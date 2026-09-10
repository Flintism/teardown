const https = require('https');
const { logger } = require('../logger');

// The original client. Retries 5xx on a fixed 300ms backoff and RETURNS the
// status code rather than throwing.
function request(url, { method = 'GET', body, headers = {}, retries = 2 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 500 && retries > 0) {
          logger.warn({ url, status: res.statusCode }, 'retrying');
          return setTimeout(
            () => request(url, { method, body, headers, retries: retries - 1 }).then(resolve, reject),
            300
          );
        }
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

module.exports = { request };
