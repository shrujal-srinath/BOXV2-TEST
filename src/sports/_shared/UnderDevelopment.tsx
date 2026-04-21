// src/sports/_shared/UnderDevelopment.tsx
// Factory for placeholder UI components used by under-development sports.
// Import and call createUnderDevelopmentComponents(icon, label) to get all four
// required SportManifest component slots as no-op stubs.

import React from 'react';
import type { SportComponentProps, SpectatorProps, WallCardProps } from '../../core/types/Manifest';

interface StubProps {
  icon: string;
  label: string;
}

const UnderDevelopmentScreen: React.FC<StubProps> = ({ icon, label }) => (
  <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 text-center px-6">
    <span className="text-6xl">{icon}</span>
    <h2 className="text-2xl font-black text-white uppercase tracking-tight">{label}</h2>
    <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 px-4 py-1.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
      <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest font-mono">Under Development</span>
    </div>
    <p className="text-zinc-500 text-sm max-w-xs">
      Scoring for {label} is coming soon. Stay tuned.
    </p>
  </div>
);

const UnderDevelopmentCard: React.FC<StubProps> = ({ icon, label }) => (
  <div className="flex flex-col items-center justify-center p-6 gap-2 text-center">
    <span className="text-3xl">{icon}</span>
    <p className="text-zinc-400 text-xs font-mono uppercase tracking-widest">{label}</p>
    <p className="text-zinc-600 text-[10px]">Under Development</p>
  </div>
);

export function createUnderDevelopmentComponents(icon: string, label: string) {
  const TabletController: React.FC<SportComponentProps<any, any>> = () => (
    <UnderDevelopmentScreen icon={icon} label={label} />
  );
  TabletController.displayName = `${label}TabletController`;

  const HostConsole: React.FC<SportComponentProps<any, any>> = () => (
    <UnderDevelopmentScreen icon={icon} label={label} />
  );
  HostConsole.displayName = `${label}HostConsole`;

  const WallCard: React.FC<WallCardProps<any>> = () => (
    <UnderDevelopmentCard icon={icon} label={label} />
  );
  WallCard.displayName = `${label}WallCard`;

  const SpectatorView: React.FC<SpectatorProps<any>> = () => (
    <UnderDevelopmentScreen icon={icon} label={label} />
  );
  SpectatorView.displayName = `${label}SpectatorView`;

  return { TabletController, HostConsole, WallCard, SpectatorView };
}
