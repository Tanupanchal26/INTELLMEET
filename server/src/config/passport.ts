import passport from 'passport';
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20';
import crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const User = require('../models/User');
const { ensureUserTenant } = require('../services/tenant.service');
import config from './env';
import logger from '../shared/utils/logger';

if (!config.google.clientId || !config.google.clientSecret) {
  logger.warn('[Passport] Google OAuth skipped — GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set');
} else {
  passport.use(
    new GoogleStrategy(
      {
        clientID:     config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL:  config.google.callbackUrl,
      },
      async (_accessToken: string, _refreshToken: string, profile: Profile, done: Function) => {
        try {
          const email       = profile.emails?.[0]?.value;
          const avatar      = profile.photos?.[0]?.value ?? '';
          const googleId    = profile.id;
          const displayName = profile.displayName ?? profile.name?.givenName ?? 'User';

          if (!email) return done(new Error('No email from Google account'));

          // Existing Google-linked user
          let user = await User.findOne({ googleId });
          if (user) {
            user = await ensureUserTenant(user);
            await User.findByIdAndUpdate(user._id, {
              lastLogin: new Date(),
              avatar:    avatar || user.avatar,
            });
            return done(null, user);
          }

          // Existing email user — link Google
          user = await User.findOne({ email });
          if (user) {
            user = await ensureUserTenant(user);
            user = await User.findByIdAndUpdate(
              user._id,
              {
                googleId,
                provider:      'google',
                emailVerified: true,
                isVerified:    true,
                avatar:        user.avatar || avatar,
                lastLogin:     new Date(),
              },
              { new: true }
            );
            return done(null, user!);
          }

          // New user via Google
          user = await User.create({
            name:          displayName,
            email,
            googleId,
            provider:      'google',
            avatar,
            emailVerified: true,
            isVerified:    true,
            password:      crypto.randomBytes(32).toString('hex'),
            status:        'active',
          });
          user = await ensureUserTenant(user);

          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

passport.serializeUser((user: Express.User, done: Function) => {
  done(null, (user as unknown as { _id: { toString(): string } })._id.toString());
});

passport.deserializeUser(async (id: string, done: Function) => {
  try {
    done(null, await User.findById(id));
  } catch (err) {
    done(err, null);
  }
});

export default passport;
module.exports = passport;
module.exports.default = passport;
