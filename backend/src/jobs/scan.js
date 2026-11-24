// Runs every waste scanner once and saves the findings. The Kubernetes CronJob runs this daily:
//   node src/jobs/scan.js
// Exit code 0 means the job worked. Exit code 1 means every scanner failed.
import 'dotenv/config';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { connectDB } from '../config/db.js';
import { costSource } from '../services/costSource.js';
import { runScanners } from '../services/scanners/index.js';
import { saveScanResults } from '../services/recommendations.js';

export async function runScanJob({
  connect = connectDB,
  disconnect = () => mongoose.disconnect(),
  scan = runScanners,
  save = saveScanResults,
  log = console.log,
} = {}) {
  const source = costSource();
  const region = process.env.AWS_REGION || 'ap-south-1';
  const startedAt = new Date();

  await connect();
  try {
    const { findings, errors, scannedTypes, scannerCount } = await scan({ source, region });
    const saved = await save({ source, findings, scannedTypes, startedAt });
    const total = findings.reduce((s, f) => s + f.monthlySavings, 0);
    // One JSON line per run, so Datadog can read it in Week 7.
    log(JSON.stringify({
      event: 'scan_job',
      source,
      found: findings.length,
      totalMonthlySavings: Math.round(total * 100) / 100,
      ...saved,
      failedScanners: errors.map((e) => e.scanner),
      durationMs: Date.now() - startedAt.getTime(),
    }));
    return errors.length === scannerCount ? 1 : 0;
  } finally {
    await disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runScanJob()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(JSON.stringify({ event: 'scan_job_failed', message: e.message }));
      process.exit(1);
    });
}
