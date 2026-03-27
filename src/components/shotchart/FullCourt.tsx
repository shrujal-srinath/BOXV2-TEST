// src/components/shotchart/FullCourt.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Full-Court SVG v1
//
// FIBA full court: 28m × 15m
// ViewBox: 100 × 188
//   - 1 unit = 0.15m (same scale as HalfCourt)
//   - Bottom half: y = 0   → 94  (mirrors HalfCourt exactly)
//   - Top half:    y = 94  → 188 (mirrored vertically)
//   - Midcourt line: y = 94
//   - Center circle: cx=50, cy=94, r=12 (1.8m)
//   - Bottom basket: cx=50, cy=10.5
//   - Top basket:    cx=50, cy=177.5  (188 - 10.5)
//
// Design language: inherits ALL HalfCourt v6 decisions
//   - Realistic wood planks, alternating tones
//   - Paint area distinct fill
//   - Three-tier line weights: heavy / medium / detail
//   - Orange rim + net drape arcs, both ends
//   - Full center circle with jump-ball dot
//   - Shot dots: green filled (made) / hollow red (miss)
//   - Interactive tap feedback ring
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { COURT } from './courtZones';
import type { ShotZoneId } from './types/shotTypes';

// ── Types ────────────────────────────────────────────────────────────────────

interface ShotDot {
    id: string;
    x: number; y: number;
    made: boolean;
    points: 1 | 2 | 3;
    isLatest?: boolean;
    playerNumber?: string | null;
}

interface ZoneOverlay {
    zoneId: ShotZoneId;
    fgPct: number;
    fga: number;
    label: string;
}

interface FullCourtProps {
    shots?: ShotDot[];
    zoneOverlays?: ZoneOverlay[];
    showZones?: boolean;
    onCourtTap?: (x: number, y: number) => void;
    className?: string;
    interactive?: boolean;
    maxHeight?: string;
    activeColor?: string;
    activeEdge?: 'A' | 'B' | null;
    pendingInfo?: { made: boolean; points: number } | null;
    liveMode?: boolean;
}

// ── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
@keyframes sdPop{0%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(1.4)}100%{opacity:1;transform:scale(1)}}
@keyframes sdFade{0%{opacity:1}100%{opacity:0}}
.sd-new{animation:sdPop .3s cubic-bezier(.34,1.56,.64,1) forwards,sdFade 4s ease-in 2.5s forwards}
.sd-old{opacity:.2}
.sd-hide{display:none}
@keyframes edgeGlow{0%,100%{opacity:.12}50%{opacity:.3}}
@keyframes borderPulse{0%,100%{stroke-opacity:.1}50%{stroke-opacity:.28}}
@keyframes tapFlash{0%{opacity:.25}100%{opacity:0}}
`;

// ── Geometry builder ─────────────────────────────────────────────────────────

function geo() {
    const C = COURT;
    const FULL_H = 188; // total court height (2 × 94)
    const tanY = C.basketY + Math.sqrt(C.threePointRadius ** 2 - (C.threeCornerX - C.basketX) ** 2);

    // Bottom half (y=0..94) — same as HalfCourt
    const threePtBottom = `M ${C.threeCornerX} 0 L ${C.threeCornerX} ${tanY.toFixed(2)} A ${C.threePointRadius} ${C.threePointRadius} 0 0 0 ${100 - C.threeCornerX} ${tanY.toFixed(2)} L ${100 - C.threeCornerX} 0`;
    const ncBottom = `M ${C.basketX - C.restrictedRadius} ${C.basketY} A ${C.restrictedRadius} ${C.restrictedRadius} 0 0 0 ${C.basketX + C.restrictedRadius} ${C.basketY}`;
    const ftSBottom = `M ${C.basketX - C.ftCircleRadius} ${C.paintTop} A ${C.ftCircleRadius} ${C.ftCircleRadius} 0 0 1 ${C.basketX + C.ftCircleRadius} ${C.paintTop}`;
    const ftDBottom = `M ${C.basketX - C.ftCircleRadius} ${C.paintTop} A ${C.ftCircleRadius} ${C.ftCircleRadius} 0 0 0 ${C.basketX + C.ftCircleRadius} ${C.paintTop}`;

    // Top half (y=94..188) — mirror of bottom
    const topBasketY = FULL_H - C.basketY; // 177.5
    const topPaintBottom = FULL_H - C.paintTop; // 149.33
    const topTanY = FULL_H - tanY;
    const topBackboardY = FULL_H - C.backboardY;

    const threePtTop = `M ${C.threeCornerX} ${FULL_H} L ${C.threeCornerX} ${topTanY.toFixed(2)} A ${C.threePointRadius} ${C.threePointRadius} 0 0 1 ${100 - C.threeCornerX} ${topTanY.toFixed(2)} L ${100 - C.threeCornerX} ${FULL_H}`;
    const ncTop = `M ${C.basketX - C.restrictedRadius} ${topBasketY} A ${C.restrictedRadius} ${C.restrictedRadius} 0 0 1 ${C.basketX + C.restrictedRadius} ${topBasketY}`;
    const ftSTop = `M ${C.basketX - C.ftCircleRadius} ${topPaintBottom} A ${C.ftCircleRadius} ${C.ftCircleRadius} 0 0 0 ${C.basketX + C.ftCircleRadius} ${topPaintBottom}`;
    const ftDTop = `M ${C.basketX - C.ftCircleRadius} ${topPaintBottom} A ${C.ftCircleRadius} ${C.ftCircleRadius} 0 0 1 ${C.basketX + C.ftCircleRadius} ${topPaintBottom}`;

    // Full center circle (both halves)
    const ccFull = `M ${C.basketX - C.centerCircleRadius} 94 A ${C.centerCircleRadius} ${C.centerCircleRadius} 0 1 1 ${C.basketX + C.centerCircleRadius} 94 A ${C.centerCircleRadius} ${C.centerCircleRadius} 0 1 1 ${C.basketX - C.centerCircleRadius} 94`;

    return {
        tanY, topTanY, topBasketY, topPaintBottom, topBackboardY, FULL_H,
        threePtBottom, ncBottom, ftSBottom, ftDBottom,
        threePtTop, ncTop, ftSTop, ftDTop,
        ccFull,
    };
}

// ── Component ────────────────────────────────────────────────────────────────

export const FullCourt: React.FC<FullCourtProps> = ({
    shots = [], zoneOverlays: _zoneOverlays, showZones: _showZones = false, onCourtTap,
    className = '', interactive = false, maxHeight,
    activeColor = '#FBBF24', activeEdge = null, pendingInfo, liveMode = false,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [taps, setTaps] = useState<Array<{ id: string; x: number; y: number; info?: { made: boolean; points: number } }>>([]);
    const g = useMemo(geo, []);

    useEffect(() => {
        if (!taps.length) return;
        const t = setTimeout(() => setTaps(p => p.slice(1)), 1800);
        return () => clearTimeout(t);
    }, [taps]);

    const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!interactive || !onCourtTap || !svgRef.current) return;
        const svg = svgRef.current;
        const r = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const x = Math.max(0, Math.min(100, (e.clientX - r.left) * vb.width / r.width));
        const y = Math.max(0, Math.min(188, (e.clientY - r.top) * vb.height / r.height));
        setTaps(p => [...p, { id: `t-${Date.now()}`, x, y, info: pendingInfo || undefined }]);
        onCourtTap(x, y);
    }, [interactive, onCourtTap, pendingInfo]);

    const C = COURT;

    // Line weight tiers (same as HalfCourt)
    const H = 0.8;   // heavy: boundaries, 3pt
    const M = 0.5;   // medium: paint, FT, restricted
    const D = 0.3;   // detail: lane marks, net, coach

    // Line colors
    const L1 = 'rgba(255,255,255,0.28)'; // heavy
    const L2 = 'rgba(255,255,255,0.18)'; // medium
    const L3 = 'rgba(255,255,255,0.09)'; // detail
    const RIM = 'rgba(255,140,40,0.55)';

    // Helper: render basket assembly (rim + backboard + net) at given y positions
    const renderBasket = (basketY: number, backboardY: number, isTop: boolean) => (
        <g>
            {/* Backboard — thick, visible */}
            <line x1={C.basketX - 6} y1={backboardY} x2={C.basketX + 6} y2={backboardY}
                stroke="rgba(255,255,255,0.32)" strokeWidth="0.9" strokeLinecap="round" />
            {/* Shooter's square */}
            <rect x={C.basketX - 2.2} y={backboardY - 0.3} width="4.4" height="0.6" rx="0.15"
                stroke="rgba(255,255,255,0.15)" strokeWidth="0.2" fill="none" />
            {/* Rim — orange fill + stroke */}
            <circle cx={C.basketX} cy={basketY} r="1.5"
                fill="rgba(255,140,40,0.08)" stroke={RIM} strokeWidth="0.5" />
            {/* Rim connector to backboard */}
            <line x1={C.basketX} y1={isTop ? basketY + 1.5 : basketY - 1.5} x2={C.basketX} y2={backboardY}
                stroke="rgba(255,140,40,0.3)" strokeWidth="0.35" />
            {/* Rim flanges */}
            {[0, 60, 120, 180, 240, 300].map(a => {
                const rad = (a * Math.PI) / 180;
                return <circle key={a} cx={C.basketX + Math.cos(rad) * 1.5} cy={basketY + Math.sin(rad) * 1.5} r="0.2" fill="rgba(255,140,40,0.3)" />;
            })}
            {/* Net — 3 drape arcs */}
            {[-0.8, 0, 0.8].map((offset, i) => {
                const netDir = isTop ? -1 : 1;
                return (
                    <path key={i}
                        d={`M ${C.basketX + offset - 1} ${basketY + netDir * 0.8} Q ${C.basketX + offset} ${basketY + netDir * (3.5 + i * 0.3)} ${C.basketX + offset + 1} ${basketY + netDir * 0.8}`}
                        stroke="rgba(255,255,255,0.06)" strokeWidth="0.15" fill="none" />
                );
            })}
        </g>
    );

    // Helper: render lane marks
    const renderLaneMarks = (paintTop: number, paintBottom: number | null, isTop: boolean) => {
        const marks = isTop
            ? C.laneMarks.map(my => g.FULL_H - my)
            : C.laneMarks;
        return marks.map((my, i) => {
            const len = i === 0 ? 1.2 : 0.8;
            return (
                <React.Fragment key={`${isTop ? 'top' : 'bot'}-lm-${i}`}>
                    <line x1={C.paintLeft - len} y1={my} x2={C.paintLeft + len} y2={my} stroke={L3} strokeWidth={D} />
                    <line x1={C.paintRight - len} y1={my} x2={C.paintRight + len} y2={my} stroke={L3} strokeWidth={D} />
                </React.Fragment>
            );
        });
    };

    return (
        <>
            <style>{CSS}</style>
            <svg ref={svgRef} viewBox="0 0 100 188" className={className}
                onClick={handleClick}
                style={{ width: '100%', height: '100%', maxHeight: maxHeight || '100%', userSelect: 'none', borderRadius: 'inherit', display: 'block', cursor: interactive ? 'crosshair' : 'default' }}
                preserveAspectRatio="xMidYMid meet">

                {/* ═══ DEFS ═══ */}
                <defs>
                    {/* Realistic wood plank pattern */}
                    <pattern id="fc-wood" x="0" y="0" width="100" height="4" patternUnits="userSpaceOnUse">
                        <rect width="100" height="4" fill="#0D0C0A" />
                        <rect width="100" height="1.8" y="0" fill="rgba(140,110,60,0.018)" />
                        <line x1="0" y1="1.8" x2="100" y2="1.8" stroke="rgba(0,0,0,0.15)" strokeWidth="0.08" />
                        <rect width="100" height="1.8" y="2.0" fill="rgba(100,70,35,0.012)" />
                        <line x1="0" y1="3.8" x2="100" y2="3.8" stroke="rgba(0,0,0,0.12)" strokeWidth="0.08" />
                        <line x1="0" y1="0.6" x2="100" y2="0.6" stroke="rgba(255,255,255,0.008)" strokeWidth="0.06" />
                        <line x1="0" y1="2.7" x2="100" y2="2.7" stroke="rgba(255,255,255,0.006)" strokeWidth="0.06" />
                    </pattern>

                    {/* Paint wood — warmer, darker */}
                    <pattern id="fc-paintW" x="0" y="0" width="100" height="4" patternUnits="userSpaceOnUse">
                        <rect width="100" height="4" fill="#100E08" />
                        <rect width="100" height="1.8" y="0" fill="rgba(160,100,40,0.03)" />
                        <line x1="0" y1="1.8" x2="100" y2="1.8" stroke="rgba(0,0,0,0.18)" strokeWidth="0.08" />
                        <rect width="100" height="1.8" y="2.0" fill="rgba(140,85,30,0.025)" />
                        <line x1="0" y1="3.8" x2="100" y2="3.8" stroke="rgba(0,0,0,0.15)" strokeWidth="0.08" />
                        <line x1="0" y1="0.6" x2="100" y2="0.6" stroke="rgba(200,150,60,0.012)" strokeWidth="0.06" />
                        <line x1="0" y1="2.7" x2="100" y2="2.7" stroke="rgba(200,150,60,0.01)" strokeWidth="0.06" />
                    </pattern>
                </defs>

                {/* ═══ COURT SURFACE ═══ */}
                <rect x="0" y="0" width="100" height="188" fill="url(#fc-wood)" />

                {/* ── BOTTOM HALF paint area ── */}
                <rect x={C.paintLeft} y="0" width={C.paintRight - C.paintLeft} height={C.paintTop} fill="url(#fc-paintW)" />
                <rect x={C.paintLeft} y="0" width={C.paintRight - C.paintLeft} height={C.paintTop} fill="rgba(80,45,20,0.06)" />

                {/* ── TOP HALF paint area ── */}
                <rect x={C.paintLeft} y={g.topPaintBottom} width={C.paintRight - C.paintLeft} height={C.paintTop} fill="url(#fc-paintW)" />
                <rect x={C.paintLeft} y={g.topPaintBottom} width={C.paintRight - C.paintLeft} height={C.paintTop} fill="rgba(80,45,20,0.06)" />

                {/* Edge glows for active team */}
                {activeEdge === 'A' && <rect x="0" y="0" width="2.5" height="188" fill={activeColor} opacity="0.1" style={{ animation: 'edgeGlow 2s ease-in-out infinite' }} />}
                {activeEdge === 'B' && <rect x="97.5" y="0" width="2.5" height="188" fill={activeColor} opacity="0.1" style={{ animation: 'edgeGlow 2s ease-in-out infinite' }} />}

                {/* ═══ COURT MARKINGS ═══ */}
                <g fill="none">

                    {/* HEAVY tier — boundaries */}
                    <rect x="0" y="0" width="100" height="188" stroke={L1} strokeWidth={H} />

                    {/* ── MIDCOURT LINE ── */}
                    <line x1="0" y1="94" x2="100" y2="94" stroke={L1} strokeWidth={H} />

                    {/* ── BOTTOM HALF ── */}

                    {/* 3-point line bottom — heaviest, with glow */}
                    <path d={g.threePtBottom} stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                    <path d={g.threePtBottom} stroke="rgba(255,255,255,0.35)" strokeWidth={H} />

                    {/* Paint box bottom */}
                    <rect x={C.paintLeft} y="0" width={C.paintRight - C.paintLeft} height={C.paintTop} stroke={L2} strokeWidth={M} fill="none" />

                    {/* FT semicircles bottom */}
                    <path d={g.ftSBottom} stroke={L2} strokeWidth={M} />
                    <path d={g.ftDBottom} stroke="rgba(255,255,255,0.15)" strokeWidth={M} strokeDasharray="2.0 1.5" />

                    {/* No-charge semicircle bottom */}
                    <path d={g.ncBottom} stroke={L2} strokeWidth={M} />

                    {/* ── TOP HALF ── */}

                    {/* 3-point line top — with glow */}
                    <path d={g.threePtTop} stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                    <path d={g.threePtTop} stroke="rgba(255,255,255,0.35)" strokeWidth={H} />

                    {/* Paint box top */}
                    <rect x={C.paintLeft} y={g.topPaintBottom} width={C.paintRight - C.paintLeft} height={C.paintTop} stroke={L2} strokeWidth={M} fill="none" />

                    {/* FT semicircles top */}
                    <path d={g.ftSTop} stroke={L2} strokeWidth={M} />
                    <path d={g.ftDTop} stroke="rgba(255,255,255,0.15)" strokeWidth={M} strokeDasharray="2.0 1.5" />

                    {/* No-charge semicircle top */}
                    <path d={g.ncTop} stroke={L2} strokeWidth={M} />

                    {/* ── CENTER CIRCLE ── */}
                    <path d={g.ccFull} stroke={L2} strokeWidth={M} />
                    {/* Jump ball dot */}
                    <circle cx={C.basketX} cy="94" r="0.5" fill="rgba(255,255,255,0.12)" />

                    {/* ── BASKETS ── */}
                    {renderBasket(C.basketY, C.backboardY, false)}
                    {renderBasket(g.topBasketY, g.topBackboardY, true)}

                    {/* ── LANE MARKS ── */}
                    {renderLaneMarks(C.paintTop, null, false)}
                    {renderLaneMarks(g.topPaintBottom, null, true)}

                    {/* ── COACHING/SUB MARKS (bottom) ── */}
                    {[80, 86].map(my => (
                        <React.Fragment key={`bot-cm-${my}`}>
                            <line x1="0" y1={my} x2="1" y2={my} stroke={L3} strokeWidth={D} />
                            <line x1="99" y1={my} x2="100" y2={my} stroke={L3} strokeWidth={D} />
                        </React.Fragment>
                    ))}
                    <line x1="42" y1="94" x2="42" y2="92.5" stroke={L3} strokeWidth={D} />
                    <line x1="58" y1="94" x2="58" y2="92.5" stroke={L3} strokeWidth={D} />

                    {/* ── COACHING/SUB MARKS (top — mirrored) ── */}
                    {[188 - 80, 188 - 86].map(my => (
                        <React.Fragment key={`top-cm-${my}`}>
                            <line x1="0" y1={my} x2="1" y2={my} stroke={L3} strokeWidth={D} />
                            <line x1="99" y1={my} x2="100" y2={my} stroke={L3} strokeWidth={D} />
                        </React.Fragment>
                    ))}
                    <line x1="42" y1="94" x2="42" y2="95.5" stroke={L3} strokeWidth={D} />
                    <line x1="58" y1="94" x2="58" y2="95.5" stroke={L3} strokeWidth={D} />
                </g>

                {/* Interactive pulsing border */}
                {interactive && (
                    <g fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.15" strokeDasharray="1 2">
                        <rect x="0.4" y="0.4" width="99.2" height="187.2" stroke={activeColor} strokeWidth="0.5" strokeDasharray="none" style={{ animation: 'borderPulse 2s ease-in-out infinite' }} />
                    </g>
                )}

                {/* ═══ SHOT DOTS ═══ */}
                {shots.map(s => {
                    const isNew = s.isLatest;
                    const hide = liveMode && !isNew;
                    const r = s.points === 3 ? 2.5 : s.points === 1 ? 1.4 : 2.0;
                    const madeColor = '#22C55E';

                    return (
                        <g key={s.id} className={hide ? 'sd-hide' : isNew ? 'sd-new' : 'sd-old'}>
                            {s.made ? (
                                <>
                                    {isNew && <circle cx={s.x} cy={s.y} r={r + 1.2} fill="none" stroke={madeColor} strokeWidth="0.25" opacity="0.25" />}
                                    <circle cx={s.x} cy={s.y} r={r} fill={madeColor} stroke="rgba(255,255,255,0.25)" strokeWidth="0.25" />
                                    {s.points === 3 && <circle cx={s.x} cy={s.y} r="0.6" fill="rgba(255,255,255,0.7)" />}
                                </>
                            ) : (
                                <>
                                    {isNew && <circle cx={s.x} cy={s.y} r={r + 0.8} fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="0.2" />}
                                    <circle cx={s.x} cy={s.y} r={r} fill="none" stroke="#EF4444" strokeWidth="0.7" />
                                    <line x1={s.x - r * 0.4} y1={s.y - r * 0.4} x2={s.x + r * 0.4} y2={s.y + r * 0.4} stroke="#EF4444" strokeWidth="0.5" strokeLinecap="round" />
                                    <line x1={s.x + r * 0.4} y1={s.y - r * 0.4} x2={s.x - r * 0.4} y2={s.y + r * 0.4} stroke="#EF4444" strokeWidth="0.5" strokeLinecap="round" />
                                </>
                            )}

                            {/* Player number label */}
                            {isNew && s.playerNumber && (
                                <>
                                    <rect x={s.x - 3} y={s.y - r - 3.8} width="6" height="3" rx="0.8" fill="rgba(0,0,0,0.7)" />
                                    <text x={s.x} y={s.y - r - 2.2} textAnchor="middle" dominantBaseline="central"
                                        fill="rgba(255,255,255,0.8)" fontSize="2.4" fontWeight="700"
                                        fontFamily="'Barlow Condensed', sans-serif" style={{ pointerEvents: 'none' }}>
                                        #{s.playerNumber}
                                    </text>
                                </>
                            )}
                        </g>
                    );
                })}

                {/* ═══ TAP FEEDBACK ═══ */}
                {taps.map(t => (
                    <g key={t.id}>
                        <circle cx={t.x} cy={t.y} r="5" fill="rgba(255,255,255,0.15)">
                            <animate attributeName="opacity" from="0.15" to="0" dur="0.15s" fill="freeze" />
                        </circle>
                        <circle cx={t.x} cy={t.y} fill="none" stroke={activeColor} r="2" strokeWidth="1" opacity="0.5">
                            <animate attributeName="r" from="2" to="9" dur="0.8s" fill="freeze" />
                            <animate attributeName="opacity" from="0.5" to="0" dur="0.8s" fill="freeze" />
                            <animate attributeName="stroke-width" from="1" to="0.1" dur="0.8s" fill="freeze" />
                        </circle>
                        <circle cx={t.x} cy={t.y} fill={activeColor}>
                            <animate attributeName="r" from="0" to="2.5" dur="0.2s" fill="freeze" />
                            <animate attributeName="opacity" from="1" to="0" dur="1s" fill="freeze" />
                        </circle>
                        {t.info && (
                            <>
                                <rect rx="1.5" fill="rgba(0,0,0,0.7)">
                                    <animate attributeName="x" from={t.x - 5} to={t.x - 5} dur="1.4s" fill="freeze" />
                                    <animate attributeName="y" from={t.y - 6} to={t.y - 18} dur="1.4s" fill="freeze" />
                                    <animate attributeName="width" from="10" to="10" dur="1.4s" fill="freeze" />
                                    <animate attributeName="height" from="5" to="5" dur="1.4s" fill="freeze" />
                                    <animate attributeName="opacity" from="0.8" to="0" dur="1.4s" fill="freeze" />
                                </rect>
                                <text x={t.x} textAnchor="middle" dominantBaseline="central"
                                    fill={t.info.made ? '#22C55E' : '#EF4444'} fontSize="4" fontWeight="800"
                                    fontFamily="'Barlow Condensed', sans-serif" style={{ pointerEvents: 'none' }}>
                                    <animate attributeName="y" from={t.y - 3.5} to={t.y - 15.5} dur="1.4s" fill="freeze" />
                                    <animate attributeName="opacity" from="1" to="0" dur="1.4s" fill="freeze" />
                                    {t.info.made ? `+${t.info.points}` : 'MISS'}
                                </text>
                            </>
                        )}
                    </g>
                ))}
            </svg>
        </>
    );
};

export default FullCourt;
