"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetry = exports.getClient = void 0;
const openai_1 = __importDefault(require("openai"));
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../shared/utils/logger"));
let _client = null;
// ── Mock client for missing API key ──────────────────────────────────────────
class MockOpenAI {
    chat = {
        completions: {
            create: async (options) => {
                let content = 'Mock AI: OPENAI_API_KEY is not configured. Please set it in your .env file.';
                if (options?.response_format?.type === 'json_object') {
                    content = JSON.stringify({
                        actionItems: [{ text: 'Configure OPENAI_API_KEY in .env', assignee: 'Admin', dueDate: null, priority: 'high', status: 'pending' }],
                        decisions: [],
                        keywords: ['configuration', 'setup'],
                    });
                }
                return { choices: [{ message: { content }, finish_reason: 'stop' }], usage: { total_tokens: 0 } };
            },
        },
    };
    embeddings = {
        create: async () => ({ data: [{ embedding: new Array(1536).fill(0) }] }),
    };
    audio = {
        transcriptions: {
            create: async () => 'Mock transcription: audio processing unavailable without API key.',
        },
    };
}
const getClient = () => {
    if (!env_1.default.openai.apiKey) {
        logger_1.default.warn('[AI] OPENAI_API_KEY not configured — using Mock AI Service.');
        return new MockOpenAI();
    }
    if (!_client) {
        _client = new openai_1.default({
            apiKey: env_1.default.openai.apiKey,
            timeout: 60_000, // 60s hard timeout per request
            maxRetries: 3, // built-in exponential back-off for 429/5xx
        });
    }
    return _client;
};
exports.getClient = getClient;
// ── Retry wrapper with exponential back-off ───────────────────────────────────
const withRetry = async (fn, retries = 3, delayMs = 1000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            const isRetryable = err?.status === 429 ||
                err?.status === 503 ||
                err?.code === 'ECONNRESET' ||
                err?.code === 'ETIMEDOUT';
            if (!isRetryable || attempt === retries)
                throw err;
            const wait = delayMs * Math.pow(2, attempt - 1);
            logger_1.default.warn(`[AI] Retry ${attempt}/${retries} after ${wait}ms — ${err?.message}`);
            await new Promise((r) => setTimeout(r, wait));
        }
    }
    throw new Error('withRetry: exhausted retries');
};
exports.withRetry = withRetry;
