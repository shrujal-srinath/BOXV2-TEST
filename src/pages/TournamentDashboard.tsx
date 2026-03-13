// src/pages/TournamentDashboard.tsx
// "THE ARENA" — Full-bleed cinematic tournament hub

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser, subscribeToAuth } from '../services/authService';
import { subscribeToMyTournaments, subscribeToJoinedTournaments, joinTournament } from '../services/tournamentService';
// FIX: Was `import type { User } from 'firebase/auth'` — wrong package, crashes build.
// Supabase User type comes from @supabase/supabase-js, matching what subscribeToAuth returns.
import type { User } from '@supabase/supabase-js';
import type { Tournament } from '../types';

// ─── Sub-components ───────────────────────────────────────────

const ArenaBackground: React.FC = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(202,138,4,0.12) 0%, transparent 70%)',
        }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
        }} />
        <div className="absolute -top-20 right-0 w-[600px] h-[400px] opacity-[0.04]" style={{
            background: 'linear-gradient(135deg, transparent 40%, rgba(202,138,4,1) 41%, rgba(202,138,4,1) 42%, transparent 43%)',
        }} />
        <div className="absolute bottom-0 left-0 right-0 h-64" style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
        }} />
    </div>
);

const StatPill: React.FC<{ label: string; value: number | string; accent?: boolean }> = ({ label, value, accent }) => (
    <div className={`flex items-center gap-3 px-5 py-3 rounded-full border backdrop-blur-sm transition-all
        ${accent
            ? 'bg-yellow-950/40 border-yellow-700/40 hover:border-yellow-600/60'
            : 'bg-zinc-900/60 border-zinc-800/60 hover:border-zinc-700/60'}`}>
        <span className={`text-xl font-black tracking-tight ${accent ? 'text-yellow-400' : 'text-white'}`}>{value}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
    </div>
);

// FIX: Was reading `tournament.config.sports` (old Firebase shape).
// New Supabase shape uses `tournament.sportConfig` + `tournament.divisions`.
// This was crashing on every tournament card render with "Cannot read properties of undefined".
const TournamentCard = ({ tournament, role, onClick }: {
    tournament: Tournament;
    role: 'admin' | 'scorer';
    onClick: () => void;
}) => {
    const sportConfig = tournament.sportConfig || {};
    const totalCourts = Object.values(sportConfig).reduce((total: number, s: any) => total + (s?.courts || 0), 0);
    const totalSports = Object.keys(sportConfig).length;
    const publishedCount = tournament.divisions
        ? Object.values(tournament.divisions).filter((d: any) => d?.status === 'published' || d?.status === 'completed').length
        : 0;

    const statusColor = tournament.status === 'active' ? 'text-green-400' : tournament.status === 'archived' ? 'text-zinc-600' : 'text-yellow-500';

    return (
        <div
            onClick={onClick}
            className="group bg-zinc-950 border border-zinc-800/80 hover:border-yellow-700/40 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:bg-zinc-900/80 relative overflow-hidden"
        >
            {/* Top accent line */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 opacity-0 group-hover:opacity-100`}
                style={{ background: 'linear-gradient(to right, #ca8a04, transparent)' }} />

            <div className="flex justify-between items-start mb-4">
                <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border
                    ${role === 'admin'
                        ? 'bg-yellow-950/40 border-yellow-800/40 text-yellow-500'
                        : 'bg-blue-950/40 border-blue-800/40 text-blue-400'}`}>
                    {role === 'admin' ? 'ADMIN' : 'SCORER'}
                </span>
                <span className="text-[9px] font-mono text-zinc-600">{tournament.id}</span>
            </div>

            <h3 className="text-xl font-black italic uppercase tracking-tight text-white leading-none mb-1 truncate group-hover:text-zinc-100 transition-colors">
                {tournament.name}
            </h3>

            {tournament.organizer && (
                <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mb-3 truncate">
                    {tournament.organizer}
                </div>
            )}

            <div className="flex items-center gap-3 mt-4 text-[10px] font-mono text-zinc-500">
                <span>{totalSports} Sport{totalSports !== 1 ? 's' : ''}</span>
                <span className="text-zinc-800">·</span>
                <span>{totalCourts} Court{totalCourts !== 1 ? 's' : ''}</span>
                {publishedCount > 0 && (
                    <>
                        <span className="text-zinc-800">·</span>
                        <span className="text-green-500 font-bold">{publishedCount} Live</span>
                    </>
                )}
                <span className="text-zinc-800">·</span>
                <span className={statusColor}>{tournament.status}</span>
            </div>
        </div>
    );
};

// ─── Join Modal ───────────────────────────────────────────────
const JoinModal: React.FC<{
    joinCode: string;
    setJoinCode: (v: string) => void;
    joinStatus: 'idle' | 'loading' | 'success' | 'error';
    onJoin: (code: string) => void;
    onClose: () => void;
}> = ({ joinCode, setJoinCode, joinStatus, onJoin, onClose }) => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-black italic uppercase text-white mb-1">Join Tournament</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6">Enter the 6-character event code</p>

            <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && onJoin(joinCode)}
                placeholder="ABC123"
                maxLength={6}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-yellow-600 text-white text-2xl font-black text-center tracking-[0.5em] py-4 rounded-xl outline-none mb-4 uppercase placeholder:text-zinc-700 placeholder:tracking-[0.5em]"
                autoFocus
            />

            {joinStatus === 'error' && (
                <p className="text-red-400 text-xs font-bold text-center mb-4 uppercase tracking-wider">
                    Tournament not found. Check the code and try again.
                </p>
            )}
            {joinStatus === 'success' && (
                <p className="text-green-400 text-xs font-bold text-center mb-4 uppercase tracking-wider">
                    Request sent — waiting for admin approval.
                </p>
            )}

            <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all">
                    Cancel
                </button>
                <button
                    onClick={() => onJoin(joinCode)}
                    disabled={joinCode.length < 4 || joinStatus === 'loading' || joinStatus === 'success'}
                    className="flex-1 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black uppercase text-[10px] tracking-widest transition-all"
                >
                    {joinStatus === 'loading' ? 'Sending...' : joinStatus === 'success' ? 'Sent!' : 'Request Access'}
                </button>
            </div>
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────

export const TournamentDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [myTournaments, setMyTournaments] = useState<Tournament[]>([]);
    const [joinedTournaments, setJoinedTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'hosting' | 'volunteering'>('hosting');

    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [joinStatus, setJoinStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // ── Auth + Data ───────────────────────────────────────────
    useEffect(() => {
        let unsubMy: (() => void) | undefined;
        let unsubJoined: (() => void) | undefined;

        const unsubAuth = subscribeToAuth((u) => {
            setUser(u);
            if (u) {
                // FIX: Supabase User uses `u.id`, not `u.uid` (Firebase convention).
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

        return () => {
            unsubAuth();
            unsubMy?.();
            unsubJoined?.();
        };
    }, []);

    // ── Keyboard shortcuts ────────────────────────────────────
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
        setTimeout(() => setToast(null), 3000);
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
            showToast('Access request sent — waiting for admin approval.', 'info');
            setTimeout(() => {
                setShowJoinModal(false);
                setJoinCode('');
                setJoinStatus('idle');
            }, 2000);
        } catch {
            setJoinStatus('error');
            setTimeout(() => setJoinStatus('idle'), 3000);
        }
    };

    // ── Derived stats ─────────────────────────────────────────
    const allTournaments = [...myTournaments, ...joinedTournaments];
    const activeTournaments = allTournaments.filter(t => t.status === 'active');
    const totalDivisions = allTournaments.reduce((acc, t) =>
        acc + (t.divisions ? Object.keys(t.divisions).length : 0), 0);

    // ── Filtered list ─────────────────────────────────────────
    const displayedTournaments = useMemo(() => {
        const source = activeTab === 'hosting' ? myTournaments : joinedTournaments;
        if (!searchQuery.trim()) return source;
        return source.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [activeTab, myTournaments, joinedTournaments, searchQuery]);

    // ─────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
            <ArenaBackground />

            {/* ── TOAST ──────────────────────────────────── */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl font-bold text-sm shadow-2xl animate-in slide-in-from-top-2 duration-300 border backdrop-blur-xl
                    ${toast.type === 'success' ? 'bg-green-950/90 border-green-800/60 text-green-300'
                        : toast.type === 'error' ? 'bg-red-950/90 border-red-800/60 text-red-300'
                            : 'bg-zinc-900/90 border-zinc-700/60 text-white'}`}>
                    {toast.message}
                </div>
            )}

            {/* ── HEADER ─────────────────────────────────── */}
            <header className="relative z-20 sticky top-0">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-xl border-b border-zinc-900/80" />
                <div className="relative px-6 lg:px-10 h-[72px] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-all duration-200"
                        >
                            <div className="w-9 h-9 rounded-xl bg-zinc-900/80 border border-zinc-800 group-hover:border-zinc-600 flex items-center justify-center transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </div>
                        </button>
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-yellow-600/80">THE BOX</div>
                            <div className="text-base font-black italic uppercase text-white tracking-tight leading-none">Tournament Mode</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/tournament/create')}
                            className="hidden sm:flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase text-[10px] tracking-widest px-4 py-2.5 rounded-xl transition-all"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            New Event
                        </button>
                        <button
                            onClick={() => setShowJoinModal(true)}
                            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-white font-black uppercase text-[10px] tracking-widest px-4 py-2.5 rounded-xl transition-all"
                        >
                            Join
                        </button>
                        <button
                            onClick={() => setIsMenuOpen(true)}
                            className="w-9 h-9 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* ── HERO STATS ─────────────────────────────── */}
            <section className="relative z-10 px-6 lg:px-10 py-10">
                <div className="mb-8">
                    <h1 className="text-4xl lg:text-5xl font-black italic uppercase text-white tracking-tight leading-none">
                        {user?.user_metadata?.full_name?.split(' ')[0] || 'Your'}{' '}
                        <span className="text-zinc-600">Events</span>
                    </h1>
                    <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest mt-2">
                        Tournament Hub · {new Date().getFullYear()}
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <StatPill value={myTournaments.length} label="Hosting" accent />
                    <StatPill value={joinedTournaments.length} label="Scoring" />
                    <StatPill value={activeTournaments.length} label="Active" accent={activeTournaments.length > 0} />
                    <StatPill value={totalDivisions} label="Divisions" />
                </div>
            </section>

            {/* ── CONTENT ────────────────────────────────── */}
            <section className="relative z-10 px-6 lg:px-10 pb-16">

                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
                    <div className="flex items-center gap-1 bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-1 backdrop-blur-sm">
                        {(['hosting', 'volunteering'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200
                                    ${activeTab === tab
                                        ? 'bg-yellow-600 text-black shadow-lg shadow-yellow-900/30'
                                        : 'text-zinc-500 hover:text-white'}`}
                            >
                                {tab === 'hosting' ? `Hosting (${myTournaments.length})` : `Scoring (${joinedTournaments.length})`}
                            </button>
                        ))}
                    </div>

                    <div className="relative flex-1 max-w-xs">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search events..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-yellow-700/70 text-white text-xs pl-9 pr-4 py-2.5 rounded-xl outline-none placeholder:text-zinc-700 transition-all"
                        />
                    </div>

                    <button
                        onClick={() => navigate('/tournament/create')}
                        className="sm:hidden flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase text-[10px] tracking-widest px-4 py-2.5 rounded-xl transition-all"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        New Event
                    </button>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-yellow-600 animate-spin" />
                    </div>
                )}

                {/* Empty state */}
                {!loading && displayedTournaments.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in duration-300">
                        <div className="text-6xl mb-6 opacity-10 font-black italic">
                            {activeTab === 'hosting' ? 'HOST' : 'SCORE'}
                        </div>
                        <h3 className="text-xl font-black italic uppercase text-zinc-400 mb-2">
                            {searchQuery ? 'No results found' : activeTab === 'hosting' ? 'No tournaments yet' : 'Not volunteering anywhere'}
                        </h3>
                        <p className="text-zinc-600 text-xs font-bold uppercase tracking-wider mb-8">
                            {searchQuery ? 'Try a different search term' : activeTab === 'hosting' ? 'Create your first event to get started' : 'Join an event with a tournament code'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => activeTab === 'hosting' ? navigate('/tournament/create') : setShowJoinModal(true)}
                                className="bg-yellow-600 hover:bg-yellow-500 text-black font-black py-3 px-6 rounded-xl uppercase text-xs tracking-widest transition-all flex items-center gap-2"
                            >
                                {activeTab === 'hosting' ? 'Create Tournament' : 'Join with Code'}
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                {/* Grid */}
                {!loading && displayedTournaments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {displayedTournaments.map((t) => (
                            <TournamentCard
                                key={t.id}
                                tournament={t}
                                role={activeTab === 'hosting' ? 'admin' : 'scorer'}
                                onClick={() => navigate(`/tournament/${t.id}/manage`)}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* ── MODALS ─────────────────────────────────── */}
            {showJoinModal && (
                <JoinModal
                    joinCode={joinCode}
                    setJoinCode={setJoinCode}
                    joinStatus={joinStatus}
                    onJoin={handleJoin}
                    onClose={() => { setShowJoinModal(false); setJoinCode(''); setJoinStatus('idle'); }}
                />
            )}

            {/* Slide menu */}
            {isMenuOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setIsMenuOpen(false)} />}
            <div className={`fixed top-0 right-0 w-[280px] h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 transform transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-6 h-full flex flex-col">
                    <button onClick={() => setIsMenuOpen(false)} className="self-end w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white mb-8">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="space-y-1">
                        <button onClick={() => { navigate('/dashboard'); setIsMenuOpen(false); }}
                            className="w-full text-left px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-900 font-bold uppercase text-xs tracking-widest rounded-xl transition-all">
                            Game Dashboard
                        </button>
                        <button onClick={() => { navigate('/tournament/create'); setIsMenuOpen(false); }}
                            className="w-full text-left px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-900 font-bold uppercase text-xs tracking-widest rounded-xl transition-all">
                            New Tournament
                        </button>
                    </div>
                    <div className="mt-auto pt-6 border-t border-zinc-900">
                        <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-red-500 hover:text-red-400 font-bold uppercase text-xs tracking-widest rounded-xl transition-all">
                            Log Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};