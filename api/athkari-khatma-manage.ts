// POST /api/athkari-khatma-manage {code, action, ...} — privacy and control for the Athkari group khatma.
//
// - A *private* khatma (PIN of 4 digits) can't be read from Firestore by the app at all (rules: get is denied
//   when `private` is true); members read and change it only through here, with the PIN. The PIN is stored
//   only as sha256("athkari-khatma:<code>:<pin>") in the document, which nobody but this server can read.
//   Wrong PINs are limited per address and per khatma, like the admin login.
// - The *owner* (the phone that created the khatma) keeps a random key; the document stores only its
//   sha256 (`owner`). With the key the owner can lock/unlock, rename, free a part (remove a name),
//   set/change/remove the PIN, and move the khatma to a new link (the old code stops working).
//
// Actions:
//   view                      (pin or ownerKey)  → {name, round, locked, private, owner, parts:[{s, n, mine}]}
//   claim {juz, name, device} (pin)              → take a free part
//   done  {juz, done, device} (pin)              → mark my part read / not yet
//   release {juz, device}     (pin)              → give back my part
//   round                     (pin)              → start the next round after all 30 parts are read
//   lock {locked} · rename {name} · free {juz} · pin {pin|""} · relink   (ownerKey)
//
// Public (non-private) khatmas keep working directly with Firestore as before; for them this endpoint is
// only used for the owner actions. Uses the ATHKARI_SERVICE_ACCOUNT env var (Firestore access).
import { createHash, randomInt } from 'node:crypto';
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { jsonBody, limitKey, sendJson } from './_lib/http';
import { clear, hit, peek } from './_lib/ratelimit';
import { storageConfigured } from './_lib/redis';
import { accessToken, PROJECT, serviceAccount, type ServiceAccount } from './athkari-push';

const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/khatmas`;
const SCOPE = 'https://www.googleapis.com/auth/datastore';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PIN_FAILS = 5;            // wrong PINs per address per khatma…
const PIN_WINDOW = 15 * 60;     // …per 15 minutes
const CODE_FAILS = 30;          // and per khatma from everywhere, per hour

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const pinHash = (code: string, pin: string) => sha256(`athkari-khatma:${code}:${pin}`);

interface Part { s: number; n: string; d: string }
export interface KhatmaDoc {
  name: string; round: number; parts: Record<number, Part>;
  owner: string; private: boolean; pin: string; locked: boolean; updateTime: string;
}

type Body = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Firestore REST document → our fields (all optional ones default safely). */
export function parseDoc(doc: unknown): KhatmaDoc | null {
  const d = doc as { fields?: Record<string, any>; updateTime?: string };
  const f = d?.fields;
  if (!f) return null;
  const parts: Record<number, Part> = {};
  const raw = f.parts?.mapValue?.fields ?? {};
  for (let j = 1; j <= 30; j++) {
    const p = raw[String(j)]?.mapValue?.fields ?? {};
    parts[j] = { s: Number(p.s?.integerValue ?? p.s?.doubleValue ?? 0), n: String(p.n?.stringValue ?? ''), d: String(p.d?.stringValue ?? '') };
  }
  return {
    name: String(f.name?.stringValue ?? '').slice(0, 60),
    round: Number(f.round?.integerValue ?? 0),
    parts,
    owner: String(f.owner?.stringValue ?? ''),
    private: f.private?.booleanValue === true,
    pin: String(f.pin?.stringValue ?? ''),
    locked: f.locked?.booleanValue === true,
    updateTime: String(d.updateTime ?? ''),
  };
}

const partValue = (p: Part) => ({
  mapValue: { fields: { s: { integerValue: String(p.s) }, n: { stringValue: p.n }, d: { stringValue: p.d } } },
});
const emptyParts = () => {
  const o: Record<string, unknown> = {};
  for (let j = 1; j <= 30; j++) o[String(j)] = partValue({ s: 0, n: '', d: '' });
  return { mapValue: { fields: o } };
};
const allParts = (k: KhatmaDoc) => {
  const o: Record<string, unknown> = {};
  for (let j = 1; j <= 30; j++) o[String(j)] = partValue(k.parts[j]);
  return { mapValue: { fields: o } };
};

/** What a member sees: names and states, and which parts are theirs — never other devices' ids. */
export function view(k: KhatmaDoc, device: string, isOwner: boolean) {
  const parts = [];
  for (let j = 1; j <= 30; j++) {
    const p = k.parts[j];
    parts.push({ s: p.s, n: p.s ? p.n.slice(0, 30) : '', mine: !!device && p.s !== 0 && p.d === device });
  }
  return { ok: true, name: k.name, round: k.round, locked: k.locked, private: k.private, owner: isOwner, parts };
}

export function validName(v: unknown): string | null {
  const n = str(v).trim();
  return n.length >= 1 && n.length <= 30 ? n : null;
}

class Store {
  constructor(private token: string) {}
  private h(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', ...extra };
  }
  async get(code: string): Promise<KhatmaDoc | null> {
    const r = await fetch(`${DOCS}/${code}`, { headers: this.h() });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('firestore');
    return parseDoc(await r.json());
  }
  /** Updates the given fields only if nobody changed the document since `updateTime` (else 'conflict'). */
  async patch(code: string, fields: Record<string, unknown>, paths: string[], updateTime: string): Promise<'ok' | 'conflict'> {
    const q = paths.map((p) => 'updateMask.fieldPaths=' + encodeURIComponent(p)).join('&');
    const r = await fetch(`${DOCS}/${code}?${q}&currentDocument.updateTime=${encodeURIComponent(updateTime)}`, {
      method: 'PATCH', headers: this.h(), body: JSON.stringify({ fields }),
    });
    if (r.status === 409 || r.status === 412 || r.status === 400) {
      const t = await r.text().catch(() => '');
      if (r.status !== 400 || /FAILED_PRECONDITION|precondition/i.test(t)) return 'conflict';
      throw new Error('firestore');
    }
    if (!r.ok) throw new Error('firestore');
    return 'ok';
  }
  async create(code: string, fields: Record<string, unknown>): Promise<boolean> {
    const r = await fetch(`${DOCS}?documentId=${code}`, { method: 'POST', headers: this.h(), body: JSON.stringify({ fields }) });
    if (r.status === 409) return false;
    if (!r.ok) throw new Error('firestore');
    return true;
  }
  async remove(code: string): Promise<void> {
    const r = await fetch(`${DOCS}/${code}`, { method: 'DELETE', headers: this.h() });
    if (!r.ok && r.status !== 404) throw new Error('firestore');
  }
}

/** A part change, retried a few times if another change landed in between. */
async function changePart(store: Store, code: string, k: KhatmaDoc, juz: number,
  next: (p: Part) => Part | null | 'state'): Promise<'ok' | 'state' | 'busy' | 'missing'> {
  let doc: KhatmaDoc | null = k;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!doc) return 'missing';
    const p = next(doc.parts[juz]);
    if (p === 'state' || p === null) return 'state';
    const r = await store.patch(code, { parts: { mapValue: { fields: { [String(juz)]: partValue(p) } } } },
      [`parts.\`${juz}\``], doc.updateTime);
    if (r === 'ok') return 'ok';
    doc = await store.get(code);
  }
  return 'busy';
}

function newCode(): string {
  return Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { ok: false }); }
  const b: Body = jsonBody(req) ?? {};
  const code = str(b.code);
  const action = str(b.action);
  const device = str(b.device);
  if (!/^[A-Z0-9]{6}$/.test(code) || !action) return sendJson(res, 400, { ok: false, error: 'bad_request' });
  if (device && !/^[a-z0-9]{8}$/.test(device)) return sendJson(res, 400, { ok: false, error: 'bad_request' });
  if (!(await hit('athkari-khatma-manage:' + limitKey(req), 300, 3600))) return sendJson(res, 429, { ok: false, error: 'too_many' });
  const sa: ServiceAccount | null = serviceAccount();
  // PIN guesses must be limited, so without storage we refuse rather than allow unlimited tries
  if (!sa || !storageConfigured()) return sendJson(res, 503, { ok: false, error: 'not_configured' });

  let store: Store;
  let k: KhatmaDoc | null;
  try {
    store = new Store(await accessToken(sa, SCOPE));
    k = await store.get(code);
  } catch { return sendJson(res, 502, { ok: false, error: 'firestore' }); }
  if (!k) return sendJson(res, 404, { ok: false, error: 'no_khatma' });

  // ── who is asking: the owner (key), or a member of a private khatma (PIN) ──
  const ownerKey = str(b.ownerKey);
  const isOwner = !!ownerKey && !!k.owner && sha256(ownerKey) === k.owner;
  const OWNER_ACTIONS = ['lock', 'rename', 'free', 'pin', 'relink'];
  if (OWNER_ACTIONS.includes(action) && !isOwner) return sendJson(res, 403, { ok: false, error: 'not_owner' });

  if (!isOwner) {
    if (!k.private) return sendJson(res, 400, { ok: false, error: 'not_private' }); // public: use Firestore directly
    const pin = str(b.pin);
    const ipKey = `khatma-pin:${code}:${limitKey(req)}`;
    const codeKey = `khatma-pin-all:${code}`;
    try {
      if (!(await hit(ipKey, PIN_FAILS, PIN_WINDOW, true)) || (await peek(codeKey, 3600, true)) >= CODE_FAILS) {
        res.setHeader('Retry-After', String(PIN_WINDOW));
        return sendJson(res, 429, { ok: false, error: 'too_many_attempts' });
      }
    } catch { return sendJson(res, 503, { ok: false, error: 'storage' }); }
    if (!/^\d{4}$/.test(pin) || pinHash(code, pin) !== k.pin) {
      await hit(codeKey, CODE_FAILS, 3600).catch(() => true);
      return sendJson(res, 401, { ok: false, error: 'wrong_pin' });
    }
    await clear(ipKey, PIN_WINDOW);
  }

  const juz = typeof b.juz === 'number' ? b.juz : NaN;
  const needJuz = () => Number.isInteger(juz) && juz >= 1 && juz <= 30;
  const fail = (e: string, s = 409) => sendJson(res, s, { ok: false, error: e });

  try {
    switch (action) {
      case 'view':
        return sendJson(res, 200, view(k, device, isOwner));

      case 'claim': {
        const name = validName(b.name);
        if (!needJuz() || !name || !device) return fail('bad_request', 400);
        if (k.locked) return fail('locked', 423);
        const r = await changePart(store, code, k, juz, (p) => (p.s === 0 ? { s: 1, n: name, d: device } : 'state'));
        return r === 'ok' ? sendJson(res, 200, { ok: true }) : fail(r === 'state' ? 'taken' : r);
      }
      case 'done': {
        if (!needJuz() || !device || typeof b.done !== 'boolean') return fail('bad_request', 400);
        if (k.locked) return fail('locked', 423);
        const r = await changePart(store, code, k, juz, (p) => (p.d === device && p.s !== 0 ? { ...p, s: b.done ? 2 : 1 } : 'state'));
        return r === 'ok' ? sendJson(res, 200, { ok: true }) : fail(r === 'state' ? 'not_yours' : r);
      }
      case 'release': {
        if (!needJuz() || !device) return fail('bad_request', 400);
        if (k.locked) return fail('locked', 423);
        const r = await changePart(store, code, k, juz, (p) => (p.d === device && p.s === 1 ? { s: 0, n: '', d: '' } : 'state'));
        return r === 'ok' ? sendJson(res, 200, { ok: true }) : fail(r === 'state' ? 'not_yours' : r);
      }
      case 'round': {
        const done = Object.values(k.parts).every((p) => p.s === 2);
        if (!done) return fail('not_complete');
        const r = await store.patch(code, { parts: emptyParts(), round: { integerValue: String(k.round + 1) } },
          ['parts', 'round'], k.updateTime);
        return r === 'ok' ? sendJson(res, 200, { ok: true }) : fail('busy');
      }

      // ── owner ──
      case 'lock': {
        if (typeof b.locked !== 'boolean') return fail('bad_request', 400);
        await store.patch(code, { locked: { booleanValue: b.locked } }, ['locked'], k.updateTime);
        return sendJson(res, 200, { ok: true });
      }
      case 'rename': {
        const n = str(b.name).trim();
        if (n.length < 1 || n.length > 60) return fail('bad_request', 400);
        await store.patch(code, { name: { stringValue: n } }, ['name'], k.updateTime);
        return sendJson(res, 200, { ok: true });
      }
      case 'free': {
        if (!needJuz()) return fail('bad_request', 400);
        const r = await changePart(store, code, k, juz, () => ({ s: 0, n: '', d: '' }));
        return r === 'ok' ? sendJson(res, 200, { ok: true }) : fail(r);
      }
      case 'pin': {
        const pin = str(b.pin);
        if (pin && !/^\d{4}$/.test(pin)) return fail('bad_request', 400);
        await store.patch(code,
          { private: { booleanValue: !!pin }, pin: { stringValue: pin ? pinHash(code, pin) : '' } },
          ['private', 'pin'], k.updateTime);
        return sendJson(res, 200, { ok: true, private: !!pin });
      }
      case 'relink': {
        // a new code with the same khatma; the PIN is tied to the code, so it carries over only if re-sent
        const pin = str(b.pin);
        if (k.private && !/^\d{4}$/.test(pin)) return fail('pin_required', 400);
        for (let attempt = 0; attempt < 5; attempt++) {
          const fresh = newCode();
          const fields: Record<string, unknown> = {
            name: { stringValue: k.name }, round: { integerValue: String(k.round) }, parts: allParts(k),
            owner: { stringValue: k.owner }, locked: { booleanValue: k.locked },
            private: { booleanValue: k.private }, pin: { stringValue: k.private ? pinHash(fresh, pin) : '' },
            createdAt: { timestampValue: new Date().toISOString() },
          };
          if (await store.create(fresh, fields)) {
            await store.remove(code);
            return sendJson(res, 200, { ok: true, code: fresh });
          }
        }
        return fail('busy', 503);
      }
      default:
        return fail('bad_request', 400);
    }
  } catch {
    return sendJson(res, 502, { ok: false, error: 'firestore' });
  }
}
