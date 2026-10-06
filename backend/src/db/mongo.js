const mongoose = require('mongoose');
const config = require('../config');

const listingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  deal: { type: String, default: 'rent' },
  type: String,
  price: { type: Number, default: 0 },
  beds: { type: Number, default: 0 },
  baths: { type: Number, default: 0 },
  roomCount: { type: Number, default: 0 },
  size: String,
  region: String,
  county: String,
  areaAcres: Number,
  lat: Number,
  lng: Number,
  location: String,
  description: String,
  photos: { type: [String], default: [] },
  videos: { type: [String], default: [] },
  rooms: { type: Array, default: [] },
  tier: { type: String, default: 'standard' },
  featured: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  ownerId: String,
  views: { type: Number, default: 0 },
  submitter: { name: String, phone: String, email: String },
  status: { type: String, default: 'pending' },
  paid: { type: Boolean, default: false },
  amount: { type: Number, default: 0 },
  checkoutId: String,
  receipt: String,
  payError: String,
}, { timestamps: true });

listingSchema.index({ paid: 1, status: 1, createdAt: -1 });
listingSchema.index({ region: 1 });
listingSchema.index({ checkoutId: 1 });

const Listing = mongoose.model('Listing', listingSchema);

function out(d) {
  if (!d) return null;
  const o = d.toObject ? d.toObject() : d;
  return {
    id: String(o._id),
    title: o.title, deal: o.deal, type: o.type, price: o.price || 0,
    beds: o.beds || 0, baths: o.baths || 0, roomCount: o.roomCount || 0, size: o.size,
    region: o.region, county: o.county, areaAcres: o.areaAcres, lat: o.lat != null ? o.lat : null, lng: o.lng != null ? o.lng : null, location: o.location, description: o.description,
    photos: o.photos || [], status: o.status, paid: o.paid, amount: o.amount || 0,
    videos: o.videos || [], rooms: o.rooms || [], tier: o.tier || 'standard', featured: !!o.featured, verified: !!o.verified,
    ownerId: o.ownerId ? String(o.ownerId) : null, views: o.views || 0,
    checkoutId: o.checkoutId, receipt: o.receipt,
    submitter: o.submitter || {}, createdAt: o.createdAt,
  };
}

module.exports = {
  async init() {
    await mongoose.connect(config.mongoUri);
    console.log('[db] MongoDB ready');
  },

  async create(d) {
    const doc = await Listing.create({
      title: d.title, deal: d.deal || 'rent', type: d.type, price: d.price || 0,
      beds: d.beds || 0, baths: d.baths || 0, roomCount: d.roomCount || 0, size: d.size, region: d.region, county: d.county, areaAcres: d.areaAcres != null ? d.areaAcres : null, lat: d.lat != null ? d.lat : null, lng: d.lng != null ? d.lng : null,
      location: d.location, description: d.description, photos: d.photos || [],
      videos: d.videos || [], rooms: d.rooms || [], tier: d.tier === 'showcase' ? 'showcase' : 'standard',
      ownerId: d.ownerId || null,
      submitter: d.submitter || {}, status: d.status || 'pending', paid: d.paid != null ? d.paid : false,
    });
    return out(doc);
  },

  async getById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return out(await Listing.findById(id));
  },

  async list(f) {
    const query = { paid: true, status: 'published' };
    if (f.region) query.region = new RegExp('^' + escapeRe(f.region) + '$', 'i');
    if (f.county) query.county = new RegExp('^' + escapeRe(f.county) + '$', 'i');
    if (f.deal) query.deal = f.deal;
    if (f.minBeds) query.beds = { $gte: f.minBeds };
    if (f.minPrice || f.maxPrice) {
      query.price = {};
      if (f.minPrice) query.price.$gte = f.minPrice;
      if (f.maxPrice) query.price.$lte = f.maxPrice;
    }
    if (f.q) {
      const re = new RegExp(escapeRe(f.q), 'i');
      query.$or = [{ title: re }, { location: re }, { type: re }];
    }
    let sort = { featured: -1, createdAt: -1 };
    if (f.sort === 'price-asc') sort = { featured: -1, price: 1 };
    else if (f.sort === 'price-desc') sort = { featured: -1, price: -1 };

    const limit = Math.min(f.limit || 24, 100);
    const page = f.page || 1;
    const [items, total] = await Promise.all([
      Listing.find(query).sort(sort).skip((page - 1) * limit).limit(limit),
      Listing.countDocuments(query),
    ]);
    return { items: items.map(out), total, page, limit };
  },

  async regions() {
    return Listing.aggregate([
      { $match: { paid: true, status: 'published', region: { $nin: [null, ''] } } },
      { $group: { _id: '$region', count: { $sum: 1 } } },
      { $project: { _id: 0, region: '$_id', count: 1 } },
      { $sort: { region: 1 } },
    ]);
  },

  async setCheckout(id, { checkoutId, amount }) {
    await Listing.findByIdAndUpdate(id, { checkoutId, amount });
  },
  async findByCheckout(checkoutId) {
    return out(await Listing.findOne({ checkoutId }));
  },
  async markPaid(id, { receipt }) {
    await Listing.findByIdAndUpdate(id, { paid: true, status: 'published', receipt });
  },
  async markFailed(id, { error }) {
    await Listing.findByIdAndUpdate(id, { paid: false, status: 'failed', payError: error });
  },
  async addPhotos(id, urls) {
    await Listing.findByIdAndUpdate(id, { photos: urls });
  },
};

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const subSchema = new mongoose.Schema({
  planId: String, planName: String, audience: String, userId: String,
  phone: { type: String, required: true }, name: String, email: String,
  billing: { type: String, default: 'monthly' }, amount: { type: Number, default: 0 },
  status: { type: String, default: 'pending' }, checkoutId: String, receipt: String,
  currentPeriodEnd: Date,
}, { timestamps: true });
subSchema.index({ phone: 1, status: 1 });
subSchema.index({ checkoutId: 1 });
const Subscription = mongoose.model('Subscription', subSchema);

function subOut(d) {
  if (!d) return null;
  const o = d.toObject ? d.toObject() : d;
  return {
    id: String(o._id), planId: o.planId, planName: o.planName, audience: o.audience,
    phone: o.phone, name: o.name, email: o.email, billing: o.billing, amount: o.amount || 0,
    status: o.status, checkoutId: o.checkoutId, receipt: o.receipt,
    currentPeriodEnd: o.currentPeriodEnd, createdAt: o.createdAt,
  };
}

Object.assign(module.exports, {
  async createSubscription(d) {
    return subOut(await Subscription.create({
      planId: d.planId, planName: d.planName, audience: d.audience, phone: d.phone,
      name: d.name, email: d.email, billing: d.billing, amount: d.amount || 0, status: 'pending',
    }));
  },
  async getSubById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return subOut(await Subscription.findById(id));
  },
  async findSubByCheckout(cid) { return subOut(await Subscription.findOne({ checkoutId: cid })); },
  async setSubCheckout(id, { checkoutId, amount }) { await Subscription.findByIdAndUpdate(id, { checkoutId, amount }); },
  async activateSub(id, { receipt, days }) {
    const sub = await Subscription.findById(id);
    if (!sub) return;
    const base = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
    const end = new Date(base.getTime() + (days || 30) * 24 * 60 * 60 * 1000);
    await Subscription.findByIdAndUpdate(id, { status: 'active', receipt, currentPeriodEnd: end });
  },
  async failSub(id, { error }) { await Subscription.findByIdAndUpdate(id, { status: 'failed', receipt: error }); },
  async getActiveSubByPhone(phone) {
    return subOut(await Subscription.findOne({ phone, status: 'active', currentPeriodEnd: { $gt: new Date() } }).sort({ currentPeriodEnd: -1 }));
  },
});

const userSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true, required: true }, phone: String,
  role: { type: String, default: 'landlord' }, company: String,
  passwordHash: { type: String, required: true }, verified: { type: Boolean, default: false },
  payoutMethod: String, payoutMpesa: String, bankName: String, bankAccountName: String,
  bankAccountNumber: String, idNumber: String, kraPin: String, businessName: String,
}, { timestamps: true });
const User = mongoose.model('User', userSchema);
function userOut(d) {
  if (!d) return null;
  const o = d.toObject ? d.toObject() : d;
  return {
    id: String(o._id), name: o.name, email: o.email, phone: o.phone, role: o.role, company: o.company,
    verified: o.verified, passwordHash: o.passwordHash, createdAt: o.createdAt,
    payoutMethod: o.payoutMethod, payoutMpesa: o.payoutMpesa, bankName: o.bankName,
    bankAccountName: o.bankAccountName, bankAccountNumber: o.bankAccountNumber,
    idNumber: o.idNumber, kraPin: o.kraPin, businessName: o.businessName,
  };
}

const leadSchema = new mongoose.Schema({
  listingId: String, ownerId: String, name: String, phone: String, message: String,
}, { timestamps: true });
const Lead = mongoose.model('Lead', leadSchema);

Object.assign(module.exports, {
  async createUser(d) {
    return userOut(await User.create({ name: d.name, email: d.email, phone: d.phone, role: d.role || 'landlord', company: d.company, passwordHash: d.passwordHash }));
  },
  async findUserByEmail(email) { return userOut(await User.findOne({ email: new RegExp('^' + escapeRe(email) + '$', 'i') })); },
  async findUserById(id) { return mongoose.isValidObjectId(id) ? userOut(await User.findById(id)) : null; },

  async listByOwner(ownerId) { return (await Listing.find({ ownerId }).sort({ createdAt: -1 })).map(out); },
  async getOwned(id, ownerId) { return mongoose.isValidObjectId(id) ? out(await Listing.findOne({ _id: id, ownerId })) : null; },
  async countPublishedByOwner(ownerId) { return Listing.countDocuments({ ownerId, status: 'published' }); },
  async setStatus(id, status) { await Listing.findByIdAndUpdate(id, { status }); },
  // Admin override publish: public browse requires paid === true AND status === 'published',
  // so flip both here, otherwise an admin-published listing stays hidden on browse.
  async publish(id) { await Listing.findByIdAndUpdate(id, { paid: true, status: 'published' }); },
  async setListingFlags(id, { featured, verified }) { await Listing.findByIdAndUpdate(id, { featured: !!featured, verified: !!verified }); },
  async updateOwned(id, ownerId, f) {
    if (!mongoose.isValidObjectId(id)) return;
    const allow = ['title', 'deal', 'type', 'price', 'beds', 'baths', 'roomCount', 'region', 'county', 'location', 'description', 'size', 'areaAcres', 'lat', 'lng', 'photos', 'videos', 'tier'];
    const upd = {};
    allow.forEach((k) => { if (f[k] !== undefined) upd[k] = f[k]; });
    if (!Object.keys(upd).length) return;
    await Listing.findOneAndUpdate({ _id: id, ownerId }, upd);
  },
  async deleteOwned(id, ownerId) { await Listing.findOneAndDelete({ _id: id, ownerId }); },
  async incrementViews(id) { if (mongoose.isValidObjectId(id)) await Listing.findByIdAndUpdate(id, { $inc: { views: 1 } }); },

  async createLead(d) {
    const l = await Lead.create({ listingId: d.listingId, ownerId: d.ownerId, name: d.name, phone: d.phone, message: d.message });
    return { id: String(l._id) };
  },
  async listLeadsByOwner(ownerId) {
    return (await Lead.find({ ownerId }).sort({ createdAt: -1 }).limit(100)).map((l) => ({ id: String(l._id), listingId: l.listingId, name: l.name, phone: l.phone, message: l.message, createdAt: l.createdAt }));
  },

  async getActiveSubByUserId(userId) {
    return subOut(await Subscription.findOne({ userId, status: 'active', currentPeriodEnd: { $gt: new Date() } }).sort({ currentPeriodEnd: -1 }));
  },
});

const _createSubscriptionMongo = module.exports.createSubscription;
module.exports.createSubscription = async function (d) {
  const sub = await _createSubscriptionMongo(d);
  if (d.userId && sub) await Subscription.findByIdAndUpdate(sub.id, { userId: d.userId });
  return sub;
};

const escrowSchema = new mongoose.Schema({
  listingId: String, listingTitle: String, ownerId: String,
  tenantName: String, tenantPhone: String, tenantEmail: String,
  gross: { type: Number, default: 0 }, commission: { type: Number, default: 0 }, net: { type: Number, default: 0 },
  provider: String, checkoutId: String, receipt: String,
  status: { type: String, default: 'pending' }, payoutRef: String, releasedAt: Date,
  type: { type: String, default: 'rent' }, method: String,
  invoiceStatus: { type: String, default: 'pending' }, invoiceRef: String, invoicedAt: Date,
}, { timestamps: true });
escrowSchema.index({ ownerId: 1, status: 1 });
escrowSchema.index({ checkoutId: 1 });
const Escrow = mongoose.model('Escrow', escrowSchema);
function escrowOut(d) {
  if (!d) return null;
  const o = d.toObject ? d.toObject() : d;
  return {
    id: String(o._id), listingId: o.listingId, listingTitle: o.listingTitle, ownerId: o.ownerId,
    tenant: { name: o.tenantName, phone: o.tenantPhone, email: o.tenantEmail },
    gross: o.gross || 0, commission: o.commission || 0, net: o.net || 0,
    provider: o.provider, checkoutId: o.checkoutId, receipt: o.receipt, status: o.status,
    type: o.type || 'rent', method: o.method, invoiceStatus: o.invoiceStatus || 'pending', invoiceRef: o.invoiceRef,
    payoutRef: o.payoutRef, createdAt: o.createdAt, releasedAt: o.releasedAt,
  };
}

Object.assign(module.exports, {
  async updateUserPayout(id, f) {
    await User.findByIdAndUpdate(id, {
      payoutMethod: f.payoutMethod, payoutMpesa: f.payoutMpesa, bankName: f.bankName,
      bankAccountName: f.bankAccountName, bankAccountNumber: f.bankAccountNumber,
      idNumber: f.idNumber, kraPin: f.kraPin, businessName: f.businessName,
    });
    return userOut(await User.findById(id));
  },
});

const ratingSchema = new mongoose.Schema({ stars: Number, comment: String, context: String }, { timestamps: true });
const Rating = mongoose.model('Rating', ratingSchema);

Object.assign(module.exports, {
  async recordTransaction(d) {
    return escrowOut(await Escrow.create({
      listingId: d.listingId, listingTitle: d.listingTitle, ownerId: d.ownerId,
      tenantName: d.tenantName, tenantPhone: d.tenantPhone, tenantEmail: d.tenantEmail,
      gross: d.gross || 0, commission: d.commission || 0, net: d.net || 0, method: d.method,
      type: 'sale', status: 'recorded', invoiceStatus: 'pending',
    }));
  },
  async listTransactionsByOwner(ownerId) {
    return (await Escrow.find({ ownerId, type: 'sale' }).sort({ createdAt: -1 }).limit(200)).map(escrowOut);
  },
  async ownerCommissionSummary(ownerId) {
    const rows = await Escrow.find({ ownerId, type: 'sale' });
    let collected = 0, owed = 0, paid = 0;
    rows.forEach((r) => { collected += r.gross || 0; if (r.invoiceStatus === 'paid') paid += r.commission || 0; else owed += r.commission || 0; });
    return { collected, owed, paid, count: rows.length };
  },
  async markInvoicesPaidByOwner(ownerId) {
    await Escrow.updateMany({ ownerId, type: 'sale', invoiceStatus: { $ne: 'paid' } }, { invoiceStatus: 'paid', invoicedAt: new Date() });
  },
  async createCommission(d) {
    return escrowOut(await Escrow.create({ ownerId: d.ownerId, gross: d.amount || 0, commission: 0, type: 'commission', status: 'pending' }));
  },
  async setEscrowCheckout(id, { checkoutId, provider }) { await Escrow.findByIdAndUpdate(id, { checkoutId, provider }); },
  async findEscrowByCheckout(cid) { return escrowOut(await Escrow.findOne({ checkoutId: cid })); },
  async markCommissionPaid(id) { await Escrow.findByIdAndUpdate(id, { status: 'paid' }); },

  async createRating(d) { await Rating.create({ stars: d.stars || 0, comment: d.comment, context: d.context }); },
  async ratingSummary() {
    const rows = await Rating.find({});
    if (!rows.length) return { average: 0, count: 0 };
    const avg = rows.reduce((a, r) => a + (r.stars || 0), 0) / rows.length;
    return { average: Math.round(avg * 10) / 10, count: rows.length };
  },
});

Object.assign(module.exports, {
  async adminStats() {
    const now = new Date();
    const [users, total, published, draft, pending, subsActive, leads] = await Promise.all([
      User.countDocuments({}), Listing.countDocuments({}), Listing.countDocuments({ status: 'published' }),
      Listing.countDocuments({ status: 'draft' }), Listing.countDocuments({ status: 'pending' }),
      Subscription.countDocuments({ status: 'active', currentPeriodEnd: { $gt: now } }), Lead.countDocuments({}),
    ]);
    const subRev = await Subscription.aggregate([{ $match: { status: 'active', currentPeriodEnd: { $gt: now } } }, { $group: { _id: null, rev: { $sum: '$amount' } } }]);
    const comm = await Escrow.aggregate([{ $match: { type: 'sale' } }, { $group: { _id: '$invoiceStatus', commission: { $sum: '$commission' }, gross: { $sum: '$gross' } } }]);
    let collected = 0, owed = 0, sales = 0;
    comm.forEach((g) => { sales += g.gross || 0; if (g._id === 'paid') collected += g.commission || 0; else owed += g.commission || 0; });
    const byCounty = await Listing.aggregate([{ $match: { status: 'published', county: { $nin: [null, ''] } } }, { $group: { _id: '$county', c: { $sum: 1 } } }, { $sort: { c: -1 } }, { $limit: 8 }]);
    const byDeal = await Listing.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$deal', c: { $sum: 1 } } }]);
    return {
      users, listings: { total, published, draft, pending }, subsActive, subRevenue: (subRev[0] && subRev[0].rev) || 0,
      commissionCollected: collected, commissionOwed: owed, salesValue: sales, leads,
      byCounty: byCounty.map((g) => ({ label: g._id, count: g.c })),
      byDeal: byDeal.map((g) => ({ label: g._id, count: g.c })),
    };
  },
  async recentActivity(limit) {
    const [ls, us, ss, ts, lds, rs] = await Promise.all([
      Listing.find({}).sort({ createdAt: -1 }).limit(15),
      User.find({}).sort({ createdAt: -1 }).limit(15),
      Subscription.find({}).sort({ createdAt: -1 }).limit(15),
      Escrow.find({ type: 'sale' }).sort({ createdAt: -1 }).limit(15),
      Lead.find({}).sort({ createdAt: -1 }).limit(15),
      Rating.find({}).sort({ createdAt: -1 }).limit(15),
    ]);
    const items = [];
    ls.forEach((x) => items.push({ kind: 'listing', at: x.createdAt, text: (x.status === 'published' ? 'Listing live: ' : 'Listing added: ') + x.title }));
    us.forEach((x) => items.push({ kind: 'user', at: x.createdAt, text: 'New ' + (x.role || 'user') + ': ' + (x.name || x.email) }));
    ss.forEach((x) => items.push({ kind: 'subscription', at: x.createdAt, text: (x.status === 'active' ? 'Subscribed: ' : 'Subscription ' + x.status + ': ') + (x.planName || '') }));
    ts.forEach((x) => items.push({ kind: 'payment', at: x.createdAt, text: 'Sale recorded: ' + (x.listingTitle || '') + ' — KSh ' + Math.round(x.gross) }));
    lds.forEach((x) => items.push({ kind: 'lead', at: x.createdAt, text: 'Enquiry from ' + (x.name || 'someone') }));
    rs.forEach((x) => items.push({ kind: 'rating', at: x.createdAt, text: x.stars + '\u2605 rating' + (x.comment ? ': ' + x.comment : '') }));
    items.sort((a, b) => new Date(b.at) - new Date(a.at));
    return items.slice(0, limit || 40);
  },
  async adminListings(limit) { return (await Listing.find({}).sort({ createdAt: -1 }).limit(limit || 60)).map(out); },
  async deleteAny(id) { if (mongoose.isValidObjectId(id)) await Listing.findByIdAndDelete(id); },
});

const favSchema = new mongoose.Schema({ userId: String, listingId: String }, { timestamps: true });
favSchema.index({ userId: 1, listingId: 1 }, { unique: true });
const Fav = mongoose.model('Fav', favSchema);

Object.assign(module.exports, {
  async listFavIds(userId) {
    return (await Fav.find({ userId }).sort({ createdAt: -1 })).map((f) => String(f.listingId));
  },
  async addFav(userId, listingId) {
    try { await Fav.create({ userId, listingId: String(listingId) }); } catch (e) { /* dup */ }
  },
  async removeFav(userId, listingId) { await Fav.deleteOne({ userId, listingId: String(listingId) }); },

  async setUserVerified(userId, val) {
    await User.findByIdAndUpdate(userId, { verified: !!val });
    await Listing.updateMany({ ownerId: String(userId) }, { verified: !!val });
  },
  async listUsersForAdmin(limit) {
    const us = await User.find({}).sort({ verified: 1, createdAt: -1 }).limit(limit || 100);
    const out = [];
    for (const u of us) {
      const listings = await Listing.countDocuments({ ownerId: String(u._id) });
      out.push({ id: String(u._id), name: u.name, email: u.email, phone: u.phone, role: u.role, company: u.company, businessName: u.businessName, idNumber: u.idNumber, kraPin: u.kraPin, verified: u.verified, listings, createdAt: u.createdAt });
    }
    return out;
  },
});
