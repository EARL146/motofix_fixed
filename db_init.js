const mysql = require('mysql2/promise');
require('dotenv').config();

const run = async () => {
  console.log('MotoFix DB Setup...');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
  });

  const db = process.env.DB_NAME || 'motofix_db';
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${db}\``);
  console.log('Database ready: ' + db);

  await conn.query(`CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(100), name VARCHAR(100),
    email VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(20) NOT NULL, phone VARCHAR(20),
    password VARCHAR(255), password_hash VARCHAR(255),
    role ENUM('admin','customer') DEFAULT 'customer',
    avatar_data LONGTEXT, otp_code VARCHAR(6), otp_expiry DATETIME,
    is_logged_in BOOLEAN DEFAULT 0, last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('users table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL, category VARCHAR(50), size VARCHAR(100),
    price DECIMAL(10,2) NOT NULL, stock INT DEFAULT 0,
    image_icon VARCHAR(20), image_url VARCHAR(500),
    original_price DECIMAL(10,2), rating DECIMAL(3,2) DEFAULT 0,
    sold_count INT DEFAULT 0, description TEXT,
    is_flash_sale TINYINT DEFAULT 0, is_deleted TINYINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('products table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS mechanics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL, specialty VARCHAR(100),
    icon VARCHAR(20), photo VARCHAR(500),
    fee DECIMAL(10,2), available BOOLEAN DEFAULT 1,
    rating DECIMAL(3,1) DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('mechanics table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL, customer_email VARCHAR(100),
    mechanic_id INT, mechanic_name VARCHAR(100),
    mechanic_fee DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2), total DECIMAL(10,2),
    house_no VARCHAR(200), barangay VARCHAR(100),
    city VARCHAR(100), province VARCHAR(100),
    region VARCHAR(100), postal_code VARCHAR(10),
    payment_method VARCHAR(50), status VARCHAR(20) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('orders table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL, product_id INT,
    product_name VARCHAR(200), mechanic_id INT,
    quantity INT DEFAULT 1, price DECIMAL(10,2),
    image_icon VARCHAR(20), size VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('order_items table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS cart (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL, product_id INT NOT NULL,
    mechanic_id INT, quantity INT DEFAULT 1,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_product (user_id, product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('cart table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS complaints (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    type ENUM('Complaint','Feedback','Request') DEFAULT 'Complaint',
    subject VARCHAR(200), message TEXT,
    status ENUM('open','resolved') DEFAULT 'open',
    admin_response TEXT, resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('complaints table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL, type VARCHAR(50) DEFAULT 'info',
    title VARCHAR(200), message TEXT,
    is_read TINYINT DEFAULT 0, related_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('notifications table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS addresses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    province VARCHAR(100), city VARCHAR(100),
    barangay VARCHAR(100), street_house TEXT,
    postal_code VARCHAR(10),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  // Add postal_code column to existing DBs that were created before this column was added
  try {
    await conn.query(`ALTER TABLE addresses ADD COLUMN postal_code VARCHAR(10)`);
  } catch(e) { /* column already exists, ignore */ }
  console.log('addresses table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS login_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL, ip_address VARCHAR(45) NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('login_logs table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS visitors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    visitor_name VARCHAR(100), page VARCHAR(100),
    ip_address VARCHAR(45), visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('visitors table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS password_resets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_token (token),
    KEY idx_user_id (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('password_resets table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS product_rating (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    user_name VARCHAR(100),
    user_avatar TEXT,
    rating TINYINT NOT NULL DEFAULT 5,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY one_review_per_user (product_id, user_id),
    KEY idx_product_id (product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('product_rating table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS rating_helpful (
    id INT PRIMARY KEY AUTO_INCREMENT,
    review_id INT NOT NULL,
    user_id INT NOT NULL,
    liker_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_like (review_id, user_id),
    KEY idx_review_id (review_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('rating_helpful table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    product_id INT,
    product_name VARCHAR(200),
    quantity INT DEFAULT 1,
    notes TEXT,
    status ENUM('pending','fulfilled','cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_customer_id (customer_id),
    KEY idx_product_id (product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('requests table ready');

  // Sync product_reviews → product_rating (alias for compatibility)
  await conn.query(`CREATE TABLE IF NOT EXISTS product_reviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    user_name VARCHAR(100),
    user_avatar TEXT,
    rating TINYINT NOT NULL DEFAULT 5,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY one_review_per_user (product_id, user_id),
    KEY idx_product_id (product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('product_reviews table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS review_likes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    review_id INT NOT NULL,
    user_id INT NOT NULL,
    liker_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_like (review_id, user_id),
    KEY idx_review_id (review_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('review_likes table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS flash_sales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    mode ENUM('single','group','all') NOT NULL DEFAULT 'single',
    disc_pct DECIMAL(5,2) NOT NULL,
    product_id INT NULL,
    category VARCHAR(100) NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status ENUM('active','stopped','ended') NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('flash_sales table ready');

  await conn.query(`CREATE TABLE IF NOT EXISTS favorites (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_fav (user_id, product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('favorites table ready');

  // Admin account
  const bcrypt = require('bcryptjs');
  const [existing] = await conn.query("SELECT id FROM users WHERE email='admin@gmail.com'");
  if (!existing.length) {
    const hash = await bcrypt.hash('admin123', 10);
    await conn.query(
      "INSERT INTO users (full_name, name, email, phone_number, password_hash, role) VALUES (?,?,?,?,?,?)",
      ['Admin','Admin','admin@gmail.com','09123456789', hash,'admin']
    );
    console.log('\nAdmin account created: admin@gmail.com / admin123');
  } else {
    console.log('\nAdmin account already exists');
  }

  // Sample products (only if empty)
  const [prows] = await conn.query("SELECT COUNT(*) as cnt FROM products");
  if (prows[0].cnt === 0) {
    const products = [
      ['Brake Pads','Parts','Standard',350,50,'🔧',400,4.5,25,'High-quality brake pads',0],
      ['Oil Change Kit','Oil & Fluids','1L',450,30,'🛢️',500,4.7,45,'Complete oil change kit',0],
      ['Motorcycle Tire','Tires','70/90-17',1200,25,'🛞',1350,4.8,30,'Premium motorcycle tire',0],
      ['Battery','Electrical','12V',2500,15,'🔋',2800,4.6,20,'High-performance battery',0],
      ['Chain & Sprocket','Parts','Standard',1500,20,'⛓️',1700,4.4,35,'Durable chain set',0],
      ['Air Filter','Parts','Standard',280,40,'🔧',320,4.3,50,'High-flow air filter',0],
      ['Spark Plug','Electrical','Standard',150,60,'⚡',180,4.2,80,'Iridium spark plug',0],
      ['Chain Lube','Maintenance','500ml',150,120,'🛢️',170,4.6,95,'Chain lubricant',0],
      ['Reflective Vest','Accessories','One Size',320,85,'🦺',350,4.4,60,'Safety vest',0],
      ['USB Phone Charger','Electronics','Dual Port',480,75,'🔌',550,4.5,40,'Dual USB charger',0],
      ['Disc Brake Cleaner','Maintenance','Spray',220,65,'🧼',250,4.3,55,'Brake cleaner',0],
      ['Rear View Mirror','Accessories','Pair',650,90,'🔍',720,4.7,45,'Adjustable mirrors',0],
      ['Helmet Visor','Accessories','Anti-fog',550,60,'🛡️',620,4.6,35,'Anti-fog visor',0],
      ['Brake Fluid DOT4','Fluids','500ml',120,200,'💧',140,4.5,85,'DOT4 brake fluid',0],
      ['Motorcycle Tool Kit','Tools','Compact',2200,40,'🛠️',2500,4.8,25,'Comprehensive tool kit',0],
    ];
    for (const p of products) {
      await conn.query(
        'INSERT INTO products (name,category,size,price,stock,image_icon,original_price,rating,sold_count,description,is_flash_sale) VALUES (?,?,?,?,?,?,?,?,?,?,?)', p
      );
    }
    console.log(products.length + ' sample products added');
  }

  // Sample mechanics (only if empty)
  const [mrows] = await conn.query("SELECT COUNT(*) as cnt FROM mechanics");
  if (mrows[0].cnt === 0) {
    const mechanics = [
      ['Juan Dela Cruz','General Motor Repair','🔧',500,1,4.8],
      ['Maria Santos','Electrical & Wiring','⚡',600,1,4.9],
      ['Pedro Lopez','Tire & Wheels Specialist','🛞',400,1,4.7],
      ['Rosa Garcia','Welding Specialist','🔥',700,1,5.0],
      ['Carlos Rivera','Engine Overhaul','⚙️',800,1,4.6],
    ];
    for (const m of mechanics) {
      await conn.query(
        'INSERT INTO mechanics (name,specialty,icon,fee,available,rating) VALUES (?,?,?,?,?,?)', m
      );
    }
    console.log(mechanics.length + ' sample mechanics added');
  }

  await conn.end();
  console.log('\nDone! Run: npm start\n');
  process.exit(0);
};

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
