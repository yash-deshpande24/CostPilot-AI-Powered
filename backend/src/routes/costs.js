import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getDailyCosts } from '../services/costSource.js';
import { generateCostsBetween } from '../services/mockCosts.js';
import { costSource } from '../services/costSource.js';
import { findAnomalies } from '../services/anomaly.js';

const router = Router();
router.use(requireAuth);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const r2 = (n) => Math.round(n * 100) / 100;

router.get('/', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  let result;
  try {
    if (costSource() === 'mock' && ISO.test(from || '') && ISO.test(to || '') && from <= to) {
      const span = (Date.parse(to) - Date.parse(from)) / 86400000;
      if (span > 400) return res.status(400).json({ error: 'Pick a range of 400 days or less.' });
      result = { source: 'mock', daily: generateCostsBetween(from, to), cached: false };
    } else {
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 14), 90);
      result = await getDailyCosts(days);
    }
  } catch (e) {
    console.error('Cost fetch failed:', e);
    return res.status(502).json({ error: 'Could not read costs from AWS. Check your keys, region and permissions.', detail: e.message });
  }

  const { source, daily, cached, fetchedAt } = result;
  const totals = {};
  for (const d of daily) for (const [s, v] of Object.entries(d.byService)) totals[s] = (totals[s] || 0) + v;
  const byService = Object.entries(totals)
    .map(([service, amount]) => ({ service, amount: r2(amount) }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = r2(daily.reduce((s, d) => s + d.total, 0));

  res.json({
    source, cached: Boolean(cached), fetchedAt: fetchedAt || null,
    from: daily[0]?.date || null, to: daily[daily.length - 1]?.date || null,
    days: daily.length, total,
    dailyAverage: daily.length ? r2(total / daily.length) : 0,
    daily, byService, anomalies: findAnomalies(daily),
  });
}));

export default router;