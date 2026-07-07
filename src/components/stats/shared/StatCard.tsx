// src/components/stats/shared/StatCard.tsx
// Reusable stat display card with value, label, and optional sparkline

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  variant?: 'default' | 'highlight' | 'muted';
  className?: string;
}

export const StatCard = ({
  label,
  value,
  subtext,
  variant = 'default',
  className = '',
}: StatCardProps) => {
  const baseClasses =
    'rounded-lg p-4 border transition-all duration-150';

  const variantClasses = {
    default:
      'bg-zinc-900 border-zinc-700 text-zinc-50',
    highlight:
      'bg-red-600/10 border-red-600/30 text-red-600',
    muted:
      'bg-zinc-800 border-zinc-700 text-zinc-400',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black text-zinc-50">
        {value}
      </div>
      {subtext && (
        <div className="mt-1 text-xs text-zinc-400">
          {subtext}
        </div>
      )}
    </div>
  );
};
