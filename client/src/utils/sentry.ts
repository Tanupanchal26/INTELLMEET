// Sentry integration — graceful degradation when @sentry/react is not installed
// To enable Sentry: npm install @sentry/react && set VITE_SENTRY_DSN in .env

const SENTRY_DSN = (import.meta as any).env?.VITE_SENTRY_DSN || '';

let _sentry: any = null;

export const initSentry = () => {
  if (!SENTRY_DSN) {
    console.log('[Sentry] No VITE_SENTRY_DSN set — error monitoring disabled');
    return;
  }

  try {
    // Dynamic require-style import to avoid compile-time dependency
    const mod = (globalThis as any).__SENTRY_REACT__;
    if (mod) {
      _sentry = mod;
      _sentry.init({
        dsn: SENTRY_DSN,
        environment: (import.meta as any).env?.MODE || 'development',
        tracesSampleRate: (import.meta as any).env?.MODE === 'production' ? 0.1 : 1.0,
      });
      console.log('[Sentry] Initialized successfully');
    } else {
      console.log('[Sentry] @sentry/react not loaded — install the package to enable');
    }
  } catch {
    console.log('[Sentry] Initialization failed — continuing without error monitoring');
  }
};

export const captureException = (error: Error, context?: Record<string, unknown>) => {
  if (_sentry) {
    _sentry.captureException(error, { extra: context });
  } else {
    // Sanitize error message before logging to prevent log injection
    // eslint-disable-next-line no-control-regex
    const safeMsg = String(error?.message ?? error ?? '').replace(/[\r\n\t\x00-\x1f\x7f]/g, '_').slice(0, 512);
    console.error('[Error]', safeMsg);
  }
};

export const captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
  if (_sentry) {
    _sentry.captureMessage(message, level);
  }
};
