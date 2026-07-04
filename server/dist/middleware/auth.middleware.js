"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOwnerOrAdmin = exports.scopeTenant = exports.roleGuard = exports.authorize = exports.protect = exports.authenticate = void 0;
const redisBlacklist_1 = require("../utils/redisBlacklist");
const jwt_service_1 = require("../services/jwt.service");
const ApiError_1 = __importDefault(require("../utils/ApiError"));
const asyncHandler_1 = __importDefault(require("../utils/asyncHandler"));
const constants_1 = require("../constants");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const User = require('../models/User');
const extractBearerToken = (req) => req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : req.headers['x-access-token']
        ?? req.query.token
        ?? null;
exports.authenticate = (0, asyncHandler_1.default)(async (req, _res, next) => {
    const token = extractBearerToken(req);
    if (!token)
        throw ApiError_1.default.unauthorized('Access token required');
    let decoded;
    try {
        decoded = (0, jwt_service_1.verifyAccessToken)(token);
    }
    catch (err) {
        const msg = err.name === 'TokenExpiredError'
            ? 'Access token expired'
            : 'Invalid access token';
        throw ApiError_1.default.unauthorized(msg);
    }
    if (await (0, redisBlacklist_1.isBlacklisted)(token))
        throw ApiError_1.default.unauthorized('Token revoked');
    // Fetch only non-sensitive fields for the request context
    const user = await User.findById(decoded.id)
        .select('+passwordChangedAt')
        .lean();
    if (!user)
        throw ApiError_1.default.unauthorized('User no longer exists');
    if (user.status === constants_1.USER_STATUS.BANNED)
        throw ApiError_1.default.forbidden('Account suspended. Contact support.');
    if (user.status === constants_1.USER_STATUS.LOCKED)
        throw ApiError_1.default.forbidden('Account is locked.');
    if (user.status === constants_1.USER_STATUS.INACTIVE)
        throw ApiError_1.default.forbidden('Account is inactive.');
    // Invalidate tokens issued before a password change
    if (user.passwordChangedAt) {
        const tokenIssuedAtMs = (decoded.iat ?? 0) * 1000;
        if (user.passwordChangedAt.getTime() > tokenIssuedAtMs) {
            throw ApiError_1.default.unauthorized('Password recently changed. Please log in again.');
        }
    }
    req.user = user;
    next();
});
exports.protect = exports.authenticate;
const authorize = (...roles) => (req, _res, next) => {
    if (!req.user)
        throw ApiError_1.default.unauthorized('Not authenticated');
    const allowedRoles = [...roles];
    if (roles.includes(constants_1.ROLES.ADMIN) && !allowedRoles.includes(constants_1.ROLES.SUPER_ADMIN)) {
        allowedRoles.push(constants_1.ROLES.SUPER_ADMIN);
    }
    if (!allowedRoles.includes(req.user.role)) {
        throw ApiError_1.default.forbidden(`Role '${req.user.role}' does not have permission for this action`);
    }
    next();
};
exports.authorize = authorize;
const roleGuard = (minimumRole) => (req, _res, next) => {
    if (!req.user)
        throw ApiError_1.default.unauthorized('Not authenticated');
    const userLevel = constants_1.ROLE_HIERARCHY.indexOf(req.user.role);
    const requiredLevel = constants_1.ROLE_HIERARCHY.indexOf(minimumRole);
    if (userLevel === -1 || requiredLevel === -1) {
        throw ApiError_1.default.internal('Invalid role configuration');
    }
    if (userLevel > requiredLevel) {
        throw ApiError_1.default.forbidden(`Minimum required role: '${minimumRole}'. Your role: '${req.user.role}'`);
    }
    next();
};
exports.roleGuard = roleGuard;
const scopeTenant = (field = 'tenantId') => (req, _res, next) => {
    req.tenantId = req.user?.tenantId ?? undefined;
    req.tenantFilter = { [field]: req.tenantId };
    next();
};
exports.scopeTenant = scopeTenant;
const verifyOwnerOrAdmin = (req, _res, next) => {
    const isOwner = req.user?._id?.toString() === req.params.id;
    const isAdmin = [constants_1.ROLES.ADMIN, constants_1.ROLES.SUPER_ADMIN].includes(req.user?.role ?? '');
    if (!isOwner && !isAdmin) {
        throw ApiError_1.default.forbidden('You can only access your own resources');
    }
    next();
};
exports.verifyOwnerOrAdmin = verifyOwnerOrAdmin;
exports.default = { authenticate: exports.authenticate, protect: exports.protect, authorize: exports.authorize, roleGuard: exports.roleGuard, scopeTenant: exports.scopeTenant, verifyOwnerOrAdmin: exports.verifyOwnerOrAdmin };
module.exports = { authenticate: exports.authenticate, protect: exports.protect, authorize: exports.authorize, roleGuard: exports.roleGuard, scopeTenant: exports.scopeTenant, verifyOwnerOrAdmin: exports.verifyOwnerOrAdmin };
module.exports.default = module.exports;
