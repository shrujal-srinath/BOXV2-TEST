// src/components/CastModal.tsx
// ═══════════════════════════════════════════════════════════════
//  UNIFIED CAST MODAL  ·  Replaces CastPanel + CastModal + BroadcastModal
//
//  FLOW:
//    Open → auto-load all Pi screens + check existing cast
//    Two selection paths (both converge to same action):
//      A) Click a Pi card  → populates code input → ready to cast
//      B) Type code manually → highlights matching card if found
//    Cast / Stop → real-time subscription keeps status live
//
//  CLEANUP INSTRUCTIONS:
//    1. Delete src/components/CastPanel.tsx
//    2. Delete src/components/BroadcastModal.tsx
//    3. In HostConsole.tsx:
//         - Remove:  import { CastPanel } from '../components/CastPanel'
//         - Add:     import { CastModal } from '../components/CastModal'
//         - The JSX call signature is identical: gameCode + gameName + onClose
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    fetchAllTvDisplays,
    castGameToTv,
    stopCastingToTv,
    subscribeTvStatus,
    type TvDisplay,
} from '../services/tvDisplayService';
import { supabase } from '../services/supabase';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CastModalProps {
    gameCode: string;
    gameName?: string;
    onClose: () => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'idle' | 'casting' | 'error';

interface RichDisplay extends TvDisplay {
    online: boolean;
    castingThis: boolean;
    castingOther: boolean;
}

const ONLINE_MS = 20_000;

const enrich = (d: TvDisplay, gc: string): RichDisplay => ({
    ...d,
    online: Date.now() - d.last_seen < ONLINE_MS,
    castingThis: d.status === 'casting' && d.game_code?.toUpperCase() === gc.toUpperCase(),
    castingOther: d.status === 'casting' && d.game_code?.toUpperCase() !== gc.toUpperCase(),
});

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes cm-in     { from{opacity:0;transform:translateY(10px) scale(0.97)} to{opacity:1;transform:none} }
  @keyframes cm-spin   { to{transform:rotate(360deg)} }
  @keyframes cm-pulse  { 0%,100%{opacity:1;box-shadow:0 0 8px #22c55e} 50%{opacity:.3;box-shadow:0 0 2px #22c55e} }
  @keyframes cm-rpulse { 0%,100%{opacity:1;box-shadow:0 0 8px #ef4444} 50%{opacity:.3;box-shadow:0 0 2px #ef4444} }
  @keyframes cm-ping   { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.4);opacity:0} }
  @keyframes cm-cardin { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:none} }
  @keyframes cm-shake  { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
  @keyframes cm-glow   { 0%,100%{box-shadow:0 0 24px rgba(220,38,38,0.2)} 50%{box-shadow:0 0 40px rgba(220,38,38,0.4)} }
`;

// ─── Atoms ────────────────────────────────────────────────────────────────────

const Spinner: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#DC2626' }) => (
    <div style={{
        width: size, height: size, flexShrink: 0,
        border: `${Math.max(1.5, size / 10)}px solid rgba(255,255,255,0.07)`,
        borderTopColor: color, borderRadius: '50%',
        animation: 'cm-spin 0.7s linear infinite',
    }} />
);

const Dot: React.FC<{ online: boolean; casting?: boolean }> = ({ online, casting }) => (
    <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
        {(casting || online) && (
            <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: casting ? '#22c55e' : 'rgba(255,255,255,0.3)',
                animation: casting ? 'cm-ping 1.8s ease-out infinite' : 'none',
            }} />
        )}
        <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: casting ? '#22c55e' : online ? 'rgba(255,255,255,0.3)' : '#3f3f46',
            animation: casting ? 'cm-pulse 2s infinite' : 'none',
        }} />
    </div>
);

// ─── Screen Card ──────────────────────────────────────────────────────────────

const ScreenCard: React.FC<{
    display: RichDisplay;
    selected: boolean;
    onClick: () => void;
    operating: boolean;
    delay: number;
}> = ({ display, selected, onClick, operating, delay }) => {
    const isLive = display.castingThis;
    const isOther = display.castingOther;

    const border = isLive ? 'rgba(34,197,94,0.45)'
        : selected ? 'rgba(220,38,38,0.55)'
            : display.online ? 'rgba(255,255,255,0.07)'
                : 'rgba(255,255,255,0.03)';

    const bg = isLive ? 'rgba(34,197,94,0.05)'
        : selected ? 'rgba(220,38,38,0.06)'
            : 'rgba(255,255,255,0.02)';

    const statusText = isLive ? '● LIVE — CASTING THIS GAME'
        : isOther ? `◐ BUSY — ${display.game_code}`
            : display.online ? 'READY TO RECEIVE'
                : 'OFFLINE';

    const statusColor = isLive ? 'rgba(34,197,94,0.7)'
        : isOther ? 'rgba(251,191,36,0.55)'
            : display.online ? 'rgba(255,255,255,0.2)'
                : 'rgba(255,255,255,0.1)';

    return (
        <button
            onClick={onClick}
            disabled={operating}
            style={{
                width: '100%', textAlign: 'left',
                background: bg, border: `1px solid ${border}`,
                borderRadius: 10, padding: '11px 13px',
                display: 'flex', alignItems: 'center', gap: 11,
                cursor: !operating ? 'pointer' : 'not-allowed',
                transition: 'all 0.16s ease',
                opacity: 1,
                animation: `cm-cardin 0.28s ${delay}s both`,
                position: 'relative', overflow: 'hidden',
            }}
        >
            {/* Left accent on selected */}
            {selected && (
                <div style={{
                    position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 2,
                    background: '#DC2626', borderRadius: '0 1px 1px 0',
                }} />
            )}

            {/* Icon */}
            <div style={{
                width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                background: isLive ? 'rgba(34,197,94,0.1)' : selected ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isLive ? 'rgba(34,197,94,0.2)' : selected ? 'rgba(220,38,38,0.18)' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
            }}>📺</div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Dot online={display.online} casting={isLive} />
                    <span style={{
                        fontSize: 12, fontWeight: 900, fontFamily: 'monospace',
                        color: isLive ? '#22c55e' : selected ? '#fff' : 'rgba(255,255,255,0.65)',
                        letterSpacing: '0.18em', textTransform: 'uppercase',
                    }}>{display.tv_code}</span>
                </div>
                <div style={{
                    fontSize: 9, fontFamily: 'monospace',
                    color: statusColor, letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>{statusText}</div>
            </div>

            {/* Right badge */}
            {isLive && (
                <div style={{
                    padding: '2px 7px', borderRadius: 4,
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.22)',
                    fontSize: 8, fontWeight: 900, fontFamily: 'monospace',
                    color: '#22c55e', letterSpacing: '0.2em', textTransform: 'uppercase',
                }}>LIVE</div>
            )}
            {selected && !isLive && display.online && (
                <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: '#DC2626',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                </div>
            )}
            {operating && selected && <Spinner size={14} color="#DC2626" />}
        </button>
    );
};

// ─── Code Input ───────────────────────────────────────────────────────────────

const CodeInput: React.FC<{
    value: string; onChange: (v: string) => void;
    disabled: boolean; shake: boolean;
}> = ({ value, onChange, disabled, shake }) => {
    const chars = value.toUpperCase().split('').slice(0, 4);
    while (chars.length < 4) chars.push('');

    return (
        <div style={{ position: 'relative' }}>
            <div style={{
                display: 'flex', gap: 7, justifyContent: 'center',
                animation: shake ? 'cm-shake 0.32s ease' : 'none',
            }}>
                {chars.map((ch, i) => (
                    <div key={i} style={{
                        width: 50, height: 58, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, fontWeight: 900, fontFamily: 'monospace',
                        transition: 'all 0.14s',
                        background: ch ? 'rgba(220,38,38,0.07)' : 'rgba(255,255,255,0.03)',
                        border: `1.5px solid ${shake ? 'rgba(239,68,68,0.5)' : ch ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        color: ch ? '#fff' : 'rgba(255,255,255,0.1)',
                        boxShadow: ch && !shake ? '0 0 10px rgba(220,38,38,0.1)' : 'none',
                        letterSpacing: 0,
                    }}>{ch || '·'}</div>
                ))}
            </div>
            <input
                type="text" value={value}
                onChange={e => onChange(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4))}
                disabled={disabled} maxLength={4} autoFocus
                autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
                style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    opacity: 0, cursor: disabled ? 'not-allowed' : 'text', zIndex: 10,
                }}
            />
        </div>
    );
};

// ─── Live Cast Banner ─────────────────────────────────────────────────────────

const LiveBanner: React.FC<{
    tvCode: string; gameCode: string; gameName?: string;
    onStop: () => void; stopping: boolean;
}> = ({ tvCode, gameCode, gameName, onStop, stopping }) => (
    <div style={{
        background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.22)',
        borderRadius: 11, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 11,
        animation: 'cm-in 0.25s ease-out',
    }}>
        <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#22c55e', animation: 'cm-ping 1.8s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#22c55e', animation: 'cm-pulse 2s infinite' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#22c55e', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 2 }}>
                LIVE CAST ACTIVE
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                {gameName || gameCode}
                <span style={{ color: 'rgba(255,255,255,0.15)' }}> → </span>
                <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>{tvCode}</span>
            </div>
        </div>
        <button
            onClick={onStop} disabled={stopping}
            style={{
                padding: '5px 10px', borderRadius: 6, cursor: stopping ? 'not-allowed' : 'pointer',
                background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)',
                color: '#ef4444', fontSize: 9, fontWeight: 900, fontFamily: 'monospace',
                letterSpacing: '0.18em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.14s',
                opacity: stopping ? 0.5 : 1,
            }}
        >
            {stopping ? <Spinner size={10} color="#ef4444" /> : '■'} STOP
        </button>
    </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

export const CastModal: React.FC<CastModalProps> = ({ gameCode, gameName, onClose }) => {
    const [phase, setPhase] = useState<Phase>('loading');
    const [displays, setDisplays] = useState<RichDisplay[]>([]);
    const [inputCode, setInputCode] = useState('');       // raw input
    const [selectedCard, setCard] = useState<string | null>(null);
    const [activeCast, setActiveCast] = useState<string | null>(null);
    const [operating, setOperating] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [shake, setShake] = useState(false);

    const subsRef = useRef<Map<string, () => void>>(new Map());
    const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const gcRef = useRef(gameCode);
    gcRef.current = gameCode;

    // ── Load + subscribe ─────────────────────────────────────────────────────
    const loadDisplays = useCallback(async () => {
        const all = await fetchAllTvDisplays();
        const rich = all.map(d => enrich(d, gcRef.current));
        setDisplays(rich);

        rich.forEach(d => {
            if (subsRef.current.has(d.tv_code)) return;
            const unsub = subscribeTvStatus(d.tv_code, updated => {
                setDisplays(prev =>
                    prev.map(p => p.tv_code === updated.tv_code ? enrich(updated, gcRef.current) : p)
                );
            });
            subsRef.current.set(d.tv_code, unsub);
        });

        return rich;
    }, []);

    // ── Boot ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        const boot = async () => {
            // Check if already casting this game
            const { data } = await supabase
                .from('tv_displays')
                .select('*')
                .eq('game_code', gameCode.toUpperCase())
                .eq('status', 'casting')
                .limit(1);

            const rich = await loadDisplays();

            if (data && data.length > 0) {
                const code = data[0].tv_code.toUpperCase();
                setActiveCast(code);
                setCard(code);
                setInputCode(code);
                setPhase('casting');
            } else {
                // Auto-select single online idle screen
                const available = rich.filter(d => d.online && !d.castingOther);
                if (available.length === 1) {
                    setCard(available[0].tv_code);
                    setInputCode(available[0].tv_code);
                }
                setPhase('idle');
            }

            refreshRef.current = setInterval(loadDisplays, 12_000);
        };

        boot();
        return () => {
            if (refreshRef.current) clearInterval(refreshRef.current);
            subsRef.current.forEach(u => u());
            subsRef.current.clear();
        };
    }, [gameCode, loadDisplays]);

    // ── Code input → highlight card ──────────────────────────────────────────
    useEffect(() => {
        const upper = inputCode.toUpperCase();
        if (upper.length === 4) {
            const match = displays.find(d => d.tv_code === upper);
            if (match) setCard(match.tv_code);
        } else if (upper.length === 0) {
            setCard(null);
        }
        if (errorMsg) setErrorMsg('');
    }, [inputCode]); // eslint-disable-line

    // ── Card click → fill input ──────────────────────────────────────────────
    const handleCardClick = (tvCode: string) => {
        if (activeCast === tvCode) return;
        setCard(tvCode);
        setInputCode(tvCode);
        setErrorMsg('');
    };

    // ── Cast ─────────────────────────────────────────────────────────────────
    const handleCast = async () => {
        const target = inputCode.toUpperCase();
        if (target.length < 4 || operating) return;

        setOperating(true);
        setErrorMsg('');

        const result = await castGameToTv(target, gameCode);

        if (!result.success) {
            setErrorMsg(result.message);
            setShake(true);
            setTimeout(() => setShake(false), 400);
            setOperating(false);
            return;
        }

        setActiveCast(target);
        setPhase('casting');
        setOperating(false);
        await loadDisplays();
    };

    // ── Stop ─────────────────────────────────────────────────────────────────
    const handleStop = async () => {
        if (!activeCast) return;
        setStopping(true);
        await stopCastingToTv(activeCast);
        setActiveCast(null);
        setStopping(false);
        setPhase('idle');
        setCard(null);
        setInputCode('');
        await loadDisplays();
    };

    // ── Derived ──────────────────────────────────────────────────────────────
    const onlineList = displays.filter(d => d.online);
    const offlineList = displays.filter(d => !d.online);
    const targetDisp = displays.find(d => d.tv_code === inputCode.toUpperCase());
    const canCast = inputCode.length === 4 && !operating && !stopping;

    // Hint text
    const hint = inputCode.length === 0
        ? 'code shown on the idle screen'
        : inputCode.length < 4
            ? `${4 - inputCode.length} more…`
            : targetDisp?.castingThis
                ? '✓ already casting here'
                : targetDisp?.online
                    ? '✓ screen found and ready'
                    : targetDisp
                        ? '✓ ready (currently offline)'
                        : '✓ NEW screen — will register on cast';

    const hintColor = inputCode.length === 4
        ? (targetDisp?.online || !targetDisp) ? 'rgba(34,197,94,0.6)' : 'rgba(255,191,0,0.5)'
        : 'rgba(255,255,255,0.14)';

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            <style>{CSS}</style>

            {/* Backdrop */}
            <div
                onClick={e => { if (e.target === e.currentTarget) onClose(); }}
                style={{
                    position: 'fixed', inset: 0, zIndex: 100,
                    background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
                }}
            >
                {/* Card */}
                <div style={{
                    width: '100%', maxWidth: 460, maxHeight: '92vh',
                    display: 'flex', flexDirection: 'column',
                    background: '#0a0a0a',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16,
                    boxShadow: '0 0 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03)',
                    animation: 'cm-in 0.22s cubic-bezier(0.2,0,0,1)',
                    overflow: 'hidden',
                }}>

                    {/* Header */}
                    <div style={{
                        padding: '16px 18px 14px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                        flexShrink: 0,
                    }}>
                        <div>
                            <div style={{
                                fontSize: 8, fontWeight: 900, fontFamily: 'monospace',
                                color: '#DC2626', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 5,
                            }}>
                                LED CAST CONTROL
                            </div>
                            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', textTransform: 'uppercase', lineHeight: 1 }}>
                                {phase === 'casting' ? 'Cast Active' : 'Cast to Screen'}
                            </div>
                            {gameName && (
                                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)', marginTop: 3, letterSpacing: '0.08em' }}>
                                    {gameName}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                                color: 'rgba(255,255,255,0.35)', fontSize: 15, lineHeight: 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: 'all 0.15s',
                            }}
                        >×</button>
                    </div>

                    {/* Body */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Loading */}
                        {phase === 'loading' && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '28px 0' }}>
                                <Spinner size={18} />
                                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                                    Scanning for screens...
                                </span>
                            </div>
                        )}

                        {phase !== 'loading' && (
                            <>
                                {/* Live banner */}
                                {activeCast && (
                                    <LiveBanner
                                        tvCode={activeCast} gameCode={gameCode} gameName={gameName}
                                        onStop={handleStop} stopping={stopping}
                                    />
                                )}

                                {/* Code input section */}
                                <div>
                                    <div style={{
                                        fontSize: 8, fontWeight: 900, fontFamily: 'monospace',
                                        color: 'rgba(255,255,255,0.18)', letterSpacing: '0.32em',
                                        textTransform: 'uppercase', marginBottom: 10,
                                    }}>
                                        {activeCast ? 'CAST TO ANOTHER SCREEN' : 'ENTER SCREEN CODE'}
                                    </div>

                                    <CodeInput
                                        value={inputCode}
                                        onChange={setInputCode}
                                        disabled={operating || stopping}
                                        shake={shake}
                                    />

                                    {/* Hint */}
                                    <div style={{
                                        textAlign: 'center', marginTop: 7, minHeight: 14,
                                        fontSize: 10, fontFamily: 'monospace',
                                        color: hintColor, letterSpacing: '0.14em',
                                        textTransform: 'uppercase', transition: 'color 0.18s',
                                    }}>
                                        {hint}
                                    </div>

                                    {/* Error */}
                                    {errorMsg && (
                                        <div style={{
                                            marginTop: 8, padding: '9px 11px', borderRadius: 7,
                                            background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)',
                                            fontSize: 10, fontFamily: 'monospace', color: '#ef4444',
                                            letterSpacing: '0.06em', lineHeight: 1.5,
                                        }}>
                                            {errorMsg}
                                        </div>
                                    )}
                                </div>

                                {/* Divider + screen count */}
                                {displays.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                                        <span style={{
                                            fontSize: 8, fontWeight: 800, fontFamily: 'monospace',
                                            color: 'rgba(255,255,255,0.15)', letterSpacing: '0.3em', textTransform: 'uppercase',
                                        }}>
                                            {onlineList.length > 0
                                                ? `${onlineList.length} SCREEN${onlineList.length > 1 ? 'S' : ''} ONLINE`
                                                : 'NO SCREENS ONLINE'}
                                        </span>
                                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                                    </div>
                                )}

                                {/* Screen cards */}
                                {displays.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        {onlineList.map((d, i) => (
                                            <ScreenCard
                                                key={d.tv_code} display={d}
                                                selected={selectedCard === d.tv_code}
                                                onClick={() => handleCardClick(d.tv_code)}
                                                operating={operating && selectedCard === d.tv_code}
                                                delay={i * 0.03}
                                            />
                                        ))}

                                        {offlineList.length > 0 && (
                                            <div style={{ marginTop: 4 }}>
                                                <div style={{
                                                    fontSize: 8, fontFamily: 'monospace',
                                                    color: 'rgba(255,255,255,0.1)', letterSpacing: '0.28em',
                                                    textTransform: 'uppercase', marginBottom: 5,
                                                }}>
                                                    OFFLINE ({offlineList.length})
                                                </div>
                                                {offlineList.map((d, i) => (
                                                    <ScreenCard
                                                        key={d.tv_code} display={d} selected={false}
                                                        onClick={() => { }} operating={false}
                                                        delay={(onlineList.length + i) * 0.03}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Empty state */}
                                {displays.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '12px 0', animation: 'cm-in 0.3s ease-out' }}>
                                        <div style={{ fontSize: 26, marginBottom: 9 }}>📺</div>
                                        <div style={{
                                            fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
                                            color: 'rgba(255,255,255,0.18)', letterSpacing: '0.22em',
                                            textTransform: 'uppercase', marginBottom: 5,
                                        }}>
                                            No Screens Detected
                                        </div>
                                        <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.08)', lineHeight: 1.9 }}>
                                            Boot a Pi at{' '}
                                            <span style={{ color: 'rgba(220,38,38,0.35)' }}>yourapp.com/tv?code=XXXX</span>
                                            <br />It will appear here automatically.
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    {phase !== 'loading' && (
                        <div style={{ padding: '12px 18px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                            <button
                                onClick={handleCast}
                                disabled={!canCast}
                                style={{
                                    width: '100%', padding: '12px',
                                    borderRadius: 9, border: 'none',
                                    background: canCast
                                        ? 'linear-gradient(135deg,#DC2626,#b91c1c)'
                                        : 'rgba(255,255,255,0.04)',
                                    color: canCast ? '#fff' : 'rgba(255,255,255,0.15)',
                                    fontSize: 10, fontWeight: 900, fontFamily: 'monospace',
                                    letterSpacing: '0.25em', textTransform: 'uppercase',
                                    cursor: canCast ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.18s',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                    boxShadow: canCast ? '0 0 28px rgba(220,38,38,0.22)' : 'none',
                                    animation: canCast ? 'cm-glow 2.5s ease-in-out infinite' : 'none',
                                }}
                            >
                                {operating
                                    ? <><Spinner size={13} color="#fff" /> Connecting...</>
                                    : inputCode.length === 4
                                        ? `📡 Cast to ${inputCode.toUpperCase()}`
                                        : '📺 Select or enter a screen code'}
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </>
    );
};

export default CastModal;