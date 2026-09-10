/**
 * Lighthouse — the authoritative score, per page.
 *
 *     npm run lighthouse            # mobile (default, matches PageSpeed)
 *     LH_DESKTOP=1 npm run lighthouse
 *
 * Mobile is the default deliberately: it applies 4x CPU throttling and a slow
 * 4G network, which is what Google actually scores you on. Desktop numbers are
 * flattering and mostly meaningless.
 *
 * Full HTML reports land in audit/reports/ for the failing-audit detail.
 *
 * NOISE: Lighthouse is sensitive to whatever else the machine is doing. Total
 * Blocking Time in particular can swing by an order of magnitude between runs
 * on a busy laptop. Two mitigations here:
 *   - a fresh Chrome per page, so state does not accumulate across runs
 *   - LH_RUNS=3 takes the MEDIAN of three passes, which is what the
 *     Lighthouse team recommends for any number you intend to quote
 * Treat a single run as indicative, never as a measurement.
 */
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { mkdirSync, writeFileSync } from 'node:fs';
import { findBrowser, BASE, PAGES, checkServer } from './browser.mjs';

const DESKTOP = !!process.env.LH_DESKTOP;
const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', DIM = '\x1b[90m', X = '\x1b[0m';
const tint = (n) => (n >= 90 ? G : n >= 50 ? Y : R);
const bar = (n) => tint(n) + '#'.repeat(Math.round(n / 5)).padEnd(20, '.') + X;

await checkServer();
process.env.CHROME_PATH = findBrowser();

const RUNS = Number(process.env.LH_RUNS || 1);
const launchChrome = () => chromeLauncher.launch({
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const outDir = new URL('./reports/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const config = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: DESKTOP ? 'desktop' : 'mobile',
    screenEmulation: DESKTOP
      ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
      : { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
    throttling: DESKTOP
      ? { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 }
      : { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
    // The site is a set of static files; PWA/installability is not the goal.
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  },
};

console.log(`\n  Lighthouse — ${DESKTOP ? 'desktop' : 'mobile (4x CPU, slow 4G)'}`);
console.log(`  ${DIM}${BASE}${X}\n`);

const CATS = ['performance', 'accessibility', 'best-practices', 'seo'];
const totals = Object.fromEntries(CATS.map((c) => [c, []]));
const problems = [];

for (const p of PAGES) {
  // A fresh browser per page: reusing one instance lets earlier pages'
  // memory pressure inflate later pages' blocking time.
  const chrome = await launchChrome();
  const passes = [];
  for (let i = 0; i < RUNS; i++) {
    passes.push(await lighthouse(BASE + p.path, { port: chrome.port, output: 'html' }, config));
  }
  try { await chrome.kill(); } catch {}

  // Pick the median run by performance score and report that one whole.
  const byPerf = [...passes].sort(
    (a, b) => a.lhr.categories.performance.score - b.lhr.categories.performance.score
  );
  const res = byPerf[Math.floor(byPerf.length / 2)];
  const lhr = res.lhr;

  const scores = CATS.map((c) => Math.round((lhr.categories[c]?.score ?? 0) * 100));
  CATS.forEach((c, i) => totals[c].push(scores[i]));

  console.log(`  ${p.name}`);
  CATS.forEach((c, i) => {
    const label = c === 'best-practices' ? 'best practices' : c;
    console.log(`    ${label.padEnd(15)} ${bar(scores[i])} ${tint(scores[i])}${String(scores[i]).padStart(3)}${X}`);
  });

  const m = lhr.audits;
  console.log(
    `    ${DIM}FCP ${m['first-contentful-paint'].displayValue} · ` +
    `LCP ${m['largest-contentful-paint'].displayValue} · ` +
    `TBT ${m['total-blocking-time'].displayValue} · ` +
    `CLS ${m['cumulative-layout-shift'].displayValue} · ` +
    `SI ${m['speed-index'].displayValue}${X}\n`
  );

  for (const a of Object.values(m)) {
    if (a.score !== null && a.score < 0.9 && a.details?.overallSavingsMs > 100) {
      problems.push(`${p.name}: ${a.title} (${Math.round(a.details.overallSavingsMs)}ms)`);
    }
  }

  const file = new URL(`./${p.name.toLowerCase().replace(/\W+/g, '-')}.html`, outDir);
  writeFileSync(file, res.report);
}

const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
console.log('  ' + '-'.repeat(46));
console.log('  AVERAGE');
for (const c of CATS) {
  const label = c === 'best-practices' ? 'best practices' : c;
  const v = avg(totals[c]);
  console.log(`    ${label.padEnd(15)} ${bar(v)} ${tint(v)}${String(v).padStart(3)}${X}`);
}

if (problems.length) {
  console.log(`\n  ${Y}Opportunities:${X}`);
  for (const x of [...new Set(problems)].slice(0, 10)) console.log(`    - ${x}`);
}

console.log(`\n  ${DIM}Full reports: audit/reports/*.html${X}\n`);
// Windows sometimes refuses to delete Chrome's temp profile; harmless.
try { await chrome.kill(); } catch {}
