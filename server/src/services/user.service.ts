// eslint-disable-next-line @typescript-eslint/no-require-imports
const User = require('../models/User');
import ApiError from '../utils/ApiError';
import logger from '../shared/utils/logger';
import type { Document } from 'mongoose';

const sanitizeLog = (val: unknown): string =>
  String(val).replace(/[\r\n\t\x00-\x1f\x7f]/g, '_');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserDoc = Document & Record<string, any>;

const invalidateUserCache = async (_userId: string): Promise<void> => {
  // Redis removed — no-op until Redis is re-enabled
};

export const getProfile = async (userId: string): Promise<UserDoc> => {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    logger.warn(`User not found: ${sanitizeLog(userId)}`);
    throw ApiError.notFound('User not found');
  }

  return user as UserDoc;
};

export const getUserForAuth = async (userId: string): Promise<UserDoc> => {
  const user = await User.findById(userId)
    .select('+passwordChangedAt')
    .lean();
  if (!user) {
    logger.warn(`User not found for auth: ${sanitizeLog(userId)}`);
    return null as unknown as UserDoc;
  }
  return user as UserDoc;
};

const ALLOWED_UPDATE_FIELDS: ReadonlyArray<string> = ['name', 'avatar', 'bio'];
const ALLOWED_ROLE_VALUES = Object.values({
  super_admin: 'super_admin',
  admin: 'admin',
  member: 'member',
  guest: 'guest',
});

export const updateProfile = async (userId: string, updateData: Record<string, unknown>): Promise<UserDoc> => {
  // Whitelist — prevent mass-assignment of sensitive fields (role, isVerified, googleId, etc.)
  const safe = Object.fromEntries(
    Object.entries(updateData).filter(([k]) => ALLOWED_UPDATE_FIELDS.includes(k))
  );

  if (Object.keys(safe).length === 0) throw ApiError.badRequest('No valid fields to update');

  const user = await User.findByIdAndUpdate(userId, safe, { new: true, runValidators: true }).select('-password');
  if (!user) {
    logger.warn(`User not found for update: ${sanitizeLog(userId)}`);
    throw ApiError.notFound('User not found');
  }
  await invalidateUserCache(userId);
  return user as UserDoc;
};

export const updateRole = async (userId: string, role: string): Promise<UserDoc> => {
  if (!ALLOWED_ROLE_VALUES.includes(role)) {
    throw ApiError.badRequest('Invalid role');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    logger.warn(`User not found for role update: ${sanitizeLog(userId)}`);
    throw ApiError.notFound('User not found');
  }

  await invalidateUserCache(userId);
  return user as UserDoc;
};

export const updateAvatar = async (userId: string, avatarUrl: string): Promise<UserDoc> => {
  const user = await User.findByIdAndUpdate(
    userId,
    { avatar: avatarUrl },
    { new: true, runValidators: true }
  ).select('-password');
  if (!user) throw ApiError.notFound('User not found');
  await invalidateUserCache(userId);
  return user as UserDoc;
};

export const deleteAccount = async (userId: string): Promise<void> => {
  const result = await User.findByIdAndDelete(userId);
  if (!result) {
    logger.warn(`User not found for deletion: ${sanitizeLog(userId)}`);
    throw ApiError.notFound('User not found');
  }
  await invalidateUserCache(userId);
};

export const getAllUsers = async (
  page  = 1,
  limit = 20,
): Promise<{ users: UserDoc[]; total: number; page: number; pages: number }> => {
  const skip  = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find().select('-password').skip(skip).limit(limit).lean(),
    User.countDocuments(),
  ]);
  return { users, total, page, pages: Math.ceil(total / limit) };
};

export default {
  getProfile,
  getUserForAuth,
  updateProfile,
  updateRole,
  updateAvatar,
  deleteAccount,
  getAllUsers,
};
module.exports = { getProfile, getUserForAuth, updateProfile, updateRole, updateAvatar, deleteAccount, getAllUsers };
module.exports.default = module.exports;
