"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIQueue = exports.enqueueAIJob = exports.initAIWorker = exports.initAIQueue = void 0;
const logger_1 = __importDefault(require("../shared/utils/logger"));
let _queue = null;
let _worker = null;
let _bullmqAvailable = false;
const REDIS_URL = process.env.REDIS_URL || '';
const initAIQueue = async () => {
    if (!REDIS_URL) {
        logger_1.default.info('[AI Queue] No REDIS_URL — running in synchronous fallback mode');
        return;
    }
    try {
        const { Queue } = await Promise.resolve().then(() => __importStar(require('bullmq')));
        const connection = { url: REDIS_URL };
        _queue = new Queue('ai-jobs', {
            connection,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: { count: 100 },
                removeOnFail: { count: 50 },
            },
        });
        _bullmqAvailable = true;
        logger_1.default.info('[AI Queue] BullMQ queue initialised');
    }
    catch (err) {
        logger_1.default.warn(`[AI Queue] BullMQ init failed — falling back to sync mode: ${err.message}`);
    }
};
exports.initAIQueue = initAIQueue;
const initAIWorker = async () => {
    if (!_bullmqAvailable || !REDIS_URL)
        return;
    try {
        const { Worker } = await Promise.resolve().then(() => __importStar(require('bullmq')));
        const processor = require('./ai.worker');
        _worker = new Worker('ai-jobs', processor, {
            connection: { url: REDIS_URL },
            concurrency: 3,
        });
        _worker.on('completed', (job) => logger_1.default.info(`[AI Worker] Job ${job.id} (${job.name}) completed`));
        _worker.on('failed', (job, err) => logger_1.default.error(`[AI Worker] Job ${job?.id} failed: ${err.message}`));
        logger_1.default.info('[AI Queue] BullMQ worker started');
    }
    catch (err) {
        logger_1.default.warn(`[AI Worker] Worker init failed: ${err.message}`);
    }
};
exports.initAIWorker = initAIWorker;
const enqueueAIJob = async (name, data) => {
    if (!_bullmqAvailable || !_queue)
        return null;
    try {
        const job = await _queue.add(name, data);
        return { id: job.id };
    }
    catch (err) {
        logger_1.default.warn(`[AI Queue] Failed to enqueue job "${name}": ${err.message}`);
        return null;
    }
};
exports.enqueueAIJob = enqueueAIJob;
const getAIQueue = () => _queue;
exports.getAIQueue = getAIQueue;
