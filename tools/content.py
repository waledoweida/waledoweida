"""Editable site content (content/*.json) and the helpers that turn it into HTML.

The admin panel (/admin/) edits these JSON files through the GitHub API; the
"Build pages" workflow then runs tools/build_all.py and commits the pages.
Everything written by the owner is HTML-escaped here; the only formatting is
**bold**, and in articles: "## " headings, "- " / "1. " lists and "> " tips.
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(name):
    with open(os.path.join(ROOT, "content", name + ".json"), encoding="utf-8") as f:
        return json.load(f)


def esc(s):
    """Text node: escape &, < and > (quotes stay as typed)."""
    return html.escape(str(s), quote=False)


def attr(s):
    """Attribute value in double quotes."""
    return esc(s).replace('"', "&quot;")


def inline(s):
    """Escaped text with **bold** and line breaks."""
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", esc(s).strip()).replace("\n", "<br>")


def article_html(text):
    """Article body in the simple text format -> HTML."""
    out = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = [x.strip() for x in block.strip().split("\n") if x.strip()]
        if not lines:
            continue
        if lines[0].startswith("## "):
            out.append(f"<h2>{inline(lines[0][3:])}</h2>")
            if lines[1:]:
                out.append(f"<p>{inline(' '.join(lines[1:]))}</p>")
        elif lines[0].startswith("> "):
            out.append(f'<blockquote class="tip">{inline(" ".join(x.lstrip("> ").strip() for x in lines))}</blockquote>')
        elif all(x.startswith("- ") for x in lines):
            out.append("<ul>\n" + "\n".join(f"  <li>{inline(x[2:])}</li>" for x in lines) + "\n</ul>")
        elif all(re.match(r"\d+\. ", x) for x in lines):
            out.append("<ol>\n" + "\n".join(f"  <li>{inline(re.sub(r'^\d+\. ', '', x))}</li>" for x in lines) + "\n</ol>")
        else:
            out.append(f"<p>{inline(' '.join(lines))}</p>")
    return "\n\n".join(out)


def ld_json(obj, **kw):
    """JSON for a <script type="application/ld+json"> block: '<' is escaped so text can never close the script."""
    return json.dumps(obj, ensure_ascii=False, **kw).replace("<", "\\u003c")


def phone(site):
    """WhatsApp number in its display forms: (+20 102 592 6261, 0102 592 6261), with no-break spaces."""
    n = site["whatsapp"]
    if n.startswith("20") and len(n) == 12:
        rest = n[2:]
        intl = f"+20 {rest[:3]} {rest[3:6]} {rest[6:]}"
        local = f"0{rest[:3]} {rest[3:6]} {rest[6:]}"
    else:
        intl = local = "+" + n
    return intl.replace(" ", "&nbsp;"), local.replace(" ", "&nbsp;")
