// Admin session: a signed, HttpOnly cookie issued after a correct password.
// The signing key is derived from ADMIN_KEY, so changing the password logs every session out.
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './types';

const COOKIE = 'wo_admin';
const MAX_AGE = 7 * 24 * 3600; // seconds

function secret(): Buffer | null {
  const key = process.env.ADMIN_KEY;
  return key ? createHash('sha256').update('session:' + key).digest() : null;
}

function sign(payload: string, key: Buffer): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

function equal(a: string, b: string): boolean {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_KEY);
}

export function passwordMatches(given: unknown): boolean {
  const key = process.env.ADMIN_KEY;
  return typeof given === 'string' && given.length > 0 && !!key && equal(given, key);
}

export function startSession(res: VercelResponse): void {
  const key = secret();
  if (!key) return;
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString('base64url');
  const value = payload + '.' + sign(payload, key);
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/api; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`);
}

export function endSession(res: VercelResponse): void {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
}

export function hasSession(req: VercelRequest): boolean {
  const key = secret();
  if (!key) return false;
  const raw = String(req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig || !equal(sig, sign(payload, key))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: number };
    return typeof exp === 'number' && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
