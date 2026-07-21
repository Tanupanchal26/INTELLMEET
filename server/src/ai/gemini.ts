import { GoogleGenAI } from '@google/genai';
import logger from '../shared/utils/logger';

let _client: GoogleGenAI | null = null;

// ── Mock client for missing API key ──────────────────────────────────────────
class MockGemini {
  async generateContent(opts: any): Promise<{ text: string }> {
    const isJson = typeof opts?.prompt === 'string' && opts.prompt.includes('Return JSON');
    const text = isJson
      ? JSON.stringify({ actionItems: [], decisions: [], suggestions: [], tasks: [], topicsCovered: [], followUpItems: [], questionsAsked: [], answersGiven: [], agendaCompletion: 0, notesMarkdown: '' })
      : 'Mock AI: GEMINI_API_KEY is not configured. Please set it in your environment variables.';
    return { text };
  }
  async embedContent(_text: string): Promise<number[]> {
    return new Array(768).fill(0);
  }
}

const getApiKey = () => process.env.GEMINI_API_KEY || '';

export const getClient = (): any => {
  if (!getApiKey()) {
    logger.warn('[AI] GEMINI_API_KEY not configured — using Mock AI Service.');
    return new MockGemini();
  }
  if (!_client) {
    logger.info(`[AI] Initializing Gemini client (key prefix: ${getApiKey().slice(0, 8)}…)`);
    _client = new GoogleGenAI({ apiKey: getApiKey() });
  }
  return _client;
};

// ── Unified text generation helper ───────────────────────────────────────────
// Returns the raw text string from Gemini so callers don't touch the SDK directly.
export const generate = async (
  prompt: string,
  model = 'gemini-2.0-flash',
): Promise<string> => {
  const client = getClient();

  // MockGemini path
  if (client instanceof MockGemini) {
    const res = await client.generateContent({ prompt });
    return res.text;
  }

  const response = await (client as GoogleGenAI).models.generateContent({
    model,
    contents: prompt,
  });
  const text = response.text ?? '';
  if (!text.trim()) throw new Error('Gemini returned an empty response');
  return text.trim();
};

// ── Embedding helper ──────────────────────────────────────────────────────────
export const embed = async (text: string): Promise<number[]> => {
  const client = getClient();

  if (client instanceof MockGemini) {
    return client.embedContent(text);
  }

  const response = await (client as GoogleGenAI).models.embedContent({
    model:   'gemini-embedding-exp-03-07',
    contents: text,
  });
  return response.embeddings?.[0]?.values ?? new Array(768).fill(0);
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
      const status  = err?.status ?? err?.statusCode ?? err?.httpStatus;
      const message = (err?.message ?? '').toLowerCase();

      // Never retry quota/auth failures — they will never succeed
      const isFatal =
        status === 401 ||
        status === 403 ||
        message.includes('api_key') ||
        message.includes('quota') ||
        message.includes('billing') ||
        message.includes('invalid argument');

      const isRetryable =
        !isFatal && (status === 429 || status === 503 || status === 500 ||
          err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT');

      if (!isRetryable || attempt === retries) throw err;

      const wait = delayMs * Math.pow(2, attempt - 1);
      logger.warn(`[AI] Retry ${attempt}/${retries} after ${wait}ms — ${err?.message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error('withRetry: exhausted retries');
};

// ── Parse JSON from Gemini response (strips markdown fences if present) ───────
export const parseJSON = <T>(raw: string): T => {
  // Gemini sometimes wraps JSON in ```json ... ``` fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(cleaned) as T;
};
