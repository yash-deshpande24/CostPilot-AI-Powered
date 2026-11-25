// A small GitHub client built on Node's own fetch, so there is nothing extra to install.
import { httpError } from './ai/errors.js';

const API = 'https://api.github.com';
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRANCH = /^[A-Za-z0-9._\/-]{1,100}$/;

async function call(fetchImpl, token, method, path, body) {
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'costpilot',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
  if (!res.ok) {
    console.error('GitHub call failed:', method, path, res.status, data.message); // never log the token
    if (res.status === 401) throw httpError(502, 'GitHub rejected the token. Check GITHUB_TOKEN.');
    if (res.status === 403 || res.status === 404) throw httpError(502, 'GitHub says the token cannot write to this repository. It needs Contents and Pull requests set to read and write.');
    if (res.status === 422) throw httpError(409, 'A branch or pull request for this item already exists on GitHub.');
    throw httpError(502, 'GitHub returned an error. Try again in a minute.');
  }
  return data;
}

// Creates a branch from the base branch, adds one file to it, and opens a pull request.
export async function openFixPullRequest({ token, repo, base = 'main', branch, path, content, title, body, fetchImpl = fetch }) {
  if (!REPO.test(repo || '')) throw httpError(400, 'GITHUB_REPO must look like owner/name.');
  if (!BRANCH.test(base)) throw httpError(400, 'GITHUB_BASE_BRANCH is not a valid branch name.');

  const ref = await call(fetchImpl, token, 'GET', `/repos/${repo}/git/ref/heads/${base}`);
  await call(fetchImpl, token, 'POST', `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: ref.object.sha });
  await call(fetchImpl, token, 'PUT', `/repos/${repo}/contents/${path}`, {
    message: title,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
  });
  const pr = await call(fetchImpl, token, 'POST', `/repos/${repo}/pulls`, { title, head: branch, base, body });
  return { url: pr.html_url, number: pr.number };
}
