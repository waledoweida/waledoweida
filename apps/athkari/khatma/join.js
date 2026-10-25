(function () {
  var m = /[?&]c=([A-Za-z0-9]{6})(?:&|$)/.exec(location.search);
  if (!m) return;
  var code = m[1].toUpperCase();
  var box = document.getElementById('khatma-code');
  document.getElementById('khatma-code-val').textContent = code;
  box.hidden = false;
  var btn = document.getElementById('khatma-open');
  var fallback = btn.getAttribute('data-fallback');
  btn.href = /Android/i.test(navigator.userAgent)
    ? 'intent://khatma/' + code + '#Intent;scheme=athkari;package=com.athkari.athkari;S.browser_fallback_url=' + encodeURIComponent(fallback) + ';end'
    : 'athkari://khatma/' + code;

  // حالة الختمة: الأجزاء الثلاثين ومين بيقرا إيه (بتتحدّث كل دقيقة)
  var live = document.getElementById('khatma-live');
  if (!live || !window.fetch) return;
  var label = { 0: live.getAttribute('data-free'), 1: live.getAttribute('data-reading'), 2: live.getAttribute('data-done') };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function render(k) {
    var done = 0, taken = 0;
    var grid = document.getElementById('khatma-live-grid');
    grid.textContent = '';
    k.parts.forEach(function (p, i) {
      if (p.s === 2) done++;
      if (p.s) taken++;
      var li = el('li', 'kl-' + (p.s === 2 ? 'done' : p.s === 1 ? 'reading' : 'free'));
      li.appendChild(el('b', null, String(i + 1)));
      li.appendChild(el('span', null, p.s ? p.n || label[p.s] : label[0]));
      if (p.s) li.appendChild(el('small', null, label[p.s]));
      grid.appendChild(li);
    });
    document.getElementById('khatma-live-name').textContent = k.name;
    document.getElementById('khatma-live-bar').style.width = Math.round(done * 100 / 30) + '%';
    document.getElementById('khatma-live-sum').textContent =
      done + ' / 30 ' + label[2] + ' • ' + (taken - done) + ' ' + label[1] + (k.round ? ' • ✓ ' + k.round : '');
    live.hidden = false;
  }
  function load() {
    fetch('/api/athkari-khatma?c=' + code).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (k) { if (k && k.ok) render(k); }).catch(function () {});
  }
  load();
  setInterval(function () { if (!document.hidden) load(); }, 60000);
})();
