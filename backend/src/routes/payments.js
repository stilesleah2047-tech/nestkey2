const express = require('express');
const db = require('../db');
const mpesa = require('../services/mpesa');
const pesapal = require('../services/pesapal');
const config = require('../config');

const router = express.Router();

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
    const phone = mpesa.normalizePhone((listing.submitter && listing.submitter.phone) || '');
    const sub = phone ? await db.getActiveSubByPhone(phone) : null;
    const isPro = sub && (sub.planId === 'landlord' || sub.planId === 'agency');
    if (!isPro) amount += config.showcaseFee;
  }
  return amount;
}

// Resolve a paid checkout/tracking id to a listing or subscription and mark it.
async function settlePayment(ref, ok, receipt, error) {
  const listing = await db.findByCheckout(ref);
  if (listing) {
    if (ok) await db.markPaid(listing.id, { receipt });
    else await db.markFailed(listing.id, { error });
    return true;
  }
  const sub = await db.findSubByCheckout(ref);
  if (sub) {
    if (ok) await db.activateSub(sub.id, { receipt, days: sub.billing === 'annual' ? 365 : 30 });
    else await db.failSub(sub.id, { error });
    return true;
  }
  // Commission settlement (landlord paying us the owed 8%)
  const esc = await db.findEscrowByCheckout(ref);
  if (esc && esc.type === 'commission') {
    if (ok) { await db.markCommissionPaid(esc.id); await db.markInvoicesPaidByOwner(esc.ownerId); }
    return true;
  }
  return false;
}

// POST /api/payments/stk  { listingId, phone }
router.post('/stk', async (req, res) => {
  try {
    const { listingId, phone } = req.body || {};
    const listing = await db.getById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.paid) return res.status(400).json({ error: 'Already paid' });

    const amount = await listingAmount(listing);
    const stk = await mpesa.stkPush({
      phone,
      amount,
      accountRef: 'HOUSE' + listing.id,
      desc: 'House listing fee',
    });
    if (!stk.ok) return res.status(400).json({ error: stk.error });

    await db.setCheckout(listing.id, { checkoutId: stk.checkout, amount });
    res.json({ ok: true, checkout: stk.checkout, amount, message: stk.message });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not start payment' });
  }
});

// POST /api/payments/pesapal  { listingId }  → iframe URL (paid on-site, no redirect)
router.post('/pesapal', async (req, res) => {
  try {
    const listing = await db.getById(req.body && req.body.listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.paid) return res.status(400).json({ error: 'Already paid' });

    const amount = await listingAmount(listing);
    const order = await pesapal.submitOrder({
      merchantRef: 'HOUSE' + listing.id,
      amount,
      description: 'House listing fee',
      email: listing.submitter && listing.submitter.email,
      phone: listing.submitter && listing.submitter.phone,
    });
    if (!order.ok) return res.status(400).json({ error: order.error });

    await db.setCheckout(listing.id, { checkoutId: order.orderTrackingId, amount });
    res.json({ ok: true, orderTrackingId: order.orderTrackingId, iframeUrl: order.redirectUrl, amount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not start card payment' });
  }
});

// GET /api/payments/pesapal/status/:otid
router.get('/pesapal/status/:otid', async (req, res) => {
  try {
    const st = await pesapal.status(req.params.otid);
    if (st === 'yes') await settlePayment(req.params.otid, true, '');
    else if (st === 'failed') await settlePayment(req.params.otid, false, '', 'Payment failed');
    res.json({ status: st });
  } catch (e) {
    res.status(500).json({ error: 'Could not check status' });
  }
});

// Pesapal IPN (GET or POST) — Pesapal calls this when a payment settles.
async function ipnHandler(req, res) {
  const otid = req.query.OrderTrackingId || (req.body && req.body.OrderTrackingId) || '';
  const notifType = req.query.OrderNotificationType || (req.body && req.body.OrderNotificationType) || 'IPNCHANGE';
  const ref = req.query.OrderMerchantReference || (req.body && req.body.OrderMerchantReference) || '';
  try {
    if (otid) {
      const st = await pesapal.status(otid);
      if (st === 'yes') await settlePayment(otid, true, '');
      else if (st === 'failed') await settlePayment(otid, false, '', 'Payment failed');
    }
  } catch (e) { console.error('IPN error', e); }
  res.json({ orderNotificationType: notifType, orderTrackingId: otid, orderMerchantReference: ref, status: 200 });
}
router.get('/ipn', ipnHandler);
router.post('/ipn', ipnHandler);

// POST /api/payments/callback  — Safaricom posts the result here
router.post('/callback', async (req, res) => {
  try {
    const stk = req.body?.Body?.stkCallback;
    if (!stk || !stk.CheckoutRequestID) {
      return res.json({ ResultCode: 0, ResultDesc: 'Ignored' });
    }
    const cid = stk.CheckoutRequestID;
    const listing = await db.findByCheckout(cid);

    if (listing) {
      if (Number(stk.ResultCode) === 0) {
        let receipt = '';
        (stk.CallbackMetadata?.Item || []).forEach((it) => {
          if (it.Name === 'MpesaReceiptNumber') receipt = it.Value;
        });
        await db.markPaid(listing.id, { receipt });
      } else {
        await db.markFailed(listing.id, { error: stk.ResultDesc });
      }
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    // Not a listing — maybe a subscription payment.
    const sub = await db.findSubByCheckout(cid);
    if (sub) {
      if (Number(stk.ResultCode) === 0) {
        let receipt = '';
        (stk.CallbackMetadata?.Item || []).forEach((it) => {
          if (it.Name === 'MpesaReceiptNumber') receipt = it.Value;
        });
        await db.activateSub(sub.id, { receipt, days: sub.billing === 'annual' ? 365 : 30 });
      } else {
        await db.failSub(sub.id, { error: stk.ResultDesc });
      }
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    // Otherwise try commission settlement.
    let receipt = '';
    (stk.CallbackMetadata?.Item || []).forEach((it) => { if (it.Name === 'MpesaReceiptNumber') receipt = it.Value; });
    await settlePayment(cid, Number(stk.ResultCode) === 0, receipt, stk.ResultDesc);
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (e) {
    console.error(e);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// GET /api/payments/status/:listingId  — poll; falls back to STK query
router.get('/status/:listingId', async (req, res) => {
  try {
    const listing = await db.getById(req.params.listingId);
    if (!listing) return res.status(404).json({ error: 'Not found' });

    let status = listing.paid ? 'yes' : (listing.status === 'failed' ? 'failed' : 'pending');

    if (status === 'pending' && listing.checkoutId) {
      const q = await mpesa.stkQuery(listing.checkoutId);
      if (q && String(q.ResultCode) === '0') {
        await db.markPaid(listing.id, { receipt: '' });
        status = 'yes';
      } else if (q && ['1032', '1', '1037', '2001'].includes(String(q.ResultCode))) {
        await db.markFailed(listing.id, { error: q.ResultDesc });
        status = 'failed';
      }
    }
    res.json({ status, id: listing.id });
  } catch (e) {
    res.status(500).json({ error: 'Could not check status' });
  }
});

module.exports = router;
