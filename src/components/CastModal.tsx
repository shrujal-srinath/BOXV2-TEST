// src/components/CastModal.tsx
//
// The host's "remote control" for the Pi TV display.
// Triggered by the 📺 Cast button in HostConsole header.
//
// States:
//   input      → Enter the 4-char TV code
//   validating → Checking Supabase for the TV
//   casting    → Live casting — shows stop button + TV status
//   error      → TV not found or offline

import React, { useState, useEffect, useRef } from 'react';
import {
    validateTvCode,
    castGameToTv,
    stopCastingToTv,
    subscribeTvStatus,
    type TvDisplay,
} from '../services/tvDisplayService';

interface CastModalProps {
    gameCode: string;
    onClose: () => void;
}

type CastPhase = 'input' | 'validating' | 'casting' | 'error';

// ─── Animated Icons ───────────────────────────────────────────────────────────

const TvIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
);

const CastingDot = () => (
    <span style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#22c55e',
        boxShadow: '0 0 8px #22c55e',
        animation: 'castPulse 2s ease-in-out infinite',
        flexShrink: 0,
    }} />
);

// ─── Code Input ───────────────────────────────────────────────────────────────

const CodeInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    disabled: boolean;
}> = ({ value, onChange, disabled }) => {
    const chars = value.toUpperCase().split('').slice(0, 4);
    while (chars.length < 4) chars.push('');

    return (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {chars.map((char, i) => (
                <div key={i} style={{
                    width: '52px',
                    height: '64px',
                    border: `2px solid ${char ? '#DC2626' : '#2a2a2a'}`,
                    borderRadius: '8px',
                    background: char ? 'rgba(220,38,38,0.08)' : '#0a0a0a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    fontWeight: 900,
                    fontFamily: 'monospace',
                    color: char ? '#ffffff' : '#1a1a1a',
                    transition: 'all 0.15s ease',
                    letterSpacing: 0,
                }}>
                    {char || '·'}
                </div>
            ))}
            {/* Hidden real input */}
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4))}
                disabled={disabled}
                maxLength={4}
                autoFocus
                style={{
                    position: 'absolute',
                    opacity: 0,
                    width: '240px',
                    height: '64px',
                    cursor: 'text',
                }}
            />
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const CastModal: React.FC<CastModalProps> = ({ gameCode, onClose }) => {
    const [phase, setPhase] = useState<CastPhase>('input');
    const [tvCodeInput, setTvCodeInput] = useState('');
    const [activeTvCode, setActiveTvCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [tvStatus, setTvStatus] = useState<TvDisplay | null>(null);
    const unsubRef = useRef<(() => void) | null>(null);

    // Cleanup subscription on unmount
    useEffect(() => {
        return () => {
            unsubRef.current?.();
        };
    }, []);

    const handleCast = async () => {
        if (tvCodeInput.length < 4) return;
        setPhase('validating');
        setErrorMsg('');

        const { valid, message, display } = await validateTvCode(tvCodeInput);

        if (!valid) {
            setPhase('error');
            setErrorMsg(message);
            return;
        }

        const result = await castGameToTv(tvCodeInput, gameCode);

        if (!result.success) {
            setPhase('error');
            setErrorMsg(result.message);
            return;
        }

        // Success — start watching TV status
        const code = tvCodeInput.toUpperCase();
        setActiveTvCode(code);
        setPhase('casting');

        unsubRef.current = subscribeTvStatus(code, (d) => {
            setTvStatus(d);
            // If TV went back to idle externally, close gracefully
            if (d.status === 'idle' && phase === 'casting') {
                setPhase('input');
                setTvCodeInput('');
            }
        });
    };

    const handleStop = async () => {
        unsubRef.current?.();
        unsubRef.current = null;
        await stopCastingToTv(activeTvCode);
        setPhase('input');
        setTvCodeInput('');
        setActiveTvCode('');
        setTvStatus(null);
    };

    const isOnline = tvStatus ? Date.now() - tvStatus.last_seen < 20000 : false;

    return (
        <>
            <style>{`
                @keyframes castPulse {
                    0%, 100% { opacity: 1; box-shadow: 0 0 8px #22c55e; }
                    50% { opacity: 0.4; box-shadow: 0 0 3px #22c55e; }
                }
                @keyframes castSpin {
                    to { transform: rotate(360deg); }
                }
            `}</style>

            {/* Backdrop */}
            <div
                onClick={phase === 'validating' ? undefined : onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                }}
            >
                {/* Modal */}
                <div
                    onClick={e => e.stopPropagation()}
                    style={{
                        width: '100%',
                        maxWidth: '380px',
                        background: '#0a0a0a',
                        border: '1px solid #1a1a1a',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
                    }}
                >
                    {/* Top accent */}
                    <div style={{
                        height: '2px',
                        background: phase === 'casting'
                            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                            : phase === 'error'
                                ? '#DC2626'
                                : 'linear-gradient(90deg, #DC2626, #7f1d1d)',
                        transition: 'background 0.4s ease',
                    }} />

                    <div style={{ padding: '28px' }}>

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.3em', color: '#333', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '6px' }}>
                                    TV Display
                                </p>
                                <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                    {phase === 'casting' ? `Casting to ${activeTvCode}` : 'Cast to Screen'}
                                </h2>
                            </div>
                            {phase !== 'validating' && (
                                <button
                                    onClick={onClose}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#444',
                                        cursor: 'pointer',
                                        fontSize: '18px',
                                        lineHeight: 1,
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* ── INPUT PHASE ── */}
                        {(phase === 'input' || phase === 'error') && (
                            <div>
                                <p style={{ fontSize: '12px', color: '#444', fontFamily: 'monospace', marginBottom: '20px', lineHeight: 1.6 }}>
                                    Enter the 4-character code shown on your TV screen.
                                </p>

                                <div style={{ position: 'relative', marginBottom: '16px' }}>
                                    <CodeInput
                                        value={tvCodeInput}
                                        onChange={setTvCodeInput}
                                        disabled={false}
                                    />
                                </div>

                                {phase === 'error' && (
                                    <div style={{
                                        background: 'rgba(220,38,38,0.08)',
                                        border: '1px solid rgba(220,38,38,0.2)',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        marginBottom: '16px',
                                    }}>
                                        <p style={{ fontSize: '12px', color: '#ef4444', fontFamily: 'monospace', margin: 0 }}>
                                            {errorMsg}
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={handleCast}
                                    disabled={tvCodeInput.length < 4}
                                    style={{
                                        width: '100%',
                                        padding: '14px',
                                        background: tvCodeInput.length === 4 ? '#DC2626' : '#111',
                                        border: 'none',
                                        borderRadius: '10px',
                                        color: tvCodeInput.length === 4 ? '#fff' : '#333',
                                        fontSize: '12px',
                                        fontWeight: 900,
                                        letterSpacing: '0.2em',
                                        textTransform: 'uppercase',
                                        cursor: tvCodeInput.length === 4 ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    Cast Game →
                                </button>
                            </div>
                        )}

                        {/* ── VALIDATING PHASE ── */}
                        {phase === 'validating' && (
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    border: '3px solid #1a1a1a',
                                    borderTopColor: '#DC2626',
                                    borderRadius: '50%',
                                    animation: 'castSpin 0.8s linear infinite',
                                    margin: '0 auto 16px',
                                }} />
                                <p style={{ color: '#555', fontSize: '13px', fontFamily: 'monospace' }}>
                                    Connecting to <span style={{ color: '#fff' }}>{tvCodeInput.toUpperCase()}</span>...
                                </p>
                            </div>
                        )}

                        {/* ── CASTING PHASE ── */}
                        {phase === 'casting' && (
                            <div>
                                {/* Live status card */}
                                <div style={{
                                    background: '#000',
                                    border: '1px solid #1a1a1a',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    marginBottom: '16px',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '10px', color: '#333', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase' }}>TV Code</span>
                                        <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff', fontFamily: 'monospace', letterSpacing: '0.15em' }}>{activeTvCode}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '10px', color: '#333', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Game</span>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626', fontFamily: 'monospace' }}>{gameCode}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '10px', color: '#333', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Screen</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CastingDot />
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>
                                                LIVE
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Stop button */}
                                <button
                                    onClick={handleStop}
                                    style={{
                                        width: '100%',
                                        padding: '14px',
                                        background: 'transparent',
                                        border: '1px solid #DC2626',
                                        borderRadius: '10px',
                                        color: '#DC2626',
                                        fontSize: '12px',
                                        fontWeight: 900,
                                        letterSpacing: '0.2em',
                                        textTransform: 'uppercase',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={e => {
                                        (e.target as HTMLButtonElement).style.background = 'rgba(220,38,38,0.1)';
                                    }}
                                    onMouseLeave={e => {
                                        (e.target as HTMLButtonElement).style.background = 'transparent';
                                    }}
                                >
                                    ⏹ Stop Casting
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default CastModal;