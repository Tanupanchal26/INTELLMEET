"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTokenPair = exports.clearRefreshCookie = exports.setRefreshCookie = exports.hashToken = exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = __importDefault(require("../config/env"));
const constants_1 = require("../constants");
const refreshToken_model_1 = __importDefault(require("../models/refreshToken.model"));
// Normalise default export across CJS/ESM interop
const RefreshToken = refreshToken_model_1.default.default ?? refreshToken_model_1.default;
// Derive refresh token TTL in ms from the config string (e.g. '7d')
const REFRESH_TTL_MS = constants_1.AUTH.COOKIE_MAX_AGE; // 7 days
const JWT_OPTIONS = {
    issuer: constants_1.JWT_CLAIMS.ISSUER,
    audience: constants_1.JWT_CLAIMS.AUDIENCE,
};
const generateAccessToken = (payload) => jsonwebtoken_1.default.sign(payload, env_1.default.jwt.secret, {
    ...JWT_OPTIONS,
    expiresIn: env_1.default.jwt.expiresIn,
});
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = async (userId) => {
    const token = jsonwebtoken_1.default.sign({ id: userId }, env_1.default.jwt.refreshSecret, {
        ...JWT_OPTIONS,
        expiresIn: env_1.default.jwt.refreshExpiresIn,
    });
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    const hashed = (0, exports.hashToken)(token);
    await RefreshToken.create({ tokenHash: hashed, userId, expiresAt });
    return token;
};
exports.generateRefreshToken = generateRefreshToken;
const verifyAccessToken = (token) => jsonwebtoken_1.default.verify(token, env_1.default.jwt.secret, JWT_OPTIONS);
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = async (token) => {
    const payload = jsonwebtoken_1.default.verify(token, env_1.default.jwt.refreshSecret, JWT_OPTIONS);
    const hashed = (0, exports.hashToken)(token);
    const record = await RefreshToken.findOne({ tokenHash: hashed, userId: payload.id });
    if (!record)
        throw new Error('Refresh token not found or revoked');
    return payload;
};
exports.verifyRefreshToken = verifyRefreshToken;
const hashToken = (token) => crypto_1.default.createHash('sha256').update(token).digest('hex');
exports.hashToken = hashToken;
const setRefreshCookie = (res, refreshToken) => {
    res.cookie(constants_1.COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: constants_1.AUTH.COOKIE_MAX_AGE,
        path: '/',
    });
};
exports.setRefreshCookie = setRefreshCookie;
const clearRefreshCookie = (res) => {
    res.clearCookie(constants_1.COOKIE_NAMES.REFRESH_TOKEN, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
    });
};
exports.clearRefreshCookie = clearRefreshCookie;
const generateTokenPair = async (user) => {
    const accessToken = (0, exports.generateAccessToken)({
        id: String(user._id),
        role: user.role,
        email: user.email,
    });
    const refreshToken = await (0, exports.generateRefreshToken)(String(user._id));
    return { accessToken, refreshToken };
};
exports.generateTokenPair = generateTokenPair;
