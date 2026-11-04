const express = require('express');
const multer = require('multer');
const db = require('../db');
const storage = require('../services/storage');
const { requireAuth } = require('../auth');

const router = express.Router();

// --- SECURITY (Finding 3 & 4): uploads require a signed-in user. ---
// Previously anyone could POST up to 12x60MB files with an attacker-chosen
// extension. Now every route below is behind auth.
router.use(requireAuth);

// Explicit MIME allowlist (mirrors services/storage.js EXT_BY_MIME).
// image/svg+xml is intentionally excluded (SVG can carry script → stored XSS).
const ALLOWED_MIME = new Set(Object.keys(storage.EXT_BY_MIME));

// Keep files in memory so we can push them straight to object storage (S3/R2).
// Local-disk fallback also writes from the same in-memory buffer.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024, files: 12 }, // up to 60MB (covers short videos)
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(String(file.mimetype || '').toLowerCase())) return cb(null, true);
    return cb(null, false); // silently drop disallowed types (e.g. svg, html)
  },
});

// POST /api/uploads  (field: files[]) -> { files: [{ url, type }] }
router.post('/', upload.array('files', 12), async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ error: 'No valid image/video files uploaded' });
    }
    const saved = await Promise.all(req.files.map((f) => storage.save(f)));
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
    if (!req.files || !req.files.length) {
      return res.status(400).json({ error: 'No valid image/video files uploaded' });
    }
    const saved = await Promise.all(req.files.map((f) => storage.save(f)));
    const urls = saved.map((s) => s.url);
    if (urls.length) await db.addPhotos(listing.id, urls);
    res.json({ ok: true, photos: urls });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Upload failed: unsupported or invalid file' });
  }
});

module.exports = router;
