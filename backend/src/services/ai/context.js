// Builds the compact "bill summary" that is given to Claude (or used by the sample answers).
const round = (n) => Math.round(n * 100) / 100;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekdayIndex = (iso) => (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7;

export function buildBillSummary({ source, daily, anomalies, recs }) {
  const totals = {};
  for (const d of daily) for (const [s, v] of Object.entries(d.byService)) totals[s] = (totals[s] || 0) + v;
  const last7 = daily.slice(-7);
  const prev7 = daily.slice(-14, -7);
  const part = (days, s) => round(sum(days.map((d) => d.byService[s] || 0)));

  const byService = Object.entries(totals)
    .map(([service, total]) => {
      const a = part(last7, service);
      const b = part(prev7, service);
      return { service, total: round(total), last7Days: a, previous7Days: b, changePct: b > 0 ? round(((a - b) / b) * 100) : null };
    })
    .filter((s) => s.total > 0)
    .sort((x, y) => y.total - x.total);

  const wsum = Array(7).fill(0);
  const wn = Array(7).fill(0);
  for (const d of daily) { const i = weekdayIndex(d.date); wsum[i] += d.total; wn[i]++; }
  const wavg = wsum.map((s, i) => (wn[i] ? s / wn[i] : 0));
  const best = wavg.indexOf(Math.max(...wavg));

  const total = round(sum(daily.map((d) => d.total)));
  return {
    currency: 'USD',
    dataSource: source === 'aws' ? 'real AWS Cost Explorer data' : 'sample data',
    period: { from: daily[0]?.date, to: daily[daily.length - 1]?.date, days: daily.length },
    totalSpend: total,
    dailyAverage: daily.length ? round(total / daily.length) : 0,
    byService,
    unusualDays: anomalies.map((a) => ({ date: a.date, spend: a.total, expected: a.expected, topDriver: a.topDriver, extraFromDriver: a.extraSpend })),
    busiestWeekday: { day: WEEKDAYS[best], averageSpend: round(wavg[best]) },
    wasteFindings: recs.map((r) => ({ title: r.title, type: r.type, resourceId: r.resourceId, monthlySavings: r.monthlySavings, status: r.status })),
    totalPotentialMonthlySavings: round(sum(recs.map((r) => r.monthlySavings))),
  };
}

// What one day looked like compared with the 7 days before it.
export function buildDayDetail(daily, date) {
  const i = daily.findIndex((d) => d.date === date);
  if (i < 0) return null;
  const day = daily[i];
  const prev = daily.slice(Math.max(0, i - 7), i);
  const usual = (s) => (prev.length ? sum(prev.map((d) => d.byService[s] || 0)) / prev.length : null);
  const services = Object.entries(day.byService).map(([service, amount]) => {
    const u = usual(service);
    return { service, amount: round(amount), usual: u === null ? null : round(u), extra: u === null ? 0 : round(amount - u) };
  });
  const expected = prev.length ? round(sum(prev.map((d) => d.total)) / prev.length) : null;
  return {
    date,
    weekday: WEEKDAYS[weekdayIndex(date)],
    total: day.total,
    expectedTotal: expected,
    extra: expected === null ? null : round(day.total - expected),
    biggestIncreases: [...services].sort((a, b) => b.extra - a.extra).slice(0, 4),
    allServices: services.filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount),
  };
}
