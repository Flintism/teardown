// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Functional tests. These probe the things a static check and an accessibility
 * scan both miss: keyboard journeys, focus management, history behaviour, and
 * whether the interactive bits actually do what the UI promises.
 */

// ─────────────────────────────────────────── navigation and deep links ────

/** Below 720px the nav sits behind a toggle, so open it first. */
async function openNavIfCollapsed(page) {
  const toggle = page.locator('[data-nav-toggle]');
  if (await toggle.isVisible()) await toggle.click();
}

test('nav links resolve to the right filtered view', async ({ page }) => {
  await page.goto('/index.html');
  await openNavIfCollapsed(page);

  await page.getByRole('navigation').getByRole('link', { name: 'Comparisons' }).click();
  await expect(page).toHaveURL(/library\.html\?type=versus/);

  const visible = page.locator('.card:visible');
  await expect(visible).not.toHaveCount(0);
  const types = await visible.evaluateAll((els) =>
    [...new Set(els.map((e) => e.getAttribute('data-type')))]);
  expect(types).toEqual(['versus']);
});

test('the active nav item is marked for the current view', async ({ page }) => {
  await page.goto('/library.html?type=tutorial');
  const current = page.locator('.nav a[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText('Tutorials');
});

test('every internal link on every page resolves', async ({ page, baseURL }) => {
  const pages = ['/index.html', '/library.html', '/about.html',
                 '/posts/claude-code-hooks.html', '/posts/how-we-test-coding-agents.html'];
  const broken = [];

  for (const p of pages) {
    await page.goto(p);
    const hrefs = await page.locator('a[href]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('href')).filter(
        (h) => h && !/^(https?:|mailto:|#|data:)/.test(h)));

    for (const href of [...new Set(hrefs)]) {
      const url = new URL(href, baseURL + p).toString();
      const res = await page.request.get(url);
      if (!res.ok()) broken.push(`${p} -> ${href} (${res.status()})`);
    }
  }
  expect(broken, `broken links:\n${broken.join('\n')}`).toEqual([]);
});

// ───────────────────────────────────────────────────────── filtering ────

test('type and topic filters combine, and the URL reflects both', async ({ page }) => {
  await page.goto('/library.html');
  await page.locator('[data-type-filters] .chip', { hasText: 'Tutorials' }).click();
  await page.locator('[data-filters] .chip', { hasText: 'Workflow' }).click();

  await expect(page).toHaveURL(/type=tutorial/);
  await expect(page).toHaveURL(/cat=Workflow/);

  const shown = await page.locator('.card:visible').evaluateAll((els) =>
    els.map((e) => [e.getAttribute('data-type'), e.getAttribute('data-cat')]));
  expect(shown.every(([t, c]) => t === 'tutorial' && c === 'Workflow')).toBe(true);
});

test('a filtered URL survives a reload', async ({ page }) => {
  await page.goto('/library.html?type=guide');
  const before = await page.locator('.card:visible').count();
  await page.reload();
  await expect(page.locator('.card:visible')).toHaveCount(before);
  await expect(page.locator('[data-type-filters] .chip[aria-pressed="true"]')).toHaveText(/Guides/);
});

test('the back button undoes a filter change', async ({ page }) => {
  await page.goto('/library.html');
  const all = await page.locator('.card:visible').count();

  await page.locator('[data-type-filters] .chip', { hasText: 'Comparisons' }).click();
  await expect(page.locator('.card:visible')).not.toHaveCount(all);

  await page.goBack();
  await page.waitForTimeout(200);
  await expect(page.locator('.card:visible')).toHaveCount(all);
});

test('the empty state appears when a combination matches nothing', async ({ page }) => {
  await page.goto('/library.html');
  await page.locator('[data-type-filters] .chip', { hasText: 'Comparisons' }).click();
  await page.locator('[data-filters] .chip', { hasText: 'Commerce' }).click();
  await expect(page.locator('.card:visible')).toHaveCount(0);
  await expect(page.locator('[data-empty]')).toBeVisible();
});

// ────────────────────────────────────────────── the command palette ────

test('palette opens with the keyboard and closes on Escape', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  await expect(page.locator('.pal')).toHaveClass(/is-open/);
  await expect(page.locator('.pal__input')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('.pal')).not.toHaveClass(/is-open/);
});

test('palette returns focus to the trigger when closed', async ({ page }) => {
  await page.goto('/index.html');
  const trigger = page.locator('[data-open-palette]').first();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('palette keyboard selection opens the highlighted post', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  await page.locator('.pal__input').fill('hooks');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/claude-code-hooks/);
});

test('palette does not offer a dead link for a draft post', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  await page.locator('.pal__input').fill('codex');
  await page.waitForTimeout(150);
  const items = page.locator('.pal__item');
  await expect(items).not.toHaveCount(0);
  // Draft entries must render as non-navigable
  const tags = await items.evaluateAll((els) => els.map((e) => e.tagName));
  expect(tags).not.toContain('A');
});

test('the palette traps focus while open', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  const inside = await page.evaluate(() =>
    !!document.querySelector('.pal')?.contains(document.activeElement));
  expect(inside, 'focus escaped the open dialog').toBe(true);
});

// ─────────────────────────────────────────────────────────── theming ────

test('the theme toggle persists across a navigation', async ({ page }) => {
  await page.goto('/index.html');
  const before = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme'));
  await page.locator('[data-theme-toggle]').first().click();
  const after = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme'));
  expect(after).not.toBe(before);

  await page.goto('/library.html');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toBe(after);
});

// ──────────────────────────────────────────────── content guarantees ────

test('the affiliate post carries a disclosure above the article body', async ({ page }) => {
  await page.goto('/posts/claude-code-vs-codex.html');
  const disc = page.locator('.disclosure');
  await expect(disc).toBeVisible();
  const order = await page.evaluate(() => {
    const d = document.querySelector('.disclosure');
    const body = document.querySelector('.art__layout');
    return d && body ? (d.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING) > 0 : false;
  });
  expect(order, 'disclosure must precede the article body').toBe(true);
});

test('tutorials carry no affiliate disclosure', async ({ page }) => {
  await page.goto('/posts/claude-code-hooks.html');
  await expect(page.locator('.disclosure')).toHaveCount(0);
});

/**
 * Robots directives must match whichever mode the site is in. The mode is read
 * from robots.txt rather than hard-coded, so flipping ALLOW_SEARCH_INDEXING in
 * build.py does not require editing this test.
 */
test('robots directives match the site indexing mode', async ({ page, request }) => {
  const robotsTxt = await (await request.get('/robots.txt')).text();
  const siteClosed = /^\s*Disallow:\s*\/\s*$/m.test(robotsTxt);

  const pages = ['/index.html', '/library.html', '/about.html',
                 '/posts/claude-code-hooks.html',
                 '/posts/claude-code-vs-codex.html'];

  for (const path of pages) {
    await page.goto(path);
    const metas = page.locator('meta[name="robots"]');
    // exactly one directive per page: two conflicting ones is how a blocked
    // site quietly gets indexed anyway
    await expect(metas, `${path} must have one robots meta`).toHaveCount(1);

    const content = (await metas.getAttribute('content')) || '';
    const noindexed = content.includes('noindex');

    if (siteClosed) {
      expect(noindexed, `${path} indexable while the site is closed`).toBe(true);
    } else {
      const isDraft = path.includes('claude-code-vs-codex');
      expect(noindexed, `${path} noindex should be ${isDraft}`).toBe(isDraft);
    }
  }

  if (siteClosed) {
    expect(robotsTxt, 'a blocked site should not advertise a sitemap')
      .not.toContain('Sitemap:');
  }
});

test('no draft post is linked from anywhere', async ({ page }) => {
  const drafts = ['claude-code-vs-codex', 'how-we-test-coding-agents'];
  const found = [];
  for (const p of ['/index.html', '/library.html', '/posts/claude-code-hooks.html']) {
    await page.goto(p);
    for (const slug of drafts) {
      const n = await page.locator(`a[href*="${slug}"]`).count();
      if (n) found.push(`${p} links to draft ${slug} (${n}x)`);
    }
  }
  expect(found, found.join('\n')).toEqual([]);
});

// ────────────────────────────────────────────── article page chrome ────

test('the table of contents builds and tracks scrolling', async ({ page }) => {
  await page.goto('/posts/claude-code-hooks.html');
  const links = page.locator('.toc a');
  await expect(links).not.toHaveCount(0);

  // Labels must not swallow the "Round 01" style kicker
  const first = await links.first().textContent();
  expect(first?.trim().length).toBeGreaterThan(0);

  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const h = document.querySelectorAll('.prose h2[id]');
    h[h.length - 1]?.scrollIntoView();
  });
  await page.waitForTimeout(300);
  await expect(page.locator('.toc a.is-active')).toHaveCount(1);
});

test('code blocks are reachable by keyboard and copy on click', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/posts/claude-code-hooks.html');

  const pre = page.locator('.code pre').first();
  await expect(pre).toHaveAttribute('tabindex', '0');

  await page.locator('.code__copy').first().click();
  await expect(page.locator('.code__copy').first()).toHaveText(/copied/i);

  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip.length).toBeGreaterThan(10);
});

test('the reading progress bar advances on scroll', async ({ page }) => {
  await page.goto('/posts/claude-code-hooks.html');
  const width = () => page.locator('.progress').evaluate((el) => el.style.width);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, document.body.scrollHeight / 2);
  });
  await page.waitForTimeout(250);
  const w = await width();
  expect(parseFloat(w)).toBeGreaterThan(0);
});

// ───────────────────────────────────────────────── resilience ────

test('the skip link is the first tab stop and moves focus to main', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Tab');
  const skip = page.locator('.skip');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main/);
});

test('content is visible even if IntersectionObserver never fires', async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-ignore - simulate an environment where the observer never delivers
    window.IntersectionObserver = class {
      observe() {} unobserve() {} disconnect() {}
    };
  });
  await page.goto('/index.html');
  await page.waitForTimeout(3000);   // the failsafe fires at 2.5s
  const hidden = await page.locator('.card').evaluateAll((els) =>
    els.filter((e) => parseFloat(getComputedStyle(e).opacity) === 0).length);
  expect(hidden, 'cards stayed invisible with no IntersectionObserver').toBe(0);
});

test('no page scrolls sideways', async ({ page }) => {
  for (const p of ['/index.html', '/library.html', '/about.html',
                   '/posts/claude-code-hooks.html', '/posts/how-we-test-coding-agents.html']) {
    await page.goto(p);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${p} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
  }
});

test('the page loads without console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const p of ['/index.html', '/library.html', '/posts/claude-code-hooks.html']) {
    await page.goto(p);
    await page.waitForTimeout(400);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the newsletter form confirms submission', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('form[data-signup] input[type="email"]').first().fill('reader@example.com');
  await page.locator('form[data-signup] button[type="submit"]').first().click();
  await expect(page.locator('.form__ok')).toBeVisible();
});

// ─────────────────────────────────────────────────── mobile navigation ────

test('the site is navigable on a phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile viewport only');

  await page.goto('/index.html');
  const toggle = page.locator('[data-nav-toggle]');
  await expect(toggle).toBeVisible();
  await expect(page.locator('#site-nav')).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#site-nav')).toBeVisible();

  await page.locator('#site-nav a', { hasText: 'Comparisons' }).click();
  await expect(page).toHaveURL(/type=versus/);
});

test('the mobile menu closes on Escape and returns focus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile viewport only');

  await page.goto('/index.html');
  const toggle = page.locator('[data-nav-toggle]');
  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('the nav is reachable at every viewport', async ({ page }) => {
  for (const width of [360, 700, 900, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/index.html');
    const navVisible = await page.locator('#site-nav').isVisible();
    const toggleVisible = await page.locator('[data-nav-toggle]').isVisible();
    expect(navVisible || toggleVisible,
      `no way to reach the nav at ${width}px`).toBe(true);
  }
});

// ──────────────────────────────────────────── analytics and consent ────

/**
 * These skip themselves when GA4 is not configured, which is the shipped
 * state. Set GA4_MEASUREMENT_ID in build.py and they start running.
 *
 * Note the hostname: the tag deliberately reports nothing from bare
 * localhost, so the consent flow can only be exercised from a host that is
 * not loopback-named.
 */
const GA_HOST = 'http://teardown.localhost:4321';

async function analyticsConfigured(request) {
  const html = await (await request.get('/index.html')).text();
  return html.includes('GA4:start');
}

test('analytics sends nothing from localhost', async ({ page, request }) => {
  test.skip(!(await analyticsConfigured(request)), 'GA4 not configured');

  let hits = 0;
  page.on('request', (r) => {
    if (/google-analytics|\/g\/collect/.test(r.url())) hits++;
  });
  await page.goto('/index.html');
  await page.waitForTimeout(700);

  expect(hits, 'dev traffic must never reach the production property').toBe(0);
  await expect(page.locator('.consent')).toHaveCount(0);
});

test('declining analytics sets no cookie', async ({ page, request, context }) => {
  test.skip(!(await analyticsConfigured(request)), 'GA4 not configured');

  await page.goto(`${GA_HOST}/index.html`);
  await expect(page.locator('.consent')).toBeVisible();

  await page.locator('[data-consent="denied"]').click();
  await expect(page.locator('.consent')).toHaveCount(0);
  await page.waitForTimeout(500);

  const ga = (await context.cookies()).filter((c) => c.name.startsWith('_ga'));
  expect(ga, 'declining must leave no analytics cookie').toEqual([]);

  // and the choice survives a reload
  await page.reload();
  await expect(page.locator('.consent')).toHaveCount(0);
});

test('allowing analytics sets the cookie and is remembered', async ({ page, request, context }) => {
  test.skip(!(await analyticsConfigured(request)), 'GA4 not configured');

  await page.goto(`${GA_HOST}/index.html`);
  await page.locator('[data-consent="granted"]').click();
  await page.waitForTimeout(700);

  const ga = (await context.cookies()).filter((c) => c.name.startsWith('_ga'));
  expect(ga.length, 'granting consent should set the GA cookie').toBeGreaterThan(0);

  await page.reload();
  await expect(page.locator('.consent')).toHaveCount(0);
});
