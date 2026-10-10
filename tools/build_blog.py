#!/usr/bin/env python3
"""Generate the blog (blog/ and en/blog/) from content/articles.json (loaded by tools/articles.py).

Header, footer, icon sprite and floating WhatsApp button are taken from the
home pages (index.html / en/index.html) so the blog always matches the site.
Never touches wedding/ or فرح/.

Usage:  python3 tools/build_blog.py
"""
import html
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from articles import ARTICLES  # noqa: E402
from content import ld_json, load  # noqa: E402
from icons import ICONS  # noqa: E402

SITE = "https://waledoweida.com"
WA = "https://wa.me/" + load("site")["whatsapp"]

L = {
    "ar": dict(
        home="/", blog="/blog/", other="en", lang_label="EN", lang_title="English",
        dir="rtl", locale="ar_EG", name="وليد أحمد علي أبوعويضة", short="وليد أبوعويضة",
        blog_title="المدونة", blog_h1="نصايح تسويق ومواقع",
        blog_lead="مقالات عملية عن الإعلانات الممولة، المواقع، والظهور في جوجل، تساعدك تكبّر مشروعك أونلاين.",
        read="اقرأ المقال", min_read=lambda n: f"{n} دقائق قراءة" if 3 <= n <= 10 else f"{n} دقيقة قراءة",
        by="بقلم", more="مقالات تانية", author_bio="متخصص في التسويق الإلكتروني وتصميم المواقع لعملاء في مصر وليبيا ودول الخليج.",
        cta_h="عايز تطبّق الكلام ده على مشروعك؟", cta_p="ابعتلي على واتساب ونتكلم، أو اطلب تقييم مجاني لصفحتك أو موقعك.",
        cta_wa="كلّمني على واتساب", cta_audit="اطلب تقييم مجاني", crumbs_home="الرئيسية",
        months=["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
        fonts=["/fonts/tajawal-arabic-3a7b8d.woff2", "/fonts/readex-pro-arabic-982df5.woff2"],
        src="index.html", wa_label="واتساب",
    ),
    "en": dict(
        home="/en/", blog="/en/blog/", other="ar", lang_label="ع", lang_title="العربية",
        dir="ltr", locale="en_US", name="Waled Ahmed Ali Abu Oweida", short="Waled Abu Oweida",
        blog_title="Blog", blog_h1="Marketing & website tips",
        blog_lead="Practical articles on paid ads, websites and showing up on Google — to help your business grow online.",
        read="Read article", min_read=lambda n: f"{n} min read",
        by="By", more="More articles", author_bio="Digital marketing and web design specialist for clients in Egypt, Libya and the Gulf.",
        cta_h="Want to apply this to your business?", cta_p="Message me on WhatsApp, or ask for a free review of your page or website.",
        cta_wa="Chat on WhatsApp", cta_audit="Get a free review", crumbs_home="Home",
        months=["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        fonts=["/fonts/readex-pro-latin-f0cddb.woff2"],
        src="en/index.html", wa_label="WhatsApp",
    ),
}



def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()


RED_LINE = ("wedding", "فرح")


def safe_path(p):
    """Absolute path for a generated file. Refuses anything outside the repo and anything in the
    wedding invitation (wedding/, فرح/), whatever the spelling (../, ./, symlinks, letter case)."""
    full = os.path.realpath(os.path.join(ROOT, p))
    rel = os.path.relpath(full, os.path.realpath(ROOT))
    top = rel.split(os.sep)[0].casefold()
    if rel == "." or top == ".." or os.path.isabs(rel) or top.startswith(RED_LINE):
        raise RuntimeError(f"red line: refusing to write {p!r}")
    return full


def write(p, s):
    full = safe_path(p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(s)


def between(s, start, end, include_end=True):
    i = s.index(start)
    j = s.index(end, i) + (len(end) if include_end else 0)
    return s[i:j]


def chrome(lang, other_url):
    """Header/footer/sprite/fab from the home page, with in-page links made absolute."""
    d = L[lang]
    src = read(d["src"])
    head = between(src, "<head>", "</head>")
    csp = re.search(r'<meta http-equiv="Content-Security-Policy"[^>]*>', head).group(0)
    css = re.search(r'/style\.css\?v=\d+', head).group(0)
    js = re.search(r'/main\.js\?v=\d+', src).group(0)
    sprite = between(src, '<svg class="sprite"', "</svg>")
    header = between(src, '<div class="progress"', "</header>")
    footer = between(src, "<footer>", "</footer>")
    fab = between(src, "<aside aria-label=", "</aside>")
    home = d["home"]
    for blk_name in ("header", "footer"):
        blk = header if blk_name == "header" else footer
        blk = re.sub(r'href="#([a-z]+)"', lambda m: f'href="{home}#{m.group(1)}"', blk)
        blk = blk.replace('href="#"', f'href="{home}"')
        if blk_name == "header":
            header = blk
        else:
            footer = blk
    header = re.sub(r'(<a class="lang" href=")[^"]*(")', lambda m: m.group(1) + other_url + m.group(2), header)
    return dict(csp=csp, css=css, js=js, sprite=sprite, header=header, footer=footer, fab=fab)


def fmt_date(iso, lang):
    y, m, d = (int(x) for x in iso.split("-"))
    months = L[lang]["months"]
    return f"{d} {months[m - 1]} {y}" if lang == "ar" else f"{months[m - 1]} {d}, {y}"


def minutes(body):
    words = len(re.sub(r"<[^>]+>", " ", body).split())
    return max(1, math.ceil(words / 200))


def fit_title(title, limit=70):
    """The title, cut at a word boundary (with …) if its escaped form is over `limit` characters."""
    if len(html.escape(title)) <= limit:
        return title
    words = title.split()
    while words and len(html.escape(" ".join(words) + "…")) > limit:
        words.pop()
    return (" ".join(words) + "…") if words else title[:limit - 1] + "…"


def page_title(title, short):
    """'<title> | <name>' when that fits in 70 characters, otherwise just the title (search engines cut longer ones)."""
    full = f"{title} | {short}"
    return full if len(html.escape(full)) <= 70 else fit_title(title)


def page(lang, *, title, desc, path, alt_path, og_type, ld, body, ch):
    d = L[lang]
    other = d["other"]
    pre = "\n".join(f'<link rel="preload" href="{u}" as="font" type="font/woff2" crossorigin>' for u in d["fonts"])
    hreflang_ar = alt_path if lang == "en" else path
    hreflang_en = path if lang == "en" else alt_path
    return f"""<!DOCTYPE html>
<html lang="{lang}" dir="{d['dir']}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="theme-color" content="#0b0d12">
{ch['csp']}
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="{SITE}{path}">
<link rel="alternate" hreflang="ar" href="{SITE}{hreflang_ar}">
<link rel="alternate" hreflang="en" href="{SITE}{hreflang_en}">
<link rel="alternate" hreflang="x-default" href="{SITE}{hreflang_ar}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=2">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png?v=2">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="{html.escape(d['short'])}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{SITE}{path}">
<meta property="og:image" content="{SITE}/og.png?v=2">
<meta property="og:locale" content="{d['locale']}">
<meta name="twitter:card" content="summary_large_image">
{pre}
<script type="application/ld+json">
{ld_json(ld)}
</script>
<script>document.documentElement.classList.add('js')</script>
<link rel="stylesheet" href="{ch['css']}">
</head>
<body>

{ch['sprite']}

{ch['header']}

<main>
{body}
</main>

{ch['footer']}

{ch['fab']}

<script src="{ch['js']}" defer></script>
</body>
</html>
"""


def card(a, lang, h="h3"):
    d = L[lang]
    t = a[lang]
    url = f"{d['blog']}{a['slug']}/"
    return f"""
        <a class="post-card reveal" href="{url}">
          <div class="ic"><svg class="i" viewBox="0 0 24 24">{ICONS[a['icon']]}</svg></div>
          <{h}>{html.escape(t['title'])}</{h}>
          <p>{html.escape(t['desc'])}</p>
          <span class="post-meta"><time datetime="{a['date']}">{fmt_date(a['date'], lang)}</time> · {d['min_read'](minutes(t['body']))}</span>
          <span class="post-more">{d['read']} <svg class="i"><use href="#arrow"/></svg></span>
        </a>"""


def build():
    out = []
    for lang in ("ar", "en"):
        d = L[lang]
        o = L[d["other"]]
        # ----- index -----
        ch = chrome(lang, o["blog"])
        cards = "".join(card(a, lang, "h2") for a in ARTICLES)
        body = f"""  <section class="post-hero">
    <div class="wrap">
      <div class="crumbs"><a href="{d['home']}">{d['crumbs_home']}</a> / <span>{d['blog_title']}</span></div>
      <h1>{html.escape(d['blog_h1'])}</h1>
      <p class="lead">{d['blog_lead']}</p>
    </div>
  </section>

  <section class="posts">
    <div class="wrap">
      <div class="post-grid">{cards}
      </div>
    </div>
  </section>"""
        ld = {"@context": "https://schema.org", "@type": "Blog", "name": f"{d['blog_title']} | {d['short']}",
              "url": SITE + d["blog"], "inLanguage": lang,
              "author": {"@type": "Person", "name": d["name"], "url": SITE + d["home"]}}
        write(d["blog"].strip("/") + "/index.html",
              page(lang, title=f"{d['blog_title']} | {d['short']}", desc=d["blog_lead"], path=d["blog"],
                   alt_path=o["blog"], og_type="website", ld=ld, body=body, ch=ch))
        out.append(d["blog"])

        # ----- articles -----
        for a in ARTICLES:
            t = a[lang]
            path = f"{d['blog']}{a['slug']}/"
            alt = f"{o['blog']}{a['slug']}/"
            ch = chrome(lang, alt)
            others = "".join(card(x, lang) for x in ARTICLES if x is not a)
            # "more articles" only when there is another article to show
            more = f"""

  <section class="posts">
    <div class="wrap">
      <div class="group-title">{d['more']}</div>
      <div class="post-grid">{others}
      </div>
    </div>
  </section>""" if others else ""
            body = f"""  <section class="post-hero">
    <div class="wrap narrow">
      <div class="crumbs"><a href="{d['home']}">{d['crumbs_home']}</a> / <a href="{d['blog']}">{d['blog_title']}</a></div>
      <h1>{html.escape(t['title'])}</h1>
      <div class="byline">
        <img class="avatar" src="/avatar.jpg" alt="" width="40" height="40">
        <span>{d['by']} <b>{d['short']}</b><br><time datetime="{a['date']}">{fmt_date(a['date'], lang)}</time> · {d['min_read'](minutes(t['body']))}</span>
      </div>
    </div>
  </section>

  <article class="prose wrap narrow">
{t['body'].strip()}
  </article>

  <section class="wrap narrow post-end">
    <div class="author-box">
      <img src="/avatar.jpg" alt="" width="64" height="64" loading="lazy">
      <div><b>{d['name']}</b><p>{d['author_bio']}</p></div>
    </div>
    <div class="band post-cta">
      <div class="band-text"><h2>{d['cta_h']}</h2><p>{d['cta_p']}</p></div>
      <div class="btns">
        <a class="btn btn-dark" href="{WA}" target="_blank" rel="noopener"><svg><use href="#wa"/></svg>{d['cta_wa']}</a>
        <a class="btn btn-line" href="{d['home']}#audit">{d['cta_audit']}</a>
      </div>
    </div>
  </section>{more}"""
            ld = {"@context": "https://schema.org", "@type": "BlogPosting", "headline": t["title"],
                  "description": t["desc"], "datePublished": a["date"], "dateModified": a["date"],
                  "inLanguage": lang, "mainEntityOfPage": SITE + path, "image": SITE + "/og.png",
                  "author": {"@type": "Person", "name": d["name"], "url": SITE + d["home"]},
                  "publisher": {"@type": "Person", "name": d["name"]}}
            write(path.strip("/") + "/index.html",
                  page(lang, title=page_title(t['title'], d['short']), desc=t["desc"], path=path, alt_path=alt,
                       og_type="article", ld=ld, body=body, ch=ch))
            out.append(path)
    return out


def remove_page(folder):
    """Delete a generated page (folder/index.html), and the folder only if nothing else is in it."""
    page_file = safe_path(os.path.join(folder, "index.html"))
    os.remove(page_file)
    if not os.listdir(os.path.dirname(page_file)):
        os.rmdir(os.path.dirname(page_file))


def prune():
    """Delete the pages of articles that were removed from content/articles.json."""
    keep = {a["slug"] for a in ARTICLES}
    for blog in ("blog", "en/blog"):
        for name in os.listdir(os.path.join(ROOT, blog)):
            if name not in keep and os.path.isfile(os.path.join(ROOT, blog, name, "index.html")):
                remove_page(os.path.join(blog, name))


def update_sitemap(paths):
    """Sitemap = home pages + the given blog paths + the country pages."""
    from build_countries import paths as country_paths
    paths = paths + country_paths()
    urls = ["/", "/en/"] + paths
    pairs = {"/": "/en/", "/en/": "/"}
    for p in paths:
        pairs[p] = p[3:] if p.startswith("/en/") else "/en" + p
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for u in urls:
        ar, en = (pairs[u], u) if u.startswith("/en/") else (u, pairs[u])
        lines += ["  <url>", f"    <loc>{SITE}{u}</loc>",
                  f'    <xhtml:link rel="alternate" hreflang="ar" href="{SITE}{ar}"/>',
                  f'    <xhtml:link rel="alternate" hreflang="en" href="{SITE}{en}"/>', "  </url>"]
    lines.append("</urlset>")
    write("sitemap.xml", "\n".join(lines) + "\n")


if __name__ == "__main__":
    built = build()
    update_sitemap(built)
    print("built", len(built), "pages:", *built, sep="\n  ")
