import { DescribeAddressesCommand } from '@aws-sdk/client-ec2';

const EIP_MONTHLY = 3.65; // about $0.005 per hour

export async function scanEip({ ec2, region }) {
  const res = await ec2.send(new DescribeAddressesCommand({}));
  return (res.Addresses || [])
    .filter((a) => !a.AssociationId)
    .map((a) => ({
      type: 'unattached_eip',
      resourceId: a.AllocationId || a.PublicIp,
      region,
      title: `Unused Elastic IP ${a.PublicIp}`,
      detail: 'Not associated with any instance or network interface. Release it to stop the charge.',
      monthlySavings: EIP_MONTHLY,
    }));
}
