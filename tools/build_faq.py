#!/usr/bin/env python3
"""Generate the FAQ page (faq/ and en/faq/) from content/home.json (faq). It has its own page,
linked from the header menu and the footer, so it doesn't take room on the home page.
Never touches wedding/ or فرح/.

Usage:  python3 tools/build_faq.py
"""
from build_blog import L, WA, chrome, page, write
from content import attr, esc, load

T = {
    "ar": dict(path="/faq/", alt="/en/faq/", order="اطلب خدمة"),
    "en": dict(path="/en/faq/", alt="/faq/", order="Request a service"),
}


def paths():
    return [t["path"] for t in T.values()]


def build():
    home = load("home")
    for lang, t in T.items():
        d, f = L[lang], home[lang]["faq"]
        items = "\n".join(f"""        <details class="reveal">
          <summary>{esc(x['q'])}</summary>
          <p>{esc(x['a'])}</p>
        </details>""" for x in f["items"])
        body = f"""  <section class="post-hero">
    <div class="wrap narrow">
      <span class="eyebrow">{esc(f['eyebrow'])}</span>
      <h1>{esc(f['title'])}</h1>
      <p class="lead">{esc(f['lead'])}</p>
    </div>
  </section>

  <section class="faq-page">
    <div class="wrap narrow">
{items}
      <div class="btns faq-cta">
        <a class="btn btn-gold" href="{attr(WA)}" target="_blank" rel="noopener"><svg class="i"><use href="#wa"/></svg>{esc(d['cta_wa'])}</a>
        <a class="btn btn-dark" href="{d['home']}#contact">{t['order']}</a>
      </div>
    </div>
  </section>"""
        ld = {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": lang,
              "mainEntity": [{"@type": "Question", "name": x["q"], "acceptedAnswer": {"@type": "Answer", "text": x["a"]}}
                             for x in f["items"]]}
        html = page(lang, title=f"{f['eyebrow']} | {d['short']}", desc=f["lead"], path=t["path"], alt_path=t["alt"],
                    og_type="website", ld=ld, body=body, ch=chrome(lang, t["alt"]))
        write(t["path"].strip("/") + "/index.html", html)
    return paths()


if __name__ == "__main__":
    print("built", *build(), sep="\n  ")
