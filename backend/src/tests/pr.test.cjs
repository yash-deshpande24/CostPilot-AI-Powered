// Run with:  node --test src/tests/pr.test.cjs   (from the backend folder). No packages needed.
const test = require('node:test');
const assert = require('node:assert');
const { normalize } = require('../services/pr/normalize.cjs');
const { buildPr } = require('../services/pr/buildPr.cjs');
const { createPullRequest, getPullRequest, GitHubError } = require('../services/pr/github.cjs');
const { getConfig } = require('../services/pr/config.cjs');
const { prState, syncRecord } = require('../services/pr/sync.cjs');

const rec = { _id: 'abc123', type: 'unattached_ebs', resourceId: 'vol-0abc', monthlySavings: 8.5, region: 'ap-south-1', aiRisk: 'high' };
const fixed = { now: new Date('2026-11-25T10:00:00Z'), suffix: 'ab12' };

test('config: no token means mock mode', () => {
  assert.equal(getConfig({}).mode, 'mock');
  assert.equal(getConfig({ GITHUB_TOKEN: 'x', GITHUB_REPO: 'a/b' }).mode, 'github');
  assert.equal(getConfig({ GITHUB_TOKEN: 'x', GITHUB_REPO: 'a/b', PR_MODE: 'mock' }).mode, 'mock');
});

test('normalize: reads common field names', () => {
  const n = normalize(rec);
  assert.equal(n.kind, 'ebs');
  assert.equal(n.resourceId, 'vol-0abc');
  assert.equal(n.monthlySavings, 8.5);
  assert.equal(n.action, 'delete_unattached_volume');
});

test('normalize: handles missing fields', () => {
  const n = normalize({ _id: 'z9' });
  assert.equal(n.kind, 'other');
  assert.equal(n.resourceId, 'z9');
  assert.equal(n.monthlySavings, 0);
});

test('buildPr: branch, path, title and body', () => {
  const p = buildPr(normalize(rec), fixed);
  assert.equal(p.branch, 'costpilot/ebs-vol-0abc-20261125-ab12');
  assert.equal(p.path, 'costpilot-gitops/remediations/ebs-vol-0abc.yaml');
  assert.match(p.title, /vol-0abc/);
  assert.match(p.title, /\$8\.50/);
  assert.match(p.content, /action: delete_unattached_volume/);
  assert.match(p.body, /snapshot/);
  assert.match(p.body, /no permission to change AWS/);
});

test('buildPr: odd resource names stay safe in the file name', () => {
  const p = buildPr(normalize({ ...rec, resourceId: 'My Vol/../x' }), fixed);
  assert.ok(!p.path.includes('..'));
  assert.ok(!p.branch.includes(' '));
});

test('createPullRequest: mock mode sends nothing', async () => {
  const plan = buildPr(normalize(rec), fixed);
  const out = await createPullRequest(getConfig({}), plan, () => {
    throw new Error('should not call');
  });
  assert.equal(out.mode, 'mock');
  assert.equal(out.url, null);
});

test('createPullRequest: calls GitHub in order and returns the PR url', async () => {
  const calls = [];
  const fake = async (url, opts) => {
    calls.push(`${opts.method} ${url.replace('https://api.github.com', '')}`);
    const json =
      opts.method === 'GET' ? { object: { sha: 'sha1' } } : url.endsWith('/pulls') ? { number: 7, html_url: 'https://github.com/a/b/pull/7' } : {};
    return { ok: true, status: 200, json: async () => json };
  };
  const cfg = getConfig({ GITHUB_TOKEN: 'secret-token', GITHUB_REPO: 'a/b' });
  const plan = buildPr(normalize(rec), fixed);
  const out = await createPullRequest(cfg, plan, fake);
  assert.equal(out.number, 7);
  assert.equal(out.url, 'https://github.com/a/b/pull/7');
  assert.deepEqual(calls.map((c) => c.split(' ')[0]), ['GET', 'POST', 'PUT', 'POST']);
});

test('createPullRequest: error messages never contain the token', async () => {
  const fake = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const cfg = getConfig({ GITHUB_TOKEN: 'secret-token', GITHUB_REPO: 'a/b' });
  await assert.rejects(
    () => createPullRequest(cfg, buildPr(normalize(rec), fixed), fake),
    (e) => e instanceof GitHubError && !e.message.includes('secret-token') && /token/i.test(e.message)
  );
});

test('getPullRequest: reads one pull request', async () => {
  const fake = async (url, opts) => {
    assert.equal(opts.method, 'GET');
    assert.match(url, /\/repos\/a\/b\/pulls\/7$/);
    return { ok: true, status: 200, json: async () => ({ number: 7, state: 'open' }) };
  };
  const cfg = getConfig({ GITHUB_TOKEN: 't', GITHUB_REPO: 'a/b' });
  const pr = await getPullRequest(cfg, 7, fake);
  assert.equal(pr.number, 7);
});

test('prState: open, merged and closed', () => {
  assert.equal(prState({ state: 'open' }), 'open');
  assert.equal(prState({ state: 'closed', merged_at: '2026-11-25T10:00:00Z' }), 'merged');
  assert.equal(prState({ state: 'closed', merged_at: null }), 'closed');
  assert.equal(prState(null), 'unknown');
});

test('syncRecord: a merged pull request marks the finding applied', async () => {
  const updates = { record: [], rec: [] };
  const out = await syncRecord(
    getConfig({ GITHUB_TOKEN: 't', GITHUB_REPO: 'a/b' }),
    { _id: 'pr1', mode: 'github', number: 7, state: 'open', recommendation: 'rec1' },
    {
      getPullRequest: async () => ({ number: 7, state: 'closed', merged_at: '2026-11-25T10:00:00Z' }),
      PullRequestRecord: { updateOne: async (q, u) => updates.record.push(u.$set) },
      Recommendation: { updateOne: async (q, u) => updates.rec.push(u.$set) },
    }
  );
  assert.equal(out, 'merged');
  assert.deepEqual(updates.record, [{ state: 'closed' }]);
  assert.equal(updates.rec[0].status, 'applied');
});

test('syncRecord: a closed pull request puts the finding back to new', async () => {
  const updates = [];
  await syncRecord(
    getConfig({ GITHUB_TOKEN: 't', GITHUB_REPO: 'a/b' }),
    { _id: 'pr1', mode: 'github', number: 7, state: 'open', recommendation: 'rec1' },
    {
      getPullRequest: async () => ({ number: 7, state: 'closed', merged_at: null }),
      PullRequestRecord: { updateOne: async () => {} },
      Recommendation: { updateOne: async (q, u) => updates.push(u.$set) },
    }
  );
  assert.equal(updates[0].status, 'new');
});

test('syncRecord: mock records are not sent to GitHub', async () => {
  const out = await syncRecord(getConfig({}), { _id: 'pr1', mode: 'mock', state: 'open' }, {});
  assert.equal(out, 'skipped');
});
