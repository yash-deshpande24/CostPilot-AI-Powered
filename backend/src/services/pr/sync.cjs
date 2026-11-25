// Keeps pull request records and recommendations in step with GitHub.
// Merged  -> the finding becomes "applied".
// Closed  -> the finding goes back to "new" so it can be fixed another way.
const { getPullRequest: defaultGetPullRequest } = require('./github.cjs');

function prState(pr) {
  if (!pr) return 'unknown';
  if (pr.merged_at) return 'merged';
  if (pr.state === 'closed') return 'closed';
  return 'open';
}

async function syncRecord(cfg, row, { getPullRequest = defaultGetPullRequest, PullRequestRecord, Recommendation } = {}) {
  if (cfg.mode !== 'github' || row.mode !== 'github' || !row.number) return 'skipped';
  const pr = await getPullRequest(cfg, row.number);
  const state = prState(pr);
  if (state === 'merged' || state === 'closed') {
    await PullRequestRecord.updateOne({ _id: row._id }, { $set: { state: 'closed' } });
    if (row.recommendation) {
      if (state === 'merged') {
        await Recommendation.updateOne(
          { _id: row.recommendation },
          { $set: { status: 'applied', appliedAt: new Date() } }
        );
      } else {
        await Recommendation.updateOne(
          { _id: row.recommendation, status: 'pr_opened' },
          { $set: { status: 'new' } }
        );
      }
    }
  }
  return state;
}

async function syncRecords(cfg, rows, deps) {
  const open = rows.filter((r) => r.state === 'open' && r.mode === 'github' && r.number);
  const results = await Promise.all(open.map((r) => syncRecord(cfg, r, deps).catch(() => 'unknown')));
  return { checked: open.length, results };
}

module.exports = { prState, syncRecord, syncRecords };
