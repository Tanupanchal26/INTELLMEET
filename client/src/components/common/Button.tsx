import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline' | 'soft' | 'muted';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon-xs' | 'icon-sm' | 'icon-md' | 'icon-lg';
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const BASE =
  'relative inline-flex items-center justify-center font-semibold transition-all ' +
  'select-none cursor-pointer outline-none shrink-0 whitespace-nowrap tracking-tight ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ' +
  'active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2';

const VARIANTS = {
  primary:
    'text-white shadow-[0_2px_8px_rgba(66,67,65,0.12)] ' +
    'hover:shadow-[0_4px_16px_rgba(66,67,65,0.2)] hover:opacity-95 duration-200',
  secondary:
    'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)] ' +
    'shadow-[0_2px_6px_rgba(66,67,65,0.05)] ' +
    'hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)] duration-200',
  ghost:
    'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] duration-200',
  danger:
    'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/25 hover:bg-red-500/20 duration-200',
  success:
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 duration-200',
  outline:
    'bg-transparent text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] duration-200',
  soft:
    'bg-[var(--color-primary-light)] text-[var(--color-primary-hover)] border border-[var(--color-primary-border)] hover:bg-[var(--color-primary-light)]/85 duration-200',
  muted:
    'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-tertiary)] duration-200',
};

const SIZES = {
  xs:       'h-7  px-2.5  text-xs     rounded-lg  gap-1    font-medium',
  sm:       'h-8  px-3    text-[12px] rounded-xl  gap-1.5',
  md:       'h-9  px-4    text-[13px] rounded-xl  gap-2',
  lg:       'h-11 px-5    text-[14px] rounded-xl  gap-2',
  'icon-xs':  'h-7  w-7    text-xs  rounded-lg',
  'icon-sm':  'h-8  w-8    text-xs  rounded-xl',
  'icon-md':  'h-9  w-9    text-xs  rounded-xl',
  'icon-lg':  'h-11 w-11   text-sm  rounded-xl',
};

const PRIMARY_STYLE = { background: 'var(--color-primary)' };

const Button = ({
  variant = 'primary',
  size = 'md',
  loading,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  style,
  ...rest
}: Props) => (
  <button
    className={clsx(BASE, VARIANTS[variant], SIZES[size], className)}
    disabled={disabled || loading}
    aria-busy={loading}
    style={variant === 'primary' ? { ...PRIMARY_STYLE, ...style } : style}
    {...rest}
  >
    {loading ? (
      <Loader2 size={13} className="animate-spin shrink-0" aria-hidden="true" />
    ) : leftIcon ? (
      <span className="shrink-0 flex items-center" aria-hidden="true">{leftIcon}</span>
    ) : null}
    {children}
    {!loading && rightIcon && (
      <span className="shrink-0 flex items-center" aria-hidden="true">{rightIcon}</span>
    )}
  </button>
);

export default Button;
