-- MotoFix / MotoMarket - TikTok Login Kit migration
-- Run this once if you prefer SQL migration instead of the automatic server migration.

ALTER TABLE users
  ADD COLUMN tiktok_open_id VARCHAR(255) NULL UNIQUE;

CREATE TABLE IF NOT EXISTS tiktok_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  open_id VARCHAR(255) NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NULL,
  expires_at DATETIME NULL,
  refresh_expires_at DATETIME NULL,
  scope VARCHAR(500) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_tiktok_user (user_id),
  CONSTRAINT fk_tiktok_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
