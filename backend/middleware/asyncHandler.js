/**
 * Wrap an async route handler so any thrown error / rejected promise is
 * forwarded to Express's error middleware. Lets controllers use plain `await`.
 *   router.get("/", asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
