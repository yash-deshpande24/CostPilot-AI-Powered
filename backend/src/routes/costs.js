import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getDailyCosts, getCostsBetween } from '../services/costSource.js';
import { findAnomalies } from '../services/anomaly.js';

const router = Router();
router.use(requireAuth);
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

// Returns { from, to } for ?from=&to=, null when neither is given, or { error }.
function parseRange(q) {
  if (!q.from && !q.to) return null;
  if (!validDate(q.from) || !validDate(q.to)) return { error: 'Use dates like 2026-11-01 for from and to.' };
  const today = new Date().toISOString().slice(0, 10);
  const to = q.to > today ? today : q.to; // the future has no costs yet
  if (q.from > to) return { error: 'The start date must be on or before the end date.' };
  const span = (Date.parse(to) - Date.parse(q.from)) / 86400000 + 1;
  if (span > 366) return { error: 'Pick a range of 366 days or fewer.' };
  return { from: q.from, to };
}
const r2 = (n) => Math.round(n * 100) / 100;

router.get('/', asyncHandler(async (req, res) => {
  const range = parseRange(req.query);
  if (range?.error) return res.status(400).json({ error: range.error });
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 366);

  let result;
  try {
    result = range ? await getCostsBetween(range.from, range.to) : await getDailyCosts(days);
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