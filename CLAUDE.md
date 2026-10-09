# waledoweida.com

Static personal/business site for وليد أحمد علي أبوعويضة, hosted on Vercel (DNS at GoDaddy).

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
- Country pages: `tools/build_countries.py` generates `/egypt/`, `/libya/`, `/kuwait/`, `/gulf/` (+ `/en/...`) from `tools/countries.py`; it also refreshes `sitemap.xml`.

## Hosting (Vercel) and visitor stats

- The site is served by Vercel from `main` (static files + the functions in `api/`); every merge to `main` deploys automatically. `.vercelignore` keeps repo-only files off Vercel. GitHub Pages was the old host (`_config.yml`, `CNAME` are leftovers from it).
- `api/track.js` stores anonymous events (views, contact clicks, visible time; country/city from Vercel's IP headers) in Redis; `api/stats.js` returns the summary for `/admin/` when called with `Authorization: Bearer <ADMIN_KEY>`.
- Vercel env vars: `REDIS_URL` (set by Vercel's Redis integration; or `KV_REST_API_URL` + `KV_REST_API_TOKEN` for Upstash REST) and `ADMIN_KEY`. Never commit their values. `package.json` only exists for the `redis` client used by `api/`.
- The tracker lives at the top of `main.js` (`TRACK_URL`); `/admin/` is noindex and disallowed in `robots.txt`.
