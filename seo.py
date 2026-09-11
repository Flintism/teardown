"""
TEARDOWN — SEO + GEO head injection.

Imported by build.py. Writes a generated block between

    <!-- SEO:start -->  ...  <!-- SEO:end -->

in every page's <head>, so changing SITE_URL and rebuilding updates every
canonical URL, social card and schema at once. None of it is hand-maintained
in the HTML.

Two audiences, one block:

  SEO  — canonical, robots directives, Open Graph and Twitter cards, sitemap
         and feed links. Gets the page indexed and makes the shared link look
         like something worth clicking.

  GEO  — the JSON-LD @graph. Generative engines use structured data to decide
         what a page *is*, who wrote it, what entities it discusses, and
         whether a claim is attributable to a named person with a stated
         methodology. That is the difference between being cited in an answer
         and being silently absorbed into one.

The FAQ and HowTo schemas are extracted from the rendered HTML rather than
retyped, so the structured data cannot drift from what the page actually says.
Lying to a crawler about your own content is the fastest way to lose the
rich result.
"""

import json
import re

# Entities the site writes about. Naming them explicitly, with canonical URLs,
# helps a model connect a page to the thing the user actually asked about.
ENTITIES = {
    "Claude Code": "https://claude.com/claude-code",
    "Codex": "https://openai.com/codex",
    "Cursor": "https://cursor.com",
    "Windsurf": "https://windsurf.com",
    "Model Context Protocol": "https://modelcontextprotocol.io",
    "Lovable": "https://lovable.dev",
    "Bolt.new": "https://bolt.new",
    "Replit": "https://replit.com",
    "v0": "https://v0.app",
    "Base44": "https://base44.com",
    "Bubble": "https://bubble.io",
    "Glide": "https://www.glideapps.com",
}


def strip_tags(frag):
    t = re.sub(r"<[^>]+>", " ", frag)
    for a, b in [("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'),
                 ("&#39;", "'"), ("&nbsp;", " "), ("&mdash;", "—"),
                 ("&ndash;", "–"), ("&middot;", "·"),
                 ("&ldquo;", "“"), ("&rdquo;", "”"),
                 ("&rsquo;", "’")]:
        t = t.replace(a, b)
    return re.sub(r"\s+", " ", t).strip()


def xml_esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


class Seo:
    def __init__(self, base, site_name, site_tag, site_desc, author, locale,
                 allow_indexing=True, google_verify='', bing_verify='',
                 impact_verify=''):
        self.base = base.rstrip("/")
        self.name = site_name
        self.tag = site_tag
        self.desc = site_desc
        self.author = author
        self.locale = locale
        self.allow_indexing = allow_indexing
        self.google_verify = google_verify
        self.bing_verify = bing_verify
        self.impact_verify = impact_verify
        self.person_id = f"{self.base}/about.html#person"
        self.org_id = f"{self.base}/#organization"
        self.site_id = f"{self.base}/#website"

    # ------------------------------------------------------------ entities --
    def person(self):
        return {
            "@type": "Person",
            "@id": self.person_id,
            "name": self.author,
            "url": f"{self.base}/about.html",
            "image": f"{self.base}/assets/img/saad.jpg",
            "jobTitle": "Software engineer and technical writer",
            "description": ("Builds with AI coding tools daily and publishes "
                            "the configs and comparison methodology behind "
                            "every post."),
            "knowsAbout": [
                "AI coding assistants", "Claude Code", "OpenAI Codex",
                "Model Context Protocol", "AI agents", "Developer tooling",
                "Software engineering workflows",
            ],
            "worksFor": {"@id": self.org_id},
        }

    def org(self):
        return {
            "@type": "Organization",
            "@id": self.org_id,
            "name": self.name,
            "url": self.base + "/",
            "description": self.desc,
            "logo": {"@type": "ImageObject",
                     "url": f"{self.base}/assets/og/default.png",
                     "width": 1200, "height": 630},
            "founder": {"@id": self.person_id},
            # E-E-A-T signals: these tell an engine the site has a stated,
            # checkable editorial standard rather than an opinion.
            "publishingPrinciples": f"{self.base}/about.html",
            "ethicsPolicy": f"{self.base}/about.html#ethics",
            "correctionsPolicy": f"{self.base}/about.html#corrections",
        }

    def website(self):
        return {
            "@type": "WebSite",
            "@id": self.site_id,
            "url": self.base + "/",
            "name": self.name,
            "alternateName": f"{self.name}: {self.tag}",
            "description": self.desc,
            "inLanguage": "en",
            "publisher": {"@id": self.org_id},
        }

    # ------------------------------------------- extracted from the page ----
    @staticmethod
    def faqs_in(html):
        out = []
        for m in re.finditer(
                r"<details[^>]*>\s*<summary>(.*?)</summary>(.*?)</details>",
                html, re.S):
            q, a = strip_tags(m.group(1)), strip_tags(m.group(2))
            if q and a:
                out.append((q, a))
        return out

    @staticmethod
    def steps_in(html):
        out = []
        for m in re.finditer(
                r'<span class="step__n">(\d+)</span>\s*<h2 id="([^"]+)"[^>]*>(.*?)</h2>',
                html, re.S):
            out.append((int(m.group(1)), m.group(2), strip_tags(m.group(3))))
        return out

    def mentions(self, post):
        names = []
        if post.get("vs"):
            names += [post["vs"]["a"]["name"], post["vs"]["b"]["name"]]
        hay = (post["title"] + " " + post["deck"]).lower()
        # Tags are an exact list, so match them whole: a roundup names its
        # tools in tags, not always in the headline.
        tags = {t.lower() for t in post.get("tags", [])}
        names += [n for n in ENTITIES if n.lower() in hay or n.lower() in tags]
        seen, out = set(), []
        for n in names:
            if n in seen:
                continue
            seen.add(n)
            item = {"@type": "SoftwareApplication", "name": n,
                    "applicationCategory": "DeveloperApplication"}
            if n in ENTITIES:
                item["url"] = ENTITIES[n]
            out.append(item)
        return out

    # --------------------------------------------------------- page graphs --
    def article(self, post, html, url, og):
        is_tut = post["type"] == "tutorial"
        g = {
            "@type": "HowTo" if is_tut else "TechArticle",
            "@id": url + "#article",
            "headline": post["title"],
            "name": post["title"],
            "description": post["deck"],
            "url": url,
            "datePublished": post["date"],
            "dateModified": post["date"],
            "inLanguage": "en",
            "author": {"@id": self.person_id},
            "publisher": {"@id": self.org_id},
            "isPartOf": {"@id": self.site_id},
            "mainEntityOfPage": {"@type": "WebPage", "@id": url},
            "image": [og],
            "keywords": ", ".join(post.get("tags", []) + [post["category"]]),
            "articleSection": post["category"],
            "timeRequired": f"PT{post['mins']}M",
            "isAccessibleForFree": True,
            "creativeWorkStatus": "Published",
        }
        m = self.mentions(post)
        if m:
            g["mentions"] = m
            g["about"] = m
        if is_tut:
            steps = self.steps_in(html)
            if steps:
                g["step"] = [{"@type": "HowToStep", "position": n,
                              "name": nm, "url": f"{url}#{anchor}"}
                             for n, anchor, nm in steps]
                g["totalTime"] = f"PT{post['mins']}M"
        return g

    @staticmethod
    def faq_page(url, faqs):
        return {
            "@type": "FAQPage",
            "@id": url + "#faq",
            "mainEntity": [{"@type": "Question", "name": q,
                            "acceptedAnswer": {"@type": "Answer", "text": a}}
                           for q, a in faqs],
        }

    @staticmethod
    def crumbs(trail):
        return {
            "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1,
                                 "name": n, "item": h}
                                for i, (n, h) in enumerate(trail)],
        }

    def item_list(self, posts, post_url):
        return {
            "@type": "ItemList",
            "numberOfItems": len(posts),
            "itemListElement": [{"@type": "ListItem", "position": i + 1,
                                 "url": post_url(p), "name": p["title"]}
                                for i, p in enumerate(posts)],
        }

    # ------------------------------------------------------------- render ---
    def head(self, *, title, desc, canonical, image, graph, kind="website",
             published=None, modified=None, force_noindex=False):
        full = [self.website(), self.org(), self.person()] + graph
        ld = json.dumps({"@context": "https://schema.org", "@graph": full},
                        indent=2, ensure_ascii=False)
        t, d = xml_esc(title), xml_esc(desc)

        # noindex is what actually keeps a page out of the index. The blanket
        # Disallow in robots.txt only stops the fetch.
        robots_meta = (
            '<meta name="robots" content="index, follow, max-image-preview:large,'
            ' max-snippet:-1, max-video-preview:-1">'
            if self.allow_indexing and not force_noindex else
            '<meta name="robots" content="noindex, nofollow">'
        )

        # Ownership proofs for Search Console and Bing Webmaster Tools. They
        # verify the property; they do not affect ranking or indexing.
        nl = chr(10)
        verify = ""
        if self.google_verify:
            verify += (nl + '<meta name="google-site-verification" content="'
                       + xml_esc(self.google_verify) + '">')
        if self.bing_verify:
            verify += (nl + '<meta name="msvalidate.01" content="'
                       + xml_esc(self.bing_verify) + '">')
        # Impact reads value="...", not content="...", so keep its format.
        if self.impact_verify:
            verify += (nl + '<meta name="impact-site-verification" value="'
                       + xml_esc(self.impact_verify) + '">')

        art = ""
        if published:
            art = (
                f'\n<meta property="article:published_time" content="{published}">'
                f'\n<meta property="article:modified_time" content="{modified or published}">'
                f'\n<meta property="article:author" content="{xml_esc(self.author)}">'
            )

        return f"""<!-- SEO:start — generated by build.py, do not hand-edit -->
<title>{t}</title>
<meta name="description" content="{d}">
<link rel="canonical" href="{canonical}">{verify}
<meta name="author" content="{xml_esc(self.author)}">
{robots_meta}
<meta property="og:type" content="{kind}">
<meta property="og:site_name" content="{xml_esc(self.name)}">
<meta property="og:locale" content="{self.locale}">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{t}">{art}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{image}">
<link rel="alternate" type="application/rss+xml" title="{xml_esc(self.name)} feed" href="{self.base}/feed.xml">
<script type="application/ld+json">
{ld}
</script>
<!-- SEO:end -->"""


BLOCK_RE = re.compile(r"<!-- SEO:start.*?<!-- SEO:end -->", re.S)
# The hand-written tags this block replaces on first run.
LEGACY_RE = re.compile(
    r"[ \t]*<title>.*?</title>\n?"
    r"|[ \t]*<meta name=\"description\"[^>]*>\n?"
    r"|[ \t]*<meta name=\"author\"[^>]*>\n?"
    r"|[ \t]*<meta property=\"og:[^\"]*\"[^>]*>\n?", re.S)


def inject(path, block):
    html = path.read_text(encoding="utf-8")
    if BLOCK_RE.search(html):
        html = BLOCK_RE.sub(lambda _: block, html)
    else:
        head_end = html.index("</head>")
        head, rest = html[:head_end], html[head_end:]
        head = LEGACY_RE.sub("", head)
        html = head + block + "\n" + rest
    path.write_text(html, encoding="utf-8")
