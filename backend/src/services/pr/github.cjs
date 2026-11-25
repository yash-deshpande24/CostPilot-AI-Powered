// Opens a pull request through the GitHub REST API. Uses the built-in fetch (Node 20+),
// so no extra package is needed. The token is never written to logs or error messages.
class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

function friendly(status) {
  if (status === 401) return 'GitHub rejected the token. Check GITHUB_TOKEN.';
  if (status === 403) return 'GitHub refused the request. The token needs Contents and Pull requests write access, or you hit a rate limit.';
  if (status === 404) return 'GitHub could not find the repository or branch. Check GITHUB_REPO and GITHUB_BASE_BRANCH, and that the token can see the repository.';
  if (status === 422) return 'GitHub could not create the pull request. The branch or file may already exist.';
  return `GitHub returned status ${status}.`;
}

async function call(cfg, fetchImpl, method, path, body) {
  let res;
  try {
    res = await fetchImpl(`${cfg.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'costpilot',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new GitHubError('Could not reach GitHub.', 502);
  }
  if (!res.ok) throw new GitHubError(friendly(res.status), res.status === 401 || res.status === 403 ? 502 : res.status);
  return res.json();
}

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

async function createPullRequest(cfg, plan, fetchImpl = globalThis.fetch) {
  if (cfg.mode !== 'github') {
    return { mode: 'mock', number: null, url: null, branch: plan.branch, path: plan.path, title: plan.title };
  }
  const repo = cfg.repo;
  const ref = await call(cfg, fetchImpl, 'GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(cfg.baseBranch)}`);
  const sha = ref && ref.object && ref.object.sha;
  if (!sha) throw new GitHubError('Could not read the base branch.', 502);

  await call(cfg, fetchImpl, 'POST', `/repos/${repo}/git/refs`, { ref: `refs/heads/${plan.branch}`, sha });

  await call(cfg, fetchImpl, 'PUT', `/repos/${repo}/contents/${encodePath(plan.path)}`, {
    message: plan.title,
    content: Buffer.from(plan.content, 'utf8').toString('base64'),
    branch: plan.branch,
  });

  const pr = await call(cfg, fetchImpl, 'POST', `/repos/${repo}/pulls`, {
    title: plan.title,
    head: plan.branch,
    base: cfg.baseBranch,
    body: plan.body,
  });
  return { mode: 'github', number: pr.number, url: pr.html_url, branch: plan.branch, path: plan.path, title: plan.title };
}

module.exports = { createPullRequest, GitHubError };
