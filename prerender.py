"""
TEARDOWN — prerenderer. Imported by build.py.

Bakes the card grids into the HTML so a crawler that does not execute
JavaScript still sees every card, headline, link and date. This is the single
biggest organic-search win in the build: without it, the homepage and library
are empty <div>s to Googlebot and to every AI crawler.

The markup comes from assets/js/templates.js executed in Node, so the
prerendered HTML and the browser-rendered HTML cannot drift apart.
"""

import re

def close_of(html, open_end, tag):
    """Index span of the closing tag matching the one that ends at open_end.

    A depth counter, not a regex. Prerendered cards contain nested elements, so
    a non-greedy `.*?</tag>` stops at the first inner close — which meant the
    second build appended a duplicate copy of every card instead of replacing
    them. Counting depth makes the build idempotent.
    """
    tag_re = re.compile(r"<(/?)" + re.escape(tag) + r"\b[^>]*>", re.I)
    depth = 1
    for m in tag_re.finditer(html, open_end):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return m.start(), m.end()
    raise ValueError("unclosed <%s> in document" % tag)


def fill(html, marker, build_inner):
    """Replace the inner HTML of every element carrying `marker`.

    Tag-agnostic on purpose: the containers are a mix of <div> (card grids)
    and <ul> (footer link lists), and a div-only version silently skipped the
    lists — the footer kept its stale hand-written links and nothing failed.
    """
    pat = re.compile(r"<(div|ul|ol|nav|section)\b[^>]*\b" + marker + r"\b[^>]*>", re.I)
    out, i = [], 0
    while True:
        m = pat.search(html, i)
        if not m:
            out.append(html[i:])
            return "".join(out)

        c_start, c_end = close_of(html, m.end(), m.group(1))
        tag = m.group(0)
        inner = build_inner(tag)

        if inner is None:
            out.append(html[i:c_end])
        else:
            if "data-prerendered" not in tag:
                tag = tag[:-1] + " data-prerendered>"
            out.append(html[i:m.start()])
            out.append(tag + "\n" + inner + "\n")
            out.append(html[c_start:c_end])
        i = c_end


def run(td, root, render, by_date):
    posts, cats = td["POSTS"], td["CATEGORIES"]
    ordered = by_date(posts)
    touched = []

    for path in list(root.glob("*.html")) + list(root.glob("posts/*.html")):
        html = original = path.read_text(encoding="utf-8")
        base = "../" if path.parent.name == "posts" else ""

        def grid_inner(tag):
            attrs = dict(re.findall(r'data-([\w-]+)="([^"]*)"', tag))
            flags = re.findall(r'data-([\w-]+)(?=[\s>])', tag)
            sel = ordered
            if attrs.get("type"):
                sel = [p for p in sel if p["type"] == attrs["type"]]
            if attrs.get("exclude"):
                sel = [p for p in sel if p["slug"] != attrs["exclude"]]
            if "skip-featured" in flags:
                sel = [p for p in sel if not p.get("featured")]
            if attrs.get("limit"):
                sel = sel[: int(attrs["limit"])]
            return "".join(render("cardHTML", p, cats, base) for p in sel)

        def feature_inner(tag):
            # Published only. A draft must never reach the hero slot, however
            # it is flagged - that is how an unreviewed post ends up as the
            # most prominent thing on the site.
            live = [p for p in ordered if not p.get("draft")]
            if not live:
                return ""
            feat = next((p for p in live if p.get("featured")), live[0])
            return render("featureHTML", feat, cats, base)

        def chips_inner(tag):
            return render("chipsHTML", ordered, cats)

        def type_chips_inner(tag):
            return render("typeChipsHTML", ordered)

        def popular_inner(tag):
            return render("linkListHTML", ordered, 3, base)

        html = fill(html, "data-grid", grid_inner)
        html = fill(html, "data-feature", feature_inner)
        html = fill(html, "data-filters", chips_inner)
        html = fill(html, "data-type-filters", type_chips_inner)
        html = fill(html, "data-popular", popular_inner)

        if html != original:
            path.write_text(html, encoding="utf-8")
            touched.append(path.name)

    return touched
