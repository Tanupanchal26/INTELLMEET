/**
 * IntellMeet Design System — Color Tokens
 * Single source of truth for all colors used across the application.
 * JS tokens mirror the CSS custom properties in global.css.
 */

export const colors = {
  // ── Brand ────────────────────────────────────────────────────────────────
  brand: {
    50:  '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    400: '#60A5FA',
    500: '#2563EB',
    600: '#1D4ED8',
    700: '#1E40AF',
  },

  // ── Accent / Indigo ───────────────────────────────────────────────────────
  accent: {
    50:  '#EEF2FF',
    100: '#E0E7FF',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#6366F1',
    600: '#4F46E5',
    700: '#4338CA',
  },

  // ── Violet ────────────────────────────────────────────────────────────────
  violet: {
    50:  '#F5F3FF',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
  },

  // ── Emerald ───────────────────────────────────────────────────────────────
  emerald: {
    50:  '#ECFDF5',
    100: '#D1FAE5',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
  },

  // ── Amber ─────────────────────────────────────────────────────────────────
  amber: {
    50:  '#FFFBEB',
    100: '#FEF3C7',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
  },

  // ── Red ───────────────────────────────────────────────────────────────────
  red: {
    50:  '#FEF2F2',
    100: '#FEE2E2',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
  },

  // ── Neutral ───────────────────────────────────────────────────────────────
  neutral: {
    0:   '#FFFFFF',
    50:  '#FAFBFD',
    100: '#F4F6FA',
    200: '#EEF2F7',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  // ── Semantic aliases ──────────────────────────────────────────────────────
  bg:          '#FAFBFD',
  surface:     '#FFFFFF',
  border:      '#EEF2F7',
  borderStrong:'#CBD5E1',
  text:        '#0F172A',
  textSub:     '#334155',
  textMuted:   '#64748B',
  textDim:     '#94A3B8',
  shadow:      '0 1px 3px rgba(15,23,42,0.05), 0 4px 20px rgba(15,23,42,0.06)',
} as const;

export type ColorToken = typeof colors;
