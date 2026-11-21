// Express 4 does not catch errors thrown inside async handlers. This forwards them to the error handler.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
