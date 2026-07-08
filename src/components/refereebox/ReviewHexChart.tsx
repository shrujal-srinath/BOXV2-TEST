// src/components/refereebox/ReviewHexChart.tsx
// ═══════════════════════════════════════════════════════════════
// Landscape full-court hexbin chart for the Pi MATCH REPORT
// (PLAN-U P4). One aggregation everywhere: bins are built in the
// persisted PORTRAIT space by hexbinEngine and only TRANSFORMED
// here via binsToLandscape — team A's shots land on the LEFT
// basket, team B's on the RIGHT (the referee-court convention).
//
// Touch-first: tap a hex to select (ring + others recede) and the
// parent shows the readout; no hover states. Entrance: hexes sweep
// outward from each rim, stagger scaled by distance. Colours:
// FG% heat when misses were tracked, else team-colour volume.
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import type { ShotEvent } from '../shotchart/types/shotTypes';
import {
    buildHexbins, binsToLandscape, hexPath, landscapeBinId, type LandscapeHexBin,
} from '../../services/hexbinEngine';
import {
    LS_W, LS_H, HALF, BX_L, BX_R, BY, PD, PT, PB, FTR, R3, TX, TYT, TYB, RA, BK_X, CC_R,
} from './court/CourtGeometry';
import { useReducedMotion } from '../../lib/colorPalettes';

export type HexFilter = 'both' | 'A' | 'B';

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const mix = (c1: number[], c2: number[], t: number) =>
    `rgb(${lerp(c1[0], c2[0], t)},${lerp(c1[1], c2[1], t)},${lerp(c1[2], c2[2], t)})`;

/** Same FG% stops as the web hexmap + ZoneHeatmap — "hot" reads identically. */
const heatColor = (pct: number): string => {
    const S = [
        { p: 25, c: [239, 68, 68] },
        { p: 45, c: [245, 158, 11] },
        { p: 62, c: [34, 197, 94] },
    ];
    if (pct <= S[0].p) return mix(S[0].c, S[0].c, 0);
    if (pct >= S[2].p) return mix(S[2].c, S[2].c, 0);
    const [lo, hi] = pct < S[1].p ? [S[0], S[1]] : [S[1], S[2]];
    return mix(lo.c, hi.c, (pct - lo.p) / (hi.p - lo.p));
};

interface Props {
    shots: ShotEvent[];
    hasMisses: boolean;
    teamAColor: string;
    teamBColor: string;
    filter: HexFilter;
    selectedId: string | null;
    onSelect: (bin: LandscapeHexBin | null) => void;
}

/** Court furniture for one half (mirrored for the right basket). */
function HalfLines({ right, stroke }: { right?: boolean; stroke: string }) {
    const m = (x: number) => (right ? LS_W - x : x);
    const sweep = right ? 0 : 1;
    return (
        <g fill="none" stroke={stroke} strokeWidth={0.45} strokeLinejoin="round">
            {/* paint */}
            <rect
                x={right ? m(PD) : 0} y={PT}
                width={PD} height={PB - PT}
            />
            {/* FT circle */}
            <circle cx={m(PD)} cy={BY} r={FTR} />
            {/* restricted arc (opens toward midcourt) */}
            <path d={`M ${m(BX_L)} ${BY - RA} A ${RA} ${RA} 0 0 ${sweep} ${m(BX_L)} ${BY + RA}`} />
            {/* backboard + rim */}
            <line x1={m(BK_X)} y1={BY - 6} x2={m(BK_X)} y2={BY + 6} strokeWidth={0.65} />
            <circle cx={m(BX_L)} cy={BY} r={1.4} />
            {/* 3pt: corner straights + arc */}
            <path d={`M ${m(0)} ${TYT} L ${m(TX)} ${TYT} A ${R3} ${R3} 0 0 ${sweep} ${m(TX)} ${TYB} L ${m(0)} ${TYB}`} />
        </g>
    );
}

export default function ReviewHexChart({
    shots, hasMisses, teamAColor, teamBColor, filter, selectedId, onSelect,
}: Props) {
    const reducedMotion = useReducedMotion();

    const bins = useMemo(() => {
        const out: LandscapeHexBin[] = [];
        if (filter !== 'B') out.push(...binsToLandscape(buildHexbins(shots, { side: 'A' }), 'A'));
        if (filter !== 'A') out.push(...binsToLandscape(buildHexbins(shots, { side: 'B' }), 'B'));
        return out;
    }, [shots, filter]);

    const anySelected = selectedId !== null;

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <style>{`
                @keyframes rhcSweep {
                    0%   { transform: scale(0.1); opacity: 0; }
                    70%  { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1);   opacity: 1; }
                }
                .rhc-hex {
                    transform-box: fill-box; transform-origin: center;
                    animation: rhcSweep 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
                    transition: opacity 0.18s ease, transform 0.16s ease;
                    cursor: pointer;
                }
                .rhc-hex.sel   { transform: scale(1.18); }
                .rhc-hex.dim   { opacity: 0.3 !important; }
                @media (prefers-reduced-motion: reduce) {
                    .rhc-hex { animation: none; transition: none; }
                }
            `}</style>
            <svg
                viewBox={`0 0 ${LS_W} ${LS_H}`}
                style={{ width: '100%', height: 'auto', display: 'block' }}
                onPointerDown={e => { if (e.target === e.currentTarget) onSelect(null); }}
            >
                {/* floor + boundary */}
                <rect x={0} y={0} width={LS_W} height={LS_H} fill="#0B0D12"
                    onPointerDown={() => onSelect(null)} />
                <g fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={0.45}>
                    <rect x={0.3} y={0.3} width={LS_W - 0.6} height={LS_H - 0.6} />
                    <line x1={HALF} y1={0} x2={HALF} y2={LS_H} />
                    <circle cx={HALF} cy={BY} r={CC_R} />
                </g>
                <HalfLines stroke="rgba(255,255,255,0.16)" />
                <HalfLines right stroke="rgba(255,255,255,0.16)" />

                {/* hexbins — key on filter so the sweep replays on lens change */}
                <g key={filter}>
                    {bins.map(b => {
                        const id = landscapeBinId(b);
                        const sel = selectedId === id;
                        const teamColor = b.side === 'A' ? teamAColor : teamBColor;
                        const drawR = 3 * (0.42 + 0.58 * Math.sqrt(b.sizeT));
                        const fill = hasMisses ? heatColor(b.fgPct) : teamColor;
                        const opacity = hasMisses ? 0.9 : 0.3 + 0.6 * b.sizeT;
                        const rimX = b.side === 'A' ? BX_L : BX_R;
                        const dist = Math.hypot(b.lx - rimX, b.ly - BY);
                        return (
                            <path
                                key={id}
                                d={hexPath(b.lx, b.ly, drawR)}
                                fill={fill}
                                fillOpacity={opacity}
                                stroke={sel ? '#FFFFFF' : 'transparent'}
                                strokeWidth={sel ? 0.6 : 0}
                                className={`rhc-hex${sel ? ' sel' : ''}${anySelected && !sel ? ' dim' : ''}`}
                                style={reducedMotion ? undefined : { animationDelay: `${Math.round(dist * 9)}ms` }}
                                role="button"
                                aria-label={`${b.made} of ${b.attempts} from this spot`}
                                onPointerDown={e => { e.stopPropagation(); onSelect(sel ? null : b); }}
                            />
                        );
                    })}
                </g>

                {/* team end labels */}
                <text x={6} y={LS_H - 4} fontSize={4.2} fontWeight={700} fill={teamAColor}
                    opacity={filter === 'B' ? 0.25 : 0.8} style={{ letterSpacing: 1 }}>A ◀ ATTACKS</text>
                <text x={LS_W - 6} y={LS_H - 4} fontSize={4.2} fontWeight={700} fill={teamBColor}
                    textAnchor="end" opacity={filter === 'A' ? 0.25 : 0.8} style={{ letterSpacing: 1 }}>ATTACKS ▶ B</text>
            </svg>
        </div>
    );
}
