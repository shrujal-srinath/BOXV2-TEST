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
    LS_W, LS_H, BX_L, BX_R, BY,
    M_PER_UNIT,
    buildInsidePath, buildOutsidePath,
    hexPath, nearest, distanceToBasket,
} from './CourtGeometry';
import type { HexCell, HexIndex, ShotPoint, CellAgg } from './CourtGeometry';
import {
    heatFill, MADE_COLOR, MISS_COLOR, withAlpha,
    paletteById, type HeatPaletteId, type HexStat,
} from '../../../lib/colorPalettes';
import { ZONE_PRIOR } from '../../../lib/xppa';
import type { ShotZoneId } from '../../shotchart/types/shotTypes';

// ── Drag-to-cancel threshold (CSS pixels) ─────────────────────
const DRAG_CANCEL_PX = 6;

// ── 2pt vs 3pt subtle tints (when no heatmap) ─────────────────
function baseFillFor(zone: ShotZoneId | null, T: CourtPalette): string {
    if (!zone) return 'transparent';
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
    onSelect: (cell: HexCell) => void;
    onHover: (cell: HexCell | null, clientX?: number, clientY?: number) => void;

    showHeat: boolean;
    showRings: boolean;
    palette: HeatPaletteId;
    madeFilter: 'all' | 'made' | 'miss';

    shots: ShotPoint[];
    recentShots: ShotPoint[];

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
    selectedCellId, onSelect, onHover,
    showHeat, showRings, palette, madeFilter,
    shots, recentShots,
    courtPalette: T, reducedMotion, mirror,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const ringRef = useRef<SVGGElement>(null);
    const hoverRef = useRef<SVGGElement>(null);
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
        if (!showHeat) return new Map();
        const m = new Map<string, CellAgg>();
        for (const s of filteredShots) {
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
    }, [showHeat, filteredShots, index]);

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
    const updateHoverGhost = useCallback((cell: HexCell | null) => {
        const g = hoverRef.current;
        if (!g) return;
        if (!cell) {
            g.style.opacity = '0';
            return;
        }
        g.style.opacity = '1';
        g.setAttribute('transform', `translate(${cell.cx} ${cell.cy})`);
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
        onHover(cell, e.clientX, e.clientY);
    }, [clientToLandscape, index, onHover, updateHoverGhost]);

    const flushPendingMove = useCallback(() => {
        rafRef.current = null;
        const p = pendingMoveRef.current;
        pendingMoveRef.current = null;
        if (!p) return;
        const c = clientToLandscape(p.cx, p.cy);
        if (!c) {
            updateHoverGhost(null);
            onHover(null);
            return;
        }
        const cell = nearest(index, c.lx, c.ly);
        updateHoverGhost(cell);
        onHover(cell, p.cx, p.cy);
    }, [clientToLandscape, index, onHover, updateHoverGhost]);

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

        if (!down || down.id !== e.pointerId) return;
        // Drag-to-cancel
        const dx = e.clientX - down.cx;
        const dy = e.clientY - down.cy;
        if (dx * dx + dy * dy > DRAG_CANCEL_PX * DRAG_CANCEL_PX) {
            updateHoverGhost(null);
            onHover(null);
            return;
        }
        const c = clientToLandscape(e.clientX, e.clientY);
        if (!c) return;
        const cell = nearest(index, c.lx, c.ly);
        // Optimistic visual: position the selection ring immediately, no React rerender
        const g = ringRef.current;
        if (g) g.setAttribute('transform', `translate(${cell.cx} ${cell.cy})`);
        onSelect(cell);
    }, [clientToLandscape, index, onSelect, onHover, updateHoverGhost]);

    const handlePointerLeave = useCallback(() => {
        if (pointerDownRef.current) return; // keep tracking during drag
        updateHoverGhost(null);
        onHover(null);
    }, [onHover, updateHoverGhost]);

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

    // ── Render hex cells with arc-split clipping ─────────────
    const renderedHexes = useMemo(() => {
        const out: React.ReactElement[] = [];
        for (const c of cells) {
            if (c.kind === 'rim') {
                // Rim cell: draw a soft accent ring, no zone fill (basket icon already drawn elsewhere)
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
            const stat = cellAggs.get(c.id);

            const renderPiece = (
                clipUrl: 'inside' | 'outside' | null,
                zone: ShotZoneId | null,
                key: string,
            ) => {
                if (!zone) return null;
                let fill: string;
                if (showHeat && stat && stat.attempts > 0) {
                    const prior = ZONE_PRIOR[zone] ?? 0.45;
                    fill = heatFill(stat as HexStat, prior, 3, paletteFn);
                } else {
                    fill = baseFillFor(zone, T);
                }
                return (
                    <path
                        key={key}
                        d={hexPath(c.cx, c.cy, hexR * 0.94)}
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
    }, [cells, hexR, showHeat, cellAggs, paletteFn, T]);

    // ── Recent shot trail ────────────────────────────────────
    const trailDots = useMemo(() => {
        return recentShots.slice(0, 5).map((s, i) => {
            const lx = s.y, ly = s.x;
            const color = s.made ? MADE_COLOR : MISS_COLOR;
            const op = Math.max(0.18, 1 - i * 0.18);
            return (
                <g key={`trail-${i}`} opacity={op} pointerEvents="none">
                    <circle cx={lx} cy={ly} r={1.6}
                        fill={color}
                        stroke="rgba(0,0,0,0.45)" strokeWidth={0.25}
                        className={i === 0 ? (reducedMotion ? 'hx-recent--reduced' : 'hx-recent') : undefined}
                    />
                </g>
            );
        });
    }, [recentShots, reducedMotion]);

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

                {/* Recent shot trail */}
                {trailDots}

                {/* Hover ghost (positioned via ref, hidden by default) */}
                <g ref={hoverRef} pointerEvents="none" style={{ opacity: 0 }}>
                    <path d={hexPath(0, 0, hexR * 0.96)}
                        fill={withAlpha(teamColor, 0.28)}
                        stroke={teamColor}
                        strokeWidth={0.45} />
                </g>

                {/* Selection ring (positioned via ref) */}
                <g ref={ringRef} pointerEvents="none"
                    style={{ display: selectedCellId ? 'block' : 'none' }}>
                    {/* Inner solid fill */}
                    <path d={hexPath(0, 0, hexR * 0.92)}
                        fill={withAlpha(teamColor, 0.7)}
                        stroke={teamColor}
                        strokeWidth={0.6} />
                    {/* Outer halo */}
                    <path d={hexPath(0, 0, hexR * 1.3)}
                        fill="none"
                        stroke={teamColor}
                        strokeWidth={0.45}
                        className={reducedMotion ? 'hx-ring--reduced' : 'hx-ring'} />
                    {/* Center white dot */}
                    <circle cx={0} cy={0} r={0.7} fill="#fff" />
                </g>
            </g>
        </svg>
    );
};

export default React.memo(HexLayer);
