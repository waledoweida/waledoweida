// GET /api/counter — the live "services delivered" number for the home pages (see _lib/counter.ts).
// Vercel's CDN keeps the answer for 5 minutes, so most visits never run this function.
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { sendEmpty, sendJson } from './_lib/http';
import { liveCount } from './_lib/counter';
import { COUNTER } from './_lib/counter-start';

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return sendEmpty(res, 405); }
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=300');
  sendJson(res, 200, { n: liveCount(COUNTER.base, COUNTER.start, Date.now()) });
}
