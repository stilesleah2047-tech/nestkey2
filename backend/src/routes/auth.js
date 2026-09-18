const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, requireAuth, isAdmin } = require('../auth');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, company: u.company, verified: u.verified, isAdmin: isAdmin(u) };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
    if (!b.password || String(b.password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const existing = await db.findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

    const passwordHash = await bcrypt.hash(String(b.password), 10);
    const user = await db.createUser({
      name: b.name ? String(b.name).slice(0, 120) : '',
      email,
      phone: b.phone ? String(b.phone).slice(0, 20) : '',
      role: ['agent', 'landlord', 'individual'].includes(b.role) ? b.role : 'landlord',
      company: b.company ? String(b.company).slice(0, 120) : '',
      passwordHash,
    });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
    try { require('../events').emitAdmin('activity', { kind: 'user', at: new Date(), text: 'New ' + user.role + ': ' + (user.name || user.email) }); } catch (e) {}
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not create account' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const b = req.body || {};
    const user = await db.findUserByEmail(String(b.email || '').trim().toLowerCase());
    if (!user) return res.status(401).json({ error: 'Wrong email or password.' });
    const ok = await bcrypt.compare(String(b.password || ''), user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Wrong email or password.' });
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: 'Could not sign in' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
