import { Document } from 'mongoose';
const userRepo = require('../repositories/user.repository');
const teamRepo = require('../repositories/team.repository');
const channelRepo = require('../repositories/channel.repository');
const Tenant = require('../models/Tenant');
const { ensureUserTenant, toSlug } = require('./tenant.service');
import * as jwtService from './jwt.service';
const emailService = require('./email.service');
import ApiError from '../utils/ApiError';
import logger from '../shared/utils/logger';
import { USER_STATUS, AUTH, PLANS } from '../constants';

const INVALID_CREDENTIALS_MSG = 'Invalid email or password';

export interface SignupPayload {
  name:     string;
  email:    string;
  password: string;
  role?:    string;
}

export interface AuthResult {
  user:         unknown;
  accessToken:  string;
  refreshToken: string;
}

export const signup = async ({ name, email, password, role }: SignupPayload): Promise<AuthResult> => {
  const exists = await userRepo.findByEmail(email);
  if (exists) throw ApiError.conflict('An account with this email already exists');

  const user = await userRepo.create({ name, email, password, role });

  await ensureUserTenant(user);

  const rawToken = user.createToken('emailVerify');
  await user.save({ validateBeforeSave: false });

  emailService.sendVerificationEmail(user, rawToken).catch((_error: unknown): void => undefined);

  const { accessToken, refreshToken } = await jwtService.generateTokenPair(user);

  return { user, accessToken, refreshToken };
};

export const login = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<AuthResult> => {
  const user = await userRepo.findByEmailForAuth(email);

  if (!user) {
    logger.warn(`Login failed: invalid email (${email})`);
    throw ApiError.unauthorized(INVALID_CREDENTIALS_MSG);
  }

  if (user.status === USER_STATUS.BANNED)
    throw ApiError.forbidden('Your account has been suspended. Contact support.');
  if (user.status === USER_STATUS.INACTIVE)
    throw ApiError.forbidden('Your account is inactive.');

  if (user.isLocked) {
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60_000);
    logger.warn(`Login failed: account locked (${email})`);
    throw ApiError.forbidden(
      `Account temporarily locked. Try again in ${minutesLeft} minute(s).`
    );
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    logger.warn(`Login failed: invalid password (${email})`);
    await user.incLoginAttempts();
    const remaining = AUTH.MAX_LOGIN_ATTEMPTS - (user.loginAttempts + 1);
    const msg = remaining > 0
      ? `${INVALID_CREDENTIALS_MSG}. ${remaining} attempt(s) remaining.`
      : `Account locked for ${AUTH.LOCK_DURATION_MINUTES} minutes due to too many failed attempts.`;
    throw ApiError.unauthorized(msg);
  }

  await user.resetLoginAttempts();

  const { accessToken, refreshToken } = await jwtService.generateTokenPair(user);
  // generateTokenPair writes the hashed token to the RefreshToken collection internally

  return { user, accessToken, refreshToken };
};

export const logout = async (userId: string, rawRefreshToken?: string): Promise<void> => {
  if (rawRefreshToken) {
    await userRepo.removeRefreshToken(userId, jwtService.hashToken(rawRefreshToken));
  }
};

export const logoutAll = async (userId: string): Promise<void> => {
  await userRepo.clearAllRefreshTokens(userId);
};

export const refreshTokens = async (rawRefreshToken: string): Promise<AuthResult> => {
  if (!rawRefreshToken) throw ApiError.unauthorized('Refresh token required');

  let decoded: { id: string };
  try {
    decoded = await jwtService.verifyRefreshToken(rawRefreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const hashedIncoming = jwtService.hashToken(rawRefreshToken);
  const user           = await userRepo.findByRefreshToken(hashedIncoming);

  if (!user) {
    await userRepo.clearAllRefreshTokens(decoded.id);
    throw ApiError.unauthorized('Token reuse detected — all sessions revoked');
  }

  await userRepo.removeRefreshToken(user._id, hashedIncoming);
  const { accessToken, refreshToken: newRefresh } = await jwtService.generateTokenPair(user);
  // generateTokenPair writes the new hashed token to the RefreshToken collection internally

  return { user, accessToken, refreshToken: newRefresh };
};

export const forgotPassword = async (email: string): Promise<void> => {
  const user = await userRepo.findByEmail(email);
  if (!user) return; // never reveal whether email exists

  const rawToken = user.createToken('passwordReset');
  await user.save({ validateBeforeSave: false });
  await emailService.sendPasswordResetEmail(user, rawToken).catch((_error: unknown): void => undefined);
};

export const resetPassword = async (rawToken: string, newPassword: string): Promise<Document> => {
  const user = await userRepo.findByResetToken(rawToken);
  if (!user) throw ApiError.badRequest('Invalid or expired password reset token');

  user.password             = newPassword;
  user.passwordResetToken   = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  return user;
};

export const verifyEmail = async (rawToken: string): Promise<Document> => {
  const user = await userRepo.findByVerifyToken(rawToken);
  if (!user) throw ApiError.badRequest('Invalid or expired verification token');

  user.isVerified        = true;
  user.emailVerifyToken   = undefined;
  user.emailVerifyExpires = undefined;
  await user.save({ validateBeforeSave: false });
  return user;
};

export const changePassword = async (
  userId:          string,
  currentPassword: string,
  newPassword:     string
): Promise<Document> => {
  const user = await userRepo.findByIdWithPassword(userId);
  if (!user) throw ApiError.notFound('User not found');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw ApiError.unauthorized('Current password is incorrect');

  user.password = newPassword;
  await user.save();
  return user;
};

export const unlockAccount = async (userId: string): Promise<Document> =>
  userRepo.updateById(userId, undefined, {
    $set:   { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });

export default {
  signup,
  login,
  logout,
  logoutAll,
  refreshTokens,
  forgotPassword,
  resetPassword,
  verifyEmail,
  changePassword,
  unlockAccount,
};
module.exports = { signup, login, logout, logoutAll, refreshTokens, forgotPassword, resetPassword, verifyEmail, changePassword, unlockAccount };
module.exports.default = module.exports;
