// Redis access for the serverless functions.
// Works with REDIS_URL (Vercel's Redis integration, redis:// or rediss://) through the `redis`
// client, or with an Upstash REST endpoint (KV_REST_API_URL + KV_REST_API_TOKEN).
import { createClient } from 'redis';

type Command = (string | number)[];
type RedisClient = ReturnType<typeof createClient>;

function restConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export function storageConfigured(): boolean {
  return Boolean(restConfig() || process.env.REDIS_URL);
}

// one TCP connection per warm function instance
let clientPromise: Promise<RedisClient> | null = null;
function tcpClient(): Promise<RedisClient> {
  if (!clientPromise) {
    const client = createClient({
      url: process.env.REDIS_URL,
      socket: { connectTimeout: 5000, reconnectStrategy: false },
    });
    client.on('error', () => { clientPromise = null; });
    clientPromise = client.connect().then(() => client).catch((e: unknown) => {
      clientPromise = null;
      throw e;
    });
  }
  return clientPromise;
}

/** Runs the commands (pipelined) and returns their results in order. */
export async function redis(commands: Command[]): Promise<unknown[]> {
  const rest = restConfig();
  if (rest) {
    const r = await fetch(rest.url + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + rest.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!r.ok) throw new Error('storage error ' + r.status);
    const out = (await r.json()) as { result?: unknown; error?: string }[];
    return out.map((x) => x.result);
  }
  if (!process.env.REDIS_URL) throw new Error('storage not configured');
  const client = await tcpClient();
  return Promise.all(commands.map((c) => client.sendCommand(c.map(String))));
}
