import test from 'node:test';
import assert from 'node:assert/strict';
import { runScanJob } from '../jobs/scan.js';

const base = () => {
  const calls = [];
  return {
    calls,
    connect: async () => calls.push('connect'),
    disconnect: async () => calls.push('disconnect'),
    save: async (a) => { calls.push('save'); return { created: a.findings.length, updated: 0, resolved: 0 }; },
    log: (line) => calls.push('log:' + line),
  };
};

test('scan job saves findings, logs one JSON line and exits 0', async () => {
  const d = base();
  const code = await runScanJob({
    ...d,
    scan: async () => ({ findings: [{ monthlySavings: 10.5 }, { monthlySavings: 4 }], errors: [], scannedTypes: ['idle_ec2'], scannerCount: 3 }),
  });
  assert.equal(code, 0);
  assert.deepEqual(d.calls.slice(0, 2), ['connect', 'save']);
  assert.equal(d.calls.at(-1), 'disconnect');
  const line = JSON.parse(d.calls.find((c) => c.startsWith('log:')).slice(4));
  assert.equal(line.event, 'scan_job');
  assert.equal(line.found, 2);
  assert.equal(line.totalMonthlySavings, 14.5);
});

test('one failed scanner still exits 0 but is reported', async () => {
  const d = base();
  const code = await runScanJob({
    ...d,
    scan: async () => ({ findings: [], errors: [{ scanner: 'ebs', message: 'denied' }], scannedTypes: ['idle_ec2', 'unattached_eip'], scannerCount: 3 }),
  });
  assert.equal(code, 0);
  const line = JSON.parse(d.calls.find((c) => c.startsWith('log:')).slice(4));
  assert.deepEqual(line.failedScanners, ['ebs']);
});

test('every scanner failing exits 1, and the database is still disconnected', async () => {
  const d = base();
  const code = await runScanJob({
    ...d,
    scan: async () => ({ findings: [], errors: [{ scanner: 'a' }, { scanner: 'b' }, { scanner: 'c' }], scannedTypes: [], scannerCount: 3 }),
  });
  assert.equal(code, 1);
  assert.equal(d.calls.at(-1), 'disconnect');
});

test('database is disconnected even when saving throws', async () => {
  const d = base();
  await assert.rejects(runScanJob({
    ...d,
    scan: async () => ({ findings: [], errors: [], scannedTypes: [], scannerCount: 3 }),
    save: async () => { throw new Error('db down'); },
  }), /db down/);
  assert.equal(d.calls.at(-1), 'disconnect');
});
