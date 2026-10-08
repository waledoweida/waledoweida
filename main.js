(function(){
  var WA = '201025926261';
  document.getElementById('y').textContent = new Date().getFullYear();

  // header background after scrolling past the top
  var hdr = document.getElementById('top');
  var bar = document.querySelector('.progress');
  function onScroll(){
    hdr.classList.toggle('scrolled', window.scrollY > 20);
    if (bar) { var h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = 'scaleX(' + (h > 0 ? scrollY / h : 0) + ')'; }
  }
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

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

  // service links preselect the service in the form
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-service]');
    if (t && f) f.elements['service'].value = t.getAttribute('data-service');
  });
  f.addEventListener('submit', function(e){
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
  });

  // count-up numbers
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
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
