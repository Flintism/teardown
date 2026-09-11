"""Per-page SEO/GEO wiring. Imported by build.py."""

from pathlib import Path

from seo import Seo, inject


NOINDEX = ('<meta name="robots" content="noindex, nofollow">'
           '<!-- draft: not published, kept out of the index -->')


def mark_drafts(td, root):
    """Draft posts keep their file but must never be indexed.

    A draft is unfinished or, worse, still carries placeholder figures. It is
    not in the sitemap or the feed, but the URL is still reachable, so the page
    says noindex explicitly rather than relying on obscurity.
    """
    import re
    n = 0
    for p in td["POSTS"]:
        f = Path(root) / "posts" / f"{p['slug']}.html"
        if not f.exists():
            continue
        html = original = f.read_text(encoding="utf-8")
        html = html.replace(NOINDEX, "")
        if p.get("draft"):
            html = html.replace("</head>", NOINDEX + chr(10) + "</head>", 1)
        if html != original:
            f.write_text(html, encoding="utf-8")
            n += 1
    return n


def strip_draft_marks(td, root):
    """Remove the per-draft noindex stamp; the head block covers it."""
    for p in td["POSTS"]:
        f = Path(root) / "posts" / f"{p['slug']}.html"
        if f.exists():
            html = f.read_text(encoding="utf-8")
            if NOINDEX in html:
                f.write_text(html.replace(NOINDEX, ""), encoding="utf-8")


def run(cfg, td, published, by_date, post_url, root):
    # Drafts used to get a separate noindex stamp on top of a stale head
    # block, leaving two conflicting robots directives on one page. Now every
    # post gets a head block and drafts force noindex inside it.
    strip_draft_marks(td, root)
    allow = cfg.get("ALLOW_SEARCH_INDEXING", True)
    s = Seo(cfg["BASE"], cfg["SITE_NAME"], cfg["SITE_TAG"],
            cfg["SITE_DESC"], cfg["AUTHOR_NAME"], cfg["LOCALE"],
            allow_indexing=allow,
            google_verify=cfg.get('GOOGLE_SITE_VERIFICATION', ''),
            bing_verify=cfg.get('BING_SITE_VERIFICATION', ''),
            impact_verify=cfg.get('IMPACT_SITE_VERIFICATION', ''))
    base = s.base
    posts = by_date(published(td["POSTS"]))
    default_img = f"{base}/assets/og/default.png"
    root = Path(root)
    n = 0

    # ---------------------------------------------------------- homepage ----
    inject(root / "index.html", s.head(
        title=f"{cfg['SITE_NAME']}: {cfg['SITE_TAG']}",
        desc=cfg["SITE_DESC"],
        canonical=base + "/",
        image=default_img,
        graph=[{
            "@type": "CollectionPage",
            "@id": base + "/#webpage",
            "url": base + "/",
            "name": f"{cfg['SITE_NAME']}: {cfg['SITE_TAG']}",
            "description": cfg["SITE_DESC"],
            "isPartOf": {"@id": s.site_id},
            "about": {"@id": s.org_id},
            "mainEntity": s.item_list(posts, post_url),
        }]))
    n += 1

    # ----------------------------------------------------------- library ----
    inject(root / "library.html", s.head(
        title=f"Library: every tutorial and comparison | {cfg['SITE_NAME']}",
        desc=("Every Teardown tutorial, head-to-head comparison and guide, "
              "filterable by topic: AI coding tools, agents, and the "
              "workflows around them."),
        canonical=f"{base}/library.html",
        image=default_img,
        graph=[
            {
                "@type": "CollectionPage",
                "@id": f"{base}/library.html#webpage",
                "url": f"{base}/library.html",
                "name": "Library",
                "isPartOf": {"@id": s.site_id},
                "mainEntity": s.item_list(posts, post_url),
            },
            s.crumbs([("Home", base + "/"), ("Library", f"{base}/library.html")]),
        ]))
    n += 1

    # ------------------------------------------------------------- about ----
    inject(root / "about.html", s.head(
        title=f"How we test, and who pays for it | {cfg['SITE_NAME']}",
        desc=("Our testing methodology, independence policy and corrections "
              "policy. No sponsored posts, no affiliate links, and every "
              "comparison publishes its seed repo and task prompts."),
        canonical=f"{base}/about.html",
        image=default_img,
        kind="profile",
        graph=[
            {
                "@type": "AboutPage",
                "@id": f"{base}/about.html#webpage",
                "url": f"{base}/about.html",
                "name": "How we test",
                "isPartOf": {"@id": s.site_id},
                "mainEntity": {"@id": s.person_id},
            },
            s.crumbs([("Home", base + "/"), ("About", f"{base}/about.html")]),
        ]))
    n += 1

    # ------------------------------------------------------------- posts ----
    # Every post, drafts included: a draft still needs a canonical and a
    # robots directive, it just must never be indexed.
    for p in by_date(td["POSTS"]):
        path = root / "posts" / f"{p['slug']}.html"
        if not path.exists():
            continue
        html = path.read_text(encoding="utf-8")
        url = post_url(p)
        og = f"{base}/assets/og/{p['slug']}.png"

        graph = [s.article(p, html, url, og)]
        faqs = s.faqs_in(html)
        if faqs:
            graph.append(s.faq_page(url, faqs))
        graph.append(s.crumbs([
            ("Home", base + "/"),
            ("Library", f"{base}/library.html"),
            (p["title"], url),
        ]))

        inject(path, s.head(
            title=f"{p['title']} | {cfg['SITE_NAME']}",
            desc=p["deck"],
            canonical=url,
            image=og,
            kind="article",
            published=p["date"],
            force_noindex=bool(p.get("draft")),
            graph=graph))
        n += 1

    return n
