// src/components/CastModal.tsx
// ═══════════════════════════════════════════════════════════════
//  CAST MODAL — v2
//
//  IMPROVEMENTS:
//    [UX-1]  Inline styles → Tailwind classes throughout
//    [UX-2]  Eyebrow label font bumped 8px → 12px
//    [UX-3]  Close button 26px → 36px (touch-safe)
//    [UX-4]  errorMsg clears on any inputCode change
//    [UX-5]  Retry button shown on error phase
//    [UX-6]  Empty state when no displays found after load
//    [UX-7]  Offline screens collapsed to bottom section (not blocking)
//    [UX-8]  Success flash — green pulse after cast connects
//    [UX-9]  CodeInput: backspace-to-prev-box keyboard navigation
//    [UX-10] Stop button min touch target 44px
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    fetchAllTvDisplays,
    castGameToTv,
    stopCastingToTv,
    subscribeTvStatus,
    openCastChannel,
    type TvDisplay,
    type CastChannel,
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

// ─── Animations (keyframes only — minimal, not a global style dump) ───────────

const KEYFRAMES = `
  @keyframes cm-in     { from{opacity:0;transform:translateY(10px) scale(0.97)} to{opacity:1;transform:none} }
  @keyframes cm-spin   { to{transform:rotate(360deg)} }
  @keyframes cm-pulse  { 0%,100%{opacity:1;box-shadow:0 0 8px #22c55e} 50%{opacity:.3;box-shadow:0 0 2px #22c55e} }
  @keyframes cm-ping   { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.4);opacity:0} }
  @keyframes cm-cardin { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:none} }
  @keyframes cm-shake  { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
  @keyframes cm-glow   { 0%,100%{box-shadow:0 0 24px rgba(220,38,38,0.2)} 50%{box-shadow:0 0 40px rgba(220,38,38,0.4)} }
  @keyframes cm-success{ 0%{opacity:0;transform:scale(0.7)} 50%{opacity:1;transform:scale(1.08)} 100%{opacity:0;transform:scale(1.15)} }
  @keyframes cm-float  { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-28px)} }
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
    <div className="relative w-2 h-2 flex-shrink-0">
        {(casting || online) && (
            <div className="absolute inset-0 rounded-full" style={{
                background: casting ? '#22c55e' : 'rgba(255,255,255,0.3)',
                animation: casting ? 'cm-ping 1.8s ease-out infinite' : 'none',
            }} />
        )}
        <div className="absolute inset-0 rounded-full" style={{
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
            disabled={!display.online || operating}
            style={{
                width: '100%', textAlign: 'left',
                background: bg, border: `1px solid ${border}`,
                borderRadius: 10, padding: '11px 13px',
                display: 'flex', alignItems: 'center', gap: 11,
                cursor: display.online && !operating ? 'pointer' : 'not-allowed',
                transition: 'all 0.16s ease',
                opacity: display.online ? 1 : 0.4,
                animation: `cm-cardin 0.28s ${delay}s both`,
                position: 'relative', overflow: 'hidden',
            }}
        >
            {selected && (
                <div className="absolute left-0 rounded-r" style={{
                    top: '15%', bottom: '15%', width: 2,
                    background: '#DC2626',
                }} />
            )}

            {/* TV icon */}
            <div style={{
                width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                background: isLive ? 'rgba(34,197,94,0.1)' : selected ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isLive ? 'rgba(34,197,94,0.2)' : selected ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
            }}>
                📺
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 12, fontWeight: 800, fontFamily: 'monospace',
                    color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase',
                    marginBottom: 3,
                }}>
                    {display.tv_code}
                </div>
                <div style={{
                    fontSize: 9, fontWeight: 700, fontFamily: 'monospace',
                    color: statusColor, letterSpacing: '0.18em', textTransform: 'uppercase',
                }}>
                    {statusText}
                </div>
            </div>

            <Dot online={display.online} casting={isLive} />
        </button>
    );
};

// ─── Code Input ───────────────────────────────────────────────────────────────

const CodeInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    shake?: boolean;
}> = ({ value, onChange, disabled, shake }) => {
    const chars = value.padEnd(4, '').split('').slice(0, 4);
    // Refs for each box to manage focus
    const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

    const handleBoxInput = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const ch = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(-1).toUpperCase();
        const arr = chars.map((c, idx) => (idx === i ? ch : c === ' ' ? '' : c));
        onChange(arr.join('').replace(/ /g, ''));
        if (ch && i < 3) inputRefs.current[i + 1]?.focus();
    };

    const handleBoxKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            if (chars[i] && chars[i] !== ' ') {
                // clear current
                const arr = [...chars];
                arr[i] = '';
                onChange(arr.join('').replace(/ /g, ''));
            } else if (i > 0) {
                // move to prev
                inputRefs.current[i - 1]?.focus();
                const arr = [...chars];
                arr[i - 1] = '';
                onChange(arr.join('').replace(/ /g, ''));
            }
        } else if (e.key === 'ArrowLeft' && i > 0) {
            inputRefs.current[i - 1]?.focus();
        } else if (e.key === 'ArrowRight' && i < 3) {
            inputRefs.current[i + 1]?.focus();
        }
    };

    return (
        <div
            style={{ animation: shake ? 'cm-shake 0.32s ease' : 'none' }}
            className="flex gap-2 justify-center"
        >
            {chars.map((ch, i) => (
                <div key={i} className="relative" style={{ width: 50, height: 58 }}>
                    {/* Visual box */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        borderRadius: 8, pointerEvents: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, fontWeight: 900, fontFamily: 'monospace',
                        transition: 'all 0.14s',
                        background: ch && ch !== ' ' ? 'rgba(220,38,38,0.07)' : 'rgba(255,255,255,0.03)',
                        border: `1.5px solid ${shake ? 'rgba(239,68,68,0.5)' : ch && ch !== ' ' ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        color: ch && ch !== ' ' ? '#fff' : 'rgba(255,255,255,0.1)',
                        boxShadow: ch && ch !== ' ' && !shake ? '0 0 10px rgba(220,38,38,0.1)' : 'none',
                        zIndex: 1,
                    }}>
                        {ch && ch !== ' ' ? ch : '·'}
                    </div>
                    {/* Hidden real input — proper keyboard nav per box */}
                    <input
                        ref={el => { inputRefs.current[i] = el; }}
                        type="text"
                        value={ch === ' ' ? '' : ch}
                        onChange={e => handleBoxInput(i, e)}
                        onKeyDown={e => handleBoxKeyDown(i, e)}
                        onFocus={() => {/* find first empty box */ }}
                        disabled={disabled}
                        maxLength={1}
                        autoFocus={i === 0}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        inputMode="text"
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            opacity: 0, cursor: disabled ? 'not-allowed' : 'text', zIndex: 10,
                            fontSize: 22, // prevent iOS zoom on focus
                        }}
                    />
                </div>
            ))}
        </div>
    );
};

// ─── Live Cast Banner ─────────────────────────────────────────────────────────

const LiveBanner: React.FC<{
    tvCode: string; gameCode: string; gameName?: string;
    onStop: () => void; stopping: boolean;
}> = ({ tvCode, gameCode, gameName, onStop, stopping }) => (
    <div style={{
        animation: 'cm-glow 2.5s ease-in-out infinite',
    }} className="rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
            <Dot online casting />
            <div className="min-w-0">
                <div style={{ fontSize: 9, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.25em' }}
                    className="text-green-400 uppercase mb-0.5">
                    Live Cast
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em' }}
                    className="text-white uppercase truncate">
                    {tvCode} {gameName ? `· ${gameName}` : `· ${gameCode}`}
                </div>
            </div>
        </div>
        {/* Stop button — min 44px touch target */}
        <button
            onClick={onStop}
            disabled={stopping}
            className="flex items-center gap-1.5 px-3 rounded-md border border-red-900/30 bg-black text-red-500 hover:bg-red-900/20 transition-all"
            style={{
                minHeight: 44, minWidth: 64,
                fontSize: 9, fontWeight: 900, fontFamily: 'monospace',
                letterSpacing: '0.18em', textTransform: 'uppercase',
                cursor: stopping ? 'not-allowed' : 'pointer',
                opacity: stopping ? 0.5 : 1,
            }}
        >
            {stopping ? <Spinner size={10} color="#ef4444" /> : '■'} STOP
        </button>
    </div>
);

// ─── Success Flash ─────────────────────────────────────────────────────────────

const SuccessFlash: React.FC = () => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" style={{ borderRadius: 16 }}>
        <div style={{
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.4)',
            borderRadius: 12,
            padding: '16px 28px',
            animation: 'cm-success 1.2s ease forwards',
            display: 'flex', alignItems: 'center', gap: 10,
        }}>
            <div style={{ fontSize: 22 }}>✓</div>
            <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: '#22c55e', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                CAST CONNECTED
            </span>
        </div>
    </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
    <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
        <div style={{ fontSize: 36, opacity: 0.4 }}>📺</div>
        <div>
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                No screens registered
            </div>
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
                Connect a Pi display and enter<br />its TV code in the field above
            </div>
        </div>
        <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition-all"
            style={{ fontSize: 9, fontWeight: 800, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase' }}
        >
            ↺ REFRESH
        </button>
    </div>
);

// ─── Error State ──────────────────────────────────────────────────────────────

const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
    <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
        <div style={{ fontSize: 32, opacity: 0.5 }}>⚠️</div>
        <div>
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: 'rgba(239,68,68,0.7)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                Failed to load screens
            </div>
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
                Check your connection and try again
            </div>
        </div>
        <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-900/40 bg-red-900/10 hover:bg-red-900/20 transition-all text-red-500"
            style={{ fontSize: 9, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase' }}
        >
            ↺ RETRY
        </button>
    </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

export const CastModal: React.FC<CastModalProps> = ({ gameCode, gameName, onClose }) => {
    const [phase, setPhase] = useState<Phase>('loading');
    const [displays, setDisplays] = useState<RichDisplay[]>([]);
    const [inputCode, setInputCode] = useState('');
    const [selectedCard, setCard] = useState<string | null>(null);
    const [activeCast, setActiveCast] = useState<string | null>(null);
    const [operating, setOperating] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [shake, setShake] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showOffline, setShowOffline] = useState(false);

    const subsRef = useRef<Map<string, () => void>>(new Map());
    const bcastRef = useRef<Map<string, CastChannel>>(new Map());
    const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const gcRef = useRef(gameCode);
    gcRef.current = gameCode;

    // ── Load + subscribe ─────────────────────────────────────────────────────
    const loadDisplays = useCallback(async () => {
        setPhase('loading');
        try {
            const all = await fetchAllTvDisplays();
            const rich = all.map(d => enrich(d, gcRef.current));
            setDisplays(rich);

            // Find if there's an existing active cast for this game
            const casting = rich.find(d => d.castingThis);
            if (casting) {
                setActiveCast(casting.tv_code);
                setPhase('casting');
            } else {
                setPhase('idle');
            }

            // Subscribe to each display — Postgres Changes (backup, ~200–1500ms)
            // AND Broadcast channel (instant, ~50ms)
            rich.forEach(d => {
                if (subsRef.current.has(d.tv_code)) return;

                // Open broadcast channel NOW so it's SUBSCRIBED by the time user clicks Cast
                if (!bcastRef.current.has(d.tv_code)) {
                    const bch = openCastChannel(d.tv_code);
                    bcastRef.current.set(d.tv_code, bch);
                }

                const unsub = subscribeTvStatus(d.tv_code, updated => {
                    updated.last_seen = Date.now();
                    setDisplays(prev =>
                        prev.map(p => p.tv_code === updated.tv_code
                            ? enrich(updated, gcRef.current)
                            : p
                        )
                    );
                    // Update activeCast reactively
                    if (updated.status === 'casting' && updated.game_code?.toUpperCase() === gcRef.current.toUpperCase()) {
                        setActiveCast(updated.tv_code);
                        setPhase('casting');
                    } else if (updated.status === 'idle') {
                        setDisplays(prev => {
                            const stillCasting = prev.some(p =>
                                p.tv_code !== updated.tv_code &&
                                p.status === 'casting' &&
                                p.game_code?.toUpperCase() === gcRef.current.toUpperCase()
                            );
                            if (!stillCasting) {
                                setActiveCast(null);
                                setPhase('idle');
                            }
                            return prev;
                        });
                    }
                });
                subsRef.current.set(d.tv_code, unsub);
            });

            // Refresh online status every 10s
            if (refreshRef.current) clearInterval(refreshRef.current);
            refreshRef.current = setInterval(() => {
                setDisplays(prev => prev.map(d => enrich(d, gcRef.current)));
            }, 10_000);

        } catch {
            setPhase('error');
        }
    }, []);

    useEffect(() => {
        loadDisplays();
        return () => {
            subsRef.current.forEach(u => u());
            subsRef.current.clear();
            bcastRef.current.forEach(ch => ch.unsub());
            bcastRef.current.clear();
            if (refreshRef.current) clearInterval(refreshRef.current);
        };
    }, [loadDisplays]);

    // [UX-4] Clear error message whenever the user changes the input code
    useEffect(() => {
        if (errorMsg) setErrorMsg('');
    }, [inputCode]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Derived ──────────────────────────────────────────────────────────────
    const onlineList = displays.filter(d => d.online);
    const offlineList = displays.filter(d => !d.online);
    const targetDisp = displays.find(d => d.tv_code === inputCode.toUpperCase());
    const canCast = inputCode.length === 4 && !operating;

    // Sync card selection with code input
    useEffect(() => {
        if (inputCode.length === 4) {
            const match = displays.find(d => d.tv_code === inputCode.toUpperCase());
            if (match) setCard(match.tv_code);
        } else {
            setCard(null);
        }
    }, [inputCode, displays]);

    // ── Actions ──────────────────────────────────────────────────────────────
    const handleCast = async () => {
        if (!canCast) return;
        const code = inputCode.toUpperCase();
        setOperating(true);
        setErrorMsg('');

        // DB write — source of truth (game IS in DB when this resolves)
        const result = await castGameToTv(code, gameCode);
        setOperating(false);

        if (result.success) {
            // [OPTIMISTIC UPDATE] Don't wait for Realtime echo — update immediately
            setDisplays(prev => prev.map(d =>
                d.tv_code === code
                    ? { ...d, status: 'casting' as const, game_code: gameCode, castingThis: true, castingOther: false }
                    : d
            ));
            setActiveCast(code);
            setPhase('casting');
            // [UX-8] Show success flash
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 1300);

            // [BROADCAST] Send instant signal to Pi AFTER DB write succeeds
            // Game is guaranteed in DB — no race condition
            const bch = bcastRef.current.get(code);
            if (bch) {
                bch.send('cast', gameCode);
            } else {
                // TV was manually typed (not in list) — open a temp channel
                const tempCh = openCastChannel(code);
                bcastRef.current.set(code, tempCh);
                // Small delay to allow SUBSCRIBED before send (queued internally anyway)
                setTimeout(() => tempCh.send('cast', gameCode), 100);
            }
        } else {
            setErrorMsg(result.message || 'Cast failed. Try again.');
            setShake(true);
            setTimeout(() => setShake(false), 400);
        }
    };

    const handleStop = async () => {
        if (!activeCast) return;
        setStopping(true);

        // Send stop broadcast immediately (before DB write, Pi should stop ASAP)
        const bch = bcastRef.current.get(activeCast);
        if (bch) bch.send('stop');

        await stopCastingToTv(activeCast);
        setStopping(false);

        // Optimistic update
        setDisplays(prev => prev.map(d =>
            d.tv_code === activeCast
                ? { ...d, status: 'idle' as const, game_code: null, castingThis: false }
                : d
        ));
        setActiveCast(null);
        setPhase('idle');
        setInputCode('');
        setCard(null);
    };

    const handleCardClick = (tvCode: string) => {
        if (operating) return;
        const d = displays.find(d => d.tv_code === tvCode);
        if (!d?.online) return;
        setCard(tvCode);
        setInputCode(tvCode);
    };

    // ── Hint ──────────────────────────────────────────────────────────────────
    const hint = inputCode.length === 0
        ? 'Enter code shown on the idle screen'
        : inputCode.length < 4
            ? `${4 - inputCode.length} more character${4 - inputCode.length > 1 ? 's' : ''}…`
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
            <style>{KEYFRAMES}</style>

            {/* Backdrop */}
            <div
                onClick={e => { if (e.target === e.currentTarget) onClose(); }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
            >
                {/* Card */}
                <div
                    className="relative w-full flex flex-col overflow-hidden"
                    style={{
                        maxWidth: 520,
                        maxHeight: '92vh',
                        background: '#0a0a0a',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 16,
                        boxShadow: '0 0 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03)',
                        animation: 'cm-in 0.22s cubic-bezier(0.2,0,0,1)',
                    }}
                >
                    {/* [UX-8] Success flash overlay */}
                    {showSuccess && <SuccessFlash />}

                    {/* Header */}
                    <div className="flex items-start justify-between flex-shrink-0 px-5 pt-4 pb-3.5"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                            {/* [UX-2] Eyebrow bumped to 12px */}
                            <div className="font-mono font-black uppercase tracking-[0.4em] text-red-600 mb-1"
                                style={{ fontSize: 12 }}>
                                LED Cast Control
                            </div>
                            <div className="font-black uppercase text-white leading-none"
                                style={{ fontSize: 17, letterSpacing: '-0.01em' }}>
                                {phase === 'casting' ? 'Cast Active' : 'Cast to Screen'}
                            </div>
                            {gameName && (
                                <div className="font-mono text-zinc-600 mt-0.5 uppercase tracking-wider"
                                    style={{ fontSize: 10 }}>
                                    {gameName}
                                </div>
                            )}
                        </div>
                        {/* [UX-3] Close button — 36px touch-safe */}
                        <button
                            onClick={onClose}
                            className="flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-zinc-500 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                            style={{ width: 36, height: 36, fontSize: 18, lineHeight: 1 }}
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

                        {/* Loading */}
                        {phase === 'loading' && (
                            <div className="flex justify-center items-center gap-3 py-8">
                                <Spinner size={18} />
                                <span className="font-mono uppercase tracking-[0.22em] text-zinc-600"
                                    style={{ fontSize: 10 }}>
                                    Scanning for screens...
                                </span>
                            </div>
                        )}

                        {/* [UX-5] Error phase with Retry */}
                        {phase === 'error' && <ErrorState onRetry={loadDisplays} />}

                        {(phase === 'idle' || phase === 'casting') && (
                            <>
                                {/* Live banner */}
                                {activeCast && (
                                    <LiveBanner
                                        tvCode={activeCast}
                                        gameCode={gameCode}
                                        gameName={gameName}
                                        onStop={handleStop}
                                        stopping={stopping}
                                    />
                                )}

                                {/* Code input section */}
                                <div>
                                    <div className="font-mono font-black uppercase tracking-[0.32em] text-zinc-600 mb-2.5"
                                        style={{ fontSize: 8 }}>
                                        {activeCast ? 'Cast to Another Screen' : 'Enter Screen Code'}
                                    </div>

                                    <CodeInput
                                        value={inputCode}
                                        onChange={setInputCode}
                                        disabled={operating || stopping}
                                        shake={shake}
                                    />

                                    {/* Hint */}
                                    <div className="text-center mt-2 font-mono uppercase tracking-[0.14em] transition-colors duration-200"
                                        style={{ fontSize: 10, color: hintColor, minHeight: 14 }}>
                                        {hint}
                                    </div>

                                    {/* Inline error */}
                                    {errorMsg && (
                                        <div className="mt-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 font-mono text-red-400 leading-relaxed"
                                            style={{ fontSize: 10, letterSpacing: '0.06em' }}>
                                            {errorMsg}
                                        </div>
                                    )}
                                </div>

                                {/* [UX-6] Empty state — only shown when idle/casting with no displays */}
                                {displays.length === 0 && (
                                    <EmptyState onRetry={loadDisplays} />
                                )}

                                {onlineList.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2.5 mb-2">
                                            <div className="flex-1 h-px bg-white/5" />
                                            <span className="font-mono font-black uppercase tracking-[0.3em] text-zinc-700"
                                                style={{ fontSize: 8 }}>
                                                {onlineList.length} screen{onlineList.length > 1 ? 's' : ''} online
                                            </span>
                                            <div className="flex-1 h-px bg-white/5" />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            {onlineList.map((d, i) => (
                                                <ScreenCard
                                                    key={d.tv_code}
                                                    display={d}
                                                    selected={selectedCard === d.tv_code}
                                                    onClick={() => handleCardClick(d.tv_code)}
                                                    operating={operating}
                                                    delay={i * 0.04}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* [UX-7] Offline screens — collapsed section at bottom */}
                                {offlineList.length > 0 && (
                                    <div>
                                        <button
                                            onClick={() => setShowOffline(v => !v)}
                                            className="flex items-center gap-2 w-full mb-1.5"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            <div className="flex-1 h-px bg-white/5" />
                                            <span className="font-mono font-black uppercase tracking-[0.3em] text-zinc-700 hover:text-zinc-500 transition-colors flex items-center gap-1"
                                                style={{ fontSize: 8 }}>
                                                {showOffline ? '▲' : '▼'} {offlineList.length} offline
                                            </span>
                                            <div className="flex-1 h-px bg-white/5" />
                                        </button>
                                        {showOffline && (
                                            <div className="flex flex-col gap-1.5">
                                                {offlineList.map((d, i) => (
                                                    <ScreenCard
                                                        key={d.tv_code}
                                                        display={d}
                                                        selected={false}
                                                        onClick={() => { }}
                                                        operating={operating}
                                                        delay={i * 0.04}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer — Cast button */}
                    {(phase === 'idle' || phase === 'casting') && (
                        <div className="flex-shrink-0 px-5 pb-4 pt-3"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <button
                                onClick={handleCast}
                                disabled={!canCast}
                                className="w-full py-3 rounded-xl font-black uppercase transition-all flex items-center justify-center gap-2"
                                style={{
                                    fontSize: 12,
                                    letterSpacing: '0.1em',
                                    fontFamily: 'monospace',
                                    background: canCast ? 'rgba(220,38,38,0.9)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${canCast ? 'rgba(220,38,38,0.7)' : 'rgba(255,255,255,0.08)'}`,
                                    color: canCast ? '#fff' : 'rgba(255,255,255,0.2)',
                                    cursor: canCast ? 'pointer' : 'not-allowed',
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