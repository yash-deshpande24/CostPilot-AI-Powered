// Free sample answers built from the user's own numbers. Used when no ANTHROPIC_API_KEY is set.
import { usd } from './fmt.js';

const CAUSES = {
  'Amazon EC2': ['More or larger instances were running than usual (possible cause: an autoscaling event, a batch job or a forgotten test instance).'],
  'Data Transfer': ['A large download, backup or cross-region copy (possible cause: data leaving AWS or moving between regions).'],
  'Amazon RDS': ['A bigger database instance, a storage jump or a new read replica (possible cause).'],
  'Amazon S3': ['A burst of requests or a large upload (possible cause: a new data pipeline or a backup job).'],
  'Amazon EKS': ['More worker nodes joined the cluster (possible cause: a scale-up or a stuck deployment).'],
};

export function mockExplain(d) {
  const top = d.biggestIncreases[0];
  const up = d.extra !== null && d.extra > 0;
  const summary = d.expectedTotal === null
    ? `Spend on ${d.date} was ${usd(d.total)}. There are no earlier days to compare it with.`
    : `On ${d.weekday} ${d.date} spend was ${usd(d.total)} against about ${usd(d.expectedTotal)} on a usual day, which is ${usd(Math.abs(d.extra))} ${up ? 'more' : 'less'}.` +
      (top && up ? ` ${top.service} added the most, about ${usd(top.extra)} above its normal level.` : '');
  return {
    summary,
    likely_causes: (up ? d.biggestIncreases.filter((s) => s.extra > 0).slice(0, 3) : []).flatMap((s) => CAUSES[s.service] || [`${s.service} cost more than usual (possible cause: a change in usage).`]),
    what_to_check: [
      'In Cost Explorer, group this day by "Usage type" to see exactly what grew.',
      'In CloudTrail, look for RunInstances, CreateDBInstance or large copy events on this date.',
      'Compare the same service on the days before and after to see if it was a one-off.',
    ],
    confidence: 'low',
  };
}

const PROFILE = {
  idle_ec2: { risk: 'medium', effort: 'hours', why: 'Stop or resize it after checking nothing depends on it.' },
  unattached_ebs: { risk: 'low', effort: 'minutes', why: 'Take a snapshot, then delete the volume.' },
  unattached_eip: { risk: 'low', effort: 'minutes', why: 'Release the address if nothing points to it.' },
};

export function mockRank(items) {
  const ordered = [...items].sort((a, b) => b.monthlySavings - a.monthlySavings);
  const total = items.reduce((s, i) => s + i.monthlySavings, 0);
  return {
    headline: ordered.length ? `Start with ${ordered[0].title.toLowerCase()}; all ${items.length} items are worth about ${usd(total)} a month.` : 'Nothing to rank.',
    rankings: ordered.map((r, i) => {
      const p = PROFILE[r.type] || { risk: 'medium', effort: 'hours', why: 'Review it before changing anything.' };
      return { id: r.id, priority: i + 1, risk: p.risk, effort: p.effort, reason: `Saves about ${usd(r.monthlySavings)} a month. ${p.why}` };
    }),
  };
}

export function mockChat(question, s) {
  const q = question.toLowerCase();
  const top = s.byService[0];
  const spike = s.unusualDays[0];
  if (/spike|jump|unusual|increase|why|anomal/.test(q)) {
    return spike
      ? `The odd day was ${spike.date}: spend hit ${usd(spike.spend)} against about ${usd(spike.expected)} expected. ${spike.topDriver} added roughly ${usd(spike.extraFromDriver)} of that. Open the Overview tab and choose "Explain this" on that day for next steps.`
      : 'No day in this period stood out. Spend stayed within 35% of the previous week every day.';
  }
  if (/save|waste|cut|reduce|cheaper/.test(q)) {
    if (!s.wasteFindings.length) return 'No waste has been found yet. Open the Savings tab and choose Scan now.';
    const list = s.wasteFindings.slice(0, 3).map((w) => `${w.title} (${usd(w.monthlySavings)}/mo)`).join('; ');
    return `The scans found about ${usd(s.totalPotentialMonthlySavings)} a month of waste. The biggest items: ${list}.`;
  }
  if (/most|top|biggest|expensive|costs? the/.test(q) && /service|cost|expensive|most|biggest/.test(q) && !/week|day of/.test(q)) {
    return `${top.service} costs the most at ${usd(top.total)} over ${s.period.days} days, which is ${Math.round((top.total / s.totalSpend) * 100)}% of the bill.`;
  }
  if (/weekday|day of the week|busiest|which day/.test(q)) {
    return `${s.busiestWeekday.day} is the most expensive day of the week, at about ${usd(s.busiestWeekday.averageSpend)} on average.`;
  }
  if (/total|how much|spend|bill|average/.test(q)) {
    return `Spend was ${usd(s.totalSpend)} from ${s.period.from} to ${s.period.to}, about ${usd(s.dailyAverage)} a day.`;
  }
  return 'I can answer questions about total spend, which service costs the most, unusual days, the busiest weekday and what you could save. Try one of the suggestions above.';
}
