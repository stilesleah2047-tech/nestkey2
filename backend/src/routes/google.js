const express = require('express');
const db = require('../db');
const { sign } = require('../auth');

const router = express.Router();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

function publicUser(u) {
  const { isAdmin } = require('../auth');
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, company: u.company, verified: u.verified, isAdmin: isAdmin(u) };
}

// POST /api/auth/google  { credential }  -> { token, user }
router.post('/google', async (req, res) => {
  try {
    const credential = (req.body && req.body.credential) || '';
    if (!credential) return res.status(400).json({ error: 'Missing Google credential.' });
    if (!CLIENT_ID) return res.status(500).json({ error: 'Google sign-in is not configured.' });

    // Verify the ID token directly with Google (no extra npm packages needed).
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    const info = await r.json();
    if (!r.ok || !info.email) return res.status(401).json({ error: 'Could not verify Google sign-in.' });
    if (info.aud !== CLIENT_ID) return res.status(401).json({ error: 'Google token audience mismatch.' });
    if (info.email_verified !== 'true' && info.email_verified !== true) {
      return res.status(401).json({ error: 'Your Google email is not verified.' });
    }

    const email = String(info.email).toLowerCase();
    let user = await db.findUserByEmail(email);
    if (!user) {
      // Create an account for first-time Google users (random password hash they won't use).
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash('google-' + Date.now() + Math.random(), 10);
      user = await db.createUser({
        name: info.name || '',
        email,
        phone: '',
        role: 'landlord',
        company: '',
        passwordHash,
      });
    }
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    console.error('google auth', e);
    res.status(500).json({ error: 'Google sign-in failed.' });
  }
});

module.exports = router;
