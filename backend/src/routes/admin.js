const express = require('express');
const db = require('../db');
const { requireAuth, isAdmin } = require('../auth');

const router = express.Router();

router.use(requireAuth, function (req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admins only' });
  next();
});

// GET /api/admin/overview — KPIs + breakdowns + ratings
router.get('/overview', async (_req, res) => {
  try {
    const [stats, ratings] = await Promise.all([db.adminStats(), db.ratingSummary()]);
    res.json({ stats, ratings });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load overview' });
  }
});

// GET /api/admin/activity — merged recent activity feed
router.get('/activity', async (req, res) => {
  try { res.json({ items: await db.recentActivity(parseInt(req.query.limit, 10) || 40) }); }
  catch (e) { res.status(500).json({ error: 'Could not load activity' }); }
});

// GET /api/admin/listings — recent listings for moderation
router.get('/listings', async (_req, res) => {
  try { res.json({ items: await db.adminListings(60) }); }
  catch (e) { res.status(500).json({ error: 'Could not load listings' }); }
});

router.post('/listings/:id/unpublish', async (req, res) => { await db.setStatus(req.params.id, 'draft'); res.json({ ok: true }); });
router.post('/listings/:id/publish', async (req, res) => { await db.publish(req.params.id); res.json({ ok: true }); });
router.delete('/listings/:id', async (req, res) => { await db.deleteAny(req.params.id); res.json({ ok: true }); });

// Users & verification
router.get('/users', async (_req, res) => {
  try { res.json({ items: await db.listUsersForAdmin(100) }); }
  catch (e) { res.status(500).json({ error: 'Could not load users' }); }
});
router.post('/users/:id/verify', async (req, res) => { await db.setUserVerified(req.params.id, true); res.json({ ok: true }); });
router.post('/users/:id/unverify', async (req, res) => { await db.setUserVerified(req.params.id, false); res.json({ ok: true }); });

module.exports = router;
