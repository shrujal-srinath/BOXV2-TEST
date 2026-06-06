// src/components/scoring/QEndBanner.tsx
// End-of-period banner — appears top-center when the game clock reaches 0.
import React from 'react';

const BARLOW = '"Barlow Condensed", sans-serif';

interface Props {
    periodLabel: string;
    nextLabel: string;
    onAdvance: () => void;
    onDismiss: () => void;
}

export const QEndBanner: React.FC<Props> = ({ periodLabel, nextLabel, onAdvance, onDismiss }) => (
    <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
        padding: '14px 24px', borderRadius: 14,
        background: 'linear-gradient(180deg, #E8112D, #B00C22)',
        color: '#FFF', display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 12px 40px rgba(232,17,45,0.5)',
        fontFamily: BARLOW, fontStyle: 'italic', textTransform: 'uppercase',
        animation: 'qePopIn 320ms cubic-bezier(0.34,1.56,0.64,1)',
    }}>
        <style>{`@keyframes qePopIn { from{opacity:0;transform:translate(-50%,-8px)} to{opacity:1;transform:translate(-50%,0)} }`}</style>
        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.4 }}>End of {periodLabel}</span>
        <button onClick={onAdvance} style={{
            padding: '8px 16px', borderRadius: 100, border: '1.5px solid #FFF',
            background: 'rgba(255,255,255,0.15)', color: '#FFF',
            fontFamily: BARLOW, fontStyle: 'italic', textTransform: 'uppercase',
            fontWeight: 800, fontSize: 12, letterSpacing: 1.4, cursor: 'pointer',
        }}>Advance → {nextLabel}</button>
        <button onClick={onDismiss} style={{
            background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1,
        }}>×</button>
    </div>
);
