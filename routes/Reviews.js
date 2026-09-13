const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success:false, message:'No token' });
    const decoded = JSON.parse(Buffer.from(token,'base64').toString());
    req.userId = decoded.id;
    req.userName = decoded.name || decoded.username || '';
    next();
  } catch(e) {
    return res.status(401).json({ success:false, message:'Invalid token' });
  }
};

// ===== SPECIFIC routes FIRST, dynamic :param routes LAST =====

// POST /api/reviews — submit a review
router.post('/', requireAuth, async (req, res) => {
  try {
    const { productId, rating, comment, userAvatar } = req.body;
    if(!productId || !rating || !comment)
      return res.json({ success:false, message:'Missing fields' });
    const conn = await pool.getConnection();
    const [existing] = await conn.query(
      'SELECT id FROM product_reviews WHERE product_id=? AND user_id=? LIMIT 1',
      [productId, req.userId]
    );
    let reviewId;
    if(existing.length){
      await conn.query(
        'UPDATE product_reviews SET rating=?, comment=?, user_avatar=?, updated_at=NOW() WHERE id=?',
        [rating, comment, userAvatar||null, existing[0].id]
      );
      reviewId = existing[0].id;
    } else {
      const [result] = await conn.query(
        `INSERT INTO product_reviews (product_id, user_id, user_name, rating, comment, user_avatar)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [productId, req.userId, req.userName, rating, comment, userAvatar||null]
      );
      reviewId = result.insertId;
    }
    conn.release();
    res.json({ success:true, reviewId });
  } catch(e) {
    console.error('POST review error:', e);
    res.json({ success:false, message:e.message });
  }
});

// POST /api/reviews/like/:reviewId — toggle like (BEFORE /:productId)
router.post('/like/:reviewId', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const reviewId = parseInt(req.params.reviewId);
    if(!reviewId){ conn.release(); return res.json({success:false,message:'Invalid review id'}); }

    const [rev] = await conn.query(
      'SELECT user_id, comment, product_id FROM product_reviews WHERE id=?',
      [reviewId]
    );
    if(!rev.length){ conn.release(); return res.json({success:false, message:'Review not found'}); }

    const ownerId = rev[0].user_id;
    if(String(ownerId) === String(req.userId)){
      conn.release();
      return res.json({success:false, message:'Cannot like own review'});
    }

    const [existing] = await conn.query(
      'SELECT id FROM review_likes WHERE review_id=? AND user_id=?',
      [reviewId, req.userId]
    );
    let liked;
    if(existing.length){
      await conn.query('DELETE FROM review_likes WHERE review_id=? AND user_id=?', [reviewId, req.userId]);
      liked = false;
    } else {
      await conn.query(
        'INSERT INTO review_likes (review_id, user_id, liker_name) VALUES (?,?,?)',
        [reviewId, req.userId, req.userName]
      );
      liked = true;
      // Notify review owner
      if(ownerId){
        const preview = (rev[0].comment||'').substring(0,60);
        await conn.query(
          `INSERT INTO notifications (user_id, type, title, message, related_id)
           VALUES (?, 'review_like', ?, ?, ?)`,
          [ownerId,
           `${req.userName||'Someone'} liked your review!`,
           `${req.userName||'Someone'} liked your review: "${preview}..."`,
           rev[0].product_id]
        ).catch(()=>{});
      }
    }

    const [cnt] = await conn.query(
      'SELECT COUNT(*) as total FROM review_likes WHERE review_id=?',
      [reviewId]
    );
    conn.release();
    res.json({ success:true, liked, likeCount: parseInt(cnt[0].total) });
  } catch(e) {
    console.error('Like error:', e);
    res.json({ success:false, message:e.message });
  }
});

// GET /api/reviews/my-likes/:productId — which reviews current user liked (BEFORE /:productId)
router.get('/my-likes/:productId', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT rl.review_id FROM review_likes rl
       JOIN product_reviews pr ON pr.id = rl.review_id
       WHERE pr.product_id=? AND rl.user_id=?`,
      [req.params.productId, req.userId]
    );
    conn.release();
    res.json({ success:true, liked: rows.map(r=>r.review_id) });
  } catch(e) {
    // review_likes table may not exist yet
    res.json({ success:true, liked:[] });
  }
});

// GET /api/reviews/:productId — get all reviews (LAST — dynamic param)
router.get('/:productId', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    // First try with like_count, fallback without if review_likes table missing
    let rows;
    try {
      [rows] = await conn.query(
        `SELECT r.id, r.product_id, r.user_id,
                COALESCE(NULLIF(r.user_name,''), u.full_name, u.name, 'Customer') AS user_name,
                r.user_avatar, r.rating, r.comment, r.created_at,
                (SELECT COUNT(*) FROM review_likes rl WHERE rl.review_id = r.id) AS like_count
         FROM product_reviews r
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.product_id = ?
         ORDER BY r.created_at DESC`,
        [req.params.productId]
      );
    } catch(e2) {
      // review_likes table might not exist — query without it
      [rows] = await conn.query(
        `SELECT r.id, r.product_id, r.user_id,
                COALESCE(NULLIF(r.user_name,''), u.full_name, u.name, 'Customer') AS user_name,
                r.user_avatar, r.rating, r.comment, r.created_at, 0 AS like_count
         FROM product_reviews r
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.product_id = ?
         ORDER BY r.created_at DESC`,
        [req.params.productId]
      );
    }
    conn.release();
    res.json({ success: true, data: rows });
  } catch(e) {
    console.error('GET reviews error:', e);
    res.json({ success: false, data: [] });
  }
});

// POST /api/reviews/update-avatar — update avatar on all reviews by this user
router.post('/update-avatar', requireAuth, async (req, res) => {
  try {
    const { userAvatar } = req.body;
    if(!userAvatar) return res.json({success:false});
    const conn = await pool.getConnection();
    await conn.query(
      'UPDATE product_reviews SET user_avatar=? WHERE user_id=?',
      [userAvatar, req.userId]
    );
    conn.release();
    res.json({ success:true });
  } catch(e) {
    console.error('update-avatar error:', e);
    res.json({ success:false });
  }
});

module.exports = router;