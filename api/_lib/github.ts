// Minimal GitHub contents API client for the admin panel's saves.
// Needs GITHUB_TOKEN (fine-grained, this repository only, Contents: read and write).
const API = 'https://api.github.com';

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

function repo(): string {
  return process.env.GITHUB_REPO || 'waledoweida/waledoweida';
}

function branch(): string {
  return process.env.GITHUB_BRANCH || 'main';
}

export class GitHubError extends Error {
  constructor(public status: number) { super('github ' + status); }
}

async function gh(path: string, init: RequestInit = {}): Promise<unknown> {
  const r = await fetch(API + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'waledoweida-admin',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!r.ok) throw new GitHubError(r.status);
  return r.json();
}

export interface RepoFile { text: string; sha: string }

export async function readFile(path: string): Promise<RepoFile> {
  const f = await gh(`/repos/${repo()}/contents/${path}?ref=${encodeURIComponent(branch())}`) as { content?: string; sha: string };
  return { text: Buffer.from(f.content || '', 'base64').toString('utf8'), sha: f.sha };
}

/** Commits new file content; `sha` must be the version the edit started from (409 if it changed meanwhile). */
export async function writeFile(path: string, text: string, sha: string, message: string): Promise<string> {
  const r = await gh(`/repos/${repo()}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: Buffer.from(text, 'utf8').toString('base64'), sha, branch: branch() }),
  }) as { content: { sha: string } };
  return r.content.sha;
}

/** Latest commit on the branch: tells the panel whether the pages were rebuilt after the last save. */
export async function head(): Promise<{ message: string; date: string }> {
  const c = await gh(`/repos/${repo()}/commits/${encodeURIComponent(branch())}`) as { commit: { message: string; committer: { date: string } } };
  return { message: c.commit.message.split('\n')[0], date: c.commit.committer.date };
}
