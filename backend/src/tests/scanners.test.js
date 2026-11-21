import test from 'node:test';
import assert from 'node:assert/strict';
import { runScanners } from '../services/scanners/index.js';

test('mock scan finds the planted waste and skips healthy resources', async () => {
  const { findings, errors, scannedTypes } = await runScanners({ source: 'mock', region: 'ap-south-1' });
  assert.deepEqual(errors, []);
  assert.equal(scannedTypes.length, 3);

  const by = (t) => findings.filter((f) => f.type === t);
  assert.equal(by('unattached_ebs').length, 3);
  assert.equal(by('unattached_eip').length, 2); // the attached one is skipped
  assert.equal(by('idle_ec2').length, 2); // the busy one is skipped
  assert.ok(!findings.some((f) => f.resourceId === 'i-0busy00000000003'));
  assert.ok(!findings.some((f) => f.resourceId === 'eipalloc-0cc33'));
});

test('savings estimates are positive and EBS is size times rate', async () => {
  const { findings } = await runScanners({ source: 'mock', region: 'ap-south-1' });
  assert.ok(findings.every((f) => f.monthlySavings > 0));
  const gp3 = findings.find((f) => f.resourceId === 'vol-0a1b2c3d4e5f60001');
  assert.equal(gp3.monthlySavings, 16); // 200 GB * $0.08
});
