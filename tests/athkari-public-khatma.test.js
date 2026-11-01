// Pure logic of the public khatma API (api/athkari-public-khatma.ts): pages per juz, the reading-log check,
// expiry of parts held too long, and what the app is shown.
const test = require('node:test');
const assert = require('node:assert/strict');
const pk = require('../.build/athkari-public-khatma.js');

const khatma = (over = {}) => {
  const parts = {};
  for (let j = 1; j <= 30; j++) parts[j] = { s: 0, d: '', at: 0 };
  return { id: 'ABCDEFGH', name: 'ختمة', dua: '', seq: 1, status: 'open', createdAt: 0, doneAt: 0,
    minPageSec: 15, holdHours: 6, repeat: true, parts, updateTime: '', ...over };
};

test('juzPages covers the 604 pages exactly once', () => {
  let all = [];
  for (let j = 1; j <= 30; j++) all = all.concat(pk.juzPages(j));
  assert.equal(all.length, 604);
  assert.deepEqual(all, Array.from({ length: 604 }, (_, i) => i + 1));
  assert.deepEqual(pk.juzPages(1).slice(0, 2), [1, 2]);
  assert.equal(pk.juzPages(1).length, 21);
});

test('checkLog: every page long enough, and not faster than the pages need', () => {
  const pages = pk.juzPages(2);
  const log = Object.fromEntries(pages.map((p) => [String(p), 16]));
  const enough = pages.length * 15 * 1000;
  assert.equal(pk.checkLog(2, log, 15, enough), 'ok');
  assert.equal(pk.checkLog(2, { ...log, [String(pages[3])]: 4 }, 15, enough), 'pages');
  const missing = { ...log }; delete missing[String(pages[0])];
  assert.equal(pk.checkLog(2, missing, 15, enough), 'pages');
  assert.equal(pk.checkLog(2, log, 15, 60_000), 'too_fast');
  assert.equal(pk.checkLog(2, null, 15, enough), 'pages');
});

test('expire frees parts held longer than holdHours, and view hides device ids', () => {
  const now = Date.now();
  const k = khatma();
  k.parts[3] = { s: 1, d: 'aaaaaaaaaaaaaaaa', at: now - 7 * 3600_000 };
  k.parts[4] = { s: 1, d: 'bbbbbbbbbbbbbbbb', at: now - 3600_000 };
  k.parts[5] = { s: 2, d: 'cccccccccccccccc', at: now - 9 * 3600_000 };
  assert.deepEqual(pk.expire(k, now), [3]);
  assert.equal(k.parts[3].s, 0);
  const v = pk.view(k, 'bbbbbbbbbbbbbbbb');
  assert.equal(v.mine.juz, 4);
  assert.equal(v.mine.done, false);
  assert.equal(v.taken, 2);
  assert.equal(v.done, 1);
  assert.ok(!JSON.stringify(v).includes('cccccccc'));
  assert.equal(pk.view(k, '').mine, null);
});

test('parseKhatma reads Firestore REST fields with safe defaults', () => {
  const doc = { updateTime: 't', fields: { name: { stringValue: 'ختمة أذكاري' }, seq: { integerValue: '3' }, status: { stringValue: 'full' },
    parts: { mapValue: { fields: { 1: { mapValue: { fields: { s: { integerValue: '2' }, d: { stringValue: 'x' }, at: { integerValue: '5' } } } } } } } } };
  const k = pk.parseKhatma('ABCDEFGH', doc);
  assert.equal(k.seq, 3);
  assert.equal(k.status, 'full');
  assert.equal(k.minPageSec, 15);
  assert.equal(k.holdHours, 6);
  assert.equal(k.repeat, true);
  assert.equal(k.parts[1].s, 2);
  assert.equal(k.parts[30].s, 0);
});
