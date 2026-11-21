import { DescribeVolumesCommand } from '@aws-sdk/client-ec2';

// Rough USD per GB-month. These are estimates; real prices vary by region.
const RATE = { gp3: 0.08, gp2: 0.1, io1: 0.125, io2: 0.125, st1: 0.045, sc1: 0.015, standard: 0.05 };
const round = (n) => Math.round(n * 100) / 100;

export async function scanEbs({ ec2, region }) {
  const out = [];
  let token;
  do {
    const res = await ec2.send(
      new DescribeVolumesCommand({ Filters: [{ Name: 'status', Values: ['available'] }], NextToken: token })
    );
    for (const v of res.Volumes || []) {
      if (v.State && v.State !== 'available') continue;
      const rate = RATE[v.VolumeType] ?? 0.1;
      out.push({
        type: 'unattached_ebs',
        resourceId: v.VolumeId,
        region,
        title: `Unattached ${v.VolumeType} volume, ${v.Size} GB`,
        detail: 'Not attached to any instance. Snapshot it if you need the data, then delete it.',
        monthlySavings: round(v.Size * rate),
      });
    }
    token = res.NextToken;
  } while (token);
  return out;
}
