// src/pages/CreateArenaPage.tsx
// Full-page arena session creator — single step, light mode, full-width layout.

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
    createArenaSession,
    joinArenaSession,
    subscribeToArenaSession,
    generateArenaCode,
    type ArenaSession,
} from '../services/arenaSessionService';
import { subscribeToAuth } from '../services/authService';
import type { User } from '@supabase/supabase-js';

// ─── Input class ──────────────────────────────────────────────────────────────

const inp = [
    'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-150',
    'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400',
    'focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10',
].join(' ');

// ─── Display Mode types & config ─────────────────────────────────────────────

type DisplayMode = 'grid' | 'row' | 'carousel' | 'spotlight';

const DISPLAY_MODES: { key: DisplayMode; label: string; desc: string }[] = [
    { key: 'grid',      label: 'Grid',         desc: 'All courts equal' },
    { key: 'row',       label: 'Side by side',  desc: 'Single row' },
    { key: 'carousel',  label: 'Auto-rotate',   desc: 'One at a time' },
    { key: 'spotlight', label: 'Spotlight',     desc: 'Feature + sidebar' },
];

// ─── Display Mode Icons ───────────────────────────────────────────────────────

const ModeIcon: React.FC<{ mode: DisplayMode; active: boolean }> = ({ mode, active }) => {
    const color = active ? '#DC2626' : '#94a3b8';
    if (mode === 'grid') return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill={color}>
            <rect x="2" y="2" width="11" height="11" rx="2" />
            <rect x="15" y="2" width="11" height="11" rx="2" />
            <rect x="2" y="15" width="11" height="11" rx="2" />
            <rect x="15" y="15" width="11" height="11" rx="2" />
        </svg>
    );
    if (mode === 'row') return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill={color}>
            <rect x="2" y="7" width="6" height="14" rx="2" />
            <rect x="11" y="7" width="6" height="14" rx="2" />
            <rect x="20" y="7" width="6" height="14" rx="2" />
        </svg>
    );
    if (mode === 'carousel') return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill={color}>
            <rect x="6" y="4" width="16" height="17" rx="2" />
            <rect x="7" y="23" width="4" height="3" rx="1.5" />
            <rect x="12" y="23" width="4" height="3" rx="1.5" opacity="0.35" />
            <rect x="17" y="23" width="4" height="3" rx="1.5" opacity="0.35" />
            <path d="M3 12.5l3-3v6l-3-3z" opacity="0.5" />
            <path d="M25 12.5l-3-3v6l3-3z" opacity="0.5" />
        </svg>
    );
    return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill={color}>
            <rect x="2" y="2" width="16" height="24" rx="2" />
            <rect x="20" y="2" width="6" height="7" rx="1.5" opacity="0.7" />
            <rect x="20" y="11" width="6" height="7" rx="1.5" opacity="0.7" />
            <rect x="20" y="20" width="6" height="6" rx="1.5" opacity="0.7" />
        </svg>
    );
};

// ─── Display Mode Visual Preview ──────────────────────────────────────────────

const DisplayModePreview: React.FC<{ mode: DisplayMode; courts: number }> = ({ mode, courts }) => {
    const n = Math.max(1, courts);

    if (mode === 'grid') {
        const cols = n <= 2 ? n : n <= 4 ? 2 : n <= 9 ? 3 : 4;
        return (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 5, height: 160 }}>
                {Array.from({ length: n }).map((_, i) => (
                    <div key={i} className="bg-slate-100 border border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1">
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">C{i + 1}</div>
                        <div className="w-8 h-1 rounded-full bg-slate-300" />
                    </div>
                ))}
            </div>
        );
    }

    if (mode === 'row') {
        return (
            <div style={{ display: 'flex', gap: 5, height: 160 }}>
                {Array.from({ length: n }).map((_, i) => (
                    <div key={i} style={{ flex: 1 }} className="bg-slate-100 border border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 min-w-0">
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">C{i + 1}</div>
                        <div className="w-full max-w-[20px] h-1 rounded-full bg-slate-300" />
                    </div>
                ))}
            </div>
        );
    }

    if (mode === 'carousel') {
        return (
            <div style={{ height: 160, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }} className="bg-slate-100 border-2 border-red-200 rounded-xl flex flex-col items-center justify-center gap-2">
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Court 1 of {n}</div>
                    <div className="w-12 h-1 rounded-full bg-slate-300" />
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 text-sm font-bold">‹</div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 text-sm font-bold">›</div>
                </div>
                <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: Math.min(n, 6) }).map((_, i) => (
                        <div key={i} className={`rounded-full ${i === 0 ? 'w-4 h-2 bg-red-500' : 'w-2 h-2 bg-slate-300'}`} />
                    ))}
                    {n > 6 && <div className="text-[9px] text-slate-400">+{n - 6}</div>}
                </div>
            </div>
        );
    }

    // Spotlight
    const sidebarCount = Math.max(0, n - 1);
    return (
        <div style={{ height: 160, display: 'flex', gap: 5 }}>
            <div style={{ flex: '0 0 62%' }} className="bg-slate-100 border-2 border-red-200 rounded-xl flex flex-col items-center justify-center gap-2">
                <div className="text-[8px] font-bold text-red-400 uppercase tracking-widest">Featured</div>
                <div className="text-[9px] font-bold text-slate-500">Court 1</div>
                <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {sidebarCount === 0
                    ? <div className="flex-1 bg-slate-50 border border-dashed border-slate-200 rounded-lg flex items-center justify-center"><span className="text-[8px] text-slate-300">More courts</span></div>
                    : Array.from({ length: Math.min(sidebarCount, 4) }).map((_, i) => (
                        <div key={i} style={{ flex: 1 }} className="bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center">
                            <span className="text-[8px] font-bold text-slate-400">C{i + 2}</span>
                        </div>
                    ))
                }
                {sidebarCount > 4 && <div className="text-[8px] text-slate-400 text-center">+{sidebarCount - 4} more</div>}
            </div>
        </div>
    );
};

// ─── Live court grid (after create) ──────────────────────────────────────────

const LiveCourtGrid: React.FC<{ codes: string[]; maxSlots: number }> = ({ codes, maxSlots }) => {
    const cols = maxSlots <= 3 ? maxSlots : maxSlots <= 6 ? 3 : 4;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>
            {Array.from({ length: maxSlots }).map((_, i) => {
                const gc = codes[i];
                return (
                    <div key={i} className={`rounded-lg p-2.5 text-center transition-all ${gc ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-dashed border-slate-200'}`}>
                        <div className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${gc ? 'text-green-600' : 'text-slate-300'}`}>C{i + 1}</div>
                        {gc
                            ? <div className="text-[10px] font-mono font-bold text-green-700 leading-tight">{gc}</div>
                            : <div className="text-[9px] text-slate-300">Waiting</div>
                        }
                    </div>
                );
            })}
        </div>
    );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'border-red-600' }) => (
    <h3 className={`text-sm font-bold text-slate-800 border-l-4 ${color} pl-3`}>{children}</h3>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">{children}</div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

export const CreateArenaPage: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);

    // Form state
    const [label, setLabel] = useState('Arena Session');
    const [courts, setCourts] = useState(4);
    const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');
    const [carouselInterval, setCarouselInterval] = useState(15);
    const [joinMode, setJoinMode] = useState<'open' | 'approval'>('open');

    // Pre-generated code shown immediately
    const [arenaCode, setArenaCode] = useState<string>('');
    const [codeLoading, setCodeLoading] = useState(true);

    // Create state
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [session, setSession] = useState<ArenaSession | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState('');

    // Pre-queue game codes (before create)
    const [showManualAdd, setShowManualAdd] = useState(false);
    const [queueInput, setQueueInput] = useState('');
    const [queuedCodes, setQueuedCodes] = useState<string[]>([]);

    // Post-create manual add
    const [manualCode, setManualCode] = useState('');
    const [addingManual, setAddingManual] = useState(false);
    const [manualMsg, setManualMsg] = useState('');

    const subRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        const unsub = subscribeToAuth(setUser);
        return unsub;
    }, []);

    useEffect(() => {
        return () => { subRef.current?.(); };
    }, []);

    // Generate code on mount so it's shown immediately
    useEffect(() => {
        setCodeLoading(true);
        generateArenaCode().then(code => {
            setArenaCode(code);
            setCodeLoading(false);
        });
    }, []);

    const arenaUrl = arenaCode ? `${window.location.origin}/arena/${arenaCode}` : '';

    useEffect(() => {
        if (!arenaUrl) return;
        QRCode.toDataURL(arenaUrl, { width: 160, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
            .then(setQrDataUrl).catch(() => { });
    }, [arenaUrl]);

    const layoutValue = courts <= 2 ? '1x2' : courts <= 4 ? '2x2' : '3x2';

    const handleQueueAdd = () => {
        const code = queueInput.trim().toUpperCase();
        if (code.length < 4) return;
        if (queuedCodes.includes(code)) { setQueueInput(''); return; }
        if (queuedCodes.length >= courts) return;
        setQueuedCodes(prev => [...prev, code]);
        setQueueInput('');
    };

    const handleCreate = async () => {
        if (!user) return;
        if (!label.trim()) { setCreateError('Session name is required.'); return; }
        setCreating(true);
        setCreateError('');
        try {
            const { session: created } = await createArenaSession({
                label: label.trim(),
                maxSlots: courts,
                layout: layoutValue,
                joinMode,
                displayMode,
                carouselIntervalSec: carouselInterval,
                userId: user.id,
                preGeneratedCode: arenaCode,
            });
            // Add any pre-queued game codes
            for (const gc of queuedCodes) {
                await joinArenaSession(created.arena_code, gc);
            }
            setSession(created);
            const unsub = subscribeToArenaSession(created.arena_code, setSession);
            subRef.current = unsub;
        } catch {
            setCreateError('Failed to create session. Please try again.');
        } finally {
            setCreating(false);
        }
    };

    const handleAddManual = async () => {
        if (!session || manualCode.length < 4) return;
        setAddingManual(true);
        setManualMsg('');
        const result = await joinArenaSession(session.arena_code, manualCode);
        setManualMsg(result.message);
        if (result.success) setManualCode('');
        setAddingManual(false);
    };

    const isSuccess = (msg: string) =>
        ['success', 'joined', 'already'].some(w => msg.toLowerCase().includes(w));

    return (
        <div className="min-h-dvh bg-[#F0EEE9]">

            {/* ── Top bar ── */}
            <header className="sticky top-0 z-40 bg-white [box-shadow:0_1px_0_rgba(0,0,0,0.08)] h-14 flex items-center px-6 gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Dashboard
                </button>
                <div className="flex-1 text-center">
                    <span className="text-sm font-black text-slate-900 uppercase tracking-tight">Create Arena Session</span>
                    {session && (
                        <span className="ml-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-50 border border-green-200 text-[10px] font-bold text-green-700 uppercase tracking-wide">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                            Live
                        </span>
                    )}
                </div>
                <div className="w-28" />
            </header>

            {/* ── Body ── */}
            <div className="max-w-[1400px] mx-auto px-6 py-8">
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_460px] gap-7 items-start">

                    {/* ══ LEFT — Configuration ══ */}
                    <div className="space-y-6">

                        {/* Session Name */}
                        <div className="bg-white rounded-2xl [box-shadow:0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)] p-6">
                            <div className="mb-5">
                                <div className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Multi-Court Display</div>
                                <SectionHeader>Configure Your Arena</SectionHeader>
                            </div>
                            <FieldLabel>
                                Session Name <span className="text-[9px] font-bold text-red-500 normal-case tracking-normal ml-1">Required</span>
                            </FieldLabel>
                            <input
                                className={inp}
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                placeholder="e.g. Friday Night Hoops"
                                disabled={!!session}
                            />
                        </div>

                        {/* Court count + Join permission */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl [box-shadow:0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)] p-6">
                                <FieldLabel>Court Count</FieldLabel>
                                <div className={`flex items-center gap-4 ${session ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <button onClick={() => setCourts(c => Math.max(2, c - 1))} disabled={courts <= 2}
                                        className="w-12 h-12 rounded-xl border-2 border-slate-200 flex items-center justify-center text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xl font-bold flex-shrink-0">−</button>
                                    <div className="flex-1 flex flex-col items-center gap-0.5">
                                        <span className="text-4xl font-black text-slate-900 tabular-nums leading-none">{courts}</span>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-1">Courts</span>
                                    </div>
                                    <button onClick={() => setCourts(c => Math.min(12, c + 1))} disabled={courts >= 12}
                                        className="w-12 h-12 rounded-xl border-2 border-slate-200 flex items-center justify-center text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xl font-bold flex-shrink-0">+</button>
                                </div>
                                <div className="mt-3 text-[10px] text-slate-400 text-center">min 2 · max 12</div>
                            </div>

                            <div className="bg-white rounded-2xl [box-shadow:0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)] p-6">
                                <FieldLabel>Join Permission</FieldLabel>
                                <div className={`space-y-2 ${session ? 'opacity-40 pointer-events-none' : ''}`}>
                                    {[
                                        { key: 'open',     label: 'Open Access',       desc: 'Scorers join instantly — no approval' },
                                        { key: 'approval', label: 'Approval Required', desc: 'You approve each scorer manually' },
                                    ].map(opt => (
                                        <button key={opt.key} onClick={() => setJoinMode(opt.key as 'open' | 'approval')}
                                            className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${joinMode === opt.key ? 'border-red-600 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${joinMode === opt.key ? 'border-red-600 bg-red-600' : 'border-slate-300'}`}>
                                                {joinMode === opt.key && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                            <div>
                                                <div className={`text-xs font-bold ${joinMode === opt.key ? 'text-red-700' : 'text-slate-700'}`}>{opt.label}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Display Mode */}
                        <div className="bg-white rounded-2xl [box-shadow:0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)] p-6">
                            <FieldLabel>Display Mode</FieldLabel>
                            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${session ? 'opacity-40 pointer-events-none' : ''}`}>
                                {DISPLAY_MODES.map(({ key, label: mLabel, desc }) => {
                                    const active = displayMode === key;
                                    return (
                                        <button key={key} onClick={() => setDisplayMode(key)}
                                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all text-center ${active ? 'border-red-600 bg-red-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                                            <ModeIcon mode={key} active={active} />
                                            <div>
                                                <div className={`text-xs font-bold uppercase tracking-wide ${active ? 'text-red-700' : 'text-slate-600'}`}>{mLabel}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">{desc}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            {displayMode === 'carousel' && !session && (
                                <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Rotate every</div>
                                    <div className="flex gap-2 flex-wrap">
                                        {[5, 10, 15, 30, 60].map(s => (
                                            <button key={s} onClick={() => setCarouselInterval(s)}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${carouselInterval === s ? 'bg-red-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                                {s}s
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* CTA / Locked */}
                        {!session ? (
                            <div>
                                {createError && <div className="text-sm text-red-600 mb-3">{createError}</div>}
                                <button onClick={handleCreate} disabled={creating || !label.trim() || codeLoading}
                                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 [box-shadow:0_2px_8px_rgba(220,38,38,0.35)]">
                                    {creating ? (
                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating session…</>
                                    ) : (
                                        <>Create Session <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg></>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 px-5 py-3.5 bg-green-50 border border-green-200 rounded-2xl">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
                                <span className="text-sm font-bold text-green-700">Session active — settings are locked</span>
                                <button onClick={() => navigate(`/arena/${session.arena_code}`)}
                                    className="ml-auto flex-shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5">
                                    Open Display <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ══ RIGHT — Code + Preview panel (sticky) ══ */}
                    <div className="space-y-5 xl:sticky xl:top-[72px]">

                        {/* Arena Code card — always visible */}
                        <div className="bg-white rounded-2xl [box-shadow:0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden">

                            {/* Code hero — dark bg, always showing */}
                            <div className={`px-5 pt-5 pb-4 transition-colors ${session ? 'bg-slate-900' : 'bg-slate-800'}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Arena Code</span>
                                    {session ? (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                            <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Live</span>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                            {codeLoading ? 'Generating…' : 'Ready'}
                                        </span>
                                    )}
                                </div>
                                <div className="text-center py-1">
                                    {codeLoading ? (
                                        <div className="flex items-center justify-center gap-3 py-2">
                                            <div className="w-5 h-5 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
                                            <span className="text-slate-500 text-sm font-mono">Checking availability…</span>
                                        </div>
                                    ) : (
                                        <div className="text-6xl font-black tracking-[0.4em] text-white font-mono leading-none py-1">
                                            {arenaCode}
                                        </div>
                                    )}
                                </div>
                                {/* URL row */}
                                {!codeLoading && (
                                    <div className="mt-3 flex items-center gap-2 bg-slate-700/60 rounded-xl px-3 py-2">
                                        <span className="flex-1 text-[10px] font-mono text-slate-400 truncate">{arenaUrl}</span>
                                        <button onClick={() => navigator.clipboard.writeText(arenaUrl).catch(() => { })}
                                            className="flex-shrink-0 text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider">
                                            Copy
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Card body */}
                            <div className="p-5 space-y-4">

                                {!session ? (
                                    <>
                                        {/* Explainer */}
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Your code is reserved and ready. Hit <strong className="text-slate-700">Create Session</strong> to activate it — then share this code with scorers. They enter it in their <strong className="text-slate-700">Cast → Arena</strong> tab to claim a court on the display.
                                        </p>

                                        {/* ── Pre-queue manual add (collapsible) ── */}
                                        <div className="border-t border-slate-100 pt-3">
                                            <button
                                                onClick={() => setShowManualAdd(v => !v)}
                                                className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors w-full text-left"
                                            >
                                                <svg
                                                    className={`w-3.5 h-3.5 transition-transform duration-200 ${showManualAdd ? 'rotate-90' : ''}`}
                                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                                </svg>
                                                Add game codes manually
                                                {queuedCodes.length > 0 && (
                                                    <span className="ml-auto px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                                                        {queuedCodes.length}
                                                    </span>
                                                )}
                                            </button>

                                            {showManualAdd && (
                                                <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                                                    <div className="flex gap-2">
                                                        <input
                                                            className={inp + ' flex-1 !py-2'}
                                                            value={queueInput}
                                                            onChange={e => setQueueInput(e.target.value.toUpperCase())}
                                                            placeholder="Game code"
                                                            maxLength={6}
                                                            onKeyDown={e => { if (e.key === 'Enter') handleQueueAdd(); }}
                                                        />
                                                        <button
                                                            onClick={handleQueueAdd}
                                                            disabled={queueInput.trim().length < 4 || queuedCodes.length >= courts}
                                                            className="flex-shrink-0 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl disabled:opacity-30 transition-colors"
                                                        >
                                                            + Add
                                                        </button>
                                                    </div>

                                                    {queuedCodes.length > 0 && (
                                                        <div className="space-y-1.5">
                                                            {queuedCodes.map((gc, i) => (
                                                                <div key={gc} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                                                                    <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                                                        <span className="text-[8px] font-bold text-slate-500">{i + 1}</span>
                                                                    </div>
                                                                    <span className="flex-1 text-xs font-mono font-bold text-slate-700">{gc}</span>
                                                                    <button
                                                                        onClick={() => setQueuedCodes(prev => prev.filter(c => c !== gc))}
                                                                        className="text-slate-300 hover:text-red-500 transition-colors text-sm leading-none font-bold"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            <div className="text-[10px] text-slate-400">
                                                                These courts will be added automatically when you create the session.
                                                            </div>
                                                        </div>
                                                    )}

                                                    {queuedCodes.length >= courts && (
                                                        <div className="text-[10px] text-amber-600 font-medium">All {courts} court slots filled.</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* QR + instructions */}
                                        {qrDataUrl && (
                                            <div className="flex items-start gap-4">
                                                <div className="flex-shrink-0 p-2 bg-white border border-slate-200 rounded-xl shadow-sm">
                                                    <img src={qrDataUrl} alt="Arena QR" width={90} height={90} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-slate-700 mb-1">How scorers join</div>
                                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                                        Open <strong className="text-slate-700">Cast → Arena tab</strong> and enter <strong className="text-slate-900 font-mono">{session.arena_code}</strong> to claim a court on the display.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Live court grid */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Courts</span>
                                                <span className="text-[10px] font-bold text-slate-400">{session.game_codes.length}/{session.max_slots} active</span>
                                            </div>
                                            <LiveCourtGrid codes={session.game_codes} maxSlots={session.max_slots} />
                                        </div>

                                        {/* Post-create manual add */}
                                        <div className="border-t border-slate-100 pt-3">
                                            <div className="text-xs font-bold text-slate-800 border-l-4 border-red-600 pl-3 mb-3">Add Court by Game Code</div>
                                            <div className="flex gap-2">
                                                <input
                                                    className={inp + ' flex-1 !py-2.5'}
                                                    value={manualCode}
                                                    onChange={e => setManualCode(e.target.value.toUpperCase())}
                                                    placeholder="Enter game code"
                                                    maxLength={6}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleAddManual(); }}
                                                />
                                                <button onClick={handleAddManual} disabled={addingManual || manualCode.length < 4}
                                                    className="flex-shrink-0 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-colors whitespace-nowrap">
                                                    {addingManual ? '…' : '+ Add'}
                                                </button>
                                            </div>
                                            {manualMsg && (
                                                <div className={`text-xs mt-2 font-medium ${isSuccess(manualMsg) ? 'text-green-600' : 'text-red-600'}`}>
                                                    {manualMsg}
                                                </div>
                                            )}
                                        </div>

                                        {/* Open display CTA */}
                                        <button onClick={() => navigate(`/arena/${session.arena_code}`)}
                                            className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 [box-shadow:0_2px_8px_rgba(220,38,38,0.3)]">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                            Open Display Screen
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Display preview */}
                        <div className="bg-white rounded-2xl [box-shadow:0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)] p-5">
                            <div className="flex items-center justify-between mb-4">
                                <SectionHeader>Layout Preview</SectionHeader>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest capitalize">{displayMode} · {courts} courts</span>
                            </div>
                            <DisplayModePreview mode={displayMode} courts={courts} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateArenaPage;
