// src/components/shotchart/AdvancedCourtHex.tsx
// Drop-in replacement for HalfCourtCanvas in AdvancedConsole.
// SVG-based hex court from the box-court-view design handoff.

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { COURT, classifyZone } from './courtZones';
import type { ShotZoneId } from './types/shotTypes';

// ── Public types ─────────────────────────────────────────────────────────────

export type CourtTheme = 'dark' | 'wooden' | 'white';

export interface ShotDot {
    id: string;
    x: number; y: number;   // app coords [0-100, 0-94]
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
    interactive?: boolean;
    activeColor?: string;
    activeEdge?: 'A' | 'B' | null;
    pendingInfo?: { made: boolean; points: number } | null;
    courtTheme?: CourtTheme;
    hexOpacity?: number;   // 0–1, controls hex grid line visibility
    showZoneHL?: boolean;  // zone tinting + badge on hover (default true)
    fullCourt?: boolean;   // 188-unit full court (default false)
    hexRadius?: number;    // hex cell size in court units (default 1.9)
    showLineToRim?: boolean; // dashed line from hovered hex to basket
    className?: string;
}

// ── Court geometry ───────────────────────────────────────────────────────────

const SQRT3 = Math.sqrt(3);
const M_PER_UNIT = 0.15;
const HALF_H = 94;
const HEX_R_DEFAULT = 1.9;

interface HexCell { id: string; row: number; col: number; x: number; y: number; kind: 'hex' | 'rim' }

function buildHexGrid(R: number, courtH: number): HexCell[] {
    const dx = SQRT3 * R;
    const dy = 1.5 * R;
    const cells: HexCell[] = [];
    const rRows = Math.ceil((courtH + 2 * R) / dy) + 2;
    const rCols = Math.ceil((COURT.width + 2 * R) / dx) + 2;
    for (let row = 0; row < rRows; row++) {
        const y = -R + row * dy;
        const xOff = (row % 2 === 0) ? 0 : dx / 2;
        for (let col = 0; col < rCols; col++) {
            const x = -R + xOff + col * dx;
            if (x < -R * 0.4 || x > COURT.width + R * 0.4) continue;
            if (y < -R * 0.4 || y > courtH + R * 0.4) continue;
            // Exclude near-end rim
            if (Math.hypot(x - COURT.basketX, y - COURT.basketY) < R * 0.85) continue;
            // Exclude far-end rim (full court)
            if (courtH > HALF_H && Math.hypot(x - COURT.basketX, y - (courtH - COURT.basketY)) < R * 0.85) continue;
            cells.push({ id: `r${row}c${col}`, row, col, x, y, kind: 'hex' });
        }
    }
    cells.push({ id: 'rim', row: -1, col: -1, x: COURT.basketX, y: COURT.basketY, kind: 'rim' });
    if (courtH > HALF_H) {
        cells.push({ id: 'rim_far', row: -2, col: -1, x: COURT.basketX, y: courtH - COURT.basketY, kind: 'rim' });
    }
    return cells;
}

function hexPoints(cx: number, cy: number, R: number): string {
    let pts = '';
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        pts += `${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)} `;
    }
    return pts.trim();
}

function nearestHex(cells: HexCell[], x: number, y: number): HexCell | null {
    let best: HexCell | null = null, bestD = Infinity;
    for (const c of cells) {
        const d = (c.x - x) ** 2 + (c.y - y) ** 2;
        if (d < bestD) { bestD = d; best = c; }
    }
    return best;
}

function classifyFull(x: number, y: number): ShotZoneId {
    if (Math.hypot(x - COURT.basketX, y - COURT.basketY) <= 1.6) return 'restricted';
    return classifyZone(x, y);
}

function rimDist(x: number, y: number) {
    const du = Math.hypot(x - COURT.basketX, y - COURT.basketY);
    const m = du * M_PER_UNIT;
    return { meters: m, feet: m * 3.28084 };
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

// ── Zone accent colours ───────────────────────────────────────────────────────

const ZONE_ACCENT: Record<string, string> = {
    restricted: '#22C55E',
    paint_left: '#84CC16', paint_right: '#84CC16',
};
function zoneAccent(z: string): string {
    if (ZONE_ACCENT[z]) return ZONE_ACCENT[z];
    if (z.startsWith('three_')) return '#3B82F6';
    return '#F59E0B';
}

const ZONE_LABELS: Record<string, string> = {
    restricted: 'RESTRICTED AREA', paint_left: 'PAINT — LEFT', paint_right: 'PAINT — RIGHT',
    mid_baseline_left: 'MID BASELINE L', mid_baseline_right: 'MID BASELINE R',
    mid_elbow_left: 'LEFT ELBOW', mid_elbow_right: 'RIGHT ELBOW', mid_top: 'MID TOP OF KEY',
    three_corner_left: 'LEFT CORNER 3', three_corner_right: 'RIGHT CORNER 3',
    three_wing_left: 'LEFT WING 3', three_wing_right: 'RIGHT WING 3',
    three_top_left: 'TOP LEFT 3', three_top_right: 'TOP RIGHT 3', three_top_center: 'TOP CENTER 3',
};
const ZONE_PTS: Record<string, 2 | 3> = {
    three_corner_left: 3, three_corner_right: 3, three_wing_left: 3, three_wing_right: 3,
    three_top_left: 3, three_top_right: 3, three_top_center: 3,
};

// ── Themes ───────────────────────────────────────────────────────────────────

interface ThemeDef {
    bgFrom: string; bgTo: string;
    line1: string; line2: string; line3: string;
    paintFill: string; grain: string;
    cellBase: string; cellStroke: string;
    rimLabel: string;
    isLight: boolean;
}

const THEMES: Record<CourtTheme, ThemeDef> = {
    dark: {
        bgFrom: '#0E0C09', bgTo: '#050403',
        line1: 'rgba(255,255,255,0.50)', line2: 'rgba(255,255,255,0.32)', line3: 'rgba(255,255,255,0.18)',
        paintFill: 'rgba(120,60,20,0.10)', grain: 'rgba(255,255,255,0.04)',
        cellBase: 'rgba(255,255,255,0.018)', cellStroke: 'rgba(255,255,255,0.06)',
        rimLabel: 'rgba(255,140,0,0.85)', isLight: false,
    },
    wooden: {
        bgFrom: '#C8965A', bgTo: '#8B5A2B',
        line1: 'rgba(255,255,255,0.85)', line2: 'rgba(255,255,255,0.55)', line3: 'rgba(255,255,255,0.30)',
        paintFill: 'rgba(180,90,30,0.30)', grain: 'rgba(60,30,5,0.10)',
        cellBase: 'rgba(255,255,255,0.04)', cellStroke: 'rgba(60,30,10,0.18)',
        rimLabel: 'rgba(255,255,255,0.95)', isLight: true,
    },
    white: {
        bgFrom: '#F8F5EE', bgTo: '#E8E2D4',
        line1: 'rgba(20,20,25,0.65)', line2: 'rgba(20,20,25,0.40)', line3: 'rgba(20,20,25,0.20)',
        paintFill: 'rgba(180,90,30,0.10)', grain: 'rgba(0,0,0,0.025)',
        cellBase: 'rgba(20,20,25,0.04)', cellStroke: 'rgba(20,20,25,0.10)',
        rimLabel: 'rgba(180,80,0,0.90)', isLight: true,
    },
};

// ── Court markings ───────────────────────────────────────────────────────────

function HoopMarkings({ theme, transform }: { theme: CourtTheme; transform?: string }) {
    const T = THEMES[theme];
    const C = COURT;
    const tanY = C.threeCornerMaxY;
    const threePt = `M ${C.threeCornerX} 0 L ${C.threeCornerX} ${tanY.toFixed(2)} A ${C.threePointRadius} ${C.threePointRadius} 0 0 0 ${100 - C.threeCornerX} ${tanY.toFixed(2)} L ${100 - C.threeCornerX} 0`;
    const nc = `M ${C.basketX - C.restrictedRadius} ${C.basketY} A ${C.restrictedRadius} ${C.restrictedRadius} 0 0 0 ${C.basketX + C.restrictedRadius} ${C.basketY}`;
    const ftS = `M ${C.basketX - C.ftCircleRadius} ${C.paintTop} A ${C.ftCircleRadius} ${C.ftCircleRadius} 0 0 1 ${C.basketX + C.ftCircleRadius} ${C.paintTop}`;
    const ftD = `M ${C.basketX - C.ftCircleRadius} ${C.paintTop} A ${C.ftCircleRadius} ${C.ftCircleRadius} 0 0 0 ${C.basketX + C.ftCircleRadius} ${C.paintTop}`;
    return (
        <g fill="none" pointerEvents="none" transform={transform}>
            <rect x={C.paintLeft} y="0" width={C.paintRight - C.paintLeft} height={C.paintTop} fill={T.paintFill} />
            <rect x={C.paintLeft} y="0" width={C.paintRight - C.paintLeft} height={C.paintTop} stroke={T.line2} strokeWidth="0.4" />
            <path d={threePt} stroke={T.isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.10)'} strokeWidth="1.6" />
            <path d={threePt} stroke={T.line1} strokeWidth="0.65" />
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

function CourtLines({ theme, courtH }: { theme: CourtTheme; courtH: number }) {
    const T = THEMES[theme];
    const C = COURT;
    const isFullCourt = courtH > HALF_H;
    return (
        <g fill="none" pointerEvents="none">
            <rect x="0" y="0" width="100" height={courtH} stroke={T.line1} strokeWidth="0.6" />
            {/* Half-court dividing line */}
            {isFullCourt && (
                <line x1="0" y1={courtH / 2} x2="100" y2={courtH / 2} stroke={T.line2} strokeWidth="0.4" />
            )}
            {/* Center circle arc at near baseline */}
            <path d={`M ${C.basketX - C.centerCircleRadius} ${isFullCourt ? HALF_H : courtH} A ${C.centerCircleRadius} ${C.centerCircleRadius} 0 0 1 ${C.basketX + C.centerCircleRadius} ${isFullCourt ? HALF_H : courtH}`} stroke={T.line3} strokeWidth="0.4" />
            {/* Near end */}
            <HoopMarkings theme={theme} />
            {/* Far end (full court only) — mirror via rotate 180 around court center */}
            {isFullCourt && (
                <g transform={`translate(100,${courtH}) rotate(180)`}>
                    <HoopMarkings theme={theme} />
                </g>
            )}
        </g>
    );
}

// ── Per-hex shot aggregation ─────────────────────────────────────────────────

function buildShotIndex(cells: HexCell[], shots: ShotDot[]) {
    const idx = new Map<string, { made: number; miss: number; total: number }>();
    for (const s of shots) {
        const hex = nearestHex(cells.filter(c => c.kind !== 'rim'), s.x, s.y);
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
    shots = [],
    zoneOverlays,
    onCourtTap,
    interactive = false,
    activeColor = '#FBBF24',
    activeEdge = null,
    pendingInfo,
    courtTheme = 'dark',
    hexOpacity = 0.18,
    showZoneHL = true,
    fullCourt = false,
    hexRadius,
    showLineToRim = false,
    className = '',
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const rafRef = useRef<number | null>(null);
    const pendingPos = useRef<{ x: number; y: number } | null>(null);
    const [hoverCell, setHoverCell] = useState<HexCell | null>(null);
    const [hoverPos, setHoverPos] = useState<{ cx: number; cy: number } | null>(null);

    const T = THEMES[courtTheme] || THEMES.dark;
    const R = hexRadius ?? HEX_R_DEFAULT;
    const HEX_R_ACTUAL = R * 0.95;
    const RIM_R = R * 1.25;
    const courtH = fullCourt ? 188 : HALF_H;

    const cells = useMemo(() => buildHexGrid(R, courtH), [R, courtH]);

    const rowMap = useMemo(() => {
        const m = new Map<number, HexCell[]>();
        cells.forEach(c => {
            if (c.kind === 'rim') return;
            if (!m.has(c.row)) m.set(c.row, []);
            m.get(c.row)!.push(c);
        });
        return m;
    }, [cells]);

    const rimCell = useMemo(() => cells.find(c => c.id === 'rim')!, [cells]);
    const rimFarCell = useMemo(() => cells.find(c => c.id === 'rim_far') ?? null, [cells]);

    const cellZone = useMemo(() => {
        const m = new Map<string, string>();
        for (const c of cells) {
            if (c.kind === 'rim') { m.set(c.id, 'restricted'); continue; }
            // Mirror far-half cells so zone classification uses near-half coords
            const eff_y = fullCourt && c.y > HALF_H ? courtH - c.y : c.y;
            m.set(c.id, classifyFull(c.x, eff_y));
        }
        return m;
    }, [cells, fullCourt, courtH]);

    const shotIndex = useMemo(() => buildShotIndex(cells, shots), [cells, shots]);

    const zoneHeatMap = useMemo(() => {
        if (!zoneOverlays?.length) return null;
        const m = new Map<string, number>();
        for (const o of zoneOverlays) m.set(o.zoneId, o.fgPct);
        return m;
    }, [zoneOverlays]);

    const hoverZone = hoverCell ? cellZone.get(hoverCell.id) : null;

    const zoneSet = useMemo(() => {
        if (!showZoneHL || !hoverZone) return null;
        const s = new Set<string>();
        for (const [id, z] of cellZone) if (z === hoverZone) s.add(id);
        return s;
    }, [showZoneHL, hoverZone, cellZone]);

    const findCell = useCallback((x: number, y: number): HexCell | null => {
        if (Math.hypot(x - rimCell.x, y - rimCell.y) <= 1.6) return rimCell;
        if (rimFarCell && Math.hypot(x - rimFarCell.x, y - rimFarCell.y) <= 1.6) return rimFarCell;
        const dy = 1.5 * R;
        const guessRow = Math.round(y / dy);
        const candidates: HexCell[] = [];
        for (let dr = -2; dr <= 2; dr++) {
            const arr = rowMap.get(guessRow + dr);
            if (arr) candidates.push(...arr);
        }
        return nearestHex(candidates.length ? candidates : cells.filter(c => c.kind !== 'rim'), x, y);
    }, [cells, rowMap, rimCell, rimFarCell, R]);

    const updateHover = useCallback((clientX: number, clientY: number) => {
        if (!svgRef.current) return;
        const { x, y } = svgToApp(svgRef.current, clientX, clientY, courtH);
        if (x < 0 || x > 100 || y < 0 || y > courtH) {
            setHoverCell(null); setHoverPos(null); return;
        }
        const cell = findCell(x, y);
        setHoverCell(prev => prev?.id === cell?.id ? prev : cell);
        setHoverPos({ cx: clientX, cy: clientY });
    }, [findCell, courtH]);

    const handleMove = useCallback((e: React.MouseEvent) => {
        if (!interactive) return;
        pendingPos.current = { x: e.clientX, y: e.clientY };
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const p = pendingPos.current;
            if (p) updateHover(p.x, p.y);
        });
    }, [interactive, updateHover]);

    const handleLeave = useCallback(() => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        setHoverCell(null); setHoverPos(null);
    }, []);

    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (!interactive || !onCourtTap || !svgRef.current) return;
        const { x, y: rawY } = svgToApp(svgRef.current, e.clientX, e.clientY, courtH);
        if (x < 0 || x > 100 || rawY < 0 || rawY > courtH) return;
        const cell = findCell(x, rawY);
        if (!cell) return;
        // Mirror far-half cell coordinates to near-half before passing to scoring logic
        const outY = fullCourt && cell.y > HALF_H ? courtH - cell.y : cell.y;
        onCourtTap(cell.x, outY);
    }, [interactive, onCourtTap, findCell, courtH, fullCourt]);

    const getCellFill = useCallback((cell: HexCell): string => {
        const agg = shotIndex.get(cell.id);
        const z = cellZone.get(cell.id) || 'mid_top';
        if (agg && agg.total > 0) {
            const pct = agg.made / agg.total;
            return pct >= 0.5 ? hexA('#22C55E', 0.75) : hexA('#EF4444', 0.60);
        }
        if (zoneHeatMap) {
            const pct = zoneHeatMap.get(z);
            if (pct !== undefined) {
                const col = pct >= 55 ? '#22C55E' : pct >= 35 ? '#FBBF24' : '#EF4444';
                return hexA(col, 0.20);
            }
        }
        const accent = zoneAccent(z);
        const a = z === 'restricted' ? 0.12 : z.startsWith('three_') ? 0.06 : 0.04;
        return hexA(accent, a);
    }, [shotIndex, cellZone, zoneHeatMap]);

    const baseStrokeOpacity = hexOpacity * 0.5;

    const tipData = useMemo(() => {
        if (!hoverCell || !interactive) return null;
        // Use near-half coordinates for distance calculation
        const eff_y = fullCourt && hoverCell.y > HALF_H ? courtH - hoverCell.y : hoverCell.y;
        const dist = rimDist(hoverCell.x, eff_y);
        const z = cellZone.get(hoverCell.id) || 'mid_top';
        return {
            zone: ZONE_LABELS[z] || z.toUpperCase(),
            dist: `${dist.meters.toFixed(2)}m / ${dist.feet.toFixed(1)}ft`,
            pts: ZONE_PTS[z] || 2,
            zoneKey: z,
        };
    }, [hoverCell, interactive, cellZone, fullCourt, courtH]);

    const madeMode = pendingInfo?.made !== false;
    const pendingColor = madeMode ? '34,197,94' : '239,68,68';

    return (
        <div className={`relative w-full h-full ${className}`}>
            <svg
                ref={svgRef}
                viewBox={`0 0 100 ${courtH}`}
                style={{ width: '100%', height: '100%', display: 'block', cursor: interactive ? 'crosshair' : 'default', userSelect: 'none', touchAction: 'none' }}
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
                onClick={handleClick}
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
                    <clipPath id="ach-clip"><rect x="0" y="0" width="100" height={courtH} /></clipPath>
                    <style>{`
                        @keyframes achPulse {
                            0%  { opacity:0; transform:scale(1.6); }
                            40% { opacity:1; }
                            100%{ opacity:0; transform:scale(1); }
                        }
                        .ach-hex { transition: fill 80ms linear, stroke 80ms linear; }
                    `}</style>
                </defs>

                {/* Background */}
                <rect x="0" y="0" width="100" height={courtH} fill="url(#ach-bg)" />
                <rect x="0" y="0" width="100" height={courtH} fill="url(#ach-grain)" />
                {courtTheme === 'wooden' && <rect x="0" y="0" width="100" height={courtH} fill="url(#ach-planks)" />}

                {/* Hex grid */}
                <g clipPath="url(#ach-clip)">
                    {cells.map(c => {
                        const isRim = c.kind === 'rim';
                        const isHover = hoverCell?.id === c.id;
                        const inZone = zoneSet?.has(c.id) && !isHover;
                        const agg = shotIndex.get(c.id);
                        const hasShot = agg && agg.total > 0;
                        const z = cellZone.get(c.id) || 'mid_top';
                        const cellR = isRim ? RIM_R : HEX_R_ACTUAL;

                        let fill = getCellFill(c);
                        let stroke = isRim ? 'rgba(255,140,0,0.5)' : T.cellStroke;
                        let sw = isRim ? 0.32 : Math.max(0.02, baseStrokeOpacity * 0.4);
                        let dasharray: string | undefined;

                        if (inZone) {
                            if (!hasShot) fill = hexA(zoneAccent(z), 0.20);
                            stroke = hexA(zoneAccent(z), 0.35);
                            sw = 0.10;
                        }

                        if (isHover && interactive) {
                            if (hasShot) {
                                stroke = `rgba(${pendingColor},0.9)`;
                                sw = 0.5;
                            } else {
                                fill = `rgba(${pendingColor},0.38)`;
                                stroke = `rgba(${pendingColor},0.8)`;
                                sw = 0.5;
                            }
                        }

                        if (hasShot && !isHover) {
                            const dominantMade = agg.made >= agg.miss;
                            stroke = T.isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)';
                            sw = 0.18;
                            if (!dominantMade) dasharray = '0.6 0.6';
                        }

                        return (
                            <polygon key={c.id} className="ach-hex"
                                points={hexPoints(c.x, c.y, cellR)}
                                fill={fill} stroke={stroke} strokeWidth={sw}
                                strokeDasharray={dasharray} />
                        );
                    })}

                    {/* Shot count badges (≥2 shots on same hex) */}
                    {[...shotIndex.entries()].map(([cellId, agg]) => {
                        const c = cells.find(x => x.id === cellId);
                        if (!c || agg.total < 2) return null;
                        return (
                            <text key={cellId} x={c.x} y={c.y}
                                textAnchor="middle" dominantBaseline="central"
                                fill={T.isLight ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)'}
                                fontSize={Math.max(2.2, R * 1.0)} fontWeight="800"
                                fontFamily="'JetBrains Mono', monospace"
                                style={{ pointerEvents: 'none' }}>
                                {agg.total}
                            </text>
                        );
                    })}

                    {/* RIM labels */}
                    <text x={rimCell.x} y={rimCell.y + RIM_R + 1.6}
                        textAnchor="middle" dominantBaseline="central"
                        fill={T.rimLabel} fontSize="1.6" fontWeight="900"
                        letterSpacing="0.15em"
                        fontFamily="'Barlow Condensed', sans-serif"
                        pointerEvents="none">RIM</text>
                    {rimFarCell && (
                        <text x={rimFarCell.x} y={rimFarCell.y - RIM_R - 0.5}
                            textAnchor="middle" dominantBaseline="central"
                            fill={T.rimLabel} fontSize="1.6" fontWeight="900"
                            letterSpacing="0.15em"
                            fontFamily="'Barlow Condensed', sans-serif"
                            pointerEvents="none">RIM</text>
                    )}
                </g>

                {/* Line from hovered hex to near rim */}
                {showLineToRim && hoverCell && interactive && (
                    <line
                        x1={hoverCell.x} y1={hoverCell.y}
                        x2={COURT.basketX} y2={COURT.basketY}
                        stroke="rgba(255,255,255,0.25)" strokeWidth="0.4"
                        strokeDasharray="1 1"
                        pointerEvents="none"
                    />
                )}

                {/* Court lines (on top of hex grid) */}
                <CourtLines theme={courtTheme} courtH={courtH} />

                {/* Active edge glow */}
                {activeEdge === 'A' && interactive && (
                    <rect x="0" y="0" width="20" height={courtH} fill="url(#ach-glowA)" pointerEvents="none" />
                )}
                {activeEdge === 'B' && interactive && (
                    <rect x="80" y="0" width="20" height={courtH} fill="url(#ach-glowB)" pointerEvents="none" />
                )}

                {/* Zone label badge near hovered hex */}
                {interactive && hoverCell && tipData && showZoneHL && (() => {
                    const bx = Math.min(Math.max(hoverCell.x + 2, 1), 78);
                    const by = Math.min(Math.max(hoverCell.y - 5.2, 1), courtH - 4);
                    return (
                        <g pointerEvents="none">
                            <rect x={bx} y={by} width="21" height="3.6" rx="0.6"
                                fill={T.isLight ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)'}
                                stroke={zoneAccent(tipData.zoneKey)} strokeWidth="0.18" />
                            <text x={bx + 1} y={by + 2.3}
                                fill={T.isLight ? '#111' : '#FFF'}
                                fontSize="1.7" fontWeight="800" letterSpacing="0.08em"
                                fontFamily="'Barlow Condensed', sans-serif">
                                {tipData.zone}
                            </text>
                        </g>
                    );
                })()}
            </svg>

            {/* Floating distance tooltip */}
            {tipData && interactive && hoverPos && (
                <div className="fixed z-50 pointer-events-none"
                    style={{ left: hoverPos.cx + 16, top: hoverPos.cy - 10 }}>
                    <div className="bg-black/90 border border-zinc-700 rounded px-2.5 py-1.5 text-[11px] font-mono text-white whitespace-nowrap shadow-xl">
                        <div className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">From basket</div>
                        <div className="font-bold tabular-nums">{tipData.dist}</div>
                        <div className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${
                            tipData.pts === 3 ? 'text-amber-400' :
                            tipData.zoneKey === 'restricted' ? 'text-emerald-400' : 'text-blue-400'
                        }`}>{tipData.zone}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdvancedCourtHex;
