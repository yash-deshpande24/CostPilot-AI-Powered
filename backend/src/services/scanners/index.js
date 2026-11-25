import { EC2Client } from '@aws-sdk/client-ec2';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { fakeEc2, fakeCloudWatch } from './mockAws.js';
import { scanEbs } from './ebs.js';
import { scanEip } from './eip.js';
import { scanIdleEc2 } from './ec2Idle.js';

const SCANNERS = [
  { name: 'ebs', type: 'unattached_ebs', run: scanEbs },
  { name: 'eip', type: 'unattached_eip', run: scanEip },
  { name: 'ec2_idle', type: 'idle_ec2', run: scanIdleEc2 },
];

// One scanner failing (for example a missing permission) must not hide the others.
export async function runScanners({ source, region }) {
  const mock = source === 'mock';
  const ec2 = mock ? fakeEc2 : new EC2Client({ region });
  const cloudwatch = mock ? fakeCloudWatch : new CloudWatchClient({ region });

  const findings = [];
  const errors = [];
  const scannedTypes = [];
  for (const s of SCANNERS) {
    try {
      findings.push(...(await s.run({ ec2, cloudwatch, region })));
      scannedTypes.push(s.type);
    } catch (e) {
      errors.push({ scanner: s.name, message: e.message });
    }
  }
  return { findings, errors, scannedTypes, scannerCount: SCANNERS.length };
}
