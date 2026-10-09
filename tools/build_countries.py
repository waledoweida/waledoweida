#!/usr/bin/env python3
"""Generate the country landing pages (/egypt/, /libya/, /kuwait/, /gulf/ and /en/...).

They are linked from the region cards on the home pages and listed in the sitemap.
Header, footer and WhatsApp button come from the home pages, like the blog.
Never touches wedding/ or فرح/.

Usage:  python3 tools/build_countries.py   (also refreshes sitemap.xml)
"""
import html
import os
import sys
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_blog import L, SITE, chrome, page, page_title, write, update_sitemap, build as build_blog  # noqa: E402
from countries import COUNTRIES  # noqa: E402

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

ICONS = {
    "ads": '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    "web": '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    "store": '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H5.1"/>',
    "social": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    "maps": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    "seo": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
}

WA_NUM = "201025926261"


def path_for(c, lang):
    return ("/en/" if lang == "en" else "/") + c["slug"] + "/"


def paths():
    return [path_for(c, lang) for lang in ("ar", "en") for c in COUNTRIES]


def wa(text):
    return f"https://wa.me/{WA_NUM}?text={quote(text)}"


def build():
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
          <a class="mini reveal" href="{esc(wa(x['wa_text'] + ' — ' + name))}" target="_blank" rel="noopener" aria-label="{esc(t['ask'])}: {esc(name)}">
            <div class="ic"><svg class="i" viewBox="0 0 24 24">{ICONS[icon]}</svg></div>
            <div><h3>{esc(name)}</h3><p>{esc(desc)}</p></div>
          </a>""" for icon, name, desc in x["services"])
            why = "".join(f'<li><svg class="i"><use href="#check"/></svg><span>{esc(w)}</span></li>' for w in x["why"])
            faq = "".join(f"""
        <details class="reveal">
          <summary>{esc(q)}</summary>
          <p>{esc(a)}</p>
        </details>""" for q, a in x["faq"])
            others = " ".join(
                f'<a href="{path_for(o, lang)}"><span>{o["code"]}</span>{esc(o[lang]["name"])}</a>'
                for o in COUNTRIES if o is not c)
            body = f"""  <section class="post-hero country-hero">
    <div class="wrap narrow">
      <div class="crumbs"><a href="{d['home']}">{d['crumbs_home']}</a> / <a href="{d['home']}#work">{t['markets']}</a> / <span>{esc(x['name'])}</span></div>
      <span class="reg-code country-code">{c['code']}</span>
      <h1>{esc(x['title'])}</h1>
      <p class="lead">{esc(x['lead'])}</p>
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
                  "areaServed": [{"@type": "Country", "name": n} for n in AREA[c["code"]]],
                  "provider": {"@type": "Person", "name": d["name"], "url": SITE + d["home"],
                               "telephone": "+" + WA_NUM}}
            write(path.strip("/") + "/index.html",
                  page(lang, title=page_title(x.get('seo_title', x['title']), d['short']), desc=x["desc"], path=path, alt_path=alt,
                       og_type="website", ld=ld, body=body, ch=ch))
            out.append(path)
    return out


if __name__ == "__main__":
    built = build()
    update_sitemap(build_blog())
    print("built", len(built), "pages:", *built, sep="\n  ")
