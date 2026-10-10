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


# the same rules as api/_lib/schema.ts, for values that could break out of where the build puts them
SLUG = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")
RULES = {
    "site": [(lambda d: d["whatsapp"], re.compile(r"[1-9][0-9]{7,14}"), "whatsapp")],
    "countries": [(lambda r: r["code"], re.compile(r"[A-Z]{2,4}"), "code"), (lambda r: r["slug"], SLUG, "slug")],
    "articles": [(lambda r: r["date"], re.compile(r"\d{4}-\d{2}-\d{2}"), "date"), (lambda r: r["slug"], SLUG, "slug")],
}


def _tidy(v):
    """Strings: drop spaces before line breaks (html-validate rejects trailing whitespace)
    and replace lone surrogates (they can't be written as UTF-8)."""
    if isinstance(v, str):
        return re.sub(r"[ \t]+\n", "\n", v).encode("utf-8", "replace").decode("utf-8")
    if isinstance(v, list):
        return [_tidy(x) for x in v]
    if isinstance(v, dict):
        return {k: _tidy(x) for k, x in v.items()}
    return v


def load(name):
    with open(os.path.join(ROOT, "content", name + ".json"), encoding="utf-8") as f:
        data = _tidy(json.load(f))
    for get, rule, field in RULES.get(name, []):
        for row in (data if isinstance(data, list) else [data]):
            value = get(row)
            if not isinstance(value, str) or not rule.fullmatch(value):
                raise ValueError(f"content/{name}.json: bad {field} {value!r}")
    return data


def esc(s):
    """Text node: escape &, < and > (quotes stay as typed); line breaks typed in the panel become <br>."""
    return html.escape(str(s), quote=False).replace("\n", "<br>")


def attr(s):
    """Attribute value in double quotes (on one line)."""
    return html.escape(str(s), quote=False).replace('"', "&quot;").replace("\n", " ")


def inline(s):
    """Escaped text with **bold** and line breaks."""
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", esc(str(s).strip()))


LIST_ITEM = re.compile(r"^(- |\d+\. )")


def article_html(text):
    """Article body in the simple text format -> HTML.

    Blocks are separated by a blank line. Inside a block: "## " is a heading, "> " a tip,
    runs of "- " / "1. " lines a list, and other lines one paragraph.
    """
    out = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = [x.strip() for x in block.strip().split("\n") if x.strip()]
        para = []

        def flush():
            if para:
                out.append(f"<p>{inline(' '.join(para))}</p>")
                para.clear()

        i = 0
        while i < len(lines):
            x = lines[i]
            if x.startswith("## "):
                flush()
                out.append(f"<h2>{inline(x[3:])}</h2>")
                i += 1
            elif x.startswith("> "):
                flush()
                run = []
                while i < len(lines) and lines[i].startswith("> "):
                    run.append(lines[i][2:].strip())
                    i += 1
                out.append(f'<blockquote class="tip">{inline(" ".join(run))}</blockquote>')
            elif LIST_ITEM.match(x):
                flush()
                tag = "ul" if x.startswith("- ") else "ol"
                items = []
                while i < len(lines) and LIST_ITEM.match(lines[i]) and lines[i].startswith("- ") == (tag == "ul"):
                    items.append(LIST_ITEM.sub("", lines[i], count=1))
                    i += 1
                lis = "\n".join(f"  <li>{inline(t)}</li>" for t in items)
                out.append(f"<{tag}>\n{lis}\n</{tag}>")
            else:
                para.append(x)
                i += 1
        flush()
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
