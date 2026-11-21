import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Recommendation from '../models/Recommendation.js';
import { runScanners } from '../services/scanner.js';

const router = Router();
router.use(requireAuth);

const ownerOf = (req) => String(req.user?.id ?? req.user?._id ?? req.user?.sub ?? req.user?.email ?? 'anonymous');
const round = (n) => Math.round(n * 100) / 100;

function shape(doc) {
  const o = doc.toObject();
  return {
    id: String(o._id),
    _id: String(o._id),
    type: o.type,
    resource: o.resource,
    region: o.region,
    title: o.title,
    detail: o.detail,
    description: o.detail,
    monthlySavings: o.monthlySavings,
    status: o.status,
    createdAt: o.createdAt,
  };
}

async function listOpen(owner) {
  const docs = await Recommendation.find({ owner, status: 'open' }).sort({ monthlySavings: -1 });
  const items = docs.map(shape);
  return {
    count: items.length,
    totalMonthlySavings: round(items.reduce((s, r) => s + r.monthlySavings, 0)),
    items,
    recommendations: items,
  };
}

router.get('/recommendations', async (req, res, next) => {
  try {
    res.json(await listOpen(ownerOf(req)));
  } catch (e) { next(e); }
});

router.post('/scan', async (req, res, next) => {
  try {
    const owner = ownerOf(req);
    const { findings, errors } = await runScanners();
    const dismissed = new Set((await Recommendation.find({ owner, status: 'dismissed' })).map((d) => d.resource));
    const fresh = findings.filter((f) => !dismissed.has(f.resource));
    await Recommendation.deleteMany({ owner, status: 'open' });
    if (fresh.length) await Recommendation.insertMany(fresh.map((f) => ({ ...f, owner })));
    const totalMonthlySavings = round(fresh.reduce((s, f) => s + f.monthlySavings, 0));
    res.json({ found: fresh.length, totalMonthlySavings, errors });
  } catch (e) { next(e); }
});

router.patch('/recommendations/:id', async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!['open', 'dismissed'].includes(status)) return res.status(400).json({ error: 'Status must be open or dismissed.' });
    const doc = await Recommendation.findOneAndUpdate({ _id: req.params.id, owner: ownerOf(req) }, { status }, { new: true });
    if (!doc) return res.status(404).json({ error: 'That recommendation was not found.' });
    res.json(shape(doc));
  } catch (e) {
    if (e.name === 'CastError') return res.status(404).json({ error: 'That recommendation was not found.' });
    next(e);
  }
});

export default router;