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
// Pesapal needs a UNIQUE merchant reference for every order. Re-using
// "HOUSE12" when someone closes the window and presses Pay again makes
// Pesapal reject the second order, so we add a short unique suffix.
function uniqueRef(prefix, id) {
  return (String(prefix) + id + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).slice(0, 50);
}

// "HOUSE12-lx3abc" -> { kind: 'HOUSE', id: '12' }
function parseRef(ref) {
  const m = /^(HOUSE|SUB|COMM)([^-]+)/.exec(String(ref || ''));
  return m ? { kind: m[1], id: m[2] } : null;
}

async function submitOrder({ merchantRef, amount, description, email, phone, name }) {
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
      email_address: email || 'customer@nestkey.co.ke',
      phone_number: phone || '',
      country_code: 'KE',
      first_name: (String(name || '').trim().split(/\s+/)[0] || 'NestKey').slice(0, 40),
      last_name: (String(name || '').trim().split(/\s+/).slice(1).join(' ') || 'Customer').slice(0, 40),
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

/**
 * Full transaction status from Pesapal (the only source we trust for "paid").
 * Returns { state: 'yes'|'failed'|'pending', amount, currency, receipt, method, merchantRef }.
 * Pesapal status_code: 0 invalid, 1 completed, 2 failed, 3 reversed.
 */
async function statusDetails(orderTrackingId) {
  const res = await fetch(
    `${BASE()}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { headers: { Accept: 'application/json', Authorization: `Bearer ${await token()}` } }
  );
  const data = await res.json();
  const code = String(data.status_code);
  const state = code === '1' ? 'yes' : (code === '2' || code === '3') ? 'failed' : 'pending';
  return {
    state,
    reversed: code === '3',
    amount: Number(data.amount) || 0,
    currency: data.currency || '',
    receipt: data.confirmation_code || '',
    method: data.payment_method || '',
    merchantRef: data.merchant_reference || '',
    description: data.description || data.payment_status_description || '',
  };
}

/** Returns 'yes' | 'failed' | 'pending' */
async function status(orderTrackingId) {
  return (await statusDetails(orderTrackingId)).state;
}

module.exports = { configured, submitOrder, status, statusDetails, uniqueRef, parseRef };
