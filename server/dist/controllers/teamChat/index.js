"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const teamChatService = require('../../services/teamChat.service');
const ApiResponse = require('../../utils/ApiResponse').default;
const asyncHandler = require('../../utils/asyncHandler').default;
exports.getMessages = asyncHandler(async (req, res) => {
    const { teamId } = req.params;
    const messages = await teamChatService.getMessages(teamId, req.tenantId, req.user?._id, {
        limit: req.query.limit,
        cursor: req.query.cursor
    });
    ApiResponse.ok(res, messages);
});
exports.sendMessage = asyncHandler(async (req, res) => {
    const { teamId } = req.params;
    const message = await teamChatService.sendMessage(teamId, req.tenantId, req.user?._id, req.body);
    ApiResponse.created(res, message);
});
exports.editMessage = asyncHandler(async (req, res) => {
    const { teamId, messageId } = req.params;
    const message = await teamChatService.editMessage(teamId, messageId, req.tenantId, req.user?._id, req.body.content);
    ApiResponse.ok(res, message);
});
exports.deleteMessage = asyncHandler(async (req, res) => {
    const { teamId, messageId } = req.params;
    await teamChatService.deleteMessage(teamId, messageId, req.tenantId, req.user?._id);
    ApiResponse.noContent(res);
});
exports.toggleReaction = asyncHandler(async (req, res) => {
    const { teamId, messageId } = req.params;
    const reactions = await teamChatService.toggleReaction(teamId, messageId, req.tenantId, req.user?._id, req.body.emoji);
    ApiResponse.ok(res, reactions);
});
