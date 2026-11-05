const express = require('express');
const multer = require('multer');
const db = require('../db');
const storage = require('../services/storage');
const { requireAuth, isAdmin } = require('../auth');

const router = express.Router();

// --- SECURITY (Finding 3 & 4): uploads require a signed-in user. ---
// Previously anyone could POST up to 12x60MB files with an attacker-chosen
// extension. Now every route below is behind auth.
router.use(requireAuth);

// Max 40 upload requests per user per 15 minutes (stops one account flooding storage/RAM).
const uploadHits = new Map();
router.use(function (req, res, next) {
  const k = String(req.user.id), now = Date.now();
  let h = uploadHits.get(k);
  if (!h || h.reset <= now) { h = { n: 0, reset: now + 15 * 60 * 1000 }; uploadHits.set(k, h); }
  if (++h.n > 40) return res.status(429).json({ error: 'Too many uploads. Please wait a few minutes.' });
  next();
});

// The browser's "type" label can be faked, so also check the file's real
// signature (magic bytes) before saving it.
function looksLike(mime, buf) {
  if (!buf || buf.length < 12) return false;
  const hex = buf.subarray(0, 12).toString('hex');
  const ascii = buf.subarray(0, 12).toString('latin1');
  switch (mime) {
    case 'image/jpeg': return hex.startsWith('ffd8ff');
    case 'image/png': return hex.startsWith('89504e470d0a1a0a');
    case 'image/gif': return ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a');
    case 'image/webp': return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP';
    case 'video/mp4': case 'video/quicktime': return ascii.slice(4, 8) === 'ftyp' || ascii.slice(4, 8) === 'moov' || ascii.slice(4, 8) === 'mdat' || ascii.slice(4, 8) === 'wide';
    case 'video/webm': return hex.startsWith('1a45dfa3');
    default: return false;
  }
}
function realFiles(files) {
  return (files || []).filter((f) => looksLike(String(f.mimetype || '').toLowerCase(), f.buffer));
}

// Explicit MIME allowlist (mirrors services/storage.js EXT_BY_MIME).
// image/svg+xml is intentionally excluded (SVG can carry script → stored XSS).
const ALLOWED_MIME = new Set(Object.keys(storage.EXT_BY_MIME));

// Keep files in memory so we can push them straight to object storage (S3/R2).
// Local-disk fallback also writes from the same in-memory buffer.
const upload = multer({
  storage: multer.memoryStorage(),
  // Files are held in memory, so keep the total per request well under the
  // server's RAM (12 x 60MB could exhaust a small Render instance).
  limits: { fileSize: 30 * 1024 * 1024, files: 12 }, // up to 30MB each (short phone videos)
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(String(file.mimetype || '').toLowerCase())) return cb(null, true);
    return cb(null, false); // silently drop disallowed types (e.g. svg, html)
  },
});

// POST /api/uploads  (field: files[]) -> { files: [{ url, type }] }
router.post('/', upload.array('files', 12), async (req, res) => {
  try {
    const files = realFiles(req.files);
    if (!files.length) {
      return res.status(400).json({ error: 'No valid image/video files uploaded' });
    }
    const saved = await Promise.all(files.map((f) => storage.save(f)));
    res.json({ ok: true, files: saved.map((s) => ({ url: s.url, type: s.type })) });
  } catch (e) {
    console.error('upload failed', e);
    res.status(400).json({ error: 'Upload failed: unsupported or invalid file' });
  }
});

// POST /api/uploads/:listingId  (field: photos[]) -> attach photos to a listing
router.post('/:listingId', upload.array('photos', 12), async (req, res) => {
  try {
    const listing = await db.getById(req.params.listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    // Only the listing's owner (or an admin) may replace its photos.
    if (!isAdmin(req.user) && String(listing.ownerId || '') !== String(req.user.id)) {
      return res.status(403).json({ error: 'You can only change photos on your own listings.' });
    }
    const files = realFiles(req.files);
    if (!files.length) {
      return res.status(400).json({ error: 'No valid image/video files uploaded' });
    }
    const saved = await Promise.all(files.map((f) => storage.save(f)));
    const urls = saved.map((s) => s.url);
    if (urls.length) await db.addPhotos(listing.id, urls);
    res.json({ ok: true, photos: urls });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Upload failed: unsupported or invalid file' });
  }
});

module.exports = router;
