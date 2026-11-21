import { DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';

// Rough on-demand Linux USD per month (730 hours). Estimates only.
const MONTHLY = {
  't2.micro': 8.47, 't3.micro': 7.59, 't3.small': 15.18, 't3.medium': 30.37, 't3.large': 60.74,
  't3.xlarge': 121.47, 't4g.micro': 6.13, 't4g.small': 12.26, 'm5.large': 70.08, 'm5.xlarge': 140.16,
  'm5.2xlarge': 280.32, 'c5.large': 62.05, 'c5.xlarge': 124.1, 'r5.large': 91.98, 'r5.xlarge': 183.96,
};
const FALLBACK = 30;
const round = (n) => Math.round(n * 100) / 100;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const IDLE_AVG_CPU = 5; // percent
const IDLE_PEAK_CPU = 20; // percent
const LOOKBACK_DAYS = 14;
const MIN_DATAPOINTS = 7;

export async function scanIdleEc2({ ec2, cloudwatch, region }) {
  const instances = [];
  let token;
  do {
    const res = await ec2.send(
      new DescribeInstancesCommand({
        Filters: [{ Name: 'instance-state-name', Values: ['running'] }],
        NextToken: token,
      })
    );
    for (const r of res.Reservations || []) instances.push(...(r.Instances || []));
    token = res.NextToken;
  } while (token);

  const out = [];
  const end = new Date();
  const start = new Date(end.getTime() - LOOKBACK_DAYS * 86400 * 1000);

  for (const inst of instances) {
    const stats = await cloudwatch.send(
      new GetMetricStatisticsCommand({
        Namespace: 'AWS/EC2',
        MetricName: 'CPUUtilization',
        Dimensions: [{ Name: 'InstanceId', Value: inst.InstanceId }],
        StartTime: start,
        EndTime: end,
        Period: 86400,
        Statistics: ['Average', 'Maximum'],
      })
    );
    const points = stats.Datapoints || [];
    if (points.length < MIN_DATAPOINTS) continue; // too new to judge

    const avg = mean(points.map((p) => p.Average));
    const peak = Math.max(...points.map((p) => p.Maximum));
    if (avg >= IDLE_AVG_CPU || peak >= IDLE_PEAK_CPU) continue;

    const name = (inst.Tags || []).find((t) => t.Key === 'Name')?.Value;
    const known = inst.InstanceType in MONTHLY;
    out.push({
      type: 'idle_ec2',
      resourceId: inst.InstanceId,
      region,
      title: `Idle ${inst.InstanceType} instance${name ? ` "${name}"` : ''}`,
      detail:
        `Average CPU ${round(avg)}% and peak ${round(peak)}% over ${LOOKBACK_DAYS} days. ` +
        `Stop it or move to a smaller size.${known ? '' : ' Price is a rough guess for this type.'}`,
      monthlySavings: MONTHLY[inst.InstanceType] ?? FALLBACK,
    });
  }
  return out;
}
