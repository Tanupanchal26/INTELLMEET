/**
 * Grid — reusable CSS Grid layout primitive.
 * Replaces repetitive Tailwind grid strings with semantic token-driven props.
 */
import type { HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface GridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 6 | 12;
  smCols?: 1 | 2 | 3 | 4;
  lgCols?: 1 | 2 | 3 | 4;
  xlCols?: 1 | 2 | 3 | 4;
  gap?: 2 | 3 | 4 | 5 | 6 | 8;
  children: ReactNode;
}

const COLS: Record<number, string>   = { 1:'grid-cols-1', 2:'grid-cols-2', 3:'grid-cols-3', 4:'grid-cols-4', 6:'grid-cols-6', 12:'grid-cols-12' };
const SM:   Record<number, string>   = { 1:'sm:grid-cols-1', 2:'sm:grid-cols-2', 3:'sm:grid-cols-3', 4:'sm:grid-cols-4' };
const LG:   Record<number, string>   = { 1:'lg:grid-cols-1', 2:'lg:grid-cols-2', 3:'lg:grid-cols-3', 4:'lg:grid-cols-4' };
const XL:   Record<number, string>   = { 1:'xl:grid-cols-1', 2:'xl:grid-cols-2', 3:'xl:grid-cols-3', 4:'xl:grid-cols-4' };
const GAP:  Record<number, string>   = { 2:'gap-2', 3:'gap-3', 4:'gap-4', 5:'gap-5', 6:'gap-6', 8:'gap-8' };

export const Grid = ({
  cols = 1,
  smCols,
  lgCols,
  xlCols,
  gap = 4,
  className,
  children,
  ...rest
}: GridProps) => (
  <div
    className={clsx(
      'grid',
      COLS[cols],
      smCols && SM[smCols],
      lgCols && LG[lgCols],
      xlCols && XL[xlCols],
      GAP[gap],
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

export default Grid;
