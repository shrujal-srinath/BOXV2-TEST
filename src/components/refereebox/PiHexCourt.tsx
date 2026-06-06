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
import { ZONES } from '../shotchart/courtZones';
import {
    buildAndAnnotateGrid, buildSpatialIndex,
    distanceToBasket, angleFromBaseline,
    QUICK_SPOTS,
    landscapeToPortrait,
    LS_W, LS_H,
} from './court/CourtGeometry';
import type { QuickSpot, HexCell, ShotPoint } from './court/CourtGeometry';
import { COURT_THEMES, type CourtTheme, CourtLinesBackground, CourtLinesForeground } from './court/CourtLines';
import HexLayer from './court/HexLayer';
import CourtToolbar, { type HexSize, type MadeFilter } from './court/CourtToolbar';
import CourtHud from './court/CourtHud';
import QuickSpotChips from './court/QuickSpotChips';
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
}

const PiHexCourt: React.FC<PiHexCourtProps> = ({
    teamColor,
    onZoneSelect,
    selectedZone,
    selectedX,
    selectedY,
    existingShots = [],
}) => {
    // ── Local UI state ────────────────────────────────────────
    const [theme, setTheme]           = useState<CourtTheme>('dark');
    const [hexSize, setHexSize]       = useState<HexSize>('M');
    const [showHeat, setShowHeat]     = useState(false);
    const [showRings, setShowRings]   = useState(false);
    const [mirror, setMirror]         = useState(false);
    const [madeFilter, setMadeFilter] = useState<MadeFilter>('all');
    const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
    const [hoverScreen, setHoverScreen] = useState<{ x: number; y: number } | null>(null);
    const [hoverCellId, setHoverCellId] = useState<string | null>(null);

    const [palette] = useHeatPalette();
    const reducedMotion = useReducedMotion();

    const T = COURT_THEMES[theme];
    const isLight = theme === 'white';
    const hexR = HEX_RADIUS[hexSize];

    // ── Grid + spatial index (rebuilt only when size changes) ─
    const cells = useMemo(() => buildAndAnnotateGrid(hexR, hexR * 0.94), [hexR]);
    const index = useMemo(() => buildSpatialIndex(cells, hexR), [cells, hexR]);

    // ── Selection ↔ external props sync ───────────────────────
    // When selectedX/selectedY change externally (e.g. parent reset), find the matching cell.
    useEffect(() => {
        if (selectedX === null || selectedY === null) {
            setSelectedCellId(null);
            return;
        }
        // selectedX = portrait width, selectedY = portrait depth → landscape (lx=portY, ly=portX)
        // best-effort match by nearest cell to landscape coords
        const lx = selectedY;
        const ly = selectedX;
        let best = cells[0];
        let bestD = Infinity;
        for (const c of cells) {
            const d = (c.cx - lx) ** 2 + (c.cy - ly) ** 2;
            if (d < bestD) { bestD = d; best = c; }
        }
        setSelectedCellId(best.id);
    }, [selectedX, selectedY, cells]);

    // ── Shot data → ShotPoint[] format expected by HexLayer ──
    const shots: ShotPoint[] = useMemo(() => {
        return existingShots
            .filter(s => s.shotType === 'field_goal' && s.zone !== 'unlocated')
            .map(s => ({ x: s.x, y: s.y, made: s.made }));
    }, [existingShots]);

    // Recent: last 5 by createdAt
    const recentShots: ShotPoint[] = useMemo(() => {
        return [...existingShots]
            .filter(s => s.shotType === 'field_goal' && s.zone !== 'unlocated')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
            .map(s => ({ x: s.x, y: s.y, made: s.made }));
    }, [existingShots]);

    // ── FG% for selected zone (HUD) ───────────────────────────
    const selectedFgPct = useMemo(() => {
        if (!selectedZone) return null;
        const z = existingShots.filter(s => s.shotType === 'field_goal' && s.zone === selectedZone);
        if (!z.length) return null;
        return z.filter(s => s.made).length / z.length;
    }, [selectedZone, existingShots]);

    // ── HUD distance + angle ─────────────────────────────────
    const distMeters = useMemo(() => {
        if (selectedX === null || selectedY === null) return null;
        return distanceToBasket(selectedY, selectedX); // landscape coords (lx=portY, ly=portX)
    }, [selectedX, selectedY]);

    const angleDeg = useMemo(() => {
        if (selectedX === null || selectedY === null) return null;
        return angleFromBaseline(selectedY, selectedX);
    }, [selectedX, selectedY]);

    // ── Hovered hex stats (for floating tooltip) ─────────────
    const hoveredStats = useMemo(() => {
        if (!showHeat || !hoverCellId) return null;
        let made = 0, attempts = 0;
        for (const s of shots) {
            // crude: cell id check via nearest
            // (cheap because hover is RAF-coalesced; skipping in production tooltip if slow)
            const lx = s.y, ly = s.x;
            const d2 = (lx - 0) ** 2 + (ly - 0) ** 2; // placeholder — recomputed inline
            void d2;
        }
        // For simplicity, compute from existingShots using zone of the hovered cell
        const cell = cells.find(c => c.id === hoverCellId);
        if (!cell) return null;
        const zone = cell.zone;
        for (const s of existingShots) {
            if (s.shotType !== 'field_goal') continue;
            if (s.zone !== zone) continue;
            if (madeFilter === 'made' && !s.made) continue;
            if (madeFilter === 'miss' && s.made) continue;
            attempts++;
            if (s.made) made++;
        }
        if (attempts === 0) return null;
        return { made, attempts, pct: (made / attempts) * 100 };
    }, [showHeat, hoverCellId, cells, existingShots, madeFilter, shots]);

    // ── Handlers ──────────────────────────────────────────────
    const handleSelect = useCallback((cell: HexCell) => {
        setSelectedCellId(cell.id);
        const { portX, portY } = landscapeToPortrait(cell.cx, cell.cy);
        onZoneSelect(cell.zone, portX, portY);
    }, [onZoneSelect]);

    const handleHover = useCallback((cell: HexCell | null, clientX?: number, clientY?: number) => {
        setHoverCellId(cell?.id ?? null);
        if (cell && clientX !== undefined && clientY !== undefined) {
            setHoverScreen({ x: clientX, y: clientY });
        } else {
            setHoverScreen(null);
        }
    }, []);

    const handleSpotTap = useCallback((spot: QuickSpot) => {
        // Visual feedback: snap to the nearest hex cell so the ring lands on a tile.
        let best = cells[0];
        let bestD = Infinity;
        for (const c of cells) {
            const d = (c.cx - spot.lx) ** 2 + (c.cy - spot.ly) ** 2;
            if (d < bestD) { bestD = d; best = c; }
        }
        setSelectedCellId(best.id);
        // Persistence: use the spot's authoritative location (NOT the nearest cell's
        // centroid) so analytics stay aligned with the chip's declared zone.
        const { portX, portY } = landscapeToPortrait(spot.lx, spot.ly);
        onZoneSelect(spot.zone, portX, portY);
    }, [cells, onZoneSelect]);

    const cycleTheme = useCallback(() => {
        const order: CourtTheme[] = ['dark', 'wood', 'white'];
        setTheme(t => order[(order.indexOf(t) + 1) % order.length]);
    }, []);

    const themeLabel = theme === 'dark' ? 'DARK' : theme === 'wood' ? 'WOOD' : 'LITE';

    // Computed style bg for top/bottom bars (theme-aware)
    const topBarBg = isLight ? 'rgba(245,245,242,0.97)' : 'rgba(7,9,14,0.92)';
    const bottomBarBg = isLight ? 'rgba(232,232,228,0.98)' : 'rgba(5,7,11,0.95)';
    const borderColor = isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.06)';

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            width: '100%', height: '100%',
            position: 'relative', background: T.floor,
        }}>
            <CourtToolbar
                selectedZone={selectedZone}
                teamColor={teamColor}
                isLight={isLight}
                hexSize={hexSize} onHexSize={setHexSize}
                showHeat={showHeat} onShowHeat={setShowHeat}
                showRings={showRings} onShowRings={setShowRings}
                mirror={mirror} onMirror={setMirror}
                madeFilter={madeFilter} onMadeFilter={setMadeFilter}
                themeLabel={themeLabel} onCycleTheme={cycleTheme}
                topBarBg={topBarBg}
                borderColor={borderColor}
            />

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
                    showHeat={showHeat}
                    showRings={showRings}
                    palette={palette}
                    madeFilter={madeFilter}
                    shots={shots}
                    recentShots={recentShots}
                    courtPalette={T}
                    reducedMotion={reducedMotion}
                    mirror={mirror}
                />

                {/* Foreground lines (paint + arc on top of hexes, baskets) */}
                <svg
                    viewBox={`0 0 ${LS_W} ${LS_H}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                >
                    <g transform={mirror ? `matrix(-1 0 0 -1 ${LS_W} ${LS_H})` : undefined}>
                        <CourtLinesForeground T={T} />
                        {showHeat && <HeatmapLegend palette={palette} x={3} y={92} />}
                    </g>
                </svg>

                {/* Hover info chip (floating, screen-space) */}
                {hoveredStats && hoverScreen && (
                    <div style={{
                        position: 'fixed',
                        left: hoverScreen.x + 14,
                        top: hoverScreen.y - 38,
                        zIndex: 50,
                        background: 'rgba(0,0,0,0.92)',
                        border: `1px solid ${teamColor}66`,
                        borderRadius: 4,
                        padding: '5px 9px',
                        pointerEvents: 'none',
                        boxShadow: `0 4px 12px rgba(0,0,0,0.5), 0 0 14px ${teamColor}33`,
                        fontFamily: "'JetBrains Mono', monospace",
                        whiteSpace: 'nowrap',
                    }}>
                        <div style={{
                            fontSize: 8, color: 'rgba(255,255,255,0.45)',
                            letterSpacing: '0.18em', textTransform: 'uppercase',
                            marginBottom: 2,
                        }}>ZONE STATS</div>
                        <div style={{
                            fontSize: 11, color: '#fff', fontWeight: 700,
                            letterSpacing: '0.04em',
                        }}>
                            <span style={{ color: '#22C55E' }}>{hoveredStats.made}</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}> of </span>
                            <span>{hoveredStats.attempts}</span>
                            <span style={{
                                color: teamColor, marginLeft: 6, fontSize: 10,
                            }}>{hoveredStats.pct.toFixed(0)}%</span>
                        </div>
                    </div>
                )}
            </div>

            <QuickSpotChips
                color={teamColor}
                onTap={handleSpotTap}
                isLight={isLight}
                bottomBarBg={bottomBarBg}
                borderColor={borderColor}
            />

            <CourtHud
                zone={selectedZone}
                distMeters={distMeters}
                angleDeg={angleDeg}
                fgPct={selectedFgPct}
                teamColor={teamColor}
                isLight={isLight}
                hudBg={bottomBarBg}
                borderColor={borderColor}
            />
        </div>
    );
};

export default PiHexCourt;
