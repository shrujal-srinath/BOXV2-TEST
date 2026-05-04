// THE BOX — Court Hex Map v2
// Honeycomb of pointy-top hexagons covering a half- or full-court SVG.
// Half court: viewBox 0 0 100 94. Full court: 0 0 100 188 (mirrored).
// 1u = 0.15m. Origin = baseline-left.

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { COURT, classifyZone } from './courtZones';

const SQRT3 = Math.sqrt(3);
const M_PER_UNIT = 0.15;
const HALF_H = 94;
const FULL_H = 188;

// ── Local zone type (extends with at_rim) ────────────────────────────────────

export type HexZoneId =
  | 'at_rim'
  | 'restricted'
  | 'paint_left'
  | 'paint_right'
  | 'mid_baseline_left'
  | 'mid_baseline_right'
  | 'mid_elbow_left'
  | 'mid_elbow_right'
  | 'mid_top'
  | 'three_corner_left'
  | 'three_corner_right'
  | 'three_wing_left'
  | 'three_wing_right'
  | 'three_top_left'
  | 'three_top_right'
  | 'three_top_center';

export const ZONE_META: Record<HexZoneId, { label: string; short: string; pts: 2 | 3 }> = {
  at_rim:             { label: 'At Rim / Dunk',    short: 'RIM', pts: 2 },
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

export function zoneAccent(zoneId: HexZoneId | string): string {
  if (zoneId === 'at_rim')   return '#FF8C00';
  if (zoneId === 'restricted') return '#22C55E';
  if (zoneId === 'paint_left' || zoneId === 'paint_right') return '#84CC16';
  if (zoneId && zoneId.startsWith('three_')) return '#3B82F6';
  return '#F59E0B';
}

// ── Themes ───────────────────────────────────────────────────────────────────

export type CourtTheme = 'dark' | 'wooden' | 'white';

interface ThemeDef {
  bgFrom: string; bgTo: string;
  line1: string; line2: string; line3: string;
  paintFill: string; grain: string;
  cellBase: string; cellStroke: string;
  rimLabel: string;
  isLight: boolean;
}

export const THEMES: Record<CourtTheme, ThemeDef> = {
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

// ── Types ────────────────────────────────────────────────────────────────────

export interface HexCell {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  kind: 'hex' | 'rim';
}

export interface HexShotEvent {
  id: string;
  cellId: string;
  x: number;
  y: number;
  zone: HexZoneId;
  made: boolean;
  points: number;
  distM: number;
  shotType: string | null;
  playerNum: string | null;
  ts: number;
}

export interface HoverInfo {
  cell: HexCell;
  x: number;
  y: number;
  cursorX: number;
  cursorY: number;
  dist: { units: number; meters: number; feet: number };
  zone: HexZoneId;
}

export interface CourtTweaks {
  hexRadius: number;
  tintByZone: boolean;
  theme: CourtTheme;
  fullCourt: boolean;
  showZoneHL: boolean;
  showLineToRim: boolean;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

function buildHexGrid(R: number, courtH: number): HexCell[] {
  const dx = SQRT3 * R;
  const dy = 1.5 * R;
  const cells: HexCell[] = [];
  const yMin = -R, yMax = courtH + R;
  const rRows = Math.ceil((yMax - yMin) / dy) + 2;
  const rCols = Math.ceil((COURT.width + 2 * R) / dx) + 2;

  for (let row = 0; row < rRows; row++) {
    const y = yMin + row * dy;
    const xOff = (row % 2 === 0) ? 0 : dx / 2;
    for (let col = 0; col < rCols; col++) {
      const x = -R + xOff + col * dx;
      if (x < -R * 0.4 || x > COURT.width + R * 0.4) continue;
      if (y < -R * 0.4 || y > courtH + R * 0.4) continue;
      const dRim1 = Math.hypot(x - COURT.basketX, y - COURT.basketY);
      if (dRim1 < R * 0.85) continue;
      if (courtH > 100) {
        const dRim2 = Math.hypot(x - COURT.basketX, y - (courtH - COURT.basketY));
        if (dRim2 < R * 0.85) continue;
      }
      cells.push({ id: `r${row}c${col}`, row, col, x, y, kind: 'hex' });
    }
  }

  cells.push({ id: 'rim', row: -1, col: -1, x: COURT.basketX, y: COURT.basketY, kind: 'rim' });
  if (courtH > 100) {
    cells.push({ id: 'rim2', row: -1, col: -2, x: COURT.basketX, y: courtH - COURT.basketY, kind: 'rim' });
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

function rimDistance(x: number, y: number, courtH: number) {
  const d1 = Math.hypot(x - COURT.basketX, y - COURT.basketY);
  let du = d1;
  if (courtH > 100) {
    const d2 = Math.hypot(x - COURT.basketX, y - (courtH - COURT.basketY));
    du = Math.min(d1, d2);
  }
  const m = du * M_PER_UNIT;
  return { units: du, meters: m, feet: m * 3.28084 };
}

function svgToCourt(svgEl: SVGSVGElement, clientX: number, clientY: number, courtH: number) {
  const r = svgEl.getBoundingClientRect();
  return {
    x: (clientX - r.left) * (100 / r.width),
    y: (clientY - r.top) * (courtH / r.height),
  };
}

function nearestHex(cells: HexCell[], x: number, y: number): HexCell | null {
  let best: HexCell | null = null;
  let bestD = Infinity;
  for (const c of cells) {
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function hexA(hex: string, a: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

function classifyZoneFull(x: number, y: number, courtH: number): HexZoneId {
  let cx = x, cy = y;
  if (courtH > 100 && y > courtH / 2) { cy = courtH - y; }
  const dx = cx - COURT.basketX;
  const dy2 = cy - COURT.basketY;
  if (Math.sqrt(dx * dx + dy2 * dy2) <= 1.6) return 'at_rim';
  return classifyZone(cx, cy) as HexZoneId;
}

function fgPctColor(made: number, total: number): { base: string; alpha: number } | null {
  if (!total) return null;
  const pct = (made / total) * 100;
  const base = pct >= 60 ? '#22C55E' : pct >= 40 ? '#F59E0B' : '#EF4444';
  const alpha = Math.min(0.75, 0.20 + total * 0.11);
  return { base, alpha };
}

function buildShotIndex(shots: HexShotEvent[]) {
  const idx = new Map<string, { made: number; miss: number; total: number; lastTs: number }>();
  for (const s of shots) {
    let agg = idx.get(s.cellId);
    if (!agg) { agg = { made: 0, miss: 0, total: 0, lastTs: 0 }; idx.set(s.cellId, agg); }
    agg.total++;
    if (s.made) agg.made++; else agg.miss++;
    if (s.ts > agg.lastTs) agg.lastTs = s.ts;
  }
  return idx;
}

// ── Court markings ───────────────────────────────────────────────────────────

interface HoopProps { flipY?: string; theme: CourtTheme }

function HoopMarkings({ flipY, theme }: HoopProps) {
  const T = THEMES[theme];
  const C = COURT;
  const tanY = C.threeCornerMaxY;
  const threePt = `M ${C.threeCornerX} 0 L ${C.threeCornerX} ${tanY.toFixed(2)} A ${C.threePointRadius} ${C.threePointRadius} 0 0 0 ${100 - C.threeCornerX} ${tanY.toFixed(2)} L ${100 - C.threeCornerX} 0`;
  const nc = `M ${C.basketX - C.restrictedRadius} ${C.basketY} A ${C.restrictedRadius} ${C.restrictedRadius} 0 0 0 ${C.basketX + C.restrictedRadius} ${C.basketY}`;
  const ftS = `M ${C.basketX - C.ftCircleRadius} ${C.paintTop} A ${C.ftCircleRadius} ${C.ftCircleRadius} 0 0 1 ${C.basketX + C.ftCircleRadius} ${C.paintTop}`;
  const ftD = `M ${C.basketX - C.ftCircleRadius} ${C.paintTop} A ${C.ftCircleRadius} ${C.ftCircleRadius} 0 0 0 ${C.basketX + C.ftCircleRadius} ${C.paintTop}`;

  return (
    <g fill="none" pointerEvents="none" transform={flipY}>
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

interface CourtLinesProps { theme: CourtTheme; fullCourt: boolean }

function CourtLines({ theme, fullCourt }: CourtLinesProps) {
  const T = THEMES[theme];
  const C = COURT;
  const courtH = fullCourt ? FULL_H : HALF_H;
  return (
    <g fill="none" pointerEvents="none">
      <rect x="0" y="0" width="100" height={courtH} stroke={T.line1} strokeWidth="0.6" />
      {fullCourt ? (
        <>
          <line x1="0" y1="94" x2="100" y2="94" stroke={T.line1} strokeWidth="0.5" />
          <circle cx={C.basketX} cy="94" r={C.centerCircleRadius} stroke={T.line2} strokeWidth="0.4" />
          <circle cx={C.basketX} cy="94" r="2" stroke={T.line3} strokeWidth="0.3" />
        </>
      ) : (
        <path d={`M ${C.basketX - C.centerCircleRadius} 94 A ${C.centerCircleRadius} ${C.centerCircleRadius} 0 0 1 ${C.basketX + C.centerCircleRadius} 94`} stroke={T.line3} strokeWidth="0.4" />
      )}
      <HoopMarkings theme={theme} />
      {fullCourt && <HoopMarkings theme={theme} flipY={`matrix(1 0 0 -1 0 ${courtH})`} />}
    </g>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface CourtHexMapProps {
  tweaks: CourtTweaks;
  onHoverChange: (info: HoverInfo | null) => void;
  shots: HexShotEvent[];
  setShots: React.Dispatch<React.SetStateAction<HexShotEvent[]>>;
  mode: 'made' | 'miss';
  jersey: string;
}

export function CourtHexMap({ tweaks, onHoverChange, shots, setShots, mode, jersey }: CourtHexMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);

  const theme = tweaks.theme || 'dark';
  const T = THEMES[theme];
  const fullCourt = !!tweaks.fullCourt;
  const courtH = fullCourt ? FULL_H : HALF_H;
  const showZoneHL = tweaks.showZoneHL !== false;
  const tintByZone = !!tweaks.tintByZone;

  const cells = useMemo(() => buildHexGrid(tweaks.hexRadius, courtH), [tweaks.hexRadius, courtH]);

  const rowMap = useMemo(() => {
    const m = new Map<number, HexCell[]>();
    cells.forEach(c => {
      if (c.kind === 'rim') return;
      if (!m.has(c.row)) m.set(c.row, []);
      m.get(c.row)!.push(c);
    });
    return m;
  }, [cells]);

  const rimCells = useMemo(() => cells.filter(c => c.kind === 'rim'), [cells]);
  const shotIndex = useMemo(() => buildShotIndex(shots), [shots]);

  const cellZone = useMemo(() => {
    const m = new Map<string, HexZoneId>();
    for (const c of cells) {
      m.set(c.id, c.kind === 'rim' ? 'at_rim' : classifyZoneFull(c.x, c.y, courtH));
    }
    return m;
  }, [cells, courtH]);

  const findCell = useCallback((x: number, y: number): HexCell | null => {
    for (const r of rimCells) {
      if (Math.hypot(x - r.x, y - r.y) <= 1.6) return r;
    }
    const dy = 1.5 * tweaks.hexRadius;
    const guessRow = Math.round(y / dy);
    const candidates: HexCell[] = [];
    for (let dr = -2; dr <= 2; dr++) {
      const arr = rowMap.get(guessRow + dr);
      if (arr) candidates.push(...arr);
    }
    return nearestHex(candidates.length ? candidates : cells.filter(c => c.kind !== 'rim'), x, y);
  }, [cells, rowMap, rimCells, tweaks.hexRadius]);

  const updateHoverNow = useCallback((cx: number, cy: number) => {
    if (!svgRef.current) return;
    const { x, y } = svgToCourt(svgRef.current, cx, cy, courtH);
    if (x < 0 || x > 100 || y < 0 || y > courtH) {
      setHover(null); onHoverChange(null); return;
    }
    const cell = findCell(x, y);
    if (!cell) return;
    const dist = rimDistance(cell.x, cell.y, courtH);
    const zone = cellZone.get(cell.id) || 'mid_top';
    const info: HoverInfo = { cell, x: cell.x, y: cell.y, cursorX: x, cursorY: y, dist, zone };
    setHover(prev => (prev && prev.cell.id === cell.id ? prev : info));
    onHoverChange(info);
  }, [findCell, onHoverChange, courtH, cellZone]);

  const handleMove = useCallback((e: React.MouseEvent) => {
    pendingRef.current = { x: e.clientX, y: e.clientY };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const p = pendingRef.current;
      if (p) updateHoverNow(p.x, p.y);
    });
  }, [updateHoverNow]);

  const handleLeave = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setHover(null); onHoverChange(null);
  }, [onHoverChange]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const logShotAt = useCallback((cx: number, cy: number) => {
    if (!svgRef.current) return;
    const { x, y } = svgToCourt(svgRef.current, cx, cy, courtH);
    if (x < 0 || x > 100 || y < 0 || y > courtH) return;
    const cell = findCell(x, y);
    if (!cell) return;
    const zone = cellZone.get(cell.id) || 'mid_top';
    const dist = rimDistance(cell.x, cell.y, courtH);
    const made = mode === 'made';
    const pts = ZONE_META[zone]?.pts || 2;
    let shotType: string | null = null;
    if (zone === 'at_rim') shotType = 'DUNK';
    else if (zone === 'restricted') shotType = 'LAYUP';

    setShots(prev => [...prev, {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      cellId: cell.id, x: cell.x, y: cell.y,
      zone, made, points: pts,
      distM: dist.meters, shotType,
      playerNum: jersey || null,
      ts: Date.now(),
    }]);
    setPulseId(cell.id);
    setTimeout(() => setPulseId(null), 700);
  }, [findCell, mode, setShots, jersey, courtH, cellZone]);

  const handleClick = useCallback((e: React.MouseEvent) => logShotAt(e.clientX, e.clientY), [logShotAt]);

  const cellFill = useCallback((cell: HexCell): string => {
    const agg = shotIndex.get(cell.id);
    if (tintByZone && agg && agg.total > 0) {
      const fg = fgPctColor(agg.made, agg.total);
      if (fg) return hexA(fg.base, fg.alpha);
    }
    if (agg && agg.total > 0) {
      const pct = agg.made / agg.total;
      return pct >= 0.5 ? hexA('#22C55E', 0.7) : hexA('#EF4444', 0.55);
    }
    if (tintByZone) {
      const z = cellZone.get(cell.id) || 'mid_top';
      const base = zoneAccent(z);
      const a = z === 'at_rim' ? 0.20 : z.startsWith('three_') ? 0.06 : (z === 'restricted' ? 0.12 : 0.05);
      return hexA(base, a);
    }
    return cell.kind === 'rim' ? hexA('#FF8C00', 0.18) : T.cellBase;
  }, [shotIndex, tintByZone, cellZone, T.cellBase]);

  const RIM_R = tweaks.hexRadius * 1.25;
  const HEX_R = tweaks.hexRadius * 0.95;

  const hoverZone = hover ? hover.zone : null;
  const zoneIds = useMemo(() => {
    if (!showZoneHL || !hoverZone) return null;
    const set = new Set<string>();
    for (const [id, z] of cellZone) if (z === hoverZone) set.add(id);
    return set;
  }, [showZoneHL, hoverZone, cellZone]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 100 ${courtH}`}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair', userSelect: 'none', touchAction: 'none' }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="chm-bg" cx="50%" cy="20%" r="80%">
          <stop offset="0%" stopColor={T.bgFrom} />
          <stop offset="100%" stopColor={T.bgTo} />
        </radialGradient>
        <pattern id="chm-grain" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="rgba(255,255,255,0)" />
          <circle cx="1" cy="1" r="0.05" fill={T.grain} />
          <circle cx="3.5" cy="4" r="0.05" fill={T.grain} />
          <circle cx="5" cy="2" r="0.05" fill={T.grain} />
        </pattern>
        {theme === 'wooden' && (
          <pattern id="chm-planks" x="0" y="0" width="100" height="6" patternUnits="userSpaceOnUse">
            <rect width="100" height="6" fill="rgba(0,0,0,0)" />
            <line x1="0" y1="0" x2="100" y2="0" stroke="rgba(60,30,5,0.18)" strokeWidth="0.08" />
          </pattern>
        )}
        <clipPath id="chm-clip"><rect x="0" y="0" width="100" height={courtH} /></clipPath>
        <style>{`
          @keyframes chmHexPulse {
            0% { opacity: 0; transform: scale(1.6); }
            40% { opacity: 1; }
            100% { opacity: 0; transform: scale(1); }
          }
          .chm-pulse { animation: chmHexPulse 0.7s ease-out forwards; transform-origin: center; transform-box: fill-box; }
          .chm-hex { transition: fill 90ms linear, stroke 90ms linear, stroke-width 90ms linear; }
        `}</style>
      </defs>

      <rect x="0" y="0" width="100" height={courtH} fill="url(#chm-bg)" />
      <rect x="0" y="0" width="100" height={courtH} fill="url(#chm-grain)" />
      {theme === 'wooden' && <rect x="0" y="0" width="100" height={courtH} fill="url(#chm-planks)" />}

      <g clipPath="url(#chm-clip)">
        {cells.map(c => {
          const isRim = c.kind === 'rim';
          const isHover = hover && hover.cell.id === c.id;
          const inHoverZone = zoneIds && zoneIds.has(c.id);
          const agg = shotIndex.get(c.id);
          const hasShot = agg && agg.total > 0;
          const dominantMade = hasShot && agg.made >= agg.miss;
          const z = cellZone.get(c.id) || 'mid_top';

          let fill = cellFill(c);
          let stroke = isRim ? '#FF8C00' : T.cellStroke;
          let sw = isRim ? 0.32 : 0.06;
          let dasharray: string | undefined;

          if (inHoverZone && !isHover) {
            if (!hasShot) fill = hexA(zoneAccent(z), tintByZone ? 0.28 : 0.22);
            stroke = hexA(zoneAccent(z), 0.35);
            sw = 0.10;
          }

          if (isHover) {
            stroke = zoneAccent(z);
            sw = 0.5;
            if (!hasShot) fill = hexA(stroke, 0.65);
          }

          if (hasShot) {
            stroke = T.isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)';
            sw = 0.18;
            if (!dominantMade) dasharray = '0.6 0.6';
            if (isHover) sw = 0.4;
          }

          const R = isRim ? RIM_R : HEX_R;
          return (
            <polygon key={c.id} className="chm-hex"
              points={hexPoints(c.x, c.y, R)}
              fill={fill} stroke={stroke} strokeWidth={sw}
              strokeDasharray={dasharray} />
          );
        })}

        {pulseId && (() => {
          const c = cells.find(x => x.id === pulseId);
          if (!c) return null;
          const accent = mode === 'made' ? '#22C55E' : '#EF4444';
          return (
            <polygon className="chm-pulse"
              points={hexPoints(c.x, c.y, (c.kind === 'rim' ? RIM_R : HEX_R) * 1.5)}
              fill="none" stroke={accent} strokeWidth="0.6" />
          );
        })()}

        {[...shotIndex.entries()].map(([cellId, agg]) => {
          const c = cells.find(x => x.id === cellId);
          if (!c || agg.total < 2) return null;
          const fontSize = Math.max(2.2, tweaks.hexRadius * 1.05);
          return (
            <text key={cellId} x={c.x} y={c.y}
              textAnchor="middle" dominantBaseline="central"
              fill={T.isLight ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)'}
              fontSize={fontSize} fontWeight="800"
              fontFamily="'JetBrains Mono', monospace"
              style={{ pointerEvents: 'none' }}>
              {agg.total}
            </text>
          );
        })}

        {rimCells.map(rc => (
          <text key={rc.id}
            x={rc.x} y={rc.y + (rc.id === 'rim2' ? -RIM_R - 1.6 : RIM_R + 1.6)}
            textAnchor="middle" dominantBaseline="central"
            fill={T.rimLabel}
            fontSize="1.6" fontWeight="900"
            letterSpacing="0.15em"
            fontFamily="'Barlow Condensed', sans-serif"
            pointerEvents="none">
            RIM
          </text>
        ))}
      </g>

      <CourtLines theme={theme} fullCourt={fullCourt} />

      {showZoneHL && hover && (
        <g pointerEvents="none">
          <rect
            x={Math.min(Math.max(hover.cursorX + 2, 1), 78)}
            y={Math.min(Math.max(hover.cursorY - 5.2, 1), courtH - 4)}
            width="20" height="3.6" rx="0.6"
            fill={T.isLight ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)'}
            stroke={zoneAccent(hover.zone)} strokeWidth="0.18" />
          <text
            x={Math.min(Math.max(hover.cursorX + 2, 1), 78) + 1}
            y={Math.min(Math.max(hover.cursorY - 5.2, 1), courtH - 4) + 2.3}
            fill={T.isLight ? '#111' : '#FFF'}
            fontSize="1.7" fontWeight="800"
            letterSpacing="0.08em"
            fontFamily="'Barlow Condensed', sans-serif">
            {(ZONE_META[hover.zone]?.label || hover.zone).toUpperCase()}
          </text>
        </g>
      )}
    </svg>
  );
}
