const express = require('express');
const db = require('../db');
const config = require('../config');

const router = express.Router();

// Commission (and on-site payment) applies to properties being SOLD, not rentals.
function isSale(deal) { return deal === 'sale' || deal === 'land'; }

// GET /api/rent/:listingId/payinfo — where the buyer should pay the seller
router.get('/:listingId/payinfo', async (req, res) => {
  try {
    const listing = await db.getById(req.params.listingId);
    if (!listing || !listing.paid) return res.status(404).json({ error: 'Listing not found' });
    if (!isSale(listing.deal)) return res.status(400).json({ error: 'Online payment applies to properties for sale. Rentals are arranged directly with the landlord.' });
    if (!listing.ownerId) return res.status(400).json({ error: 'This listing is not set up for payments yet.' });
    const owner = await db.findUserById(listing.ownerId);
    if (!owner || !owner.payoutMethod) return res.status(400).json({ error: 'The seller has not added payment details yet.' });

    res.json({
      listingId: listing.id,
      title: listing.title,
      amount: listing.price,
      commissionRate: config.commissionRate,
      payTo: {
        name: owner.businessName || owner.company || owner.name || 'Seller',
        method: owner.payoutMethod,
        mpesa: owner.payoutMethod === 'mpesa' ? owner.payoutMpesa : '',
        bankName: owner.payoutMethod === 'bank' ? owner.bankName : '',
        accountName: owner.payoutMethod === 'bank' ? owner.bankAccountName : '',
        accountNumber: owner.payoutMethod === 'bank' ? owner.bankAccountNumber : '',
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Could not load payment details' });
  }
});

// POST /api/rent/:listingId — record a payment the buyer made directly to the seller
router.post('/:listingId', async (req, res) => {
  try {
    const listing = await db.getById(req.params.listingId);
    if (!listing || !listing.paid) return res.status(404).json({ error: 'Listing not found' });
    if (!isSale(listing.deal)) return res.status(400).json({ error: 'On-site payment applies to properties for sale only.' });
    if (!listing.ownerId) return res.status(400).json({ error: 'This listing is not set up for payments.' });

    const b = req.body || {};
    const gross = parseFloat(b.amount) || listing.price || 0;
    if (gross <= 0) return res.status(400).json({ error: 'Enter the amount paid.' });
    const commission = Math.round(gross * config.commissionRate);
    const net = gross - commission;

    const txn = await db.recordTransaction({
      listingId: listing.id, listingTitle: listing.title, ownerId: listing.ownerId,
      tenantName: b.name ? String(b.name).slice(0, 120) : '',
      tenantPhone: b.phone ? String(b.phone).slice(0, 20) : '',
      tenantEmail: b.email ? String(b.email).slice(0, 120) : '',
      gross, commission, net, method: b.method ? String(b.method).slice(0, 40) : 'mpesa',
    });

    // Notify the landlord in real time.
    try { require('../events').emit('payment.recorded', { listingId: listing.id, title: listing.title, gross }, listing.ownerId); } catch (e) {}
    try { require('../events').emitAdmin('activity', { kind: 'payment', at: new Date(), text: 'Sale recorded: ' + listing.title + ' — KSh ' + Math.round(gross) + ' (8% = KSh ' + commission + ')' }); } catch (e) {}

    res.status(201).json({ id: txn.id, gross, commission, net, commissionRate: config.commissionRate });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not record payment' });
  }
});

module.exports = router;
