// @ts-nocheck
const { getClient, withRetry } = require('./openai');
const { Readable } = require('stream');

/**
 * Transcribe audio buffer using OpenAI Whisper.
 * Returns plain text transcript.
 */
exports.transcribe = async (audioBuffer: Buffer, filename = 'audio.webm'): Promise<string> => {
  const client = getClient();

  return withRetry(async () => {
    // Build a Readable stream with a .path hint so the OpenAI SDK detects the MIME type
    const stream = Readable.from(audioBuffer);
    (stream as any).path = filename;

    const res = await client.audio.transcriptions.create({
      model:           'whisper-1',
      file:            stream,
      response_format: 'text',
      language:        'en',
    });

    return typeof res === 'string' ? res.trim() : String(res).trim();
  });
};

/**
 * Transcribe with verbose JSON to get word-level timestamps and speaker hints.
 */
exports.transcribeVerbose = async (audioBuffer: Buffer, filename = 'audio.webm'): Promise<{
  text:     string;
  segments: Array<{ start: number; end: number; text: string }>;
}> => {
  const client = getClient();

  return withRetry(async () => {
    const stream = Readable.from(audioBuffer);
    (stream as any).path = filename;

    const res: any = await client.audio.transcriptions.create({
      model:           'whisper-1',
      file:            stream,
      response_format: 'verbose_json',
      language:        'en',
    });

    return {
      text:     res.text?.trim() || '',
      segments: (res.segments || []).map((s: any) => ({
        start: s.start,
        end:   s.end,
        text:  s.text?.trim() || '',
      })),
    };
  });
};

export {};
