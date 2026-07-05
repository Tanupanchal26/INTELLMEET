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

// Session-scoped caching — Google Meet / Zoom style SPA behaviour
// gcTime 30 min  : cached data survives navigation for the whole session
// staleTime 5 min: no refetch within 5 min of last successful fetch
// refetchOnWindowFocus false : switching browser tabs never triggers a refetch
// refetchOnMount false       : navigating back to a page never re-fetches fresh data
// refetchOnReconnect always  : only refetch when the network actually drops & reconnects
const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1_000,
      gcTime: 30 * 60 * 1_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: 'always',
    },
  },
});

const IS_DEV = import.meta.env.DEV;

const AuthSync = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const { socket } = useSocket();

  // Global real-time notification listener
  useEffect(() => {
    if (!isAuthenticated || !socket.current) return;
    const onNew = (notif: Notification) => {
      dispatch(pushNotification(notif));
      toast(notif.title, { icon: '🔔', duration: 4000 });
    };
    socket.current.on('notification:new', onNew);
    return () => { socket.current!.off('notification:new', onNew); };
  }, [isAuthenticated, dispatch]); // socket is a stable ref — safe to omit

  // ── Session restoration on every app boot ────────────────────────────────
  // isInitializing is ALWAYS true on boot (auth.slice.ts). This effect runs
  // once and resolves the session via one of three paths:
  //   1. Valid access token in localStorage  → /users/me succeeds directly
  //   2. Expired access token                → axios interceptor refreshes it
  //                                            transparently, /users/me retried
  //   3. No access token at all              → proactive /auth/refresh-token
  //                                            call uses the HttpOnly cookie
  // This covers browser refresh, new tab, and "close & reopen" scenarios.
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const storedToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

      // Path 3: no access token — try the refresh cookie proactively before
      // hitting /users/me so we don't waste a round-trip with a guaranteed 401.
      if (!storedToken) {
        try {
          const refreshed = await authService.refreshToken();
          const newToken = (refreshed as any)?.data?.accessToken ?? (refreshed as any)?.accessToken;
          if (!newToken) throw new Error('no token');
          localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newToken);
          window.dispatchEvent(new CustomEvent('auth:tokenRefreshed', { detail: newToken }));
          // Fall through to /users/me with the new token in localStorage
        } catch {
          // No valid refresh cookie either — truly unauthenticated
          if (!cancelled) dispatch(clearAuth());
          return;
        }
      }

      // Paths 1 & 2: call /users/me. If the access token is expired the axios
      // interceptor will transparently refresh it and retry the request, so
      // from this code's perspective it either resolves or rejects.
      try {
        const res = await authService.me();
        const user = res.data;
        if (cancelled) return;
        if (user?.id || (user as any)?._id) {
          const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) ?? '';
          dispatch(setCredentials({ user, accessToken: token }));
        } else {
          dispatch(clearAuth());
        }
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          // Both access token and refresh token are invalid — truly logged out
          dispatch(clearAuth());
        } else {
          // Network error / server down — keep the user logged in optimistically
          // and mark initialization complete so the app doesn't hang forever.
          dispatch(setInitialized());
        }
      }
    };

    restoreSession();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Global token-refresh & logout event bus ───────────────────────────────
  useEffect(() => {
    const onRefresh = (e: Event) => {
      const newToken = (e as CustomEvent<string>).detail;
      dispatch(refreshAccessToken(newToken));
      // Reconnect socket with the new token — disconnect first so the server
      // sees a fresh handshake with the updated auth credential.
      import('./utils/socket').then(({ disconnectSocket, connectSocket }) => {
        disconnectSocket();
        connectSocket(newToken);
      });
    };
    const onLogout = () => dispatch(clearAuth());
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
