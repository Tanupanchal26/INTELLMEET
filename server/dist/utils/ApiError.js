"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
const constants_1 = require("../constants");
class ApiError extends Error {
    statusCode;
    isOperational;
    errors;
    field;
    constructor(statusCode, message, errors = []) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
    static badRequest(msg, errors) {
        return new ApiError(constants_1.HTTP.BAD_REQUEST, msg, errors);
    }
    static unauthorized(msg = 'Unauthorized') {
        return new ApiError(constants_1.HTTP.UNAUTHORIZED, msg);
    }
    static forbidden(msg = 'Forbidden') {
        return new ApiError(constants_1.HTTP.FORBIDDEN, msg);
    }
    static notFound(msg = 'Resource not found') {
        return new ApiError(constants_1.HTTP.NOT_FOUND, msg);
    }
    static conflict(msg) {
        return new ApiError(constants_1.HTTP.CONFLICT, msg);
    }
    static internal(msg = 'Internal server error') {
        return new ApiError(constants_1.HTTP.INTERNAL_ERROR, msg);
    }
}
exports.ApiError = ApiError;
exports.default = ApiError;
module.exports = ApiError;
module.exports.default = ApiError;
