// Sample scanner. With no AWS credentials it returns realistic findings.
// Swap runScanners() for real AWS SDK checks later; keep the return shape.
const POOL = [
  { type: 'idle-ec2', resource: 'i-0a1b2c3d4e5f60718', title: 'Idle EC2 instance (m5.large)', detail: 'CPU stayed under 3% for the last 14 days.', monthlySavings: 69.12 },
  { type: 'unattached-ebs', resource: 'vol-0f9e8d7c6b5a40312', title: 'Unattached EBS volume (500 GB gp3)', detail: 'Not attached to any instance for 21 days.', monthlySavings: 40.0 },
  { type: 'unused-eip', resource: 'eipalloc-0123abcd4567ef89', title: 'Unused Elastic IP', detail: 'Allocated but not associated with a running instance.', monthlySavings: 3.65 },
  { type: 'old-snapshots', resource: 'snap-0b7a6c5d4e3f21098', title: 'Old EBS snapshots (12 found)', detail: 'Snapshots older than 180 days with no linked AMI.', monthlySavings: 18.4 },
  { type: 'idle-rds', resource: 'db-costpilot-staging', title: 'Idle RDS database (db.t3.medium)', detail: 'No connections in the last 10 days.', monthlySavings: 52.56 },
  { type: 'oversized-nat', resource: 'nat-0c4d5e6f7a8b9c0d1', title: 'NAT gateway with almost no traffic', detail: 'Under 1 GB processed in 30 days.', monthlySavings: 32.4 },
];

export async function runScanners() {
  const findings = POOL.map((f) => ({ ...f, region: 'us-east-1' }));
  return { findings, errors: [] }; // errors: [{ scanner, message }] for scanners that fail
}