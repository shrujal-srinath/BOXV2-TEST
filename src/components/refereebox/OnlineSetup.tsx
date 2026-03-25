// src/components/refereebox/OnlineSetup.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — ONLINE SETUP (QR FLOW)
//
// No manual code entry. Flow:
//   1. Pi loads its permanent 4-char box code from localStorage
//   2. Registers in box_units table in Supabase
//   3. Displays QR code → operator scans → website GameSetup opens
//   4. Operator configures everything on website and hits Launch
//   5. Website writes game_code to box's row + fires broadcast
//   6. Pi subscription fires → onGameAssigned(gameCode) called
//   7. RefereeScreen transitions automatically — no manual input
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import {
    registerBoxUnit,
    startBoxHeartbeat,
    subscribeBoxUnit,
    subscribeBoxSignal,
} from '../../services/boxUnitService';

// ─── QR Code via free API (swap to qrcode.js if offline needed) ─
const getQRUrl = (text: string): string =>
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}&bgcolor=000000&color=ffffff&margin=10`;

// ─── Permanent box code stored in localStorage ────────────────
const BOX_CODE_KEY = 'THE_BOX_UNIT_CODE';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

const getOrCreateBoxCode = (): string => {
    const stored = localStorage.getItem(BOX_CODE_KEY);
    if (stored) return stored;
    let code = 'BX'; // prefix so it's identifiable
    for (let i = 0; i < 2; i++) code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    localStorage.setItem(BOX_CODE_KEY, code);
    return code;
};

// ─── Props ────────────────────────────────────────────────────

interface OnlineSetupProps {
    onGameAssigned: (gameCode: string) => void;
    onBack: () => void;
}

type Phase = 'registering' | 'waiting' | 'assigned' | 'error';

// ─── Component ────────────────────────────────────────────────

const OnlineSetup: React.FC<OnlineSetupProps> = ({ onGameAssigned, onBack }) => {
    const [boxCode] = useState<string>(getOrCreateBoxCode);
    const [phase, setPhase] = useState<Phase>('registering');
    const [errorMsg, setErrorMsg] = useState('');
    const [assignedCode, setAssignedCode] = useState('');
    const handledRef = useRef(false);
    const cleanupRef = useRef<(() => void)[]>([]);

    const [networkIp, setNetworkIp] = useState('localhost');

    useEffect(() => {
        fetch('http://localhost:3001/api/network-ip')
            .then(r => r.json())
            .then(d => setNetworkIp(d.ip))
            .catch(() => { });
    }, []);

    const setupUrl = `http://${networkIp}:5173/setup?box=${boxCode}`;

    const handleGameAssigned = (gameCode: string) => {
        if (handledRef.current) return;
        handledRef.current = true;
        setAssignedCode(gameCode);
        setPhase('assigned');
        setTimeout(() => onGameAssigned(gameCode), 1200);
    };

    useEffect(() => {
        let heartbeatCleanup: (() => void) | null = null;

        const init = async () => {
            try {
                const { game_code, status } = await registerBoxUnit(boxCode);

                // Already has a game assigned — resume immediately
                if (game_code && status === 'game_ready') {
                    handleGameAssigned(game_code);
                    return;
                }

                setPhase('waiting');
                heartbeatCleanup = startBoxHeartbeat(boxCode);

                const unsubDb = subscribeBoxUnit(boxCode, handleGameAssigned, () => { });
                const unsubSignal = subscribeBoxSignal(boxCode, handleGameAssigned, () => { });
                cleanupRef.current = [unsubDb, unsubSignal];

            } catch (err) {
                console.error('[OnlineSetup] Init failed:', err);
                setPhase('error');
                setErrorMsg('Cannot reach Supabase. Check your internet connection.');
            }
        };

        init();

        return () => {
            heartbeatCleanup?.();
            cleanupRef.current.forEach(fn => fn());
        };
    }, [boxCode]);

    return (
        <div style={{
            width: '1024px', height: '600px', background: '#000',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 28px', borderBottom: '1px solid #0f0f0f', flexShrink: 0,
            }}>
                <div style={{
                    fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                    fontSize: '20px', letterSpacing: '0.25em', color: '#fff',
                }}>THE BOX</div>
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px', letterSpacing: '0.15em', color: '#333',
                }}>ONLINE SETUP</div>
                <button onClick={onBack} style={{
                    background: 'none', border: '1px solid #222', borderRadius: '6px',
                    color: '#444', fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px', letterSpacing: '0.1em', padding: '6px 14px', cursor: 'pointer',
                }}>← BACK</button>
            </div>

            {/* Body */}
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '64px', padding: '24px 48px',
            }}>
                {/* QR Code */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px', color: '#444', letterSpacing: '0.2em',
                    }}>SCAN TO CONFIGURE</div>

                    <div style={{
                        width: '208px', height: '208px', background: '#000',
                        border: `3px solid ${phase === 'assigned' ? '#22C55E' : '#1e1e1e'}`,
                        borderRadius: '12px', overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'border-color 0.3s',
                    }}>
                        {phase === 'registering' ? (
                            <div style={{
                                width: '32px', height: '32px',
                                border: '2px solid #1a1a1a', borderTop: '2px solid #F59E0B',
                                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                            }} />
                        ) : phase === 'assigned' ? (
                            <div style={{ fontSize: '72px', color: '#22C55E', animation: 'popIn 0.3s ease' }}>✓</div>
                        ) : (
                            <img
                                src={getQRUrl(setupUrl)}
                                alt="Setup QR Code"
                                width={200} height={200}
                                style={{ imageRendering: 'pixelated' }}
                            />
                        )}
                    </div>

                    {/* Box code */}
                    <div style={{
                        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                        fontSize: '20px', letterSpacing: '0.3em', color: '#333',
                    }}>{boxCode}</div>
                </div>

                {/* Divider */}
                <div style={{ width: '1px', height: '180px', background: '#111', flexShrink: 0 }} />

                {/* Instructions / status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '340px' }}>

                    {(phase === 'waiting' || phase === 'registering') && (
                        <>
                            {[
                                { n: '1', text: 'Scan the QR code with your phone' },
                                { n: '2', text: 'Configure teams, rosters, and rules on the website' },
                                { n: '3', text: 'Hit Launch — The Box loads automatically' },
                            ].map(step => (
                                <div key={step.n} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: '#0a0a0a', border: '1px solid #222',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontSize: '12px', fontWeight: 700, color: '#F59E0B', flexShrink: 0,
                                    }}>{step.n}</div>
                                    <div style={{
                                        fontFamily: "'Barlow', sans-serif",
                                        fontSize: '15px', color: '#555', lineHeight: 1.5, paddingTop: '4px',
                                    }}>{step.text}</div>
                                </div>
                            ))}

                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '12px 16px', background: '#070707',
                                border: '1px solid #141414', borderRadius: '8px', marginTop: '4px',
                            }}>
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: '#F59E0B', animation: 'breathe 1.5s infinite', flexShrink: 0,
                                }} />
                                <div style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: '11px', color: '#F59E0B', letterSpacing: '0.1em',
                                }}>
                                    {phase === 'registering' ? 'CONNECTING...' : 'WAITING FOR GAME LAUNCH...'}
                                </div>
                            </div>
                        </>
                    )}

                    {phase === 'assigned' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '11px', color: '#22C55E', letterSpacing: '0.15em',
                            }}>GAME ASSIGNED ✓</div>
                            <div style={{
                                fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                                fontSize: '48px', letterSpacing: '0.25em', color: '#F59E0B',
                            }}>{assignedCode}</div>
                            <div style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '11px', color: '#444', letterSpacing: '0.1em',
                                animation: 'breathe 1s infinite',
                            }}>LOADING GAME...</div>
                        </div>
                    )}

                    {phase === 'error' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '11px', color: '#EF4444', letterSpacing: '0.15em',
                            }}>CONNECTION FAILED</div>
                            <div style={{
                                fontFamily: "'Barlow', sans-serif", fontSize: '14px', color: '#555',
                            }}>{errorMsg}</div>
                            <button onClick={onBack} style={{
                                padding: '10px 20px', background: '#111',
                                border: '1px solid #2a2a2a', borderRadius: '8px',
                                color: '#666', fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '11px', letterSpacing: '0.1em',
                                cursor: 'pointer', width: 'fit-content',
                            }}>← USE OFFLINE MODE</button>
                        </div>
                    )}
                </div>
            </div>

            {/* URL hint */}
            {phase === 'waiting' && (
                <div style={{
                    padding: '8px 28px 12px', flexShrink: 0, textAlign: 'center',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px', color: '#1a1a1a', letterSpacing: '0.05em',
                }}>{setupUrl}</div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes breathe { 0%,100% { opacity:0.3; } 50% { opacity:1; } }
                @keyframes popIn { from { opacity:0; transform:scale(0.6); } to { opacity:1; transform:scale(1); } }
            `}</style>
        </div>
    );
};

export default OnlineSetup;