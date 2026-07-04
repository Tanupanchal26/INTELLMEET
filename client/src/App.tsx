import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from './hooks/useAppDispatch';
import { clearAuth, refreshAccessToken, setCredentials, setInitialized } from './store/auth/auth.slice';
import { pushNotification } from './store/notifications/notification.slice';
import { authService } from './api/auth.api';
import { STORAGE_KEYS } from './constants';
import { useSocket } from './hooks/useSocket';
import AppRoutes from './app/router';
import ErrorBoundary from './components/common/ErrorBoundary';
import { initSentry } from './utils/sentry';
import type { Notification } from './api/notification.api';
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
  const isInitializing = useAppSelector((s) => s.auth.isInitializing);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const { socket } = useSocket();

  // Global real-time notification listener
  useEffect(() => {
    if (!isAuthenticated || !socket) return;
    const onNew = (notif: Notification) => {
      dispatch(pushNotification(notif));
      toast(notif.title, { icon: '🔔', duration: 4000 });
    };
    socket.on('notification:new', onNew);
    return () => { socket.off('notification:new', onNew); };
  }, [isAuthenticated, socket, dispatch]);

  // Validate stored token on app boot — catches expired tokens before any route renders
  useEffect(() => {
    if (!isInitializing) return;

    authService.me()
      .then((res) => {
        const user = res.data;
        if (user?.id || (user as any)?._id) {
          const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) ?? '';
          dispatch(setCredentials({ user, accessToken: token }));
        } else {
          dispatch(clearAuth());
        }
      })
      .catch((err: any) => {
        // me() failed — could be expired access token (interceptor will have
        // already attempted a refresh). Check if we still have a token after
        // the interceptor ran (meaning refresh succeeded but me() still failed
        // for another reason), or if the token is now gone (refresh also failed).
        const tokenAfterRefresh = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        const refreshStatus = err?.response?.status;

        if (tokenAfterRefresh && refreshStatus !== 401 && refreshStatus !== 403) {
          // Refresh succeeded (token still present) — re-try me() once
          authService.me()
            .then((res) => {
              const user = res.data;
              if (user?.id || (user as any)?._id) {
                dispatch(setCredentials({ user, accessToken: tokenAfterRefresh }));
              } else {
                dispatch(clearAuth());
              }
            })
            .catch(() => dispatch(clearAuth()));
        } else if (refreshStatus === 401 || refreshStatus === 403) {
          // Refresh token is also invalid — session truly expired
          dispatch(clearAuth());
        } else {
          // Network error or server down — keep user logged in, just mark initialized
          dispatch(setInitialized());
        }
      });
  }, [dispatch, isInitializing]);

  useEffect(() => {
    const onRefresh = (e: Event) => {
      const newToken = (e as CustomEvent<string>).detail;
      dispatch(refreshAccessToken(newToken));
      // Re-authenticate the socket with the new token so it doesn't drop
      import('./utils/socket').then(({ connectSocket }) => {
        connectSocket(newToken);
      });
    };
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
          position="bottom-left"
          gutter={10}
          containerStyle={{ bottom: 24, left: 24 }}
          toastOptions={{
            duration: 3500,
            style: {
              background: '#ffffff',
              color: '#202124',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              fontWeight: '500',
              padding: '12px 16px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
              maxWidth: '320px',
              lineHeight: '1.5',
              borderLeft: '4px solid #dadce0',
            },
            success: {
              iconTheme: { primary: '#1e8e3e', secondary: '#fff' },
              style: {
                background: '#ffffff',
                borderLeft: '4px solid #1e8e3e',
              },
            },
            error: {
              iconTheme: { primary: '#d93025', secondary: '#fff' },
              style: {
                background: '#ffffff',
                borderLeft: '4px solid #d93025',
              },
            },
            loading: {
              iconTheme: { primary: '#1a73e8', secondary: '#e8f0fe' },
              style: {
                background: '#ffffff',
                borderLeft: '4px solid #1a73e8',
              },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
