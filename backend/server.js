const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./src/config');
const db = require('./src/db');

const { rateLimit } = require('./src/ratelimit');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // correct client IPs behind Render/Railway/Nginx (needed for rate limits)

// Basic security headers (no extra dependency).
app.use(function (req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (process.env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// CORS: only our own sites (config.corsOrigins). Previously cors() allowed every origin.
// Same-origin requests and server-to-server callbacks (M-Pesa, Pesapal) send no Origin and are unaffected.
const devOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(cors({
  origin: function (origin, cb) {
    if (!origin || config.corsOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && devOrigin.test(origin))) return cb(null, true);
    return cb(null, false);
  },
}));
app.use(express.json({ limit: '2mb' }));

// Rate limits on endpoints that are easy to abuse.
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many sign-in attempts. Try again in a few minutes.' }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }));
app.use('/api/auth/google', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
app.use('/api/contact', rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }));
app.use('/api/ratings', rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }));
app.use('/api/payments/pesapal', rateLimit({ windowMs: 10 * 60 * 1000, max: 120 })); // status polls every 5s
app.use('/api/subscriptions/pesapal', rateLimit({ windowMs: 10 * 60 * 1000, max: 10 }));
app.use('/api/agent/commission/pay', rateLimit({ windowMs: 10 * 60 * 1000, max: 10 }));

// SEO routes must come BEFORE express.static so /sitemap.xml and
// /property/:id are generated from the database.
app.use(require('./src/seo').router);

// Clean page addresses: /browse.html -> /browse and /index(.html) -> / (permanent),
// keeping any ?query. Old links, bookmarks and search results keep working.
// (/property.html?id=… is handled by the SEO router above.)
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const m = req.path.match(/^\/([A-Za-z0-9_-]+)(\.html)?$/);
  if (!m || (!m[2] && m[1] !== 'index')) return next();
  const qs = req.originalUrl.slice(req.originalUrl.indexOf(req.path) + req.path.length);
  res.redirect(301, (m[1] === 'index' ? '/' : '/' + m[1]) + qs);
});

// Serve uploaded images and the frontend app (/browse serves browse.html).
app.use('/' + config.uploadDir, express.static(path.join(__dirname, config.uploadDir)));
app.use('/', express.static(path.join(__dirname, '..', 'frontend'), { extensions: ['html'], index: 'index.html' }));

// API
app.use('/api/listings', require('./src/routes/listings'));
app.use('/api/payments', require('./src/routes/payments'));
app.use('/api/subscriptions', require('./src/routes/subscriptions'));
app.use('/api/uploads', require('./src/routes/uploads'));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/agent', require('./src/routes/agent'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/rent', require('./src/routes/rent'));
app.use('/api/ratings', require('./src/routes/ratings'));
app.use('/api/contact', require('./src/routes/contact'));
app.use('/api/favourites', require('./src/routes/favourites'));
app.use('/api/auth', require('./src/routes/google'));
// Real-time stream (Server-Sent Events). ?token= to also receive private/admin events.
const events = require('./src/events');
const { verify, isAdmin } = require('./src/auth');
app.get('/api/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders && res.flushHeaders();
  res.write(': connected\n\n');
  const u = verify(req.query.token || '');
  const remove = events.addClient(res, u ? u.id : null, isAdmin(u));
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 25000);
  req.on('close', () => { clearInterval(ping); remove(); });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, driver: config.driver, roomRate: config.roomRate }));
app.get('/api/config', (_req, res) => res.json({
  roomRate: config.roomRate,
  showcaseFee: config.showcaseFee,
  commissionRate: config.commissionRate,
  land: config.land,
  roomTypes: require('./src/rooms').ROOM_TYPES,
}));
app.get('/api/locations', (_req, res) => res.json(require('./src/locations').COUNTIES));

async function start() {
  await db.init();
  app.listen(config.port, () => {
    console.log(`[server] NestKey API on http://localhost:${config.port}  (db: ${config.driver})`);
  });
}

start().catch((e) => {
  console.error('Failed to start:', e);
  process.exit(1);
});
