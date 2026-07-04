"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = exports.deleteAccount = exports.updateAvatar = exports.updateRole = exports.updateProfile = exports.getUserForAuth = exports.getProfile = void 0;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const User = require('../models/User');
const ApiError_1 = __importDefault(require("../utils/ApiError"));
const logger_1 = __importDefault(require("../shared/utils/logger"));
const sanitizeLog = (val) => String(val).replace(/[\r\n\t\x00-\x1f\x7f]/g, '_');
const invalidateUserCache = async (_userId) => {
    // Redis removed — no-op until Redis is re-enabled
};
const getProfile = async (userId) => {
    const user = await User.findById(userId).select('-password');
    if (!user) {
        logger_1.default.warn(`User not found: ${sanitizeLog(userId)}`);
        throw ApiError_1.default.notFound('User not found');
    }
    return user;
};
exports.getProfile = getProfile;
const getUserForAuth = async (userId) => {
    const user = await User.findById(userId)
        .select('+passwordChangedAt')
        .lean();
    if (!user) {
        logger_1.default.warn(`User not found for auth: ${sanitizeLog(userId)}`);
        return null;
    }
    return user;
};
exports.getUserForAuth = getUserForAuth;
const ALLOWED_UPDATE_FIELDS = ['name', 'avatar', 'bio'];
const ALLOWED_ROLE_VALUES = Object.values({
    super_admin: 'super_admin',
    admin: 'admin',
    member: 'member',
    guest: 'guest',
});
const updateProfile = async (userId, updateData) => {
    // Whitelist — prevent mass-assignment of sensitive fields (role, isVerified, googleId, etc.)
    const safe = Object.fromEntries(Object.entries(updateData).filter(([k]) => ALLOWED_UPDATE_FIELDS.includes(k)));
    if (Object.keys(safe).length === 0)
        throw ApiError_1.default.badRequest('No valid fields to update');
    const user = await User.findByIdAndUpdate(userId, safe, { new: true, runValidators: true }).select('-password');
    if (!user) {
        logger_1.default.warn(`User not found for update: ${sanitizeLog(userId)}`);
        throw ApiError_1.default.notFound('User not found');
    }
    await invalidateUserCache(userId);
    return user;
};
exports.updateProfile = updateProfile;
const updateRole = async (userId, role) => {
    if (!ALLOWED_ROLE_VALUES.includes(role)) {
        throw ApiError_1.default.badRequest('Invalid role');
    }
    const user = await User.findByIdAndUpdate(userId, { role }, { new: true, runValidators: true }).select('-password');
    if (!user) {
        logger_1.default.warn(`User not found for role update: ${sanitizeLog(userId)}`);
        throw ApiError_1.default.notFound('User not found');
    }
    await invalidateUserCache(userId);
    return user;
};
exports.updateRole = updateRole;
const updateAvatar = async (userId, avatarUrl) => {
    const user = await User.findByIdAndUpdate(userId, { avatar: avatarUrl }, { new: true, runValidators: true }).select('-password');
    if (!user)
        throw ApiError_1.default.notFound('User not found');
    await invalidateUserCache(userId);
    return user;
};
exports.updateAvatar = updateAvatar;
const deleteAccount = async (userId) => {
    const result = await User.findByIdAndDelete(userId);
    if (!result) {
        logger_1.default.warn(`User not found for deletion: ${sanitizeLog(userId)}`);
        throw ApiError_1.default.notFound('User not found');
    }
    await invalidateUserCache(userId);
};
exports.deleteAccount = deleteAccount;
const getAllUsers = async (page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
        User.find().select('-password').skip(skip).limit(limit).lean(),
        User.countDocuments(),
    ]);
    return { users, total, page, pages: Math.ceil(total / limit) };
};
exports.getAllUsers = getAllUsers;
exports.default = {
    getProfile: exports.getProfile,
    getUserForAuth: exports.getUserForAuth,
    updateProfile: exports.updateProfile,
    updateRole: exports.updateRole,
    updateAvatar: exports.updateAvatar,
    deleteAccount: exports.deleteAccount,
    getAllUsers: exports.getAllUsers,
};
module.exports = { getProfile: exports.getProfile, getUserForAuth: exports.getUserForAuth, updateProfile: exports.updateProfile, updateRole: exports.updateRole, updateAvatar: exports.updateAvatar, deleteAccount: exports.deleteAccount, getAllUsers: exports.getAllUsers };
module.exports.default = module.exports;
