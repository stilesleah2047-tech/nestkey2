const express = require('express');
const events = require('../events');

const router = express.Router();

// POST /api/contact  { name, contact, message }
router.post('/', (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').slice(0, 120).trim();
  const contact = String(b.contact || '').slice(0, 120).trim();
  const message = String(b.message || '').slice(0, 2000).trim();
  if (!name || !contact || message.length < 3) return res.status(400).json({ error: 'Please fill in all fields.' });
  // Surface it live in the admin Command Center feed.
  try { events.emitAdmin('activity', { kind: 'mail', at: new Date(), text: 'Contact from ' + name + ' (' + contact + '): ' + message.slice(0, 140) }); } catch (e) {}
  console.log('[contact]', name, contact, '-', message);
  res.status(201).json({ ok: true });
});

module.exports = router;
