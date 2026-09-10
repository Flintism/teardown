/**
 * Core Web Vitals — measured in the lab, per page.
 *
 *     npm run vitals
 *
 * Reports LCP, CLS, TTFB, FCP and total transfer weight, plus the identity of
 * the LCP element — which is the number that actually tells you what to fix.
 *
 * INP cannot be measured without real interaction, so this reports TBT (total
 * blocking time) instead, which is the lab proxy Lighthouse uses for it.
 *
 * Thresholds are Google's "good" bar:
 *   LCP <= 2.5s   CLS <= 0.1   TBT <= 200ms   FCP <= 1.8s
 */
import puppeteer from 'puppeteer-core';
import { findBrowser, BASE, PAGES, checkServer, LAUNCH } from './browser.mjs';

const GOOD = { lcp: 2500, cls: 0.1, tbt: 200, fcp: 1800 };
const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', DIM = '\x1b[90m', X = '\x1b[0m';

const verdict = (v, good) => (v <= good ? G + 'good' : v <= good * 1.6 ? Y + 'needs work' : R + 'poor') + X;
const ms = (v) => (v >= 1000 ? (v / 1000).toFixed(2) + 's' : Math.round(v) + 'ms');

await checkServer();
const browser = await puppeteer.launch({ ...LAUNCH, executablePath: findBrowser() });

console.log(`\n  Core Web Vitals — ${BASE}`);
console.log(`  ${DIM}lab measurement, cold cache, no CPU/network throttling${X}\n`);

const rows = [];

for (const p of PAGES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1350, height: 940 });
  await page.setCacheEnabled(false);

  let bytes = 0;
  page.on('response', async (res) => {
    try {
      const len = res.headers()['content-length'];
      if (len) bytes += Number(len);
      else if (res.ok()) bytes += (await res.buffer()).length;
    } catch {}
  });

  await page.evaluateOnNewDocument(() => {
    window.__v = { lcp: 0, cls: 0, lcpEl: '', longtasks: 0 };
    new PerformanceObserver((l) => {
      const e = l.getEntries().at(-1);
      window.__v.lcp = e.startTime;
      const el = e.element;
      window.__v.lcpEl = el
        ? el.tagName.toLowerCase() +
          (el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
        : '(text)';
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });

    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__v.longtasks += Math.max(0, e.duration - 50);
    }).observe({ type: 'longtask', buffered: true });
  });

  await page.goto(BASE + p.path, { waitUntil: 'networkidle0', timeout: 30000 });
  // give late layout shifts (font swap, lazy images) a chance to register
  await new Promise((r) => setTimeout(r, 1200));

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return {
      ...window.__v,
      ttfb: nav.responseStart || 0,
      fcp: fcp ? fcp.startTime : 0,
      dom: nav.domContentLoadedEventEnd || 0,
      resources: performance.getEntriesByType('resource').length,
    };
  });

  rows.push({ ...p, ...m, bytes });
  await page.close();
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`  ${pad('page', 13)}${pad('LCP', 18)}${pad('CLS', 16)}${pad('TBT', 16)}${pad('FCP', 12)}${pad('weight', 9)}reqs`);
console.log('  ' + '-'.repeat(88));

let worst = { lcp: 0 };
for (const r of rows) {
  if (r.lcp > worst.lcp) worst = r;
  console.log(
    '  ' + pad(r.name, 13) +
    pad(`${ms(r.lcp)} ${verdict(r.lcp, GOOD.lcp)}`, 18 + 9) +
    pad(`${r.cls.toFixed(3)} ${verdict(r.cls, GOOD.cls)}`, 16 + 9) +
    pad(`${ms(r.longtasks)} ${verdict(r.longtasks, GOOD.tbt)}`, 16 + 9) +
    pad(ms(r.fcp), 12) +
    pad((r.bytes / 1024).toFixed(0) + 'kB', 9) +
    r.resources
  );
}

console.log(`\n  ${DIM}LCP element per page:${X}`);
for (const r of rows) console.log(`    ${pad(r.name, 13)} ${r.lcpEl}`);

const allGood = rows.every(
  (r) => r.lcp <= GOOD.lcp && r.cls <= GOOD.cls && r.longtasks <= GOOD.tbt
);
console.log(
  allGood
    ? `\n  ${G}All pages within Google's "good" thresholds.${X}\n`
    : `\n  ${Y}Some metrics outside the "good" range — see above.${X}\n`
);

await browser.close();
