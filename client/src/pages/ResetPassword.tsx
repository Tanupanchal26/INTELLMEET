import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Video, Lock, CheckCircle } from 'lucide-react';
import { ROUTES } from '../constants';
import axiosClient from '../api/axios';
import Logo from '../components/common/Logo';

const ResetPassword = () => {
  const { token: paramToken } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  // Support both /reset-password/:token and /reset-password?token=...
  const token = paramToken || searchParams.get('token') || '';
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(token ? '' : 'No reset token provided. Please check your email reset link.');

  // Navigate to login after success — cleaned up if component unmounts
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => navigate(ROUTES.LOGIN, { replace: true }), 3000);
    return () => clearTimeout(id);
  }, [done, navigate]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) { setError('No reset token provided. Please check your email reset link.'); return; }
    if (!form.password || !form.confirm) { setError('All fields are required'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await axiosClient.post(`/auth/reset-password/${token}`, {
        password: form.password,
        confirmPassword: form.confirm,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        
        {/* Left Pane: Form */}
        <div className="auth-left-pane">
          <div className="auth-form-wrapper">
            {/* Logo */}
            <Link to="/" className="auth-logo">
              <div className="auth-logo-icon">
                <Logo width={20} height={8} className="text-white" />
              </div>
              <span className="auth-logo-text">IntellMeet</span>
            </Link>

            {done ? (
              <div className="auth-header-text text-center flex flex-col items-center gap-4 py-4">
                <div className="auth-success-circle auth-success-circle-green">
                  <CheckCircle size={28} className="text-emerald-500" />
                </div>
                <div>
                  <h2 className="auth-title mb-1 text-center">Password reset!</h2>
                  <p className="auth-subtitle text-center">Redirecting you to sign in…</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="auth-header-text">
                  <h1 className="auth-title">Set new password</h1>
                  <p className="auth-subtitle">Choose a strong password for your account.</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                  {(['password', 'confirm'] as const).map((key) => (
                    <div key={key} className="auth-input-group">
                      <label className="auth-label">
                        {key === 'password' ? 'New Password' : 'Confirm Password'}
                      </label>
                      <div className="auth-input-container">
                        <Lock size={14} className="auth-input-icon" aria-hidden="true" />
                        <input
                          type={showPass ? 'text' : 'password'}
                          value={form[key]}
                          onChange={set(key)}
                          placeholder="Min 8 characters"
                          className={`auth-input has-icon ${key === 'password' ? 'has-right-btn' : ''}`}
                          required
                        />
                        {key === 'password' && (
                          <button 
                            type="button" 
                            onClick={() => setShowPass(v => !v)} 
                            className="auth-eye-btn"
                            aria-label={showPass ? 'Hide password' : 'Show password'}
                          >
                            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {error && (
                    <div role="alert" className="auth-alert auth-alert-error">
                      <span className="shrink-0">⚠</span>
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading || !token} className="auth-submit-btn">
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Reset Password'}
                  </button>
                </form>

                <p className="auth-footer">
                  Remember it?{' '}
                  <Link to={ROUTES.LOGIN} className="auth-footer-link">Sign in</Link>
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="auth-footer">
              <p className="auth-copyright">All rights reserved © 2026 IntellMeet</p>
            </div>
          </div>
        </div>

        {/* Right Pane: Image & Overlay */}
        <div 
          className="auth-right-pane"
          style={{ 
            backgroundImage: "url('/auth_illustration.png')", 
            backgroundColor: '#ffffff', 
            backgroundSize: 'contain', 
            backgroundPosition: 'center', 
            backgroundRepeat: 'no-repeat' 
          }}
        >
          {/* Glass Card Overlay */}
          <div className="auth-glass-card">
            <div className="auth-glass-icon-wrapper">
              <Video size={14} className="text-white" />
            </div>
            <h3 className="auth-glass-title">
              Meet Smarter. Work Faster. Grow Together.
            </h3>
            <p className="auth-glass-desc">
              Transform every conversation into actionable intelligence with real-time AI transcription, smart summaries, and automatic action-item extraction.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ResetPassword;
