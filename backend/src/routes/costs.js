import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDailyCosts } from '../services/costSource.js';
import { findAnomalies } from '../services/anomaly.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 14), 90);
  try {
    const { source, daily, cached, fetchedAt } = await getDailyCosts(days);

    const totals = {};
    for (const d of daily) {
      for (const [s, v] of Object.entries(d.byService)) totals[s] = (totals[s] || 0) + v;
    }
    const byService = Object.entries(totals)
      .map(([service, amount]) => ({ service, amount: Math.round(amount * 100) / 100 }))
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const total = Math.round(daily.reduce((s, d) => s + d.total, 0) * 100) / 100;

    res.json({
      source,
      cached: Boolean(cached),
      fetchedAt: fetchedAt || null,
      days,
      total,
      dailyAverage: daily.length ? Math.round((total / daily.length) * 100) / 100 : 0,
      daily,
      byService,
      anomalies: findAnomalies(daily),
    });
  } catch (e) {
    console.error('Cost fetch failed:', e);
    res.status(502).json({
      error: 'Could not read costs from AWS. Check your AWS keys, region and permissions.',
      detail: e.message,
    });
  }
});

export default router;
