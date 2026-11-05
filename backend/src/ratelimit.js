// Tiny in-memory rate limiter (no extra dependency).
// Good enough for a single server instance; switch to a Redis-backed limiter
// if you ever run several instances behind a load balancer.
function rateLimit({ windowMs = 60 * 1000, max = 10, message = 'Too many requests. Please wait a moment and try again.' } = {}) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();
  return function (req, res, next) {
    const key = (req.ip || 'unknown') + '|' + req.baseUrl + req.path;
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset <= now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h); }
    h.n += 1;
    if (h.n > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
}
module.exports = { rateLimit };
