"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const constants_1 = require("../constants");
const rateLimitHandler = (_req, res) => res.status(constants_1.HTTP.TOO_MANY_REQUESTS).json({
    success: false,
    statusCode: constants_1.HTTP.TOO_MANY_REQUESTS,
    message: 'Too many requests — please slow down.',
    requestId: res.locals?.requestId,
});
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
});
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skipSuccessfulRequests: true,
});
exports.aiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
});
