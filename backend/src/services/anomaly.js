// A day is an anomaly when it is more than 35% above the average of the previous 7 days.
export function findAnomalies(daily, threshold = 1.35) {
  const anomalies = [];
  for (let i = 7; i < daily.length; i++) {
    const prev = daily.slice(i - 7, i);
    const avg = prev.reduce((s, d) => s + d.total, 0) / 7;
    if (daily[i].total > avg * threshold) {
      const culprit = Object.entries(daily[i].byService)
        .map(([service, amount]) => {
          const prevAvg = prev.reduce((s, d) => s + d.byService[service], 0) / 7;
          return { service, extra: Math.round((amount - prevAvg) * 100) / 100 };
        })
        .sort((a, b) => b.extra - a.extra)[0];
      anomalies.push({
        date: daily[i].date,
        total: daily[i].total,
        expected: Math.round(avg * 100) / 100,
        topDriver: culprit.service,
        extraSpend: culprit.extra,
      });
    }
  }
  return anomalies;
}
