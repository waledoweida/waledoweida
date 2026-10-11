#!/usr/bin/env python3
"""Minify the site's scripts: the readable sources live in src/ (kept off the published site by
.vercelignore); the published files carry no comments and short names, so the browser's F12 shows
nothing about how the site works behind the scenes. Needs `npm ci` first (terser, a dev dependency).

Usage:  python3 tools/build_js.py
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from build_blog import ROOT, write  # noqa: E402

FILES = {  # published file: readable source
    "main.js": "src/main.js",
    "admin/admin.js": "src/admin/admin.js",
    "admin/editor.js": "src/admin/editor.js",
}
TERSER = os.path.join(ROOT, "node_modules", "terser", "bin", "terser")


def build():
    if not os.path.exists(TERSER):
        raise SystemExit("terser is missing: run `npm ci` first")
    for out, src in FILES.items():
        js = subprocess.run(["node", TERSER, os.path.join(ROOT, src), "--compress", "--mangle", "--comments", "false"],
                            check=True, capture_output=True, text=True, encoding="utf-8").stdout
        write(out, js.strip() + "\n")
    return list(FILES)


if __name__ == "__main__":
    print("minified", *build(), sep="\n  ")
