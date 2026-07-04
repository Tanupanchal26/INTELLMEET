"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const ApiError_1 = __importDefault(require("../utils/ApiError"));
const logger_1 = __importDefault(require("../shared/utils/logger"));
const constants_1 = require("../constants");
const normalizeError = (err) => {
    if (err instanceof ApiError_1.default)
        return err;
    if (err instanceof mongoose_1.default.Error.ValidationError) {
        const errors = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message,
        }));
        return new ApiError_1.default(constants_1.HTTP.UNPROCESSABLE, 'Validation failed', errors);
    }
    if (typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        err.code === 11000) {
        const keyValue = err.keyValue;
        const field = Object.keys(keyValue ?? {})[0] ?? 'field';
        return ApiError_1.default.conflict(`${field} already exists`);
    }
    if (err instanceof mongoose_1.default.Error.CastError) {
        return ApiError_1.default.badRequest(`Invalid ${err.path}: ${String(err.value)}`);
    }
    if (err instanceof Error) {
        if (err.name === 'JsonWebTokenError')
            return ApiError_1.default.unauthorized('Invalid token');
        if (err.name === 'TokenExpiredError')
            return ApiError_1.default.unauthorized('Token expired');
        logger_1.default.error(`[UNCAUGHT ERROR] ${err.message}`, { stack: err.stack });
    }
    return new ApiError_1.default(constants_1.HTTP.INTERNAL_ERROR, 'Internal server error');
};
const sanitizeLog = (v) => String(v ?? '').replace(/[\r\n\t\x00-\x1f\x7f]/g, '_').slice(0, 512);
const errorMiddleware = (err, req, res, _next) => {
    const normalized = normalizeError(err);
    if (!normalized.isOperational) {
        logger_1.default.error({
            message: sanitizeLog(err.message),
            stack: err.stack,
            path: sanitizeLog(req.path),
            method: sanitizeLog(req.method),
            requestId: res.locals.requestId,
        });
    }
    else {
        logger_1.default.warn(`[${sanitizeLog(req.method)}] ${sanitizeLog(req.path)} → ${normalized.statusCode}: ${sanitizeLog(normalized.message)}`);
    }
    res.status(normalized.statusCode).json({
        success: false,
        statusCode: normalized.statusCode,
        message: normalized.message,
        ...(normalized.field && { field: normalized.field }),
        ...(res.locals?.requestId && { requestId: res.locals.requestId }),
        ...(normalized.errors?.length && { errors: normalized.errors }),
        ...(process.env.NODE_ENV === constants_1.ENV.DEVELOPMENT && { stack: err.stack }),
    });
};
exports.default = errorMiddleware;
module.exports = errorMiddleware;
module.exports.default = errorMiddleware;
