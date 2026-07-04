import { useAppDispatch, useAppSelector } from './useAppDispatch';
import { setCredentials, clearAuth } from '../store/auth/auth.slice';
import { authService } from '../api/auth.api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ROUTES } from '../constants';
import { disconnectSocket } from '../utils/socket';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { user, accessToken: token, isAuthenticated } = useAppSelector((s) => s.auth);
  const navigate = useNavigate();

  const login = async (email: string, password: string, redirectTo: string = ROUTES.DASHBOARD) => {
    const res = await authService.login({ email, password });
    // res is ApiEnvelope<{ user: User; accessToken: string }>
    const userData    = res.data?.user;
    const accessToken = res.data?.accessToken;
    if (!userData)    throw new Error('User data not received from server');
    if (!accessToken) throw new Error('Access token not received from server');
    dispatch(setCredentials({ user: userData, accessToken }));
    toast.success(`Welcome back, ${userData.name}!`);
    navigate(redirectTo, { replace: true });
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await authService.register({ name, email, password });
    // res is ApiEnvelope<{ user: User; accessToken: string }>
    const userData    = res.data?.user;
    const accessToken = res.data?.accessToken;
    if (!userData)    throw new Error('User data not received from server');
    if (!accessToken) throw new Error('Access token not received from server');
    dispatch(setCredentials({ user: userData, accessToken }));
    toast.success('Account created!');
    navigate(ROUTES.DASHBOARD, { replace: true });
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore API errors — clear local state regardless
    } finally {
      disconnectSocket();
      dispatch(clearAuth());
      navigate(ROUTES.LOGIN, { replace: true });
      toast.success('Signed out');
    }
  };

  return { user, token, isAuthenticated, login, register, logout };
};
