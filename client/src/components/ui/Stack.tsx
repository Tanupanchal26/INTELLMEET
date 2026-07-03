/**
 * Stack — reusable flex layout primitive.
 * Eliminates ad-hoc gap / margin hacks across the codebase.
 */
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column';
  gap?: 1 | 2 | 3 | 4 | 6 | 8 | 10 | 12;
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyContent'];
  wrap?: boolean;
  children: ReactNode;
}

const GAP: Record<number, string> = {
  1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4',
  6: 'gap-6', 8: 'gap-8', 10: 'gap-10', 12: 'gap-12',
};

export const Stack = ({
  direction = 'column',
  gap = 4,
  align,
  justify,
  wrap,
  className,
  style,
  children,
  ...rest
}: StackProps) => (
  <div
    className={clsx(
      'flex',
      direction === 'row' ? 'flex-row' : 'flex-col',
      GAP[gap],
      wrap && 'flex-wrap',
      className,
    )}
    style={{ alignItems: align, justifyContent: justify, ...style }}
    {...rest}
  >
    {children}
  </div>
);

export default Stack;
