// @ts-nocheck
const mediaService = require('../../services/media.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse  = require('../../utils/ApiResponse').default;
const ApiError     = require('../../utils/ApiError');

exports.upload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file provided');
  const media = await mediaService.uploadMedia(req.file, req.tenantId, req.user._id);
  ApiResponse.created(res, media, 'File uploaded');
});

exports.list = asyncHandler(async (req, res) => {
  const list = await mediaService.getMediaList(req.tenantId);
  ApiResponse.ok(res, list, 'Media retrieved');
});

exports.delete = asyncHandler(async (req, res) => {
  await mediaService.deleteMedia(req.params.id, req.tenantId, req.user._id);
  ApiResponse.noContent(res);
});

export {};
