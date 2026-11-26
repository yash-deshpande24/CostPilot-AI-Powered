import { registry } from '../services/metrics.js';

// Records every API call. Uses the route pattern (for example /api/costs), never the full URL,
// so a user id or date in the path cannot create thousands of metric series.
export function metricsMiddleware(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route ? `${req.baseUrl || ''}${req.route.path}` : (req.baseUrl ? 'other' : 'unmatched');
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    const labels = { route, method: req.method, status_class: `${Math.floor(res.statusCode / 100)}xx` };
    registry.httpRequests.inc(labels);
    registry.httpLatency.observe({ route }, seconds);
  });
  next();
}
