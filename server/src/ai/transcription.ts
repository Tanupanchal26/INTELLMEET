// @ts-nocheck
const logger = require('../shared/utils/logger').default;

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

exports.transcribe = async (audioBuffer: Buffer, filename = 'audio.webm'): Promise<string> => {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    logger.warn('[Transcription] GROK_API_KEY not set.');
    return '';
  }
  if (!audioBuffer || audioBuffer.length === 0) {
    logger.warn('[Transcription] Empty audio buffer.');
    return '';
  }
  try {
    const { FormData, Blob } = await import('formdata-node');
    const form = new FormData();
    form.set('file', new Blob([audioBuffer], { type: 'audio/webm' }), filename);
    form.set('model', 'whisper-large-v3');
    form.set('response_format', 'text');

    const res = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form as any,
    });
    if (!res.ok) throw new Error(`Groq transcription error ${res.status}: ${await res.text()}`);
    const text = await res.text();
    logger.info(`[Transcription] Success: ${text.length} chars`);
    return text.trim();
  } catch (err: any) {
    logger.error(`[Transcription] Failed: ${err.message}`);
    throw err;
  }
};

exports.transcribeVerbose = async (audioBuffer: Buffer, filename = 'audio.webm'): Promise<{
  text: string;
  segments: Array<{ start: number; end: number; text: string }>;
}> => {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey || !audioBuffer || audioBuffer.length === 0) return { text: '', segments: [] };
  try {
    const { FormData, Blob } = await import('formdata-node');
    const form = new FormData();
    form.set('file', new Blob([audioBuffer], { type: 'audio/webm' }), filename);
    form.set('model', 'whisper-large-v3');
    form.set('response_format', 'verbose_json');

    const res = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form as any,
    });
    if (!res.ok) throw new Error(`Groq transcription error ${res.status}: ${await res.text()}`);
    const data = await res.json() as any;
    return {
      text:     data.text?.trim() || '',
      segments: (data.segments || []).map((s: any) => ({ start: s.start, end: s.end, text: s.text })),
    };
  } catch (err: any) {
    logger.error(`[Transcription] Verbose failed: ${err.message}`);
    throw err;
  }
};

export {};
