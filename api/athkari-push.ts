// POST /api/athkari-push {idToken, title, body} — sends a push notification to every user of the
// Athkari app (Firebase Cloud Messaging topic "all"). Called from the app's control panel
// (/athkari-admin/). Only the panel's admin account may send: the Firebase ID token is checked
// with Google, and its email must be the admin's.
//
// Needs the Vercel env var ATHKARI_SERVICE_ACCOUNT: the Firebase service-account JSON key of the
// athkari project (Project settings → Service accounts → Generate new private key), pasted as is.
import { createSign } from 'crypto';
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { clean, jsonBody, limitKey, sameOrigin, sendJson } from './_lib/http';
import { hit } from './_lib/ratelimit';

const PROJECT = 'athkari-fd56c';
const WEB_API_KEY = 'AIzaSyD4ih7NvJNF_VadjfLLtLfhppsMfPl9uMk'; // public Firebase web key (not a secret)
const ADMIN_EMAIL = 'abwwydtwlydahmd@gmail.com';
const TOPIC = 'all';

interface ServiceAccount { client_email: string; private_key: string }

export function serviceAccount(raw = process.env.ATHKARI_SERVICE_ACCOUNT): ServiceAccount | null {
  if (!raw) return null;
  try {
    raw = raw.trim().replace(/^['"`]+|['"`]+$/g, '').trim(); // tolerate a value pasted with quotes around it
    const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const j = JSON.parse(text) as Partial<ServiceAccount>;
    if (typeof j.client_email !== 'string' || typeof j.private_key !== 'string') return null;
    return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, '\n') };
  } catch {
    return null;
  }
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

/** A Google OAuth access token for FCM, from a JWT signed with the service account key. */
async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${head}.${claims}`);
  const jwt = `${head}.${claims}.${b64url(signer.sign(sa.private_key))}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  const d = (await r.json().catch(() => ({}))) as { access_token?: string };
  if (!r.ok || !d.access_token) throw new Error('oauth');
  return d.access_token;
}

/** The email behind a Firebase ID token (Google checks the token), or null if it isn't valid. */
async function tokenEmail(idToken: string): Promise<string | null> {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
  });
  if (!r.ok) return null;
  const d = (await r.json().catch(() => ({}))) as { users?: { email?: string }[] };
  return d.users?.[0]?.email?.toLowerCase() ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { ok: false }); }
  if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' });
  const sa = serviceAccount();
  if (!sa) return sendJson(res, 503, { ok: false, error: 'not_configured' });
  if (!(await hit('athkari-push:' + limitKey(req), 30, 3600))) return sendJson(res, 429, { ok: false, error: 'too_many' });

  const body = jsonBody(req);
  const idToken = typeof body?.idToken === 'string' ? body.idToken : '';
  const title = clean(body?.title, 80).trim();
  const text = clean(body?.body, 400).trim();
  if (!idToken || !title) return sendJson(res, 400, { ok: false, error: 'bad_request' });

  let email: string | null;
  try { email = await tokenEmail(idToken); } catch { return sendJson(res, 502, { ok: false, error: 'auth_unreachable' }); }
  if (email !== ADMIN_EMAIL) return sendJson(res, 401, { ok: false, error: 'not_admin' });

  try {
    const token = await accessToken(sa);
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: {
          topic: TOPIC,
          notification: { title, body: text },
          android: {
            priority: 'HIGH',
            notification: { channel_id: 'broadcast_v1', icon: 'ic_stat_notify', color: '#1B4332', sound: 'default' },
          },
        },
      }),
    });
    const d = (await r.json().catch(() => ({}))) as { name?: string };
    if (!r.ok) return sendJson(res, 502, { ok: false, error: 'fcm', status: r.status });
    return sendJson(res, 200, { ok: true, id: d.name ?? '' });
  } catch {
    return sendJson(res, 502, { ok: false, error: 'send_failed' });
  }
}
