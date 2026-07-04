"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const channelService = require('../../services/channel.service');
const ApiResponse = require('../../utils/ApiResponse').default;
const asyncHandler = require('../../utils/asyncHandler').default;
exports.createChannel = asyncHandler(async (req, res) => {
    const channel = await channelService.createChannel(req.params.teamId, req.tenantId, req.user?._id, req.body);
    ApiResponse.created(res, channel, 'Channel created');
});
exports.listChannels = asyncHandler(async (req, res) => {
    const channels = await channelService.getTeamChannels(req.params.teamId, req.tenantId, req.user?._id);
    ApiResponse.ok(res, channels);
});
exports.getChannel = asyncHandler(async (req, res) => {
    const channel = await channelService.getChannel(req.params.id, req.tenantId, req.user?._id);
    ApiResponse.ok(res, channel);
});
exports.updateChannel = asyncHandler(async (req, res) => {
    const channel = await channelService.updateChannel(req.params.id, req.tenantId, req.user?._id, req.body);
    ApiResponse.ok(res, channel, 'Channel updated');
});
exports.archiveChannel = asyncHandler(async (req, res) => {
    const channel = await channelService.archiveChannel(req.params.id, req.tenantId, req.user?._id);
    ApiResponse.ok(res, channel, 'Channel archived');
});
exports.getMessages = asyncHandler(async (req, res) => {
    const result = await channelService.getMessages(req.params.id, req.tenantId, req.user?._id, req.query);
    ApiResponse.paginated(res, result.data, result);
});
exports.sendMessage = asyncHandler(async (req, res) => {
    const msg = await channelService.sendMessage(req.params.id, req.tenantId, req.user?._id, req.body);
    ApiResponse.created(res, msg);
});
exports.editMessage = asyncHandler(async (req, res) => {
    const msg = await channelService.editMessage(req.params.msgId, req.user?._id, req.body.content);
    ApiResponse.ok(res, msg, 'Message updated');
});
exports.deleteMessage = asyncHandler(async (req, res) => {
    const msg = await channelService.deleteMessage(req.params.msgId, req.user?._id);
    ApiResponse.ok(res, msg, 'Message deleted');
});
exports.toggleReaction = asyncHandler(async (req, res) => {
    const msg = await channelService.toggleReaction(req.params.msgId, req.user?._id, req.body.emoji);
    ApiResponse.ok(res, msg);
});
exports.pinMessage = asyncHandler(async (req, res) => {
    const channelRepo = require('../../repositories/channel.repository');
    await channelRepo.pinMessage(req.params.id, req.params.msgId);
    ApiResponse.ok(res, null, 'Message pinned');
});
exports.unpinMessage = asyncHandler(async (req, res) => {
    const channelRepo = require('../../repositories/channel.repository');
    await channelRepo.unpinMessage(req.params.id, req.params.msgId);
    ApiResponse.ok(res, null, 'Message unpinned');
});
