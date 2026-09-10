"""
TEARDOWN — JS bundling + image optimisation. Imported by build.py.

Two Lighthouse opportunities, fixed at build time:

  "Minify JavaScript"            ~400ms
  "Serve images in next-gen
   formats"                      ~460ms

The three source files stay separate and readable — data.js is the content
database you edit, templates.js is shared with the prerenderer, site.js is the
behaviour. The build concatenates them in dependency order and minifies the
result to one file, so the browser makes a single request for minified code
while you keep editing unminified sources.
"""

import hashlib
import re
import shutil
import subprocess
from pathlib import Path

# Order matters: site.js reads window.TD and window.TD_TEMPLATES at load.
SOURCES = ["data.js", "templates.js", "site.js"]
BUNDLE_GLOB = "bundle.*.min.js"


def _terser():
    """Prefer the local install; fall back to npx."""
    local = Path("node_modules/.bin/terser.cmd")
    if local.exists():
        return [str(local)]
    if shutil.which("terser"):
        return ["terser"]
    return ["npx", "--yes", "terser"]


def bundle_js(root):
    js_dir = Path(root) / "assets" / "js"
    combined = []
    for name in SOURCES:
        src = js_dir / name
        combined.append(f"/* --- {name} --- */\n" + src.read_text(encoding="utf-8"))
    raw = "\n;\n".join(combined)

    tmp = js_dir / "_bundle.tmp.js"
    tmp.write_text(raw, encoding="utf-8")
    out = js_dir / "_bundle.out.js"

    try:
        subprocess.run(
            _terser() + [str(tmp), "--compress", "--mangle",
                         "--comments", "false", "-o", str(out)],
            cwd=root, capture_output=True, text=True, check=True, shell=False,
        )
        minified = True
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        # No terser available — ship the concatenation. One request instead of
        # three is still a win, and the site is never broken by a missing
        # dev dependency.
        out.write_text(raw, encoding="utf-8")
        minified = False
    finally:
        tmp.unlink(missing_ok=True)

    # Name the file after its contents so it can be cached for a year and a
    # redeploy still busts it.
    body = out.read_bytes()
    digest = hashlib.sha256(body).hexdigest()[:10]
    final = js_dir / f"bundle.{digest}.min.js"
    for stale in js_dir.glob(BUNDLE_GLOB):
        if stale != final:
            stale.unlink()
    final.write_bytes(body)
    out.unlink(missing_ok=True)

    return len(raw), final.stat().st_size, minified, final.name


def rewrite_script_tags(root, bundle_name):
    """Point every page at the current hashed bundle."""
    root = Path(root)
    changed = []
    for path in list(root.glob("*.html")) + list(root.glob("posts/*.html")):
        html = original = path.read_text(encoding="utf-8")
        base = "../" if path.parent.name == "posts" else ""

        three = "".join(
            f'<script src="{base}assets/js/{n}"></script>\n' for n in SOURCES
        ).strip()
        one = f'<script src="{base}assets/js/{bundle_name}" defer></script>'

        if three in html:
            html = html.replace(three, one)
        else:
            import re
            # Two shapes to replace: the three source tags (a hand-written
            # page), or an existing bundle tag from a previous build. The
            # bundle name carries a content hash that changes every time the
            # JS changes, so the old tag must match hashed AND unhashed.
            pat = re.compile(
                r'(?:<script src="' + re.escape(base)
                + r'assets/js/(?:data|templates|site)\.js"></script>\s*){2,3}'
                r'|<script src="' + re.escape(base)
                + r'assets/js/bundle(?:\.[0-9a-f]+)?\.min\.js"[^>]*></script>'
            )
            html = pat.sub(lambda _: one, html, count=1)

        if html != original:
            path.write_text(html, encoding="utf-8")
            changed.append(path.name)
    return changed


def webp_avatar(root):
    """Ship the portrait as WebP with a JPEG fallback via <picture>."""
    try:
        from PIL import Image
    except ImportError:
        return None
    src = Path(root) / "assets" / "img" / "saad.jpg"
    if not src.exists():
        return None
    dst = src.with_suffix(".webp")
    im = Image.open(src).convert("RGB")
    im.save(dst, "WEBP", quality=82, method=6)
    return src.stat().st_size, dst.stat().st_size


def minify_css(root):
    """Minify style.css and return (raw_size, minified_css).

    The minified CSS is inlined into the pages, so there is no reason to leave
    a style.min.css on disk that nothing links to. Written to a temp file only
    because the minifier is a separate Node process, then cleaned up.
    """
    root = Path(root)
    src = root / "assets" / "css" / "style.css"
    tmp = root / "assets" / "css" / "_style.tmp.css"
    try:
        subprocess.run(
            ["node", "audit/minify-css.mjs", str(src), str(tmp)],
            cwd=root, capture_output=True, text=True, check=True,
        )
        css = tmp.read_text(encoding="utf-8")
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        css = src.read_text(encoding="utf-8")
    finally:
        tmp.unlink(missing_ok=True)
    return src.stat().st_size, css


def inline_css(root, css):
    """Replace the render-blocking <link> with the stylesheet inlined.

    style.css is the critical CSS — every page needs essentially all of it
    above the fold — so there is nothing meaningful to split out. Inlining it
    removes a render-blocking round trip entirely. The trade is that the CSS
    is no longer cached across pages; at ~5kB gzipped per page that is the
    cheaper side of the deal for a site people read one or two pages of.

    Reversible: set INLINE_CSS = False in build.py and rebuild.
    """
    root = Path(root)
    block = "<style>" + css + "</style>"
    changed = []

    for path in list(root.glob("*.html")) + list(root.glob("posts/*.html")):
        html = original = path.read_text(encoding="utf-8")
        base = "../" if path.parent.name == "posts" else ""
        link = f'<link rel="stylesheet" href="{base}assets/css/style.css">'

        marker_open, marker_close = "<!-- CSS:start -->", "<!-- CSS:end -->"
        wrapped = f"{marker_open}{block}{marker_close}"

        if marker_open in html:
            start = html.index(marker_open)
            end = html.index(marker_close) + len(marker_close)
            html = html[:start] + wrapped + html[end:]
        elif link in html:
            html = html.replace(link, wrapped)

        if html != original:
            path.write_text(html, encoding="utf-8")
            changed.append(path.name)
    return changed


FONT_BLOCKING = re.compile(
    r'<link href="(https://fonts\.googleapis\.com/css2[^"]+)" rel="stylesheet">')


def async_fonts(root):
    """Make the webfont stylesheet non-blocking on every page.

    A third-party stylesheet in the head is a round trip in front of first
    paint. preload + media="print" onload downloads it without blocking, and
    the <noscript> copy keeps it working with JS off.

    This runs over every page on every build rather than being applied by hand,
    because it WAS applied by hand once: the five pages that existed at the
    time got it, and the article written afterwards did not. Lighthouse scored
    that page 1.3s of render-blocking resources until this function existed.
    """
    root = Path(root)
    fixed = []
    for path in list(root.glob("*.html")) + list(root.glob("posts/*.html")):
        html = original = path.read_text(encoding="utf-8")

        def swap(m):
            url = m.group(1)
            return (
                f'<link rel="preload" as="style" href="{url}">\n'
                f'<link rel="stylesheet" href="{url}" media="print" '
                f'onload="this.media=&quot;all&quot;">\n'
                f'<noscript><link rel="stylesheet" href="{url}"></noscript>'
            )

        html = FONT_BLOCKING.sub(swap, html)
        if html != original:
            path.write_text(html, encoding="utf-8")
            fixed.append(path.name)
    return fixed
