// src/components/refereebox/HardwareCheck.tsx
// THE BOX — Pre-game button verification screen
// Prompts ref to press each physical button to confirm wiring before tip-off.

import React, { useState, useEffect } from 'react';

interface HardwareCheckProps {
    onComplete: () => void;
    onSkip: () => void;
}

const BUTTONS = [
    { id: 'SCORE_A1', label: 'Team A  +1', color: '#3B82F6' },
    { id: 'SCORE_A2', label: 'Team A  +2', color: '#3B82F6' },
    { id: 'SCORE_A3', label: 'Team A  +3', color: '#3B82F6' },
    { id: 'SCORE_B1', label: 'Team B  +1', color: '#EF4444' },
    { id: 'SCORE_B2', label: 'Team B  +2', color: '#EF4444' },
    { id: 'SCORE_B3', label: 'Team B  +3', color: '#EF4444' },
    { id: 'SHOT_CLOCK_24', label: 'Shot Clock 24s', color: '#F59E0B' },
    { id: 'SHOT_CLOCK_14', label: 'Shot Clock 14s', color: '#F59E0B' },
    { id: 'CLOCK_START', label: 'Play / Pause', color: '#22C55E' },
    { id: 'UNDO', label: 'Undo', color: '#8B5CF6' },
];

const HardwareCheck: React.FC<HardwareCheckProps> = ({ onComplete, onSkip }) => {
    const [verified, setVerified] = useState<Set<string>>(new Set());
    const [lastHit, setLastHit] = useState<string | null>(null);

    // Listen to the daemon's pico messages via the health endpoint
    // We piggyback on the existing socket connection via window event
    useEffect(() => {
        const handler = (e: CustomEvent) => {
            const msg = e.detail as string;
            if (BUTTONS.find(b => b.id === msg)) {
                setVerified(prev => {
                    const next = new Set(prev);
                    next.add(msg);
                    return next;
                });
                setLastHit(msg);
                setTimeout(() => setLastHit(null), 600);
            }
        };
        window.addEventListener('pico_message', handler as EventListener);
        return () => window.removeEventListener('pico_message', handler as EventListener);
    }, []);

    const allVerified = verified.size === BUTTONS.length;

    useEffect(() => {
        if (allVerified) {
            const t = setTimeout(onComplete, 1000);
            return () => clearTimeout(t);
        }
    }, [allVerified, onComplete]);

    return (
        <div style={{
            width: '100vw', height: '100vh', background: '#000',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 32, fontFamily: "'Oswald', sans-serif",
        }}>
            <div style={{ fontSize: 13, letterSpacing: '0.3em', color: '#333' }}>
                HARDWARE CHECK
            </div>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#222', fontFamily: 'monospace' }}>
                PRESS EACH BUTTON TO VERIFY
            </div>

            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10,
                width: '90vw', maxWidth: 700,
            }}>
                {BUTTONS.map(btn => {
                    const done = verified.has(btn.id);
                    const active = lastHit === btn.id;
                    return (
                        <div key={btn.id} style={{
                            padding: '14px 8px', borderRadius: 8, textAlign: 'center',
                            border: `1.5px solid ${done ? btn.color : '#1a1a1a'}`,
                            background: active ? btn.color + '22' : done ? btn.color + '11' : '#050505',
                            transition: 'all 0.15s',
                            transform: active ? 'scale(1.06)' : 'scale(1)',
                        }}>
                            <div style={{
                                fontSize: 18, marginBottom: 6,
                                color: done ? btn.color : '#222',
                            }}>
                                {done ? '✓' : '○'}
                            </div>
                            <div style={{
                                fontSize: 10, letterSpacing: '0.1em',
                                color: done ? '#888' : '#2a2a2a',
                                fontFamily: "'JetBrains Mono', monospace",
                            }}>
                                {btn.label}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <div style={{ fontSize: 11, color: '#1a1a1a', fontFamily: 'monospace', letterSpacing: '0.15em' }}>
                    {verified.size}/{BUTTONS.length} verified
                </div>
                <button onClick={onSkip} style={{
                    background: 'none', border: '1px solid #1a1a1a', borderRadius: 6,
                    color: '#2a2a2a', fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10, letterSpacing: '0.1em', padding: '4px 14px', cursor: 'pointer',
                }}>
                    SKIP CHECK
                </button>
            </div>

            {allVerified && (
                <div style={{
                    position: 'absolute', bottom: 40,
                    fontSize: 12, color: '#22C55E', letterSpacing: '0.2em',
                    fontFamily: 'monospace', animation: 'fadeIn 0.3s ease',
                }}>
                    ALL BUTTONS VERIFIED — STARTING...
                </div>
            )}

            <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
        </div>
    );
};

export default HardwareCheck;
