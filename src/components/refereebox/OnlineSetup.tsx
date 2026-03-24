// src/components/referee/OnlineSetup.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — ONLINE GAME IMPORT
// Enter 6-digit game code from website. On match, pulls team names,
// colors, rules from Supabase and transitions to pre-game confirm.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';

interface OnlineSetupProps {
    onGameFound: (gameData: any) => void;
    onBack: () => void;
}

const OnlineSetup: React.FC<OnlineSetupProps> = ({ onGameFound, onBack }) => {
    const [code, setCode] = useState('');
    const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Auto-focus the hidden input for keyboard
        inputRef.current?.focus();
    }, []);

    const handleCodeChange = (value: string) => {
        const cleaned = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6);
        setCode(cleaned);
        setStatus('idle');
        setErrorMsg('');

        // Auto-search when 6 chars entered
        if (cleaned.length === 6) {
            searchGame(cleaned);
        }
    };

    const searchGame = async (gameCode: string) => {
        setStatus('searching');
        try {
            // TODO: Replace with actual Supabase lookup
            // const { data, error } = await supabase.from('games').select('*').eq('code', gameCode).single();
            // For now, simulate a search
            await new Promise(resolve => setTimeout(resolve, 1200));

            // Simulated — replace with real lookup
            setStatus('error');
            setErrorMsg('GAME NOT FOUND — CHECK CODE');
        } catch (err) {
            setStatus('error');
            setErrorMsg('CONNECTION FAILED');
        }
    };

    const codeSlots = Array.from({ length: 6 }, (_, i) => code[i] || '');

    return (
        <div style={{
            width: '1024px',
            height: '600px',
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                width: '100%',
                padding: '16px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #1a1a1a',
                flexShrink: 0,
            }}>
                <div
                    onClick={onBack}
                    style={{
                        fontFamily: "'Barlow', sans-serif",
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#666',
                        cursor: 'pointer',
                        padding: '8px 0',
                    }}
                >
                    ← BACK
                </div>
                <div style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontSize: '22px',
                    letterSpacing: '0.1em',
                    color: '#3B82F6',
                }}>
                    SCAN GAME
                </div>
                <div style={{ width: '60px' }} />
            </div>

            {/* Main content */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '32px',
                padding: '0 32px',
            }}>
                <div style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: '16px',
                    color: '#666',
                    textAlign: 'center',
                    letterSpacing: '0.05em',
                }}>
                    Enter the game code shown on the website dashboard
                </div>

                {/* Hidden input for keyboard trigger */}
                <input
                    ref={inputRef}
                    type="text"
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    style={{
                        position: 'absolute',
                        opacity: 0,
                        width: '1px',
                        height: '1px',
                    }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    inputMode="text"
                />

                {/* Code display slots */}
                <div
                    onClick={() => inputRef.current?.focus()}
                    style={{
                        display: 'flex',
                        gap: '12px',
                        cursor: 'text',
                    }}
                >
                    {codeSlots.map((char, i) => (
                        <div key={i} style={{
                            width: '72px',
                            height: '88px',
                            background: char ? '#0a1528' : '#0a0a0a',
                            border: `2px solid ${i === code.length && status === 'idle'
                                    ? '#3B82F6'
                                    : char
                                        ? '#1a3a6a'
                                        : '#1a1a1a'
                                }`,
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: '40px',
                            fontWeight: 700,
                            color: '#3B82F6',
                            letterSpacing: '0.05em',
                            transition: 'all 0.15s ease',
                        }}>
                            {char || (
                                i === code.length && status === 'idle' ? (
                                    <div style={{
                                        width: '2px',
                                        height: '36px',
                                        background: '#3B82F6',
                                        animation: 'breathe 1s infinite',
                                    }} />
                                ) : null
                            )}
                        </div>
                    ))}
                </div>

                {/* Status line */}
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    height: '20px',
                    color: status === 'searching' ? '#F59E0B'
                        : status === 'found' ? '#22C55E'
                            : status === 'error' ? '#EF4444'
                                : '#333',
                    animation: status === 'searching' ? 'breathe 1s infinite' : 'none',
                }}>
                    {status === 'idle' && code.length < 6 && `${6 - code.length} DIGITS REMAINING`}
                    {status === 'searching' && 'SEARCHING...'}
                    {status === 'found' && 'GAME FOUND — LOADING'}
                    {status === 'error' && errorMsg}
                </div>

                {/* Retry / Clear */}
                {(status === 'error' || code.length > 0) && (
                    <div
                        onClick={() => {
                            setCode('');
                            setStatus('idle');
                            setErrorMsg('');
                            inputRef.current?.focus();
                        }}
                        style={{
                            fontFamily: "'Barlow', sans-serif",
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#555',
                            cursor: 'pointer',
                            padding: '12px 24px',
                            border: '1px solid #222',
                            borderRadius: '8px',
                        }}
                    >
                        CLEAR & RETRY
                    </div>
                )}
            </div>

            {/* Bottom hint */}
            <div style={{
                padding: '16px 32px',
                borderTop: '1px solid #1a1a1a',
                width: '100%',
                textAlign: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                color: '#2a2a2a',
                letterSpacing: '0.05em',
            }}>
                CODE IS SHOWN IN WEBSITE → DASHBOARD → GAME CARD
            </div>
        </div>
    );
};

export default OnlineSetup;