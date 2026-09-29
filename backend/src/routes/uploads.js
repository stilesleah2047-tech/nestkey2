const express = require('express');
const multer = require('multer');
const db = require('../db');
const storage = require('../services/storage');

const router = express.Router();

// Keep files in memory so we can push them straight to object storage (S3/R2).
// Local-disk fallback also writes from the same in-memory buffer.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024, files: 12 }, // up to 60MB (covers short videos)
  fileFilter: (_req, file, cb) => cb(null, /^(image|video)\//.test(file.mimetype)),
});

// POST /api/uploads  (field: files[]) -> { files: [{ url, type }] }
router.post('/', upload.array('files', 12), async (req, res) => {
  try {
    const saved = await Promise.all((req.files || []).map((f) => storage.save(f)));
    res.json({ ok: true, files: saved.map((s) => ({ url: s.url, type: s.type })) });
  } catch (e) {
    console.error('upload failed', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// POST /api/uploads/:listingId  (field: photos[]) -> attach photos to a listing
router.post('/:listingId', upload.array('photos', 12), async (req, res) => {
  try {
    const listing = await db.getById(req.params.listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    const saved = await Promise.all((req.files || []).map((f) => storage.save(f)));
    const urls = saved.map((s) => s.url);
    if (urls.length) await db.addPhotos(listing.id, urls);
    res.json({ ok: true, photos: urls });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
