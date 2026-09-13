-- MotoFix: authorize exactly two admin accounts
-- Run this in the motofix_db database after both accounts exist.

UPDATE users
SET role='admin'
WHERE LOWER(TRIM(email)) IN ('admin@gmail.com','earlypajo050775@gmail.com');

-- Verify both accounts and their roles.
SELECT id, full_name, email, role
FROM users
WHERE LOWER(TRIM(email)) IN ('admin@gmail.com','earlypajo050775@gmail.com');
