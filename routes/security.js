// ══════════════════════════════════════════════════════
//  MotoFix Security Monitor — routes/security.js
//  Tracks: failed logins, rate abuse, suspicious IPs,
//  unusual traffic patterns on ngrok tunnel
// ══════════════════════════════════════════════════════
const express = require('express');
const router  = express.Router();

// ── In-memory security log (resets on server restart) ─
const _secLog = {
  failedLogins:   [],   // { ip, email, time }
  blockedIPs:     new Set(),
  requestLog:     [],   // { ip, path, method, time, ua }
  alerts:         [],   // { type, msg, time, ip }
  startTime:      Date.now()
};

const MAX_FAILED_LOGINS = 5;     // per IP in 10 minutes
const MAX_REQ_PER_MIN   = 60;    // per IP per minute
const ALERT_KEEP        = 200;   // max alerts stored
const REQ_KEEP          = 1000;  // max requests stored

// ── Helpers ────────────────────────────────────────────
function _getIP(req) {
  return (req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
}

function _addAlert(type, msg, ip = '') {
  _secLog.alerts.unshift({ type, msg, ip, time: new Date().toISOString() });
  if (_secLog.alerts.length > ALERT_KEEP) _secLog.alerts.length = ALERT_KEEP;
  console.warn(`[🛡️ SECURITY] [${type}] ${msg} | IP: ${ip}`);
}

function _pruneOld(arr, msAgo) {
  const cutoff = Date.now() - msAgo;
  return arr.filter(x => new Date(x.time).getTime() > cutoff);
}

// ── Middleware: log every request ─────────────────────
function securityMiddleware(req, res, next) {
  const ip   = _getIP(req);
  const now  = Date.now();
  const time = new Date().toISOString();
  const ua   = req.headers['user-agent'] || '';
  const path = req.path;

  // Log request
  _secLog.requestLog.unshift({ ip, path, method: req.method, time, ua });
  if (_secLog.requestLog.length > REQ_KEEP) _secLog.requestLog.length = REQ_KEEP;

  // Block if IP is banned
  if (_secLog.blockedIPs.has(ip)) {
    _addAlert('BLOCKED', `Blocked IP tried to access ${path}`, ip);
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  // Rate limit check: too many requests per minute
  const recentReqs = _secLog.requestLog.filter(r => {
    return r.ip === ip && (now - new Date(r.time).getTime()) < 60000;
  });
  if (recentReqs.length > MAX_REQ_PER_MIN) {
    _addAlert('RATE_LIMIT', `IP exceeded ${MAX_REQ_PER_MIN} req/min on ${path}`, ip);
    // Auto-block if 3x over limit
    if (recentReqs.length > MAX_REQ_PER_MIN * 3) {
      _secLog.blockedIPs.add(ip);
      _addAlert('AUTO_BLOCK', `IP auto-blocked for exceeding ${MAX_REQ_PER_MIN * 3} req/min`, ip);
    }
    return res.status(429).json({ success: false, message: 'Too many requests. Slow down.' });
  }

  // Detect suspicious user agents (scanners/bots)
  const suspiciousUA = ['sqlmap', 'nikto', 'nmap', 'masscan', 'zgrab', 'python-requests', 'curl/'];
  const uaLower = ua.toLowerCase();
  if (suspiciousUA.some(s => uaLower.includes(s))) {
    _addAlert('SUSPICIOUS_UA', `Scanner/bot detected: ${ua.slice(0, 80)}`, ip);
  }

  // Detect path traversal attempts
  if (path.includes('../') || path.includes('..\\') || path.includes('%2e%2e')) {
    _addAlert('PATH_TRAVERSAL', `Path traversal attempt: ${path}`, ip);
    return res.status(400).json({ success: false, message: 'Bad request.' });
  }

  // Detect SQL injection patterns in URL
  const sqliPattern = /(\bunion\b|\bselect\b|\bdrop\b|\binsert\b|\bdelete\b|\bexec\b|--|\/\*|\*\/|xp_)/i;
  if (sqliPattern.test(req.url)) {
    _addAlert('SQLI_ATTEMPT', `Possible SQL injection in URL: ${req.url.slice(0, 100)}`, ip);
    return res.status(400).json({ success: false, message: 'Bad request.' });
  }

  // Detect XSS patterns
  const xssPattern = /<script|javascript:|onerror=|onload=|alert\(/i;
  if (xssPattern.test(decodeURIComponent(req.url))) {
    _addAlert('XSS_ATTEMPT', `Possible XSS in URL: ${req.url.slice(0, 100)}`, ip);
    return res.status(400).json({ success: false, message: 'Bad request.' });
  }

  next();
}

// ── Track failed login (called from auth route) ────────
function trackFailedLogin(ip, email) {
  _secLog.failedLogins.push({ ip, email, time: new Date().toISOString() });

  // Count recent failures per IP (last 10 minutes)
  const recent = _pruneOld(_secLog.failedLogins, 10 * 60 * 1000)
    .filter(f => f.ip === ip);
  _secLog.failedLogins = recent;

  if (recent.length >= MAX_FAILED_LOGINS) {
    _addAlert('BRUTE_FORCE', `${recent.length} failed logins for email: ${email}`, ip);
    if (recent.length >= MAX_FAILED_LOGINS * 2) {
      _secLog.blockedIPs.add(ip);
      _addAlert('AUTO_BLOCK', `IP auto-blocked after ${recent.length} failed logins`, ip);
    }
  }
}

// ── GET /api/security/status — full snapshot for AI ───
router.get('/status', (req, res) => {
  const now = Date.now();
  const last1h = now - 3600000;
  const last10m = now - 600000;

  // Requests in last hour and minute
  const reqLastHour = _secLog.requestLog.filter(r => new Date(r.time).getTime() > last1h);
  const reqLast10m  = _secLog.requestLog.filter(r => new Date(r.time).getTime() > last10m);

  // Unique IPs
  const uniqueIPs = [...new Set(reqLastHour.map(r => r.ip))];

  // Top IPs by request count (last hour)
  const ipCounts = {};
  reqLastHour.forEach(r => { ipCounts[r.ip] = (ipCounts[r.ip] || 0) + 1; });
  const topIPs = Object.entries(ipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));

  // Top paths
  const pathCounts = {};
  reqLastHour.forEach(r => { pathCounts[r.path] = (pathCounts[r.path] || 0) + 1; });
  const topPaths = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // Recent alerts by type
  const alertCounts = {};
  _secLog.alerts.forEach(a => { alertCounts[a.type] = (alertCounts[a.type] || 0) + 1; });

  res.json({
    success: true,
    data: {
      serverUptime: Math.floor((now - _secLog.startTime) / 1000) + 's',
      serverType: 'ngrok tunnel (Node.js/Express)',
      totalRequestsLogged: _secLog.requestLog.length,
      requestsLastHour: reqLastHour.length,
      requestsLast10Min: reqLast10m.length,
      uniqueIPsLastHour: uniqueIPs.length,
      blockedIPCount: _secLog.blockedIPs.size,
      blockedIPs: [..._secLog.blockedIPs],
      failedLoginsRecent: _secLog.failedLogins.length,
      recentAlerts: _secLog.alerts.slice(0, 20),
      alertSummary: alertCounts,
      topIPs,
      topPaths,
      threatLevel: _secLog.alerts.filter(a =>
        ['BRUTE_FORCE','AUTO_BLOCK','SQLI_ATTEMPT','XSS_ATTEMPT'].includes(a.type) &&
        (now - new Date(a.time).getTime()) < 3600000
      ).length > 0 ? 'HIGH' : reqLast10m.length > 30 ? 'MEDIUM' : 'LOW'
    }
  });
});

// ── GET /api/security/alerts — recent alerts only ─────
router.get('/alerts', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ success: true, data: _secLog.alerts.slice(0, limit) });
});

// ── POST /api/security/unblock — unblock an IP ────────
router.post('/unblock', (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ success: false, message: 'IP required' });
  _secLog.blockedIPs.delete(ip);
  _addAlert('UNBLOCKED', `IP manually unblocked by admin`, ip);
  res.json({ success: true, message: `${ip} unblocked` });
});

// ── POST /api/security/block — manually block an IP ───
router.post('/block', (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ success: false, message: 'IP required' });
  _secLog.blockedIPs.add(ip);
  _addAlert('MANUAL_BLOCK', `IP manually blocked by admin`, ip);
  res.json({ success: true, message: `${ip} blocked` });
});

module.exports = { router, securityMiddleware, trackFailedLogin };
