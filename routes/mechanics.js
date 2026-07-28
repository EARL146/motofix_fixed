const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

// GET /api/mechanics/all
router.get('/all', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [mechanics] = await conn.query(
      `SELECT m.id, m.name, m.specialty, m.icon, m.photo, m.fee, m.available, m.experience_years,
              COALESCE(AVG(mr.rating), m.rating, 0) AS rating,
              COUNT(mr.id) AS review_count
       FROM mechanics m
       LEFT JOIN mechanic_reviews mr ON mr.mechanic_id = m.id
       GROUP BY m.id
       ORDER BY m.available DESC, rating DESC`
    );
    conn.release();
    res.json({ success: true, data: mechanics });
  } catch (error) {
    // Fallback: mechanic_reviews table may not exist yet on first boot
    try {
      const conn = await pool.getConnection();
      const [mechanics] = await conn.query(
        'SELECT id, name, specialty, icon, photo, fee, rating, available, experience_years FROM mechanics ORDER BY available DESC, rating DESC'
      );
      conn.release();
      res.json({ success: true, data: mechanics });
    } catch(e2) {
      console.error('Get mechanics error:', e2);
      res.json({ success: false, message: 'Error fetching mechanics' });
    }
  }
});

// GET /api/mechanics/:id
router.get('/:id', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [mechanics] = await conn.query(
      'SELECT id, name, specialty, icon, photo, fee, rating, available, experience_years FROM mechanics WHERE id=?',
      [req.params.id]
    );
    conn.release();
    if (!mechanics.length) return res.json({ success: false, message: 'Mechanic not found' });
    res.json({ success: true, data: mechanics[0] });
  } catch (error) {
    res.json({ success: false, message: 'Error fetching mechanic' });
  }
});

module.exports = router;