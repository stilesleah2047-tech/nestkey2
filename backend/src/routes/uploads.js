const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const config = require('../config');

const router = express.Router();

const dir = path.join(__dirname, '..', '..', config.uploadDir);
fs.mkdirSync(dir, { recursive: true });

function guessExt(m) {
  if (/mp4/.test(m)) return '.mp4';
  if (/webm/.test(m)) return '.webm';
  if (/quicktime/.test(m)) return '.mov';
  if (/png/.test(m)) return '.png';
  return '.jpg';
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase() || guessExt(file.mimetype);
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 60 * 1024 * 1024, files: 12 }, // up to 60MB (covers short videos)
  fileFilter: (_req, file, cb) => cb(null, /^(image|video)\//.test(file.mimetype)),
});

function urlFor(filename) {
  return `${config.publicUrl}/${config.uploadDir}/${filename}`;
}

// POST /api/uploads  (field: files[]) -> { files: [{ url, type }] }
router.post('/', upload.array('files', 12), (req, res) => {
  const files = (req.files || []).map((f) => ({
    url: urlFor(f.filename),
    type: /^video\//.test(f.mimetype) ? 'video' : 'image',
  }));
  res.json({ ok: true, files });
});

// POST /api/uploads/:listingId  (field: photos[]) -> attach photos to a listing
router.post('/:listingId', upload.array('photos', 12), async (req, res) => {
  try {
    const listing = await db.getById(req.params.listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    const urls = (req.files || []).map((f) => urlFor(f.filename));
    if (urls.length) await db.addPhotos(listing.id, urls);
    res.json({ ok: true, photos: urls });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
