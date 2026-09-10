#!/usr/bin/env python3
"""
Local dev server.

    python serve.py [port]

Threaded, unlike `python -m http.server`, which serves one request at a time.
Lighthouse and Puppeteer open many connections at once and a single-threaded
server makes them stall or time out — which shows up as fake performance
problems in the audit.

Also sends no-cache headers so a rebuild is picked up on reload instead of
being served from the browser's memory cache.
"""

import gzip
import io
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Real static hosts (Netlify, Cloudflare, GitHub Pages, S3+CloudFront) all
# compress text responses. Without this, a local Lighthouse run reports
# "Enable text compression" as a ~700ms opportunity that will not exist in
# production — so the dev server compresses too and the numbers mean something.
COMPRESSIBLE = (
    "text/", "application/javascript", "text/javascript",
    "application/json", "application/xml", "image/svg+xml",
)

ROOT = Path(__file__).parent


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".xml": "application/xml",
        ".txt": "text/plain; charset=utf-8",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def send_head(self):
        """Serve the file, gzipped when the client asks and the type suits."""
        path = self.translate_path(self.path)
        if path.endswith("/") or not Path(path).is_file():
            return super().send_head()

        ctype = self.guess_type(path)
        accepts = "gzip" in self.headers.get("Accept-Encoding", "")
        if not (accepts and any(ctype.startswith(c) for c in COMPRESSIBLE)):
            return super().send_head()

        try:
            raw = Path(path).read_bytes()
        except OSError:
            self.send_error(404)
            return None

        body = gzip.compress(raw, 6)
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Vary", "Accept-Encoding")
        self.end_headers()
        return io.BytesIO(body)

    def log_message(self, fmt, *args):
        if "404" in (fmt % args):
            sys.stderr.write("  404  %s\n" % (args[0] if args else ""))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
    handler = partial(Handler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    server.daemon_threads = True
    print(f"  serving {ROOT} at http://localhost:{port}  (ctrl-c to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  stopped")


if __name__ == "__main__":
    main()
