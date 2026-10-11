// POST /api/track — anonymous visit events from main.js (sent with navigator.sendBeacon).
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { redis } from './_lib/redis';
import { clean, jsonBody, limitKey, sendEmpty } from './_lib/http';
import { hit } from './_lib/ratelimit';
import { DAY_CAP, EVENT_TYPES, KEEP_SECONDS, dayKey, type EventType, type VisitEvent } from './_lib/stats';

const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless/i;
const ID = /^[a-z0-9]{6,40}$/i;
const PATH = /^\/[^\s<>"']*$/;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendEmpty(res, 405); }
  if (BOT.test(String(req.headers['user-agent'] || ''))) return sendEmpty(res, 204);

  const d = jsonBody(req);
  const type = clean(d?.type, 10) as EventType;
  const vid = clean(d?.vid, 40);
  const path = clean(d?.path, 120);
  if (!d || !EVENT_TYPES.includes(type) || !ID.test(vid) || !PATH.test(path)) return sendEmpty(res, 400);

  // at most 60 events per minute from one address (IPv6: per /64)
  if (!(await hit('track:' + limitKey(req), 60, 60))) return sendEmpty(res, 429);

  let city = '';
  try { city = decodeURIComponent(String(req.headers['x-vercel-ip-city'] || '')); } catch { /* keep empty */ }
  const now = new Date();
  const sid = clean(d.sid, 40);
  const ev: VisitEvent = {
    ts: now.toISOString(), type, vid, sid: ID.test(sid) ? sid : vid,
    path, ref: clean(d.ref, 80), source: clean(d.source, 40), medium: clean(d.medium, 40),
    campaign: clean(d.campaign, 40), device: clean(d.device, 10), lang: clean(d.lang, 5), value: clean(d.value, 40),
    country: clean(req.headers['x-vercel-ip-country'], 4), city: clean(city, 40),
  };
  try {
    const key = 'ev:' + dayKey(now);
    // a fixed cap per day keeps storage small even if someone floods this endpoint
    // (storage that fills up would also stop the admin login, which needs it)
    await redis([['RPUSH', key, JSON.stringify(ev)], ['LTRIM', key, 0, DAY_CAP - 1], ['EXPIRE', key, KEEP_SECONDS]]);
    return sendEmpty(res, 204);
  } catch {
    return sendEmpty(res, 503);
  }
}
