import logger from '../shared/utils/logger';

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

const getApiKey  = () => process.env.GROQ_API_KEY || '';
const getTimeout = () => parseInt(process.env.AI_TIMEOUT || '30000', 10);

export const transcribe = async (audioBuffer: Buffer, filename = 'audio.webm'): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured. Please add it to your .env file.');
  if (!audioBuffer || audioBuffer.length === 0) throw new Error('Empty audio buffer.');

  const { FormData, Blob } = await import('formdata-node');
  const form = new FormData();
  form.set('file', new Blob([audioBuffer], { type: 'audio/webm' }), filename);
  form.set('model', 'whisper-large-v3');
  form.set('response_format', 'text');

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), getTimeout());

  try {
    const res = await fetch(GROQ_TRANSCRIPTION_URL, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body:    form as any,
      signal:  controller.signal,
    });
    if (!res.ok) throw new Error(`Groq Whisper error ${res.status}: ${await res.text()}`);
    const text = await res.text();
    logger.info(`[Transcription] Success: ${text.length} chars`);
    return text.trim();
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error(`Groq Whisper timed out after ${getTimeout()}ms.`);
    logger.error(`[Transcription] Failed: ${err.message}`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

export const transcribeVerbose = async (
  audioBuffer: Buffer,
  filename = 'audio.webm',
): Promise<{ text: string; segments: Array<{ start: number; end: number; text: string }> }> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured. Please add it to your .env file.');
  if (!audioBuffer || audioBuffer.length === 0) throw new Error('Empty audio buffer.');

  const { FormData, Blob } = await import('formdata-node');
  const form = new FormData();
  form.set('file', new Blob([audioBuffer], { type: 'audio/webm' }), filename);
  form.set('model', 'whisper-large-v3');
  form.set('response_format', 'verbose_json');

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), getTimeout());

  try {
    const res = await fetch(GROQ_TRANSCRIPTION_URL, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body:    form as any,
      signal:  controller.signal,
    });
    if (!res.ok) throw new Error(`Groq Whisper error ${res.status}: ${await res.text()}`);
    const data = await res.json() as any;
    return {
      text:     data.text?.trim() || '',
      segments: (data.segments || []).map((s: any) => ({ start: s.start, end: s.end, text: s.text })),
    };
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error(`Groq Whisper timed out after ${getTimeout()}ms.`);
    logger.error(`[Transcription] Verbose failed: ${err.message}`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};
