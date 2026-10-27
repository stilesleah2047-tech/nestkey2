require('dotenv').config();

// --- SECURITY: JWT secret must be strong in production (Finding 2) ---
// Never fall back to a hardcoded, publicly-known secret in prod — that lets
// anyone forge a token (including an admin token). Fail closed instead.
const JWT_SECRET = process.env.JWT_SECRET;
if ((!JWT_SECRET || JWT_SECRET.length < 32) && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set to a strong (32+ char) value in production');
}
if (!JWT_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('[WARN] JWT_SECRET not set — using an ephemeral dev-only secret. DO NOT deploy like this.');
}

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:4000',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  driver: (process.env.DB_DRIVER || 'postgres').toLowerCase(),
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/househunt',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/househunt',
  roomRate: parseInt(process.env.ROOM_RATE || '100', 10),
  showcaseFee: parseInt(process.env.SHOWCASE_FEE || '500', 10),
  land: {
    ratePerAcre: parseInt(process.env.LAND_RATE || '1500', 10),
    min: parseInt(process.env.LAND_MIN || '300', 10),
    max: parseInt(process.env.LAND_MAX || '3000', 10),
  },
  currency: process.env.CURRENCY || 'KES',
  // Strong secret in prod (guaranteed by the check above); random ephemeral one in dev.
  jwtSecret: JWT_SECRET || ('dev-only-insecure-' + require('crypto').randomBytes(16).toString('hex')),
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean),
  commissionRate: parseFloat(process.env.COMMISSION_RATE || '0.08'),
  // Allowed browser origins for CORS (Finding 6). Comma-separated env override,
  // else sensible NestKey defaults.
  corsOrigins: (process.env.CORS_ORIGINS ||
    'https://nestkey.co.ke,https://www.nestkey.co.ke')
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean),
  storage: {
    // 's3' or 'r2' => object storage (both use the S3 API). Anything else => local disk.
    driver: (process.env.STORAGE_DRIVER || (process.env.S3_BUCKET ? 's3' : 'local')).toLowerCase(),
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    publicBase: process.env.S3_PUBLIC_BASE || '',
    forcePathStyle: /^true$/i.test(process.env.S3_FORCE_PATH_STYLE || ''),
  },
  publicUrlFront: process.env.PUBLIC_URL || 'http://localhost:4000',
  pesapal: {
    env: (process.env.PESAPAL_ENV || 'sandbox').toLowerCase(),
    key: process.env.PESAPAL_KEY || '',
    secret: process.env.PESAPAL_SECRET || '',
    ipnId: process.env.PESAPAL_IPN_ID || '',
    ipnUrl: process.env.PESAPAL_IPN_URL || '',
    callbackUrl: process.env.PESAPAL_CALLBACK_URL || '',
  },
  mpesa: {
    env: (process.env.MPESA_ENV || 'sandbox').toLowerCase(),
    key: process.env.MPESA_KEY || '',
    secret: process.env.MPESA_SECRET || '',
    shortcode: process.env.MPESA_SHORTCODE || '',
    passkey: process.env.MPESA_PASSKEY || '',
    type: (process.env.MPESA_TYPE || 'paybill').toLowerCase(),
    callbackUrl: process.env.MPESA_CALLBACK_URL || '',
  },
};
