// @ts-nocheck
const googleAuthService = require('../../services/googleAuth.service');
const config = require('../../config/env');
const { AUTH } = require('../../constants');

exports.googleCallback = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(`${config.clientUrl}/login?error=${encodeURIComponent('Google sign-in failed — no user session.')}`);
    }
    const { user, accessToken, refreshToken } = await googleAuthService.googleLogin(req.user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure:   true,
      sameSite: 'none',
      maxAge:   AUTH.COOKIE_MAX_AGE,
      path:     '/',
    });

    // Short-lived readable cookie — frontend reads once then discards
    res.cookie('__oauth_token', accessToken, {
      httpOnly: false,
      secure:   config.isProd,
      sameSite: 'lax',
      maxAge:   60 * 1000,
      path:     '/',
    });

    return res.redirect(`${config.clientUrl}/auth/google/success`);
  } catch (err) {
    const logger = require('../../shared/utils/logger').default;
    logger.error('[Google OAuth] callback error', { message: err.message });
    return res.redirect(`${config.clientUrl}/login?error=${encodeURIComponent('Google sign-in failed.')}`);
  }
};

export {};
