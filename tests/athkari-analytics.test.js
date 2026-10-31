// حسابات «التحليلات الدقيقة» في لوحة تحكم أذكاري: أرقام معروفة ← نتيجة متوقعة
const test = require('node:test');
const assert = require('node:assert/strict');
const { compute, addDays, groupCrashes } = require('../athkari-admin/analytics-calc.js');

const doc = (dev, d, extra = {}) => ({ id: `${dev}_${d}`, d, ...extra });

test('addDays عبر الشهور والسنين', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('التثبيت والتحديث ومسارات النسخ', () => {
  const docs = [
    doc('aaaaaaaaaa', '2026-11-01', { life: { t: 'new', to: '2.1.0' } }),
    doc('bbbbbbbbbb', '2026-11-01', { life: { t: 'update', from: '2.0.0', to: '2.1.0' } }),
    doc('cccccccccc', '2026-11-02', { life: { t: 'update', from: 'old', to: '2.1.0' } }),
    doc('dddddddddd', '2026-11-02'),
  ];
  const a = compute(docs, docs, '2026-11-02');
  assert.equal(a.installs, 1);
  assert.equal(a.updates, 2);
  assert.equal(a.lifePaths['2.0.0 ← 2.1.0'], 1);
  assert.equal(a.lifePaths['نسخة قديمة ← 2.1.0'], 1);
  assert.equal(a.lifePaths['تثبيت جديد · 2.1.0'], 1);
});

test('مرات الفتح والمدة: متوسط على المستندات الجديدة بس', () => {
  const docs = [
    doc('aaaaaaaaaa', '2026-11-01', { s: { n: 3, sec: 600 }, hr: { h08: 2, h21: 1 } }),
    doc('bbbbbbbbbb', '2026-11-01', { s: { n: 1, sec: 60 }, hr: { h08: 1 } }),
    doc('cccccccccc', '2026-11-01'), // نسخة قديمة: مابتدخلش في المتوسط
  ];
  const a = compute(docs, docs, '2026-11-01');
  assert.equal(a.opensPerDevDay, 2);
  assert.equal(a.secPerDevDay, 330);
  assert.equal(a.secPerSession, 165);
  assert.deepEqual(a.hours, { h08: 3, h21: 1 });
});

test('النشطين: موبايلات مختلفة في اليوم والأسبوع والشهر', () => {
  const all = [
    doc('aaaaaaaaaa', '2026-11-10'), doc('aaaaaaaaaa', '2026-11-09'),
    doc('bbbbbbbbbb', '2026-11-05'),
    doc('cccccccccc', '2026-10-20'),
    doc('dddddddddd', '2026-09-01'), // أقدم من 30 يوم
  ];
  const a = compute(all, all, '2026-11-10');
  assert.equal(a.dau, 1);
  assert.equal(a.wau, 2);
  assert.equal(a.mau, 3);
});

test('الرجوع بعد يوم وأسبوع، وشهر لسه بدري', () => {
  const all = [
    doc('aaaaaaaaaa', '2026-11-01', { i: '2026-11-01' }), doc('aaaaaaaaaa', '2026-11-02'), doc('aaaaaaaaaa', '2026-11-08'),
    doc('bbbbbbbbbb', '2026-11-01', { i: '2026-11-01' }), doc('bbbbbbbbbb', '2026-11-03'),
    doc('cccccccccc', '2026-11-09', { i: '2026-11-09' }), // لسه مكملش أسبوع
  ];
  const a = compute(all, all, '2026-11-10');
  assert.deepEqual(a.ret.d1, { cohort: 3, back: 1, rate: 1 / 3 });
  assert.deepEqual(a.ret.d7, { cohort: 2, back: 1, rate: 0.5 });
  assert.equal(a.ret.d30.cohort, 0);
});

test('الموبايلات ومصدر التثبيت: آخر معلومة لكل موبايل مرة واحدة', () => {
  const docs = [
    doc('aaaaaaaaaa', '2026-11-01', { src: 'play', dev: { b: 'samsung', a: 34 } }),
    doc('aaaaaaaaaa', '2026-11-02', { src: 'play', dev: { b: 'samsung', a: 34 } }),
    doc('bbbbbbbbbb', '2026-11-02', { src: 'other', dev: { b: 'Xiaomi', a: 33 } }),
  ];
  const a = compute(docs, docs, '2026-11-02');
  assert.deepEqual(a.sources, { play: 1, other: 1 });
  assert.deepEqual(a.brands, { Samsung: 1, Xiaomi: 1 });
  assert.deepEqual(a.android, { 34: 1, 33: 1 });
});

test('الأخطاء: متجمّعة بالبصمة، وعدد الموبايلات والمرات صح', () => {
  const g = groupCrashes([
    { id: 'aaaaaaaaaaaa_2026-11-01_d1', g: 'aaaaaaaaaaaa', d: '2026-11-01', v: '2.1.0', m: 'RangeError', s: 'x', c: 3 },
    { id: 'aaaaaaaaaaaa_2026-11-02_d2', g: 'aaaaaaaaaaaa', d: '2026-11-02', v: '2.1.0', m: 'RangeError', s: 'x', c: 1 },
    { id: 'bbbbbbbbbbbb_2026-11-02_d1', g: 'bbbbbbbbbbbb', d: '2026-11-02', v: '2.0.0', m: 'Null', s: 'y', c: 9 },
  ]);
  assert.equal(g.length, 2);
  assert.equal(g[0].sig, 'aaaaaaaaaaaa'); // موبايلين أهم من موبايل واحد
  assert.equal(g[0].count, 4);
  assert.equal(g[0].devices, 2);
  assert.equal(g[0].last, '2026-11-02');
  assert.deepEqual(g[1].versions, ['2.0.0']);
});
