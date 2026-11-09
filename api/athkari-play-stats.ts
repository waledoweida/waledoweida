// /api/athkari-play-stats — the official Google Play numbers of the Athkari app, for the control panel.
//
// Google Play writes daily CSV reports (installs, ratings, crashes) to the developer account's Cloud Storage
// bucket. The app's service account (ATHKARI_SERVICE_ACCOUNT) was given read-only "View app information and
// download bulk reports" in Play Console, so it can read them with a devstorage.read_only token.
// The reports are UTF-16 CSV files, one per month: stats/<kind>/<kind>_<package>_<YYYYMM>_overview.csv
//
// Panel: POST {idToken}  (admin account only) → { ok, days: [{date, installs, uninstalls, active, ...}], totals }
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { jsonBody, limitKey, sendJson } from './_lib/http';
import { hit } from './_lib/ratelimit';
import { accessToken, ADMIN_EMAIL, serviceAccount, tokenEmail } from './athkari-push';

export const BUCKET = 'pubsite_prod_8655742230235414287';
export const PACKAGE = 'com.athkari.athkari';
const SCOPE = 'https://www.googleapis.com/auth/devstorage.read_only';

/** The months (YYYYMM) to read: this one and the `count - 1` before it. */
export function months(now: Date, count = 3): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** Report bytes → text: Play writes UTF-16LE with a BOM; older files may be UTF-8. */
export function decode(buf: Uint8Array): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return new TextDecoder('utf-8').decode(buf.subarray(3));
  return new TextDecoder('utf-8').decode(buf);
}

/** A simple CSV (Play's reports have no quoted commas) → rows keyed by the header names. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((l) => {
    const cells = l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}

const num = (v: string | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface Day {
  date: string;
  installs: number | null; // Daily Device Installs (new devices)
  uninstalls: number | null;
  userInstalls: number | null; // Daily User Installs
  totalUsers: number | null; // Total User Installs (all time)
  active: number | null; // Active Device Installs
  rating: number | null; // Daily Average Rating
  totalRating: number | null;
  crashes: number | null;
  anrs: number | null;
}

/** Merges the three kinds of rows into one list of days (newest last). */
export function mergeDays(installs: Record<string, string>[], ratings: Record<string, string>[],
  crashes: Record<string, string>[]): Day[] {
  const by = new Map<string, Day>();
  const day = (date: string): Day => {
    let d = by.get(date);
    if (!d) {
      d = { date, installs: null, uninstalls: null, userInstalls: null, totalUsers: null, active: null,
        rating: null, totalRating: null, crashes: null, anrs: null };
      by.set(date, d);
    }
    return d;
  };
  for (const r of installs) {
    if (!r.Date) continue;
    const d = day(r.Date);
    d.installs = num(r['Daily Device Installs']);
    d.uninstalls = num(r['Daily Device Uninstalls']);
    d.userInstalls = num(r['Daily User Installs']);
    d.totalUsers = num(r['Total User Installs']);
    d.active = num(r['Active Device Installs']);
  }
  for (const r of ratings) {
    if (!r.Date) continue;
    const d = day(r.Date);
    d.rating = r['Daily Average Rating'] === 'NA' ? null : num(r['Daily Average Rating']);
    d.totalRating = r['Total Average Rating'] === 'NA' ? null : num(r['Total Average Rating']);
  }
  for (const r of crashes) {
    if (!r.Date) continue;
    const d = day(r.Date);
    d.crashes = num(r['Daily Crashes']);
    d.anrs = num(r['Daily ANRs']);
  }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Headline numbers: latest totals and sums over the last 7 and 28 days. */
export function totals(days: Day[]) {
  const last = <K extends keyof Day>(k: K) => {
    for (let i = days.length - 1; i >= 0; i--) if (days[i][k] != null) return days[i][k];
    return null;
  };
  const sum = (k: 'installs' | 'uninstalls' | 'crashes' | 'anrs', n: number) =>
    days.slice(-n).reduce((s, d) => s + (d[k] ?? 0), 0);
  return {
    totalUsers: last('totalUsers'),
    active: last('active'),
    rating: last('totalRating'),
    installs7: sum('installs', 7),
    installs28: sum('installs', 28),
    uninstalls28: sum('uninstalls', 28),
    crashes7: sum('crashes', 7),
    anrs7: sum('anrs', 7),
    lastDate: days.length ? days[days.length - 1].date : null,
  };
}

async function readReport(token: string, kind: string, month: string): Promise<Record<string, string>[] | 'denied'> {
  const name = encodeURIComponent(`stats/${kind}/${kind}_${PACKAGE}_${month}_overview.csv`);
  const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${name}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 404) return [];
  if (r.status === 401 || r.status === 403) return 'denied';
  if (!r.ok) throw new Error('gcs ' + r.status);
  return parseCsv(decode(new Uint8Array(await r.arrayBuffer())));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { ok: false }); }
  const sa = serviceAccount();
  if (!sa) return sendJson(res, 503, { ok: false, error: 'not_configured' });
  if (!(await hit('athkari-play:' + limitKey(req), 60, 3600))) return sendJson(res, 429, { ok: false, error: 'too_many' });

  const body = jsonBody(req);
  const idToken = typeof body?.idToken === 'string' ? body.idToken : '';
  if (!idToken) return sendJson(res, 400, { ok: false, error: 'bad_request' });
  let email: string | null;
  try { email = await tokenEmail(idToken); } catch { return sendJson(res, 502, { ok: false, error: 'auth_unreachable' }); }
  if (email !== ADMIN_EMAIL) return sendJson(res, 401, { ok: false, error: 'not_admin' });

  try {
    const token = await accessToken(sa, SCOPE);
    const ms = months(new Date()).reverse();
    const read = async (kind: string) => {
      const all: Record<string, string>[] = [];
      for (const m of ms) {
        const rows = await readReport(token, kind, m);
        if (rows === 'denied') return 'denied' as const;
        all.push(...rows);
      }
      return all;
    };
    const [inst, rate, crash] = await Promise.all([read('installs'), read('ratings'), read('crashes')]);
    if (inst === 'denied' || rate === 'denied' || crash === 'denied') {
      // The account email is not secret: it shows which account needs the permission in Play Console.
      return sendJson(res, 403, { ok: false, error: 'no_access', account: sa.client_email });
    }
    const days = mergeDays(inst, rate, crash).slice(-90);
    return sendJson(res, 200, { ok: true, days, totals: totals(days) });
  } catch {
    return sendJson(res, 502, { ok: false, error: 'read_failed' });
  }
}
