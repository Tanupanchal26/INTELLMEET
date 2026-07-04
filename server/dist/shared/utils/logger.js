"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
require("winston-daily-rotate-file");
const path_1 = __importDefault(require("path"));
const isDev = process.env.NODE_ENV !== 'production';
const LOGS_DIR = path_1.default.join(__dirname, '../../../logs');
const devFormat = winston_1.default.format.combine(winston_1.default.format.colorize({ all: true }), winston_1.default.format.timestamp({ format: 'HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.printf(({ level, message, timestamp: ts, stack }) => stack ? `[${ts}] ${level}: ${message}\n${stack}` : `[${ts}] ${level}: ${message}`));
const prodFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
const transports = [new winston_1.default.transports.Console()];
if (isDev) {
    transports.push(new winston_1.default.transports.DailyRotateFile({
        dirname: LOGS_DIR,
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'info',
    }), new winston_1.default.transports.DailyRotateFile({
        dirname: LOGS_DIR,
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
    }));
}
const logger = winston_1.default.createLogger({
    level: isDev ? 'debug' : 'info',
    format: isDev ? devFormat : prodFormat,
    exitOnError: false,
    transports,
    exceptionHandlers: isDev
        ? [new winston_1.default.transports.File({ filename: path_1.default.join(LOGS_DIR, 'exceptions.log') })]
        : [new winston_1.default.transports.Console()],
    rejectionHandlers: isDev
        ? [new winston_1.default.transports.File({ filename: path_1.default.join(LOGS_DIR, 'rejections.log') })]
        : [new winston_1.default.transports.Console()],
});
exports.default = logger;
