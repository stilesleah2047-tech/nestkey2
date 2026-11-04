const express = require('express');
const db = require('../db');
const { sortRooms, labelFor } = require('../rooms');
const { countyForTown } = require('../locations');
const { parsePrice } = require('../price');
const { cleanMedia } = require('../media');
const { rateLimit } = require('../ratelimit');
const { optionalAuth } = require('../auth');

const enquireLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 8, message: 'You have sent several enquiries. Please wait a few minutes.' });
const createLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });

const router = express.Router();

// Strip private / payment fields before sending a listing to the public.
// (The public API used to expose the lister's email, M-Pesa checkout id and receipt.)
function publicListing(l) {
  if (!l) return l;
  const { checkoutId, receipt, amount, payError, ...rest } = l;
  rest.submitter = { name: (l.submitter && l.submitter.name) || '', phone: (l.submitter && l.submitter.phone) || '' };
  return rest;
}

// GET /api/listings  — public search with filters
router.get('/', async (req, res) => {
  try {
    const q = req.query;
    const result = await db.list({
      q: q.q,
      region: q.region,
      county: q.county,
      deal: q.deal,
      minBeds: q.minBeds ? parseInt(q.minBeds, 10) : 0,
      minPrice: q.minPrice ? parseFloat(q.minPrice) : 0,
      maxPrice: q.maxPrice ? parseFloat(q.maxPrice) : 0,
      sort: q.sort,
      limit: Math.min(Math.max(parseInt(q.limit, 10) || 24, 1), 60),
      page: Math.max(parseInt(q.page, 10) || 1, 1),
    });
    if (result && Array.isArray(result.items)) result.items = result.items.map(publicListing);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load listings' });
  }
});

// GET /api/listings/regions — region + counts (for chips)
router.get('/regions', async (_req, res) => {
  try {
    res.json(await db.regions());
  } catch (e) {
    res.status(500).json({ error: 'Could not load regions' });
  }
});

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
  try {
    const l = await db.getById(req.params.id);
    if (!l || !l.paid || l.status !== 'published') return res.status(404).json({ error: 'Not found' });
    db.incrementViews(req.params.id).catch(function () {});
    res.json(publicListing(l));
  } catch (e) {
    res.status(500).json({ error: 'Could not load listing' });
  }
});

// POST /api/listings/:id/enquire  { name, phone, message } → lead for the owner
router.post('/:id/enquire', enquireLimit, async (req, res) => {
  try {
    const l = await db.getById(req.params.id);
    if (!l || !l.paid || l.status !== 'published') return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    if (String(b.phone || '').replace(/\D/g, '').length < 9) return res.status(400).json({ error: 'Add a phone number so the owner can reach you.' });
    await db.createLead({
      listingId: l.id, ownerId: l.ownerId,
      name: b.name ? String(b.name).slice(0, 120) : '',
      phone: b.phone ? String(b.phone).slice(0, 20) : '',
      message: b.message ? String(b.message).slice(0, 1000) : '',
    });
    if (l.ownerId) {
      require('../events').emit('lead.created', { listingId: l.id, title: l.title, name: b.name, phone: b.phone }, l.ownerId);
    }
    require('../events').emitAdmin('activity', { kind: 'lead', at: new Date(), text: 'Enquiry on ' + l.title + ' from ' + (b.name || 'someone') });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Could not send enquiry' });
  }
});

// POST /api/listings — create a pending (unpaid) listing
router.post('/', createLimit, optionalAuth, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title || String(b.title).trim().length < 4) {
      return res.status(400).json({ error: 'Please provide a clear listing title.' });
    }
    // Hunters are promised they can call / WhatsApp the lister, so a phone is required.
    if (String(b.phone || '').replace(/\D/g, '').length < 9) {
      return res.status(400).json({ error: 'Please add a phone / WhatsApp number so hunters can reach you.' });
    }
    // Sanitize + auto-order rooms into a canonical walk-through.
    var rooms = [];
    if (Array.isArray(b.rooms)) {
      rooms = sortRooms(b.rooms.slice(0, 20).map(function (r) {
        return {
          type: String(r.type || 'other'),
          label: labelFor(String(r.type || 'other')),
          description: r.description ? String(r.description).slice(0, 1000) : '',
          photos: cleanMedia(r.photos, 12),
          videos: cleanMedia(r.videos, 4),
        };
      }));
    }
    var tier = b.tier === 'showcase' ? 'showcase' : 'standard';

    // Cover photos = general photos, else the first photo found in rooms.
    var photos = cleanMedia(b.photos, 12);
    if (!photos.length) {
      rooms.some(function (r) { if (r.photos.length) { photos = [r.photos[0]]; return true; } return false; });
    }

    const listing = await db.create({
      title: String(b.title).slice(0, 160),
      deal: ['rent', 'sale', 'land'].includes(b.deal) ? b.deal : 'rent',
      type: b.type ? String(b.type).slice(0, 80) : '',
      price: parsePrice(b.price),
      beds: parseInt(b.beds, 10) || 0,
      baths: parseInt(b.baths, 10) || 0,
      roomCount: Math.min(parseInt(b.roomCount, 10) || 0, 999),
      size: b.size ? String(b.size).slice(0, 40) : '',
      areaAcres: b.areaAcres != null && b.areaAcres !== '' ? parseFloat(b.areaAcres) : null,
      lat: b.lat != null && b.lat !== '' ? parseFloat(b.lat) : null,
      lng: b.lng != null && b.lng !== '' ? parseFloat(b.lng) : null,
      region: b.region ? String(b.region).slice(0, 80) : '',
      county: (b.county && String(b.county).slice(0, 80)) || countyForTown(b.region) || '',
      location: b.location ? String(b.location).slice(0, 160) : (b.region || ''),
      description: b.description ? String(b.description).slice(0, 4000) : '',
      photos: photos,
      videos: cleanMedia(b.videos, 6),
      rooms: rooms,
      tier: tier,
      // Link the listing to the signed-in account so it shows in their dashboard.
      ownerId: req.user ? req.user.id : null,
      submitter: {
        name: b.name ? String(b.name).slice(0, 120) : '',
        phone: String(b.phone).slice(0, 20),
        email: b.email ? String(b.email).slice(0, 160) : '',
      },
    });
    res.status(201).json({ id: listing.id, tier: listing.tier });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save listing' });
  }
});

module.exports = router;
