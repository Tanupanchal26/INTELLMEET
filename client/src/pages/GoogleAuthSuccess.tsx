import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { setCredentials } from '../store/auth/auth.slice';
import toast from 'react-hot-toast';
import { ROUTES, STORAGE_KEYS } from '../constants';
import { authService } from '../api/auth.api';

const OAUTH_COOKIE_NAME = '__oauth_token';

const readCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
};

const clearCookie = (name: string): void => {
  document.cookie = `${name}=; Max-Age=0; path=/`;
};

const GoogleAuthSuccess = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = readCookie(OAUTH_COOKIE_NAME);

    if (accessToken) {
      clearCookie(OAUTH_COOKIE_NAME);
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);

      // Fetch user data from API — never read PII from URL params
      // Interceptor unwraps res.data → API envelope { data: User, ... }
      authService.me()
        .then(({ data: user }) => {
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
          dispatch(setCredentials({ user, accessToken }));
          toast.success(`Welcome, ${user.name || 'back'}! 🎉`);
          navigate(ROUTES.DASHBOARD, { replace: true });
        })
        .catch(() => {
          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          toast.error('Google sign-in failed.');
          navigate(ROUTES.LOGIN, { replace: true });
        });
      return;
    }

    // Already logged in (e.g. StrictMode second mount)
    const existingToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (existingToken) {
      navigate(ROUTES.DASHBOARD, { replace: true });
      return;
    }

    toast.error('Google sign-in failed.');
    navigate(ROUTES.LOGIN, { replace: true });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#07070C] gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      <p className="text-sm text-[#64748B]">Signing you in with Google...</p>
    </div>
  );
};

export default GoogleAuthSuccess;
