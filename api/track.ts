// POST /api/track — anonymous visit events from main.js (sent with navigator.sendBeacon).
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { redis } from './_lib/redis';
import { clean, clientIp, jsonBody, sendEmpty } from './_lib/http';
import { hit } from './_lib/ratelimit';
import { EVENT_TYPES, KEEP_SECONDS, dayKey, type EventType, type VisitEvent } from './_lib/stats';

const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless/i;
const ID = /^[a-z0-9]{6,40}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendEmpty(res, 405); }
  if (BOT.test(String(req.headers['user-agent'] || ''))) return sendEmpty(res, 204);

  const d = jsonBody(req);
  const type = clean(d?.type, 10) as EventType;
  const vid = clean(d?.vid, 40);
  if (!d || !EVENT_TYPES.includes(type) || !ID.test(vid)) return sendEmpty(res, 400);

  // at most 120 events per minute from one address
  if (!(await hit('track:' + clientIp(req), 120, 60))) return sendEmpty(res, 429);

  let city = '';
  try { city = decodeURIComponent(String(req.headers['x-vercel-ip-city'] || '')); } catch { /* keep empty */ }
  const now = new Date();
  const sid = clean(d.sid, 40);
  const ev: VisitEvent = {
    ts: now.toISOString(), type, vid, sid: ID.test(sid) ? sid : vid,
    path: clean(d.path, 200), ref: clean(d.ref, 120), source: clean(d.source, 60), medium: clean(d.medium, 60),
    campaign: clean(d.campaign, 80), device: clean(d.device, 20), lang: clean(d.lang, 10), value: clean(d.value, 60),
    country: clean(req.headers['x-vercel-ip-country'], 4), city: clean(city, 60),
  };
  try {
    const key = 'ev:' + dayKey(now);
    await redis([['RPUSH', key, JSON.stringify(ev)], ['EXPIRE', key, KEEP_SECONDS]]);
    return sendEmpty(res, 204);
  } catch {
    return sendEmpty(res, 503);
  }
}
