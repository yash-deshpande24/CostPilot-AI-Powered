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

const round2 = (n) => Math.round(n * 100) / 100;

// Last N days ending today (unchanged behaviour).
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
      byService[name] = round2(v);
    }
    const total = round2(Object.values(byService).reduce((a, b) => a + b, 0));
    out.push({ date: d.toISOString().slice(0, 10), total, byService });
  }
  return out;
}

// Any date range, "YYYY-MM-DD" to "YYYY-MM-DD" (inclusive).
// Each day is seeded by its own date, so a day shows the same numbers
// no matter which range you ask for. Days after today are marked projected.
export function generateCostsBetween(from, to) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const today = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const out = [];
  for (let t = start; t <= end; t += 86400000) {
    const d = new Date(t);
    const epochDay = t / 86400000;
    const rand = mulberry32(epochDay * 7919);
    const weekend = [0, 6].includes(d.getUTCDay()) ? 0.82 : 1;
    const spike = epochDay % 29 === 0;
    const byService = {};
    for (const [name, base] of Object.entries(SERVICES)) {
      let v = base * weekend * (0.93 + rand() * 0.14);
      if (spike && name === 'Amazon EC2') v *= 1.9;
      if (spike && name === 'Data Transfer') v *= 3.1;
      byService[name] = round2(v);
    }
    const total = round2(Object.values(byService).reduce((a, b) => a + b, 0));
    out.push({ date: d.toISOString().slice(0, 10), total, byService, projected: t > today });
  }
  return out;
}