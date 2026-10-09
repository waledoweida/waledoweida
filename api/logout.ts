// POST /api/logout — ends the admin session.
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { sameOrigin, sendJson } from './_lib/http';
import { endSession } from './_lib/session';

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { ok: false }); }
  if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' });
  endSession(res);
  return sendJson(res, 200, { ok: true });
}
