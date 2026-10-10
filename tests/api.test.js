// API tests: run with `npm test` (compiles api/ to .build/ first).
// Storage is an in-memory stand-in for the Upstash REST API, so no Redis server is needed.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.KV_REST_API_URL = 'https://redis.test';
process.env.KV_REST_API_TOKEN = 'tok';
process.env.ADMIN_KEY = 'correct horse battery staple';

const store = new Map();
global.fetch = async (url, opt) => {
  assert.equal(url, 'https://redis.test/pipeline');
  const out = JSON.parse(opt.body).map(([cmd, key, ...a]) => {
    switch (cmd) {
      case 'RPUSH': { const l = store.get(key) || []; l.push(a[0]); store.set(key, l); return l.length; }
      case 'LRANGE': return store.get(key) || [];
      case 'INCR': { const n = (Number(store.get(key)) || 0) + 1; store.set(key, n); return n; }
      case 'GET': return store.has(key) ? String(store.get(key)) : null;
      case 'EXPIRE': return 1;
      default: throw new Error('unexpected ' + cmd);
    }
  });
  return { ok: true, json: async () => out.map((result) => ({ result })) };
};

const load = (p) => require('../.build/' + p).default;
const track = load('track.js'), stats = load('stats.js'), login = load('login.js'), logout = load('logout.js');

function call(handler, { method = 'GET', headers = {}, body, query = {} } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(b) { resolve({ status: this.statusCode, headers: this.headers, body: b ? JSON.parse(b) : null }); },
    };
    handler({ method, headers: { host: 'waledoweida.com', 'user-agent': 'Mozilla/5.0', ...headers }, body, query }, res);
  });
}

const view = (o = {}) => ({ type: 'view', vid: 'abc123def', sid: 'sess12345', path: '/', ref: 'www.google.com', device: 'mobile', lang: 'ar', ...o });

test('track stores a valid event with country and city', async () => {
  const r = await call(track, { method: 'POST', body: JSON.stringify(view()), headers: { 'x-vercel-ip-country': 'KW', 'x-vercel-ip-city': encodeURIComponent('حولي'), 'x-forwarded-for': '1.1.1.1' } });
  assert.equal(r.status, 204);
  const day = [...store.keys()].find((k) => k.startsWith('ev:'));
  const ev = JSON.parse(store.get(day)[0]);
  assert.equal(ev.country, 'KW');
  assert.equal(ev.city, 'حولي');
});

test('track rejects bad input, bots and wrong methods', async () => {
  assert.equal((await call(track, { method: 'GET' })).status, 405);
  assert.equal((await call(track, { method: 'POST', body: 'not json' })).status, 400);
  assert.equal((await call(track, { method: 'POST', body: view({ type: 'evil' }) })).status, 400);
  assert.equal((await call(track, { method: 'POST', body: view({ vid: '<script>' }) })).status, 400);
  assert.equal((await call(track, { method: 'POST', body: view(), headers: { 'user-agent': 'Googlebot' } })).status, 204);
});

test('track is rate limited per address', async () => {
  let last;
  for (let i = 0; i < 121; i++) last = await call(track, { method: 'POST', body: view(), headers: { 'x-forwarded-for': '9.9.9.9' } });
  assert.equal(last.status, 429);
});

test('stats requires a session', async () => {
  assert.equal((await call(stats, { query: { days: '7' } })).status, 401);
});

test('login: wrong password, lockout after 5 failures, cross-site refused', async () => {
  const ip = { 'x-forwarded-for': '2.2.2.2' };
  assert.equal((await call(login, { method: 'POST', body: { password: 'nope' }, headers: ip })).status, 401);
  for (let i = 0; i < 4; i++) await call(login, { method: 'POST', body: { password: 'nope' }, headers: ip });
  const locked = await call(login, { method: 'POST', body: { password: process.env.ADMIN_KEY }, headers: ip });
  assert.equal(locked.status, 429);
  const cross = await call(login, { method: 'POST', body: { password: process.env.ADMIN_KEY }, headers: { origin: 'https://evil.example', 'x-forwarded-for': '3.3.3.3' } });
  assert.equal(cross.status, 403);
});

test('login sets a secure HttpOnly cookie that unlocks stats; tampering is refused', async () => {
  const r = await call(login, { method: 'POST', body: { password: process.env.ADMIN_KEY }, headers: { 'x-forwarded-for': '4.4.4.4', origin: 'https://waledoweida.com' } });
  assert.equal(r.status, 200);
  const cookie = r.headers['set-cookie'];
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Strict/);
  const value = cookie.split(';')[0];
  const s = await call(stats, { query: { days: '7' }, headers: { cookie: value } });
  assert.equal(s.status, 200);
  assert.equal(s.body.visitors, 1);
  assert.equal(s.body.countries[0].name, 'الكويت');
  const forged = value.slice(0, -2) + (value.endsWith('A') ? 'BB' : 'AA');
  assert.equal((await call(stats, { headers: { cookie: forged } })).status, 401);
  const out = await call(logout, { method: 'POST', headers: { origin: 'https://waledoweida.com' } });
  assert.match(out.headers['set-cookie'], /Max-Age=0/);
});

test('changing ADMIN_KEY invalidates existing sessions', async () => {
  const r = await call(login, { method: 'POST', body: { password: process.env.ADMIN_KEY }, headers: { 'x-forwarded-for': '5.5.5.5' } });
  const value = r.headers['set-cookie'].split(';')[0];
  process.env.ADMIN_KEY = 'a new password';
  assert.equal((await call(stats, { headers: { cookie: value } })).status, 401);
});

// ---------- /api/content (admin editor) with a stand-in for the GitHub contents API ----------
const fs = require('node:fs');
const path = require('node:path');
const repoFiles = new Map();
for (const f of ['site', 'home', 'countries', 'articles', 'icons']) {
  repoFiles.set(`content/${f}.json`, { text: fs.readFileSync(path.join(__dirname, '..', 'content', f + '.json'), 'utf8'), sha: f.padEnd(40, '0').replace(/[^0-9a-f]/g, 'a') });
}
const commits = [];
const redisFetch = global.fetch;
global.fetch = async (url, opt = {}) => {
  if (!String(url).startsWith('https://api.github.com/')) return redisFetch(url, opt);
  assert.equal(opt.headers.Authorization, 'Bearer gh-test-token');
  const u = new URL(url);
  const m = u.pathname.match(/^\/repos\/waledoweida\/waledoweida\/contents\/(.+)$/);
  const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
  if (m && (!opt.method || opt.method === 'GET')) {
    const f = repoFiles.get(m[1]);
    return f ? json(200, { content: Buffer.from(f.text).toString('base64'), sha: f.sha }) : json(404, {});
  }
  if (m && opt.method === 'PUT') {
    const b = JSON.parse(opt.body), f = repoFiles.get(m[1]);
    if (!f) return json(404, {});
    if (b.sha !== f.sha) return json(409, {});
    const sha = (commits.length + 1).toString(16).padStart(40, 'c');
    repoFiles.set(m[1], { text: Buffer.from(b.content, 'base64').toString('utf8'), sha });
    commits.push(b.message);
    return json(200, { content: { sha } });
  }
  if (u.pathname === '/repos/waledoweida/waledoweida/commits/main') {
    return json(200, { commit: { message: commits.length ? commits[commits.length - 1] : 'Rebuild pages from content', committer: { date: '2026-10-10T10:00:00Z' } } });
  }
  return json(404, {});
};
const content = load('content.js');

async function session() {
  const r = await call(login, { method: 'POST', body: { password: process.env.ADMIN_KEY }, headers: { 'x-forwarded-for': '6.6.6.6' } });
  return { cookie: r.headers['set-cookie'].split(';')[0] };
}

test('content: needs a session and the GitHub token', async () => {
  assert.equal((await call(content)).status, 401);
  const h = await session();
  delete process.env.GITHUB_TOKEN;
  assert.equal((await call(content, { headers: h })).body.error, 'no_github_token');
  process.env.GITHUB_TOKEN = 'gh-test-token';
});

test('content: GET returns every file, the schema and the publish status', async () => {
  const h = await session();
  const r = await call(content, { headers: h });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body.files).sort(), ['articles', 'countries', 'home', 'site']);
  assert.equal(r.body.files.site.data.whatsapp, '201025926261');
  assert.ok(r.body.schema.home && r.body.icons.ads);
  assert.equal(r.body.status.state, 'live');
});

test('content: PUT validates, cleans and commits; then reports building', async () => {
  const h = await session();
  const g = await call(content, { headers: h });
  const home = g.body.files.home.data;
  home.ar.faq.items.push({ q: '  سؤال جديد؟  ', a: 'إجابة <script>alert(1)</script>\r\nسطر تاني' });
  const r = await call(content, { method: 'PUT', headers: { ...h, origin: 'https://waledoweida.com' }, body: { file: 'home', sha: g.body.files.home.sha, data: home } });
  assert.equal(r.status, 200);
  const savedFaq = JSON.parse(repoFiles.get('content/home.json').text).ar.faq.items.at(-1);
  assert.equal(savedFaq.q, 'سؤال جديد؟');                       // trimmed
  assert.equal(savedFaq.a, 'إجابة <script>alert(1)</script>\nسطر تاني');   // stored as text; the build escapes it
  assert.equal(commits.at(-1), 'Admin: update home page');
  const st = await call(content, { headers: h, query: { status: '1' } });
  assert.equal(st.body.status.state, 'building');
  // a save based on an old version is refused instead of overwriting
  const stale = await call(content, { method: 'PUT', headers: h, body: { file: 'home', sha: g.body.files.home.sha, data: home } });
  assert.equal(stale.status, 409);
});

test('content: PUT refuses bad data, unknown files, cross-site requests', async () => {
  const h = await session();
  const g = await call(content, { headers: h });
  const put = (file, data, extra = {}) => call(content, { method: 'PUT', headers: { ...h, ...extra }, body: { file, sha: g.body.files[file] ? g.body.files[file].sha : 'a'.repeat(40), data } });
  const site = g.body.files.site.data;
  assert.equal((await put('site', { ...site, whatsapp: '+20 10' })).status, 422);
  assert.equal((await put('site', { ...site, counter: { ...site.counter, base: -5 } })).status, 422);
  const countries = g.body.files.countries.data;
  assert.equal((await put('countries', [...countries, countries[0]])).status, 422);                       // duplicate link
  assert.equal((await put('countries', [{ ...countries[0], slug: 'wedding' }, ...countries.slice(1)])).status, 422); // reserved
  assert.equal((await put('countries', [{ ...countries[0], slug: '../x' }, ...countries.slice(1)])).status, 422);
  const arts = g.body.files.articles.data;
  assert.equal((await put('articles', [{ ...arts[0], icon: '<svg onload=x>' }, ...arts.slice(1)])).status, 422);
  assert.equal((await put('icons', {})).status, 400);
  assert.equal((await put('../package', {})).status, 400);
  assert.equal((await put('site', site, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await call(content, { method: 'DELETE', headers: h })).status, 405);
});
