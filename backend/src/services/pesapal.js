const config = require('../config');

const BASE = () =>
  config.pesapal.env === 'live'
    ? 'https://pay.pesapal.com/v3'
    : 'https://cybqa.pesapal.com/pesapalv3';

function configured() {
  return config.pesapal.key && config.pesapal.secret;
}

let cachedToken = null;
let tokenExpiry = 0;

async function token() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${BASE()}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ consumer_key: config.pesapal.key, consumer_secret: config.pesapal.secret }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Pesapal auth failed');
  cachedToken = data.token;
  tokenExpiry = Date.now() + 4 * 60 * 1000; // tokens last ~5 min
  return cachedToken;
}

let cachedIpnId = config.pesapal.ipnId || null;

async function ipnId() {
  if (cachedIpnId) return cachedIpnId;
  const res = await fetch(`${BASE()}/api/URLSetup/RegisterIPN`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify({ url: config.pesapal.ipnUrl, ipn_notification_type: 'GET' }),
  });
  const data = await res.json();
  if (!data.ipn_id) throw new Error('Pesapal IPN registration failed');
  cachedIpnId = data.ipn_id;
  return cachedIpnId;
}

/**
 * Create an order. Returns { orderTrackingId, redirectUrl } — redirectUrl is
 * loaded in an IFRAME on our own site (no full-page redirect).
 */
async function submitOrder({ merchantRef, amount, description, email, phone }) {
  if (!configured()) return { ok: false, error: 'Card payments not configured' };
  const body = {
    id: merchantRef,
    currency: config.currency,
    amount: Math.round(amount),
    description: String(description || 'NestKey').slice(0, 100),
    callback_url: config.pesapal.callbackUrl,
    notification_id: await ipnId(),
    billing_address: {
      email_address: email || 'customer@househunt.app',
      phone_number: phone || '',
      country_code: 'KE',
      first_name: 'House',
      last_name: 'Hunt',
    },
  };
  const res = await fetch(`${BASE()}/api/Transactions/SubmitOrderRequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.order_tracking_id && data.redirect_url) {
    return { ok: true, orderTrackingId: data.order_tracking_id, redirectUrl: data.redirect_url };
  }
  return { ok: false, error: (data.error && data.error.message) || 'Could not start card payment' };
}

/** Returns 'yes' | 'failed' | 'pending' */
async function status(orderTrackingId) {
  const res = await fetch(
    `${BASE()}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { headers: { Accept: 'application/json', Authorization: `Bearer ${await token()}` } }
  );
  const data = await res.json();
  const code = String(data.status_code);
  if (code === '1') return 'yes';       // Completed
  if (code === '2' || code === '3') return 'failed'; // Failed / Reversed
  return 'pending';
}

module.exports = { configured, submitOrder, status };
