import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../api/axios';
import Logo from '../components/common/Logo';
import { ROUTES } from '../constants';

type Status = 'loading' | 'success' | 'error';

const VerifyEmail = () => {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }

    api
      .get(`/auth/verify-email/${token}`)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified successfully. You can now sign in.');
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(
          err?.message ??
            'Verification failed. The link may have expired or already been used.'
        );
      });
  }, [token]);

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div className="auth-left-pane" style={{ width: '100%' }}>
          <div className="auth-form-wrapper flex flex-col items-center text-center gap-6 py-10">
            <Link to="/" className="auth-logo">
              <div className="auth-logo-icon">
                <Logo width={20} height={8} className="text-white" />
              </div>
              <span className="auth-logo-text">IntellMeet</span>
            </Link>

            {status === 'loading' && (
              <>
                <Loader2 size={48} className="animate-spin text-indigo-600" />
                <p className="text-[var(--color-text-secondary)] font-medium">
                  Verifying your email…
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle size={56} className="text-emerald-500" />
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
                    Email Verified!
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
                </div>
                <Link
                  to={ROUTES.LOGIN}
                  className="auth-submit-btn auth-submit-btn-sm text-center"
                  style={{ display: 'inline-block', padding: '10px 32px' }}
                >
                  Sign In
                </Link>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle size={56} className="text-red-500" />
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
                    Verification Failed
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
                </div>
                <Link
                  to={ROUTES.LOGIN}
                  className="text-indigo-600 font-semibold text-sm hover:underline"
                >
                  Back to Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
