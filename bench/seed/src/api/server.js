const express = require('express');
const { logger } = require('../lib/logger');
const webhooks = require('./routes/webhooks');
const billing = require('./routes/billing');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();
app.use(express.json({ limit: '2mb' }));

// Webhook delivery is latency-sensitive, so it is mounted early.
app.use('/webhooks', webhooks);

app.use(rateLimiter({ windowMs: 60000, max: 120 }));

app.use('/billing', billing);

app.use((err, _req, res, _next) => {
  logger.error({ err }, 'unhandled');
  res.status(500).json({ error: 'internal' });
});

module.exports = { app };
