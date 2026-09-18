const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./src/config');
const db = require('./src/db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve uploaded images and the frontend app.
app.use('/' + config.uploadDir, express.static(path.join(__dirname, config.uploadDir)));
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

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
