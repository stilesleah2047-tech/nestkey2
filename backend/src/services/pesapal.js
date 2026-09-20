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
  if (!config.pesapal.key || !config.pesapal.secret) return { ok: false, error: 'Card payments are not set up: add PESAPAL_KEY and PESAPAL_SECRET in .env.' };
  if (!config.pesapal.callbackUrl || /localhost|127\.0\.0\.1/.test(config.pesapal.callbackUrl) || !/^https:/.test(config.pesapal.callbackUrl)) {
    return { ok: false, error: 'Card payments need a public HTTPS callback. Set PESAPAL_CALLBACK_URL and PESAPAL_IPN_URL to your public URL (e.g. a dev tunnel or ngrok), not localhost.' };
  }
  let idn;
  try { idn = await ipnId(); } catch (e) { return { ok: false, error: 'Pesapal setup failed (' + e.message + '). Check your keys and that PESAPAL_IPN_URL is a public HTTPS URL.' }; }
  const body = {
    id: merchantRef,
    currency: config.currency,
    amount: Math.round(amount),
    description: String(description || 'NestKey').slice(0, 100),
    callback_url: config.pesapal.callbackUrl,
    notification_id: idn,
    billing_address: {
      email_address: email || 'customer@nestkey.app',
      phone_number: phone || '',
      country_code: 'KE',
      first_name: 'NestKey',
      last_name: 'Customer',
    },
  };
  let data;
  try {
    const res = await fetch(`${BASE()}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${await token()}` },
      body: JSON.stringify(body),
    });
    data = await res.json();
  } catch (e) {
    return { ok: false, error: 'Could not reach Pesapal: ' + e.message };
  }
  if (data.order_tracking_id && data.redirect_url) {
    return { ok: true, orderTrackingId: data.order_tracking_id, redirectUrl: data.redirect_url };
  }
  const msg = (data.error && (data.error.message || data.error.code)) || data.message || 'Pesapal rejected the order';
  return { ok: false, error: String(msg) };
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
