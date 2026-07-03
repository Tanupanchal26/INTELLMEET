import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Zap } from 'lucide-react';
import Button from '../components/common/Button';
import { ROUTES } from '../constants';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#07070C] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px]" style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 70%)' }} />
      </div>

      <motion.div
        className="text-center relative z-10 flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
      >
        {/* Logo */}
        <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.3)]">
          <Zap size={20} className="text-white" strokeWidth={2.5} />
        </div>

        {/* 404 */}
        <div>
          <p
            className="gradient-text-animated font-black leading-none tracking-tighter select-none"
            style={{ fontSize: 'clamp(5rem, 20vw, 9rem)' }}
            aria-hidden="true"
          >
            404
          </p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-h4 text-[#F1F5F9]">Page not found</h1>
          <p className="text-sm text-[#64748B] max-w-xs text-center leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#94A3B8] transition-colors font-medium"
            aria-label="Go back"
          >
            <ArrowLeft size={14} />
            Go back
          </button>
          <span className="text-[#2D3A4A]">·</span>
          <Link to={ROUTES.DASHBOARD}>
            <Button size="md" leftIcon={<Home size={13} />}>
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
