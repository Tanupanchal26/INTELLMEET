import { clsx } from 'clsx';

interface Props {
  fullPage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const SIZES = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };

const SpinnerSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={clsx('animate-spin', className)} aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.12" strokeWidth="2.5" />
    <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const Loader = ({ fullPage, size = 'md', className, label }: Props) => {
  if (fullPage) {
    return (
      <div
        className="flex items-center justify-center w-full h-full min-h-[300px] flex-1 py-12"
        role="status"
        aria-label={label || 'Loading'}
      >
        <SpinnerSVG className={clsx('w-8 h-8 text-[var(--color-primary)]', className)} />
      </div>
    );
  }

  return <SpinnerSVG className={clsx(SIZES[size], 'text-[var(--color-primary)]', className)} />;
};

/* ── Skeleton primitives ── */
export const SkeletonBlock = ({
  className,
  height,
  width,
  rounded,
}: {
  className?: string;
  height?: string | number;
  width?: string | number;
  rounded?: string;
}) => (
  <div
    role="status"
    aria-label="Loading"
    className={clsx('skeleton', className)}
    style={{ height, width, borderRadius: rounded }}
  />
);

export const SkeletonText = ({
  lines = 1,
  className,
  lastLineWidth = '65%',
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}) => (
  <div className={clsx('flex flex-col gap-2', className)} role="status" aria-label="Loading">
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="skeleton rounded-md h-[13px]"
        style={{ width: i === lines - 1 && lines > 1 ? lastLineWidth : '100%' }}
      />
    ))}
  </div>
);

export const SkeletonCard = ({ className }: { className?: string }) => (
  <div className={clsx('rounded-xl bg-[#0F0F18] border border-[rgba(255,255,255,0.055)] p-4 flex flex-col gap-3', className)}>
    <div className="flex items-center gap-3">
      <SkeletonBlock className="rounded-lg" height={36} width={36} />
      <div className="flex-1 flex flex-col gap-2">
        <SkeletonBlock height={13} className="rounded-md w-3/4" />
        <SkeletonBlock height={11} className="rounded-md w-1/2" />
      </div>
    </div>
    <SkeletonText lines={2} />
  </div>
);

export const SkeletonAvatar = ({ size = 32 }: { size?: number }) => (
  <SkeletonBlock
    height={size}
    width={size}
    rounded="9999px"
    className="shrink-0"
  />
);

export default Loader;
