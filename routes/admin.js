const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

// ══════════════════════════════════════════════════════════════
// DASHBOARD STATS — GET /api/admin/stats
// Returns all dynamic numbers for the admin dashboard
// ══════════════════════════════════════════════════════════════
// DEBUG — GET /api/admin/debug-orders  (delete after fixing)
router.get('/debug-orders', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [orderCols] = await conn.query('SHOW COLUMNS FROM orders');
    const [itemCols]  = await conn.query('SHOW COLUMNS FROM order_items');
    const [prodCols]  = await conn.query('SHOW COLUMNS FROM products');
    const [userCols]  = await conn.query('SHOW COLUMNS FROM users');

    // Try the simplest possible orders query
    let testError = null;
    try {
      await conn.query('SELECT id, status, total FROM orders LIMIT 1');
    } catch(e) { testError = e.message; }

    conn.release();
    res.json({
      orderColumns:   orderCols.map(c=>c.Field+' '+c.Type),
      orderItemCols:  itemCols.map(c=>c.Field+' '+c.Type),
      productCols:    prodCols.map(c=>c.Field+' '+c.Type),
      userCols:       userCols.map(c=>c.Field+' '+c.Type),
      simpleQueryOk:  testError === null,
      simpleQueryErr: testError,
    });
  } catch(e) {
    if (conn) try { conn.release(); } catch(_) {}
    res.json({ fatal: e.message });
  }
});

router.get('/stats', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const year = parseInt(req.query.year) || new Date().getFullYear();

    // Helper: safe query that returns 0 on error
    const safeCount = async (sql, params=[]) => {
      try {
        const [[row]] = await conn.query(sql, params);
        return Object.values(row)[0] || 0;
      } catch(e) { console.warn('safeCount error:', e.message); return 0; }
    };
    const safeRows = async (sql, params=[]) => {
      try {
        const [rows] = await conn.query(sql, params);
        return rows || [];
      } catch(e) { console.warn('safeRows error:', e.message); return []; }
    };

    // Orders
    const totalOrders  = await safeCount('SELECT COUNT(*) AS v FROM orders WHERE YEAR(created_at)=?', [year]);
    const thisWeek     = await safeCount('SELECT COUNT(*) AS v FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const lastWeek     = await safeCount('SELECT COUNT(*) AS v FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const weekPct      = lastWeek > 0 ? (((thisWeek - lastWeek) / lastWeek) * 100).toFixed(1) : (thisWeek > 0 ? 100 : 0);

    // Revenue
    const totalRevenue = await safeCount("SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE status NOT IN ('Cancelled')");
    const thisMonth    = await safeCount("SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW()) AND status NOT IN ('Cancelled')");
    const lastMonth    = await safeCount("SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE MONTH(created_at)=MONTH(DATE_SUB(NOW(),INTERVAL 1 MONTH)) AND YEAR(created_at)=YEAR(DATE_SUB(NOW(),INTERVAL 1 MONTH)) AND status NOT IN ('Cancelled')");
    const monthPct     = lastMonth > 0 ? (((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1) : (thisMonth > 0 ? 100 : 0);

    // Customers
    const totalCustomers = await safeCount("SELECT COUNT(*) AS v FROM users WHERE role='customer'");
    const newToday       = await safeCount("SELECT COUNT(*) AS v FROM users WHERE role='customer' AND DATE(created_at)=CURDATE()");

    // Mechanics
    const totalMechanics     = await safeCount('SELECT COUNT(*) AS v FROM mechanics');
    const availableMechanics = await safeCount('SELECT COUNT(*) AS v FROM mechanics WHERE available=1');

    // Feedback
    const cntComplaints = await safeCount("SELECT COUNT(*) AS v FROM complaints WHERE type='Complaint'");
    const cntFeedback   = await safeCount("SELECT COUNT(*) AS v FROM complaints WHERE type='Feedback'");
    const cntRequests   = await safeCount("SELECT COUNT(*) AS v FROM complaints WHERE type='Request'");
    const cntResolved   = await safeCount("SELECT COUNT(*) AS v FROM complaints WHERE status='resolved'");

    // Monthly revenue
    const monthlyRows = await safeRows(`
      SELECT DATE_FORMAT(created_at,'%b') AS month,
             MONTH(created_at) AS mNum,
             COALESCE(SUM(total),0) AS revenue
      FROM orders
      WHERE YEAR(created_at)=? AND status NOT IN ('Cancelled')
      GROUP BY MONTH(created_at), DATE_FORMAT(created_at,'%b')
      ORDER BY MONTH(created_at)
    `, [year]);

    // Service types
    const serviceRows = await safeRows(`
      SELECT COALESCE(m.specialty,'Parts / Product') AS service, COUNT(*) AS cnt
      FROM orders o
      LEFT JOIN mechanics m ON o.mechanic_id = m.id
      WHERE YEAR(o.created_at)=?
      GROUP BY service ORDER BY cnt DESC LIMIT 6
    `, [year]);

    // Top product
    const topProductRows = await safeRows(`
      SELECT p.name, COALESCE(SUM(oi.quantity),0) AS totalSold
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      GROUP BY oi.product_id ORDER BY totalSold DESC LIMIT 1
    `);

    // Recent orders
    const recentOrders = await safeRows(`
      SELECT o.id, o.status, o.total, o.created_at,
             COALESCE(u.name, u.email, 'Unknown') AS customer_name,
             u.email AS customer_email,
             o.mechanic_name, o.payment_method
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC LIMIT 5
    `);

    conn.release();

    res.json({
      success: true,
      stats: {
        totalOrders, weekPct: parseFloat(weekPct),
        totalRevenue: parseFloat(totalRevenue), monthPct: parseFloat(monthPct),
        totalCustomers, newToday,
        totalMechanics, availableMechanics,
        cntComplaints, cntFeedback, cntRequests, cntResolved,
      },
      monthlyRevenue: monthlyRows,
      serviceTypes: serviceRows,
      topProduct: topProductRows[0] || null,
      recentOrders,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    if (conn) try { conn.release(); } catch(e) {}
    res.status(500).json({ success: false, message: 'Error fetching stats: ' + error.message });
  }
});


// ══════════════════════════════════════════════════════════════
// REVENUE CHART — GET /api/admin/revenue?mode=week|month|year
// ══════════════════════════════════════════════════════════════
router.get('/revenue', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const mode = req.query.mode || 'month';
    let sql, params = [], labels = [], values = [];

    if (mode === 'week') {
      // Last 7 days — Filipino day names
      const [rows] = await conn.query(`
        SELECT DAYOFWEEK(created_at) AS dow,
               DATE(created_at) AS day,
               COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          AND status NOT IN ('Cancelled')
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `);
      // Filipino day names: DAYOFWEEK 1=Sun,2=Mon,...7=Sat
      const filDays = ['Domingo','Lunes','Martes','Miyerkules','Huwebes','Biyernes','Sabado'];
      const map = {};
      rows.forEach(r => { map[r.day.toISOString ? r.day.toISOString().split('T')[0] : String(r.day).split('T')[0]] = parseFloat(r.revenue); });
      for(let i=6; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate()-i);
        const key = d.toISOString().split('T')[0];
        labels.push(filDays[d.getDay()]);
        values.push(map[key] || 0);
      }

    } else if (mode === 'year') {
      // All 12 months of current year
      const year = new Date().getFullYear();
      const [rows] = await conn.query(`
        SELECT MONTH(created_at) AS mnum,
               COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE YEAR(created_at) = ?
          AND status NOT IN ('Cancelled')
        GROUP BY MONTH(created_at)
        ORDER BY MONTH(created_at) ASC
      `, [year]);
      const allMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const map = {};
      rows.forEach(r => { map[parseInt(r.mnum)] = parseFloat(r.revenue); });
      labels = allMonths;
      values = allMonths.map((m, i) => map[i + 1] || 0);

    } else {
      // Month (default) — all 12 months of current year
      const year = new Date().getFullYear();
      const [rows] = await conn.query(`
        SELECT MONTH(created_at) AS mnum,
               DATE_FORMAT(created_at,'%b') AS label,
               COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE YEAR(created_at) = ?
          AND status NOT IN ('Cancelled')
        GROUP BY MONTH(created_at)
        ORDER BY MONTH(created_at) ASC
      `, [year]);
      const allMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const map = {};
      rows.forEach(r => { map[r.label] = parseFloat(r.revenue); });
      labels = allMonths;
      values = allMonths.map(m => map[m] || 0);
    }

    conn.release();
    res.json({ success: true, labels, values });
  } catch(err) {
    console.error('Revenue chart error:', err);
    if(conn) try { conn.release(); } catch(e) {}
    res.json({ success: false, message: err.message, labels: [], values: [] });
  }
});

// ══════════════════════════════════════════════════════════════
// COMPLAINTS — GET /api/admin/complaints.php
// ══════════════════════════════════════════════════════════════
router.get('/complaints.php', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [complaints] = await conn.query(`
      SELECT c.id, c.type, c.subject, c.message, c.status, c.admin_response, c.resolved_at, c.created_at,
             COALESCE(u.name, u.email, 'Unknown') AS customer_name,
             u.email AS customer_email,
             u.phone_number AS phone
      FROM complaints c
      LEFT JOIN users u ON c.customer_id = u.id
      ORDER BY c.created_at DESC
    `);
    conn.release();
    res.json({ success: true, data: complaints });
  } catch (error) {
    console.error('Fetch complaints error:', error);
    res.json({ success: false, message: 'Error fetching complaints', data: [] });
  }
});

// POST /api/admin/complaints.php  — resolve, update status, reply
router.post('/complaints.php', async (req, res) => {
  console.log('[complaints POST] body:', req.body);
  const { action, id, status, admin_response } = req.body;
  if (!id) return res.json({ success: false, message: 'ID is required' });

  try {
    const conn = await pool.getConnection();

    if (action === 'resolve') {
      await conn.query(
        "UPDATE complaints SET status='resolved', admin_response=?, resolved_at=NOW() WHERE id=?",
        [admin_response || 'Your submission has been resolved by admin.', id]
      );

      // Get customer_id and complaint details to create a notification
      const [rows] = await conn.query('SELECT customer_id, type, subject FROM complaints WHERE id=?', [id]);
      if (rows.length) {
        const { customer_id, type, subject } = rows[0];
        const title   = 'Your ' + type + ' has been resolved';
        const message = admin_response || 'Admin has reviewed and resolved your ' + type.toLowerCase() + (subject ? ': "' + subject + '"' : '') + '.';
        await conn.query(
          'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?,?,?,?,?)',
          [customer_id, 'resolved', title, message, id]
        );
        console.log('Notification sent to user ' + customer_id + ' for complaint ' + id);
      }
      conn.release();
      return res.json({ success: true, message: 'Complaint resolved and customer notified' });
    }

    if (action === 'update_status') {
      await conn.query('UPDATE complaints SET status=? WHERE id=?', [status || 'open', id]);
      conn.release();
      return res.json({ success: true, message: 'Status updated' });
    }

    if (action === 'delete') {
      await conn.query('DELETE FROM complaints WHERE id=?', [parseInt(id)]);
      conn.release();
      return res.json({ success: true, message: 'Entry deleted' });
    }

    if (action === 'edit') {
      const { type, subject, message, status: newStatus } = req.body;
      const validType = ['Complaint','Feedback','Request'].includes(type) ? type : null;
      const validStatus = ['open','resolved'].includes(newStatus) ? newStatus : (newStatus === 'In Review' ? 'open' : null);
      const sets = [];
      const vals = [];
      if (validType)    { sets.push('type=?');    vals.push(validType); }
      if (subject)      { sets.push('subject=?'); vals.push(subject); }
      if (message)      { sets.push('message=?'); vals.push(message); }
      if (validStatus)  { sets.push('status=?');  vals.push(validStatus); }
      if (sets.length) {
        vals.push(id);
        await conn.query('UPDATE complaints SET ' + sets.join(',') + ' WHERE id=?', vals);
      }
      conn.release();
      return res.json({ success: true, message: 'Entry updated' });
    }

    conn.release();
    res.json({ success: false, message: 'Unknown action' });
  } catch (error) {
    console.error('Admin complaints action error:', error);
    res.json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ══════════════════════════════════════════════════════════════
// CUSTOMERS
// ══════════════════════════════════════════════════════════════
router.get('/customers.php', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    // Ensure avatar_data column exists before querying
    try {
      await conn.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data LONGTEXT');
    } catch(e) { /* column already exists or not supported — ignore */ }
    const [customers] = await conn.query(
      "SELECT id, COALESCE(name, email, '?') AS name, email, phone_number AS phone, role, created_at, avatar_data FROM users WHERE role != ? ORDER BY created_at DESC",
      ['admin']
    );
    conn.release();
    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Fetch customers error:', error);
    // Fallback: return customers without avatar_data if column truly missing
    try {
      const conn2 = await pool.getConnection();
      const [customers] = await conn2.query(
        "SELECT id, COALESCE(name, email, '?') AS name, email, phone_number AS phone, role, created_at, NULL AS avatar_data FROM users WHERE role != ? ORDER BY created_at DESC",
        ['admin']
      );
      conn2.release();
      return res.json({ success: true, data: customers });
    } catch(e2) {
      return res.json({ success: false, data: [] });
    }
  }
});

// ══════════════════════════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════════════════════════
router.get('/products.php', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [products] = await conn.query(
      'SELECT id, name, category, brands_json, sizes_json, price, stock, image_icon, image_url, image_url2, image_url3, description, rating, sold_count, is_flash_sale FROM products WHERE is_deleted=0 ORDER BY category, name'
    );
    conn.release();
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Fetch products error:', error);
    res.json({ success: false, data: [] });
  }
});

router.post('/products.php', async (req, res) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return new Promise((resolve) => {
      req.upload.fields([
        { name: 'productImage1', maxCount: 1 },
        { name: 'productImage2', maxCount: 1 },
        { name: 'productImage3', maxCount: 1 },
        { name: 'productImages', maxCount: 3 }
      ])(req, res, async (err) => {
        if (err) { res.json({ success: false, message: 'File upload error: ' + err.message }); return resolve(); }
        await handleProductAction(req, res);
        resolve();
      });
    });
  }
  await handleProductAction(req, res);
});

async function handleProductAction(req, res) {
  const { action } = req.body;
  try {
    const conn = await pool.getConnection();
    if (action === 'add') {
      const { name, category, size, brand, price, orig_price, stock, icon, description, rating } = req.body;
      if (!name || !price || stock === undefined) { conn.release(); return res.json({ success: false, message: 'Name, price, and stock are required' }); }
      const priceNum    = parseFloat(price);
      const origPrice   = orig_price ? parseFloat(orig_price) : priceNum;
      const stockNum    = parseInt(stock);
      const ratingNum   = rating ? parseFloat(rating) : 0;
      if (isNaN(priceNum) || priceNum <= 0) { conn.release(); return res.json({ success: false, message: 'Price must be positive' }); }
      if (isNaN(stockNum) || stockNum < 0)  { conn.release(); return res.json({ success: false, message: 'Stock must be non-negative' }); }

      let imagePath = icon || '🔧';
      let imageUrl  = null;
      let imageUrl2 = null;
      let imageUrl3 = null;
      if (req.files) {
        if (req.files.productImage1 && req.files.productImage1[0]) imageUrl  = '/images/' + req.files.productImage1[0].filename;
        else if (req.files.productImages && req.files.productImages[0]) imageUrl = '/images/' + req.files.productImages[0].filename;
        if (req.files.productImage2 && req.files.productImage2[0]) imageUrl2 = '/images/' + req.files.productImage2[0].filename;
        else if (req.files.productImages && req.files.productImages[1]) imageUrl2 = '/images/' + req.files.productImages[1].filename;
        if (req.files.productImage3 && req.files.productImage3[0]) imageUrl3 = '/images/' + req.files.productImage3[0].filename;
        else if (req.files.productImages && req.files.productImages[2]) imageUrl3 = '/images/' + req.files.productImages[2].filename;
        if (imageUrl) imagePath = '🔧';
      }

      await conn.query(
        'INSERT INTO products (name, category, brands_json, sizes_json, price, stock, image_icon, image_url, image_url2, image_url3, original_price, rating, sold_count, description, is_flash_sale) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,0)',
        [name.trim(), category || 'General', req.body.brands||'[]', req.body.sizes||'[]', priceNum, stockNum, imagePath, imageUrl, imageUrl2, imageUrl3, origPrice, ratingNum, description || null]
      );
      console.log('Product added: ' + name);
      conn.release();
      return res.json({ success: true, message: 'Product added successfully' });
    }

    if (action === 'edit') {
      const { id, name, category, size, price, orig_price, stock, icon, description, rating,
              existingImg1, existingImg2, existingImg3 } = req.body;
      if (!id || !name || !price || stock === undefined) { conn.release(); return res.json({ success: false, message: 'ID, name, price, stock are required' }); }
      const priceNum  = parseFloat(price);
      const origPrice = orig_price ? parseFloat(orig_price) : priceNum;
      const stockNum  = parseInt(stock);
      const ratingNum = rating ? parseFloat(rating) : 0;
      const imagePath = icon || '🔧';

      // New uploaded files take priority per slot; fall back to existing URLs
      let imageUrl  = existingImg1 || null;
      let imageUrl2 = existingImg2 || null;
      let imageUrl3 = existingImg3 || null;
      if (req.files) {
        if (req.files.productImage1 && req.files.productImage1[0]) imageUrl  = '/images/' + req.files.productImage1[0].filename;
        if (req.files.productImage2 && req.files.productImage2[0]) imageUrl2 = '/images/' + req.files.productImage2[0].filename;
        if (req.files.productImage3 && req.files.productImage3[0]) imageUrl3 = '/images/' + req.files.productImage3[0].filename;
      }

      await conn.query(
        'UPDATE products SET name=?,category=?,brands_json=?,sizes_json=?,price=?,stock=?,image_icon=?,image_url=?,image_url2=?,image_url3=?,original_price=?,rating=?,description=? WHERE id=?',
        [name.trim(), category||'General', req.body.brands||'[]', req.body.sizes||'[]', priceNum, stockNum, imagePath, imageUrl, imageUrl2, imageUrl3, origPrice, ratingNum, description||null, id]
      );
      conn.release();
      return res.json({ success: true, message: 'Product updated successfully' });
    }

    if (action === 'delete') {
      const { id } = req.body;
      if (!id) { conn.release(); return res.json({ success: false, message: 'Product ID required' }); }
      await conn.query('UPDATE products SET is_deleted=1 WHERE id=?', [id]);
      conn.release();
      return res.json({ success: true, message: 'Product deleted' });
    }

    conn.release();
    res.json({ success: false, message: 'Invalid action' });
  } catch (error) {
    console.error('Product admin error:', error);
    res.json({ success: false, message: 'Server error: ' + error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// MECHANICS
// ══════════════════════════════════════════════════════════════
router.get('/mechanics.php', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [mechanics] = await conn.query(
      'SELECT id, name, specialty, icon, photo, fee, available, rating, experience_years FROM mechanics ORDER BY available DESC, rating DESC'
    );
    conn.release();
    res.json({ success: true, data: mechanics });
  } catch (error) {
    console.error('Fetch mechanics error:', error);
    res.json({ success: false, data: [] });
  }
});

router.post('/mechanics.php', (req, res, next) => {
  req.upload.single('mechanicPhoto')(req, res, (err) => {
    if (err) return res.json({ success: false, message: 'File upload error: ' + err.message });
    next();
  });
}, async (req, res) => {
  const { action } = req.body;
  try {
    const conn = await pool.getConnection();

    if (action === 'add') {
      const { name, specialty, fee } = req.body;
      if (!name || !specialty || !fee) { conn.release(); return res.json({ success: false, message: 'Name, specialty, and fee are required' }); }
      const feeNum = parseFloat(fee);
      if (isNaN(feeNum) || feeNum <= 0) { conn.release(); return res.json({ success: false, message: 'Fee must be positive' }); }

      // Allow mechanics with same name (removed duplicate check)

      // photo: save as image_url in photo column; icon stays emoji
      let photoPath = null;
      let iconVal   = '👨‍🔧';
      if (req.file) {
        photoPath = '/images/' + req.file.filename;
      }

      const expYears = parseInt(req.body.experience_years || 0) || 0;
      await conn.query(
        'INSERT INTO mechanics (name, specialty, fee, icon, photo, rating, available, experience_years) VALUES (?,?,?,?,?,5.0,1,?)',
        [name.trim(), specialty.trim(), feeNum, iconVal, photoPath, expYears]
      );
      console.log('Mechanic added: ' + name);
      conn.release();
      return res.json({ success: true, message: 'Mechanic added successfully' });
    }

    if (action === 'edit') {
      const { id, name, specialty, fee, icon } = req.body;
      if (!id || !name || !specialty || !fee) { conn.release(); return res.json({ success: false, message: 'ID, name, specialty, fee required' }); }
      const feeNum = parseFloat(fee);

      let photoPath = req.body.photo || null;
      if (req.file) photoPath = '/images/' + req.file.filename;

      await conn.query(
        'UPDATE mechanics SET name=?, specialty=?, fee=?, icon=?, photo=?, experience_years=?, available=? WHERE id=?',
        [name.trim(), specialty.trim(), feeNum, icon || '👨‍🔧', photoPath, parseInt(req.body.experience_years||0)||0, (req.body.available==='1'||req.body.available===1)?1:0, id]
      );
      conn.release();
      return res.json({ success: true, message: 'Mechanic updated' });
    }

    if (action === 'toggle') {
      const { id } = req.body;
      await conn.query('UPDATE mechanics SET available = IF(available=1,0,1) WHERE id=?', [id]);
      conn.release();
      return res.json({ success: true, message: 'Availability toggled' });
    }

    if (action === 'delete') {
      const { id } = req.body;
      await conn.query('DELETE FROM mechanics WHERE id=?', [id]);
      conn.release();
      return res.json({ success: true, message: 'Mechanic deleted' });
    }

    conn.release();
    res.json({ success: false, message: 'Invalid action' });
  } catch (error) {
    console.error('Mechanics admin error:', error);
    res.json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ══════════════════════════════════════════════════════════════
// ORDERS — GET all orders with customer address
// ══════════════════════════════════════════════════════════════
router.get('/orders.php', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [orders] = await conn.query(`SELECT * FROM orders ORDER BY created_at DESC`);

    for (const order of orders) {
      try {
        const [users] = await conn.query(
          `SELECT name, email, phone_number FROM users WHERE id = ? LIMIT 1`, [order.user_id]
        );
        order.customer_name  = users[0]?.name || 'Unknown';
        order.customer_email = users[0]?.email || order.customer_email || '';
        order.customer_phone = users[0]?.phone_number || order.customer_phone || '';
      } catch(e) { order.customer_name = 'Unknown'; }

      try {
        const [items] = await conn.query(
          `SELECT oi.product_name, oi.quantity, oi.price, oi.size,
                  COALESCE(p.image_url, '') AS image_url,
                  COALESCE(p.image_icon, oi.image_icon, '') AS image_icon
           FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = ?`, [order.id]
        );
        order.items = items;
      } catch(e) { order.items = []; }

      order.delivery_address = [order.house_no, order.barangay, order.city, order.province, order.region]
        .filter(Boolean).join(', ');
    }

    conn.release();
    res.json({ success: true, data: orders });
  } catch (error) {
    if (conn) try { conn.release(); } catch(e) {}
    console.error('Admin orders GET error:', error.message);
    res.status(500).json({ success: false, message: error.message, data: [] });
  }
});

router.post('/orders.php', async (req, res) => {
  const action = req.body.action;
  const id     = req.body.id;
  const status = req.body.status;
  let conn;
  try {
    conn = await pool.getConnection();

    if (action === 'delete') {
      if (!id) { conn.release(); return res.json({ success: false, message: 'Order ID required' }); }
      await conn.query('DELETE FROM order_items WHERE order_id = ?', [id]);
      await conn.query('DELETE FROM orders WHERE id = ?', [id]);
      conn.release();
      return res.json({ success: true, message: 'Order deleted' });
    }

    if (action === 'update_status') {
      const valid = ['Pending','Coming','Confirmed','In Progress','Completed','Cancelled','Done'];
      if (!valid.includes(status)) { conn.release(); return res.json({ success: false, message: 'Invalid status' }); }
      await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
      conn.release();
      return res.json({ success: true, message: 'Status updated' });
    }

    conn.release();
    res.json({ success: false, message: 'Unknown action' });
  } catch (error) {
    if (conn) try { conn.release(); } catch(e) {}
    console.error('Admin orders POST error:', error.message);
    res.json({ success: false, message: error.message });
  }
});

router.delete('/orders.php', async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) return res.json({ success: false, message: 'Order ID required' });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('DELETE FROM order_items WHERE order_id = ?', [id]);
    await conn.query('DELETE FROM orders WHERE id = ?', [id]);
    conn.release();
    res.json({ success: true, message: 'Order deleted' });
  } catch (error) {
    if (conn) try { conn.release(); } catch(e) {}
    console.error('Delete order error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════
// CART — admin view: who added what
// ══════════════════════════════════════════════════════════════
router.get('/cart.php', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [cartItems] = await conn.query(`
      SELECT c.id, c.user_id, c.quantity, c.added_at,
             COALESCE(u.name, u.email, 'Unknown') AS customer_name,
             u.email AS customer_email,
             p.name AS product_name, p.price, p.category, p.image_url
      FROM cart c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN products p ON c.product_id = p.id
      ORDER BY c.added_at DESC
    `);
    conn.release();
    res.json({ success: true, data: cartItems });
  } catch (error) {
    console.error('Fetch admin cart error:', error);
    res.json({ success: false, data: [] });
  }
});

// ══════════════════════════════════════════════════════════════
// VISITORS
// ══════════════════════════════════════════════════════════════
router.get('/visitors.php', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [visitors] = await conn.query(
      'SELECT id, visitor_name, ip_address, page, visited_at FROM visitors ORDER BY visited_at DESC'
    );
    conn.release();
    res.json({ success: true, data: visitors });
  } catch (error) {
    res.json({ success: false, data: [] });
  }
});

// ══════════════════════════════════════════════════════════════
// SHOP SETTINGS
// ══════════════════════════════════════════════════════════════
router.get('/settings.php', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM shop_settings WHERE id = 1 LIMIT 1');
    conn.release();
    res.json({ success: true, data: rows[0] || null });
  } catch (error) {
    console.error('Fetch shop settings error:', error);
    res.json({ success: false, message: error.message });
  }
});

router.post('/settings.php', async (req, res) => {
  try {
    const { shopName, email, contactNumber, address } = req.body;
    const conn = await pool.getConnection();
    await conn.query(
      `INSERT INTO shop_settings (id, shop_name, email, contact_number, address)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE shop_name=VALUES(shop_name), email=VALUES(email),
         contact_number=VALUES(contact_number), address=VALUES(address)`,
      [shopName || '', email || '', contactNumber || '', address || '']
    );
    conn.release();
    res.json({ success: true, message: 'Shop settings saved' });
  } catch (error) {
    console.error('Save shop settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════
// ADMIN → CUSTOMER MESSAGES / NOTIFICATIONS
// ══════════════════════════════════════════════════════════════
// POST /api/admin/notify.php — send a new notification to one customer or
// broadcast to every customer. Reuses the existing `notifications` table
// that the storefront's bell-icon dropdown already polls.
router.post('/notify.php', async (req, res) => {
  try {
    const { userId, title, message } = req.body;
    if (!title || !title.trim() || !message || !message.trim()) {
      return res.json({ success: false, message: 'Title and message are required' });
    }
    const conn = await pool.getConnection();

    if (!userId || userId === 'all') {
      // Broadcast to every non-admin user
      const [customers] = await conn.query("SELECT id FROM users WHERE role != 'admin'");
      for (const c of customers) {
        await conn.query(
          'INSERT INTO notifications (user_id, type, title, message) VALUES (?,?,?,?)',
          [c.id, 'admin_message', title.trim(), message.trim()]
        );
      }
      conn.release();
      return res.json({ success: true, message: 'Notification sent to ' + customers.length + ' customer(s)' });
    }

    await conn.query(
      'INSERT INTO notifications (user_id, type, title, message) VALUES (?,?,?,?)',
      [userId, 'admin_message', title.trim(), message.trim()]
    );
    conn.release();
    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('Send admin notification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════
// CUSTOMER-FACING SHORTCUTS (kept for backward compat)
// ══════════════════════════════════════════════════════════════
router.get('/customer/products.php', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [products] = await conn.query('SELECT id,name,category,brands_json,sizes_json,price,stock,image_icon,image_url,image_url2,image_url3,description,rating,sold_count,is_flash_sale FROM products WHERE is_deleted=0 ORDER BY category,name');
    conn.release();
    res.json({ success: true, data: products });
  } catch (error) { res.json({ success: false, data: [] }); }
});

router.get('/customer/mechanics.php', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [mechanics] = await conn.query('SELECT id,name,specialty,icon,photo,fee,available,rating,experience_years FROM mechanics ORDER BY available DESC, rating DESC');
    conn.release();
    res.json({ success: true, data: mechanics });
  } catch (error) { res.json({ success: false, data: [] }); }
});


// LOW STOCK ALERT — GET /api/admin/low-stock
router.get('/low-stock', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT id, name, stock, category FROM products WHERE is_deleted=0 AND stock <= 10 ORDER BY stock ASC LIMIT 10'
    );
    conn.release();
    res.json({ success: true, data: rows });
  } catch(e) {
    res.json({ success: false, data: [] });
  }
});

  odule.exports = router;