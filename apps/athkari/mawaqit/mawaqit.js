/* مواقيت الصلاة لمدن مصر — نفس حساب تطبيق أذكاري (PrayTimes، الهيئة المصرية العامة للمساحة: الفجر 19.5°، العشاء 17.5°)
   بيتحسب كله على الجهاز، والتوقيت الصيفي والشتوي بياخده من منطقة Africa/Cairo لكل يوم لوحده. */
(function () {
  "use strict";
  var CITIES = [
    ["القاهرة", 30.0444, 31.2357], ["الجيزة", 30.0131, 31.2089], ["الإسكندرية", 31.2001, 29.9187],
    ["القليوبية (بنها)", 30.4660, 31.1858], ["المنوفية (شبين الكوم)", 30.5503, 31.0106], ["الغربية (طنطا)", 30.7865, 31.0004],
    ["الدقهلية (المنصورة)", 31.0409, 31.3785], ["الشرقية (الزقازيق)", 30.5877, 31.5020], ["البحيرة (دمنهور)", 31.0341, 30.4682],
    ["كفر الشيخ", 31.1107, 30.9388], ["دمياط", 31.4165, 31.8133], ["بورسعيد", 31.2653, 32.3019],
    ["الإسماعيلية", 30.5965, 32.2715], ["السويس", 29.9668, 32.5498], ["الفيوم", 29.3084, 30.8428],
    ["بني سويف", 29.0661, 31.0994], ["المنيا", 28.1099, 30.7503], ["أسيوط", 27.1809, 31.1837],
    ["سوهاج", 26.5591, 31.6957], ["قنا", 26.1551, 32.7160], ["الأقصر", 25.6872, 32.6396],
    ["أسوان", 24.0889, 32.8998], ["البحر الأحمر (الغردقة)", 27.2579, 33.8116], ["مطروح (مرسى مطروح)", 31.3543, 27.2373],
    ["الوادي الجديد (الخارجة)", 25.4390, 30.5586], ["شمال سيناء (العريش)", 31.1316, 33.7984], ["جنوب سيناء (الطور)", 28.2416, 33.6222],
    ["شرم الشيخ", 27.9158, 34.3300]
  ];
  var NAMES = ["الفجر", "الشروق", "الظهر", "العصر", "المغرب", "العشاء"];
  var MAIN = [0, 2, 3, 4, 5];
  var MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  var DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  var d2r = function (d) { return d * Math.PI / 180; };
  var r2d = function (r) { return r * 180 / Math.PI; };
  function fix(a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; }
  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var a = Math.floor(y / 100), b = 2 - a + Math.floor(a / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
  }
  function sun(jd) {
    var dd = jd - 2451545.0, g = fix(357.529 + 0.98560028 * dd, 360), q = fix(280.459 + 0.98564736 * dd, 360);
    var l = fix(q + 1.915 * Math.sin(d2r(g)) + 0.020 * Math.sin(d2r(2 * g)), 360), e = 23.439 - 0.00000036 * dd;
    var ra = r2d(Math.atan2(Math.cos(d2r(e)) * Math.sin(d2r(l)), Math.cos(d2r(l)))) / 15;
    return [r2d(Math.asin(Math.sin(d2r(e)) * Math.sin(d2r(l)))), q / 15 - fix(ra, 24)];
  }

  // فرق توقيت القاهرة عن جرينتش (بالساعات) في يوم معيّن، شاملًا الصيفي والشتوي
  var tzFmt = null;
  try {
    tzFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", hourCycle: "h23", year: "numeric", month: "numeric",
      day: "numeric", hour: "numeric", minute: "numeric" });
  } catch (e) { tzFmt = null; }
  function cairoOffset(y, m, d) {
    var at = new Date(Date.UTC(y, m - 1, d, 10, 0));
    if (!tzFmt) return 2;
    var p = {};
    tzFmt.formatToParts(at).forEach(function (x) { p[x.type] = +x.value; });
    var local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    return Math.round((local - at.getTime()) / 60000) / 60;
  }

  // المواقيت بالدقايق من نص الليل بتوقيت مصر
  function times(y, m, d, lat, lng) {
    var tz = cairoOffset(y, m, d), jd = julian(y, m, d) - lng / (15 * 24);
    function mid(t) { return fix(12 - sun(jd + t)[1], 24); }
    function sat(angle, t, ccw) {
      var decl = sun(jd + t)[0], noon = mid(t);
      var x = (-Math.sin(d2r(angle)) - Math.sin(d2r(decl)) * Math.sin(d2r(lat))) / (Math.cos(d2r(decl)) * Math.cos(d2r(lat)));
      x = Math.max(-1, Math.min(1, x));
      var tt = r2d(Math.acos(x)) / 15;
      return noon + (ccw ? -tt : tt);
    }
    function asr(t) {
      var decl = sun(jd + t)[0];
      return sat(-r2d(Math.atan(1 / (1 + Math.tan(d2r(Math.abs(lat - decl)))))), t);
    }
    var raw = [sat(19.5, 5 / 24, true), sat(0.833, 6 / 24, true), mid(12 / 24), asr(13 / 24), sat(0.833, 18 / 24), sat(17.5, 18 / 24)];
    return raw.map(function (h) { return Math.round((h + tz - lng / 15) * 60); });
  }

  function hm(mins) {
    var h = Math.floor(mins / 60) % 24, mm = mins % 60;
    var h12 = (h + 11) % 12 + 1;
    return h12 + ":" + (mm < 10 ? "0" : "") + mm;
  }
  function ap(mins) { return Math.floor(mins / 60) % 24 < 12 ? "ص" : "م"; }

  var hijriFmt = null;
  try { hijriFmt = new Intl.DateTimeFormat("ar-EG-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { hijriFmt = null; }
  function hijri(y, m, d) {
    if (!hijriFmt) return "";
    return hijriFmt.format(new Date(Date.UTC(y, m - 1, d, 12))).replace(/\s*هـ\s*$/, "");
  }
  function hijriDay(s) { var n = parseInt(s, 10); return isNaN(n) ? 0 : n; }

  var $ = function (id) { return document.getElementById(id); };
  var citySel = $("mq-city"), monthLbl = $("mq-month"), body = $("mq-body"), today = $("mq-today");
  if (!citySel || !body) return;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  CITIES.forEach(function (c, i) {
    var o = document.createElement("option");
    o.value = String(i); o.textContent = c[0];
    citySel.appendChild(o);
  });
  var saved = store.get("mq_city");
  citySel.value = saved && CITIES[+saved] ? saved : "0";

  var now = new Date();
  var view = { y: now.getFullYear(), m: now.getMonth() + 1 };

  function cairoNow() {
    var off = cairoOffset(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
    var t = new Date(Date.now() + off * 3600000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), min: t.getUTCHours() * 60 + t.getUTCMinutes(), sec: t.getUTCSeconds() };
  }

  function renderToday() {
    if (!today) return;
    var c = CITIES[+citySel.value], n = cairoNow();
    var t = times(n.y, n.m, n.d, c[1], c[2]);
    var next = -1;
    for (var i = 0; i < MAIN.length; i++) { if (t[MAIN[i]] > n.min) { next = MAIN[i]; break; } }
    var nextAt, nextName;
    if (next >= 0) { nextAt = t[next]; nextName = NAMES[next]; }
    else {
      var tm = new Date(Date.UTC(n.y, n.m - 1, n.d + 1));
      nextAt = times(tm.getUTCFullYear(), tm.getUTCMonth() + 1, tm.getUTCDate(), c[1], c[2])[0] + 1440; nextName = NAMES[0];
    }
    var left = (nextAt - n.min) * 60 - n.sec;
    var hh = Math.floor(left / 3600), mi = Math.floor(left % 3600 / 60), ss = left % 60;
    $("mq-next-name").textContent = nextName;
    $("mq-next-at").textContent = hm(nextAt % 1440) + " " + ap(nextAt % 1440);
    $("mq-next-left").textContent = hh + ":" + (mi < 10 ? "0" : "") + mi + ":" + (ss < 10 ? "0" : "") + ss;
    $("mq-today-date").textContent = DAYS[new Date(Date.UTC(n.y, n.m - 1, n.d)).getUTCDay()] + " " + n.d + " " + MONTHS[n.m - 1] + " " + n.y +
      (hijri(n.y, n.m, n.d) ? " · " + hijri(n.y, n.m, n.d) : "");
    var cells = today.querySelectorAll("[data-p]");
    Array.prototype.forEach.call(cells, function (el) {
      var p = +el.getAttribute("data-p");
      el.querySelector("b").textContent = hm(t[p]);
      el.classList.toggle("on", p === next || (next < 0 && p === 0));
      el.classList.toggle("past", next >= 0 ? (t[p] <= n.min) : p !== 0);
    });
  }

  function renderMonth() {
    var c = CITIES[+citySel.value], days = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate(), n = cairoNow();
    monthLbl.textContent = MONTHS[view.m - 1] + " " + view.y;
    var rows = [], firstH = hijri(view.y, view.m, 1);
    for (var d = 1; d <= days; d++) {
      var t = times(view.y, view.m, d, c[1], c[2]);
      var wd = new Date(Date.UTC(view.y, view.m - 1, d)).getUTCDay(), h = hijri(view.y, view.m, d), hd = hijriDay(h);
      var cls = [];
      if (wd === 5) cls.push("fri");
      if (hd >= 13 && hd <= 15) cls.push("white");
      if (view.y === n.y && view.m === n.m && d === n.d) cls.push("now");
      var hcell = (d === 1 || hd === 1) ? h : String(hd || "");
      var tr = "<tr" + (cls.length ? " class=\"" + cls.join(" ") + "\"" : "") + "><th scope=\"row\">" + DAYS[wd] + " <span>" + d + "</span></th><td class=\"h\">" + hcell + "</td>";
      for (var i = 0; i < 6; i++) tr += "<td>" + hm(t[i]) + "</td>";
      rows.push(tr + "</tr>");
    }
    body.innerHTML = rows.join("");
    var cap = $("mq-cap");
    if (cap) cap.textContent = "مواقيت الصلاة في " + c[0] + " — " + MONTHS[view.m - 1] + " " + view.y + (firstH ? " (" + firstH + ")" : "");
  }

  function shift(k) {
    view.m += k;
    if (view.m < 1) { view.m = 12; view.y--; }
    if (view.m > 12) { view.m = 1; view.y++; }
    renderMonth();
  }
  $("mq-prev").addEventListener("click", function () { shift(-1); });
  $("mq-next").addEventListener("click", function () { shift(1); });
  citySel.addEventListener("change", function () { store.set("mq_city", citySel.value); renderMonth(); renderToday(); });
  var pr = $("mq-print");
  if (pr) pr.addEventListener("click", function () { window.print(); });

  document.documentElement.classList.add("mq-ready");
  renderMonth();
  renderToday();
  setInterval(renderToday, 1000);
})();
