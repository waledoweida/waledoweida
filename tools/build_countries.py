#!/usr/bin/env python3
"""Generate the country landing pages (/egypt/, /libya/, /kuwait/, /gulf/ and /en/...).

They are linked from the region cards on the home pages and listed in the sitemap.
Header, footer and WhatsApp button come from the home pages, like the blog.
Never touches wedding/ or فرح/.

Usage:  python3 tools/build_countries.py   (also refreshes sitemap.xml)
"""
import html
import json
import os
import sys
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_blog import RED_LINE, ROOT, L, SITE, remove_page, chrome, page, page_title, write, update_sitemap, build as build_blog  # noqa: E402
from countries import COUNTRIES  # noqa: E402
from content import load  # noqa: E402
from icons import ICONS  # noqa: E402

T = {
    "ar": dict(markets="أسواقي", explore="استكشف الخدمات", wa_btn="كلّمني على واتساب",
               faq_h="أسئلة شائعة", others="بلاد تانية بشتغل فيها", ask="اسأل عن الخدمة دي"),
    "en": dict(markets="Markets", explore="Explore services", wa_btn="Chat on WhatsApp",
               faq_h="FAQ", others="Other markets I work in", ask="Ask about this service"),
}

AREA = {
    "EG": ["Egypt"], "LY": ["Libya"], "KW": ["Kuwait"],
    "GCC": ["Saudi Arabia", "United Arab Emirates", "Qatar", "Bahrain", "Oman"],
}


WA_NUM = load("site")["whatsapp"]


def ml(s):
    """Text from a multi-line field: escaped, line breaks kept."""
    return html.escape(s).replace("\n", "<br>")


def path_for(c, lang):
    return ("/en/" if lang == "en" else "/") + c["slug"] + "/"


def paths():
    return [path_for(c, lang) for lang in ("ar", "en") for c in COUNTRIES]


def wa(text):
    return f"https://wa.me/{WA_NUM}?text={quote(text)}"


def build():
    check_slugs()
    out = []
    for lang in ("ar", "en"):
        d, t = L[lang], T[lang]
        other = d["other"]
        for c in COUNTRIES:
            x = c[lang]
            path, alt = path_for(c, lang), path_for(c, other)
            ch = chrome(lang, alt)
            esc = html.escape
            svc = "".join(f"""
          <a class="mini reveal" href="{esc(wa(x['wa_text'] + ' — ' + sv['title']))}" target="_blank" rel="noopener" aria-label="{esc(t['ask'])}: {esc(sv['title'])}">
            <div class="ic"><svg class="i" viewBox="0 0 24 24">{ICONS[sv['icon']]}</svg></div>
            <div><h3>{esc(sv['title'])}</h3><p>{ml(sv['text'])}</p></div>
          </a>""" for sv in x["services"])
            why = "".join(f'<li><svg class="i"><use href="#check"/></svg><span>{esc(w)}</span></li>' for w in x["why"])
            faq = "".join(f"""
        <details class="reveal">
          <summary>{esc(f['q'])}</summary>
          <p>{ml(f['a'])}</p>
        </details>""" for f in x["faq"])
            others = " ".join(
                f'<a href="{path_for(o, lang)}"><span>{o["code"]}</span>{esc(o[lang]["name"])}</a>'
                for o in COUNTRIES if o is not c)
            body = f"""  <section class="post-hero country-hero">
    <div class="wrap narrow">
      <div class="crumbs"><a href="{d['home']}">{d['crumbs_home']}</a> / <a href="{d['home']}#work">{t['markets']}</a> / <span>{esc(x['name'])}</span></div>
      <span class="reg-code country-code">{c['code']}</span>
      <h1>{esc(x['title'])}</h1>
      <p class="lead">{ml(x['lead'])}</p>
      <div class="btns">
        <a class="btn btn-gold" href="{esc(wa(x['wa_text']))}" target="_blank" rel="noopener"><svg class="i"><use href="#wa"/></svg>{t['wa_btn']}</a>
        <a class="btn btn-ghost" href="#services">{t['explore']}</a>
      </div>
    </div>
  </section>

  <section id="services" class="country-services">
    <div class="wrap">
      <div class="head reveal"><h2>{esc(x['services_h'])}</h2></div>
      <div class="mini-grid">{svc}
      </div>
    </div>
  </section>

  <section class="country-why">
    <div class="wrap narrow">
      <h2 class="reveal">{esc(x['why_h'])}</h2>
      <ul class="c-why reveal">{why}</ul>
    </div>
  </section>

  <section class="country-faq">
    <div class="wrap narrow">
      <h2 class="reveal">{t['faq_h']}</h2>{faq}
    </div>
  </section>

  <section class="band-wrap">
    <div class="wrap">
      <div class="band reveal">
        <div class="band-text"><h2>{esc(x['cta_h'])}</h2><p>{esc(x['cta_p'])}</p></div>
        <div class="btns"><a class="btn btn-dark" href="{esc(wa(x['wa_text']))}" target="_blank" rel="noopener"><svg><use href="#wa"/></svg>{t['wa_btn']}</a></div>
      </div>
      <nav class="c-others" aria-label="{t['others']}"><b>{t['others']}</b>{others}</nav>
    </div>
  </section>"""
            ld = {"@context": "https://schema.org", "@type": "Service", "name": x["title"],
                  "description": x["desc"], "url": SITE + path, "inLanguage": lang,
                  "areaServed": [{"@type": "Country", "name": n} for n in AREA.get(c["code"], [c["en"]["name"]])],
                  "provider": {"@type": "Person", "name": d["name"], "url": SITE + d["home"],
                               "telephone": "+" + WA_NUM}}
            write(path.strip("/") + "/index.html",
                  page(lang, title=page_title(x.get('seo_title') or x['title'], d['short']), desc=x["desc"], path=path, alt_path=alt,
                       og_type="website", ld=ld, body=body, ch=ch))
            out.append(path)
    return out


NOT_COUNTRY = {"/", "/index.html", "/404.html", "/en", "/en/(.*)", "/blog", "/blog/(.*)", "/review", "/review/(.*)"}


def sync_vercel():
    """Give every country page the site's security headers (vercel.json lists paths explicitly)."""
    path = os.path.join(ROOT, "vercel.json")
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    rules = cfg["headers"]
    page_csp = next(r for r in rules if r["source"] == "/")["headers"]
    is_country = lambda r: r["source"] not in NOT_COUNTRY and r["headers"] == page_csp
    at = next(i for i, r in enumerate(rules) if r["source"] == "/blog/(.*)") + 1
    rest = [r for r in rules if not is_country(r)]
    mine = [{"source": s, "headers": page_csp} for c in COUNTRIES for s in (f"/{c['slug']}", f"/{c['slug']}/(.*)")]
    cfg["headers"] = rest[:at] + mine + rest[at:]
    out = json.dumps(cfg, ensure_ascii=False, indent=2) + "\n"
    with open(path, encoding="utf-8") as f:
        same = f.read() == out
    if not same:
        with open(path, "w", encoding="utf-8") as f:
            f.write(out)


MARK = 'class="post-hero country-hero"'


def is_country_page(folder):
    page_file = os.path.join(ROOT, folder, "index.html")
    if not os.path.isfile(page_file):
        return False
    with open(page_file, encoding="utf-8") as f:
        return MARK in f.read()


def check_slugs():
    """A country page may only take a folder that is free or already a country page."""
    for c in COUNTRIES:
        for folder in (c["slug"], "en/" + c["slug"]):
            full = os.path.join(ROOT, folder)
            if os.path.exists(full) and not is_country_page(folder):
                raise RuntimeError(f"country link {c['slug']!r} clashes with the existing {folder!r}")


def prune():
    """Delete the pages of countries that were removed from content/countries.json."""
    keep = {c["slug"] for c in COUNTRIES}
    for base in ("", "en"):
        for name in os.listdir(os.path.join(ROOT, base) if base else ROOT):
            folder = os.path.join(base, name) if base else name
            if name in keep or name.casefold().startswith(RED_LINE) or name.startswith("."):
                continue
            if is_country_page(folder):
                remove_page(folder)


if __name__ == "__main__":
    built = build()
    sync_vercel()
    prune()
    update_sitemap(build_blog())
    print("built", len(built), "pages:", *built, sep="\n  ")
