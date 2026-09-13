const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

// Auth middleware
const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success:false, message:'No token' });
    const decoded = JSON.parse(Buffer.from(token,'base64').toString());
    req.userId = decoded.id;
    next();
  } catch(e) {
    return res.status(401).json({ success:false, message:'Invalid token' });
  }
};

// GET /api/flashsale — public, returns all active sales with product info
router.get('/', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    // Use MySQL NOW() so timezone is consistent with DB server
    const [sales] = await conn.query(`
      SELECT fs.id, fs.mode, fs.disc_pct, fs.category, fs.start_time, fs.end_time,
             fs.product_id,
             p.name AS product_name, p.price AS orig_price,
             COALESCE(p.image_url,'') AS product_img,
             COALESCE(p.image_icon,'🔧') AS product_emoji,
             p.category AS product_cat,
             ROUND(p.price * (1 - fs.disc_pct/100)) AS disc_price
      FROM flash_sales fs
      LEFT JOIN products p ON p.id = fs.product_id AND fs.mode = 'single'
      WHERE fs.status = 'active' AND fs.end_time > NOW() AND fs.start_time <= NOW()
    `);

    // Enrich all modes with product list
    const enriched = [];
    for (const sale of sales) {
      if (sale.mode === 'single' && sale.product_id) {
        // Fetch full product details for single mode (ensures price/image always available)
        const [prods] = await conn.query(
          `SELECT id, name, price, COALESCE(image_url,'') AS image_url, COALESCE(image_icon,'🔧') AS image_icon, category
           FROM products WHERE id=? AND is_deleted=0 LIMIT 1`, [sale.product_id]
        );
        if (prods.length) {
          const p = prods[0];
          // Overwrite with fresh DB values so orig_price is never 0
          sale.orig_price = parseFloat(p.price) || sale.orig_price || 0;
          sale.disc_price = Math.round(sale.orig_price * (1 - sale.disc_pct / 100));
          sale.product_name = p.name || sale.product_name;
          sale.product_img  = p.image_url || sale.product_img || '';
          sale.product_emoji= p.image_icon || sale.product_emoji || '🔧';
          sale.products = [p];
        }
      } else if (sale.mode === 'group' && sale.category) {
        const [prods] = await conn.query(
          `SELECT id, name, price, COALESCE(image_url,'') AS image_url, COALESCE(image_icon,'\U0001f527') AS image_icon, category
           FROM products WHERE category=? AND is_deleted=0`, [sale.category]
        );
        sale.products = prods;
        // Set orig_price and disc_price based on first product price
        if (prods.length) {
          sale.orig_price = parseFloat(prods[0].price) || 0;
          sale.disc_price = sale.orig_price > 0 ? Math.round(sale.orig_price * (1 - sale.disc_pct / 100)) : 0;
        }
      } else if (sale.mode === 'all') {
        const [prods] = await conn.query(
          `SELECT id, name, price, COALESCE(image_url,'') AS image_url, COALESCE(image_icon,'\U0001f527') AS image_icon, category
           FROM products WHERE is_deleted=0`
        );
        sale.products = prods;
        // Set orig_price and disc_price based on first product price
        if (prods.length) {
          sale.orig_price = parseFloat(prods[0].price) || 0;
          sale.disc_price = sale.orig_price > 0 ? Math.round(sale.orig_price * (1 - sale.disc_pct / 100)) : 0;
        }
      }
      enriched.push(sale);
    }

    conn.release();
    res.json({ success:true, data: enriched });
  } catch(e) {
    console.error('GET /flashsale error:', e);
    res.json({ success:false, message: e.message });
  }
});

// GET /api/flashsale/all — admin: all sales
router.get('/all', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [sales] = await conn.query(`
      SELECT fs.*, p.name AS product_name, p.price AS orig_price,
             COALESCE(p.image_url,'') AS product_img,
             COALESCE(p.image_icon,'🔧') AS product_emoji,
             ROUND(p.price*(1-fs.disc_pct/100)) AS disc_price
      FROM flash_sales fs
      LEFT JOIN products p ON p.id = fs.product_id AND fs.mode = 'single'
      ORDER BY fs.created_at DESC
    `);
    // For group/all modes in admin view, get a sample product count & name
    for (const sale of sales) {
      if (sale.mode === 'group' && sale.category) {
        const [cnt] = await conn.query(
          `SELECT COUNT(*) as c FROM products WHERE category=? AND is_deleted=0`, [sale.category]
        );
        sale.product_count = cnt[0].c;
        sale.orig_price = null;
        sale.disc_price = null;
      } else if (sale.mode === 'all') {
        const [cnt] = await conn.query(`SELECT COUNT(*) as c FROM products WHERE is_deleted=0`);
        sale.product_count = cnt[0].c;
        sale.orig_price = null;
        sale.disc_price = null;
      } else if (sale.mode === 'single' && sale.product_id && (!sale.orig_price)) {
        // fallback if JOIN returned null price
        const [pr] = await conn.query(`SELECT price FROM products WHERE id=? LIMIT 1`, [sale.product_id]);
        if (pr.length) {
          sale.orig_price = parseFloat(pr[0].price);
          sale.disc_price = Math.round(sale.orig_price * (1 - sale.disc_pct / 100));
        }
      }
    }
    conn.release();
    res.json({ success:true, data: sales });
  } catch(e) {
    res.json({ success:false, message: e.message });
  }
});

// POST /api/flashsale — create new sale (admin)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { mode, disc_pct, product_id, category, start_time, end_time } = req.body;
    if(!disc_pct||!start_time||!end_time) return res.json({success:false,message:'Missing fields'});
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      `INSERT INTO flash_sales (mode, disc_pct, product_id, category, start_time, end_time, status)
       VALUES (?,?,?,?,?,?,'active')`,
      [mode||'single', disc_pct, product_id||null, category||null, start_time, end_time]
    );
    conn.release();
    res.json({ success:true, id: result.insertId });
  } catch(e) {
    res.json({ success:false, message: e.message });
  }
});

// PUT /api/flashsale/:id — edit sale (admin)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { mode, disc_pct, product_id, category, start_time, end_time } = req.body;
    const conn = await pool.getConnection();
    await conn.query(
      `UPDATE flash_sales SET mode=?, disc_pct=?, product_id=?, category=?, start_time=?, end_time=?, status='active'
       WHERE id=?`,
      [mode||'single', disc_pct, product_id||null, category||null, start_time, end_time, req.params.id]
    );
    conn.release();
    res.json({ success:true });
  } catch(e) {
    res.json({ success:false, message: e.message });
  }
});

// PATCH /api/flashsale/:id/stop — stop sale (admin)
router.patch('/:id/stop', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.query(`UPDATE flash_sales SET status='stopped' WHERE id=?`, [req.params.id]);
    conn.release();
    res.json({ success:true });
  } catch(e) {
    res.json({ success:false, message: e.message });
  }
});

// DELETE /api/flashsale/:id — delete sale record (admin)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.query(`DELETE FROM flash_sales WHERE id=?`, [req.params.id]);
    conn.release();
    res.json({ success:true });
  } catch(e) {
    res.json({ success:false, message: e.message });
  }
});

module.exports = router;