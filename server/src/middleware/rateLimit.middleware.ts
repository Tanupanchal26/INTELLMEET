import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { HTTP } from '../constants';

const rateLimitHandler = (_req: unknown, res: any) =>
  res.status(HTTP.TOO_MANY_REQUESTS).json({
    success:    false,
    statusCode: HTTP.TOO_MANY_REQUESTS,
    message:    'Too many requests — please slow down.',
    requestId:  res.locals?.requestId,
  });

export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs:        60 * 1_000,
  max:             120,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs:               15 * 60 * 1_000,
  max:                    10,
  standardHeaders:        true,
  legacyHeaders:          false,
  handler:                rateLimitHandler,
  skipSuccessfulRequests: true,
});

export const aiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs:        60 * 1_000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});
