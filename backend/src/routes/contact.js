const express = require('express');
const db = require('../db');
const events = require('../events');

const router = express.Router();

// POST /api/contact  { name, contact, message }
// Saves the message as an enquiry with no listing attached, so it appears in
// the admin Command Center under Enquiries (marked "Contact form").
router.post('/', async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').slice(0, 120).trim();
  const contact = String(b.contact || '').slice(0, 120).trim();
  const message = String(b.message || '').slice(0, 2000).trim();
  if (!name || !contact || message.length < 3) return res.status(400).json({ error: 'Please fill in all fields.' });

  try {
    await db.createLead({ listingId: null, ownerId: null, name, phone: contact, message });
  } catch (e) {
    console.error('[contact] could not save', e);
    return res.status(500).json({ error: 'Sorry, your message could not be sent. Please try again or reach us on WhatsApp.' });
  }

  // Live ping for anyone with the Command Center open.
  try { events.emitAdmin('activity', { kind: 'lead', at: new Date(), text: 'Contact form: ' + name + ' (' + contact + ')' }); } catch (e) {}
  console.log('[contact]', name, contact, '-', message);
  res.status(201).json({ ok: true });
});

module.exports = router;
