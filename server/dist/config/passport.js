"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const crypto_1 = __importDefault(require("crypto"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const User = require('../models/User');
const { ensureUserTenant } = require('../services/tenant.service');
const env_1 = __importDefault(require("./env"));
const logger_1 = __importDefault(require("../shared/utils/logger"));
if (!env_1.default.google.clientId || !env_1.default.google.clientSecret) {
    logger_1.default.warn('[Passport] Google OAuth skipped — GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set');
}
else {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: env_1.default.google.clientId,
        clientSecret: env_1.default.google.clientSecret,
        callbackURL: env_1.default.google.callbackUrl,
    }, async (_accessToken, _refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            const avatar = profile.photos?.[0]?.value ?? '';
            const googleId = profile.id;
            const displayName = profile.displayName ?? profile.name?.givenName ?? 'User';
            if (!email)
                return done(new Error('No email from Google account'));
            // Existing Google-linked user
            let user = await User.findOne({ googleId });
            if (user) {
                user = await ensureUserTenant(user);
                await User.findByIdAndUpdate(user._id, {
                    lastLogin: new Date(),
                    avatar: avatar || user.avatar,
                });
                return done(null, user);
            }
            // Existing email user — link Google
            user = await User.findOne({ email });
            if (user) {
                user = await ensureUserTenant(user);
                user = await User.findByIdAndUpdate(user._id, {
                    googleId,
                    provider: 'google',
                    emailVerified: true,
                    isVerified: true,
                    avatar: user.avatar || avatar,
                    lastLogin: new Date(),
                }, { new: true });
                return done(null, user);
            }
            // New user via Google
            user = await User.create({
                name: displayName,
                email,
                googleId,
                provider: 'google',
                avatar,
                emailVerified: true,
                isVerified: true,
                password: crypto_1.default.randomBytes(32).toString('hex'),
                status: 'active',
            });
            user = await ensureUserTenant(user);
            return done(null, user);
        }
        catch (err) {
            return done(err);
        }
    }));
}
passport_1.default.serializeUser((user, done) => {
    done(null, user._id.toString());
});
passport_1.default.deserializeUser(async (id, done) => {
    try {
        done(null, await User.findById(id));
    }
    catch (err) {
        done(err, null);
    }
});
exports.default = passport_1.default;
module.exports = passport_1.default;
module.exports.default = passport_1.default;
