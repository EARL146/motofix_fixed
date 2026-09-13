-- ============================================================
-- QUICK FIX for existing database
-- Run this in phpMyAdmin SQL tab if you don't want to reimport
-- ============================================================

-- Fix mechanics table
ALTER TABLE `mechanics` 
  ADD COLUMN `experience_years` INT DEFAULT 0,
  ADD COLUMN `trusted` TINYINT DEFAULT 1;

-- Update existing mechanics with experience values
UPDATE `mechanics` SET experience_years=10, trusted=1 WHERE name='Juan Dela Cruz';
UPDATE `mechanics` SET experience_years=5,  trusted=1 WHERE name='Maria Santos';
UPDATE `mechanics` SET experience_years=4,  trusted=1 WHERE name='Pedro Lopez';
UPDATE `mechanics` SET experience_years=6,  trusted=1 WHERE name='Rosa Garcia';
UPDATE `mechanics` SET experience_years=12, trusted=1 WHERE name='Carlos Rivera';

-- Re-create flash_sales table if missing
CREATE TABLE IF NOT EXISTS `flash_sales` (
  `id`         INT PRIMARY KEY AUTO_INCREMENT,
  `mode`       ENUM('single','group','all') NOT NULL DEFAULT 'single',
  `disc_pct`   DECIMAL(5,2) NOT NULL,
  `product_id` INT NULL,
  `category`   VARCHAR(100) NULL,
  `start_time` DATETIME NOT NULL,
  `end_time`   DATETIME NOT NULL,
  `status`     ENUM('active','stopped','ended') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fix addresses - add postal_code if missing
ALTER TABLE `addresses` ADD COLUMN IF NOT EXISTS `postal_code` VARCHAR(20) AFTER `street_house`;

-- Fix product_reviews table if missing
CREATE TABLE IF NOT EXISTS `product_reviews` (
  `id`           INT PRIMARY KEY AUTO_INCREMENT,
  `product_id`   INT NOT NULL,
  `user_id`      INT NOT NULL,
  `user_name`    VARCHAR(100),
  `user_avatar`  TEXT,
  `rating`       TINYINT NOT NULL DEFAULT 5,
  `comment`      TEXT NOT NULL,
  `created_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `one_review_per_user` (`product_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fix review_likes table if missing
CREATE TABLE IF NOT EXISTS `review_likes` (
  `id`          INT PRIMARY KEY AUTO_INCREMENT,
  `review_id`   INT NOT NULL,
  `user_id`     INT NOT NULL,
  `liker_name`  VARCHAR(100),
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_like` (`review_id`,`user_id`),
  FOREIGN KEY (`review_id`) REFERENCES `product_reviews`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;