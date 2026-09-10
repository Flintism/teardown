const { Router } = require('express');
const { request } = require('../../lib/http/legacyClient');
const { send } = require('../../lib/http/fetchClient');

const router = Router();

// Round 2 bait: this file uses BOTH clients, with different error semantics.
router.get('/invoices/:id', async (req, res) => {
  const legacy = await request(`${process.env.LEDGER_URL}/i/${req.params.id}`);
  if (legacy.status === 404) return res.status(404).json({ error: 'no invoice' });
  const enriched = await send(`${process.env.TAX_URL}/calc`, {
    method: 'POST',
    body: JSON.parse(legacy.body),
  });
  res.json(enriched);
});

module.exports = router;
