import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Zap, Video, Brain, CheckSquare, Shield, Users, Mic, Sparkles,
  Check, Lock, Globe, Settings, MessageSquare, ArrowRight, X,
  ChevronDown, BarChart2, Play, Star, Menu, Cpu, Layers,
  TrendingUp, Clock, Award, ChevronRight, Workflow,
} from 'lucide-react';
import { ROUTES } from '../constants';
import { useAppSelector, useAppDispatch } from '../hooks/useAppDispatch';
import { clearAuth } from '../store/auth/auth.slice';
import { authService } from '../api/auth.api';
import toast from 'react-hot-toast';
import Logo from '../components/common/Logo';

/* ─── helpers ─── */
const W = 'max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-14';
const FU = (delay = 0, y = 28) => ({
  initial: { opacity: 0, y },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as const, delay },
});

/* ─── Counter ─── */
const Counter = ({ end, suffix = '', decimals = 0 }: { end: number; suffix?: string; decimals?: number }) => {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let s = 0;
    const step = end / 70;
    const id = setInterval(() => {
      s += step;
      if (s >= end) { setVal(end); clearInterval(id); }
      else setVal(parseFloat(s.toFixed(decimals)));
    }, 14);
    return () => clearInterval(id);
  }, [inView, end, decimals]);
  return <span ref={ref}>{decimals > 0 ? val.toFixed(decimals) : val.toLocaleString()}{suffix}</span>;
};

/* ─── Navbar ─── */
const Navbar = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 10);

      // Prevent hiding if the mobile menu is currently open
      if (mobileOpen) {
        setVisible(true);
        return;
      }

      if (currentScrollY < 100) {
        setVisible(true);
      } else if (currentScrollY > lastScrollY.current) {
        setVisible(false); // Scrolling down
      } else {
        setVisible(true); // Scrolling up
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mobileOpen]);

  const logout = async () => {
    try { await authService.logout().catch(() => {}); } finally {
      dispatch(clearAuth()); localStorage.clear(); sessionStorage.clear();
      toast.success('Signed out'); navigate('/', { replace: true });
    }
  };

  const links = ['Products', 'AI Solutions', 'Enterprise', 'Pricing'];

  return (
    <>
      <header
        className="fixed top-0 inset-x-0 z-[100] transition-all duration-500"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(-100%)',
          background: scrolled ? 'var(--color-surface)' : 'transparent',
          backdropFilter: scrolled ? 'blur(24px) saturate(180%)' : 'none',
          borderBottom: scrolled ? '1px solid var(--color-surface-2)' : 'none',
          boxShadow: scrolled ? '0 4px 32px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        <div className={`${W} h-20 flex items-center justify-between`}>
          {/* Logo */}
          <Link to={ROUTES.HOME} className="flex items-center gap-2.5 group">
            <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#2563EB,#7C3AED)', boxShadow: '0 0 20px rgba(99,102,241,0.5)' }}>
              <Logo width={24} height={9} className="text-[var(--color-text)] relative z-10" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#2563EB)' }} />
            </div>
            <span className="text-[18px] font-black tracking-tight text-[var(--color-text)]">Intell<span style={{ color: '#818CF8' }}>Meet</span></span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {links.map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`}
                className="group flex items-center gap-1 px-4 py-2.5 rounded-xl text-[13.5px] font-semibold text-[var(--color-text)]/55 hover:text-[var(--color-text)] transition-all duration-200 hover:bg-white/[0.07] relative">
                {item}
                {item !== 'Pricing' && <ChevronDown size={11} className="opacity-40 group-hover:opacity-70 transition-opacity" />}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link to={ROUTES.DASHBOARD} className="hidden sm:block text-[13px] font-semibold text-[var(--color-text)]/60 hover:text-[var(--color-text)] transition-colors px-3 py-2">Dashboard</Link>
                <button onClick={logout}
                  className="px-5 py-2.5 rounded-full border border-[var(--color-border)] text-[var(--color-text)]/70 text-[13px] font-semibold hover:bg-white/[0.08] hover:text-[var(--color-text)] transition-all">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to={ROUTES.LOGIN} className="hidden sm:block text-[13px] font-semibold text-[var(--color-text)]/55 hover:text-[var(--color-text)] transition-colors px-3 py-2">
                  Sign In
                </Link>
                <Link to={ROUTES.SIGNUP}
                  className="px-5 py-2.5 rounded-full text-[13px] font-bold text-[var(--color-text)] transition-all duration-300 hover:scale-105 hidden sm:flex items-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg,#2563EB,#7C3AED)', boxShadow: '0 4px 20px rgba(99,102,241,0.45)' }}>
                  Get Started Free <ArrowRight size={13} />
                </Link>
              </>
            )}
            <button className="lg:hidden p-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text)]/70 hover:bg-white/[0.08] transition-all"
              onClick={() => setMobileOpen(v => !v)}>
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="fixed top-20 inset-x-4 z-[99] rounded-2xl p-5 lg:hidden"
            style={{ background: 'var(--color-surface)', backdropFilter: 'blur(24px)', border: '1px solid var(--color-surface-2)' }}>
            {links.map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(' ', '-')}`}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-[15px] font-semibold text-[var(--color-text)]/60 hover:text-[var(--color-text)] hover:bg-white/[0.07] transition-all">
                {l} <ChevronRight size={14} className="opacity-40" />
              </a>
            ))}
            <div className="pt-4 mt-2 border-t border-white/[0.08] flex gap-3">
              <Link to={ROUTES.LOGIN} onClick={() => setMobileOpen(false)}
                className="flex-1 py-2.5 text-center rounded-xl border border-[var(--color-border)] text-[var(--color-text)]/70 text-[13px] font-semibold">Sign In</Link>
              <Link to={ROUTES.SIGNUP} onClick={() => setMobileOpen(false)}
                className="flex-1 py-2.5 text-center rounded-xl text-[var(--color-text)] text-[13px] font-bold"
                style={{ background: 'linear-gradient(135deg,#2563EB,#7C3AED)' }}>Get Started</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

/* ─── Dashboard Mockup ─── */
const DashboardMockup = () => (
  <div className="relative w-full">
    {/* Main dashboard surface */}
    <div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        background: 'var(--color-surface-2)',
        backdropFilter: 'blur(32px)',
        border: '1px solid var(--color-surface-2)',
        boxShadow: '0 48px 120px rgba(0,0,0,0.65), 0 0 0 1px var(--color-surface-2), inset 0 1px 0 var(--color-surface-2)',
      }}
    >
      {/* Window chrome */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]" style={{ background: 'var(--color-surface-2)' }}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {['#FF5F57', '#FEBC2E', '#28C840'].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}
          </div>
          <span className="ml-3 text-[11px] font-semibold text-[var(--color-text)]/25 tracking-wide">IntellMeet Workspace</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold text-emerald-400" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <motion.span className="w-1.5 h-1.5 rounded-full bg-emerald-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            Live Session
          </span>
        </div>
      </div>

      {/* Dashboard body */}
      <div className="p-5 flex flex-col gap-4">

        {/* Top metric row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Meeting Score', value: '94', unit: '/100', color: '#6366F1', icon: TrendingUp },
            { label: 'Action Items', value: '12', unit: ' open', color: '#10B981', icon: CheckSquare },
            { label: 'Time Saved', value: '3.2', unit: 'hrs', color: '#F59E0B', icon: Clock },
          ].map(({ label, value, unit, color, icon: Icon }) => (
            <div key={label} className="rounded-xl p-3.5" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-surface-2)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-[var(--color-text)]/30 uppercase tracking-[0.12em]">{label}</span>
                <Icon size={11} style={{ color }} />
              </div>
              <div className="text-[22px] font-black text-[var(--color-text)] tracking-tight leading-none">
                {value}<span className="text-[11px] font-semibold text-[var(--color-text)]/30 ml-0.5">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Live transcription panel */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.25)' }}>
                <Sparkles size={9} className="text-[var(--color-primary)]" />
              </div>
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">AI Transcription</span>
            </div>
            <div className="flex gap-px items-end h-3">
              {[3, 5, 4, 6, 3, 5, 4].map((h, j) => (
                <motion.div key={j} className="w-[2px] rounded-full bg-indigo-400" style={{ height: `${h}px` }}
                  animate={{ scaleY: [1, 1.9, 1] }} transition={{ duration: 0.7, repeat: Infinity, delay: j * 0.09 }} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { speaker: 'Sarah M.', color: '#6366F1', text: 'We need to finalise the Q4 roadmap before end of week.' },
              { speaker: 'Alex C.', color: '#10B981', text: 'Agreed — I can have the infra proposal ready by Thursday.' },
            ].map(({ speaker, color, text }) => (
              <div key={speaker} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-black text-[var(--color-text)] shrink-0 mt-0.5" style={{ background: color }}>
                  {speaker[0]}
                </div>
                <div>
                  <span className="text-[9px] font-bold" style={{ color }}>{speaker}</span>
                  <p className="text-[11px] text-[var(--color-text)]/55 leading-snug">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action items */}
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-surface-2)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-[var(--color-text)]/30 uppercase tracking-widest">Extracted Actions</span>
            <span className="text-[9px] font-bold text-[var(--color-primary)]">4 detected</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              { task: 'Scale infra capacity 20%', owner: 'Alex', priority: 'high', done: false },
              { task: 'Ship onboarding V2 to staging', owner: 'Sarah', priority: 'high', done: false },
              { task: 'CCPA compliance review', owner: 'Legal', priority: 'med', done: true },
            ].map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 + i * 0.12 }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-surface-2)' }}>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.priority === 'high' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                <span className={`flex-1 text-[11px] font-medium ${t.done ? 'text-[var(--color-text)]/25 line-through' : 'text-[var(--color-text)]/70'}`}>{t.task}</span>
                <span className="text-[9px] font-bold text-[var(--color-text)]/25">@{t.owner}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Participant strip */}
        <div className="flex items-center justify-between">
          <div className="flex -space-x-2">
            {[{ c: '#6366F1', i: 'SM' }, { c: '#EC4899', i: 'JW' }, { c: '#10B981', i: 'PR' }, { c: '#F59E0B', i: 'AC' }].map(({ c, i }) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[8px] font-black text-[var(--color-text)]" style={{ background: c, borderColor: '#0D1123' }}>{i}</div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-[9px] font-bold text-[var(--color-text)]/35">REC · 42:15</span>
          </div>
          <button className="px-3 py-1.5 rounded-lg bg-rose-600/80 text-[9px] font-black text-[var(--color-text)] uppercase tracking-widest">End Call</button>
        </div>
      </div>
    </div>

    {/* Floating card 1 — AI insight */}
    <motion.div
      initial={{ opacity: 0, x: -24, y: 8 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ delay: 1.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="absolute -left-12 top-[22%] flex items-center gap-3 px-4 py-3 rounded-2xl hidden xl:flex"
      style={{ background: 'var(--color-surface-2)', backdropFilter: 'blur(24px)', border: '1px solid rgba(16,185,129,0.28)', boxShadow: '0 16px 48px rgba(0,0,0,0.55)' }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(16,185,129,0.15)' }}>
        <TrendingUp size={15} className="text-emerald-400" />
      </div>
      <div>
        <div className="text-[12px] font-black text-[var(--color-text)]">+34% Productivity</div>
        <div className="text-[9px] text-[var(--color-text)]/35">avg team improvement</div>
      </div>
    </motion.div>

    {/* Floating card 2 — time saved */}
    <motion.div
      initial={{ opacity: 0, x: 24, y: 8 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ delay: 1.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="absolute -right-12 bottom-[18%] flex items-center gap-3 px-4 py-3 rounded-2xl hidden xl:flex"
      style={{ background: 'var(--color-surface-2)', backdropFilter: 'blur(24px)', border: '1px solid rgba(99,102,241,0.28)', boxShadow: '0 16px 48px rgba(0,0,0,0.55)' }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
        <Clock size={15} className="text-[var(--color-primary)]" />
      </div>
      <div>
        <div className="text-[12px] font-black text-[var(--color-text)]">5 hrs/week saved</div>
        <div className="text-[9px] text-[var(--color-text)]/35">per team member</div>
      </div>
    </motion.div>
  </div>
);

/* ─── Hero ─── */
const Hero = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden"
      style={{
        background: 'var(--color-bg)',
        minHeight: '85vh',
        paddingTop: 'clamp(88px, 12vw, 128px)',
        paddingBottom: 'clamp(48px, 8vw, 120px)',
      }}
    >
      {/* Background glows */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-8%] left-[8%] w-[640px] h-[640px] rounded-full blur-[140px] opacity-[0.16]"
          style={{ background: 'radial-gradient(circle,#2563EB,transparent 70%)' }} />
        <div className="absolute top-[15%] right-[2%] w-[480px] h-[480px] rounded-full blur-[120px] opacity-[0.13]"
          style={{ background: 'radial-gradient(circle,#7C3AED,transparent 70%)' }} />
        <div className="absolute bottom-[0%] left-[35%] w-[360px] h-[360px] rounded-full blur-[110px] opacity-[0.09]"
          style={{ background: 'radial-gradient(circle,#4F46E5,transparent 70%)' }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(var(--color-surface-2) 1px,transparent 1px),linear-gradient(90deg,var(--color-surface-2) 1px,transparent 1px)', backgroundSize: '72px 72px' }} />
      </motion.div>

      {/* 1280px container */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-14 relative z-10 h-full">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-0">

          {/* ── LEFT 45% ── */}
          <div className="w-full lg:w-[45%] flex flex-col text-center lg:text-left lg:pr-14">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2.5 self-center lg:self-start px-4 py-2 rounded-full cursor-default"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.28)', boxShadow: '0 0 18px rgba(99,102,241,0.12)' }}
            >
              <motion.span className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }} />
              <span className="text-[11.5px] font-bold text-indigo-300 uppercase tracking-[0.11em]">AI-Powered Enterprise Video Platform</span>
            </motion.div>

            {/* Headline — 24px below badge */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="font-extrabold text-[var(--color-text)] leading-[1.04] tracking-[-0.04em]"
              style={{ fontSize: 'clamp(2.25rem, 7vw, 72px)', marginTop: '24px' }}
            >
              Meet Smarter.<br />
              Work Faster.<br />
              <span style={{ background: 'linear-gradient(90deg,#60A5FA 0%,#A78BFA 55%,#F472B6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Grow Together.
              </span>
            </motion.h1>

            {/* Description — 32px below headline */}
            <motion.p
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(15px,2.5vw,17px)] text-[var(--color-text)]/62 leading-[1.78] self-center lg:self-start"
              style={{ maxWidth: '600px', marginTop: '32px' }}
            >
              Transform every conversation into actionable intelligence. Real-time AI transcription, smart summaries, automatic action-item extraction, and enterprise-grade collaboration — all in one unified workspace.
            </motion.p>

            {/* CTAs — 40px below description */}
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
              style={{ marginTop: '40px' }}
            >
              {/* Primary — filled gradient */}
              <Link
                to={ROUTES.SIGNUP}
                className="group inline-flex items-center justify-center gap-2.5 px-8 rounded-full font-bold text-[14.5px] text-[var(--color-text)] transition-all duration-300 hover:scale-[1.03] hover:brightness-110"
                style={{
                  height: '52px',
                  background: 'linear-gradient(135deg,#2563EB 0%,#6366F1 50%,#7C3AED 100%)',
                  boxShadow: '0 8px 32px rgba(37,99,235,0.42), 0 0 0 1px var(--color-surface-2), inset 0 1px 0 var(--color-surface-2)',
                }}
              >
                Start Free Today
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform duration-200" />
              </Link>

              {/* Secondary — ghost */}
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-2.5 px-8 rounded-full font-bold text-[14.5px] text-[var(--color-text)]/75 transition-all duration-300 hover:text-[var(--color-text)] hover:bg-white/[0.07] hover:border-[var(--color-border)]"
                style={{
                  height: '52px',
                  border: '1px solid var(--color-surface-2)',
                }}
              >
                <div className="w-6 h-6 rounded-full bg-white/12 flex items-center justify-center">
                  <Play size={9} className="fill-current ml-0.5" />
                </div>
                Watch Demo
              </a>
            </motion.div>

            {/* Trust strip — reviews + stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row items-center lg:items-start gap-5 pt-8 mt-10 border-t border-white/[0.08]"
            >
              {/* Avatars + rating */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {['#6366F1','#EC4899','#10B981','#F59E0B','#3B82F6'].map((c, i) => (
                    <div key={i} className="w-7 h-7 rounded-full border-[1.5px] border-[#0B1650]"
                      style={{ background: `linear-gradient(135deg,${c},${c}80)`, zIndex: 5 - i }} />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => <Star key={i} size={11} className="fill-amber-400 text-amber-400" />)}
                    <span className="text-[12px] font-bold text-[var(--color-text)] ml-1">4.9/5</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text)]/32">14,000+ enterprise reviews</p>
                </div>
              </div>

              <div className="hidden sm:block w-px h-9 bg-white/[0.08]" />

              {/* Stats */}
              <div className="flex gap-6">
                {[
                  { end: 250, suffix: 'K+', label: 'Active Users' },
                  { end: 10, suffix: 'M+', label: 'AI Insights' },
                  { end: 99.9, suffix: '%', label: 'Uptime', decimals: 1 },
                ].map(s => (
                  <div key={s.label} className="text-center lg:text-left">
                    <div className="text-[18px] font-black text-[var(--color-text)] tracking-tight leading-none">
                      <Counter end={s.end} suffix={s.suffix} decimals={s.decimals ?? 0} />
                    </div>
                    <div className="text-[10px] text-[var(--color-text)]/28 uppercase tracking-wider mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── RIGHT 55% ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-full sm:hidden lg:block lg:w-[55%] relative lg:pl-6"
          >
            {/* Glow behind mockup */}
            <div className="absolute -inset-8 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 55%,rgba(99,102,241,0.16),transparent 65%)' }} />
            <DashboardMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

/* ─── Products ─── */
const Products = () => {
  const cards = [
    { icon: Video, title: 'AI Video Meetings', desc: 'HD conferencing with real-time transcription, AI summaries and automatic action-item extraction.', color: '#6366F1', glow: 'rgba(99,102,241,0.2)' },
    { icon: Brain, title: 'IntelliMate AI', desc: 'Your meeting co-pilot — asks clarifying questions, surfaces context, and writes follow-up emails.', color: '#8B5CF6', glow: 'rgba(139,92,246,0.2)' },
    { icon: BarChart2, title: 'Analytics Hub', desc: 'Meeting effectiveness scores, talk-time analytics, sentiment trends and ROI dashboards.', color: '#10B981', glow: 'rgba(16,185,129,0.2)' },
    { icon: Workflow, title: 'Task Sync', desc: 'Action items pushed instantly to Jira, Linear, Asana, Notion or any webhook endpoint.', color: '#3B82F6', glow: 'rgba(59,130,246,0.2)' },
    { icon: MessageSquare, title: 'Team Channels', desc: 'Persistent threaded conversations, shared docs, and smart message search powered by AI.', color: '#EC4899', glow: 'rgba(236,72,153,0.2)' },
    { icon: Layers, title: 'Meeting Rooms', desc: 'Hybrid smart-room integration with intelligent scheduling and calendar sync across timezones.', color: '#F59E0B', glow: 'rgba(245,158,11,0.2)' },
  ];

  return (
    <section id="products" className="min-h-screen flex flex-col justify-center" style={{ background: 'var(--color-bg)', padding: '0' }}>
      <div className={`${W} py-20 lg:py-24`}>
        {/* Heading — centered */}
        <motion.div {...FU()} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/20 bg-indigo-500/[0.07] text-[11px] font-bold text-[var(--color-primary)] uppercase tracking-[0.12em] mb-6">
            <Cpu size={11} />Platform
          </div>
          <h2 className="font-black text-[var(--color-text)] tracking-tight mb-5" style={{ fontSize: 'clamp(2rem,4vw,3.5rem)', letterSpacing: '-0.03em' }}>
            One platform.<br />Infinite possibilities.
          </h2>
          <p className="text-[var(--color-text)]/40 text-[17px] max-w-xl mx-auto leading-relaxed">
            Every tool your team needs — connected by AI and built for enterprise scale.
          </p>
        </motion.div>

        {/* Cards grid — centered, wider cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {cards.map((c, i) => (
            <motion.div key={c.title} {...FU(i * 0.07)}
              className="group relative p-8 rounded-3xl cursor-pointer overflow-hidden transition-all duration-500 hover:-translate-y-2"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-surface-2)' }}
              whileHover={{ boxShadow: `0 20px 60px ${c.glow}, 0 0 0 1px ${c.color}30` }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(circle at 30% 30%,${c.glow},transparent 60%)` }} />
              <div className="w-13 h-13 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 relative"
                style={{ width: 52, height: 52, background: `${c.color}18`, border: `1px solid ${c.color}30` }}>
                <c.icon size={24} style={{ color: c.color }} />
              </div>
              <h3 className="text-[18px] font-bold text-[var(--color-text)] mb-3 tracking-tight">{c.title}</h3>
              <p className="text-[14.5px] text-[var(--color-text)]/42 leading-relaxed">{c.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ─── AI Section ─── */
const AISection = () => (
  <section id="ai-solutions" className="py-28 lg:py-36" style={{ background: 'var(--color-bg)' }}>
    <div className={W}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
        <motion.div {...FU()}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/20 bg-indigo-500/[0.07] text-[11px] font-bold text-[var(--color-primary)] uppercase tracking-[0.12em] mb-7">
            <Brain size={11} />AI Intelligence
          </div>
          <h2 className="font-black text-[var(--color-text)] tracking-tight leading-tight mb-9" style={{ fontSize: 'clamp(2rem,3.5vw,3rem)', letterSpacing: '-0.03em' }}>
            Meetings that<br />think for themselves.
          </h2>
          <div className="flex flex-col gap-7">
            {[
              { icon: Mic, title: 'Neural Transcription', desc: '99.4% accurate, multi-speaker diarization, real-time captions in 40+ languages.', color: '#6366F1' },
              { icon: Sparkles, title: 'Abstractive Summaries', desc: 'Context-aware narrative summaries — not bullet points. Reads like a memo, not a transcript.', color: '#8B5CF6' },
              { icon: CheckSquare, title: 'Zero-Friction Task Sync', desc: 'Action items extracted and pushed to your task manager in under 3 seconds.', color: '#10B981' },
              { icon: Cpu, title: 'Smart Follow-ups', desc: 'AI drafts personalized follow-up emails for each attendee with key context highlighted.', color: '#F59E0B' },
            ].map((item, i) => (
              <motion.div key={i} {...FU(i * 0.07)} className="group flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110"
                  style={{ background: `${item.color}15`, border: `1px solid ${item.color}25` }}>
                  <item.icon size={18} style={{ color: item.color }} />
                </div>
                <div>
                  <h4 className="text-[15.5px] font-bold text-[var(--color-text)] mb-1.5">{item.title}</h4>
                  <p className="text-[13.5px] text-[var(--color-text)]/40 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* AI card */}
        <motion.div {...FU(0.14)}>
          <div className="rounded-3xl p-px" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.4),rgba(139,92,246,0.15),transparent 60%)' }}>
            <div className="rounded-3xl p-7" style={{ background: 'var(--color-surface-2)' }}>
              <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/[0.06]">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg"
                  style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.5)' }}>
                  <Sparkles size={16} className="text-[var(--color-text)]" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-black text-[var(--color-text)] uppercase tracking-widest">AI Recap Engine</p>
                  <p className="text-[10px] text-[var(--color-text)]/30 mt-0.5">Q4 Strategy Review · 47 min</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>Complete</span>
              </div>

              <div className="p-4 rounded-2xl mb-5" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-surface-2)' }}>
                <p className="text-[9px] font-black text-[var(--color-primary)] uppercase tracking-[0.2em] mb-3">Executive Summary</p>
                <p className="text-[13px] text-[var(--color-text)]/60 leading-relaxed italic">
                  "The team converged on a modular Q4 strategy. Alex flagged infra constraints; Marcus committed to a 20% capacity scale-up by Friday. The onboarding redesign was greenlit with a Nov 15 deadline."
                </p>
              </div>

              <p className="text-[9px] font-black text-[var(--color-text)]/20 uppercase tracking-[0.2em] mb-3">Action Items · 4 found</p>
              {[
                { task: 'Scale infra capacity by 20%', owner: 'Alex', priority: 'high', due: 'Nov 8' },
                { task: 'Ship onboarding V2 to staging', owner: 'Sarah', priority: 'high', due: 'Nov 15' },
                { task: 'CCPA compliance audit', owner: 'Legal', priority: 'med', due: 'Nov 22' },
                { task: 'Update sales deck for Q4', owner: 'Marcus', priority: 'low', due: 'Nov 29' },
              ].map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.1 }}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl mb-2 cursor-pointer hover:bg-white/[0.05] transition-colors group"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-surface-2)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${t.priority === 'high' ? 'bg-rose-500' : t.priority === 'med' ? 'bg-amber-500' : 'bg-slate-500'}`} />
                    <span className="text-[12px] font-medium text-[var(--color-text)]/80 group-hover:text-[var(--color-text)] transition-colors">{t.task}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] text-[var(--color-text)]/25 uppercase font-bold">{t.due}</span>
                    <span className="text-[9px] font-bold text-[var(--color-text)]/30 uppercase">@{t.owner}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

/* ─── Security ─── */
const Security = () => (
  <section id="enterprise" className="py-28 lg:py-36" style={{ background: 'var(--color-bg)' }}>
    <div className={W}>
      <div className="relative rounded-[2rem] overflow-hidden p-16 md:p-28 text-center"
        style={{ background: 'linear-gradient(135deg,#1E3A8A 0%,#4F46E5 50%,#7C3AED 100%)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right,var(--color-surface-2),transparent 55%)' }} />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        <motion.div {...FU()} className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--color-border)] bg-white/10 text-[11px] font-bold text-[var(--color-text)] uppercase tracking-[0.12em] mb-7">
            <Lock size={10} />Zero-Trust Security
          </div>
          <h2 className="font-black text-[var(--color-text)] tracking-tight mb-7" style={{ fontSize: 'clamp(2.5rem,5vw,4rem)', letterSpacing: '-0.03em' }}>
            Your data is yours.<br />Period.
          </h2>
          <p className="text-[17px] text-[var(--color-text)]/65 mb-14 leading-relaxed max-w-2xl mx-auto">
            Built on zero-trust architecture with end-to-end AES-256 encryption, multi-region data residency, and full SOC 2 Type II compliance.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Lock, title: 'E2E Encryption', desc: 'AES-256 Bit' },
              { icon: Shield, title: 'Compliance', desc: 'SOC2 Type II' },
              { icon: Globe, title: 'Data Residency', desc: 'EU · US · APAC' },
              { icon: Settings, title: 'IAM Controls', desc: 'SSO / SAML' },
            ].map((item, i) => (
              <motion.div key={i} {...FU(i * 0.07)} className="flex flex-col items-center gap-3 group">
                <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors duration-300">
                  <item.icon size={22} className="text-[var(--color-text)]" />
                </div>
                <div className="text-[12px] font-black text-[var(--color-text)] uppercase tracking-widest">{item.title}</div>
                <div className="text-[10px] font-semibold text-[var(--color-text)]/55 uppercase tracking-widest">{item.desc}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

/* ─── CTA ─── */
const CTA = () => (
  <section className="py-28 lg:py-36" style={{ background: 'var(--color-bg-tertiary)' }}>
    <div className={W}>
      <motion.div {...FU()}
        className="relative rounded-[2rem] p-12 lg:p-20 text-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0B1E63 0%,#2563EB 40%,#7C3AED 80%,#1a0a3d 100%)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 60% -10%,var(--color-surface-2),transparent 55%)' }} />
        {/* particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-white/20"
            style={{ top: `${20 + i * 12}%`, left: `${10 + i * 14}%` }}
            animate={{ y: [-12, 12, -12], opacity: [0.15, 0.5, 0.15] }}
            transition={{ duration: 3 + i * 0.8, repeat: Infinity, ease: 'easeInOut' }} />
        ))}
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="font-black text-[var(--color-text)] tracking-tight mb-6" style={{ fontSize: 'clamp(2rem,4vw,3.25rem)', letterSpacing: '-0.04em' }}>
            Ready to Transform<br />the Way You Meet?
          </h2>
          <p className="text-[18px] text-[var(--color-text)]/60 mb-12 leading-relaxed">
            Join 250,000+ professionals running smarter meetings with IntellMeet.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={ROUTES.SIGNUP}
              className="px-9 py-4 rounded-full text-[15px] font-bold bg-white text-indigo-600 hover:bg-white/90 transition-all duration-300 hover:scale-[1.03] flex items-center justify-center gap-2"
              style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
              Start Free — No Credit Card <ArrowRight size={16} />
            </Link>
            <a href="#"
              className="px-9 py-4 rounded-full text-[15px] font-bold text-[var(--color-text)] border border-[var(--color-border)] hover:bg-white/[0.1] transition-all duration-300 flex items-center justify-center">
              Talk to Sales
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

/* ─── Footer ─── */
const Footer = () => (
  <footer className="pt-16 pb-10 border-t border-white/[0.06]" style={{ background: 'var(--color-bg-secondary)' }}>
    <div className={W}>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-10 mb-14">
        <div className="col-span-2">
          <Link to={ROUTES.HOME} className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#2563EB,#7C3AED)' }}>
              <Zap size={16} className="text-[var(--color-text)] fill-current" />
            </div>
            <span className="text-[17px] font-black text-[var(--color-text)] tracking-tight">Intell<span className="text-[var(--color-primary)]">Meet</span></span>
          </Link>
          <p className="text-[13px] text-[var(--color-text)]/28 leading-relaxed max-w-xs mb-6">
            AI-powered meetings and collaboration for modern enterprise teams.
          </p>
          <div className="flex gap-2.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-8 h-8 rounded-full border border-[var(--color-border)] hover:bg-white/[0.08] transition-colors cursor-pointer" />
            ))}
          </div>
        </div>
        {[
          { head: 'Product', links: ['AI Meetings', 'IntelliMate', 'Analytics', 'Rooms'] },
          { head: 'Company', links: ['About', 'Careers', 'Blog', 'Press'] },
          { head: 'Resources', links: ['Docs', 'API', 'Help Center', 'Status'] },
          { head: 'Legal', links: ['Privacy', 'Terms', 'Security', 'CCPA'] },
        ].map(col => (
          <div key={col.head}>
            <p className="text-[10px] font-black text-[var(--color-text)]/25 uppercase tracking-[0.18em] mb-5">{col.head}</p>
            <ul className="flex flex-col gap-3">
              {col.links.map(l => (
                <li key={l}><a href="#" className="text-[13px] text-[var(--color-text)]/28 hover:text-[var(--color-text)] transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between pt-7 border-t border-white/[0.06] gap-4">
        <p className="text-[11px] text-[var(--color-text)]/18 uppercase tracking-widest">© 2025 IntellMeet Inc. All Rights Reserved.</p>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <motion.span className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">All Systems Operational</span>
          </div>
          <span className="text-[10px] text-[var(--color-text)]/18 uppercase tracking-widest">SOC 2 Type II</span>
        </div>
      </div>
    </div>
  </footer>
);

/* ─── Page ─── */
export default function Home() {
  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text)] font-sans antialiased">
      <Navbar />
      <main>
        <Hero />
        <Products />
        <AISection />
        <Security />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
