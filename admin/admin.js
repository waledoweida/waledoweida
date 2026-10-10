(function(){
  // Stats tab + login + tab switching. The editor tabs live in editor.js (window.woEditor).
  var STATS_URL = '/api/stats';
  var $ = function(id){ return document.getElementById(id); };
  function get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v){ try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

  // opening this page marks the device as the owner's, so its visits aren't counted
  if (get('wo_owner') == null) put('wo_owner', '1');
  $('ownerToggle').checked = get('wo_owner') === '1';
  $('ownerToggle').addEventListener('change', function(){ put('wo_owner', this.checked ? '1' : '0'); });

  var days = +(get('wo_days') || 7);
  var nf = new Intl.NumberFormat('en-US');
  var SRC_DEVICE = { mobile: 'موبايل', desktop: 'كمبيوتر', tablet: 'تابلت' };
  var CLICK = { whatsapp: 'واتساب', phone: 'اتصال', form: 'فورم الطلب' };

  var tab = 'stats';
  // view: 'login' | 'setup' (stats storage missing) | 'dash' (stats) | 'editor'
  function show(id){
    var inApp = id !== 'login';
    $('login').hidden = inApp;
    $('tabs').hidden = $('logout').hidden = !inApp;
    $('setup').hidden = id !== 'setup';
    $('dash').hidden = $('controls').hidden = id !== 'dash';
    if (id !== 'editor') { $('editor').hidden = true; $('noGithub').hidden = true; }
    if (!inApp) $('err').hidden = true;
  }
  window.woShowLogin = function(){ show('login'); };
  function openTab(name){
    if (tab !== name && window.woEditor && !window.woEditor.canLeave()) return;
    tab = name;
    document.querySelectorAll('#tabs button').forEach(function(b){
      if (b.getAttribute('data-tab') === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    try { sessionStorage.setItem('wo_tab', name); } catch (e) {}
    if (name === 'stats') { load(); return; }
    show('editor');
    window.woEditor.open(name);
  }
  document.querySelectorAll('#tabs button').forEach(function(b){
    b.addEventListener('click', function(){ openTab(b.getAttribute('data-tab')); });
  });
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dur(s){ s = +s || 0; if (s < 60) return s + ' ث'; var m = Math.floor(s / 60), r = s % 60; return m + ' د' + (r ? ' ' + r + ' ث' : ''); }

  function bars(el, items, fmt){
    if (!items.length) { el.innerHTML = '<p class="empty">لسه مفيش بيانات.</p>'; return; }
    var max = Math.max.apply(null, items.map(function(x){ return x.count; })) || 1;
    el.innerHTML = items.map(function(x){
      return '<div class="brow"><span class="lbl" title="' + esc(x.name) + '">' + esc(fmt ? fmt(x.name) : x.name) + '</span>' +
        '<span class="trk"><i data-w="' + Math.max(2, Math.round(x.count / max * 100)) + '"></i></span><b>' + nf.format(x.count) + '</b></div>';
    }).join('');
    dims(el);
  }

  // the page's CSP blocks inline style="" attributes, so sizes are set through the DOM
  function dims(root){
    root.querySelectorAll('[data-w],[data-h],[data-b],[data-l]').forEach(function(n){
      var d = n.dataset;
      if (d.w) n.style.width = d.w + '%';
      if (d.h) n.style.height = d.h + '%';
      if (d.b) n.style.bottom = d.b + '%';
      if (d.l) n.style.left = d.l + '%';
    });
  }

  function niceMax(v){ if (v <= 4) return 4; var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }

  function daily(list){
    var el = $('dailyChart'), max = niceMax(Math.max.apply(null, list.map(function(d){ return d.visitors; })) || 0);
    var grid = [0, .5, 1].map(function(f){ return '<div class="gl" data-b="' + f * 100 + '"><span>' + nf.format(Math.round(max * f)) + '</span></div>'; }).join('');
    var cols = list.map(function(d, i){
      return '<div class="col" tabindex="0" data-i="' + i + '"><i data-h="' + (d.visitors / max * 100) + '"></i></div>';
    }).join('');
    var step = Math.ceil(list.length / (el.clientWidth < 520 ? 4 : 7)), xl = '';
    list.forEach(function(d, i){
      if (i % step === 0 || i === list.length - 1) xl += '<span data-l="' + ((i + .5) / list.length * 100) + '">' + d.day.slice(5).replace('-', '/') + '</span>';
    });
    el.innerHTML = '<div class="grid">' + grid + '</div><div class="cols">' + cols + '</div><div class="xl">' + xl + '</div>';
    dims(el);
    var tip = $('tip');
    function on(e){
      var c = e.target.closest('.col'); if (!c) return;
      var d = list[+c.getAttribute('data-i')], r = c.getBoundingClientRect();
      tip.textContent = d.day + ' — ' + nf.format(d.visitors) + ' زائر';
      tip.style.left = (r.left + r.width / 2) + 'px'; tip.style.top = (r.top + c.firstChild.offsetTop) + 'px';
      tip.hidden = false;
    }
    el.onmouseover = on; el.onfocusin = on;
    el.onmouseleave = el.onfocusout = function(){ tip.hidden = true; };
    $('dailyTable').querySelector('tbody').innerHTML = list.slice().reverse().map(function(d){
      return '<tr><td>' + d.day + '</td><td>' + nf.format(d.visitors) + '</td></tr>';
    }).join('');
  }

  function render(s){
    $('tVisitors').textContent = nf.format(s.visitors);
    $('tSessions').textContent = nf.format(s.sessions);
    $('tContacted').textContent = nf.format(s.contacted);
    $('tRate').textContent = s.sessions ? Math.round(s.contacted / s.sessions * 100) + '% من الزيارات' : '–';
    $('tTime').textContent = dur(s.avgSecs);
    daily(s.daily);
    bars($('sources'), s.sources);
    bars($('countries'), s.countries);
    bars($('devices'), s.devices, function(n){ return SRC_DEVICE[n] || n; });
    bars($('pages'), s.pages, function(p){ return decodeURI(p); });
    bars($('clicks'), Object.keys(s.clicks).map(function(k){ return { name: k, count: s.clicks[k] }; })
      .filter(function(x){ return x.count; }).sort(function(a, b){ return b.count - a.count; }), function(k){ return CLICK[k] || k; });
    $('recent').querySelector('tbody').innerHTML = s.recent.length ? s.recent.map(function(r){
      return '<tr><td>' + esc(r.time) + '</td><td>' + esc(r.source) + '</td><td>' + esc(r.country) + '</td><td>' + esc(SRC_DEVICE[r.device] || r.device) +
        '</td><td>' + r.pages + '</td><td>' + dur(r.secs) + '</td><td>' + (r.contacted ? '<span class="yes">' + esc(CLICK[r.contacted] || r.contacted) + '</span>' : '–') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">لسه مفيش زيارات.</td></tr>';
    $('updated').textContent = 'آخر تحديث: ' + s.generated;
  }

  function load(){
    if (tab !== 'stats') return;
    $('err').hidden = true;
    $('updated').textContent = 'جاري التحميل…';
    fetch(STATS_URL + '?days=' + days, { credentials: 'same-origin', cache: 'no-store' })
      .then(function(r){
        if (r.status === 401) { show('login'); return null; }
        if (r.status === 503) { show('setup'); return null; }
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function(s){ if (s && tab === 'stats') { show('dash'); render(s); } })
      .catch(function(){ show('dash'); $('err').textContent = 'تعذّر تحميل البيانات. اتأكد من الإنترنت وجرّب تاني.'; $('err').hidden = false; });
  }

  // password goes to /api/login once; the session lives in an HttpOnly cookie the page can't read
  $('loginForm').addEventListener('submit', function(e){
    e.preventDefault(); $('loginErr').hidden = true;
    var pw = $('key').value; $('key').value = '';
    fetch('/api/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
      .then(function(r){
        if (r.ok) { openTab(tab); return; }
        $('loginErr').textContent = r.status === 429 ? 'محاولات كتير غلط. استنى ربع ساعة وجرّب تاني.'
          : r.status === 503 ? 'لوحة التحكم مش متظبطة لسه.' : 'كلمة السر غلط.';
        $('loginErr').hidden = false;
      })
      .catch(function(){ $('loginErr').textContent = 'تعذّر الاتصال. جرّب تاني.'; $('loginErr').hidden = false; });
  });
  $('logout').addEventListener('click', function(){
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).finally(function(){ show('login'); });
  });
  put('wo_admin_key', null); // old versions kept the password in the browser; remove it
  $('refresh').addEventListener('click', load);
  window.addEventListener('beforeunload', function(e){ if (window.woEditor && window.woEditor.dirty()) { e.preventDefault(); e.returnValue = ''; } });
  document.querySelectorAll('.seg button').forEach(function(b){
    b.setAttribute('aria-pressed', +b.getAttribute('data-days') === days ? 'true' : 'false');
    b.addEventListener('click', function(){
      days = +b.getAttribute('data-days'); put('wo_days', days);
      document.querySelectorAll('.seg button').forEach(function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      load();
    });
  });
  document.querySelector('[data-table]').addEventListener('click', function(){
    var t = $(this.getAttribute('data-table')); t.hidden = !t.hidden;
    this.textContent = t.hidden ? 'عرض كجدول' : 'إخفاء الجدول';
  });
  try { tab = sessionStorage.getItem('wo_tab') || 'stats'; } catch (e) {}
  // first paint: ask the server whether the session is still valid
  fetch('/api/content?status=1', { credentials: 'same-origin', cache: 'no-store' }).then(function(r){
    if (r.status === 401) { show('login'); return; }
    openTab(tab);
  }).catch(function(){ openTab(tab); });
})();
