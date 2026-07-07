// src/components/stats/shared/StatPill.tsx
// Inline stat badge for quick display (e.g., "28 PTS")

interface StatPillProps {
  label: string;
  value: string | number;
  color?: 'default' | 'red' | 'green' | 'blue' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatPill = ({
  label,
  value,
  color = 'default',
  size = 'md',
  className = '',
}: StatPillProps) => {
  const colorClasses = {
    default: 'bg-zinc-800 text-zinc-50',
    red: 'bg-red-600/10 text-red-400 border border-red-600/30',
    green: 'bg-green-600/10 text-green-400 border border-green-600/30',
    blue: 'bg-blue-600/10 text-blue-400 border border-blue-600/30',
    gray: 'bg-zinc-700 text-zinc-400',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div className={`
      inline-flex items-baseline gap-1.5 rounded-full
      ${colorClasses[color]}
      ${sizeClasses[size]}
      font-semibold tracking-tight
      ${className}
    `}>
      <span className="tabular-nums font-black">{value}</span>
      <span className="text-[0.65em] opacity-75 uppercase tracking-wide">{label}</span>
    </div>
  );
};
