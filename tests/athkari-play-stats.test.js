// Google Play report parsing for the Athkari control panel (api/athkari-play-stats.ts).
const test = require('node:test');
const assert = require('node:assert/strict');
const ps = require('../.build/athkari-play-stats.js');

const utf16 = (s) => {
  const body = Buffer.from(s, 'utf16le');
  return new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xfe]), body]));
};

test('months: this month and the two before, across a year change', () => {
  assert.deepEqual(ps.months(new Date(Date.UTC(2027, 0, 15))), ['202701', '202612', '202611']);
});

test('decode: UTF-16LE with BOM, UTF-8 with BOM, plain UTF-8', () => {
  assert.equal(ps.decode(utf16('Date,X\n')), 'Date,X\n');
  assert.equal(ps.decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])), 'A');
  assert.equal(ps.decode(new Uint8Array([0x41, 0x42])), 'AB');
});

test('parseCsv + mergeDays + totals', () => {
  const inst = ps.parseCsv(ps.decode(utf16(
    'Date,Package Name,Daily Device Installs,Daily Device Uninstalls,Daily User Installs,Total User Installs,Active Device Installs\r\n' +
    '2026-11-08,com.athkari.athkari,5,1,5,20,18\r\n' +
    '2026-11-09,com.athkari.athkari,7,0,6,26,24\r\n')));
  const rate = ps.parseCsv('Date,Package Name,Daily Average Rating,Total Average Rating\n2026-11-09,com.athkari.athkari,NA,4.80\n');
  const crash = ps.parseCsv('Date,Package Name,Daily Crashes,Daily ANRs\n2026-11-08,com.athkari.athkari,1,0\n');
  const days = ps.mergeDays(inst, rate, crash);
  assert.equal(days.length, 2);
  assert.deepEqual(days.map((d) => d.date), ['2026-11-08', '2026-11-09']);
  assert.equal(days[1].rating, null);
  assert.equal(days[1].totalRating, 4.8);
  assert.equal(days[0].crashes, 1);
  const t = ps.totals(days);
  assert.equal(t.totalUsers, 26);
  assert.equal(t.active, 24);
  assert.equal(t.rating, 4.8);
  assert.equal(t.installs7, 12);
  assert.equal(t.uninstalls28, 1);
  assert.equal(t.crashes7, 1);
  assert.equal(t.lastDate, '2026-11-09');
});

test('totals of no days', () => {
  const t = ps.totals([]);
  assert.equal(t.totalUsers, null);
  assert.equal(t.installs28, 0);
  assert.equal(t.lastDate, null);
});
