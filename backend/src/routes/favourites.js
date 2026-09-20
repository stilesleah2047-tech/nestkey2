const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/favourites → { ids: [...] }
router.get('/', async (req, res) => {
  res.json({ ids: await db.listFavIds(req.user.id) });
});

// POST /api/favourites/:id
router.post('/:id', async (req, res) => {
  await db.addFav(req.user.id, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/favourites/:id
router.delete('/:id', async (req, res) => {
  await db.removeFav(req.user.id, req.params.id);
  res.json({ ok: true });
});

// POST /api/favourites/merge  { ids: [...] } — merge guest favourites on login
router.post('/merge/all', async (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.slice(0, 200) : [];
  for (const id of ids) { try { await db.addFav(req.user.id, id); } catch (e) {} }
  res.json({ ids: await db.listFavIds(req.user.id) });
});

module.exports = router;
