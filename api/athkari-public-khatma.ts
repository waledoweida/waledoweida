// /api/athkari-public-khatma — the Athkari app's *public* khatma, run from the control panel.
//
// One public khatma is open at a time (settings/public_khatma → active). Anyone with the app takes one part
// (juz), reads it in the app's locked "read the part" mode, and the app sends the reading log. The server —
// not the phone — marks the part read, after checking:
//   - the part is held by this device and hasn't expired (a part goes back to free after `holdHours`),
//   - enough time passed since taking it, and every page of the part was on screen at least `minPageSec`,
//   - (optionally, ATHKARI_REQUIRE_APPCHECK=1) a valid Firebase App Check token from the real app.
// Phones can only read `public_khatmas` (firestore.rules); all writes come from here with the service account.
// When all 30 parts are taken, the next khatma opens by itself (if `repeat`), so new people can always join.
// When all 30 are read, everyone who took part (FCM topic pk_<id>) gets "the khatma is complete".
//
// App:   GET  ?d=<device>                         → active khatma + this device's part
//        POST {action: claim|release|done, id, device, juz?, log?}
// Panel: POST {action: admin_state|start|settings|stop|notify, idToken, ...}   (admin account only)
//
// Uses ATHKARI_SERVICE_ACCOUNT (Firestore + FCM), like athkari-push.ts.
import { createHash, createPublicKey, createVerify, randomInt } from 'node:crypto';
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { clean, jsonBody, limitKey, sendJson } from './_lib/http';
import { hit } from './_lib/ratelimit';
import { accessToken, ADMIN_EMAIL, PROJECT, serviceAccount, tokenEmail, type ServiceAccount } from './athkari-push';

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const SCOPE_DB = 'https://www.googleapis.com/auth/datastore';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** First page of each juz in the Madinah mushaf (604 pages); juz 30 ends at 604. Same table as the app. */
export const JUZ_START = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
export function juzPages(juz: number): number[] {
  const from = JUZ_START[juz - 1], to = juz < 30 ? JUZ_START[juz] - 1 : 604;
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

interface Part { s: number; d: string; at: number }
export interface PublicKhatma {
  id: string; name: string; dua: string; seq: number; status: 'open' | 'full' | 'done' | 'stopped';
  createdAt: number; doneAt: number; minPageSec: number; holdHours: number; repeat: boolean;
  parts: Record<number, Part>; updateTime: string;
}
export interface Settings { active: string; seq: number; name: string; dua: string; minPageSec: number; holdHours: number; repeat: boolean }

const num = (v: any) => Number(v?.integerValue ?? v?.doubleValue ?? 0);
const s = (v: any) => String(v?.stringValue ?? '');

export function parseKhatma(id: string, doc: any): PublicKhatma | null {
  const f = doc?.fields;
  if (!f) return null;
  const parts: Record<number, Part> = {};
  const raw = f.parts?.mapValue?.fields ?? {};
  for (let j = 1; j <= 30; j++) {
    const p = raw[String(j)]?.mapValue?.fields ?? {};
    parts[j] = { s: num(p.s), d: s(p.d), at: num(p.at) };
  }
  const st = s(f.status);
  return {
    id, name: s(f.name).slice(0, 80), dua: s(f.dua).slice(0, 400), seq: num(f.seq),
    status: (['open', 'full', 'done', 'stopped'].includes(st) ? st : 'open') as PublicKhatma['status'],
    createdAt: num(f.createdAt), doneAt: num(f.doneAt),
    minPageSec: num(f.minPageSec) || 15, holdHours: num(f.holdHours) || 6, repeat: f.repeat?.booleanValue !== false,
    parts, updateTime: String(doc.updateTime ?? ''),
  };
}

export function parseSettings(doc: any): Settings {
  const f = doc?.fields ?? {};
  return {
    active: s(f.active), seq: num(f.seq), name: s(f.name), dua: s(f.dua),
    minPageSec: num(f.minPageSec) || 15, holdHours: num(f.holdHours) || 6, repeat: f.repeat?.booleanValue !== false,
  };
}

const partValue = (p: Part) => ({ mapValue: { fields: { s: { integerValue: String(p.s) }, d: { stringValue: p.d }, at: { integerValue: String(p.at) } } } });
const partsValue = (parts: Record<number, Part>) => {
  const o: Record<string, unknown> = {};
  for (let j = 1; j <= 30; j++) o[String(j)] = partValue(parts[j]);
  return { mapValue: { fields: o } };
};

/** Parts held longer than holdHours without being read go back to free (done in every request, lazily). */
export function expire(k: PublicKhatma, now: number): number[] {
  const freed: number[] = [];
  for (let j = 1; j <= 30; j++) {
    const p = k.parts[j];
    if (p.s === 1 && now - p.at > k.holdHours * 3600_000) { k.parts[j] = { s: 0, d: '', at: 0 }; freed.push(j); }
  }
  return freed;
}

export const counts = (k: PublicKhatma) => {
  let taken = 0, done = 0;
  for (let j = 1; j <= 30; j++) { if (k.parts[j].s) taken++; if (k.parts[j].s === 2) done++; }
  return { taken, done };
};

/** What the app sees: states only (no device ids), and this device's part. */
export function view(k: PublicKhatma, device: string) {
  const c = counts(k);
  let mine: { juz: number; deadline: number; done: boolean } | null = null;
  const parts: number[] = [];
  for (let j = 1; j <= 30; j++) {
    const p = k.parts[j];
    parts.push(p.s);
    if (device && p.s && p.d === device && (!mine || p.s === 1)) mine = { juz: j, deadline: p.at + k.holdHours * 3600_000, done: p.s === 2 };
  }
  return {
    id: k.id, name: k.name, dua: k.dua, seq: k.seq, status: k.status, taken: c.taken, done: c.done, parts,
    minPageSec: k.minPageSec, holdHours: k.holdHours, mine,
  };
}

/**
 * Checks a reading log {page: seconds on screen} for a part: every page of the juz was on screen at least
 * minPageSec, and the time since taking the part is at least the sum (a little slack for clocks).
 */
export function checkLog(juz: number, log: unknown, minPageSec: number, heldMs: number): 'ok' | 'pages' | 'too_fast' {
  if (!log || typeof log !== 'object') return 'pages';
  const l = log as Record<string, unknown>;
  const pages = juzPages(juz);
  let total = 0;
  for (const p of pages) {
    const t = Number(l[String(p)]);
    if (!Number.isFinite(t) || t < minPageSec) return 'pages';
    total += Math.min(t, 3600);
  }
  if (heldMs < pages.length * minPageSec * 1000 * 0.9) return 'too_fast';
  return 'ok';
}

// ───────── Firebase App Check (optional) ─────────
let jwks: { at: number; keys: any[] } | null = null;
async function appCheckValid(token: string): Promise<boolean> {
  try {
    const [h, p, sig] = token.split('.');
    if (!h || !p || !sig) return false;
    const head = JSON.parse(Buffer.from(h, 'base64url').toString());
    const body = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (head.alg !== 'RS256') return false;
    if (!jwks || Date.now() - jwks.at > 6 * 3600_000) {
      const r = await fetch('https://firebaseappcheck.googleapis.com/v1/jwks');
      jwks = { at: Date.now(), keys: ((await r.json()) as { keys: any[] }).keys ?? [] };
    }
    const jwk = jwks.keys.find((k) => k.kid === head.kid);
    if (!jwk) return false;
    const v = createVerify('RSA-SHA256');
    v.update(`${h}.${p}`);
    if (!v.verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(sig, 'base64url'))) return false;
    const aud: string[] = Array.isArray(body.aud) ? body.aud : [body.aud];
    return body.iss === `https://firebaseappcheck.googleapis.com/${PROJECT_NUMBER()}` && aud.includes(`projects/${PROJECT}`)
      && body.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
const PROJECT_NUMBER = () => process.env.ATHKARI_PROJECT_NUMBER || '';

// ───────── Firestore ─────────
class Store {
  constructor(private token: string) {}
  private h() { return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }; }
  async raw(path: string): Promise<any | null> {
    const r = await fetch(`${BASE}/${path}`, { headers: this.h() });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('firestore');
    return r.json();
  }
  async settings(): Promise<Settings> { return parseSettings(await this.raw('settings/public_khatma')); }
  async khatma(id: string): Promise<PublicKhatma | null> {
    if (!/^[A-Z0-9]{8}$/.test(id)) return null;
    return parseKhatma(id, await this.raw(`public_khatmas/${id}`));
  }
  async write(path: string, fields: Record<string, unknown>, mask: string[] | null, updateTime?: string): Promise<'ok' | 'conflict'> {
    const q = [...(mask ?? []).map((m) => 'updateMask.fieldPaths=' + encodeURIComponent(m)),
      ...(updateTime ? ['currentDocument.updateTime=' + encodeURIComponent(updateTime)] : [])].join('&');
    const r = await fetch(`${BASE}/${path}${q ? '?' + q : ''}`, { method: 'PATCH', headers: this.h(), body: JSON.stringify({ fields }) });
    if (r.status === 409 || r.status === 412) return 'conflict';
    if (r.status === 400 && /precondition/i.test(await r.text().catch(() => ''))) return 'conflict';
    if (!r.ok) throw new Error('firestore');
    return 'ok';
  }
  /** Saves the parts and status of a khatma only if nobody changed it meanwhile. */
  saveKhatma(k: PublicKhatma, extra: Record<string, unknown> = {}): Promise<'ok' | 'conflict'> {
    return this.write(`public_khatmas/${k.id}`, {
      parts: partsValue(k.parts), status: { stringValue: k.status }, doneAt: { integerValue: String(k.doneAt) }, ...extra,
    }, ['parts', 'status', 'doneAt', ...Object.keys(extra)], k.updateTime);
  }
  async newKhatma(st: Settings, seq: number): Promise<PublicKhatma> {
    const id = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    const parts: Record<number, Part> = {};
    for (let j = 1; j <= 30; j++) parts[j] = { s: 0, d: '', at: 0 };
    const now = Date.now();
    await this.write(`public_khatmas/${id}`, {
      name: { stringValue: st.name }, dua: { stringValue: st.dua }, seq: { integerValue: String(seq) },
      status: { stringValue: 'open' }, createdAt: { integerValue: String(now) }, doneAt: { integerValue: '0' },
      minPageSec: { integerValue: String(st.minPageSec) }, holdHours: { integerValue: String(st.holdHours) },
      repeat: { booleanValue: st.repeat }, parts: partsValue(parts),
    }, null);
    await this.write('settings/public_khatma', { active: { stringValue: id }, seq: { integerValue: String(seq) } }, ['active', 'seq']);
    return (await this.khatma(id))!;
  }
}

async function fcm(sa: ServiceAccount, message: Record<string, unknown>): Promise<boolean> {
  try {
    const token = await accessToken(sa);
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

const notification = (topic: string, title: string, body: string, data: Record<string, string>) => ({
  topic, notification: { title, body }, data,
  android: { priority: 'HIGH', notification: { channel_id: 'broadcast_v1', icon: 'ic_stat_notify', color: '#1B4332', sound: 'default' } },
});

type Body = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Applies a change to a khatma with a few retries when someone else changed it at the same moment. */
async function change(store: Store, id: string,
  fn: (k: PublicKhatma) => string | null): Promise<{ k: PublicKhatma; error: string | null } | null> {
  for (let i = 0; i < 5; i++) {
    const k = await store.khatma(id);
    if (!k) return null;
    expire(k, Date.now());
    const error = fn(k);
    if (error) return { k, error };
    if ((await store.saveKhatma(k)) === 'ok') return { k, error: null };
  }
  return { k: (await store.khatma(id))!, error: 'busy' };
}

async function appHandler(req: VercelRequest, res: VercelResponse, store: Store, sa: ServiceAccount, b: Body) {
  const action = str(b.action);
  const device = str(b.device);
  const id = str(b.id);
  const juz = Number(b.juz);
  if (!/^[a-z0-9]{16}$/.test(device)) return sendJson(res, 400, { ok: false, error: 'bad_request' });
  if (!(await hit('pk:' + limitKey(req), 120, 3600))) return sendJson(res, 429, { ok: false, error: 'too_many' });

  if (action === 'claim') {
    let got = 0;
    const r = await change(store, id, (k) => {
      if (k.status !== 'open') return 'closed';
      for (let j = 1; j <= 30; j++) if (k.parts[j].s === 1 && k.parts[j].d === device) return 'has_part';
      const want = Number.isInteger(juz) && juz >= 1 && juz <= 30 ? juz : 0;
      got = want || (Array.from({ length: 30 }, (_, i) => i + 1).find((j) => k.parts[j].s === 0) ?? 0);
      if (!got || k.parts[got].s !== 0) return want ? 'taken' : 'closed';
      k.parts[got] = { s: 1, d: device, at: Date.now() };
      if (counts(k).taken === 30) k.status = 'full';
      return null;
    });
    if (!r) return sendJson(res, 404, { ok: false, error: 'no_khatma' });
    if (r.error) return sendJson(res, 409, { ok: false, error: r.error, khatma: view(r.k, device) });
    // all 30 taken: the next khatma opens so others can still join
    if (r.k.status === 'full' && r.k.repeat) {
      const st = await store.settings();
      if (st.active === r.k.id) await store.newKhatma({ ...st, name: r.k.name, dua: r.k.dua, minPageSec: r.k.minPageSec, holdHours: r.k.holdHours, repeat: r.k.repeat }, r.k.seq + 1);
    }
    return sendJson(res, 200, { ok: true, juz: got, khatma: view(r.k, device) });
  }

  if (action === 'release') {
    const r = await change(store, id, (k) => {
      const p = k.parts[juz];
      if (!p || p.s !== 1 || p.d !== device) return 'not_yours';
      k.parts[juz] = { s: 0, d: '', at: 0 };
      if (k.status === 'full') k.status = 'open';
      return null;
    });
    if (!r) return sendJson(res, 404, { ok: false, error: 'no_khatma' });
    if (r.error) return sendJson(res, 409, { ok: false, error: r.error, khatma: view(r.k, device) });
    return sendJson(res, 200, { ok: true, khatma: view(r.k, device) });
  }

  if (action === 'done') {
    if (process.env.ATHKARI_REQUIRE_APPCHECK === '1') {
      const t = String(req.headers['x-firebase-appcheck'] || '');
      if (!t || !(await appCheckValid(t))) return sendJson(res, 403, { ok: false, error: 'app_check' });
    }
    let finished = false;
    const r = await change(store, id, (k) => {
      const p = k.parts[juz];
      if (!p || p.s !== 1 || p.d !== device) return 'not_yours';
      const c = checkLog(juz, b.log, k.minPageSec, Date.now() - p.at);
      if (c !== 'ok') return c;
      k.parts[juz] = { s: 2, d: device, at: p.at };
      if (counts(k).done === 30) { k.status = 'done'; k.doneAt = Date.now(); finished = true; }
      return null;
    });
    if (!r) return sendJson(res, 404, { ok: false, error: 'no_khatma' });
    if (r.error) return sendJson(res, 409, { ok: false, error: r.error, khatma: view(r.k, device) });
    if (finished) {
      await fcm(sa, notification(`pk_${r.k.id}`, `تمت الختمة العامة رقم ${r.k.seq} 🎉`,
        'اكتملت الأجزاء الثلاثين وأنت منهم، تقبّل الله منا ومنكم', { type: 'public_khatma' }));
      const st = await store.settings();
      if (st.active === r.k.id && r.k.repeat) await store.newKhatma(st, r.k.seq + 1);
    }
    return sendJson(res, 200, { ok: true, finished, khatma: view(r.k, device) });
  }
  return sendJson(res, 400, { ok: false, error: 'bad_request' });
}

async function adminHandler(res: VercelResponse, store: Store, sa: ServiceAccount, b: Body) {
  let email: string | null;
  try { email = await tokenEmail(str(b.idToken)); } catch { return sendJson(res, 502, { ok: false, error: 'auth_unreachable' }); }
  if (email !== ADMIN_EMAIL) return sendJson(res, 401, { ok: false, error: 'not_admin' });
  const action = str(b.action);
  const st = await store.settings();
  const active = st.active ? await store.khatma(st.active) : null;
  if (active) expire(active, Date.now());

  if (action === 'admin_state') {
    return sendJson(res, 200, { ok: true, settings: st, khatma: active ? { ...view(active, ''), createdAt: active.createdAt } : null });
  }
  if (action === 'start' || action === 'settings') {
    const name = clean(b.name, 80).trim();
    const dua = clean(b.dua, 400).trim();
    const minPageSec = Math.min(Math.max(Math.round(Number(b.minPageSec) || 15), 5), 120);
    const holdHours = Math.min(Math.max(Math.round(Number(b.holdHours) || 6), 1), 48);
    const repeat = b.repeat !== false;
    if (!name) return sendJson(res, 400, { ok: false, error: 'name' });
    const next: Settings = { ...st, name, dua, minPageSec, holdHours, repeat };
    await store.write('settings/public_khatma', {
      name: { stringValue: name }, dua: { stringValue: dua }, minPageSec: { integerValue: String(minPageSec) },
      holdHours: { integerValue: String(holdHours) }, repeat: { booleanValue: repeat },
    }, ['name', 'dua', 'minPageSec', 'holdHours', 'repeat']);
    if (action === 'settings' && active && active.status !== 'done' && active.status !== 'stopped') {
      // the running khatma takes the new settings too (parts stay as they are)
      await store.write(`public_khatmas/${active.id}`, {
        name: { stringValue: name }, dua: { stringValue: dua }, minPageSec: { integerValue: String(minPageSec) },
        holdHours: { integerValue: String(holdHours) }, repeat: { booleanValue: repeat },
      }, ['name', 'dua', 'minPageSec', 'holdHours', 'repeat']);
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'start') {
      if (active && (active.status === 'open' || active.status === 'full')) {
        active.status = 'stopped';
        await store.saveKhatma(active);
      }
      const k = await store.newKhatma(next, (st.seq || 0) + 1);
      return sendJson(res, 200, { ok: true, khatma: view(k, '') });
    }
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'stop') {
    if (active && active.status !== 'done') { active.status = 'stopped'; await store.saveKhatma(active); }
    await store.write('settings/public_khatma', { active: { stringValue: '' } }, ['active']);
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'notify') {
    const title = clean(b.title, 80).trim() || 'شارك في الختمة العامة 🤍';
    const body = clean(b.body, 300).trim() || 'خُد جزء واقرأه من التطبيق، ونختم القرآن مع بعض';
    if (!active || active.status !== 'open') return sendJson(res, 409, { ok: false, error: 'no_open_khatma' });
    const ok = await fcm(sa, notification('all', title, body, { type: 'public_khatma' }));
    return sendJson(res, ok ? 200 : 502, { ok });
  }
  return sendJson(res, 400, { ok: false, error: 'bad_request' });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const sa = serviceAccount();
  if (!sa) return sendJson(res, 503, { ok: false, error: 'not_configured' });
  let store: Store;
  try { store = new Store(await accessToken(sa, SCOPE_DB)); } catch { return sendJson(res, 502, { ok: false, error: 'firestore' }); }

  try {
    if (req.method === 'GET') {
      const device = String(req.query?.d ?? '');
      if (device && !/^[a-z0-9]{16}$/.test(device)) return sendJson(res, 400, { ok: false, error: 'bad_request' });
      if (!(await hit('pk-get:' + limitKey(req), 600, 3600))) return sendJson(res, 429, { ok: false, error: 'too_many' });
      const st = await store.settings();
      const k = st.active ? await store.khatma(st.active) : null;
      // a part of the previous khatma may still be with this device (it filled up while they read)
      const prevId = String(req.query?.k ?? '');
      const prev = prevId && prevId !== st.active ? await store.khatma(prevId) : null;
      if (k) expire(k, Date.now());
      if (prev) expire(prev, Date.now());
      return sendJson(res, 200, {
        ok: true,
        khatma: k && k.status !== 'stopped' ? view(k, device) : null,
        previous: prev ? view(prev, device) : null,
      });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return sendJson(res, 405, { ok: false }); }
    const b: Body = jsonBody(req) ?? {};
    if (str(b.idToken)) return await adminHandler(res, store, sa, b);
    return await appHandler(req, res, store, sa, b);
  } catch {
    return sendJson(res, 502, { ok: false, error: 'firestore' });
  }
}

export const sha256 = (x: string) => createHash('sha256').update(x).digest('hex');
