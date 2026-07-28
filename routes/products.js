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

// Get all products
router.get('/all', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    // JOIN with product_reviews to get live avg rating and review count
    const sql = `SELECT p.id, p.name, p.category AS cat, p.size, p.price, p.stock, p.image_icon,
              COALESCE(p.original_price, p.price) AS orig,
              COALESCE(p.sold_count, 0) AS sold,
              COALESCE(p.image_url, CONCAT('https://placehold.co/300x200/1a1a1a/ee4d2d?text=', REPLACE(REPLACE(p.name, ' ', '+'), '&', '%26'))) AS img,
              p.image_url2, p.image_url3,
              COALESCE(p.description, CONCAT('Description for ', p.name)) AS description,
              COALESCE(p.is_flash_sale, 0) AS is_flash_sale,
              p.brands_json, p.sizes_json,
              COALESCE(AVG(pr.rating), p.rating, 0) AS rating,
              COUNT(pr.id) AS review_count
       FROM products p
       LEFT JOIN product_reviews pr ON pr.product_id = p.id
       WHERE p.is_deleted = 0 AND p.stock > 0
       GROUP BY p.id
       ORDER BY p.category, p.name`;
    console.log('Executing product SQL:', sql.replace(/\s+/g, ' '));
    const [products] = await conn.query(sql);
    conn.release();

    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Get products error:', error);
    res.json({ success: false, message: 'Error fetching products: ' + error.message });
  }
});

// Get products by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const conn = await pool.getConnection();
    const sql = `SELECT p.id, p.name, p.category AS cat, p.size, p.price, p.stock, p.image_icon,
              COALESCE(p.original_price, p.price) AS orig,
              COALESCE(p.sold_count, 0) AS sold,
              COALESCE(p.image_url, CONCAT('https://placehold.co/300x200/1a1a1a/ee4d2d?text=', REPLACE(REPLACE(p.name, ' ', '+'), '&', '%26'))) AS img,
              p.image_url2, p.image_url3,
              COALESCE(p.description, CONCAT('Description for ', p.name)) AS description,
              COALESCE(p.is_flash_sale, 0) AS is_flash_sale,
              p.brands_json, p.sizes_json,
              COALESCE(AVG(pr.rating), p.rating, 0) AS rating,
              COUNT(pr.id) AS review_count
       FROM products p
       LEFT JOIN product_reviews pr ON pr.product_id = p.id
       WHERE p.category = ? AND p.is_deleted = 0 AND p.stock > 0
       GROUP BY p.id
       ORDER BY p.name`;
    console.log('Executing category product SQL:', sql.replace(/\s+/g, ' '), category);
    const [products] = await conn.query(sql, [category]);
    conn.release();
  
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Get category products error:', error);
    res.json({ success: false, message: 'Error fetching products' });
  }
});

// Get single product (useful for editing)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await pool.getConnection();
    const [products] = await conn.query(
      'SELECT * FROM products WHERE id = ? LIMIT 1',
      [id]
    );
    conn.release();
    if (products.length === 0) {
      return res.json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: products[0] });
  } catch (error) {
    console.error('Get product by id error:', error);
    res.json({ success: false, message: 'Error fetching product' });
  }
});

// Request product
router.post('/request', requireAuth, async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const customer_id = req.userId;
    const conn = await pool.getConnection();
    await conn.query('INSERT INTO requests (customer_id, product_id, quantity) VALUES (?, ?, ?)', [customer_id, product_id, quantity]);
    conn.release();
    res.json({ success: true, message: 'Request submitted successfully' });
  } catch (error) {
    console.error('Submit request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;