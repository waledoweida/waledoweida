// /api/content — the admin panel's editor backend (admin session cookie required).
//   GET            → every editable file (data + version), the form schema, icons and publish status
//   GET ?status=1  → publish status only
//   PUT {file, data, sha} → validates and commits content/<file>.json; the "Build pages"
//                    workflow then regenerates the pages and Vercel publishes them.
import type { ApiRequest as VercelRequest, ApiResponse as VercelResponse } from './_lib/types';
import { jsonBody, sameOrigin, sendJson } from './_lib/http';
import { adminConfigured, hasSession } from './_lib/session';
import { FILES, Invalid, SCHEMA, validateFile } from './_lib/schema';
import { GitHubError, githubConfigured, head, readFile, writeFile } from './_lib/github';

const SAVE_PREFIX = 'Admin: ';
const LABEL: Record<string, string> = { site: 'site settings', home: 'home page', countries: 'country pages', articles: 'blog articles' };

async function status(): Promise<{ state: 'building' | 'live'; since: string }> {
  const h = await head();
  return { state: h.message.startsWith(SAVE_PREFIX) ? 'building' : 'live', since: h.date };
}

async function icons(): Promise<Record<string, string>> {
  return JSON.parse((await readFile('content/icons.json')).text) as Record<string, string>;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'PUT') { res.setHeader('Allow', 'GET, PUT'); return sendJson(res, 405, { ok: false }); }
  if (!adminConfigured()) return sendJson(res, 503, { ok: false, error: 'not_configured' });
  if (!hasSession(req)) return sendJson(res, 401, { ok: false, error: 'unauthorized' });
  if (!githubConfigured()) return sendJson(res, 503, { ok: false, error: 'no_github_token' });

  try {
    if (req.method === 'GET') {
      if (req.query.status) return sendJson(res, 200, { ok: true, status: await status() });
      const [ic, st, ...files] = await Promise.all([icons(), status(), ...FILES.map((f) => readFile(`content/${f}.json`))]);
      const out: Record<string, { data: unknown; sha: string }> = {};
      FILES.forEach((f, i) => { out[f] = { data: JSON.parse(files[i].text), sha: files[i].sha }; });
      return sendJson(res, 200, { ok: true, files: out, schema: SCHEMA, icons: ic, status: st });
    }

    if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' });
    const body = jsonBody(req);
    const file = String(body?.file ?? ''), sha = String(body?.sha ?? '');
    if (!FILES.includes(file) || !/^[0-9a-f]{40}$/.test(sha)) return sendJson(res, 400, { ok: false, error: 'bad_request' });
    let clean: unknown;
    try {
      clean = validateFile(file, body?.data, new Set(Object.keys(await icons())));
    } catch (e) {
      if (e instanceof Invalid) return sendJson(res, 422, { ok: false, error: 'invalid', field: e.message });
      throw e;
    }
    const text = JSON.stringify(clean, null, 2) + '\n';
    if (text.length > 900_000) return sendJson(res, 413, { ok: false, error: 'too_large' });
    const newSha = await writeFile(`content/${file}.json`, text, sha, SAVE_PREFIX + 'update ' + LABEL[file]);
    return sendJson(res, 200, { ok: true, sha: newSha, data: clean });
  } catch (e) {
    if (e instanceof GitHubError) {
      if (e.status === 409 || e.status === 422) return sendJson(res, 409, { ok: false, error: 'changed_meanwhile' });
      if (e.status === 401 || e.status === 403 || e.status === 404) return sendJson(res, 502, { ok: false, error: 'github_access' });
    }
    return sendJson(res, 502, { ok: false, error: 'github' });
  }
}
