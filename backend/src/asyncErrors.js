// Express 4 does not catch errors thrown inside async route handlers. When one
// fails (for example a database error on a bad id like /api/agent/listings/abc),
// Node treats it as an unhandled rejection and the whole server exits, taking the
// site down until the host restarts it. This sends those errors to Express's error
// handler instead, so only that one request fails.
const Layer = require('express/lib/router/layer');

Layer.prototype.handle_request = function handle(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return next(); // error handlers are called elsewhere
  try {
    const out = fn(req, res, next);
    if (out && typeof out.catch === 'function') out.catch(next);
  } catch (err) {
    next(err);
  }
};

// Final error handler: log it, answer with a short JSON error.
function errorHandler(err, req, res, next) {
  console.error('[error]', req.method, req.originalUrl, err && (err.stack || err.message || err));
  if (res.headersSent) return next(err);
  res.status(err && err.status && err.status < 500 ? err.status : 500).json({ error: 'Something went wrong. Please try again.' });
}

// Backstop for promises that fail outside a request (fire-and-forget work):
// log them instead of letting Node exit.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason && (reason.stack || reason.message || reason));
});

module.exports = { errorHandler };
