// src/components/shotchart/HalfCourt.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Half-Court SVG v6: Definitive Court Rendering
//
// 16 improvements applied (see audit):
//  1. Realistic wood plank pattern with alternating board tones
//  2. Visible paint area — clearly different tone from hardwood
//  3. 3pt line is the heaviest line (0.8px, brightest)
//  4. No-charge arc: semicircle only, no confusing flat line
//  5. Rim with orange fill + thicker backboard + shooter square
//  6. Net: 3 drape arcs instead of crosshatch mesh
//  7. FT dashed half more visible (0.15 opacity, larger dash)
//  8. Lane marks with FIBA-correct widths
//  9. Center circle with jump ball dot
// 10. Coach/sub marks kept subtle
// 11. Made shots: ALL green, size = point value distinction
// 12. Missed shots: hollow red circle (not X)
// 13. Player number: 2.8px with dark background pill
// 14. Tap feedback: thicker ring, bigger float badge with bg pill
// 15. Interactive: dim zone grid overlay showing shot zones
// 16. Three-tier line weights: heavy/medium/detail
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

interface HalfCourtProps {
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
    const tanY = C.basketY + Math.sqrt(C.threePointRadius ** 2 - (C.threeCornerX - C.basketX) ** 2);
    return {
        tanY,
        threePt: `M ${C.threeCornerX} 0 L ${C.threeCornerX} ${tanY.toFixed(2)} A ${C.threePointRadius} ${C.threePointRadius} 0 0 0 ${100 - C.threeCornerX} ${tanY.toFixed(2)} L ${100 - C.threeCornerX} 0`,
        nc: `M ${C.basketX - C.restrictedRadius} ${C.basketY} A ${C.restrictedRadius} ${C.restrictedRadius} 0 0 0 ${C.basketX + C.restrictedRadius} ${C.basketY}`,
        ftS: `M ${C.basketX - C.ftCircleRadius} ${C.paintTop} A ${C.ftCircleRadius} ${C.ftCircleRadius} 0 0 1 ${C.basketX + C.ftCircleRadius} ${C.paintTop}`,
        ftD: `M ${C.basketX - C.ftCircleRadius} ${C.paintTop} A ${C.ftCircleRadius} ${C.ftCircleRadius} 0 0 0 ${C.basketX + C.ftCircleRadius} ${C.paintTop}`,
        cc: `M ${C.basketX - C.centerCircleRadius} 94 A ${C.centerCircleRadius} ${C.centerCircleRadius} 0 0 1 ${C.basketX + C.centerCircleRadius} 94`,
    };
}

function effColor(p: number, n: number): string {
    if (n < 2) return 'rgba(255,255,255,0.02)';
    if (p >= 55) return 'rgba(34,197,94,0.22)';
    if (p >= 45) return 'rgba(34,197,94,0.12)';
    if (p >= 35) return 'rgba(250,204,21,0.11)';
    if (p >= 25) return 'rgba(239,68,68,0.12)';
    return 'rgba(239,68,68,0.22)';
}

// ── Component ────────────────────────────────────────────────────────────────

export const HalfCourt: React.FC<HalfCourtProps> = ({
    shots = [], zoneOverlays, showZones = false, onCourtTap,
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
        const y = Math.max(0, Math.min(94, (e.clientY - r.top) * vb.height / r.height));
        setTaps(p => [...p, { id: `t-${Date.now()}`, x, y, info: pendingInfo || undefined }]);
        onCourtTap(x, y);
    }, [interactive, onCourtTap, pendingInfo]);

    const C = COURT;

    // Line weight tiers
    const H = 0.8;   // heavy: boundaries, 3pt
    const M = 0.5;   // medium: paint, FT, restricted
    const D = 0.3;   // detail: lane marks, net, coach

    // Line colors
    const L1 = 'rgba(255,255,255,0.28)'; // heavy
    const L2 = 'rgba(255,255,255,0.18)'; // medium
    const L3 = 'rgba(255,255,255,0.09)'; // detail
    const RIM = 'rgba(255,140,40,0.55)';

    return (
        <>
            <style>{CSS}</style>
            <svg ref={svgRef} viewBox="0 0 100 94" className={className}
                onClick={handleClick}
                style={{ width: '100%', height: '100%', maxHeight: maxHeight || '100%', userSelect: 'none', borderRadius: 'inherit', display: 'block', cursor: interactive ? 'crosshair' : 'default' }}
                preserveAspectRatio="xMidYMid meet">

                {/* ═══ DEFS ═══ */}
                <defs>
                    {/* (1) Realistic wood plank pattern — alternating board tones */}
                    <pattern id="wood" x="0" y="0" width="100" height="4" patternUnits="userSpaceOnUse">
                        <rect width="100" height="4" fill="#0D0C0A" />
                        {/* Plank A: slightly lighter */}
                        <rect width="100" height="1.8" y="0" fill="rgba(140,110,60,0.018)" />
                        {/* Board edge shadow */}
                        <line x1="0" y1="1.8" x2="100" y2="1.8" stroke="rgba(0,0,0,0.15)" strokeWidth="0.08" />
                        {/* Plank B: slightly darker */}
                        <rect width="100" height="1.8" y="2.0" fill="rgba(100,70,35,0.012)" />
                        <line x1="0" y1="3.8" x2="100" y2="3.8" stroke="rgba(0,0,0,0.12)" strokeWidth="0.08" />
                        {/* Grain lines */}
                        <line x1="0" y1="0.6" x2="100" y2="0.6" stroke="rgba(255,255,255,0.008)" strokeWidth="0.06" />
                        <line x1="0" y1="2.7" x2="100" y2="2.7" stroke="rgba(255,255,255,0.006)" strokeWidth="0.06" />
                    </pattern>

                    {/* (2) Paint wood — noticeably different, warmer, darker */}
                    <pattern id="paintW" x="0" y="0" width="100" height="4" patternUnits="userSpaceOnUse">
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
                <rect x="0" y="0" width="100" height="94" fill="url(#wood)" />

                {/* (2) Paint area — different wood + color wash */}
                <rect x={C.paintLeft} y="0" width={C.paintRight - C.paintLeft} height={C.paintTop} fill="url(#paintW)" />
                <rect x={C.paintLeft} y="0" width={C.paintRight - C.paintLeft} height={C.paintTop} fill="rgba(80,45,20,0.06)" />

                {/* Edge glows for active team */}
                {activeEdge === 'A' && <rect x="0" y="0" width="2.5" height="94" fill={activeColor} opacity="0.1" style={{ animation: 'edgeGlow 2s ease-in-out infinite' }} />}
                {activeEdge === 'B' && <rect x="97.5" y="0" width="2.5" height="94" fill={activeColor} opacity="0.1" style={{ animation: 'edgeGlow 2s ease-in-out infinite' }} />}

                {/* Zone overlays (heat map) */}
                {zoneOverlays?.map(o => <ZoneShape key={o.zoneId} zoneId={o.zoneId} color={effColor(o.fgPct, o.fga)} />)}

                {/* ═══ COURT MARKINGS (3-tier line weights) ═══ */}
                <g fill="none">

                    {/* (16) HEAVY tier — boundaries + 3pt */}
                    <rect x="0" y="0" width="100" height="94" stroke={L1} strokeWidth={H} />
                    <line x1="0" y1="94" x2="100" y2="94" stroke={L1} strokeWidth={H} />

                    {/* (3) 3-point line — heaviest, brightest, subtle glow behind */}
                    <path d={g.threePt} stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                    <path d={g.threePt} stroke="rgba(255,255,255,0.35)" strokeWidth={H} />

                    {/* (16) MEDIUM tier — paint, FT, restricted */}
                    <rect x={C.paintLeft} y="0" width={C.paintRight - C.paintLeft} height={C.paintTop} stroke={L2} strokeWidth={M} />

                    {/* (7) FT semicircles — visible dashed half */}
                    <path d={g.ftS} stroke={L2} strokeWidth={M} />
                    <path d={g.ftD} stroke="rgba(255,255,255,0.15)" strokeWidth={M} strokeDasharray="2.0 1.5" />

                    {/* (4) No-charge semicircle — just the arc, no flat line */}
                    <path d={g.nc} stroke={L2} strokeWidth={M} />

                    {/* (9) Center circle + jump ball dot */}
                    <path d={g.cc} stroke={L3} strokeWidth={M} />
                    <circle cx={C.basketX} cy="94" r="0.5" fill="rgba(255,255,255,0.12)" />

                    {/* (5) Backboard — thick, visible */}
                    <line x1={C.basketX - 6} y1={C.backboardY} x2={C.basketX + 6} y2={C.backboardY}
                        stroke="rgba(255,255,255,0.32)" strokeWidth="0.9" strokeLinecap="round" />
                    {/* Shooter's square */}
                    <rect x={C.basketX - 2.2} y={C.backboardY - 0.3} width="4.4" height="0.6" rx="0.15"
                        stroke="rgba(255,255,255,0.15)" strokeWidth="0.2" />

                    {/* (5) Rim — orange fill + stroke */}
                    <circle cx={C.basketX} cy={C.basketY} r="1.5"
                        fill="rgba(255,140,40,0.08)" stroke={RIM} strokeWidth="0.5" />
                    {/* Rim connector to backboard */}
                    <line x1={C.basketX} y1={C.basketY - 1.5} x2={C.basketX} y2={C.backboardY}
                        stroke="rgba(255,140,40,0.3)" strokeWidth="0.35" />
                    {/* Rim flanges */}
                    {[0, 60, 120, 180, 240, 300].map(a => {
                        const rad = (a * Math.PI) / 180;
                        return <circle key={a} cx={C.basketX + Math.cos(rad) * 1.5} cy={C.basketY + Math.sin(rad) * 1.5} r="0.2" fill="rgba(255,140,40,0.3)" />;
                    })}

                    {/* (6) Net — 3 drape arcs suggesting hang, not crosshatch */}
                    {[-0.8, 0, 0.8].map((offset, i) => (
                        <path key={i}
                            d={`M ${C.basketX + offset - 1} ${C.basketY + 0.8} Q ${C.basketX + offset} ${C.basketY + 3.5 + i * 0.3} ${C.basketX + offset + 1} ${C.basketY + 0.8}`}
                            stroke="rgba(255,255,255,0.06)" strokeWidth="0.15" />
                    ))}

                    {/* (16) DETAIL tier — lane marks */}
                    {/* (8) First mark slightly longer per FIBA */}
                    {C.laneMarks.map((my, i) => {
                        const len = i === 0 ? 1.2 : 0.8;
                        return (
                            <React.Fragment key={i}>
                                <line x1={C.paintLeft - len} y1={my} x2={C.paintLeft + len} y2={my} stroke={L3} strokeWidth={D} />
                                <line x1={C.paintRight - len} y1={my} x2={C.paintRight + len} y2={my} stroke={L3} strokeWidth={D} />
                            </React.Fragment>
                        );
                    })}

                    {/* (10) Coaching/sub marks — kept subtle */}
                    {[80, 86].map(my => (
                        <React.Fragment key={my}>
                            <line x1="0" y1={my} x2="1" y2={my} stroke={L3} strokeWidth={D} />
                            <line x1="99" y1={my} x2="100" y2={my} stroke={L3} strokeWidth={D} />
                        </React.Fragment>
                    ))}
                    <line x1="42" y1="94" x2="42" y2="92.5" stroke={L3} strokeWidth={D} />
                    <line x1="58" y1="94" x2="58" y2="92.5" stroke={L3} strokeWidth={D} />
                </g>

                {/* (15) Interactive zone grid — only when court is tappable */}
                {interactive && (
                    <g fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.15" strokeDasharray="1 2">
                        {/* Horizontal zone dividers */}
                        <line x1="0" y1={C.paintTop} x2={C.paintLeft} y2={C.paintTop} />
                        <line x1={C.paintRight} y1={C.paintTop} x2="100" y2={C.paintTop} />
                        <line x1="0" y1="24" x2={C.paintLeft} y2="24" />
                        <line x1={C.paintRight} y1="24" x2="100" y2="24" />
                        {/* Vertical zone dividers */}
                        <line x1={C.paintLeft} y1={C.paintTop} x2={C.paintLeft} y2="74" />
                        <line x1={C.paintRight} y1={C.paintTop} x2={C.paintRight} y2="74" />
                        <line x1="22" y1={C.threeCornerMaxY} x2="22" y2="74" />
                        <line x1="78" y1={C.threeCornerMaxY} x2="78" y2="74" />
                        {/* Pulsing border */}
                        <rect x="0.4" y="0.4" width="99.2" height="93.2" stroke={activeColor} strokeWidth="0.5" strokeDasharray="none" style={{ animation: 'borderPulse 2s ease-in-out infinite' }} />
                    </g>
                )}

                {/* Zone labels (heat map) */}
                {zoneOverlays?.map(o => <ZoneLabel key={`zl-${o.zoneId}`} {...o} />)}

                {/* ═══ SHOT DOTS ═══ */}
                {shots.map(s => {
                    const isNew = s.isLatest;
                    const hide = liveMode && !isNew;
                    // (11) All made = green, size by points. (12) Miss = hollow red circle
                    const r = s.points === 3 ? 2.5 : s.points === 1 ? 1.4 : 2.0;
                    const madeColor = '#22C55E';

                    return (
                        <g key={s.id} className={hide ? 'sd-hide' : isNew ? 'sd-new' : 'sd-old'}>
                            {s.made ? (
                                <>
                                    {/* Glow ring on new shots */}
                                    {isNew && <circle cx={s.x} cy={s.y} r={r + 1.2} fill="none" stroke={madeColor} strokeWidth="0.25" opacity="0.25" />}
                                    {/* Main dot */}
                                    <circle cx={s.x} cy={s.y} r={r} fill={madeColor} stroke="rgba(255,255,255,0.25)" strokeWidth="0.25" />
                                    {/* (11) White inner mark on 3-pointers */}
                                    {s.points === 3 && <circle cx={s.x} cy={s.y} r="0.6" fill="rgba(255,255,255,0.7)" />}
                                </>
                            ) : (
                                /* (12) Hollow red circle for misses — clearer than X */
                                <>
                                    {isNew && <circle cx={s.x} cy={s.y} r={r + 0.8} fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="0.2" />}
                                    <circle cx={s.x} cy={s.y} r={r} fill="none" stroke="#EF4444" strokeWidth="0.7" />
                                    {/* Small X inside the circle */}
                                    <line x1={s.x - r * 0.4} y1={s.y - r * 0.4} x2={s.x + r * 0.4} y2={s.y + r * 0.4} stroke="#EF4444" strokeWidth="0.5" strokeLinecap="round" />
                                    <line x1={s.x + r * 0.4} y1={s.y - r * 0.4} x2={s.x - r * 0.4} y2={s.y + r * 0.4} stroke="#EF4444" strokeWidth="0.5" strokeLinecap="round" />
                                </>
                            )}

                            {/* (13) Player number label with background pill */}
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
                        {/* (14) Brief white flash */}
                        <circle cx={t.x} cy={t.y} r="5" fill="rgba(255,255,255,0.15)">
                            <animate attributeName="opacity" from="0.15" to="0" dur="0.15s" fill="freeze" />
                        </circle>
                        {/* Expanding ring — thicker */}
                        <circle cx={t.x} cy={t.y} fill="none" stroke={activeColor} r="2" strokeWidth="1" opacity="0.5">
                            <animate attributeName="r" from="2" to="9" dur="0.8s" fill="freeze" />
                            <animate attributeName="opacity" from="0.5" to="0" dur="0.8s" fill="freeze" />
                            <animate attributeName="stroke-width" from="1" to="0.1" dur="0.8s" fill="freeze" />
                        </circle>
                        {/* Inner dot */}
                        <circle cx={t.x} cy={t.y} fill={activeColor}>
                            <animate attributeName="r" from="0" to="2.5" dur="0.2s" fill="freeze" />
                            <animate attributeName="opacity" from="1" to="0" dur="1s" fill="freeze" />
                        </circle>
                        {/* (14) Score float badge with dark pill background */}
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

// ── ZoneShape ────────────────────────────────────────────────────────────────

const ZoneShape: React.FC<{ zoneId: ShotZoneId; color: string }> = ({ zoneId, color }) => {
    const C = COURT;
    const shapes: Record<string, React.ReactNode> = {
        restricted: <circle cx={C.basketX} cy={C.basketY} r={C.restrictedRadius + 2} fill={color} />,
        paint_left: <rect x={C.paintLeft} y={0} width={C.basketX - C.paintLeft} height={C.paintTop} fill={color} />,
        paint_right: <rect x={C.basketX} y={0} width={C.paintRight - C.basketX} height={C.paintTop} fill={color} />,
        mid_baseline_left: <rect x={C.threeCornerX + 6} y={0} width={C.paintLeft - C.threeCornerX - 6} height={24} fill={color} />,
        mid_baseline_right: <rect x={C.paintRight} y={0} width={100 - C.threeCornerX - 6 - C.paintRight} height={24} fill={color} />,
        mid_elbow_left: <rect x={C.threeCornerX + 6} y={24} width={C.paintLeft - C.threeCornerX - 6} height={C.paintTop - 14} fill={color} />,
        mid_elbow_right: <rect x={C.paintRight} y={24} width={100 - C.threeCornerX - 6 - C.paintRight} height={C.paintTop - 14} fill={color} />,
        mid_top: <rect x={C.paintLeft - 5} y={C.paintTop} width={C.paintRight - C.paintLeft + 10} height={14} fill={color} />,
        three_corner_left: <rect x={0} y={0} width={C.threeCornerX + 6} height={C.threeCornerMaxY + 2} fill={color} />,
        three_corner_right: <rect x={100 - C.threeCornerX - 6} y={0} width={C.threeCornerX + 6} height={C.threeCornerMaxY + 2} fill={color} />,
        three_wing_left: <rect x={0} y={C.threeCornerMaxY + 2} width={22} height={30} fill={color} />,
        three_wing_right: <rect x={78} y={C.threeCornerMaxY + 2} width={22} height={30} fill={color} />,
        three_top_left: <rect x={10} y={50} width={28} height={24} fill={color} />,
        three_top_right: <rect x={62} y={50} width={28} height={24} fill={color} />,
        three_top_center: <rect x={34} y={50} width={32} height={24} fill={color} />,
    };
    return <>{shapes[zoneId] || null}</>;
};

// ── ZoneLabel ────────────────────────────────────────────────────────────────

const ZoneLabel: React.FC<{ zoneId: ShotZoneId; fgPct: number; fga: number }> = ({ zoneId, fgPct, fga }) => {
    const p: Record<string, [number, number]> = {
        restricted: [50, 13], paint_left: [40, 26], paint_right: [60, 26],
        mid_baseline_left: [22, 14], mid_baseline_right: [78, 14],
        mid_elbow_left: [24, 38], mid_elbow_right: [76, 38], mid_top: [50, 46],
        three_corner_left: [3, 10], three_corner_right: [97, 10],
        three_wing_left: [10, 38], three_wing_right: [90, 38],
        three_top_left: [26, 60], three_top_right: [74, 60], three_top_center: [50, 64],
    };
    const pos = p[zoneId];
    if (!pos || fga < 1) return null;
    const c = fgPct >= 45 ? '#22C55E' : fgPct >= 35 ? '#FBBF24' : '#EF4444';
    return (
        <g style={{ pointerEvents: 'none' }}>
            <rect x={pos[0] - 6.5} y={pos[1] - 4.5} width="13" height="9" rx="1.5" fill="rgba(0,0,0,0.7)" />
            <text x={pos[0]} y={pos[1] - 1} textAnchor="middle" dominantBaseline="central" fill={c} fontSize="3.2" fontWeight="700" fontFamily="'Barlow Condensed', sans-serif">{fgPct}%</text>
            <text x={pos[0]} y={pos[1] + 2.8} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.3)" fontSize="1.8" fontWeight="500" fontFamily="'Barlow', sans-serif">{fga} att</text>
        </g>
    );
};

export default HalfCourt;