const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /api/ratings  { stars, comment, context }
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    const stars = parseInt(b.stars, 10);
    if (!stars || stars < 1 || stars > 5) return res.status(400).json({ error: 'Pick 1–5 stars.' });
    await db.createRating({ stars, comment: b.comment ? String(b.comment).slice(0, 500) : '', context: b.context ? String(b.context).slice(0, 40) : '' });
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Could not save rating' });
  }
});

// GET /api/ratings/summary
router.get('/summary', async (_req, res) => {
  try { res.json(await db.ratingSummary()); } catch (e) { res.status(500).json({ error: 'Could not load' }); }
});

module.exports = router;
