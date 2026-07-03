import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'default' | 'full';
}

export const PageContainer = ({ children, className, size = 'default' }: PageContainerProps) => {
  const maxWidthClass = {
    sm: 'max-w-3xl',
    default: 'max-w-[1440px]',
    full: 'max-w-full',
  }[size];

  return (
    <div className={clsx(`w-full mx-auto ${maxWidthClass}`, className)}>
      {children}
    </div>
  );
};
