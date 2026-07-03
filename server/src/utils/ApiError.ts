import { HTTP } from '../constants';

export interface FieldError {
  field:   string;
  message: string;
}

export class ApiError extends Error {
  readonly statusCode:    number;
  readonly isOperational: boolean;
  readonly errors:        FieldError[];
  field?: string;

  constructor(statusCode: number, message: string, errors: FieldError[] = []) {
    super(message);
    this.name          = 'ApiError';
    this.statusCode    = statusCode;
    this.errors        = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg: string, errors?: FieldError[]): ApiError {
    return new ApiError(HTTP.BAD_REQUEST, msg, errors);
  }

  static unauthorized(msg = 'Unauthorized'): ApiError {
    return new ApiError(HTTP.UNAUTHORIZED, msg);
  }

  static forbidden(msg = 'Forbidden'): ApiError {
    return new ApiError(HTTP.FORBIDDEN, msg);
  }

  static notFound(msg = 'Resource not found'): ApiError {
    return new ApiError(HTTP.NOT_FOUND, msg);
  }

  static conflict(msg: string): ApiError {
    return new ApiError(HTTP.CONFLICT, msg);
  }

  static internal(msg = 'Internal server error'): ApiError {
    return new ApiError(HTTP.INTERNAL_ERROR, msg);
  }
}

export default ApiError;
module.exports = ApiError;
module.exports.default = ApiError;
