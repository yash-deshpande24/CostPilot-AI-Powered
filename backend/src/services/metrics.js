// A tiny Prometheus-format metrics registry, so there is no extra package to install.
// Datadog's agent reads this text from GET /metrics (see gitops/platform/datadog).
// Labels are kept to a small, fixed set so the metric count cannot explode.

const esc = (v) => String(v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
const key = (labels, names) => names.map((n) => `${n}=${labels[n] ?? ''}`).join(',');
const fmtLabels = (labels, names) => (names.length ? `{${names.map((n) => `${n}="${esc(labels[n] ?? '')}"`).join(',')}}` : '');

export class Counter {
  constructor(name, help, labelNames = []) {
    Object.assign(this, { name, help, labelNames, values: new Map() });
  }
  inc(labels = {}, by = 1) {
    const k = key(labels, this.labelNames);
    const cur = this.values.get(k) || { labels, value: 0 };
    cur.value += by;
    this.values.set(k, cur);
  }
  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const { labels, value } of this.values.values()) lines.push(`${this.name}${fmtLabels(labels, this.labelNames)} ${value}`);
    return lines;
  }
}

export class Histogram {
  constructor(name, help, buckets, labelNames = []) {
    Object.assign(this, { name, help, buckets: [...buckets].sort((a, b) => a - b), labelNames, series: new Map() });
  }
  observe(labels = {}, seconds) {
    const k = key(labels, this.labelNames);
    const s = this.series.get(k) || { labels, counts: this.buckets.map(() => 0), sum: 0, count: 0 };
    this.buckets.forEach((b, i) => { if (seconds <= b) s.counts[i]++; });
    s.sum += seconds;
    s.count++;
    this.series.set(k, s);
  }
  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const s of this.series.values()) {
      const base = this.labelNames.map((n) => `${n}="${esc(s.labels[n] ?? '')}"`);
      this.buckets.forEach((b, i) => lines.push(`${this.name}_bucket{${[...base, `le="${b}"`].join(',')}} ${s.counts[i]}`));
      lines.push(`${this.name}_bucket{${[...base, 'le="+Inf"'].join(',')}} ${s.count}`);
      const plain = base.length ? `{${base.join(',')}}` : '';
      lines.push(`${this.name}_sum${plain} ${s.sum}`, `${this.name}_count${plain} ${s.count}`);
    }
    return lines;
  }
}

export const registry = {
  httpRequests: new Counter('costpilot_http_requests_total', 'API requests by route, method and status class.', ['route', 'method', 'status_class']),
  httpLatency: new Histogram('costpilot_http_request_duration_seconds', 'API request duration.', [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5], ['route']),
  aiCalls: new Counter('costpilot_ai_calls_total', 'Calls to Claude by mode and result.', ['mode', 'result']),
  aiTokens: new Counter('costpilot_ai_tokens_total', 'Claude tokens used.', ['direction']),
};

export function renderMetrics() {
  return [...Object.values(registry).flatMap((m) => m.render()), ''].join('\n');
}

export function resetMetrics() {
  for (const m of Object.values(registry)) m.values?.clear?.();
  for (const m of Object.values(registry)) m.series?.clear?.();
}
