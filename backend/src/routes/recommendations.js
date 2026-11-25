import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { costSource } from '../services/costSource.js';
import Recommendation from '../models/Recommendation.js';
import { buildRemediation } from '../services/remediation.js';
import { openFixPullRequest } from '../services/github.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (_req, res) => {
  const source = costSource();
  const items = await Recommendation.find({ source, status: { $in: ['new', 'pr_opened'] } }).lean();
  // AI-ranked items first (by rank), then the rest by savings.
  items.sort((a, b) => {
    const pa = a.aiPriority ?? Infinity;
    const pb = b.aiPriority ?? Infinity;
    return pa !== pb ? pa - pb : b.monthlySavings - a.monthlySavings;
  });
  const total = items.reduce((s, r) => s + r.monthlySavings, 0);
  const last = await Recommendation.findOne({ source }).sort({ lastSeenAt: -1 }).lean();

  res.json({
    source,
    count: items.length,
    totalMonthlySavings: Math.round(total * 100) / 100,
    lastScanAt: last?.lastSeenAt || null,
    items,
  });
}));

// Dismiss a recommendation, or bring it back.
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'That recommendation id is not valid.' });
  if (!['dismissed', 'new'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "dismissed" or "new".' });
  }
  const item = await Recommendation.findByIdAndUpdate(id, { status }, { new: true });
  if (!item) return res.status(404).json({ error: 'Recommendation not found.' });
  res.json({ item });
}));

// Opens a pull request on GitHub with a runbook for this finding. Merging it does not change AWS.
router.post('/:id/pr', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'That recommendation id is not valid.' });
  const rec = await Recommendation.findById(id);
  if (!rec) return res.status(404).json({ error: 'Recommendation not found.' });
  if (rec.prUrl) return res.json({ url: rec.prUrl, existing: true });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return res.status(400).json({ error: 'GitHub is not connected yet. Set GITHUB_TOKEN and GITHUB_REPO. See docs/week6.md.' });
  }
  try {
    const fix = buildRemediation(rec);
    const pr = await openFixPullRequest({ token, repo, base: process.env.GITHUB_BASE_BRANCH || 'main', ...fix });
    rec.prUrl = pr.url;
    rec.status = 'pr_opened';
    await rec.save();
    res.json({ url: pr.url, number: pr.number, existing: false });
  } catch (e) {
    if (e.userMessage) return res.status(e.status || 502).json({ error: e.userMessage });
    throw e;
  }
}));

export default router;
