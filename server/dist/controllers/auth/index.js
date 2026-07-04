"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jwt_service_1 = require("../../services/jwt.service");
const authService = require('../../services/auth.service');
const asyncHandler = require('../../utils/asyncHandler').default;
const ApiResponse = require('../../utils/ApiResponse').default;
const ApiError = require('../../utils/ApiError');
const logger = require('../../shared/utils/logger').default;
const { addToBlacklist } = require('../../utils/redisBlacklist');
const getRefreshToken = (req) => req.cookies?.refreshToken ||
    req.body?.refreshToken;
const userPayload = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    isVerified: user.isVerified,
    status: user.status,
    lastLogin: user.lastLogin,
    tenantId: user.tenantId,
});
exports.signup = asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;
    const { user, accessToken, refreshToken } = await authService.signup({
        name: name ?? '', email: email ?? '', password: password ?? '', role,
    });
    (0, jwt_service_1.setRefreshCookie)(res, refreshToken);
    return ApiResponse.created(res, { user: userPayload(user), accessToken }, 'Account created. Please verify your email.');
});
exports.login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.login({ email: email ?? '', password: password ?? '' });
    (0, jwt_service_1.setRefreshCookie)(res, refreshToken);
    return ApiResponse.ok(res, { user: userPayload(user), accessToken }, 'Login successful');
});
exports.logout = asyncHandler(async (req, res) => {
    const rawRefreshToken = getRefreshToken(req);
    const accessToken = req.headers.authorization?.split(' ')[1] ?? req.headers['x-access-token'];
    if (accessToken)
        await addToBlacklist(accessToken);
    await authService.logout(String(req.user?._id ?? ''), rawRefreshToken);
    (0, jwt_service_1.clearRefreshCookie)(res);
    return ApiResponse.ok(res, null, 'Logged out successfully');
});
exports.logoutAll = asyncHandler(async (req, res) => {
    await authService.logoutAll(String(req.user?._id ?? ''));
    (0, jwt_service_1.clearRefreshCookie)(res);
    return ApiResponse.ok(res, null, 'All sessions terminated');
});
exports.refreshToken = asyncHandler(async (req, res) => {
    const rawToken = getRefreshToken(req);
    if (!rawToken) {
        logger.warn('Refresh failed: missing refresh token');
        throw ApiError.unauthorized('Refresh token required');
    }
    const { user, accessToken, refreshToken } = await authService.refreshTokens(rawToken);
    (0, jwt_service_1.setRefreshCookie)(res, refreshToken);
    return ApiResponse.ok(res, { user: userPayload(user), accessToken }, 'Token refreshed');
});
exports.forgotPassword = asyncHandler(async (req, res) => {
    await authService.forgotPassword(req.body?.email ?? '');
    return ApiResponse.ok(res, null, 'If an account with that email exists, a reset link has been sent.');
});
exports.resetPassword = asyncHandler(async (req, res) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    await authService.resetPassword(token, req.body?.password ?? '');
    return ApiResponse.ok(res, null, 'Password reset successful. Please log in with your new password.');
});
exports.verifyEmail = asyncHandler(async (req, res) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    await authService.verifyEmail(token);
    return ApiResponse.ok(res, null, 'Email verified successfully');
});
exports.changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(String(req.user?._id ?? ''), currentPassword ?? '', newPassword ?? '');
    return ApiResponse.ok(res, null, 'Password changed successfully. All other sessions have been terminated.');
});
exports.getMe = asyncHandler(async (req, res) => ApiResponse.ok(res, userPayload((req.user ?? {})), 'Profile retrieved'));
exports.unlockAccount = asyncHandler(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await authService.unlockAccount(id);
    return ApiResponse.ok(res, null, 'Account unlocked successfully');
});
