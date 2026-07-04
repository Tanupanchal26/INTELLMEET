// HTTP Status Codes
export const HTTP = {
  OK:                  200,
  CREATED:             201,
  NO_CONTENT:          204,
  BAD_REQUEST:         400,
  UNAUTHORIZED:        401,
  FORBIDDEN:           403,
  NOT_FOUND:           404,
  CONFLICT:            409,
  UNPROCESSABLE:       422,
  TOO_MANY_REQUESTS:   429,
  INTERNAL_ERROR:      500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatus = typeof HTTP[keyof typeof HTTP];

// RBAC Roles
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN:       'admin',
  MEMBER:      'member',
  GUEST:       'guest',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const ROLE_HIERARCHY: Role[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MEMBER, ROLES.GUEST];

// User Status
export const USER_STATUS = {
  ACTIVE:   'active',
  INACTIVE: 'inactive',
  BANNED:   'banned',
  LOCKED:   'locked',
} as const;

export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];

// Auth Security
export const AUTH = {
  BCRYPT_ROUNDS:         12,
  MAX_LOGIN_ATTEMPTS:    5,
  LOCK_DURATION_MINUTES: 15,
  VERIFY_TOKEN_EXPIRES:  24 * 60 * 60 * 1000,    // 24 hours in ms
  RESET_TOKEN_EXPIRES:   60 * 60 * 1000,          // 1 hour in ms
  COOKIE_MAX_AGE:        7 * 24 * 60 * 60 * 1000, // 7 days in ms
} as const;

// Subscription Plans
export const PLANS = {
  FREE:       'free',
  PRO:        'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type Plan = typeof PLANS[keyof typeof PLANS];

// Meeting Status
export const MEETING_STATUS = {
  SCHEDULED: 'scheduled',
  ACTIVE:    'active',
  ENDED:     'ended',
} as const;

export type MeetingStatus = typeof MEETING_STATUS[keyof typeof MEETING_STATUS];

// Task Status
export const TASK_STATUS = {
  BACKLOG:     'backlog',
  TODO:        'todo',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW:   'in_review',
  DONE:        'done',
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

// Task Priority
export const TASK_PRIORITY = {
  LOW:    'low',
  MEDIUM: 'medium',
  HIGH:   'high',
  URGENT: 'urgent',
} as const;

export type TaskPriority = typeof TASK_PRIORITY[keyof typeof TASK_PRIORITY];

// Token Types
export const TOKEN_TYPE = {
  ACCESS:         'access',
  REFRESH:        'refresh',
  EMAIL_VERIFY:   'email_verify',
  PASSWORD_RESET: 'password_reset',
} as const;

export type TokenType = typeof TOKEN_TYPE[keyof typeof TOKEN_TYPE];

// Environment Names
export const ENV = {
  DEVELOPMENT: 'development',
  STAGING:     'staging',
  PRODUCTION:  'production',
  TEST:        'test',
} as const;

export type Environment = typeof ENV[keyof typeof ENV];

// Pagination Defaults
export const PAGINATION = {
  DEFAULT_PAGE:  1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT:     100,
} as const;

// Cache TTL (seconds)
export const CACHE_TTL = {
  USER_SESSION: 900,   // 15 min
  MEETING_LIST: 120,   // 2 min
  AI_SUMMARY:   86400, // 24 h
  RATE_LIMIT:   60,    // 1 min
} as const;

// AI Models
export const AI_MODEL = {
  GEMINI_FLASH:   'gemini-2.0-flash',
  GEMINI_PRO:     'gemini-2.0-flash',   // alias kept for any future upgrade path
  WHISPER:        'whisper-1',          // kept for reference — not actively used
  // Legacy aliases so any remaining references don't break at runtime
  GPT4O:          'gemini-2.0-flash',
  GPT4_TURBO:     'gemini-2.0-flash',
} as const;

export type AiModel = typeof AI_MODEL[keyof typeof AI_MODEL];

// Cookie Names
export const COOKIE_NAMES = {
  REFRESH_TOKEN: 'refreshToken',
  OAUTH_TOKEN:   '__oauth_token',
} as const;

// Socket Room Prefixes
export const SOCKET_ROOMS = {
  CHAT:    (id: string) => `chat:${id}`,
  CHANNEL: (id: string) => `channel:${id}`,
  MEETING: (id: string) => `meeting:${id}`,
  USER:    (id: string) => `user:${id}`,
} as const;

// Redis Keys
export const REDIS_KEYS = {
  USER_CACHE: (id: string) => `user:${id}`,
} as const;

// JWT issuer / audience (must match between sign and verify)
export const JWT_CLAIMS = {
  ISSUER:   'intellmeet',
  AUDIENCE: 'intellmeet-client',
} as const;

// App-level timeouts (ms)
export const TIMEOUTS = {
  GRACEFUL_SHUTDOWN_MS: 15_000,
  ICE_RESTART_DELAY_MS: 3_000,
  OAUTH_COOKIE_MAX_AGE_MS: 60_000, // 1 minute one-time use
  SESSION_MAX_AGE_MS: 10 * 60 * 1000, // 10 minutes
} as const;
