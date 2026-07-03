import type { Request, Response, NextFunction } from 'express';

const teamChatService = require('../../services/teamChat.service') as any;
const ApiResponse = require('../../utils/ApiResponse').default;
const asyncHandler = require('../../utils/asyncHandler').default as any;

exports.getMessages = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.params;
  const messages = await teamChatService.getMessages(teamId, (req as any).tenantId, (req as any).user?._id, {
    limit: req.query.limit,
    cursor: req.query.cursor
  });
  ApiResponse.ok(res, messages);
});

exports.sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.params;
  const message = await teamChatService.sendMessage(teamId, (req as any).tenantId, (req as any).user?._id, req.body);
  ApiResponse.created(res, message);
});

exports.editMessage = asyncHandler(async (req: Request, res: Response) => {
  const { teamId, messageId } = req.params;
  const message = await teamChatService.editMessage(teamId, messageId, (req as any).tenantId, (req as any).user?._id, req.body.content);
  ApiResponse.ok(res, message);
});

exports.deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const { teamId, messageId } = req.params;
  await teamChatService.deleteMessage(teamId, messageId, (req as any).tenantId, (req as any).user?._id);
  ApiResponse.noContent(res);
});

exports.toggleReaction = asyncHandler(async (req: Request, res: Response) => {
  const { teamId, messageId } = req.params;
  const reactions = await teamChatService.toggleReaction(teamId, messageId, (req as any).tenantId, (req as any).user?._id, req.body.emoji);
  ApiResponse.ok(res, reactions);
});

export {};
