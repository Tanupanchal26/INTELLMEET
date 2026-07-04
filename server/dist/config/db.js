"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDB = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = __importDefault(require("./env"));
const logger_1 = __importDefault(require("../shared/utils/logger"));
const MONGO_OPTIONS = {
    serverSelectionTimeoutMS: 5_000,
    heartbeatFrequencyMS: 10_000,
    maxPoolSize: env_1.default.isProd ? 20 : 5,
    minPoolSize: 2,
    socketTimeoutMS: 45_000,
    family: 4,
    autoIndex: env_1.default.isProd ? false : true,
};
const connectWithRetry = async (retries = 5, baseDelayMs = 3_000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await mongoose_1.default.connect(env_1.default.mongo.uri, MONGO_OPTIONS);
            return;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger_1.default.error(`[DB] Connection attempt ${attempt}/${retries} failed: ${message}`);
            if (attempt === retries)
                throw err;
            await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
        }
    }
};
const connectDB = async () => {
    mongoose_1.default.connection.on('connected', () => logger_1.default.info('[DB] MongoDB connected'));
    mongoose_1.default.connection.on('disconnected', () => logger_1.default.warn('[DB] MongoDB disconnected'));
    mongoose_1.default.connection.on('error', (e) => logger_1.default.error(`[DB] Error: ${e.message}`));
    if (!env_1.default.isProd) {
        mongoose_1.default.set('debug', (collection, method) => {
            // Skip noisy index sync logs
            if (method === 'createIndex')
                return;
            logger_1.default.debug(`[DB] ${collection}.${method}`);
        });
    }
    try {
        await connectWithRetry();
        logger_1.default.info(`[DB] Connected to: ${mongoose_1.default.connection.host}`);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger_1.default.error(`[DB] Failed to connect after retries — exiting. ${message}`);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
const disconnectDB = async () => {
    await mongoose_1.default.connection.close();
    logger_1.default.info('[DB] MongoDB connection closed');
};
exports.disconnectDB = disconnectDB;
