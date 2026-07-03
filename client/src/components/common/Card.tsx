import { clsx } from 'clsx';
import type { HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'inset' | 'brand' | 'danger' | 'success' | 'warning';
  hover?: boolean;
  interactive?: boolean;
  noPadding?: boolean;
}

const VARIANTS = {
  default:  'bg-[var(--color-surface)] border border-[var(--color-border)] backdrop-blur-md',
  elevated: 'bg-[var(--color-surface)] border border-[var(--color-border)] backdrop-blur-md shadow-[0_8px_32px_rgba(66,67,65,0.08)]',
  bordered: 'bg-[var(--color-surface)] border border-[var(--color-border-strong)] backdrop-blur-md',
  inset:    'bg-[var(--color-bg-secondary)] border border-[var(--color-border)]',
  brand:    'bg-[var(--color-primary-light)] border border-[var(--color-primary-border)] text-[var(--color-primary-hover)]',
  danger:   'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400',
  success:  'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  warning:  'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400',
};

const SHADOW = '0 4px 24px rgba(66,67,65,0.06)';

const HOVER =
  'cursor-pointer transition-all duration-300 ' +
  'hover:border-slate-400 hover:shadow-[0_8px_32px_rgba(66,67,65,0.12)] hover:-translate-y-1 hover:bg-[var(--color-surface-hover)]';

const Card = ({
  variant = 'default',
  hover,
  interactive,
  noPadding,
  className,
  children,
  onClick,
  style,
  ...rest
}: Props) => (
  <div
    onClick={onClick}
    role={onClick || interactive ? 'button' : undefined}
    tabIndex={onClick || interactive ? 0 : undefined}
    onKeyDown={
      onClick || interactive
        ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e as any); } }
        : undefined
    }
    className={clsx(
      'rounded-2xl overflow-hidden',
      VARIANTS[variant],
      !noPadding && 'p-5',
      (hover || interactive || onClick) && HOVER,
      className
    )}
    style={{ boxShadow: SHADOW, ...style }}
    {...rest}
  >
    {children}
  </div>
);

export default Card;
