-- ============================================================
-- MotoFix & MotoService - Complete Database
-- Import this in phpMyAdmin
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

CREATE DATABASE IF NOT EXISTS `motofix_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `motofix_db`;

-- ============================================================
-- USERS
-- ============================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `full_name` VARCHAR(100), `name` VARCHAR(100),
  `email` VARCHAR(100) UNIQUE NOT NULL,
  `phone_number` VARCHAR(20) NOT NULL, `phone` VARCHAR(20),
  `password` VARCHAR(255), `password_hash` VARCHAR(255),
  `role` ENUM('admin','customer') DEFAULT 'customer',
  `avatar_data` LONGTEXT, `otp_code` VARCHAR(6), `otp_expiry` DATETIME,
  `is_logged_in` BOOLEAN DEFAULT 0, `last_login` DATETIME,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin: admin@gmail.com / admin123
INSERT INTO `users` (`full_name`,`name`,`email`,`phone_number`,`password_hash`,`role`) VALUES
('Admin','Admin','admin@gmail.com','09123456789','$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','admin');

-- ============================================================
-- PRODUCTS (with real image URLs)
-- ============================================================
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL, `category` VARCHAR(50), `size` VARCHAR(100),
  `price` DECIMAL(10,2) NOT NULL, `stock` INT DEFAULT 0,
  `image_icon` VARCHAR(20), `image_url` VARCHAR(500), `image_url2` VARCHAR(500), `image_url3` VARCHAR(500),
  `original_price` DECIMAL(10,2), `rating` DECIMAL(3,2) DEFAULT 0,
  `sold_count` INT DEFAULT 0, `description` TEXT,
  `is_flash_sale` TINYINT DEFAULT 0, `is_deleted` TINYINT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DELETE FROM `products`;

INSERT INTO `products` (`name`,`category`,`size`,`price`,`stock`,`image_icon`,`image_url`,`image_url2`,`image_url3`,`original_price`,`rating`,`sold_count`,`description`,`is_flash_sale`) VALUES

-- ══════════ PARTS ══════════
('Honda Genuine Brake Pads (ADV 160 / PCX 160)','Parts','Pair',420.00,50,'🔧',
'/images/productImages-1772976575916-996763428.webp',
'/images/productImages-1772976575919-79905886.webp',
'/images/productImages-1772977674865-49783861.webp',
480.00,4.8,112,'OEM Honda genuine brake pads for ADV 150/160 and PCX 150/160 ABS CBS. Reliable stopping power.',0),

('Chain & Sprocket Set 428H-120L (TMX125 Alpha)','Parts','14T/42T',850.00,35,'⛓️',
'/images/productImages-1772978873709-38125422.webp',
'/images/productImages-1772978873747-4949867.webp',
'/images/productImages-1772978873751-731742333.webp',
980.00,4.7,88,'CSL Chain and Sprocket Set for TMX125 Alpha. Heavy-duty 428H-120L for smooth power.',0),

('Air Filter Honda TMX 155 High Flow','Parts','Standard',180.00,60,'🌀',
'/images/productImages-1772980350150-266873659.webp',
'/images/productImages-1772981574321-830481859.webp',
'/images/productImages-1773374320032-558336910.jpg',
220.00,4.5,74,'GPC High Flow Air Filter for Honda TMX 155. Better engine breathing and fuel efficiency.',0),

('Iridium Spark Plug NGK CR7HIX','Parts','Standard',165.00,80,'⚡',
'/images/productImages-1773374320045-867852032.jpg',
'/images/productImages-1773374320047-639486903.jpg',
'/images/productImages-1773374551485-605549920.jpg',
190.00,4.6,95,'NGK Iridium spark plug CR7HIX for 4-stroke motorcycles. Long-lasting reliable ignition.',0),

('Brake Fluid DOT4 500ml','Parts','500ml',135.00,100,'💧',
'/images/productImages-1773374551486-411841788.webp',
'/images/productImages-1773374551487-960553650.webp',
'/images/productImages-1773374719249-621327998.webp',
160.00,4.4,67,'High performance DOT4 brake fluid. Maintains braking under high temperature.',0),

-- ══════════ ACCESSORIES ══════════
('CNC Universal Motorcycle Side Mirror (Pair)','Accessories','Universal Pair',580.00,45,'🪞',
'/images/productImages-1773374719250-285121338.webp',
'/images/productImages-1773374719250-539651914.webp',
'/images/productImages-1773374857283-4221531.jpg',
650.00,4.7,55,'Takimoto Universal CNC Aluminum motorcycle side mirrors. Anti-glare, fully adjustable.',0),

('Waterproof Motorcycle Phone Holder Handlebar','Accessories','Universal',390.00,70,'📱',
'/images/productImages-1773374857285-378481400.jpg',
'/images/productImages-1773374857285-473137491.jpg',
'/images/productImages-1773376122756-546677896.jpg',
450.00,4.6,82,'Adjustable waterproof phone holder for motorcycle handlebars. Fits 4.5–6.8 inch phones.',0),

('Motorcycle Waterproof Saddlebag Side Bag 30L','Accessories','30L',1250.00,25,'👜',
'/images/productImages-1773376122757-275309633.jpg',
'/images/productImages-1773376122757-356346689.jpg',
'/images/productImages-1773376256908-707933147.png',
1450.00,4.5,38,'30L waterproof saddlebag. Universal fit for most motorcycles. Retro design.',0),

('Reflective Safety Vest High Visibility','Accessories','Free Size',280.00,90,'🦺',
'/images/productImages-1773376472310-684201237.jpg',
'/images/productImages-1773376472310-886728533.jpg',
'/images/productImages-1773376472311-153307130.jpg',
320.00,4.3,64,'High-visibility reflective safety vest for night riding. Lightweight and breathable.',0),

('Dual USB Handlebar Charger 12V Waterproof','Accessories','12V',450.00,55,'🔌',
'/images/productImages-1773376868807-289168448.webp',
'/images/productImages-1773376868807-843860353.jpg',
'/images/productImages-1773376868815-816735537.webp',
520.00,4.5,49,'Weatherproof dual USB charger for handlebars. Fast charging 2.1A per port.',0),

-- ══════════ SERVICES ══════════
('General Check-up & Tune-up Service','Services','1 session',350.00,999,'🔩',
'/images/productImages-1773377054873-207710533.jpg',
'/images/productImages-1773377054874-103110432.jpg',
'/images/productImages-1773377054878-919025036.jpg',
450.00,5.0,210,'Full motorcycle check-up and tune-up. Carburetor cleaning, spark plug, chain adjustment.',0),

('Engine Oil Change Service (Labor + Oil)','Services','1 session',250.00,999,'🛢️',
'/images/productImages-1773378467309-583284902.png',
'/images/productImages-1773378467314-868617252.webp',
'/images/productImages-1773378467315-969341481.jpg',
300.00,4.9,185,'Engine oil change service. Includes 1L oil and oil filter replacement.',0),

('Tire Replacement Service (Labor Only)','Services','1 session',150.00,999,'🛞',
'/images/productImages-1773921360574-954496472.png',
'/images/productImages-1773921360602-280806221.png',
'/images/productImages-1773921360611-725581531.png',
200.00,4.8,142,'Professional tire installation service. Front and rear available.',0),

('Brake System Overhaul Service','Services','1 session',500.00,999,'🔧',
'/images/productImages-1773923373734-362307147.png',
'/images/productImages-1773973318926-499374704.png',
'/images/productImages-1773973318971-268262127.png',
600.00,4.9,98,'Complete brake overhaul. Pad replacement, fluid flush, disc inspection.',0),

('Chain Cleaning & Lubrication Service','Services','1 session',120.00,999,'⛓️',
'/images/productImages-1774008925224-241231434.webp',
'/images/productImages-1774008925229-813730797.webp',
'/images/productImages-1774008925241-457581234.webp',
150.00,4.7,167,'Professional chain cleaning, tensioning, and lubrication service.',0),

-- ══════════ TIRES ══════════
('IRC NR72 Motorcycle Tire 70/90-17 Tube Type','Tires','70/90-17',520.00,30,'🛞',
'/images/productImages-1774011122248-329660630.webp',
'/images/productImages-1774011122259-679330367.webp',
'/images/productImages-1774011122292-671091476.webp',
600.00,4.7,88,'IRC NR72 Speed Winner tube type tire. Excellent wet and dry grip. 17-inch rim.',0),

('FDR Sport XR Evo Tubeless Tire 80/90-17','Tires','80/90-17',680.00,28,'🛞',
'/images/productImages-1774012520424-307936008.jpg',
'/images/productImages-1774012535848-956853424.jpg',
'/images/productImages-1774012535849-840920380.jpg',
780.00,4.6,72,'FDR Sport XR Evo tubeless tire. Anti-slip pattern for all-weather grip.',0),

('Vee Rubber Satan Tubeless Tire 100/80-17','Tires','100/80-17',950.00,20,'🛞',
'/images/productImages-1774012541337-501737909.jpg',
'/images/productImages-1774012567949-480880281.jpg',
'/images/productImages-1774012567950-997105124.jpg',
1100.00,4.8,55,'Vee Rubber VRM360 SATAN tubeless. High-mileage compound with sporty grip.',0),

('NORU Tubeless Tire 70/80-17','Tires','70/80-17',490.00,35,'🛞',
'/images/productImages-1774012780619-188323701.jpg',
'/images/productImages-1774012793564-204692838.jpg',
'/images/productImages-1774012793798-919145457.jpg',
560.00,4.5,63,'NORU tubeless tire 17-inch rim. Budget-friendly with reliable performance.',0),

('BEAST Flash Tubeless Tire 80/80-17','Tires','80/80-17',620.00,25,'🛞',
'/images/productImages-1772976575916-996763428.webp',
'/images/productImages-1772976575919-79905886.webp',
'/images/productImages-1772977674865-49783861.webp',
720.00,4.6,47,'BEAST Flash tubeless tire. Sporty tread for enhanced cornering stability.',0),

-- ══════════ ENGINE OIL ══════════
('Shell Advance Ultra 4T 10W-40 1L Fully Synthetic','Engine Oil','1 Liter',380.00,120,'🛢️',
'/images/productImages-1772978873709-38125422.webp',
'/images/productImages-1772978873747-4949867.webp',
'/images/productImages-1772978873751-731742333.webp',
430.00,4.9,205,'Shell Advance Ultra 4T 10W-40 fully synthetic. Protects engine at high speeds and temperatures.',1),

('Motul 7100 4T 10W-40 1L 100% Synthetic','Engine Oil','1 Liter',520.00,85,'🛢️',
'/images/productImages-1772980350150-266873659.webp',
'/images/productImages-1772981574321-830481859.webp',
'/images/productImages-1773374320032-558336910.jpg',
600.00,4.9,178,'Motul 7100 100% synthetic 4-stroke engine oil. Racing-grade protection for high performance.',1),

('Petron Blaze Racing BR600 10W-40 1L Semi-Synthetic','Engine Oil','1 Liter',280.00,150,'🛢️',
'/images/productImages-1773374320045-867852032.jpg',
'/images/productImages-1773374320047-639486903.jpg',
'/images/productImages-1773374551485-605549920.jpg',
330.00,4.7,231,'Petron Blaze Racing BR600 semi-synthetic 10W-40. Trusted by Filipino riders nationwide.',0),

('Yamalube 4 Semi-Synthetic 10W-40 1L','Engine Oil','1 Liter',320.00,100,'🛢️',
'/images/productImages-1773374551486-411841788.webp',
'/images/productImages-1773374551487-960553650.webp',
'/images/productImages-1773374719249-621327998.webp',
370.00,4.8,143,'Yamalube 4 semi-synthetic 10W-40. Specially formulated for Yamaha motorcycles.',0),

('Honda GN4 4-Stroke Engine Oil 10W-40 1L','Engine Oil','1 Liter',295.00,110,'🛢️',
'/images/productImages-1773374719250-285121338.webp',
'/images/productImages-1773374719250-539651914.webp',
'/images/productImages-1773374857283-4221531.jpg',
340.00,4.8,189,'Honda GN4 genuine 4-stroke engine oil. Ideal for Honda TMX, Click, and Beat models.',0),

-- ══════════ LIGHTS ══════════
('LED Headlight Bulb H4 Hi-Lo Beam 3570SMD','Lights','H4',380.00,65,'💡',
'/images/productImages-1773374857285-378481400.jpg',
'/images/productImages-1773374857285-473137491.jpg',
'/images/productImages-1773376122756-546677896.jpg',
450.00,4.6,92,'High-power LED headlight H4 with 3570SMD chips. Hi-Lo beam, bright white 6000K.',0),

('LED Turn Signal Indicator Light Universal Pair','Lights','Universal Pair',220.00,80,'🔆',
'/images/productImages-1773376122757-275309633.jpg',
'/images/productImages-1773376122757-356346689.jpg',
'/images/productImages-1773376256908-707933147.png',
260.00,4.5,74,'Universal LED turn signal lights. Compatible with most motorcycles. Amber flash.',0),

('HIFAST LED Tail Brake Light Universal','Lights','Universal',350.00,55,'🔴',
'/images/productImages-1773376472310-684201237.jpg',
'/images/productImages-1773376472310-886728533.jpg',
'/images/productImages-1773376472311-153307130.jpg',
420.00,4.7,61,'HIFAST LED tail brake light with plate illumination. Universal fit, waterproof.',0),

('Sunlight L3747 LED Headlight H4 Yellow/White','Lights','H4',420.00,48,'💡',
'/images/productImages-1773376868807-289168448.webp',
'/images/productImages-1773376868807-843860353.jpg',
'/images/productImages-1773376868815-816735537.webp',
490.00,4.5,53,'Sunlight L3747 dual-color LED headlight. Switchable yellow/white beam. H4 fit.',0),

('Firefly Halogen LED Headlight H4 Ba20D','Lights','H4/Ba20D',290.00,72,'💡',
'/images/productImages-1773377054873-207710533.jpg',
'/images/productImages-1773377054874-103110432.jpg',
'/images/productImages-1773377054878-919025036.jpg',
340.00,4.4,48,'Firefly dual LED headlight. Fits H4 and Ba20D socket. Bright night riding.',0),

-- ══════════ TOOLS ══════════
('Motorcycle Repair Tool Kit 61pcs Complete Set','Tools','61pcs',1850.00,30,'🛠️',
'/images/productImages-1773378467309-583284902.png',
'/images/productImages-1773378467314-868617252.webp',
'/images/productImages-1773378467315-969341481.jpg',
2200.00,4.8,42,'Complete 61-piece motorcycle repair tool kit. Socket wrenches, screwdrivers, pliers.',0),

('T-Handle Torque Wrench Set 7pc Metric','Tools','7pc',680.00,40,'🔧',
'/images/productImages-1773921360574-954496472.png',
'/images/productImages-1773921360602-280806221.png',
'/images/productImages-1773921360611-725581531.png',
820.00,4.6,35,'Lotus T-Handle Wrench Set 7pc metric. Ergonomic for tight engine spaces.',0),

('Tubeless Tire Puncture Repair Kit 12pcs','Tools','12pcs',185.00,90,'🔩',
'/images/productImages-1773923373734-362307147.png',
'/images/productImages-1773973318926-499374704.png',
'/images/productImages-1773973318971-268262127.png',
220.00,4.7,118,'12-piece tubeless puncture repair kit. Includes plugs, reamer, and insertion tool.',0),

('Socket Wrench Set 82pcs with Ratchet Handle','Tools','82pcs',2400.00,22,'🛠️',
'/images/productImages-1774008925224-241231434.webp',
'/images/productImages-1774008925229-813730797.webp',
'/images/productImages-1774008925241-457581234.webp',
2800.00,4.9,28,'82-piece socket wrench set with ratchet handle. For motorcycle and car repair.',0),

('Chain Breaker & Riveting Tool 420/428/520','Tools','Standard',420.00,50,'⛓️',
'/images/productImages-1774011122248-329660630.webp',
'/images/productImages-1774011122259-679330367.webp',
'/images/productImages-1774011122292-671091476.webp',
500.00,4.6,39,'Professional chain breaker and riveting tool. Works with 420/428/520/525/530 chains.',0),

-- ══════════ GAUGES ══════════
('Universal Digital Speedometer LCD Odometer Tachometer','Gauges','Universal',650.00,38,'📊',
'/images/productImages-1774012520424-307936008.jpg',
'/images/productImages-1774012535848-956853424.jpg',
'/images/productImages-1774012535849-840920380.jpg',
780.00,4.7,58,'Multi-function LCD digital speedometer with odometer and tachometer. Universal fit.',0),

('ROX Digital RPM Tachometer Gauge Motorcycle','Gauges','Universal',580.00,32,'📈',
'/images/productImages-1774012541337-501737909.jpg',
'/images/productImages-1774012567949-480880281.jpg',
'/images/productImages-1774012567950-997105124.jpg',
700.00,4.6,44,'ROX digital RPM tachometer with LCD display. Easy install on 1-2 cylinder engines.',0),

('Digital Voltmeter Battery Indicator 12V-72V','Gauges','Universal',280.00,60,'🔋',
'/images/productImages-1774012780619-188323701.jpg',
'/images/productImages-1774012793564-204692838.jpg',
'/images/productImages-1774012793798-919145457.jpg',
340.00,4.5,76,'LED digital voltmeter for motorcycles. Monitors battery from 12V–72V. Waterproof.',0),

('Universal Retro LCD Speedometer Cafe Racer Style','Gauges','Universal',720.00,25,'📊',
'/images/productImages-1772976575916-996763428.webp',
'/images/productImages-1772976575919-79905886.webp',
'/images/productImages-1772977674865-49783861.webp',
860.00,4.8,33,'Retro-style LCD speedometer for cafe racer custom builds. Includes odometer and clock.',0),

('Digital Tachometer Hour Meter RPM Waterproof','Gauges','Universal',350.00,45,'⏱️',
'/images/productImages-1772978873709-38125422.webp',
'/images/productImages-1772978873747-4949867.webp',
'/images/productImages-1772978873751-731742333.webp',
420.00,4.5,51,'Waterproof digital tachometer with hour meter. Works on all spark-ignition engines.',0);


-- ============================================================
-- MECHANICS
-- ============================================================
DROP TABLE IF EXISTS `mechanics`;
CREATE TABLE `mechanics` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL, `specialty` VARCHAR(100),
  `icon` VARCHAR(20), `photo` VARCHAR(500),
  `fee` DECIMAL(10,2), `available` BOOLEAN DEFAULT 1,
  `rating` DECIMAL(3,1) DEFAULT 5.0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `mechanics` (`name`,`specialty`,`icon`,`fee`,`available`,`rating`) VALUES
('Juan Dela Cruz','General Motor Repair','🔧',500.00,1,4.8),
('Maria Santos','Electrical & Wiring','⚡',600.00,1,4.9),
('Pedro Lopez','Tire & Wheels Specialist','🛞',400.00,1,4.7),
('Rosa Garcia','Welding Specialist','🔥',700.00,1,5.0),
('Carlos Rivera','Engine Overhaul','⚙️',800.00,1,4.6);

-- ============================================================
-- ORDERS
-- ============================================================
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL, `customer_email` VARCHAR(100),
  `mechanic_id` INT, `mechanic_name` VARCHAR(100),
  `mechanic_fee` DECIMAL(10,2) DEFAULT 0,
  `subtotal` DECIMAL(10,2), `total` DECIMAL(10,2),
  `house_no` VARCHAR(200), `barangay` VARCHAR(100),
  `city` VARCHAR(100), `province` VARCHAR(100),
  `region` VARCHAR(100), `postal_code` VARCHAR(10),
  `payment_method` VARCHAR(50), `status` VARCHAR(20) DEFAULT 'Pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ORDER ITEMS
-- ============================================================
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `order_id` INT NOT NULL, `product_id` INT,
  `product_name` VARCHAR(200), `mechanic_id` INT,
  `quantity` INT DEFAULT 1, `price` DECIMAL(10,2),
  `image_icon` VARCHAR(20), `size` VARCHAR(100),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- CART
-- ============================================================
DROP TABLE IF EXISTS `cart`;
CREATE TABLE `cart` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL, `product_id` INT NOT NULL,
  `mechanic_id` INT, `quantity` INT DEFAULT 1,
  `added_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_user_product` (`user_id`,`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- COMPLAINTS
-- ============================================================
DROP TABLE IF EXISTS `complaints`;
CREATE TABLE `complaints` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `customer_id` INT NOT NULL,
  `type` ENUM('Complaint','Feedback','Request') DEFAULT 'Complaint',
  `subject` VARCHAR(200), `message` TEXT,
  `status` ENUM('open','resolved') DEFAULT 'open',
  `admin_response` TEXT, `resolved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL, `type` VARCHAR(50) DEFAULT 'info',
  `title` VARCHAR(200), `message` TEXT,
  `is_read` TINYINT DEFAULT 0, `related_id` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ADDRESSES
-- ============================================================
DROP TABLE IF EXISTS `addresses`;
CREATE TABLE `addresses` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `province` VARCHAR(100), `city` VARCHAR(100),
  `barangay` VARCHAR(100), `street_house` TEXT,
  `is_default` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- LOGIN LOGS
-- ============================================================
DROP TABLE IF EXISTS `login_logs`;
CREATE TABLE `login_logs` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL, `ip_address` VARCHAR(45) NOT NULL,
  `login_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- VISITORS
-- ============================================================
DROP TABLE IF EXISTS `visitors`;
CREATE TABLE `visitors` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `visitor_name` VARCHAR(100), `page` VARCHAR(100),
  `ip_address` VARCHAR(45),
  `visited_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PASSWORD RESETS
-- ============================================================
DROP TABLE IF EXISTS `password_resets`;
CREATE TABLE `password_resets` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_token` (`token`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PRODUCT RATING (product reviews by users)
-- ============================================================
DROP TABLE IF EXISTS `product_rating`;
CREATE TABLE `product_rating` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `product_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `user_name` VARCHAR(100),
  `user_avatar` TEXT,
  `rating` TINYINT NOT NULL DEFAULT 5,
  `comment` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `one_review_per_user` (`product_id`,`user_id`),
  KEY `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PRODUCT REVIEWS (alias of product_rating, used by routes)
-- ============================================================
DROP TABLE IF EXISTS `product_reviews`;
CREATE TABLE `product_reviews` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `product_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `user_name` VARCHAR(100),
  `user_avatar` TEXT,
  `rating` TINYINT NOT NULL DEFAULT 5,
  `comment` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `one_review_per_user` (`product_id`,`user_id`),
  KEY `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- RATING HELPFUL (thumbs up on reviews)
-- ============================================================
DROP TABLE IF EXISTS `rating_helpful`;
CREATE TABLE `rating_helpful` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `review_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `liker_name` VARCHAR(100),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_like` (`review_id`,`user_id`),
  KEY `idx_review_id` (`review_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- REVIEW LIKES (alias of rating_helpful, used by routes)
-- ============================================================
DROP TABLE IF EXISTS `review_likes`;
CREATE TABLE `review_likes` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `review_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `liker_name` VARCHAR(100),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_like` (`review_id`,`user_id`),
  KEY `idx_review_id` (`review_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- REQUESTS (customer product requests)
-- ============================================================
DROP TABLE IF EXISTS `requests`;
CREATE TABLE `requests` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `customer_id` INT NOT NULL,
  `product_id` INT NULL,
  `product_name` VARCHAR(200),
  `quantity` INT DEFAULT 1,
  `notes` TEXT,
  `status` ENUM('pending','fulfilled','cancelled') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- FLASH SALES
-- ============================================================
DROP TABLE IF EXISTS `flash_sales`;
CREATE TABLE `flash_sales` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `mode` ENUM('single','group','all') NOT NULL DEFAULT 'single',
  `disc_pct` DECIMAL(5,2) NOT NULL,
  `product_id` INT NULL,
  `category` VARCHAR(100) NULL,
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME NOT NULL,
  `status` ENUM('active','stopped','ended') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- FAVORITES
-- ============================================================
DROP TABLE IF EXISTS `favorites`;
CREATE TABLE `favorites` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_fav` (`user_id`,`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- UPDATE PRODUCT IMAGES (run this if products already exist)
-- ============================================================
UPDATE `products` SET `image_url`='/images/productImages-1772976575916-996763428.webp', `image_url2`='/images/productImages-1772976575919-79905886.webp', `image_url3`='/images/productImages-1772977674865-49783861.webp' WHERE `name`='Honda Genuine Brake Pads (ADV 160 / PCX 160)';
UPDATE `products` SET `image_url`='/images/productImages-1772978873709-38125422.webp', `image_url2`='/images/productImages-1772978873747-4949867.webp', `image_url3`='/images/productImages-1772978873751-731742333.webp' WHERE `name`='Chain & Sprocket Set 428H-120L (TMX125 Alpha)';
UPDATE `products` SET `image_url`='/images/productImages-1772980350150-266873659.webp', `image_url2`='/images/productImages-1772981574321-830481859.webp', `image_url3`='/images/productImages-1773374320032-558336910.jpg' WHERE `name`='Air Filter Honda TMX 155 High Flow';
UPDATE `products` SET `image_url`='/images/productImages-1773374320045-867852032.jpg', `image_url2`='/images/productImages-1773374320047-639486903.jpg', `image_url3`='/images/productImages-1773374551485-605549920.jpg' WHERE `name`='Iridium Spark Plug NGK CR7HIX';
UPDATE `products` SET `image_url`='/images/productImages-1773374551486-411841788.webp', `image_url2`='/images/productImages-1773374551487-960553650.webp', `image_url3`='/images/productImages-1773374719249-621327998.webp' WHERE `name`='Brake Fluid DOT4 500ml';
UPDATE `products` SET `image_url`='/images/productImages-1773374719250-285121338.webp', `image_url2`='/images/productImages-1773374719250-539651914.webp', `image_url3`='/images/productImages-1773374857283-4221531.jpg' WHERE `name`='CNC Universal Motorcycle Side Mirror (Pair)';
UPDATE `products` SET `image_url`='/images/productImages-1773374857285-378481400.jpg', `image_url2`='/images/productImages-1773374857285-473137491.jpg', `image_url3`='/images/productImages-1773376122756-546677896.jpg' WHERE `name`='Waterproof Motorcycle Phone Holder Handlebar';
UPDATE `products` SET `image_url`='/images/productImages-1773376122757-275309633.jpg', `image_url2`='/images/productImages-1773376122757-356346689.jpg', `image_url3`='/images/productImages-1773376256908-707933147.png' WHERE `name`='Motorcycle Waterproof Saddlebag Side Bag 30L';
UPDATE `products` SET `image_url`='/images/productImages-1773376472310-684201237.jpg', `image_url2`='/images/productImages-1773376472310-886728533.jpg', `image_url3`='/images/productImages-1773376472311-153307130.jpg' WHERE `name`='Reflective Safety Vest High Visibility';
UPDATE `products` SET `image_url`='/images/productImages-1773376868807-289168448.webp', `image_url2`='/images/productImages-1773376868807-843860353.jpg', `image_url3`='/images/productImages-1773376868815-816735537.webp' WHERE `name`='Dual USB Handlebar Charger 12V Waterproof';
UPDATE `products` SET `image_url`='/images/productImages-1773377054873-207710533.jpg', `image_url2`='/images/productImages-1773377054874-103110432.jpg', `image_url3`='/images/productImages-1773377054878-919025036.jpg' WHERE `name`='General Check-up & Tune-up Service';
UPDATE `products` SET `image_url`='/images/productImages-1773378467309-583284902.png', `image_url2`='/images/productImages-1773378467314-868617252.webp', `image_url3`='/images/productImages-1773378467315-969341481.jpg' WHERE `name`='Engine Oil Change Service (Labor + Oil)';
UPDATE `products` SET `image_url`='/images/productImages-1773921360574-954496472.png', `image_url2`='/images/productImages-1773921360602-280806221.png', `image_url3`='/images/productImages-1773921360611-725581531.png' WHERE `name`='Tire Replacement Service (Labor Only)';
UPDATE `products` SET `image_url`='/images/productImages-1773923373734-362307147.png', `image_url2`='/images/productImages-1773973318926-499374704.png', `image_url3`='/images/productImages-1773973318971-268262127.png' WHERE `name`='Brake System Overhaul Service';
UPDATE `products` SET `image_url`='/images/productImages-1774008925224-241231434.webp', `image_url2`='/images/productImages-1774008925229-813730797.webp', `image_url3`='/images/productImages-1774008925241-457581234.webp' WHERE `name`='Chain Cleaning & Lubrication Service';
UPDATE `products` SET `image_url`='/images/productImages-1774011122248-329660630.webp', `image_url2`='/images/productImages-1774011122259-679330367.webp', `image_url3`='/images/productImages-1774011122292-671091476.webp' WHERE `name`='IRC NR72 Motorcycle Tire 70/90-17 Tube Type';
UPDATE `products` SET `image_url`='/images/productImages-1774012520424-307936008.jpg', `image_url2`='/images/productImages-1774012535848-956853424.jpg', `image_url3`='/images/productImages-1774012535849-840920380.jpg' WHERE `name`='FDR Sport XR Evo Tubeless Tire 80/90-17';
UPDATE `products` SET `image_url`='/images/productImages-1774012541337-501737909.jpg', `image_url2`='/images/productImages-1774012567949-480880281.jpg', `image_url3`='/images/productImages-1774012567950-997105124.jpg' WHERE `name`='Vee Rubber Satan Tubeless Tire 100/80-17';
UPDATE `products` SET `image_url`='/images/productImages-1774012780619-188323701.jpg', `image_url2`='/images/productImages-1774012793564-204692838.jpg', `image_url3`='/images/productImages-1774012793798-919145457.jpg' WHERE `name`='NORU Tubeless Tire 70/80-17';
UPDATE `products` SET `image_url`='/images/productImages-1772976575916-996763428.webp', `image_url2`='/images/productImages-1772976575919-79905886.webp', `image_url3`='/images/productImages-1772977674865-49783861.webp' WHERE `name`='BEAST Flash Tubeless Tire 80/80-17';
UPDATE `products` SET `image_url`='/images/productImages-1772978873709-38125422.webp', `image_url2`='/images/productImages-1772978873747-4949867.webp', `image_url3`='/images/productImages-1772978873751-731742333.webp' WHERE `name`='Shell Advance Ultra 4T 10W-40 1L Fully Synthetic';
UPDATE `products` SET `image_url`='/images/productImages-1772980350150-266873659.webp', `image_url2`='/images/productImages-1772981574321-830481859.webp', `image_url3`='/images/productImages-1773374320032-558336910.jpg' WHERE `name`='Motul 7100 4T 10W-40 1L 100% Synthetic';
UPDATE `products` SET `image_url`='/images/productImages-1773374320045-867852032.jpg', `image_url2`='/images/productImages-1773374320047-639486903.jpg', `image_url3`='/images/productImages-1773374551485-605549920.jpg' WHERE `name`='Petron Blaze Racing BR600 10W-40 1L Semi-Synthetic';
UPDATE `products` SET `image_url`='/images/productImages-1773374551486-411841788.webp', `image_url2`='/images/productImages-1773374551487-960553650.webp', `image_url3`='/images/productImages-1773374719249-621327998.webp' WHERE `name`='Yamalube 4 Semi-Synthetic 10W-40 1L';
UPDATE `products` SET `image_url`='/images/productImages-1773374719250-285121338.webp', `image_url2`='/images/productImages-1773374719250-539651914.webp', `image_url3`='/images/productImages-1773374857283-4221531.jpg' WHERE `name`='Honda GN4 4-Stroke Engine Oil 10W-40 1L';
UPDATE `products` SET `image_url`='/images/productImages-1773374857285-378481400.jpg', `image_url2`='/images/productImages-1773374857285-473137491.jpg', `image_url3`='/images/productImages-1773376122756-546677896.jpg' WHERE `name`='LED Headlight Bulb H4 Hi-Lo Beam 3570SMD';
UPDATE `products` SET `image_url`='/images/productImages-1773376122757-275309633.jpg', `image_url2`='/images/productImages-1773376122757-356346689.jpg', `image_url3`='/images/productImages-1773376256908-707933147.png' WHERE `name`='LED Turn Signal Indicator Light Universal Pair';
UPDATE `products` SET `image_url`='/images/productImages-1773376472310-684201237.jpg', `image_url2`='/images/productImages-1773376472310-886728533.jpg', `image_url3`='/images/productImages-1773376472311-153307130.jpg' WHERE `name`='HIFAST LED Tail Brake Light Universal';
UPDATE `products` SET `image_url`='/images/productImages-1773376868807-289168448.webp', `image_url2`='/images/productImages-1773376868807-843860353.jpg', `image_url3`='/images/productImages-1773376868815-816735537.webp' WHERE `name`='Sunlight L3747 LED Headlight H4 Yellow/White';
UPDATE `products` SET `image_url`='/images/productImages-1773377054873-207710533.jpg', `image_url2`='/images/productImages-1773377054874-103110432.jpg', `image_url3`='/images/productImages-1773377054878-919025036.jpg' WHERE `name`='Firefly Halogen LED Headlight H4 Ba20D';
UPDATE `products` SET `image_url`='/images/productImages-1773378467309-583284902.png', `image_url2`='/images/productImages-1773378467314-868617252.webp', `image_url3`='/images/productImages-1773378467315-969341481.jpg' WHERE `name`='Motorcycle Repair Tool Kit 61pcs Complete Set';
UPDATE `products` SET `image_url`='/images/productImages-1773921360574-954496472.png', `image_url2`='/images/productImages-1773921360602-280806221.png', `image_url3`='/images/productImages-1773921360611-725581531.png' WHERE `name`='T-Handle Torque Wrench Set 7pc Metric';
UPDATE `products` SET `image_url`='/images/productImages-1773923373734-362307147.png', `image_url2`='/images/productImages-1773973318926-499374704.png', `image_url3`='/images/productImages-1773973318971-268262127.png' WHERE `name`='Tubeless Tire Puncture Repair Kit 12pcs';
UPDATE `products` SET `image_url`='/images/productImages-1774008925224-241231434.webp', `image_url2`='/images/productImages-1774008925229-813730797.webp', `image_url3`='/images/productImages-1774008925241-457581234.webp' WHERE `name`='Socket Wrench Set 82pcs with Ratchet Handle';
UPDATE `products` SET `image_url`='/images/productImages-1774011122248-329660630.webp', `image_url2`='/images/productImages-1774011122259-679330367.webp', `image_url3`='/images/productImages-1774011122292-671091476.webp' WHERE `name`='Chain Breaker & Riveting Tool 420/428/520';
UPDATE `products` SET `image_url`='/images/productImages-1774012520424-307936008.jpg', `image_url2`='/images/productImages-1774012535848-956853424.jpg', `image_url3`='/images/productImages-1774012535849-840920380.jpg' WHERE `name`='Universal Digital Speedometer LCD Odometer Tachometer';
UPDATE `products` SET `image_url`='/images/productImages-1774012541337-501737909.jpg', `image_url2`='/images/productImages-1774012567949-480880281.jpg', `image_url3`='/images/productImages-1774012567950-997105124.jpg' WHERE `name`='ROX Digital RPM Tachometer Gauge Motorcycle';
UPDATE `products` SET `image_url`='/images/productImages-1774012780619-188323701.jpg', `image_url2`='/images/productImages-1774012793564-204692838.jpg', `image_url3`='/images/productImages-1774012793798-919145457.jpg' WHERE `name`='Digital Voltmeter Battery Indicator 12V-72V';
UPDATE `products` SET `image_url`='/images/productImages-1772976575916-996763428.webp', `image_url2`='/images/productImages-1772976575919-79905886.webp', `image_url3`='/images/productImages-1772977674865-49783861.webp' WHERE `name`='Universal Retro LCD Speedometer Cafe Racer Style';
UPDATE `products` SET `image_url`='/images/productImages-1772978873709-38125422.webp', `image_url2`='/images/productImages-1772978873747-4949867.webp', `image_url3`='/images/productImages-1772978873751-731742333.webp' WHERE `name`='Digital Tachometer Hour Meter RPM Waterproof';

-- ============================================================
-- DONE! Admin: admin@gmail.com / admin123
-- ============================================================
