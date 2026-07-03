// @ts-nocheck
const ApiError = require('../utils/ApiError');

/**
 * Catch-all for routes that don't match any registered handler.
 * Must be registered AFTER all routes in app.js.
 */
const notFound = (req, _res, next) =>
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

module.exports = notFound;

export {};
