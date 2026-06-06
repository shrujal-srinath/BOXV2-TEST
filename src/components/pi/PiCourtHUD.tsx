import React from 'react';
import type { ShotZoneId } from '../shotchart/types/shotTypes';
import { ZONES } from '../shotchart/courtZones';

const BARLOW = '"Barlow Condensed", system-ui, sans-serif';
const JETBRAINS = '"JetBrains Mono", monospace';

export interface PiCourtHUDProps {
    hoverZone: ShotZoneId | null;
    distM: number | null;
    distFt: number | null;
    pendingShotType: string;
    onShotTypeChange: (type: string) => void;
}

// Map zones to available sub-types
function subTypesForZone(zone: ShotZoneId | null): string[] {
    if (!zone) return ['JUMPER', 'DRIVE'];
    if (zone === 'at_rim') return ['DUNK', 'LAYUP', 'TIP', 'PUTBACK'];
    if (zone === 'restricted') return ['LAYUP', 'FLOAT', 'HOOK', 'TIP'];
    if (
        zone === 'paint_left' || zone === 'paint_right' ||
        zone === 'mid_baseline_left' || zone === 'mid_baseline_right' ||
        zone === 'mid_elbow_left' || zone === 'mid_elbow_right' ||
        zone === 'mid_top'
    ) {
        return ['JUMPER', 'FADEAWAY', 'PULL UP', 'STEP BACK'];
    }
    return ['CATCH & SHOOT', 'PULL UP', 'STEP BACK', 'TRANSITION'];
}

// Mock priors for xPPA calculation (simplified Bayesian shrink)
const ZONE_PRIORS: Record<string, number> = {
    at_rim: 0.62,
    restricted: 0.58,
    paint_left: 0.46,
    paint_right: 0.46,
    mid_baseline_left: 0.40,
    mid_baseline_right: 0.40,
    mid_elbow_left: 0.41,
    mid_elbow_right: 0.41,
    mid_top: 0.43,
    three_corner_left: 0.38,
    three_corner_right: 0.38,
    three_wing_left: 0.36,
    three_wing_right: 0.36,
    three_top_left: 0.35,
    three_top_right: 0.35,
    three_top_center: 0.35,
};

export const PiCourtHUD: React.FC<PiCourtHUDProps> = ({ hoverZone, distM, distFt, pendingShotType, onShotTypeChange }) => {
    const meta = hoverZone ? ZONES[hoverZone] : null;
    const pts = meta?.pointValue ?? 2;
    const prior = hoverZone ? (ZONE_PRIORS[hoverZone] ?? 0.4) : 0;
    
    // xPPA = Expected Points Per Attempt
    // In a real app we'd blend the player's actual FG% with the prior. Here we just use prior * pts for demo
    const xPPA = prior * pts;

    const availableTypes = subTypesForZone(hoverZone);

    // Auto-select a valid type if the current pendingType isn't in the list for this zone
    React.useEffect(() => {
        if (availableTypes.length > 0 && !availableTypes.includes(pendingShotType)) {
            onShotTypeChange(availableTypes[0]);
        }
    }, [hoverZone, availableTypes, pendingShotType, onShotTypeChange]);

    if (!hoverZone || distM === null || distFt === null) {
        return (
            <div style={{
                position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(13,19,32,0.85)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                padding: '8px 16px', color: '#64748B', fontFamily: BARLOW,
                fontSize: 14, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                pointerEvents: 'none', zIndex: 10
            }}>
                Touch court to log shot
            </div>
        );
    }

    return (
        <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(13,19,32,0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
            padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 10,
            pointerEvents: 'auto'
        }}>
            {/* Zone & Distance */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 120 }}>
                <div style={{
                    fontFamily: BARLOW, fontSize: 16, fontWeight: 800, color: pts === 3 ? '#60A5FA' : '#F472B6',
                    textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.1
                }}>
                    {meta?.label ?? 'UNKNOWN'}
                </div>
                <div style={{ fontFamily: JETBRAINS, fontSize: 11, color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>
                    {distM.toFixed(1)}<span style={{ fontSize: 9, color: '#64748B' }}>M</span> / {distFt.toFixed(1)}<span style={{ fontSize: 9, color: '#64748B' }}>FT</span>
                </div>
            </div>

            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />

            {/* xPPA */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
                <div style={{ fontFamily: BARLOW, fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: 1 }}>xPPA</div>
                <div style={{ fontFamily: JETBRAINS, fontSize: 15, fontWeight: 800, color: '#E2E8F0', marginTop: -2 }}>
                    {xPPA.toFixed(2)}
                </div>
            </div>

            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />

            {/* Shot Type Selector */}
            <div style={{ display: 'flex', gap: 4 }}>
                {availableTypes.map(type => {
                    const isSel = pendingShotType === type;
                    return (
                        <button
                            key={type}
                            onClick={(e) => { e.stopPropagation(); onShotTypeChange(type); }}
                            style={{
                                background: isSel ? '#F472B6' : 'rgba(255,255,255,0.05)',
                                border: 'none',
                                padding: '6px 10px', borderRadius: 8,
                                color: isSel ? '#000' : '#E2E8F0',
                                fontFamily: BARLOW, fontSize: 13, fontWeight: isSel ? 800 : 600,
                                letterSpacing: 0.5, cursor: 'pointer',
                                transition: 'all 0.15s'
                            }}
                        >
                            {type}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
