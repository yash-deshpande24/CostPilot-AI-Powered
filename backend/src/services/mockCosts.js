// Deterministic fake AWS bill so the UI works before a real AWS account is connected.
// Week 2 replaces this with the AWS Cost Explorer client.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SERVICES = {
  'Amazon EC2': 62,
  'Amazon EKS': 24,
  'Amazon RDS': 31,
  'Amazon S3': 9,
  'Data Transfer': 14,
  'CloudWatch': 7,
};

export function generateDailyCosts(days = 30) {
  const rand = mulberry32(42);
  const spikeDay = days - 9;
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const weekend = [0, 6].includes(d.getUTCDay()) ? 0.82 : 1;
    const byService = {};
    for (const [name, base] of Object.entries(SERVICES)) {
      let v = base * weekend * (0.93 + rand() * 0.14);
      if (i === spikeDay && name === 'Amazon EC2') v *= 1.9;
      if (i === spikeDay && name === 'Data Transfer') v *= 3.1;
      byService[name] = Math.round(v * 100) / 100;
    }
    const total = Math.round(Object.values(byService).reduce((a, b) => a + b, 0) * 100) / 100;
    out.push({ date: d.toISOString().slice(0, 10), total, byService });
  }
  return out;
}
