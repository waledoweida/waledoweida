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
})();
