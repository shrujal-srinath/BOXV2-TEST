// src/components/ArenaSessionSection.tsx
// Dashboard section for Multi-Court Arena sessions.
// Shows idle banner or active session cards with live management.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import {
    fetchMyArenaSessions,
    subscribeToArenaSession,
    joinArenaSession,
    leaveArenaSession,
    approveArenaRequest,
    rejectArenaRequest,
    endArenaSession,
    type ArenaSession,
} from '../services/arenaSessionService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ArenaSessionSectionProps {
    user: User | null;
}

// ─── Dot Grid (court count visualizer) ───────────────────────────────────────

const DotGrid: React.FC<{ total: number; active: number }> = ({ total, active }) => (
    <div className="flex items-center gap-1 flex-wrap">
        {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i < active ? 'bg-cs-accent dark:bg-red-600' : 'bg-cs-overlay dark:bg-zinc-700'}`} />
        ))}
    </div>
);

// ─── Individual Session Card ──────────────────────────────────────────────────

const SessionCard: React.FC<{
    session: ArenaSession;
    onEnd: () => void;
}> = ({ session: initialSession, onEnd }) => {
    const [session, setSession] = useState(initialSession);
    const [expanded, setExpanded] = useState(false);
    const [addCode, setAddCode] = useState('');
    const [addMsg, setAddMsg] = useState('');
    const [adding, setAdding] = useState(false);

    // Subscribe to live updates
    useEffect(() => {
        const unsub = subscribeToArenaSession(session.arena_code, setSession);
        return unsub;
    }, [session.arena_code]);

    const handleAdd = async () => {
        if (addCode.length < 4) return;
        setAdding(true);
        const result = await joinArenaSession(session.arena_code, addCode);
        setAddMsg(result.message);
        if (result.success) setAddCode('');
        setAdding(false);
    };

    const handleRemove = async (gameCode: string) => {
        await leaveArenaSession(session.arena_code, gameCode);
    };

    const handleApprove = async (gameCode: string) => {
        await approveArenaRequest(session.arena_code, gameCode);
    };

    const handleReject = async (gameCode: string) => {
        await rejectArenaRequest(session.arena_code, gameCode);
    };

    const pending = session.pending_requests;
    const hasPending = session.join_mode === 'approval' && pending.length > 0;

    return (
        <div className="bg-cs-surface dark:bg-zinc-900/50 border-[0.5px] border-cs-border dark:border dark:border-zinc-800 cs-radius-card dark:rounded-2xl shadow-cs-card dark:shadow-none overflow-hidden min-w-[240px] max-w-xs flex-shrink-0">
            {/* Top accent */}
            <div className="h-1 bg-cs-accent dark:bg-red-600" />

            <div style={{ paddingTop: 14, paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-cs-text dark:text-white truncate mb-1.5 dark:text-sm dark:font-bold">{session.label}</div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] tabular-nums bg-cs-elevated dark:bg-zinc-800 text-cs-text-2 dark:text-zinc-400 px-2 py-0.5 cs-radius-sm dark:rounded">
                                {session.arena_code}
                            </span>
                            {hasPending && (
                                <span className="text-[10px] font-semibold uppercase tracking-[0.073em] bg-cs-accent dark:bg-red-600 text-white px-2 py-0.5 cs-pill dark:rounded-full dark:font-bold dark:text-[9px] dark:tracking-normal">
                                    {pending.length} pending
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Court count */}
                <div className="flex items-center gap-2 mb-4">
                    <DotGrid total={session.max_slots} active={session.game_codes.length} />
                    <span className="font-display text-[10px] text-cs-text-2 dark:text-zinc-500 font-bold uppercase tracking-[0.22em] dark:font-sans dark:tracking-normal dark:font-semibold dark:normal-case">
                        {session.game_codes.length} / {session.max_slots} courts
                    </span>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5">
                    <button
                        onClick={() => window.open(`/arena/${session.arena_code}`, '_blank')}
                        className="flex-1 h-10 inline-flex items-center justify-center text-[11px] font-semibold uppercase tracking-[0.073em] bg-cs-accent hover:bg-cs-accent-pressed text-white cs-pill dark:rounded-xl dark:tracking-normal dark:normal-case dark:font-bold dark:text-[10px] transition-colors"
                    >
                        Open Display
                    </button>
                    <button
                        onClick={() => setExpanded(v => !v)}
                        className={`flex-1 h-10 inline-flex items-center justify-center text-[11px] font-semibold uppercase tracking-[0.073em] cs-pill dark:rounded-xl border-[0.5px] dark:border dark:tracking-normal dark:normal-case dark:font-bold dark:text-[10px] transition-colors ${expanded ? 'bg-cs-elevated dark:bg-zinc-800 border-cs-border dark:border-zinc-700 text-cs-text dark:text-white' : 'border-cs-border dark:border-zinc-700 text-cs-text-2 dark:text-zinc-400 hover:bg-cs-elevated dark:hover:bg-zinc-900'}`}
                    >
                        {expanded ? 'Collapse' : 'Manage'}
                    </button>
                    <button
                        onClick={onEnd}
                        className="h-10 px-3 inline-flex items-center cs-pill dark:rounded-xl border-[0.5px] dark:border border-cs-border dark:border-zinc-700 text-cs-error dark:text-red-500 hover:bg-cs-error/10 dark:hover:bg-red-950/20 transition-colors"
                        title="End session"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Expanded manage panel */}
            {expanded && (
                <div className="border-t-[0.5px] border-cs-border dark:border-t dark:border-zinc-800 p-4 space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
                    {/* Slots list */}
                    <div className="space-y-1.5">
                        {Array.from({ length: session.max_slots }).map((_, i) => {
                            const gc = session.game_codes[i];
                            return (
                                <div key={i} className={`flex items-center justify-between p-2.5 cs-radius-md dark:rounded-xl ${gc ? 'border-[0.5px] dark:border border-cs-border dark:border-zinc-700 bg-cs-elevated dark:bg-zinc-900' : 'border-dashed border-[0.5px] dark:border border-cs-border dark:border-zinc-800'}`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-display text-[10px] font-bold text-cs-text-3 dark:text-zinc-600 uppercase tracking-[0.3em] flex-shrink-0 dark:font-sans dark:text-[9px] dark:tracking-widest">Court {i + 1}</span>
                                        {gc ? (
                                            <span className="font-mono text-xs font-bold text-cs-text dark:text-white truncate tabular-nums">{gc}</span>
                                        ) : (
                                            <span className="text-[10px] text-cs-text-3 dark:text-zinc-700">Waiting...</span>
                                        )}
                                    </div>
                                    {gc && (
                                        <button
                                            onClick={() => handleRemove(gc)}
                                            className="text-cs-text-3 dark:text-zinc-700 hover:text-cs-error dark:hover:text-red-400 transition-colors ml-2 flex-shrink-0"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Pending approvals */}
                    {hasPending && (
                        <div className="space-y-1.5">
                            <div className="font-display text-[10px] font-bold text-cs-text-2 dark:text-zinc-600 uppercase tracking-[0.3em] dark:font-sans dark:text-[9px] dark:tracking-widest">Pending Approval</div>
                            {pending.map(req => (
                                <div key={req.game_code} className="flex items-center justify-between p-2.5 cs-radius-md dark:rounded-xl bg-cs-warning/10 dark:bg-amber-950/20 border-[0.5px] dark:border border-cs-warning/30 dark:border-amber-900/40">
                                    <div className="min-w-0">
                                        <div className="font-mono text-xs font-bold text-cs-text dark:text-white tabular-nums">{req.game_code}</div>
                                        <div className="text-[10px] text-cs-text-2 dark:text-zinc-500 truncate">{req.game_name}</div>
                                    </div>
                                    <div className="flex gap-1 ml-2 flex-shrink-0">
                                        <button onClick={() => handleApprove(req.game_code)} className="px-2 h-8 inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.073em] bg-cs-success text-white cs-pill hover:brightness-95 transition-colors dark:rounded-lg dark:font-bold dark:text-[9px] dark:tracking-normal dark:normal-case dark:bg-green-600 dark:hover:bg-green-700">
                                            Accept
                                        </button>
                                        <button onClick={() => handleReject(req.game_code)} className="px-2 h-8 inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.073em] border-[0.5px] dark:border border-cs-border dark:border-red-900/40 text-cs-error dark:text-red-400 cs-pill hover:bg-cs-error/10 dark:hover:bg-red-950/20 transition-colors dark:rounded-lg dark:font-bold dark:text-[9px] dark:tracking-normal dark:normal-case">
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add game manually */}
                    <div>
                        <div className="font-display text-[10px] font-bold text-cs-text-2 dark:text-zinc-600 uppercase tracking-[0.3em] mb-2 dark:font-sans dark:text-[9px] dark:tracking-widest">Add Game Manually</div>
                        <div className="flex gap-1.5">
                            <input
                                value={addCode}
                                onChange={e => setAddCode(e.target.value.toUpperCase())}
                                placeholder="Game Code"
                                maxLength={6}
                                className="flex-1 cs-radius-md dark:rounded-xl bg-cs-elevated dark:bg-zinc-800 border-0 dark:border dark:border-zinc-600 text-cs-text dark:text-zinc-100 placeholder:text-cs-text-3 dark:placeholder:text-zinc-500 px-3 text-xs outline-none focus:ring-2 focus:ring-cs-info/20 dark:focus:border-violet-500 dark:focus:ring-violet-500/10 transition-all font-mono tabular-nums"
                                style={{ height: 40 }}
                            />
                            <button
                                onClick={handleAdd}
                                disabled={adding || addCode.length < 4}
                                className="px-4 h-10 inline-flex items-center bg-cs-accent hover:bg-cs-accent-pressed text-white text-[11px] font-semibold uppercase tracking-[0.073em] cs-pill dark:rounded-xl dark:font-bold dark:text-[10px] dark:tracking-normal dark:normal-case dark:bg-red-600 dark:hover:bg-red-700 disabled:opacity-40 transition-colors"
                            >
                                + Add
                            </button>
                        </div>
                        {addMsg && <div className="text-[11px] text-cs-text-2 dark:text-zinc-500 mt-1.5">{addMsg}</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Section ─────────────────────────────────────────────────────────────

export const ArenaSessionSection: React.FC<ArenaSessionSectionProps> = ({ user }) => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<ArenaSession[]>([]);
    const [loading, setLoading] = useState(false);

    const loadSessions = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const data = await fetchMyArenaSessions(user.id);
        setSessions(data);
        setLoading(false);
    }, [user]);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const handleEnd = async (arenaCode: string) => {
        if (!window.confirm('End this arena session? The display will go offline.')) return;
        await endArenaSession(arenaCode);
        setSessions(prev => prev.filter(s => s.arena_code !== arenaCode));
    };

    return (
        <>
            <section className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h2 className="font-display text-[12px] font-bold text-cs-text-2 dark:text-zinc-200 uppercase tracking-[0.3em] mb-2 dark:font-sans dark:text-base dark:tracking-normal dark:border-l-4 dark:border-red-600 dark:pl-3 dark:mb-5">
                    Multi-Court Arena
                </h2>
                <div className="w-7 h-[2px] bg-cs-accent mb-6 dark:hidden" />

                {/* Banner / CTA card */}
                <div className="bg-cs-surface dark:bg-zinc-900/50 border-[0.5px] border-cs-border dark:border dark:border-zinc-800 cs-radius-card dark:rounded-2xl shadow-cs-card dark:shadow-none overflow-hidden mb-4">
                    <div className="flex items-center justify-between gap-4" style={{ paddingTop: 14, paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
                        <div className="flex items-center gap-4 min-w-0">
                            {/* Icon */}
                            <div className="w-11 h-11 cs-radius-md dark:rounded-xl bg-cs-accent dark:bg-red-600 flex items-center justify-center flex-shrink-0 shadow-cs-fab dark:shadow-none">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <div className="text-[15px] font-semibold text-cs-text dark:text-white leading-tight dark:text-sm dark:font-bold">Multi-Court Arena</div>
                                <div className="text-[12px] text-cs-text-2 dark:text-zinc-500 mt-1 dark:text-xs dark:mt-0.5">Broadcast 2–6 games to one screen</div>
                            </div>
                        </div>
                        <button
                            onClick={() => user ? navigate('/arena/create') : undefined}
                            disabled={!user}
                            className="flex-shrink-0 px-5 h-10 inline-flex items-center bg-cs-accent hover:bg-cs-accent-pressed text-white text-[12px] font-semibold uppercase tracking-[0.073em] cs-pill dark:rounded-xl dark:font-bold dark:text-xs dark:tracking-normal dark:normal-case transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            Create Session
                        </button>
                    </div>
                </div>

                {/* Active sessions */}
                {loading && (
                    <div className="flex items-center gap-2 text-cs-text-3 dark:text-zinc-600 text-xs py-2">
                        <div className="w-3 h-3 border-[0.5px] dark:border border-cs-border dark:border-zinc-700 border-t-cs-accent dark:border-t-red-600 rounded-full animate-spin" />
                        Loading sessions...
                    </div>
                )}

                {!loading && sessions.length > 0 && (
                    <div className="flex gap-4 overflow-x-auto pb-2 md:flex-wrap md:overflow-x-visible">
                        {sessions.map(s => (
                            <SessionCard
                                key={s.id}
                                session={s}
                                onEnd={() => handleEnd(s.arena_code)}
                            />
                        ))}
                    </div>
                )}
            </section>

        </>
    );
};

export default ArenaSessionSection;
