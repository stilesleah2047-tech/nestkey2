// Validate photo / video URLs sent by the browser before we store them.
// Without this, a listing could carry a "photo" like  x" onerror="...  which
// becomes stored XSS on every page that shows the listing.
const config = require('./config');

const SAFE = /^[^\s"'<>`\\]+$/;

function allowedPrefixes() {
  const p = ['/' + String(config.uploadDir || 'uploads').replace(/^\/+|\/+$/g, '') + '/'];
  if (config.storage && config.storage.publicBase) p.push(String(config.storage.publicBase).replace(/\/+$/, '') + '/');
  if (config.storage && config.storage.endpoint && config.storage.bucket) p.push(String(config.storage.endpoint).replace(/\/+$/, '') + '/' + config.storage.bucket + '/');
  if (config.publicUrl) p.push(String(config.publicUrl).replace(/\/+$/, '') + '/' + String(config.uploadDir || 'uploads') + '/');
  return p;
}

function isSafeMediaUrl(u) {
  if (typeof u !== 'string' || !u || u.length > 600 || !SAFE.test(u)) return false;
  return allowedPrefixes().some((pre) => u.startsWith(pre));
}

function cleanMedia(list, max) {
  if (!Array.isArray(list)) return [];
  return list.filter(isSafeMediaUrl).slice(0, max);
}

module.exports = { isSafeMediaUrl, cleanMedia };
