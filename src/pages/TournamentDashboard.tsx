// src/pages/TournamentDashboard.tsx
// COMPLETE FILE - FINE-TUNED VERSION
// All polish improvements included

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser, subscribeToAuth } from '../services/authService';
import { subscribeToMyTournaments, subscribeToJoinedTournaments, joinTournament } from '../services/tournamentService';
import type { User } from 'firebase/auth';
import type { Tournament } from '../types';

export const TournamentDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [myTournaments, setMyTournaments] = useState<Tournament[]>([]);
    const [joinedTournaments, setJoinedTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'hosting' | 'volunteering'>('hosting');

    // Join Modal
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [joinStatus, setJoinStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    // Toast Notification
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

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
            if (unsubMy) unsubMy();
            if (unsubJoined) unsubJoined();
        };
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            // Only trigger if not typing in input
            if (e.target instanceof HTMLInputElement) return;

            if (e.key === 'c' || e.key === 'C') {
                navigate('/tournament/create');
            } else if (e.key === 'j' || e.key === 'J') {
                setShowJoinModal(true);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [navigate]);

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleJoin = async () => {
        if (!joinCode.trim()) {
            showToast('Please enter a tournament code', 'error');
            return;
        }

        setJoinStatus('loading');
        try {
            await joinTournament(joinCode.toUpperCase());
            setJoinStatus('success');
            showToast(`Successfully joined ${joinCode.toUpperCase()}!`, 'success');
            setTimeout(() => {
                setShowJoinModal(false);
                setJoinCode("");
                setJoinStatus('idle');
            }, 1500);
        } catch (err: any) {
            setJoinStatus('error');
            showToast(err.message || 'Failed to join tournament', 'error');
            setTimeout(() => setJoinStatus('idle'), 2000);
        }
    };

    const handleLogout = async () => {
        await logoutUser();
        navigate('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="space-y-6 w-full max-w-7xl px-6">
                    {/* Skeleton Header */}
                    <div className="h-20 bg-zinc-900/50 rounded-xl animate-pulse"></div>

                    {/* Skeleton Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 bg-zinc-900/50 rounded-2xl animate-pulse"
                                style={{ animationDelay: `${i * 100}ms` }}></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white relative">
            {/* HEADER */}
            <header className="bg-zinc-950/50 backdrop-blur-md border-b border-zinc-900 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center font-black text-sm border border-zinc-800 overflow-hidden">
                                {user?.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <span>{user?.displayName?.[0] || 'U'}</span>}
                            </div>
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full animate-pulse"></div>
                        </div>
                        <div>
                            <div className="text-[9px] font-bold text-yellow-500 uppercase tracking-widest mb-0.5">Tournament Mode</div>
                            <div className="text-white font-bold text-sm leading-none">{user?.displayName || 'Operator'}</div>
                        </div>
                    </div>

                    {/* Keyboard Hint */}
                    <div className="hidden lg:flex items-center gap-2 text-[10px] text-zinc-600 font-mono">
                        <kbd className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded">C</kbd>
                        <span>Create</span>
                        <kbd className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded ml-4">J</kbd>
                        <span>Join</span>
                    </div>

                    <button onClick={() => setIsMenuOpen(true)} className="group p-2 space-y-1.5 cursor-pointer hover:bg-zinc-900 rounded-lg transition-all">
                        <div className="w-6 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors"></div>
                        <div className="w-6 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors"></div>
                        <div className="w-4 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors ml-auto"></div>
                    </button>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="max-w-7xl mx-auto p-6 md:p-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black italic text-white uppercase tracking-tighter mb-2">My Events</h1>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Select an event to manage or score</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setShowJoinModal(true)}
                            className="group px-6 py-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold uppercase tracking-widest text-xs transition-all border border-zinc-800 hover:border-zinc-700 hover:shadow-lg hover:shadow-zinc-900/50"
                        >
                            <span className="group-hover:scale-110 inline-block transition-transform">Join Event</span>
                        </button>
                        <button
                            onClick={() => navigate('/tournament/create')}
                            className="group bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-black py-4 px-8 rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-yellow-900/30 hover:shadow-yellow-900/50 transition-all flex items-center gap-3 hover:-translate-y-0.5"
                        >
                            <span className="text-xl group-hover:rotate-90 transition-transform duration-300">+</span>
                            <span>Create New</span>
                        </button>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex gap-8 border-b border-zinc-900 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '100ms' }}>
                    <button
                        onClick={() => setActiveTab('hosting')}
                        className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'hosting' ? 'text-yellow-500' : 'text-zinc-500 hover:text-white'}`}
                    >
                        My Events
                        {activeTab === 'hosting' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-600 to-yellow-500 animate-in slide-in-from-left duration-300"></div>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('volunteering')}
                        className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'volunteering' ? 'text-blue-500' : 'text-zinc-500 hover:text-white'}`}
                    >
                        Volunteering
                        {activeTab === 'volunteering' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-blue-500 animate-in slide-in-from-left duration-300"></div>
                        )}
                    </button>
                </div>

                {/* HOSTING VIEW */}
                {activeTab === 'hosting' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {myTournaments.length === 0 ? (
                            <div className="border-2 border-dashed border-zinc-900 rounded-3xl p-16 text-center">
                                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-zinc-900 flex items-center justify-center">
                                    <svg className="w-12 h-12 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-zinc-400 mb-2">No tournaments yet</h3>
                                <p className="text-zinc-600 text-sm mb-8">Get started by creating your first event</p>
                                <button
                                    onClick={() => navigate('/tournament/create')}
                                    className="bg-yellow-600 hover:bg-yellow-500 text-black font-black py-3 px-6 rounded-lg uppercase text-xs transition-all inline-flex items-center gap-2"
                                >
                                    <span>Create Tournament</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {myTournaments.map((t, index) => (
                                    <EnhancedTournamentCard
                                        key={t.id}
                                        tournament={t}
                                        role="admin"
                                        onClick={() => navigate(`/tournament/${t.id}/manage`)}
                                        index={index}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* VOLUNTEERING VIEW */}
                {activeTab === 'volunteering' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {joinedTournaments.length === 0 ? (
                            <div className="border-2 border-dashed border-zinc-900 rounded-3xl p-16 text-center">
                                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-zinc-900 flex items-center justify-center">
                                    <svg className="w-12 h-12 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-zinc-400 mb-2">Not volunteering yet</h3>
                                <p className="text-zinc-600 text-sm mb-8">Join a tournament to help with scoring</p>
                                <button
                                    onClick={() => setShowJoinModal(true)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-6 rounded-lg uppercase text-xs transition-all inline-flex items-center gap-2"
                                >
                                    <span>Join with Code</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {joinedTournaments.map((t, index) => (
                                    <EnhancedTournamentCard
                                        key={t.id}
                                        tournament={t}
                                        role="scorer"
                                        onClick={() => navigate(`/tournament/${t.id}/manage`)}
                                        index={index}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* JOIN MODAL */}
            {showJoinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowJoinModal(false)}></div>
                    <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md p-8 relative z-10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black uppercase text-white tracking-wider">Join Tournament</h3>
                            <button onClick={() => setShowJoinModal(false)} className="text-zinc-500 hover:text-white text-2xl transition-colors">×</button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Tournament Code</label>
                                <input
                                    autoFocus
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                                    placeholder="KREED-2026"
                                    className="w-full bg-black border-2 border-zinc-800 focus:border-blue-600 p-4 rounded-xl text-white font-mono uppercase tracking-widest text-center text-xl outline-none transition-colors"
                                    disabled={joinStatus === 'loading'}
                                />
                            </div>

                            <button
                                onClick={handleJoin}
                                disabled={joinStatus === 'loading' || !joinCode.trim()}
                                className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${joinStatus === 'success'
                                    ? 'bg-green-600 text-white'
                                    : joinStatus === 'error'
                                        ? 'bg-red-600 text-white'
                                        : joinStatus === 'loading'
                                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-lg hover:shadow-blue-900/50'
                                    }`}
                            >
                                {joinStatus === 'loading' && (
                                    <span className="inline-block animate-spin mr-2">⟳</span>
                                )}
                                {joinStatus === 'success' ? '✓ Joined Successfully' : joinStatus === 'error' ? '✗ Failed to Join' : joinStatus === 'loading' ? 'Verifying...' : 'Request Access'}
                            </button>

                            <p className="text-xs text-zinc-600 text-center">
                                Ask the tournament admin for the access code
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST NOTIFICATION */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <div className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[300px] ${toast.type === 'success' ? 'bg-green-600 text-white' :
                        toast.type === 'error' ? 'bg-red-600 text-white' :
                            'bg-blue-600 text-white'
                        }`}>
                        <span className="text-xl">
                            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : 'ℹ'}
                        </span>
                        <span className="font-bold text-sm">{toast.message}</span>
                    </div>
                </div>
            )}

            {/* SLIDE MENU */}
            {isMenuOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200" onClick={() => setIsMenuOpen(false)}></div>}
            <div className={`fixed top-0 right-0 w-[320px] h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 transform transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-8 h-full flex flex-col">
                    <button onClick={() => setIsMenuOpen(false)} className="self-end text-3xl text-zinc-500 hover:text-white transition-colors mb-8">×</button>

                    <div className="space-y-3">
                        <button
                            onClick={() => { navigate('/dashboard'); setIsMenuOpen(false); }}
                            className="w-full text-left px-4 py-3 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 font-bold uppercase text-xs transition-all"
                        >
                            Standard Dashboard
                        </button>
                    </div>

                    <div className="mt-auto pt-8 border-t border-zinc-900 space-y-3">
                        <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Account</div>
                        <button
                            onClick={handleLogout}
                            className="text-red-500 hover:text-red-400 font-bold uppercase text-xs transition-colors"
                        >
                            Log Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ENHANCED TOURNAMENT CARD COMPONENT
const EnhancedTournamentCard = ({ tournament, role, onClick, index }: {
    tournament: Tournament;
    role: 'admin' | 'scorer';
    onClick: () => void;
    index: number;
}) => {
    const divisions = tournament.divisions ? Object.values(tournament.divisions) : [];
    const activeSports = Array.from(new Set(divisions.filter(d => d.isActive).map(d => d.sport)));
    const totalTeams = divisions.reduce((acc, curr) => acc + (curr.bracketSize || 0), 0);

    // Check statuses
    const hasLiveGames = divisions.some(d => d.status === 'published');
    const hasDraftGames = divisions.some(d => d.status === 'draft');
    const completedDivisions = divisions.filter(d => d.status === 'completed').length;

    // Sport icons mapping
    const sportIcons: { [key: string]: string } = {
        basketball: '🏀',
        badminton: '🏸',
        volleyball: '🏐',
        kabaddi: '🤼',
        football: '⚽',
        cricket: '🏏'
    };

    return (
        <div
            onClick={onClick}
            className="group bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-yellow-600/50 rounded-2xl p-6 relative overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-yellow-900/20 animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 100}ms`, animationDuration: '500ms' }}
        >
            {/* Animated gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/0 via-yellow-900/0 to-yellow-900/0 group-hover:from-yellow-900/5 group-hover:via-yellow-900/10 group-hover:to-transparent transition-all duration-500 pointer-events-none"></div>

            {/* Status Badge - Top Right */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                {hasLiveGames && (
                    <div className="flex items-center gap-2 bg-red-600/20 border border-red-600/30 px-3 py-1.5 rounded-full backdrop-blur-sm">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Live</span>
                    </div>
                )}
                {hasDraftGames && !hasLiveGames && (
                    <div className="flex items-center gap-2 bg-yellow-600/20 border border-yellow-600/30 px-3 py-1.5 rounded-full backdrop-blur-sm">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">Draft</span>
                    </div>
                )}
            </div>

            {/* Trophy Icon Background */}
            <div className="absolute -bottom-6 -right-6 opacity-5 group-hover:opacity-10 group-hover:rotate-12 transition-all duration-500 pointer-events-none">
                <svg className="w-32 h-32 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 9v10h14V9H5zm0-4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2H5V5zm12 16H7v-2h10v2z" />
                </svg>
            </div>

            <div className="relative z-10">
                {/* Header - Role Badge + ID */}
                <div className="flex justify-between items-start mb-4">
                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest border backdrop-blur-sm ${role === 'admin'
                        ? 'bg-yellow-900/20 text-yellow-500 border-yellow-900/30'
                        : 'bg-blue-900/20 text-blue-500 border-blue-900/30'
                        }`}>
                        {role}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900/50 px-2 py-1 rounded border border-zinc-800">{tournament.id}</span>
                </div>

                {/* Tournament Name */}
                <h3 className="text-2xl font-black italic text-white uppercase tracking-tight mb-4 truncate group-hover:text-yellow-500 transition-colors duration-300">
                    {tournament.name}
                </h3>

                {/* Stats Grid - NEW ENHANCED VERSION */}
                <div className="space-y-3 mb-4">
                    {/* Sports Row */}
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Sports</span>
                        <div className="flex items-center gap-1.5">
                            {activeSports.slice(0, 3).map(sport => (
                                <span key={sport} className="text-lg" title={sport}>
                                    {sportIcons[sport] || '🏆'}
                                </span>
                            ))}
                            {activeSports.length > 3 && (
                                <span className="text-xs text-zinc-600 ml-1">+{activeSports.length - 3}</span>
                            )}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent"></div>

                    {/* Teams Row */}
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Teams</span>
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="text-sm font-bold text-white">{totalTeams || 'TBD'}</span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent"></div>

                    {/* Progress Row */}
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Progress</span>
                        <div className="flex items-center gap-2">
                            {completedDivisions > 0 && (
                                <span className="text-xs text-green-500 font-bold">{completedDivisions} Complete</span>
                            )}
                            {divisions.length > 0 && (
                                <span className="text-xs text-zinc-600">
                                    {Math.round((completedDivisions / divisions.length) * 100)}%
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions - Appears on Hover */}
                <div className="pt-4 border-t border-zinc-800 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-2 transform translate-y-2 group-hover:translate-y-0">
                    <button
                        onClick={(e) => { e.stopPropagation(); onClick(); }}
                        className="flex-1 py-2.5 bg-zinc-800/50 hover:bg-yellow-600 hover:text-black backdrop-blur-sm rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border border-zinc-700 hover:border-yellow-600"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View
                        </span>
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(tournament.id);
                            // Show toast: "Code copied!"
                        }}
                        className="px-3 py-2.5 bg-zinc-800/50 hover:bg-zinc-700 backdrop-blur-sm rounded-lg transition-all border border-zinc-700 hover:border-zinc-600"
                        title="Copy Tournament Code"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};