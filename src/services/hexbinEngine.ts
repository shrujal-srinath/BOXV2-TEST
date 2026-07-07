// src/services/hexbinEngine.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Hexbin Shot-Chart Engine (Goldsberry-style)
//
// Bins field-goal attempts into a pointy-top hex grid over the PORTRAIT
// half-court (x 0–100 × y 0–94 — the persisted shot_events space) and returns,
// per non-empty bin: volume, efficiency, points-per-attempt, and the delta vs
// the league-prior expectation (lib/xppa.ts). Consumers encode:
//
//   hex SIZE  ← sizeT   (share of the busiest bin — volume)
//   hex COLOR ← fgPct or delta (efficiency, or shot-making vs expectation)
//
// Min-sample gating is built in (Goldsberry rule: tiny samples lie — a 1/1 bin
// is not "100% shooter"). Game-level charts can use minAttempts 1–2; career
// charts should use ≥ 4.
//
// Pure module: no React, no I/O. The pointy-top spacing (dx = √3·R, dy = 1.5·R,
// odd-row half-offset) matches refereebox/court/CourtGeometry's grid so the two
// hex systems tile identically; `hexPath` is re-exported from there for SVG
// consumers. (PLAN-R may later hoist the shared hex primitives into
// shared/court/ — keep the math in sync until then.)
// ─────────────────────────────────────────────────────────────────────────────

import type { ShotEvent, ShotZoneId } from '../components/shotchart/types/shotTypes';
import type { TeamSide } from '../components/stats/types';
import { COURT, classifyZone } from '../components/shotchart/courtZones';
import { ZONE_PRIOR, zonePoints } from '../lib/xppa';

export { hexPath, hexVertices } from '../components/refereebox/court/CourtGeometry';

const SQRT3 = Math.sqrt(3);

// ── types ────────────────────────────────────────────────────────────────────

export interface HexBin {
    /** Bin center in portrait court space (0–100 × 0–94). */
    cx: number;
    cy: number;
    attempts: number;
    made: number;
    /** Made points in this bin (uses each shot's recorded point value). */
    points: number;
    fgPct: number;              // 0–100
    ppa: number;                // points per attempt (actual)
    expPpa: number;             // expected PPA from league priors (per shot, then averaged)
    /** ppa − expPpa. > 0 = shot-making beat the expected value of these looks. */
    delta: number;
    /** attempts / maxAttempts across returned bins — the SIZE encoding (0–1]. */
    sizeT: number;
}

export interface HexbinOptions {
    /** Hex radius in court units (center→vertex). Default 3 ≈ 0.45 m. */
    radius?: number;
    /** Bins with fewer attempts are dropped. Default 1 (game); use ≥4 for career. */
    minAttempts?: number;
    side?: TeamSide;
    playerId?: string;
}

export interface HexbinResult {
    bins: HexBin[];             // sorted by attempts desc
    radius: number;
    minAttempts: number;
    /** Attempts in the busiest returned bin (sizeT denominator); 0 if none. */
    maxAttempts: number;
    /** Located FGAs that entered binning (before min-sample gating). */
    totalAttempts: number;
}

// ── grid math (pointy-top, matches CourtGeometry spacing) ────────────────────

interface GridSpec {
    R: number;
    dx: number;                 // column pitch = √3·R
    dy: number;                 // row pitch = 1.5·R
    cols: number;
}

const gridSpec = (R: number): GridSpec => ({
    R,
    dx: SQRT3 * R,
    dy: 1.5 * R,
    cols: Math.ceil(COURT.width / (SQRT3 * R)) + 2,
});

/** Center of grid cell (row, col). Odd rows shift half a column right. */
const cellCenter = (g: GridSpec, row: number, col: number): { cx: number; cy: number } => ({
    cx: col * g.dx + (row % 2 !== 0 ? g.dx / 2 : 0),
    cy: row * g.dy,
});

/**
 * Nearest hex center to a point. With a pointy-top offset grid the nearest
 * center IS the containing hex (centers form the hex tiling's Voronoi sites),
 * so checking the two candidate rows around y is exact.
 */
const binFor = (g: GridSpec, x: number, y: number): { row: number; col: number } => {
    let best: { row: number; col: number } | null = null;
    let bestD = Infinity;
    const rowGuess = Math.round(y / g.dy);
    for (let row = rowGuess - 1; row <= rowGuess + 1; row++) {
        const xOff = row % 2 !== 0 ? g.dx / 2 : 0;
        const colGuess = Math.round((x - xOff) / g.dx);
        for (let col = colGuess - 1; col <= colGuess + 1; col++) {
            const { cx, cy } = cellCenter(g, row, col);
            const d = (cx - x) ** 2 + (cy - y) ** 2;
            if (d < bestD) { bestD = d; best = { row, col }; }
        }
    }
    return best!;
};

// ── binning ──────────────────────────────────────────────────────────────────

const effectiveZone = (s: ShotEvent): ShotZoneId =>
    s.zone !== 'unlocated' ? classifyZone(s.x, s.y) : s.zone;

/**
 * Build hexbins from shot events. Only LOCATED field-goal attempts participate:
 * free throws, `zone:'unlocated'` rows (their x/y are centroid backfill, not a
 * real location — see shotService), and null-coordinate rows are excluded.
 */
export const buildHexbins = (shots: ShotEvent[], opts: HexbinOptions = {}): HexbinResult => {
    const R = opts.radius ?? 3;
    const minAttempts = opts.minAttempts ?? 1;
    const g = gridSpec(R);

    const located = shots.filter(
        s =>
            s.shotType !== 'free_throw' &&
            s.x != null && s.y != null &&
            s.zone !== 'unlocated' &&
            (!opts.side || s.teamSide === opts.side) &&
            (!opts.playerId || s.playerId === opts.playerId)
    );

    interface Acc { cx: number; cy: number; attempts: number; made: number; points: number; expPts: number }
    const acc = new Map<string, Acc>();

    for (const s of located) {
        // Clamp into court bounds so edge taps land in an edge bin, not off-grid.
        const x = Math.min(COURT.width, Math.max(0, s.x));
        const y = Math.min(COURT.height, Math.max(0, s.y));
        const { row, col } = binFor(g, x, y);
        const key = `${row}:${col}`;
        let a = acc.get(key);
        if (!a) {
            const { cx, cy } = cellCenter(g, row, col);
            a = { cx, cy, attempts: 0, made: 0, points: 0, expPts: 0 };
            acc.set(key, a);
        }
        a.attempts += 1;
        const zone = effectiveZone(s);
        a.expPts += ZONE_PRIOR[zone] * zonePoints(zone);
        if (s.made) {
            a.made += 1;
            a.points += s.points;
        }
    }

    const kept = Array.from(acc.values()).filter(a => a.attempts >= minAttempts);
    const maxAttempts = kept.reduce((m, a) => Math.max(m, a.attempts), 0);

    const bins: HexBin[] = kept
        .map(a => {
            const ppa = a.points / a.attempts;
            const expPpa = a.expPts / a.attempts;
            return {
                cx: a.cx,
                cy: a.cy,
                attempts: a.attempts,
                made: a.made,
                points: a.points,
                fgPct: (a.made / a.attempts) * 100,
                ppa,
                expPpa,
                delta: ppa - expPpa,
                sizeT: maxAttempts > 0 ? a.attempts / maxAttempts : 0,
            };
        })
        .sort((p, q) => q.attempts - p.attempts);

    return { bins, radius: R, minAttempts, maxAttempts, totalAttempts: located.length };
};
