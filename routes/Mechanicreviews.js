const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success:false, message:'No token' });
    const decoded = JSON.parse(Buffer.from(token,'base64').toString());
    req.userId   = decoded.id;
    req.userName = decoded.name || decoded.username || '';
    next();
  } catch(e) {
    return res.status(401).json({ success:false, message:'Invalid token' });
  }
};

// ── Auto-create table on startup ──────────────────────────────────────────────
const initTable = async () => {
  try {
    const conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS mechanic_reviews (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        mechanic_id INT NOT NULL,
        user_id     INT NOT NULL,
        user_name   VARCHAR(120) NOT NULL DEFAULT '',
        user_avatar TEXT NULL,
        rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment     TEXT NOT NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_mech (mechanic_id, user_id),
        INDEX idx_mechanic (mechanic_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    conn.release();
    console.log('✅ mechanic_reviews table ready');
  } catch(e) {
    console.warn('mechanic_reviews init warning:', e.message);
  }
};
initTable();

// POST /api/mechanic-reviews — submit or update a review
router.post('/', requireAuth, async (req, res) => {
  try {
    const { mechanicId, rating, comment, userAvatar } = req.body;
    if (!mechanicId || !rating || !comment)
      return res.json({ success:false, message:'Missing fields' });
    if (rating < 1 || rating > 5)
      return res.json({ success:false, message:'Rating must be 1-5' });

    const conn = await pool.getConnection();
    const [existing] = await conn.query(
      'SELECT id FROM mechanic_reviews WHERE mechanic_id=? AND user_id=? LIMIT 1',
      [mechanicId, req.userId]
    );
    let reviewId;
    if (existing.length) {
      await conn.query(
        'UPDATE mechanic_reviews SET rating=?, comment=?, user_avatar=?, updated_at=NOW() WHERE id=?',
        [rating, comment, userAvatar||null, existing[0].id]
      );
      reviewId = existing[0].id;
    } else {
      const [result] = await conn.query(
        `INSERT INTO mechanic_reviews (mechanic_id, user_id, user_name, rating, comment, user_avatar)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [mechanicId, req.userId, req.userName, rating, comment, userAvatar||null]
      );
      reviewId = result.insertId;
    }

    // Update live avg rating on mechanics table
    await conn.query(
      `UPDATE mechanics SET rating = (
         SELECT ROUND(AVG(rating),1) FROM mechanic_reviews WHERE mechanic_id=?
       ) WHERE id=?`,
      [mechanicId, mechanicId]
    ).catch(()=>{}); // non-fatal if mechanics table missing rating column

    conn.release();
    res.json({ success:true, reviewId });
  } catch(e) {
    console.error('POST mechanic-review error:', e);
    res.json({ success:false, message:e.message });
  }
});

// GET /api/mechanic-reviews/:mechanicId — get reviews + avg rating
router.get('/:mechanicId', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT r.id, r.mechanic_id, r.user_id,
              COALESCE(NULLIF(r.user_name,''), u.full_name, u.name, 'Customer') AS user_name,
              r.user_avatar, r.rating, r.comment, r.created_at
       FROM mechanic_reviews r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.mechanic_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.mechanicId]
    );
    const avgRating = rows.length
      ? rows.reduce((s,r)=>s+r.rating, 0) / rows.length
      : 0;
    conn.release();
    res.json({ success:true, data:rows, avgRating: parseFloat(avgRating.toFixed(1)), total: rows.length });
  } catch(e) {
    console.error('GET mechanic-reviews error:', e);
    res.json({ success:false, data:[], avgRating:0, total:0 });
  }
});

// GET /api/mechanic-reviews/my-review/:mechanicId — check if current user already reviewed
router.get('/my-review/:mechanicId', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT id, rating, comment FROM mechanic_reviews WHERE mechanic_id=? AND user_id=? LIMIT 1',
      [req.params.mechanicId, req.userId]
    );
    conn.release();
    res.json({ success:true, review: rows[0]||null });
  } catch(e) {
    res.json({ success:true, review:null });
  }
});

module.exports = router;