# waledoweida.com

Static personal/business site for وليد أحمد علي أبوعويضة, served by GitHub Pages.

## RED LINE — the wedding invitation is off-limits

**Never modify, move, rename, reformat, "fix", optimize or delete anything under:**

- `wedding/` (the invitation page and all its assets)
- `فرح/` (the shortcut that redirects to `/wedding/`)

This applies to every kind of change: content, design, security hardening, accessibility,
validation fixes, dependency updates, link checks, bulk find-and-replace, formatting.
Site-wide changes must exclude these paths. If a task seems to require touching them,
stop and ask the owner first.

> خط أحمر: دعوة الفرح (`wedding/` و `فرح/`) ممنوع أي تعديل أو تحديث عليها نهائيًا.

## Layout

- `index.html` — Arabic home (RTL), `en/index.html` — English home (LTR)
- `style.css`, `main.js` — shared by both home pages (bump the `?v=` query when changed)
- `404.html`, `robots.txt`, `sitemap.xml`, icons, `og.png`, `profile.jpg`, `avatar.jpg`
- Home pages carry a Content-Security-Policy meta; keep styles out of inline `style=""` attributes.
