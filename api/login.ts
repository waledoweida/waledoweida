// POST /api/login {password} — starts an admin session. Rate limited per address.
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { clientIp, jsonBody, sameOrigin, sendJson } from './_lib/http';
import { hit, peek } from './_lib/ratelimit';
import { storageConfigured } from './_lib/redis';
import { adminConfigured, passwordMatches, startSession } from './_lib/session';

const MAX_FAILS = 5;          // wrong passwords allowed…
const WINDOW = 15 * 60;       // …per 15 minutes per address

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { ok: false }); }
  if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' });
  // the attempt limit lives in Redis; without it, refuse rather than allow unlimited guesses
  if (!adminConfigured() || !storageConfigured()) return sendJson(res, 503, { ok: false, error: 'not_configured' });

  const key = 'login:' + clientIp(req);
  let fails: number;
  try { fails = await peek(key, WINDOW, true); } catch { return sendJson(res, 503, { ok: false, error: 'storage' }); }
  if (fails >= MAX_FAILS) {
    res.setHeader('Retry-After', String(WINDOW));
    return sendJson(res, 429, { ok: false, error: 'too_many_attempts' });
  }
  const body = jsonBody(req);
  if (!passwordMatches(body?.password)) {
    try { await hit(key, MAX_FAILS, WINDOW, true); } catch { return sendJson(res, 503, { ok: false, error: 'storage' }); }
    return sendJson(res, 401, { ok: false, error: 'wrong_password' });
  }
  startSession(res);
  return sendJson(res, 200, { ok: true });
}
