// src/components/shotchart/AdvancedCourtHex.tsx
// Zone-clipped hex court v2 — each hex straddling the 3pt arc is rendered
// TWICE with SVG clipPaths so the boundary cuts cleanly through the grid.

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { ShotZoneId } from './types/shotTypes';

// ── Court specs ──────────────────────────────────────────────────────────────

interface CourtSpec {
    width: number; height: number;
    basketX: number; basketY: number; backboardY: number;
    restrictedRadius: number;
    paintLeft: number; paintRight: number; paintTop: number;
    ftCircleRadius: number;
    threePointRadius: number; threeCornerX: number; threeCornerMaxY: number;
    laneMarks: number[]; centerCircleRadius: number;
    M_PER_UNIT: number;
}

const M = 0.15;

const FIBA_SPEC: CourtSpec = {
    width: 100, height: 94, basketX: 50, basketY: 10.5, backboardY: 8,
    restrictedRadius: 8.33, paintLeft: 33.67, paintRight: 66.33, paintTop: 38.67,
    ftCircleRadius: 12, threePointRadius: 45, threeCornerX: 6,
    threeCornerMaxY: 19.93,
    laneMarks: [11.67, 17.0, 22.33, 27.67], centerCircleRadius: 12, M_PER_UNIT: M,
};

const NBA_SPEC: CourtSpec = {
    width: 100, height: 94, basketX: 50, basketY: 10.5, backboardY: 8,
    restrictedRadius: 8.13, paintLeft: 33.73, paintRight: 66.27, paintTop: 38.60,
    ftCircleRadius: 12.20, threePointRadius: 48.27, threeCornerX: 6.07,
    // 10.5 + sqrt(48.27^2 - (50-6.07)^2) ≈ 30.52
    threeCornerMaxY: 30.52,
    laneMarks: [11.67, 17.0, 22.33, 27.67], centerCircleRadius: 12, M_PER_UNIT: M,
};

// ── Public types ─────────────────────────────────────────────────────────────

export type CourtTheme = 'dark' | 'wooden' | 'white';

export interface HoverInfo {
    zone: ShotZoneId;
    dist: { meters: number; feet: number };
    x: number;
    y: number;
    /** Screen (client) coords of the pointer — used by the Pi touch preview. */
    screen?: { x: number; y: number };
}

export interface ShotDot {
    id: string;
    x: number; y: number;
    made: boolean;
    points: 1 | 2 | 3;
    isLatest?: boolean;
}

export interface ZoneOverlay {
    zoneId: ShotZoneId;
    fgPct: number;
    fga: number;
    label: string;
}

export interface AdvancedCourtHexProps {
    shots?: ShotDot[];
    zoneOverlays?: ZoneOverlay[];
    onCourtTap?: (x: number, y: number) => void;
    onHoverChange?: (info: HoverInfo | null) => void;
    interactive?: boolean;
    activeColor?: string;
    activeEdge?: 'A' | 'B' | null;
    pendingInfo?: { made: boolean; points: number } | null;
    courtTheme?: CourtTheme;
    hexOpacity?: number;
    showZoneHL?: boolean;
    showHeatmap?: boolean;
    fullCourt?: boolean;
    hexRadius?: number;
    showLineToRim?: boolean;
    courtSpec?: 'fiba' | 'nba';
    className?: string;
    /** Touch-first mode (Pi). Replaces hover with touch preview + commit-on-release. */
    touchMode?: boolean;
}

// ── Geometry ─────────────────────────────────────────────────────────────────

const SQRT3 = Math.sqrt(3);
const HALF_H = 94;

interface HexCell { id: string; row: number; col: number; x: number; y: number; kind: 'hex' | 'rim' }

function buildHexGrid(R: number, courtH: number, C: CourtSpec): HexCell[] {
    const dx = SQRT3 * R, dy = 1.5 * R;
    const cells: HexCell[] = [];
    const rRows = Math.ceil((courtH + 2 * R) / dy) + 2;
    const rCols = Math.ceil((C.width + 2 * R) / dx) + 2;
    for (let row = 0; row < rRows; row++) {
        const y = -R + row * dy;
        const xOff = (row % 2 === 0) ? 0 : dx / 2;
        for (let col = 0; col < rCols; col++) {
            const x = -R + xOff + col * dx;
            if (x < -R * 0.4 || x > C.width + R * 0.4) continue;
            if (y < -R * 0.4 || y > courtH + R * 0.4) continue;
            if (Math.hypot(x - C.basketX, y - C.basketY) < R * 0.85) continue;
            if (courtH > HALF_H && Math.hypot(x - C.basketX, y - (courtH - C.basketY)) < R * 0.85) continue;
            cells.push({ id: `r${row}c${col}`, row, col, x, y, kind: 'hex' });
        }
    }
    cells.push({ id: 'rim', row: -1, col: -1, x: C.basketX, y: C.basketY, kind: 'rim' });
    if (courtH > HALF_H) cells.push({ id: 'rim_far', row: -2, col: -1, x: C.basketX, y: courtH - C.basketY, kind: 'rim' });
    return cells;
}

function hexPoints(cx: number, cy: number, R: number): string {
    let pts = '';
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        pts += `${(cx + R * Math.cos(a)).toFixed(3)},${(cy + R * Math.sin(a)).toFixed(3)} `;
    }
    return pts.trim();
}

function hexVertices(cx: number, cy: number, R: number): [number, number][] {
    const v: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        v.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    return v;
}

function nearestHex(cells: HexCell[], x: number, y: number): HexCell | null {
    let best: HexCell | null = null, bestD = Infinity;
    for (const c of cells) {
        const d = (c.x - x) ** 2 + (c.y - y) ** 2;
        if (d < bestD) { bestD = d; best = c; }
    }
    return best;
}

function rimDist(x: number, y: number, C: CourtSpec) {
    const du = Math.hypot(x - C.basketX, y - C.basketY);
    const meters = du * C.M_PER_UNIT;
    return { meters, feet: meters * 3.28084 };
}

function svgToApp(svgEl: SVGSVGElement, clientX: number, clientY: number, courtH: number) {
    const r = svgEl.getBoundingClientRect();
    return { x: (clientX - r.left) * 100 / r.width, y: (clientY - r.top) * courtH / r.height };
}

function hexA(hex: string, a: number): string {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

// ── Zone classification (corrected — matches design's court-geom.js) ─────────

function isBeyondArc(x: number, y: number, courtH: number, C: CourtSpec): boolean {
    const yEff = (courtH > HALF_H && y > courtH / 2) ? courtH - y : y;
    if (yEff <= C.threeCornerMaxY) return x <= C.threeCornerX || x >= 100 - C.threeCornerX;
    return Math.hypot(x - C.basketX, yEff - C.basketY) >= C.threePointRadius;
}

function hexSplit(cell: HexCell, R: number, courtH: number, C: CourtSpec): 'inside' | 'outside' | 'split' {
    const verts = hexVertices(cell.x, cell.y, R);
    let inside = 0, outside = 0;
    for (const [vx, vy] of verts) isBeyondArc(vx, vy, courtH, C) ? outside++ : inside++;
    isBeyondArc(cell.x, cell.y, courtH, C) ? outside++ : inside++;
    if (outside === 0) return 'inside';
    if (inside === 0) return 'outside';
    return 'split';
}

function classifyLocal(x: number, y: number, C: CourtSpec): ShotZoneId {
    const dist = Math.hypot(x - C.basketX, y - C.basketY);
    if (dist <= 1.6) return 'at_rim';
    if (x >= C.paintLeft && x <= C.paintRight && y <= C.paintTop) {
        return dist <= C.restrictedRadius ? 'restricted' : x < C.basketX ? 'paint_left' : 'paint_right';
    }
    if (dist <= C.restrictedRadius && y <= C.basketY + C.restrictedRadius) return 'restricted';
    if (y <= C.threeCornerMaxY) {
        if (x <= C.threeCornerX) return 'three_corner_left';
        if (x >= 100 - C.threeCornerX) return 'three_corner_right';
    }
    if (dist >= C.threePointRadius) {
        const ang = Math.atan2(y - C.basketY, x - C.basketX) * 180 / Math.PI;
        if (ang < 25)   return 'three_wing_right';
        if (ang < 65)   return 'three_top_right';
        if (ang <= 115) return 'three_top_center';
        if (ang <= 155) return 'three_top_left';
        return 'three_wing_left';
    }
    if (y <= C.paintTop) return x < C.basketX ? 'mid_baseline_left' : 'mid_baseline_right';
    if (y <= C.paintTop + 10) {
        if (x < C.paintLeft) return 'mid_elbow_left';
        if (x > C.paintRight) return 'mid_elbow_right';
    }
    return 'mid_top';
}

function classifyFull(x: number, y: number, courtH: number, C: CourtSpec): ShotZoneId {
    const yEff = courtH > HALF_H && y > courtH / 2 ? courtH - y : y;
    return classifyLocal(x, yEff, C);
}

// ── Zone metadata ─────────────────────────────────────────────────────────────

const ZONE_ACCENT: Partial<Record<string, string>> = {
    at_rim: '#FF8C00', restricted: '#22C55E',
    paint_left: '#84CC16', paint_right: '#84CC16',
};
export function zoneAccent(z: string): string {
    if (ZONE_ACCENT[z]) return ZONE_ACCENT[z]!;
    if (z.startsWith('three_')) return '#3B82F6';
    return '#F59E0B';
}

export const ZONE_META: Partial<Record<string, { label: string; short: string; pts: 2 | 3 }>> = {
    at_rim:             { label: 'At Rim / Dunk',   short: 'RIM', pts: 2 },
    restricted:         { label: 'Restricted Area',  short: 'RA',  pts: 2 },
    paint_left:         { label: 'Paint — Left',     short: 'PL',  pts: 2 },
    paint_right:        { label: 'Paint — Right',    short: 'PR',  pts: 2 },
    mid_baseline_left:  { label: 'Mid Baseline L',   short: 'MBL', pts: 2 },
    mid_baseline_right: { label: 'Mid Baseline R',   short: 'MBR', pts: 2 },
    mid_elbow_left:     { label: 'Left Elbow',       short: 'LEL', pts: 2 },
    mid_elbow_right:    { label: 'Right Elbow',      short: 'REL', pts: 2 },
    mid_top:            { label: 'Mid Top of Key',   short: 'MT',  pts: 2 },
    three_corner_left:  { label: 'Left Corner 3',    short: 'LC3', pts: 3 },
    three_corner_right: { label: 'Right Corner 3',   short: 'RC3', pts: 3 },
    three_wing_left:    { label: 'Left Wing 3',      short: 'LW3', pts: 3 },
    three_wing_right:   { label: 'Right Wing 3',     short: 'RW3', pts: 3 },
    three_top_left:     { label: 'Top Left 3',       short: 'TL3', pts: 3 },
    three_top_right:    { label: 'Top Right 3',      short: 'TR3', pts: 3 },
    three_top_center:   { label: 'Top Center 3',     short: 'TC3', pts: 3 },
};

function fgPctColor(made: number, total: number): { base: string; alpha: number } | null {
    if (!total) return null;
    const pct = (made / total) * 100;
    return {
        base: pct >= 60 ? '#22C55E' : pct >= 40 ? '#F59E0B' : '#EF4444',
        alpha: Math.min(0.75, 0.20 + total * 0.11),
    };
}

// ── Themes ───────────────────────────────────────────────────────────────────

interface ThemeDef {
    bgFrom: string; bgTo: string;
    line1: string; line2: string; line3: string;
    paintFill: string; grain: string;
    cellBase: string; cellStroke: string;
    rimLabel: string; isLight: boolean;
}

const THEMES: Record<CourtTheme, ThemeDef> = {
    dark: {
        bgFrom: '#0E0C09', bgTo: '#050403',
        line1: 'rgba(255,255,255,0.55)', line2: 'rgba(255,255,255,0.35)', line3: 'rgba(255,255,255,0.20)',
        paintFill: 'rgba(120,60,20,0.10)', grain: 'rgba(255,255,255,0.04)',
        cellBase: 'rgba(255,255,255,0.018)', cellStroke: 'rgba(255,255,255,0.06)',
        rimLabel: 'rgba(255,140,0,0.85)', isLight: false,
    },
    wooden: {
        bgFrom: '#C8965A', bgTo: '#8B5A2B',
        line1: 'rgba(255,255,255,0.92)', line2: 'rgba(255,255,255,0.62)', line3: 'rgba(255,255,255,0.32)',
        paintFill: 'rgba(180,90,30,0.30)', grain: 'rgba(60,30,5,0.10)',
        cellBase: 'rgba(255,255,255,0.04)', cellStroke: 'rgba(60,30,10,0.18)',
        rimLabel: 'rgba(255,255,255,0.95)', isLight: true,
    },
    white: {
        bgFrom: '#F8F5EE', bgTo: '#E8E2D4',
        line1: 'rgba(20,20,25,0.70)', line2: 'rgba(20,20,25,0.45)', line3: 'rgba(20,20,25,0.25)',
        paintFill: 'rgba(180,90,30,0.10)', grain: 'rgba(0,0,0,0.025)',
        cellBase: 'rgba(20,20,25,0.04)', cellStroke: 'rgba(20,20,25,0.10)',
        rimLabel: 'rgba(180,80,0,0.90)', isLight: true,
    },
};

// ── Court markings ───────────────────────────────────────────────────────────

function HoopMarkings({ T, C, transform }: { T: ThemeDef; C: CourtSpec; transform?: string }) {
    const tanY = C.threeCornerMaxY;
    const threePt = `M ${C.threeCornerX} 0 L ${C.threeCornerX} ${tanY.toFixed(3)} A ${C.threePointRadius} ${C.threePointRadius} 0 0 0 ${100 - C.threeCornerX} ${tanY.toFixed(3)} L ${100 - C.threeCornerX} 0`;
    const nc = `M ${C.basketX - C.restrictedRadius} ${C.basketY} A ${C.restrictedRadius} ${C.restrictedRadius} 0 0 0 ${C.basketX + C.restrictedRadius} ${C.basketY}`;
    const ftS = `M ${C.basketX - C.ftCircleRadius} ${C.paintTop} A ${C.ftCircleRadius} ${C.ftCircleRadius} 0 0 1 ${C.basketX + C.ftCircleRadius} ${C.paintTop}`;
    const ftD = `M ${C.basketX - C.ftCircleRadius} ${C.paintTop} A ${C.ftCircleRadius} ${C.ftCircleRadius} 0 0 0 ${C.basketX + C.ftCircleRadius} ${C.paintTop}`;
    return (
        <g fill="none" pointerEvents="none" transform={transform}>
            <rect x={C.paintLeft} y="0" width={C.paintRight - C.paintLeft} height={C.paintTop} fill={T.paintFill} />
            <rect x={C.paintLeft} y="0" width={C.paintRight - C.paintLeft} height={C.paintTop} stroke={T.line2} strokeWidth="0.4" />
            {/* 3pt arc shadow for depth */}
            <path d={threePt} stroke={T.isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.10)'} strokeWidth="1.6" />
            <path d={threePt} stroke={T.line1} strokeWidth="0.7" />
            <path d={ftS} stroke={T.line2} strokeWidth="0.4" />
            <path d={ftD} stroke={T.line3} strokeWidth="0.4" strokeDasharray="2 1.5" />
            <path d={nc} stroke={T.line2} strokeWidth="0.4" />
            <line x1={C.basketX - 6} y1={C.backboardY} x2={C.basketX + 6} y2={C.backboardY} stroke={T.line1} strokeWidth="0.9" strokeLinecap="round" />
            <rect x={C.basketX - 2.2} y={C.backboardY - 0.3} width="4.4" height="0.6" rx="0.15" stroke={T.line2} strokeWidth="0.2" />
            <line x1={C.basketX} y1={C.basketY - 1.5} x2={C.basketX} y2={C.backboardY} stroke="rgba(255,140,40,0.65)" strokeWidth="0.4" />
            <circle cx={C.basketX} cy={C.basketY} r="0.85" fill="none" stroke="rgba(255,140,40,0.75)" strokeWidth="0.3" />
            {C.laneMarks.map((my, i) => {
                const len = i === 0 ? 1.2 : 0.8;
                return (
                    <g key={i}>
                        <line x1={C.paintLeft - len} y1={my} x2={C.paintLeft + len} y2={my} stroke={T.line3} strokeWidth="0.3" />
                        <line x1={C.paintRight - len} y1={my} x2={C.paintRight + len} y2={my} stroke={T.line3} strokeWidth="0.3" />
                    </g>
                );
            })}
        </g>
    );
}

function CourtLines({ T, C, courtH }: { T: ThemeDef; C: CourtSpec; courtH: number }) {
    const isFC = courtH > HALF_H;
    return (
        <g fill="none" pointerEvents="none">
            <rect x="0" y="0" width="100" height={courtH} stroke={T.line1} strokeWidth="0.6" />
            {isFC && (
                <>
                    <line x1="0" y1={courtH / 2} x2="100" y2={courtH / 2} stroke={T.line2} strokeWidth="0.4" />
                    <circle cx={C.basketX} cy={courtH / 2} r={C.centerCircleRadius} stroke={T.line2} strokeWidth="0.4" />
                    <circle cx={C.basketX} cy={courtH / 2} r="2" stroke={T.line3} strokeWidth="0.3" />
                </>
            )}
            <HoopMarkings T={T} C={C} />
            {isFC && <HoopMarkings T={T} C={C} transform={`translate(100,${courtH}) rotate(180)`} />}
        </g>
    );
}

// ── Shot aggregation ─────────────────────────────────────────────────────────

function buildShotIndex(cells: HexCell[], shots: ShotDot[]) {
    const idx = new Map<string, { made: number; miss: number; total: number }>();
    const hexOnly = cells.filter(c => c.kind !== 'rim');
    for (const s of shots) {
        const hex = nearestHex(hexOnly, s.x, s.y);
        if (!hex) continue;
        let agg = idx.get(hex.id);
        if (!agg) { agg = { made: 0, miss: 0, total: 0 }; idx.set(hex.id, agg); }
        agg.total++;
        if (s.made) agg.made++; else agg.miss++;
    }
    return idx;
}

// ── Main component ───────────────────────────────────────────────────────────

export const AdvancedCourtHex: React.FC<AdvancedCourtHexProps> = ({
    shots = [], zoneOverlays, onCourtTap, onHoverChange,
    interactive = false, activeColor = '#FBBF24', activeEdge = null, pendingInfo,
    courtTheme = 'dark', hexOpacity = 0.18, showZoneHL = true, showHeatmap = false,
    fullCourt = false, hexRadius, showLineToRim = false,
    courtSpec = 'fiba', className = '', touchMode = false,
}) => {
    const lastTouch = useRef<{ x: number; y: number } | null>(null);
    const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const rafRef = useRef<number | null>(null);
    const pendingPos = useRef<{ x: number; y: number } | null>(null);
    const [hoverCell, setHoverCell] = useState<HexCell | null>(null);
    const [hoverPos, setHoverPos] = useState<{ cx: number; cy: number } | null>(null);
    const [pulseId, setPulseId] = useState<string | null>(null);

    const C = courtSpec === 'nba' ? NBA_SPEC : FIBA_SPEC;
    const T = THEMES[courtTheme] ?? THEMES.dark;
    const R = hexRadius ?? 1.9;
    const HEX_R = R * 0.95;
    const RIM_R = R * 1.25;
    const courtH = fullCourt ? 188 : HALF_H;

    const cells = useMemo(() => buildHexGrid(R, courtH, C), [R, courtH, courtSpec]);

    const rowMap = useMemo(() => {
        const m = new Map<number, HexCell[]>();
        cells.forEach(c => { if (c.kind === 'rim') return; if (!m.has(c.row)) m.set(c.row, []); m.get(c.row)!.push(c); });
        return m;
    }, [cells]);

    const rimCell = useMemo(() => cells.find(c => c.id === 'rim')!, [cells]);
    const rimFarCell = useMemo(() => cells.find(c => c.id === 'rim_far') ?? null, [cells]);

    // Arc-split classification for every cell
    const cellInfo = useMemo(() => {
        const m = new Map<string, { zone: ShotZoneId; split: 'inside' | 'outside' | 'split'; insideZone: ShotZoneId | null; outsideZone: ShotZoneId | null }>();
        for (const c of cells) {
            if (c.kind === 'rim') { m.set(c.id, { zone: 'at_rim', split: 'inside', insideZone: 'at_rim', outsideZone: null }); continue; }
            const yEff = fullCourt && c.y > courtH / 2 ? courtH - c.y : c.y;
            const zone = classifyLocal(c.x, yEff, C);
            const split = hexSplit(c, HEX_R, courtH, C);
            let insideZone: ShotZoneId | null = null, outsideZone: ShotZoneId | null = null;
            if (split === 'inside') {
                insideZone = zone;
            } else if (split === 'outside') {
                outsideZone = zone;
            } else {
                // Straddles arc — sample a point on each side
                const dirX = C.basketX - c.x;
                const dirYEff = C.basketY - yEff;
                const len = Math.hypot(dirX, dirYEff) || 1;
                const ux = dirX / len, uy = dirYEff / len;
                const pInX = c.x + ux * R * 1.2;
                const pInYRaw = c.y + uy * R * 1.2;
                const pInY = fullCourt && c.y > courtH / 2 ? courtH - pInYRaw : pInYRaw;
                let iz = classifyLocal(pInX, Math.max(0.01, pInY), C);
                if (iz.startsWith('three_')) iz = 'mid_top';
                insideZone = iz;
                const pOutX = c.x - ux * R * 1.2;
                const pOutYRaw = c.y - uy * R * 1.2;
                const pOutY = fullCourt && c.y > courtH / 2 ? courtH - pOutYRaw : pOutYRaw;
                let oz = classifyLocal(pOutX, Math.max(0.01, pOutY), C);
                if (!oz.startsWith('three_')) oz = 'three_top_center';
                outsideZone = oz;
            }
            m.set(c.id, { zone, split, insideZone, outsideZone });
        }
        return m;
    }, [cells, HEX_R, courtH, courtSpec, fullCourt]);

    const shotIndex = useMemo(() => buildShotIndex(cells, shots), [cells, shots]);

    const zoneStats = useMemo(() => {
        const m = new Map<ShotZoneId, { made: number; total: number }>();
        for (const s of shots) {
            const hex = nearestHex(cells.filter(c => c.kind !== 'rim'), s.x, s.y);
            if (!hex) continue;
            const info = cellInfo.get(hex.id);
            if (!info || !info.zone) continue;
            let st = m.get(info.zone);
            if (!st) { st = { made: 0, total: 0 }; m.set(info.zone, st); }
            st.total++;
            if (s.made) st.made++;
        }
        return m;
    }, [cells, cellInfo, shots]);

    const zoneHeatMap = useMemo(() => {
        if (!zoneOverlays?.length) return null;
        const m = new Map<string, number>();
        for (const o of zoneOverlays) m.set(o.zoneId, o.fgPct);
        return m;
    }, [zoneOverlays]);

    const hoverZone = hoverCell ? (cellInfo.get(hoverCell.id)?.zone ?? null) : null;

    const zoneSet = useMemo(() => {
        if (!showZoneHL || !hoverZone) return null;
        const s = new Set<string>();
        for (const [id, info] of cellInfo) {
            if (info.insideZone === hoverZone || info.outsideZone === hoverZone || info.zone === hoverZone) s.add(id);
        }
        return s;
    }, [showZoneHL, hoverZone, cellInfo]);

    const findCell = useCallback((x: number, y: number): HexCell | null => {
        if (Math.hypot(x - rimCell.x, y - rimCell.y) <= 1.6) return rimCell;
        if (rimFarCell && Math.hypot(x - rimFarCell.x, y - rimFarCell.y) <= 1.6) return rimFarCell;
        const dy = 1.5 * R;
        const guessRow = Math.round(y / dy);
        const candidates: HexCell[] = [];
        for (let dr = -2; dr <= 2; dr++) { const arr = rowMap.get(guessRow + dr); if (arr) candidates.push(...arr); }
        return nearestHex(candidates.length ? candidates : cells.filter(c => c.kind !== 'rim'), x, y);
    }, [cells, rowMap, rimCell, rimFarCell, R]);

    const updateHover = useCallback((clientX: number, clientY: number) => {
        if (!svgRef.current) return;
        const { x, y } = svgToApp(svgRef.current, clientX, clientY, courtH);
        if (x < 0 || x > 100 || y < 0 || y > courtH) {
            setHoverCell(null); setHoverPos(null); onHoverChange?.(null); return;
        }
        const cell = findCell(x, y);
        if (!cell) return;
        setHoverCell(prev => prev?.id === cell.id ? prev : cell);
        setHoverPos({ cx: clientX, cy: clientY });
        const yEff = fullCourt && y > courtH / 2 ? courtH - y : y;
        const zone = classifyFull(x, y, courtH, C);
        onHoverChange?.({ zone, dist: rimDist(x, yEff, C), x, y: yEff, screen: { x: clientX, y: clientY } });
    }, [findCell, courtH, C, onHoverChange, fullCourt]);

    const handleMove = useCallback((e: React.MouseEvent) => {
        pendingPos.current = { x: e.clientX, y: e.clientY };
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const p = pendingPos.current;
            if (p) updateHover(p.x, p.y);
        });
    }, [updateHover]);

    const handleLeave = useCallback(() => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        setHoverCell(null); setHoverPos(null); onHoverChange?.(null);
    }, [onHoverChange]);

    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (!onCourtTap || !svgRef.current) return;
        const { x, y: rawY } = svgToApp(svgRef.current, e.clientX, e.clientY, courtH);
        if (x < 0 || x > 100 || rawY < 0 || rawY > courtH) return;
        const cell = findCell(x, rawY);
        if (!cell) return;
        // Persist the RAW tap point (mirrored to near-half depth), not the snapped
        // hex center — the cell is only for the visual pulse. Matches the Pi path
        // (PiHexCourt) so exact shot locations survive for stats re-binning.
        const outY = fullCourt && rawY > HALF_H ? courtH - rawY : rawY;
        onCourtTap(x, outY);
        setPulseId(cell.id);
        setTimeout(() => setPulseId(null), 700);
    }, [onCourtTap, findCell, courtH, fullCourt]);

    // ── Touch path (Pi). Preview on down/move, commit on release. ───────────────
    const commitAt = useCallback((clientX: number, clientY: number) => {
        if (!onCourtTap || !svgRef.current) return;
        const { x, y: rawY } = svgToApp(svgRef.current, clientX, clientY, courtH);
        if (x < 0 || x > 100 || rawY < 0 || rawY > courtH) return;
        const cell = findCell(x, rawY);
        if (!cell) return;
        // Persist the RAW tap point (mirrored to near-half depth), not the snapped
        // hex center — the cell is only for the visual pulse. Matches the Pi path
        // (PiHexCourt) so exact shot locations survive for stats re-binning.
        const outY = fullCourt && rawY > HALF_H ? courtH - rawY : rawY;
        onCourtTap(x, outY);
        setPulseId(cell.id);
        setTimeout(() => setPulseId(null), 700);
    }, [onCourtTap, findCell, courtH, fullCourt]);

    const handleTouchPreview = useCallback((e: React.TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        e.preventDefault();
        if (clearTimer.current) { clearTimeout(clearTimer.current); clearTimer.current = null; }
        lastTouch.current = { x: t.clientX, y: t.clientY };
        updateHover(t.clientX, t.clientY);
    }, [updateHover]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        const p = lastTouch.current;
        if (p) commitAt(p.x, p.y);
        // Let the snapped preview linger briefly before clearing.
        clearTimer.current = setTimeout(() => {
            setHoverCell(null); setHoverPos(null); onHoverChange?.(null);
        }, 200);
    }, [commitAt, onHoverChange]);

    const handleTouchCancel = useCallback(() => {
        lastTouch.current = null;
        setHoverCell(null); setHoverPos(null); onHoverChange?.(null);
    }, [onHoverChange]);

    useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current); }, []);

    // Fill for a zone region on a hex
    const fillForZone = useCallback((cellId: string, zoneId: ShotZoneId | null, isHover: boolean, inHoverZone: boolean): string => {
        if (!zoneId) return 'transparent';
        
        if (showHeatmap) {
            const st = zoneStats.get(zoneId);
            if (st && st.total > 0) {
                const pct = st.made / st.total;
                const att = Math.min(1, st.total / 6);
                if (pct >= 0.55) return `rgba(34,197,94,${0.22 + att * 0.30})`;
                if (pct >= 0.40) return `rgba(245,158,11,${0.20 + att * 0.25})`;
                if (pct >= 0.25) return `rgba(245,158,11,${0.12 + att * 0.18})`;
                return `rgba(239,68,68,${0.20 + att * 0.30})`;
            }
        }

        const agg = shotIndex.get(cellId);
        if (agg && agg.total > 0 && !showHeatmap) {
            const col = fgPctColor(agg.made, agg.total);
            if (col) return hexA(col.base, col.alpha);
        }
        if (zoneHeatMap && !showHeatmap) {
            const pct = zoneHeatMap.get(zoneId);
            if (pct !== undefined) return hexA(pct >= 55 ? '#22C55E' : pct >= 35 ? '#FBBF24' : '#EF4444', 0.22);
        }
        if (isHover && interactive) return hexA(zoneAccent(zoneId), 0.65);
        if (inHoverZone) return hexA(zoneAccent(zoneId), 0.24);
        const a = zoneId === 'at_rim' ? 0.20 : zoneId === 'restricted' ? 0.13 : zoneId.startsWith('three_') ? 0.07 : 0.05;
        return hexA(zoneAccent(zoneId), a);
    }, [shotIndex, zoneHeatMap, interactive, showHeatmap, zoneStats]);

    // Clip path geometry
    const tanY = C.threeCornerMaxY;
    const insidePath = `M ${C.threeCornerX} 0 L ${C.threeCornerX} ${tanY.toFixed(3)} A ${C.threePointRadius} ${C.threePointRadius} 0 0 0 ${100 - C.threeCornerX} ${tanY.toFixed(3)} L ${100 - C.threeCornerX} 0 Z`;
    const insidePathFar = fullCourt
        ? `M ${C.threeCornerX} ${courtH} L ${C.threeCornerX} ${(courtH - tanY).toFixed(3)} A ${C.threePointRadius} ${C.threePointRadius} 0 0 1 ${100 - C.threeCornerX} ${(courtH - tanY).toFixed(3)} L ${100 - C.threeCornerX} ${courtH} Z`
        : '';
    const clipSuffix = `${courtSpec}-${courtH}`;
    const insideClipId = `ach-in-${clipSuffix}`;
    const outsideClipId = `ach-out-${clipSuffix}`;

    const madeMode = pendingInfo?.made !== false;
    const pendingRGB = madeMode ? '34,197,94' : '239,68,68';

    const tipData = useMemo(() => {
        if (!hoverCell) return null;
        const info = cellInfo.get(hoverCell.id);
        const zone = info?.zone ?? 'mid_top';
        const yEff = fullCourt && hoverCell.y > courtH / 2 ? courtH - hoverCell.y : hoverCell.y;
        const dist = rimDist(hoverCell.x, yEff, C);
        const meta = ZONE_META[zone];
        return { zone, label: meta?.label ?? zone.toUpperCase(), short: meta?.short ?? '??', pts: meta?.pts ?? 2, dist };
    }, [hoverCell, cellInfo, fullCourt, courtH, C]);

    return (
        <div className={`relative w-full h-full ${className}`}>
            <svg
                ref={svgRef}
                viewBox={`0 0 100 ${courtH}`}
                style={{ width: '100%', height: '100%', display: 'block', cursor: interactive ? 'crosshair' : 'default', userSelect: 'none', touchAction: 'none' }}
                onMouseMove={touchMode ? undefined : handleMove}
                onMouseLeave={touchMode ? undefined : handleLeave}
                onClick={touchMode ? undefined : handleClick}
                onTouchStart={touchMode ? handleTouchPreview : undefined}
                onTouchMove={touchMode ? handleTouchPreview : undefined}
                onTouchEnd={touchMode ? handleTouchEnd : undefined}
                onTouchCancel={touchMode ? handleTouchCancel : undefined}
                preserveAspectRatio="xMidYMid meet"
            >
                <defs>
                    <radialGradient id="ach-bg" cx="50%" cy="20%" r="80%">
                        <stop offset="0%" stopColor={T.bgFrom} />
                        <stop offset="100%" stopColor={T.bgTo} />
                    </radialGradient>
                    <pattern id="ach-grain" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
                        <circle cx="1" cy="1" r="0.05" fill={T.grain} />
                        <circle cx="3.5" cy="4" r="0.05" fill={T.grain} />
                        <circle cx="5" cy="2" r="0.05" fill={T.grain} />
                    </pattern>
                    {courtTheme === 'wooden' && (
                        <pattern id="ach-planks" x="0" y="0" width="100" height="6" patternUnits="userSpaceOnUse">
                            <line x1="0" y1="0" x2="100" y2="0" stroke="rgba(60,30,5,0.18)" strokeWidth="0.08" />
                        </pattern>
                    )}
                    <linearGradient id="ach-glowA" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={activeColor} stopOpacity="0.18" />
                        <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="ach-glowB" x1="100%" y1="0%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor={activeColor} stopOpacity="0.18" />
                        <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
                    </linearGradient>
                    <clipPath id="ach-court-clip"><rect x="0" y="0" width="100" height={courtH} /></clipPath>
                    {/* Inside 3pt arc clip (2pt area) */}
                    <clipPath id={insideClipId}>
                        <path d={insidePath + (fullCourt ? ' ' + insidePathFar : '')} />
                    </clipPath>
                    {/* Outside 3pt arc clip (3pt area) — evenodd subtracts inside */}
                    <clipPath id={outsideClipId} clipPathUnits="userSpaceOnUse">
                        <path fillRule="evenodd" d={`M 0 0 L 100 0 L 100 ${courtH} L 0 ${courtH} Z ${insidePath}${fullCourt ? ' ' + insidePathFar : ''}`} />
                    </clipPath>
                    <style>{`
                        @keyframes achPulse { 0%{opacity:0;transform:scale(1.6)} 40%{opacity:1} 100%{opacity:0;transform:scale(1)} }
                        .ach-hex { transition: fill 80ms linear, stroke 80ms linear; }
                        .ach-pulse { animation: achPulse 0.7s ease-out forwards; transform-origin:center; transform-box:fill-box; }
                    `}</style>
                </defs>

                {/* Court surface */}
                <rect x="0" y="0" width="100" height={courtH} fill="url(#ach-bg)" />
                <rect x="0" y="0" width="100" height={courtH} fill="url(#ach-grain)" />
                {courtTheme === 'wooden' && <rect x="0" y="0" width="100" height={courtH} fill="url(#ach-planks)" />}

                {/* Hex grid with zone-clipping */}
                <g clipPath="url(#ach-court-clip)">
                    {cells.map(c => {
                        const isRim = c.kind === 'rim';
                        const isHover = hoverCell?.id === c.id;
                        const inZone = (zoneSet?.has(c.id) && !isHover) ?? false;
                        const info = cellInfo.get(c.id);
                        if (!info) return null;
                        const agg = shotIndex.get(c.id);
                        const hasShot = !!(agg && agg.total > 0);
                        const dominantMade = hasShot && agg!.made >= agg!.miss;
                        const cellR = isRim ? RIM_R : HEX_R;

                        const getStroke = (zoneId: ShotZoneId | null): { stroke: string; sw: number; dash?: string } => {
                            if (isRim) return { stroke: 'rgba(255,140,0,0.5)', sw: 0.32 };
                            let stroke = T.cellStroke, sw = 0.06, dash: string | undefined;
                            if (inZone) { stroke = hexA(zoneAccent(zoneId ?? 'mid_top'), 0.40); sw = 0.12; }
                            if (isHover && interactive) { stroke = zoneAccent(zoneId ?? 'mid_top'); sw = touchMode ? 0.9 : 0.5; }
                            if (hasShot) {
                                stroke = T.isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)';
                                sw = isHover ? 0.4 : 0.18;
                                if (!dominantMade) dash = '0.6 0.6';
                            }
                            return { stroke, sw, dash };
                        };

                        const renderPiece = (clipId: string | null, zoneId: ShotZoneId | null, key: string) => {
                            if (!zoneId) return null;
                            const fill = isRim
                                ? hexA('#FF8C00', isHover && interactive ? 0.45 : 0.12)
                                : isHover && interactive && !hasShot
                                    ? `rgba(${pendingRGB},0.32)`
                                    : fillForZone(c.id, zoneId, isHover, inZone);
                            const { stroke, sw, dash } = getStroke(zoneId);
                            return (
                                <polygon key={key} className="ach-hex"
                                    points={hexPoints(c.x, c.y, cellR)}
                                    fill={fill} stroke={stroke} strokeWidth={sw}
                                    strokeDasharray={dash}
                                    clipPath={clipId ? `url(#${clipId})` : undefined}
                                />
                            );
                        };

                        let pieces: (React.ReactElement | null)[];
                        if (isRim) {
                            pieces = [renderPiece(null, 'at_rim', c.id)];
                        } else if (info.split === 'inside') {
                            pieces = [renderPiece(insideClipId, info.insideZone, c.id)];
                        } else if (info.split === 'outside') {
                            pieces = [renderPiece(outsideClipId, info.outsideZone, c.id)];
                        } else {
                            pieces = [
                                renderPiece(insideClipId, info.insideZone, `${c.id}-in`),
                                renderPiece(outsideClipId, info.outsideZone, `${c.id}-out`),
                            ];
                        }
                        return <g key={c.id}>{pieces}</g>;
                    })}

                    {/* Click pulse ring */}
                    {pulseId && (() => {
                        const c = cells.find(x => x.id === pulseId);
                        if (!c) return null;
                        return (
                            <polygon className="ach-pulse"
                                points={hexPoints(c.x, c.y, (c.kind === 'rim' ? RIM_R : HEX_R) * 1.5)}
                                fill="none" stroke={madeMode ? '#22C55E' : '#EF4444'} strokeWidth="0.6" />
                        );
                    })()}

                    {/* Shot count badges (≥2 on same hex) */}
                    {[...shotIndex.entries()].map(([cellId, agg]) => {
                        const c = cells.find(x => x.id === cellId);
                        if (!c || agg.total < 2) return null;
                        return (
                            <text key={cellId} x={c.x} y={c.y}
                                textAnchor="middle" dominantBaseline="central"
                                fill={T.isLight ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)'}
                                fontSize={Math.max(2.2, R * 1.05)} fontWeight="800"
                                fontFamily="'JetBrains Mono', monospace"
                                style={{ pointerEvents: 'none' }}>
                                {agg.total}
                            </text>
                        );
                    })}

                    {/* RIM label */}
                    <text x={rimCell.x} y={rimCell.y + RIM_R + 1.6}
                        textAnchor="middle" dominantBaseline="central"
                        fill={T.rimLabel} fontSize="1.6" fontWeight="900"
                        letterSpacing="0.15em" fontFamily="'Barlow Condensed', sans-serif"
                        pointerEvents="none">RIM</text>
                    {rimFarCell && (
                        <text x={rimFarCell.x} y={rimFarCell.y - RIM_R - 0.5}
                            textAnchor="middle" dominantBaseline="central"
                            fill={T.rimLabel} fontSize="1.6" fontWeight="900"
                            letterSpacing="0.15em" fontFamily="'Barlow Condensed', sans-serif"
                            pointerEvents="none">RIM</text>
                    )}
                </g>

                {/* Line to rim guide */}
                {showLineToRim && hoverCell && (
                    <line x1={hoverCell.x} y1={hoverCell.y} x2={C.basketX} y2={C.basketY}
                        stroke="rgba(255,255,255,0.25)" strokeWidth="0.4"
                        strokeDasharray="1 1" pointerEvents="none" />
                )}

                {/* Court lines drawn on top of grid */}
                <CourtLines T={T} C={C} courtH={courtH} />

                {/* Edge glow for active team side */}
                {activeEdge === 'A' && interactive && (
                    <rect x="0" y="0" width="20" height={courtH} fill="url(#ach-glowA)" pointerEvents="none" />
                )}
                {activeEdge === 'B' && interactive && (
                    <rect x="80" y="0" width="20" height={courtH} fill="url(#ach-glowB)" pointerEvents="none" />
                )}

                {/* Zone label badge following cursor */}
                {showZoneHL && hoverCell && tipData && (() => {
                    const bx = Math.min(Math.max(hoverCell.x + 2, 1), 77);
                    const by = Math.min(Math.max(hoverCell.y - 5.2, 1), courtH - 4);
                    return (
                        <g pointerEvents="none">
                            <rect x={bx} y={by} width="23" height="3.6" rx="0.6"
                                fill={T.isLight ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)'}
                                stroke={zoneAccent(tipData.zone)} strokeWidth="0.18" />
                            <text x={bx + 1} y={by + 2.3}
                                fill={T.isLight ? '#111' : '#FFF'}
                                fontSize="1.7" fontWeight="800" letterSpacing="0.08em"
                                fontFamily="'Barlow Condensed', sans-serif">
                                {tipData.label}
                            </text>
                        </g>
                    );
                })()}
            </svg>

            {/* Floating distance tooltip */}
            {tipData && hoverPos && (
                <div className="fixed z-50 pointer-events-none"
                    style={{ left: hoverPos.cx + 16, top: hoverPos.cy - 10 }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.92)', border: '1px solid #3f3f46',
                        borderRadius: 4, padding: '6px 10px',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#fff',
                        whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    }}>
                        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.3em', color: '#71717a', marginBottom: 2, textTransform: 'uppercase' }}>From basket</div>
                        <div style={{ fontWeight: 700, tabularNums: true } as React.CSSProperties}>
                            {tipData.dist.meters.toFixed(2)}<span style={{ fontSize: 9, color: '#71717a', marginLeft: 3 }}>M</span>
                            <span style={{ color: '#3f3f46', margin: '0 4px' }}>/</span>
                            {tipData.dist.feet.toFixed(1)}<span style={{ fontSize: 9, color: '#71717a', marginLeft: 3 }}>FT</span>
                        </div>
                        <div style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', marginTop: 2, textTransform: 'uppercase',
                            color: tipData.pts === 3 ? '#fbbf24' : tipData.zone === 'at_rim' || tipData.zone === 'restricted' ? '#4ade80' : '#93c5fd',
                        }}>{tipData.label}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdvancedCourtHex;
