"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const transcriptionService = require('../../services/transcription.service');
const logger = require('../../shared/utils/logger').default;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB per chunk
/**
 * POST /ai/:meetingId/transcribe-audio
 * Body: multipart/form-data  { audio: <file> }
 * Returns: { text, segments }
 * Side-effect: broadcasts meeting:transcript-chunk to the meeting room
 */
exports.transcribeAudio = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    if (!req.file)
        throw ApiError.badRequest('audio file is required');
    if (req.file.size > MAX_AUDIO_BYTES)
        throw ApiError.badRequest('audio chunk exceeds 10 MB limit');
    const speakerName = req.user?.name || 'Unknown';
    const speakerId = req.user?.id || '';
    const { text, segments } = await transcriptionService.processAudioChunk(meetingId, speakerName, speakerId, req.file.buffer, req.file.originalname || 'audio.webm');
    if (!text)
        return ApiResponse.ok(res, { text: '', segments: [] }, 'No speech detected');
    // Broadcast to all participants in the meeting room
    const io = req.app.get('io');
    if (io) {
        io.to(`meeting:${meetingId}`).emit('meeting:transcript-chunk', {
            chunk: text,
            speaker: speakerName,
            userId: speakerId,
            segments,
            source: 'whisper',
        });
    }
    logger.info(`[Transcription] meeting=${meetingId} speaker=${speakerName} chars=${text.length}`);
    return ApiResponse.ok(res, { text, segments }, 'Transcribed');
});
/**
 * POST /ai/:meetingId/consolidate-transcript
 * Merges all stored chunks into the flat transcript field.
 * Called automatically on meeting:end; also available as a manual REST trigger.
 */
exports.consolidateTranscript = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const transcript = await transcriptionService.consolidateTranscript(meetingId);
    return ApiResponse.ok(res, { transcript }, 'Transcript consolidated');
});
