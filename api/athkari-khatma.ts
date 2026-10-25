// POST /api/athkari-khatma {code, juz, event, device} — called by the Athkari app after someone takes a
// part (juz) of a group khatma (event "claim") or finishes it ("done"). The server reads the khatma from
// Firestore (public read) and only sends when the part really is in that state for that device, so the
// endpoint can't be used to send made-up notifications. It then sends a data message to the khatma's
// FCM topic (khatma_<code>); the app shows it to everyone in the khatma except the device that did it.
// Each (khatma, part, event, device) is announced once.
//
// Uses the same ATHKARI_SERVICE_ACCOUNT env var as athkari-push.ts.
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { jsonBody, limitKey, sendJson } from './_lib/http';
import { hit } from './_lib/ratelimit';
import { accessToken, PROJECT, serviceAccount } from './athkari-push';

type Event = 'claim' | 'done';
interface Part { s: number; n: string; d: string }
export interface Khatma { name: string; round: number; parts: Record<number, Part> }

export function valid(b: Record<string, unknown> | null): { code: string; juz: number; event: Event; device: string } | null {
  const code = typeof b?.code === 'string' ? b.code : '';
  const juz = typeof b?.juz === 'number' ? b.juz : NaN;
  const event = b?.event;
  const device = typeof b?.device === 'string' ? b.device : '';
  if (!/^[A-Z0-9]{6}$/.test(code) || !Number.isInteger(juz) || juz < 1 || juz > 30) return null;
  if (event !== 'claim' && event !== 'done') return null;
  if (!/^[a-z0-9]{8}$/.test(device)) return null;
  return { code, juz, event, device };
}

/** Firestore REST document → the fields we use. */
export function parseKhatma(doc: unknown): Khatma | null {
  const f = (doc as { fields?: Record<string, any> })?.fields;
  if (!f) return null;
  const parts: Record<number, Part> = {};
  const raw = f.parts?.mapValue?.fields ?? {};
  for (let j = 1; j <= 30; j++) {
    const p = raw[String(j)]?.mapValue?.fields ?? {};
    parts[j] = { s: Number(p.s?.integerValue ?? p.s?.doubleValue ?? 0), n: String(p.n?.stringValue ?? ''), d: String(p.d?.stringValue ?? '') };
  }
  return { name: String(f.name?.stringValue ?? '').slice(0, 60), round: Number(f.round?.integerValue ?? 0), parts };
}

/** The notification text, or null when this event isn't worth announcing. */
export function message(k: Khatma, juz: number, event: Event): { title: string; body: string } | null {
  const p = k.parts[juz];
  const who = (p?.n || 'واحد من المشاركين').slice(0, 30);
  const title = k.name ? `ختمة ${k.name}` : 'الختمة الجماعية';
  const done = Object.values(k.parts).filter((x) => x.s === 2).length;
  const taken = Object.values(k.parts).filter((x) => x.s !== 0).length;
  if (event === 'claim') return { title, body: `${who} حجز الجزء ${juz} 📖 — اتحجز ${taken} من 30 جزء` };
  if (done === 30) return { title: `تمت ${title} 🎉`, body: 'اكتملت الأجزاء الثلاثين، تقبّل الله من الجميع وجعلها في ميزان حسناته' };
  const left = 30 - done;
  if (left <= 5) return { title, body: `${who} أتم الجزء ${juz} ✓ — فاضل ${left === 1 ? 'جزء واحد' : left === 2 ? 'جزءان' : `${left} أجزاء`} على الختم` };
  return { title, body: `${who} أتم الجزء ${juz} ✓ — اتقرا ${done} من 30 جزء` };
}

async function readKhatma(code: string): Promise<Khatma | null | 'missing'> {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/khatmas/${code}`);
  if (r.status === 404) return 'missing';
  if (!r.ok) throw new Error('firestore');
  return parseKhatma(await r.json());
}

/** GET ?c=CODE — the khatma's progress for its page on the site (names and states only, no device ids). */
async function show(req: VercelRequest, res: VercelResponse): Promise<void> {
  const code = String(req.query?.c ?? '');
  if (!/^[A-Z0-9]{6}$/.test(code)) return sendJson(res, 400, { ok: false, error: 'bad_request' });
  if (!(await hit('athkari-khatma-get:' + limitKey(req), 120, 3600))) return sendJson(res, 429, { ok: false, error: 'too_many' });
  let k: Khatma | null | 'missing';
  try { k = await readKhatma(code); } catch { return sendJson(res, 502, { ok: false, error: 'firestore' }); }
  if (k === 'missing' || !k) return sendJson(res, 404, { ok: false, error: 'no_khatma' });
  const parts = [];
  for (let j = 1; j <= 30; j++) parts.push({ s: k.parts[j].s, n: k.parts[j].s ? k.parts[j].n.slice(0, 30) : '' });
  res.setHeader('Cache-Control', 'public, max-age=20');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true, name: k.name, round: k.round, parts }));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'GET') return show(req, res);
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return sendJson(res, 405, { ok: false }); }
  const b = valid(jsonBody(req));
  if (!b) return sendJson(res, 400, { ok: false, error: 'bad_request' });
  if (!(await hit('athkari-khatma:' + limitKey(req), 60, 3600))) return sendJson(res, 429, { ok: false, error: 'too_many' });
  const sa = serviceAccount();
  if (!sa) return sendJson(res, 503, { ok: false, error: 'not_configured' });

  let got: Khatma | null | 'missing';
  try { got = await readKhatma(b.code); } catch { return sendJson(res, 502, { ok: false, error: 'firestore' }); }
  if (got === 'missing') return sendJson(res, 404, { ok: false, error: 'no_khatma' });
  const k = got;
  const p = k?.parts[b.juz];
  if (!k || !p || p.d !== b.device || p.s !== (b.event === 'claim' ? 1 : 2)) return sendJson(res, 409, { ok: false, error: 'state' });

  // once per (khatma round, part, event, device)
  if (!(await hit(`athkari-khatma-ev:${b.code}:${k.round}:${b.juz}:${b.event}:${b.device}`, 1, 7 * 86400))) {
    return sendJson(res, 200, { ok: true, sent: false });
  }
  const msg = message(k, b.juz, b.event);
  if (!msg) return sendJson(res, 200, { ok: true, sent: false });

  try {
    const token = await accessToken(sa);
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: {
          topic: `khatma_${b.code}`,
          data: { type: 'khatma', code: b.code, juz: String(b.juz), event: b.event, device: b.device, ...msg },
          android: { priority: 'HIGH', ttl: '86400s' },
        },
      }),
    });
    if (!r.ok) return sendJson(res, 502, { ok: false, error: 'fcm', status: r.status });
    return sendJson(res, 200, { ok: true, sent: true });
  } catch {
    return sendJson(res, 502, { ok: false, error: 'send_failed' });
  }
}
