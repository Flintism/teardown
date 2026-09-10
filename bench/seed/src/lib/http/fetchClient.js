const { logger } = require('../logger');

// The newer client. Exponential backoff, and it THROWS on non-2xx instead of
// returning the status. Collapsing this with legacyClient without a shim
// changes what every caller sees on a 404.
async function send(url, { method = 'GET', body, headers = {}, attempt = 0 } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status >= 500 && attempt < 3) {
    const wait = 2 ** attempt * 200;
    logger.warn({ url, status: res.status, wait }, 'retrying');
    await new Promise((r) => setTimeout(r, wait));
    return send(url, { method, body, headers, attempt: attempt + 1 });
  }
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.json();
}

module.exports = { send };
