export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}
export function errorHandler(err, _req, res, _next) {
  const status = Number(err.status) || 500;
  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message
  });
}
