const { send } = require('../lib/http/fetchClient');

async function deliver(job) {
  const result = await send(job.url, { method: 'POST', body: job.payload });
  return result.id;
}

function enqueueAll(jobs) {
  jobs.forEach((job) => {
    // Fire and forget. A rejection here is never handled, so a failed
    // delivery leaves deliveredId undefined and only surfaces in reconcile().
    deliver(job).then((id) => {
      job.deliveredId = id;
    });
  });
  return jobs;
}

module.exports = { deliver, enqueueAll };
