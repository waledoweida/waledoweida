(function(){
  var WA = '201025926261';

  // anonymous visit stats -> /api/track (Vercel function, see api/), read on /admin/.
  // Empty TRACK_URL = off. Bots are skipped, and so is the owner once /admin/ was opened on that device.
  var TRACK_URL = '/api/track';
  (function(){
    if (!TRACK_URL || !navigator.sendBeacon) return;
    var ua = navigator.userAgent || '';
    if (navigator.webdriver || /bot|crawl|spider|slurp|preview|lighthouse|headless/i.test(ua)) return;
    function get(st, k){ try { return st.getItem(k); } catch (e) { return null; } }
    function put(st, k, v){ try { st.setItem(k, v); } catch (e) {} }
    var LS = window.localStorage, SS = window.sessionStorage;
    if (get(LS, 'wo_owner') === '1') return;
    function rid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
    var vid = get(LS, 'wo_vid') || rid(); put(LS, 'wo_vid', vid);
    var sid = get(SS, 'wo_sid') || rid(); put(SS, 'wo_sid', sid);
    var q = new URLSearchParams(location.search), ref = '';
    try { if (document.referrer) { var r = new URL(document.referrer); if (r.host !== location.host) ref = r.host; } } catch (e) {}
    var base = { vid: vid, sid: sid, path: location.pathname, ref: ref,
      source: q.get('utm_source') || '', medium: q.get('utm_medium') || '', campaign: q.get('utm_campaign') || '',
      device: /iPad|Tablet/i.test(ua) ? 'tablet' : (/Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop'),
      lang: document.documentElement.lang };
    function send(type, value){
      var d = {}; for (var k in base) d[k] = base[k];
      d.type = type; d.value = value || '';
      try { navigator.sendBeacon(TRACK_URL, JSON.stringify(d)); } catch (e) {}
    }
    // one view per page per visit, so refreshing doesn't inflate the numbers
    var seen = 'wo_seen_' + location.pathname;
    if (!get(SS, seen)) { put(SS, seen, '1'); send('view'); }
    // contact clicks
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
      var h = a.getAttribute('href');
      if (/^https:\/\/wa\.me\//.test(h)) send('click', 'whatsapp:' + (a.className.split(' ')[0] || 'link'));
      else if (/^tel:/.test(h)) send('click', 'phone');
    }, true);
    document.addEventListener('submit', function(e){
      var fm = e.target; if (fm.checkValidity && fm.checkValidity()) send('click', 'form:' + (fm.id || 'form'));
    }, true);
    // time actually spent looking at the page (tab visible)
    var shown = document.visibilityState === 'visible' ? Date.now() : 0;
    function flush(){
      if (!shown) return;
      var secs = Math.round((Date.now() - shown) / 1000); shown = 0;
      if (secs >= 1) send('time', secs);
    }
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'hidden') flush(); else shown = Date.now();
    });
    window.addEventListener('pagehide', flush);
  })();
  var yr = document.getElementById('y'); if (yr) yr.textContent = new Date().getFullYear();

  // header background after scrolling past the top
  var hdr = document.getElementById('top');
  var bar = document.querySelector('.progress');
  // read layout first, then write, at most once per frame (avoids forced reflow)
  var ticking = false;
  function update(){
    ticking = false;
    var y = window.scrollY, h = document.documentElement.scrollHeight - innerHeight;
    hdr.classList.toggle('scrolled', y > 20);
    if (bar) bar.style.transform = 'scaleX(' + (h > 0 ? y / h : 0) + ')';
  }
  function onScroll(){ if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  update(); window.addEventListener('scroll', onScroll, { passive: true });

  // mobile menu
  var mb = document.querySelector('.menu-btn'), mn = document.getElementById('mnav');
  if (mb && mn) {
    function setMenu(open){ mn.hidden = !open; mb.setAttribute('aria-expanded', open); hdr.classList.toggle('menu-open', open); }
    mb.addEventListener('click', function(){ setMenu(mn.hidden); });
    mn.addEventListener('click', function(e){ if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') setMenu(false); });
  }

  // request form -> WhatsApp
  var f = document.getElementById('reqForm');

  // free review form -> WhatsApp
  var af = document.getElementById('auditForm');
  if (af) af.addEventListener('submit', function(e){
    e.preventDefault();
    var link = af.elements['link'].value.trim(), who = af.elements['name'].value.trim();
    if (!link) { af.elements['link'].reportValidity(); af.elements['link'].focus(); return; }
    if (!who) { af.elements['name'].reportValidity(); af.elements['name'].focus(); return; }
    var en = document.documentElement.lang === 'en';
    var msg = en
      ? 'Hello, my name is ' + who + '\nI would like a free review of: ' + link
      : 'السلام عليكم، أنا ' + who + '\nعايز تقييم مجاني لـ: ' + link;
    window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    af.querySelector('.audit-ok').hidden = false;
  });

  // client review form -> WhatsApp
  var rf = document.getElementById('reviewForm');
  if (rf) rf.addEventListener('submit', function(e){
    e.preventDefault();
    var el = rf.elements, en = document.documentElement.lang === 'en';
    var name = el['name'].value.trim(), text = el['text'].value.trim();
    var r = rf.querySelector('input[name="rating"]:checked');
    if (!name) { el['name'].reportValidity(); el['name'].focus(); return; }
    if (!r) { rf.querySelector('#r5').reportValidity(); rf.querySelector('#r5').focus(); return; }
    if (!text) { el['text'].reportValidity(); el['text'].focus(); return; }
    var n = +r.value, stars = new Array(n + 1).join('★') + new Array(6 - n).join('☆');
    var lines = en
      ? ['New review from the website', 'Name: ' + name, 'Country: ' + (el['country'].value || '-'), 'Service: ' + (el['service'].value || '-'),
         'Rating: ' + stars + ' (' + n + '/5)', 'Review: ' + text, 'Publish as: ' + el['publish'].value]
      : ['تقييم جديد من الموقع', 'الاسم: ' + name, 'البلد: ' + (el['country'].value || '-'), 'الخدمة: ' + (el['service'].value || '-'),
         'التقييم: ' + stars + ' (' + n + '/5)', 'الرأي: ' + text, 'النشر: ' + el['publish'].value];
    window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
    rf.querySelector('.form-ok').hidden = false;
  });

  // service links preselect the service in the form
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-service]');
    if (t && f) f.elements['service'].value = t.getAttribute('data-service');
  });
  if (f) f.addEventListener('submit', function(e){
    e.preventDefault();
    var el = f.elements;
    var name = el['name'].value.trim(), service = el['service'].value, details = el['details'].value.trim();
    if (!name) { el['name'].reportValidity(); el['name'].focus(); return; }
    if (!service) { el['service'].reportValidity(); el['service'].focus(); return; }
    var en = document.documentElement.lang === 'en';
    var msg = en
      ? 'Hello, my name is ' + name + '\nI need: ' + service + (details ? '\n\nDetails:\n' + details : '')
      : 'السلام عليكم، أنا ' + name + '\nمحتاج خدمة: ' + service + (details ? '\n\nالتفاصيل:\n' + details : '');
    window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    var ok = f.querySelector('.form-ok'); if (ok) ok.hidden = false;
  });

  // highlight the nav link of the section in view
  var navLinks = document.querySelectorAll('nav a[href^="#"]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (!en.isIntersecting) return;
        navLinks.forEach(function(a){ a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(function(a){ var sec = document.querySelector(a.getAttribute('href')); if (sec) spy.observe(sec); });
  }

  // spotlight follows the pointer on featured cards
  document.querySelectorAll('.feat').forEach(function(card){
    card.addEventListener('pointermove', function(e){
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  // live "services delivered" counter: from a fixed start, every 1–5 hours it
  // grows by 3–15, except overnight (2am–9am Cairo time). Seeded per step, so every
  // visitor sees the same number and it never goes down.
  function seeded(i){ var t = (i + 0x6D2B79F5) | 0; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  var cairoHour = (function(){
    try { var f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: 'numeric', hourCycle: 'h23' }); return function(t){ return parseInt(f.format(t), 10); }; }
    catch (e) { return function(t){ return new Date(t + 3 * 36e5).getUTCHours(); }; }
  })();
  document.querySelectorAll('[data-live-base]').forEach(function(el){
    var n = parseInt(el.getAttribute('data-live-base'), 10), t = Date.parse(el.getAttribute('data-live-start')), now = Date.now();
    if (isNaN(n) || isNaN(t)) return;
    for (var i = 0; ; i++) {
      t += (1 + seeded(2 * i) * 4) * 36e5;
      if (t > now) break;
      var h = cairoHour(t);
      if (h < 2 || h >= 9) n += 3 + Math.floor(seeded(2 * i + 1) * 13);
    }
    el.setAttribute('data-count', '+' + n);
    el.textContent = '+' + n.toLocaleString('en-US');
  });

  // count-up numbers
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // WhatsApp bubble: after a few seconds, a short "typing…" then a greeting pops out of
  // the floating button. Closing it keeps it hidden for the rest of the visit.
  var dock = document.getElementById('waDock'), bub = document.getElementById('waBubble');
  if (dock && bub) {
    var KEY = 'waBubbleClosed', closed = false;
    try { closed = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
    var focusables = bub.querySelectorAll('button,a');
    function setOpen(open){
      bub.classList.toggle('show', open);
      bub.setAttribute('aria-hidden', open ? 'false' : 'true');
      focusables.forEach(function(el){ el.tabIndex = open ? 0 : -1; });
    }
    function closeBubble(){
      setOpen(false); dock.classList.remove('badge');
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    }
    document.getElementById('waClose').addEventListener('click', closeBubble);
    bub.querySelector('.wa-cta').addEventListener('click', closeBubble);
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && bub.classList.contains('show')) closeBubble(); });
    if (!closed) {
      setTimeout(function(){
        dock.classList.add('badge'); setOpen(true);
        setTimeout(function(){ bub.classList.add('typed'); }, reduce ? 0 : 1600);
      }, 5000);
    }
  }
  function countUp(el){
    var raw = el.getAttribute('data-count'), m = raw.match(/^(\D*)(\d+)(\D*)$/);
    if (reduce || !m) return;
    var pre = m[1], end = parseInt(m[2], 10), post = m[3], t0 = null;
    function fmt(n){ return pre + n.toLocaleString('en-US') + post; }
    function step(t){ if (!t0) t0 = t; var k = Math.min((t - t0) / 1600, 1); el.textContent = fmt(Math.round(end * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); }
    el.textContent = fmt(0); requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    var co = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if (en.isIntersecting) { countUp(en.target); co.unobserve(en.target); } });
    }, { threshold: .6 });
    document.querySelectorAll('[data-count]').forEach(function(el){ co.observe(el); });
  }

  // reveal on scroll
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(function(el){ el.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){ if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -40px 0px' });
  els.forEach(function(el){ io.observe(el); });
})();
