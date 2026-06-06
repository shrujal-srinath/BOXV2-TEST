// src/pages/TournamentDashboard.tsx
// THE BOX — Tournament Hub Home

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser, subscribeToAuth } from '../services/authService';
import { subscribeToMyTournaments, subscribeToJoinedTournaments, joinTournament } from '../services/tournamentService';
import type { User } from '@supabase/supabase-js';
import type { Tournament } from '../types';

// ─── Sport icon helpers ───────────────────────────────────────
const SPORT_COLORS: Record<string, string> = {
    basketball: '#f59e0b', badminton: '#10b981', volleyball: '#3b82f6',
    football: '#22c55e', kabaddi: '#f97316', tabletennis: '#e11d48',
    cricket: '#8b5cf6', general: '#64748b',
};

const SportDot: React.FC<{ sport: string }> = ({ sport }) => (
    <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: SPORT_COLORS[sport] ?? SPORT_COLORS.general }}
    />
);

// ─── Tournament card ──────────────────────────────────────────
const TournamentCard: React.FC<{
    tournament: Tournament;
    role: 'admin' | 'scorer';
    onClick: () => void;
}> = ({ tournament, role, onClick }) => {
    const sportConfig = tournament.sportConfig || {};
    const sports = Object.keys(sportConfig);
    const divisions = tournament.divisions ? Object.values(tournament.divisions) : [];
    const liveCount = divisions.filter((d: any) => d?.status === 'published').length;
    const completedCount = divisions.filter((d: any) => d?.status === 'completed').length;
    const isActive = liveCount > 0;

    return (
        <div
            onClick={onClick}
            className="group bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 cursor-pointer transition-all duration-200 relative overflow-hidden [box-shadow:0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]"
        >
            {/* accent line on hover */}
            <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: role === 'admin' ? 'linear-gradient(to right, #ca8a04, transparent)' : 'linear-gradient(to right, #3b82f6, transparent)' }} />

            {/* header row */}
            <div className="flex items-start justify-between mb-3">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest
                    ${role === 'admin'
                        ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-yellow-950/40 dark:border-yellow-800/40 dark:text-yellow-500'
                        : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800/40 dark:text-blue-400'}`}>
                    {role === 'admin' ? 'Admin' : 'Scorer'}
                </span>
                {isActive && (
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[9px] font-black text-green-400 uppercase tracking-widest">{liveCount} Live</span>
                    </div>
                )}
                {!isActive && completedCount > 0 && (
                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{completedCount} done</span>
                )}
            </div>

            {/* name */}
            <h3 className="text-base font-black italic uppercase text-slate-900 dark:text-white leading-tight mb-1 line-clamp-2">
                {tournament.name}
            </h3>
            {tournament.organizer && (
                <p className="text-[10px] text-slate-500 dark:text-zinc-600 font-bold uppercase tracking-wider truncate mb-3">
                    {tournament.organizer}
                </p>
            )}

            {/* sport dots + id */}
            <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1.5">
                    {sports.slice(0, 6).map(s => <SportDot key={s} sport={s} />)}
                    {sports.length > 6 && <span className="text-[9px] text-slate-500 dark:text-zinc-600 font-bold">+{sports.length - 6}</span>}
                    {sports.length === 0 && <span className="text-[9px] text-slate-400 dark:text-zinc-700 font-bold uppercase tracking-widest">No sports</span>}
                </div>
                <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-700">{tournament.id}</span>
            </div>
        </div>
    );
};

// ─── Join as Volunteer modal ──────────────────────────────────
const JoinVolunteerModal: React.FC<{
    joinCode: string;
    setJoinCode: (v: string) => void;
    joinStatus: 'idle' | 'loading' | 'success' | 'error';
    onJoin: (code: string) => void;
    onClose: () => void;
}> = ({ joinCode, setJoinCode, joinStatus, onJoin, onClose }) => (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="h-[2px] bg-gradient-to-r from-blue-500 to-transparent" />
            <div className="p-7">
                {/* header */}
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-zinc-500 mb-0.5">Volunteer Access</div>
                        <div className="text-sm font-black italic uppercase text-slate-900 dark:text-white leading-none">Join as Scorer</div>
                    </div>
                </div>

                {/* explanation */}
                <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl p-4 mb-5 space-y-2">
                    {[
                        'Enter the tournament code from the admin',
                        'Your request is sent to the tournament admin',
                        'Once approved, you can score matches live',
                    ].map((step, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-[8px] font-black text-blue-600 dark:text-blue-400">{i + 1}</span>
                            </div>
                            <span className="text-[11px] text-slate-600 dark:text-zinc-400 leading-snug">{step}</span>
                        </div>
                    ))}
                </div>

                {/* code input */}
                <input
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && onJoin(joinCode)}
                    placeholder="ABC123"
                    maxLength={6}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-blue-500 text-slate-900 dark:text-white text-2xl font-black text-center tracking-[0.5em] py-4 rounded-xl outline-none mb-3 uppercase placeholder:text-slate-300 dark:placeholder:text-zinc-700 placeholder:tracking-[0.5em] transition-colors"
                    autoFocus
                />

                {joinStatus === 'error' && (
                    <p className="text-red-500 dark:text-red-400 text-[10px] font-bold text-center mb-3 uppercase tracking-wider">
                        Tournament not found — check the code
                    </p>
                )}
                {joinStatus === 'success' && (
                    <p className="text-green-600 dark:text-green-400 text-[10px] font-bold text-center mb-3 uppercase tracking-wider">
                        Request sent — waiting for admin approval
                    </p>
                )}

                <div className="flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-black uppercase text-[10px] tracking-widest transition-all">
                        Cancel
                    </button>
                    <button
                        onClick={() => onJoin(joinCode)}
                        disabled={joinCode.length < 4 || joinStatus === 'loading' || joinStatus === 'success'}
                        className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase text-[10px] tracking-widest transition-all"
                    >
                        {joinStatus === 'loading' ? 'Sending...' : joinStatus === 'success' ? 'Sent!' : 'Request Access'}
                    </button>
                </div>
            </div>
        </div>
    </div>
);

// ─── Main component ───────────────────────────────────────────
export const TournamentDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [myTournaments, setMyTournaments] = useState<Tournament[]>([]);
    const [joinedTournaments, setJoinedTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'hosting' | 'scoring'>('hosting');
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [joinStatus, setJoinStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    useEffect(() => {
        let unsubMy: (() => void) | undefined;
        let unsubJoined: (() => void) | undefined;

        const unsubAuth = subscribeToAuth((u) => {
            setUser(u);
            if (u) {
                unsubMy = subscribeToMyTournaments(u.id, (data) => {
                    setMyTournaments(data);
                    setLoading(false);
                });
                unsubJoined = subscribeToJoinedTournaments(u.id, (data) => {
                    setJoinedTournaments(data);
                });
            } else {
                setLoading(false);
            }
        });

        return () => { unsubAuth(); unsubMy?.(); unsubJoined?.(); };
    }, []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;
            if (e.key === 'c' || e.key === 'C') navigate('/tournament/create');
            if (e.key === 'j' || e.key === 'J') setShowJoinModal(true);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [navigate]);

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleLogout = async () => {
        await logoutUser();
        navigate('/');
    };

    const handleJoin = async (code: string) => {
        if (!code.trim() || !user) return;
        setJoinStatus('loading');
        try {
            await joinTournament(code.trim());
            setJoinStatus('success');
            showToast('Request sent — waiting for admin approval.', 'info');
            setTimeout(() => {
                setShowJoinModal(false);
                setJoinCode('');
                setJoinStatus('idle');
            }, 2200);
        } catch {
            setJoinStatus('error');
            setTimeout(() => setJoinStatus('idle'), 3000);
        }
    };

    const displayedTournaments = useMemo(() => {
        const source = activeTab === 'hosting' ? myTournaments : joinedTournaments;
        if (!searchQuery.trim()) return source;
        return source.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [activeTab, myTournaments, joinedTournaments, searchQuery]);

    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || null;

    return (
        <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white relative overflow-x-hidden">
            {/* ambient background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 dark:bg-black" />
                <div className="absolute inset-0 hidden dark:block" style={{
                    background: 'radial-gradient(ellipse 70% 35% at 50% -5%, rgba(202,138,4,0.10) 0%, transparent 70%)',
                }} />
                <div className="absolute inset-0 opacity-[0.02] hidden dark:block" style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }} />
            </div>

            {/* ── TOAST ────────────────────────────────────── */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl font-bold text-sm shadow-2xl animate-in slide-in-from-top-2 duration-300 border backdrop-blur-xl
                    ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/90 dark:border-green-800/60 dark:text-green-300'
                        : toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/90 dark:border-red-800/60 dark:text-red-300'
                            : 'bg-white border-slate-200 text-slate-800 dark:bg-zinc-900/90 dark:border-zinc-700/60 dark:text-white'}`}>
                    {toast.message}
                </div>
            )}

            {/* ── HEADER ───────────────────────────────────── */}
            <header className="relative z-20 sticky top-0">
                <div className="absolute inset-0 bg-white/80 dark:bg-black/70 backdrop-blur-xl [box-shadow:0_1px_0_rgba(0,0,0,0.08)] dark:border-b dark:border-zinc-900/80" />
                <div className="relative px-5 lg:px-10 h-[64px] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-600 flex items-center justify-center text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-all"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <div className="text-[8px] font-black uppercase tracking-[0.35em] text-yellow-600/80 dark:text-yellow-600/80 leading-none mb-0.5">THE BOX</div>
                            <div className="text-sm font-black italic uppercase text-slate-900 dark:text-white tracking-tight leading-none">Tournaments</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {firstName && (
                            <span className="hidden sm:block text-[10px] font-bold text-slate-500 dark:text-zinc-600 uppercase tracking-widest mr-1">
                                {firstName}
                            </span>
                        )}
                        <button
                            onClick={handleLogout}
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/50 flex items-center justify-center text-slate-400 dark:text-zinc-600 hover:text-red-600 dark:hover:text-red-400 transition-all"
                            title="Log out"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            <main className="relative z-10 px-5 lg:px-10 py-8 max-w-5xl mx-auto">

                {/* ── PAGE TITLE ───────────────────────────── */}
                <div className="mb-8">
                    <h1 className="text-3xl lg:text-4xl font-black italic uppercase text-slate-900 dark:text-white tracking-tight leading-none">
                        {firstName ? `${firstName}'s ` : ''}
                        <span className="text-slate-400 dark:text-zinc-600">Hub</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-[0.25em] mt-1.5">
                        {myTournaments.length} hosting · {joinedTournaments.length} scoring
                    </p>
                </div>

                {/* ── PRIMARY ACTIONS ──────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">

                    {/* Create Tournament */}
                    <button
                        onClick={() => navigate('/tournament/create')}
                        className="group relative bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-yellow-700/60 rounded-2xl p-6 text-left transition-all duration-200 overflow-hidden [box-shadow:0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]"
                    >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            style={{ background: 'radial-gradient(ellipse 100% 100% at 30% 0%, rgba(202,138,4,0.06) 0%, transparent 70%)' }} />
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-600 dark:from-yellow-600 to-transparent" />

                        <div className="flex items-start justify-between mb-4">
                            <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-yellow-950/40 border border-red-100 dark:border-yellow-900/40 flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-yellow-950/60 transition-colors">
                                <svg className="w-5 h-5 text-red-600 dark:text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                            <svg className="w-4 h-4 text-slate-300 dark:text-zinc-700 group-hover:text-slate-500 dark:group-hover:text-zinc-500 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>

                        <div className="text-[9px] font-black uppercase tracking-[0.25em] text-red-600 dark:text-yellow-600 mb-1">Primary Action</div>
                        <div className="text-lg font-black italic uppercase text-slate-900 dark:text-white leading-tight">Create Tournament</div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1.5 leading-snug">
                            Set up brackets, manage sports divisions, and run your event from start to finish.
                        </p>
                        <div className="mt-4 text-[9px] font-bold text-slate-300 dark:text-zinc-700 uppercase tracking-widest">Press C</div>
                    </button>

                    {/* Join as Volunteer */}
                    <button
                        onClick={() => setShowJoinModal(true)}
                        className="group relative bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700/60 rounded-2xl p-6 text-left transition-all duration-200 overflow-hidden [box-shadow:0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]"
                    >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            style={{ background: 'radial-gradient(ellipse 100% 100% at 30% 0%, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-600 to-transparent" />

                        <div className="flex items-start justify-between mb-4">
                            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-950/60 transition-colors">
                                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <svg className="w-4 h-4 text-slate-300 dark:text-zinc-700 group-hover:text-slate-500 dark:group-hover:text-zinc-500 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>

                        <div className="text-[9px] font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-500 mb-1">Volunteer</div>
                        <div className="text-lg font-black italic uppercase text-slate-900 dark:text-white leading-tight">Join as Scorer</div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1.5 leading-snug">
                            Enter a tournament code to request scorer access. Admin approves, then you score matches live.
                        </p>
                        <div className="mt-4 text-[9px] font-bold text-slate-300 dark:text-zinc-700 uppercase tracking-widest">Press J</div>
                    </button>
                </div>

                {/* ── MY TOURNAMENTS ───────────────────────── */}
                <div>
                    {/* section header */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
                        {/* tabs */}
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-1 w-fit">
                            {([
                                { key: 'hosting', label: 'Hosting', count: myTournaments.length },
                                { key: 'scoring', label: 'Scoring', count: joinedTournaments.length },
                            ] as const).map(({ key, label, count }) => (
                                <button
                                    key={key}
                                    onClick={() => { setActiveTab(key); setSearchQuery(''); }}
                                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-150
                                        ${activeTab === key
                                            ? key === 'hosting' ? 'bg-red-600 dark:bg-yellow-600 text-white dark:text-black' : 'bg-blue-600 text-white'
                                            : 'text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    {label}
                                    <span className={`ml-1.5 ${activeTab === key ? 'opacity-70' : 'opacity-40'}`}>
                                        ({count})
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* search */}
                        <div className="relative flex-1 max-w-xs">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 focus:border-violet-500 dark:focus:border-zinc-600 text-slate-900 dark:text-white text-xs pl-9 pr-4 py-2 rounded-xl outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-700 transition-all"
                            />
                        </div>
                    </div>

                    {/* loading */}
                    {loading && (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-7 h-7 rounded-full border-2 border-slate-200 dark:border-zinc-800 border-t-red-600 dark:border-t-yellow-600 animate-spin" />
                        </div>
                    )}

                    {/* empty state */}
                    {!loading && displayedTournaments.length === 0 && (
                        <div className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900 rounded-2xl p-10 text-center animate-in fade-in duration-200 [box-shadow:0_1px_3px_rgba(0,0,0,0.06)]">
                            <div className="text-4xl font-black italic uppercase text-slate-200 dark:text-zinc-900 mb-3">
                                {activeTab === 'hosting' ? 'Host' : 'Score'}
                            </div>
                            <h3 className="text-base font-black italic uppercase text-slate-400 dark:text-zinc-500 mb-1">
                                {searchQuery
                                    ? 'No results'
                                    : activeTab === 'hosting'
                                        ? 'No tournaments yet'
                                        : 'Not scoring anywhere'}
                            </h3>
                            <p className="text-[10px] text-slate-400 dark:text-zinc-700 font-bold uppercase tracking-widest mb-6">
                                {searchQuery
                                    ? 'Try a different term'
                                    : activeTab === 'hosting'
                                        ? 'Create your first event to get started'
                                        : 'Use a tournament code to join an event as scorer'}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={() => activeTab === 'hosting' ? navigate('/tournament/create') : setShowJoinModal(true)}
                                    className={`font-black py-2.5 px-6 rounded-xl uppercase text-[10px] tracking-widest transition-all inline-flex items-center gap-2
                                        ${activeTab === 'hosting' ? 'bg-red-600 hover:bg-red-500 dark:bg-yellow-600 dark:hover:bg-yellow-500 text-white dark:text-black' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                                >
                                    {activeTab === 'hosting' ? 'Create Tournament' : 'Join with Code'}
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    )}

                    {/* grid */}
                    {!loading && displayedTournaments.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200">
                            {displayedTournaments.map((t) => (
                                <TournamentCard
                                    key={t.id}
                                    tournament={t}
                                    role={activeTab === 'hosting' ? 'admin' : 'scorer'}
                                    onClick={() => navigate(`/tournament/${t.id}/manage`)}
                                />
                            ))}

                            {/* inline create card when on hosting tab */}
                            {activeTab === 'hosting' && !searchQuery && (
                                <button
                                    onClick={() => navigate('/tournament/create')}
                                    className="group border-2 border-dashed border-slate-200 dark:border-zinc-900 hover:border-red-300 dark:hover:border-zinc-700 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 min-h-[140px]"
                                >
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-900 group-hover:bg-red-50 dark:group-hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 flex items-center justify-center transition-all">
                                        <svg className="w-4 h-4 text-slate-400 dark:text-zinc-600 group-hover:text-red-600 dark:group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </div>
                                    <span className="text-[10px] font-black italic uppercase text-slate-400 dark:text-zinc-700 group-hover:text-slate-600 dark:group-hover:text-zinc-400 transition-colors tracking-wide">
                                        New Tournament
                                    </span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* ── JOIN MODAL ───────────────────────────────── */}
            {showJoinModal && (
                <JoinVolunteerModal
                    joinCode={joinCode}
                    setJoinCode={setJoinCode}
                    joinStatus={joinStatus}
                    onJoin={handleJoin}
                    onClose={() => { setShowJoinModal(false); setJoinCode(''); setJoinStatus('idle'); }}
                />
            )}
        </div>
    );
};
