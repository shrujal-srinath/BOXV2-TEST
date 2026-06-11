// src/components/refereebox/court/CourtHudStrip.tsx
// ═══════════════════════════════════════════════════════════════
// Pinned top-right live stats strip. Replaces the finger-following
// CourtTooltip — no jitter, no occlusion of the court.
//
// Three fields only (cut from six in CourtHud):
//   • ZONE   — short label (RIM, LC3, MT, etc.)
//   • DIST   — italic Oswald in meters (1 decimal)
//   • xPPS   — italic Oswald, color-shifted vs ZONE_PRIOR * pts baseline
//
// Persistent. Shows "—" placeholders when nothing is hovered, so the
// strip never appears/disappears (predictable, low-noise UI).
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { ZONES } from '../../shotchart/courtZones';
import type { ShotZoneId } from '../../shotchart/types/shotTypes';
import { ZONE_PRIOR } from '../../../lib/xppa';

const RM  = "'JetBrains Mono', monospace";
const OSW = "'Oswald', sans-serif";

interface CourtHudStripProps {
    zone: ShotZoneId | null;
    distMeters: number | null;
    /** Live FG% for the hovered zone (0..1) or null if no attempts. */
    fgPct: number | null;
    teamColor: string;
}

const COL_GOOD = '#22C55E';
const COL_NEUT = '#F59E0B';
const COL_BAD  = '#EF4444';

const CourtHudStrip: React.FC<CourtHudStripProps> = ({
    zone, distMeters, fgPct, teamColor,
}) => {
    const z = zone ? ZONES[zone] : null;
    const prior = zone ? (ZONE_PRIOR[zone] ?? 0.45) : 0.45;
    const pts = z?.pointValue ?? 2;
    const baselineXpps = prior * pts;

    const xPPS = useMemo(() => {
        if (!zone) return null;
        const rate = fgPct !== null ? fgPct : prior;
        return rate * pts;
    }, [zone, fgPct, prior, pts]);

    const xPPSColor = xPPS === null
        ? 'rgba(255,255,255,0.35)'
        : (xPPS > baselineXpps + 0.05) ? COL_GOOD
        : (xPPS < baselineXpps - 0.05) ? COL_BAD
        : COL_NEUT;

    return (
        <div
            aria-hidden="true"
            style={{
                position: 'absolute',
                top: 12, right: 12,
                zIndex: 55,
                display: 'flex', alignItems: 'stretch',
                background: 'rgba(8,10,14,0.86)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                border: `1px solid ${teamColor}55`,
                pointerEvents: 'none',
                userSelect: 'none',
                fontFamily: RM,
                minWidth: 240,
            }}
        >
            {/* ZONE */}
            <div style={cellStyle(true)}>
                <span style={labelStyle}>ZONE</span>
                <span style={{
                    ...valueStyle(zone ? teamColor : 'rgba(255,255,255,0.35)'),
                    fontFamily: RM, fontSize: 12, fontStyle: 'normal',
                    letterSpacing: '0.18em',
                }}>
                    {z?.shortLabel ?? '—'}
                </span>
            </div>

            {/* DIST */}
            <div style={cellStyle(true)}>
                <span style={labelStyle}>DIST</span>
                <span style={valueStyle(
                    distMeters !== null ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)'
                )}>
                    {distMeters !== null ? `${distMeters.toFixed(1)}m` : '—'}
                </span>
            </div>

            {/* xPPS */}
            <div style={cellStyle(false)}>
                <span style={labelStyle}>xPPS</span>
                <span style={valueStyle(xPPSColor)}>
                    {xPPS !== null ? xPPS.toFixed(2) : '—'}
                </span>
            </div>
        </div>
    );
};

function cellStyle(border: boolean): React.CSSProperties {
    return {
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '6px 14px',
        borderRight: border ? '1px solid rgba(255,255,255,0.10)' : 'none',
        minWidth: 70,
    };
}

const labelStyle: React.CSSProperties = {
    fontFamily: RM,
    fontSize: 7,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    lineHeight: 1,
    marginBottom: 4,
};

function valueStyle(color: string): React.CSSProperties {
    return {
        fontFamily: OSW,
        fontStyle: 'italic',
        fontWeight: 700,
        fontSize: 18,
        color,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
    };
}

export default React.memo(CourtHudStrip);
