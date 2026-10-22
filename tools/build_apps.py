#!/usr/bin/env python3
"""Generate the apps pages ("تطبيقاتي") from content/apps.json:
  apps/ and en/apps/                 — the list of apps
  apps/<slug>/ and en/apps/<slug>/    — one page per app: details, screenshots and the download button
Screenshots and the app icon live in apps/<slug>/img/ (committed, not generated). The download link
(/apps/<slug>/download) is a redirect in vercel.json to the latest APK.
Never touches wedding/ or فرح/.

Usage:  python3 tools/build_apps.py
"""
import os
import shutil

from build_blog import L, ROOT, SITE, WA, chrome, page, page_title, safe_path, write
from content import attr, esc, load

T = {
    "ar": dict(
        path="/apps/", alt="/en/apps/", title="تطبيقاتي", h1="تطبيقات من تصميمي",
        lead="تطبيقات موبايل بصمّمها وبطوّرها بنفسي: شكل احترافي، سهلة الاستخدام، ومجانية.",
        details="التفاصيل والتحميل", download="تحميل للأندرويد", free="مجاني", version="الإصدار",
        size="الحجم", mb="ميجا", android="أندرويد", android_min="{v} أو أحدث", updated="آخر تحديث",
        features="المميزات", screens="صور من التطبيق", install="طريقة التثبيت", privacy="سياسة الخصوصية",
        made="تصميم وتطوير: وليد أبوعويضة", want_h="عايز تطبيق لمشروعك؟",
        want_p="بصمّم تطبيقات ومواقع احترافية بلوحة تحكم تحدّث منها المحتوى بنفسك. كلّمني ونتكلم عن فكرتك.",
        apk="ملف APK", all_apps="كل التطبيقات",
    ),
    "en": dict(
        path="/en/apps/", alt="/apps/", title="My apps", h1="Apps I've built",
        lead="Mobile apps I design and build myself: polished, easy to use, and free.",
        details="Details & download", download="Download for Android", free="Free", version="Version",
        size="Size", mb="MB", android="Android", android_min="{v} or newer", updated="Updated",
        features="Features", screens="Screenshots", install="How to install", privacy="Privacy policy",
        made="Designed & built by Waled Abu Oweida", want_h="Want an app for your business?",
        want_p="I build polished apps and websites with a control panel so you can update the content yourself. Let's talk about your idea.",
        apk="APK file", all_apps="All apps",
    ),
}

ICON = {
    "book": '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    "book-open": '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M8 7h8M8 11h6"/>',
    "headphones": '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    "mosque": '<path d="M3 21h18M5 21V11l7-6 7 6v10M10 21v-5h4v5"/>',
    "heart": '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
    "compass": '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
    "calendar": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    "star": '<path d="m12 2 2.4 7.4H22l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4L2 9.4h7.6z"/>',
    "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    "repeat": '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "share": '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    "android": '<path d="M17.6 9.5 19.4 6.3a.4.4 0 0 0-.7-.4l-1.9 3.2A11.4 11.4 0 0 0 12 8.1c-1.8 0-3.4.4-4.9 1L5.2 5.9a.4.4 0 1 0-.7.4l1.9 3.2A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.5zM7 15.3a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm10 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"/>',
}


def svg(key, cls="i"):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{ICON[key]}</svg>'


def apps():
    return load("apps")


def paths():
    out = []
    for lang in T:
        out.append(T[lang]["path"])
        out += [T[lang]["path"] + a["slug"] + "/" for a in apps()]
    out += [T["ar"]["path"] + a["slug"] + "/test/" for a in apps() if a.get("testing")]
    return out


def img(slug, name):
    return f"/apps/{slug}/img/{name}.webp"


def fmt_date(iso, lang):
    y, m, d = (int(x) for x in iso.split("-"))
    months = L[lang]["months"]
    return f"{d} {months[m - 1]} {y}" if lang == "ar" else f"{months[m - 1]} {d}, {y}"


def list_page(lang):
    t, d = T[lang], L[lang]
    cards = []
    for a in apps():
        x = a[lang]
        url = t["path"] + a["slug"] + "/"
        cards.append(f"""        <a class="app-card reveal" href="{url}">
          <img class="app-icon" src="{img(a['slug'], 'icon')}" alt="" width="72" height="72">
          <div class="app-card-body">
            <h2>{esc(x['name'])}</h2>
            <p>{esc(x['tagline'])}</p>
            <span class="app-chips"><span>{esc(t['free'])}</span><span>{esc(t['android'])}</span><span>{esc(t['version'])} {esc(a['version'])}</span></span>
            <span class="post-more">{esc(t['details'])} <svg class="i"><use href="#arrow"/></svg></span>
          </div>
        </a>""")
    body = f"""  <section class="post-hero">
    <div class="wrap">
      <div class="crumbs"><a href="{d['home']}">{esc(d['crumbs_home'])}</a> / <span>{esc(t['title'])}</span></div>
      <h1>{esc(t['h1'])}</h1>
      <p class="lead">{esc(t['lead'])}</p>
    </div>
  </section>

  <section class="apps">
    <div class="wrap">
      <div class="app-grid">
{chr(10).join(cards)}
      </div>
{want(lang)}
    </div>
  </section>"""
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "inLanguage": lang, "name": t["title"],
          "url": SITE + t["path"],
          "hasPart": [{"@type": "MobileApplication", "name": a[lang]["name"], "url": SITE + t["path"] + a["slug"] + "/"}
                      for a in apps()]}
    return page(lang, title=page_title(t["title"], d["short"]), desc=t["lead"], path=t["path"], alt_path=t["alt"],
                og_type="website", ld=ld, body=body, ch=chrome(lang, t["alt"]))


def want(lang):
    t, d = T[lang], L[lang]
    return f"""      <div class="band app-band reveal">
        <div>
          <h2>{esc(t['want_h'])}</h2>
          <p>{esc(t['want_p'])}</p>
        </div>
        <a class="btn btn-dark" href="{attr(WA)}" target="_blank" rel="noopener"><svg class="i"><use href="#wa"/></svg>{esc(d['cta_wa'])}</a>
      </div>"""


def app_page(lang, a):
    t, d = T[lang], L[lang]
    x = a[lang]
    slug = a["slug"]
    path = t["path"] + slug + "/"
    alt = T[L[lang]["other"]]["path"] + slug + "/"
    badges = "".join(f"<li>{esc(b)}</li>" for b in x["badges"])
    shots = "\n".join(
        f"""          <figure class="shot"><img src="{img(slug, s)}" alt="{attr(c)}" width="270" height="480" loading="lazy"><figcaption>{esc(c)}</figcaption></figure>"""
        for s, c in zip(a["screens"], x["screens"]))
    feats = "\n".join(f"""        <div class="app-feat reveal">
          <span class="ic">{svg(f['icon'])}</span>
          <h3>{esc(f['t'])}</h3>
          <p>{esc(f['d'])}</p>
        </div>""" for f in x["features"])
    steps = "\n".join(f"""        <li><b>{esc(s['t'])}</b><span>{esc(s['d'])}</span></li>""" for s in x["steps"])
    facts = [
        (t["version"], a["version"]),
        (t["size"], f"{a['size_mb']} {t['mb']}"),
        (t["android"], t["android_min"].format(v=a["android"])),
        (t["updated"], fmt_date(a["updated"], lang)),
    ]
    facts_html = "".join(f"<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>" for k, v in facts)
    test_btn = (f"""\n            <a class="btn btn-ghost app-dl" href="{t['path']}{slug}/test/">{svg('check')}<span>{esc(a['testing']['cta'])}<small>{esc(a['testing']['cta_small'])}</small></span></a>"""
                if lang == "ar" and a.get("testing") else "")
    dl = f"""<a class="btn btn-gold app-dl" href="{a['download']}" download>{svg('android')}<span>{esc(t['download'])}<small>{esc(t['free'])} • {esc(t['apk'])} • {a['size_mb']} {esc(t['mb'])}</small></span></a>"""
    body = f"""  <section class="post-hero app-hero">
    <div class="wrap">
      <div class="crumbs"><a href="{d['home']}">{esc(d['crumbs_home'])}</a> / <a href="{t['path']}">{esc(t['title'])}</a> / <span>{esc(x['name'])}</span></div>
      <div class="app-head">
        <img class="app-icon big" src="{img(slug, 'icon')}" alt="{attr(x['name'])}" width="112" height="112">
        <div>
          <h1>{esc(x['name'])}</h1>
          <p class="app-tag">{esc(x['tagline'])}</p>
          <p class="lead">{esc(x['summary'])}</p>
          <ul class="app-badges">{badges}</ul>
          <div class="app-cta">
            {dl}{test_btn}
          </div>
          <dl class="app-facts">{facts_html}</dl>
        </div>
      </div>
    </div>
  </section>

  <section class="app-shots-sec">
    <div class="wrap">
      <h2 class="app-h2">{esc(t['screens'])}</h2>
      <div class="app-shots">
{shots}
      </div>
    </div>
  </section>

  <section class="app-feats-sec">
    <div class="wrap">
      <h2 class="app-h2">{esc(t['features'])}</h2>
      <div class="app-feats">
{feats}
      </div>
    </div>
  </section>

  <section class="app-install">
    <div class="wrap narrow">
      <h2 class="app-h2">{esc(t['install'])}</h2>
      <ol class="app-steps">
{steps}
      </ol>
      <div class="app-cta center">{dl}</div>
      <p class="app-note">{esc(x['note'])} <a href="{attr(a['privacy'])}" target="_blank" rel="noopener">{esc(t['privacy'])}</a></p>
      <p class="app-made">{esc(t['made'])}<br><a class="app-phone" href="{attr(WA)}" target="_blank" rel="noopener"><svg class="i"><use href="#wa"/></svg><span dir="ltr">0102 592 6261</span></a></p>
{want(lang)}
    </div>
  </section>"""
    ld = {
        "@context": "https://schema.org", "@type": "MobileApplication", "name": x["name"], "inLanguage": lang,
        "description": x["summary"], "url": SITE + path, "operatingSystem": f"Android {a['android']}+",
        "applicationCategory": "LifestyleApplication", "softwareVersion": a["version"],
        "fileSize": f"{a['size_mb']}MB", "downloadUrl": SITE + a["download"], "image": SITE + img(slug, "icon"),
        "screenshot": [SITE + img(slug, s) for s in a["screens"][:4]],
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "author": {"@type": "Person", "name": d["name"], "url": SITE + d["home"]},
    }
    title = f"{x['name']} — {x['tagline']}"
    return page(lang, title=page_title(title, d["short"]), desc=x["summary"], path=path, alt_path=alt,
                og_type="website", ld=ld, body=body, ch=chrome(lang, alt))


KHATMA = dict(
    title="ختمة جماعية", h1="انضم للختمة الجماعية",
    lead="اتدعيت تشارك في ختمة قرآن جماعية على تطبيق أذكاري: كل واحد يحجز جزء ويقراه، ونكمّل الختمة سوا صدقة جارية.",
    code="كود الختمة", open="افتح الختمة في التطبيق", no_app="لسه معندكش التطبيق؟",
    steps=[
        ("حمّل أذكاري", "لو التطبيق مش متثبّت عندك، حمّله مجانًا من الزرار اللي تحت."),
        ("افتح الختمة", "دوس «افتح الختمة في التطبيق»، أو من التطبيق: الرئيسية ← ختمة جماعية ← انضم بكود، واكتب الكود."),
        ("احجز جزءك", "اختار جزء فاضي، واكتب اسمك، ولما تخلّص قراءته علّمه «تم»."),
    ],
)


def khatma_page(a):
    """/apps/<slug>/khatma/?c=CODE — the link the app shares for a group khatma. join.js reads the code and points
    the button at the app (athkari://khatma/CODE, falling back to this app's page when it isn't installed)."""
    t, d, k = T["ar"], L["ar"], KHATMA
    slug, x = a["slug"], a["ar"]
    path = t["path"] + slug + "/khatma/"
    steps = "\n".join(f"""        <li><b>{esc(h)}</b><span>{esc(b)}</span></li>""" for h, b in k["steps"])
    dl = f"""<a class="btn btn-gold app-dl" href="{a['download']}" download>{svg('android')}<span>{esc(t['download'])}<small>{esc(t['free'])} • {esc(t['apk'])} • {a['size_mb']} {esc(t['mb'])}</small></span></a>"""
    body = f"""  <section class="post-hero app-hero">
    <div class="wrap narrow">
      <div class="crumbs"><a href="{d['home']}">{esc(d['crumbs_home'])}</a> / <a href="{t['path']}{slug}/">{esc(x['name'])}</a> / <span>{esc(k['title'])}</span></div>
      <div class="app-head">
        <img class="app-icon big" src="{img(slug, 'icon')}" alt="{attr(x['name'])}" width="112" height="112">
        <div>
          <h1>{esc(k['h1'])}</h1>
          <p class="lead">{esc(k['lead'])}</p>
          <p class="khatma-code" id="khatma-code" hidden>{esc(k['code'])}: <b dir="ltr" id="khatma-code-val"></b></p>
          <div class="app-cta">
            <a class="btn btn-gold app-dl" id="khatma-open" href="{t['path']}{slug}/" data-fallback="{SITE}{t['path']}{slug}/">{svg('book-open')}<span>{esc(k['open'])}</span></a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="app-install">
    <div class="wrap narrow">
      <h2 class="app-h2">{esc(k['no_app'])}</h2>
      <ol class="app-steps">
{steps}
      </ol>
      <div class="app-cta center">{dl}</div>
      <p class="app-made">{esc(t['made'])}<br><a class="app-phone" href="{attr(WA)}" target="_blank" rel="noopener"><svg class="i"><use href="#wa"/></svg><span dir="ltr">0102 592 6261</span></a></p>
    </div>
  </section>
  <script src="/apps/{slug}/khatma/join.js" defer></script>"""
    ld = {"@context": "https://schema.org", "@type": "WebPage", "inLanguage": "ar", "name": k["title"], "url": SITE + path}
    return page("ar", title=page_title(f"{k['title']} — {x['name']}", d["short"]), desc=k["lead"], path=path,
                alt_path=T["en"]["path"] + slug + "/", og_type="website", ld=ld, body=body,
                ch=chrome("ar", T["en"]["path"] + slug + "/"))


def testing_page(a):
    """/apps/<slug>/test/ — how to join the app's Google Play closed test: the features, the two links
    (the testers' Google Group, then Google Play's opt-in page) and the download, step by step."""
    t, d, x = T["ar"], L["ar"], a["ar"]
    k = a["testing"]
    slug = a["slug"]
    path = t["path"] + slug + "/test/"
    group, optin = k["group"], k["optin"]
    feats = "\n".join(f"""        <div class="app-feat">
          <span class="ic">{svg(f['icon'])}</span>
          <h3>{esc(f['t'])}</h3>
          <p>{esc(f['d'])}</p>
        </div>""" for f in k["features"])
    steps = "\n".join(f"""        <li class="tst-step">
          <b>{esc(st['t'])}</b>
          <span>{esc(st['d'])}</span>
          {''.join(f'<em>{esc(n)}</em>' for n in st.get('notes', []))}
          {f'<a class="btn btn-gold" href="{attr(st["url"])}" target="_blank" rel="noopener">{svg(st["icon"])}{esc(st["btn"])}</a><code dir="ltr">{esc(st["url"].split("://")[1])}</code>' if st.get('url') else ''}
        </li>""" for st in k["steps"])
    notes = "\n".join(f"""        <li><b>{esc(n['t'])}</b><span>{esc(n['d'])}</span></li>""" for n in k["notes"])
    badges = "".join(f"<li>{esc(b)}</li>" for b in k["badges"])
    share = "https://wa.me/?text=" + __import__("urllib.parse").parse.quote(k["share"] + "\n" + SITE + path)
    body = f"""  <section class="post-hero app-hero">
    <div class="wrap">
      <div class="crumbs"><a href="{d['home']}">{esc(d['crumbs_home'])}</a> / <a href="{t['path']}">{esc(t['title'])}</a> / <a href="{t['path']}{slug}/">{esc(x['name'])}</a> / <span>{esc(k['crumb'])}</span></div>
      <div class="app-head">
        <img class="app-icon big" src="{img(slug, 'icon')}" alt="{attr(x['name'])}" width="112" height="112">
        <div>
          <h1>{esc(k['h1'])}</h1>
          <p class="app-tag">{esc(k['tag'])}</p>
          <p class="lead">{esc(k['lead'])}</p>
          <ul class="app-badges">{badges}</ul>
          <div class="app-cta">
            <a class="btn btn-gold" href="#steps">{svg('check')}{esc(k['start'])}</a>
            <a class="btn btn-ghost" href="{attr(share)}" target="_blank" rel="noopener">{svg('share')}{esc(k['share_btn'])}</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="app-feats-sec">
    <div class="wrap">
      <h2 class="app-h2">{esc(k['feats_h'])}</h2>
      <div class="app-feats">
{feats}
      </div>
    </div>
  </section>

  <section class="app-install" id="steps">
    <div class="wrap narrow">
      <h2 class="app-h2">{esc(k['steps_h'])}</h2>
      <p class="tst-lead">{esc(k['steps_lead'])}</p>
      <ol class="tst-steps">
{steps}
      </ol>

      <h2 class="app-h2 tst-h2">{esc(k['notes_h'])}</h2>
      <ul class="tst-notes">
{notes}
      </ul>

      <div class="tst-alt">
        <p>{esc(k['alt'])}</p>
        <a class="btn btn-line" href="{t['path']}{slug}/">{svg('android')}{esc(k['alt_btn'])}</a>
      </div>

      <p class="tst-dua">{esc(k['dua'])}</p>
      <div class="app-cta center"><a class="btn btn-gold" href="{attr(share)}" target="_blank" rel="noopener">{svg('share')}{esc(k['share_btn'])}</a></div>
      <p class="app-made">{esc(t['made'])}<br><a class="app-phone" href="{attr(WA)}" target="_blank" rel="noopener"><svg class="i"><use href="#wa"/></svg><span dir="ltr">0102 592 6261</span></a></p>
    </div>
  </section>"""
    ld = {"@context": "https://schema.org", "@type": "HowTo", "inLanguage": "ar", "name": k["h1"], "url": SITE + path,
          "description": k["lead"],
          "step": [{"@type": "HowToStep", "position": i + 1, "name": st["t"], "text": st["d"]} for i, st in enumerate(k["steps"])]}
    return page("ar", title=page_title(f"{k['h1']} — {x['name']}", d["short"]), desc=k["lead"], path=path,
                alt_path=T["en"]["path"] + slug + "/", og_type="website", ld=ld, body=body,
                ch=chrome("ar", T["en"]["path"] + slug + "/"))


def build():
    for lang, t in T.items():
        write(t["path"].strip("/") + "/index.html", list_page(lang))
        for a in apps():
            folder = os.path.join(ROOT, "apps", a["slug"], "img")
            missing = [n for n in ["icon"] + a["screens"] if not os.path.exists(os.path.join(folder, n + ".webp"))]
            if missing:
                raise SystemExit(f"apps/{a['slug']}/img/: missing {missing}")
            write(t["path"].strip("/") + "/" + a["slug"] + "/index.html", app_page(lang, a))
            if lang == "ar" and a.get("testing"):
                write(f"apps/{a['slug']}/test/index.html", testing_page(a))
            if lang == "ar" and a.get("khatma"):
                write(f"apps/{a['slug']}/khatma/index.html", khatma_page(a))
    return paths()


def prune():
    """Delete the pages of apps that were removed from content/apps.json (their images stay until removed by hand)."""
    keep = {a["slug"] for a in apps()}
    for base in ("apps", "en/apps"):
        full = os.path.join(ROOT, base)
        if not os.path.isdir(full):
            continue
        for name in os.listdir(full):
            page_dir = os.path.join(full, name)
            if os.path.isdir(page_dir) and name not in keep and name != "img":
                idx = os.path.join(page_dir, "index.html")
                if os.path.exists(idx):
                    os.remove(safe_path(os.path.relpath(idx, ROOT)))
                if base == "en/apps" and not os.listdir(page_dir):
                    shutil.rmtree(safe_path(os.path.relpath(page_dir, ROOT)))


if __name__ == "__main__":
    print("built", *build(), sep="\n  ")
