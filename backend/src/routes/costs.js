import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generateDailyCosts } from '../services/mockCosts.js';
import { findAnomalies } from '../services/anomaly.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 14), 90);
  const daily = generateDailyCosts(days);
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
    total,
    dailyAverage: Math.round((total / days) * 100) / 100,
    daily,
    byService,
    anomalies: findAnomalies(daily),
  });
});

export default router;
