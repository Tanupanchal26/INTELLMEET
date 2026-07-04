"use strict";
// @ts-nocheck
const AIResult = require('../models/AIResult');
const { transcribeVerbose } = require('../ai/transcription');
const logger = require('../shared/utils/logger').default;
const MAX_CHUNK_TEXT = 2000;
/**
 * Process a raw audio buffer through Whisper, persist segments to AIResult,
 * and return structured segments with speaker attribution.
 */
exports.processAudioChunk = async (meetingId, speakerName, speakerId, audioBuffer, filename = 'audio.webm') => {
    if (!audioBuffer || audioBuffer.length < 1000) {
        // Too small to be meaningful audio — skip Whisper call
        return { text: '', segments: [] };
    }
    let result;
    try {
        result = await transcribeVerbose(audioBuffer, filename);
    }
    catch (err) {
        logger.error(`[Transcription] Whisper error for meeting ${meetingId}: ${err.message}`);
        throw err;
    }
    if (!result.text?.trim())
        return { text: '', segments: [] };
    const segments = result.segments.map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text.slice(0, MAX_CHUNK_TEXT),
        speaker: speakerName,
        speakerId,
    }));
    // Persist each segment as a transcript chunk
    const chunkDocs = segments.map((s) => ({
        text: s.text,
        speaker: s.speaker,
        speakerId: s.speakerId,
        ts: Date.now() + Math.round(s.start * 1000),
    }));
    if (chunkDocs.length) {
        await AIResult.findOneAndUpdate({ meeting: meetingId }, {
            $setOnInsert: { meeting: meetingId },
            $push: { transcriptChunks: { $each: chunkDocs } },
        }, { upsert: true });
    }
    return { text: result.text, segments };
};
/**
 * Consolidate all transcriptChunks into the flat `transcript` field.
 * Called when a meeting ends so downstream AI (summarize, etc.) has a clean string.
 */
exports.consolidateTranscript = async (meetingId) => {
    const doc = await AIResult.findOne({ meeting: meetingId }).lean();
    if (!doc)
        return '';
    const chunks = (doc.transcriptChunks || [])
        .slice()
        .sort((a, b) => a.ts - b.ts);
    const transcript = chunks
        .map((c) => `${c.speaker}: ${c.text}`)
        .join('\n')
        .trim();
    if (transcript) {
        await AIResult.findOneAndUpdate({ meeting: meetingId }, { $set: { transcript } });
    }
    return transcript;
};
