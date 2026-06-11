// src/components/refereebox/court/CourtGeometry.ts
// ═══════════════════════════════════════════════════════════════
// THE BOX — Pure court geometry module
//
// Coordinate system: LANDSCAPE FULL COURT, viewBox 188 × 100
//   lx (x in landscape) = depth from left baseline (0 → 188)
//   ly (y in landscape) = court width (0 → 100, center = 50)
//   Left basket at (10.5, 50); right basket at (177.5, 50)
//   Halfcourt line at lx = 94
//
// Portrait <-> landscape mapping for classifyZone():
//   portY (depth) = min(lx, LS_W - lx)        — distance from the nearer basket
//   portX (width) = ly                         — width (same axis)
// ═══════════════════════════════════════════════════════════════

import { classifyZone, COURT, ZONES } from '../../shotchart/courtZones';
import type { ShotZoneId } from '../../shotchart/types/shotTypes';

// ── Landscape full-court constants ────────────────────────────
export const LS_W = 188;
export const LS_H = 100;
export const HALF = LS_W / 2;

// Basket positions (landscape)
export const BX_L = COURT.basketY;            // 10.5
export const BX_R = LS_W - COURT.basketY;     // 177.5
export const BY   = COURT.basketX;            // 50

// Key geometry
export const PD   = COURT.paintTop;           // 38.67 — paint depth (FT line)
export const PT   = COURT.paintLeft;          // 33.67 — lane top
export const PB   = COURT.paintRight;         // 66.33 — lane bottom
export const FTR  = COURT.ftCircleRadius;     // 12
export const R3   = COURT.threePointRadius;   // 45
export const TX   = COURT.threeCornerMaxY;    // 19.93 — 3pt tangent depth
export const TYT  = COURT.threeCornerX;       // 6 — 3pt corner from top sideline
export const TYB  = LS_H - TYT;               // 94 — bottom corner
export const RA   = COURT.restrictedRadius;   // 8.33
export const BK_X = COURT.backboardY;         // 8 — backboard depth from baseline
export const BK_H = 6;                        // backboard half-height (1.8m / 2 ≈ 6u)
export const CC_R = COURT.centerCircleRadius; // 12

export const LANE_MARKS    = COURT.laneMarks; // [11.67, 17.0, 22.33, 27.67]
export const LANE_MARK_LEN = 1.2;
export const M_PER_UNIT    = 0.15;            // 1 unit = 15cm

// FIBA spec: 7 hash marks per side at 0.4m intervals starting 1.75m from baseline.
// Existing LANE_MARKS covers the 4 wider neutral-zone blocks; LANE_BLOCKS adds
// the full 7-tick FIBA pattern (0.4u = 6cm long, perpendicular to lane edge).
export const LANE_BLOCKS = [11.67, 14.33, 17.0, 19.67, 22.33, 25.0, 27.67];
export const LANE_BLOCK_LEN = 0.6;

// FIBA line width 5cm = 0.33 court units
export const LINE_HEAVY = 0.55;  // visible-bold, used for arc & paint
export const LINE_THIN  = 0.40;  // standard markings
export const LINE_FAINT = 0.32;  // dashed/secondary

// ── Hex cell type ────────────────────────────────────────────
export type HexKind = 'hex' | 'rim';
export interface HexCell {
    id: string;
    row: number;
    col: number;
    cx: number;        // landscape center x
    cy: number;        // landscape center y
    kind: HexKind;
    // Arc-split classification (set by classifyCells)
    split: 'inside' | 'outside' | 'split';
    insideZone: ShotZoneId | null;
    outsideZone: ShotZoneId | null;
    zone: ShotZoneId;  // canonical zone for stats
}

// ── Landscape → portrait coordinate mapping ──────────────────
/** Map landscape (lx, ly) → half-court portrait depth (y in classifyZone). */
export function landscapeToDepth(lx: number): number {
    return Math.min(lx <= HALF ? lx : LS_W - lx, 94);
}

/** Inverse — landscape (lx,ly) → portrait (x,y) tuple for daemon persistence. */
export function landscapeToPortrait(lx: number, ly: number): { portX: number; portY: number } {
    return { portX: ly, portY: landscapeToDepth(lx) };
}

/** Classify a landscape hex's centroid via the portrait zones util. */
export function classifyLandscape(lx: number, ly: number): ShotZoneId {
    return classifyZone(ly, landscapeToDepth(lx));
}

/** Portrait (persisted) → landscape, team-aware. Convention: A shoots on the
 *  left basket, B on the right (same convention as the line-to-rim ruler and
 *  the top team strip). portY is depth from the team's basket; portX is width. */
export function portraitToLandscape(
    portX: number, portY: number, side: 'A' | 'B',
): { lx: number; ly: number } {
    return { lx: side === 'B' ? LS_W - portY : portY, ly: portX };
}

// ── Hex grid generation ───────────────────────────────────────
const SQRT3 = Math.sqrt(3);

/** Generate a pointy-top hex grid covering the full landscape court. */
export function buildHexGrid(R: number): HexCell[] {
    const dx = SQRT3 * R;
    const dy = 1.5 * R;
    const cells: HexCell[] = [];
    const rows = Math.ceil((LS_H + 2 * R) / dy) + 2;
    const cols = Math.ceil((LS_W + 2 * R) / dx) + 2;

    for (let row = 0; row < rows; row++) {
        const cy = -R + row * dy;
        const xOff = (row % 2) * (dx / 2);
        for (let col = 0; col < cols; col++) {
            const cx = -dx / 2 + xOff + col * dx;
            // Cull cells outside the court bounds (small margin so border hexes are clipped)
            if (cx < R * 0.4 || cx > LS_W - R * 0.4) continue;
            if (cy < R * 0.4 || cy > LS_H - R * 0.4) continue;
            // Carve rim holes so the basket icon is unobstructed
            if (Math.hypot(cx - BX_L, cy - BY) < R * 0.75) continue;
            if (Math.hypot(cx - BX_R, cy - BY) < R * 0.75) continue;
            cells.push({
                id: `r${row}c${col}`,
                row, col, cx, cy, kind: 'hex',
                split: 'inside',
                insideZone: 'unlocated',
                outsideZone: null,
                zone: 'unlocated',
            });
        }
    }
    // Synthetic rim cells (tappable, always at_rim)
    cells.push({ id: 'rim_l', row: -1, col: -1, cx: BX_L, cy: BY, kind: 'rim', split: 'inside', insideZone: 'at_rim', outsideZone: null, zone: 'at_rim' });
    cells.push({ id: 'rim_r', row: -1, col: -2, cx: BX_R, cy: BY, kind: 'rim', split: 'inside', insideZone: 'at_rim', outsideZone: null, zone: 'at_rim' });
    return cells;
}

/** Six pointy-top hex vertices around (cx, cy) with radius R. */
export function hexVertices(cx: number, cy: number, R: number): [number, number][] {
    const v: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        v.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    return v;
}

/** SVG path "d" string for a closed pointy-top hex. */
export function hexPath(cx: number, cy: number, R: number): string {
    let s = '';
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        const x = (cx + R * Math.cos(a)).toFixed(3);
        const y = (cy + R * Math.sin(a)).toFixed(3);
        s += (i === 0 ? 'M' : 'L') + x + ',' + y;
    }
    return s + 'Z';
}

// ── Arc-split classification ─────────────────────────────────
/** True if landscape point (lx, ly) is BEYOND the 3pt arc (i.e. in 3pt territory). */
export function isBeyondArc(lx: number, ly: number): boolean {
    // Map to nearest-basket frame
    const isLeft = lx <= HALF;
    const baseX = isLeft ? BX_L : BX_R;
    const yEff  = ly;
    // Corner straight column (FIBA: arc tangent at TX depth)
    const portDepth = isLeft ? lx : LS_W - lx;
    if (portDepth <= TX) {
        // In the corner column — beyond if ly is in the corner stripe
        return yEff <= TYT || yEff >= TYB;
    }
    // Beyond if distance from basket ≥ R3
    return Math.hypot(lx - baseX, yEff - BY) >= R3;
}

/** Classify a hex against the 3pt arc — 'inside', 'outside', or 'split'. */
export function splitHexAtArc(cell: HexCell, hexR: number): 'inside' | 'outside' | 'split' {
    const verts = hexVertices(cell.cx, cell.cy, hexR);
    let inside = 0, outside = 0;
    for (const [vx, vy] of verts) {
        if (isBeyondArc(vx, vy)) outside++; else inside++;
    }
    if (isBeyondArc(cell.cx, cell.cy)) outside++; else inside++;
    if (outside === 0) return 'inside';
    if (inside === 0) return 'outside';
    return 'split';
}

/** Populate insideZone / outsideZone / zone for a freshly-generated cell. */
export function annotateCell(cell: HexCell, hexR: number): void {
    if (cell.kind === 'rim') {
        cell.split = 'inside';
        cell.insideZone = 'at_rim';
        cell.outsideZone = null;
        cell.zone = 'at_rim';
        return;
    }
    const baseZone = classifyLandscape(cell.cx, cell.cy);
    cell.zone = baseZone;
    const split = splitHexAtArc(cell, hexR);
    cell.split = split;
    if (split === 'inside') {
        cell.insideZone = baseZone;
        cell.outsideZone = null;
    } else if (split === 'outside') {
        cell.insideZone = null;
        cell.outsideZone = baseZone;
    } else {
        // Straddles arc — sample inward and outward points to force-classify each side
        const isLeft = cell.cx <= HALF;
        const baseX = isLeft ? BX_L : BX_R;
        const dirX = baseX - cell.cx;
        const dirY = BY - cell.cy;
        const len = Math.hypot(dirX, dirY) || 1;
        const ux = dirX / len, uy = dirY / len;
        // Inside sample (toward basket)
        const pInX = cell.cx + ux * hexR * 1.2;
        const pInY = cell.cy + uy * hexR * 1.2;
        let iz = classifyLandscape(pInX, pInY);
        if (iz.startsWith('three_')) iz = 'mid_top';
        cell.insideZone = iz;
        // Outside sample (away from basket)
        const pOutX = cell.cx - ux * hexR * 1.2;
        const pOutY = cell.cy - uy * hexR * 1.2;
        let oz = classifyLandscape(pOutX, pOutY);
        if (!oz.startsWith('three_')) oz = 'three_top_center';
        cell.outsideZone = oz;
    }
}

/** Build + annotate the full grid in one pass. */
export function buildAndAnnotateGrid(R: number, hexR: number): HexCell[] {
    const cells = buildHexGrid(R);
    for (const c of cells) annotateCell(c, hexR);
    return cells;
}

// ── ClipPath geometry — landscape 2pt / 3pt regions ───────────
/**
 * Build the SVG path-d string covering the 2pt area (inside both 3pt arcs).
 * Used as the clip for "inside" hex fragments.
 */
export function buildInsidePath(): string {
    // Left half 2pt region
    const left = `M 0 ${TYT} L ${TX} ${TYT} A ${R3} ${R3} 0 0 1 ${TX} ${TYB} L 0 ${TYB} Z`;
    // Right half 2pt region (mirrored — sweep flips)
    const right = `M ${LS_W} ${TYT} L ${LS_W - TX} ${TYT} A ${R3} ${R3} 0 0 0 ${LS_W - TX} ${TYB} L ${LS_W} ${TYB} Z`;
    return `${left} ${right}`;
}

/**
 * Build the SVG path-d for the OUTSIDE-of-arc region using even-odd fill rule
 * (full court rect minus the two inside-arc regions).
 */
export function buildOutsidePath(): string {
    const fullRect = `M 0 0 L ${LS_W} 0 L ${LS_W} ${LS_H} L 0 ${LS_H} Z`;
    return `${fullRect} ${buildInsidePath()}`;
}

// ── Spatial index — row-bucket hash ───────────────────────────
export interface HexIndex {
    rimL: HexCell;
    rimR: HexCell;
    rowMap: Map<number, HexCell[]>;
    R: number;
    cells: HexCell[];
}

/** O(N) build, O(1) amortized lookup. Use for hover/tap nearest-cell. */
export function buildSpatialIndex(cells: HexCell[], R: number): HexIndex {
    const rowMap = new Map<number, HexCell[]>();
    let rimL!: HexCell, rimR!: HexCell;
    for (const c of cells) {
        if (c.kind === 'rim') {
            if (c.id === 'rim_l') rimL = c;
            else rimR = c;
            continue;
        }
        const bucket = rowMap.get(c.row);
        if (bucket) bucket.push(c);
        else rowMap.set(c.row, [c]);
    }
    return { rimL, rimR, rowMap, R, cells };
}

/** O(1) amortized nearest-cell lookup. Always returns a cell (may be a rim cell). */
export function nearest(idx: HexIndex, lx: number, ly: number): HexCell {
    // Rim override: snap to at_rim within 1.6 units
    if (Math.hypot(lx - idx.rimL.cx, ly - idx.rimL.cy) <= 1.6) return idx.rimL;
    if (Math.hypot(lx - idx.rimR.cx, ly - idx.rimR.cy) <= 1.6) return idx.rimR;

    const dy = 1.5 * idx.R;
    // Grid row is offset by -R origin in buildHexGrid; recompute guessRow
    const guessRow = Math.round((ly + idx.R) / dy);
    const candidates: HexCell[] = [];
    for (let dr = -2; dr <= 2; dr++) {
        const arr = idx.rowMap.get(guessRow + dr);
        if (arr) candidates.push(...arr);
    }
    if (candidates.length === 0) {
        // Fallback: scan all (shouldn't happen in normal use)
        candidates.push(...idx.cells.filter(c => c.kind === 'hex'));
    }
    let best = candidates[0];
    let bestD = (best.cx - lx) ** 2 + (best.cy - ly) ** 2;
    for (let i = 1; i < candidates.length; i++) {
        const c = candidates[i];
        const d = (c.cx - lx) ** 2 + (c.cy - ly) ** 2;
        if (d < bestD) { bestD = d; best = c; }
    }
    return best;
}

// ── Heatmap aggregation (cell-keyed) ─────────────────────────
export interface CellAgg { made: number; attempts: number }

/** A shot already mapped to LANDSCAPE coords (x = lx depth, y = ly width).
 *  Producers convert from the persisted portrait coords via portraitToLandscape
 *  so team B's shots land on the right basket. */
export interface ShotPoint { x: number; y: number; made: boolean }

/** Aggregate landscape shots into hex cells via the spatial index. */
export function aggregateShotsByCell(
    idx: HexIndex,
    shots: ShotPoint[],
): Map<string, CellAgg> {
    const m = new Map<string, CellAgg>();
    for (const s of shots) {
        const cell = nearest(idx, s.x, s.y);
        const cur = m.get(cell.id);
        if (cur) {
            cur.attempts++;
            if (s.made) cur.made++;
        } else {
            m.set(cell.id, { made: s.made ? 1 : 0, attempts: 1 });
        }
    }
    return m;
}

// ── Quick-spot definitions (re-classified centroids) ─────────
export interface QuickSpot {
    id: string;
    label: string;
    short: string;
    lx: number;            // landscape coords (left half — code mirrors at render time if needed)
    ly: number;
    zone: ShotZoneId;
}

/** Quick-spot centroids. Each is verified against classifyLandscape; module-init
 *  assertion logs warnings if any drift out of spec. */
export const QUICK_SPOTS: QuickSpot[] = [
    { id: 'rim',  label: 'AT RIM',     short: 'RIM',  lx: BX_L,  ly: BY, zone: 'at_rim' },
    { id: 'ft',   label: 'FT LINE',    short: 'FT',   lx: 40,    ly: 50, zone: 'mid_top' },
    { id: 'tok3', label: 'TOP KEY 3',  short: 'TOP3', lx: 56,    ly: 50, zone: 'three_top_center' },
    { id: 'lc3',  label: 'L CORNER 3', short: 'LC3',  lx: 5,     ly: 3,  zone: 'three_corner_left' },
    { id: 'rc3',  label: 'R CORNER 3', short: 'RC3',  lx: 5,     ly: 97, zone: 'three_corner_right' },
    { id: 'lw3',  label: 'L WING 3',   short: 'LW3',  lx: 20,    ly: 5,  zone: 'three_wing_left' },
    { id: 'rw3',  label: 'R WING 3',   short: 'RW3',  lx: 20,    ly: 95, zone: 'three_wing_right' },
];

/** Dev-only assertion: warn if any quick-spot's centroid doesn't classify to its label. */
export function assertQuickSpotZonesInDev(): void {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
    for (const spot of QUICK_SPOTS) {
        const actual = classifyLandscape(spot.lx, spot.ly);
        if (actual !== spot.zone) {
            console.warn(
                `[CourtGeometry] Quick-spot "${spot.label}" centroid (${spot.lx}, ${spot.ly}) ` +
                `classifies as "${actual}" but is labeled "${spot.zone}". Fix centroid.`
            );
        }
    }
}

// Run assertion once at module init (dev-only no-op in production)
assertQuickSpotZonesInDev();

// ── Distance + angle helpers ──────────────────────────────────
/** Distance from (lx, ly) to nearest basket, in meters. */
export function distanceToBasket(lx: number, ly: number): number {
    const dL = Math.hypot(lx - BX_L, ly - BY);
    const dR = Math.hypot(lx - BX_R, ly - BY);
    return Math.min(dL, dR) * M_PER_UNIT;
}

/** Angle (degrees from baseline, 0=along baseline, 90=above rim). */
export function angleFromBaseline(lx: number, ly: number): number {
    const isLeft = lx <= HALF;
    const baseX = isLeft ? BX_L : BX_R;
    // Translate so basket is origin; positive x toward midcourt
    const dx = (isLeft ? lx - baseX : baseX - lx);
    const dy = ly - BY;
    return Math.abs(Math.atan2(dy, dx) * 180 / Math.PI - 0);
}

// ── ZONES re-export so consumers only import from this module ─
export { ZONES, classifyZone };
