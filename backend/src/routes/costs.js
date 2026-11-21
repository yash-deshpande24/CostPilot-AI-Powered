import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generateDailyCosts, generateCostsBetween } from '../services/mockCosts.js';
import { findAnomalies } from '../services/anomaly.js';

const router = Router();
router.use(requireAuth);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;

router.get('/', (req, res) => {
  const { from, to } = req.query;
  let daily;
  let days;

  if (from || to) {
    if (!DATE.test(from || '') || !DATE.test(to || '') || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
      return res.status(400).json({ error: 'Use dates like 2026-10-23 for from and to.' });
    }
    if (from > to) return res.status(400).json({ error: 'The start date must be before the end date.' });
    days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
    if (days > MAX_RANGE_DAYS) return res.status(400).json({ error: `Pick a range of ${MAX_RANGE_DAYS} days or less.` });
    daily = generateCostsBetween(from, to);
  } else {
    days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 14), 90);
    daily = generateDailyCosts(days);
  }

  const totals = {};
  for (const d of daily) {
    for (const [s, v] of Object.entries(d.byService)) totals[s] = (totals[s] || 0) + v;
  }
  const byService = Object.entries(totals)
    .map(([service, amount]) => ({ service, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
  const total = Math.round(daily.reduce((s, d) => s + d.total, 0) * 100) / 100;

  res.json({
    source: 'mock',
    days,
    from: daily[0]?.date,
    to: daily[daily.length - 1]?.date,
    total,
    dailyAverage: Math.round((total / days) * 100) / 100,
    daily,
    byService,
    anomalies: findAnomalies(daily),
  });
});

export default router;