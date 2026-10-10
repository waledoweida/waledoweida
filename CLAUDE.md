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
- `.vercelignore` keeps repo-only files (`CLAUDE.md`, `tools/`, `tests/`, …) off the published site.
- **Content lives in `content/*.json`** (`site`, `home`, `countries`, `articles`, `icons`); the generated pages are committed.
  `python3 tools/build_all.py` rebuilds everything from it: the content sections of the home pages (`tools/build_home.py`
  fills the sections in place; head/header/scripts stay hand-written in the HTML), the country pages
  (`tools/build_countries.py`, also keeps their `vercel.json` header rules in sync and deletes pages of removed countries),
  the blog (`tools/build_blog.py`; article bodies use the simple text format in `tools/content.py`), `sitemap.xml` and the
  review page. Edit the JSON (or use `/admin/`), run `build_all.py`, commit both.
- Every write goes through `build_blog.write()`/`safe_path()`, which refuses paths outside the repo or under `wedding/` / `فرح/`.

## Hosting (Vercel) and visitor stats

- The site is served by Vercel from `main` (static files + the functions in `api/`); every merge to `main` deploys automatically.
- `api/` is TypeScript (`npm run typecheck`, `npm test`). `track.ts` stores anonymous events (views, contact clicks, visible time; country/city from Vercel's IP headers) in Redis; `login.ts` checks `ADMIN_KEY` (5 wrong tries per 15 min per address) and sets a signed HttpOnly session cookie; `stats.ts` needs that session.
- Security headers live in `vercel.json` as an explicit list of the site's paths. `wedding/` and `فرح/` are intentionally not listed so their responses stay untouched.
- Vercel env vars: `REDIS_URL` (set by Vercel's Redis integration; or `KV_REST_API_URL` + `KV_REST_API_TOKEN` for Upstash REST), `ADMIN_KEY` and `GITHUB_TOKEN`. Never commit their values. `package.json` holds the `redis` client plus dev-only TypeScript tooling.
- The tracker lives at the top of `main.js` (`TRACK_URL`); `/admin/` is noindex and disallowed in `robots.txt`.
- `/admin/` is the owner's control panel: stats plus a content editor (`admin/editor.js`) drawn from the schema in
  `api/_lib/schema.ts`. `api/content.ts` (session required) validates a save against that schema and commits
  `content/<file>.json` through the GitHub contents API using the `GITHUB_TOKEN` env var (fine-grained, this repo only,
  Contents: read and write). `.github/workflows/build-pages.yml` then runs `build_all.py` and commits
  "Rebuild pages from content"; `vercel.json`'s `ignoreCommand` skips the deploy for the content-only commit.
  The panel shows "building" while the latest commit on `main` is an `Admin: …` save.
- Change the schema and `content/*.json` together; the API rejects files that don't match it.

## Checks

- `npm run check` = types + API tests + HTML validation (`html-validate`, wedding excluded via `.htmlvalidateignore`).
- `.github/workflows/quality.yml` runs the same plus `npm audit` and verifies the generated pages match `content/` (runs `build_all.py`). Keep it green.
