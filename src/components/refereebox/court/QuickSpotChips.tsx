// src/components/refereebox/court/QuickSpotChips.tsx
// Bottom strip of one-tap shortcuts for high-frequency shot locations.
// Centroids re-classified (see CourtGeometry.QUICK_SPOTS) — dev-mode console.warn
// will flag any chip whose centroid disagrees with its label.

import React from 'react';
import { QUICK_SPOTS } from './CourtGeometry';
import type { QuickSpot } from './CourtGeometry';

const RM = "'JetBrains Mono', monospace";

interface ChipProps {
    spot: QuickSpot; color: string;
    onTap: (s: QuickSpot) => void;
    isLight: boolean;
}

const SpotChip: React.FC<ChipProps> = ({ spot, color, onTap, isLight }) => (
    <button onClick={() => onTap(spot)}
        aria-label={`Mark shot at ${spot.short}`}
        style={{
            height: 44, padding: '0 14px', minWidth: 56,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${color}88`,
            color, fontFamily: RM, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            borderRadius: 8, whiteSpace: 'nowrap',
            boxShadow: `inset 0 1px 0 ${color}22`,
            transition: 'background 0.1s, transform 0.06s, box-shadow 0.12s',
        }}
        onPointerDown={e => {
            const t = e.currentTarget;
            t.style.background = `${color}22`;
            t.style.transform = 'scale(0.96)';
        }}
        onPointerUp={e => {
            const t = e.currentTarget;
            t.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';
            t.style.transform = 'scale(1)';
        }}
        onPointerLeave={e => {
            const t = e.currentTarget;
            t.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';
            t.style.transform = 'scale(1)';
        }}
    >{spot.short}</button>
);

interface ChipsProps {
    color: string;
    onTap: (s: QuickSpot) => void;
    isLight: boolean;
    bottomBarBg: string;
    borderColor: string;
}

const QuickSpotChips: React.FC<ChipsProps> = ({ color, onTap, isLight, bottomBarBg, borderColor }) => (
    <div style={{
        height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        gap: 6, padding: '0 12px',
        background: bottomBarBg,
        borderTop: `1px solid ${borderColor}`,
        overflowX: 'auto',
    }}>
        <span style={{
            fontFamily: RM, fontSize: 9, fontWeight: 700,
            letterSpacing: '0.22em',
            color: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
            textTransform: 'uppercase', flexShrink: 0, paddingRight: 6,
        }}>QUICK:</span>
        {QUICK_SPOTS.map(s => (
            <SpotChip key={s.id} spot={s} color={color} onTap={onTap} isLight={isLight} />
        ))}
    </div>
);

export default React.memo(QuickSpotChips);
