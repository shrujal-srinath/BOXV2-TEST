// src/components/CastModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { validateTvCode, castGameToTv, stopCastingToTv, subscribeTvStatus, type TvDisplay } from '../services/tvDisplayService';
import { supabase } from '../services/supabase'; // <-- Added to query state

interface CastModalProps {
    gameCode: string;
    onClose: () => void;
}

type CastPhase = 'loading' | 'input' | 'searching' | 'success' | 'casting' | 'error';

// ─── Code Input (Optimized for iPads & Tablets) ───────────────────────────────
const CodeInput: React.FC<{ value: string; onChange: (v: string) => void; disabled: boolean }> = ({ value, onChange, disabled }) => {
    const chars = value.toUpperCase().split('').slice(0, 4);
    while (chars.length < 4) chars.push('');

    return (
        <div className="flex gap-3 justify-center relative">
            {chars.map((char, i) => (
                <div key={i} className={`w-14 h-16 flex items-center justify-center text-3xl font-black font-mono rounded-lg border-2 transition-all ${char ? 'border-red-600 bg-red-950/20 text-white shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'border-zinc-800 bg-black text-zinc-700'}`}>
                    {char || '·'}
                </div>
            ))}
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4))}
                disabled={disabled}
                maxLength={4}
                autoFocus
                // CRITICAL UX FIXES FOR iPAD/TABLET:
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                autoCapitalize="characters"
                className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
            />
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const CastModal: React.FC<CastModalProps> = ({ gameCode, onClose }) => {
    const [phase, setPhase] = useState<CastPhase>('loading');
    const [tvCodeInput, setTvCodeInput] = useState('');
    const [activeTvCode, setActiveTvCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [tvStatus, setTvStatus] = useState<TvDisplay | null>(null);
    const unsubRef = useRef<(() => void) | null>(null);

    // ─── THE FIX: INSTANT STATE RECOVERY ───
    useEffect(() => {
        const checkExistingCast = async () => {
            const { data } = await supabase
                .from('tv_displays')
                .select('*')
                .eq('game_code', gameCode)
                .limit(1);

            if (data && data.length > 0 && data[0].tv_code) {
                // We are ALREADY casting this game! Resume the dashboard.
                const code = data[0].tv_code.toUpperCase();
                setActiveTvCode(code);
                setTvStatus(data[0] as TvDisplay);
                setPhase('casting');

                unsubRef.current = subscribeTvStatus(code, (d) => {
                    setTvStatus(d);
                    if (d.status === 'idle') {
                        setPhase('input');
                        setTvCodeInput('');
                    }
                });
            } else {
                // Not casting, show input screen
                setPhase('input');
            }
        };

        checkExistingCast();

        return () => unsubRef.current?.();
    }, [gameCode]);

    const handleCast = async () => {
        if (tvCodeInput.length < 4) return;
        setPhase('searching');
        setErrorMsg('');

        const { valid, message } = await validateTvCode(tvCodeInput);
        if (!valid) {
            setTimeout(() => { setPhase('error'); setErrorMsg(message); }, 800);
            return;
        }

        const result = await castGameToTv(tvCodeInput, gameCode);
        if (!result.success) {
            setPhase('error');
            setErrorMsg(result.message);
            return;
        }

        const code = tvCodeInput.toUpperCase();
        setActiveTvCode(code);
        setPhase('success');

        setTimeout(() => {
            setPhase('casting');
            unsubRef.current = subscribeTvStatus(code, (d) => {
                setTvStatus(d);
                if (d.status === 'idle') {
                    setPhase('input');
                    setTvCodeInput('');
                }
            });
        }, 1500);
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

    const isOnline = tvStatus ? Date.now() - tvStatus.last_seen < 20000 : true;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] relative animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 pb-0 flex justify-between items-start">
                    <div>
                        <div className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] mb-1">LED Cast Control</div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">
                            {phase === 'casting' ? 'Live Telemetry' : 'Establish Link'}
                        </h2>
                    </div>
                    {phase !== 'searching' && phase !== 'success' && phase !== 'loading' && (
                        <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl transition-colors">&times;</button>
                    )}
                </div>

                <div className="p-6 min-h-[250px] flex flex-col justify-center">
                    {/* ── LOADING PHASE ── */}
                    {phase === 'loading' && (
                        <div className="flex justify-center animate-pulse text-zinc-600 uppercase tracking-widest text-xs font-bold">
                            Checking Signal...
                        </div>
                    )}

                    {/* ── INPUT PHASE ── */}
                    {(phase === 'input' || phase === 'error') && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 w-full">
                            <p className="text-xs text-zinc-400 font-mono mb-6 text-center">Enter the 4-digit code displayed on the arena screen.</p>
                            <CodeInput value={tvCodeInput} onChange={setTvCodeInput} disabled={false} />

                            {phase === 'error' && (
                                <div className="mt-4 p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-center">
                                    <p className="text-xs text-red-500 font-bold uppercase tracking-widest">{errorMsg}</p>
                                </div>
                            )}

                            <button
                                onClick={handleCast}
                                disabled={tvCodeInput.length < 4}
                                className={`mt-8 w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${tvCodeInput.length === 4 ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}
                            >
                                Initiate Cast 📡
                            </button>
                        </div>
                    )}

                    {/* ── SEARCHING PHASE ── */}
                    {phase === 'searching' && (
                        <div className="flex flex-col items-center justify-center animate-in fade-in">
                            <div className="relative w-20 h-20 flex items-center justify-center mb-6">
                                <div className="absolute inset-0 border-2 border-red-600 rounded-full animate-ping opacity-20"></div>
                                <div className="absolute inset-2 border-2 border-red-600 rounded-full animate-ping opacity-40" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-12 h-12 bg-red-600 rounded-full shadow-[0_0_30px_red]"></div>
                            </div>
                            <div className="text-sm font-bold text-white uppercase tracking-widest animate-pulse">Locating Terminal...</div>
                            <div className="text-xs text-zinc-500 font-mono mt-2">Target: {tvCodeInput.toUpperCase()}</div>
                        </div>
                    )}

                    {/* ── SUCCESS PHASE ── */}
                    {phase === 'success' && (
                        <div className="flex flex-col items-center justify-center animate-in zoom-in-95">
                            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(34,197,94,0.5)]">
                                <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div className="text-sm font-bold text-green-500 uppercase tracking-widest">Handshake Complete</div>
                        </div>
                    )}

                    {/* ── CASTING PHASE (TELEMETRY) ── */}
                    {phase === 'casting' && (
                        <div className="animate-in slide-in-from-bottom-4 w-full">
                            <div className="bg-black border border-zinc-800 rounded-xl p-4 mb-6">
                                <div className="flex justify-between items-center mb-3 pb-3 border-b border-zinc-900">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Target Screen</span>
                                    <span className="text-lg font-black text-white tracking-widest">{activeTvCode}</span>
                                </div>
                                <div className="flex justify-between items-center mb-3 pb-3 border-b border-zinc-900">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Stream Source</span>
                                    <span className="text-xs font-bold text-blue-400 font-mono">{gameCode}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Connection</span>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`}></div>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
                                            {isOnline ? 'STABLE' : 'DROPPED'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleStop} className="w-full py-4 border border-zinc-700 text-zinc-300 hover:bg-red-950/30 hover:border-red-900/50 hover:text-red-500 rounded-xl font-bold uppercase tracking-widest text-xs transition-all">
                                Terminate Cast ⏹
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CastModal;