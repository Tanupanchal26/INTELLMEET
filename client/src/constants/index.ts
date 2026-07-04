// ── Route paths ────────────────────────────────────────────────────────────────
export const ROUTES = {
  HOME:            '/',
  LOGIN:           '/login',
  SIGNUP:          '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD:  '/reset-password/:token',
  VERIFY_EMAIL:    '/verify-email/:token',
  DASHBOARD:       '/dashboard',
  LOBBY:           '/lobby',
  MEETING:         '/meeting/:id',
  ANALYTICS:       '/analytics',
  TASKS:           '/tasks',
  SETTINGS:        '/settings',
  PROFILE:         '/profile',
  AI_SUMMARY:      '/ai-summary',
  TEAMS:           '/teams',
  TEAM:            '/teams/:id',
  TEAM_WORKSPACE:  '/teams/:id/workspace',
  CHANNELS:        '/teams/:teamId/channels/:channelId',
  NOTIFICATIONS:   '/notifications',
  RECORDINGS:      '/recordings',
  RECORDING_DETAIL:'/recordings/:id',
  MEDIA:           '/media',
  POST_MEETING:    '/post-meeting',
  NOT_FOUND:       '*',
} as const;

// ── Dynamic route builders ─────────────────────────────────────────────────────
export const toMeeting     = (id: string) => `/meeting/${id}`;
export const toTeam        = (id: string) => `/teams/${id}`;
export const toWorkspace   = (id: string) => `/teams/${id}/workspace`;
export const toChannel     = (teamId: string, channelId: string) => `/teams/${teamId}/channels/${channelId}`;
export const toResetPassword = (token: string) => `/reset-password/${token}`;
export const toVerifyEmail   = (token: string) => `/verify-email/${token}`;

// Keep backwards compat alias used in older files
export const MEETING_ROUTE = toMeeting;
export const API_BASE_URL  = ((import.meta as any).env?.VITE_API_BASE_URL as string) || 'http://127.0.0.1:5000/api/v1';
export const SOCKET_URL    = ((import.meta as any).env?.VITE_SOCKET_URL   as string) || 'http://127.0.0.1:5000';

// ── Roles ─────────────────────────────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN:  'admin',
  MEMBER: 'member',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// ── Storage keys ──────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  ACCESS_TOKEN:  'im_access_token',
  REFRESH_TOKEN: 'im_refresh_token',
  USER:          'im_user',
  THEME:         'im_theme',
  SIDEBAR:       'im_sidebar',
  DENSITY:       'im_density',
  DEV_MINIMIZED: 'im_dev_minimized',
} as const;

// ── Pagination ────────────────────────────────────────────────────────────────
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT:     100,
} as const;

// ── Meeting status ────────────────────────────────────────────────────────────
export const MEETING_STATUS = {
  SCHEDULED: 'scheduled',
  ACTIVE:    'active',
  ENDED:     'ended',
} as const;
