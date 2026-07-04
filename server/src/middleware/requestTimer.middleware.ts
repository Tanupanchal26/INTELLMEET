import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that records the duration of each request and adds it to the response locals.
 * It also logs the request details in development mode.
 */
export default function requestTimer(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  const locals = res.locals as any;
  locals.requestStart = start;
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    locals.requestDurationMs = durationMs;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[REQ] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${durationMs.toFixed(2)}ms`);
    }
  });
  next();
}
