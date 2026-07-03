import type { NextFunction, Request, Response } from 'express';

const channelService = require('../../services/channel.service') as {
  createChannel: (...args: unknown[]) => Promise<unknown>;
  getTeamChannels: (...args: unknown[]) => Promise<unknown>;
  getChannel: (...args: unknown[]) => Promise<unknown>;
  updateChannel: (...args: unknown[]) => Promise<unknown>;
  archiveChannel: (...args: unknown[]) => Promise<unknown>;
  getMessages: (...args: unknown[]) => Promise<{ data: unknown; page: number; limit: number; total: number }>;
  sendMessage: (...args: unknown[]) => Promise<unknown>;
  editMessage: (...args: unknown[]) => Promise<unknown>;
  deleteMessage: (...args: unknown[]) => Promise<unknown>;
  toggleReaction: (...args: unknown[]) => Promise<unknown>;
};
const ApiResponse = require('../../utils/ApiResponse').default;
const asyncHandler = require('../../utils/asyncHandler').default as (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => void;

exports.createChannel = asyncHandler(async (req: Request, res: Response) => {
  const channel = await channelService.createChannel(req.params.teamId, req.tenantId, req.user?._id, req.body);
  ApiResponse.created(res, channel, 'Channel created');
});

exports.listChannels = asyncHandler(async (req: Request, res: Response) => {
  const channels = await channelService.getTeamChannels(req.params.teamId, req.tenantId, req.user?._id);
  ApiResponse.ok(res, channels);
});

exports.getChannel = asyncHandler(async (req: Request, res: Response) => {
  const channel = await channelService.getChannel(req.params.id, req.tenantId, req.user?._id);
  ApiResponse.ok(res, channel);
});

exports.updateChannel = asyncHandler(async (req: Request, res: Response) => {
  const channel = await channelService.updateChannel(req.params.id, req.tenantId, req.user?._id, req.body);
  ApiResponse.ok(res, channel, 'Channel updated');
});

exports.archiveChannel = asyncHandler(async (req: Request, res: Response) => {
  const channel = await channelService.archiveChannel(req.params.id, req.tenantId, req.user?._id);
  ApiResponse.ok(res, channel, 'Channel archived');
});

exports.getMessages = asyncHandler(async (req: Request, res: Response) => {
  const result = await channelService.getMessages(req.params.id, req.tenantId, req.user?._id, req.query);
  ApiResponse.paginated(res, result.data, result);
});

exports.sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const msg = await channelService.sendMessage(req.params.id, req.tenantId, req.user?._id, req.body);
  ApiResponse.created(res, msg);
});

exports.editMessage = asyncHandler(async (req: Request, res: Response) => {
  const msg = await channelService.editMessage(req.params.msgId, req.user?._id, (req.body as { content?: string }).content);
  ApiResponse.ok(res, msg, 'Message updated');
});

exports.deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const msg = await channelService.deleteMessage(req.params.msgId, req.user?._id);
  ApiResponse.ok(res, msg, 'Message deleted');
});

exports.toggleReaction = asyncHandler(async (req: Request, res: Response) => {
  const msg = await channelService.toggleReaction(req.params.msgId, req.user?._id, (req.body as { emoji?: string }).emoji);
  ApiResponse.ok(res, msg);
});

exports.pinMessage = asyncHandler(async (req: Request, res: Response) => {
  const channelRepo = require('../../repositories/channel.repository');
  await channelRepo.pinMessage(req.params.id, req.params.msgId);
  ApiResponse.ok(res, null, 'Message pinned');
});

exports.unpinMessage = asyncHandler(async (req: Request, res: Response) => {
  const channelRepo = require('../../repositories/channel.repository');
  await channelRepo.unpinMessage(req.params.id, req.params.msgId);
  ApiResponse.ok(res, null, 'Message unpinned');
});

export {};
