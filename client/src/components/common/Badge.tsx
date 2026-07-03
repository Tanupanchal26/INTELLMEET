import { clsx } from 'clsx';

type Variant = 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'outline' | 'live' | 'ai' | 'recording';

const STYLES: Record<Variant, string> = {
  default:   'bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20',
  primary:   'bg-[var(--color-primary-light)] text-[var(--color-primary-hover)] border border-[var(--color-primary-border)]',
  success:   'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25',
  danger:    'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/25',
  warning:   'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/25',
  info:      'bg-blue-500/10 text-blue-750 dark:text-blue-400 border border-blue-500/25',
  purple:    'bg-[var(--color-primary-light)] text-[var(--color-primary-hover)] border border-[var(--color-primary-border)]',
  outline:   'bg-transparent text-[var(--color-text-secondary)] border border-[var(--color-border)]',
  live:      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-[0_2px_8px_rgba(16,185,129,0.08)]',
  ai:        'bg-[var(--color-primary-light)] text-[var(--color-primary-hover)] border border-[var(--color-primary-border)] shadow-[0_2px_8px_rgba(83,98,154,0.08)]',
  recording: 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/25 shadow-[0_2px_8px_rgba(239,68,68,0.08)]',
};

const DOT_COLOR: Partial<Record<Variant, string>> = {
  success: 'bg-[#10B981]', danger: 'bg-[#EF4444]', warning: 'bg-[#F59E0B]',
  primary: 'bg-[#3B82F6]', info: 'bg-[#3B82F6]', live: 'bg-[#10B981]', recording: 'bg-[#EF4444]',
};

interface Props {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

const Badge = ({ variant = 'default', children, className, dot, pulse, size = 'sm' }: Props) => (
  <span
    className={clsx(
      'inline-flex items-center gap-1.5 rounded-full font-semibold tracking-tight',
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
      STYLES[variant],
      className
    )}
  >
    {dot && (
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
        {pulse && (
          <span className={clsx('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', DOT_COLOR[variant] || 'bg-current')} />
        )}
        <span className={clsx('relative inline-flex rounded-full h-1.5 w-1.5', DOT_COLOR[variant] || 'bg-current')} />
      </span>
    )}
    {children}
  </span>
);

export default Badge;
