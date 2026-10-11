// The live "services delivered" number. Worked out on the server so the way it grows never
// reaches the browser: the page only gets the result from /api/counter.
// From a fixed start, every 1–5 hours it grows by 3–15, except overnight (2am–9am Cairo time).
// Seeded per step, so every visitor sees the same number and it never goes down.

function seeded(i: number): number {
  let t = (i + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const cairoHour = ((): ((t: number) => number) => {
  try {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: 'numeric', hourCycle: 'h23' });
    return (t) => parseInt(f.format(t), 10);
  } catch {
    return (t) => new Date(t + 3 * 36e5).getUTCHours();
  }
})();

export function liveCount(base: number, start: string, now: number): number {
  let n = base;
  let t = Date.parse(start);
  if (!Number.isFinite(n) || Number.isNaN(t)) return Math.max(0, Math.floor(n) || 0);
  for (let i = 0; ; i++) {
    t += (1 + seeded(2 * i) * 4) * 36e5;
    if (t > now) break;
    const h = cairoHour(t);
    if (h < 2 || h >= 9) n += 3 + Math.floor(seeded(2 * i + 1) * 13);
  }
  return n;
}
