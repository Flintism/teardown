const { logger } = require('../../lib/logger');

const buckets = new Map();

function rateLimiter({ windowMs, max }) {
  return function (req, res, next) {
    const key = req.ip;
    const now = Date.now();
    const b = buckets.get(key) || { count: 0, reset: now + windowMs };
    if (now > b.reset) {
      b.count = 0;
      b.reset = now + windowMs;
    }
    b.count += 1;
    buckets.set(key, b);
    if (b.count > max) {
      logger.warn({ key }, 'rate limited');
      return res.status(429).json({ error: 'slow down' });
    }
    next();
  };
}

module.exports = { rateLimiter };
