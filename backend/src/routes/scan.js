import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { costSource } from '../services/costSource.js';
import { runScanners } from '../services/scanners/index.js';
import { saveScanResults } from '../services/recommendations.js';

const router = Router();
router.use(requireAuth);

router.post('/', asyncHandler(async (_req, res) => {
  const source = costSource();
  const region = process.env.AWS_REGION || 'ap-south-1';
  const startedAt = new Date();

  const { findings, errors, scannedTypes, scannerCount } = await runScanners({ source, region });
  if (errors.length === scannerCount) {
    return res.status(502).json({
      error: 'Every scanner failed. Check your AWS keys and permissions.',
      errors,
    });
  }
  const saved = await saveScanResults({ source, findings, scannedTypes, startedAt });
  const total = findings.reduce((s, f) => s + f.monthlySavings, 0);

  res.json({
    source,
    found: findings.length,
    totalMonthlySavings: Math.round(total * 100) / 100,
    ...saved,
    errors,
  });
}));

export default router;
