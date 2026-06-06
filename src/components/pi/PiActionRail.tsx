// src/components/pi/PiActionRail.tsx
// Right rail: +1 / +2 / +3 / MISS / FOUL / TO — 56px fingertip buttons.
import React from 'react';

const BARLOW = '"Barlow Condensed", system-ui, sans-serif';

export type PendingKind = 'made2' | 'made3' | 'miss' | null;

interface Props {
    color: string;
    pending: PendingKind;
    onFt: () => void;
    onTwo: () => void;
    onThree: () => void;
    onMiss: () => void;
    onFoul: () => void;
    onTo: () => void;
}

const baseBtn = (active: boolean, color: string, danger?: boolean): React.CSSProperties => ({
    height: 56, width: '100%', borderRadius: 12, cursor: 'pointer',
    border: active ? 'none' : `1px solid ${danger ? 'rgba(239,68,68,0.4)' : '#2B3E5A'}`,
    background: active ? color : '#152032',
    color: active ? '#FFF' : danger ? '#EF4444' : '#F0F4FF',
    fontFamily: BARLOW, fontStyle: 'italic', textTransform: 'uppercase', fontWeight: 800,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
    boxShadow: active ? `0 4px 16px ${color}55` : 'none',
});

export const PiActionRail: React.FC<Props> = ({ color, pending, onFt, onTwo, onThree, onMiss, onFoul, onTo }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 6, fontFamily: BARLOW }}>
        <button onClick={onFt} style={baseBtn(false, '#22C55E')}>
            <span style={{ fontSize: 22, color: '#22C55E' }}>+1</span>
            <span style={{ fontSize: 9, letterSpacing: 1 }}>FT</span>
        </button>
        <button onClick={onTwo} style={baseBtn(pending === 'made2', color)}>
            <span style={{ fontSize: 24 }}>+2</span>
        </button>
        <button onClick={onThree} style={baseBtn(pending === 'made3', color)}>
            <span style={{ fontSize: 24 }}>+3</span>
        </button>
        <button onClick={onMiss} style={baseBtn(pending === 'miss', '#EF4444', true)}>
            <span style={{ fontSize: 16 }}>MISS</span>
        </button>
        <button onClick={onFoul} style={baseBtn(false, '#F59E0B')}>
            <span style={{ fontSize: 16, color: '#F59E0B' }}>FOUL</span>
        </button>
        <button onClick={onTo} style={baseBtn(false, '#F59E0B')}>
            <span style={{ fontSize: 16, color: '#F59E0B' }}>TO</span>
        </button>
    </div>
);
