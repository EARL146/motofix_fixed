const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client();

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



// Google Sign-In configuration
router.get('/google/config', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  res.json({ success: true, clientId });
});

// Google Sign-In: verify Google's ID token, find/create the MotoFix user,
// record the login, and return the same session shape used by normal login.
router.post('/google', async (req, res) => {
  let conn;
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'admin@gmail.com').split(',').map(e => e.toLowerCase().trim()).filter(Boolean);
  const adminMode = req.query.mode === 'admin';
  try {
    const credential = req.body?.credential;
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }
    if (!clientId) {
      return res.status(503).json({ success: false, message: 'Google Sign-In is not configured yet. Add GOOGLE_CLIENT_ID to .env.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
      return res.status(401).json({ success: false, message: 'Google account could not be verified' });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase().trim();

    // Strict admin login: only the configured admin email may use the admin login.
    if (adminMode && !adminEmails.includes(email)) {
      return res.status(403).json({ success: false, message: 'Admin access denied.' });
    }
    // Keep the designated admin account out of the customer login flow.
    if (!adminMode && adminEmails.includes(email)) {
      return res.status(403).json({ success: false, message: 'Please use the Admin Login.' });
    }

    const fullName = (payload.name || email.split('@')[0] || 'Google User').trim();
    const avatar = payload.picture || '';

    conn = await pool.getConnection();

    // First match by Google ID. If this is an existing MotoFix account,
    // match the verified Google email too and link it automatically.
    let [users] = await conn.query(
      'SELECT id, full_name, name, email, role, google_id, avatar_data FROM users WHERE google_id = ? LIMIT 1',
      [googleId]
    );

    if (users.length === 0) {
      [users] = await conn.query(
        'SELECT id, full_name, name, email, role, google_id, avatar_data FROM users WHERE email = ? LIMIT 1',
        [email]
      );
    }

    let user;
    if (users.length > 0) {
      user = users[0];
      await conn.query(
        `UPDATE users
         SET google_id = ?, full_name = COALESCE(NULLIF(full_name,''), ?),
             name = COALESCE(NULLIF(name,''), ?),
             avatar_data = COALESCE(NULLIF(avatar_data,''), ?),
             last_login = NOW(), is_logged_in = 1
         WHERE id = ?`,
        [googleId, fullName, fullName, avatar, user.id]
      );
      user.google_id = googleId;
      user.full_name = user.full_name || fullName;
      user.name = user.name || fullName;
    } else {
      const [result] = await conn.query(
        `INSERT INTO users
          (full_name, name, email, phone_number, password_hash, role, google_id, avatar_data, last_login, is_logged_in)
         VALUES (?, ?, ?, '', NULL, 'customer', ?, ?, NOW(), 1)`,
        [fullName, fullName, email, googleId, avatar]
      );
      user = {
        id: result.insertId,
        full_name: fullName,
        name: fullName,
        email,
        role: 'customer',
        google_id: googleId,
        avatar_data: avatar
      };
    }

    // Admin Google login must match BOTH the exact admin email and DB role.
    // Never auto-create or auto-promote an admin account from Google login.
    if (adminMode && (!adminEmails.includes(user.email.toLowerCase().trim()) || user.role !== 'admin')) {
      if (conn) conn.release();
      conn = null;
      return res.status(403).json({ success: false, message: 'Admin account is not authorized.' });
    }

    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress || req.connection.remoteAddress || 'unknown';

    try {
      await conn.query(
        'INSERT INTO login_logs (user_id, ip_address) VALUES (?, ?)',
        [user.id, ipAddress]
      );
    } catch (logError) {
      console.error('Google login log failed:', logError.message);
    }

    conn.release();
    conn = null;

    const token = Buffer.from(JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.full_name || user.name || '',
      timestamp: Date.now()
    })).toString('base64');

    res.json({
      success: true,
      message: 'Google login successful',
      token,
      ip_address: ipAddress,
      user: {
        id: user.id,
        name: user.full_name || user.name || 'User',
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    if (conn) conn.release();
    res.status(401).json({ success: false, message: 'Google login failed. Please try again.' });
  }
});

// TikTok Login Kit (customer-only OAuth 2.0)
// Web Login Kit uses the v2 authorize endpoint, a CSRF state cookie,
// server-side token exchange, and the v2 User Info API.
const crypto = require('crypto');

const readCookie = (req, name) => {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return decodeURIComponent(part.slice(idx + 1));
  }
  return null;
};

const safeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const tiktokResultPage = ({ success, message, token, user }) => {
  const safeMessage = safeHtml(message || (success ? 'TikTok login successful.' : 'TikTok login failed.'));
  if (!success) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>TikTok Login</title></head><body style="font-family:Arial,sans-serif;background:#111;color:#fff;display:grid;place-items:center;min-height:100vh"><div style="max-width:520px;padding:28px;text-align:center"><h2>TikTok Login Failed</h2><p>${safeMessage}</p><p><a href="/" style="color:#69c0ff">Return to MotoMarket</a></p></div></body></html>`;
  }

  const payload = JSON.stringify({
    token,
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || ''
  }).replace(/</g, '\\u003c');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Signing in...</title></head><body style="font-family:Arial,sans-serif;background:#111;color:#fff;display:grid;place-items:center;min-height:100vh"><div style="text-align:center"><h2>Signing you in...</h2><p>Please wait.</p></div><script>
try {
  const user = ${payload};
  localStorage.setItem('mf_user', JSON.stringify(user));
  localStorage.setItem('sessionToken', user.token);
  window.location.replace('/');
} catch (e) {
  document.body.innerHTML = '<div style="text-align:center"><h2>Login completed</h2><p>Please return to MotoMarket.</p><a href="/" style="color:#69c0ff">Continue</a></div>';
}
</script></body></html>`;
};

router.get('/tiktok', async (req, res) => {
  const clientKey = (process.env.TIKTOK_CLIENT_KEY || '').trim();
  const redirectUri = (process.env.TIKTOK_REDIRECT_URI || '').trim();

  if (!clientKey || !process.env.TIKTOK_CLIENT_SECRET) {
    return res.status(503).send(tiktokResultPage({
      success: false,
      message: 'TikTok Login is not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env.'
    }));
  }

  if (!redirectUri || !/^https:\/\//i.test(redirectUri) || /[?#]/.test(redirectUri)) {
    return res.status(503).send(tiktokResultPage({
      success: false,
      message: 'TIKTOK_REDIRECT_URI must be a static HTTPS URL registered in TikTok Login Kit settings. Example: https://your-ngrok-domain.ngrok-free.app/api/auth/tiktok/callback'
    }));
  }

  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('tiktok_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/'
  });

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.set('client_key', clientKey);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'user.info.basic');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  return res.redirect(authUrl.toString());
});

router.get('/tiktok/callback', async (req, res) => {
  const code = req.query.code;
  const returnedState = req.query.state;
  const expectedState = readCookie(req, 'tiktok_oauth_state');
  const redirectUri = (process.env.TIKTOK_REDIRECT_URI || '').trim();
  const clientKey = (process.env.TIKTOK_CLIENT_KEY || '').trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';

  res.clearCookie('tiktok_oauth_state', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });

  if (req.query.error) {
    return res.status(401).send(tiktokResultPage({
      success: false,
      message: req.query.error_description || req.query.error || 'TikTok authorization was denied.'
    }));
  }

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    return res.status(400).send(tiktokResultPage({
      success: false,
      message: 'Invalid TikTok authorization state. Please try again.'
    }));
  }

  if (!clientKey || !clientSecret || !redirectUri || !/^https:\/\//i.test(redirectUri)) {
    return res.status(503).send(tiktokResultPage({
      success: false,
      message: 'TikTok Login is not configured correctly on the server.'
    }));
  }

  let conn;
  try {
    // Exchange the one-time authorization code server-side.
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: String(code),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData?.access_token || !tokenData?.open_id) {
      console.error('TikTok token exchange failed:', tokenData);
      return res.status(401).send(tiktokResultPage({
        success: false,
        message: tokenData?.error?.message || tokenData?.message || 'TikTok token exchange failed.'
      }));
    }

    // Fetch only the basic profile fields granted by user.info.basic.
    const infoResponse = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const infoData = await infoResponse.json();
    const tiktokUser = infoData?.data?.user;

    if (!infoResponse.ok || !tiktokUser?.open_id) {
      console.error('TikTok user info failed:', infoData);
      return res.status(401).send(tiktokResultPage({
        success: false,
        message: infoData?.error?.message || 'Could not retrieve your TikTok profile.'
      }));
    }

    const openId = String(tiktokUser.open_id);
    const displayName = String(tiktokUser.display_name || 'TikTok User').trim() || 'TikTok User';
    const avatar = String(tiktokUser.avatar_url || '').trim();
    const placeholderEmail = `tiktok_${openId}@tiktok.local`;

    conn = await pool.getConnection();

    // TikTok is customer-only. Never use it to create or authenticate admins.
    let [users] = await conn.query(
      'SELECT id, full_name, name, email, role, avatar_data FROM users WHERE tiktok_open_id = ? LIMIT 1',
      [openId]
    );

    let user;
    if (users.length > 0) {
      user = users[0];
      if (String(user.role).toLowerCase() === 'admin') {
        conn.release();
        conn = null;
        return res.status(403).send(tiktokResultPage({ success: false, message: 'Admin accounts must use Admin Login.' }));
      }

      await conn.query(
        `UPDATE users
         SET full_name = ?, name = ?, avatar_data = ?, last_login = NOW(), is_logged_in = 1
         WHERE id = ?`,
        [displayName, displayName, avatar, user.id]
      );
      user.full_name = displayName;
      user.name = displayName;
      user.avatar_data = avatar;
    } else {
      const [result] = await conn.query(
        `INSERT INTO users
          (full_name, name, email, phone_number, password_hash, role, tiktok_open_id, avatar_data, last_login, is_logged_in)
         VALUES (?, ?, ?, '', NULL, 'customer', ?, ?, NOW(), 1)`,
        [displayName, displayName, placeholderEmail, openId, avatar]
      );
      user = {
        id: result.insertId,
        full_name: displayName,
        name: displayName,
        email: placeholderEmail,
        role: 'customer',
        avatar_data: avatar
      };
    }

    // Keep the OAuth tokens server-side only. They are never sent to the browser.
    await conn.query(
      `INSERT INTO tiktok_accounts
        (user_id, open_id, access_token, refresh_token, expires_at, refresh_expires_at, scope)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         access_token = VALUES(access_token),
         refresh_token = VALUES(refresh_token),
         expires_at = VALUES(expires_at),
         refresh_expires_at = VALUES(refresh_expires_at),
         scope = VALUES(scope),
         updated_at = CURRENT_TIMESTAMP`,
      [
        user.id,
        openId,
        tokenData.access_token,
        tokenData.refresh_token || null,
        tokenData.expires_in ? new Date(Date.now() + Number(tokenData.expires_in) * 1000) : null,
        tokenData.refresh_expires_in ? new Date(Date.now() + Number(tokenData.refresh_expires_in) * 1000) : null,
        tokenData.scope || 'user.info.basic'
      ]
    );

    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress || req.connection.remoteAddress || 'unknown';

    try {
      await conn.query('INSERT INTO login_logs (user_id, ip_address) VALUES (?, ?)', [user.id, ipAddress]);
    } catch (logError) {
      console.error('TikTok login log failed:', logError.message);
    }

    conn.release();
    conn = null;

    const token = Buffer.from(JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.full_name || user.name || displayName,
      timestamp: Date.now()
    })).toString('base64');

    return res.send(tiktokResultPage({
      success: true,
      message: 'TikTok login successful.',
      token,
      user: {
        id: user.id,
        name: user.full_name || user.name || displayName,
        email: user.email,
        role: user.role,
        avatar: avatar || user.avatar_data || ''
      }
    }));
  } catch (error) {
    console.error('TikTok login error:', error);
    if (conn) conn.release();
    return res.status(500).send(tiktokResultPage({
      success: false,
      message: 'TikTok login failed. Check the server terminal for details.'
    }));
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
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'admin@gmail.com').split(',').map(e => e.toLowerCase().trim()).filter(Boolean);
  const adminMode = req.query.mode === 'admin';
  let conn;
  try {
    const { email: rawEmail, password } = req.body;
    const email = (rawEmail || '').toLowerCase().trim();
    
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

    // Strict admin login policy.
    if (adminMode && (!adminEmails.includes(email) || user.role !== 'admin')) {
      conn.release();
      return res.json({ success: false, message: 'Admin access denied.' });
    }
    if (!adminMode && adminEmails.includes(email)) {
      conn.release();
      return res.json({ success: false, message: 'Please use the Admin Login.' });
    }
    
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
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client();
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