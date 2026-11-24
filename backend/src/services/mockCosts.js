// Deterministic fake AWS bill so the UI works before a real AWS account is connected.
// Every day gets its own seed, so a date always has the same numbers whatever range is asked for.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromDate(iso) {
  let h = 2166136261;
  for (const c of iso) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const SERVICES = {
  'Amazon EC2': 62,
  'Amazon EKS': 24,
  'Amazon RDS': 31,
  'Amazon S3': 9,
  'Data Transfer': 14,
  'CloudWatch': 7,
};

const isoDay = (d) => d.toISOString().slice(0, 10);

// from and to are YYYY-MM-DD and both included.
export function generateCostsBetween(from, to) {
  const spike = new Date();
  spike.setUTCDate(spike.getUTCDate() - 8); // one unusual day, 8 days ago
  const spikeDate = isoDay(spike);

  const out = [];
  const d = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = isoDay(d);
    const rand = mulberry32(seedFromDate(date));
    const weekend = [0, 6].includes(d.getUTCDay()) ? 0.82 : 1;
    const byService = {};
    for (const [name, base] of Object.entries(SERVICES)) {
      let v = base * weekend * (0.93 + rand() * 0.14);
      if (date === spikeDate && name === 'Amazon EC2') v *= 1.9;
      if (date === spikeDate && name === 'Data Transfer') v *= 3.1;
      byService[name] = Math.round(v * 100) / 100;
    }
    const total = Math.round(Object.values(byService).reduce((a, b) => a + b, 0) * 100) / 100;
    out.push({ date, total, byService });
  }
  return out;
}

// The last "days" days, ending today.
export function generateDailyCosts(days = 30) {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(to.getUTCDate() - (days - 1));
  return generateCostsBetween(isoDay(from), isoDay(to));
}
