"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const morgan_1 = __importDefault(require("morgan"));
const logger_1 = __importDefault(require("../shared/utils/logger"));
const stream = {
    write: (message) => logger_1.default.http(message.trim()),
};
morgan_1.default.token('request-id', (_req, res) => res.locals?.requestId ?? '-');
morgan_1.default.token('tenant-id', (req) => req.user?.tenantId ?? '-');
const DEV_FORMAT = ':method :url :status :res[content-length] - :response-time ms [:request-id]';
const PROD_FORMAT = JSON.stringify({
    requestId: ':request-id',
    tenantId: ':tenant-id',
    method: ':method',
    url: ':url',
    status: ':status',
    responseTime: ':response-time ms',
    contentLength: ':res[content-length]',
    userAgent: ':user-agent',
    ip: ':remote-addr',
});
const isDev = process.env.NODE_ENV !== 'production';
const httpLogger = (0, morgan_1.default)(isDev ? DEV_FORMAT : PROD_FORMAT, {
    stream,
    skip: (req) => req.path === '/health',
});
exports.default = httpLogger;
module.exports = httpLogger;
module.exports.default = httpLogger;
