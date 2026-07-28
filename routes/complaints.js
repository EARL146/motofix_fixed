const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Authorization token required' });
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    req.userId = decoded.id;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// POST /api/complaints/submit  — saves type, subject, message to SQL
router.post('/submit', requireAuth, async (req, res) => {
  try {
    const { type, subject, message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    const typeNorm = type ? (type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()) : 'Complaint';
    const validType = ['Complaint','Feedback','Request'].includes(typeNorm) ? typeNorm : 'Complaint';
    const conn = await pool.getConnection();
    await conn.query(
      'INSERT INTO complaints (customer_id, type, subject, message, status) VALUES (?, ?, ?, ?, ?)',
      [req.userId, validType, subject || null, message, 'open']
    );
    conn.release();
    console.log('Complaint saved: type=' + validType + ' user=' + req.userId);
    res.json({ success: true, message: 'Submission successful' });
  } catch (error) {
    console.error('Submit complaint error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// GET /api/complaints  — get logged-in user's complaints + notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [complaints] = await conn.query(
      'SELECT * FROM complaints WHERE customer_id = ? ORDER BY created_at DESC',
      [req.userId]
    );
    conn.release();
    res.json({ success: true, data: complaints });
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/complaints/notifications  — unread notifications for user
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [notifs] = await conn.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );
    conn.release();
    res.json({ success: true, data: notifs });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/complaints/notifications/read/:id  — mark notification read
router.post('/notifications/read/:id', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    conn.release();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// DELETE /api/complaints/notifications/:id — delete single notification
router.delete('/notifications/:id', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    conn.release();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// DELETE /api/complaints/notifications — delete all notifications for user
router.delete('/notifications', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.query('DELETE FROM notifications WHERE user_id = ?', [req.userId]);
    conn.release();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// ===== REVIEW LIKES =====

// POST /api/complaints/review-like — toggle like on a review
router.post('/review-like', requireAuth, async (req, res) => {
  try {
    const { productId, reviewIdx, reviewOwnerId, likerName, commentPreview } = req.body;
    const likerId = req.userId;
    if(likerId === reviewOwnerId) return res.json({success:false, message:'Cannot like your own review'});
    const conn = await pool.getConnection();

    // Check if already liked
    const [existing] = await conn.query(
      'SELECT id FROM review_likes WHERE product_id=? AND review_idx=? AND liker_id=?',
      [productId, reviewIdx, likerId]
    );

    let liked = false;
    if(existing.length > 0){
      // Unlike
      await conn.query('DELETE FROM review_likes WHERE product_id=? AND review_idx=? AND liker_id=?',
        [productId, reviewIdx, likerId]);
      liked = false;
    } else {
      // Like
      await conn.query(
        'INSERT INTO review_likes (product_id, review_idx, review_owner_id, liker_id, liker_name, comment_preview) VALUES (?,?,?,?,?,?)',
        [productId, reviewIdx, reviewOwnerId, likerId, likerName||'Someone', (commentPreview||'').substring(0,80)]
      );
      liked = true;
      // Create notification for the review owner (if not same person)
      if(reviewOwnerId && reviewOwnerId !== likerId){
        await conn.query(
          `INSERT INTO notifications (user_id, type, title, message, related_id)
           VALUES (?, 'review_like', ?, ?, ?)
           ON DUPLICATE KEY UPDATE title=VALUES(title), message=VALUES(message), created_at=NOW()`,
          [reviewOwnerId,
           `${likerName||'Someone'} liked your review!`,
           `${likerName||'Someone'} liked your review: "${(commentPreview||'').substring(0,50)}..."`,
           productId]
        ).catch(()=>{}); // notifications table may differ, ignore errors
      }
    }

    // Get total likes for this review
    const [likeRows] = await conn.query(
      'SELECT COUNT(*) as total FROM review_likes WHERE product_id=? AND review_idx=?',
      [productId, reviewIdx]
    );
    conn.release();
    res.json({success:true, liked, likeCount: likeRows[0].total});
  } catch(e){
    console.error('review-like error:', e);
    res.json({success:false, message:e.message});
  }
});

// GET /api/complaints/review-likes/:productId — get all like counts for a product's reviews
router.get('/review-likes/:productId', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT review_idx, COUNT(*) as total FROM review_likes WHERE product_id=? GROUP BY review_idx',
      [req.params.productId]
    );
    conn.release();
    const likesMap = {};
    rows.forEach(r => { likesMap[r.review_idx] = r.total; });
    res.json({success:true, likes: likesMap});
  } catch(e){
    res.json({success:false, likes:{}});
  }
});

// GET /api/complaints/my-likes/:productId — which reviews current user has liked
router.get('/my-likes/:productId', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT review_idx FROM review_likes WHERE product_id=? AND liker_id=?',
      [req.params.productId, req.userId]
    );
    conn.release();
    const liked = rows.map(r => r.review_idx);
    res.json({success:true, liked});
  } catch(e){
    res.json({success:false, liked:[]});
  }
});
module.exports = router;
