// Payments — Pesapal only (Pesapal itself offers M-Pesa, Airtel Money, cards
// and bank on one secure screen, shown in an iframe on our site).
const express = require('express');
const db = require('../db');
const pesapal = require('../services/pesapal');
const { listingAmount, settleOrder } = require('../billing');

const router = express.Router();

// POST /api/payments/pesapal  { listingId }  → { iframeUrl, orderTrackingId, amount }
router.post('/pesapal', async (req, res) => {
  try {
    const listing = await db.getById(req.body && req.body.listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.paid) return res.status(400).json({ error: 'Already paid' });

    const amount = await listingAmount(listing); // always computed on the server
    const order = await pesapal.submitOrder({
      merchantRef: pesapal.uniqueRef('HOUSE', listing.id),
      amount,
      description: 'NestKey listing fee: ' + String(listing.title || '').slice(0, 60),
      email: listing.submitter && listing.submitter.email,
      phone: listing.submitter && listing.submitter.phone,
      name: listing.submitter && listing.submitter.name,
    });
    if (!order.ok) return res.status(400).json({ error: order.error });

    await db.setCheckout(listing.id, { checkoutId: order.orderTrackingId, amount });
    res.json({ ok: true, orderTrackingId: order.orderTrackingId, iframeUrl: order.redirectUrl, amount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not start payment' });
  }
});

// GET /api/payments/pesapal/status/:otid — polled by the payment window.
router.get('/pesapal/status/:otid', async (req, res) => {
  try {
    res.json({ status: await settleOrder(req.params.otid) });
  } catch (e) {
    console.error('pesapal status', e);
    res.status(500).json({ error: 'Could not check status' });
  }
});

// Pesapal IPN (GET or POST) — Pesapal calls this when a payment settles,
// even if the customer closed the window. We confirm with Pesapal before acting.
async function ipnHandler(req, res) {
  const q = Object.assign({}, req.query, req.body || {});
  const otid = q.OrderTrackingId || '';
  const notifType = q.OrderNotificationType || 'IPNCHANGE';
  const ref = q.OrderMerchantReference || '';
  let status = 200;
  try {
    if (otid) await settleOrder(otid);
  } catch (e) {
    console.error('IPN error', e);
    status = 500; // tells Pesapal to retry later
  }
  res.json({ orderNotificationType: notifType, orderTrackingId: otid, orderMerchantReference: ref, status });
}
router.get('/ipn', ipnHandler);
router.post('/ipn', ipnHandler);

// GET /api/payments/pesapal-return — where Pesapal sends the customer after
// paying (PESAPAL_CALLBACK_URL). This page opens INSIDE our payment iframe, so it
// shows a short message and tells the parent page the result straight away.
router.get('/pesapal-return', async (req, res) => {
  let status = 'pending';
  try { status = await settleOrder(String(req.query.OrderTrackingId || '')); } catch (e) { console.error('pesapal return', e); }
  const msg = status === 'yes'
    ? { icon: '✓', title: 'Payment received', text: 'Thank you! You can close this window.' }
    : status === 'failed'
      ? { icon: '!', title: 'Payment not completed', text: 'No money was taken. Close this window and try again.' }
      : { icon: '…', title: 'Payment processing', text: 'This can take a minute. We’ll update automatically — you can close this window.' };
  res.set('Cache-Control', 'no-store').type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${msg.title} — NestKey</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f7f9;color:#0B1B2B;display:grid;place-items:center;min-height:100vh;text-align:center}
.c{padding:32px}.i{width:72px;height:72px;border-radius:50%;margin:0 auto 16px;display:grid;place-items:center;font-size:34px;color:#fff;background:${status === 'yes' ? '#0B6B5E' : status === 'failed' ? '#c0392b' : '#5c6b7e'}}
h1{font-size:1.3rem;margin:0 0 8px}p{margin:0;color:#5c6b7e}</style></head>
<body><div class="c"><div class="i">${msg.icon}</div><h1>${msg.title}</h1><p>${msg.text}</p></div>
<script>/* Works even when this page is on another domain (e.g. *.onrender.com) than the site. The page only uses this as a hint and re-checks with the server. */try{window.parent.postMessage({type:'nestkey-payment',status:${JSON.stringify(status)}},'*');}catch(e){}</script></body></html>`);
});

// GET /api/payments/status/:listingId — has this listing's fee been paid?
router.get('/status/:listingId', async (req, res) => {
  try {
    const listing = await db.getById(req.params.listingId);
    if (!listing) return res.status(404).json({ error: 'Not found' });
    let status = listing.paid ? 'yes' : (listing.status === 'failed' ? 'failed' : 'pending');
    if (status === 'pending' && listing.checkoutId) status = await settleOrder(listing.checkoutId);
    res.json({ status, id: listing.id });
  } catch (e) {
    res.status(500).json({ error: 'Could not check status' });
  }
});

module.exports = router;
