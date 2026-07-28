-- Run this SQL in your MySQL database (motofix_db)
-- Creates the flash_sales table

CREATE TABLE IF NOT EXISTS `flash_sales` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `mode`       ENUM('single','group','all') NOT NULL DEFAULT 'single',
  `disc_pct`   DECIMAL(5,2) NOT NULL,
  `product_id` INT NULL,
  `category`   VARCHAR(100) NULL,
  `start_time` DATETIME NOT NULL,
  `end_time`   DATETIME NOT NULL,
  `status`     ENUM('active','stopped','ended') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
