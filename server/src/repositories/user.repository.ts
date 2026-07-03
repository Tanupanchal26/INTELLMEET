import crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BaseRepository = require('./base.repository');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const User = require('../models/User');
import RefreshTokenModel from '../models/refreshToken.model';

// Normalise default export across CJS/ESM interop
const RefreshToken = (RefreshTokenModel as unknown as { default?: typeof RefreshTokenModel }).default ?? RefreshTokenModel;

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

class UserRepository extends BaseRepository {
  constructor() { super(User); }

  // ── Auth queries ───────────────────────────────────────────────────────────

  findByEmailForAuth(email: string) {
    return User.findOne({ email })
      .select('+password +loginAttempts +lockUntil');
  }

  findByEmail(email: string) {
    return User.findOne({ email });
  }

  findByResetToken(rawToken: string) {
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
    return User.findOne({
      passwordResetToken:   hashed,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires +passwordChangedAt');
  }

  findByVerifyToken(rawToken: string) {
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
    return User.findOne({
      emailVerifyToken:   hashed,
      emailVerifyExpires: { $gt: Date.now() },
    }).select('+emailVerifyToken +emailVerifyExpires');
  }

  findByIdWithPassword(id: string) {
    return User.findById(id).select('+password +passwordChangedAt');
  }

  // ── Refresh token management ───────────────────────────────────────────────

  addRefreshToken(userId: string, hashedToken: string) {
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    return RefreshToken.create({ tokenHash: hashedToken, userId, expiresAt });
  }

  removeRefreshToken(_userId: string, hashedToken: string) {
    return RefreshToken.deleteOne({ tokenHash: hashedToken });
  }

  clearAllRefreshTokens(userId: string) {
    return RefreshToken.deleteMany({ userId });
  }

  async findByRefreshToken(hashedToken: string) {
    const record = await RefreshToken.findOne({ tokenHash: hashedToken });
    if (!record) return null;
    return User.findById(record.userId);
  }

  updateLastLogin(userId: string) {
    return User.findByIdAndUpdate(userId, { lastLogin: new Date() });
  }
}

const userRepository = new UserRepository();
export default userRepository;
module.exports = userRepository;
