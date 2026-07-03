/**
 * IntellMeet Design System — Typography Tokens
 */
export const typography = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  },
  fontSize: {
    display: 'clamp(2.25rem, 5vw, 3.5rem)',
    h1:      'clamp(1.875rem, 3.5vw, 2.5rem)',
    h2:      'clamp(1.5rem, 2.5vw, 2rem)',
    h3:      'clamp(1.125rem, 2vw, 1.375rem)',
    h4:      '1.0625rem',
    body:    '1rem',
    bodySm:  '0.875rem',
    caption: '0.8125rem',
    xs:      '0.75rem',
    xxs:     '0.6875rem',
  },
  fontWeight: {
    regular:   400,
    medium:    500,
    semibold:  600,
    bold:      700,
    extrabold: 800,
  },
  lineHeight: {
    tight:  1.1,
    snug:   1.3,
    normal: 1.5,
    relaxed: 1.65,
  },
  letterSpacing: {
    tightest: '-0.03em',
    tighter:  '-0.02em',
    tight:    '-0.015em',
    normal:   '0em',
    wide:     '0.05em',
    wider:    '0.09em',
  },
} as const;
