# waledoweida.com

Static personal/business site for وليد أحمد علي أبوعويضة, served by GitHub Pages.

## RED LINE — the wedding invitation is off-limits

**Never modify, move, rename, reformat, "fix", optimize or delete anything under:**

- `wedding/` (the invitation page and all its assets)
- `فرح/` (the shortcut that redirects to `/wedding/`)

This applies to every kind of change and to every request, now or later: content, design,
security hardening, accessibility, validation fixes, dependency updates, link checks, bulk
find-and-replace, formatting, build scripts. Site-wide changes must exclude these paths.
The owner has decided the page stays exactly as it is. Do not touch it as a side effect of
any other request. The only exception is a request from the owner that explicitly names the
wedding page and asks to change it — and even then, confirm with them before doing anything.

A CI check (`.github/workflows/protect-wedding.yml`) fails any pull request or push that
changes these paths.

> خط أحمر: دعوة الفرح (`wedding/` و `فرح/`) ممنوع أي تعديل أو تحديث عليها نهائيًا.

## Layout

- `index.html` — Arabic home (RTL), `en/index.html` — English home (LTR)
- `style.css`, `main.js` — shared by both home pages (bump the `?v=` query when changed)
- `404.html`, `robots.txt`, `sitemap.xml`, icons, `og.png`, `profile.jpg`, `avatar.jpg`
- Home pages carry a Content-Security-Policy meta; keep styles out of inline `style=""` attributes.
- `_config.yml` keeps repo-only files (`CLAUDE.md`, `tools/`) off the published site.
- Blog: `tools/build_blog.py` generates `blog/` and `en/blog/` from the article sources in `tools/articles.py`; run it after editing an article and commit the output.
