const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

// Ensure public/images directory exists for uploads
const imagesDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Import database
const pool = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const mechanicsRoutes = require('./routes/mechanics');
const ordersRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const addressesRoutes = require('./routes/addresses');
const favoritesRoutes = require('./routes/favorites');
const cartRoutes = require('./routes/cart');
const complaintsRoutes = require('./routes/complaints');
const flashsaleRoutes  = require('./routes/flashsale');
const reviewsRoutes    = require('./routes/Reviews');
const mechReviewsRoutes = require('./routes/Mechanicreviews');
const { router: securityRouter, securityMiddleware } = require('./routes/security');

const app = express();
app.set("trust proxy", true);
const PORT = process.env.PORT || 3000;

// Test database connection on startup
const testDatabase = async () => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT 1');

    // migration: rename legacy `desc` column to `description` if it still exists
    try {
      await conn.query("ALTER TABLE products CHANGE `desc` description TEXT");
      console.log('🔧 Renamed legacy `desc` column to `description`');
    } catch (mErr) {
      if (mErr.code !== 'ER_BAD_FIELD_ERROR' && mErr.code !== 'ER_DUP_FIELDNAME') {
        console.warn('Migration warning (desc rename):', mErr.message);
      }
    }

    // migration: add avatar_data column to users if not exists
    try {
      await conn.query("ALTER TABLE users ADD COLUMN avatar_data LONGTEXT NULL");
      console.log('✅ avatar_data column added to users');
    } catch(e) { /* already exists */ }

    // migration: add GPS columns to orders if not exists — required so the
    // customer's real device location is actually persisted with each order
    try {
      await conn.query(`ALTER TABLE orders
        ADD COLUMN gps_lat DECIMAL(10,7) NULL,
        ADD COLUMN gps_lng DECIMAL(10,7) NULL,
        ADD COLUMN gps_accuracy DECIMAL(10,2) NULL,
        ADD COLUMN ip_city VARCHAR(100) NULL,
        ADD COLUMN gps_mismatch TINYINT(1) DEFAULT 0`);
      console.log('✅ GPS columns (gps_lat, gps_lng, gps_accuracy, ip_city, gps_mismatch) added to orders');
    } catch(e) { /* already exist */ }

    // migration: create shop_settings table (single row, id=1) — previously
    // the admin "Save Settings" button was a fake alert() with no real storage
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS shop_settings (
          id             INT PRIMARY KEY DEFAULT 1,
          shop_name      VARCHAR(150) DEFAULT 'MotoMarket',
          email          VARCHAR(150) DEFAULT '',
          contact_number VARCHAR(50)  DEFAULT '',
          address        VARCHAR(255) DEFAULT '',
          updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await conn.query(
        `INSERT INTO shop_settings (id, shop_name, email, contact_number, address)
         VALUES (1, 'MotoMarket', 'admin@motofix.com', '+63 912 345 6789', '123 Davao City, Philippines')
         ON DUPLICATE KEY UPDATE id = id`
      );
      console.log('✅ shop_settings table ready');
    } catch(e) { console.warn('shop_settings migration warning:', e.message); }

    // migration: add brands_json + sizes_json columns to products
    try {
      await conn.query("ALTER TABLE products ADD COLUMN brands_json LONGTEXT NULL");
      console.log('✅ brands_json column added to products');
    } catch(e) { /* already exists */ }
    try {
      await conn.query("ALTER TABLE products ADD COLUMN sizes_json LONGTEXT NULL");
      console.log('✅ sizes_json column added to products');
    } catch(e) { /* already exists */ }

    // migration: create flash_sales table if not exists
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS flash_sales (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          mode       ENUM('single','group','all') NOT NULL DEFAULT 'single',
          disc_pct   DECIMAL(5,2) NOT NULL,
          product_id INT NULL,
          category   VARCHAR(100) NULL,
          start_time DATETIME NOT NULL,
          end_time   DATETIME NOT NULL,
          status     ENUM('active','stopped','ended') NOT NULL DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('✅ flash_sales table ready');
    } catch (fsErr) {
      console.warn('Migration warning (flash_sales):', fsErr.message);
    }

    // migration: fix broken Amazon image URLs
    try {
      await conn.query(`
        UPDATE products
        SET image_url = CONCAT('https://placehold.co/300x200/1a1a1a/ee4d2d?text=', REPLACE(REPLACE(name,' ','+'),'&','%26'))
        WHERE image_url LIKE '%m.media-amazon.com%'
           OR image_url LIKE '%amazon.com%'
      `);
      console.log('✅ Amazon image URLs replaced with placeholders');
    } catch(e) { console.warn('Migration warning (amazon imgs):', e.message); }

    // migration: ensure admin user exists (credentials from .env)
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPass  = process.env.ADMIN_PASSWORD;
      if (adminEmail && adminPass) {
        const bcrypt = require('bcryptjs');
        const [admins] = await conn.query('SELECT id FROM users WHERE email=? LIMIT 1', [adminEmail]);
        if (admins.length === 0) {
          const hash = await bcrypt.hash(adminPass, 10);
          await conn.query(
            "INSERT INTO users (full_name, name, email, phone_number, password_hash, role) VALUES (?,?,?,?,?,?)",
            ['Admin', 'Admin', adminEmail, '09000000000', hash, 'admin']
          );
          console.log('✅ Admin user created from .env');
        } else {
          console.log('✅ Admin user exists');
        }
      } else {
        console.warn('WARNING: ADMIN_EMAIL or ADMIN_PASSWORD not set in .env');
      }
    } catch (adminErr) {
      console.warn('Migration warning (admin user):', adminErr.message);
    }

    // migration: create chat tables if not exists
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          session_id VARCHAR(64) NOT NULL,
          user_id INT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          session_id VARCHAR(64) NOT NULL,
          role ENUM('user','assistant') NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('✅ chat tables ready');
    } catch(e) { console.warn('Chat tables warning:', e.message); }

    // migration: create password_resets table
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          token VARCHAR(64) NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user (user_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('✅ password_resets table ready');
    } catch(e) { console.warn('password_resets:', e.message); }

    conn.release();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Run: node db_init.js');
    return false;
  }
};

// Middleware
app.use(cors({
  origin: true, // Allow all origins (same-server requests always work)
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public', 'images'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,   // 10MB per file
    fieldSize: 50 * 1024 * 1024,  // 50MB per field (needed for base64 brand images in JSON)
    fields: 50                     // allow many text fields
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Security middleware — runs on every request
app.use('/api', securityMiddleware);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/mechanics', mechanicsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin', (req, res, next) => {
  req.upload = upload;
  next();
}, adminRoutes);
app.use('/api/addresses', addressesRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/flashsale',  flashsaleRoutes);
app.use('/api/reviews',    reviewsRoutes);
app.use('/api/mechanic-reviews', mechReviewsRoutes);
app.use('/api/complaints', complaintsRoutes);

// AI Chat proxy — Gemini (free tier)
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, image } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.json({ success: false, message: 'AI chat not configured. Add GROQ_API_KEY to .env' });

    const SYSTEM = `Ikaw si MotoMarket Buddy — ang opisyal, friendly, at professional na AI assistant ng MotoMarket. Isa kang customer support specialist ng isang motorcycle parts at repair shop sa Pilipinas na may base sa Davao de Oro.

=== TUNGKOL SA DEVELOPER ===
Ang buong MotoFix system ay ginawa ni Earlnis Willan A. Pajo, isang Computer Programming student mula sa Davao de Oro. Ginawa niya ito noong March 15, 2026 para mapabuti at mapadali ang sistema ng negosyo at mapaunlad ang teknolohiya sa kanilang komunidad. Siya ay isang passionate at talented na batang developer na nakatuon sa pagbuo ng mga praktikal na digital solutions para sa mga lokal na negosyo.

=== TUNGKOL SA MOTOFIX ===
Ang MotoMarket ay isang online motorcycle parts shop at repair service. Nagbibigay kami ng:
• Motorcycle parts at accessories
• Oil at fluids para sa iba't ibang uri ng motorsiklo
• Tires at wheels
• Electrical components
• Maintenance tools at supplies
• Mechanic booking service para sa mga repairs

=== CUSTOMER ACCOUNT FEATURES ===

PAGPAPAREHISTRO AT LOGIN:
- Mag-click ng "Register" para gumawa ng bagong account. Kailangan: full name, email address, phone number, at password.
- Mag-login gamit ang registered email at password.
- Kung nakalimutan ang password, gamitin ang "Forgot Password" option.
- Pagkatapos mag-login, makikita ang profile icon sa kanang bahagi ng navbar.

PROFILE MANAGEMENT:
- I-click ang profile icon para buksan ang Profile Dropdown.
- Pumunta sa "Edit Profile" para baguhin ang pangalan, email, o phone number.
- Maaaring mag-upload ng profile photo — i-click ang camera icon sa profile picture.
- Ang avatar/profile photo ay naka-save sa cloud para makita kahit saan mag-login.
- May "Change Password" option sa profile settings.

PAMAMAHALA NG ADDRESS:
- Pumunta sa Profile > My Addresses para mag-manage ng delivery addresses.
- Maaaring magdagdag ng maraming address (bahay, opisina, etc.).
- Bawat address ay kailangan ng: Province, City/Municipality, Barangay, Street Address, at Postal Code.
- Maaaring mag-set ng default address para mas mabilis ang checkout.
- Maaaring mag-edit o mag-delete ng mga naka-save na address.

=== PAMIMILI (SHOPPING) ===

PAG-BROWSE NG PRODUKTO:
- Ang home page ay nagpapakita ng mga featured products, flash sales, at top-rated items.
- Gamitin ang category navigation: Parts, Oil & Fluids, Tires, Electrical, Accessories, Maintenance, Tools.
- May search bar sa navbar para hanapin ang specific na produkto.
- Ang bawat product card ay nagpapakita ng presyo, rating, at available variants.
- I-click ang product para makita ang full details, images, description, at reviews.

PRODUCT DETAILS PAGE:
- Makikita ang multiple product images (may slideshow/gallery).
- May brand options at size options para sa ilang produkto (halimbawa: tires may sizes, oils may volume).
- Makikita ang average star rating at lahat ng customer reviews.
- May "Add to Cart" button at "Add to Favorites" (heart icon) button.
- Makikita ang related/similar products sa ibaba.

FLASH SALES:
- Ang Flash Sales ay mga limitadong oras na diskwento sa mga piling produkto.
- May countdown timer para malaman kung gaano na katagal ang sale.
- Ang discounted price ay makikita sa product card (may strikethrough sa original price).
- Maaaring single product sale, category-wide sale, o all-products sale.
- Mag-check ng Flash Sales section sa home page para hindi mapagod ang mga deals.

FAVORITES:
- I-click ang heart icon sa kahit anong produkto para i-save sa Favorites.
- Pumunta sa navbar > Favorites icon para makita lahat ng saved products.
- Maaaring direktang mag-add to cart mula sa Favorites page.
- Maaaring mag-remove ng products mula sa Favorites list.

=== CART AT CHECKOUT ===

CART MANAGEMENT:
- I-click ang cart icon sa navbar para buksan ang Cart Dropdown.
- Makikita ang lahat ng items sa cart — produkto, quantity, presyo, at selected mechanic (kung meron).
- Maaaring baguhin ang quantity o mag-remove ng items sa cart.
- Makikita ang cart total bago mag-checkout.
- I-click ang "Checkout" button para magpatuloy sa pagbabayad.

CHECKOUT PROCESS (Step-by-Step):
1. DELIVERY ADDRESS — Pumili mula sa iyong saved addresses O maglagay ng bagong address (Province, City, Barangay, Street, Postal Code).
2. MECHANIC BOOKING (Optional) — Pumili ng mechanic kung kailangan ng installation o repair service. Makikita ang mechanic name, specialty, at service fee.
3. PAYMENT METHOD — Pumili ng Cash on Delivery (COD) o GCash.
4. ORDER REVIEW — I-review ang lahat ng items, address, mechanic, at total amount bago mag-place ng order.
5. PLACE ORDER — I-click ang "Place Order" button para ma-confirm ang order.

PAYMENT METHODS:
- Cash on Delivery (COD): Bayaran ang delivery rider sa oras ng pagdating ng order.
- GCash: Digital payment. Kailangan ng GCash account na may sapat na balance.

=== MECHANIC BOOKING ===

PAANO MAG-BOOK NG MECHANIC:
- Sa cart o checkout, makikita ang "Add Mechanic" option.
- Pumili ng mechanic mula sa listahan ng available mechanics.
- Bawat mechanic ay may profile na nagpapakita ng: pangalan, specialty, rating, at service fee.

MGA SPECIALTY NG MECHANIC:
• General Motor Repair — pangkalahatang motorcycle repairs at maintenance
• Electrical & Wiring — electrical system, wiring issues, battery problems
• Tire & Wheels Specialist — tire change, balancing, wheel alignment
• Welding Specialist — metal fabrication at welding repairs
• Engine Overhaul — complete engine rebuild at major repairs

MECHANIC SERVICE FEE:
- Ang service fee ng mechanic ay naka-separate sa presyo ng produkto.
- Makikita ang total na kasama ang service fee bago mag-checkout.
- Ang mechanic ay ibibigay sa bahay mo kasama ang delivery.

=== ORDERS ===

PAANO MAKITA ANG MGA ORDERS:
- I-click ang Profile > My Orders o pumunta sa Orders section.
- Makikita ang lahat ng past at current orders.
- Bawat order ay may order number, date, items, total amount, at status.

ORDER STATUS FLOW:
1. PENDING — Natanggap ang order, hinihintay ang confirmation ng shop.
2. PROCESSING — Inihahanda na ang order sa bodega/shop.
3. SHIPPED — Nasa daan na ang order papunta sa iyong address.
4. DELIVERED — Natanggap na ang order. Maaari nang mag-review ng produkto.
5. CANCELLED — Kinansela ang order (ng customer o ng shop).

REVIEWS AFTER DELIVERY:
- Pagkatapos ma-DELIVERED ang order, makakita ng "Leave a Review" button.
- Mag-rate ng 1-5 stars at mag-lagay ng written review para sa bawat produkto.
- Ang reviews ay makikita ng lahat ng customers sa product page.
- Maaari lang mag-review ang mga customers na nakapag-order ng produkto (verified purchase).

=== COMPLAINTS AT FEEDBACK ===

PAANO MAG-SUBMIT:
- Pumunta sa Profile > Complaints & Feedback.
- Pumili ng uri ng submission:
  • COMPLAINT — Para sa mga problema, isyu, o hindi magandang experience.
  • FEEDBACK — Para sa mga mungkahi, komento, o general na feedback.
  • REQUEST — Para sa mga special na kahilingan o requests sa shop.
- Isulat ang iyong mensahe at i-submit.
- Ang admin ng MotoFix ay makakatanggap at tutugon sa iyong submission.

=== NOTIFICATIONS ===
- Ang bell icon sa navbar ay nagpapakita ng mga notifications.
- Makakatanggap ng notification kapag:
  • Na-confirm ang order (Pending → Processing)
  • Naka-ship na ang order (Processing → Shipped)
  • Na-deliver na ang order (Shipped → Delivered)
  • May update sa order status

=== SETTINGS AT PERSONALIZATION ===

LANGUAGE OPTIONS:
- English (default)
- Filipino (Tagalog)
- Cebuano
- Japanese (日本語)
- Chinese (中文)
- Korean (한국어)

THEME OPTIONS:
- Dark Mode / Light Mode toggle
- Color themes: Orange (default), Violet, Red, Brown, Yellow, Slate

Para mag-access ng settings: I-click ang profile icon > Settings.

=== SECURITY RULES — BAWAL LABAGAN ===
- HUWAG KAILANMAN ibigay ang kahit anong admin account info, admin password, o admin login credentials.
- HUWAG sabihin kung paano mag-access ng admin panel, admin dashboard, o admin features.
- HUWAG ibigay ang mga teknikal na detalye ng system: database credentials, API keys, server info, environment variables.
- HUWAG sabihin ang mga internal route paths ng admin o admin-only endpoints.
- Kung may nagtanong tungkol sa admin access o admin account: "Para sa admin concerns, makipag-ugnayan sa aming shop directly."
- Ang chatbot na ito ay para sa CUSTOMER SUPPORT LAMANG. Hindi ito may access sa admin system.

=== BEHAVIOR RULES ===
1. Kung tatanungin kung sino ang gumawa — laging sabihin si Earlnis Willan A. Pajo.
2. Kung galit o frustrated ang user — sumagot ng maayos at professional:
   "Pasensya na kung may frustration sa iyong tanong. Bilang AI assistant ng MotoFix, nakaprogram ako para tumulong sa impormasyon at support lamang. Hindi ako makapagbibigay ng sagot na lalabag sa aming mga patakaran. Kung may kailangan kang tulong tungkol sa MotoFix services, handa akong tumulong."
3. Huwag magsalita ng masama o makakasakit.
4. Huwag magkomento negatibo tungkol sa ibang shops o competitors.
5. Laging professional, mainit, at kapaki-pakinabang.
6. Sumasagot sa Filipino, Cebuano, o English awtomatiko — anuman ang ginagamit ng user.
7. Presyo laging sa Philippine Peso (₱).
8. Maaaring makipag-usap sa general topics, jokes, at pangkalahatang tanong — hindi lang MotoFix topics.
9. Kung hindi sigurado sa sagot — huwag mag-imbento. Sabihing "Para sa mas tiyak na impormasyon, makipag-ugnayan sa aming shop directly."`

    // Build messages for Groq (OpenAI-compatible format)
    const groqMessages = [{ role: 'system', content: SYSTEM }];

    const history = (messages || []).slice(0, -1);
    history.forEach(m => {
      groqMessages.push({ role: m.role, content: m.content });
    });

    // Last user message — may include image (Llama 4 Scout supports vision)
    const lastMsg = messages && messages.length ? messages[messages.length - 1] : null;
    if (lastMsg) {
      if (image) {
        groqMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: lastMsg.content || 'What is in this image?' },
            { type: 'image_url', image_url: { url: image } }
          ]
        });
      } else {
        groqMessages.push({ role: 'user', content: lastMsg.content });
      }
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: image ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile',
        messages: groqMessages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (data.error) return res.json({ success: false, message: data.error.message });
    const reply = data?.choices?.[0]?.message?.content || 'Sorry, I could not get a response.';

    // Save to database
    try {
      const sessionId = req.body.sessionId || ('sess_' + Date.now());
      const userId = req.body.userId || null;
      const conn2 = await pool.getConnection();

      // Ensure session exists — use INSERT or UPDATE
      const [existing] = await conn2.query(
        `SELECT id FROM chat_sessions WHERE session_id = ? LIMIT 1`, [sessionId]
      );
      if (existing.length === 0) {
        await conn2.query(
          `INSERT INTO chat_sessions (session_id, user_id) VALUES (?, ?)`,
          [sessionId, userId]
        );
      } else {
        await conn2.query(
          `UPDATE chat_sessions SET updated_at = NOW() WHERE session_id = ?`, [sessionId]
        );
      }

      // Save user message (only the last one to avoid duplicates)
      const lastUserMsg = messages && messages.length ? messages[messages.length - 1] : null;
      if (lastUserMsg && lastUserMsg.role === 'user') {
        await conn2.query(
          `INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', ?)`,
          [sessionId, lastUserMsg.content]
        );
      }

      // Save assistant reply
      await conn2.query(
        `INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'assistant', ?)`,
        [sessionId, reply]
      );

      conn2.release();
      console.log('✅ Chat saved — session:', sessionId, '| messages in DB');
      res.json({ success: true, reply, sessionId });
    } catch(dbErr) {
      console.error('❌ Chat DB save error:', dbErr.message);
      res.json({ success: true, reply });
    }
  } catch(e) {
    console.error('Groq chat error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

// GET /api/chat/history — admin: get all chat sessions
app.get('/api/chat/history', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [sessions] = await conn.query(`
      SELECT cs.session_id, cs.created_at, cs.updated_at,
             u.full_name AS user_name, u.email AS user_email,
             COUNT(cm.id) AS message_count,
             MAX(cm.created_at) AS last_message_at
      FROM chat_sessions cs
      LEFT JOIN users u ON u.id = cs.user_id
      LEFT JOIN chat_messages cm ON cm.session_id = cs.session_id
      GROUP BY cs.session_id
      ORDER BY last_message_at DESC
      LIMIT 100
    `);
    conn.release();
    res.json({ success: true, data: sessions });
  } catch(e) {
    res.json({ success: false, message: e.message });
  }
});

// GET /api/chat/history/:sessionId — get messages of a session
app.get('/api/chat/history/:sessionId', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [messages] = await conn.query(
      `SELECT role, content, created_at FROM chat_messages
       WHERE session_id = ? ORDER BY created_at ASC`,
      [req.params.sessionId]
    );
    conn.release();
    res.json({ success: true, data: messages });
  } catch(e) {
    res.json({ success: false, message: e.message });
  }
});
app.use('/api/complaints', complaintsRoutes);
// AI Security proxy — uses Groq (free)
app.post('/api/security/ai', async (req, res) => {
  try {
    const { messages, systemContext } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.json({ success: false, reply: 'GROQ_API_KEY not set in .env file.' });

app.use('/api/security', securityRouter);



    const SYSTEM = `You are MotoFix Security AI, an expert security assistant for a motorcycle shop admin dashboard running on a Node.js/ngrok server. Your job:
1. CUSTOMER COMPLIANCE: Flag customers missing phone numbers, alert admin to contact them for delivery.
2. SUSPICIOUS ORDERS: Analyze GPS mismatches, rapid repeat orders, unusual patterns.
3. SERVER SECURITY: Monitor brute force attempts, blocked IPs, SQL injection, XSS attacks, rate abuse on the ngrok tunnel.
Be concise, professional, and actionable. Use bullet points. Recommend specific actions.
Current system data: ${JSON.stringify(systemContext || {})}`;

    const groqMessages = [{ role: 'system', content: SYSTEM }];
    (messages || []).forEach(m => groqMessages.push({ role: m.role, content: m.content }));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: groqMessages, max_tokens: 800, temperature: 0.4 })
    });

    const data = await response.json();
    if (data.error) return res.json({ success: false, reply: data.error.message });
    const reply = data?.choices?.[0]?.message?.content || 'No response.';
    res.json({ success: true, reply });
  } catch(e) {
    console.error('Security AI error:', e.message);
    res.json({ success: false, reply: 'Server error: ' + e.message });
  }
});

// Static files (after API routes to prevent conflicts)
app.use(express.static(path.join(__dirname, 'public')));

// Serve setup page
app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all route middleware for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Server error' });
});

// Start server with database check
const startServer = async () => {
  const dbConnected = await testDatabase();
  
  if (!dbConnected) {
    console.error('\n⚠️  WARNING: Database connection failed!');
    console.error('If this is your first time, run: node db_init.js\n');
  }

  app.listen(PORT, () => {
    console.log(`\n🏍️  MotoMarket Server running at http://localhost:${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
};

try {
  startServer();
} catch (error) {
  console.error('Error starting server:', error);
}