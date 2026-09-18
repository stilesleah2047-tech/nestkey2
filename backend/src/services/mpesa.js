const config = require('../config');

const BASE = () =>
  config.mpesa.env === 'live'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

function configured() {
  const m = config.mpesa;
  return m.key && m.secret && m.shortcode && m.passkey;
}

function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D+/g, '');
  if (!d) return '';
  if (d.startsWith('254')) { /* ok */ }
  else if (d.startsWith('0')) d = '254' + d.slice(1);
  else if (d.startsWith('7') || d.startsWith('1')) d = '254' + d;
  return /^254(7|1)\d{8}$/.test(d) ? d : '';
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
    p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds())
  );
}

let cachedToken = null;
let tokenExpiry = 0;

async function token() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const auth = Buffer.from(`${config.mpesa.key}:${config.mpesa.secret}`).toString('base64');
  const res = await fetch(`${BASE()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('M-Pesa auth failed');
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 55 * 60 * 1000;
  return cachedToken;
}

async function stkPush({ phone, amount, accountRef, desc }) {
  const p = normalizePhone(phone);
  if (!p) return { ok: false, error: 'Invalid Safaricom number' };
  if (!configured()) return { ok: false, error: 'Payments not configured' };

  const ts = timestamp();
  const password = Buffer.from(config.mpesa.shortcode + config.mpesa.passkey + ts).toString('base64');
  const txnType = config.mpesa.type === 'till' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';

  const body = {
    BusinessShortCode: config.mpesa.shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: txnType,
    Amount: Math.round(amount),
    PartyA: p,
    PartyB: config.mpesa.shortcode,
    PhoneNumber: p,
    CallBackURL: config.mpesa.callbackUrl,
    AccountReference: String(accountRef).slice(0, 12),
    TransactionDesc: String(desc || 'House listing').slice(0, 60),
  };

  const res = await fetch(`${BASE()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.CheckoutRequestID && String(data.ResponseCode) === '0') {
    return { ok: true, checkout: data.CheckoutRequestID, message: data.CustomerMessage };
  }
  return { ok: false, error: data.errorMessage || 'Payment could not be started' };
}

async function stkQuery(checkoutId) {
  const ts = timestamp();
  const password = Buffer.from(config.mpesa.shortcode + config.mpesa.passkey + ts).toString('base64');
  const res = await fetch(`${BASE()}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: config.mpesa.shortcode,
      Password: password,
      Timestamp: ts,
      CheckoutRequestID: checkoutId,
    }),
  });
  return res.json();
}

module.exports = { normalizePhone, stkPush, stkQuery, configured };
