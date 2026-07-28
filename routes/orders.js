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

// POST /api/orders/create
router.post('/create', requireAuth, async (req, res) => {
  try {
    const {
      mechanicId, mechanicName, mechanicFee,
      items, subtotal, total,
      houseNo, barangay, city, province, region, postalCode,
      paymentMethod,
      gpsLat, gpsLng, gpsAccuracy, ipCity, gpsAddressMismatch
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Order items are required' });
    }

    const conn = await pool.getConnection();

    // Get customer email
    const [users] = await conn.query('SELECT email FROM users WHERE id = ?', [req.userId]);
    const customerEmail = users.length ? users[0].email : null;

    // Insert order
    const [result] = await conn.query(
      `INSERT INTO orders
       (user_id, customer_email, mechanic_id, mechanic_name, mechanic_fee,
        subtotal, total, house_no, barangay, city, province, region,
        postal_code, payment_method, status,
        gps_lat, gps_lng, gps_accuracy, ip_city, gps_mismatch)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Pending',?,?,?,?,?)`,
      [
        req.userId, customerEmail,
        mechanicId || null, mechanicName || null, mechanicFee || 0,
        subtotal || 0, total || 0,
        houseNo || '', barangay || '', city || '', province || '',
        region || '', postalCode || '', paymentMethod || 'Cash',
        gpsLat || null, gpsLng || null, gpsAccuracy || null,
        ipCity || null, gpsAddressMismatch ? 1 : 0
      ]
    );
    const orderId = result.insertId;
    console.log('Order created id=' + orderId + ' user=' + req.userId);

    // Insert order items (with product_name snapshot)
    for (const item of items) {
      // Truncate image_icon to 255 chars to avoid "Data too long" DB error
      const rawIcon = item.image_icon || item.icon || '';
      const safeIcon = rawIcon.substring(0, 255);

      // Try insert with brand column, fallback without if column missing
      try {
        await conn.query(
          `INSERT INTO order_items
           (order_id, product_id, product_name, mechanic_id, quantity, price, image_icon, size, brand)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            orderId,
            item.id || item.product_id || null,
            item.name || item.product_name || '',
            item.mechanic_id || null,
            item.quantity || 1,
            item.price || 0,
            safeIcon,
            item.size || '',
            item.brand || ''
          ]
        );
      } catch(brandErr) {
        // brand column may not exist yet — insert without it
        await conn.query(
          `INSERT INTO order_items
           (order_id, product_id, product_name, mechanic_id, quantity, price, image_icon, size)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            orderId,
            item.id || item.product_id || null,
            item.name || item.product_name || '',
            item.mechanic_id || null,
            item.quantity || 1,
            item.price || 0,
            safeIcon,
            item.size || ''
          ]
        );
      }
    }

    // Update sold_count AND deduct stock for each product ordered
    for (const item of items) {
      const productId = item.id || item.product_id;
      const qty = item.quantity || 1;
      if (productId) {
        await conn.query(
          'UPDATE products SET sold_count = sold_count + ?, stock = GREATEST(0, stock - ?) WHERE id = ?',
          [qty, qty, productId]
        );
      }
    }

    // Save delivery address to addresses table
    if (houseNo || barangay || city || province) {
      try {
        // Unset previous default
        await conn.query('UPDATE addresses SET is_default = FALSE WHERE user_id = ?', [req.userId]);
        await conn.query(
          'INSERT INTO addresses (user_id, province, city, barangay, street_house, is_default) VALUES (?,?,?,?,?,1)',
          [req.userId, province || '', city || '', barangay || '', houseNo || '']
        );
        console.log('Address saved for user ' + req.userId);
      } catch (addrErr) {
        console.error('Address save warning:', addrErr.message);
      }
    }

    // Clear the customer's cart
    await conn.query('DELETE FROM cart WHERE user_id = ?', [req.userId]);

    conn.release();
    res.json({ success: true, message: 'Order created successfully', orderId });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Error creating order: ' + error.message });
  }
});

// GET /api/orders  — logged-in user's orders with items + address
router.get('/', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [orders] = await conn.query(
      `SELECT id, mechanic_name, mechanic_fee, total, status, created_at,
              house_no, barangay, city, province, payment_method
       FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
      [req.userId]
    );
    // Attach items to each order
    for (const order of orders) {
      const [items] = await conn.query(
        `SELECT oi.product_id, oi.product_name, oi.size, oi.mechanic_id,
                COALESCE(oi.brand, '') AS brand,
                COALESCE(p.image_url2, p.image_url, p.image_icon, oi.image_icon, '') AS image_url,
                COALESCE(m.photo, '') AS mechanic_photo,
                oi.price, oi.quantity
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         LEFT JOIN mechanics m ON m.id = oi.mechanic_id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }
    conn.release();
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Error fetching orders: ' + error.message });
  }
});

// GET /api/orders/details/:orderId
router.get('/details/:orderId', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [orders] = await conn.query('SELECT * FROM orders WHERE id = ?', [req.params.orderId]);
    if (!orders.length) { conn.release(); return res.json({ success: false, message: 'Order not found' }); }

    const [items] = await conn.query(
      'SELECT product_name, size, image_icon, price, quantity FROM order_items WHERE order_id = ?',
      [req.params.orderId]
    );
    conn.release();
    res.json({ success: true, order: orders[0], items });
  } catch (error) {
    console.error('Get order details error:', error);
    res.json({ success: false, message: 'Error fetching order details' });
  }
});

// GET /api/orders/user/:userId
router.get('/user/:userId', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [orders] = await conn.query(
      'SELECT id, mechanic_name, total AS total_amount, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.params.userId]
    );
    conn.release();
    res.json({ success: true, data: orders });
  } catch (error) {
    res.json({ success: false, message: 'Error fetching orders' });
  }
});

// GET /api/orders/all — admin: all orders with items + customer info
router.get('/all', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [orders] = await conn.query(
      `SELECT o.id, o.customer_email, o.total, o.status, o.payment_method,
              o.city, o.barangay, o.house_no, o.province, o.created_at,
              o.gps_lat, o.gps_lng, o.gps_accuracy, o.ip_city, o.gps_mismatch,
              u.name AS customer_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`
    );
    // Attach items to each order
    for (const order of orders) {
      const [items] = await conn.query(
        `SELECT oi.product_name, oi.quantity, oi.price, oi.image_icon,
                p.image_icon AS product_img
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }
    conn.release();
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Admin get all orders error:', error);
    res.status(500).json({ success: false, message: 'Error fetching orders: ' + error.message });
  }
});

// POST/PUT /api/orders/cancel/:orderId
const _cancelHandler = async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [orders] = await conn.query('SELECT id, user_id, status FROM orders WHERE id = ?', [req.params.orderId]);
    if (!orders.length) { conn.release(); return res.json({ success: false, message: 'Order not found' }); }
    if (orders[0].user_id !== req.userId) { conn.release(); return res.status(403).json({ success: false, message: 'Not authorized' }); }
    if (orders[0].status && orders[0].status.toLowerCase() !== 'pending') {
      conn.release();
      return res.json({ success: false, message: 'Only pending orders can be cancelled' });
    }
    // Restore stock for each item in the cancelled order
    const [orderItems] = await conn.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [req.params.orderId]
    );
    for (const item of orderItems) {
      if (item.product_id) {
        await conn.query(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.quantity || 1, item.product_id]
        );
      }
    }
    await conn.query("UPDATE orders SET status = 'Cancelled' WHERE id = ?", [req.params.orderId]);
    conn.release();
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.json({ success: false, message: 'Error cancelling order: ' + error.message });
  }
};
router.post('/cancel/:orderId', requireAuth, _cancelHandler);
router.put('/:orderId/cancel', requireAuth, _cancelHandler);



// DELETE /api/orders/:orderId — admin: permanently delete an order
router.delete('/:orderId', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const orderId = req.params.orderId;
    // Delete order items first (foreign key)
    await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    const [result] = await conn.query('DELETE FROM orders WHERE id = ?', [orderId]);
    conn.release();
    if (result.affectedRows === 0) {
      return res.json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ success: false, message: 'Error deleting order: ' + error.message });
  }
});

// PATCH /api/orders/:orderId/status — admin: update order status
router.patch('/:orderId/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending','Processing','Shipped','Delivered','Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.json({ success: false, message: 'Invalid status' });
    }
    const conn = await pool.getConnection();
    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.orderId]);
    conn.release();
    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating status' });
  }
});

// GET /api/orders/debug-address — check raw address fields in orders
router.get('/debug-address', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [orders] = await conn.query(
      `SELECT id, customer_email, house_no, barangay, city, province, region, status, created_at
       FROM orders ORDER BY created_at DESC LIMIT 20`
    );
    conn.release();
    res.json({ success: true, total: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// GET /api/orders/geocode?q=address — proxy for Nominatim with queue + cache
const _geocodeCache = {};
const _geocodeQueue = [];
let _geocodeBusy = false;

async function _processGeocodeQueue() {
  if (_geocodeBusy || _geocodeQueue.length === 0) return;
  _geocodeBusy = true;
  while (_geocodeQueue.length > 0) {
    const { q, resolve } = _geocodeQueue.shift();
    // Return cache hit immediately
    if (_geocodeCache[q]) { resolve({ success: true, result: _geocodeCache[q], cached: true }); continue; }
    try {
      const https = require('https');
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=ph`;
      const data = await new Promise((res2, rej) => {
        https.get(url, { headers: { 'User-Agent': 'MotoFixApp/1.0' } }, (r) => {
          let body = '';
          r.on('data', chunk => body += chunk);
          r.on('end', () => { try { res2(JSON.parse(body)); } catch(e){ res2([]); } });
          r.on('error', rej);
        }).on('error', rej);
      });
      if (data && data[0]) {
        const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        _geocodeCache[q] = result;
        resolve({ success: true, result });
      } else {
        resolve({ success: false });
      }
    } catch(e) {
      resolve({ success: false, error: e.message });
    }
    // Respect Nominatim rate limit: 1 req/sec
    await new Promise(r => setTimeout(r, 1100));
  }
  _geocodeBusy = false;
}

router.get('/geocode', requireAuth, async (req, res) => {
  const q = req.query.q || '';
  if (!q) return res.json({ success: false });
  // Return from cache immediately
  if (_geocodeCache[q]) return res.json({ success: true, result: _geocodeCache[q], cached: true });
  // Queue the request
  const result = await new Promise(resolve => {
    _geocodeQueue.push({ q, resolve });
    _processGeocodeQueue();
  });
  res.json(result);
});

module.exports = router;