# Teardown

A static site for **tutorials** and **head-to-head comparisons**. No framework,
no dependencies to install, no thumbnail images to design.

```bash
npm install     # only needed for the audit tooling
npm run dev     # build + serve on http://localhost:4321
```

Or without Node: `python build.py && python serve.py`. Any static host works — GitHub Pages, Netlify,
Cloudflare Pages, S3. Just upload the folder.

**Set `SITE_URL` in `build.py` before deploying.** Every canonical tag, social
card, sitemap entry and schema URL is generated from it.

---

## The idea: thumbnails are generated, not designed

The thing that usually kills a publication like this is artwork. Every post needs
a thumbnail, thumbnails need a designer, and without one your grid looks dead.

So there are no thumbnail images here. Every poster is **rendered from the post's
metadata** by `assets/js/site.js`, in three art directions:

| Type       | Art direction                                                        |
|------------|----------------------------------------------------------------------|
| `versus`   | Diagonal colour split, both tools as chips, giant `VS` in difference blend |
| `tutorial` | Dark stock, drifting colour blobs, ghost numeral in the corner        |
| `guide`    | Paper stock, serif headline, printed-grid texture                     |

Add a post and the artwork exists. Change the category and the colours follow.
Nothing to export, nothing to re-crop, and the grid stays coherent because the
posters were never drawn by hand in the first place.

---

## Publishing a post

**1. Add an object to `assets/js/data.js`:**

```js
{
  slug: 'my-comparison',
  type: 'versus',                    // versus | tutorial | guide
  title: 'Tool A vs. Tool B: the honest scoreline',
  posterH: 'Two tools. One repo.',   // optional shorter headline for the poster
  deck: 'One line that makes someone click.',
  category: 'AI Coding',             // must exist in CATEGORIES
  date: '2026-09-08',
  mins: 12,
  author: AUTHOR,                    // the shared record at the top of data.js
  tags: ['searchable', 'keywords'],
  vs: {                              // required for type: 'versus'
    a: { name: 'Tool A', initials: 'TA', color: '#FF5B38' },
    b: { name: 'Tool B', initials: 'TB', color: '#22D3EE' }
  }
}
```

**2. Copy the closest template in `posts/` and rewrite the `<article class="prose">` block.**

- `posts/claude-code-vs-codex.html` — comparison layout
- `posts/claude-code-hooks.html` — tutorial layout

That's it. The card, the poster, the search index, the category chip and its
count, and the "Read next" grids all update from step 1.

Useful flags: `featured: true` promotes a post to the homepage hero. `draft: true`
renders a dimmed, unclickable "In the works" card so your pipeline is visible
without shipping dead links.

---

## Components you can drop into any article

| Markup | What it is |
|---|---|
| `.verdict` | Per-section "Winner:" box. The move that makes comparisons scannable. |
| `.score` | Round-by-round scorecard with bars that animate into view |
| `.spec` | Two-column "better when…" panels |
| `.note` / `.note--tip` / `.note--warn` / `.note--stop` | Callouts. Set the icon with `data-icon="⚡"` |
| `.step` + `.step__n` | Numbered tutorial steps |
| `.code` | Code block with filename bar and working copy button |
| `.prompt` | Copyable prompt box — for "paste this into your agent" |
| `.faq` | `<details>` accordion |
| `h2[id]` | Any `h2` with an `id` is picked up by the sticky TOC automatically |

Give a `.prose h2` a `<span class="n">Round 01</span>` kicker and the TOC strips it
out of the label for you. Override the per-article accent with
`<body style="--accent:#22D3EE">`.

---

## What's built in

- Generated poster thumbnails (the whole point)
- ⌘K / Ctrl-K command palette searching titles, decks, categories and tags
- Category filters with live counts
- Light/dark themes, remembered, set before first paint so there's no flash
- Sticky TOC with scrollspy, reading-progress bar
- Copy buttons on every code and prompt block
- Reveal-on-scroll and animated score bars, both disabled under
  `prefers-reduced-motion`
- Verified: no horizontal overflow at 375px on any page

## Files

```
index.html          homepage — hero, featured, three sections
library.html        everything, filterable
about.html          method + independence policy
posts/              one HTML file per article
assets/img/saad.jpg your portrait
assets/og/          generated 1200x630 social cards
assets/js/data.js   ← the only file you touch to publish
assets/js/templates.js  card + poster markup, shared by browser and build
assets/js/site.js   filters, palette, TOC, theme, copy buttons
assets/css/style.css design system

build.py            the build: prerender, bundle, OG images, sitemap, feed, SEO
prerender.py        bakes card grids into the HTML for crawlers
bundle.py           JS bundling + minification, WebP conversion
seo.py              JSON-LD graph + head tag generation
seo_pages.py        per-page SEO wiring
validate.py         post-build self-check
serve.py            threaded, gzipping dev server

audit/a11y.mjs      axe-core, both themes, 11 runs
audit/vitals.mjs    Core Web Vitals
audit/lighthouse.mjs Lighthouse, mobile-throttled
audit/browser.mjs   finds a local Chromium, shared config

robots.txt sitemap.xml feed.xml llms.txt llms-full.txt   <- all generated
```

## Known limitations

- **Run `python build.py` after every content change.** Adding a post to
  `data.js` alone won't update the prerendered HTML, sitemap, feed or llms.txt.
- **The sample article copy is placeholder.** The comparison's scores and the
  "400 sessions" figures are invented to demonstrate the format. The hook
  mechanics in the tutorial are real but worth checking against current docs
  before you publish under your own name. Both files are marked
  `<!-- SAMPLE COPY -->` at the top of the prose.
- **The newsletter form is a stub.** It fakes success on submit. Point it at
  Buttondown, ConvertKit or whatever you use.
- Seven of the nine seeded posts are `draft: true` — they exist to fill the grid
  and show the pipeline UI. Delete them or write them.

---

## SEO and GEO

Two audiences: search crawlers, and the language models that increasingly answer
questions instead of linking out. `python build.py` produces both sets of
signals. Nothing below is hand-maintained in the HTML — change `SITE_URL` and
rebuild and it all updates.

### The one that matters most: prerendering

The card grids used to be built by JavaScript, which meant Googlebot saw empty
`<div>`s and most AI crawlers — which don't run JS at all — saw nothing. The
build now bakes the cards into the HTML:

| Page | Indexable text without JS | Cards in raw HTML |
|---|---|---|
| `index.html` | 3,988 chars | 8 |
| `library.html` | 3,123 chars | 9 |
| a post | 10,181 chars | 3 (read-next) |

Markup comes from `assets/js/templates.js` run through Node, so the prerendered
HTML and the browser-rendered HTML are byte-identical and can't drift. The
browser skips any container the build already filled.

Related: `.reveal` animations are now **visible by default** and only hidden
once JS confirms it can animate them back (`html.js .reveal`), plus a 2.5s
failsafe. Content is never invisible because a script didn't run.

### Structured data (the GEO half)

Every page ships a JSON-LD `@graph`. Search engines use it for rich results;
generative engines use it to decide what a page *is*, who wrote it, and whether
a claim is attributable — which is the difference between being **cited** in an
answer and being silently absorbed into one.

| Page | Schema |
|---|---|
| Home | `WebSite`, `Organization`, `Person`, `CollectionPage` + `ItemList` |
| Library | + `BreadcrumbList` |
| About | `AboutPage` → `Person` |
| Comparison | `TechArticle`, `FAQPage`, `BreadcrumbList` |
| Tutorial | `HowTo` (with steps), `FAQPage`, `BreadcrumbList` |

The `FAQPage` and `HowTo` steps are **extracted from the rendered HTML**, not
retyped — 3 Q&A pairs and 4 steps on the hooks tutorial, pulled straight from
the `<details>` and `.step` blocks. Structured data that contradicts the visible
page is how you lose a rich result, so it's generated from the page itself.

`Organization` also carries `publishingPrinciples`, `ethicsPolicy` and
`correctionsPolicy` pointing at the About page. Those are E-E-A-T signals: they
say the site has a stated, checkable standard rather than an opinion.

Named entities (`Claude Code`, `Codex`, `Cursor`, …) are linked to their
canonical URLs via `mentions`/`about`, so a model can connect a page to the
thing the user actually asked about.

### Search visibility is one switch

```python
# build.py
ALLOW_SEARCH_INDEXING = False    # currently CLOSED to search engines
```

The site is closed to search engines and AI crawlers. Flipping that flag and
rebuilding opens it.

The flag drives four things at once, because they do different jobs and a site
that gets half of them right is a site that gets indexed by accident:

| Mechanism | What it does |
|---|---|
| `robots.txt` `Disallow: /` | Stops crawlers **fetching** pages |
| `<meta name="robots" content="noindex">` on every page | Stops pages being **indexed** |
| `X-Robots-Tag` in `_headers` and `netlify.toml` | Same, at the HTTP layer, which **overrides** the meta tag |
| No `Sitemap:` line in robots.txt | Stops advertising URLs you are blocking |

**The trap worth knowing:** `Disallow` and `noindex` are not the same control.
`Disallow` prevents crawling, not indexing, so a blocked URL can still appear in
results as a bare link if something else links to it. Worse, a crawler that is
not allowed to fetch the page never sees the `noindex` that would have kept it
out. For a site that has never been indexed, blocking is enough; both are
shipped so the answer is right either way.

`validate.py` fails the build if these ever disagree, in both directions, and
one Playwright test reads the mode out of `robots.txt` rather than hard-coding
it, so flipping the flag needs no test edits.

### Discovery files

| File | What it's for |
|---|---|
| `robots.txt` | Generated from `ALLOW_SEARCH_INDEXING`. Currently **blocking every crawler** |
| `sitemap.xml` | 5 URLs with `lastmod` |
| `feed.xml` | RSS 2.0 — still how aggregators and many AI crawlers find new posts |
| `llms.txt` | The emerging convention: a clean plain-text map of the site |
| `llms-full.txt` | The same map **plus the full article prose** (18 KB), so a model can answer from one fetch instead of crawling every page |

**A choice worth making consciously:** the crawler list mixes *search* crawlers
(`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`) which can cite you, with
*training* crawlers (`GPTBot`, `CCBot`, `Google-Extended`, `Applebot-Extended`,
`Meta-ExternalAgent`) which absorb your text into a model. Allowing both is the
right default for reach. If you'd rather be cited but not trained on, delete the
training agents from `AI_CRAWLERS` in `build.py` and rebuild.

Nothing is disallowed, deliberately. Blocking `/assets/` is a common reflex and
a bad one — Google fetches CSS and JS to render pages, and blocking them earns
you "blocked resources" warnings rather than a tidier index.

### Social cards

`assets/og/*.png` — a 1200×630 card per post, generated by Pillow in the same
three art directions as the site posters, plus a `default.png` for other pages.
Wired to `og:image` and `twitter:image` with `summary_large_image`.

### The build checks itself

`validate.py` runs after every build and fails loudly on: unbalanced `<div>`,
`<article>` or `<section>` tags; missing or duplicate `<title>`/canonical/SEO
block/JSON-LD; dead internal links; posts missing from the sitemap or feed;
missing OG images; and any page loading `site.js` without `templates.js`.

That last check exists because all three of those bugs actually happened while
this was being built. The build is idempotent — run it ten times, the output is
identical.

### Still worth doing by hand

- Set `SITE_URL`, rebuild, then submit `sitemap.xml` to Google Search Console
  and Bing Webmaster Tools.
- Add real `sameAs` links (GitHub, LinkedIn, X) to the `Person` schema in
  `seo.py` — identity links are a strong E-E-A-T signal.
- The sample article copy is invented. Rewrite it before chasing traffic;
  ranking for content you can't stand behind is worse than not ranking.


---

## Quality gates

```bash
npm run audit        # all three
npm run a11y         # axe-core, 11 runs
npm run vitals       # Core Web Vitals
npm run lighthouse   # Lighthouse (LH_RUNS=3 for a stable number)
```

### The Playwright suite

```bash
npm test                # 92 tests, desktop + mobile
npm run test:mobile     # mobile only
npm run test:ui         # interactive runner
```

[Playwright](https://playwright.dev) with
[@axe-core/playwright](https://github.com/dequelabs/axe-core-npm). It drives a
Chromium already on the machine rather than downloading one; set
`PW_USE_BUNDLED=1` to prefer Playwright's own.

Two files:

- **`tests/a11y.spec.js`** — axe-core over every page in both themes, plus the
  states that only exist after an interaction: palette open, palette with
  results, palette empty, library with a filter applied. A page-load scan never
  sees any of those.
- **`tests/site.spec.js`** — the things neither a static check nor an
  accessibility scan can reach: keyboard journeys, focus management, history
  behaviour, clipboard, and whether the interactive parts do what the UI says.

This suite found **nine real bugs on its first run**, including two the
standalone axe script had been passing for days. The most serious was not an
accessibility rule at all: below 720px the nav was `display: none` with no
replacement, so **the entire site was unreachable on a phone** except through
in-content links. There is now a proper disclosure menu with a focus-returning
Escape, and `the nav is reachable at every viewport` guards it at 360, 700, 900
and 1280px.

The others, all fixed:

| Bug | Why it mattered |
|---|---|
| `.pal__list` was `role="listbox"` with a plain `<div>` inside when empty | **Critical** invalid ARIA — a listbox must own options |
| The palette never returned focus to its trigger | Keyboard users were dumped at the top of the document |
| The palette did not trap Tab | Focus escaped an open modal dialog |
| Filters used `replaceState` | The back button could not undo a filter change |
| `.chip__n` at `opacity: .6` | ~2.6:1 on paper; it only ever passed because the chip carrying it happened to be pressed |
| A filtered URL served every card until JS ran | Visible flash of the wrong content |
| The footer linked a post that had been pulled to draft | Hand-written list drifted; now generated |
| `prerender.py` only filled `<div>` containers | It silently skipped the `<ul>` footer list — which is *why* that list went stale |

### Accessibility — the standalone script

`npm run a11y` is the older axe-core runner (Puppeteer, no Playwright
dependency). The Playwright suite supersedes it and covers more states; this is
kept because it runs without the Playwright install.

**Result: 11/11 pass, zero violations.** Getting there fixed four real things:

| Issue | Impact | What was wrong |
|---|---|---|
| `color-contrast` | serious | `--fg-faint` was 3.44:1 on paper and 3.88:1 in dark — both below the 4.5:1 AA bar. Accent-coloured small text was worse: 2.95:1 for the coral section kickers, **1.73:1** for cyan prompt labels |
| `scrollable-region-focusable` | serious | Code blocks scroll horizontally but had no keyboard access |
| `aria-input-field-name` | serious | The command palette's `role="listbox"` had no accessible name |
| `heading-order` | moderate | Footer `h5` after `h2`; card titles `h3` under an `h1`; author boxes `h4` |

New colours were computed against the actual backgrounds rather than eyeballed
— every token now clears 4.5:1 on both `--bg` and `--surface-2` in both themes.
Accent-as-text is darkened at the use site with `color-mix`, so per-article
`--accent` overrides still flow through. Also added: a skip link, visible focus
rings on scrollable regions, and a `prefers-contrast: more` block.

**One trap worth knowing:** the first runs reported violation counts that
swung between 44 and 84 for the same page. axe was sampling colours *mid-fade*
on the reveal animation. The harness now freezes all transitions before
measuring — without that the audit is worse than useless, because it is
confidently wrong.

### Core Web Vitals

`npm run vitals` measures LCP, CLS, TBT and FCP per page with `PerformanceObserver`,
and reports **which element is the LCP** — the number that actually tells you
what to fix.

| Page | LCP | CLS | TBT |
|---|---|---|---|
| Home | 1.00s | 0.064 | 41ms |
| Library | 884ms | 0.020 | 0ms |
| About | 788ms | 0.079 | 0ms |
| Comparison | 1.96s | 0.008 | 2ms |
| Tutorial | 1.32s | 0.028 | 185ms |

All inside Google's "good" thresholds (LCP ≤2.5s, CLS ≤0.1, TBT ≤200ms). LCP is
the `h1` on most pages, which means text rendering — not images — is the
critical path.

### Lighthouse

`npm run lighthouse` drives a Chromium already on the machine (no 150MB browser
download) with **mobile emulation, 4× CPU throttling and slow 4G** — the profile
PageSpeed actually scores you on. Desktop numbers are flattering and mostly
meaningless; use `LH_DESKTOP=1` if you want them anyway.

| | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| **Average** | **82** | **100** | **100** | **100** |

Four opportunities were found and fixed:

- **Minify JavaScript** — `build.py` now concatenates `data.js` + `templates.js`
  + `site.js` in dependency order and minifies with terser: **30 kB → 15 kB**,
  three requests down to one, loaded with `defer`. Sources stay separate and
  readable; only the bundle ships.
- **Serve images in next-gen formats** — the portrait is emitted as
  `<picture>` with a WebP source and JPEG fallback: **31 kB → 13 kB**.
- **Eliminate render-blocking resources** — the Google Fonts stylesheet was a
  third-party round trip in front of first paint. Now `preload` + `media="print"
  onload` with a `<noscript>` fallback.

  This one was applied by hand the first time, to the five pages that existed
  then — and the article written afterwards silently missed it, costing that
  page **1,318ms of render-blocking time**. `bundle.async_fonts()` now rewrites
  every page on every build and `validate.py` fails if a blocking font link
  reappears. The lesson generalises: anything applied per-page by hand will
  drift the moment a page is added.
- **Enable text compression** — `serve.py` gzips text responses, because every
  real static host does and otherwise the local score reports a ~700ms
  opportunity that will not exist in production. **28 kB → 5.9 kB** for the
  homepage.

A fifth fix came out of the profile rather than the opportunity list. The
main-thread breakdown showed **styleLayout at 1,914ms** against scriptEvaluation
at 114ms — the cost was CSS, not JavaScript. Each poster had two
`filter: blur(38px)` divs, so the homepage was compositing **18 blurred layers**.
Replacing them with two `radial-gradient` backgrounds paints the same look in
the poster's own layer. TBT went to **0ms on every page**.

**On trusting these numbers:** Lighthouse is noisy. Total Blocking Time for the
homepage measured 41ms, 170ms and 1,210ms across three runs on the same build,
purely from what else the machine was doing. The harness now launches a fresh
Chrome per page, and `LH_RUNS=3` reports the **median**, which is what the
Lighthouse team recommends for any number you intend to quote. A single run is
indicative, never a measurement.

**Render-blocking CSS — measured, then fixed.** The last opportunity was our own
`style.css`. Since essentially all of it is needed above the fold, there was no
meaningful critical subset to split out, so `build.py` minifies it (40 kB → 31 kB)
and inlines it into every page between `<!-- CSS:start -->` markers, dropping the
`<link>` entirely. Speed Index improved on four of five pages (~1s each). Set
`INLINE_CSS = False` in `build.py` to revert.

That change surfaced a regression worth recording: with CSS no longer blocking,
first paint arrived early enough that the webfont swap became a visible layout
shift — CLS on the library page went to **0.121**, past the 0.1 threshold.
Fixed with metric-matched `@font-face` fallbacks (`size-adjust`,
`ascent-override`) that make the local fallback occupy the same space as the
webfont. The filter chips were also injected by JS after paint, so they are now
prerendered too. CLS is back to **0.001–0.05** on every page.

Final median-of-3 on an idle machine: **performance 88, accessibility 100,
best practices 100, SEO 100.**


---

## Analytics and webmaster tools

All three are wired and all three are **off** until you paste an ID. Nothing
half-configured: with no ID there is no script, no cookie and no banner.

```python
# build.py
GA4_MEASUREMENT_ID       = ""   # "G-XXXXXXXXXX"
GOOGLE_SITE_VERIFICATION = ""   # the content="..." value only
BING_SITE_VERIFICATION   = ""   # the content="..." value only
```

Or as environment variables, which is what your host should use:
`TEARDOWN_GA4_ID`, `TEARDOWN_GSC_TOKEN`, `TEARDOWN_BING_TOKEN`.

### The order these have to happen in

Verification and analytics both need the site **live at a URL you control**, so
none of this can be finished before the site is deployed. And the site is
currently closed to search engines, which changes what each tool can do:

| Step | Needs | Works while indexing is blocked? |
|---|---|---|
| 1. Deploy to a real URL | a host and a domain | — |
| 2. Set `SITE_URL`, rebuild | the URL from step 1 | — |
| 3. Verify GSC and Bing | the site live | **yes**, verification is independent of indexing |
| 4. Add GA4 | the site live | **yes**, analytics does not involve crawlers |
| 5. Submit the sitemap | a verified property | **pointless until you open indexing** |

Verifying early is worth doing: the property starts collecting data from the
day it exists, so you are not blind on launch day. Submitting a sitemap for
pages you are blocking is not.

### GA4

Create a property, take the `G-` ID, paste it in, rebuild. What you get is not
the default copy-pasted snippet:

- **Consent Mode v2, denied by default.** GA4 sets cookies, which in the EU and
  UK needs consent *before* it happens. Consent defaults to denied and the
  banner grants it. Declining is a real decline, verified by a test that
  asserts no `_ga` cookie exists afterwards.
- **No hits from localhost.** Development traffic in a production property
  cannot be removed later.
- **Do Not Track is honoured.**

Three Playwright tests cover this and skip themselves when GA4 is off.

### Search Console

Property type matters. **Domain** properties (verified by a DNS TXT record)
cover every subdomain and both protocols and are the better choice if you own
the DNS. **URL-prefix** properties can use the meta tag this build injects.

If you end up on GitHub Pages at a `github.io` subpath, note that you can only
verify the part of the domain you control, and `robots.txt` there belongs to
the domain root rather than your project.

### Bing

Bing Webmaster Tools can **import your Search Console property** once GSC is
verified, which is faster than verifying separately. The `msvalidate.01` meta
tag is there if you would rather verify directly.

## Your photo

`assets/img/saad.jpg` — 512x512, 32 KB, downloaded from your LinkedIn profile and
re-encoded (the CDN served a 675 KB PNG; that's a lot of bytes for something that
renders at 22px). It shows up in card bylines, article headers, both author
boxes, and the About page masthead.

The path is written in exactly one place, `AUTHOR` in `assets/js/data.js`:

```js
const AUTHOR = {
  name: 'EL Haddad Saad',
  initials: 'ES',
  photo: 'assets/img/saad.jpg'
};
```

Swap the file (keep the name) or edit that line to change it everywhere at once.
If the file is ever missing the `<img>` removes itself and the **ES** monogram
underneath shows through, so a broken path never renders a broken-image icon.

Note the LinkedIn URL you sent is a signed, expiring link — the local copy is the
one the site uses, so it won't rot.

## Renaming it

"Teardown" appears in the page titles, the header brand, and the footer.
A find-and-replace across the HTML files gets you 100% of the way. Your name is
already in the footers, the `<meta name="author">` tags, and `AUTHOR` above.
