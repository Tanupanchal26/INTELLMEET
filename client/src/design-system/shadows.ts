/**
 * IntellMeet Design System — Shadow Tokens
 */
export const shadows = {
  xs:     '0 1px 2px rgba(0,0,0,0.05)',
  sm:     '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
  md:     '0 4px 6px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)',
  lg:     '0 10px 15px rgba(0,0,0,0.07), 0 4px 6px rgba(0,0,0,0.04)',
  xl:     '0 20px 25px rgba(0,0,0,0.08), 0 10px 10px rgba(0,0,0,0.03)',
  '2xl':  '0 25px 50px rgba(0,0,0,0.12)',
  card:   '0 0 0 1px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.05)',
  brand:  '0 4px 14px rgba(37,99,235,0.18)',
  modal:  '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
  inset:  'inset 0 1px 2px rgba(0,0,0,0.04)',
  ring:   '0 0 0 3px rgba(37,99,235,0.12)',
} as const;

export type ShadowToken = keyof typeof shadows;
