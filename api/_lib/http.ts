// Small HTTP helpers shared by the functions.
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './types';

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function sendEmpty(res: VercelResponse, status: number): void {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(req: VercelRequest): string {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || String(req.headers['x-real-ip'] || 'unknown');
}

/** Rejects cross-site state-changing requests: Origin (when present) must be this site. */
export function sameOrigin(req: VercelRequest): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/** Parses a JSON body that may arrive as a string (text/plain beacons) or an object. */
export function jsonBody(req: VercelRequest): Record<string, unknown> | null {
  let b: unknown = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { return null; }
  }
  return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
}

export function clean(v: unknown, max = 200): string {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
}
