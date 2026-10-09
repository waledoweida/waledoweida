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
