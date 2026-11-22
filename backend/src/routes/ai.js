import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import Recommendation from '../models/Recommendation.js';
import ChatMessage from '../models/ChatMessage.js';
import { getDailyCosts, costSource } from '../services/costSource.js';
import { findAnomalies } from '../services/anomaly.js';
import { aiMode, aiModel } from '../services/ai/config.js';
import { explainSpend, rankRecommendations, chatWithBill } from '../services/ai/index.js';
import { getUsage, estimateCostUsd } from '../services/ai/usage.js';
import { httpError } from '../services/ai/errors.js';

const router = Router();
router.use(requireAuth);

// Sends our own friendly errors (limit reached, bad key, no data) instead of a generic 500.
const guard = (fn) =>
  asyncHandler(async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e.userMessage) return res.status(e.status || 502).json({ error: e.userMessage });
      throw e;
    }
  });

const uid = (req) => String(req.user.id);
const activeRecs = (source) => Recommendation.find({ source, status: { $in: ['new', 'pr_opened'] } }).sort({ monthlySavings: -1 }).lean();

async function loadCosts() {
  const { source, daily } = await getDailyCosts(30);
  return { source, daily, anomalies: findAnomalies(daily) };
}

router.get('/status', asyncHandler(async (req, res) => {
  const usage = await getUsage(uid(req));
  res.json({ mode: aiMode(), model: aiMode() === 'claude' ? aiModel() : null, ...usage, estimatedCostUsd: estimateCostUsd(usage) });
}));

router.post('/explain', guard(async (req, res) => {
  const date = String(req.body?.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw httpError(400, 'Send a date like 2026-11-13.');
  const { source, daily } = await loadCosts();
  const out = await explainSpend({ userId: uid(req), source, daily, date });
  res.json({ date, ...out });
}));

router.post('/rank', guard(async (req, res) => {
  const items = await activeRecs(costSource());
  if (items.length === 0) throw httpError(400, 'There is nothing to rank yet. Run a scan on the Savings tab first.');
  const out = await rankRecommendations({ userId: uid(req), items });
  await Recommendation.bulkWrite(
    out.ranked.map((r) => ({
      updateOne: { filter: { _id: r._id }, update: { $set: { aiPriority: r.priority, aiRisk: r.risk, aiEffort: r.effort, aiReason: r.reason, aiRankedAt: new Date() } } },
    }))
  );
  res.json({ mode: out.mode, headline: out.headline, ranked: out.ranked.length });
}));

router.post('/chat', guard(async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question || question.length > 500) throw httpError(400, 'Ask a question of up to 500 characters.');
  const userId = uid(req);
  const { source, daily, anomalies } = await loadCosts();
  const recs = await activeRecs(source);
  const history = await ChatMessage.find({ userId }).sort({ createdAt: -1 }).limit(6).lean();
  history.reverse();

  const out = await chatWithBill({ userId, question, source, daily, anomalies, recs, history });
  await ChatMessage.create({ userId, role: 'user', content: question, mode: out.mode });
  await ChatMessage.create({ userId, role: 'assistant', content: out.answer, mode: out.mode });
  res.json({ mode: out.mode, answer: out.answer });
}));

router.get('/chat', asyncHandler(async (req, res) => {
  const items = await ChatMessage.find({ userId: uid(req) }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ items: items.reverse().map((m) => ({ role: m.role, content: m.content, mode: m.mode })) });
}));

router.delete('/chat', asyncHandler(async (req, res) => {
  await ChatMessage.deleteMany({ userId: uid(req) });
  res.json({ ok: true });
}));

export default router;
