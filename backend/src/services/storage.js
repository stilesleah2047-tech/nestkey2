// NestKey media storage.
// Uploads photos/videos to S3-compatible object storage (AWS S3 or Cloudflare R2)
// when configured; otherwise falls back to the local ./uploads disk (dev only).
//
// Configure via env (see .env.example):
//   STORAGE_DRIVER=s3            # or 'r2' — both use the S3 API. Omit for local disk.
//   S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
//   S3_PUBLIC_BASE              # public URL base for objects (CDN / r2.dev / bucket URL)
//   S3_FORCE_PATH_STYLE=true    # needed for some S3-compatible providers

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');

const S = config.storage;
const useS3 = S.driver === 's3' || S.driver === 'r2';

let s3 = null;
let PutObjectCommand = null;
if (useS3) {
  // Loaded lazily so local-disk deployments don't need the AWS SDK installed.
  const aws = require('@aws-sdk/client-s3');
  PutObjectCommand = aws.PutObjectCommand;
  s3 = new aws.S3Client({
    region: S.region || 'auto',
    endpoint: S.endpoint || undefined,
    forcePathStyle: !!S.forcePathStyle,
    credentials: { accessKeyId: S.accessKeyId, secretAccessKey: S.secretAccessKey },
  });
}

// Local disk fallback directory (created only when we actually use it).
const localDir = path.join(__dirname, '..', '..', config.uploadDir);
if (!useS3) fs.mkdirSync(localDir, { recursive: true });

function guessExt(m) {
  m = m || '';
  if (/mp4/.test(m)) return '.mp4';
  if (/webm/.test(m)) return '.webm';
  if (/quicktime/.test(m)) return '.mov';
  if (/png/.test(m)) return '.png';
  if (/webp/.test(m)) return '.webp';
  return '.jpg';
}

function keyFor(originalname, mimetype) {
  const ext = (path.extname(originalname || '') || '').toLowerCase() || guessExt(mimetype);
  return Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext;
}

function publicUrlForKey(key) {
  if (useS3) {
    if (S.publicBase) return S.publicBase.replace(/\/$/, '') + '/' + key;
    // Fallback: endpoint/bucket/key (works if the bucket/endpoint is publicly readable).
    if (S.endpoint) return S.endpoint.replace(/\/$/, '') + '/' + S.bucket + '/' + key;
  }
  // Same-origin relative path served by express.static.
  return '/' + config.uploadDir + '/' + key;
}

// Save one uploaded file (multer memoryStorage buffer) -> { url, type, key }.
async function save(file) {
  const key = keyFor(file.originalname, file.mimetype);
  const type = /^video\//.test(file.mimetype) ? 'video' : 'image';
  if (useS3) {
    await s3.send(new PutObjectCommand({
      Bucket: S.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  } else {
    fs.writeFileSync(path.join(localDir, key), file.buffer);
  }
  return { url: publicUrlForKey(key), type, key };
}

module.exports = { save, useS3 };
