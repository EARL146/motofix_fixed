-- Run this if you already have an existing database
-- This adds image_url2 and image_url3 columns to the products table

ALTER TABLE `products`
  ADD COLUMN IF NOT EXISTS `image_url2` VARCHAR(500) NULL AFTER `image_url`,
  ADD COLUMN IF NOT EXISTS `image_url3` VARCHAR(500) NULL AFTER `image_url2`;
