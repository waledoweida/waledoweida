// Tests for api/download.ts (the /download/ page's backend). Cobalt and Redis are in-memory stand-ins.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.KV_REST_API_URL = 'https://redis.test';
process.env.KV_REST_API_TOKEN = 'tok';
process.env.COBALT_API_URL = 'https://cobalt.test/';
process.env.COBALT_API_KEY = 'key-123';

const store = new Map();
let cobaltReply = { status: 'tunnel', url: 'https://cobalt.test/tunnel?id=1', filename: 'video (1080p).mp4' };
let lastCobalt = null;
global.fetch = async (url, opt) => {
  if (url === 'https://redis.test/pipeline') {
    const out = JSON.parse(opt.body).map(([cmd, key]) => {
      if (cmd === 'INCR') { const n = (Number(store.get(key)) || 0) + 1; store.set(key, n); return n; }
      return 1;
    });
    return { ok: true, json: async () => out.map((result) => ({ result })) };
  }
  assert.equal(url, 'https://cobalt.test/');
  lastCobalt = { headers: opt.headers, body: JSON.parse(opt.body) };
  return { ok: true, json: async () => cobaltReply };
};

const mod = require('../.build/download.js');
const handler = mod.default;

function call({ method = 'POST', headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(b) { resolve({ status: this.statusCode, body: b ? JSON.parse(b) : null }); },
    };
    handler({ method, headers: { host: 'waledoweida.com', 'x-forwarded-for': '5.5.5.5', ...headers }, body, query: {} }, res);
  });
}

test('download returns the file link and sends the key to Cobalt only', async () => {
  const r = await call({ body: { url: 'youtube.com/watch?v=abc', mode: 'auto', quality: '720' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { kind: 'file', url: 'https://cobalt.test/tunnel?id=1', filename: 'video (1080p).mp4' });
  assert.equal(lastCobalt.headers.Authorization, 'Api-Key key-123');
  assert.equal(lastCobalt.body.url, 'https://youtube.com/watch?v=abc');
  assert.equal(lastCobalt.body.videoQuality, '720');
  assert.equal(lastCobalt.body.youtubeVideoCodec, 'h264');
  assert.ok(!JSON.stringify(r.body).includes('key-123'));
});

test('download picks vp9 above 1080p and safe defaults for unknown values', () => {
  assert.equal(mod.cobaltBody({ quality: '2160' }, 'https://x.com/a').youtubeVideoCodec, 'vp9');
  assert.equal(mod.cobaltBody({ quality: 'max' }, 'https://x.com/a').youtubeVideoCodec, 'vp9');
  const b = mod.cobaltBody({ quality: '9999', mode: 'evil', audioFormat: 'exe' }, 'https://x.com/a');
  assert.equal(b.videoQuality, '1080');
  assert.equal(b.downloadMode, 'auto');
  assert.equal(b.audioFormat, 'mp3');
});

test('download rejects bad links, methods and other sites', async () => {
  assert.equal((await call({ method: 'GET' })).status, 405);
  for (const url of ['', 'javascript:alert(1)', 'file:///etc/passwd', 'http://localhost/x', 'http://127.0.0.1/', 'https://user:pw@youtube.com/', 'notalink']) {
    assert.equal((await call({ body: { url } })).status, 400, url);
  }
  assert.equal((await call({ body: { url: 'https://youtu.be/a' }, headers: { origin: 'https://evil.example' } })).status, 403);
});

test('download passes Cobalt errors and pickers through', async () => {
  cobaltReply = { status: 'error', error: { code: 'error.api.content.video.unavailable' } };
  let r = await call({ body: { url: 'https://youtu.be/a' }, headers: { 'x-forwarded-for': '6.6.6.6' } });
  assert.equal(r.status, 422);
  assert.equal(r.body.error, 'error.api.content.video.unavailable');
  cobaltReply = { status: 'picker', picker: [{ type: 'photo', url: 'https://cobalt.test/p1', thumb: 'https://cobalt.test/t1' }, { bad: 1 }] };
  r = await call({ body: { url: 'https://www.instagram.com/p/abc/' }, headers: { 'x-forwarded-for': '6.6.6.6' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.kind, 'picker');
  assert.equal(r.body.items.length, 1);
});

test('download is rate limited per address', async () => {
  cobaltReply = { status: 'redirect', url: 'https://cdn.test/v.mp4', filename: 'v.mp4' };
  let last;
  for (let i = 0; i < 21; i++) last = await call({ body: { url: 'https://youtu.be/a' }, headers: { 'x-forwarded-for': '7.7.7.7' } });
  assert.equal(last.status, 429);
});
