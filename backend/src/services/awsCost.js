import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';

const round = (n) => Math.round(n * 100) / 100;
const isoDay = (d) => d.toISOString().slice(0, 10);

const FRIENDLY = {
  'Amazon Elastic Compute Cloud - Compute': 'Amazon EC2',
  'EC2 - Other': 'EC2 - Other',
  'Amazon Relational Database Service': 'Amazon RDS',
  'Amazon Simple Storage Service': 'Amazon S3',
  'Amazon Elastic Kubernetes Service': 'Amazon EKS',
  'AmazonCloudWatch': 'CloudWatch',
  'Amazon Virtual Private Cloud': 'Amazon VPC',
  'Amazon Elastic Load Balancing': 'Load Balancing',
  'Elastic Load Balancing': 'Load Balancing',
};
const friendly = (name) => FRIENDLY[name] || name;

// Turns Cost Explorer's ResultsByTime into the same shape the mock data uses:
// [{ date, total, byService: { 'Amazon EC2': 12.3, ... } }]
export function toDaily(resultsByTime) {
  const services = new Set();
  for (const r of resultsByTime) {
    for (const g of r.Groups || []) services.add(friendly(g.Keys[0]));
  }
  return resultsByTime.map((r) => {
    const byService = {};
    for (const s of services) byService[s] = 0; // every day has every service (the anomaly code needs that)
    for (const g of r.Groups || []) {
      const name = friendly(g.Keys[0]);
      const amount = parseFloat(g.Metrics?.UnblendedCost?.Amount || '0');
      byService[name] = round(byService[name] + Math.max(0, amount));
    }
    const total = round(Object.values(byService).reduce((a, b) => a + b, 0));
    return { date: r.TimePeriod.Start, total, byService };
  });
}

// Cost Explorer is only served from us-east-1, whatever region your resources are in.
export async function fetchAwsDailyCosts(days, client = new CostExplorerClient({ region: 'us-east-1' })) {
  const end = new Date(); // End is exclusive, so this covers up to yesterday
  const start = new Date();
  start.setUTCDate(end.getUTCDate() - days);

  const results = [];
  let token;
  do {
    const res = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: isoDay(start), End: isoDay(end) },
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        Filter: { Not: { Dimensions: { Key: 'RECORD_TYPE', Values: ['Credit', 'Refund'] } } },
        NextPageToken: token,
      })
    );
    results.push(...(res.ResultsByTime || []));
    token = res.NextPageToken;
  } while (token);

  return toDaily(results);
}
