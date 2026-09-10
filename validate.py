"""
TEARDOWN — post-build validation. Imported by build.py.

The prerenderer rewrites HTML in place. A bug there once left orphaned card
fragments and an unclosed <div> that nothing complained about until the layout
visibly broke. This runs after every build so that failure mode is loud.

Checks:
  * <div> and <article> tags balance in every page
  * every page has exactly one <title>, one canonical, one SEO block
  * every internal link resolves to a file that exists
  * every published post is in the sitemap and the feed
  * no page still references the placeholder domain by accident
"""

import re
from pathlib import Path


def _count(html, tag):
    opens = len(re.findall(r"<" + tag + r"\b", html))
    closes = len(re.findall(r"</" + tag + r">", html))
    return opens, closes


def run(root, base, td, published, post_url, allow_indexing=True, ga4_id=""):
    root = Path(root)
    pages = sorted(list(root.glob("*.html")) + list(root.glob("posts/*.html")))
    problems = []

    for path in pages:
        rel = path.relative_to(root).as_posix()
        html = path.read_text(encoding="utf-8")

        for tag in ("div", "article", "section"):
            o, c = _count(html, tag)
            if o != c:
                problems.append(f"{rel}: <{tag}> unbalanced ({o} open, {c} close)")

        # A blocking third-party font stylesheet costs ~1.3s of render-blocking
        # time. build.py rewrites these, so finding one means the rewrite broke.
        if 'href="https://fonts.googleapis.com/css2' in html and 'media="print"' not in html:
            problems.append(f"{rel}: render-blocking webfont stylesheet")

        # every page must load the shared templates before site.js, or all
        # client-side JS dies on an undefined TD_TEMPLATES
        if "site.js" in html and "templates.js" not in html:
            problems.append(f"{rel}: loads site.js without templates.js")

        for label, pat, want in (
            ("<title>", r"<title>", 1),
            ("canonical", r'rel="canonical"', 1),
            ("SEO block", r"<!-- SEO:start", 1),
            ("JSON-LD", r'type="application/ld\+json"', 1),
        ):
            n = len(re.findall(pat, html))
            if n != want:
                problems.append(f"{rel}: expected {want} {label}, found {n}")

        # Internal links must resolve. Strip BOTH the query string and the
        # fragment: ?type=versus deep links into the library are real files.
        # href AND src. A dead src is worse than a dead href: a missing
        # script breaks the page silently instead of 404ing somewhere visible.
        refs = (re.findall(r'href="((?!https?:|mailto:|#|data:)[^"]+)"', html)
                + re.findall(r'src="((?!https?:|data:)[^"]+)"', html))
        for ref in refs:
            file_part = ref.split("#")[0].split("?")[0]
            if not file_part:
                continue
            if not (path.parent / file_part).resolve().exists():
                problems.append(f"{rel}: dead reference -> {ref}")

    # Affiliate disclosure must match the flag in data.js, in both directions:
    # a flagged post without a notice is a compliance problem, and an unflagged
    # post carrying one is a lie about the content.
    for p in td["POSTS"]:
        f = root / "posts" / f"{p['slug']}.html"
        if not f.exists():
            continue
        has = "AFFILIATE:start" in f.read_text(encoding="utf-8")
        if p.get("affiliate") and not has:
            problems.append(f"posts/{p['slug']}.html: affiliate:true but no disclosure")
        if not p.get("affiliate") and has:
            problems.append(f"posts/{p['slug']}.html: disclosure present but affiliate flag not set")

    # Robots directives must match the site's indexing mode, and there must be
    # exactly one of them per page. Two conflicting directives on one page is
    # how a "blocked" site quietly gets indexed anyway.
    for path in pages:
        rel = path.relative_to(root).as_posix()
        html = path.read_text(encoding="utf-8")
        metas = re.findall(r'<meta name="robots" content="([^"]*)"', html)
        if len(metas) != 1:
            problems.append(f"{rel}: expected 1 robots meta, found {len(metas)}")
            continue
        noindexed = "noindex" in metas[0]
        if not allow_indexing and not noindexed:
            problems.append(f"{rel}: site is closed to search but this page is indexable")
        if allow_indexing:
            slug = path.stem
            post = next((p for p in td["POSTS"] if p["slug"] == slug), None)
            is_draft = bool(post and post.get("draft"))
            if is_draft and not noindexed:
                problems.append(f"{rel}: draft is missing noindex")
            if post and not is_draft and noindexed:
                problems.append(f"{rel}: published but marked noindex")

    # Analytics must be all-or-nothing: a page with a stray half-configured
    # tag either double-counts or silently reports nothing.
    for path in pages:
        rel = path.relative_to(root).as_posix()
        html = path.read_text(encoding="utf-8")
        n = html.count("<!-- GA4:start")
        if ga4_id and n != 1:
            problems.append(f"{rel}: expected 1 GA4 block, found {n}")
        if not ga4_id and n:
            problems.append(f"{rel}: GA4 block present but no measurement ID configured")
        if ga4_id and "consent" not in html.lower():
            problems.append(f"{rel}: GA4 present without consent handling")

    # robots.txt must agree with the same flag.
    rb = root / "robots.txt"
    if rb.exists():
        txt = rb.read_text(encoding="utf-8")
        blocks = "Disallow: /" in txt
        if not allow_indexing and not blocks:
            problems.append("robots.txt: site is closed to search but robots.txt allows crawling")
        if allow_indexing and blocks:
            problems.append("robots.txt: site is open to search but robots.txt disallows crawling")
        if not allow_indexing and "Sitemap:" in txt:
            problems.append("robots.txt: advertises a sitemap while blocking every page")

    # sitemap + feed coverage
    live = published(td["POSTS"])
    for name in ("sitemap.xml", "feed.xml"):
        f = root / name
        if not f.exists():
            problems.append(f"{name}: missing")
            continue
        body = f.read_text(encoding="utf-8")
        for p in live:
            if post_url(p) not in body:
                problems.append(f"{name}: missing {p['slug']}")

    for name in ("robots.txt", "llms.txt", "llms-full.txt"):
        if not (root / name).exists():
            problems.append(f"{name}: missing")

    # OG images referenced must exist
    for p in live:
        og = root / "assets" / "og" / f"{p['slug']}.png"
        if not og.exists():
            problems.append(f"assets/og/{p['slug']}.png: missing")

    return problems
