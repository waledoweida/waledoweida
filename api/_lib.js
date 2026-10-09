// Shared helpers for the visitor-stats functions (Vercel serverless, no dependencies).
// Storage: Upstash Redis over its REST API. Vercel's Upstash integration sets
// KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN).
// Events are kept in one Redis list per day ("ev:YYYY-MM-DD", Cairo time) for ~13 months.

const TZ = 'Africa/Cairo';
const KEEP_SECONDS = 400 * 24 * 3600;

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function redis(commands) {
  const cfg = redisConfig();
  if (!cfg) throw new Error('storage not configured');
  const r = await fetch(cfg.url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('storage error ' + r.status);
  return (await r.json()).map((x) => x.result);
}

function dayKey(date) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function clean(v, n) {
  return String(v == null ? '' : v).replace(/[\r\n\t]/g, ' ').slice(0, n || 200);
}

const COUNTRY_AR = {
  EG: 'مصر', LY: 'ليبيا', KW: 'الكويت', SA: 'السعودية', AE: 'الإمارات', QA: 'قطر', BH: 'البحرين', OM: 'عُمان',
  JO: 'الأردن', IQ: 'العراق', LB: 'لبنان', SD: 'السودان', SY: 'سوريا', PS: 'فلسطين', YE: 'اليمن', MA: 'المغرب',
  DZ: 'الجزائر', TN: 'تونس', TR: 'تركيا', GB: 'بريطانيا', DE: 'ألمانيا', FR: 'فرنسا', IT: 'إيطاليا',
  US: 'أمريكا', CA: 'كندا', NL: 'هولندا', SE: 'السويد',
};

function sourceOf(ref, utm) {
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

// Turn raw events into the numbers shown on /admin/.
function summarize(events, days, now) {
  const visitors = new Set();
  const sessions = new Map();
  const perDay = {};
  const pages = {}, sources = {}, devices = {}, countries = {};
  const clicks = { whatsapp: 0, phone: 0, form: 0 };
  let views = 0;

  for (const e of events) {
    const ts = new Date(e.ts);
    const sid = e.sid || e.vid;
    let s = sessions.get(sid);
    if (!s) {
      s = { vid: e.vid, start: ts, pages: [], src: '', device: e.device, country: e.country, city: e.city, secs: 0, contacted: '' };
      sessions.set(sid, s);
    }
    if (ts < s.start) s.start = ts;
    if (!s.country && e.country) s.country = e.country;
    if (e.type === 'view') {
      views++;
      visitors.add(e.vid);
      const d = dayKey(ts);
      (perDay[d] = perDay[d] || new Set()).add(e.vid);
      pages[e.path] = (pages[e.path] || 0) + 1;
      s.pages.push(e.path);
      if (!s.src) s.src = sourceOf(e.ref, e.source);
    } else if (e.type === 'click') {
      const kind = String(e.value).split(':')[0];
      if (kind in clicks) clicks[kind]++;
      if (!s.contacted) s.contacted = kind;
    } else if (e.type === 'time') {
      s.secs += Math.min(parseInt(e.value, 10) || 0, 3600);
    }
  }

  const list = [...sessions.values()].filter((s) => s.pages.length);
  let totalSecs = 0, contacted = 0;
  for (const s of list) {
    totalSecs += s.secs;
    if (s.contacted) contacted++;
    sources[s.src] = (sources[s.src] || 0) + 1;
    devices[s.device || '-'] = (devices[s.device || '-'] || 0) + 1;
    const c = COUNTRY_AR[s.country] || s.country || '-';
    countries[c] = (countries[c] || 0) + 1;
  }

  const daily = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKey(new Date(now - i * 864e5));
    daily.push({ day: d, visitors: perDay[d] ? perDay[d].size : 0 });
  }

  const top = (obj, n = 10) => Object.entries(obj).map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count).slice(0, n);
  const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(d).replace(',', '');

  list.sort((a, b) => b.start - a.start);
  return {
    ok: true, days, generated: fmt(new Date(now)),
    visitors: visitors.size, sessions: list.length, views,
    avgSecs: list.length ? Math.round(totalSecs / list.length) : 0,
    contacted, clicks,
    daily, sources: top(sources), pages: top(pages), devices: top(devices), countries: top(countries),
    recent: list.slice(0, 30).map((s) => ({
      time: fmt(s.start), source: s.src, device: s.device,
      country: (COUNTRY_AR[s.country] || s.country || '-') + (s.city ? ' · ' + s.city : ''),
      pages: s.pages.length, secs: s.secs, contacted: s.contacted,
    })),
  };
}

module.exports = { redis, redisConfig, dayKey, clean, summarize, KEEP_SECONDS };
