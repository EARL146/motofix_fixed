-- MotoFix strict admin account setup
-- Make sure admin@gmail.com is the Google account you personally control.
-- Run this in phpMyAdmin after selecting motofix_db.

-- If admin@gmail.com already exists, make it the admin account.
UPDATE users
SET role = 'admin'
WHERE LOWER(TRIM(email)) = 'admin@gmail.com'
LIMIT 1;

-- If your old admin account is still admin@motofix.com, change its email
-- to the designated admin email. Run only if admin@gmail.com does not already exist.
-- UPDATE users SET email = 'admin@gmail.com', role = 'admin'
-- WHERE LOWER(TRIM(email)) = 'admin@motofix.com' LIMIT 1;

-- Verify the final admin account:
SELECT id, full_name, email, role FROM users WHERE LOWER(TRIM(email)) = 'admin@gmail.com';
