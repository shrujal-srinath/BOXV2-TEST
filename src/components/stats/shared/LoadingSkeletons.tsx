// src/components/stats/shared/LoadingSkeletons.tsx
// Skeleton loaders for stats pages during data fetches

export const StatCardSkeleton = () => (
  <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700 animate-pulse">
    <div className="h-3 bg-zinc-700 rounded w-20 mb-2"></div>
    <div className="h-8 bg-zinc-700 rounded w-32"></div>
  </div>
);

export const StatPillSkeleton = () => (
  <div className="inline-flex items-baseline gap-1.5 rounded-full bg-zinc-800 px-3 py-1.5 animate-pulse">
    <div className="h-6 w-12 bg-zinc-700 rounded"></div>
    <div className="h-3 w-8 bg-zinc-700 rounded"></div>
  </div>
);

export const GameHeaderSkeleton = () => (
  <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl border border-zinc-700 p-8 mb-8 animate-pulse">
    <div className="flex items-center justify-center gap-8">
      <div className="flex-1 text-center">
        <div className="h-6 bg-zinc-700 rounded w-32 mx-auto mb-3"></div>
        <div className="h-12 bg-zinc-700 rounded w-24 mx-auto"></div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="h-4 bg-zinc-700 rounded w-12"></div>
      </div>
      <div className="flex-1 text-center">
        <div className="h-6 bg-zinc-700 rounded w-32 mx-auto mb-3"></div>
        <div className="h-12 bg-zinc-700 rounded w-24 mx-auto"></div>
      </div>
    </div>
  </div>
);

export const PlayerTableSkeleton = () => (
  <div className="bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden animate-pulse">
    <div className="px-6 py-4 border-b border-zinc-700 h-6 bg-zinc-800 w-32"></div>

    <div className="space-y-2 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 bg-zinc-800 rounded"></div>
      ))}
    </div>
  </div>
);

export const ChartSkeleton = () => (
  <div className="bg-zinc-900 rounded-2xl border border-zinc-700 p-6 animate-pulse">
    <div className="h-4 bg-zinc-700 rounded w-24 mb-4"></div>
    <div className="h-64 bg-zinc-800 rounded"></div>
  </div>
);

export const PlayerHeroSkeleton = () => (
  <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl border border-zinc-700 p-8 mb-8 animate-pulse">
    <div className="flex items-center gap-6 mb-8">
      <div className="w-24 h-24 rounded-xl bg-zinc-700"></div>
      <div className="flex-1">
        <div className="h-8 bg-zinc-700 rounded w-48 mb-2"></div>
        <div className="h-4 bg-zinc-700 rounded w-32"></div>
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 bg-zinc-800 rounded"></div>
      ))}
    </div>
  </div>
);
