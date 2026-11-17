// Admin: list enquiries from every owner (used by GET /api/admin/leads).
// Kept separate from the main driver files so it works with either database.
const config = require('../config');

let pgPool = null;

module.exports = async function adminLeads(limit) {
  const n = Math.min(parseInt(limit, 10) || 100, 500);

  if (config.driver === 'mongo') {
    const mongoose = require('mongoose');
    const Lead = mongoose.models.Lead;
    const Listing = mongoose.models.Listing;
    if (!Lead) return [];
    const leads = await Lead.find({}).sort({ createdAt: -1 }).limit(n);
    const ids = [...new Set(leads.map((l) => l.listingId).filter((x) => x && mongoose.isValidObjectId(x)))];
    const titles = {};
    if (Listing && ids.length) {
      (await Listing.find({ _id: { $in: ids } }, { title: 1 })).forEach((l) => { titles[String(l._id)] = l.title; });
    }
    return leads.map((l) => ({
      id: String(l._id), listingId: l.listingId || null, listingTitle: titles[l.listingId] || null,
      name: l.name, phone: l.phone, message: l.message, createdAt: l.createdAt,
    }));
  }

  if (!pgPool) {
    const { Pool } = require('pg');
    pgPool = new Pool({ connectionString: config.databaseUrl, max: 2 });
  }
  const { rows } = await pgPool.query(
    `SELECT ld.id, ld.listing_id, ld.name, ld.phone, ld.message, ld.created_at, l.title AS listing_title
     FROM leads ld LEFT JOIN listings l ON l.id = ld.listing_id
     ORDER BY ld.created_at DESC LIMIT $1`, [n]
  );
  return rows.map((r) => ({
    id: String(r.id), listingId: r.listing_id ? String(r.listing_id) : null, listingTitle: r.listing_title || null,
    name: r.name, phone: r.phone, message: r.message, createdAt: r.created_at,
  }));
};
