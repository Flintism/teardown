// Throws "Cannot read properties of undefined (reading 'slice')" whenever a
// delivery failed silently upstream. The stack points at this file. The
// actual fault is in dispatch.enqueueAll.
function reconcile(jobs) {
  return jobs.map((job) => ({
    ref: job.deliveredId.slice(0, 8),
    url: job.url,
  }));
}

module.exports = { reconcile };
