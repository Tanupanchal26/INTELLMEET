import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Video, ArrowLeft, CheckCircle } from 'lucide-react';
import { ROUTES } from '../constants';
import axiosClient from '../api/axios';
import Logo from '../components/common/Logo';

const ForgotPassword = () => {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Email is required.'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    try {
      await axiosClient.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
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

            {sent ? (
              <div className="auth-header-text text-center flex flex-col items-center gap-4 py-4">
                <div className="auth-success-circle auth-success-circle-green">
                  <CheckCircle size={28} className="text-emerald-500" />
                </div>
                <div>
                  <h2 className="auth-title mb-1 text-center">Check your inbox</h2>
                  <p className="auth-subtitle text-center">
                    We sent a reset link to <span className="font-semibold text-[var(--color-text)]">{email}</span>
                  </p>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  Didn't receive it? Check spam or{' '}
                  <button
                    onClick={() => { setSent(false); setEmail(''); setError(''); }}
                    className="text-[var(--color-text)] font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    try again
                  </button>
                  .
                </p>
                <Link to={ROUTES.LOGIN} className="auth-back-link">
                  <ArrowLeft size={13} />
                  Back to sign in
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="auth-header-text">
                  <h1 className="auth-title">Forgot password?</h1>
                  <p className="auth-subtitle">Enter your email and we'll send you a reset link.</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form" noValidate>
                  <div className="auth-input-group">
                    <label htmlFor="forgot-email" className="auth-label">Email address</label>
                    <div className="auth-input-container">
                      <Mail size={14} className="auth-input-icon" aria-hidden="true" />
                      <input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="auth-input has-icon"
                        autoFocus
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div role="alert" className="auth-alert auth-alert-error">
                      <span className="shrink-0">⚠</span>
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="auth-submit-btn">
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Send Reset Link'}
                  </button>
                </form>

                <Link to={ROUTES.LOGIN} className="auth-back-link">
                  <ArrowLeft size={13} />
                  Back to sign in
                </Link>
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

export default ForgotPassword;
