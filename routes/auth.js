const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// Authentication middleware
const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization token required' });
    }
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Health check - verify database is working
router.get('/health', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [result] = await conn.query('SELECT 1');
    conn.release();
    res.json({ success: true, message: 'Database connected', timestamp: new Date() });
  } catch (error) {
    res.json({ success: false, message: 'Database error: ' + error.message });
  }
});

// Register user
router.post('/register', async (req, res) => {
  console.log('REGISTER body:', req.body);
  try {
    const { full_name, email, password, phone_number, name, phone } = req.body;
    
    const fullName = full_name || name;
    const phoneNumber = phone_number || phone;
    
    if (!fullName || !email || !phoneNumber || !password) {
      return res.status(400).json({ success: false, message: 'Full name, email, phone number, and password are required' });
    }

    // Validate phone number format (Philippine)
    // Format: 09XXXXXXXXX (11 digits) or +639XXXXXXXXX (13 chars)
    const phoneRegex = /^(09|\+639)\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid Philippine mobile number (e.g. 09XXXXXXXXX)' });
    }

    // Reject fake numbers where the subscriber digits are all the same
    // (e.g. 09111111111, +639222222222) or a simple sequential pattern
    const subscriberDigits = phoneNumber.replace(/^(09|\+639)/, '');
    const isAllSameDigit = /^(\d)\1+$/.test(subscriberDigits);
    const isSequential = /^0123456789|123456789|987654321|9876543210$/.test(subscriberDigits);
    if (isAllSameDigit || isSequential) {
      return res.status(400).json({ success: false, message: 'Please enter a real, valid mobile number. Repeated or sequential digit numbers are not allowed.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    if (password.length > 20) {
      return res.status(400).json({ success: false, message: 'Password must not exceed 20 characters' });
    }

    // Strong password check: must have uppercase, lowercase, number, and special character
    // Also rejects all-numeric passwords like "12345678"
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (e.g. !@#$%).'
      });
    }

    const conn = await pool.getConnection();
    
    // Check if email exists
    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Check if phone number already exists
    const [existingPhone] = await conn.query('SELECT id FROM users WHERE phone_number = ?', [phoneNumber]);
    if (existingPhone.length > 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Phone number already registered' });
    }

    // Hash password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    console.log('Inserting user:', { full_name: fullName, email, phone_number: phoneNumber, role: 'customer' });
    
    // Insert new user
    await conn.query(
      'INSERT INTO users (full_name, name, email, phone_number, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      [fullName, fullName, email, phoneNumber, passwordHash, 'customer']
    );
    
    conn.release();
    console.log('✅ User registered successfully:', email);
    res.status(201).json({ success: true, message: 'Registration successful! Please login.' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  console.log('LOGIN attempt:', req.body.email);
  let conn;
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.json({ success: false, message: 'Email and password required' });
    }

    conn = await pool.getConnection();
    
    console.log('Looking for user:', email);
    
    const [users] = await conn.query(
      'SELECT id, full_name, name, email, role, password_hash FROM users WHERE email = ?',
      [email]
    );
    
    console.log('Query result rows:', users.length);
    
    if (users.length === 0) {
      console.log('❌ Login failed for:', email);
      conn.release();
      return res.json({ success: false, message: 'Invalid email or password' });
    }

    const user = users[0];
    
    // Compare password with hash using bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash || '');
    
    if (!passwordMatch) {
      console.log('❌ Password mismatch for:', email);
      conn.release();
      return res.json({ success: false, message: 'Invalid email or password' });
    }

    console.log('✅ Login successful for:', email, 'Role:', user.role);
    
    // Get IP address
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.socket.remoteAddress || 
                     req.connection.remoteAddress || 
                     'unknown';
    
    console.log('📍 Login IP:', ipAddress);
    console.log('⏳ About to insert login log for user:', user.id);
    
    // Log the login attempt
    try {
      console.log('🔄 Executing insert query...');
      const insertResult = await conn.query(
        'INSERT INTO login_logs (user_id, ip_address) VALUES (?, ?)',
        [user.id, ipAddress]
      );
      console.log('✅ Login logged for user:', user.id, 'Result:', insertResult);
    } catch (logError) {
      console.error('❌ Failed to log login:', logError);
      console.error('   SQL Error:', logError.code, logError.sqlMessage);
      // Don't fail the login if logging fails
    }
    
    conn.release();
    
    // Create session token (simple JWT-like token)
    const token = Buffer.from(JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.full_name || user.name || '',
      timestamp: Date.now()
    })).toString('base64');
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      token: token,
      ip_address: ipAddress,
      user: {
        id: user.id,
        name: user.full_name || user.name || 'User',
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    if (conn) conn.release();
    res.json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Get current logged in user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.json({ success: false, message: 'No token provided' });
    }

    // Decode token
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const userId = decoded.id;

    const conn = await pool.getConnection();
    const [users] = await conn.query(
      'SELECT id, full_name, name, email, role FROM users WHERE id = ?',
      [userId]
    );
    conn.release();

    if (users.length === 0) {
      return res.json({ success: false, message: 'User not found' });
    }

    const user = users[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.full_name || user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.json({ success: false, message: 'Invalid token' });
  }
});

// Logout user
router.post('/logout', (req, res) => {
  // Since we're using client-side session management,
  // just return success and let client clear localStorage
  res.json({ success: true, message: 'Logged out successfully' });
});

// Log visitor
router.post('/log-visitor', async (req, res) => {
  try {
    const { page } = req.body;
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || req.ip || req.connection.remoteAddress || 'unknown';

    // Basic bot detection - skip logging for obvious bots
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i, /headless/i,
      /selenium/i, /puppeteer/i, /chrome-lighthouse/i
    ];

    const isBot = botPatterns.some(pattern => pattern.test(userAgent));
    if (isBot) {
      console.log('🤖 Bot detected, skipping visitor log:', userAgent.substring(0, 50));
      return res.json({ success: true });
    }

    // Skip if no user agent (suspicious)
    if (!userAgent.trim()) {
      console.log('⚠️ Empty user agent, skipping visitor log');
      return res.json({ success: true });
    }

    const conn = await pool.getConnection();

    // Check for recent visits from same IP (within last 5 minutes) to prevent spam
    const [recentVisits] = await conn.query(
      'SELECT id FROM visitors WHERE ip_address = ? AND visited_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)',
      [ipAddress]
    );

    if (recentVisits.length > 0) {
      console.log('⏰ Recent visit from same IP, skipping duplicate log');
      conn.release();
      return res.json({ success: true });
    }

    // Extract visitor name from user agent (browser type)
    let visitorName = 'Web User';
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('chrome') && !ua.includes('edg') && !ua.includes('opr')) {
      visitorName = 'Chrome User';
    } else if (ua.includes('firefox')) {
      visitorName = 'Firefox User';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      visitorName = 'Safari User';
    } else if (ua.includes('edg') || ua.includes('edge')) {
      visitorName = 'Edge User';
    } else if (ua.includes('opera') || ua.includes('opr')) {
      visitorName = 'Opera User';
    } else if (ua.includes('mobile') || ua.includes('android')) {
      visitorName = 'Mobile User';
    }

    await conn.query(
      'INSERT INTO visitors (visitor_name, page, ip_address, visited_at) VALUES (?, ?, ?, NOW())',
      [visitorName, page || 'landing', ipAddress]
    );

    console.log(`👤 Visitor logged: ${visitorName} from ${ipAddress} viewing ${page || 'landing'}`);
    conn.release();
    res.json({ success: true });
  } catch (error) {
    console.error('Log visitor error:', error);
    res.json({ success: true }); // Don't fail on logging
  }
});

// send OTP for forgot password
router.post('/send_otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: false, message: 'Email required' });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const conn = await pool.getConnection();
    await conn.query('UPDATE users SET otp_code=?, otp_expiry=? WHERE email=?', [code, expiry, email]);
    conn.release();
    // in production send email; for now return otp
    res.json({ success: true, otp: code });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.json({ success: false, message: 'Server error' });
  }
});

// verify otp
router.post('/verify_otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.json({ success: false, message: 'Email and OTP required' });
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT otp_code, otp_expiry FROM users WHERE email=?', [email]);
    conn.release();
    if (!rows.length) return res.json({ success: false, message: 'User not found' });
    const user = rows[0];
    if (user.otp_code !== otp) return res.json({ success: false, message: 'Invalid OTP' });
    if (new Date() > new Date(user.otp_expiry)) return res.json({ success: false, message: 'OTP expired' });
    res.json({ success: true });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.json({ success: false, message: 'Server error' });
  }
});

// Upload profile picture
router.post('/upload-avatar', async (req, res) => {
  try {
    const { token, avatar_data } = req.body;
    
    if (!token || !avatar_data) {
      return res.json({ success: false, message: 'Token and avatar data required' });
    }

    // Decode token to get user ID
    let userId;
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      userId = decoded.id;
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Validate avatar data size (max 5MB for base64)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (avatar_data.length > maxSize) {
      return res.json({ success: false, message: 'Avatar too large! Max 5MB' });
    }

    let conn;
    try {
      conn = await pool.getConnection();
      await conn.query(
        'UPDATE users SET avatar_data = ? WHERE id = ?',
        [avatar_data, userId]
      );
      conn.release();
      return res.json({ success: true, message: 'Avatar saved!' });
    } catch (error) {
      if (conn) try { conn.release(); } catch(e) {}
      console.error('Upload avatar DB error:', error.message);
      // If column missing, try to add it
      if(error.message && error.message.includes('avatar_data')){
        try {
          const c2 = await pool.getConnection();
          await c2.query('ALTER TABLE users ADD COLUMN avatar_data LONGTEXT');
          await c2.query('UPDATE users SET avatar_data = ? WHERE id = ?', [avatar_data, userId]);
          c2.release();
          return res.json({ success: true, message: 'Avatar saved (column created)!' });
        } catch(e2) {
          console.error('Auto-fix failed:', e2.message);
        }
      }
      return res.json({ success: false, message: 'DB error: ' + error.message });
    }
    
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.json({ success: false, message: 'Error uploading avatar: ' + error.message });
  }
});

// Get profile picture
router.get('/avatar/:userId', async (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID required' });
  }
  
  let conn = null;
  try {
    conn = await pool.getConnection();
    const [users] = await conn.query(
      'SELECT avatar_data FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0 || !users[0].avatar_data) {
      return res.json({ success: false, message: 'Avatar not found', avatar: null });
    }
    
    return res.json({ success: true, avatar: users[0].avatar_data });
  } catch (error) {
    // Any error (DB or connection) - just return avatar not found
    res.json({ success: false, message: 'Avatar not found', avatar: null });
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (e) {
        // ignore release errors
      }
    }
  }
});

// reset password after otp
router.post('/reset_password', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.json({ success: false, message: 'Email and password required' });
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const conn = await pool.getConnection();
    await conn.query('UPDATE users SET password_hash=?, otp_code=NULL, otp_expiry=NULL WHERE email=?', [passwordHash, email]);
    conn.release();
    res.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    res.json({ success: false, message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const userId = req.userId;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const conn = await pool.getConnection();

    // Check if email is taken by another user
    const [existing] = await conn.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (existing.length > 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Email is already taken by another user' });
    }

    // Build update query — include password only if provided
    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      await conn.query(
        'UPDATE users SET full_name=?, name=?, email=?, phone_number=?, phone=?, password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [name, name, email, phone||'', phone||'', passwordHash, userId]
      );
    } else {
      await conn.query(
        'UPDATE users SET full_name=?, name=?, email=?, phone_number=?, phone=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [name, name, email, phone||'', phone||'', userId]
      );
    }

    const [updatedUser] = await conn.query(
      'SELECT id, full_name, name, email, phone_number, role FROM users WHERE id = ?',
      [userId]
    );
    conn.release();

    if (updatedUser.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'Profile updated successfully', user: updatedUser[0] });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Get login logs
router.get('/login-logs', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    
    const [logs] = await conn.query(`
      SELECT 
        ll.id,
        ll.ip_address,
        ll.login_time,
        COALESCE(u.full_name, u.name) as username,
        u.email
      FROM login_logs ll
      JOIN users u ON ll.user_id = u.id
      ORDER BY ll.login_time DESC
    `);
    
    conn.release();
    
    res.json({
      success: true,
      logs: logs.map(log => ({
        id: log.id,
        username: log.username,
        email: log.email,
        ip_address: log.ip_address,
        login_time: log.login_time
      }))
    });
    
  } catch (error) {
    console.error('Get login logs error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});


// POST /api/auth/forgot-password — verify email, return token directly
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: false, message: 'Email is required' });

    const conn = await pool.getConnection();
    const [users] = await conn.query(
      'SELECT id, full_name FROM users WHERE email = ? LIMIT 1', [email]
    );

    if (!users.length) {
      conn.release();
      return res.json({ success: false, message: 'No account found with this email.' });
    }

    const user = users[0];
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await conn.query(
      `INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE token=VALUES(token), expires_at=VALUES(expires_at)`,
      [user.id, token, expires]
    );
    conn.release();

    res.json({ success: true, token, name: user.full_name });
  } catch(e) {
    console.error('Forgot password error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

// POST /api/auth/reset-password — reset password using token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.json({ success: false, message: 'Missing fields' });
    if (password.length < 6) return res.json({ success: false, message: 'Password must be at least 6 characters' });

    const conn = await pool.getConnection();
    const [resets] = await conn.query(
      'SELECT user_id FROM password_resets WHERE token = ? LIMIT 1', [token]
    );

    if (!resets.length) {
      conn.release();
      return res.json({ success: false, message: 'Invalid or expired reset link.' });
    }

    const userId = resets[0].user_id;
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(password, 10);

    await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashed, userId]);
    await conn.query('DELETE FROM password_resets WHERE user_id = ?', [userId]);
    conn.release();

    res.json({ success: true, message: 'Password reset successfully!' });
  } catch(e) {
    console.error('Reset password error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

module.exports = router;