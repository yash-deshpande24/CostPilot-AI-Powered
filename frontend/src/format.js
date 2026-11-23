export const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const usd2 = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const utc = (iso) => new Date(iso + 'T00:00:00Z');
export const shortDate = (iso) => utc(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const longDate = (iso) => utc(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
export const sum = (xs) => xs.reduce((a, b) => a + b, 0);

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const SERVICE_COLORS = ['#6f74e8', '#e9a23b', '#3fb6a8', '#d97aa5', '#8fbf5a', '#e07a5f', '#7aa7d9', '#b79cf0'];
export const OTHER_COLOR = '#8a97a8';

// Month-end projection: spend so far this month plus the last 7 days' average for the days left.
export function forecast(daily) {
  if (daily.length === 0) return null;
  const last = daily[daily.length - 1].date;
  const [y, m, d] = last.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prefix = `${y}-${String(m).padStart(2, '0')}`;
  const mtd = sum(daily.filter((x) => x.date.startsWith(prefix)).map((x) => x.total));
  const recent = daily.slice(-7);
  const rate = sum(recent.map((x) => x.total)) / recent.length;
  const remaining = daysInMonth - d;
  return {
    month: utc(last).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }),
    day: d,
    remaining,
    mtd,
    projected: mtd + rate * remaining,
  };
}

// Average spend for Monday..Sunday.
export function weekdayAverages(daily) {
  const s = Array(7).fill(0);
  const n = Array(7).fill(0);
  for (const d of daily) {
    const i = (utc(d.date).getUTCDay() + 6) % 7;
    s[i] += d.total;
    n[i]++;
  }
  return s.map((v, i) => (n[i] ? v / n[i] : 0));
}
