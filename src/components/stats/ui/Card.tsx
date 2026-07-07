// src/components/stats/ui/Card.tsx
// Design-system card surface — white in light, zinc-900 in dark, soft shadow.
import type { ReactNode } from 'react';
import { cx } from './cx';

export const Card = ({
  children,
  className,
  padded = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) => (
  <div
    className={cx(
      'rounded-2xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800',
      '[box-shadow:0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none',
      padded && 'p-5',
      className
    )}
  >
    {children}
  </div>
);
