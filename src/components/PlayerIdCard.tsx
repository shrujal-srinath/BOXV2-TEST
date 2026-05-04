// src/components/PlayerIdCard.tsx
// Wide horizontal ID badge — like a real sports accreditation pass / laminated card
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

function cmToFeet(cm: number): string {
  const ft = Math.floor(cm / 30.48);
  const inches = Math.round((cm / 2.54) % 12);
  return `${ft}'${inches}"`;
}

// Fake barcode lines for visual flair
const Barcode: React.FC = () => {
  const bars = [3,1,2,3,1,4,2,1,3,2,1,3,2,4,1,2,3,1,2,1,3,4,1,2];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '28px' }}>
      {bars.map((w, i) => (
        <div
          key={i}
          style={{
            width: `${w}px`,
            height: i % 3 === 0 ? '28px' : i % 2 === 0 ? '20px' : '24px',
            background: 'rgba(139,92,246,0.5)',
            borderRadius: '1px',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
};

export const PlayerIdCard: React.FC<PlayerIdCardProps> = ({ profile, className = '' }) => {
  const primarySportId = profile.sport_ids[0];
  const primarySport   = SPORT_REGISTRY[primarySportId];
  const otherSports    = profile.sport_ids.slice(1, 4);
  const issueYear      = new Date(profile.created_at).getFullYear();

  return (
    <div className={`relative w-full select-none ${className}`}>
      {/* Outer glow border */}
      <div
        className="absolute -inset-[1px] rounded-xl pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.7) 0%, rgba(79,70,229,0.3) 50%, rgba(168,85,247,0.5) 100%)', filter: 'blur(1px)' }}
      />

      {/* Card */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0c0c14 0%, #10082a 50%, #0a0a18 100%)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,58,237,0.2)',
        }}
      >
        {/* Scanlines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)' }}
        />

        {/* Top accent stripe */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 40%, #a855f7 70%, transparent 100%)' }}
        />

        <div className="flex" style={{ minHeight: '130px' }}>

          {/* ── LEFT: Photo zone ─────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex flex-col items-center justify-center gap-2 px-4 py-4"
            style={{
              width: '110px',
              background: 'linear-gradient(180deg, rgba(124,58,237,0.18) 0%, rgba(79,70,229,0.08) 100%)',
              borderRight: '1px solid rgba(124,58,237,0.2)',
            }}
          >
            {/* Photo */}
            <div
              style={{
                width: '62px',
                height: '62px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1.5px solid rgba(124,58,237,0.4)',
                background: 'rgba(124,58,237,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(124,58,237,0.2)',
                flexShrink: 0,
              }}
            >
              {profile.profile_photo_url ? (
                <img src={profile.profile_photo_url} alt={profile.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '20px', fontWeight: 900, color: 'rgba(167,139,250,0.6)', fontStyle: 'italic' }}>
                  {getInitials(profile.full_name)}
                </span>
              )}
            </div>

            {/* Jersey */}
            {profile.jersey_number && (
              <div style={{
                background: 'rgba(124,58,237,0.2)',
                border: '1px solid rgba(124,58,237,0.35)',
                borderRadius: '6px',
                padding: '2px 10px',
                textAlign: 'center',
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: '7px', color: 'rgba(167,139,250,0.45)', letterSpacing: '0.2em', display: 'block', textTransform: 'uppercase' }}>No.</span>
                <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 900, color: '#a78bfa', lineHeight: 1 }}>
                  {profile.jersey_number}
                </span>
              </div>
            )}

            {/* Primary sport icon */}
            {primarySport && (
              <span style={{ fontSize: '20px', lineHeight: 1, filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.5))' }}>
                {primarySport.icon as string}
              </span>
            )}
          </div>

          {/* ── CENTER: Main info ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col justify-between px-4 py-3">
            {/* Top: name + sport */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                <p style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  textTransform: 'uppercase',
                  fontStyle: 'italic',
                }} className="truncate">
                  {profile.full_name}
                </p>
                {profile.display_name && (
                  <p style={{ fontSize: '10px', color: 'rgba(167,139,250,0.5)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                    "{profile.display_name}"
                  </p>
                )}
              </div>

              {/* Sport + position */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                {primarySport && (
                  <span style={{
                    fontFamily: 'monospace', fontSize: '9px', fontWeight: 700,
                    color: '#a78bfa', letterSpacing: '0.1em', textTransform: 'uppercase',
                    background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)',
                    borderRadius: '4px', padding: '1px 6px',
                  }}>
                    {primarySport.label}
                  </span>
                )}
                {profile.primary_position && (
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em' }}>
                    · {profile.primary_position}
                  </span>
                )}
                {otherSports.map(id => (
                  <span key={id} style={{ fontSize: '13px', lineHeight: 1 }} title={SPORT_REGISTRY[id]?.label}>
                    {SPORT_REGISTRY[id]?.icon as string}
                  </span>
                ))}
                {profile.sport_ids.length > 4 && (
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>
                    +{profile.sport_ids.length - 4}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom: college + physical */}
            <div style={{ marginTop: '8px' }}>
              {profile.college_name && (
                <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em', marginBottom: '4px' }} className="truncate">
                  🎓 {profile.college_name}
                </p>
              )}

              {/* Stats row */}
              {(profile.height_cm || profile.weight_kg || profile.dominant_hand) && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {profile.height_cm && (
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>
                      {cmToFeet(profile.height_cm)}
                    </span>
                  )}
                  {profile.weight_kg && (
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>
                      {profile.weight_kg} kg
                    </span>
                  )}
                  {profile.dominant_hand && (
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(255,255,255,0.25)', textTransform: 'capitalize' }}>
                      {profile.dominant_hand === 'ambidextrous' ? 'Both Hands' : `${profile.dominant_hand} Hand`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Code + branding ────────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex flex-col items-center justify-between py-3 px-3"
            style={{
              width: '110px',
              borderLeft: '1px solid rgba(124,58,237,0.12)',
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            {/* THE BOX wordmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div
                style={{
                  width: '14px', height: '14px', background: '#7c3aed', flexShrink: 0,
                  clipPath: 'polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '7px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>B</span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: '7px', fontWeight: 800, color: 'rgba(167,139,250,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                THE BOX
              </span>
            </div>

            {/* Barcode */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <Barcode />
              <span style={{ fontFamily: 'monospace', fontSize: '8px', fontWeight: 800, color: '#8b5cf6', letterSpacing: '0.08em' }}>
                {profile.player_code}
              </span>
            </div>

            {/* Bottom: status + year */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center', marginBottom: '2px' }}>
                <div style={{
                  width: '4px', height: '4px', borderRadius: '50%',
                  background: profile.is_claimed ? '#22c55e' : '#f59e0b',
                  boxShadow: `0 0 5px ${profile.is_claimed ? 'rgba(34,197,94,0.8)' : 'rgba(245,158,11,0.8)'}`,
                }} />
                <span style={{ fontFamily: 'monospace', fontSize: '7px', color: profile.is_claimed ? 'rgba(34,197,94,0.5)' : 'rgba(245,158,11,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {profile.is_claimed ? 'Active' : 'Unclaimed'}
                </span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: '7px', color: 'rgba(255,255,255,0.12)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {issueYear}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom accent stripe */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.4) 30%, rgba(79,70,229,0.3) 70%, transparent 100%)' }}
        />

        {/* Corner glow */}
        <div className="absolute top-0 right-0 w-32 h-16 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, rgba(109,40,217,0.12) 0%, transparent 70%)' }} />
      </div>
    </div>
  );
};
