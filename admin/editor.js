(function(){
  // Content editor: draws forms from the schema served by /api/content, saves each file back
  // through the same endpoint (which commits it to GitHub), then follows the rebuild until it's live.
  // Everything the owner types is set with .value / .textContent — never parsed as HTML.
  var $ = function(id){ return document.getElementById(id); };
  var API = '/api/content';
  var state = null;        // { files: {name: {data, sha}}, schema, icons, status }
  var saved = {};          // file -> JSON string of the last saved version
  var lang = 'ar';
  var view = null;
  var openCards = {};      // remembers which list items are expanded, by path

  var VIEWS = {
    basics: { intro: 'رقم الواتساب، عداد الخدمات، ظهورك في جوجل، أسفل الموقع وفقاعة واتساب.',
      parts: [{ file: 'site', title: 'الواتساب وعداد الخدمات' }, { file: 'home', keys: ['name', 'seo', 'footer', 'chat'] }] },
    home: { intro: 'كل أقسام الصفحة الرئيسية بالترتيب. الخدمات والأسئلة ليهم تبويب لوحدهم.',
      parts: [{ file: 'home', keys: ['hero', 'platforms', 'stats', 'regions', 'why', 'steps', 'audit', 'contact'] }] },
    services: { intro: 'ضيف خدمة، عدّلها، رتّبها بالأسهم، أو امسحها. فورم "اطلب خدمة" بيتحدث لوحده.',
      parts: [{ file: 'home', keys: ['services'], open: true }] },
    faq: { intro: 'أسئلة الصفحة الرئيسية. أسئلة كل بلد في تبويب "البلاد".',
      parts: [{ file: 'home', keys: ['faq'], open: true }] },
    countries: { intro: 'كل بلد ليها كارت في الصفحة الرئيسية وصفحة لوحدها. ممكن تضيف بلد جديدة.',
      parts: [{ file: 'countries' }] },
    articles: { intro: 'مقالات المدونة. كل مقال بالعربي والإنجليزي.',
      parts: [{ file: 'articles' }] }
  };

  function el(tag, cls, text){ var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function clone(x){ return JSON.parse(JSON.stringify(x)); }
  function isDirty(f){ return state && JSON.stringify(state.files[f].data) !== saved[f]; }
  function dirtyFiles(){ return state ? Object.keys(state.files).filter(isDirty) : []; }
  function bilingual(f){ return f.t === 'obj' && f.fields.ar && f.fields.en; }

  // ---------- loading ----------
  var loading = null;      // the one in-flight load of /api/content
  function load(){
    if (!loading) loading = fetchAll().then(function(b){ loading = null; return b; }, function(e){ loading = null; throw e; });
    return loading;
  }
  function fetchAll(){
    $('edBody').textContent = 'جاري التحميل…';
    return fetch(API, { credentials: 'same-origin', cache: 'no-store' }).then(function(r){
      if (r.status === 401) { window.woShowLogin(); return null; }
      if (r.status === 503) return r.json().then(function(b){
        if (b.error === 'no_github_token') { $('editor').hidden = true; $('noGithub').hidden = false; }
        return null;
      });
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function(b){
      if (!b) return null;
      state = b; saved = {};
      Object.keys(b.files).forEach(function(f){ saved[f] = JSON.stringify(b.files[f].data); });
      pub(b.status);
      return b;
    });
  }

  // ---------- publish status ----------
  var pollTimer = null, savedAt = 0;
  function pub(s){
    var p = $('pub'); p.hidden = false;
    if (s.state === 'building') {
      // a rebuild takes 2–3 minutes; past 8 minutes since the save commit something went wrong
      var since = Date.parse(s.since) || savedAt;
      var late = since && Date.now() - since > 8 * 60e3;
      p.className = 'pub ' + (late ? 'bad' : 'wait');
      p.textContent = late ? 'التحديث اتأخر — في مشكلة في البناء، ابعت للمطور' : 'الموقع بيتحدث دلوقتي… (دقيقتين تلاتة)';
      clearTimeout(pollTimer); pollTimer = setTimeout(poll, late ? 60000 : 15000);
    } else {
      p.className = 'pub ok';
      p.textContent = 'الموقع محدّث ✓';
      if (savedAt) { savedAt = 0; p.textContent = 'اتنشر ✓ التعديلات هتظهر على الموقع خلال دقيقة'; }
    }
  }
  function poll(){
    fetch(API + '?status=1', { credentials: 'same-origin', cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(b){ if (b) pub(b.status); else pollTimer = setTimeout(poll, 30000); })
      .catch(function(){ pollTimer = setTimeout(poll, 30000); });
  }

  // ---------- form building ----------
  function blank(f){
    switch (f.t) {
      case 'num': return f.min;
      case 'icon': return Object.keys(state.icons)[0];
      case 'list': var a = []; for (var i = 0; i < f.min; i++) a.push(blank(f.of)); return a;
      case 'obj': var o = {}; Object.keys(f.fields).forEach(function(k){ o[k] = blank(f.fields[k]); }); return o;
      case 'match': return /\d{4}-/.test(f.re) && f.max === 10 ? new Date().toISOString().slice(0, 10) : '';
      default: return '';
    }
  }

  function changed(){
    var files = dirtyFiles();
    $('savebar').hidden = !files.length;
    $('saveMsg').textContent = 'عندك تعديلات لسه متحفظتش';
    $('saveMsg').className = '';
  }

  // field(f, get, set, path) → DOM node. get/set read and write the value in state.
  function field(f, get, set, path, nested){
    if (f.t === 'obj') return group(f, get(), path, null, nested);
    if (f.t === 'list') return listEditor(f, get(), path);
    var wrap = el('div', 'fld' + (f.adv ? ' adv' : ''));
    var id = 'f_' + path.replace(/[^a-z0-9]/gi, '_');
    var lab = el('label', null, f.label); lab.htmlFor = id;
    wrap.appendChild(lab);
    var input;
    if (f.t === 'icon') {
      input = iconPicker(get(), set, id);
    } else if (f.t === 'area' || f.t === 'body') {
      input = el('textarea'); input.rows = f.t === 'body' ? 18 : 3;
    } else {
      input = el('input'); input.type = f.t === 'num' ? 'number' : 'text';
      if (f.t === 'num') { input.min = f.min; input.max = f.max; input.inputMode = 'numeric'; }
    }
    if (f.t !== 'icon') {
      input.id = id; input.value = get(); input.dataset.path = path;
      if (f.max && f.t !== 'num') input.maxLength = f.max;
      if (f.ltr) input.dir = 'ltr';
      var count = f.max && f.t !== 'num' ? el('small', 'count') : null;
      var upd = function(){
        if (count) { count.textContent = input.value.length + ' / ' + f.max; count.classList.toggle('near', input.value.length > f.max * 0.9); }
      };
      input.addEventListener('input', function(){
        set(f.t === 'num' ? (input.value === '' ? '' : Number(input.value)) : input.value);
        input.classList.remove('invalid'); upd(); changed();
      });
      if (f.t === 'body') wrap.appendChild(bodyTools(input));
      wrap.appendChild(input);
      upd();
      if (count) wrap.appendChild(count);
    } else {
      wrap.appendChild(input);
    }
    if (f.hint) wrap.appendChild(el('small', 'hint', f.hint));
    return wrap;
  }

  // top-level sections fold open/closed; groups inside them are plain boxes with a heading
  function group(f, obj, path, title, nested){
    var box = el('div', 'grp');
    if (nested && f.label) { box.className = 'grp sub'; box.appendChild(el('div', 'sub-h', f.label)); }
    else if (f.label || title) {
      box = el('details', 'grp sec'); box.open = openCards[path] === true;
      var sum = el('summary', null, title || f.label); box.appendChild(sum);
      box.addEventListener('toggle', function(){ openCards[path] = box.open; });
    }
    if (f.hint) box.appendChild(el('p', 'hint', f.hint));
    var keys = Object.keys(f.fields);
    var advBox = null;
    keys.forEach(function(k){
      var sub = f.fields[k];
      if ((k === 'ar' || k === 'en') && bilingual(f)) { if (k !== lang) return; }
      var node = field(sub, function(){ return obj[k]; }, function(v){ obj[k] = v; }, path + '.' + k, true);
      if (sub.adv) {
        if (!advBox) { advBox = el('details', 'more'); advBox.appendChild(el('summary', null, 'إعدادات إضافية')); }
        advBox.appendChild(node);
      } else box.appendChild(node);
    });
    if (advBox) box.appendChild(advBox);
    return box;
  }

  function itemTitle(f, item, i){
    var t = '';
    if (f.item && item && typeof item === 'object') {
      t = item[f.item] || (item[lang] && item[lang].title) || '';
      if (item[lang] && item[lang].name) t = item[f.item] + ' — ' + item[lang].name;
      else if (item[lang] && item[lang].title && f.item === 'slug') t = item[lang].title;
    }
    return (i + 1) + '. ' + (t || 'جديد');
  }

  function listEditor(f, arr, path){
    var box = el('div', 'lst' + (f.adv ? ' adv' : ''));
    var simple = f.of.t !== 'obj';
    box.appendChild(el('div', 'lst-h', f.label));
    if (f.hint) box.appendChild(el('small', 'hint', f.hint));
    var rows = el('div', simple ? 'rows' : 'cards');
    box.appendChild(rows);
    function redraw(){
      rows.textContent = '';
      arr.forEach(function(item, i){
        var p = path + '[' + i + ']';
        var tools = el('div', 'itools');
        [['↑', 'لفوق', i > 0, function(){ swap(i, i - 1); }], ['↓', 'لتحت', i < arr.length - 1, function(){ swap(i, i + 1); }],
         ['✕', 'امسح', arr.length > f.min, function(){
           if (!simple && !confirm('متأكد إنك عايز تمسح "' + itemTitle(f, item, i) + '"؟')) return;
           arr.splice(i, 1); shiftOpen(path, i); redraw(); changed();
         }]].forEach(function(b){
          var btn = el('button', 'icon-btn', b[0]); btn.type = 'button'; btn.title = b[1]; btn.setAttribute('aria-label', b[1]); btn.disabled = !b[2];
          btn.addEventListener('click', function(e){ e.preventDefault(); b[3](); });
          tools.appendChild(btn);
        });
        if (simple) {
          var row = el('div', 'row');
          var input = field(f.of, function(){ return arr[i]; }, function(v){ arr[i] = v; }, p);
          input.querySelector('label').className = 'sr';
          row.appendChild(input); row.appendChild(tools); rows.appendChild(row);
        } else {
          var card = el('details', 'card-item');
          card.open = !!openCards[p];
          var sum = el('summary'); var st = el('span', 'ititle', itemTitle(f, item, i)); sum.appendChild(st); sum.appendChild(tools);
          card.appendChild(sum);
          card.addEventListener('toggle', function(){
            openCards[p] = card.open;
            if (card.open && card.children.length === 1) card.appendChild(group(f.of, item, p));
          });
          card.addEventListener('input', function(){ st.textContent = itemTitle(f, item, i); });
          if (card.open) card.appendChild(group(f.of, item, p));
          rows.appendChild(card);
        }
      });
      add.disabled = arr.length >= f.max;
    }
    function swap(a, b){ var t = arr[a]; arr[a] = arr[b]; arr[b] = t; swapOpen(path, a, b); redraw(); changed(); }
    var add = el('button', 'add', '+ إضافة'); add.type = 'button';
    add.addEventListener('click', function(){
      arr.push(blank(f.of)); openCards[path + '[' + (arr.length - 1) + ']'] = true; redraw(); changed();
      var last = rows.lastElementChild; var inp = last && last.querySelector('input,textarea'); if (inp) inp.focus();
    });
    box.appendChild(add);
    redraw();
    return box;
  }

  // open/closed state is kept by path ("countries[2].ar.services[0]"); keep it with its item when items move
  function remapOpen(path, fn){
    var esc = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), re = new RegExp('^' + esc + '\\[(\\d+)\\]'), next = {};
    Object.keys(openCards).forEach(function(k){
      var m = re.exec(k);
      if (!m) { next[k] = openCards[k]; return; }
      var to = fn(+m[1]);
      if (to != null) next[path + '[' + to + ']' + k.slice(m[0].length)] = openCards[k];
    });
    openCards = next;
  }
  function shiftOpen(path, removed){ remapOpen(path, function(i){ return i === removed ? null : i > removed ? i - 1 : i; }); }
  function swapOpen(path, a, b){ remapOpen(path, function(i){ return i === a ? b : i === b ? a : i; }); }

  function iconPicker(value, set, id){
    var box = el('div', 'icons'); box.id = id; box.setAttribute('role', 'radiogroup');
    Object.keys(state.icons).forEach(function(k){
      var b = el('button', 'ico'); b.type = 'button'; b.title = k; b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', k); b.setAttribute('aria-checked', String(k === value));
      // icon markup comes from content/icons.json in the repository, not from user input
      b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + state.icons[k] + '</svg>';
      b.addEventListener('click', function(){
        box.querySelectorAll('.ico').forEach(function(x){ x.setAttribute('aria-checked', String(x === b)); });
        set(k); changed();
      });
      box.appendChild(b);
    });
    return box;
  }

  // ---------- article body: toolbar + preview ----------
  function bodyTools(ta){
    var bar = el('div', 'btools');
    [['عنوان فرعي', '\n\n## ', ''], ['نقطة', '\n- ', ''], ['نصيحة', '\n\n> ', ''], ['عريض', '**', '**']].forEach(function(t){
      var b = el('button', null, t[0]); b.type = 'button';
      b.addEventListener('click', function(){
        var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
        var before = t[1];
        if (before === '\n- ' && !/(^|\n)- [^\n]*$/.test(v.slice(0, s))) before = '\n\n- ';   // a new list starts on its own
        if (s === 0) before = before.replace(/^\n+/, '');
        ta.value = v.slice(0, s) + before + v.slice(s, e) + t[2] + v.slice(e);
        ta.selectionStart = ta.selectionEnd = s + before.length + (e - s);
        ta.focus(); ta.dispatchEvent(new Event('input'));
      });
      bar.appendChild(b);
    });
    var pv = el('button', 'pv', 'معاينة'); pv.type = 'button';
    var out = el('div', 'preview'); out.hidden = true;
    pv.addEventListener('click', function(){
      out.hidden = !out.hidden; pv.textContent = out.hidden ? 'معاينة' : 'إخفاء المعاينة';
      if (!out.hidden) renderBody(ta.value, out);
    });
    ta.addEventListener('input', function(){ if (!out.hidden) renderBody(ta.value, out); });
    bar.appendChild(pv);
    setTimeout(function(){ ta.parentNode.insertBefore(out, ta.nextSibling); });
    return bar;
  }
  function inline(parent, text){
    text.split(/\*\*(.+?)\*\*/).forEach(function(part, i){ parent.appendChild(i % 2 ? el('strong', null, part) : document.createTextNode(part)); });
    return parent;
  }
  // same rules as article_html() in tools/content.py
  function renderBody(text, out){
    out.textContent = '';
    text.trim().split(/\n\s*\n/).forEach(function(block){
      var lines = block.split('\n').map(function(x){ return x.trim(); }).filter(Boolean), para = [], i = 0;
      function flush(){ if (para.length) { out.appendChild(inline(el('p'), para.join(' '))); para = []; } }
      while (i < lines.length) {
        var x = lines[i];
        if (/^## /.test(x)) { flush(); out.appendChild(inline(el('h3'), x.slice(3))); i++; }
        else if (/^> /.test(x)) {
          flush(); var run = [];
          while (i < lines.length && /^> /.test(lines[i])) run.push(lines[i++].slice(2).trim());
          out.appendChild(inline(el('blockquote'), run.join(' ')));
        } else if (/^(- |\d+\. )/.test(x)) {
          flush(); var ul = /^- /.test(x), list = el(ul ? 'ul' : 'ol');
          while (i < lines.length && /^(- |\d+\. )/.test(lines[i]) && /^- /.test(lines[i]) === ul) list.appendChild(inline(el('li'), lines[i++].replace(/^(- |\d+\. )/, '')));
          out.appendChild(list);
        } else { para.push(x); i++; }
      }
      flush();
    });
  }

  // ---------- rendering a view ----------
  function render(){
    var body = $('edBody'); body.textContent = '';
    var v = VIEWS[view];
    $('edIntro').textContent = v.intro;
    var anyLang = false;
    v.parts.forEach(function(part){
      var f = state.schema[part.file], data = state.files[part.file].data;
      if (part.file === 'home') {
        anyLang = true;
        var langF = f.fields[lang], obj = data[lang];
        part.keys.forEach(function(k){
          var sub = langF.fields[k];
          var node = field(sub, function(){ return obj[k]; }, function(x){ obj[k] = x; }, 'home.' + lang + '.' + k);
          if (part.open && node.tagName === 'DETAILS' && openCards['home.' + lang + '.' + k] !== false) node.open = true;
          body.appendChild(node);
        });
      } else if (part.file === 'site') {
        var box = group(f, data, 'site', part.title);
        // changing the counter number restarts the count from now
        box.addEventListener('input', function(e){
          if (e.target.dataset.path === 'site.counter.base') {
            var was = JSON.parse(saved.site).counter;
            data.counter.start = data.counter.base === was.base ? was.start : new Date().toISOString().replace(/\.\d+Z$/, 'Z');
            var st = box.querySelector('[data-path="site.counter.start"]'); if (st) st.value = data.counter.start;
          }
        });
        body.appendChild(box);
      } else {
        anyLang = true;
        body.appendChild(listEditor(f, data, part.file));
        var note = el('p', 'hint');
        note.textContent = part.file === 'countries' ? 'افتح البلد عشان تعدّلها. الرابط = waledoweida.com/<الرابط>/' : 'افتح المقال عشان تعدّله. الرابط = waledoweida.com/blog/<الرابط>/';
        body.appendChild(note);
      }
    });
    $('langSeg').hidden = !anyLang;
    changed();
  }

  // ---------- client-side checks (the server checks again) ----------
  function check(f, v, path, errs){
    if (f.t === 'obj') { Object.keys(f.fields).forEach(function(k){ check(f.fields[k], v[k], path + '.' + k, errs); }); return; }
    if (f.t === 'list') {
      if (v.length < f.min) errs.push({ path: path, msg: f.label + ': لازم يبقى فيها ' + f.min + ' على الأقل' });
      v.forEach(function(x, i){ check(f.of, x, path + '[' + i + ']', errs); });
      return;
    }
    if (f.t === 'num') { if (!(Number.isInteger(v) && v >= f.min && v <= f.max)) errs.push({ path: path, msg: f.label + ': رقم مش مظبوط' }); return; }
    if (f.t === 'icon') return;
    var s = String(v == null ? '' : v).trim();
    if (f.t === 'match') { if (!new RegExp(f.re).test(s) || (f.when && !realDate(s, f.when))) errs.push({ path: path, msg: f.label + ': الشكل مش مظبوط' + (f.hint ? ' (' + f.hint + ')' : '') }); return; }
    if (!s && !f.optional) errs.push({ path: path, msg: f.label + ': فاضية' });
    else if (s.length > f.max) errs.push({ path: path, msg: f.label + ': أطول من ' + f.max + ' حرف' });
  }
  // same rule as realDate() in api/_lib/schema.ts
  function realDate(s, when){
    if (when === 'day') { var d = new Date(s + 'T00:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && s >= '2000' && s < '2100'; }
    var t = Date.parse(s); return !isNaN(t) && t >= Date.UTC(2020, 0, 1) && t < Date.UTC(2100, 0, 1);
  }
  function uniq(file, data, errs){
    if (file !== 'countries' && file !== 'articles') return;
    var seen = {}, reserved = ['en', 'blog', 'admin', 'api', 'review', 'fonts', 'content', 'tools', 'tests', 'node_modules'];
    data.forEach(function(x, i){
      if (seen[x.slug]) errs.push({ path: file + '[' + i + '].slug', msg: 'الرابط "' + x.slug + '" متكرر' });
      else if (file === 'countries' && (reserved.indexOf(x.slug) >= 0 || /^wedding/.test(x.slug)))
        errs.push({ path: file + '[' + i + '].slug', msg: 'الرابط "' + x.slug + '" محجوز للموقع، اختار رابط تاني' });
      seen[x.slug] = 1;
    });
    if (file === 'countries') {
      var codes = {};
      data.forEach(function(x, i){
        if (codes[x.code]) errs.push({ path: 'countries[' + i + '].code', msg: 'كود البلد "' + x.code + '" متكرر' });
        codes[x.code] = 1;
      });
    }
  }

  // which editor tab shows a given field path
  function viewFor(path){
    if (/^site/.test(path)) return 'basics';
    if (/^countries/.test(path)) return 'countries';
    if (/^articles/.test(path)) return 'articles';
    var m = /^home\.(?:ar|en)\.(\w+)/.exec(path), key = m && m[1];
    return Object.keys(VIEWS).filter(function(v){
      return VIEWS[v].parts.some(function(p){ return p.file === 'home' && p.keys.indexOf(key) >= 0; });
    })[0] || view;
  }

  function focusError(err){
    var m = /\.(ar|en)(\.|$)/.exec(err.path);
    if (m && m[1] !== lang) setLang(m[1]);
    var v = viewFor(err.path);
    if (v !== view) { view = v; if (window.woSelectTab) window.woSelectTab(v); }
    // open every section and card on the way to the field, then focus it
    var parts = err.path.match(/^[^\[.]+|\[\d+\]|\.[^\[.]+/g) || [], acc = '';
    parts.forEach(function(p){ acc += p; openCards[acc] = true; });
    render();
    var input = document.querySelector('[data-path="' + err.path.replace(/"/g, '') + '"]');
    if (input) {
      for (var d = input.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
      input.classList.add('invalid'); input.focus(); input.scrollIntoView({ block: 'center' });
    }
    var where = m ? (m[1] === 'en' ? 'في النسخة الإنجليزي — ' : 'في النسخة العربي — ') : '';
    $('saveMsg').textContent = where + err.msg; $('saveMsg').className = 'bad';
  }

  // ---------- saving ----------
  function save(){
    var files = dirtyFiles();
    for (var i = 0; i < files.length; i++) {
      var errs = [];
      check(state.schema[files[i]], state.files[files[i]].data, files[i], errs);
      uniq(files[i], state.files[files[i]].data, errs);
      if (errs.length) { focusError(errs[0]); return; }
    }
    $('save').disabled = true; $('saveMsg').textContent = 'بيتحفظ…'; $('saveMsg').className = '';
    // no typing while the commits run: what's on screen is exactly what gets saved
    $('edBody').inert = true; $('undo').disabled = true;
    function unlock(){ $('edBody').inert = false; $('save').disabled = false; $('undo').disabled = false; }
    var chain = Promise.resolve(), committed = 0;
    files.forEach(function(f){
      chain = chain.then(function(){
        return fetch(API, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: f, sha: state.files[f].sha, data: state.files[f].data }) })
          .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(b){ return { r: r, b: b }; }); })
          .then(function(x){
            if (x.r.ok) {
              state.files[f].sha = x.b.sha; state.files[f].data = x.b.data; saved[f] = JSON.stringify(x.b.data);
              if (!x.b.unchanged) committed++;
              return;
            }
            var e = new Error(x.b.error || x.r.status); e.status = x.r.status; e.body = x.b; throw e;
          });
      });
    });
    chain.then(function(){
      unlock();
      render();
      $('savebar').hidden = false; $('saveMsg').className = 'good';
      $('saveMsg').textContent = committed ? 'اتحفظ ✓ الموقع هيتحدث خلال دقيقتين تلاتة' : 'مفيش تغيير فعلي يتنشر (المسافات الزيادة بتتشال لوحدها)';
      setTimeout(function(){ if (!dirtyFiles().length) $('savebar').hidden = true; }, 6000);
      if (committed) { savedAt = Date.now(); pub({ state: 'building', since: new Date().toISOString() }); }
    }).catch(function(e){
      unlock();
      render();   // the files that did save were replaced by the server's copy; bind the form to them again
      if (e.status === 422 && e.body && e.body.field) {
        var i = e.body.field.indexOf(': '), path = e.body.field.slice(0, i), why = e.body.field.slice(i + 2);
        var WHY = { 'empty': 'فاضية', 'too long': 'أطول من المسموح', 'wrong format': 'الشكل مش مظبوط', 'bad number': 'رقم مش مظبوط',
          'broken character': 'فيها حرف بايظ (غالبًا إيموجي اتقطع) — امسحه واكتبه تاني', 'duplicate link': 'في رابط متكرر',
          'duplicate code': 'في كود بلد متكرر', 'reserved link': 'الرابط محجوز للموقع، اختار رابط تاني',
          'same as platforms.aria': 'لازم تختلف عن اسم شريط المنصات', 'wrong count': 'العدد مش مظبوط' };
        focusError({ path: path, msg: 'في خانة مش مظبوطة: ' + (WHY[why] || why) });
        return;
      }
      var msg = e.status === 401 ? 'خلصت مدة الدخول. ادخل تاني وبعدين دوس حفظ تاني (متقفلش الصفحة عشان تعديلاتك متضيعش).'
        : e.status === 409 ? 'الملف اتعدّل من مكان تاني. انسخ تعديلاتك واعمل تحديث للصفحة.'
        : e.body && e.body.error === 'github_access' ? 'مفتاح GitHub مش شغال (يمكن انتهى أو صلاحيته ناقصة).'
        : e.body && e.body.error === 'too_large' ? 'الملف بقى كبير أوي. قلّل شوية من الكلام.'
        : 'الحفظ فشل. اتأكد من الإنترنت وجرّب تاني.';
      $('saveMsg').textContent = msg; $('saveMsg').className = 'bad';
      if (e.status === 401) window.woShowLogin();
    });
  }

  function setLang(l){
    lang = l;
    document.querySelectorAll('#langSeg button').forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === l)); });
    $('edBody').dir = l === 'en' ? 'ltr' : 'rtl';
  }
  document.querySelectorAll('#langSeg button').forEach(function(b){
    b.addEventListener('click', function(){ setLang(b.getAttribute('data-lang')); render(); });
  });
  $('save').addEventListener('click', save);
  $('undo').addEventListener('click', function(){
    if (!confirm('ترجع كل التعديلات اللي لسه متحفظتش؟')) return;
    Object.keys(saved).forEach(function(f){ state.files[f].data = JSON.parse(saved[f]); });
    render();
  });

  window.woEditor = {
    open: function(name){
      view = name; $('editor').hidden = false; $('noGithub').hidden = true;
      (state ? Promise.resolve(state) : load()).then(function(s){ if (s && view === name) render(); })
        .catch(function(){ $('edBody').textContent = 'تعذّر تحميل المحتوى. جرّب تاني.'; });
    },
    dirty: function(){ return dirtyFiles().length > 0; },
    canLeave: function(){ return true; }
  };
})();
