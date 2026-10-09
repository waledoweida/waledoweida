// Visitor events and the summary shown on /admin/.
// Events are kept in one Redis list per day ("ev:YYYY-MM-DD", Cairo time) for ~13 months.

export const TZ = 'Africa/Cairo';
export const KEEP_SECONDS = 400 * 24 * 3600;

export type EventType = 'view' | 'click' | 'time';
export const EVENT_TYPES: readonly EventType[] = ['view', 'click', 'time'];

export interface VisitEvent {
  ts: string;
  type: EventType;
  vid: string;
  sid: string;
  path: string;
  ref: string;
  source: string;
  medium: string;
  campaign: string;
  device: string;
  lang: string;
  value: string;
  country: string;
  city: string;
}

interface Session {
  start: Date;
  pages: string[];
  src: string;
  device: string;
  country: string;
  city: string;
  secs: number;
  contacted: string;
}

interface Counted { name: string; count: number }

export interface Summary {
  ok: true;
  days: number;
  generated: string;
  visitors: number;
  sessions: number;
  views: number;
  avgSecs: number;
  contacted: number;
  clicks: { whatsapp: number; phone: number; form: number };
  daily: { day: string; visitors: number }[];
  sources: Counted[];
  pages: Counted[];
  devices: Counted[];
  countries: Counted[];
  recent: {
    time: string; source: string; device: string; country: string;
    pages: number; secs: number; contacted: string;
  }[];
}

export function dayKey(date: Date): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function stamp(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date).replace(',', '');
}

const COUNTRY_AR: Record<string, string> = {
  EG: 'مصر', LY: 'ليبيا', KW: 'الكويت', SA: 'السعودية', AE: 'الإمارات', QA: 'قطر', BH: 'البحرين', OM: 'عُمان',
  JO: 'الأردن', IQ: 'العراق', LB: 'لبنان', SD: 'السودان', SY: 'سوريا', PS: 'فلسطين', YE: 'اليمن', MA: 'المغرب',
  DZ: 'الجزائر', TN: 'تونس', TR: 'تركيا', GB: 'بريطانيا', DE: 'ألمانيا', FR: 'فرنسا', IT: 'إيطاليا',
  US: 'أمريكا', CA: 'كندا', NL: 'هولندا', SE: 'السويد',
};

export function sourceOf(ref: string, utm: string): string {
  const s = String(utm || ref || '').toLowerCase();
  if (!s) return 'دخول مباشر / واتساب';
  if (/google/.test(s)) return 'جوجل';
  if (/facebook|fb\.|^fb$/.test(s)) return 'فيسبوك';
  if (/instagram|^ig$/.test(s)) return 'إنستجرام';
  if (/tiktok/.test(s)) return 'تيك توك';
  if (/snapchat/.test(s)) return 'سناب شات';
  if (/whatsapp|wa\.me/.test(s)) return 'واتساب';
  if (/t\.co|twitter|x\.com/.test(s)) return 'إكس (تويتر)';
  if (/youtube/.test(s)) return 'يوتيوب';
  if (/bing|yahoo|duckduckgo|yandex/.test(s)) return 'محركات بحث تانية';
  return s.replace(/^www\./, '');
}

function top(obj: Record<string, number>, n = 10): Counted[] {
  return Object.entries(obj).map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count).slice(0, n);
}

/** Turns raw events into the numbers shown on /admin/. */
export function summarize(events: VisitEvent[], days: number, now: number): Summary {
  const visitors = new Set<string>();
  const sessions = new Map<string, Session>();
  const perDay: Record<string, Set<string>> = {};
  const pages: Record<string, number> = {};
  const clicks = { whatsapp: 0, phone: 0, form: 0 };
  let views = 0;

  for (const e of events) {
    const ts = new Date(e.ts);
    const sid = e.sid || e.vid;
    let s = sessions.get(sid);
    if (!s) {
      s = { start: ts, pages: [], src: '', device: e.device, country: e.country, city: e.city, secs: 0, contacted: '' };
      sessions.set(sid, s);
    }
    if (ts < s.start) s.start = ts;
    if (!s.country && e.country) s.country = e.country;
    if (e.type === 'view') {
      views++;
      visitors.add(e.vid);
      const d = dayKey(ts);
      (perDay[d] ||= new Set()).add(e.vid);
      pages[e.path] = (pages[e.path] || 0) + 1;
      s.pages.push(e.path);
      if (!s.src) s.src = sourceOf(e.ref, e.source);
    } else if (e.type === 'click') {
      const kind = String(e.value).split(':')[0] as keyof typeof clicks;
      if (kind in clicks) clicks[kind]++;
      if (!s.contacted) s.contacted = kind;
    } else if (e.type === 'time') {
      s.secs += Math.min(parseInt(e.value, 10) || 0, 3600);
    }
  }

  const list = [...sessions.values()].filter((s) => s.pages.length);
  const sources: Record<string, number> = {};
  const devices: Record<string, number> = {};
  const countries: Record<string, number> = {};
  let totalSecs = 0;
  let contacted = 0;
  for (const s of list) {
    totalSecs += s.secs;
    if (s.contacted) contacted++;
    sources[s.src] = (sources[s.src] || 0) + 1;
    const dev = s.device || '-';
    devices[dev] = (devices[dev] || 0) + 1;
    const c = COUNTRY_AR[s.country] || s.country || '-';
    countries[c] = (countries[c] || 0) + 1;
  }

  const daily: Summary['daily'] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKey(new Date(now - i * 864e5));
    daily.push({ day: d, visitors: perDay[d] ? perDay[d].size : 0 });
  }

  list.sort((a, b) => b.start.getTime() - a.start.getTime());
  return {
    ok: true, days, generated: stamp(new Date(now)),
    visitors: visitors.size, sessions: list.length, views,
    avgSecs: list.length ? Math.round(totalSecs / list.length) : 0,
    contacted, clicks,
    daily, sources: top(sources), pages: top(pages), devices: top(devices), countries: top(countries),
    recent: list.slice(0, 30).map((s) => ({
      time: stamp(s.start), source: s.src, device: s.device,
      country: (COUNTRY_AR[s.country] || s.country || '-') + (s.city ? ' · ' + s.city : ''),
      pages: s.pages.length, secs: s.secs, contacted: s.contacted,
    })),
  };
}
