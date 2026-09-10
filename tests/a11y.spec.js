// @ts-check
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * axe-core over every page, in both themes, plus the states that only exist
 * after an interaction. A modal that appears on click is exactly the kind of
 * thing a page-load scan never sees.
 */

const PAGES = [
  ['Home', '/index.html'],
  ['Library', '/library.html'],
  ['Library filtered', '/library.html?type=versus'],
  ['About', '/about.html'],
  ['Tutorial', '/posts/claude-code-hooks.html'],
  ['Method', '/posts/how-we-test-coding-agents.html'],
  ['Comparison (draft)', '/posts/claude-code-vs-codex.html'],
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

/** Freeze motion and settle the reveal animation before sampling colour. */
async function settle(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
  }, theme);
  await page.addStyleTag({
    content: '*,*::before,*::after{transition:none!important;animation:none!important}',
  });
  await page.waitForTimeout(80);
}

function report(results) {
  return results.violations
    .map((v) => `[${v.impact}] ${v.id} — ${v.help}\n` +
      v.nodes.slice(0, 4).map((n) => `      ${n.target.join(' ')}`).join('\n'))
    .join('\n\n');
}

for (const [name, path] of PAGES) {
  for (const theme of ['light', 'dark']) {
    test(`a11y: ${name} (${theme})`, async ({ page }) => {
      await page.goto(path);
      await settle(page, theme);
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(results.violations, report(results)).toEqual([]);
    });
  }
}

test('a11y: command palette open', async ({ page }) => {
  await page.goto('/index.html');
  await settle(page, 'light');
  await page.locator('[data-open-palette]').first().click();
  await expect(page.locator('.pal')).toHaveClass(/is-open/);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations, report(results)).toEqual([]);
});

test('a11y: palette with results showing', async ({ page }) => {
  await page.goto('/index.html');
  await settle(page, 'dark');
  await page.locator('[data-open-palette]').first().click();
  await page.locator('.pal__input').fill('hooks');
  await page.waitForTimeout(150);
  await expect(page.locator('.pal__item')).not.toHaveCount(0);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations, report(results)).toEqual([]);
});

test('a11y: palette empty state', async ({ page }) => {
  await page.goto('/index.html');
  await settle(page, 'light');
  await page.locator('[data-open-palette]').first().click();
  await page.locator('.pal__input').fill('zzzzzznothing');
  await page.waitForTimeout(150);
  await expect(page.locator('.pal__empty')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations, report(results)).toEqual([]);
});

test('a11y: library with a topic filter applied', async ({ page }) => {
  await page.goto('/library.html');
  await settle(page, 'light');
  await page.locator('[data-filters] .chip', { hasText: 'Workflow' }).click();
  await page.waitForTimeout(150);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations, report(results)).toEqual([]);
});

/**
 * Invisible-text guard.
 *
 * axe reports contrast over a gradient or image background as "incomplete"
 * rather than a violation, and the suite only asserted on violations. That let
 * black-on-black text ship on the newsletter panel in dark mode: the panel used
 * a token that never flips while the text used one that does.
 *
 * This checks the thing axe declines to judge, and only the extreme case, so it
 * has no opinion about borderline contrast.
 */
for (const [name, path] of [['Home', '/index.html'], ['Library', '/library.html'],
                            ['About', '/about.html'],
                            ['Tutorial', '/posts/claude-code-hooks.html'],
                            ['Method', '/posts/how-we-test-coding-agents.html']]) {
  for (const theme of ['light', 'dark']) {
    test(`no invisible text: ${name} (${theme})`, async ({ page }) => {
      await page.goto(path);
      await settle(page, theme);

      const invisible = await page.evaluate(() => {
        const lum = (c) => {
          const f = c.map((v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
        };
        /* Chrome serialises color-mix() as "color(srgb 0.03 0.03 0.04 / 0.82)"
           with 0-1 components, not 0-255. Reading those as bytes turned every
           element under the translucent header into a phantom failure. */
        const parse = (s) => {
          if (!s) return [];
          const n = (s.match(/[\d.]+/g) || []).map(Number);
          if (s.startsWith('color(')) {
            const [r, g, b, a] = n;
            const rgb = [r, g, b].map((v) => Math.round(v * 255));
            return a === undefined ? rgb : [...rgb, a];
          }
          return n.slice(0, 4);
        };
        const ratio = (a, b) => {
          const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
          return (x + 0.05) / (y + 0.05);
        };

        /* Composite the background stack instead of skipping translucent
           layers. The draft pill sits on a 62%-alpha dark background over a
           dark poster; ignoring that layer made it look like white-on-white. */
        const bgOf = (el) => {
          const layers = [];
          for (let n = el; n; n = n.parentElement) {
            const c = parse(getComputedStyle(n).backgroundColor);
            const a = c.length === 4 ? c[3] : (c.length === 3 ? 1 : 0);
            if (a > 0) layers.push([c[0], c[1], c[2], a]);
            if (a >= 0.999) break;
            if (n === document.documentElement) break;
          }
          if (!layers.length) return [255, 255, 255];
          let base = layers[layers.length - 1].slice(0, 3);
          for (let i = layers.length - 2; i >= 0; i--) {
            const [r, g, b, a] = layers[i];
            base = [r, g, b].map((v, k) => Math.round(a * v + (1 - a) * base[k]));
          }
          return base;
        };

        const hidden = (el) => el.closest('[aria-hidden="true"]') !== null;

        const bad = [];
        for (const el of document.querySelectorAll('h1,h2,h3,h4,p,a,span,li,td,th,button')) {
          const text = [...el.childNodes]
            .filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
          if (!text) continue;
          if (hidden(el)) continue;              // decorative poster art
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          if (parseFloat(cs.opacity) === 0) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;

          const fgRaw = parse(cs.color);
          const fgA = fgRaw.length === 4 ? fgRaw[3] : 1;
          if (fgA === 0) continue;
          const bg = bgOf(el);
          // flatten a translucent text colour over its background too
          const fg = fgRaw.slice(0, 3).map((v, k) => Math.round(fgA * v + (1 - fgA) * bg[k]));

          const c = ratio(fg, bg);
          if (c < 1.5) {
            bad.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} `
                     + `"${text.slice(0, 40)}" ratio ${c.toFixed(2)}`);
          }
        }
        return bad;
      });

      expect(invisible, `text indistinguishable from its background:\n${invisible.join('\n')}`)
        .toEqual([]);
    });
  }
}
