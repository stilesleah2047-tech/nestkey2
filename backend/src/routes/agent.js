const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { getPlan } = require('../plans');
const { sortRooms, labelFor } = require('../rooms');
const { countyForTown } = require('../locations');
const mpesa = require('../services/mpesa');
const pesapal = require('../services/pesapal');
const events = require('../events');

const router = express.Router();
router.use(requireAuth);

// GET /api/agent/summary — quota, counts, leads
router.get('/summary', async (req, res) => {
  const uid = req.user.id;
  const [mine, sub, leads] = await Promise.all([
    db.listByOwner(uid),
    db.getActiveSubByUserId(uid),
    db.listLeadsByOwner(uid),
  ]);
  const published = mine.filter((l) => l.status === 'published').length;
  const plan = sub ? getPlan(sub.planId) : null;
  const max = plan ? plan.maxListings : 0;
  res.json({
    counts: { total: mine.length, published, draft: mine.length - published },
    subscription: sub ? { plan: sub.planName, planId: sub.planId, periodEnd: sub.currentPeriodEnd } : null,
    quota: { max: max, used: published, remaining: max == null ? null : Math.max(0, max - published) },
    leads: leads.length,
  });
});

// GET /api/agent/listings — my listings (any status)
router.get('/listings', async (req, res) => {
  res.json({ items: await db.listByOwner(req.user.id) });
});

// POST /api/agent/listings — create a draft owned by me
router.post('/listings', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title || String(b.title).trim().length < 4) return res.status(400).json({ error: 'Please give the listing a clear title.' });

    let rooms = [];
    if (Array.isArray(b.rooms)) {
      rooms = sortRooms(b.rooms.slice(0, 20).map((r) => ({
        type: String(r.type || 'other'), label: labelFor(String(r.type || 'other')),
        description: r.description ? String(r.description).slice(0, 1000) : '',
        photos: Array.isArray(r.photos) ? r.photos.slice(0, 12) : [],
        videos: Array.isArray(r.videos) ? r.videos.slice(0, 4) : [],
      })));
    }
    let photos = Array.isArray(b.photos) ? b.photos.slice(0, 12) : [];
    if (!photos.length) rooms.some((r) => { if (r.photos.length) { photos = [r.photos[0]]; return true; } return false; });

    const listing = await db.create({
      title: String(b.title).slice(0, 160),
      deal: ['rent', 'sale', 'land'].includes(b.deal) ? b.deal : 'rent',
      type: b.type ? String(b.type).slice(0, 80) : '',
      price: parseFloat(b.price) || 0,
      beds: parseInt(b.beds, 10) || 0,
      baths: parseInt(b.baths, 10) || 0,
      region: b.region ? String(b.region).slice(0, 80) : '',
      county: (b.county && String(b.county).slice(0, 80)) || countyForTown(b.region) || '',
      size: b.size ? String(b.size).slice(0, 40) : '',
      areaAcres: b.areaAcres != null && b.areaAcres !== '' ? parseFloat(b.areaAcres) : null,
      lat: b.lat != null && b.lat !== '' ? parseFloat(b.lat) : null,
      lng: b.lng != null && b.lng !== '' ? parseFloat(b.lng) : null,
      location: b.location ? String(b.location).slice(0, 160) : (b.region || ''),
      description: b.description ? String(b.description).slice(0, 4000) : '',
      photos, videos: Array.isArray(b.videos) ? b.videos.slice(0, 6) : [], rooms,
      tier: b.tier === 'showcase' ? 'showcase' : 'standard',
      submitter: { name: req.user.name, phone: b.phone, email: req.user.email },
      ownerId: req.user.id, status: 'draft', paid: true,
    });
    res.status(201).json({ id: listing.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save listing' });
  }
});

// PUT /api/agent/listings/:id — edit
router.put('/listings/:id', async (req, res) => {
  const l = await db.getOwned(req.params.id, req.user.id);
  if (!l) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  await db.updateOwned(req.params.id, req.user.id, {
    title: b.title || l.title, deal: b.deal || l.deal, type: b.type || l.type,
    price: parseFloat(b.price) || l.price, beds: parseInt(b.beds, 10) || l.beds,
    baths: parseInt(b.baths, 10) || l.baths, region: b.region || l.region,
    location: b.location || l.location, description: b.description || l.description,
  });
  res.json({ ok: true });
});

// POST /api/agent/listings/:id/publish — quota-gated
router.post('/listings/:id/publish', async (req, res) => {
  const uid = req.user.id;
  const l = await db.getOwned(req.params.id, uid);
  if (!l) return res.status(404).json({ error: 'Not found' });

  const sub = await db.getActiveSubByUserId(uid);
  if (!sub) return res.status(402).json({ error: 'Choose a plan to publish listings.', needPlan: true });
  const plan = getPlan(sub.planId);
  const max = plan ? plan.maxListings : 0;
  if (max === 0) return res.status(403).json({ error: 'Your plan does not allow publishing. Upgrade to a landlord plan.' });
  if (max != null) {
    const used = await db.countPublishedByOwner(uid);
    if (used >= max && l.status !== 'published') {
      return res.status(403).json({ error: `You've reached your plan limit of ${max} published listings. Upgrade to publish more.`, quota: true });
    }
  }
  await db.markPaid(req.params.id, { receipt: l.receipt || 'plan-published' });
  // Pro & Agency get featured placement; the verified badge comes from admin approval.
  var isPremium = plan && (plan.id === 'pro' || plan.id === 'agency');
  var owner = await db.findUserById(uid);
  await db.setListingFlags(req.params.id, { featured: isPremium, verified: !!(owner && owner.verified) });
  const fresh = await db.getById(req.params.id);
  events.emit('listing.published', {
    id: fresh.id, title: fresh.title, price: fresh.price, region: fresh.region,
    location: fresh.location, deal: fresh.deal, beds: fresh.beds, photo: (fresh.photos || [])[0] || '',
  });
  events.emitAdmin('activity', { kind: 'listing', at: new Date(), text: 'Listing live: ' + fresh.title + ' (' + fresh.deal + ')' });
  res.json({ ok: true });
});

// POST /api/agent/listings/:id/unpublish
router.post('/listings/:id/unpublish', async (req, res) => {
  const l = await db.getOwned(req.params.id, req.user.id);
  if (!l) return res.status(404).json({ error: 'Not found' });
  await db.setStatus(req.params.id, 'draft');
  res.json({ ok: true });
});

// DELETE /api/agent/listings/:id
router.delete('/listings/:id', async (req, res) => {
  await db.deleteOwned(req.params.id, req.user.id);
  res.json({ ok: true });
});

// GET /api/agent/leads
router.get('/leads', async (req, res) => {
  res.json({ items: await db.listLeadsByOwner(req.user.id) });
});

// GET /api/agent/profile — payment/payout + KYC details
router.get('/profile', async (req, res) => {
  const u = await db.findUserById(req.user.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json({
    name: u.name, email: u.email, phone: u.phone, role: u.role, company: u.company,
    payoutMethod: u.payoutMethod || '', payoutMpesa: u.payoutMpesa || '',
    bankName: u.bankName || '', bankAccountName: u.bankAccountName || '', bankAccountNumber: u.bankAccountNumber || '',
    idNumber: u.idNumber || '', kraPin: u.kraPin || '', businessName: u.businessName || '',
  });
});

// PUT /api/agent/profile — save payment details (where tenants pay you)
router.put('/profile', async (req, res) => {
  const b = req.body || {};
  const u = await db.updateUserPayout(req.user.id, {
    payoutMethod: ['mpesa', 'bank'].includes(b.payoutMethod) ? b.payoutMethod : null,
    payoutMpesa: b.payoutMpesa ? String(b.payoutMpesa).slice(0, 20) : '',
    bankName: b.bankName ? String(b.bankName).slice(0, 80) : '',
    bankAccountName: b.bankAccountName ? String(b.bankAccountName).slice(0, 120) : '',
    bankAccountNumber: b.bankAccountNumber ? String(b.bankAccountNumber).slice(0, 40) : '',
    idNumber: b.idNumber ? String(b.idNumber).slice(0, 20) : '',
    kraPin: b.kraPin ? String(b.kraPin).slice(0, 20) : '',
    businessName: b.businessName ? String(b.businessName).slice(0, 120) : '',
  });
  res.json({ ok: true, payoutMethod: u.payoutMethod });
});

// GET /api/agent/transactions — rent payments recorded + commission summary
router.get('/transactions', async (req, res) => {
  const [items, summary] = await Promise.all([
    db.listTransactionsByOwner(req.user.id),
    db.ownerCommissionSummary(req.user.id),
  ]);
  res.json({ items, summary });
});

// POST /api/agent/commission/pay { provider, phone } — settle the 8% we invoiced
router.post('/commission/pay', async (req, res) => {
  try {
    const summary = await db.ownerCommissionSummary(req.user.id);
    if (!summary.owed || summary.owed <= 0) return res.status(400).json({ error: 'No commission due.' });
    const provider = req.body && req.body.provider === 'pesapal' ? 'pesapal' : 'mpesa';
    const comm = await db.createCommission({ ownerId: req.user.id, amount: summary.owed });

    if (provider === 'pesapal') {
      const order = await pesapal.submitOrder({ merchantRef: 'COMM' + comm.id, amount: summary.owed, description: 'NestKey commission', email: req.user.email });
      if (!order.ok) return res.status(400).json({ error: order.error });
      await db.setEscrowCheckout(comm.id, { checkoutId: order.orderTrackingId, provider });
      return res.json({ ok: true, provider, orderTrackingId: order.orderTrackingId, iframeUrl: order.redirectUrl, amount: summary.owed });
    }
    const stk = await mpesa.stkPush({ phone: req.body.phone, amount: summary.owed, accountRef: 'COMM' + comm.id, desc: 'NestKey commission' });
    if (!stk.ok) return res.status(400).json({ error: stk.error });
    await db.setEscrowCheckout(comm.id, { checkoutId: stk.checkout, provider });
    res.json({ ok: true, provider, checkout: stk.checkout, amount: summary.owed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not start commission payment' });
  }
});

module.exports = router;
