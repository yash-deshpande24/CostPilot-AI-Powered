import test from 'node:test';
import assert from 'node:assert/strict';
import { Counter, Histogram, registry, renderMetrics, resetMetrics } from '../services/metrics.js';
import { metricsMiddleware } from '../middleware/metrics.js';

test.beforeEach(() => resetMetrics());

test('counter renders HELP, TYPE and labelled values', () => {
  const c = new Counter('demo_total', 'Demo counter.', ['route']);
  c.inc({ route: '/a' });
  c.inc({ route: '/a' }, 2);
  const out = c.render().join('\n');
  assert.match(out, /# TYPE demo_total counter/);
  assert.match(out, /demo_total\{route="\/a"\} 3/);
});

test('label values are escaped', () => {
  const c = new Counter('esc_total', 'Escape test.', ['route']);
  c.inc({ route: 'a"b' });
  assert.match(c.render().join('\n'), /route="a\\"b"/);
});

test('histogram fills cumulative buckets, sum and count', () => {
  const h = new Histogram('lat_seconds', 'Latency.', [0.1, 1], ['route']);
  h.observe({ route: '/x' }, 0.05);
  h.observe({ route: '/x' }, 0.5);
  const out = h.render().join('\n');
  assert.match(out, /lat_seconds_bucket\{route="\/x",le="0.1"\} 1/);
  assert.match(out, /lat_seconds_bucket\{route="\/x",le="1"\} 2/);
  assert.match(out, /lat_seconds_bucket\{route="\/x",le="\+Inf"\} 2/);
  assert.match(out, /lat_seconds_count\{route="\/x"\} 2/);
});

test('middleware records a request when the response finishes', () => {
  const handlers = {};
  const res = { statusCode: 200, on: (evt, fn) => { handlers[evt] = fn; } };
  const req = { method: 'GET', baseUrl: '/api/costs', route: { path: '/' } };
  let called = false;
  metricsMiddleware(req, res, () => { called = true; });
  assert.equal(called, true);
  handlers.finish();
  const out = renderMetrics();
  assert.match(out, /costpilot_http_requests_total\{route="\/api\/costs\/",method="GET",status_class="2xx"\} 1/);
  assert.match(out, /costpilot_http_request_duration_seconds_count\{route="\/api\/costs\/"\} 1/);
});

test('unmatched routes use a fixed label, not the raw URL', () => {
  const handlers = {};
  const res = { statusCode: 404, on: (evt, fn) => { handlers[evt] = fn; } };
  metricsMiddleware({ method: 'GET', baseUrl: '', originalUrl: '/random/123' }, res, () => {});
  handlers.finish();
  const out = renderMetrics();
  assert.match(out, /route="unmatched"/);
  assert.doesNotMatch(out, /random\/123/);
});

test('resetMetrics clears everything', () => {
  registry.aiCalls.inc({ mode: 'mock', result: 'ok' });
  resetMetrics();
  assert.doesNotMatch(renderMetrics(), /costpilot_ai_calls_total\{/);
});