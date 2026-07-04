import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { ROLES, ROUTES, STORAGE_KEYS } from '../../constants';
import Loader from '../common/Loader';

/** Redirects unauthenticated users to the login page. */
export const ProtectedRoute = () => {
  const { isAuthenticated, isInitializing } = useAppSelector((s) => s.auth);

  // Show loader while initializing OR while we still have a stored session hint
  // (user/token in localStorage) — prevents a flash-redirect to login before
  // the server has had a chance to confirm the session.
  const hasStoredHint =
    !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) ||
    !!localStorage.getItem(STORAGE_KEYS.USER);

  if (isInitializing || (!isAuthenticated && hasStoredHint)) {
    return <Loader fullPage label="Loading…" />;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />;
};

/** Redirects already-authenticated users away from auth pages (login, signup…). */
export const PublicRoute = () => {
  const { isAuthenticated, isInitializing } = useAppSelector((s) => s.auth);
  // Wait for initialization before deciding — prevents authenticated users
  // from briefly seeing the login page on a hard refresh.
  if (isInitializing) return <Loader fullPage label="Loading…" />;
  return !isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.DASHBOARD} replace />;
};

/** Restricts access to specific roles. Redirects to Dashboard if denied. */
export const RoleProtectedRoute = ({ allowedRoles }: { allowedRoles: string[] }) => {
  const { isAuthenticated, isInitializing, user } = useAppSelector((s) => s.auth);
  const hasStoredHint =
    !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) ||
    !!localStorage.getItem(STORAGE_KEYS.USER);

  if (isInitializing || (!isAuthenticated && hasStoredHint)) {
    return <Loader fullPage label="Loading…" />;
  }
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;

  const effectiveRoles = [...allowedRoles];
  if (allowedRoles.includes(ROLES.ADMIN) && !allowedRoles.includes(ROLES.SUPER_ADMIN)) {
    effectiveRoles.push(ROLES.SUPER_ADMIN);
  }

  if (!user?.role || !effectiveRoles.includes(user.role)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }
  return <Outlet />;
};
