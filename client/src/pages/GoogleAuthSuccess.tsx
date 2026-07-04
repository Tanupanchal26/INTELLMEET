import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { setCredentials } from '../store/auth/auth.slice';
import toast from 'react-hot-toast';
import { ROUTES, STORAGE_KEYS } from '../constants';
import { authService } from '../api/auth.api';

const GoogleAuthSuccess = () => {
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();
  // Guard against React StrictMode double-invoke
  const handled   = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('token');

    if (accessToken) {
      // Remove token from URL immediately
      window.history.replaceState({}, '', window.location.pathname);
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);

      authService.me()
        .then((res) => {
          // res is ApiEnvelope<User>: { success, data: User, message }
          const user = res.data;
          if (!user?.id && !(user as any)?._id) throw new Error('Invalid user data');
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
          dispatch(setCredentials({ user, accessToken }));
          toast.success(`Welcome, ${user.name || 'back'}! 🎉`);
          navigate(ROUTES.DASHBOARD, { replace: true });
        })
        .catch(() => {
          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          toast.error('Google sign-in failed. Please try again.');
          navigate(ROUTES.LOGIN, { replace: true });
        });
      return;
    }

    // No cookie — check if already authenticated (e.g. navigated here directly)
    const existingToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (existingToken) {
      navigate(ROUTES.DASHBOARD, { replace: true });
      return;
    }

    toast.error('Google sign-in failed. Please try again.');
    navigate(ROUTES.LOGIN, { replace: true });
  }, [dispatch, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#07070C] gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      <p className="text-sm text-[#64748B]">Signing you in with Google...</p>
    </div>
  );
};

export default GoogleAuthSuccess;
