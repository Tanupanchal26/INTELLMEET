// @ts-nocheck
const logger = require('../shared/utils/logger').default;

/**
 * Audio transcription stubs — primary transcription path in IntellMeet is
 * browser-side (Web Speech API / MediaRecorder) which streams text chunks
 * directly via socket. These stubs preserve existing call-sites in
 * transcription.service.ts without breaking anything.
 */

exports.transcribe = async (_audioBuffer: Buffer, _filename = 'audio.webm'): Promise<string> => {
  logger.warn('[Transcription] Server-side audio transcription is not available (Gemini does not support Whisper-style audio). Using browser-side transcription.');
  return '';
};

exports.transcribeVerbose = async (_audioBuffer: Buffer, _filename = 'audio.webm'): Promise<{
  text: string;
  segments: Array<{ start: number; end: number; text: string }>;
}> => {
  logger.warn('[Transcription] Server-side audio transcription is not available (Gemini does not support Whisper-style audio). Using browser-side transcription.');
  return { text: '', segments: [] };
};

export {};
