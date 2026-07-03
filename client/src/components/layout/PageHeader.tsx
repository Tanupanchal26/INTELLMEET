import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export const PageHeader = ({ title, subtitle, action, className }: PageHeaderProps) => {
  return (
    <div className={clsx("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6", className)}>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)] leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-1 text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
};
