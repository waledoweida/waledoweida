// POST /api/download — the video downloader at /download/.
// The page sends { url, mode, quality, audioFormat, audioBitrate }; this function forwards it to a
// Cobalt instance (https://github.com/imputnet/cobalt) and returns the download link it gives back.
// The Cobalt address and its API key stay on the server (Vercel env vars COBALT_API_URL, COBALT_API_KEY),
// so the browser never sees them. Setup: tools/cobalt/README.md.
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { jsonBody, limitKey, sameOrigin, sendEmpty, sendJson } from './_lib/http';
import { hit } from './_lib/ratelimit';

const MODES = ['auto', 'audio', 'mute'] as const;
const QUALITIES = ['max', '4320', '2160', '1440', '1080', '720', '480', '360', '240', '144'] as const;
const AUDIO_FORMATS = ['mp3', 'best', 'ogg', 'wav', 'opus'] as const;
const BITRATES = ['320', '256', '128', '96', '64'] as const;

/** 20 links per 10 minutes per address. */
const LIMIT = 20, WINDOW = 600;

type Choice<T extends readonly string[]> = T[number];

function pick<T extends readonly string[]>(list: T, v: unknown, fallback: Choice<T>): Choice<T> {
  const s = String(v ?? '');
  return (list as readonly string[]).includes(s) ? (s as Choice<T>) : fallback;
}

/** Accepts only a plain http(s) link to a public host (no credentials, no local addresses). */
export function cleanLink(v: unknown): string | null {
  const raw = String(v ?? '').trim();
  if (!raw || raw.length > 2048) return null;
  let u: URL;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) return null;
  return u.toString();
}

export interface CobaltBody {
  url: string;
  downloadMode: Choice<typeof MODES>;
  videoQuality: Choice<typeof QUALITIES>;
  audioFormat: Choice<typeof AUDIO_FORMATS>;
  audioBitrate: Choice<typeof BITRATES>;
  youtubeVideoCodec: 'h264' | 'vp9';
  filenameStyle: 'pretty';
  localProcessing: 'disabled';
}

/** Builds the request for Cobalt from what the page sent (unknown values fall back to safe defaults). */
export function cobaltBody(input: Record<string, unknown>, url: string): CobaltBody {
  const videoQuality = pick(QUALITIES, input.quality, '1080');
  // h264 (mp4, plays everywhere) tops out at 1080p on YouTube; higher qualities need vp9 (webm)
  const high = videoQuality === 'max' || Number(videoQuality) > 1080;
  return {
    url,
    downloadMode: pick(MODES, input.mode, 'auto'),
    videoQuality,
    audioFormat: pick(AUDIO_FORMATS, input.audioFormat, 'mp3'),
    audioBitrate: pick(BITRATES, input.audioBitrate, '128'),
    youtubeVideoCodec: high ? 'vp9' : 'h264',
    filenameStyle: 'pretty',
    localProcessing: 'disabled',
  };
}

interface PickerItem { type?: string; url?: string; thumb?: string }
interface CobaltReply {
  status?: string;
  url?: string;
  filename?: string;
  audio?: string;
  audioFilename?: string;
  picker?: PickerItem[];
  error?: { code?: string };
}

const web = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//i.test(v);

/** Keeps only what the page needs from Cobalt's answer (and only plain web links). */
export function shapeReply(r: CobaltReply): { status: number; body: Record<string, unknown> } {
  if ((r.status === 'tunnel' || r.status === 'redirect') && web(r.url)) {
    return { status: 200, body: { kind: 'file', url: r.url, filename: r.filename || '' } };
  }
  if (r.status === 'picker' && Array.isArray(r.picker)) {
    const items = r.picker
      .filter((p) => p && web(p.url))
      .slice(0, 40)
      .map((p) => ({ type: String(p.type || 'video'), url: p.url, thumb: web(p.thumb) ? p.thumb : '' }));
    return { status: 200, body: { kind: 'picker', items, audio: web(r.audio) ? r.audio : '', audioFilename: r.audioFilename || '' } };
  }
  const code = String(r.error?.code || (r.status === 'local-processing' ? 'error.api.local' : 'error.api.unknown'));
  return { status: 422, body: { error: code.slice(0, 120) } };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendEmpty(res, 405); }
  if (!sameOrigin(req)) return sendJson(res, 403, { error: 'forbidden' });

  const api = (process.env.COBALT_API_URL || '').replace(/\/+$/, '');
  if (!api) return sendJson(res, 503, { error: 'not_configured' });

  const input = jsonBody(req);
  const url = input && cleanLink(input.url);
  if (!input || !url) return sendJson(res, 400, { error: 'error.api.link.invalid' });

  if (!(await hit(`dl:${limitKey(req)}`, LIMIT, WINDOW))) return sendJson(res, 429, { error: 'rate_limited' });

  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (process.env.COBALT_API_KEY) headers.Authorization = `Api-Key ${process.env.COBALT_API_KEY}`;

  let reply: CobaltReply;
  try {
    const r = await fetch(`${api}/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(cobaltBody(input, url)),
      signal: AbortSignal.timeout(25000),
    });
    reply = (await r.json()) as CobaltReply;
  } catch {
    return sendJson(res, 502, { error: 'upstream' });
  }
  const out = shapeReply(reply || {});
  sendJson(res, out.status, out.body);
}
