#!/usr/bin/env python3
"""Generate the client review page (review/ and en/review/).

Clients fill in a rating and review; main.js sends it to WhatsApp, formatted.
The page is noindex and not in the sitemap: the owner shares the link directly.
Never touches wedding/ or فرح/.

Usage:  python3 tools/build_review.py
"""
import re

from build_blog import L, chrome, page, read, write

T = {
    "ar": dict(
        path="/review/", alt="/en/review/",
        title="قيّم تجربتك معايا", lead="رأيك بيفرق معايا جدًا، وبيساعد ناس تانية تختار صح. مش هياخد منك أكتر من دقيقة.",
        name="اسمك", name_ph="اسمك", country="بلدك",
        countries=["مصر", "ليبيا", "الكويت", "السعودية", "الإمارات", "قطر", "البحرين", "عُمان", "بلد تاني"],
        service="الخدمة اللي اشتغلنا فيها", choose="اختار", rating="تقييمك", star=lambda n: "نجمة واحدة" if n == 1 else f"{n} نجوم",
        text="رأيك في الشغل", text_ph="احكيلي عن تجربتك: إيه اللي عجبك؟ وإيه اللي اتغيّر في شغلك بعدها؟",
        publish="إزاي تحب يظهر اسمك لو نشرت رأيك؟",
        publish_opts=["اسمي كامل", "الحروف الأولى من اسمي بس", "متنشرش رأيي، ده لوليد بس"],
        send="ابعت التقييم على واتساب", ok="شكرًا جدًا! اتفتح واتساب بتقييمك، دوس إرسال ❤",
    ),
    "en": dict(
        path="/en/review/", alt="/review/",
        title="Rate your experience", lead="Your opinion means a lot to me and helps others choose well. It takes less than a minute.",
        name="Your name", name_ph="Your name", country="Country",
        countries=["Egypt", "Libya", "Kuwait", "Saudi Arabia", "UAE", "Qatar", "Bahrain", "Oman", "Other"],
        service="Service we worked on", choose="Choose", rating="Your rating", star=lambda n: "1 star" if n == 1 else f"{n} stars",
        text="Your review", text_ph="Tell me about your experience: what did you like, and what changed for your business?",
        publish="How should your name appear if your review is published?",
        publish_opts=["My full name", "My initials only", "Don't publish — this is just for Waled"],
        send="Send review via WhatsApp", ok="Thank you so much! WhatsApp opened with your review — just hit send ❤",
    ),
}


def options(lang):
    """Service names, taken from the home page form so they stay in sync."""
    src = read(L[lang]["src"])
    return re.findall(r"<option>(.*?)</option>", src)[:11]


def build():
    for lang, t in T.items():
        d = L[lang]
        ch = chrome(lang, t["alt"])
        svc = "".join(f"<option>{o}</option>" for o in options(lang))
        ctry = "".join(f"<option>{c}</option>" for c in t["countries"])
        stars = "".join(
            f'<input type="radio" name="rating" id="r{n}" value="{n}" required>'
            f'<label for="r{n}"><span class="sr-only">{t["star"](n)}</span><span aria-hidden="true">★</span></label>'
            for n in range(5, 0, -1))
        pub = "".join(f"<option>{o}</option>" for o in t["publish_opts"])
        body = f"""  <section class="post-hero">
    <div class="wrap narrow">
      <h1>{t['title']}</h1>
      <p class="lead">{t['lead']}</p>
    </div>
  </section>

  <section class="posts">
    <div class="wrap narrow">
      <form id="reviewForm" class="review-form" novalidate>
        <label>{t['name']}
          <input type="text" name="name" required autocomplete="name" placeholder="{t['name_ph']}">
        </label>
        <div class="row2">
          <label>{t['country']}
            <select name="country"><option value="">{t['choose']}</option>{ctry}</select>
          </label>
          <label>{t['service']}
            <select name="service"><option value="">{t['choose']}</option>{svc}</select>
          </label>
        </div>
        <fieldset class="rating">
          <legend>{t['rating']}</legend>
          <div class="stars">{stars}</div>
        </fieldset>
        <label>{t['text']}
          <textarea name="text" required placeholder="{t['text_ph']}"></textarea>
        </label>
        <label>{t['publish']}
          <select name="publish">{pub}</select>
        </label>
        <button class="btn btn-wa" type="submit"><svg><use href="#wa"/></svg>{t['send']}</button>
        <p class="form-ok" role="status" hidden>{t['ok']}</p>
      </form>
    </div>
  </section>"""
        ld = {"@context": "https://schema.org", "@type": "WebPage", "name": t["title"], "inLanguage": lang}
        html = page(lang, title=f"{t['title']} | {d['short']}", desc=t["lead"], path=t["path"], alt_path=t["alt"],
                    og_type="website", ld=ld, body=body, ch=ch)
        html = html.replace('<meta name="theme-color"', '<meta name="robots" content="noindex">\n<meta name="theme-color"', 1)
        write(t["path"].strip("/") + "/index.html", html)
        print("built", t["path"])


if __name__ == "__main__":
    build()
