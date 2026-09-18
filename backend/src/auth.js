const jwt = require('jsonwebtoken');
const config = require('./config');

function sign(user) {
  return jwt.sign(
    { id: String(user.id), email: user.email, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

function verify(token) {
  try { return jwt.verify(token, config.jwtSecret); } catch (e) { return null; }
}

function tokenFrom(req) {
  var h = req.headers.authorization || '';
  return h.replace(/^Bearer\s+/i, '');
}

function requireAuth(req, res, next) {
  const u = verify(tokenFrom(req));
  if (!u) return res.status(401).json({ error: 'Please sign in.' });
  req.user = u;
  next();
}

function optionalAuth(req, res, next) {
  const u = verify(tokenFrom(req));
  if (u) req.user = u;
  next();
}

function isAdmin(user) {
  if (!user) return false;
  const config = require('./config');
  return config.adminEmails.includes(String(user.email || '').toLowerCase());
}

module.exports = { sign, verify, requireAuth, optionalAuth, isAdmin };
