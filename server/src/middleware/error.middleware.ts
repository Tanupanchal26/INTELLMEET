import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import ApiError, { type FieldError } from '../utils/ApiError';
import logger from '../shared/utils/logger';
import { HTTP, ENV } from '../constants';

// Map Gemini SDK error → meaningful HTTP status + message
const normalizeAIError = (err: any): ApiError | null => {
  // Gemini SDK throws errors with .status, .message, sometimes .code
  const status  = err?.status ?? err?.statusCode ?? err?.httpStatus;
  const message = (err?.message ?? '').toLowerCase();

  // Only handle if it looks like a Gemini/AI API error
  const isAIError =
    status >= 400 ||
    message.includes('api_key') ||
    message.includes('quota') ||
    message.includes('gemini') ||
    message.includes('generative') ||
    message.includes('billing');

  if (!isAIError) return null;

  const logger = require('../shared/utils/logger').default;
  logger.error(
    `[Gemini Error] status=${status} message=${err?.message}`,
    { stack: err?.stack }
  );

  if (status === 401 || status === 403 || message.includes('api_key') || message.includes('invalid api key')) {
    return new ApiError(HTTP.UNAUTHORIZED, 'Gemini API key is invalid or missing. Please check your configuration.');
  }
  if (message.includes('quota') || message.includes('billing') || message.includes('resource_exhausted')) {
    return new ApiError(HTTP.TOO_MANY_REQUESTS, 'Gemini quota exceeded. Please check your billing at aistudio.google.com.');
  }
  if (status === 429) {
    return new ApiError(HTTP.TOO_MANY_REQUESTS, 'Gemini rate limit reached. Please wait a moment and try again.');
  }
  if (status === 400 || message.includes('invalid argument')) {
    return new ApiError(HTTP.BAD_REQUEST, `Gemini bad request: ${err?.message}`);
  }
  if (status === 503 || status === 500) {
    return new ApiError(HTTP.SERVICE_UNAVAILABLE, 'Gemini service is temporarily unavailable. Please try again shortly.');
  }
  return new ApiError(status ?? HTTP.INTERNAL_ERROR, `AI service error: ${err?.message}`);
};

const normalizeError = (err: unknown): ApiError => {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const errors: FieldError[] = Object.values(err.errors).map((e) => ({
      field:   e.path,
      message: e.message,
    }));
    return new ApiError(HTTP.UNPROCESSABLE, 'Validation failed', errors);
  }

  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 11000
  ) {
    const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue;
    const field    = Object.keys(keyValue ?? {})[0] ?? 'field';
    return ApiError.conflict(`${field} already exists`);
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid ${err.path}: ${String(err.value)}`);
  }

  if (err instanceof Error) {
    if (err.name === 'JsonWebTokenError') return ApiError.unauthorized('Invalid token');
    if (err.name === 'TokenExpiredError')  return ApiError.unauthorized('Token expired');

    // Check for Gemini SDK errors before falling through to generic 500
    const aiErr = normalizeAIError(err);
    if (aiErr) return aiErr;

    logger.error(`[UNCAUGHT ERROR] ${err.message}`, { stack: err.stack });
  }

  return new ApiError(HTTP.INTERNAL_ERROR, 'Internal server error');
};

const sanitizeLog = (v: unknown): string =>
  String(v ?? '').replace(/[\r\n\t\x00-\x1f\x7f]/g, '_').slice(0, 512);

const errorMiddleware: ErrorRequestHandler = (err, req: Request, res: Response, _next: NextFunction) => {
  const normalized = normalizeError(err);

  if (!normalized.isOperational) {
    logger.error({
      message:   sanitizeLog((err as Error).message),
      stack:     (err as Error).stack,
      path:      sanitizeLog(req.path),
      method:    sanitizeLog(req.method),
      requestId: res.locals.requestId,
    });
  } else {
    logger.warn(
      `[${sanitizeLog(req.method)}] ${sanitizeLog(req.path)} → ${normalized.statusCode}: ${sanitizeLog(normalized.message)}`
    );
  }

  res.status(normalized.statusCode).json({
    success:    false,
    statusCode: normalized.statusCode,
    message:    normalized.message,
    ...(normalized.field            && { field:  normalized.field }),
    ...(res.locals?.requestId       && { requestId: res.locals.requestId }),
    ...(normalized.errors?.length   && { errors: normalized.errors }),
    ...(process.env.NODE_ENV === ENV.DEVELOPMENT && { stack: (err as Error).stack }),
  });
};

export default errorMiddleware;
module.exports = errorMiddleware;
module.exports.default = errorMiddleware;
