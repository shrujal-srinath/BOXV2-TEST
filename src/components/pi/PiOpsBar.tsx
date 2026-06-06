// src/components/pi/PiOpsBar.tsx
// Bottom 60px bar: UNDO, END Q, TIMEOUT, FEED (left) · settings gear (right).
import React from 'react';

const BARLOW = '"Barlow Condensed", system-ui, sans-serif';
const qLabel = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`);

interface Props {
    period: number;
    onUndo: () => void;
    onEndQ: () => void;
    onTimeout: () => void;
    onFeed: () => void;
    onSettings: () => void;
}

const opBtn: React.CSSProperties = {
    height: 44, padding: '0 18px', borderRadius: 10, cursor: 'pointer',
    background: '#152032', border: '1px solid #2B3E5A', color: '#F0F4FF',
    fontFamily: BARLOW, fontStyle: 'italic', textTransform: 'uppercase', fontWeight: 800, fontSize: 14, letterSpacing: 1,
};

export const PiOpsBar: React.FC<Props> = ({ period, onUndo, onEndQ, onTimeout, onFeed, onSettings }) => (
    <div style={{
        background: '#0D1320', borderTop: '1px solid #1B2640',
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', fontFamily: BARLOW,
    }}>
        <button onClick={onUndo} style={opBtn}>↶ Undo</button>
        <button onClick={onEndQ} style={{ ...opBtn, color: '#E8112D', border: '1px solid rgba(232,17,45,0.4)' }}>End {qLabel(period)}</button>
        <button onClick={onTimeout} style={opBtn}>Timeout</button>
        <button onClick={onFeed} style={opBtn}>Feed</button>
        <div style={{ flex: 1 }} />
        <button onClick={onSettings} aria-label="Settings" style={{ ...opBtn, padding: 0, width: 44, fontSize: 18 }}>⚙</button>
    </div>
);
