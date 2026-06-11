// src/components/refereebox/court/ShotMarkersLayer.tsx
// ═══════════════════════════════════════════════════════════════
// Per-shot event marker overlay (NBA.com / Goldsberry split).
//
// Hexes encode aggregate efficiency × volume; this layer encodes
// individual events:
//   • Made → filled disc (MADE_COLOR) with a 0.4u white halo for contrast
//   • Miss → open ring with a rotated cross-bar (reads as ✕)
//   • Latest shot → scale-pop on mount + single ripple ring
//
// Coords come from the persisted (portrait) x/y on each ShotEvent.
// Mapping is TEAM-AWARE: portrait depth is measured from the team's
// own basket, so team A markers render around the left basket and
// team B markers around the right one — matching the A→left / B→right
// convention used by the team strip and line-to-rim ruler.
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import type { ShotEvent } from '../../shotchart/types/shotTypes';
import { MADE_COLOR, MISS_COLOR } from '../../../lib/colorPalettes';
import { LS_W, LS_H, portraitToLandscape } from './CourtGeometry';

interface ShotMarkersLayerProps {
    shots: ShotEvent[];
    /** Most recent shot id — gets the scale-pop + ripple. */
    latestId?: string | null;
    reducedMotion?: boolean;
    /** Optional team color used for the ripple tint (defaults to teamColor or accent). */
    rippleColor?: string;
}

const MADE_R = 1.2;
const MISS_R = 1.3;

const ShotMarkersLayer: React.FC<ShotMarkersLayerProps> = ({
    shots, latestId = null, reducedMotion = false, rippleColor,
}) => {
    // Stable render order: oldest first so latest sits on top.
    // Strict filter: free throws (no court location), null/NaN coords, and
    // 'unlocated' rows would otherwise stack as stray dots at the SVG origin.
    const ordered = useMemo(() => {
        return [...shots]
            .filter(s =>
                s.shotType === 'field_goal' &&
                s.zone !== 'unlocated' &&
                typeof s.x === 'number' && Number.isFinite(s.x) &&
                typeof s.y === 'number' && Number.isFinite(s.y)
            )
            .sort((a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
    }, [shots]);

    return (
        <svg
            viewBox={`0 0 ${LS_W} ${LS_H}`}
            preserveAspectRatio="xMidYMid meet"
            pointerEvents="none"
            aria-hidden="true"
            style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', display: 'block',
            }}
        >
            <style>{`
                @keyframes smkPop {
                    0%   { transform: scale(0.7); opacity: 0; }
                    50%  { transform: scale(1.15); opacity: 1; }
                    100% { transform: scale(1);   opacity: 1; }
                }
                @keyframes smkRipple {
                    0%   { r: 1.5; opacity: 0.6; }
                    100% { r: 4.0; opacity: 0;   }
                }
                .smk-pop     { animation: smkPop 240ms ease-out both; transform-box: fill-box; transform-origin: center; }
                .smk-pop--rm { animation: none; opacity: 1; }
                .smk-ripple  { animation: smkRipple 600ms ease-out both; transform-box: fill-box; transform-origin: center; }
            `}</style>

            {ordered.map((s) => {
                // Portrait (x, y) → landscape, mirrored to the team's basket.
                const { lx, ly } = portraitToLandscape(s.x, s.y, s.teamSide);
                const isLatest = s.id === latestId;
                const popClass = !isLatest ? undefined
                    : reducedMotion ? 'smk-pop--rm' : 'smk-pop';

                if (s.made) {
                    return (
                        <g key={s.id} className={popClass}>
                            {/* White halo for contrast on dark hex tints */}
                            <circle cx={lx} cy={ly} r={MADE_R + 0.35}
                                fill="rgba(255,255,255,0.55)" />
                            <circle cx={lx} cy={ly} r={MADE_R}
                                fill={MADE_COLOR}
                                stroke="rgba(0,0,0,0.4)" strokeWidth={0.15} />
                            {isLatest && !reducedMotion && (
                                <circle cx={lx} cy={ly}
                                    fill="none"
                                    stroke={rippleColor ?? MADE_COLOR}
                                    strokeWidth={0.45}
                                    className="smk-ripple" />
                            )}
                        </g>
                    );
                }

                // Miss → open ring + 45° cross-bar (reads as ✕)
                const x1 = lx - MISS_R * 0.62;
                const y1 = ly - MISS_R * 0.62;
                const x2 = lx + MISS_R * 0.62;
                const y2 = ly + MISS_R * 0.62;
                const x3 = lx - MISS_R * 0.62;
                const y3 = ly + MISS_R * 0.62;
                const x4 = lx + MISS_R * 0.62;
                const y4 = ly - MISS_R * 0.62;
                return (
                    <g key={s.id} className={popClass}>
                        <circle cx={lx} cy={ly} r={MISS_R}
                            fill="rgba(0,0,0,0.25)"
                            stroke={MISS_COLOR}
                            strokeWidth={0.55} />
                        <line x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke={MISS_COLOR}
                            strokeWidth={0.45}
                            strokeLinecap="round" />
                        <line x1={x3} y1={y3} x2={x4} y2={y4}
                            stroke={MISS_COLOR}
                            strokeWidth={0.45}
                            strokeLinecap="round" />
                        {isLatest && !reducedMotion && (
                            <circle cx={lx} cy={ly}
                                fill="none"
                                stroke={rippleColor ?? MISS_COLOR}
                                strokeWidth={0.45}
                                className="smk-ripple" />
                        )}
                    </g>
                );
            })}
        </svg>
    );
};

export default React.memo(ShotMarkersLayer);
