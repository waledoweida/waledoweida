/* حسابات «التحليلات الدقيقة» في لوحة تحكم أذكاري، من مستندات usage/ (lib/analytics.dart في التطبيق).
   كل مستند = موبايل واحد في يوم واحد: id = <رقم التثبيت>_<اليوم>، d = اليوم،
   s = {n: مرات الفتح، sec: ثواني الاستخدام}، hr = {h08: مرات الفتح الساعة 8}، life = {t: new|update، from، to}،
   i = أول يوم استخدام، dev = {b: الشركة، m: الموديل، a: نسخة أندرويد (SDK)}، src = play|other.
   دوال من غير أي اعتماد على الصفحة عشان تتختبر (tests/athkari-analytics.test.js). */
(function (root) {
  "use strict";
  function addDays(day, n) {
    const p = day.split("-").map(Number);
    const t = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return t.toISOString().slice(0, 10);
  }
  const dev = d => String(d.id || "").split("_")[0];
  const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

  /** all = آخر 60 يوم (للرجوع والنشطين)، docs = الفترة المختارة، yesterday = آخر يوم كامل */
  function compute(all, docs, yesterday) {
    const out = { installs: 0, updates: 0, opensPerDevDay: 0, secPerDevDay: 0, secPerSession: 0,
      dau: 0, wau: 0, mau: 0, ret: {}, hours: {}, lifePaths: {}, sources: {}, brands: {}, android: {} };

    // التثبيت والتحديث ومسارات النسخ (في الفترة المختارة)
    for (const d of docs) {
      const l = d.life;
      if (!l || !l.t) continue;
      if (l.t === "new") { out.installs++; inc(out.lifePaths, `تثبيت جديد · ${l.to || "؟"}`); }
      else if (l.t === "update") {
        out.updates++;
        inc(out.lifePaths, `${l.from === "old" ? "نسخة قديمة" : (l.from || "؟")} ← ${l.to || "؟"}`);
      }
    }

    // مرات الفتح والمدة (المستندات اللي فيها s بس، يعني النسخة الجديدة)
    let n = 0, sec = 0, withS = 0;
    for (const d of docs) {
      if (!d.s) continue;
      withS++; n += +d.s.n || 0; sec += +d.s.sec || 0;
      for (const [h, c] of Object.entries(d.hr || {})) inc(out.hours, h, +c || 0);
    }
    if (withS) { out.opensPerDevDay = n / withS; out.secPerDevDay = sec / withS; }
    if (n) out.secPerSession = sec / n;

    // النشطين: موبايلات مختلفة
    const active = from => new Set(all.filter(d => d.d >= from && d.d <= yesterday).map(dev)).size;
    out.dau = active(yesterday);
    out.wau = active(addDays(yesterday, -6));
    out.mau = active(addDays(yesterday, -29));

    // الرجوع: من اللي أول يوم ليهم X، كام واحد فتح يوم X+N
    const first = {}, days = {};
    for (const d of all) {
      const id = dev(d);
      if (typeof d.i === "string" && d.i.length === 10) first[id] = first[id] && first[id] < d.i ? first[id] : d.i;
      (days[id] = days[id] || new Set()).add(d.d);
    }
    const earliest = all.reduce((m, d) => (!m || d.d < m ? d.d : m), "");
    for (const [key, N] of [["d1", 1], ["d7", 7], ["d30", 30]]) {
      let cohort = 0, back = 0;
      for (const [id, i] of Object.entries(first)) {
        if (i < earliest || addDays(i, N) > yesterday) continue; // لسه بدري أو قبل البيانات
        cohort++;
        if (days[id] && days[id].has(addDays(i, N))) back++;
      }
      out.ret[key] = { cohort, back, rate: cohort ? back / cohort : 0 };
    }

    // الموبايلات ومصدر التثبيت: آخر معلومة لكل موبايل في الفترة
    const latest = {};
    for (const d of docs) { const id = dev(d); if (!latest[id] || latest[id].d < d.d) latest[id] = d; }
    for (const d of Object.values(latest)) {
      if (d.src) inc(out.sources, d.src);
      if (d.dev && d.dev.b) { const b = String(d.dev.b); inc(out.brands, b.charAt(0).toUpperCase() + b.slice(1).toLowerCase()); }
      if (d.dev && d.dev.a) inc(out.android, String(d.dev.a));
    }
    return out;
  }

  const api = { compute, addDays };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.athkariAnalytics = api;
})(typeof window !== "undefined" ? window : this);
