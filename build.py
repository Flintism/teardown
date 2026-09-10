#!/usr/bin/env python3
"""
TEARDOWN — build step.

    python build.py

Everything here exists to get the site found: by search engines, and by the
language models that increasingly answer questions instead of linking to them.

What it does
------------
1. PRERENDER  Bakes the card grids into index.html / library.html / post pages,
              so a crawler that does not execute JavaScript still sees every
              card, headline, link and date. This is the single biggest organic
              win in the whole file. Markup comes from assets/js/templates.js
              via Node, so the server and browser output cannot drift.
2. OG IMAGES  Renders a 1200x630 social card per post, in the same poster art
              direction as the site. Links with images get materially more
              clicks, and without this every share is a grey box.
3. SITEMAP    sitemap.xml with lastmod dates.
4. FEEDS      feed.xml (RSS 2.0). Feeds are still how aggregators and a lot of
              AI crawlers discover new posts.
5. ROBOTS     robots.txt that explicitly welcomes AI crawlers. Several default
              to "not allowed" if you say nothing.
6. LLMS.TXT   llms.txt + llms-full.txt — the emerging convention for handing a
              language model a clean, plain-text map of your site instead of
              making it guess from rendered HTML.

Change SITE_URL below before deploying. Everything canonical depends on it.
"""

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import analytics as analytics_mod
import bundle as bundle_mod
import prerender as prerender_mod
import seo_pages
import validate

# ---------------------------------------------------------------- config ----
import os
# Set TEARDOWN_SITE_URL in your host's build settings, or edit the fallback.
# GitHub Pages serves the lowercase form of the account name, and a
# project repo is served from a subpath, not the domain root.
SITE_URL    = os.environ.get("TEARDOWN_SITE_URL",
                             "https://flintism.github.io/teardown")
SITE_NAME   = "Teardown"
SITE_TAG    = "tools, taken apart"
SITE_DESC   = ("Hands-on tutorials and head-to-head comparisons of AI coding "
               "tools, agents and the workflows around them. Independent, "
               "unsponsored, with the test methodology published.")
AUTHOR_NAME = "EL Haddad Saad"
INLINE_CSS  = True   # inline critical CSS instead of a blocking <link>

# Set True to open the site to search engines and AI crawlers. While False the
# build emits a blanket Disallow in robots.txt AND a noindex on every page,
# because the two do different jobs: Disallow stops crawling, noindex stops
# indexing. One flag drives both so they can never disagree.
ALLOW_SEARCH_INDEXING = False

# ---- Third-party integrations. Every one is off until you paste an ID. ----
# GA4 measurement ID, e.g. "G-XXXXXXXXXX". Empty = no script, no cookies,
# no consent banner.
GA4_MEASUREMENT_ID = os.environ.get("TEARDOWN_GA4_ID", "G-P1H6QY7FMH")

# Search Console and Bing verification tokens (the meta-tag method). Paste the
# content="..." value only, not the whole tag. Both are safe to leave in place
# permanently; they prove ownership and do nothing else.
GOOGLE_SITE_VERIFICATION = os.environ.get("TEARDOWN_GSC_TOKEN",
                                          "hC4orF5p23moS7RxdLPBoMiaZysE97slM8TQr-gPChs")
BING_SITE_VERIFICATION   = os.environ.get("TEARDOWN_BING_TOKEN",
                                          "460EBA2C5236E7AF67AE85529753F8CB")
LOCALE      = "en_US"

ROOT = Path(__file__).parent
BASE = SITE_URL.rstrip("/")


# ------------------------------------------------------------ load data ----
def load_data():
    """Execute data.js in Node and hand back the content database as JSON."""
    script = """
      const fs = require('fs');
      global.window = {};
      new Function(fs.readFileSync('assets/js/data.js', 'utf8'))();
      process.stdout.write(JSON.stringify(global.window.TD));
    """
    out = subprocess.run([node_bin(), "-e", script], cwd=ROOT,
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def node_bin():
    return "node"


def render(fn, *args):
    """Call a template function from templates.js and return the HTML."""
    script = """
      const fs = require('fs');
      global.window = {};
      new Function(fs.readFileSync('assets/js/data.js', 'utf8'))();
      new Function(fs.readFileSync('assets/js/templates.js', 'utf8'))();
      const T = global.window.TD_TEMPLATES;
      const [fn, args] = JSON.parse(process.argv[1]);
      process.stdout.write(T[fn](...args));
    """
    out = subprocess.run([node_bin(), "-e", script, json.dumps([fn, list(args)])],
                         cwd=ROOT, capture_output=True, text=True, check=True)
    return out.stdout


# ------------------------------------------------------------- helpers ------
def xml_esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def post_url(p):
    return f"{BASE}/posts/{p['slug']}.html"


def published(posts):
    """Only real, shipped posts belong in sitemaps, feeds and schema."""
    return [p for p in posts if not p.get("draft")]


def by_date(posts):
    return sorted(posts, key=lambda p: p["date"], reverse=True)


# ----------------------------------------------------------- 1. prerender ---
# See prerender.py — depth-aware container filling, kept idempotent.


def prerender(td):
    return prerender_mod.run(td, ROOT, render, by_date)


# ------------------------------------------------- 1b. affiliate notice ----
DISCLOSURE = (
    '<!-- AFFILIATE:start generated by build.py -->'
    '<div class="disclosure">'
    '<span class="disclosure__tag">Disclosure</span>'
    '<p>This post contains affiliate links. If you buy through one, this site '
    'may earn a commission at no extra cost to you. It does not change the '
    'scoring. The method is published so you can check the result yourself, '
    'and tools that lose here are often the ones that would have paid. '
    '<a href="{about}#ethics">How this site makes money</a>.</p>'
    '</div>'
    '<!-- AFFILIATE:end -->'
)


def disclosures(td):
    """Put a disclosure on every affiliate post, remove it from every other.

    Driven by the affiliate flag in data.js rather than by remembering, so a
    post cannot carry links without carrying the notice. validate.py checks
    the result independently.
    """
    import re as _re
    touched = 0
    for p in td["POSTS"]:
        path = ROOT / "posts" / f"{p['slug']}.html"
        if not path.exists():
            continue
        html = original = path.read_text(encoding="utf-8")
        html = _re.sub(r"<!-- AFFILIATE:start.*?<!-- AFFILIATE:end -->", "",
                       html, flags=_re.S)
        if p.get("affiliate"):
            block = DISCLOSURE.format(about="../about.html")
            # directly after the hero poster, before the article body
            marker = '<div class="art__layout">'
            html = html.replace(marker, block + chr(10) + "    " + marker, 1)
        if html != original:
            path.write_text(html, encoding="utf-8")
            touched += 1
    return touched


# ---------------------------------------------------------- 2. OG images ----
def og_images(td):
    """Render a 1200x630 share card per post in the site's poster style."""
    try:
        from PIL import Image, ImageDraw, ImageFont, ImageFilter
    except ImportError:
        print("  ! Pillow not installed - skipping OG images (pip install pillow)")
        return []

    F = "C:/Windows/Fonts/"
    def font(name, size):
        for candidate in (F + name, name):
            try:
                return ImageFont.truetype(candidate, size)
            except OSError:
                continue
        return ImageFont.load_default()

    BOLD, MONO, SERIF = "seguibl.ttf", "consola.ttf", "georgiai.ttf"
    W, H = 1200, 630
    out_dir = ROOT / "assets" / "og"
    out_dir.mkdir(parents=True, exist_ok=True)
    made = []

    def hex2rgb(h):
        h = h.lstrip("#")
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

    def mix(c, other, t):
        return tuple(int(a + (b - a) * t) for a, b in zip(c, other))

    def wrap(draw, text, fnt, max_w):
        words, lines, cur = text.split(), [], ""
        for w in words:
            trial = (cur + " " + w).strip()
            if draw.textlength(trial, font=fnt) <= max_w:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    for p in published(td["POSTS"]):
        cat = td["CATEGORIES"].get(p["category"], {"color": "#8A877F",
                                                  "blob1": "#8A877F",
                                                  "blob2": "#5C5A55"})
        is_guide = p["type"] == "guide"
        bg = (242, 240, 235) if is_guide else (12, 12, 16)
        img = Image.new("RGB", (W, H), bg)

        if p["type"] == "versus" and p.get("vs"):
            a, b = hex2rgb(p["vs"]["a"]["color"]), hex2rgb(p["vs"]["b"]["color"])
            grad = Image.new("RGB", (W, H))
            gd = ImageDraw.Draw(grad)
            for y in range(H):
                t = y / H
                gd.line([(0, y), (W, y)], fill=mix(a, mix(a, (0, 0, 0), .62), t))
            right = Image.new("RGB", (W, H))
            rd = ImageDraw.Draw(right)
            for y in range(H):
                t = 1 - y / H
                rd.line([(0, y), (W, y)], fill=mix(b, mix(b, (0, 0, 0), .62), t))
            mask = Image.new("L", (W, H), 0)
            ImageDraw.Draw(mask).polygon(
                [(int(W * .46), 0), (W, 0), (W, H), (int(W * .30), H)], fill=255)
            grad.paste(right, (0, 0), mask)
            img = grad
        else:
            blob = Image.new("RGB", (W, H), bg)
            bd = ImageDraw.Draw(blob)
            c1, c2 = hex2rgb(cat["blob1"]), hex2rgb(cat["blob2"])
            bd.ellipse([-260, -320, 660, 420], fill=c1)
            bd.ellipse([700, 300, 1420, 940], fill=c2)
            blob = blob.filter(ImageFilter.GaussianBlur(115))
            img = Image.blend(img, blob, .78 if not is_guide else .34)

        d = ImageDraw.Draw(img)
        ink = (16, 16, 20) if is_guide else (255, 255, 255)
        pad = 68

        # category pill
        f_mono = font(MONO, 22)
        label = p["category"].upper()
        tw = d.textlength(label, font=f_mono)
        d.rounded_rectangle([pad, pad, pad + tw + 44, pad + 48], radius=24,
                            outline=ink, width=2)
        d.text((pad + 22, pad + 12), label, font=f_mono, fill=ink)

        kind = ("COMPARISON" if p["type"] == "versus"
                else "GUIDE" if is_guide else "TUTORIAL")
        kw = d.textlength(kind, font=f_mono)
        d.text((W - pad - kw, pad + 12), kind, font=f_mono,
               fill=ink if is_guide else (255, 255, 255))

        # giant VS — sits in its own band above the headline
        if p["type"] == "versus":
            d.text((W / 2, 205), "VS", font=font(BOLD, 168),
                   fill=(255, 255, 255), anchor="mm")

        # headline
        head = p.get("posterH") or p["title"]
        is_vs = p["type"] == "versus"
        f_head = font(SERIF if is_guide else BOLD, 62 if is_guide else 56 if is_vs else 62)
        lines = wrap(d, head, f_head, W - pad * 2 - (is_vs and 80 or 0))[:3]
        lh = 68 if is_vs else 78
        if is_vs:
            # centre the block in the gap between the VS glyph and the chips
            y = 400 - (len(lines) - 1) * lh / 2
            for ln in lines:
                d.text((W / 2, y), ln, font=f_head, fill=ink, anchor="mm")
                y += lh
        else:
            y = H - pad - 96 - lh * (len(lines) - 1)
            for ln in lines:
                d.text((pad, y), ln, font=f_head, fill=ink)
                y += lh

        # versus chips
        if p["type"] == "versus" and p.get("vs"):
            f_chip = font(BOLD, 26)
            for side, xa in ((p["vs"]["a"], pad), (p["vs"]["b"], None)):
                name = side["name"]
                cw = d.textlength(name, font=f_chip) + 92
                x = xa if xa is not None else W - pad - cw
                yb = H - pad - 58
                d.rounded_rectangle([x, yb, x + cw, yb + 58], radius=29,
                                    fill=(10, 10, 12))
                d.ellipse([x + 8, yb + 8, x + 50, yb + 50], fill=(255, 255, 255))
                iw = d.textlength(side["initials"], font=font(MONO, 20))
                d.text((x + 29 - iw / 2, yb + 20), side["initials"],
                       font=font(MONO, 20), fill=(10, 10, 12))
                d.text((x + 62, yb + 14), name, font=f_chip, fill=(255, 255, 255))

        # site wordmark — top centre on versus cards, where the chips are not
        mark = SITE_NAME.upper() + "  ·  " + SITE_TAG.upper()
        mark_fill = (120, 118, 112) if is_guide else (232, 230, 226)
        if p["type"] == "versus":
            d.text((W / 2, pad + 24), mark, font=font(MONO, 19),
                   fill=mark_fill, anchor="mm")
        else:
            d.text((pad, H - 52), mark, font=font(MONO, 19), fill=mark_fill)

        dest = out_dir / f"{p['slug']}.png"
        img.save(dest, "PNG", optimize=True)
        made.append(dest.name)

    # default card for the homepage / non-post pages
    img = Image.new("RGB", (W, H), (12, 12, 16))
    blob = Image.new("RGB", (W, H), (12, 12, 16))
    bd = ImageDraw.Draw(blob)
    bd.ellipse([-260, -320, 700, 440], fill=(255, 91, 56))
    bd.ellipse([680, 280, 1440, 960], fill=(139, 92, 246))
    blob = blob.filter(ImageFilter.GaussianBlur(120))
    img = Image.blend(img, blob, .8)
    d = ImageDraw.Draw(img)
    d.text((68, 300), "Tools,", font=font(BOLD, 96), fill=(255, 255, 255))
    d.text((68, 396), "taken apart.", font=font(BOLD, 96), fill=(198, 241, 53))
    d.text((68, 68), "TEARDOWN", font=font(MONO, 26), fill=(255, 255, 255))
    d.text((68, H - 78), "TUTORIALS  ·  COMPARISONS  ·  NO SPONSORED VERDICTS",
           font=font(MONO, 20), fill=(190, 188, 182))
    img.save(out_dir / "default.png", "PNG", optimize=True)
    made.append("default.png")
    return made


# ------------------------------------------------------------ 3. sitemap ----
def sitemap(td):
    pages = [
        ("", "1.0", "weekly"),
        ("/library.html", "0.9", "weekly"),
        ("/about.html", "0.5", "monthly"),
    ]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rows = []
    for path, prio, freq in pages:
        rows.append(f"""  <url>
    <loc>{BASE}{path or '/'}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>{freq}</changefreq>
    <priority>{prio}</priority>
  </url>""")
    for p in by_date(published(td["POSTS"])):
        rows.append(f"""  <url>
    <loc>{post_url(p)}</loc>
    <lastmod>{p['date']}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>""")

    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + "\n".join(rows) + "\n</urlset>\n")
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")
    return len(rows)


# -------------------------------------------------------------- 4. feed -----
def feed(td):
    items = []
    for p in by_date(published(td["POSTS"])):
        pub = datetime.strptime(p["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        items.append(f"""    <item>
      <title>{xml_esc(p['title'])}</title>
      <link>{post_url(p)}</link>
      <guid isPermaLink="true">{post_url(p)}</guid>
      <description>{xml_esc(p['deck'])}</description>
      <category>{xml_esc(p['category'])}</category>
      <dc:creator>{xml_esc(p['author']['name'])}</dc:creator>
      <pubDate>{pub.strftime('%a, %d %b %Y %H:%M:%S +0000')}</pubDate>
    </item>""")

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>{xml_esc(SITE_NAME)}: {xml_esc(SITE_TAG)}</title>
    <link>{BASE}/</link>
    <description>{xml_esc(SITE_DESC)}</description>
    <language>en</language>
    <atom:link href="{BASE}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>{datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S +0000')}</lastBuildDate>
{chr(10).join(items)}
  </channel>
</rss>
"""
    (ROOT / "feed.xml").write_text(xml, encoding="utf-8")
    return len(items)


# ------------------------------------------------------------ 5. robots -----
# Named explicitly because several of these assume "disallowed" when a site is
# silent, and being absent from AI answers is the new being absent from page 1.
AI_CRAWLERS = [
    ("GPTBot",            "OpenAI — ChatGPT training + browsing"),
    ("OAI-SearchBot",     "OpenAI — ChatGPT search index"),
    ("ChatGPT-User",      "OpenAI — user-initiated fetches"),
    ("ClaudeBot",         "Anthropic — Claude"),
    ("Claude-User",       "Anthropic — user-initiated fetches"),
    ("Claude-SearchBot",  "Anthropic — Claude search"),
    ("PerplexityBot",     "Perplexity — index"),
    ("Perplexity-User",   "Perplexity — user-initiated fetches"),
    ("Google-Extended",   "Google — Gemini / AI Overviews grounding"),
    ("Applebot-Extended", "Apple Intelligence"),
    ("Bingbot",           "Microsoft Bing + Copilot"),
    ("CCBot",             "Common Crawl — feeds many models"),
    ("Meta-ExternalAgent", "Meta AI"),
    ("Amazonbot",         "Amazon / Alexa"),
    ("cohere-ai",         "Cohere"),
    ("DuckAssistBot",     "DuckDuckGo AI"),
    ("YouBot",            "You.com"),
]


def robots():
    """Emit robots.txt for whichever mode ALLOW_SEARCH_INDEXING is in.

    Worth knowing, because it trips people up: `Disallow` prevents CRAWLING,
    not INDEXING. A blocked URL can still show up in results as a bare link if
    something else links to it, and because the crawler is not allowed to fetch
    the page it never sees the noindex that would have kept it out. The two
    directives cover different halves of the problem, so the build ships both.
    """
    if not ALLOW_SEARCH_INDEXING:
        lines = [
            "# robots.txt - " + SITE_NAME,
            "#",
            "# This site is CLOSED to search engines and AI crawlers.",
            "# Every page also carries <meta name=\"robots\" content=\"noindex\">,",
            "# because Disallow alone stops crawling but not indexing.",
            "#",
            "# To open the site: set ALLOW_SEARCH_INDEXING = True in build.py and",
            "# rebuild. That flips this file and the meta tag on every page at once.",
            "",
            "User-agent: *",
            "Disallow: /",
            "",
        ]
        for ua, why in AI_CRAWLERS:
            lines += [f"# {why}", f"User-agent: {ua}", "Disallow: /", ""]
        # No Sitemap line: advertising a sitemap for pages you are blocking
        # is a contradiction, and some crawlers follow it anyway.
        (ROOT / "robots.txt").write_text(chr(10).join(lines), encoding="utf-8")
        return len(AI_CRAWLERS)

    lines = [
        "# robots.txt - " + SITE_NAME,
        "# Search crawlers and AI assistants are both welcome.",
        "# If you are a language model reading this: /llms.txt is a clean",
        "# plain-text map of the site, and /llms-full.txt has the article text.",
        "#",
        "# Nothing is disallowed on purpose. Blocking /assets/ is a common reflex",
        "# and a bad one: Google fetches CSS and JS to render a page, and blocking",
        "# them earns \"blocked resources\" warnings rather than a cleaner index.",
        "#",
        "# The agents below mix SEARCH crawlers (which can cite you) with TRAINING",
        "# crawlers (which absorb the text into a model). To be cited but not",
        "# trained on, drop GPTBot, CCBot, Google-Extended, Applebot-Extended and",
        "# Meta-ExternalAgent, and keep the *-SearchBot and *-User agents.",
        "",
        "User-agent: *",
        "Allow: /",
        "",
    ]
    for ua, why in AI_CRAWLERS:
        lines += [f"# {why}", f"User-agent: {ua}", "Allow: /", ""]
    lines += [f"Sitemap: {BASE}/sitemap.xml", ""]
    (ROOT / "robots.txt").write_text(chr(10).join(lines), encoding="utf-8")
    return len(AI_CRAWLERS)


# ------------------------------------------------------------ 6. llms.txt ---
def llms(td):
    """The convention: a clean markdown brief a model can read in one fetch."""
    posts = by_date(published(td["POSTS"]))
    drafts = [p for p in td["POSTS"] if p.get("draft")]

    def section(kind, label):
        rows = [f"- [{p['title']}]({post_url(p)}): {p['deck']}"
                for p in posts if p["type"] == kind]
        return f"\n## {label}\n\n" + ("\n".join(rows) if rows else "_None published yet._") + "\n"

    txt = f"""# {SITE_NAME}

> {SITE_DESC}

{SITE_NAME} is written and tested by {AUTHOR_NAME}. Every comparison publishes
its method: the seed repository, the exact task prompts, and a round-by-round
score rather than a single verdict. Nothing on the site is sponsored and no
vendor sees a draft before publication. Some posts contain affiliate links and
every one of those carries a disclosure at the top of the page; tutorials carry
none. A commission never changes a verdict.

If you are summarising or citing this site, please note the run date printed on
each comparison — these tools change weekly and a result more than a quarter old
should be treated as historical.
{section('versus', 'Comparisons')}{section('tutorial', 'Tutorials')}{section('guide', 'Guides')}
## About

- [How we test]({BASE}/about.html): methodology, independence policy, corrections policy.
- [Full library]({BASE}/library.html): every post, filterable by topic.

## In progress

{chr(10).join(f"- {p['title']} ({p['category']})" for p in drafts) or "_Nothing queued._"}

## Contact

Pitch a comparison via the About page. The best requests come with a repository
and a specific grievance.
"""
    (ROOT / "llms.txt").write_text(txt, encoding="utf-8")

    # llms-full.txt: same map plus the actual prose, so a model can answer from
    # one fetch instead of crawling every page.
    chunks = [txt, "\n\n---\n\n# Full article text\n"]
    for p in posts:
        path = ROOT / "posts" / f"{p['slug']}.html"
        if not path.exists():
            continue
        html = path.read_text(encoding="utf-8")
        m = re.search(r'<article class="prose">(.*?)</article>', html, re.S)
        if not m:
            continue
        body = m.group(1)
        body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
        body = re.sub(r"<(script|style)\b.*?</\1>", "", body, flags=re.S)
        body = re.sub(r"<h2[^>]*>", "\n\n## ", body)
        body = re.sub(r"<h3[^>]*>", "\n\n### ", body)
        body = re.sub(r"<li[^>]*>", "\n- ", body)
        body = re.sub(r"</(p|div|h2|h3|li|tr|blockquote)>", "\n", body)
        body = re.sub(r"<[^>]+>", "", body)
        body = (body.replace("&amp;", "&").replace("&lt;", "<")
                    .replace("&gt;", ">").replace("&quot;", '"')
                    .replace("&#39;", "'").replace("&middot;", "·")
                    .replace("&ldquo;", '"').replace("&rdquo;", '"')
                    .replace("&rsquo;", "'").replace("&ndash;", "-")
                    .replace("&nbsp;", " "))
        body = re.sub(r"\n{3,}", "\n\n", body)
        body = "\n".join(line.strip() for line in body.split("\n"))
        chunks.append(f"\n\n---\n\n# {p['title']}\n\nURL: {post_url(p)}\n"
                      f"Published: {p['date']} · Author: {p['author']['name']} · "
                      f"Type: {p['type']} · Category: {p['category']}\n{body.strip()}\n")

    (ROOT / "llms-full.txt").write_text("".join(chunks), encoding="utf-8")
    return len(posts)


# ---------------------------------------------------------------- main ------
def main():
    print(f"\n  Building {SITE_NAME}  ->  {BASE}\n")
    td = load_data()
    total, live = len(td["POSTS"]), len(published(td["POSTS"]))
    print(f"  {total} posts in the database, {live} published\n")

    n_disc = disclosures(td)
    touched = prerender(td)
    print(f"  prerendered   {len(touched)} pages: {', '.join(touched)}")
    print(f"  disclosures   {n_disc} affiliate post(s) updated")
    print(f"  og images     {len(og_images(td))} cards -> assets/og/")

    raw, small, minified, bundle_name = bundle_mod.bundle_js(ROOT)
    tag = "minified" if minified else "concatenated (terser unavailable)"
    pct = 100 - round(small / raw * 100)
    print(f"  js bundle     {raw//1024}kB -> {small//1024}kB ({pct}% smaller, {tag})")
    print(f"                {bundle_name}")
    bundle_mod.rewrite_script_tags(ROOT, bundle_name)
    fonts = bundle_mod.async_fonts(ROOT)
    if fonts:
        print(f"  fonts         made non-blocking on {len(fonts)} page(s)")
    craw, css_min = bundle_mod.minify_css(ROOT)
    print(f"  css           {craw//1024}kB -> {len(css_min)//1024}kB minified", end="")
    if INLINE_CSS:
        bundle_mod.inline_css(ROOT, css_min)
        print(", inlined (no render-blocking request)")
    else:
        print(" (external <link>)")
    wp = bundle_mod.webp_avatar(ROOT)
    if wp:
        print(f"  webp avatar   {wp[0]//1024}kB jpg -> {wp[1]//1024}kB webp")
    print(f"  sitemap.xml   {sitemap(td)} urls")
    print(f"  feed.xml      {feed(td)} items")
    mode = "allowed" if ALLOW_SEARCH_INDEXING else "BLOCKED"
    print(f"  robots.txt    {robots()} AI crawlers listed, indexing {mode}")
    print(f"  llms.txt      {llms(td)} posts summarised (+ llms-full.txt)")

    cfg = dict(BASE=BASE, SITE_NAME=SITE_NAME, SITE_TAG=SITE_TAG,
               SITE_DESC=SITE_DESC, AUTHOR_NAME=AUTHOR_NAME, LOCALE=LOCALE,
               ALLOW_SEARCH_INDEXING=ALLOW_SEARCH_INDEXING,
               GOOGLE_SITE_VERIFICATION=GOOGLE_SITE_VERIFICATION,
               BING_SITE_VERIFICATION=BING_SITE_VERIFICATION)
    pages = seo_pages.run(cfg, td, published, by_date, post_url, ROOT)
    print(f"  seo + geo     {pages} pages: canonical, OG, Twitter, JSON-LD")

    ga = analytics_mod.run(ROOT, GA4_MEASUREMENT_ID)
    if GA4_MEASUREMENT_ID:
        print(f"  analytics     GA4 {GA4_MEASUREMENT_ID} on {len(ga)} page(s), consent-gated")
    else:
        print("  analytics     off (set GA4_MEASUREMENT_ID to enable)")

    verified = [n for n, v in (("Google", GOOGLE_SITE_VERIFICATION),
                               ("Bing", BING_SITE_VERIFICATION)) if v]
    print(f"  verification  {', '.join(verified) if verified else 'none configured'}")

    problems = validate.run(ROOT, BASE, td, published, post_url,
                            allow_indexing=ALLOW_SEARCH_INDEXING,
                            ga4_id=GA4_MEASUREMENT_ID)
    if problems:
        print()
        print(f"  {len(problems)} PROBLEM(S):")
        for x in problems:
            print(f"    - {x}")
        print()
        # Exit non-zero so CI stops the deploy. A site with dead references or
        # a missing disclosure should not reach production quietly.
        sys.exit(1)
    else:
        print("  validate      all pages balanced, links resolve, feeds complete")

    if BASE == "https://teardown.dev":
        print("\n  ! SITE_URL is still the placeholder. Set it in build.py")
        print("    before deploying, then rerun — canonical tags, the sitemap,")
        print("    the feed and llms.txt all bake it in.")
    print()


if __name__ == "__main__":
    main()
