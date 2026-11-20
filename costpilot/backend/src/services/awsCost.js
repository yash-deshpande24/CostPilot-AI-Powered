import { GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import { costExplorer } from '../config/aws.js';
import { env } from '../config/env.js';

export async function getMonthlyCosts({ start, end }) {
  if (env.AWS_COST_EXPLORER_ENABLED !== 'true') {
    return { source: 'sample', currency: 'USD', results: [], message: 'Enable AWS Cost Explorer to retrieve live data.' };
  }
  const response = await costExplorer.send(new GetCostAndUsageCommand({
    TimePeriod: { Start: start, End: end },
    Granularity: 'MONTHLY',
    Metrics: ['UnblendedCost']
  }));
  return {
    source: 'aws',
    results: (response.ResultsByTime ?? []).map((item) => ({
      start: item.TimePeriod?.Start,
      end: item.TimePeriod?.End,
      amount: item.Total?.UnblendedCost?.Amount ?? '0',
      unit: item.Total?.UnblendedCost?.Unit ?? 'USD'
    }))
  };
}
