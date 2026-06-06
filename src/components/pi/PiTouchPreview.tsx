// src/components/pi/PiTouchPreview.tsx
// Near-finger preview chip shown during a court touch on the Pi console.
// Touch equivalent of the desktop hover label. Renders only when hoverInfo set.
import React from 'react';
import type { HoverInfo } from '../shotchart/AdvancedCourtHex';
import { ZONES } from '../shotchart/courtZones';
import { zonePoints } from '../../lib/xppa';

const BARLOW = '"Barlow Condensed", system-ui, sans-serif';

interface Props { hoverInfo: HoverInfo | null }

export const PiTouchPreview: React.FC<Props> = ({ hoverInfo }) => {
    if (!hoverInfo || !hoverInfo.screen) return null;
    const pts = zonePoints(hoverInfo.zone);
    const is3 = pts === 3;
    const label = ZONES[hoverInfo.zone]?.label ?? hoverInfo.zone.replace(/_/g, ' ');

    // Offset away from the fingertip; flip left when near the right edge.
    const nearRight = hoverInfo.screen.x > window.innerWidth - 220;
    const left = hoverInfo.screen.x + (nearRight ? -60 : 60);
    const top = hoverInfo.screen.y - 80;
    const transform = nearRight ? 'translateX(-100%)' : 'none';

    return (
        <div style={{
            position: 'fixed', left, top, transform, zIndex: 70, pointerEvents: 'none',
            background: 'rgba(7,9,14,0.94)', border: `1.5px solid ${is3 ? '#3B82F6' : '#F59E0B'}`,
            borderRadius: 12, padding: '8px 14px', minWidth: 150,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            fontFamily: BARLOW, fontStyle: 'italic', textTransform: 'uppercase', color: '#F0F4FF',
        }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5, lineHeight: 1.05 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6, gap: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#8D97AA', fontVariantNumeric: 'tabular-nums' }}>
                    {hoverInfo.dist.meters.toFixed(1)}<span style={{ fontSize: 11, marginLeft: 2 }}>m</span>
                </span>
                <span style={{
                    padding: '2px 10px', borderRadius: 6, fontSize: 16, fontWeight: 800,
                    background: is3 ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)',
                    color: is3 ? '#60A5FA' : '#FBBF24',
                    border: `1px solid ${is3 ? 'rgba(59,130,246,0.5)' : 'rgba(245,158,11,0.5)'}`,
                }}>+{pts}</span>
            </div>
        </div>
    );
};
