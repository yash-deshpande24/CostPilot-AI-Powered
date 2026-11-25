// Pull request routes. Mount with:  app.use('/api', createPrRouter({ requireAuth, Recommendation }))
//   POST /api/recommendations/:id/pr   open a pull request for one finding
//   GET  /api/prs                      your pull requests (last 50)
//   GET  /api/prs/status               mode (mock or github), repo, daily usage
const express = require('express');
const mongoose = require('mongoose');
const { getConfig: defaultGetConfig } = require('../services/pr/config.cjs');
const { normalize } = require('../services/pr/normalize.cjs');
const { buildPr } = require('../services/pr/buildPr.cjs');
const { createPullRequest: defaultCreate, GitHubError } = require('../services/pr/github.cjs');

function startOfUtcDay() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

module.exports = function createPrRouter({
  requireAuth,
  Recommendation,
  PullRequestRecord = require('../models/PullRequestRecord.cjs'),
  getConfig = defaultGetConfig,
  createPullRequest = defaultCreate,
}) {
  if (!requireAuth || !Recommendation) throw new Error('createPrRouter needs requireAuth and Recommendation');
  const router = express.Router();
  const userId = (req) => req.user && (req.user.id || req.user._id || req.user.sub);

  router.get('/prs/status', requireAuth, async (req, res) => {
    const cfg = getConfig();
    const usedToday = await PullRequestRecord.countDocuments({ user: userId(req), createdAt: { $gte: startOfUtcDay() } });
    res.json({ mode: cfg.mode, repo: cfg.repo || null, baseBranch: cfg.baseBranch, dir: cfg.dir, usedToday, dailyLimit: cfg.dailyLimit });
  });

  router.get('/prs', requireAuth, async (req, res) => {
    const rows = await PullRequestRecord.find({ user: userId(req) }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ prs: rows });
  });

  router.post('/recommendations/:id/pr', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid recommendation id.' });

    const rec = await Recommendation.findById(id);
    if (!rec) return res.status(404).json({ error: 'Recommendation not found.' });
    if (['dismissed', 'resolved'].includes(rec.status)) {
      return res.status(400).json({ error: `This finding is ${rec.status}. There is nothing to fix.` });
    }

    const cfg = getConfig();
    const open = await PullRequestRecord.findOne({ recommendation: id, state: 'open', mode: cfg.mode });
    if (open) return res.status(409).json({ error: 'A pull request is already open for this finding.', pr: open });

    const usedToday = await PullRequestRecord.countDocuments({ user: userId(req), createdAt: { $gte: startOfUtcDay() } });
    if (usedToday >= cfg.dailyLimit) {
      return res.status(429).json({ error: `You have opened ${cfg.dailyLimit} pull requests today. Try again after midnight UTC.` });
    }

    const n = normalize(rec);
    const plan = buildPr(n, { dir: cfg.dir });
    try {
      const result = await createPullRequest(cfg, plan);
      const saved = await PullRequestRecord.create({
        user: userId(req),
        recommendation: id,
        mode: result.mode,
        kind: n.kind,
        resourceId: n.resourceId,
        savings: n.monthlySavings,
        title: plan.title,
        branch: plan.branch,
        path: plan.path,
        number: result.number || undefined,
        url: result.url || undefined,
      });
      // In mock mode the preview is returned so the UI can show what would be opened.
      res.status(201).json({ pr: saved, preview: result.mode === 'mock' ? { title: plan.title, path: plan.path, content: plan.content, body: plan.body } : undefined });
    } catch (e) {
      if (e instanceof GitHubError) return res.status(e.status === 404 || e.status === 422 ? 502 : e.status || 502).json({ error: e.message });
      console.error('PR error:', e && e.message);
      res.status(500).json({ error: 'Could not open the pull request.' });
    }
  });

  return router;
};
