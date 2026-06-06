// src/components/pi/PiBenchDrawer.tsx
// Slide-up substitution drawer. Pick OUT (on-court 5) → pick IN (bench).
// Presentational: the shared engine has no substitution action, so onConfirm
// simply reports the chosen pair and closes (mirrors the website console).
import React, { useState } from 'react';
import type { Player } from '../../types';

const BARLOW = '"Barlow Condensed", system-ui, sans-serif';

interface Props {
    open: boolean;
    teamName: string;
    color: string;
    players: Player[];
    onConfirm: (outId: string, inId: string) => void;
    onClose: () => void;
}

export const PiBenchDrawer: React.FC<Props> = ({ open, teamName, color, players, onConfirm, onClose }) => {
    const [outId, setOutId] = useState<string | null>(null);
    const onCourt = players.slice(0, 5);
    const bench = players.slice(5);

    const bigBtn = (active: boolean): React.CSSProperties => ({
        minHeight: 64, padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
        background: active ? `${color}22` : '#152032',
        border: `1.5px solid ${active ? color : '#2B3E5A'}`, color: '#F0F4FF',
        fontFamily: BARLOW, fontStyle: 'italic', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: 10,
    });

    return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 80, pointerEvents: open ? 'auto' : 'none' }}>
            <div onClick={() => { setOutId(null); onClose(); }} style={{
                position: 'absolute', inset: 0, background: 'rgba(7,9,14,0.6)', backdropFilter: 'blur(6px)',
                opacity: open ? 1 : 0, transition: 'opacity 250ms ease-out',
            }} />
            <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%',
                background: '#0D1320', borderTop: `2px solid ${color}`, borderRadius: '16px 16px 0 0',
                transform: open ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 250ms ease-out',
                display: 'flex', flexDirection: 'column', padding: 16, fontFamily: BARLOW,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', color }}>
                        {teamName} — {outId ? 'Select In' : 'Select Out'}
                    </div>
                    <button onClick={() => { setOutId(null); onClose(); }} aria-label="Close" style={{
                        width: 44, height: 44, borderRadius: 10, background: '#152032', border: '1px solid #2B3E5A',
                        color: '#8D97AA', fontSize: 20, cursor: 'pointer',
                    }}>×</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, overflowY: 'auto' }}>
                    {!outId
                        ? onCourt.map(pl => (
                            <button key={pl.id} onClick={() => setOutId(pl.id)} style={bigBtn(false)}>
                                <span style={{ fontSize: 26, fontWeight: 800, color }}>#{pl.number}</span>
                                <span style={{ fontSize: 14, fontWeight: 600 }}>{pl.name}</span>
                            </button>
                        ))
                        : bench.length === 0
                            ? <div style={{ color: '#5E6B7D', fontSize: 14, padding: 12 }}>No bench players available.</div>
                            : bench.map(pl => (
                                <button key={pl.id} onClick={() => { onConfirm(outId, pl.id); setOutId(null); onClose(); }} style={bigBtn(false)}>
                                    <span style={{ fontSize: 26, fontWeight: 800, color }}>#{pl.number}</span>
                                    <span style={{ fontSize: 14, fontWeight: 600 }}>{pl.name}</span>
                                </button>
                            ))}
                </div>
            </div>
        </div>
    );
};
