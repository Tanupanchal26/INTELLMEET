import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { ROLES, ROUTES } from '../../constants';
import Loader from '../common/Loader';

/** Redirects unauthenticated users to the public home page. */
export const ProtectedRoute = () => {
  const { isAuthenticated, isInitializing } = useAppSelector((s) => s.auth);
  if (isInitializing) return <Loader fullPage label="Loading…" />;
  return isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />;
};

/** Redirects already-authenticated users away from auth pages (login, signup…). */
export const PublicRoute = () => {
  const { isAuthenticated, isInitializing } = useAppSelector((s) => s.auth);
  if (isInitializing) return <Loader fullPage label="Loading…" />;
  return !isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.DASHBOARD} replace />;
};

/** Restricts access to specific roles. Redirects to Dashboard if denied. */
export const RoleProtectedRoute = ({ allowedRoles }: { allowedRoles: string[] }) => {
  const { isAuthenticated, isInitializing, user } = useAppSelector((s) => s.auth);
  if (isInitializing) return <Loader fullPage label="Loading…" />;
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
