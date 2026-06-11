// src/components/refereebox/court/CourtLines.tsx
// ═══════════════════════════════════════════════════════════════
// Production court markings for THE BOX landscape court.
// All arcs sweep correctly: left half opens RIGHT, right half opens LEFT.
// FIBA 2024 dimensions via CourtGeometry constants.
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import {
    LS_W, LS_H, HALF,
    BX_L, BX_R, BY,
    PD, PT, PB, FTR, R3, TX, TYT, TYB, RA,
    BK_X, BK_H, CC_R,
    LANE_MARKS, LANE_MARK_LEN,
    LANE_BLOCKS, LANE_BLOCK_LEN,
    LINE_HEAVY, LINE_THIN, LINE_FAINT,
} from './CourtGeometry';

export interface CourtPalette {
    floor: string;
    line: string;
    lineSoft: string;
    lineDash: string;
    tint2pt: string;
    tint3pt: string;
    paintFill: string;
    rim: string;
    backboard: string;
}

export const COURT_THEMES = {
    dark: {
        floor: '#0A1322',
        line: 'rgba(240,244,255,0.82)',
        lineSoft: 'rgba(240,244,255,0.40)',
        lineDash: 'rgba(240,244,255,0.28)',
        tint2pt: 'rgba(245,158,11,0.045)',
        tint3pt: 'rgba(59,130,246,0.06)',
        paintFill: 'rgba(200,16,46,0.10)',
        rim: '#FF8C00',
        backboard: 'rgba(240,244,255,0.95)',
    },
    wooden: {
        floor: '#C68647',
        line: 'rgba(20,12,4,0.92)',
        lineSoft: 'rgba(20,12,4,0.55)',
        lineDash: 'rgba(20,12,4,0.40)',
        tint2pt: 'rgba(80,40,10,0.06)',
        tint3pt: 'rgba(40,80,160,0.10)',
        paintFill: 'rgba(180,30,40,0.22)',
        rim: '#C8102E',
        backboard: 'rgba(20,12,4,0.95)',
    },
    white: {
        floor: '#F5F5F2',
        line: 'rgba(20,20,30,0.88)',
        lineSoft: 'rgba(20,20,30,0.55)',
        lineDash: 'rgba(20,20,30,0.32)',
        tint2pt: 'rgba(120,80,20,0.04)',
        tint3pt: 'rgba(59,130,246,0.10)',
        paintFill: 'rgba(232,17,45,0.14)',
        rim: '#E8112D',
        backboard: '#1A1A2E',
    },
    hicontrast: {
        floor: '#000000',
        line: '#FFFFFF',
        lineSoft: 'rgba(255,255,255,0.7)',
        lineDash: 'rgba(255,255,255,0.5)',
        tint2pt: 'rgba(255,255,255,0.04)',
        tint3pt: 'rgba(80,140,255,0.14)',
        paintFill: 'rgba(220,38,38,0.22)',
        // Cyan rim — separates cleanly from MADE green and MISS red markers
        // that cluster at the basket.
        rim: '#00E5FF',
        backboard: '#FFFFFF',
    },
} as const satisfies Record<string, CourtPalette>;

export type CourtTheme = keyof typeof COURT_THEMES;

// ── Half-court markings ──────────────────────────────────────
const LeftHalfMarkings = React.memo(({ T }: { T: CourtPalette }) => (
    <g fill="none" pointerEvents="none">
        {/* Floor */}
        <rect x={0} y={0} width={HALF} height={LS_H} fill={T.floor} />

        {/* 2pt zone tint (gentle amber wash inside arc, outside paint) */}
        <path
            d={`M 0,${TYT} L ${TX},${TYT} A ${R3} ${R3} 0 0 1 ${TX},${TYB} L 0,${TYB} Z`}
            fill={T.tint2pt}
        />

        {/* Paint fill + boundary */}
        <rect x={0} y={PT} width={PD} height={PB - PT} fill={T.paintFill} />
        <rect x={0} y={PT} width={PD} height={PB - PT}
            fill="none" stroke={T.line} strokeWidth={LINE_HEAVY} />

        {/* FIBA neutral-zone lane marks (4 ticks, FT-side longer) */}
        {LANE_MARKS.map((lm, i) => {
            const len = i === 0 ? LANE_MARK_LEN : LANE_MARK_LEN * 0.7;
            return (
                <React.Fragment key={lm}>
                    <line x1={lm} y1={PT} x2={lm} y2={PT + len} stroke={T.line} strokeWidth={LINE_THIN} />
                    <line x1={lm} y1={PB} x2={lm} y2={PB - len} stroke={T.line} strokeWidth={LINE_THIN} />
                </React.Fragment>
            );
        })}

        {/* FIBA 7-block lane pattern (6cm perpendicular ticks every 0.4m) */}
        {LANE_BLOCKS.map(lm => (
            <React.Fragment key={`b-${lm}`}>
                <line x1={lm} y1={PT - LANE_BLOCK_LEN} x2={lm} y2={PT}
                    stroke={T.line} strokeWidth={LINE_FAINT} />
                <line x1={lm} y1={PB} x2={lm} y2={PB + LANE_BLOCK_LEN}
                    stroke={T.line} strokeWidth={LINE_FAINT} />
            </React.Fragment>
        ))}

        {/* Restricted-arc endpoint ticks (FIBA spec — short perpendicular ticks
            where the restricted arc would meet the baseline edge of the rim post). */}
        <line x1={BX_L - 0.8} y1={BY - RA} x2={BX_L + 0.8} y2={BY - RA}
            stroke={T.line} strokeWidth={LINE_FAINT} />
        <line x1={BX_L - 0.8} y1={BY + RA} x2={BX_L + 0.8} y2={BY + RA}
            stroke={T.line} strokeWidth={LINE_FAINT} />

        {/* FT circle — solid half opens toward midcourt (sweep=1) */}
        <path d={`M ${PD} ${BY - FTR} A ${FTR} ${FTR} 0 0 1 ${PD} ${BY + FTR}`}
            stroke={T.line} strokeWidth={LINE_HEAVY} />
        {/* FT circle — dashed half opens toward basket (sweep=0) */}
        <path d={`M ${PD} ${BY - FTR} A ${FTR} ${FTR} 0 0 0 ${PD} ${BY + FTR}`}
            stroke={T.lineSoft} strokeWidth={LINE_FAINT} strokeDasharray="1.8 1.8" />

        {/* Restricted area (opens right toward midcourt — sweep=1) */}
        <path d={`M ${BX_L} ${BY - RA} A ${RA} ${RA} 0 0 1 ${BX_L} ${BY + RA}`}
            stroke={T.lineSoft} strokeWidth={LINE_THIN} />

        {/* 3pt corner straight lines */}
        <line x1={0} y1={TYT} x2={TX} y2={TYT} stroke={T.line} strokeWidth={LINE_HEAVY} />
        <line x1={0} y1={TYB} x2={TX} y2={TYB} stroke={T.line} strokeWidth={LINE_HEAVY} />

        {/* 3pt arc (opens right toward midcourt — sweep=1) */}
        <path d={`M ${TX} ${TYT} A ${R3} ${R3} 0 0 1 ${TX} ${TYB}`}
            stroke={T.line} strokeWidth={LINE_HEAVY} />

        {/* Backboard (rectangular, FIBA 1.8m × 0.05m) */}
        <rect
            x={BK_X - 0.25} y={BY - BK_H}
            width={0.6} height={2 * BK_H}
            fill={T.backboard} rx={0.1}
            stroke={T.backboard} strokeWidth={0.1}
        />
        {/* Backboard mounting arm (subtle) */}
        <line
            x1={0.4} y1={BY} x2={BK_X} y2={BY}
            stroke={T.lineSoft} strokeWidth={LINE_FAINT * 0.6}
        />
    </g>
));
LeftHalfMarkings.displayName = 'LeftHalfMarkings';

const RightHalfMarkings = React.memo(({ T }: { T: CourtPalette }) => {
    const mx = (x: number) => LS_W - x;
    return (
        <g fill="none" pointerEvents="none">
            {/* Floor */}
            <rect x={HALF} y={0} width={HALF} height={LS_H} fill={T.floor} />

            {/* 2pt zone tint */}
            <path
                d={`M ${LS_W},${TYT} L ${mx(TX)},${TYT} A ${R3} ${R3} 0 0 0 ${mx(TX)},${TYB} L ${LS_W},${TYB} Z`}
                fill={T.tint2pt}
            />

            {/* Paint */}
            <rect x={mx(PD)} y={PT} width={PD} height={PB - PT} fill={T.paintFill} />
            <rect x={mx(PD)} y={PT} width={PD} height={PB - PT}
                fill="none" stroke={T.line} strokeWidth={LINE_HEAVY} />

            {/* Lane marks */}
            {LANE_MARKS.map((lm, i) => {
                const len = i === 0 ? LANE_MARK_LEN : LANE_MARK_LEN * 0.7;
                return (
                    <React.Fragment key={lm}>
                        <line x1={mx(lm)} y1={PT} x2={mx(lm)} y2={PT + len} stroke={T.line} strokeWidth={LINE_THIN} />
                        <line x1={mx(lm)} y1={PB} x2={mx(lm)} y2={PB - len} stroke={T.line} strokeWidth={LINE_THIN} />
                    </React.Fragment>
                );
            })}

            {/* FIBA 7-block lane pattern (mirror of left half) */}
            {LANE_BLOCKS.map(lm => (
                <React.Fragment key={`b-${lm}`}>
                    <line x1={mx(lm)} y1={PT - LANE_BLOCK_LEN} x2={mx(lm)} y2={PT}
                        stroke={T.line} strokeWidth={LINE_FAINT} />
                    <line x1={mx(lm)} y1={PB} x2={mx(lm)} y2={PB + LANE_BLOCK_LEN}
                        stroke={T.line} strokeWidth={LINE_FAINT} />
                </React.Fragment>
            ))}

            {/* Restricted-arc endpoint ticks (mirror) */}
            <line x1={BX_R - 0.8} y1={BY - RA} x2={BX_R + 0.8} y2={BY - RA}
                stroke={T.line} strokeWidth={LINE_FAINT} />
            <line x1={BX_R - 0.8} y1={BY + RA} x2={BX_R + 0.8} y2={BY + RA}
                stroke={T.line} strokeWidth={LINE_FAINT} />

            {/* FT circle — solid opens left (toward midcourt for right side, sweep=0) */}
            <path d={`M ${mx(PD)} ${BY - FTR} A ${FTR} ${FTR} 0 0 0 ${mx(PD)} ${BY + FTR}`}
                stroke={T.line} strokeWidth={LINE_HEAVY} />
            {/* FT dashed opens right (sweep=1) */}
            <path d={`M ${mx(PD)} ${BY - FTR} A ${FTR} ${FTR} 0 0 1 ${mx(PD)} ${BY + FTR}`}
                stroke={T.lineSoft} strokeWidth={LINE_FAINT} strokeDasharray="1.8 1.8" />

            {/* Restricted area (opens left for right basket — sweep=0) */}
            <path d={`M ${BX_R} ${BY - RA} A ${RA} ${RA} 0 0 0 ${BX_R} ${BY + RA}`}
                stroke={T.lineSoft} strokeWidth={LINE_THIN} />

            {/* 3pt corner straights */}
            <line x1={LS_W} y1={TYT} x2={mx(TX)} y2={TYT} stroke={T.line} strokeWidth={LINE_HEAVY} />
            <line x1={LS_W} y1={TYB} x2={mx(TX)} y2={TYB} stroke={T.line} strokeWidth={LINE_HEAVY} />

            {/* 3pt arc — opens left toward midcourt (sweep=0) */}
            <path d={`M ${mx(TX)} ${TYT} A ${R3} ${R3} 0 0 0 ${mx(TX)} ${TYB}`}
                stroke={T.line} strokeWidth={LINE_HEAVY} />

            {/* Backboard */}
            <rect
                x={mx(BK_X) - 0.35} y={BY - BK_H}
                width={0.6} height={2 * BK_H}
                fill={T.backboard} rx={0.1}
                stroke={T.backboard} strokeWidth={0.1}
            />
            {/* Mounting arm */}
            <line
                x1={LS_W - 0.4} y1={BY} x2={mx(BK_X)} y2={BY}
                stroke={T.lineSoft} strokeWidth={LINE_FAINT * 0.6}
            />
        </g>
    );
});
RightHalfMarkings.displayName = 'RightHalfMarkings';

// ── Rim + net (FIBA spec) ─────────────────────────────────────
const Basket = React.memo(({ bx, by, rim, gradId }: {
    bx: number; by: number; rim: string; gradId: string;
}) => (
    <g pointerEvents="none">
        <defs>
            <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={rim} stopOpacity="0.45" />
                <stop offset="100%" stopColor={rim} stopOpacity="0" />
            </radialGradient>
        </defs>
        {/* Glow halo */}
        <circle cx={bx} cy={by} r={8} fill={`url(#${gradId})`} />
        {/* FIBA 45cm rim = 3 units diameter, 1.5 radius */}
        <circle cx={bx} cy={by} r={1.5} fill="none" stroke={rim} strokeWidth={LINE_HEAVY * 0.8} />
        {/* Center bullseye */}
        <circle cx={bx} cy={by} r={0.45} fill={rim} />
    </g>
));
Basket.displayName = 'Basket';

// ── Centerline + center circle ───────────────────────────────
const CenterLine = React.memo(({ T, chevrons }: { T: CourtPalette; chevrons: boolean }) => (
    <g fill="none" pointerEvents="none">
        {/* Midcourt line */}
        <line x1={HALF} y1={0} x2={HALF} y2={LS_H}
            stroke={T.line} strokeWidth={LINE_HEAVY} />
        {/* Center circle */}
        <circle cx={HALF} cy={BY} r={CC_R}
            stroke={T.lineSoft} strokeWidth={LINE_THIN} />
        {/* Jump-ball center dot */}
        <circle cx={HALF} cy={BY} r={0.6} fill={T.line} />

        {/* Halfcourt directional chevrons — opt-in via Settings → Court aids
            → Chevrons. Off by default; many users found them visually noisy. */}
        {chevrons && (
            <g opacity={0.35} stroke={T.line} strokeWidth={LINE_FAINT} strokeLinecap="round">
                {/* Left half chevron pointing right */}
                <polyline points={`${HALF - 12},${BY - 3} ${HALF - 9},${BY} ${HALF - 12},${BY + 3}`} fill="none" />
                <polyline points={`${HALF - 16},${BY - 3} ${HALF - 13},${BY} ${HALF - 16},${BY + 3}`} fill="none" />
                {/* Right half chevron pointing left */}
                <polyline points={`${HALF + 12},${BY - 3} ${HALF + 9},${BY} ${HALF + 12},${BY + 3}`} fill="none" />
                <polyline points={`${HALF + 16},${BY - 3} ${HALF + 13},${BY} ${HALF + 16},${BY + 3}`} fill="none" />
            </g>
        )}
    </g>
));
CenterLine.displayName = 'CenterLine';

// ── Court outline ─────────────────────────────────────────────
const CourtOutline = React.memo(({ T }: { T: CourtPalette }) => (
    <rect
        x={0.3} y={0.3}
        width={LS_W - 0.6} height={LS_H - 0.6}
        fill="none" stroke={T.line} strokeWidth={LINE_HEAVY * 1.2}
        pointerEvents="none"
    />
));
CourtOutline.displayName = 'CourtOutline';

// ── Composite — exports ───────────────────────────────────────
export const CourtLinesBackground = React.memo(({ T }: { T: CourtPalette }) => (
    <g>
        <LeftHalfMarkings T={T} />
        <RightHalfMarkings T={T} />
    </g>
));
CourtLinesBackground.displayName = 'CourtLinesBackground';

export const CourtLinesForeground = React.memo(({ T, chevrons = false }: {
    T: CourtPalette; chevrons?: boolean;
}) => (
    <g>
        <CenterLine T={T} chevrons={chevrons} />
        {/* Re-draw paint + arc + 3pt corner straights on top of hex layer so
            cells don't dim the markings. Background renders these for the
            empty-court look; foreground keeps them crisp at full LINE_HEAVY
            weight even when hex tints / heatmap pack the chart. */}
        <g fill="none" pointerEvents="none">
            <rect x={0} y={PT} width={PD} height={PB - PT}
                stroke={T.line} strokeWidth={LINE_HEAVY} />
            <rect x={LS_W - PD} y={PT} width={PD} height={PB - PT}
                stroke={T.line} strokeWidth={LINE_HEAVY} />
            <path d={`M ${TX} ${TYT} A ${R3} ${R3} 0 0 1 ${TX} ${TYB}`}
                stroke={T.line} strokeWidth={LINE_HEAVY} />
            <path d={`M ${LS_W - TX} ${TYT} A ${R3} ${R3} 0 0 0 ${LS_W - TX} ${TYB}`}
                stroke={T.line} strokeWidth={LINE_HEAVY} />
            {/* Left half corner straights (baseline → arc tangent) */}
            <line x1={0} y1={TYT} x2={TX} y2={TYT}
                stroke={T.line} strokeWidth={LINE_HEAVY} />
            <line x1={0} y1={TYB} x2={TX} y2={TYB}
                stroke={T.line} strokeWidth={LINE_HEAVY} />
            {/* Right half corner straights (mirrored) */}
            <line x1={LS_W} y1={TYT} x2={LS_W - TX} y2={TYT}
                stroke={T.line} strokeWidth={LINE_HEAVY} />
            <line x1={LS_W} y1={TYB} x2={LS_W - TX} y2={TYB}
                stroke={T.line} strokeWidth={LINE_HEAVY} />
        </g>
        <CourtOutline T={T} />
        <Basket bx={BX_L} by={BY} rim={T.rim} gradId="rim-glow-l" />
        <Basket bx={BX_R} by={BY} rim={T.rim} gradId="rim-glow-r" />
    </g>
));
CourtLinesForeground.displayName = 'CourtLinesForeground';
