import { Router } from 'express';
const router = Router();
router.get('/', (_req, res) => res.json({
  items: [
    { id: 'sample-1', title: 'Review idle resources', status: 'sample', estimatedMonthlySavings: null }
  ],
  note: 'Sample recommendation only; connect inventory and pricing data before acting.'
}));
export default router;
