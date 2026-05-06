// src/components/ArenaSessionSection.tsx
// Dashboard section for Multi-Court Arena sessions.
// Shows idle banner or active session cards with live management.

import React, { useState, useEffect, useCallback } from 'react';
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
import { CreateArenaModal } from './CreateArenaModal';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ArenaSessionSectionProps {
    user: User | null;
}

// ─── Dot Grid (court count visualizer) ───────────────────────────────────────

const DotGrid: React.FC<{ total: number; active: number }> = ({ total, active }) => (
    <div className="flex items-center gap-1 flex-wrap">
        {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i < active ? 'bg-red-600' : 'bg-slate-200 dark:bg-zinc-700'}`} />
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
        <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl [box-shadow:0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden min-w-[240px] max-w-xs flex-shrink-0">
            {/* Top accent */}
            <div className="h-1 bg-red-600 rounded-t-2xl" />

            <div className="p-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate mb-1">{session.label}</div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-2 py-0.5 rounded">
                                {session.arena_code}
                            </span>
                            {hasPending && (
                                <span className="text-[9px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">
                                    {pending.length} pending
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Court count */}
                <div className="flex items-center gap-2 mb-4">
                    <DotGrid total={session.max_slots} active={session.game_codes.length} />
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-semibold">
                        {session.game_codes.length} / {session.max_slots} courts
                    </span>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5">
                    <button
                        onClick={() => window.open(`/arena/${session.arena_code}`, '_blank')}
                        className="flex-1 py-2 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
                    >
                        Open Display
                    </button>
                    <button
                        onClick={() => setExpanded(v => !v)}
                        className={`flex-1 py-2 text-[10px] font-bold rounded-xl border transition-colors ${expanded ? 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white' : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-900'}`}
                    >
                        {expanded ? 'Collapse' : 'Manage'}
                    </button>
                    <button
                        onClick={onEnd}
                        className="py-2 px-3 text-[10px] font-bold rounded-xl border border-slate-200 dark:border-zinc-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        title="End session"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Expanded manage panel */}
            {expanded && (
                <div className="border-t border-slate-100 dark:border-zinc-800 p-4 space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
                    {/* Slots list */}
                    <div className="space-y-1.5">
                        {Array.from({ length: session.max_slots }).map((_, i) => {
                            const gc = session.game_codes[i];
                            return (
                                <div key={i} className={`flex items-center justify-between p-2.5 rounded-xl border ${gc ? 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900' : 'border-dashed border-slate-200 dark:border-zinc-800'}`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest flex-shrink-0">Court {i + 1}</span>
                                        {gc ? (
                                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">{gc}</span>
                                        ) : (
                                            <span className="text-[10px] text-slate-300 dark:text-zinc-700">Waiting...</span>
                                        )}
                                    </div>
                                    {gc && (
                                        <button
                                            onClick={() => handleRemove(gc)}
                                            className="text-slate-300 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-2 flex-shrink-0"
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
                            <div className="text-[9px] font-bold text-slate-500 dark:text-zinc-600 uppercase tracking-widest">Pending Approval</div>
                            {pending.map(req => (
                                <div key={req.game_code} className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                                    <div className="min-w-0">
                                        <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">{req.game_code}</div>
                                        <div className="text-[9px] text-slate-500 dark:text-zinc-500 truncate">{req.game_name}</div>
                                    </div>
                                    <div className="flex gap-1 ml-2 flex-shrink-0">
                                        <button onClick={() => handleApprove(req.game_code)} className="px-2 py-1 text-[9px] font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                                            Accept
                                        </button>
                                        <button onClick={() => handleReject(req.game_code)} className="px-2 py-1 text-[9px] font-bold border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add game manually */}
                    <div>
                        <div className="text-[9px] font-bold text-slate-500 dark:text-zinc-600 uppercase tracking-widest mb-1.5">Add Game Manually</div>
                        <div className="flex gap-1.5">
                            <input
                                value={addCode}
                                onChange={e => setAddCode(e.target.value.toUpperCase())}
                                placeholder="Game Code"
                                maxLength={6}
                                className="flex-1 rounded-xl border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 px-3 py-2 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all font-mono"
                            />
                            <button
                                onClick={handleAdd}
                                disabled={adding || addCode.length < 4}
                                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-xl disabled:opacity-40 transition-colors"
                            >
                                + Add
                            </button>
                        </div>
                        {addMsg && <div className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1">{addMsg}</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Section ─────────────────────────────────────────────────────────────

export const ArenaSessionSection: React.FC<ArenaSessionSectionProps> = ({ user }) => {
    const [sessions, setSessions] = useState<ArenaSession[]>([]);
    const [showModal, setShowModal] = useState(false);
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

    const handleCreated = (session: ArenaSession) => {
        setSessions(prev => [session, ...prev]);
    };

    return (
        <>
            <section className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200 border-l-4 border-red-600 pl-3 mb-5">
                    Multi-Court Arena
                </h2>

                {/* Banner / CTA card */}
                <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl [box-shadow:0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden mb-4">
                    <div className="flex items-center justify-between p-5 gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            {/* Icon */}
                            <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Multi-Court Arena</div>
                                <div className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Broadcast 2–6 games to one screen</div>
                            </div>
                        </div>
                        <button
                            onClick={() => user ? setShowModal(true) : undefined}
                            disabled={!user}
                            className="flex-shrink-0 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            Create Session
                        </button>
                    </div>
                </div>

                {/* Active sessions */}
                {loading && (
                    <div className="flex items-center gap-2 text-slate-400 dark:text-zinc-600 text-xs py-2">
                        <div className="w-3 h-3 border border-slate-300 dark:border-zinc-700 border-t-red-600 rounded-full animate-spin" />
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

            {showModal && (
                <CreateArenaModal
                    user={user}
                    onClose={() => setShowModal(false)}
                    onCreated={handleCreated}
                />
            )}
        </>
    );
};

export default ArenaSessionSection;
