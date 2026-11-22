// Photo processing on upload.
// Phone photos are 3-8 MB, 4000px wide and carry hidden EXIF data (GPS location,
// phone model, the time taken). We store two cleaned copies instead:
//   full  - max 1600px, JPEG (works everywhere, incl. WhatsApp/Facebook previews)
//   small - max 640px, WebP, for listing cards and thumbnails
// Re-encoding with sharp drops all metadata, so GPS never reaches the public.
let sharp = null;
try {
  sharp = require('sharp');
  sharp.cache(false);      // don't keep decoded images in memory between uploads
  sharp.concurrency(1);    // small server: one CPU thread per image is plenty
} catch (e) {
  console.error('[images] sharp is not available, photos will be stored unprocessed:', e.message);
}

const FULL_PX = 1600;
const SMALL_PX = 640;

function available() { return !!sharp; }

// Returns { full: Buffer (image/jpeg), small: Buffer (image/webp) }.
async function processPhoto(buffer) {
  const base = sharp(buffer, { failOn: 'error', limitInputPixels: 80e6 }).rotate(); // apply EXIF orientation, then forget it
  const full = await base.clone()
    .resize({ width: FULL_PX, height: FULL_PX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toBuffer();
  const small = await base.clone()
    .resize({ width: SMALL_PX, height: SMALL_PX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  return { full, small };
}

module.exports = { available, processPhoto, FULL_PX, SMALL_PX };
