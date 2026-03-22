// src/components/shotchart/HalfCourt.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Half-Court SVG (v2: with tap confirmation)
//
// Tap feedback: ripple circle → score badge → shot dot stays
// Onion-skinning: older shots shown as dimmer dots
// Dark theme: court lines at 12% white, 3pt arc at 18%
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { COURT } from './courtZones';
import type { ShotZoneId, CourtMode } from './types/shotTypes';

// ── Types ────────────────────────────────────────────────────────────────────

interface ShotDot {
    id: string;
    x: number;
    y: number;
    made: boolean;
    points: 1 | 2 | 3;
    isLatest?: boolean;
}

interface ZoneOverlay {
    zoneId: ShotZoneId;
    fgPct: number;
    fga: number;
    label: string;
}

interface TapConfirmation {
    id: string;
    x: number;
    y: number;
    made: boolean;
    points: number;
}

interface HalfCourtProps {
    shots?: ShotDot[];
    zoneOverlays?: ZoneOverlay[];
    showZones?: boolean;
    mode?: CourtMode;
    onCourtTap?: (x: number, y: number) => void;
    className?: string;
    interactive?: boolean;
    maxHeight?: string;
}

// ── Efficiency color ─────────────────────────────────────────────────────────

function efficiencyColor(fgPct: number, fga: number): string {
    if (fga < 2) return 'rgba(255,255,255,0.03)';
    if (fgPct >= 55) return 'rgba(34,197,94,0.3)';
    if (fgPct >= 45) return 'rgba(34,197,94,0.15)';
    if (fgPct >= 35) return 'rgba(250,204,21,0.12)';
    if (fgPct >= 25) return 'rgba(239,68,68,0.15)';
    return 'rgba(239,68,68,0.3)';
}

// ── Main Component ───────────────────────────────────────────────────────────

export const HalfCourt: React.FC<HalfCourtProps> = ({
    shots = [],
    zoneOverlays,
    showZones = false,
    mode = 'zone',
    onCourtTap,
    className = '',
    interactive = false,
    maxHeight,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [confirmations, setConfirmations] = useState<TapConfirmation[]>([]);

    // Remove old confirmations after animation completes
    useEffect(() => {
        if (confirmations.length === 0) return;
        const timer = setTimeout(() => {
            setConfirmations(prev => prev.slice(1));
        }, 1200);
        return () => clearTimeout(timer);
    }, [confirmations]);

    const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!interactive || !onCourtTap || !svgRef.current) return;

        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;

        // Map screen coords to SVG viewBox coords
        const scaleX = viewBox.width / rect.width;
        const scaleY = viewBox.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const clampedX = Math.max(0, Math.min(100, x));
        const clampedY = Math.max(0, Math.min(94, y));

        // Show tap confirmation
        setConfirmations(prev => [...prev, {
            id: `tap-${Date.now()}`,
            x: clampedX,
            y: clampedY,
            made: true, // we don't know yet — the parent determines this
            points: 2,
        }]);

        onCourtTap(clampedX, clampedY);
    }, [interactive, onCourtTap]);

    const { basketX, basketY, paintLeft, paintRight, paintTop,
        threePointRadius, threeCornerX, threeCornerMaxY, restrictedRadius } = COURT;

    // 3pt arc path
    const arcStartX = threeCornerX;
    const arcEndX = 100 - threeCornerX;
    const arcY = threeCornerMaxY;
    const threeArcPath = `
        M ${arcStartX} 0
        L ${arcStartX} ${arcY}
        A ${threePointRadius} ${threePointRadius} 0 0 0 ${arcEndX} ${arcY}
        L ${arcEndX} 0
    `;

    // Restricted area arc
    const raRadius = restrictedRadius + 0.8;
    const raPath = `M ${basketX - raRadius} 0 A ${raRadius} ${raRadius} 0 0 0 ${basketX + raRadius} 0`;

    // FT circle
    const ftCenterY = paintTop;
    const ftRadius = 6;

    return (
        <svg
            ref={svgRef}
            viewBox="0 0 100 94"
            className={className}
            onClick={handleClick}
            style={{
                width: '100%',
                height: '100%',
                maxHeight: maxHeight || '100%',
                cursor: interactive ? 'crosshair' : 'default',
                userSelect: 'none',
                display: 'block',
            }}
            preserveAspectRatio="xMidYMid meet"
        >
            {/* ── Definitions ──────────────────────────────────────── */}
            <defs>
                <style>{`
                    @keyframes shotRipple {
                        0% { r: 1; opacity: 0.8; }
                        100% { r: 6; opacity: 0; }
                    }
                    @keyframes shotBadgeFade {
                        0% { opacity: 1; transform: translateY(0); }
                        60% { opacity: 1; }
                        100% { opacity: 0; transform: translateY(-3px); }
                    }
                    @keyframes dotPop {
                        0% { r: 0; opacity: 0; }
                        50% { r: 2; opacity: 1; }
                        100% { r: 1.3; opacity: 1; }
                    }
                    @keyframes latestPulse {
                        0%, 100% { opacity: 0.4; }
                        50% { opacity: 0; }
                    }
                    .shot-ripple { animation: shotRipple 0.6s ease-out forwards; }
                    .shot-badge { animation: shotBadgeFade 1.1s ease-out forwards; }
                    .dot-pop { animation: dotPop 0.25s ease-out forwards; }
                    .latest-ring { animation: latestPulse 1.5s ease-in-out infinite; }
                `}</style>
            </defs>

            {/* ── Court background ─────────────────────────────────── */}
            <rect x="0" y="0" width="100" height="94" fill="#0a0a0a" />

            {/* Subtle floor texture */}
            <rect x="0" y="0" width="100" height="94" fill="url(#courtGrain)" opacity="0.02" />

            {/* ── Court lines ──────────────────────────────────────── */}
            <g stroke="rgba(255,255,255,0.1)" strokeWidth="0.35" fill="none">
                <rect x="0" y="0" width="100" height="94" />
                <line x1="0" y1="94" x2="100" y2="94" />
                <path d={`M ${basketX - 6} 94 A 6 6 0 0 1 ${basketX + 6} 94`} />
                <rect x={paintLeft} y="0" width={paintRight - paintLeft} height={paintTop} />
                <path d={`M ${basketX - ftRadius} ${ftCenterY} A ${ftRadius} ${ftRadius} 0 0 0 ${basketX + ftRadius} ${ftCenterY}`}
                    strokeDasharray="1.2 1.2" />
                <path d={`M ${basketX - ftRadius} ${ftCenterY} A ${ftRadius} ${ftRadius} 0 0 1 ${basketX + ftRadius} ${ftCenterY}`} />
                <path d={threeArcPath} stroke="rgba(255,255,255,0.15)" strokeWidth="0.4" />
                <path d={raPath} />
                <circle cx={basketX} cy={basketY} r="0.75" stroke="rgba(255,255,255,0.25)" />
                <line x1={basketX - 3} y1={basketY - 0.6} x2={basketX + 3} y2={basketY - 0.6}
                    stroke="rgba(255,255,255,0.2)" strokeWidth="0.45" />
            </g>

            {/* ── Zone boundaries ──────────────────────────────────── */}
            {showZones && (
                <g stroke="rgba(255,255,255,0.05)" strokeWidth="0.2" fill="none" strokeDasharray="0.8 0.8">
                    <line x1="0" y1="14" x2={paintLeft} y2="14" />
                    <line x1={paintRight} y1="14" x2="100" y2="14" />
                    <line x1={basketX} y1="0" x2={basketX} y2={paintTop} />
                    <line x1={paintLeft} y1={paintTop} x2={paintLeft} y2={paintTop + 10} />
                    <line x1={paintRight} y1={paintTop} x2={paintRight} y2={paintTop + 10} />
                    <line x1="25" y1="14" x2="25" y2="60" />
                    <line x1="75" y1="14" x2="75" y2="60" />
                    <line x1="40" y1="30" x2="40" y2="55" />
                    <line x1="60" y1="30" x2="60" y2="55" />
                </g>
            )}

            {/* ── Zone efficiency overlays ─────────────────────────── */}
            {zoneOverlays && zoneOverlays.map(z => (
                <g key={z.zoneId}>
                    <ZoneShape zoneId={z.zoneId} color={efficiencyColor(z.fgPct, z.fga)} />
                    {z.fga >= 1 && <ZoneLabel zoneId={z.zoneId} fgPct={z.fgPct} fga={z.fga} />}
                </g>
            ))}

            {/* ── Interactive crosshair hint when pending ──────────── */}
            {interactive && (
                <text x="50" y="88" textAnchor="middle" fill="rgba(255,255,255,0.1)"
                    fontSize="2.8" fontFamily="'Barlow Condensed', sans-serif" fontWeight="600"
                    letterSpacing="0.15em">
                    TAP TO MARK SHOT
                </text>
            )}

            {/* ── Shot markers (onion-skinning) ────────────────────── */}
            {shots.map((shot, i) => {
                const age = shots.length - 1 - i;
                const opacity = shot.isLatest ? 1 : Math.max(0.15, 1 - age * 0.12);

                return (
                    <g key={shot.id || i}>
                        {/* Latest shot: pulsing ring */}
                        {shot.isLatest && (
                            <circle
                                cx={shot.x} cy={shot.y}
                                r="2.8"
                                fill="none"
                                stroke={shot.made ? '#22C55E' : '#EF4444'}
                                strokeWidth="0.3"
                                className="latest-ring"
                            />
                        )}

                        {/* Shot dot */}
                        {shot.made ? (
                            <circle
                                cx={shot.x} cy={shot.y}
                                r={shot.points === 3 ? 1.5 : 1.15}
                                fill={shot.made ? '#22C55E' : '#EF4444'}
                                opacity={opacity}
                                className={shot.isLatest ? 'dot-pop' : ''}
                            />
                        ) : (
                            <g opacity={opacity}>
                                <line x1={shot.x - 0.9} y1={shot.y - 0.9} x2={shot.x + 0.9} y2={shot.y + 0.9}
                                    stroke="#EF4444" strokeWidth="0.45" strokeLinecap="round" />
                                <line x1={shot.x + 0.9} y1={shot.y - 0.9} x2={shot.x - 0.9} y2={shot.y + 0.9}
                                    stroke="#EF4444" strokeWidth="0.45" strokeLinecap="round" />
                            </g>
                        )}
                    </g>
                );
            })}

            {/* ── Tap confirmation animations ──────────────────────── */}
            {confirmations.map(c => (
                <g key={c.id}>
                    {/* Ripple ring */}
                    <circle cx={c.x} cy={c.y} r="1" fill="none"
                        stroke="rgba(245,158,11,0.7)" strokeWidth="0.4"
                        className="shot-ripple" />
                    {/* Inner flash */}
                    <circle cx={c.x} cy={c.y} r="1.2"
                        fill="rgba(245,158,11,0.4)"
                        className="shot-ripple" />
                    {/* Confirmation badge */}
                    <g className="shot-badge">
                        <rect x={c.x - 4} y={c.y - 5} width="8" height="3.5" rx="1"
                            fill="rgba(0,0,0,0.85)" stroke="rgba(245,158,11,0.5)" strokeWidth="0.2" />
                        <text x={c.x} y={c.y - 2.8} textAnchor="middle" dominantBaseline="central"
                            fill="#F59E0B" fontSize="2.2" fontWeight="700"
                            fontFamily="'Barlow Condensed', sans-serif">
                            MARKED
                        </text>
                    </g>
                </g>
            ))}
        </svg>
    );
};

// ── Zone shape (for efficiency map) ──────────────────────────────────────────

const ZoneShape: React.FC<{ zoneId: ShotZoneId; color: string }> = ({ zoneId, color }) => {
    const shapes: Record<string, React.ReactNode> = {
        restricted: <circle cx={50} cy={5} r={5} fill={color} />,
        paint_left: <rect x={31} y={0} width={19} height={19} fill={color} />,
        paint_right: <rect x={50} y={0} width={19} height={19} fill={color} />,
        mid_baseline_left: <rect x={6} y={0} width={25} height={14} fill={color} />,
        mid_baseline_right: <rect x={69} y={0} width={25} height={14} fill={color} />,
        mid_elbow_left: <rect x={15} y={14} width={16} height={14} fill={color} />,
        mid_elbow_right: <rect x={69} y={14} width={16} height={14} fill={color} />,
        mid_top: <rect x={35} y={19} width={30} height={12} fill={color} />,
        three_corner_left: <rect x={0} y={0} width={6} height={10} fill={color} />,
        three_corner_right: <rect x={94} y={0} width={6} height={10} fill={color} />,
        three_wing_left: <rect x={0} y={10} width={25} height={25} fill={color} />,
        three_wing_right: <rect x={75} y={10} width={25} height={25} fill={color} />,
        three_top_left: <rect x={15} y={35} width={25} height={20} fill={color} />,
        three_top_right: <rect x={60} y={35} width={25} height={20} fill={color} />,
        three_top_center: <rect x={35} y={35} width={30} height={20} fill={color} />,
    };
    return <>{shapes[zoneId] || null}</>;
};

// ── Zone label ───────────────────────────────────────────────────────────────

const ZoneLabel: React.FC<{ zoneId: ShotZoneId; fgPct: number; fga: number }> = ({ zoneId, fgPct, fga }) => {
    const centroids: Record<string, [number, number]> = {
        restricted: [50, 6], paint_left: [38, 12], paint_right: [62, 12],
        mid_baseline_left: [15, 8], mid_baseline_right: [85, 8],
        mid_elbow_left: [23, 22], mid_elbow_right: [77, 22], mid_top: [50, 26],
        three_corner_left: [3, 5], three_corner_right: [97, 5],
        three_wing_left: [10, 25], three_wing_right: [90, 25],
        three_top_left: [28, 44], three_top_right: [72, 44], three_top_center: [50, 48],
    };

    const pos = centroids[zoneId];
    if (!pos) return null;
    const pctColor = fgPct >= 45 ? '#22C55E' : fgPct >= 35 ? '#FBBF24' : '#EF4444';

    return (
        <g>
            <text x={pos[0]} y={pos[1] - 1.5} textAnchor="middle" dominantBaseline="central"
                fill={pctColor} fontSize="3.2" fontWeight="700"
                fontFamily="'Barlow Condensed', sans-serif">
                {Math.round(fgPct)}%
            </text>
            <text x={pos[0]} y={pos[1] + 2.2} textAnchor="middle" dominantBaseline="central"
                fill="rgba(255,255,255,0.3)" fontSize="1.8"
                fontFamily="'Barlow', sans-serif">
                {fga}
            </text>
        </g>
    );
};

export default HalfCourt;