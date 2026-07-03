/**
 * IntellMeet Design System — Motion Tokens
 * Used with Framer Motion and CSS transitions.
 */
export const motion = {
  duration: {
    instant:  0.08,
    fast:     0.15,
    normal:   0.22,
    slow:     0.35,
    slower:   0.5,
  },
  ease: {
    spring:     [0.175, 0.885, 0.32, 1.275] as const,
    outExpo:    [0.16, 1, 0.3, 1] as const,
    outQuart:   [0.25, 1, 0.5, 1] as const,
    inOutSine:  [0.37, 0, 0.63, 1] as const,
    linear:     [0, 0, 1, 1] as const,
  },
  /** Pre-built Framer Motion transition presets */
  transition: {
    snappy:   { duration: 0.22, ease: [0.25, 1, 0.5, 1] as const },
    spring:   { type: 'spring' as const, stiffness: 400, damping: 30 },
    page:     { duration: 0.18, ease: [0.25, 1, 0.5, 1] as const },
    modal:    { duration: 0.2,  ease: [0.25, 1, 0.5, 1] as const },
    sidebar:  { duration: 0.26, ease: [0.25, 1, 0.5, 1] as const },
    skeleton: { duration: 1.8,  repeat: Infinity, ease: 'linear' as const },
  },
  /** Reusable fadeInUp preset for motion.div */
  fadeInUp: (delay = 0) => ({
    initial:    { opacity: 0, y: 10 },
    animate:    { opacity: 1, y: 0 },
    transition: { duration: 0.28, ease: [0.25, 1, 0.5, 1] as const, delay },
  }),
  /** Stagger container variant */
  staggerContainer: {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.06 } },
  },
  staggerItem: {
    hidden:  { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.25, 1, 0.5, 1] as const } },
  },
} as const;
