import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Types } from 'mongoose';
import { isBlacklisted } from '../utils/redisBlacklist';
import { verifyAccessToken, AccessTokenPayload } from '../services/jwt.service';
import ApiError from '../utils/ApiError';
import asyncHandler from '../utils/asyncHandler';
import { ROLES, ROLE_HIERARCHY, USER_STATUS } from '../constants';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const User = require('../models/User');

type AuthenticatedRequest = Request & {
  user?: {
    _id?: Types.ObjectId | string;
    tenantId?: Types.ObjectId | string | null;
    name?: string;
    role?: string;
    status?: string;
    passwordChangedAt?: Date | null;
    save?: () => Promise<unknown>;
  };
};

const extractBearerToken = (req: Request): string | null =>
  req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : (req.headers['x-access-token'] as string | undefined)
      ?? (req.query.token as string | undefined)
      ?? null;

export const authenticate: RequestHandler = asyncHandler(async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const token = extractBearerToken(req);
  if (!token) throw ApiError.unauthorized('Access token required');

  let decoded: AccessTokenPayload & { iat?: number };
  try {
    decoded = verifyAccessToken(token) as AccessTokenPayload & { iat?: number };
  } catch (err) {
    const msg = (err as Error).name === 'TokenExpiredError'
      ? 'Access token expired'
      : 'Invalid access token';
    throw ApiError.unauthorized(msg);
  }

  if (await isBlacklisted(token)) throw ApiError.unauthorized('Token revoked');

  // Fetch only non-sensitive fields for the request context
  const user = await User.findById(decoded.id)
    .select('+passwordChangedAt')
    .lean() as (AuthenticatedRequest['user'] & { passwordChangedAt?: Date }) | null;

  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (user.status === USER_STATUS.BANNED)
    throw ApiError.forbidden('Account suspended. Contact support.');
  if (user.status === USER_STATUS.LOCKED)
    throw ApiError.forbidden('Account is locked.');
  if (user.status === USER_STATUS.INACTIVE)
    throw ApiError.forbidden('Account is inactive.');

  // Invalidate tokens issued before a password change
  if (user.passwordChangedAt) {
    const tokenIssuedAtMs = (decoded.iat ?? 0) * 1000;
    if (user.passwordChangedAt.getTime() > tokenIssuedAtMs) {
      throw ApiError.unauthorized('Password recently changed. Please log in again.');
    }
  }

  req.user = user;
  next();
});

export const protect = authenticate;

export const authorize = (...roles: string[]): RequestHandler =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized('Not authenticated');

    const allowedRoles = [...roles];
    if (roles.includes(ROLES.ADMIN) && !allowedRoles.includes(ROLES.SUPER_ADMIN)) {
      allowedRoles.push(ROLES.SUPER_ADMIN);
    }

    if (!allowedRoles.includes(req.user.role as string)) {
      throw ApiError.forbidden(`Role '${req.user.role}' does not have permission for this action`);
    }
    next();
  };

export const roleGuard = (minimumRole: string): RequestHandler =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized('Not authenticated');

    const userLevel = ROLE_HIERARCHY.indexOf(req.user.role as typeof ROLE_HIERARCHY[number]);
    const requiredLevel = ROLE_HIERARCHY.indexOf(minimumRole as typeof ROLE_HIERARCHY[number]);

    if (userLevel === -1 || requiredLevel === -1) {
      throw ApiError.internal('Invalid role configuration');
    }

    if (userLevel > requiredLevel) {
      throw ApiError.forbidden(`Minimum required role: '${minimumRole}'. Your role: '${req.user.role}'`);
    }
    next();
  };

export const scopeTenant = (field = 'tenantId'): RequestHandler =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    req.tenantId = req.user?.tenantId ?? undefined;
    req.tenantFilter = { [field]: req.tenantId };
    next();
  };

export const verifyOwnerOrAdmin: RequestHandler = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const isOwner = req.user?._id?.toString() === req.params.id;
  const isAdmin = ([ROLES.ADMIN, ROLES.SUPER_ADMIN] as string[]).includes(req.user?.role ?? '');
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden('You can only access your own resources');
  }
  next();
};

export default { authenticate, protect, authorize, roleGuard, scopeTenant, verifyOwnerOrAdmin };
module.exports = { authenticate, protect, authorize, roleGuard, scopeTenant, verifyOwnerOrAdmin };
module.exports.default = module.exports;
