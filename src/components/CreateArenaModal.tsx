// src/components/CreateArenaModal.tsx
// Multi-step modal for creating an Arena Session.
// Steps: Configure → Add Method → Review → Session Ready

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
    createArenaSession,
    joinArenaSession,
    subscribeToArenaSession,
    type ArenaSession,
} from '../services/arenaSessionService';
import type { User } from '@supabase/supabase-js';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateArenaModalProps {
    user: User | null;
    onClose: () => void;
    onCreated?: (session: ArenaSession) => void;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

const StepDot: React.FC<{ n: number; label: string; active: boolean; done: boolean }> = ({ n, label, active, done }) => (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${done ? 'bg-green-600 text-white' : active ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600'}`}>
            {done ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            ) : n}
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${active ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-zinc-600'}`}>{label}</span>
    </div>
);

const StepConnector: React.FC<{ done: boolean }> = ({ done }) => (
    <div className={`flex-1 h-px mt-[-14px] transition-colors ${done ? 'bg-green-600' : 'bg-slate-200 dark:bg-zinc-800'}`} />
);

// ─── Layout Preview Card ──────────────────────────────────────────────────────

const LayoutCard: React.FC<{ courts: number; selected: boolean; onClick: () => void }> = ({ courts, selected, onClick }) => {
    const previewCells = Array.from({ length: courts });
    const cols = courts <= 2 ? courts : courts <= 4 ? 2 : 3;
    const rows = courts <= 2 ? 1 : courts <= 4 ? 2 : 2;

    return (
        <button
            onClick={onClick}
            className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${selected ? 'border-red-600 bg-red-50 dark:bg-red-950/20' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'}`}
        >
            <div
                style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 2, width: 48, height: 32 }}
            >
                {previewCells.map((_, i) => (
                    <div key={i} className={`rounded-[2px] transition-colors ${selected ? 'bg-red-400' : 'bg-slate-200 dark:bg-zinc-700'}`} />
                ))}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${selected ? 'text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-zinc-500'}`}>
                {courts} courts
            </span>
        </button>
    );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

export const CreateArenaModal: React.FC<CreateArenaModalProps> = ({ user, onClose, onCreated }) => {
    const [step, setStep] = useState(1);
    const [label, setLabel] = useState('Arena Session');
    const [courts, setCourts] = useState<2 | 4 | 6>(4);
    const [joinMode, setJoinMode] = useState<'open' | 'approval'>('open');
    const [addMethod, setAddMethod] = useState<'cast' | 'manual'>('cast');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [session, setSession] = useState<ArenaSession | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [manualCode, setManualCode] = useState('');
    const [addingManual, setAddingManual] = useState(false);
    const [manualMsg, setManualMsg] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const subRef = useRef<(() => void) | null>(null);

    const arenaUrl = session
        ? `${window.location.origin}/arena/${session.arena_code}`
        : '';

    // Generate QR when session ready
    useEffect(() => {
        if (!arenaUrl) return;
        QRCode.toDataURL(arenaUrl, { width: 120, margin: 1, color: { dark: '#ffffff', light: '#00000000' } })
            .then(setQrDataUrl)
            .catch(() => { });
    }, [arenaUrl]);

    // Subscribe to realtime session updates once created
    useEffect(() => {
        if (!session) return;
        const unsub = subscribeToArenaSession(session.arena_code, setSession);
        subRef.current = unsub;
        return () => { unsub(); };
    }, [session?.arena_code]);

    // Cleanup on close
    useEffect(() => {
        return () => { subRef.current?.(); };
    }, []);

    const layoutValue = courts === 2 ? '1x2' : courts === 4 ? '2x2' : '3x2';

    const handleCreate = async () => {
        if (!user) return;
        setCreating(true);
        setCreateError('');
        try {
            const { session: created } = await createArenaSession({
                label: label.trim() || 'Arena Session',
                layout: layoutValue,
                maxSlots: courts,
                joinMode,
                userId: user.id,
            });
            setSession(created);
            onCreated?.(created);
            setStep(4);
        } catch (e: any) {
            setCreateError(e.message || 'Failed to create session.');
        } finally {
            setCreating(false);
        }
    };

    const handleAddManual = async () => {
        if (!session || manualCode.length < 4) return;
        setAddingManual(true);
        setManualMsg('');
        const result = await joinArenaSession(session.arena_code, manualCode, { requesterId: user?.id });
        setManualMsg(result.message);
        if (result.success) setManualCode('');
        setAddingManual(false);
    };

    const copyUrl = () => { navigator.clipboard.writeText(arenaUrl).catch(() => { }); };

    const inp = 'w-full rounded-xl border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 px-4 py-3 text-sm outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:focus:border-violet-500 dark:focus:ring-violet-500/10';

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && step !== 4) onClose(); }}
        >
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
                style={{ maxHeight: '92vh' }}>

                {/* Sticky Header */}
                <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-900">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-0.5">Multi-Court Display</div>
                            <h2 className="text-base font-black text-slate-900 dark:text-white">
                                {step < 4 ? 'Create Arena Session' : 'Session Ready'}
                            </h2>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 dark:text-zinc-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all text-xl leading-none">
                            ×
                        </button>
                    </div>

                    {/* Step indicator */}
                    {step < 4 && (
                        <div className="flex items-center gap-1">
                            <StepDot n={1} label="Configure" active={step === 1} done={step > 1} />
                            <StepConnector done={step > 1} />
                            <StepDot n={2} label="Add Method" active={step === 2} done={step > 2} />
                            <StepConnector done={step > 2} />
                            <StepDot n={3} label="Review" active={step === 3} done={step > 3} />
                        </div>
                    )}
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">

                    {/* ── Step 1: Configure ── */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wide block mb-2">
                                    Session Name <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider ml-1">Required</span>
                                </label>
                                <input
                                    className={inp}
                                    value={label}
                                    onChange={e => setLabel(e.target.value)}
                                    placeholder="e.g. Friday Night Runs"
                                    maxLength={60}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wide block mb-3">Court Count</label>
                                <div className="flex gap-3">
                                    {([2, 4, 6] as const).map(n => (
                                        <LayoutCard key={n} courts={n} selected={courts === n} onClick={() => setCourts(n)} />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wide block mb-3">Join Permission</label>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => setJoinMode('open')}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${joinMode === 'open' ? 'border-red-600 bg-red-50 dark:bg-red-950/20' : 'border-slate-200 dark:border-zinc-700'}`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">Open Access</span>
                                            {joinMode === 'open' && <span className="text-[9px] font-bold text-red-600 uppercase tracking-wider bg-red-100 dark:bg-red-950/40 px-2 py-0.5 rounded-full">Recommended</span>}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-zinc-500">Best for casual sessions — scorers cast in without approval.</p>
                                    </button>

                                    <button
                                        onClick={() => setJoinMode('approval')}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${joinMode === 'approval' ? 'border-red-600 bg-red-50 dark:bg-red-950/20' : 'border-slate-200 dark:border-zinc-700'}`}
                                    >
                                        <div className="mb-1">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">Approval Required</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-zinc-500">Best for organized events — you approve each court before it appears on screen.</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Add Method ── */}
                    {step === 2 && (
                        <div className="space-y-3">
                            <button
                                onClick={() => setAddMethod('cast')}
                                className={`w-full text-left p-5 rounded-xl border-2 transition-all ${addMethod === 'cast' ? 'border-red-600 bg-red-50 dark:bg-red-950/20' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${addMethod === 'cast' ? 'bg-red-600' : 'bg-slate-100 dark:bg-zinc-800'}`}>
                                        <svg className={`w-5 h-5 ${addMethod === 'cast' ? 'text-white' : 'text-slate-400 dark:text-zinc-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">Cast Mode</span>
                                            <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Recommended</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-zinc-500">The arena generates a code. Share it with scorers — they enter it in their Cast panel.</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => setAddMethod('manual')}
                                className={`w-full text-left p-5 rounded-xl border-2 transition-all ${addMethod === 'manual' ? 'border-red-600 bg-red-50 dark:bg-red-950/20' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${addMethod === 'manual' ? 'bg-red-600' : 'bg-slate-100 dark:bg-zinc-800'}`}>
                                        <svg className={`w-5 h-5 ${addMethod === 'manual' ? 'text-white' : 'text-slate-400 dark:text-zinc-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <div className="mb-1">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">Manual Mode</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-zinc-500">You'll input game codes yourself after creation. You control which games appear.</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* ── Step 3: Review ── */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-zinc-800">
                                    <span className="text-xs text-slate-500 dark:text-zinc-500 uppercase tracking-widest font-bold">Session Name</span>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{label}</span>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-zinc-800">
                                    <span className="text-xs text-slate-500 dark:text-zinc-500 uppercase tracking-widest font-bold">Courts</span>
                                    <div className="flex items-center gap-2">
                                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${courts <= 2 ? courts : courts <= 4 ? 2 : 3}, 1fr)`, gap: 2, width: 28 }}>
                                            {Array.from({ length: courts }).map((_, i) => (
                                                <div key={i} className="bg-red-500 rounded-[1px]" style={{ height: 8 }} />
                                            ))}
                                        </div>
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">{courts} courts ({layoutValue})</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-zinc-800">
                                    <span className="text-xs text-slate-500 dark:text-zinc-500 uppercase tracking-widest font-bold">Join Mode</span>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">{joinMode === 'open' ? 'Open Access' : 'Approval Required'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500 dark:text-zinc-500 uppercase tracking-widest font-bold">Add Method</span>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{addMethod === 'cast' ? 'Cast Mode' : 'Manual Mode'}</span>
                                </div>
                            </div>

                            {createError && (
                                <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 text-xs">
                                    {createError}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 4: Session Ready ── */}
                    {step === 4 && session && (
                        <div className="space-y-5 text-center">
                            {/* Success badge */}
                            <div className="flex justify-center">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-950/40 border border-green-300 dark:border-green-900/60 text-green-700 dark:text-green-400 text-xs font-bold uppercase tracking-widest">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    Session Active
                                </div>
                            </div>

                            {/* Arena code display */}
                            <div>
                                <div className="text-xs text-slate-400 dark:text-zinc-600 uppercase tracking-widest font-bold mb-3">Arena Code</div>
                                <div className="flex items-center justify-center gap-3">
                                    <span className="text-slate-400 dark:text-zinc-700 text-3xl font-black">[</span>
                                    <span className="text-7xl font-black tracking-widest font-mono text-slate-900 dark:text-white leading-none">
                                        {session.arena_code}
                                    </span>
                                    <span className="text-slate-400 dark:text-zinc-700 text-3xl font-black">]</span>
                                </div>
                            </div>

                            {/* URL + copy */}
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3">
                                <span className="flex-1 text-xs font-mono text-slate-500 dark:text-zinc-500 truncate text-left">{arenaUrl}</span>
                                <button onClick={copyUrl} className="flex-shrink-0 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 transition-colors">
                                    Copy
                                </button>
                            </div>

                            {/* QR code */}
                            {qrDataUrl && (
                                <div className="flex justify-center">
                                    <div className="p-3 bg-black rounded-xl border border-zinc-800">
                                        <img src={qrDataUrl} alt="Arena QR" width={120} height={120} />
                                    </div>
                                </div>
                            )}

                            {/* Slot grid */}
                            <div>
                                <div className="text-xs text-slate-400 dark:text-zinc-600 uppercase tracking-widest font-bold mb-3">Live Courts</div>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: `repeat(${courts <= 2 ? courts : courts <= 4 ? 2 : 3}, 1fr)`, gap: 8 }}
                                >
                                    {Array.from({ length: courts }).map((_, i) => {
                                        const gc = session.game_codes[i];
                                        return (
                                            <div key={i} className={`rounded-xl border-2 p-3 transition-all text-center ${gc ? 'border-green-500 bg-green-50 dark:bg-green-950/20 animate-in fade-in zoom-in-95 duration-300' : 'border-dashed border-slate-200 dark:border-zinc-800'}`}>
                                                <div className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${gc ? 'text-green-700 dark:text-green-400' : 'text-slate-300 dark:text-zinc-700'}`}>Court {i + 1}</div>
                                                {gc ? (
                                                    <div className="text-xs font-mono font-bold text-green-800 dark:text-green-300">{gc}</div>
                                                ) : (
                                                    <div className="text-[10px] text-slate-300 dark:text-zinc-700">Waiting...</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Cast mode instructions */}
                            {addMethod === 'cast' && (
                                <div className="text-xs text-slate-500 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 text-left leading-relaxed">
                                    Share code <strong className="text-slate-900 dark:text-white font-mono">{session.arena_code}</strong> with your scorers. They enter it in their Cast panel → Arena tab.
                                </div>
                            )}

                            {/* Manual mode input */}
                            {addMethod === 'manual' && (
                                <div className="space-y-2">
                                    <div className="text-xs text-slate-500 dark:text-zinc-500 text-left font-bold uppercase tracking-widest">Add Game Code</div>
                                    <div className="flex gap-2">
                                        <input
                                            className={inp + ' flex-1'}
                                            value={manualCode}
                                            onChange={e => setManualCode(e.target.value.toUpperCase())}
                                            placeholder="GAME CODE"
                                            maxLength={6}
                                        />
                                        <button
                                            onClick={handleAddManual}
                                            disabled={addingManual || manualCode.length < 4}
                                            className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-colors"
                                        >
                                            {addingManual ? '...' : '+ Add'}
                                        </button>
                                    </div>
                                    {manualMsg && (
                                        <div className="text-xs text-slate-600 dark:text-zinc-400 text-left">{manualMsg}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Fixed bottom bar */}
                <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 dark:border-zinc-900 flex gap-3">
                    {step === 1 && (
                        <>
                            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={() => setStep(2)}
                                disabled={!label.trim()}
                                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-40 transition-colors"
                            >
                                Next →
                            </button>
                        </>
                    )}
                    {step === 2 && (
                        <>
                            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                                ← Back
                            </button>
                            <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors">
                                Next →
                            </button>
                        </>
                    )}
                    {step === 3 && (
                        <>
                            <button onClick={() => setStep(2)} disabled={creating} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-40">
                                ← Back
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={creating}
                                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                            >
                                {creating ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Creating...
                                    </>
                                ) : 'Create Arena Session'}
                            </button>
                        </>
                    )}
                    {step === 4 && session && (
                        <>
                            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                                Done
                            </button>
                            <button
                                onClick={() => window.open(`/arena/${session.arena_code}`, '_blank')}
                                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                            >
                                Open Display Screen →
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateArenaModal;
