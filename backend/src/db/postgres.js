const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({ connectionString: config.databaseUrl });

function row(r) {
  if (!r) return null;
  return {
    id: String(r.id),
    title: r.title,
    deal: r.deal,
    type: r.type,
    price: Number(r.price) || 0,
    beds: r.beds || 0,
    baths: r.baths || 0,
    roomCount: r.room_count || 0,
    size: r.size,
    areaAcres: r.area_acres != null ? Number(r.area_acres) : null,
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    region: r.region,
    county: r.county,
    location: r.location,
    description: r.description,
    photos: Array.isArray(r.photos) ? r.photos : [],
    videos: Array.isArray(r.videos) ? r.videos : [],
    rooms: Array.isArray(r.rooms) ? r.rooms : [],
    tier: r.tier || 'standard',
    featured: !!r.featured,
    verified: !!r.verified,
    ownerId: r.owner_id ? String(r.owner_id) : null,
    views: r.views || 0,
    status: r.status,
    paid: r.paid,
    amount: Number(r.amount) || 0,
    checkoutId: r.checkout_id,
    receipt: r.receipt,
    submitter: { name: r.submitter_name, phone: r.submitter_phone, email: r.submitter_email },
    createdAt: r.created_at,
  };
}

module.exports = {
  async init() {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('[db] PostgreSQL ready');
  },

  async create(d) {
    const q = `INSERT INTO listings
      (title, deal, type, price, beds, baths, size, area_acres, lat, lng, region, county, location, description, photos, videos, rooms, tier,
       submitter_name, submitter_phone, submitter_email, owner_id, status, paid, room_count)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
      RETURNING *`;
    const vals = [
      d.title, d.deal || 'rent', d.type || null, d.price || 0, d.beds || 0, d.baths || 0,
      d.size || null, d.areaAcres != null ? d.areaAcres : null, d.lat != null ? d.lat : null, d.lng != null ? d.lng : null,
      d.region || null, d.county || null, d.location || null, d.description || null,
      JSON.stringify(d.photos || []), JSON.stringify(d.videos || []), JSON.stringify(d.rooms || []),
      d.tier === 'showcase' ? 'showcase' : 'standard',
      d.submitter?.name || null, d.submitter?.phone || null, d.submitter?.email || null,
      d.ownerId || null, d.status || 'pending', d.paid != null ? d.paid : false,
      d.roomCount || 0,
    ];
    const { rows } = await pool.query(q, vals);
    return row(rows[0]);
  },

  async getById(id) {
    const { rows } = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);
    return row(rows[0]);
  },

  async list(f) {
    const where = ['paid = true', "status = 'published'"];
    const vals = [];
    let i = 1;
    if (f.region) { where.push(`lower(region) = $${i++}`); vals.push(String(f.region).toLowerCase()); }
    if (f.county) { where.push(`lower(county) = $${i++}`); vals.push(String(f.county).toLowerCase()); }
    if (f.deal) { where.push(`deal = $${i++}`); vals.push(f.deal); }
    if (f.minBeds) { where.push(`beds >= $${i++}`); vals.push(f.minBeds); }
    if (f.minPrice) { where.push(`price >= $${i++}`); vals.push(f.minPrice); }
    if (f.maxPrice) { where.push(`price <= $${i++}`); vals.push(f.maxPrice); }
    if (f.q) {
      where.push(`(lower(title) LIKE $${i} OR lower(location) LIKE $${i} OR lower(type) LIKE $${i})`);
      vals.push('%' + String(f.q).toLowerCase() + '%'); i++;
    }
    const whereSql = 'WHERE ' + where.join(' AND ');
    let order = 'created_at DESC';
    if (f.sort === 'price-asc') order = 'price ASC';
    else if (f.sort === 'price-desc') order = 'price DESC';
    order = 'featured DESC, ' + order;

    const limit = Math.min(f.limit || 24, 100);
    const offset = ((f.page || 1) - 1) * limit;

    const countRes = await pool.query(`SELECT count(*)::int AS n FROM listings ${whereSql}`, vals);
    const dataRes = await pool.query(
      `SELECT * FROM listings ${whereSql} ORDER BY ${order} LIMIT $${i++} OFFSET $${i++}`,
      [...vals, limit, offset]
    );
    return { items: dataRes.rows.map(row), total: countRes.rows[0].n, page: f.page || 1, limit };
  },

  async regions() {
    const { rows } = await pool.query(
      `SELECT region, count(*)::int AS count FROM listings
       WHERE paid = true AND status = 'published' AND region IS NOT NULL AND region <> ''
       GROUP BY region ORDER BY region ASC`
    );
    return rows;
  },

  async setCheckout(id, { checkoutId, amount }) {
    await pool.query('UPDATE listings SET checkout_id = $1, amount = $2 WHERE id = $3', [checkoutId, amount, id]);
  },

  async findByCheckout(checkoutId) {
    const { rows } = await pool.query('SELECT * FROM listings WHERE checkout_id = $1', [checkoutId]);
    return row(rows[0]);
  },

  async markPaid(id, { receipt }) {
    await pool.query(
      "UPDATE listings SET paid = true, status = 'published', receipt = $1 WHERE id = $2",
      [receipt || null, id]
    );
  },

  async markFailed(id, { error }) {
    await pool.query("UPDATE listings SET paid = false, status = 'failed', pay_error = $1 WHERE id = $2", [error || null, id]);
  },

  async addPhotos(id, urls) {
    await pool.query('UPDATE listings SET photos = $1 WHERE id = $2', [JSON.stringify(urls), id]);
  },
};

function subRow(r) {
  if (!r) return null;
  return {
    id: String(r.id), planId: r.plan_id, planName: r.plan_name, audience: r.audience,
    phone: r.phone, name: r.name, email: r.email, billing: r.billing,
    amount: Number(r.amount) || 0, status: r.status, checkoutId: r.checkout_id,
    receipt: r.receipt, currentPeriodEnd: r.current_period_end, createdAt: r.created_at,
  };
}

Object.assign(module.exports, {
  async createSubscription(d) {
    const q = `INSERT INTO subscriptions
      (plan_id, plan_name, audience, phone, name, email, billing, amount, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *`;
    const { rows } = await pool.query(q, [
      d.planId, d.planName, d.audience, d.phone, d.name || null, d.email || null,
      d.billing, d.amount || 0,
    ]);
    return subRow(rows[0]);
  },
  async getSubById(id) {
    const { rows } = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [id]);
    return subRow(rows[0]);
  },
  async findSubByCheckout(cid) {
    const { rows } = await pool.query('SELECT * FROM subscriptions WHERE checkout_id = $1', [cid]);
    return subRow(rows[0]);
  },
  async setSubCheckout(id, { checkoutId, amount }) {
    await pool.query('UPDATE subscriptions SET checkout_id = $1, amount = $2 WHERE id = $3', [checkoutId, amount, id]);
  },
  async activateSub(id, { receipt, days }) {
    await pool.query(
      `UPDATE subscriptions
       SET status = 'active', receipt = $1,
           current_period_end = GREATEST(now(), COALESCE(current_period_end, now())) + ($2 || ' days')::interval
       WHERE id = $3`,
      [receipt || null, String(days || 30), id]
    );
  },
  async failSub(id, { error }) {
    await pool.query("UPDATE subscriptions SET status = 'failed', receipt = $1 WHERE id = $2", [error || null, id]);
  },
  async getActiveSubByPhone(phone) {
    const { rows } = await pool.query(
      `SELECT * FROM subscriptions WHERE phone = $1 AND status = 'active' AND current_period_end > now()
       ORDER BY current_period_end DESC LIMIT 1`, [phone]
    );
    return subRow(rows[0]);
  },
});

function userRow(r) {
  if (!r) return null;
  return {
    id: String(r.id), name: r.name, email: r.email, phone: r.phone, role: r.role,
    company: r.company, verified: r.verified, passwordHash: r.password_hash, createdAt: r.created_at,
    payoutMethod: r.payout_method, payoutMpesa: r.payout_mpesa,
    bankName: r.bank_name, bankAccountName: r.bank_account_name, bankAccountNumber: r.bank_account_number,
    idNumber: r.id_number, kraPin: r.kra_pin, businessName: r.business_name,
  };
}

function escrowRow(r) {
  if (!r) return null;
  return {
    id: String(r.id), listingId: r.listing_id ? String(r.listing_id) : null, listingTitle: r.listing_title,
    ownerId: r.owner_id ? String(r.owner_id) : null,
    tenant: { name: r.tenant_name, phone: r.tenant_phone, email: r.tenant_email },
    gross: Number(r.gross) || 0, commission: Number(r.commission) || 0, net: Number(r.net) || 0,
    provider: r.provider, checkoutId: r.checkout_id, receipt: r.receipt, status: r.status,
    type: r.type || 'rent', method: r.method, invoiceStatus: r.invoice_status || 'pending', invoiceRef: r.invoice_ref,
    payoutRef: r.payout_ref, createdAt: r.created_at, releasedAt: r.released_at,
  };
}

Object.assign(module.exports, {
  async createUser(d) {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, role, company, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [d.name || null, d.email, d.phone || null, d.role || 'landlord', d.company || null, d.passwordHash]
    );
    return userRow(rows[0]);
  },
  async findUserByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
    return userRow(rows[0]);
  },
  async findUserById(id) {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return userRow(rows[0]);
  },

  async listByOwner(ownerId) {
    const { rows } = await pool.query('SELECT * FROM listings WHERE owner_id = $1 ORDER BY created_at DESC', [ownerId]);
    return rows.map(row);
  },
  async getOwned(id, ownerId) {
    const { rows } = await pool.query('SELECT * FROM listings WHERE id = $1 AND owner_id = $2', [id, ownerId]);
    return row(rows[0]);
  },
  async countPublishedByOwner(ownerId) {
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM listings WHERE owner_id = $1 AND status = 'published'", [ownerId]);
    return rows[0].n;
  },
  async setStatus(id, status) {
    await pool.query('UPDATE listings SET status = $1 WHERE id = $2', [status, id]);
  },
  // Admin override publish: make a listing publicly visible without a payment.
  // The public browse query requires BOTH paid = true AND status = 'published',
  // so an admin publish must flip paid = true as well, otherwise the listing
  // stays hidden on browse.html even though the dashboard shows it as PUBLISHED.
  async publish(id) {
    await pool.query("UPDATE listings SET paid = true, status = 'published' WHERE id = $1", [id]);
  },
  async setListingFlags(id, { featured, verified }) {
    await pool.query('UPDATE listings SET featured = $1, verified = $2 WHERE id = $3', [!!featured, !!verified, id]);
  },
  // Robust owner edit — updates ONLY the fields that were supplied, so an
  // agent can edit any property (including a published one) without wiping
  // untouched columns or changing its published status.
  async updateOwned(id, ownerId, f) {
    const map = {
      title: 'title', deal: 'deal', type: 'type', price: 'price', beds: 'beds', baths: 'baths',
      roomCount: 'room_count', region: 'region', county: 'county', location: 'location',
      description: 'description', size: 'size', areaAcres: 'area_acres', lat: 'lat', lng: 'lng',
      photos: 'photos', videos: 'videos', tier: 'tier',
    };
    const sets = [];
    const vals = [];
    let i = 1;
    for (const k in map) {
      if (f[k] === undefined) continue;
      let v = f[k];
      if (k === 'photos' || k === 'videos') v = JSON.stringify(v || []);
      sets.push(`${map[k]}=$${i++}`);
      vals.push(v);
    }
    if (!sets.length) return;
    vals.push(id, ownerId);
    await pool.query(
      `UPDATE listings SET ${sets.join(', ')} WHERE id=$${i++} AND owner_id=$${i++}`,
      vals
    );
  },
  async deleteOwned(id, ownerId) {
    await pool.query('DELETE FROM listings WHERE id = $1 AND owner_id = $2', [id, ownerId]);
  },
  async incrementViews(id) {
    await pool.query('UPDATE listings SET views = views + 1 WHERE id = $1', [id]);
  },

  async createLead(d) {
    const { rows } = await pool.query(
      `INSERT INTO leads (listing_id, owner_id, name, phone, message) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [d.listingId || null, d.ownerId || null, d.name || null, d.phone || null, d.message || null]
    );
    return rows[0];
  },
  async listLeadsByOwner(ownerId) {
    const { rows } = await pool.query('SELECT * FROM leads WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 100', [ownerId]);
    return rows.map((r) => ({ id: String(r.id), listingId: r.listing_id ? String(r.listing_id) : null, name: r.name, phone: r.phone, message: r.message, createdAt: r.created_at }));
  },

  async getActiveSubByUserId(userId) {
    const { rows } = await pool.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' AND current_period_end > now()
       ORDER BY current_period_end DESC LIMIT 1`, [userId]
    );
    return subRow(rows[0]);
  },
});

// Allow createSubscription to persist user_id (extend the earlier definition).
const _createSubscription = module.exports.createSubscription;
module.exports.createSubscription = async function (d) {
  const sub = await _createSubscription(d);
  if (d.userId && sub) await pool.query('UPDATE subscriptions SET user_id = $1 WHERE id = $2', [d.userId, sub.id]);
  return sub;
};

Object.assign(module.exports, {
  async updateUserPayout(id, f) {
    await pool.query(
      `UPDATE users SET payout_method=$1, payout_mpesa=$2, bank_name=$3, bank_account_name=$4,
       bank_account_number=$5, id_number=$6, kra_pin=$7, business_name=$8 WHERE id=$9`,
      [f.payoutMethod || null, f.payoutMpesa || null, f.bankName || null, f.bankAccountName || null,
       f.bankAccountNumber || null, f.idNumber || null, f.kraPin || null, f.businessName || null, id]
    );
    return this.findUserById(id);
  },
});

Object.assign(module.exports, {
  // Record a rent/sale payment that went directly to the landlord.
  async recordTransaction(d) {
    const { rows } = await pool.query(
      `INSERT INTO escrows (listing_id, listing_title, owner_id, tenant_name, tenant_phone, tenant_email,
        gross, commission, net, method, type, status, invoice_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'sale','recorded','pending') RETURNING *`,
      [d.listingId || null, d.listingTitle || null, d.ownerId || null, d.tenantName || null,
       d.tenantPhone || null, d.tenantEmail || null, d.gross || 0, d.commission || 0, d.net || 0, d.method || null]
    );
    return escrowRow(rows[0]);
  },
  async listTransactionsByOwner(ownerId) {
    const { rows } = await pool.query("SELECT * FROM escrows WHERE owner_id=$1 AND type='sale' ORDER BY created_at DESC LIMIT 200", [ownerId]);
    return rows.map(escrowRow);
  },
  async ownerCommissionSummary(ownerId) {
    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(gross) FILTER (WHERE type='sale'),0)::numeric AS collected,
         COALESCE(SUM(commission) FILTER (WHERE type='sale' AND invoice_status <> 'paid'),0)::numeric AS owed,
         COALESCE(SUM(commission) FILTER (WHERE type='sale' AND invoice_status = 'paid'),0)::numeric AS paid,
         COUNT(*) FILTER (WHERE type='sale')::int AS count
       FROM escrows WHERE owner_id=$1`, [ownerId]
    );
    const r = rows[0];
    return { collected: Number(r.collected) || 0, owed: Number(r.owed) || 0, paid: Number(r.paid) || 0, count: r.count };
  },
  async markInvoicesPaidByOwner(ownerId) {
    await pool.query("UPDATE escrows SET invoice_status='paid', invoiced_at=now() WHERE owner_id=$1 AND type='sale' AND invoice_status<>'paid'", [ownerId]);
  },

  // Commission settlement (landlord pays us the owed 8%) via the payment gateway.
  async createCommission(d) {
    const { rows } = await pool.query(
      `INSERT INTO escrows (owner_id, gross, commission, type, status) VALUES ($1,$2,0,'commission','pending') RETURNING *`,
      [d.ownerId || null, d.amount || 0]
    );
    return escrowRow(rows[0]);
  },
  async setEscrowCheckout(id, { checkoutId, provider }) {
    await pool.query('UPDATE escrows SET checkout_id=$1, provider=$2 WHERE id=$3', [checkoutId, provider, id]);
  },
  async findEscrowByCheckout(cid) {
    const { rows } = await pool.query('SELECT * FROM escrows WHERE checkout_id=$1', [cid]);
    return escrowRow(rows[0]);
  },
  async markCommissionPaid(id) {
    await pool.query("UPDATE escrows SET status='paid' WHERE id=$1", [id]);
  },

  async createRating(d) {
    await pool.query('INSERT INTO ratings (stars, comment, context) VALUES ($1,$2,$3)', [d.stars || 0, d.comment || null, d.context || null]);
  },
  async ratingSummary() {
    const { rows } = await pool.query('SELECT COALESCE(AVG(stars),0)::numeric AS avg, COUNT(*)::int AS n FROM ratings');
    return { average: Math.round((Number(rows[0].avg) || 0) * 10) / 10, count: rows[0].n };
  },
});

Object.assign(module.exports, {
  async adminStats() {
    const q = await Promise.all([
      pool.query('SELECT count(*)::int n FROM users'),
      pool.query("SELECT count(*)::int total, count(*) FILTER (WHERE status='published')::int published, count(*) FILTER (WHERE status='draft')::int draft, count(*) FILTER (WHERE status='pending')::int pending FROM listings"),
      pool.query("SELECT count(*)::int n, COALESCE(SUM(amount),0)::numeric rev FROM subscriptions WHERE status='active' AND current_period_end > now()"),
      pool.query("SELECT COALESCE(SUM(commission) FILTER (WHERE invoice_status='paid'),0)::numeric collected, COALESCE(SUM(commission) FILTER (WHERE invoice_status<>'paid'),0)::numeric owed, COALESCE(SUM(gross),0)::numeric sales FROM escrows WHERE type='sale'"),
      pool.query('SELECT count(*)::int n FROM leads'),
      pool.query("SELECT county, count(*)::int c FROM listings WHERE status='published' AND county IS NOT NULL AND county <> '' GROUP BY county ORDER BY c DESC LIMIT 8"),
      pool.query("SELECT deal, count(*)::int c FROM listings WHERE status='published' GROUP BY deal"),
    ]);
    return {
      users: q[0].rows[0].n,
      listings: q[1].rows[0],
      subsActive: q[2].rows[0].n, subRevenue: Number(q[2].rows[0].rev) || 0,
      commissionCollected: Number(q[3].rows[0].collected) || 0, commissionOwed: Number(q[3].rows[0].owed) || 0, salesValue: Number(q[3].rows[0].sales) || 0,
      leads: q[4].rows[0].n,
      byCounty: q[5].rows.map((r) => ({ label: r.county, count: r.c })),
      byDeal: q[6].rows.map((r) => ({ label: r.deal, count: r.c })),
    };
  },
  async recentActivity(limit) {
    const r = await Promise.all([
      pool.query('SELECT id,title,deal,status,created_at FROM listings ORDER BY created_at DESC LIMIT 15'),
      pool.query('SELECT name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT 15'),
      pool.query('SELECT plan_name,status,created_at FROM subscriptions ORDER BY created_at DESC LIMIT 15'),
      pool.query("SELECT listing_title,gross,created_at FROM escrows WHERE type='sale' ORDER BY created_at DESC LIMIT 15"),
      pool.query('SELECT name,created_at FROM leads ORDER BY created_at DESC LIMIT 15'),
      pool.query('SELECT stars,comment,created_at FROM ratings ORDER BY created_at DESC LIMIT 15'),
    ]);
    const items = [];
    r[0].rows.forEach((x) => items.push({ kind: 'listing', at: x.created_at, text: (x.status === 'published' ? 'Listing live: ' : 'Listing added: ') + x.title }));
    r[1].rows.forEach((x) => items.push({ kind: 'user', at: x.created_at, text: 'New ' + (x.role || 'user') + ': ' + (x.name || x.email) }));
    r[2].rows.forEach((x) => items.push({ kind: 'subscription', at: x.created_at, text: (x.status === 'active' ? 'Subscribed: ' : 'Subscription ' + x.status + ': ') + (x.plan_name || '') }));
    r[3].rows.forEach((x) => items.push({ kind: 'payment', at: x.created_at, text: 'Sale recorded: ' + (x.listing_title || '') + ' — KSh ' + Math.round(x.gross) }));
    r[4].rows.forEach((x) => items.push({ kind: 'lead', at: x.created_at, text: 'Enquiry from ' + (x.name || 'someone') }));
    r[5].rows.forEach((x) => items.push({ kind: 'rating', at: x.created_at, text: x.stars + '\u2605 rating' + (x.comment ? ': ' + x.comment : '') }));
    items.sort((a, b) => new Date(b.at) - new Date(a.at));
    return items.slice(0, limit || 40);
  },
  async adminListings(limit) {
    const { rows } = await pool.query('SELECT * FROM listings ORDER BY created_at DESC LIMIT $1', [limit || 60]);
    return rows.map(row);
  },
  async deleteAny(id) { await pool.query('DELETE FROM listings WHERE id = $1', [id]); },
});

Object.assign(module.exports, {
  // Favourites
  async listFavIds(userId) {
    const { rows } = await pool.query('SELECT listing_id FROM favourites WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
    return rows.map((r) => String(r.listing_id));
  },
  async addFav(userId, listingId) {
    await pool.query('INSERT INTO favourites (user_id, listing_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, listingId]);
  },
  async removeFav(userId, listingId) {
    await pool.query('DELETE FROM favourites WHERE user_id=$1 AND listing_id=$2', [userId, listingId]);
  },

  // Verification (admin)
  async setUserVerified(userId, val) {
    await pool.query('UPDATE users SET verified=$1 WHERE id=$2', [!!val, userId]);
    await pool.query('UPDATE listings SET verified=$1 WHERE owner_id=$2', [!!val, userId]);
  },
  async listUsersForAdmin(limit) {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.company, u.business_name, u.id_number, u.kra_pin, u.verified, u.created_at,
       (SELECT count(*)::int FROM listings l WHERE l.owner_id = u.id) AS listings
       FROM users u ORDER BY u.verified ASC, u.created_at DESC LIMIT $1`, [limit || 100]
    );
    return rows.map((r) => ({
      id: String(r.id), name: r.name, email: r.email, phone: r.phone, role: r.role,
      company: r.company, businessName: r.business_name, idNumber: r.id_number, kraPin: r.kra_pin,
      verified: r.verified, listings: r.listings, createdAt: r.created_at,
    }));
  },
});
