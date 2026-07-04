import OpenAI from 'openai';
import config from '../config/env';
import logger from '../shared/utils/logger';

let _client: OpenAI | null = null;

// ── Mock client for missing API key ──────────────────────────────────────────
class MockOpenAI {
  chat = {
    completions: {
      create: async (options: any) => {
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

export const getClient = (): any => {
  if (!config.openai.apiKey) {
    logger.warn('[AI] OPENAI_API_KEY not configured — using Mock AI Service.');
    return new MockOpenAI();
  }
  if (!_client) {
    logger.info(`[AI] Initializing OpenAI client (key prefix: ${config.openai.apiKey.slice(0, 8)}…)`);
    _client = new OpenAI({
      apiKey:     config.openai.apiKey,
      timeout:    60_000,
      maxRetries: 0, // withRetry handles retries — avoid double-retrying
    });
  }
  return _client;
};

// ── Retry wrapper with exponential back-off ───────────────────────────────────
export const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 1000,
): Promise<T> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      const code   = err?.code   ?? err?.error?.code;

      // Never retry quota exhaustion or auth errors — they will never succeed
      const isFatal =
        code === 'insufficient_quota' ||
        status === 401 ||
        status === 400;

      const isRetryable =
        !isFatal && (
          status === 429 ||
          status === 503 ||
          err?.code === 'ECONNRESET' ||
          err?.code === 'ETIMEDOUT'
        );

      if (!isRetryable || attempt === retries) throw err;

      const wait = delayMs * Math.pow(2, attempt - 1);
      logger.warn(`[AI] Retry ${attempt}/${retries} after ${wait}ms — ${err?.message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error('withRetry: exhausted retries');
};

