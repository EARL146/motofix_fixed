const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    req.userId = decoded.id;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// GET /api/addresses
router.get('/', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [addresses] = await conn.query(
      'SELECT id, province, city, barangay, street_house, postal_code, is_default, created_at, updated_at FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [req.userId]
    );
    conn.release();
    res.json({ success: true, addresses });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch addresses' });
  }
});

// POST /api/addresses
router.post('/', requireAuth, async (req, res) => {
  try {
    const { province, city, barangay, street_house, postal_code, is_default } = req.body;
    if (!barangay || !street_house) {
      return res.status(400).json({ success: false, message: 'Barangay and street/house are required' });
    }
    const conn = await pool.getConnection();
    // One address per user — if already has one, update it instead of inserting
    const [existing] = await conn.query('SELECT id FROM addresses WHERE user_id = ? LIMIT 1', [req.userId]);
    let addressId;
    if (existing.length > 0) {
      addressId = existing[0].id;
      await conn.query(
        'UPDATE addresses SET province=?, city=?, barangay=?, street_house=?, postal_code=?, is_default=1, updated_at=NOW() WHERE id=? AND user_id=?',
        [province||'', city||'', barangay, street_house, postal_code||'', addressId, req.userId]
      );
    } else {
      await conn.query('UPDATE addresses SET is_default = FALSE WHERE user_id = ?', [req.userId]);
      const [result] = await conn.query(
        'INSERT INTO addresses (user_id, province, city, barangay, street_house, postal_code, is_default) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [req.userId, province||'', city||'', barangay, street_house, postal_code||'']
      );
      addressId = result.insertId;
    }
    conn.release();
    console.log('Address saved for user ' + req.userId + ' id=' + addressId);
    res.status(201).json({ success: true, message: 'Address saved', addressId });
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ success: false, message: 'Failed to save address' });
  }
});

// PUT /api/addresses/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { province, city, barangay, street_house, postal_code, is_default } = req.body;
    const conn = await pool.getConnection();
    const [existing] = await conn.query('SELECT id FROM addresses WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing.length) { conn.release(); return res.status(404).json({ success: false, message: 'Address not found' }); }
    if (is_default) {
      await conn.query('UPDATE addresses SET is_default = FALSE WHERE user_id = ? AND id != ?', [req.userId, req.params.id]);
    }
    await conn.query(
      'UPDATE addresses SET province=?, city=?, barangay=?, street_house=?, postal_code=?, is_default=?, updated_at=NOW() WHERE id=? AND user_id=?',
      [province||'', city||'', barangay, street_house, postal_code||'', is_default ? 1 : 0, req.params.id, req.userId]
    );
    conn.release();
    res.json({ success: true, message: 'Address updated' });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ success: false, message: 'Failed to update address' });
  }
});

// DELETE /api/addresses/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.query('DELETE FROM addresses WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    conn.release();
    res.json({ success: true, message: 'Address deleted' });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
});

// PATCH /api/addresses/:id/default
router.patch('/:id/default', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.query('UPDATE addresses SET is_default = FALSE WHERE user_id = ?', [req.userId]);
    await conn.query('UPDATE addresses SET is_default = TRUE WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    conn.release();
    res.json({ success: true, message: 'Default address updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to set default' });
  }
});

module.exports = router;
