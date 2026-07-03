import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface DashboardGridProps {
  main: ReactNode;
  sidebar?: ReactNode;
  className?: string;
}

export const DashboardGrid = ({ main, sidebar, className }: DashboardGridProps) => {
  return (
    <div className={clsx("grid grid-cols-1 xl:grid-cols-12 gap-6 items-start", className)}>
      <div className={clsx("flex flex-col gap-6", sidebar ? "xl:col-span-8 2xl:col-span-9" : "xl:col-span-12")}>
        {main}
      </div>
      {sidebar && (
        <div className="flex flex-col gap-6 xl:col-span-4 2xl:col-span-3 sticky top-6">
          {sidebar}
        </div>
      )}
    </div>
  );
};

export const ContentGrid = ({ children, columns = 3, className }: { children: ReactNode, columns?: 1 | 2 | 3 | 4, className?: string }) => {
  const colsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }[columns];

  return (
    <div className={clsx(`grid gap-4 sm:gap-6 ${colsClass}`, className)}>
      {children}
    </div>
  );
};
