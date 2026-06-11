// src/components/refereebox/court/HexLayer.tsx
// ═══════════════════════════════════════════════════════════════
// Interactive hex grid with:
//   • Arc-split clipPath rendering (split hexes are drawn TWICE,
//     each piece clipped to the 2pt vs 3pt half)
//   • Pointer Events pipeline (single pointerdown/move/up flow,
//     no double-fire onClick+onTouchEnd; 6px drag-to-cancel)
//   • RAF-coalesced hover preview
//   • Sub-frame selection feedback via direct-DOM transform on a
//     ref-held ring element (no React reconciliation in hot path)
//   • CSS-only animations (no SMIL, no drop-shadow filter)
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CourtPalette } from './CourtLines';
import {
    LS_W, LS_H, HALF, BX_L, BX_R, BY,
    M_PER_UNIT,
    buildInsidePath, buildOutsidePath,
    hexPath, nearest,
    isBeyondArc,
} from './CourtGeometry';
import type { HexCell, HexIndex, ShotPoint, CellAgg } from './CourtGeometry';
import {
    heatFill, withAlpha,
    paletteById, type HeatPaletteId, type HexStat,
} from '../../../lib/colorPalettes';
import { ZONE_PRIOR } from '../../../lib/xppa';
import type { ShotZoneId } from '../../shotchart/types/shotTypes';
import { getHaptics } from '../../../services/gameControlPrefs';

// Fire a very short vibration. No-op on non-Android tablets.
const haptic = (ms: number | number[]) => {
    try {
        if (typeof navigator !== 'undefined' && navigator.vibrate && getHaptics()) {
            navigator.vibrate(ms);
        }
    } catch { /* no-op */ }
};

// ── 2pt vs 3pt subtle tints (when no heatmap) ─────────────────
// Returns transparent at game start (no shots) so the empty court reads cleanly.
// Tints emerge once data exists; before that the painted court lines carry all
// the 2pt/3pt context.
function baseFillFor(zone: ShotZoneId | null, T: CourtPalette, hasShots: boolean): string {
    if (!zone) return 'transparent';
    if (!hasShots) return 'transparent';
    if (zone.startsWith('three_')) return T.tint3pt;
    if (zone === 'at_rim' || zone === 'restricted') return withAlpha('#E8112D', 0.04);
    if (zone.startsWith('paint_')) return withAlpha('#E8112D', 0.03);
    return T.tint2pt;
}

interface HexLayerProps {
    cells: HexCell[];
    index: HexIndex;
    hexR: number;
    teamColor: string;
    selectedCellId: string | null;
    /** Fires on tap commit. `lx`/`ly` are raw landscape coords of the actual tap
     *  (not the cell centroid) — the call site classifies zone from these. */
    onSelect: (cell: HexCell, lx: number, ly: number) => void;
    /** Fires on hover/drag. `lx`/`ly` (when present) are raw landscape coords —
     *  callers should prefer them over `cell.cx/cy` for tooltip display. */
    onHover: (cell: HexCell | null, clientX?: number, clientY?: number, lx?: number, ly?: number) => void;
    /** Fires while the finger is DOWN and moving (drag-to-adjust), with raw
     *  landscape coords; fires (null, null) on lift/cancel. Drives the
     *  magnifier loupe at the call site. */
    onDrag?: (lx: number | null, ly: number | null) => void;

    showHeat: boolean;
    showRings: boolean;
    palette: HeatPaletteId;
    madeFilter: 'all' | 'made' | 'miss';

    /** 'hex' (per-cell), 'zone' (aggregate to zone, all cells in zone share color),
     *  'dots' (no hex tint at all, markers only). */
    viewMode?: 'hex' | 'zone' | 'dots';

    /** Zone-lock — disables the geometrically-wrong half of the court.
     *  'two' = only inside-arc legal; 'three' = only outside-arc legal; null = no lock. */
    lockMode?: 'two' | 'three' | null;
    /** Fires when the user taps the disabled half. Caller surfaces an educational toast. */
    onLockReject?: (lockMode: 'two' | 'three', screenX: number, screenY: number) => void;
    /** Render the soft accent ring on rim cells. Default false — basket icon
     *  from CourtLines already anchors the rim visually. */
    rimAccent?: boolean;

    /** Field-goal shots in LANDSCAPE coords (x = lx, y = ly), already mirrored
     *  to each team's basket by the caller. */
    shots: ShotPoint[];

    /** Soft-dim the half the scoring team does NOT attack (A → dim right,
     *  B → dim left). Taps stay allowed — the wrong-side red line still warns. */
    dimHalf?: 'left' | 'right' | null;

    courtPalette: CourtPalette;
    reducedMotion: boolean;
    mirror: boolean;
}

// ── Inline keyframes string — scoped to this component ───────
const KEYFRAMES = `
@keyframes hxSelectPulse {
  0%, 100% { opacity: 0.85; }
  50%       { opacity: 0.40; }
}
@keyframes hxRecentPulse {
  0%, 100% { opacity: 1;   r: 1.6; }
  50%       { opacity: 0.5; r: 2.4; }
}
.hx-hex   { transition: fill 90ms linear; }
.hx-ring  { animation: hxSelectPulse 1.6s ease-in-out infinite; }
.hx-ring--reduced { animation: none; opacity: 0.85; }
.hx-recent { animation: hxRecentPulse 1.4s ease-in-out infinite; }
.hx-recent--reduced { animation: none; }
`;

const HexLayer: React.FC<HexLayerProps> = ({
    cells, index, hexR, teamColor,
    selectedCellId, onSelect, onHover, onDrag,
    showHeat, showRings, palette, madeFilter,
    viewMode = 'hex',
    lockMode = null, onLockReject,
    rimAccent = false,
    shots,
    dimHalf = null,
    courtPalette: T, reducedMotion, mirror,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const ringRef = useRef<SVGGElement>(null);
    const hoverRef = useRef<SVGGElement>(null);
    const reticleRef = useRef<SVGGElement>(null);
    const rectRef = useRef<DOMRect | null>(null);
    const pointerDownRef = useRef<{ id: number; cx: number; cy: number } | null>(null);
    const rafRef = useRef<number | null>(null);
    const pendingMoveRef = useRef<{ cx: number; cy: number } | null>(null);

    const paletteFn = useMemo(() => paletteById(palette), [palette]);

    // ── Heatmap aggregation (filtered by made/miss) ──────────
    const filteredShots = useMemo(() => {
        if (madeFilter === 'all') return shots;
        return shots.filter(s => madeFilter === 'made' ? s.made : !s.made);
    }, [shots, madeFilter]);

    const cellAggs: Map<string, CellAgg> = useMemo(() => {
        if (!showHeat || viewMode === 'dots') return new Map();
        const m = new Map<string, CellAgg>();
        for (const s of filteredShots) {
            // ShotPoints arrive in landscape coords (see prop doc) — direct lookup.
            const cell = nearest(index, s.x, s.y);
            const cur = m.get(cell.id);
            if (cur) {
                cur.attempts++;
                if (s.made) cur.made++;
            } else {
                m.set(cell.id, { made: s.made ? 1 : 0, attempts: 1 });
            }
        }
        return m;
    }, [showHeat, viewMode, filteredShots, index]);

    // Zone-level aggregation — used in ZONE view-mode so every cell in the same
    // zone tints to the same color (driven by the zone's overall efficiency).
    const zoneAggs: Map<string, CellAgg> = useMemo(() => {
        if (viewMode !== 'zone' || !showHeat) return new Map();
        const m = new Map<string, CellAgg>();
        for (const s of filteredShots) {
            const cell = nearest(index, s.x, s.y);
            const z = cell.zone;
            const cur = m.get(z);
            if (cur) {
                cur.attempts++;
                if (s.made) cur.made++;
            } else {
                m.set(z, { made: s.made ? 1 : 0, attempts: 1 });
            }
        }
        return m;
    }, [viewMode, showHeat, filteredShots, index]);

    // ── Clip path d-strings (memo: never change at runtime) ──
    const clipInside = useMemo(() => buildInsidePath(), []);
    const clipOutside = useMemo(() => buildOutsidePath(), []);

    // ── Cache bounding rect on mount + resize ────────────────
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const cache = () => { rectRef.current = svg.getBoundingClientRect(); };
        cache();
        const obs = new ResizeObserver(cache);
        obs.observe(svg);
        window.addEventListener('scroll', cache, { passive: true });
        return () => {
            obs.disconnect();
            window.removeEventListener('scroll', cache);
        };
    }, []);

    // ── Convert client coords → landscape coords (accounts for mirror) ─
    const clientToLandscape = useCallback((clientX: number, clientY: number): { lx: number; ly: number } | null => {
        const rect = rectRef.current ?? svgRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const scale = Math.min(rect.width / LS_W, rect.height / LS_H);
        const ox = (rect.width - LS_W * scale) / 2;
        const oy = (rect.height - LS_H * scale) / 2;
        let lx = (clientX - rect.left - ox) / scale;
        let ly = (clientY - rect.top - oy) / scale;
        if (mirror) { lx = LS_W - lx; ly = LS_H - ly; }
        if (lx < 0 || lx > LS_W || ly < 0 || ly > LS_H) return null;
        return { lx, ly };
    }, [mirror]);

    // ── Pointer pipeline ────────────────────────────────────
    // Hover ghost shows the snapped hex while the cursor is hovering WITHOUT
    // pressing. Once pointer-down fires, we hand off to the reticle (sub-frame
    // crosshair at the actual finger) to avoid two competing markers.
    const updateHoverGhost = useCallback((cell: HexCell | null) => {
        const g = hoverRef.current;
        if (!g) return;
        if (!cell || pointerDownRef.current) {
            g.style.opacity = '0';
            return;
        }
        g.style.opacity = '1';
        g.setAttribute('transform', `translate(${cell.cx} ${cell.cy})`);
    }, []);

    // ── Reticle (sub-frame finger tracker, only between down→up) ──
    const updateReticle = useCallback((lx: number | null, ly: number | null) => {
        const g = reticleRef.current;
        if (!g) return;
        if (lx === null || ly === null) {
            g.style.opacity = '0';
            return;
        }
        g.style.opacity = '1';
        g.setAttribute('transform', `translate(${lx} ${ly})`);
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
        // Only handle primary button / single touch
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pointerDownRef.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY };
        const c = clientToLandscape(e.clientX, e.clientY);
        if (!c) return;
        const cell = nearest(index, c.lx, c.ly);
        updateHoverGhost(cell);
        updateReticle(c.lx, c.ly);
        onHover(cell, e.clientX, e.clientY, c.lx, c.ly);
        onDrag?.(c.lx, c.ly);
        haptic(10);
    }, [clientToLandscape, index, onHover, onDrag, updateHoverGhost, updateReticle]);

    const flushPendingMove = useCallback(() => {
        rafRef.current = null;
        const p = pendingMoveRef.current;
        pendingMoveRef.current = null;
        if (!p) return;
        const c = clientToLandscape(p.cx, p.cy);
        if (!c) {
            updateHoverGhost(null);
            updateReticle(null, null);
            onHover(null);
            onDrag?.(null, null);
            return;
        }
        const cell = nearest(index, c.lx, c.ly);
        updateHoverGhost(cell);
        // Reticle + loupe only track while pointer-down (sub-frame finger feedback).
        if (pointerDownRef.current) {
            updateReticle(c.lx, c.ly);
            onDrag?.(c.lx, c.ly);
        }
        onHover(cell, p.cx, p.cy, c.lx, c.ly);
    }, [clientToLandscape, index, onHover, onDrag, updateHoverGhost, updateReticle]);

    const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
        pendingMoveRef.current = { cx: e.clientX, cy: e.clientY };
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(flushPendingMove);
    }, [flushPendingMove]);

    const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
        const down = pointerDownRef.current;
        pointerDownRef.current = null;
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        pendingMoveRef.current = null;
        updateReticle(null, null);
        onDrag?.(null, null);

        if (!down || down.id !== e.pointerId) return;

        // DRAG-TO-ADJUST: any in-bounds release commits at the release position,
        // regardless of how far the finger travelled. Mis-tap correction is now
        // "slide your finger to the right spot then lift" instead of "abort + redo".
        // (Cancellation still happens via pointerleave / pointercancel — outside court.)
        const c = clientToLandscape(e.clientX, e.clientY);
        if (!c) return;

        // ZONE-LOCK: hard reject if the release point is in the geometrically-wrong
        // half. The score button (+2 / +3) is the source of truth; refs must tap
        // the matching court region so persisted shot rows are coherent.
        if (lockMode) {
            const beyond = isBeyondArc(c.lx, c.ly);
            const reject =
                (lockMode === 'two'   && beyond) ||
                (lockMode === 'three' && !beyond);
            if (reject) {
                onLockReject?.(lockMode, e.clientX, e.clientY);
                // Short reject buzz, no commit.
                haptic([0, 14]);
                return;
            }
        }

        const cell = nearest(index, c.lx, c.ly);
        // Optimistic visual: position the selection ring immediately, no React rerender
        const g = ringRef.current;
        if (g) g.setAttribute('transform', `translate(${cell.cx} ${cell.cy})`);
        // Pass the RAW tap coords so the caller can classify zone (2 vs 3, rim, etc.)
        // from the actual finger position rather than the cell centroid.
        onSelect(cell, c.lx, c.ly);
        // Double-buzz "logged" confirmation.
        haptic([0, 8, 40, 12]);
    }, [clientToLandscape, index, lockMode, onLockReject, onSelect, onDrag, updateReticle]);

    const handlePointerLeave = useCallback(() => {
        if (pointerDownRef.current) return; // keep tracking during drag
        updateHoverGhost(null);
        updateReticle(null, null);
        onHover(null);
        onDrag?.(null, null);
    }, [onHover, onDrag, updateHoverGhost, updateReticle]);

    // ── Keep selection ring in sync when controlled selection changes ─
    useEffect(() => {
        const g = ringRef.current;
        if (!g) return;
        if (!selectedCellId) { g.style.display = 'none'; return; }
        const cell = cells.find(c => c.id === selectedCellId);
        if (!cell) { g.style.display = 'none'; return; }
        g.style.display = '';
        g.setAttribute('transform', `translate(${cell.cx} ${cell.cy})`);
    }, [selectedCellId, cells]);

    // ── Mirror transform — applied to court group, not the whole SVG ──
    const courtTransform = mirror
        ? `matrix(-1 0 0 -1 ${LS_W} ${LS_H})`
        : undefined;

    // ── Volume-size scaling (Goldsberry encoding) ──────────────
    // High-attempt hexes render larger; low-attempt hexes are smaller (rather than
    // relying on alpha alone, which fails on dark themes). Anchors to the 90th
    // percentile so a single outlier hex doesn't shrink everything else.
    const p90Attempts = useMemo(() => {
        if (!showHeat || cellAggs.size === 0) return 0;
        const arr: number[] = [];
        cellAggs.forEach(v => arr.push(v.attempts));
        arr.sort((a, b) => a - b);
        return arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.9))] || 0;
    }, [showHeat, cellAggs]);

    // ── Render hex cells with arc-split clipping ─────────────
    const renderedHexes = useMemo(() => {
        const out: React.ReactElement[] = [];
        for (const c of cells) {
            if (c.kind === 'rim') {
                // DOTS mode hides hex/zone tints; the basket icon below carries the rim.
                if (viewMode === 'dots') continue;
                // Rim accent ring — off by default. Basket icon from CourtLines
                // already marks the rim; the extra ring is opt-in clutter.
                if (!rimAccent) continue;
                out.push(
                    <circle
                        key={c.id}
                        cx={c.cx} cy={c.cy} r={hexR * 1.05}
                        fill={withAlpha(T.rim, 0.08)}
                        stroke={withAlpha(T.rim, 0.35)}
                        strokeWidth={0.25}
                        className="hx-hex"
                        data-cell-id={c.id}
                    />
                );
                continue;
            }
            // Volume sizing uses the cell's HEX-view stat (per-cell aggregation).
            // ZONE view doesn't volume-size — all cells in a zone share their
            // zone color and size, so the user reads efficiency-per-zone cleanly.
            const cellStat = cellAggs.get(c.id);
            const useVolumeSizing = showHeat && viewMode === 'hex' && p90Attempts > 0;
            const volFrac = useVolumeSizing && cellStat
                ? Math.min(1, cellStat.attempts / p90Attempts)
                : 1;
            const Reff = (useVolumeSizing ? (0.55 + 0.45 * volFrac) : 1) * hexR * 0.94;

            const renderPiece = (
                clipUrl: 'inside' | 'outside' | null,
                zone: ShotZoneId | null,
                key: string,
            ) => {
                if (!zone) return null;
                // DOTS mode hides hex tints entirely — markers carry the whole story.
                if (viewMode === 'dots') return null;
                // Stat lookup per piece. In ZONE mode each half of a split hex
                // gets its own zone's aggregate stats (insideZone vs outsideZone)
                // so straddling hexes show two colors, not one.
                const stat = viewMode === 'zone'
                    ? zoneAggs.get(zone)
                    : cellStat;
                let fill: string;
                if (showHeat && stat && stat.attempts > 0) {
                    const prior = ZONE_PRIOR[zone] ?? 0.45;
                    fill = heatFill(stat as HexStat, prior, 3, paletteFn);
                } else {
                    fill = baseFillFor(zone, T, shots.length > 0);
                }
                return (
                    <path
                        key={key}
                        d={hexPath(c.cx, c.cy, Reff)}
                        fill={fill}
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth={0.22}
                        clipPath={clipUrl ? `url(#hx-clip-${clipUrl})` : undefined}
                        className="hx-hex"
                        data-cell-id={c.id}
                    />
                );
            };

            if (c.split === 'inside') {
                const piece = renderPiece(null, c.insideZone, c.id);
                if (piece) out.push(piece);
            } else if (c.split === 'outside') {
                const piece = renderPiece(null, c.outsideZone, c.id);
                if (piece) out.push(piece);
            } else {
                // Split — render twice, each piece clipped to its half
                const inside = renderPiece('inside', c.insideZone, `${c.id}-in`);
                const outside = renderPiece('outside', c.outsideZone, `${c.id}-out`);
                if (inside) out.push(inside);
                if (outside) out.push(outside);
            }
        }
        return out;
    }, [cells, hexR, showHeat, viewMode, rimAccent, cellAggs, zoneAggs, p90Attempts, paletteFn, T, shots.length]);

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${LS_W} ${LS_H}`}
            preserveAspectRatio="xMidYMid meet"
            role="application"
            aria-label="Basketball court shot location picker"
            style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', display: 'block',
                touchAction: 'none',
                userSelect: 'none',
                cursor: 'crosshair',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerLeave}
            onPointerLeave={handlePointerLeave}
        >
            <defs>
                <clipPath id="hx-clip-inside"><path d={clipInside} /></clipPath>
                <clipPath id="hx-clip-outside">
                    <path fillRule="evenodd" d={clipOutside} />
                </clipPath>
                <clipPath id="hx-court-clip">
                    <rect x={0} y={0} width={LS_W} height={LS_H} />
                </clipPath>
                <style>{KEYFRAMES}</style>
            </defs>

            <g transform={courtTransform}>
                {/* Hex cells layer — clipped to court */}
                <g clipPath="url(#hx-court-clip)">{renderedHexes}</g>

                {/* Zone-lock dim mask — covers the geometrically-disabled half so
                    the legal area visually pops. Pointer-transparent: rejection
                    still bubbles to the pointer pipeline above and surfaces an
                    educational toast at the call site. */}
                {lockMode === 'two' && (
                    <rect x={0} y={0} width={LS_W} height={LS_H}
                        fill={T.floor} fillOpacity={0.62}
                        clipPath="url(#hx-clip-outside)"
                        pointerEvents="none" />
                )}
                {lockMode === 'three' && (
                    <rect x={0} y={0} width={LS_W} height={LS_H}
                        fill={T.floor} fillOpacity={0.62}
                        clipPath="url(#hx-clip-inside)"
                        pointerEvents="none" />
                )}

                {/* Off-half soft dim — the scoring team attacks ONE basket, so
                    the other half is almost never the right answer. Stacks with
                    the lock masks above: the only fully-bright region is the
                    legal point-zone on the team's own half. Soft (taps allowed)
                    because the wrong-side red ruler already flags mistakes. */}
                {dimHalf && (
                    <rect
                        x={dimHalf === 'left' ? 0 : HALF} y={0}
                        width={HALF} height={LS_H}
                        fill={T.floor} fillOpacity={0.48}
                        pointerEvents="none" />
                )}

                {/* Distance rings overlay (toggleable) */}
                {showRings && (
                    <g pointerEvents="none" stroke="rgba(34,197,94,0.45)" strokeWidth={0.4} strokeDasharray="1.4 1.8" fill="none">
                        {[2, 4, 6, 8].map(m => {
                            const r = m / M_PER_UNIT;
                            return (
                                <g key={m}>
                                    <circle cx={BX_L} cy={BY} r={r} />
                                    <circle cx={BX_R} cy={BY} r={r} />
                                </g>
                            );
                        })}
                    </g>
                )}

                {/* Sub-frame reticle (positioned via ref, only visible between
                    pointerdown and pointerup). Two perpendicular hairlines + a
                    small ring give the user precise visual feedback of exactly
                    where the finger is, sub-frame. White drop-shadow halo so it
                    pops on any floor color (dark, wood, light, A11Y black). */}
                <g
                    ref={reticleRef}
                    pointerEvents="none"
                    style={{ opacity: 0, filter: 'drop-shadow(0 0 0.5px #fff)' }}
                >
                    <line x1={-11} y1={0} x2={11} y2={0}
                        stroke={teamColor} strokeWidth={0.32} opacity={0.55} />
                    <line x1={0} y1={-11} x2={0} y2={11}
                        stroke={teamColor} strokeWidth={0.32} opacity={0.55} />
                    <circle cx={0} cy={0} r={2.2}
                        fill="none" stroke={teamColor} strokeWidth={0.4}
                        opacity={0.85} />
                    <circle cx={0} cy={0} r={0.45} fill={teamColor} />
                </g>

                {/* Hover ghost (positioned via ref, hidden by default) */}
                <g ref={hoverRef} pointerEvents="none" style={{ opacity: 0 }}>
                    <path d={hexPath(0, 0, hexR * 0.96)}
                        fill={withAlpha(teamColor, 0.28)}
                        stroke={teamColor}
                        strokeWidth={0.45} />
                </g>

                {/* Selection ring (positioned via ref)
                    Highlight the whole hex outline — no inner fill, no center dot.
                    Aggregate encoding (the heat hex) stays untouched underneath;
                    this ring just says "this hex is selected" without competing
                    with the per-shot ✕/● markers above. */}
                <g ref={ringRef} pointerEvents="none"
                    style={{ display: selectedCellId ? 'block' : 'none' }}>
                    {/* Subtle inner glow */}
                    <path d={hexPath(0, 0, hexR * 1.0)}
                        fill={withAlpha(teamColor, 0.10)}
                        stroke="none" />
                    {/* Crisp hex outline */}
                    <path d={hexPath(0, 0, hexR * 1.0)}
                        fill="none"
                        stroke={teamColor}
                        strokeWidth={0.55}
                        strokeLinejoin="round"
                        style={{ filter: `drop-shadow(0 0 1.5px ${teamColor})` }} />
                    {/* Outer pulsing halo */}
                    <path d={hexPath(0, 0, hexR * 1.3)}
                        fill="none"
                        stroke={teamColor}
                        strokeWidth={0.45}
                        className={reducedMotion ? 'hx-ring--reduced' : 'hx-ring'} />
                </g>
            </g>
        </svg>
    );
};

export default React.memo(HexLayer);
