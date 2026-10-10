// POST /api/login {password} — starts an admin session. Rate limited per address.
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { clientIp, jsonBody, sameOrigin, sendJson } from './_lib/http';
import { clear, hit } from './_lib/ratelimit';
import { storageConfigured } from './_lib/redis';
import { adminConfigured, passwordMatches, startSession } from './_lib/session';

const MAX_FAILS = 5;          // wrong passwords allowed…
const WINDOW = 15 * 60;       // …per 15 minutes per address

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { ok: false }); }
  if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' });
  // the attempt limit lives in Redis; without it, refuse rather than allow unlimited guesses
  if (!adminConfigured() || !storageConfigured()) return sendJson(res, 503, { ok: false, error: 'not_configured' });

  // every attempt is counted (atomically, before the password is checked) so parallel
  // requests can't slip past the limit; a correct password clears the count again
  const key = 'login:' + clientIp(req);
  let allowed: boolean;
  try { allowed = await hit(key, MAX_FAILS, WINDOW, true); } catch { return sendJson(res, 503, { ok: false, error: 'storage' }); }
  if (!allowed) {
    res.setHeader('Retry-After', String(WINDOW));
    return sendJson(res, 429, { ok: false, error: 'too_many_attempts' });
  }
  const body = jsonBody(req);
  if (!passwordMatches(body?.password)) return sendJson(res, 401, { ok: false, error: 'wrong_password' });
  await clear(key, WINDOW);
  startSession(res);
  return sendJson(res, 200, { ok: true });
}
