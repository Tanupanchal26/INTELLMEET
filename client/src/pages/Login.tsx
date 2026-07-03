import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { ROUTES } from '../constants';
import { useAuth } from '../hooks/useAuth';
import GoogleLoginButton from '../components/common/GoogleLoginButton';
import Logo from '../components/common/Logo';

const Login = () => {
  const { login } = useAuth();
  const location  = useLocation();
  const from      = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || ROUTES.DASHBOARD;

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      await login(email, password, from);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
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
            <Link to="/" className="auth-logo">
              <div className="auth-logo-icon">
                <Logo width={20} height={8} className="text-white" />
              </div>
              <span className="auth-logo-text">IntellMeet</span>
            </Link>

            <div className="auth-header-text">
              <h2 className="auth-title">Good morning!</h2>
              <p className="auth-subtitle">Sign in to your IntellMeet workspace to get started.</p>
            </div>

            <GoogleLoginButton label="Continue with Google" theme="light" className="h-11 mb-0" />

            <div className="auth-divider">
              <div className="auth-divider-line" />
              <span className="auth-divider-text">or with email</span>
              <div className="auth-divider-line" />
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-input-group">
                <label className="auth-label">Email Address</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="auth-input"
                  required
                />
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="auth-input"
                  required
                />
                <Link to={ROUTES.FORGOT_PASSWORD} className="auth-forgot-link">
                  Forgot password?
                </Link>
              </div>

              <button type="submit" disabled={loading} className="auth-submit-btn">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : 'Next step'
                }
              </button>
            </form>

            <div className="auth-footer">
              Don't have an account? <Link to={ROUTES.SIGNUP} className="auth-footer-link">Sign up</Link>
              <p className="auth-copyright">All rights reserved © 2026 IntellMeet</p>
            </div>
          </div>
        </div>

        {/* Right Pane */}
        <div
          className="auth-right-pane"
          style={{
            backgroundImage: "url('/auth_illustration.png')",
            backgroundColor: '#ffffff',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div className="auth-glass-card">
            <div className="auth-glass-icon-wrapper">
              <Video size={14} className="text-white" />
            </div>
            <h3 className="auth-glass-title">Meet Smarter. Work Faster. Grow Together.</h3>
            <p className="auth-glass-desc">
              Transform every conversation into actionable intelligence with real-time AI transcription,
              smart summaries, and automatic action-item extraction.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
