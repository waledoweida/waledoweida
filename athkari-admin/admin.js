/* لوحة تحكم أذكاري — بتكلم Firebase (Auth + Firestore) عن طريق REST، والإشعار الفوري عن طريق /api/athkari-push */
(function () {
  "use strict";
  const CFG = { apiKey: "AIzaSyD4ih7NvJNF_VadjfLLtLfhppsMfPl9uMk", projectId: "athkari-fd56c" };
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const ICONS = { sunny: "☀️ صباح", nightlight: "🌙 مساء", mosque: "🕌 صلاة", bedtime: "😴 نوم", favorite: "🤍 دعاء",
    star: "⭐ نجمة", travel: "✈️ سفر", food: "🍽️ طعام", home: "🏠 منزل", alarm: "⏰ استيقاظ", spa: "🌿 كرب",
    shield: "🛡️ رقية", water: "💧 وضوء", book: "📖 كتاب" };
  const TITLES = { overview: "نظرة عامة", notify: "الإشعارات", home: "الرئيسية والبانر", campaigns: "حملات المناسبات",
    adhkar: "الأذكار", usage: "استخدام التطبيق", ded: "صدقة جارية", khatmas: "الختمات الجماعية", asma: "الأسماء الحسنى", update: "تحديث التطبيق" };
  // نفس الحملات اللي في التطبيق (lib/content/campaigns.dart)
  const CAMPAIGNS = [
    { id: "eid_fitr", title: "عيد فطر مبارك", emoji: "🎉", when: "1–3 شوال", sub: "تقبّل الله منا ومنكم صالح الأعمال، وكل عام وأنتم بخير", colors: ["#7B2D26", "#C9A227"] },
    { id: "qadr", title: "العشر الأواخر وليلة القدر", emoji: "✨", when: "21–30 رمضان", sub: "تحرّوا ليلة القدر في الوتر من العشر الأواخر، وأكثروا من الدعاء", colors: ["#1B1F3B", "#4A3F8C"] },
    { id: "ramadan", title: "رمضان كريم", emoji: "🌙", when: "شهر رمضان", sub: "اللهم بلّغنا ليلة القدر، وتقبّل منا الصيام والقيام", colors: ["#14213D", "#1B4332"] },
    { id: "eid_adha", title: "عيد أضحى مبارك", emoji: "🐑", when: "10–13 ذو الحجة", sub: "تقبّل الله منا ومنكم، وأعاده علينا وعليكم بالخير", colors: ["#6B2E1F", "#C9A227"] },
    { id: "arafah", title: "يوم عرفة", emoji: "🤲", when: "9 ذو الحجة", sub: "خير الدعاء دعاء يوم عرفة، فأكثروا من الدعاء والذكر", colors: ["#7A4E12", "#C9A227"] },
    { id: "dhul_hijjah", title: "العشر الأوائل من ذي الحجة", emoji: "🕋", when: "1–8 ذو الحجة", sub: "أفضل أيام الدنيا، أكثروا فيها من التكبير والتهليل والعمل الصالح", colors: ["#1B4332", "#8C6D1F"] },
    { id: "ashura", title: "يوم عاشوراء", emoji: "🌿", when: "9–10 محرم", sub: "يُستحب صيام التاسع والعاشر من محرم", colors: ["#0F4C5C", "#1B4332"] },
  ];

  const DOCS = `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents`;
  const DOC_PREFIX = `projects/${CFG.projectId}/databases/(default)/documents/`;

  // ───────── الدخول ─────────
  let session = null;
  async function signIn(email, password) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CFG.apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "login failed");
    session = { idToken: d.idToken, refreshToken: d.refreshToken, exp: Date.now() + (+d.expiresIn - 60) * 1000, email: d.email };
    store.set("athkari_refresh", d.refreshToken);
    store.set("athkari_email", d.email);
  }
  async function refresh() {
    const rt = session?.refreshToken || store.get("athkari_refresh");
    if (!rt) return false;
    const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${CFG.apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(rt)}`,
    });
    if (!r.ok) { store.set("athkari_refresh", null); return false; }
    const d = await r.json();
    session = { idToken: d.id_token, refreshToken: d.refresh_token, exp: Date.now() + (+d.expires_in - 60) * 1000, email: store.get("athkari_email") || "" };
    store.set("athkari_refresh", d.refresh_token);
    return true;
  }
  async function token() {
    if (!session || Date.now() > session.exp) {
      if (!(await refresh())) throw new Error("انتهت الجلسة، سجّل الدخول تاني");
    }
    return session.idToken;
  }

  // ───────── Firestore REST ─────────
  const enc = v => typeof v === "number"
    ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
    : typeof v === "boolean" ? { booleanValue: v } : { stringValue: String(v ?? "") };
  const dec = f => {
    if (!f) return null;
    if (f.integerValue !== undefined) return +f.integerValue;
    if (f.doubleValue !== undefined) return f.doubleValue;
    if (f.booleanValue !== undefined) return f.booleanValue;
    if (f.timestampValue !== undefined) return Date.parse(f.timestampValue);
    if (f.mapValue !== undefined) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, v]) => [k, dec(v)]));
    if (f.arrayValue !== undefined) return (f.arrayValue.values || []).map(dec);
    if (f.nullValue !== undefined) return null;
    return f.stringValue ?? "";
  };
  const toFields = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
  const fromDoc = d => ({ id: d.name.split("/").pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, dec(v)])) });

  async function api(path, opts = {}) {
    const r = await fetch(`${DOCS}${path}`, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}`, ...(opts.headers || {}) } });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      if (r.status === 404 && (opts.method || "GET") === "GET") return null;
      throw new Error(d.error?.status === "PERMISSION_DENIED" ? "الحساب ده مش مسموح له يعدّل (قواعد الأمان)." : (d.error?.message || r.statusText));
    }
    return r.status === 204 ? null : r.json();
  }
  async function listAll(col) {
    let out = [], pageToken = "";
    do {
      const d = await api(`/${col}?pageSize=300${pageToken ? "&pageToken=" + pageToken : ""}`);
      out = out.concat(((d && d.documents) || []).map(fromDoc));
      pageToken = (d && d.nextPageToken) || "";
    } while (pageToken);
    return out;
  }
  const setDoc = (col, id, data) => api(`/${col}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ fields: toFields(data) }) });
  const addDoc = (col, data) => api(`/${col}`, { method: "POST", body: JSON.stringify({ fields: toFields(data) }) });
  const delDoc = (col, id) => api(`/${col}/${encodeURIComponent(id)}`, { method: "DELETE" });
  const commit = writes => api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
  const wSet = (col, id, data) => ({ update: { name: DOC_PREFIX + col + "/" + id, fields: toFields(data) } });
  const wDel = (col, id) => ({ delete: DOC_PREFIX + col + "/" + id });
  const bumpVersion = () => setDoc("meta", "content", { version: Date.now() });
  async function count(col, where) {
    const q = { from: [{ collectionId: col }] };
    if (where) q.where = where;
    const r = await api(":runAggregationQuery", { method: "POST", body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: q, aggregations: [{ alias: "n", count: {} }] } }) });
    const row = (Array.isArray(r) ? r : [r]).find(x => x && x.result);
    return row ? +row.result.aggregateFields.n.integerValue : 0;
  }

  // ───────── أدوات الواجهة ─────────
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2800);
  }
  const fail = err => toast("حصل خطأ: " + (err && err.message ? err.message : err));
  function openModal(html) { $("modal").innerHTML = html; $("overlay").classList.remove("hidden"); }
  function closeModal() { $("overlay").classList.add("hidden"); }
  $("overlay").addEventListener("click", e => { if (e.target.id === "overlay") closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); $("phoneCol").classList.remove("open"); } });
  const strip = ({ id, ...rest }) => rest;
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fmtTime = ms => new Date(ms).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  function confirmBox(text) {
    return new Promise(resolve => {
      openModal(`<h3>تأكيد</h3><p>${esc(text)}</p><div class="foot"><button type="button" class="btn btn-ghost" id="cNo">إلغاء</button><button type="button" class="btn btn-danger" id="cYes">تأكيد</button></div>`);
      $("cNo").onclick = () => { closeModal(); resolve(false); };
      $("cYes").onclick = () => { closeModal(); resolve(true); };
    });
  }

  // ───────── التبويبات ─────────
  const loaders = {};
  function go(tab) {
    document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("hidden", t.id !== "tab-" + tab));
    $("pageTitle").textContent = TITLES[tab] || "";
    store.set("athkari_tab", tab);
    if (loaders[tab]) loaders[tab]().catch(fail);
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll("#nav button").forEach(b => b.addEventListener("click", () => go(b.dataset.tab)));
  document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
  $("previewBtn").onclick = () => $("phoneCol").classList.add("open");
  $("phoneCol").addEventListener("click", e => { if (e.target.id === "phoneCol") $("phoneCol").classList.remove("open"); });

  // ───────── البيانات ─────────
  const DEFAULTS = { bannerEnabled: false, bannerTitle: "", bannerText: "", dailyText: "", dailyReference: "", dedicationMinutes: 1,
    latestBuild: 0, updateMessage: "", updateUrl: "", updateForce: false, bannerImageV: 0 };
  let settings = { ...DEFAULTS }, categories = [], adhkar = [], dedications = [], campOverrides = {}, bannerImage = "", currentCat = null;

  async function loadSettings() {
    const d = await api("/settings/app");
    settings = { ...DEFAULTS, ...(d ? fromDoc(d) : {}) };
    delete settings.id;
    if (settings.bannerImageV > 0) {
      const img = await api("/media/banner");
      bannerImage = img ? (fromDoc(img).data || "") : "";
    } else bannerImage = "";
    fillHome(); fillUpdate(); $("dedMinutes").value = String(settings.dedicationMinutes || 1);
  }
  async function saveSettings(patch, msg) {
    settings = { ...settings, ...patch };
    await setDoc("settings", "app", settings);
    await bumpVersion();
    toast(msg || "اتنشر للتطبيق ✓");
    renderPhone();
  }

  // ───────── نظرة عامة ─────────
  loaders.overview = async () => {
    const now = new Date();
    const back = n => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
    const since = v => ({ fieldFilter: { field: { fieldPath: "lastSeen" }, op: "GREATER_THAN_OR_EQUAL", value: { stringValue: v } } });
    ["stToday", "st7", "st30", "stAll"].forEach(id => { $(id).textContent = "…"; });
    const [t, w, m, a, kh] = await Promise.all([count("devices", since(ymd(now))), count("devices", since(back(6))), count("devices", since(back(29))), count("devices"), count("khatmas")]);
    $("stToday").textContent = t; $("st7").textContent = w; $("st30").textContent = m; $("stAll").textContent = a;
    $("contentFacts").innerHTML = [
      ["أقسام الأذكار", categories.length], ["الأذكار", adhkar.length], ["أسماء صدقة جارية", dedications.filter(d => d.active !== false).length], ["ختمات جماعية", kh],
    ].map(([k, v]) => `<li><b>${v}</b>${k}</li>`).join("");
    $("importBanner").classList.toggle("hidden", categories.length > 0);
    // الإصدارات
    try {
      const r = await api(":runQuery", { method: "POST", body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: "devices" }], where: since(back(29)), select: { fields: [{ fieldPath: "version" }] }, limit: 5000 } }) });
      const counts = {};
      (r || []).forEach(x => { if (x.document) { const v = dec(x.document.fields?.version) || "؟"; counts[v] = (counts[v] || 0) + 1; } });
      const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
      const rows = Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 6);
      $("versions").innerHTML = rows.map(([v, n]) => `<div class="vrow"><span dir="ltr">${esc(v)}</span><span class="vbar"><i style="width:${Math.round(n * 100 / total)}%"></i></span><span>${n}</span></div>`).join("")
        || `<span class="hint">لسه مفيش بيانات</span>`;
    } catch { $("versions").innerHTML = `<span class="hint">—</span>`; }
  };

  // ───────── استخدام التطبيق (usage/ من analytics.dart في التطبيق) ─────────
  const RECITERS = { alafasy: "مشاري العفاسي", husary: "محمود خليل الحصري", minshawi: "محمد صديق المنشاوي",
    abdulbasit: "عبد الباسط عبد الصمد", maher: "ماهر المعيقلي", sudais: "عبد الرحمن السديس", shuraym: "سعود الشريم",
    ghamdi: "سعد الغامدي", dossari: "ياسر الدوسري", hudhaify: "علي الحذيفي", qatami: "ناصر القطامي", abdulbasit_mj: "عبد الباسط (مجوّد)" };
  const FEATURES = { quran: "المصحف", daily_wird: "ورد اليوم", khatma: "الختمة الجماعية", qibla: "القبلة", quran_wird: "الورد القرآني",
    asma: "الأسماء الحسنى", calendar: "التقويم", stats: "إحصائياتي", search: "البحث", learn_prayer: "تعليم الصلاة",
    customize: "رتّب أذكارك", share_dhikr_image: "مشاركة ذكر كصورة", share_ayah_image: "مشاركة آية كصورة",
    tafsir_saadi: "تحميل تفسير السعدي", tafsir_ibnkathir: "تحميل تفسير ابن كثير", tafsir_jalalayn: "تحميل تفسير الجلالين",
    tab_home: "تاب الرئيسية", tab_prayer: "تاب الصلاة", tab_favorites: "تاب المفضلة", tab_tasbeeh: "تاب السبحة", tab_settings: "تاب الإعدادات" };
  const notifLabel = k => {
    if (k === "prayer") return "الأذان والصلاة";
    if (k === "other") return "إشعارات أخرى";
    if (k.startsWith("cat_")) return "فتح " + catTitle(k.slice(4));
    if (k.startsWith("btn_done_")) return "زرار «قرأتها ✓» — " + catTitle(k.slice(9));
    return k;
  };
  const catTitle = id => (categories.find(c => c.id === id) || {}).title || id;
  let usageDays = 7;
  function bars(el, obj, label, max = 10) {
    const rows = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, max);
    const top = rows.length ? rows[0][1] : 1;
    $(el).innerHTML = rows.map(([k, n]) => `<div class="urow"><span>${esc(label(k))}</span><span class="vbar"><i style="width:${Math.max(3, Math.round(n * 100 / top))}%"></i></span><span>${n.toLocaleString("ar-EG")}</span></div>`).join("")
      || `<span class="hint">لسه مفيش بيانات للفترة دي</span>`;
  }
  loaders.usage = async () => {
    if (!categories.length) await loadAdhkar().catch(() => {});
    const now = new Date();
    const from = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - usageDays));
    const to = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    ["uDevices", "uMorning", "uEvening", "uDone"].forEach(id => { $(id).textContent = "…"; });
    const r = await api(":runQuery", { method: "POST", body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: "usage" }],
      where: { compositeFilter: { op: "AND", filters: [
        { fieldFilter: { field: { fieldPath: "d" }, op: "GREATER_THAN_OR_EQUAL", value: { stringValue: from } } },
        { fieldFilter: { field: { fieldPath: "d" }, op: "LESS_THAN_OR_EQUAL", value: { stringValue: to } } },
      ] } },
      limit: 20000 } }) });
    const docs = (r || []).filter(x => x.document).map(x => fromDoc(x.document));
    const sum = g => { const o = {}; docs.forEach(d => Object.entries(d[g] || {}).forEach(([k, n]) => { o[k] = (o[k] || 0) + (+n || 0); })); return o; };
    const devices = new Set(docs.map(d => d.id.split("_")[0]));
    const did = cat => new Set(docs.filter(d => (d.done || {})[cat] > 0).map(d => d.id.split("_")[0])).size;
    const pct = n => devices.size ? ` <small>(${Math.round(n * 100 / devices.size)}٪)</small>` : "";
    $("uDevices").textContent = devices.size.toLocaleString("ar-EG");
    $("uMorning").innerHTML = did("morning").toLocaleString("ar-EG") + pct(did("morning"));
    $("uEvening").innerHTML = did("evening").toLocaleString("ar-EG") + pct(did("evening"));
    $("uDone").textContent = Object.values(sum("done")).reduce((s, n) => s + n, 0).toLocaleString("ar-EG");
    bars("uCat", sum("cat"), catTitle);
    bars("uFeat", sum("feat"), k => FEATURES[k] || k, 12);
    bars("uRec", sum("rec"), k => RECITERS[k] || k);
    bars("uNotif", sum("notif"), notifLabel);
    const perDay = {};
    docs.forEach(d => { perDay[d.d] = (perDay[d.d] || 0) + 1; });
    const days = Object.keys(perDay).sort().reverse().slice(0, 30);
    const topDay = Math.max(1, ...Object.values(perDay));
    $("uDays").innerHTML = days.map(k => `<div class="urow"><span dir="ltr">${esc(k)}</span><span class="vbar"><i style="width:${Math.round(perDay[k] * 100 / topDay)}%"></i></span><span>${perDay[k]}</span></div>`).join("")
      || `<span class="hint">لسه مفيش بيانات</span>`;
  };
  document.querySelectorAll("#usageRange button").forEach(b => b.addEventListener("click", () => {
    usageDays = +b.dataset.days;
    document.querySelectorAll("#usageRange button").forEach(x => x.classList.toggle("on", x === b));
    loaders.usage().catch(fail);
  }));

  // ───────── الإشعارات ─────────
  const pvSync = () => {
    $("pvTitle").textContent = $("pushTitle").value.trim() || "جمعة مباركة 🌿";
    $("pvBody").textContent = $("pushBody").value.trim() || "لا تنسوا قراءة سورة الكهف والصلاة على النبي ﷺ";
    $("pushCount").textContent = $("pushBody").value.length;
  };
  ["pushTitle", "pushBody"].forEach(id => $(id).addEventListener("input", pvSync));
  document.querySelectorAll('input[name="when"]').forEach(r => r.addEventListener("change", () => {
    const later = document.querySelector('input[name="when"]:checked').value === "later";
    $("laterWrap").classList.toggle("hidden", !later);
    $("pushSend").textContent = later ? "جدولة الإشعار" : "إرسال دلوقتي";
    if (later && !$("pushAt").value) {
      const d = new Date(Date.now() + 24 * 3600e3); d.setMinutes(0, 0, 0);
      $("pushAt").value = new Date(d.getTime() - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
    }
  }));
  $("pushSend").textContent = "إرسال دلوقتي";

  function setupHelp() {
    $("pushSetup").classList.remove("hidden");
    $("pushSetup").innerHTML = `<b>الإرسال الفوري محتاج إعداد مرة واحدة:</b>
      <ol>
        <li>افتح <a href="https://console.firebase.google.com/project/${CFG.projectId}/settings/serviceaccounts/adminsdk" target="_blank" rel="noopener">حسابات الخدمة في Firebase</a> واضغط <b>Generate new private key</b> (هينزل ملف JSON).</li>
        <li>افتح <a href="https://vercel.com/dashboard" target="_blank" rel="noopener">Vercel</a> ← مشروع waledoweida ← Settings ← Environment Variables.</li>
        <li>أضف متغير اسمه <b dir="ltr">ATHKARI_SERVICE_ACCOUNT</b> والصق محتوى الملف كله، واحفظ، وبعدين Redeploy.</li>
      </ol>
      <span class="hint">لحد ما تعمل كده، تقدر تجدول الإشعارات عادي.</span>`;
  }

  $("pushForm").addEventListener("submit", async e => {
    e.preventDefault();
    const title = $("pushTitle").value.trim(), body = $("pushBody").value.trim();
    if (!title) return toast("اكتب عنوان الإشعار");
    const later = document.querySelector('input[name="when"]:checked').value === "later";
    const btn = $("pushSend"); btn.disabled = true;
    try {
      if (later) {
        const at = new Date($("pushAt").value).getTime();
        if (!at || at < Date.now() + 60e3) throw new Error("اختار ميعاد في المستقبل");
        await addDoc("announcements", { title, body, at, created: Date.now() });
        await bumpVersion();
        toast("اتجدول الإشعار ✓");
      } else {
        const r = await fetch("/api/athkari-push", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: await token(), title, body }) });
        const d = await r.json().catch(() => ({}));
        if (d.error === "not_configured") { setupHelp(); throw new Error("الإرسال الفوري لسه محتاج إعداد (التفاصيل تحت)"); }
        if (!r.ok) throw new Error(d.error === "not_admin" ? "الحساب ده مش أدمن" : d.error === "too_many" ? "بعت إشعارات كتير، استنى شوية" : "تعذّر الإرسال");
        await addDoc("pushes", { title, body, at: Date.now() }).catch(() => {});
        toast("اتبعت الإشعار لكل المستخدمين ✓");
      }
      $("pushTitle").value = ""; $("pushBody").value = ""; pvSync();
      await loaders.notify();
    } catch (err) { fail(err); }
    btn.disabled = false;
  });

  loaders.notify = async () => {
    const [anns, pushes] = await Promise.all([listAll("announcements"), listAll("pushes").catch(() => [])]);
    const now = Date.now();
    const upcoming = anns.filter(a => a.at > now).sort((x, y) => x.at - y.at);
    $("annList").innerHTML = upcoming.map(a => `<div class="rowline"><div class="who"><b>${esc(a.title)}</b><span>${esc(fmtTime(a.at))}${a.body ? " • " + esc(a.body.slice(0, 60)) : ""}</span></div><button type="button" class="btn btn-danger small" data-adel="${esc(a.id)}">إلغاء</button></div>`).join("")
      || `<p class="hint">مفيش إشعارات مجدولة.</p>`;
    document.querySelectorAll("[data-adel]").forEach(b => b.onclick = async () => {
      try { await delDoc("announcements", b.dataset.adel); await bumpVersion(); toast("اتلغى"); await loaders.notify(); } catch (e) { fail(e); }
    });
    // نمسح القديم اللي فات ميعاده بقاله أكتر من 3 أيام
    anns.filter(a => a.at < now - 3 * 86400e3).forEach(a => delDoc("announcements", a.id).catch(() => {}));
    $("pushList").innerHTML = pushes.sort((x, y) => y.at - x.at).slice(0, 15).map(p => `<div class="rowline"><div class="who"><b>${esc(p.title)}</b><span>${esc(fmtTime(p.at))}${p.body ? " • " + esc(p.body.slice(0, 60)) : ""}</span></div><span class="chip green">اتبعت</span></div>`).join("")
      || `<p class="hint">لسه مفيش.</p>`;
  };

  // ───────── الرئيسية والبانر ─────────
  function fillHome() {
    $("bannerOn").checked = !!settings.bannerEnabled;
    $("bannerTitle").value = settings.bannerTitle || "";
    $("bannerText").value = settings.bannerText || "";
    $("dailyText").value = settings.dailyText || "";
    $("dailyRef").value = settings.dailyReference || "";
    showImage();
  }
  function showImage() {
    const has = !!bannerImage;
    $("bannerImg").classList.toggle("hidden", !has);
    $("imgEmpty").classList.toggle("hidden", has);
    $("imgRemove").classList.toggle("hidden", !has);
    if (has) $("bannerImg").src = "data:image/jpeg;base64," + bannerImage;
    renderPhone();
  }
  ["bannerOn", "bannerTitle", "bannerText", "dailyText", "dailyRef"].forEach(id => $(id).addEventListener("input", renderPhone));
  $("bannerOn").addEventListener("change", renderPhone);

  async function compress(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      let w = Math.min(1080, img.naturalWidth), q = 0.85, data = "";
      for (let attempt = 0; attempt < 8; attempt++) {
        const h = Math.round(img.naturalHeight * w / img.naturalWidth);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        data = c.toDataURL("image/jpeg", q).split(",")[1];
        if (data.length < 600000) return data;
        q -= 0.1; if (q < 0.5) { q = 0.75; w = Math.round(w * 0.8); }
      }
      throw new Error("الصورة كبيرة جدًا");
    } finally { URL.revokeObjectURL(url); }
  }
  $("imgInput").addEventListener("change", async e => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      toast("بنجهّز الصورة…");
      const data = await compress(f);
      const v = Math.floor(Date.now() / 1000);
      await setDoc("media", "banner", { data, v });
      bannerImage = data;
      await saveSettings({ bannerImageV: v, bannerEnabled: true }, "اتنشرت الصورة للتطبيق ✓");
      $("bannerOn").checked = true; showImage();
    } catch (err) { fail(err); }
  });
  $("imgRemove").onclick = async () => {
    if (!(await confirmBox("تشيل صورة البانر؟"))) return;
    try { await delDoc("media", "banner"); bannerImage = ""; await saveSettings({ bannerImageV: 0 }, "اتشالت الصورة"); showImage(); } catch (e) { fail(e); }
  };
  $("saveHome").onclick = async () => {
    const btn = $("saveHome"); btn.disabled = true;
    try {
      await saveSettings({ bannerEnabled: $("bannerOn").checked, bannerTitle: $("bannerTitle").value.trim(), bannerText: $("bannerText").value.trim(),
        dailyText: $("dailyText").value.trim(), dailyReference: $("dailyRef").value.trim() });
    } catch (e) { fail(e); }
    btn.disabled = false;
  };

  // ───────── الحملات ─────────
  async function loadCampaigns() {
    const list = await listAll("campaigns");
    campOverrides = Object.fromEntries(list.map(c => [c.id, c]));
    renderCampaigns(); renderPhone();
  }
  function renderCampaigns() {
    $("campList").innerHTML = CAMPAIGNS.map(c => {
      const o = campOverrides[c.id] || {}, mode = o.mode || "auto";
      return `<div class="camp" data-camp="${c.id}">
        <div class="camp-head" style="background:linear-gradient(135deg,${c.colors[0]},${c.colors[1]})"><span class="em">${c.emoji}</span><div><b>${esc(c.title)}</b><small>تلقائي: ${esc(c.when)}</small></div></div>
        <div class="camp-body">
          <div class="seg" role="group" aria-label="حالة الحملة">
            ${[["auto", "تلقائي"], ["on", "مفعّلة دلوقتي"], ["off", "متوقفة"]].map(([k, v]) => `<button type="button" data-mode="${k}" class="${k === mode ? "on" : ""}">${v}</button>`).join("")}
          </div>
          <div class="state ${mode === "on" ? "live" : ""}">${mode === "on" ? "● ظاهرة في التطبيق دلوقتي" : mode === "off" ? "مش هتظهر حتى في ميعادها" : "هتظهر لوحدها في ميعادها"}</div>
          <label for="ct-${c.id}">الرسالة (اختياري)</label>
          <textarea id="ct-${c.id}" class="plain" rows="2" maxlength="160" placeholder="${esc(c.sub)}">${esc(o.text || "")}</textarea>
          <button type="button" class="btn btn-green small" data-csave="${c.id}">حفظ</button>
        </div></div>`;
    }).join("");
    document.querySelectorAll("[data-camp]").forEach(card => {
      const id = card.dataset.camp;
      card.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => saveCampaign(id, b.dataset.mode));
      card.querySelector("[data-csave]").onclick = () => saveCampaign(id, (campOverrides[id] || {}).mode || "auto");
    });
  }
  async function saveCampaign(id, mode) {
    const text = $("ct-" + id).value.trim();
    try {
      if (mode === "on") { // حملة واحدة بس مفعّلة يدويًا في نفس الوقت
        const others = Object.values(campOverrides).filter(o => o.id !== id && o.mode === "on");
        for (const o of others) { await setDoc("campaigns", o.id, { mode: "auto", text: o.text || "" }); }
      }
      await setDoc("campaigns", id, { mode, text });
      await bumpVersion(); toast("اتنشر للتطبيق ✓"); await loadCampaigns();
    } catch (e) { fail(e); }
  }
  loaders.campaigns = loadCampaigns;

  // ───────── الأذكار ─────────
  async function loadAdhkar() {
    [categories, adhkar] = await Promise.all([listAll("categories"), listAll("adhkar")]);
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!currentCat || !categories.find(c => c.id === currentCat)) currentCat = categories[0]?.id ?? null;
    renderAdhkar();
  }
  const itemsOf = cat => adhkar.filter(a => a.categoryId === cat).sort((x, y) => (x.order || 0) - (y.order || 0));
  function renderAdhkar() {
    $("catList").innerHTML = categories.map(c => `<button type="button" class="cat ${c.id === currentCat ? "active" : ""}" data-id="${esc(c.id)}">${esc((ICONS[c.icon] || "📖").split(" ")[0])} ${esc(c.title)}<span class="n">${itemsOf(c.id).length}</span></button>`).join("")
      || `<div class="empty">لا توجد أقسام. <button type="button" class="btn btn-gold" id="importBtn2">استيراد الأذكار الافتراضية</button></div>`;
    if ($("importBtn2")) $("importBtn2").onclick = importAdhkar;
    document.querySelectorAll(".cat").forEach(el => el.onclick = () => { currentCat = el.dataset.id; renderAdhkar(); });
    const cat = categories.find(c => c.id === currentCat);
    $("catTitle").textContent = cat ? cat.title : "—";
    $("editCatBtn").disabled = $("addItemBtn").disabled = !cat;
    const items = itemsOf(currentCat);
    $("items").innerHTML = items.map((a, i) => `
      <div class="item">
        <div class="text">${esc(a.text)}</div>
        ${a.virtue ? `<div class="meta"><span class="chip">الفضل: ${esc(a.virtue)}</span></div>` : ""}
        <div class="meta">
          <span class="chip gold">× ${esc(a.count)}</span>
          ${a.reference ? `<span class="chip">${esc(a.reference)}</span>` : ""}
          <div class="actions">
            <button type="button" class="btn btn-ghost small" data-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="لأعلى">↑</button>
            <button type="button" class="btn btn-ghost small" data-down="${i}" ${i === items.length - 1 ? "disabled" : ""} aria-label="لأسفل">↓</button>
            <button type="button" class="btn btn-ghost small" data-edit="${esc(a.id)}">تعديل</button>
            <button type="button" class="btn btn-danger small" data-del="${esc(a.id)}">حذف</button>
          </div>
        </div>
      </div>`).join("") || `<div class="empty">${cat ? "لا توجد أذكار في القسم ده." : ""}</div>`;
    document.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openItemForm(adhkar.find(a => a.id === b.dataset.edit)));
    document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => deleteItem(b.dataset.del));
    document.querySelectorAll("[data-up]").forEach(b => b.onclick = () => move(items, +b.dataset.up, -1));
    document.querySelectorAll("[data-down]").forEach(b => b.onclick = () => move(items, +b.dataset.down, 1));
  }
  loaders.adhkar = loadAdhkar;
  async function move(items, i, dir) {
    const list = items.slice();
    [list[i], list[i + dir]] = [list[i + dir], list[i]];
    try { await commit(list.map((a, k) => wSet("adhkar", a.id, { ...strip(a), order: k + 1 }))); await bumpVersion(); await loadAdhkar(); } catch (e) { fail(e); }
  }
  function openItemForm(item) {
    const isNew = !item;
    const nextOrder = Math.max(0, ...itemsOf(currentCat).map(a => a.order || 0)) + 1;
    item = item || { categoryId: currentCat, text: "", count: 1, reference: "", virtue: "", order: nextOrder };
    openModal(`<h3>${isNew ? "ذكر جديد" : "تعديل الذكر"}</h3>
      <form id="itemForm">
        <label for="fText">نص الذكر</label><textarea id="fText" name="text" rows="5" required>${esc(item.text)}</textarea>
        <div class="row">
          <div><label for="fCount">عدد المرات</label><input id="fCount" name="count" type="number" min="1" value="${esc(item.count)}" required></div>
          <div><label for="fOrder">الترتيب</label><input id="fOrder" name="order" type="number" value="${esc(item.order)}" required></div>
        </div>
        <label for="fRef">المصدر (مثال: رواه مسلم)</label><input id="fRef" name="reference" value="${esc(item.reference)}">
        <label for="fVirtue">الفضل (اختياري)</label><input id="fVirtue" name="virtue" value="${esc(item.virtue)}">
        <label for="fCat">القسم</label><select id="fCat" name="categoryId">${categories.map(c => `<option value="${esc(c.id)}" ${c.id === item.categoryId ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select>
        <div class="foot"><button type="button" class="btn btn-ghost" id="cancelBtn">إلغاء</button><button type="submit" class="btn btn-green">حفظ</button></div>
      </form>`);
    $("cancelBtn").onclick = closeModal;
    $("itemForm").onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = { text: f.get("text").trim(), count: Math.max(1, parseInt(f.get("count")) || 1), order: parseInt(f.get("order")) || 0,
        reference: f.get("reference").trim(), virtue: f.get("virtue").trim(), categoryId: f.get("categoryId") };
      const btn = e.submitter; btn.disabled = true;
      try { if (isNew) await addDoc("adhkar", data); else await setDoc("adhkar", item.id, data); await bumpVersion(); closeModal(); toast("تم الحفظ ✓"); await loadAdhkar(); }
      catch (err) { fail(err); btn.disabled = false; }
    };
  }
  async function deleteItem(id) {
    if (!(await confirmBox("متأكد إنك عايز تحذف الذكر ده؟"))) return;
    try { await delDoc("adhkar", id); await bumpVersion(); toast("تم الحذف"); await loadAdhkar(); } catch (e) { fail(e); }
  }
  function openCatForm(cat) {
    const isNew = !cat;
    cat = cat || { title: "", icon: "book", order: categories.length + 1 };
    openModal(`<h3>${isNew ? "قسم جديد" : "تعديل القسم"}</h3>
      <form id="catForm">
        <label for="cTitle">اسم القسم</label><input id="cTitle" name="title" value="${esc(cat.title)}" required>
        <div class="row">
          <div><label for="cIcon">الأيقونة</label><select id="cIcon" name="icon">${Object.entries(ICONS).map(([k, v]) => `<option value="${k}" ${k === cat.icon ? "selected" : ""}>${v}</option>`).join("")}</select></div>
          <div><label for="cOrder">الترتيب</label><input id="cOrder" name="order" type="number" value="${esc(cat.order)}" required></div>
        </div>
        <div class="foot">
          ${isNew ? "" : `<button type="button" class="btn btn-danger" id="delCatBtn">حذف القسم</button>`}
          <button type="button" class="btn btn-ghost" id="cancelBtn">إلغاء</button><button type="submit" class="btn btn-green">حفظ</button>
        </div>
      </form>`);
    $("cancelBtn").onclick = closeModal;
    if (!isNew) $("delCatBtn").onclick = async () => {
      const items = itemsOf(cat.id);
      if (!(await confirmBox(`هيتحذف القسم و${items.length} ذكر جواه. متأكد؟`))) return;
      try { await commit([...items.map(a => wDel("adhkar", a.id)), wDel("categories", cat.id)]); await bumpVersion(); toast("تم حذف القسم"); currentCat = null; await loadAdhkar(); } catch (e) { fail(e); }
    };
    $("catForm").onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = { title: f.get("title").trim(), icon: f.get("icon"), order: parseInt(f.get("order")) || 0 };
      const btn = e.submitter; btn.disabled = true;
      try {
        if (isNew) { const r = await addDoc("categories", data); currentCat = r.name.split("/").pop(); } else await setDoc("categories", cat.id, data);
        await bumpVersion(); closeModal(); toast("تم الحفظ ✓"); await loadAdhkar();
      } catch (err) { fail(err); btn.disabled = false; }
    };
  }
  $("addItemBtn").onclick = () => openItemForm(null);
  $("addCatBtn").onclick = () => openCatForm(null);
  $("editCatBtn").onclick = () => openCatForm(categories.find(c => c.id === currentCat));
  async function importAdhkar() {
    const data = window.DEFAULT_ADHKAR;
    if (!data) return toast("ملف الأذكار الافتراضية مش موجود");
    try {
      const writes = [...data.categories.map(({ id, ...c }) => wSet("categories", id, c)), ...data.adhkar.map(({ id, ...a }) => wSet("adhkar", id, a))];
      for (let i = 0; i < writes.length; i += 400) await commit(writes.slice(i, i + 400));
      await bumpVersion(); toast("تم استيراد الأذكار ✓"); await loadAdhkar(); await loaders.overview();
    } catch (err) { fail(err); }
  }
  $("importBtn").onclick = importAdhkar;

  // استبدال كل الأذكار بالنسخة المراجعة (adhkar-data.js): نسخة احتياطية على الجهاز، ثم كتابة الكل، ثم حذف اللي مش فيها
  let syncArmed = false;
  function syncInfo() {
    const d = window.DEFAULT_ADHKAR;
    if ($("syncInfo")) $("syncInfo").textContent = d ? `${d.adhkar.length} ذكر في ${d.categories.length} قسم.` : "";
  }
  $("syncAdhkarBtn").onclick = async () => {
    const data = window.DEFAULT_ADHKAR;
    if (!data) return toast("ملف الأذكار مش موجود");
    const btn = $("syncAdhkarBtn");
    if (!syncArmed) { syncArmed = true; btn.textContent = "متأكد؟ دوس تاني للتأكيد"; setTimeout(() => { syncArmed = false; btn.textContent = "تحديث الأذكار للنسخة المراجعة"; }, 6000); return; }
    syncArmed = false; btn.disabled = true; btn.textContent = "جارٍ التحديث…";
    try {
      const [cats, items] = await Promise.all([listAll("categories"), listAll("adhkar")]);
      const blob = new Blob([JSON.stringify({ savedAt: new Date().toISOString(), categories: cats, adhkar: items }, null, 1)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `athkari-adhkar-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      const keep = new Set(data.adhkar.map(x => x.id));
      const writes = [...data.categories.map(({ id, ...c }) => wSet("categories", id, c)), ...data.adhkar.map(({ id, ...x }) => wSet("adhkar", id, x)),
        ...items.filter(x => !keep.has(x.id)).map(x => wDel("adhkar", x.id))];
      for (let i = 0; i < writes.length; i += 400) await commit(writes.slice(i, i + 400));
      await bumpVersion();
      toast(`تم التحديث ✓ ${data.adhkar.length} ذكر`);
      await loadAdhkar(); await loaders.overview();
    } catch (err) { fail(err); }
    btn.disabled = false; btn.textContent = "تحديث الأذكار للنسخة المراجعة";
  };
  syncInfo();

  // ───────── صدقة جارية ─────────
  const TYPES = { deceased: "متوفى (رحمة)", sick: "مريض (شفاء)", living: "حي (بركة)", custom: "دعاء من عندك" };
  function dedText(d) {
    const f = !!d.female;
    switch (d.type) {
      case "sick": return { h: "دعواتكم بالشفاء العاجل لـ", p: f ? "اللهم ربَّ الناس، أذهب البأس، واشفِها أنت الشافي، شفاءً لا يغادر سقمًا" : "اللهم ربَّ الناس، أذهب البأس، واشفِه أنت الشافي، شفاءً لا يغادر سقمًا", r: f ? "لا تنسوها من دعائكم 🤲" : "لا تنسوه من دعائكم 🤲" };
      case "living": return { h: "صدقة جارية عن", p: f ? "اللهم احفظها وبارك فيها، واجعل هذا العمل في ميزان حسناتها" : "اللهم احفظه وبارك فيه، واجعل هذا العمل في ميزان حسناته", r: f ? "لا تنسوها من صالح دعائكم 🤍" : "لا تنسوه من صالح دعائكم 🤍" };
      case "custom": return { h: "اللهم اجعله صدقة جارية عن", p: (d.customText || "").trim() || "اللهم تقبّل منا ومنكم صالح الأعمال", r: "" };
      default: return { h: f ? "صدقة جارية عن روح المرحومة" : "صدقة جارية عن روح المرحوم",
        p: f ? "اللهم اغفر لها وارحمها، وعافها واعفُ عنها، وأكرم نُزُلها، ووسّع مُدخلها، واجعل قبرها روضة من رياض الجنة" : "اللهم اغفر له وارحمه، وعافه واعفُ عنه، وأكرم نُزُله، ووسّع مُدخله، واجعل قبره روضة من رياض الجنة",
        r: f ? "نسألكم الفاتحة لروحها 🤲" : "نسألكم الفاتحة لروحه 🤲" };
    }
  }
  const previewHtml = d => { const t = dedText(d); return `<div class="preview"><div class="h">${esc(t.h)}</div><div class="n">${esc(d.name || "الاسم")}</div><div class="p">${esc(t.p)}</div>${t.r ? `<div class="r">${esc(t.r)}</div>` : ""}</div>`; };
  async function loadDedications() {
    dedications = (await listAll("dedications")).sort((a, b) => (a.order || 0) - (b.order || 0));
    $("dedList").innerHTML = dedications.map((d, i) => `
      <div class="rowline ${d.active === false ? "off" : ""}">
        <div class="who"><b>${esc(d.name)}</b><span>${esc(TYPES[d.type] || TYPES.deceased)} • ${d.female ? "أنثى" : "ذكر"}${d.active === false ? " • متوقف" : ""}</span></div>
        <div class="actions">
          <button type="button" class="btn btn-ghost small" data-dup="${i}" ${i === 0 ? "disabled" : ""} aria-label="لأعلى">↑</button>
          <button type="button" class="btn btn-ghost small" data-ddown="${i}" ${i === dedications.length - 1 ? "disabled" : ""} aria-label="لأسفل">↓</button>
          <button type="button" class="btn btn-ghost small" data-dedit="${i}">تعديل</button>
          <button type="button" class="btn btn-danger small" data-ddel="${i}">حذف</button>
        </div>
      </div>`).join("") || `<div class="empty">لسه مفيش أسماء. اضغط «+ اسم جديد».</div>`;
    document.querySelectorAll("[data-dedit]").forEach(b => b.onclick = () => openDedForm(dedications[+b.dataset.dedit]));
    document.querySelectorAll("[data-ddel]").forEach(b => b.onclick = () => deleteDed(dedications[+b.dataset.ddel]));
    document.querySelectorAll("[data-dup]").forEach(b => b.onclick = () => moveDed(+b.dataset.dup, -1));
    document.querySelectorAll("[data-ddown]").forEach(b => b.onclick = () => moveDed(+b.dataset.ddown, 1));
    renderPhone();
  }
  loaders.ded = loadDedications;
  async function moveDed(i, dir) {
    const list = dedications.slice();
    [list[i], list[i + dir]] = [list[i + dir], list[i]];
    try { await commit(list.map((d, k) => wSet("dedications", d.id, { ...strip(d), order: k + 1 }))); await bumpVersion(); await loadDedications(); } catch (e) { fail(e); }
  }
  async function deleteDed(d) {
    if (!(await confirmBox(`حذف "${d.name}"؟`))) return;
    try { await delDoc("dedications", d.id); await bumpVersion(); toast("تم الحذف"); await loadDedications(); } catch (e) { fail(e); }
  }
  function openDedForm(d) {
    const isNew = !d;
    d = d || { name: "", type: "deceased", female: false, customText: "", active: true, order: dedications.length + 1 };
    openModal(`<h3>${isNew ? "اسم جديد" : "تعديل الاسم"}</h3>
      <form id="dedForm">
        <label for="dName">الاسم</label><input id="dName" name="name" value="${esc(d.name)}" required maxlength="60" placeholder="مثال: الحاج محمد أحمد">
        <div class="row">
          <div><label for="dType">النوع</label><select id="dType" name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === d.type ? "selected" : ""}>${v}</option>`).join("")}</select></div>
          <div><label for="dFem">الجنس</label><select id="dFem" name="female"><option value="0" ${!d.female ? "selected" : ""}>ذكر</option><option value="1" ${d.female ? "selected" : ""}>أنثى</option></select></div>
        </div>
        <div id="customWrap"><label for="dCustom">الدعاء (للنوع "دعاء من عندك")</label><textarea id="dCustom" name="customText" rows="3">${esc(d.customText || "")}</textarea></div>
        <label class="switch"><input type="checkbox" name="active" ${d.active !== false ? "checked" : ""}> يظهر في التطبيق</label>
        <span class="label">المعاينة</span><div id="dedFormPreview"></div>
        <div class="foot"><button type="button" class="btn btn-ghost" id="cancelBtn">إلغاء</button><button type="submit" class="btn btn-green">حفظ</button></div>
      </form>`);
    const form = $("dedForm");
    const read = () => { const f = new FormData(form); return { name: f.get("name").trim(), type: f.get("type"), female: f.get("female") === "1",
      customText: f.get("customText").trim(), active: !!f.get("active"), order: d.order || dedications.length + 1 }; };
    const refreshPv = () => { const v = read(); $("customWrap").classList.toggle("hidden", v.type !== "custom"); $("dedFormPreview").innerHTML = previewHtml(v); };
    form.oninput = refreshPv; form.onchange = refreshPv; refreshPv();
    $("cancelBtn").onclick = closeModal;
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = e.submitter; btn.disabled = true;
      try { if (isNew) await addDoc("dedications", read()); else await setDoc("dedications", d.id, read()); await bumpVersion(); closeModal(); toast("تم الحفظ ✓"); await loadDedications(); }
      catch (err) { fail(err); btn.disabled = false; }
    };
  }
  $("addDedBtn").onclick = () => openDedForm(null);
  $("saveDedMinutes").onclick = async () => { try { await saveSettings({ dedicationMinutes: parseInt($("dedMinutes").value) || 1 }); } catch (e) { fail(e); } };

  // ───────── الختمات الجماعية ─────────
  loaders.khatmas = async () => {
    const list = (await listAll("khatmas")).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    $("khatmaList").innerHTML = list.map(k => {
      const parts = Object.values(k.parts || {});
      const done = parts.filter(p => p && p.s === 2).length, taken = parts.filter(p => p && p.s === 1).length;
      return `<div class="rowline"><div class="who"><b>${esc(k.name)}</b><span dir="rtl">الكود ${esc(k.id)} • اتقرا ${done}/30 • بيتقرا ${taken}${k.round ? " • ختمات كاملة " + k.round : ""}${k.createdAt ? " • " + esc(fmtTime(k.createdAt)) : ""}</span>
        <div class="progress"><i style="width:${Math.round(done * 100 / 30)}%"></i></div></div>
        <button type="button" class="btn btn-danger small" data-kdel="${esc(k.id)}">حذف</button></div>`;
    }).join("") || `<div class="empty">لسه مفيش ختمات جماعية.</div>`;
    document.querySelectorAll("[data-kdel]").forEach(b => b.onclick = async () => {
      if (!(await confirmBox("تحذف الختمة دي نهائيًا؟"))) return;
      try { await delDoc("khatmas", b.dataset.kdel); toast("اتحذفت"); await loaders.khatmas(); } catch (e) { fail(e); }
    });
  };

  // ───────── الأسماء الحسنى ─────────
  loaders.asma = async () => {
    const asma = (await listAll("asma")).sort((a, b) => (a.order || 0) - (b.order || 0));
    const empty = asma.length === 0;
    $("importAsma").classList.toggle("hidden", !empty);
    $("asmaHint").textContent = empty ? "التطبيق بيعرض الأسماء ومعانيها الافتراضية. لو حابب تعدّل المعاني، استورد الأسماء الأول." : "عدّل المعنى واضغط حفظ جنب الاسم.";
    $("asmaList").innerHTML = asma.map((a, i) => `<div class="asma-row"><span class="hint">${a.order}</span><span class="nm">${esc(a.name)}</span>
      <input data-meaning="${i}" value="${esc(a.meaning)}" maxlength="140" aria-label="معنى ${esc(a.name)}"><button type="button" class="btn btn-ghost small" data-asave="${i}">حفظ</button></div>`).join("");
    document.querySelectorAll("[data-asave]").forEach(b => b.onclick = async () => {
      const a = asma[+b.dataset.asave];
      const meaning = document.querySelector(`[data-meaning="${b.dataset.asave}"]`).value.trim();
      if (!meaning) return toast("المعنى مينفعش يكون فاضي");
      b.disabled = true;
      try { await setDoc("asma", a.id, { name: a.name, meaning, order: a.order }); await bumpVersion(); toast("تم الحفظ ✓"); } catch (e) { fail(e); }
      b.disabled = false;
    });
  };
  $("importAsma").onclick = async () => {
    const list = window.DEFAULT_ASMA;
    if (!list) return toast("ملف الأسماء مش موجود");
    try { await commit(list.map(a => wSet("asma", "n" + String(a.order).padStart(2, "0"), a))); await bumpVersion(); toast("تم استيراد الأسماء ✓"); await loaders.asma(); } catch (e) { fail(e); }
  };

  // ───────── التحديث ─────────
  function fillUpdate() {
    $("latestBuild").value = String(parseInt(settings.latestBuild) || 0);
    $("updateMessage").value = settings.updateMessage || "";
    $("updateUrl").value = settings.updateUrl || "";
    $("updateForce").checked = !!settings.updateForce;
    renderUpdatePreview();
  }
  function renderUpdatePreview() {
    const b = parseInt($("latestBuild").value) || 0;
    const msg = $("updateMessage").value.trim() || "نزلت نسخة جديدة من أذكاري فيها تحسينات وإضافات. حدّث دلوقتي عشان توصلك كل المميزات.";
    $("updPreview").innerHTML = b > 0
      ? `<div class="ic">⬇️</div><b>تحديث جديد متاح</b><p>${esc(msg)}</p><div class="acts">${$("updateForce").checked ? "" : "<span>لاحقًا</span>"}<span class="p">تحديث الآن</span></div>`
      : `<p class="hint">التنبيه متوقف. اكتب رقم بناء أكبر من 0 لتفعيله.</p>`;
  }
  ["latestBuild", "updateMessage"].forEach(id => $(id).addEventListener("input", renderUpdatePreview));
  $("updateForce").addEventListener("change", renderUpdatePreview);
  $("saveUpdate").onclick = async () => {
    const url = $("updateUrl").value.trim();
    if (url && !/^https:\/\//i.test(url)) return toast("الرابط لازم يبدأ بـ https://");
    const raw = $("latestBuild").value.trim();
    if (raw && !/^\d+$/.test(raw)) return toast("اكتب رقم البناء بس (رقم صحيح زي 18)، مش رقم الإصدار 1.6.0");
    try { await saveSettings({ latestBuild: Math.max(0, parseInt($("latestBuild").value) || 0), updateMessage: $("updateMessage").value.trim(), updateUrl: url, updateForce: $("updateForce").checked }); } catch (e) { fail(e); }
  };

  // ───────── معاينة الموبايل ─────────
  function activeCampaignPv() {
    const forced = CAMPAIGNS.find(c => (campOverrides[c.id] || {}).mode === "on");
    return forced || null;
  }
  function renderPhone() {
    const on = $("bannerOn").checked, title = $("bannerTitle").value.trim(), text = $("bannerText").value.trim();
    const banner = on && (title || text || bannerImage)
      ? `<div class="pv-banner">${bannerImage ? `<img src="data:image/jpeg;base64,${bannerImage}" alt="">` : ""}${title || text ? `<div class="t"><b>📢 ${esc(title)}</b>${esc(text)}</div>` : ""}</div>` : "";
    const c = activeCampaignPv();
    const ct = c ? (((campOverrides[c.id] || {}).text || "").trim() || c.sub) : "";
    const camp = c ? `<div class="pv-camp" style="background:linear-gradient(135deg,${c.colors[0]},${c.colors[1]})"><span class="em">${c.emoji}</span><div><b>${esc(c.title)}</b>${esc(ct)}</div></div>` : "";
    const d = dedications.find(x => x.active !== false && (x.name || "").trim());
    const t = d ? dedText(d) : null;
    const ded = d ? `<div class="pv-ded"><div class="h">${esc(t.h)}</div><div class="n">${esc(d.name)}</div><div class="p">${esc(t.p)}</div></div>` : "";
    const daily = $("dailyText").value.trim() || "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ";
    const hour = new Date().getHours();
    $("phone").innerHTML = `
      <div class="pv-head"><div class="g">${hour < 12 ? "صباح الخير ☀️" : "مساء الخير 🌙"}</div><div class="d">${esc(new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" }))}</div>
        <div class="ayah">﴿ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ ﴾</div><div class="start">${hour < 12 ? "ابدأ أذكار الصباح" : "ابدأ أذكار المساء"}</div></div>
      <div class="pv-body">${banner}${camp}
        <div class="pv-tools"><span>📖<br>المصحف</span><span>✅<br>ورد اليوم</span><span>🤝<br>ختمة جماعية</span><span>🧭<br>القبلة</span></div>
        ${ded}
        <div class="pv-daily"><div class="k">ذكر اليوم</div><div class="x">${esc(daily)}</div></div>
      </div>`;
  }

  // ───────── البداية ─────────
  async function showApp() {
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    $("who").textContent = session?.email || "";
    try {
      await Promise.all([loadSettings(), loadAdhkar(), loadDedications().catch(() => {}), loadCampaigns().catch(() => {})]);
    } catch (e) { fail(e); }
    go(store.get("athkari_tab") || "overview");
  }
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault(); $("loginErr").textContent = "";
    const btn = e.submitter; btn.disabled = true;
    try { await signIn($("email").value.trim(), $("password").value); await showApp(); }
    catch (err) {
      const m = String(err.message || "");
      $("loginErr").textContent = /INVALID|PASSWORD|EMAIL_NOT_FOUND|CREDENTIAL/i.test(m) ? "الإيميل أو كلمة المرور غلط" : /TOO_MANY/i.test(m) ? "محاولات كتير، استنى شوية" : "تعذّر الدخول: " + m;
    }
    btn.disabled = false;
  });
  $("logoutBtn").onclick = () => { store.set("athkari_refresh", null); session = null; location.reload(); };
  (async () => {
    if (await refresh().catch(() => false)) showApp();
    else $("loginView").classList.remove("hidden");
  })();
})();
