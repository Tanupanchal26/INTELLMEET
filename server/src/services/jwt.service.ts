import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Response } from 'express';
import config from '../config/env';
import { AUTH, COOKIE_NAMES, JWT_CLAIMS } from '../constants';
import RefreshTokenModel from '../models/refreshToken.model';

// Normalise default export across CJS/ESM interop
const RefreshToken = (RefreshTokenModel as unknown as { default?: typeof RefreshTokenModel }).default ?? RefreshTokenModel;

export interface AccessTokenPayload {
  id:    string;
  role:  string;
  email: string;
}

export interface RefreshTokenPayload {
  id: string;
}

export interface TokenPair {
  accessToken:  string;
  refreshToken: string;
}

// Derive refresh token TTL in ms from the config string (e.g. '7d')
const REFRESH_TTL_MS = AUTH.COOKIE_MAX_AGE; // 7 days

const JWT_OPTIONS = {
  issuer:   JWT_CLAIMS.ISSUER,
  audience: JWT_CLAIMS.AUDIENCE,
} as const;

export const generateAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, config.jwt.secret, {
    ...JWT_OPTIONS,
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });

export const generateRefreshToken = async (userId: string): Promise<string> => {
  const token = jwt.sign({ id: userId }, config.jwt.refreshSecret, {
    ...JWT_OPTIONS,
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });

  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const hashed    = hashToken(token);

  await RefreshToken.create({ tokenHash: hashed, userId, expiresAt });
  return token;
};

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, config.jwt.secret, JWT_OPTIONS) as AccessTokenPayload;

export const verifyRefreshToken = async (token: string): Promise<RefreshTokenPayload> => {
  const payload = jwt.verify(token, config.jwt.refreshSecret, JWT_OPTIONS) as RefreshTokenPayload;
  const hashed  = hashToken(token);
  const record  = await RefreshToken.findOne({ tokenHash: hashed, userId: payload.id });
  if (!record) throw new Error('Refresh token not found or revoked');
  return payload;
};

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const setRefreshCookie = (res: Response, refreshToken: string): void => {
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
    httpOnly: true,
    secure:   config.isProd,
    sameSite: config.isProd ? 'strict' : 'lax',
    maxAge:   AUTH.COOKIE_MAX_AGE,
    path:     '/',
  });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, {
    httpOnly: true,
    secure:   config.isProd,
    sameSite: config.isProd ? 'strict' : 'lax',
    path:     '/',
  });
};

export const generateTokenPair = async (user: {
  _id: unknown;
  role: string;
  email: string;
}): Promise<TokenPair> => {
  const accessToken  = generateAccessToken({
    id:    String(user._id),
    role:  user.role,
    email: user.email,
  });
  const refreshToken = await generateRefreshToken(String(user._id));
  return { accessToken, refreshToken };
};
