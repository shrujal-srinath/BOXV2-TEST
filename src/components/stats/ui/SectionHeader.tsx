// src/components/stats/ui/SectionHeader.tsx
// Design-system section header — red-600 left bar anchor (see CLAUDE.md).
import type { ReactNode } from 'react';
import { cx } from './cx';

export const SectionHeader = ({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={cx('flex items-center justify-between mb-4', className)}>
    <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200 border-l-4 border-red-600 pl-3">
      {title}
    </h2>
    {action}
  </div>
);
