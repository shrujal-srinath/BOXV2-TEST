// src/components/refereebox/court/CourtHud.tsx
// Bottom HUD strip: zone · distance · angle · points · xPPS · FG%
// xPPS uses xppa.ZONE_PRIOR Bayesian blend; FG% from per-zone aggregation.

import React, { useMemo } from 'react';
import { ZONES } from '../../shotchart/courtZones';
import type { ShotZoneId } from '../../shotchart/types/shotTypes';
import { ZONE_PRIOR } from '../../../lib/xppa';

const RM = "'JetBrains Mono', monospace";

interface HudProps {
    zone: ShotZoneId | null;
    distMeters: number | null;
    angleDeg: number | null;
    fgPct: number | null;       // from selected zone, all attempts
    teamColor: string;
    isLight: boolean;
    hudBg: string;
    borderColor: string;
}

const CourtHud: React.FC<HudProps> = ({
    zone, distMeters, angleDeg, fgPct, teamColor, isLight, hudBg, borderColor,
}) => {
    // Contrast 4.5:1 (WCAG AA): bumped from 0.28→0.6 on dark; 0.32→0.55 on light.
    const dim = isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)';
    const z = zone ? ZONES[zone] : null;

    const xPPS = useMemo(() => {
        if (!zone) return null;
        const prior = ZONE_PRIOR[zone] ?? 0.45;
        const pts = ZONES[zone].pointValue;
        // Use prior as a stable estimate when no in-game data; xPPA full blend in analytics view
        const rate = fgPct !== null ? fgPct : prior;
        return rate * pts;
    }, [zone, fgPct]);

    const cell = (label: string, val: string | null, last = false) => (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            borderRight: last ? 'none' : `1px solid ${borderColor}`,
            padding: '0 4px',
        }}>
            <span style={{ fontFamily: RM, fontSize: 6, color: dim, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                {label}
            </span>
            <span style={{
                fontFamily: RM, fontSize: 10, fontWeight: 700,
                color: val ? (zone ? teamColor : dim) : dim, marginTop: 1,
            }}>{val ?? '—'}</span>
        </div>
    );

    return (
        <div style={{
            height: 32, flexShrink: 0,
            display: 'flex', alignItems: 'center',
            background: hudBg,
            borderTop: `1px solid ${borderColor}`,
        }}>
            {cell('ZONE',  z?.shortLabel ?? null)}
            {cell('DIST',  distMeters !== null ? `${distMeters.toFixed(1)}m` : null)}
            {cell('ANGLE', angleDeg !== null   ? `${angleDeg.toFixed(0)}°`   : null)}
            {cell('PTS',   z ? `${z.pointValue}` : null)}
            {cell('xPPS',  xPPS !== null ? xPPS.toFixed(2) : null)}
            {cell('FG%',   fgPct !== null ? `${(fgPct * 100).toFixed(0)}%` : null, true)}
        </div>
    );
};

export default React.memo(CourtHud);
