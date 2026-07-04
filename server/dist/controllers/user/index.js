"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse').default;
const ApiError = require('../../utils/ApiError');
const logger = require('../../shared/utils/logger').default;
const userService = require('../../services/user.service');
const cloudinary = require('../../config/cloudinary');
// Get current user's profile
exports.getProfile = asyncHandler(async (req, res) => {
    const user = await userService.getProfile(req.user._id);
    ApiResponse.ok(res, user, 'Profile retrieved');
});
// Update current user's profile
exports.updateProfile = asyncHandler(async (req, res) => {
    const user = await userService.updateProfile(req.user._id, req.body);
    ApiResponse.ok(res, { user }, 'Profile updated');
});
// Update a user's role (admin only)
exports.updateRole = asyncHandler(async (req, res) => {
    const user = await userService.updateRole(req.params.userId, req.body.role);
    ApiResponse.ok(res, { user }, 'Role updated');
});
// Upload avatar — POST /users/avatar
exports.uploadAvatar = asyncHandler(async (req, res) => {
    if (!req.file)
        throw ApiError.badRequest('No file uploaded');
    if (!req.file.mimetype.startsWith('image/'))
        throw ApiError.badRequest('File must be an image');
    if (req.file.size > 8 * 1024 * 1024)
        throw ApiError.badRequest('Image must be under 8 MB');
    let result;
    try {
        result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({
                folder: 'intellmeet/avatars',
                public_id: `avatar_${req.user._id}`,
                overwrite: true,
                transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }],
                resource_type: 'image',
            }, (err, res) => (err ? reject(err) : resolve(res)));
            stream.end(req.file.buffer);
        });
    }
    catch (err) {
        throw ApiError.internal(`Cloudinary upload failed: ${err?.message ?? err}`);
    }
    const avatarUrl = result.secure_url;
    const user = await userService.updateAvatar(req.user._id, avatarUrl);
    ApiResponse.ok(res, { user, avatarUrl }, 'Avatar updated');
});
// Delete current user's account
exports.deleteAccount = asyncHandler(async (req, res) => {
    await userService.deleteAccount(req.user._id);
    ApiResponse.ok(res, null, 'Account deleted');
});
// Get all users (admin)
exports.getAllUsers = asyncHandler(async (req, res) => {
    const users = await userService.getAllUsers();
    ApiResponse.ok(res, users, 'Users list retrieved');
});
