/**
 * Accessibility audit — axe-core across every page, in both themes.
 *
 *     npm run a11y
 *
 * Tests light AND dark, because contrast is the single most common violation
 * and a palette that passes in one theme routinely fails in the other. Also
 * opens the command palette on one pass so the modal gets audited too — a
 * dialog that only exists after a click is exactly the kind of thing automated
 * checks normally miss.
 *
 * Exits non-zero on any violation, so it can gate a deploy.
 */
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { findBrowser, BASE, PAGES, checkServer, LAUNCH } from './browser.mjs';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core'), 'utf8');

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];
const COLOR = { critical: '\x1b[31m', serious: '\x1b[31m',
                moderate: '\x1b[33m', minor: '\x1b[90m' };
const RESET = '\x1b[0m';

async function auditPage(page, url, theme, openPalette = false) {
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('td-theme', t); } catch {}
  }, theme);

  // Freeze all motion, then reveal everything. Without this axe samples
  // colours mid-fade and reports phantom contrast failures that change from
  // run to run.
  await page.addStyleTag({
    content: '*,*::before,*::after{transition:none!important;animation:none!important}',
  });
  await page.evaluate(() => {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
  });
  await new Promise((r) => setTimeout(r, 60));

  if (openPalette) {
    await page.evaluate(() => document.querySelector('[data-open-palette]')?.click());
    await new Promise((r) => setTimeout(r, 250));
  }

  await page.evaluate(AXE);
  return page.evaluate(async () => {
    const res = await window.axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    });
    return res.violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
      nodes: v.nodes.slice(0, 3).map((n) => ({
        target: n.target.join(' '),
        summary: (n.failureSummary || '').split('\n').filter(Boolean).slice(1).join(' | '),
      })),
      count: v.nodes.length,
    }));
  });
}

const browser = await (async () => {
  await checkServer();
  return puppeteer.launch({ ...LAUNCH, executablePath: findBrowser() });
})();

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

const runs = [];
for (const p of PAGES) {
  for (const theme of ['light', 'dark']) {
    runs.push({ ...p, theme, palette: false });
  }
}
runs.push({ name: 'Home + command palette', path: '/index.html', theme: 'light', palette: true });

console.log(`\n  axe-core accessibility audit — ${runs.length} runs\n`);

let total = 0;
const seen = new Map();

for (const r of runs) {
  const violations = await auditPage(page, BASE + r.path, r.theme, r.palette);
  const n = violations.reduce((a, v) => a + v.count, 0);
  total += n;
  const label = `${r.name} (${r.theme})`;
  console.log(`  ${n === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${label.padEnd(34)} ${n === 0 ? 'no violations' : n + ' node(s)'}`);

  for (const v of violations) {
    const key = v.id;
    if (!seen.has(key)) seen.set(key, { ...v, where: [] });
    seen.get(key).where.push(label);
  }
}

if (seen.size) {
  console.log(`\n  ${seen.size} distinct issue(s):\n`);
  const sorted = [...seen.values()].sort(
    (a, b) => IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact)
  );
  for (const v of sorted) {
    const c = COLOR[v.impact] || '';
    console.log(`  ${c}[${(v.impact || 'n/a').toUpperCase()}]${RESET} ${v.id} — ${v.help}`);
    console.log(`      pages: ${[...new Set(v.where)].join(', ')}`);
    for (const n of v.nodes) {
      console.log(`      at: ${n.target}`);
      if (n.summary) console.log(`          ${n.summary.slice(0, 150)}`);
    }
    console.log(`      ${v.helpUrl}`);
    console.log();
  }
} else {
  console.log('\n  \x1b[32mNo accessibility violations found.\x1b[0m\n');
}

await browser.close();
process.exit(total > 0 ? 1 : 0);
