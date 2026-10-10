// Shape of the editable content files (content/*.json). The admin panel draws its forms from
// this and the API validates every save against it, so a save can never break the build.
export type Field =
  | { t: 'text' | 'area' | 'body'; label: string; max: number; hint?: string; optional?: boolean; adv?: boolean; ltr?: boolean }
  | { t: 'num'; label: string; min: number; max: number; hint?: string }
  | { t: 'match'; label: string; re: string; max: number; hint?: string; ltr?: boolean }
  | { t: 'icon'; label: string }
  | { t: 'list'; label: string; of: Field; min: number; max: number; item?: string; hint?: string; adv?: boolean }
  | { t: 'obj'; label?: string; fields: Record<string, Field>; hint?: string; adv?: boolean };

const text = (label: string, max = 200, extra: Partial<{ hint: string; optional: boolean; adv: boolean; ltr: boolean }> = {}): Field => ({ t: 'text', label, max, ...extra });
const area = (label: string, max = 600, extra: Partial<{ hint: string; adv: boolean }> = {}): Field => ({ t: 'area', label, max, ...extra });
const list = (label: string, of: Field, min: number, max: number, item?: string, hint?: string): Field => ({ t: 'list', label, of, min, max, item, hint });
const obj = (fields: Record<string, Field>, label?: string, extra: Partial<{ hint: string; adv: boolean }> = {}): Field => ({ t: 'obj', fields, label, ...extra });
const head = (eyebrow = 'الكلمة الصغيرة فوق العنوان') => ({ eyebrow: text(eyebrow, 60), title: text('العنوان', 160), lead: area('الوصف تحت العنوان', 400) });
const adv = (f: Field): Field => ({ ...f, adv: true } as Field);

const homeLang = obj({
  name: text('اسمك المختصر (في أعلى الموقع وأسفله)', 60),
  seo: obj({
    title: text('عنوان الصفحة في جوجل', 70, { hint: 'أقل من 60 حرف يبقى أحسن' }),
    description: area('وصف الصفحة في جوجل', 300, { hint: 'بين 120 و160 حرف' }),
    share_title: text('العنوان لما حد يشارك اللينك', 120),
    share_description: area('الوصف لما حد يشارك اللينك', 300),
    job_title: text('مسمّاك الوظيفي (لجوجل)', 100),
  }, 'الظهور في جوجل والمشاركة'),
  hero: obj({
    badge: text('الشارة الصغيرة فوق العنوان', 60),
    title_start: text('العنوان الكبير: أوله', 120),
    title_gold: text('العنوان الكبير: الجزء الدهبي', 120),
    title_end: text('العنوان الكبير: آخره', 120, { optional: true }),
    intro: area('التعريف تحت العنوان', 600, { hint: 'حط الكلام بين ** و ** عشان يبقى عريض' }),
    button_main: text('الزرار الدهبي', 40),
    button_second: text('الزرار التاني', 40),
    trust: list('العلامات تحت الأزرار', text('علامة', 80), 1, 6),
    photo_alt: adv(text('وصف الصورة (للمكفوفين وجوجل)', 120)),
    chip_seo_title: adv(text('الكارت الطاير 1: العنوان', 40)), chip_seo_text: adv(text('الكارت الطاير 1: السطر الصغير', 60)),
    chip_social_title: adv(text('الكارت الطاير 2: العنوان', 40)), chip_social_text: adv(text('الكارت الطاير 2: السطر الصغير', 60)),
    chip_ads_title: adv(text('الكارت الطاير 3: العنوان', 40)), chip_ads_text: adv(text('الكارت الطاير 3: السطر الصغير', 60)),
  }, 'أول الصفحة'),
  platforms: obj({
    label: text('الكلام قبل الشريط', 60),
    items: list('المنصات', text('منصة', 40), 3, 20),
    aria: adv(text('اسم القسم لقارئ الشاشة', 40)),
  }, 'شريط المنصات'),
  stats: obj({
    counter_label: text('الكلام تحت عداد الخدمات', 60, { hint: 'رقم العداد نفسه من تبويب "الأساسيات"' }),
    items: list('باقي الأرقام', obj({ value: text('الرقم', 12, { ltr: true }), label: text('الكلام تحته', 60) }), 0, 5, 'label'),
    aria: adv(text('اسم القسم لقارئ الشاشة', 40)),
  }, 'الأرقام'),
  regions: obj({ ...head(), more: text('كلمة "اعرف أكتر" على الكروت', 30), note: text('السطر تحت الكروت', 160) }, 'أسواقي (كروت البلاد)', { hint: 'كلام كل كارت بتعدّله من تبويب "البلاد"' }),
  services: obj({
    ...head(),
    featured_title: text('عنوان الخدمات الأساسية', 60),
    featured: list('الخدمات الأساسية (الكروت الكبيرة)', obj({
      icon: { t: 'icon', label: 'الأيقونة' }, title: text('اسم الخدمة', 80), text: area('وصف الخدمة', 400),
      points: list('النقط', text('نقطة', 80), 0, 6),
      form_name: text('اسمها في فورم الطلب', 80, { optional: true, adv: true, hint: 'سيبها فاضية عشان تبقى زي اسم الخدمة' }),
    }), 1, 6, 'title'),
    others_title: text('عنوان الخدمات التانية', 60),
    others: list('الخدمات التانية (الكروت الصغيرة)', obj({
      icon: { t: 'icon', label: 'الأيقونة' }, title: text('اسم الخدمة', 80), text: area('وصف قصير', 200),
      form_name: text('اسمها في فورم الطلب', 80, { optional: true, adv: true, hint: 'سيبها فاضية عشان تبقى زي اسم الخدمة' }),
    }), 0, 16, 'title'),
    order: text('كلمة "اطلب الخدمة"', 40),
  }, 'الخدمات'),
  why: obj({
    ...head(), button: text('الزرار', 40),
    items: list('الأسباب', obj({ icon: { t: 'icon', label: 'الأيقونة' }, title: text('العنوان', 60), text: area('الشرح', 200) }), 1, 8, 'title'),
  }, 'ليه تشتغل معايا'),
  steps: obj({ ...head(), items: list('الخطوات', obj({ title: text('الخطوة', 60), text: area('الشرح', 200) }), 1, 6, 'title') }, 'خطوات العمل'),
  audit: obj({
    tag: text('الشارة', 40), title: text('العنوان', 120), text: area('الوصف', 400),
    checks: list('اللي هتراجعه', text('نقطة', 100), 1, 6), badges: list('العلامات الصغيرة', text('علامة', 40), 0, 4),
    form_title: text('عنوان الفورم', 60), link_label: text('اسم خانة اللينك', 60), link_placeholder: adv(text('مثال في خانة اللينك', 60, { ltr: true })),
    name_label: text('اسم خانة الاسم', 40), name_placeholder: adv(text('مثال في خانة الاسم', 60)),
    button: text('الزرار', 60), note: text('السطر تحت الزرار', 160), done: text('رسالة بعد الإرسال', 200),
  }, 'التقييم المجاني'),
  contact: obj({
    ...head(), whatsapp_label: text('كلمة "واتساب"', 30), call_label: text('كلمة "اتصال"', 30),
    form_title: text('عنوان الفورم', 60), name_label: text('خانة الاسم', 40), name_placeholder: adv(text('مثال في خانة الاسم', 60)),
    service_label: text('خانة الخدمة', 40), service_choose: text('أول اختيار ("اختار الخدمة")', 40),
    service_other: text('آخر اختيار ("أكتر من خدمة")', 60, { hint: 'باقي الاختيارات بتيجي لوحدها من الخدمات' }),
    details_label: text('خانة التفاصيل', 40), details_hint: text('كلمة "(اختياري)"', 30), details_placeholder: adv(text('مثال في خانة التفاصيل', 120)),
    button: text('الزرار', 60), done: text('رسالة بعد الإرسال', 200),
  }, 'اطلب خدمة'),
  faq: obj({ ...head(), items: list('الأسئلة', obj({ q: text('السؤال', 160), a: area('الإجابة', 800) }), 1, 20, 'q') }, 'الأسئلة الشائعة'),
  footer: obj({ about: area('النبذة في أسفل الموقع', 300), rights: text('سطر الحقوق', 120) }, 'أسفل الموقع'),
  chat: obj({
    status: text('الحالة ("متاح دلوقتي")', 60), message: area('رسالة الترحيب', 300), button: text('الزرار', 40),
    prefill: text('الرسالة الجاهزة اللي بتتبعت على واتساب', 200),
    aria: adv(text('اسم القسم لقارئ الشاشة', 40)), bubble_aria: adv(text('اسم الفقاعة لقارئ الشاشة', 60)),
    close: adv(text('كلمة "إغلاق"', 20)), fab_aria: adv(text('اسم الزرار العايم لقارئ الشاشة', 60)),
  }, 'فقاعة واتساب'),
});

const countryLang = obj({
  name: text('اسم البلد', 40),
  card_title: text('العنوان على كارت الصفحة الرئيسية', 60, { optional: true, hint: 'فاضي = اسم البلد' }),
  card: area('كلام الكارت في الصفحة الرئيسية', 300),
  title: text('عنوان الصفحة', 120),
  seo_title: text('عنوان جوجل', 70, { optional: true, adv: true, hint: 'فاضي = عنوان الصفحة' }),
  desc: area('وصف جوجل', 300),
  lead: area('الكلام تحت العنوان', 500),
  services_h: text('عنوان الخدمات', 100),
  services: list('الخدمات', obj({ icon: { t: 'icon', label: 'الأيقونة' }, title: text('الخدمة', 80), text: area('الوصف', 300) }), 1, 12, 'title'),
  why_h: text('عنوان "ليه أنا"', 100),
  why: list('الأسباب', text('سبب', 200), 1, 8),
  faq: list('الأسئلة', obj({ q: text('السؤال', 160), a: area('الإجابة', 800) }), 0, 12, 'q'),
  cta_h: text('عنوان آخر الصفحة', 100),
  cta_p: text('الكلام تحته', 200),
  wa_text: text('رسالة واتساب الجاهزة', 200),
});

const articleLang = obj({
  title: text('عنوان المقال', 140),
  desc: area('وصف قصير (لجوجل والكارت)', 300),
  body: { t: 'body', label: 'المقال', max: 30000, hint: 'سطر فاضي بين كل فقرة. ## عنوان فرعي — "- " نقطة — "1. " ترقيم — "> " نصيحة — **كلام عريض**' },
});

const SLUG = '^[a-z0-9]+(-[a-z0-9]+)*$';

export const SCHEMA: Record<string, Field> = {
  site: obj({
    whatsapp: { t: 'match', label: 'رقم الواتساب بالكود الدولي', re: '^[1-9][0-9]{7,14}$', max: 15, hint: 'أرقام بس، من غير + ولا مسافات. مثال: 201025926261', ltr: true },
    counter: obj({
      base: { t: 'num', label: 'رقم عداد الخدمات دلوقتي', min: 0, max: 100000000, hint: 'العداد بيزيد لوحده من الرقم ده' },
      start: { t: 'match', label: 'العداد بدأ من', re: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?(Z|[+-]\\d{2}:\\d{2})$', max: 40, ltr: true, hint: 'بيتظبط لوحده لما تغيّر الرقم' },
    }, 'عداد الخدمات'),
  }),
  home: obj({ ar: homeLang, en: homeLang }),
  countries: list('البلاد', obj({
    slug: { t: 'match', label: 'رابط الصفحة', re: SLUG, max: 40, ltr: true, hint: 'حروف إنجليزي صغيرة وشرطة. مثال: saudi-arabia' },
    code: { t: 'match', label: 'كود البلد', re: '^[A-Z]{2,4}$', max: 4, ltr: true, hint: 'حروف إنجليزي كابيتال. مثال: SA' },
    ar: countryLang, en: countryLang,
  }), 1, 20, 'code'),
  articles: list('المقالات', obj({
    slug: { t: 'match', label: 'رابط المقال', re: SLUG, max: 60, ltr: true, hint: 'حروف إنجليزي صغيرة وشرطة. مثال: instagram-tips' },
    date: { t: 'match', label: 'التاريخ', re: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$', max: 10, ltr: true, hint: 'سنة-شهر-يوم' },
    icon: { t: 'icon', label: 'الأيقونة' },
    ar: articleLang, en: articleLang,
  }), 1, 100, 'slug'),
};

export const FILES = Object.keys(SCHEMA);

export class Invalid extends Error {}

/** Returns a clean copy of `v` that matches `f`, or throws Invalid naming the field. */
export function validate(f: Field, v: unknown, icons: Set<string>, path = ''): unknown {
  const bad = (why: string): never => { throw new Invalid(`${path || 'root'}: ${why}`); };
  switch (f.t) {
    case 'text': case 'area': case 'body': case 'match': {
      if (typeof v !== 'string') return bad('not text');
      const keepLines = f.t === 'area' || f.t === 'body';
      if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(v)) return bad('broken character');
      let s = v.replace(/\r\n?/g, '\n').replace(keepLines ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, ' ').trim();
      if (s.length > f.max) return bad('too long');
      if (f.t === 'match') { if (!new RegExp(f.re).test(s)) return bad('wrong format'); }
      else if (!s && !f.optional) return bad('empty');
      if (f.t === 'text') s = s.replace(/\s+/g, ' ');
      else s = s.replace(/[ \t]+\n/g, '\n');
      return s;
    }
    case 'num': {
      const n = typeof v === 'number' ? v : Number.NaN;
      if (!Number.isInteger(n) || n < f.min || n > f.max) return bad('bad number');
      return n;
    }
    case 'icon':
      if (typeof v !== 'string' || !icons.has(v)) return bad('unknown icon');
      return v;
    case 'list': {
      if (!Array.isArray(v)) return bad('not a list');
      if (v.length < f.min || v.length > f.max) return bad('wrong count');
      return v.map((x, i) => validate(f.of, x, icons, `${path}[${i}]`));
    }
    case 'obj': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return bad('not an object');
      const src = v as Record<string, unknown>, out: Record<string, unknown> = {};
      for (const [k, sub] of Object.entries(f.fields)) {
        const optional = (sub.t === 'text' && sub.optional);
        out[k] = validate(sub, src[k] === undefined && optional ? '' : src[k], icons, path ? `${path}.${k}` : k);
      }
      return out;
    }
  }
}

/** Whole-file checks the field rules can't express (unique links and codes). */
export function validateFile(name: string, data: unknown, icons: Set<string>): unknown {
  const clean = validate(SCHEMA[name], data, icons, name);
  if (name === 'countries' || name === 'articles') {
    const rows = clean as { slug: string; code?: string }[];
    // folders that already exist at the top of the site (a country page there would clash);
    // anything starting with "wedding" is the red line
    const reserved = new Set(['en', 'blog', 'admin', 'api', 'review', 'fonts', 'content', 'tools', 'tests', 'node_modules']);
    const slugs = rows.map((r) => r.slug);
    if (new Set(slugs).size !== slugs.length) throw new Invalid(`${name}: duplicate link`);
    if (name === 'countries') {
      if (slugs.some((s) => reserved.has(s) || s.startsWith('wedding'))) throw new Invalid(`${name}: reserved link`);
      const codes = rows.map((r) => r.code);
      if (new Set(codes).size !== codes.length) throw new Invalid(`${name}: duplicate code`);
    }
  }
  if (name === 'home') {
    for (const l of ['ar', 'en'] as const) {
      const h = (clean as Record<string, { platforms: { aria: string }; stats: { aria: string } }>)[l];
      if (h.platforms.aria === h.stats.aria) throw new Invalid(`home.${l}.stats.aria: same as platforms.aria`);
    }
  }
  return clean;
}
