import { useState } from 'react';
import { API_BASE_URL } from '../../constants';

const GOOGLE_AUTH_URL = `${API_BASE_URL.replace(/\/api\/v1$/, '')}/api/v1/auth/google`;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.2 6.5 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.2 6.5 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.6 39.6 16.3 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C37 37.1 44 32 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);

interface Props {
  label?: string;
  theme?: 'dark' | 'light';
  className?: string;
}

const GoogleLoginButton = ({ label = 'Continue with Google', theme = 'dark', className = '' }: Props) => {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
    window.location.href = GOOGLE_AUTH_URL;
  };

  const baseClasses = `w-full flex items-center justify-center gap-3 rounded-xl border text-[0.8125rem] font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${className || 'h-11 mb-5'}`;
  
  const themeClasses = theme === 'dark' 
    ? "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[#CBD5E1] hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]"
    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`${baseClasses} ${themeClasses}`}
      aria-label={label}
    >
      {loading ? (
        <div className={`w-4 h-4 rounded-full border-2 border-t-transparent animate-spin ${theme === 'dark' ? 'border-[#CBD5E1]' : 'border-gray-400'}`} />
      ) : (
        <GoogleIcon />
      )}
      {loading ? 'Redirecting to Google...' : label}
    </button>
  );
};

export default GoogleLoginButton;
