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
           arr.splice(i, 1); delete openCards[p]; redraw(); changed();
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
    function swap(a, b){ var t = arr[a]; arr[a] = arr[b]; arr[b] = t; var o = openCards[path + '[' + a + ']']; openCards[path + '[' + a + ']'] = openCards[path + '[' + b + ']']; openCards[path + '[' + b + ']'] = o; redraw(); changed(); }
    var add = el('button', 'add', '+ إضافة'); add.type = 'button';
    add.addEventListener('click', function(){
      arr.push(blank(f.of)); openCards[path + '[' + (arr.length - 1) + ']'] = true; redraw(); changed();
      var last = rows.lastElementChild; var inp = last && last.querySelector('input,textarea'); if (inp) inp.focus();
    });
    box.appendChild(add);
    redraw();
    return box;
  }

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
        ta.value = v.slice(0, s) + t[1] + v.slice(s, e) + t[2] + v.slice(e);
        ta.selectionStart = ta.selectionEnd = s + t[1].length + (e - s);
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
  function renderBody(text, out){
    out.textContent = '';
    text.trim().split(/\n\s*\n/).forEach(function(block){
      var lines = block.split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
      if (!lines.length) return;
      if (/^## /.test(lines[0])) { out.appendChild(inline(el('h3'), lines[0].slice(3))); if (lines.length > 1) out.appendChild(inline(el('p'), lines.slice(1).join(' '))); }
      else if (/^> /.test(lines[0])) out.appendChild(inline(el('blockquote'), lines.map(function(x){ return x.replace(/^>\s*/, ''); }).join(' ')));
      else if (lines.every(function(x){ return /^- /.test(x); })) { var ul = el('ul'); lines.forEach(function(x){ ul.appendChild(inline(el('li'), x.slice(2))); }); out.appendChild(ul); }
      else if (lines.every(function(x){ return /^\d+\. /.test(x); })) { var ol = el('ol'); lines.forEach(function(x){ ol.appendChild(inline(el('li'), x.replace(/^\d+\. /, ''))); }); out.appendChild(ol); }
      else out.appendChild(inline(el('p'), lines.join(' ')));
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
            data.counter.start = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
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
    if (f.t === 'match') { if (!new RegExp(f.re).test(s)) errs.push({ path: path, msg: f.label + ': الشكل مش مظبوط' + (f.hint ? ' (' + f.hint + ')' : '') }); return; }
    if (!s && !f.optional) errs.push({ path: path, msg: f.label + ': فاضية' });
    else if (s.length > f.max) errs.push({ path: path, msg: f.label + ': أطول من ' + f.max + ' حرف' });
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
  }

  function focusError(err){
    var m = /\.(ar|en)(\.|$)/.exec(err.path);
    if (m && m[1] !== lang) setLang(m[1]);
    // open every card on the way to the field, then focus it
    var parts = err.path.match(/^[^\[.]+|\[\d+\]|\.[^\[.]+/g) || [], acc = '';
    parts.forEach(function(p){ acc += p; if (/\]$/.test(acc)) openCards[acc] = true; });
    render();
    var input = document.querySelector('[data-path="' + err.path.replace(/"/g, '') + '"]');
    if (input) {
      var d = input.closest('details.more'); if (d) d.open = true;
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
      $('save').disabled = false;
      render();
      $('savebar').hidden = false; $('saveMsg').className = 'good';
      $('saveMsg').textContent = committed ? 'اتحفظ ✓ الموقع هيتحدث خلال دقيقتين تلاتة' : 'مفيش تغيير فعلي يتنشر (المسافات الزيادة بتتشال لوحدها)';
      setTimeout(function(){ if (!dirtyFiles().length) $('savebar').hidden = true; }, 6000);
      if (committed) { savedAt = Date.now(); pub({ state: 'building', since: new Date().toISOString() }); }
    }).catch(function(e){
      $('save').disabled = false;
      var msg = e.status === 401 ? 'خلصت مدة الدخول. ادخل تاني (تعديلاتك هتضيع لو قفلت الصفحة).'
        : e.status === 409 ? 'الملف اتعدّل من مكان تاني. انسخ تعديلاتك واعمل تحديث للصفحة.'
        : e.status === 422 ? 'في خانة مش مظبوطة: ' + (e.body && e.body.field || '')
        : e.body && e.body.error === 'github_access' ? 'مفتاح GitHub مش شغال (يمكن انتهى أو صلاحيته ناقصة).'
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
      (state ? Promise.resolve(state) : fetchAll()).then(function(s){ if (s && view === name) render(); })
        .catch(function(){ $('edBody').textContent = 'تعذّر تحميل المحتوى. جرّب تاني.'; });
    },
    dirty: function(){ return dirtyFiles().length > 0; },
    canLeave: function(){ return true; }
  };
})();
