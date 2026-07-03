import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './hooks/useAppDispatch';
import { clearAuth, refreshAccessToken } from './store/auth/auth.slice';
import AppRoutes from './app/router';
import ErrorBoundary from './components/common/ErrorBoundary';
import { initSentry } from './utils/sentry';
import './styles/global.css';

const DevNavigator = import.meta.env.DEV
  ? lazy(() => import('./components/dev/DevNavigator'))
  : null;

// Initialize Sentry as early as possible
initSentry();

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5 * 60 * 1000 } } });

const IS_DEV = import.meta.env.DEV;

const AuthSync = () => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const onRefresh = (e: Event) => dispatch(refreshAccessToken((e as CustomEvent<string>).detail));
    const onLogout  = () => dispatch(clearAuth());
    window.addEventListener('auth:tokenRefreshed', onRefresh);
    window.addEventListener('auth:logout', onLogout);
    return () => {
      window.removeEventListener('auth:tokenRefreshed', onRefresh);
      window.removeEventListener('auth:logout', onLogout);
    };
  }, [dispatch]);
  return null;
};

const App = () => {
  const theme = useAppSelector((s) => s.ui.theme);
  const density = useAppSelector((s) => s.ui.density);

  // Apply theme class
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (t: 'dark' | 'light') => {
      if (t === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  // Apply density class
  useEffect(() => {
    const root = document.documentElement;
    if (density === 'compact') {
      root.classList.add('density-compact');
    } else {
      root.classList.remove('density-compact');
    }
  }, [density]);

  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ErrorBoundary>
          {/* ARIA live region for screen reader announcements */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" id="a11y-announcer" />
          <AuthSync />
          <AppRoutes />
          {IS_DEV && DevNavigator ? (
            <Suspense fallback={null}>
              <DevNavigator />
            </Suspense>
          ) : null}
        </ErrorBoundary>
        <Toaster
          position="top-right"
          gutter={8}
          containerStyle={{ top: 16, right: 16 }}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#141420',
              color: '#F1F5F9',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontSize: '0.8125rem',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              fontWeight: '500',
              padding: '10px 14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
              maxWidth: '360px',
              lineHeight: '1.45',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: '#fff' },
              style: {
                background: '#141420',
                border: '1px solid rgba(16,185,129,0.2)',
              },
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#fff' },
              style: {
                background: '#141420',
                border: '1px solid rgba(239,68,68,0.2)',
              },
            },
            loading: {
              iconTheme: { primary: '#6366F1', secondary: 'rgba(99,102,241,0.2)' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
