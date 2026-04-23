// src/components/PlayerIdCard.tsx
import React from 'react';
import type { PlayerProfile } from '../types';
import { SPORT_REGISTRY } from '../sports/registry';

interface PlayerIdCardProps {
  profile: PlayerProfile;
  className?: string;
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('');
}

function formatPhysical(p: PlayerProfile): string {
  const parts: string[] = [];
  if (p.height_cm) {
    const ft = Math.floor(p.height_cm / 30.48);
    const inches = Math.round((p.height_cm / 2.54) % 12);
    parts.push(`${ft}'${inches}"`);
  }
  if (p.weight_kg) parts.push(`${p.weight_kg} kg`);
  if (p.dominant_hand) parts.push(p.dominant_hand === 'ambidextrous' ? 'Both' : p.dominant_hand.charAt(0).toUpperCase() + p.dominant_hand.slice(1));
  return parts.join('  ·  ');
}

export const PlayerIdCard: React.FC<PlayerIdCardProps> = ({ profile, className = '' }) => {
  const sportEntries = profile.sport_ids.slice(0, 5).map(id => ({
    icon: SPORT_REGISTRY[id]?.icon as string ?? '🏅',
    label: SPORT_REGISTRY[id]?.label ?? id,
  }));

  const issueYear = new Date(profile.created_at).getFullYear();
  const physical  = formatPhysical(profile);

  return (
    <div
      className={`relative w-full max-w-sm overflow-hidden select-none shadow-2xl ${className}`}
      style={{
        aspectRatio: '1.586 / 1',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #18181b 0%, #1e1b4b 55%, #2e1065 100%)',
      }}
    >
      {/* Dot-grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      />

      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ background: 'linear-gradient(to bottom, #7c3aed, #4f46e5)' }}
      />

      {/* Top: wordmark + verified */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="w-4 h-4 rounded flex items-center justify-center"
            style={{ background: '#7c3aed' }}
          >
            <span style={{ fontSize: '8px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>B</span>
          </div>
          <span style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            THE BOX
          </span>
        </div>
        {profile.is_verified && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: '100px', padding: '2px 7px' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{ fontSize: '7px', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Verified</span>
          </div>
        )}
      </div>

      {/* Main body */}
      <div className="absolute inset-0 flex items-center pl-5 pr-4 pt-11 pb-9 gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div
            className="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.12)' }}
          >
            {profile.profile_photo_url ? (
              <img src={profile.profile_photo_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <span style={{ fontSize: '22px', fontWeight: 900, color: 'rgba(255,255,255,0.35)' }}>
                {getInitials(profile.full_name)}
              </span>
            )}
          </div>
          {profile.jersey_number && (
            <div className="mt-1.5 text-center">
              <span style={{ fontSize: '9px', fontWeight: 900, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
                #{profile.jersey_number}
              </span>
            </div>
          )}
        </div>

        {/* Info block */}
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff', lineHeight: 1.15, letterSpacing: '-0.01em' }} className="truncate">
            {profile.full_name}
          </p>
          {profile.display_name && (
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', fontStyle: 'italic' }} className="truncate">
              "{profile.display_name}"
            </p>
          )}

          {/* Sport icons */}
          <div className="flex items-center gap-1.5 mt-2">
            {sportEntries.map((s, i) => (
              <span key={i} style={{ fontSize: '14px', lineHeight: 1 }} title={s.label}>{s.icon}</span>
            ))}
            {profile.sport_ids.length > 5 && (
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>+{profile.sport_ids.length - 5}</span>
            )}
          </div>

          {profile.primary_position && (
            <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', marginTop: '4px', letterSpacing: '0.03em' }} className="truncate">
              {profile.primary_position}
            </p>
          )}

          {profile.college_name && (
            <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }} className="truncate">
              {profile.college_name}
            </p>
          )}

          {physical && (
            <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.25)', marginTop: '4px', letterSpacing: '0.04em' }}>
              {physical}
            </p>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 700, color: '#8b5cf6', letterSpacing: '0.12em' }}>
          {profile.player_code}
        </span>
        <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.18)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          ISSUED {issueYear}
        </span>
      </div>

      {/* Corner glow */}
      <div
        className="absolute bottom-0 right-0 w-24 h-24 pointer-events-none"
        style={{ background: 'radial-gradient(circle at bottom right, rgba(109,40,217,0.18), transparent 70%)' }}
      />
    </div>
  );
};
