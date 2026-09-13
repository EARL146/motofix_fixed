const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Middleware to check if user is authenticated
const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Decode token
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// GET /api/favorites - Get all favorites for the logged-in user
router.get('/', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [favorites] = await conn.query(`
      SELECT f.id, f.product_id, f.created_at,
             p.name as product_name, p.price, p.image_icon, p.category
      FROM favorites f
      JOIN products p ON f.product_id = p.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `, [req.userId]);
    conn.release();

    res.json({
      success: true,
      data: favorites
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch favorites' });
  }
});

// POST /api/favorites - Add a product to favorites
router.post('/', requireAuth, async (req, res) => {
  try {
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const conn = await pool.getConnection();

    // Check if already favorited
    const [existing] = await conn.query(
      'SELECT id FROM favorites WHERE user_id = ? AND product_id = ?',
      [req.userId, product_id]
    );

    if (existing.length > 0) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Product already in favorites'
      });
    }

    // Add to favorites
    await conn.query(
      'INSERT INTO favorites (user_id, product_id) VALUES (?, ?)',
      [req.userId, product_id]
    );

    conn.release();

    res.json({
      success: true,
      message: 'Product added to favorites'
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ success: false, message: 'Failed to add favorite' });
  }
});

// DELETE /api/favorites/:productId - Remove a product from favorites
router.delete('/:productId', requireAuth, async (req, res) => {
  try {
    const productId = req.params.productId;

    const conn = await pool.getConnection();
    const result = await conn.query(
      'DELETE FROM favorites WHERE user_id = ? AND product_id = ?',
      [req.userId, productId]
    );
    conn.release();

    if (result[0].affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Favorite not found'
      });
    }

    res.json({
      success: true,
      message: 'Product removed from favorites'
    });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ success: false, message: 'Failed to remove favorite' });
  }
});

module.exports = router;