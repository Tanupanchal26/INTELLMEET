"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMEOUTS = exports.JWT_CLAIMS = exports.REDIS_KEYS = exports.SOCKET_ROOMS = exports.COOKIE_NAMES = exports.AI_MODEL = exports.CACHE_TTL = exports.PAGINATION = exports.ENV = exports.TOKEN_TYPE = exports.TASK_PRIORITY = exports.TASK_STATUS = exports.MEETING_STATUS = exports.PLANS = exports.AUTH = exports.USER_STATUS = exports.ROLE_HIERARCHY = exports.ROLES = exports.HTTP = void 0;
// HTTP Status Codes
exports.HTTP = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};
// RBAC Roles
exports.ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    MEMBER: 'member',
    GUEST: 'guest',
};
exports.ROLE_HIERARCHY = [exports.ROLES.SUPER_ADMIN, exports.ROLES.ADMIN, exports.ROLES.MEMBER, exports.ROLES.GUEST];
// User Status
exports.USER_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    BANNED: 'banned',
    LOCKED: 'locked',
};
// Auth Security
exports.AUTH = {
    BCRYPT_ROUNDS: 12,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_DURATION_MINUTES: 15,
    VERIFY_TOKEN_EXPIRES: 24 * 60 * 60 * 1000, // 24 hours in ms
    RESET_TOKEN_EXPIRES: 60 * 60 * 1000, // 1 hour in ms
    COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};
// Subscription Plans
exports.PLANS = {
    FREE: 'free',
    PRO: 'pro',
    ENTERPRISE: 'enterprise',
};
// Meeting Status
exports.MEETING_STATUS = {
    SCHEDULED: 'scheduled',
    ACTIVE: 'active',
    ENDED: 'ended',
};
// Task Status
exports.TASK_STATUS = {
    BACKLOG: 'backlog',
    TODO: 'todo',
    IN_PROGRESS: 'in_progress',
    IN_REVIEW: 'in_review',
    DONE: 'done',
};
// Task Priority
exports.TASK_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent',
};
// Token Types
exports.TOKEN_TYPE = {
    ACCESS: 'access',
    REFRESH: 'refresh',
    EMAIL_VERIFY: 'email_verify',
    PASSWORD_RESET: 'password_reset',
};
// Environment Names
exports.ENV = {
    DEVELOPMENT: 'development',
    STAGING: 'staging',
    PRODUCTION: 'production',
    TEST: 'test',
};
// Pagination Defaults
exports.PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
};
// Cache TTL (seconds)
exports.CACHE_TTL = {
    USER_SESSION: 900, // 15 min
    MEETING_LIST: 120, // 2 min
    AI_SUMMARY: 86400, // 24 h
    RATE_LIMIT: 60, // 1 min
};
// AI Models
exports.AI_MODEL = {
    GPT4O: 'gpt-4o-mini',
    GPT4_TURBO: 'gpt-4o-mini',
    WHISPER: 'whisper-1',
};
// Cookie Names
exports.COOKIE_NAMES = {
    REFRESH_TOKEN: 'refreshToken',
    OAUTH_TOKEN: '__oauth_token',
};
// Socket Room Prefixes
exports.SOCKET_ROOMS = {
    CHAT: (id) => `chat:${id}`,
    CHANNEL: (id) => `channel:${id}`,
    MEETING: (id) => `meeting:${id}`,
    USER: (id) => `user:${id}`,
};
// Redis Keys
exports.REDIS_KEYS = {
    USER_CACHE: (id) => `user:${id}`,
};
// JWT issuer / audience (must match between sign and verify)
exports.JWT_CLAIMS = {
    ISSUER: 'intellmeet',
    AUDIENCE: 'intellmeet-client',
};
// App-level timeouts (ms)
exports.TIMEOUTS = {
    GRACEFUL_SHUTDOWN_MS: 15_000,
    ICE_RESTART_DELAY_MS: 3_000,
    OAUTH_COOKIE_MAX_AGE_MS: 60_000, // 1 minute one-time use
    SESSION_MAX_AGE_MS: 10 * 60 * 1000, // 10 minutes
};
