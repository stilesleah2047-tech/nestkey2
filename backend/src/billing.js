// Pesapal is the ONLY payment provider. Every "paid" decision is made here,
// from Pesapal's own GetTransactionStatus answer — never from what a browser says.
const db = require('./db');
const config = require('./config');
const events = require('./events');
const pesapal = require('./services/pesapal');
const { normalizePhone } = require('./phone');

function feeFor(beds) {
  const rooms = Math.max(1, parseInt(beds, 10) || 0);
  return config.roomRate * rooms;
}

// Amount for a listing (per-room fee + showcase upgrade, waived for Pro/Agency).
async function listingAmount(listing) {
  // Land is charged by size, not by rooms.
  if (listing.deal === 'land') {
    const acres = Number(listing.areaAcres) || 0;
    const raw = Math.round(acres * config.land.ratePerAcre);
    return Math.min(config.land.max, Math.max(config.land.min, raw));
  }
  let amount = feeFor(listing.beds);
  if (listing.tier === 'showcase') {
    const phone = normalizePhone((listing.submitter && listing.submitter.phone) || '');
    const sub = phone ? await db.getActiveSubByPhone(phone) : null;
    // Plan ids are 'starter' | 'pro' | 'agency' (plans.js). Pro & Agency include the showcase.
    const isPro = sub && (sub.planId === 'pro' || sub.planId === 'agency');
    if (!isPro) amount += config.showcaseFee;
  }
  return amount;
}

// Mark a listing paid and — only on the first transition to paid — fire the
// social-video webhook via the shared 'listing.published' choke point.
async function publishPaidListing(listing, receipt) {
  const wasPaid = !!(listing && listing.paid);
  if (wasPaid) return;
  await db.markPaid(listing.id, { receipt: receipt || '' });
  const fresh = await db.getById(listing.id);
  const src = fresh || listing;
  events.emit('listing.published', {
    id: src.id, title: src.title, price: src.price, region: src.region,
    location: src.location, county: src.county, deal: src.deal, beds: src.beds,
    description: src.description, photo: (src.photos || [])[0] || '',
  });
}

function amountOk(d, expected, what) {
  if (d.currency && config.currency && String(d.currency).toUpperCase() !== String(config.currency).toUpperCase()) {
    console.error('[pesapal] currency mismatch on', what, d.currency);
    return false;
  }
  if (expected && d.amount + 0.5 < Number(expected)) {
    console.error('[pesapal] amount too low on', what, 'paid', d.amount, 'expected', expected);
    try { events.emitAdmin('activity', { kind: 'payment', at: new Date(), text: 'Payment amount mismatch on ' + what + ' (paid KSh ' + d.amount + ', expected KSh ' + expected + ')' }); } catch (e) {}
    return false;
  }
  return true;
}

/**
 * Ask Pesapal about an order and apply the result. Safe to call many times
 * (status polling, IPN and the return page all call it) — it never
 * double-activates a subscription or re-publishes a listing.
 * Returns 'yes' | 'failed' | 'pending'.
 */
async function settleOrder(otid) {
  if (!otid) return 'pending';
  const d = await pesapal.statusDetails(otid);
  if (d.state === 'pending') return 'pending';
  const ref = pesapal.parseRef(d.merchantRef);

  // ---- Listing fee ----
  let listing = await db.findByCheckout(otid);
  if (!listing && ref && ref.kind === 'HOUSE') listing = await db.getById(ref.id);
  if (listing) {
    if (d.state === 'yes') {
      if (!amountOk(d, listing.amount, 'listing ' + listing.id)) return 'pending';
      await publishPaidListing(listing, d.receipt);
      return 'yes';
    }
    // A failure only counts for the CURRENT order — an old abandoned order
    // failing later must not take down a listing that was paid with a newer one.
    // A reversal (refund/chargeback) always unpublishes.
    if (d.reversed || (!listing.paid && listing.checkoutId === otid)) await db.markFailed(listing.id, { error: d.description || 'Payment failed' });
    return listing.paid && !d.reversed ? 'yes' : 'failed';
  }

  // ---- Subscription ----
  let sub = await db.findSubByCheckout(otid);
  if (!sub && ref && ref.kind === 'SUB') sub = await db.getSubById(ref.id);
  if (sub) {
    if (d.state === 'yes') {
      // activateSub ADDS days to the period, so it must run exactly once.
      if (sub.status === 'active') return 'yes';
      if (!amountOk(d, sub.amount, 'subscription ' + sub.id)) return 'pending';
      await db.activateSub(sub.id, { receipt: d.receipt, days: sub.billing === 'annual' ? 365 : 30 });
      return 'yes';
    }
    if (sub.status !== 'active' || d.reversed) await db.failSub(sub.id, { error: d.description || 'Payment failed' });
    return 'failed';
  }

  // ---- Commission (landlord paying the 8% we invoiced) ----
  const esc = await db.findEscrowByCheckout(otid);
  if (esc && esc.type === 'commission') {
    if (d.state === 'yes') {
      if (esc.status === 'paid') return 'yes';
      if (!amountOk(d, esc.gross, 'commission ' + esc.id)) return 'pending';
      await db.markCommissionPaid(esc.id);
      await db.markInvoicesPaidByOwner(esc.ownerId);
      return 'yes';
    }
    return 'failed';
  }

  console.warn('[pesapal] no order found for', otid, d.merchantRef);
  return d.state;
}

module.exports = { listingAmount, publishPaidListing, settleOrder, feeFor };
