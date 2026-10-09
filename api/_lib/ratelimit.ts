// Fixed-window rate limiting stored in Redis.
import { redis } from './redis';

/**
 * Counts one hit for `key` in the current window and returns whether it is still allowed.
 * Fails open (allows) if storage is unreachable, so the site keeps working.
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const k = `rl:${key}:${window}`;
  try {
    const [count] = await redis([['INCR', k], ['EXPIRE', k, windowSeconds]]);
    return Number(count) <= limit;
  } catch {
    return true;
  }
}

/** Reads the current count without adding a hit. */
export async function peek(key: string, windowSeconds: number): Promise<number> {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  try {
    const [count] = await redis([['GET', `rl:${key}:${window}`]]);
    return Number(count) || 0;
  } catch {
    return 0;
  }
}
