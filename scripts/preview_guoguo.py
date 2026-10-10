"""Serve an isolated bank preview; pair with api.yuanchu.ai's dev:points.

The browser uses preview-admin / local-preview. The source file and production
credentials are never modified. Listen on loopback only; no third-party packages.
"""
import argparse
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PAGE = "/product/guoguo-points-bank.html"


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path not in ("/", PAGE):
            return super().do_GET()
        source = (ROOT / PAGE.lstrip("/")).read_text(encoding="utf-8")
        source, count = re.subn(
            r"const ADMIN_ACCOUNT = \{[^}]+\};",
            "const ADMIN_ACCOUNT = { username: 'preview-admin', password: 'local-preview' };",
            source,
        )
        if count != 1:
            return self.send_error(500, "Preview account replacement failed")
        if path == "/":
            source = source.replace("<head>", '<head><base href="/product/">', 1)
        body = source.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5173)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), PreviewHandler)
    print(f"Bank preview: http://127.0.0.1:{server.server_port}{PAGE}", flush=True)
    print("Use preview-admin / local-preview; start the memory API on port 3000.", flush=True)
    server.serve_forever()
