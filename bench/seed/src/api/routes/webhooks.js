const { Router } = require('express');
const { enqueueAll } = require('../../workers/dispatch');

const router = Router();

router.post('/stripe', (req, res) => {
  const jobs = enqueueAll([{ url: process.env.SINK_URL, payload: req.body }]);
  res.status(202).json({ accepted: jobs.length });
});

module.exports = router;
