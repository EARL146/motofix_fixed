const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Authentication middleware
const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization token required' });
    }
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Get user's cart
router.get('/', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [cartItems] = await conn.query(`
      SELECT c.id, c.product_id, c.mechanic_id, c.quantity, c.added_at,
             p.name, p.price, p.image_url, p.category,
             m.name as mechanic_name
      FROM cart c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN mechanics m ON c.mechanic_id = m.id
      WHERE c.user_id = ?
      ORDER BY c.added_at DESC
    `, [req.userId]);
    conn.release();
    res.json({ success: true, data: cartItems });
  } catch (error) {
    console.error('Get cart error:', error);
    res.json({ success: false, message: 'Error fetching cart' });
  }
});

// Add item to cart
router.post('/add', requireAuth, async (req, res) => {
  try {
    const { productId, mechanicId, quantity = 1 } = req.body;
    const conn = await pool.getConnection();

    // Check if item already in cart
    const [existing] = await conn.query(
      'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?',
      [req.userId, productId]
    );

    if (existing.length > 0) {
      // Update quantity
      await conn.query(
        'UPDATE cart SET quantity = quantity + ?, mechanic_id = ? WHERE id = ?',
        [quantity, mechanicId || null, existing[0].id]
      );
      conn.release();
      res.json({ success: true, message: 'Item added to cart', cartItemId: existing[0].id });
    } else {
      // Insert new
      const [result] = await conn.query(
        'INSERT INTO cart (user_id, product_id, mechanic_id, quantity) VALUES (?, ?, ?, ?)',
        [req.userId, productId, mechanicId || null, quantity]
      );
      conn.release();
      res.json({ success: true, message: 'Item added to cart', cartItemId: result.insertId });
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    res.json({ success: false, message: 'Error adding to cart' });
  }
});

// Update cart item quantity
router.put('/update/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, mechanicId } = req.body;
    const conn = await pool.getConnection();

    await conn.query(
      'UPDATE cart SET quantity = ?, mechanic_id = ? WHERE id = ? AND user_id = ?',
      [quantity, mechanicId || null, id, req.userId]
    );

    conn.release();
    res.json({ success: true, message: 'Cart updated' });
  } catch (error) {
    console.error('Update cart error:', error);
    res.json({ success: false, message: 'Error updating cart' });
  }
});

// Clear cart  ← must be registered BEFORE /:id so it isn't captured as id=""
router.delete('/clear', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.query('DELETE FROM cart WHERE user_id = ?', [req.userId]);
    conn.release();
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.json({ success: false, message: 'Error clearing cart' });
  }
});

// Remove single item from cart
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await pool.getConnection();

    await conn.query('DELETE FROM cart WHERE id = ? AND user_id = ?', [id, req.userId]);

    conn.release();
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.json({ success: false, message: 'Error removing item' });
  }
});

module.exports = router;