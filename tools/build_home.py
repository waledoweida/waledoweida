#!/usr/bin/env python3
"""Fill the home pages (index.html, en/index.html) from content/home.json, site.json and countries.json.

The page skeleton (head, header, sprite, scripts) stays hand-written in the HTML files;
this script regenerates the content sections, the footer text, the WhatsApp dock and
the title/description/share tags. Never touches wedding/ or فرح/.

Usage:  python3 tools/build_home.py
"""
import json
import os
import re
import sys
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_blog import fit_title, read, write  # noqa: E402
from content import attr, esc, inline, ld_json, load, phone  # noqa: E402
from icons import ICONS  # noqa: E402

PAGES = {"ar": ("index.html", "/"), "en": ("en/index.html", "/en/")}
CHECK = '<svg class="i"><use href="#check"/></svg>'
ARROW = '<svg class="i"><use href="#arrow"/></svg>'


def head(h, center=False):
    return f"""      <div class="head{' center' if center else ''} reveal">
        <span class="eyebrow">{esc(h['eyebrow'])}</span>
        <h2>{esc(h['title'])}</h2>
        <p class="lead">{esc(h['lead'])}</p>
      </div>"""


def wa_link(site, text=None):
    return f"https://wa.me/{site['whatsapp']}" + (f"?text={quote(text, safe='')}" if text else "")


def hero(c):
    h = c["hero"]
    title = esc(h["title_start"]) + f' <span class="gold-text">{esc(h["title_gold"])}</span>' + (" " + esc(h["title_end"]) if h.get("title_end") else "")
    trust = "\n".join(f"          <span>{CHECK}{esc(t)}</span>" for t in h["trust"])
    return f"""  <section class="hero" id="about">
    <div class="wrap hero-grid">
      <div>
        <div class="badge"><span class="dot"></span>{esc(h['badge'])}</div>
        <h1>{title}</h1>
        <p class="sub">{inline(h['intro'])}</p>
        <div class="btns">
          <a class="btn btn-gold" href="#contact">{esc(h['button_main'])} {ARROW}</a>
          <a class="btn btn-ghost" href="#services">{esc(h['button_second'])}</a>
        </div>
        <div class="trust">
{trust}
        </div>
      </div>

      <div class="visual">
        <div class="glow" aria-hidden="true"></div>
        <div class="photo"><picture><source srcset="/profile.webp" type="image/webp"><img src="/profile.jpg" alt="{attr(h['photo_alt'])}" width="520" height="620" fetchpriority="high"></picture></div>
        <div class="float f-seo" aria-hidden="true">
          <span class="chip-ic"><svg class="i">{ICONS['seo']}</svg></span>
          <div><b>{esc(h['chip_seo_title'])}</b><small>{esc(h['chip_seo_text'])}</small></div>
        </div>
        <div class="float f-soc" aria-hidden="true">
          <span class="chip-ic"><svg class="i">{ICONS['social']}</svg></span>
          <div><b>{esc(h['chip_social_title'])}</b><small>{esc(h['chip_social_text'])}</small></div>
        </div>
        <div class="float f-ads" aria-hidden="true">
          <b>{esc(h['chip_ads_title'])}</b><small>{esc(h['chip_ads_text'])}</small>
          <svg viewBox="0 0 200 60" preserveAspectRatio="none">
            <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e6c983" stop-opacity=".35"/><stop offset="1" stop-color="#e6c983" stop-opacity="0"/></linearGradient></defs>
            <path d="M0 52 L25 46 L50 48 L75 36 L100 38 L125 26 L150 22 L175 12 L200 6 L200 60 L0 60Z" fill="url(#g)"/>
            <path d="M0 52 L25 46 L50 48 L75 36 L100 38 L125 26 L150 22 L175 12 L200 6" fill="none" stroke="#e6c983" stroke-width="2.5" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  </section>"""


def platforms(c):
    p = c["platforms"]
    a = "".join(f"<span>{esc(x)}</span>" for x in p["items"])
    b = "".join(f'<span aria-hidden="true">{esc(x)}</span>' for x in p["items"])
    return f"""  <section class="strip" aria-label="{attr(p['aria'])}">
    <div class="wrap">
      <span class="strip-label">{esc(p['label'])}</span>
      <div class="marquee">
        <div class="track">
          {a}
          {b}
        </div>
      </div>
    </div>
  </section>"""


def stats(c, site):
    s, n = c["stats"], site["counter"]
    base = int(n["base"])
    first = (f'<div class="stat reveal"><b data-count="+{base}" data-live-base="{base}" data-live-start="{attr(n["start"])}">'
             f'+{base:,}</b><span>{esc(s["counter_label"])}</span></div>')
    rest = "".join(f'<div class="stat reveal"><b data-count="{attr(x["value"])}">{esc(x["value"])}</b><span>{esc(x["label"])}</span></div>'
                   for x in s["items"])
    return f"""  <section class="stats" aria-label="{attr(s['aria'])}">
    <div class="wrap stats-grid">{first}{rest}</div>
  </section>"""


def regions(c, lang, countries):
    r = c["regions"]
    pre = "/en/" if lang == "en" else "/"
    cards = "\n".join(f"""        <a class="reg reveal" data-code="{attr(x['code'])}" href="{pre}{x['slug']}/">
          <span class="reg-code">{esc(x['code'])}</span>
          <h3>{esc(x[lang].get('card_title') or x[lang]['name'])}</h3>
          <p>{esc(x[lang]['card'])}</p>
          <span class="reg-more">{esc(r['more'])} {ARROW}</span>
        </a>""" for x in countries)
    return f"""  <section class="regions" id="work">
    <div class="wrap">
{head(r, True)}
      <div class="reg-grid">
{cards}
      </div>
      <p class="reg-note reveal"><svg class="i"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>{esc(r['note'])}</p>
    </div>
  </section>"""


def nbsp(s):
    """Text inside a tel: link: html-validate wants no-break spaces and hyphens there."""
    return re.sub(r"[ \u00a0]", "&nbsp;", esc(s)).replace("-", "&#8209;")


def form_name(x):
    return x.get("form_name") or x["title"]


def services(c):
    s = c["services"]
    feat = "\n".join(f"""          <article class="feat reveal">
            <div class="ic"><svg class="i">{ICONS[x['icon']]}</svg></div>
            <h3>{esc(x['title'])}</h3>
            <p>{esc(x['text'])}</p>
            <ul>{''.join(f'<li>{CHECK}{esc(p)}</li>' for p in x['points'])}</ul>
            <a class="feat-link" href="#contact" data-service="{attr(form_name(x))}">{esc(s['order'])} {ARROW}</a>
          </article>""" for x in s["featured"])
    mini = "\n".join(f"""          <a class="mini reveal" href="#contact" data-service="{attr(form_name(x))}">
            <div class="ic"><svg class="i">{ICONS[x['icon']]}</svg></div>
            <div><h3>{esc(x['title'])}</h3><p>{esc(x['text'])}</p></div>
          </a>""" for x in s["others"])
    return f"""  <section id="services">
    <div class="wrap">
{head(s)}

      <div class="group-title reveal">{esc(s['featured_title'])}</div>
      <div class="feat-grid">
{feat}
      </div>
      <div class="group-title reveal">{esc(s['others_title'])}</div>
      <div class="mini-grid">
{mini}
      </div>
    </div>
  </section>"""


def why(c):
    w = c["why"]
    items = "\n".join(f"""        <div class="why-item reveal">
          <div class="ic"><svg class="i">{ICONS[x['icon']]}</svg></div>
          <h3>{esc(x['title'])}</h3>
          <p>{esc(x['text'])}</p>
        </div>""" for x in w["items"])
    return f"""  <section class="why" id="why">
    <div class="wrap why-grid">
      <div class="reveal">
        <span class="eyebrow">{esc(w['eyebrow'])}</span>
        <h2>{esc(w['title'])}</h2>
        <p class="lead">{esc(w['lead'])}</p>
        <div class="btns why-cta"><a class="btn btn-line" href="#contact">{esc(w['button'])}</a></div>
      </div>
      <div class="why-list">
{items}
      </div>
    </div>
  </section>"""


def steps(c):
    s = c["steps"]
    items = "\n".join(f'        <div class="step reveal"><div class="step-n">{i}</div><h3>{esc(x["title"])}</h3><p>{esc(x["text"])}</p></div>'
                      for i, x in enumerate(s["items"], 1))
    return f"""  <section id="how">
    <div class="wrap">
{head(s, True)}
      <div class="steps">
{items}
      </div>
    </div>
  </section>"""


def audit(c):
    a = c["audit"]
    checks = "\n".join(f"            <li>{CHECK}{esc(x)}</li>" for x in a["checks"])
    badges = "".join(f"<span>{esc(x)}</span>" for x in a["badges"])
    return f"""  <section class="audit-wrap" id="audit">
    <div class="wrap">
      <div class="audit-card reveal">
        <div class="audit-info">
          <span class="audit-tag">{esc(a['tag'])}</span>
          <h2>{esc(a['title'])}</h2>
          <p>{esc(a['text'])}</p>
          <ul class="audit-list">
{checks}
          </ul>
          <div class="audit-badges">{badges}</div>
        </div>
        <form class="audit-form" id="auditForm" novalidate>
          <h3>{esc(a['form_title'])}</h3>
          <label>{esc(a['link_label'])}
            <input name="link" type="text" inputmode="url" autocomplete="url" required placeholder="{attr(a['link_placeholder'])}" dir="ltr">
          </label>
          <label>{esc(a['name_label'])}
            <input name="name" type="text" autocomplete="name" required placeholder="{attr(a['name_placeholder'])}">
          </label>
          <button class="btn btn-gold" type="submit"><svg class="i"><use href="#wa"/></svg>{esc(a['button'])}</button>
          <p class="audit-note">{esc(a['note'])}</p>
          <p class="audit-ok" role="status" hidden>{esc(a['done'])}</p>
        </form>
      </div>
    </div>
  </section>"""


def contact(c, lang, site):
    k = c["contact"]
    intl, local = phone(site)
    call = local if lang == "ar" else intl
    s = c["services"]
    opts = "\n".join(f"            <option>{esc(form_name(x))}</option>" for x in s["featured"] + s["others"])
    return f"""  <section class="cta" id="contact">
    <div class="wrap req">
      <div class="reveal">
        <span class="eyebrow">{esc(k['eyebrow'])}</span>
        <h2>{esc(k['title'])}</h2>
        <p class="lead">{esc(k['lead'])}</p>
        <div class="contact-list">
          <a class="contact-item" href="{wa_link(site)}" target="_blank" rel="noopener">
            <span class="chip-ic chip-wa"><svg width="22" height="22"><use href="#wa"/></svg></span>
            <span><small>{esc(k['whatsapp_label'])}</small><b>{intl}</b></span>
          </a>
          <a class="contact-item" href="tel:+{site['whatsapp']}">
            <span class="chip-ic"><svg class="i">{ICONS['phone']}</svg></span>
            <span><small>{nbsp(k['call_label'])}</small><b>{call}</b></span>
          </a>
        </div>
      </div>
      <form id="reqForm" class="reveal" novalidate>
        <h3>{esc(k['form_title'])}</h3>
        <label>{esc(k['name_label'])}
          <input type="text" name="name" required autocomplete="name" placeholder="{attr(k['name_placeholder'])}">
        </label>
        <label>{esc(k['service_label'])}
          <select name="service" required>
            <option value="">{esc(k['service_choose'])}</option>
{opts}
            <option>{esc(k['service_other'])}</option>
          </select>
        </label>
        <label><span>{esc(k['details_label'])} <span class="hint">{esc(k['details_hint'])}</span></span>
          <textarea name="details" placeholder="{attr(k['details_placeholder'])}"></textarea>
        </label>
        <button class="btn btn-wa" type="submit"><svg><use href="#wa"/></svg>{esc(k['button'])}</button>
        <p class="form-ok" role="status" hidden>{esc(k['done'])}</p>
      </form>
    </div>
  </section>"""


def faq(c):
    f = c["faq"]
    items = "\n".join(f"""        <details class="reveal">
          <summary>{esc(x['q'])}</summary>
          <p>{esc(x['a'])}</p>
        </details>""" for x in f["items"])
    return f"""  <section id="faq">
    <div class="wrap faq-grid">
      <div class="reveal">
        <span class="eyebrow">{esc(f['eyebrow'])}</span>
        <h2>{esc(f['title'])}</h2>
        <p class="lead">{esc(f['lead'])}</p>
      </div>
      <div>
{items}
      </div>
    </div>
  </section>"""


def dock(c, site):
    k = c["chat"]
    link = wa_link(site, k["prefill"])
    return (f'<aside aria-label="{attr(k["aria"])}" class="wa-dock" id="waDock"><div class="wa-bubble" id="waBubble" role="dialog" aria-label="{attr(k["bubble_aria"])}" aria-hidden="true">'
            f'<div class="wa-head"><img class="wa-av" src="/avatar.jpg" alt="" width="40" height="40" loading="lazy"><div><b>{esc(c["name"])}</b><small><i class="wa-on"></i>{esc(k["status"])}</small></div>'
            f'<button class="wa-close" id="waClose" type="button" aria-label="{attr(k["close"])}" tabindex="-1">&times;</button></div>'
            f'<div class="wa-body"><div class="wa-msg"><span class="wa-typing" aria-hidden="true"><i></i><i></i><i></i></span><p>{inline(k["message"])}</p></div></div>'
            f'<a class="wa-cta" href="{attr(link)}" target="_blank" rel="noopener" tabindex="-1"><svg><use href="#wa"/></svg>{esc(k["button"])}</a></div>'
            f'<a class="fab" href="{attr(link)}" target="_blank" rel="noopener" aria-label="{attr(k["fab_aria"])}"><span class="fab-ring" aria-hidden="true"></span><svg><use href="#wa"/></svg><span class="fab-badge" aria-hidden="true">1</span></a></aside>')


SECTIONS = ["HERO", "PLATFORMS", "STATS", "REGIONS", "SERVICES", "WHY", "STEPS", "CTA BAND", "CONTACT", "FAQ"]


def sub(src, pattern, repl):
    out, n = re.subn(pattern, lambda m: repl, src, count=1, flags=re.S)
    assert n == 1, pattern
    return out


def build():
    home, site, countries = load("home"), load("site"), load("countries")
    intl, local = phone(site)
    for lang, (path, url) in PAGES.items():
        c = home[lang]
        src = read(path)
        parts = {"HERO": hero(c), "PLATFORMS": platforms(c), "STATS": stats(c, site), "REGIONS": regions(c, lang, countries),
                 "SERVICES": services(c), "WHY": why(c), "STEPS": steps(c), "CTA BAND": audit(c),
                 "CONTACT": contact(c, lang, site), "FAQ": faq(c)}
        for name in SECTIONS:
            src = sub(src, rf"(?<=<!-- ===== {name} ===== -->\n)  <section.*?</section>", parts[name])
        seo = c["seo"]
        src = sub(src, r"<title>.*?</title>", f"<title>{esc(fit_title(seo['title']))}</title>")
        src = sub(src, r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{attr(seo["description"])}">')
        src = sub(src, r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{attr(seo["share_title"])}">')
        src = sub(src, r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{attr(seo["share_description"])}">')
        m = re.search(r'(<script type="application/ld\+json">\n)(\{.*?\})(\n</script>)', src, re.S)
        ld = json.loads(m.group(2))
        ld.update(jobTitle=seo["job_title"], telephone="+" + site["whatsapp"])
        src = src[:m.start(2)] + ld_json(ld, separators=(",", ":")) + src[m.end(2):]
        # footer
        foot = re.search(r"<footer>.*?</footer>", src, re.S).group(0)
        new = re.sub(r'(class="brand">.*?>)[^<>]*(</a>\s*<p>)[^<]*(</p>)', lambda m: m.group(1) + esc(c["name"]) + m.group(2) + esc(c["footer"]["about"]) + m.group(3), foot, count=1, flags=re.S)
        new = re.sub(r'href="https://wa\.me/\d+"', f'href="{wa_link(site)}"', new)
        new = re.sub(r'(<a href="tel:)\+\d+("[^>]*>)[^<]*(</a>)', lambda m: m.group(1) + "+" + site["whatsapp"] + m.group(2) + (local if lang == "ar" else intl) + m.group(3), new)
        new = re.sub(r'(<span id="y">\d+</span> )[^<]*(</span>)', lambda m: m.group(1) + esc(c["footer"]["rights"]) + m.group(2), new)
        src = src.replace(foot, new)
        src = sub(src, r'<aside aria-label=".*?</aside>', dock(c, site))
        # header brand name
        src = re.sub(r'(<a href="#" class="brand"><img class="avatar" src="/avatar.jpg" alt="" width="40" height="40">)[^<]*(</a>)', lambda m: m.group(1) + esc(c["name"]) + m.group(2), src, count=1)
        write(path, src)
    # the forms in main.js send to this number
    js = read("main.js")
    write("main.js", re.sub(r"var WA = '\d+';", f"var WA = '{site['whatsapp']}';", js, count=1))
    return [p for p, _ in PAGES.values()]


if __name__ == "__main__":
    print("built", *build(), sep="\n  ")
