import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { ROUTES } from '../constants';
import { useAuth } from '../hooks/useAuth';
import GoogleLoginButton from '../components/common/GoogleLoginButton';
import Logo from '../components/common/Logo';

const PASSWORD_MIN_LENGTH = 8;

const getStrength = (pw: string): number => {
  let score = 0;
  if (pw.length >= PASSWORD_MIN_LENGTH) score++;
  if (pw.length >= 12)                  score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw))                 score++;
  if (/[^A-Za-z0-9]/.test(pw))         score++;
  return Math.min(4, score);
};

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
const STRENGTH_COLORS = ['', 'text-red-500', 'text-amber-500', 'text-blue-500', 'text-emerald-500'] as const;
const STRENGTH_BAR_COLORS: Record<number, string> = {
  1: '#EF4444',
  2: '#F59E0B',
  3: '#6366F1',
  4: '#10B981',
};

interface SignupForm {
  name:     string;
  email:    string;
  password: string;
  confirm:  string;
}

const Signup = () => {
  const { register } = useAuth();
  const [form, setForm] = useState<SignupForm>({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const setField = (key: keyof SignupForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  const strength      = getStrength(form.password);
  const strengthLabel = form.password.length > 0 ? STRENGTH_LABELS[strength] : '';
  const strengthColor = form.password.length > 0 ? STRENGTH_COLORS[strength] : '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { toast.error('Please fill in all fields.'); return; }
    if (form.password !== form.confirm)               { toast.error('Passwords do not match.'); return; }
    if (form.password.length < PASSWORD_MIN_LENGTH)   { toast.error('Password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">

        {/* Left Pane: Form */}
        <div className="auth-left-pane">
          <div className="auth-form-wrapper compact">
            <Link to="/" className="auth-logo">
              <div className="auth-logo-icon">
                <Logo width={20} height={8} className="text-white" />
              </div>
              <span className="auth-logo-text">IntellMeet</span>
            </Link>

            <div className="overflow-y-auto pr-1 flex flex-col gap-3.5 scrollbar-thin">
              <div className="auth-header-text">
                <h2 className="auth-title">Create account</h2>
                <p className="auth-subtitle">Start your free workspace today.</p>
              </div>

              <GoogleLoginButton label="Continue with Google" theme="light" className="h-10 mb-0" />

              <div className="auth-divider">
                <div className="auth-divider-line" />
                <span className="auth-divider-text">or with email</span>
                <div className="auth-divider-line" />
              </div>

              <form onSubmit={handleSubmit} className="auth-form compact">
                <div className="auth-input-group">
                  <label className="auth-label">Full Name</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={setField('name')}
                    className="auth-input auth-input-sm"
                    required
                  />
                </div>

                <div className="auth-input-group">
                  <label className="auth-label">Work Email</label>
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={setField('email')}
                    className="auth-input auth-input-sm"
                    required
                  />
                </div>

                <div className="auth-input-group">
                  <label className="auth-label">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={setField('password')}
                    className="auth-input auth-input-sm"
                    required
                  />
                  {form.password.length > 0 && (
                    <div className="auth-strength-meter">
                      <div className="auth-strength-bars">
                        {([1, 2, 3, 4] as const).map(i => (
                          <div
                            key={i}
                            className="auth-strength-bar"
                            style={{
                              backgroundColor: i <= strength
                                ? STRENGTH_BAR_COLORS[strength]
                                : 'rgba(66, 67, 65, 0.08)',
                            }}
                          />
                        ))}
                      </div>
                      <p className={`auth-strength-text ${strengthColor}`}>{strengthLabel} password</p>
                    </div>
                  )}
                </div>

                <div className="auth-input-group">
                  <label className="auth-label">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={form.confirm}
                    onChange={setField('confirm')}
                    className="auth-input auth-input-sm"
                    required
                  />
                  {form.confirm && form.password !== form.confirm && (
                    <p className="auth-alert-error mt-1 text-[10px] font-semibold px-2 py-1.5 rounded-md border border-red-500/10">
                      Passwords do not match
                    </p>
                  )}
                </div>

                <button type="submit" disabled={loading} className="auth-submit-btn auth-submit-btn-sm">
                  {loading
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : 'Create account'
                  }
                </button>
              </form>
            </div>

            <div className="auth-footer">
              Already have an account? <Link to={ROUTES.LOGIN} className="auth-footer-link">Sign in</Link>
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

export default Signup;
