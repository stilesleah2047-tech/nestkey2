const express = require('express');
const db = require('../db');
const mpesa = require('../services/mpesa');
const pesapal = require('../services/pesapal');
const { PLANS, getPlan } = require('../plans');
const { optionalAuth } = require('../auth');

const router = express.Router();
router.use(optionalAuth);

// GET /api/subscriptions/plans
router.get('/plans', (_req, res) => res.json(PLANS));

// POST /api/subscriptions/subscribe { planId, billing, phone, name, email }
router.post('/subscribe', async (req, res) => {
  try {
    const b = req.body || {};
    const plan = getPlan(b.planId);
    if (!plan) return res.status(400).json({ error: 'Unknown plan' });
    const billing = b.billing === 'annual' ? 'annual' : 'monthly';
    const amount = billing === 'annual' ? plan.annual : plan.monthly;

    const sub = await db.createSubscription({
      planId: plan.id, planName: plan.name, audience: plan.audience,
      phone: b.phone, name: b.name, email: b.email, billing, amount, userId: req.user ? req.user.id : null,
    });

    const stk = await mpesa.stkPush({
      phone: b.phone, amount, accountRef: 'SUB' + sub.id, desc: plan.name + ' subscription',
    });
    if (!stk.ok) {
      await db.failSub(sub.id, { error: stk.error });
      return res.status(400).json({ error: stk.error });
    }
    await db.setSubCheckout(sub.id, { checkoutId: stk.checkout, amount });
    res.json({ ok: true, id: sub.id, checkout: stk.checkout, amount, billing, plan: plan.name, message: stk.message });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not start subscription' });
  }
});

// POST /api/subscriptions/pesapal  { planId, billing, phone, name, email } → iframe URL
router.post('/pesapal', async (req, res) => {
  try {
    const b = req.body || {};
    const plan = getPlan(b.planId);
    if (!plan) return res.status(400).json({ error: 'Unknown plan' });
    const billing = b.billing === 'annual' ? 'annual' : 'monthly';
    const amount = billing === 'annual' ? plan.annual : plan.monthly;

    const sub = await db.createSubscription({
      planId: plan.id, planName: plan.name, audience: plan.audience,
      phone: b.phone, name: b.name, email: b.email, billing, amount, userId: req.user ? req.user.id : null,
    });
    const order = await pesapal.submitOrder({
      merchantRef: 'SUB' + sub.id, amount, description: plan.name + ' subscription',
      email: b.email, phone: b.phone,
    });
    if (!order.ok) {
      await db.failSub(sub.id, { error: order.error });
      return res.status(400).json({ error: order.error });
    }
    await db.setSubCheckout(sub.id, { checkoutId: order.orderTrackingId, amount });
    res.json({ ok: true, id: sub.id, orderTrackingId: order.orderTrackingId, iframeUrl: order.redirectUrl, amount, plan: plan.name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not start card subscription' });
  }
});

// GET /api/subscriptions/status/:id
router.get('/status/:id', async (req, res) => {
  try {
    const sub = await db.getSubById(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Not found' });
    let status = sub.status === 'active' ? 'yes' : (sub.status === 'failed' ? 'failed' : 'pending');

    if (status === 'pending' && sub.checkoutId) {
      const q = await mpesa.stkQuery(sub.checkoutId);
      if (q && String(q.ResultCode) === '0') {
        await db.activateSub(sub.id, { receipt: '', days: sub.billing === 'annual' ? 365 : 30 });
        status = 'yes';
      } else if (q && ['1032', '1', '1037', '2001'].includes(String(q.ResultCode))) {
        await db.failSub(sub.id, { error: q.ResultDesc });
        status = 'failed';
      }
    }
    const fresh = await db.getSubById(sub.id);
    res.json({ status, plan: fresh.planName, periodEnd: fresh.currentPeriodEnd });
  } catch (e) {
    res.status(500).json({ error: 'Could not check status' });
  }
});

// GET /api/subscriptions/me?phone=07..
router.get('/me', async (req, res) => {
  try {
    const phone = mpesa.normalizePhone(req.query.phone || '');
    if (!phone) return res.json({ active: false });
    const sub = await db.getActiveSubByPhone(phone);
    res.json(sub ? { active: true, plan: sub.planName, billing: sub.billing, periodEnd: sub.currentPeriodEnd } : { active: false });
  } catch (e) {
    res.status(500).json({ error: 'Could not look up subscription' });
  }
});

module.exports = router;
