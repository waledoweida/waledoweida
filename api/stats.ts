// GET /api/stats?days=7 — visitor summary for /admin/ (admin session cookie required).
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { redis, storageConfigured } from './_lib/redis';
import { sendJson } from './_lib/http';
import { adminConfigured, hasSession } from './_lib/session';
import { dayKey, summarize, type VisitEvent } from './_lib/stats';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return sendJson(res, 405, { ok: false }); }
  if (!adminConfigured() || !storageConfigured()) return sendJson(res, 503, { ok: false, error: 'not_configured' });
  if (!hasSession(req)) return sendJson(res, 401, { ok: false, error: 'unauthorized' });

  const days = Math.min(Math.max(parseInt(String(req.query.days ?? ''), 10) || 7, 1), 365);
  const now = Date.now();
  const keys: string[] = [];
  for (let i = 0; i < days; i++) keys.push('ev:' + dayKey(new Date(now - i * 864e5)));
  try {
    const lists = await redis(keys.map((k) => ['LRANGE', k, 0, -1]));
    const events: VisitEvent[] = [];
    for (const l of lists) {
      for (const raw of (Array.isArray(l) ? l : [])) {
        try { events.push(JSON.parse(String(raw)) as VisitEvent); } catch { /* skip bad row */ }
      }
    }
    return sendJson(res, 200, summarize(events, days, now));
  } catch {
    return sendJson(res, 502, { ok: false, error: 'storage' });
  }
}
