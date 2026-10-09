// POST /api/track — anonymous visit events from main.js (sent with navigator.sendBeacon).
const { redis, dayKey, clean, KEEP_SECONDS } = require('./_lib');

const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless/i;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    const ua = req.headers['user-agent'] || '';
    if (BOT.test(ua)) { res.statusCode = 204; return res.end(); }
    let d = req.body;
    if (typeof d === 'string') d = JSON.parse(d);
    if (!d || typeof d !== 'object') throw new Error('bad body');
    const type = clean(d.type, 10);
    if (!['view', 'click', 'time'].includes(type) || !d.vid) { res.statusCode = 400; return res.end(); }
    let city = '';
    try { city = decodeURIComponent(req.headers['x-vercel-ip-city'] || ''); } catch (e) {}
    const now = new Date();
    const ev = {
      ts: now.toISOString(), type, vid: clean(d.vid, 40), sid: clean(d.sid, 40), path: clean(d.path, 200),
      ref: clean(d.ref, 120), source: clean(d.source, 60), medium: clean(d.medium, 60), campaign: clean(d.campaign, 80),
      device: clean(d.device, 20), lang: clean(d.lang, 10), value: clean(d.value, 60),
      country: clean(req.headers['x-vercel-ip-country'], 4), city: clean(city, 60),
    };
    const key = 'ev:' + dayKey(now);
    await redis([['RPUSH', key, JSON.stringify(ev)], ['EXPIRE', key, String(KEEP_SECONDS)]]);
    res.statusCode = 204;
    res.end();
  } catch (e) {
    res.statusCode = 400;
    res.end();
  }
};
