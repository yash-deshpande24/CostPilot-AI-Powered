import test from 'node:test';
import assert from 'node:assert/strict';
import { toDaily, fetchAwsDailyCosts } from '../services/awsCost.js';

const group = (name, amount) => ({ Keys: [name], Metrics: { UnblendedCost: { Amount: String(amount) } } });

test('toDaily gives every day every service and friendly names', () => {
  const daily = toDaily([
    { TimePeriod: { Start: '2026-01-01' }, Groups: [group('Amazon Elastic Compute Cloud - Compute', 10.123), group('AmazonCloudWatch', 1)] },
    { TimePeriod: { Start: '2026-01-02' }, Groups: [group('Amazon Elastic Compute Cloud - Compute', 5)] },
    { TimePeriod: { Start: '2026-01-03' }, Groups: [] },
  ]);
  assert.equal(daily.length, 3);
  assert.equal(daily[0].byService['Amazon EC2'], 10.12);
  assert.equal(daily[1].byService['CloudWatch'], 0);
  assert.equal(daily[2].total, 0);
  assert.equal(daily[0].total, 11.12);
});

test('negative amounts are clamped to zero', () => {
  const daily = toDaily([{ TimePeriod: { Start: '2026-01-01' }, Groups: [group('Amazon S3', -4)] }]);
  assert.equal(daily[0].total, 0);
});

test('fetchAwsDailyCosts follows pagination and excludes credits', async () => {
  const calls = [];
  const client = {
    async send(cmd) {
      calls.push(cmd.input);
      if (!cmd.input.NextPageToken) {
        return { ResultsByTime: [{ TimePeriod: { Start: '2026-01-01' }, Groups: [group('Amazon S3', 2)] }], NextPageToken: 'p2' };
      }
      return { ResultsByTime: [{ TimePeriod: { Start: '2026-01-02' }, Groups: [group('Amazon S3', 3)] }] };
    },
  };
  const daily = await fetchAwsDailyCosts(14, client);
  assert.equal(calls.length, 2);
  assert.equal(daily.length, 2);
  assert.equal(calls[0].Granularity, 'DAILY');
  assert.deepEqual(calls[0].Filter.Not.Dimensions.Values, ['Credit', 'Refund']);
});
