// @ts-nocheck
const googleAuthService = require('../../services/googleAuth.service');
const config = require('../../config/env');
const { AUTH } = require('../../constants');

exports.googleCallback = async (req, res) => {
  try {
    const logger = require('../../shared/utils/logger').default;
    logger.info('[Google OAuth] callback hit', { hasUser: !!req.user, userId: req.user?._id });

    if (!req.user) {
      logger.warn('[Google OAuth] no user on req — passport did not populate req.user');
      return res.redirect(`${config.clientUrl}/login?error=${encodeURIComponent('Google sign-in failed — no user session.')}`);
    }
    const { user, accessToken, refreshToken } = await googleAuthService.googleLogin(req.user);
    logger.info('[Google OAuth] tokens generated', { userId: user._id });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure:   true,
      sameSite: 'none',
      maxAge:   AUTH.COOKIE_MAX_AGE,
      path:     '/',
    });

    // Pass access token via URL param — cross-origin cookies are blocked by browsers
    return res.redirect(`${config.clientUrl}/auth/google/success?token=${encodeURIComponent(accessToken)}`);
  } catch (err) {
    const logger = require('../../shared/utils/logger').default;
    logger.error('[Google OAuth] callback error', { message: err.message, stack: err.stack });
    return res.redirect(`${config.clientUrl}/login?error=${encodeURIComponent('Google sign-in failed.')}`);
  }
};

export {};
