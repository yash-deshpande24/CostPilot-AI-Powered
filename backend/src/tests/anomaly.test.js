import test from 'node:test';
import assert from 'node:assert/strict';
import { findAnomalies } from '../services/anomaly.js';

const day = (i, ec2, s3) => ({
  date: `2026-01-${String(i + 1).padStart(2, '0')}`,
  total: ec2 + s3,
  byService: { EC2: ec2, S3: s3 },
});

test('flags a day that is 35% above the previous week', () => {
  const daily = Array.from({ length: 10 }, (_, i) => day(i, 100, 10));
  daily[9] = day(9, 200, 10);
  const out = findAnomalies(daily);
  assert.equal(out.length, 1);
  assert.equal(out[0].topDriver, 'EC2');
});

test('flat spend has no anomalies', () => {
  const daily = Array.from({ length: 14 }, (_, i) => day(i, 100, 10));
  assert.equal(findAnomalies(daily).length, 0);
});
