/**
 * waledoweida.com — private visitor stats backend (Google Apps Script + Google Sheet).
 *
 * The site sends anonymous events here (page views, contact clicks, time on page);
 * /admin/ reads the summary with your secret key. Nothing personal is stored:
 * a random visitor id, the page, where the visit came from, device type and timezone.
 *
 * SETUP (once):
 *   1. Create a new Google Sheet (any name). Extensions → Apps Script.
 *   2. Replace the code with this whole file. Save.
 *   3. Project Settings → Script properties → Add property:
 *        ADMIN_KEY = a long secret password of your choice (you type it on /admin/).
 *   4. Deploy → New deployment → type "Web app":
 *        Execute as: Me    Who has access: Anyone
 *      Authorize, then copy the Web app URL (ends with /exec).
 *   5. Put that URL in TRACK_URL in main.js and admin/admin.js (or send it to whoever maintains the site).
 * After editing this script later: Deploy → Manage deployments → edit → New version (the URL stays the same).
 */

var SHEET = 'events';
var HEAD = ['ts', 'type', 'vid', 'sid', 'path', 'ref', 'source', 'medium', 'campaign', 'device', 'tz', 'lang', 'value'];

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}

function clean_(v, n) { return String(v == null ? '' : v).replace(/[\r\n\t]/g, ' ').slice(0, n || 200); }

/* ---------- collect ---------- */
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var type = clean_(d.type, 20);
    if (['view', 'click', 'time'].indexOf(type) < 0 || !d.vid) return out_({ ok: false });
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      sheet_().appendRow([new Date(), type, clean_(d.vid, 40), clean_(d.sid, 40), clean_(d.path, 200), clean_(d.ref, 120),
        clean_(d.source, 60), clean_(d.medium, 60), clean_(d.campaign, 80), clean_(d.device, 20), clean_(d.tz, 60),
        clean_(d.lang, 10), clean_(d.value, 60)]);
    } finally { lock.releaseLock(); }
    return out_({ ok: true });
  } catch (err) { return out_({ ok: false }); }
}

/* ---------- report (admin) ---------- */
function doGet(e) {
  var p = e.parameter || {};
  var key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (p.action !== 'stats' || !key || p.key !== key) return out_({ ok: false, error: 'unauthorized' });
  var days = Math.min(Math.max(parseInt(p.days, 10) || 7, 1), 365);
  return out_(stats_(days));
}

var TZ_COUNTRY = {
  'Africa/Cairo': 'مصر', 'Africa/Tripoli': 'ليبيا', 'Asia/Kuwait': 'الكويت', 'Asia/Riyadh': 'السعودية',
  'Asia/Dubai': 'الإمارات', 'Asia/Qatar': 'قطر', 'Asia/Bahrain': 'البحرين', 'Asia/Muscat': 'عُمان',
  'Asia/Amman': 'الأردن', 'Asia/Baghdad': 'العراق', 'Asia/Beirut': 'لبنان', 'Africa/Khartoum': 'السودان',
  'Europe/London': 'بريطانيا', 'Europe/Berlin': 'ألمانيا', 'America/New_York': 'أمريكا'
};

function sourceOf_(ref, utm) {
  var s = (utm || ref || '').toLowerCase();
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

function stats_(days) {
  var sh = sheet_();
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, HEAD.length).getValues() : [];
  var tzName = Session.getScriptTimeZone();
  var since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (days - 1));

  var visitors = {}, sessions = {}, views = 0, perDay = {}, pages = {}, sources = {}, devices = {}, countries = {};
  var clicks = { whatsapp: 0, phone: 0, form: 0 };

  rows.forEach(function (r) {
    var ts = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (ts < since) return;
    var type = r[1], vid = r[2], sid = r[3] || vid, path = r[4], ref = r[5], src = r[6];
    var s = sessions[sid] || (sessions[sid] = { vid: vid, start: ts, end: ts, pages: [], src: '', device: r[9], tz: r[10], secs: 0, contacted: '' });
    if (ts < s.start) s.start = ts;
    if (ts > s.end) s.end = ts;
    if (type === 'view') {
      views++;
      visitors[vid] = true;
      var day = Utilities.formatDate(ts, tzName, 'yyyy-MM-dd');
      (perDay[day] || (perDay[day] = {}))[vid] = true;
      pages[path] = (pages[path] || 0) + 1;
      s.pages.push(path);
      if (!s.src) s.src = sourceOf_(ref, src);
    } else if (type === 'click') {
      var kind = String(r[12]).split(':')[0];
      if (clicks[kind] != null) clicks[kind]++;
      if (!s.contacted) s.contacted = kind;
    } else if (type === 'time') {
      s.secs += Math.min(parseInt(r[12], 10) || 0, 3600);
    }
  });

  var list = Object.keys(sessions).map(function (k) { return sessions[k]; }).filter(function (s) { return s.pages.length; });
  var totalSecs = 0, contacted = 0;
  list.forEach(function (s) {
    totalSecs += s.secs;
    if (s.contacted) contacted++;
    sources[s.src] = (sources[s.src] || 0) + 1;
    devices[s.device || '-'] = (devices[s.device || '-'] || 0) + 1;
    var c = TZ_COUNTRY[s.tz] || (s.tz ? s.tz.split('/').pop().replace(/_/g, ' ') : '-');
    countries[c] = (countries[c] || 0) + 1;
  });

  var daily = [];
  for (var i = 0; i < days; i++) {
    var d = new Date(since); d.setDate(since.getDate() + i);
    var key = Utilities.formatDate(d, tzName, 'yyyy-MM-dd');
    daily.push({ day: key, visitors: perDay[key] ? Object.keys(perDay[key]).length : 0 });
  }

  function top(obj, n) {
    return Object.keys(obj).map(function (k) { return { name: k, count: obj[k] }; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, n || 10);
  }

  list.sort(function (a, b) { return b.start - a.start; });
  var recent = list.slice(0, 30).map(function (s) {
    return {
      time: Utilities.formatDate(s.start, tzName, 'yyyy-MM-dd HH:mm'), source: s.src, device: s.device,
      country: TZ_COUNTRY[s.tz] || s.tz || '-', pages: s.pages.length, secs: s.secs, contacted: s.contacted
    };
  });

  return {
    ok: true, days: days, generated: Utilities.formatDate(new Date(), tzName, 'yyyy-MM-dd HH:mm'),
    visitors: Object.keys(visitors).length, sessions: list.length, views: views,
    avgSecs: list.length ? Math.round(totalSecs / list.length) : 0,
    contacted: contacted, clicks: clicks,
    daily: daily, sources: top(sources), pages: top(pages), devices: top(devices), countries: top(countries),
    recent: recent
  };
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
