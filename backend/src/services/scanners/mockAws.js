// Fake AWS clients with the same send(command) shape as the real SDK clients.
// The scanners run unchanged against them, so mock mode exercises the real scanner code.
const days = (n) => Array.from({ length: n }, (_, i) => i);

export const fakeEc2 = {
  async send(cmd) {
    switch (cmd.constructor.name) {
      case 'DescribeVolumesCommand':
        return {
          Volumes: [
            { VolumeId: 'vol-0a1b2c3d4e5f60001', Size: 200, VolumeType: 'gp3', State: 'available' },
            { VolumeId: 'vol-0a1b2c3d4e5f60002', Size: 500, VolumeType: 'gp2', State: 'available' },
            { VolumeId: 'vol-0a1b2c3d4e5f60003', Size: 100, VolumeType: 'st1', State: 'available' },
          ],
        };
      case 'DescribeAddressesCommand':
        return {
          Addresses: [
            { PublicIp: '13.233.10.21', AllocationId: 'eipalloc-0aa11' }, // not attached
            { PublicIp: '13.233.10.22', AllocationId: 'eipalloc-0bb22' }, // not attached
            { PublicIp: '13.233.10.23', AllocationId: 'eipalloc-0cc33', AssociationId: 'eipassoc-0dd44' }, // in use
          ],
        };
      case 'DescribeInstancesCommand':
        return {
          Reservations: [
            {
              Instances: [
                { InstanceId: 'i-0idle000000000001', InstanceType: 'm5.xlarge', Tags: [{ Key: 'Name', Value: 'old-batch-worker' }] },
                { InstanceId: 'i-0idle000000000002', InstanceType: 't3.large', Tags: [{ Key: 'Name', Value: 'staging-api' }] },
                { InstanceId: 'i-0busy00000000003', InstanceType: 'm5.large', Tags: [{ Key: 'Name', Value: 'prod-api' }] },
              ],
            },
          ],
        };
      default:
        throw new Error(`fakeEc2 does not support ${cmd.constructor.name}`);
    }
  },
};

export const fakeCloudWatch = {
  async send(cmd) {
    if (cmd.constructor.name !== 'GetMetricStatisticsCommand') {
      throw new Error(`fakeCloudWatch does not support ${cmd.constructor.name}`);
    }
    const id = cmd.input.Dimensions[0].Value;
    const busy = id.includes('busy');
    return {
      Datapoints: days(14).map((i) => ({
        Average: busy ? 38 + (i % 5) : 1.5 + (i % 3) * 0.4,
        Maximum: busy ? 71 : 4.8,
      })),
    };
  },
};
