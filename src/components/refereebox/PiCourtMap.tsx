// src/components/refereebox/PiCourtMap.tsx
// Lightweight SVG half-court for Pi device touch attribution.
// ViewBox 0-100 × 0-80 maps directly to court units (court is 100×94).
// Uses classifyZone() from courtZones.ts — no hex grid, no heatmap.

import React, { useRef } from 'react';
import type { ShotZoneId } from '../shotchart/types/shotTypes';
import { classifyZone, ZONES } from '../shotchart/courtZones';

interface PiCourtMapProps {
    teamColor: string;
    selectedZone: ShotZoneId | null;
    selectedX: number | null;
    selectedY: number | null;
    onZoneSelect: (zone: ShotZoneId, x: number, y: number) => void;
}

export default function PiCourtMap({
    teamColor, selectedZone, selectedX, selectedY, onZoneSelect,
}: PiCourtMapProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    function handleInteraction(clientX: number, clientY: number) {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        // Map client coords → court coords (viewBox 100×80, court units 100×80)
        const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(80, ((clientY - rect.top) / rect.height) * 80));
        onZoneSelect(classifyZone(x, y), x, y);
    }

    const zoneLabel = selectedZone ? ZONES[selectedZone]?.label : null;

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            padding: '0 8px 8px',
        }}>
            {/* Zone label / prompt */}
            <div style={{
                textAlign: 'center', padding: '6px 0 4px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em',
                color: selectedZone ? teamColor : 'rgba(255,255,255,0.25)',
                textTransform: 'uppercase', transition: 'color 0.2s',
                flexShrink: 0,
            }}>
                {zoneLabel ?? '— TAP COURT TO MARK —'}
            </div>

            {/* Court SVG */}
            <svg
                ref={svgRef}
                viewBox="0 0 100 80"
                preserveAspectRatio="xMidYMid meet"
                style={{ flex: 1, width: '100%', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
                onTouchStart={e => { e.preventDefault(); handleInteraction(e.touches[0].clientX, e.touches[0].clientY); }}
                onClick={e => handleInteraction(e.clientX, e.clientY)}
            >
                {/* Court surface — hardwood warmth */}
                <rect x="0" y="0" width="100" height="80" fill="#1c160d" />

                {/* Sidelines */}
                <line x1="0.4" y1="0" x2="0.4" y2="80" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />
                <line x1="99.6" y1="0" x2="99.6" y2="80" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />

                {/* Baseline */}
                <line x1="0" y1="0.4" x2="100" y2="0.4" stroke="rgba(255,255,255,0.55)" strokeWidth="0.9" />

                {/* Half-court hint */}
                <line x1="0" y1="79.6" x2="100" y2="79.6" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" strokeDasharray="3,3" />

                {/* Paint fill */}
                <rect x="33.67" y="0" width="32.66" height="38.67" fill="rgba(255,255,255,0.025)" />
                {/* Paint outline */}
                <rect x="33.67" y="0" width="32.66" height="38.67" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.7" />

                {/* FT semicircle — lower (solid, away from basket) */}
                {/* Center (50, 38.67), radius 12 → hits FT line at x=38 and x=62 */}
                <path d="M 38,38.67 A 12,12 0 0,0 62,38.67" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.7" />
                {/* FT semicircle — upper (dashed, toward basket) */}
                <path d="M 38,38.67 A 12,12 0 0,1 62,38.67" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" strokeDasharray="2,2" />

                {/* Backboard */}
                <line x1="43" y1="5.5" x2="57" y2="5.5" stroke="rgba(255,220,160,0.65)" strokeWidth="1.4" strokeLinecap="round" />

                {/* Basket ring */}
                <circle cx="50" cy="10.5" r="2.4" fill="none" stroke="rgba(255,140,40,0.85)" strokeWidth="0.9" />
                <circle cx="50" cy="10.5" r="0.7" fill="rgba(255,140,40,0.6)" />

                {/* Restricted area (away from baseline) */}
                <path d="M 41.67,10.5 A 8.33,8.33 0 0,0 58.33,10.5" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />

                {/* Corner-3 vertical lines */}
                <line x1="6" y1="0" x2="6" y2="19.93" stroke="rgba(255,255,255,0.28)" strokeWidth="0.7" />
                <line x1="94" y1="0" x2="94" y2="19.93" stroke="rgba(255,255,255,0.28)" strokeWidth="0.7" />

                {/* Three-point arc (large-arc=1, sweep=1 = clockwise in screen, passes through y≈55.5) */}
                <path d="M 6,19.93 A 45,45 0 1,1 94,19.93" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.7" />

                {/* Selected-zone zone hint overlay — tinted rectangle per zone area */}
                {selectedZone && selectedX !== null && (
                    <circle
                        cx={selectedX}
                        cy={Math.min(selectedY ?? 0, 79)}
                        r="5"
                        fill={teamColor}
                        opacity="0.15"
                    />
                )}

                {/* Shot dot with pulse ring */}
                {selectedX !== null && selectedY !== null && (
                    <g>
                        {/* Pulse ring */}
                        <circle cx={selectedX} cy={Math.min(selectedY, 79)} r="3.5" fill="none" stroke={teamColor} strokeWidth="1.2" opacity="0.35">
                            <animate attributeName="r" values="3.5;9;3.5" dur="1.6s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.35;0;0.35" dur="1.6s" repeatCount="indefinite" />
                        </circle>
                        {/* Filled dot */}
                        <circle cx={selectedX} cy={Math.min(selectedY, 79)} r="3" fill={teamColor} opacity="0.9">
                            <animate attributeName="r" values="3;4;3" dur="1.6s" repeatCount="indefinite" />
                        </circle>
                        {/* Center dot */}
                        <circle cx={selectedX} cy={Math.min(selectedY, 79)} r="1" fill="#fff" opacity="0.9" />
                    </g>
                )}

                {/* Invisible interaction overlay — must be last so it catches all events */}
                <rect x="0" y="0" width="100" height="80" fill="transparent" />
            </svg>
        </div>
    );
}
