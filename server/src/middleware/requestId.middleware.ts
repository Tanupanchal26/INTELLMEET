// @ts-nocheck
const { randomUUID } = require('crypto');

/**
 * Stamps every request with a unique ID.
 * — Reads X-Request-ID header if provided by upstream (ALB / API Gateway)
 * — Falls back to a fresh UUID
 * — Echoes the ID back in the response header for client-side tracing
 */
const requestId = (req, res, next) => {
  const id = req.headers['x-request-id'] || randomUUID();
  res.locals.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};

module.exports = requestId;

export {};
