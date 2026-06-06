// src/components/scoring/AndOnePopup.tsx
// And-1 offer — surfaces at the TOP of the court when a made FG is followed by
// an opposing foul within the window. Auto-dismisses after 4s.
import React, { useEffect } from 'react';
import type { AndOneOffer } from '../../hooks/useConsoleAnalytics';

const BARLOW = '"Barlow Condensed", sans-serif';

interface Props {
    offer: AndOneOffer;
    onMade: () => void;
    onMiss: () => void;
    onDismiss: () => void;
}

export const AndOnePopup: React.FC<Props> = ({ offer, onMade, onMiss, onDismiss }) => {
    useEffect(() => {
        const t = setTimeout(onDismiss, 4000);
        return () => clearTimeout(t);
    }, [onDismiss]);

    const label = `#${offer.playerName ?? offer.playerId ?? '?'}`;

    return (
        <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
            borderRadius: 14, overflow: 'hidden',
            background: 'rgba(245,158,11,0.96)', color: '#1A0D02',
            boxShadow: '0 12px 40px rgba(245,158,11,0.5)',
            animation: 'aoPopIn 220ms cubic-bezier(0.34,1.56,0.64,1)',
        }}>
            <style>{`
                @keyframes aoPopIn { from{opacity:0;transform:translate(-50%,-8px)} to{opacity:1;transform:translate(-50%,0)} }
                @keyframes aoBar { from{width:100%} to{width:0%} }
            `}</style>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                fontFamily: BARLOW, fontStyle: 'italic', textTransform: 'uppercase',
            }}>
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.4 }}>And-1?</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{label} — award FT?</span>
                <button onClick={onMade} style={{
                    height: 36, padding: '0 16px', borderRadius: 100, border: 'none', cursor: 'pointer',
                    background: '#16A34A', color: '#FFF', fontFamily: BARLOW, fontStyle: 'italic',
                    textTransform: 'uppercase', fontWeight: 800, fontSize: 12, letterSpacing: 1.2,
                }}>+1 Made</button>
                <button onClick={onMiss} style={{
                    height: 36, padding: '0 16px', borderRadius: 100, border: '1px solid #1A0D02',
                    background: 'transparent', color: '#1A0D02', fontFamily: BARLOW, fontStyle: 'italic',
                    textTransform: 'uppercase', fontWeight: 800, fontSize: 12, letterSpacing: 1.2, cursor: 'pointer',
                }}>+1 Miss</button>
                <button onClick={onDismiss} style={{
                    background: 'transparent', border: 'none', color: 'rgba(26,13,2,0.6)',
                    cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1,
                }}>×</button>
            </div>
            <div style={{ height: 3, background: 'rgba(26,13,2,0.15)' }}>
                <div style={{ height: '100%', background: '#1A0D02', animation: 'aoBar 4s linear forwards' }} />
            </div>
        </div>
    );
};
