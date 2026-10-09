// GET /api/stats?days=7 — summary for /admin/. Needs "Authorization: Bearer <ADMIN_KEY>".
const crypto = require('crypto');
const { redis, redisConfig, dayKey, summarize } = require('./_lib');

function sameKey(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false });
  const admin = process.env.ADMIN_KEY;
  const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!admin || !redisConfig()) return send(res, 503, { ok: false, error: 'not_configured' });
  if (!given || !sameKey(given, admin)) return send(res, 401, { ok: false, error: 'unauthorized' });

  const url = new URL(req.url, 'http://x');
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days'), 10) || 7, 1), 365);
  const now = Date.now();
  const keys = [];
  for (let i = 0; i < days; i++) keys.push('ev:' + dayKey(new Date(now - i * 864e5)));
  try {
    const lists = await redis(keys.map((k) => ['LRANGE', k, '0', '-1']));
    const events = [];
    for (const l of lists) for (const raw of l || []) { try { events.push(JSON.parse(raw)); } catch (e) {} }
    send(res, 200, summarize(events, days, now));
  } catch (e) {
    send(res, 502, { ok: false, error: 'storage' });
  }
};
