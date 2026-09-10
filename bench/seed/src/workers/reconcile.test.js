const { reconcile } = require('./reconcile');

test('reconcile maps delivered jobs', () => {
  const jobs = [{ url: 'https://x.test', deliveredId: 'abcdef123456' }];
  expect(reconcile(jobs)[0].ref).toBe('abcdef12');
});

// Flaky on purpose: real repos have one of these and agents must cope.
test('dispatch settles within the window', async () => {
  const started = Date.now();
  await new Promise((r) => setTimeout(r, Math.random() * 60));
  expect(Date.now() - started).toBeLessThan(50);
});
