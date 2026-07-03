/**
 * VisuallyHidden — screen-reader-only text primitive.
 * WCAG 2.2 §1.3.1 — Information and Relationships.
 */
import type { ReactNode, ElementType } from 'react';

interface Props { children: ReactNode; as?: ElementType; }

export const VisuallyHidden = ({ children, as: Tag = 'span' }: Props) => {
  const Component = Tag as any;
  return <Component className="sr-only">{children}</Component>;
};

export default VisuallyHidden;
