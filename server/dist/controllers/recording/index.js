"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const recordingService = require('../../services/recording.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse').default;
const ApiError = require('../../utils/ApiError');
exports.uploadRecording = asyncHandler(async (req, res) => {
    const { meetingId } = req.body;
    if (!req.file)
        throw ApiError.badRequest('No video file provided');
    const recording = await recordingService.uploadRecording(meetingId, req.tenantId, req.user._id, req.file.buffer, req.file.size);
    ApiResponse.created(res, recording, 'Recording uploaded');
});
exports.startRecording = asyncHandler(async (req, res) => {
    const { meetingId } = req.body;
    const recording = await recordingService.startRecording(meetingId, req.tenantId, req.user._id);
    ApiResponse.created(res, recording, 'Recording started');
});
exports.stopRecording = asyncHandler(async (req, res) => {
    const recording = await recordingService.stopRecording(req.params.id, req.tenantId);
    ApiResponse.ok(res, recording, 'Recording stopped');
});
exports.listRecordings = asyncHandler(async (req, res) => {
    const recordings = await recordingService.getRecordings(req.tenantId, req.user._id);
    ApiResponse.ok(res, recordings, 'Recordings retrieved');
});
exports.getRecording = asyncHandler(async (req, res) => {
    const recording = await recordingService.getRecording(req.params.id, req.tenantId, req.user._id);
    ApiResponse.ok(res, recording, 'Recording retrieved');
});
exports.deleteRecording = asyncHandler(async (req, res) => {
    await recordingService.deleteRecording(req.params.id, req.tenantId, req.user._id);
    ApiResponse.noContent(res);
});
