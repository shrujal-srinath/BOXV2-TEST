// src/components/refereebox/PiHexCourt.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Interactive Shot Court (v5, production rebuild)
//
// Thin orchestrator. Layout is composed from court/*:
//
//   CourtToolbar           ← top: zone label + HEAT/RINGS/FLIP/THEME
//   ┌──── <svg landscape 188×100> ────┐
//   │  CourtLinesBackground            │  paint, FT, 3pt, restricted, lane marks
//   │  HexLayer (interactive grid)     │  arc-split clipPath rendering
//   │  CourtLinesForeground            │  paint+arc redrawn on top, baskets
//   │  HeatmapLegend (when HEAT on)    │
//   └──────────────────────────────────┘
//   QuickSpotChips         ← bottom: tap shortcuts
//   CourtHud               ← bottom: zone · dist · angle · pts · xPPS · fg%
//
// All settings are local React state (per-popup). Palette + reduced-motion
// preferences are global via colorPalettes hooks.
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ShotZoneId, ShotEvent } from '../shotchart/types/shotTypes';
import {
    buildAndAnnotateGrid, buildSpatialIndex, nearest,
    landscapeToPortrait, portraitToLandscape, classifyLandscape,
    distanceToBasket,
    LS_W, LS_H, HALF, BX_L, BX_R, BY,
} from './court/CourtGeometry';
import type { QuickSpot, HexCell, ShotPoint } from './court/CourtGeometry';
import { COURT_THEMES, type CourtTheme, CourtLinesBackground, CourtLinesForeground } from './court/CourtLines';
import HexLayer from './court/HexLayer';
import ShotMarkersLayer from './court/ShotMarkersLayer';
import CourtHudStrip from './court/CourtHudStrip';
import { type HexSize, type MadeFilter } from './court/CourtToolbar';
import QuickSpotChips from './court/QuickSpotChips';
import { getQuickEntry, getRimAccent, getChevrons } from '../../services/gameControlPrefs';
import HeatmapLegend from './court/HeatmapLegend';
import { useHeatPalette, useReducedMotion } from '../../lib/colorPalettes';

const HEX_RADIUS: Record<HexSize, number> = { S: 2.4, M: 3.2, L: 4.2 };

// ── Props (same interface as v4 — drop-in compatible) ────────
interface PiHexCourtProps {
    teamColor: string;
    onZoneSelect: (zone: ShotZoneId, courtX: number, courtY: number) => void;
    selectedZone: ShotZoneId | null;
    selectedX: number | null;
    selectedY: number | null;
    existingShots?: ShotEvent[];
    /** Zone-lock — disables the geometrically-wrong half. Caller derives from
     *  the score-button points value (e.g. +2 → 'two' locks taps inside arc). */
    lockMode?: 'two' | 'three' | null;
    /** Show a floating "↶ UNDO LAST SHOT" button on the court. Hook fires the
     *  daemon UNDO (which already deletes the most recent shot_events row). */
    onUndoLastShot?: () => void;
    /** Which team is currently scoring. Drives the line-to-rim direction
     *  (A → left basket, B → right basket) and the top team-strip highlight. */
    scoringTeam?: 'A' | 'B';
    teamAName?: string;
    teamBName?: string;
    teamAColor?: string;
    teamBColor?: string;
}

const PiHexCourt: React.FC<PiHexCourtProps> = ({
    teamColor,
    onZoneSelect,
    selectedX,
    selectedY,
    existingShots = [],
    lockMode = null,
    onUndoLastShot,
    scoringTeam,
    teamAName, teamBName,
    teamAColor: teamAColorProp, teamBColor: teamBColorProp,
}) => {
    // ── Settings — read from localStorage (written by the Settings panel) ─
    const lsB = (k: string, d: boolean) => { const v = localStorage.getItem(k); return v === null ? d : v === 'true'; };
    const lsG = (k: string, d: string)  => localStorage.getItem(k) ?? d;

    const [theme]      = useState<CourtTheme>(() => lsG('boxv2-pi-court-theme', 'dark') as CourtTheme);
    const [showHeat]   = useState(() => lsB('boxv2-pi-court-heatmap', false));
    const [showRings]  = useState(() => lsB('boxv2-pi-court-distrings', false));
    const [madeFilter] = useState<MadeFilter>('all');
    const [hexSize]    = useState<HexSize>('M');
    const [quickEntry] = useState(() => getQuickEntry());
    const [rimAccent]  = useState(() => getRimAccent());
    const [chevrons]   = useState(() => getChevrons());
    const [viewMode]   = useState<'hex' | 'zone' | 'dots'>(
        () => (lsG('boxv2-pi-court-viewmode', 'hex') as 'hex' | 'zone' | 'dots'),
    );
    const mirror = false;

    const [hoverLand, setHoverLand] = useState<{ lx: number; ly: number } | null>(null);
    /** Finger position while DOWN (drag-to-adjust) — drives the magnifier loupe. */
    const [dragLand, setDragLand] = useState<{ lx: number; ly: number } | null>(null);
    /** Lock-reject toast — surfaces educational message when the user taps the
     *  disabled half. Auto-dismisses 2.5s after the most recent reject. */
    const [lockReject, setLockReject] = useState<
        { mode: 'two' | 'three'; x: number; y: number; ts: number } | null
    >(null);

    const [palette] = useHeatPalette();
    const reducedMotion = useReducedMotion();

    const T = COURT_THEMES[theme];
    const isLight = theme === 'white';
    const hexR = HEX_RADIUS[hexSize];

    // ── Grid + spatial index (rebuilt only when size changes) ─
    const cells = useMemo(() => buildAndAnnotateGrid(hexR, hexR * 0.94), [hexR]);
    const index = useMemo(() => buildSpatialIndex(cells, hexR), [cells, hexR]);

    // ── Selection — derived from the controlled selectedX/selectedY props ──
    // Mirror to the scoring team's half (B attacks the right basket) so the
    // ring lands where the ref actually tapped. HexLayer additionally positions
    // the ring sub-frame via direct DOM on tap, before this re-derives.
    const selectedCellId = useMemo(() => {
        if (selectedX === null || selectedY === null) return null;
        const { lx, ly } = portraitToLandscape(selectedX, selectedY, scoringTeam ?? 'A');
        return nearest(index, lx, ly).id;
    }, [selectedX, selectedY, index, scoringTeam]);

    // ── Shot data → landscape ShotPoint[] expected by HexLayer ──
    // Persisted coords are portrait (depth from the team's OWN basket), so the
    // mapping is team-aware: A's shots render at the left basket, B's at the right.
    const shots: ShotPoint[] = useMemo(() => {
        return existingShots
            .filter(s =>
                s.shotType === 'field_goal' && s.zone !== 'unlocated' &&
                Number.isFinite(s.x) && Number.isFinite(s.y))
            .map(s => {
                const { lx, ly } = portraitToLandscape(s.x, s.y, s.teamSide);
                return { x: lx, y: ly, made: s.made };
            });
    }, [existingShots]);

    // Most-recent FIELD-GOAL shot id (drives the scale-pop + ripple on
    // ShotMarkersLayer). Filter out free throws so a FT-then-FG sequence
    // doesn't steal the FG's celebratory animation.
    const latestShotId = useMemo<string | null>(() => {
        let latest: typeof existingShots[number] | null = null;
        let latestT = -Infinity;
        for (const s of existingShots) {
            if (s.shotType !== 'field_goal') continue;
            const t = new Date(s.createdAt).getTime();
            if (t > latestT) { latestT = t; latest = s; }
        }
        return latest?.id ?? null;
    }, [existingShots]);

    // ── Lock-reject auto-dismiss (2.5s after most recent reject) ──
    useEffect(() => {
        if (!lockReject) return;
        const t = setTimeout(() => {
            setLockReject(cur => (cur && cur.ts === lockReject.ts ? null : cur));
        }, 2500);
        return () => clearTimeout(t);
    }, [lockReject]);

    const handleLockReject = useCallback((
        mode: 'two' | 'three', screenX: number, screenY: number,
    ) => {
        setLockReject({ mode, x: screenX, y: screenY, ts: Date.now() });
    }, []);

    // ── Handlers ──────────────────────────────────────────────
    // The cell is used only for visual selection (which hex highlights).
    // The persisted coords + classified zone come from the RAW tap (lx, ly),
    // so split-arc hexes classify correctly and we keep precise coordinates
    // for re-binning downstream.
    const handleSelect = useCallback((cell: HexCell, lx: number, ly: number) => {
        // Rim snap: if the tap is within 1.6 units of a basket, treat it as at_rim
        // (mirrors classifyZone's rim test and the existing nearest() override).
        const rimZone = cell.kind === 'rim' ? 'at_rim' : classifyLandscape(lx, ly);
        const { portX, portY } = landscapeToPortrait(lx, ly);
        onZoneSelect(rimZone, portX, portY);
    }, [onZoneSelect]);

    const handleHover = useCallback((
        cell: HexCell | null,
        _clientX?: number, _clientY?: number,
        lx?: number, ly?: number,
    ) => {
        if (cell && lx !== undefined && ly !== undefined) {
            setHoverLand({ lx, ly });
        } else {
            setHoverLand(null);
        }
    }, []);

    const handleDrag = useCallback((lx: number | null, ly: number | null) => {
        setDragLand(lx === null || ly === null ? null : { lx, ly });
    }, []);

    // ── Live tooltip stats (zone/dist/angle/fgPct from raw hover coords) ──
    const liveZone = useMemo(() => {
        if (!hoverLand) return null;
        return classifyLandscape(hoverLand.lx, hoverLand.ly);
    }, [hoverLand]);

    const liveDist = useMemo(() => {
        if (!hoverLand) return null;
        return distanceToBasket(hoverLand.lx, hoverLand.ly);
    }, [hoverLand]);

    const liveFgPct = useMemo(() => {
        if (!liveZone) return null;
        const z = existingShots.filter(s =>
            s.shotType === 'field_goal' && s.zone === liveZone
        );
        if (!z.length) return null;
        return z.filter(s => s.made).length / z.length;
    }, [liveZone, existingShots]);

    const handleSpotTap = useCallback((spot: QuickSpot) => {
        // Spot centroids are declared on the left half — mirror to the scoring
        // team's basket so the selection lands on the half the ref is using.
        // Persistence uses the spot's authoritative location (NOT a cell
        // centroid) so analytics stay aligned with the chip's declared zone;
        // the visual ring re-derives from these coords via selectedCellId.
        const slx = scoringTeam === 'B' ? LS_W - spot.lx : spot.lx;
        const { portX, portY } = landscapeToPortrait(slx, spot.ly);
        onZoneSelect(spot.zone, portX, portY);
    }, [onZoneSelect, scoringTeam]);

    const bottomBarBg = isLight ? 'rgba(232,232,228,0.98)' : 'rgba(5,7,11,0.95)';
    const borderColor = isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.06)';

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            width: '100%', height: '100%',
            position: 'relative', background: T.floor,
        }}>
                {/* ── Court area ── */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {/* Background lines */}
                <svg
                    viewBox={`0 0 ${LS_W} ${LS_H}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                >
                    <g transform={mirror ? `matrix(-1 0 0 -1 ${LS_W} ${LS_H})` : undefined}>
                        <CourtLinesBackground T={T} />
                    </g>
                </svg>

                {/* Interactive hex layer */}
                <HexLayer
                    cells={cells}
                    index={index}
                    hexR={hexR}
                    teamColor={teamColor}
                    selectedCellId={selectedCellId}
                    onSelect={handleSelect}
                    onHover={handleHover}
                    onDrag={handleDrag}
                    showHeat={showHeat}
                    showRings={showRings}
                    palette={palette}
                    madeFilter={madeFilter}
                    viewMode={viewMode}
                    lockMode={lockMode}
                    onLockReject={handleLockReject}
                    rimAccent={rimAccent}
                    shots={shots}
                    dimHalf={scoringTeam === 'A' ? 'right' : scoringTeam === 'B' ? 'left' : null}
                    courtPalette={T}
                    reducedMotion={reducedMotion}
                    mirror={mirror}
                />

                {/* Per-shot event markers — sit above hexes, below foreground lines */}
                {existingShots.length > 0 && (
                    <ShotMarkersLayer
                        shots={existingShots}
                        latestId={latestShotId}
                        reducedMotion={reducedMotion}
                        rippleColor={teamColor}
                    />
                )}

                {/* Line-to-rim — team-aware ruler. Targets the scoring team's
                    designated basket (A → left, B → right). Renders during live
                    hover OR persistent selection, so refs see direction before
                    committing. If they tap on the wrong half, the line cuts
                    diagonally across the court, making the error obvious. */}
                {(() => {
                    // Source: live hover takes priority; fall back to committed selection.
                    let lx: number, ly: number;
                    if (hoverLand) {
                        lx = hoverLand.lx; ly = hoverLand.ly;
                    } else if (selectedX !== null && selectedY !== null) {
                        // Stored coords are portrait — mirror to the scoring team's half.
                        ({ lx, ly } = portraitToLandscape(selectedX, selectedY, scoringTeam ?? 'A'));
                    } else {
                        return null;
                    }
                    // Team's designated basket: A→left, B→right. Without a
                    // scoring team, fall back to the nearest basket.
                    const bx = scoringTeam === 'A' ? BX_L
                        : scoringTeam === 'B' ? BX_R
                        : (lx > HALF ? BX_R : BX_L);
                    const dx = lx - bx, dy = ly - BY;
                    const distM = Math.hypot(dx, dy) * 0.15;
                    const midX = (lx + bx) / 2;
                    const midY = (ly + BY) / 2 - 1.4;
                    // Detect "wrong side" — flag the line in red-ish when the
                    // user is tapping far from the team's basket.
                    const wrongSide = scoringTeam && (
                        (scoringTeam === 'A' && lx > HALF) ||
                        (scoringTeam === 'B' && lx < HALF)
                    );
                    const lineColor = wrongSide ? '#EF4444' : teamColor;
                    return (
                        <svg
                            viewBox={`0 0 ${LS_W} ${LS_H}`}
                            preserveAspectRatio="xMidYMid meet"
                            pointerEvents="none"
                            aria-hidden="true"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                        >
                            <g transform={mirror ? `matrix(-1 0 0 -1 ${LS_W} ${LS_H})` : undefined}>
                                <line
                                    x1={bx} y1={BY} x2={lx} y2={ly}
                                    stroke={lineColor}
                                    strokeWidth={0.35}
                                    strokeDasharray="1.2 1.2"
                                    opacity={0.75}
                                />
                                {/* Origin marker at the team's basket */}
                                <circle cx={bx} cy={BY} r={0.7}
                                    fill="none"
                                    stroke={lineColor}
                                    strokeWidth={0.25}
                                    opacity={0.85}
                                />
                                <g>
                                    <rect
                                        x={midX - 4.5} y={midY - 2.2}
                                        width={9} height={3.4}
                                        rx={0.6}
                                        fill="rgba(0,0,0,0.7)"
                                        stroke={lineColor}
                                        strokeWidth={0.15}
                                    />
                                    <text
                                        x={midX} y={midY + 0.4}
                                        textAnchor="middle"
                                        fontFamily="'JetBrains Mono', monospace"
                                        fontWeight={700}
                                        fontSize={2.2}
                                        fill={lineColor}
                                    >{distM.toFixed(1)} m</text>
                                </g>
                            </g>
                        </svg>
                    );
                })()}

                {/* Foreground lines (paint + arc on top of hexes, baskets) */}
                <svg
                    viewBox={`0 0 ${LS_W} ${LS_H}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                >
                    <g transform={mirror ? `matrix(-1 0 0 -1 ${LS_W} ${LS_H})` : undefined}>
                        <CourtLinesForeground T={T} chevrons={chevrons} />
                        {/* Heatmap legend — visible whenever there's data to encode,
                            not gated on the HEAT toggle. Honors the active palette. */}
                        {(showHeat || existingShots.length > 0) && (
                            <HeatmapLegend palette={palette} x={3} y={92} />
                        )}
                        {/* Scoring-basket beacon — pulsing ring on the active
                            team's basket so the eye lands on the right half
                            before the first tap. Static ring under reduced motion. */}
                        {scoringTeam && (
                            <circle
                                cx={scoringTeam === 'A' ? BX_L : BX_R} cy={BY}
                                r={3.6}
                                fill="none"
                                stroke={teamColor}
                                strokeWidth={0.5}
                                className={reducedMotion ? undefined : 'pi-basket-beacon'}
                                opacity={reducedMotion ? 0.55 : undefined}
                            />
                        )}
                    </g>
                    <style>{`
                        @keyframes piBasketBeacon {
                            0%   { r: 2.4; opacity: 0.85; }
                            70%  { r: 5.4; opacity: 0;    }
                            100% { r: 5.4; opacity: 0;    }
                        }
                        .pi-basket-beacon { animation: piBasketBeacon 1.8s ease-out infinite; }
                    `}</style>
                </svg>

                {/* ── Magnifier loupe ─────────────────────────────────
                    The fingertip hides the exact commit point. While the finger
                    is down (drag-to-adjust), render a 2.4× zoomed circle above
                    it: court lines + nearby shot markers + a crosshair at the
                    exact commit point. Lift to commit what the loupe shows. */}
                {dragLand && (() => {
                    const R = 15, K = 2.4, LIFT = 24;
                    const lx = dragLand.lx, ly = dragLand.ly;
                    const tx = Math.max(R + 1.5, Math.min(LS_W - R - 1.5, lx));
                    // Prefer above the finger; flip below when near the top edge.
                    let ty = ly - LIFT;
                    if (ty < R + 1.5) ty = Math.min(LS_H - R - 1.5, ly + LIFT);
                    return (
                        <svg
                            viewBox={`0 0 ${LS_W} ${LS_H}`}
                            preserveAspectRatio="xMidYMid meet"
                            pointerEvents="none"
                            aria-hidden="true"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                        >
                            <defs>
                                <clipPath id="pi-loupe-clip">
                                    <circle cx={tx} cy={ty} r={R} />
                                </clipPath>
                            </defs>
                            <g clipPath="url(#pi-loupe-clip)">
                                {/* Floor base so the loupe is opaque over hexes/markers */}
                                <rect x={tx - R} y={ty - R} width={2 * R} height={2 * R} fill={T.floor} />
                                {/* Zoomed court content centered on the finger point */}
                                <g transform={`translate(${tx} ${ty}) scale(${K}) translate(${-lx} ${-ly})`}>
                                    <CourtLinesBackground T={T} />
                                    {/* Rims (kept simple — Basket gradients live in the main foreground svg) */}
                                    <circle cx={BX_L} cy={BY} r={1.5} fill="none" stroke={T.rim} strokeWidth={0.45} />
                                    <circle cx={BX_R} cy={BY} r={1.5} fill="none" stroke={T.rim} strokeWidth={0.45} />
                                    {/* Nearby shot markers, simplified */}
                                    {shots.map((s, i) => (
                                        Math.hypot(s.x - lx, s.y - ly) < R ? (
                                            s.made
                                                ? <circle key={i} cx={s.x} cy={s.y} r={0.9} fill="#22C55E" opacity={0.85} />
                                                : <circle key={i} cx={s.x} cy={s.y} r={0.9} fill="none" stroke="#EF4444" strokeWidth={0.35} opacity={0.85} />
                                        ) : null
                                    ))}
                                </g>
                                {/* Crosshair at loupe center = exact commit point */}
                                <line x1={tx - 5} y1={ty} x2={tx - 1.2} y2={ty} stroke={teamColor} strokeWidth={0.35} />
                                <line x1={tx + 1.2} y1={ty} x2={tx + 5} y2={ty} stroke={teamColor} strokeWidth={0.35} />
                                <line x1={tx} y1={ty - 5} x2={tx} y2={ty - 1.2} stroke={teamColor} strokeWidth={0.35} />
                                <line x1={tx} y1={ty + 1.2} x2={tx} y2={ty + 5} stroke={teamColor} strokeWidth={0.35} />
                                <circle cx={tx} cy={ty} r={0.5} fill={teamColor} />
                            </g>
                            {/* Bezel */}
                            <circle cx={tx} cy={ty} r={R}
                                fill="none" stroke={teamColor} strokeWidth={0.55}
                                style={{ filter: `drop-shadow(0 0 2px ${teamColor})` }} />
                            <circle cx={tx} cy={ty} r={R + 0.7}
                                fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={0.7} />
                        </svg>
                    );
                })()}

                {/* Pinned top-right HUD strip — three fields (ZONE/DIST/xPPS),
                    never moves, no jitter. Persistent placeholders so the strip
                    geometry is stable. */}
                <CourtHudStrip
                    zone={liveZone}
                    distMeters={liveDist}
                    fgPct={liveFgPct}
                    teamColor={teamColor}
                />

                {/* Top-center team strip — shows which team is scoring AND on
                    which basket. Removes ambiguity ("am I tapping the right
                    side?"). Scoring team's chip is fully lit in their color;
                    the other team is dim so the eye latches on the live team. */}
                {(teamAName || teamBName) && (
                    <div
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            top: 12, left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 55,
                            display: 'flex', alignItems: 'stretch', gap: 0,
                            background: 'rgba(8,10,14,0.86)',
                            border: '1px solid rgba(255,255,255,0.10)',
                            backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                            pointerEvents: 'none',
                            userSelect: 'none',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10, fontWeight: 700,
                            letterSpacing: '0.18em', textTransform: 'uppercase',
                        }}
                    >
                        <TeamChip
                            name={teamAName ?? 'TEAM A'}
                            color={teamAColorProp ?? '#3B82F6'}
                            active={scoringTeam === 'A'}
                            side="left"
                        />
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '0 8px',
                            fontSize: 8, color: 'rgba(255,255,255,0.4)',
                            letterSpacing: '0.3em',
                        }}>VS</div>
                        <TeamChip
                            name={teamBName ?? 'TEAM B'}
                            color={teamBColorProp ?? '#EF4444'}
                            active={scoringTeam === 'B'}
                            side="right"
                        />
                    </div>
                )}

                {/* Per-attribution undo — wires through to daemon UNDO which
                    deletes the most recent shot row AND reverses the score.
                    Bottom-right corner of the court so it's always reachable
                    without interrupting the attribution flow. */}
                {onUndoLastShot && existingShots.length > 0 && (
                    <button
                        type="button"
                        onClick={onUndoLastShot}
                        style={{
                            position: 'absolute',
                            right: 12, bottom: 12,
                            zIndex: 55,
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px',
                            background: 'rgba(8,10,14,0.86)',
                            border: `1px solid ${teamColor}66`,
                            color: teamColor,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.18em', textTransform: 'uppercase',
                            cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                            backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                            boxShadow: `0 0 12px ${teamColor}22`,
                        }}
                    >
                        ↶ UNDO LAST SHOT
                    </button>
                )}

                {/* Zone-lock educational toast — appears near the rejected tap
                    when the user touches the disabled half. Self-dismisses 2.5s
                    after the most recent reject. */}
                {lockReject && (
                    <div
                        aria-live="polite"
                        style={{
                            position: 'fixed',
                            left: lockReject.x,
                            top: lockReject.y + 28,
                            transform: 'translate(-50%, 0)',
                            zIndex: 65,
                            background: 'rgba(8,10,14,0.94)',
                            border: '1px solid #F59E0B',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.5), 0 0 16px rgba(245,158,11,0.35)',
                            padding: '8px 14px',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: '#F59E0B',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            animation: reducedMotion ? 'none' : 'lockToastIn 160ms ease-out',
                        }}
                    >
                        {lockReject.mode === 'two'
                            ? '+2 PRESSED · TAP INSIDE THE 3-PT LINE'
                            : '+3 PRESSED · TAP OUTSIDE THE 3-PT LINE'}
                    </div>
                )}
                <style>{`
                    @keyframes lockToastIn {
                        from { opacity: 0; transform: translate(-50%, -6px); }
                        to   { opacity: 1; transform: translate(-50%, 0);    }
                    }
                `}</style>
            </div>

            {quickEntry && (
                <QuickSpotChips
                    color={teamColor}
                    onTap={handleSpotTap}
                    isLight={isLight}
                    bottomBarBg={bottomBarBg}
                    borderColor={borderColor}
                />
            )}
        </div>
    );
};

// ── TeamChip — half of the top-center team strip ─────────────
// Active team's chip is fully lit in team color + side arrow ▶/◀ pointing
// toward their basket. Inactive team is dim so the active team pops.
const TeamChip: React.FC<{
    name: string;
    color: string;
    active: boolean;
    side: 'left' | 'right';
}> = ({ name, color, active, side }) => {
    const arrow = side === 'left' ? '◀' : '▶';
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px',
            background: active ? `${color}26` : 'transparent',
            color: active ? color : 'rgba(255,255,255,0.45)',
            boxShadow: active ? `inset 0 -2px 0 ${color}` : 'none',
            minWidth: 120,
            justifyContent: side === 'left' ? 'flex-start' : 'flex-end',
        }}>
            {side === 'left' && <span style={{ fontSize: 11 }}>{arrow}</span>}
            <span style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 140,
            }}>{name}</span>
            {side === 'right' && <span style={{ fontSize: 11 }}>{arrow}</span>}
        </div>
    );
};

export default PiHexCourt;
