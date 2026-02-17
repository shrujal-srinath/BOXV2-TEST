// src/pages/TournamentDashboard.tsx
// "THE ARENA" — Full-bleed cinematic tournament hub

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser, subscribeToAuth } from '../services/authService';
import { subscribeToMyTournaments, subscribeToJoinedTournaments, joinTournament } from '../services/tournamentService';
import type { User } from 'firebase/auth';
import type { Tournament } from '../types';

// ─── Sport Icons ──────────────────────────────────────────────
const sportIcons: Record<string, string> = {
    basketball: '🏀', badminton: '🏸', volleyball: '🏐',
    kabaddi: '🤼', football: '⚽', cricket: '🏏',
};

// ─── Sub-components ───────────────────────────────────────────

// Animated background grid + radial glow
const ArenaBackground: React.FC = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Deep black base */}
        <div className="absolute inset-0 bg-black" />

        {/* Radial gold glow from top */}
        <div
            className="absolute inset-0"
            style={{
                background: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(202,138,4,0.12) 0%, transparent 70%)',
            }}
        />

        {/* Subtle grid lines */}
        <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
                backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
            }}
        />

        {/* Diagonal slash accent — top right */}
        <div
            className="absolute -top-20 right-0 w-[600px] h-[400px] opacity-[0.04]"
            style={{
                background: 'linear-gradient(135deg, transparent 40%, rgba(202,138,4,1) 41%, rgba(202,138,4,1) 42%, transparent 43%)',
            }}
        />
        <div
            className="absolute -top-20 right-0 w-[600px] h-[400px] opacity-[0.025]"
            style={{
                background: 'linear-gradient(135deg, transparent 46%, rgba(202,138,4,1) 47%, rgba(202,138,4,1) 48%, transparent 49%)',
            }}
        />

        {/* Bottom vignette */}
        <div
            className="absolute bottom-0 left-0 right-0 h-64"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}
        />
    </div>
);

// Stats bar pill
const StatPill: React.FC<{ label: string; value: number | string; accent?: boolean }> = ({ label, value, accent }) => (
    <div className={`flex items-center gap-3 px-5 py-3 rounded-full border backdrop-blur-sm transition-all
        ${accent
            ? 'bg-yellow-950/40 border-yellow-700/40 hover:border-yellow-600/60'
            : 'bg-zinc-900/60 border-zinc-800/60 hover:border-zinc-700/60'
        }`}>
        <span className={`text-xl font-black tracking-tight ${accent ? 'text-yellow-400' : 'text-white'}`}>
            {value}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
    </div>
);

// Arena tournament card — full-bleed, always shows actions
const ArenaTournamentCard: React.FC<{
    tournament: Tournament;
    role: 'admin' | 'scorer';
    onClick: () => void;
    index: number;
}> = ({ tournament, role, onClick, index }) => {
    const [copied, setCopied] = useState(false);

    const divisions = tournament.divisions ? Object.values(tournament.divisions) : [];
    const completedDivisions = divisions.filter(d => d.status === 'completed').length;
    const activeDivisions = divisions.filter(d => d.status === 'published').length;
    const activeSports = [...new Set(divisions.map(d => d.sport))];

    const statusConfig = tournament.status === 'active'
        ? { label: 'LIVE', dot: 'bg-green-400 animate-pulse', text: 'text-green-400', border: 'border-green-900/40', glow: 'shadow-green-950/30' }
        : tournament.status === 'archived'
            ? { label: 'ENDED', dot: 'bg-zinc-500', text: 'text-zinc-500', border: 'border-zinc-800/60', glow: '' }
            : { label: 'DRAFT', dot: 'bg-yellow-500', text: 'text-yellow-500', border: 'border-yellow-900/40', glow: 'shadow-yellow-950/20' };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(tournament.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            className={`group relative rounded-2xl border bg-zinc-950/80 backdrop-blur-sm cursor-pointer
                overflow-hidden transition-all duration-300
                hover:border-yellow-700/50 hover:-translate-y-1 hover:shadow-2xl hover:shadow-yellow-950/20
                ${statusConfig.border} ${statusConfig.glow}
            `}
            style={{ animationDelay: `${index * 80}ms` }}
            onClick={onClick}
        >
            {/* Gold shimmer on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'linear-gradient(135deg, transparent 60%, rgba(202,138,4,0.04) 100%)' }} />

            {/* Top accent bar */}
            <div className={`h-[2px] w-full ${role === 'admin'
                ? 'bg-gradient-to-r from-yellow-600/80 via-yellow-500/60 to-transparent'
                : 'bg-gradient-to-r from-blue-600/80 via-blue-500/60 to-transparent'}`} />

            {/* Large watermark sport icon */}
            {activeSports[0] && (
                <div className="absolute -bottom-4 -right-4 text-[96px] opacity-[0.04] group-hover:opacity-[0.07] transition-opacity duration-500 pointer-events-none select-none rotate-12">
                    {sportIcons[activeSports[0]] || '🏆'}
                </div>
            )}

            <div className="p-6 relative z-10">
                {/* Header row */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                        {/* Role badge */}
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest border
                            ${role === 'admin'
                                ? 'bg-yellow-950/50 text-yellow-500 border-yellow-900/50'
                                : 'bg-blue-950/50 text-blue-500 border-blue-900/50'}`}>
                            {role}
                        </span>
                        {/* Status badge */}
                        <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                            <span className={statusConfig.text}>{statusConfig.label}</span>
                        </span>
                    </div>
                    {/* ID chip */}
                    <span className="text-[9px] font-mono text-zinc-600 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                        {tournament.id}
                    </span>
                </div>

                {/* Tournament name */}
                <h3 className="text-2xl font-black italic uppercase tracking-tight text-white mb-1 group-hover:text-yellow-400 transition-colors duration-300 leading-tight">
                    {tournament.name}
                </h3>

                {/* Sports row */}
                <div className="flex items-center gap-1.5 mb-5">
                    {activeSports.slice(0, 4).map(sport => (
                        <span key={sport} className="text-base" title={sport}>{sportIcons[sport] || '🏆'}</span>
                    ))}
                    {activeSports.length > 4 && (
                        <span className="text-[10px] text-zinc-600 font-bold">+{activeSports.length - 4}</span>
                    )}
                    {activeSports.length === 0 && (
                        <span className="text-[10px] text-zinc-700 font-bold uppercase tracking-wider">No sports yet</span>
                    )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                    {[
                        { val: divisions.length, label: 'Divisions' },
                        { val: activeDivisions, label: 'Active' },
                        { val: completedDivisions, label: 'Done' },
                    ].map(({ val, label }) => (
                        <div key={label} className="bg-zinc-900/60 rounded-lg px-3 py-2 text-center border border-zinc-800/60">
                            <div className="text-base font-black text-white">{val}</div>
                            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold mt-0.5">{label}</div>
                        </div>
                    ))}
                </div>

                {/* Progress bar (only if divisions exist) */}
                {divisions.length > 0 && (
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Progress</span>
                            <span className="text-[9px] font-black text-zinc-400">
                                {Math.round((completedDivisions / divisions.length) * 100)}%
                            </span>
                        </div>
                        <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-700"
                                style={{ width: `${Math.round((completedDivisions / divisions.length) * 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* ALWAYS-VISIBLE action buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onClick(); }}
                        className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-yellow-600 hover:text-black text-white text-[10px] font-black uppercase tracking-widest transition-all duration-200 border border-zinc-700 hover:border-yellow-600 flex items-center justify-center gap-1.5"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        Open
                    </button>
                    <button
                        onClick={handleCopy}
                        className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all duration-200 border border-zinc-700 hover:border-zinc-600 flex items-center gap-1.5"
                        title="Copy Tournament Code"
                    >
                        {copied
                            ? <><svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg><span className="text-green-400">Copied</span></>
                            : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span>Code</span></>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};

// Join modal
const JoinModal: React.FC<{
    onClose: () => void;
    onJoin: (code: string) => void;
    status: 'idle' | 'loading' | 'success' | 'error';
    code: string;
    setCode: (v: string) => void;
}> = ({ onClose, onJoin, status, code, setCode }) => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-1">Enter Code</div>
                    <h2 className="text-2xl font-black italic uppercase text-white">Join Event</h2>
                </div>
                <button onClick={onClose} className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition-all text-xl">×</button>
            </div>
            <input
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-yellow-600 text-white text-center font-black text-2xl uppercase tracking-widest py-4 rounded-xl outline-none transition-colors placeholder-zinc-700 mb-4"
                placeholder="XXXXXXXX"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={12}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && onJoin(code)}
            />
            {status === 'error' && (
                <p className="text-red-400 text-xs font-bold text-center mb-4 uppercase tracking-wider">
                    ✗ Code not found or access denied
                </p>
            )}
            <button
                onClick={() => onJoin(code)}
                disabled={status === 'loading' || !code.trim()}
                className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black uppercase tracking-widest text-sm rounded-xl transition-all"
            >
                {status === 'loading' ? 'Joining...' : 'Join Tournament'}
            </button>
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
        let unsubMy: () => void;
        let unsubJoined: () => void;

        const unsubAuth = subscribeToAuth((u) => {
            setUser(u);
            if (u) {
                unsubMy = subscribeToMyTournaments(u.uid, (data) => {
                    setMyTournaments(data);
                    setLoading(false);
                });
                unsubJoined = subscribeToJoinedTournaments(u.uid, (data) => {
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
            showToast('✓ Joined successfully!', 'success');
            setShowJoinModal(false);
            setJoinCode('');
            setJoinStatus('idle');
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

    // ── Filtered tournaments ──────────────────────────────────
    const displayedTournaments = useMemo(() => {
        const source = activeTab === 'hosting' ? myTournaments : joinedTournaments;
        if (!searchQuery.trim()) return source;
        return source.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [activeTab, myTournaments, joinedTournaments, searchQuery]);

    // ─────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
            <ArenaBackground />

            {/* ── TOAST ─────────────────────────────────────── */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl font-bold text-sm shadow-2xl animate-in slide-in-from-top-2 duration-300 border backdrop-blur-xl
                    ${toast.type === 'success' ? 'bg-green-950/90 border-green-800/60 text-green-300'
                        : toast.type === 'error' ? 'bg-red-950/90 border-red-800/60 text-red-300'
                            : 'bg-zinc-900/90 border-zinc-700/60 text-white'}`}>
                    {toast.message}
                </div>
            )}

            {/* ── HEADER ────────────────────────────────────── */}
            <header className="relative z-20 sticky top-0">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-xl border-b border-zinc-900/80" />
                <div className="relative px-6 lg:px-10 h-[72px] flex items-center justify-between">
                    {/* Left — Back + Brand */}
                    <div className="flex items-center gap-4">
                        {/* Back button */}
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-all duration-200"
                        >
                            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-zinc-700 group-hover:bg-zinc-800 flex items-center justify-center transition-all">
                                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">Dashboard</span>
                        </button>

                        {/* Separator */}
                        <div className="h-5 w-px bg-zinc-800 hidden sm:block" />

                        {/* Brand */}
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-yellow-600 flex items-center justify-center">
                                <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                                </svg>
                            </div>
                            <span className="text-white font-black text-sm uppercase tracking-wider hidden md:block">The Arena</span>
                        </div>
                    </div>

                    {/* Center — User info */}
                    <div className="hidden md:flex items-center gap-3 absolute left-1/2 -translate-x-1/2">
                        <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center text-xs font-bold">
                                {user?.photoURL
                                    ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                    : <span>{user?.displayName?.[0]?.toUpperCase() || 'U'}</span>}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full" />
                        </div>
                        <div>
                            <div className="text-[9px] font-bold text-yellow-500 uppercase tracking-widest">Tournament Mode</div>
                            <div className="text-white font-bold text-xs">{user?.displayName || 'Operator'}</div>
                        </div>
                    </div>

                    {/* Right — Actions + Menu */}
                    <div className="flex items-center gap-3">
                        {/* Keyboard hints — desktop only */}
                        <div className="hidden xl:flex items-center gap-3 text-[9px] text-zinc-700 font-mono">
                            <span><kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9px]">C</kbd> Create</span>
                            <span><kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9px]">J</kbd> Join</span>
                        </div>

                        <button
                            onClick={() => setIsMenuOpen(true)}
                            className="group p-2.5 rounded-xl hover:bg-zinc-900 transition-all cursor-pointer space-y-1.5"
                        >
                            <div className="w-5 h-0.5 bg-zinc-500 group-hover:bg-white transition-colors" />
                            <div className="w-5 h-0.5 bg-zinc-500 group-hover:bg-white transition-colors" />
                            <div className="w-3 h-0.5 bg-zinc-500 group-hover:bg-white transition-colors ml-auto" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── HERO BANNER ───────────────────────────────── */}
            <section className="relative z-10 pt-12 pb-10 px-6 lg:px-10">
                {/* Overline */}
                <div className="flex items-center gap-3 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="h-px w-8 bg-yellow-600" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500">Tournament Hub</span>
                </div>

                {/* Headline */}
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black italic uppercase tracking-tighter text-white leading-[0.9] mb-6 animate-in fade-in slide-in-from-bottom-3 duration-600">
                    My Events
                </h1>

                {/* Stats bar */}
                <div className="flex flex-wrap gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <StatPill value={myTournaments.length} label="Hosting" accent />
                    <StatPill value={joinedTournaments.length} label="Scoring" />
                    <StatPill value={activeTournaments.length} label="Live Now" accent={activeTournaments.length > 0} />
                    <StatPill value={totalDivisions} label="Divisions" />
                </div>
            </section>

            {/* ── CONTENT AREA ──────────────────────────────── */}
            <section className="relative z-10 px-6 lg:px-10 pb-16">

                {/* Toolbar — tabs + search + actions */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
                    {/* Tabs */}
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

                    {/* Search */}
                    <div className="relative flex-1 max-w-xs">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search events..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-yellow-700/70 text-white text-xs pl-9 pr-4 py-2.5 rounded-xl outline-none transition-colors placeholder-zinc-600 backdrop-blur-sm"
                        />
                    </div>

                    {/* Push buttons right */}
                    <div className="sm:ml-auto flex items-center gap-3">
                        <button
                            onClick={() => setShowJoinModal(true)}
                            className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-widest text-[10px] transition-all border border-zinc-800 hover:border-zinc-700 flex items-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            Join
                        </button>
                        <button
                            onClick={() => navigate('/tournament/create')}
                            className="px-5 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-yellow-900/30 hover:shadow-yellow-900/50 flex items-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            Create
                        </button>
                    </div>
                </div>

                {/* Divider with label */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">
                        {activeTab === 'hosting' ? 'Your Tournaments' : 'Volunteering As Scorer'}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-l from-zinc-800 to-transparent" />
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-32">
                        <div className="w-8 h-8 rounded-full border-2 border-yellow-600/30 border-t-yellow-500 animate-spin" />
                    </div>
                )}

                {/* Empty state */}
                {!loading && displayedTournaments.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="text-6xl mb-6 opacity-20">
                            {activeTab === 'hosting' ? '🏆' : '🤝'}
                        </div>
                        <h3 className="text-xl font-black italic uppercase text-zinc-400 mb-2">
                            {searchQuery
                                ? 'No results found'
                                : activeTab === 'hosting' ? 'No tournaments yet' : 'Not volunteering anywhere'}
                        </h3>
                        <p className="text-zinc-600 text-xs font-bold uppercase tracking-wider mb-8">
                            {searchQuery
                                ? `Try a different search term`
                                : activeTab === 'hosting' ? 'Create your first event to get started' : 'Join an event with a tournament code'}
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

                {/* ── FULL-BLEED GRID ───────────────────────── */}
                {!loading && displayedTournaments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {displayedTournaments.map((t, index) => (
                            <ArenaTournamentCard
                                key={t.id}
                                tournament={t}
                                role={activeTab === 'hosting' ? 'admin' : 'scorer'}
                                onClick={() => navigate(`/tournament/${t.id}/manage`)}
                                index={index}
                            />
                        ))}

                        {/* "Create new" ghost card */}
                        {activeTab === 'hosting' && (
                            <button
                                onClick={() => navigate('/tournament/create')}
                                className="group rounded-2xl border-2 border-dashed border-zinc-800 hover:border-yellow-700/60 bg-zinc-950/40 hover:bg-zinc-950/80 transition-all duration-300 p-6 flex flex-col items-center justify-center gap-3 min-h-[280px] cursor-pointer"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-zinc-900 group-hover:bg-zinc-800 border border-zinc-800 group-hover:border-yellow-700/50 flex items-center justify-center transition-all duration-300">
                                    <svg className="w-7 h-7 text-zinc-600 group-hover:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <div className="text-center">
                                    <div className="text-sm font-black italic uppercase text-zinc-500 group-hover:text-white transition-colors">New Event</div>
                                    <div className="text-[10px] text-zinc-700 font-bold uppercase tracking-wider mt-0.5 group-hover:text-zinc-500 transition-colors">Create Tournament</div>
                                </div>
                            </button>
                        )}
                    </div>
                )}
            </section>

            {/* ── SLIDE MENU ────────────────────────────────── */}
            {isMenuOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200" onClick={() => setIsMenuOpen(false)} />
            )}
            <div className={`fixed top-0 right-0 w-[300px] h-full bg-zinc-950 border-l border-zinc-900 shadow-2xl z-50 transform transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-8 h-full flex flex-col">
                    <button onClick={() => setIsMenuOpen(false)} className="self-end text-2xl text-zinc-500 hover:text-white transition-colors mb-10">×</button>

                    <div className="space-y-2">
                        <button
                            onClick={() => { navigate('/dashboard'); setIsMenuOpen(false); }}
                            className="w-full text-left px-4 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-3"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            Standard Dashboard
                        </button>
                        <button
                            onClick={() => { navigate('/tournament/create'); setIsMenuOpen(false); }}
                            className="w-full text-left px-4 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-3"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Tournament
                        </button>
                        <button
                            onClick={() => { setShowJoinModal(true); setIsMenuOpen(false); }}
                            className="w-full text-left px-4 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-3"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            Join Tournament
                        </button>
                    </div>

                    <div className="mt-auto pt-6 border-t border-zinc-900 space-y-2">
                        <div className="text-[9px] text-zinc-600 uppercase tracking-[0.3em] font-bold mb-3">Account</div>
                        {user && (
                            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 mb-2">
                                <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center text-xs font-bold border border-zinc-700">
                                    {user.photoURL
                                        ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                        : user.displayName?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <div>
                                    <div className="text-white font-bold text-xs">{user.displayName}</div>
                                    <div className="text-[9px] text-zinc-500 truncate max-w-[160px]">{user.email}</div>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-3 rounded-xl text-red-500 hover:text-red-400 hover:bg-red-950/30 font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-3"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Log Out
                        </button>
                    </div>
                </div>
            </div>

            {/* ── JOIN MODAL ────────────────────────────────── */}
            {showJoinModal && (
                <JoinModal
                    onClose={() => { setShowJoinModal(false); setJoinCode(''); setJoinStatus('idle'); }}
                    onJoin={handleJoin}
                    status={joinStatus}
                    code={joinCode}
                    setCode={setJoinCode}
                />
            )}
        </div>
    );
};