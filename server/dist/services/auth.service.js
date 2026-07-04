"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockAccount = exports.changePassword = exports.verifyEmail = exports.resetPassword = exports.forgotPassword = exports.refreshTokens = exports.logoutAll = exports.logout = exports.login = exports.signup = void 0;
const userRepo = require('../repositories/user.repository');
const teamRepo = require('../repositories/team.repository');
const channelRepo = require('../repositories/channel.repository');
const Tenant = require('../models/Tenant');
const { ensureUserTenant, toSlug } = require('./tenant.service');
const jwtService = __importStar(require("./jwt.service"));
const emailService = require('./email.service');
const ApiError_1 = __importDefault(require("../utils/ApiError"));
const logger_1 = __importDefault(require("../shared/utils/logger"));
const constants_1 = require("../constants");
const INVALID_CREDENTIALS_MSG = 'Invalid email or password';
const signup = async ({ name, email, password, role }) => {
    const exists = await userRepo.findByEmail(email);
    if (exists)
        throw ApiError_1.default.conflict('An account with this email already exists');
    const user = await userRepo.create({ name, email, password, role });
    await ensureUserTenant(user);
    const rawToken = user.createToken('emailVerify');
    await user.save({ validateBeforeSave: false });
    emailService.sendVerificationEmail(user, rawToken).catch((_error) => undefined);
    const { accessToken, refreshToken } = await jwtService.generateTokenPair(user);
    return { user, accessToken, refreshToken };
};
exports.signup = signup;
const login = async ({ email, password, }) => {
    const user = await userRepo.findByEmailForAuth(email);
    if (!user) {
        logger_1.default.warn(`Login failed: invalid email (${email})`);
        throw ApiError_1.default.unauthorized(INVALID_CREDENTIALS_MSG);
    }
    if (user.status === constants_1.USER_STATUS.BANNED)
        throw ApiError_1.default.forbidden('Your account has been suspended. Contact support.');
    if (user.status === constants_1.USER_STATUS.INACTIVE)
        throw ApiError_1.default.forbidden('Your account is inactive.');
    if (user.isLocked) {
        const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60_000);
        logger_1.default.warn(`Login failed: account locked (${email})`);
        throw ApiError_1.default.forbidden(`Account temporarily locked. Try again in ${minutesLeft} minute(s).`);
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        logger_1.default.warn(`Login failed: invalid password (${email})`);
        await user.incLoginAttempts();
        const remaining = constants_1.AUTH.MAX_LOGIN_ATTEMPTS - (user.loginAttempts + 1);
        const msg = remaining > 0
            ? `${INVALID_CREDENTIALS_MSG}. ${remaining} attempt(s) remaining.`
            : `Account locked for ${constants_1.AUTH.LOCK_DURATION_MINUTES} minutes due to too many failed attempts.`;
        throw ApiError_1.default.unauthorized(msg);
    }
    await user.resetLoginAttempts();
    const { accessToken, refreshToken } = await jwtService.generateTokenPair(user);
    // generateTokenPair writes the hashed token to the RefreshToken collection internally
    return { user, accessToken, refreshToken };
};
exports.login = login;
const logout = async (userId, rawRefreshToken) => {
    if (rawRefreshToken) {
        await userRepo.removeRefreshToken(userId, jwtService.hashToken(rawRefreshToken));
    }
};
exports.logout = logout;
const logoutAll = async (userId) => {
    await userRepo.clearAllRefreshTokens(userId);
};
exports.logoutAll = logoutAll;
const refreshTokens = async (rawRefreshToken) => {
    if (!rawRefreshToken)
        throw ApiError_1.default.unauthorized('Refresh token required');
    let decoded;
    try {
        decoded = await jwtService.verifyRefreshToken(rawRefreshToken);
    }
    catch {
        throw ApiError_1.default.unauthorized('Invalid or expired refresh token');
    }
    const hashedIncoming = jwtService.hashToken(rawRefreshToken);
    const user = await userRepo.findByRefreshToken(hashedIncoming);
    if (!user) {
        await userRepo.clearAllRefreshTokens(decoded.id);
        throw ApiError_1.default.unauthorized('Token reuse detected — all sessions revoked');
    }
    await userRepo.removeRefreshToken(user._id, hashedIncoming);
    const { accessToken, refreshToken: newRefresh } = await jwtService.generateTokenPair(user);
    // generateTokenPair writes the new hashed token to the RefreshToken collection internally
    return { user, accessToken, refreshToken: newRefresh };
};
exports.refreshTokens = refreshTokens;
const forgotPassword = async (email) => {
    const user = await userRepo.findByEmail(email);
    if (!user)
        return; // never reveal whether email exists
    const rawToken = user.createToken('passwordReset');
    await user.save({ validateBeforeSave: false });
    await emailService.sendPasswordResetEmail(user, rawToken).catch((_error) => undefined);
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (rawToken, newPassword) => {
    const user = await userRepo.findByResetToken(rawToken);
    if (!user)
        throw ApiError_1.default.badRequest('Invalid or expired password reset token');
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    return user;
};
exports.resetPassword = resetPassword;
const verifyEmail = async (rawToken) => {
    const user = await userRepo.findByVerifyToken(rawToken);
    if (!user)
        throw ApiError_1.default.badRequest('Invalid or expired verification token');
    user.isVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return user;
};
exports.verifyEmail = verifyEmail;
const changePassword = async (userId, currentPassword, newPassword) => {
    const user = await userRepo.findByIdWithPassword(userId);
    if (!user)
        throw ApiError_1.default.notFound('User not found');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch)
        throw ApiError_1.default.unauthorized('Current password is incorrect');
    user.password = newPassword;
    await user.save();
    return user;
};
exports.changePassword = changePassword;
const unlockAccount = async (userId) => userRepo.updateById(userId, undefined, {
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
});
exports.unlockAccount = unlockAccount;
exports.default = {
    signup: exports.signup,
    login: exports.login,
    logout: exports.logout,
    logoutAll: exports.logoutAll,
    refreshTokens: exports.refreshTokens,
    forgotPassword: exports.forgotPassword,
    resetPassword: exports.resetPassword,
    verifyEmail: exports.verifyEmail,
    changePassword: exports.changePassword,
    unlockAccount: exports.unlockAccount,
};
module.exports = { signup: exports.signup, login: exports.login, logout: exports.logout, logoutAll: exports.logoutAll, refreshTokens: exports.refreshTokens, forgotPassword: exports.forgotPassword, resetPassword: exports.resetPassword, verifyEmail: exports.verifyEmail, changePassword: exports.changePassword, unlockAccount: exports.unlockAccount };
module.exports.default = module.exports;
