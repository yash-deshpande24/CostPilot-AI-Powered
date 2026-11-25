// Settings for automatic pull requests. Read from environment variables.
// With no GITHUB_TOKEN or GITHUB_REPO the feature runs in "mock" mode:
// it builds the pull request and shows it, but sends nothing to GitHub.
function getConfig(env = process.env) {
  const token = env.GITHUB_TOKEN || '';
  const repo = env.GITHUB_REPO || ''; // owner/name, for example yash-deshpande24/CostPilot-AI-Powered
  const forcedMock = (env.PR_MODE || '').toLowerCase() === 'mock';
  const mode = forcedMock || !token || !repo ? 'mock' : 'github';
  return {
    mode,
    token,
    repo,
    baseBranch: env.GITHUB_BASE_BRANCH || 'main',
    dir: (env.PR_DIR || 'costpilot-gitops/remediations').replace(/\/+$/, ''),
    apiUrl: (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, ''),
    dailyLimit: Number(env.PR_DAILY_LIMIT) > 0 ? Number(env.PR_DAILY_LIMIT) : 10,
  };
}

module.exports = { getConfig };
