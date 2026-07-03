// @ts-nocheck
const jwtService = require('./jwt.service');
const userRepo   = require('../repositories/user.repository');

const googleLogin = async (user) => {
  const { accessToken, refreshToken } = await jwtService.generateTokenPair(user);
  // generateTokenPair writes the hashed token to the RefreshToken collection internally
  await userRepo.updateLastLogin(user._id);
  return { user, accessToken, refreshToken };
};

module.exports = { googleLogin };

export {};
