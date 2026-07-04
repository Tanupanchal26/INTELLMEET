"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BaseRepository = require('./base.repository');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const User = require('../models/User');
const refreshToken_model_1 = __importDefault(require("../models/refreshToken.model"));
// Normalise default export across CJS/ESM interop
const RefreshToken = refreshToken_model_1.default.default ?? refreshToken_model_1.default;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
class UserRepository extends BaseRepository {
    constructor() { super(User); }
    // ── Auth queries ───────────────────────────────────────────────────────────
    findByEmailForAuth(email) {
        return User.findOne({ email })
            .select('+password +loginAttempts +lockUntil');
    }
    findByEmail(email) {
        return User.findOne({ email });
    }
    findByResetToken(rawToken) {
        const hashed = crypto_1.default.createHash('sha256').update(rawToken).digest('hex');
        return User.findOne({
            passwordResetToken: hashed,
            passwordResetExpires: { $gt: Date.now() },
        }).select('+passwordResetToken +passwordResetExpires +passwordChangedAt');
    }
    findByVerifyToken(rawToken) {
        const hashed = crypto_1.default.createHash('sha256').update(rawToken).digest('hex');
        return User.findOne({
            emailVerifyToken: hashed,
            emailVerifyExpires: { $gt: Date.now() },
        }).select('+emailVerifyToken +emailVerifyExpires');
    }
    findByIdWithPassword(id) {
        return User.findById(id).select('+password +passwordChangedAt');
    }
    // ── Refresh token management ───────────────────────────────────────────────
    addRefreshToken(userId, hashedToken) {
        const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
        return RefreshToken.create({ tokenHash: hashedToken, userId, expiresAt });
    }
    removeRefreshToken(_userId, hashedToken) {
        return RefreshToken.deleteOne({ tokenHash: hashedToken });
    }
    clearAllRefreshTokens(userId) {
        return RefreshToken.deleteMany({ userId });
    }
    async findByRefreshToken(hashedToken) {
        const record = await RefreshToken.findOne({ tokenHash: hashedToken });
        if (!record)
            return null;
        return User.findById(record.userId);
    }
    updateLastLogin(userId) {
        return User.findByIdAndUpdate(userId, { lastLogin: new Date() });
    }
}
const userRepository = new UserRepository();
exports.default = userRepository;
module.exports = userRepository;
