export const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const usd2 = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const utc = (iso) => new Date(iso + 'T00:00:00Z');
export const shortDate = (iso) => utc(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const longDate = (iso) => utc(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
export const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// Colours for services, used by the share bar and heatmap labels.
export const SERVICE_COLORS = ['#6f74e8', '#e9a23b', '#3fb6a8', '#d97aa5', '#8fbf5a', '#e07a5f', '#7aa7d9', '#b79cf0'];
