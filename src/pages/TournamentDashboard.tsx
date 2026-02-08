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

    // Join Modal
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [joinStatus, setJoinStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    useEffect(() => {
        let unsubMy: () => void;
        let unsubJoined: () => void;

        const unsubAuth = subscribeToAuth((u) => {
            setUser(u);
            if (u) {
                // Setup Real-time Listeners
                unsubMy = subscribeToMyTournaments(u.uid, (data) => setMyTournaments(data));
                unsubJoined = subscribeToJoinedTournaments(u.uid, (data) => setJoinedTournaments(data));
                setLoading(false);
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

    const handleJoin = async () => {
        if (!joinCode) return;
        setJoinStatus('loading');
        try {
            await joinTournament(joinCode.toUpperCase());
            setJoinStatus('success');
            setTimeout(() => {
                setShowJoinModal(false);
                setJoinCode("");
                setJoinStatus('idle');
            }, 1500);
        } catch (error) {
            console.error(error);
            setJoinStatus('error');
        }
    };

    const handleLogout = async () => {
        await logoutUser();
        navigate('/');
    };

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-black font-sans text-white transition-transform duration-300 border-t-4 border-yellow-600">
            {/* HEADER */}
            <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md p-6 flex justify-between items-center sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black italic text-sm shadow-lg overflow-hidden border-2 ${user ? 'border-yellow-500 bg-zinc-800' : 'border-zinc-600 bg-zinc-800'}`}>
                            {user?.photoURL ? <img src={user.photoURL} alt="User" className="w-full h-full object-cover" /> : <span className="text-zinc-400">{user ? user.displayName?.[0] || 'U' : 'G'}</span>}
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full animate-pulse"></div>
                    </div>
                    <div>
                        <div className="text-[9px] font-bold text-yellow-500 uppercase tracking-widest mb-0.5">Tournament Mode</div>
                        <div className="text-white font-bold text-sm leading-none">{user ? (user.displayName || 'Operator') : 'Guest User'}</div>
                    </div>
                </div>
                <button onClick={() => setIsMenuOpen(true)} className="group p-2 space-y-1.5 cursor-pointer z-30 hover:bg-zinc-800 rounded transition-colors">
                    <div className="w-6 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors"></div>
                    <div className="w-6 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors"></div>
                    <div className="w-4 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors ml-auto"></div>
                </button>
            </header>

            {/* MAIN CONTENT */}
            <main className="max-w-7xl mx-auto p-6 md:p-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-2">My Events</h1>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Select an event to manage or score</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setShowJoinModal(true)} className="px-6 py-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase tracking-widest text-xs transition-all border border-zinc-700">
                            Join Event
                        </button>
                        <button onClick={() => navigate('/tournament/create')} className="bg-yellow-600 hover:bg-yellow-500 text-black font-black py-4 px-8 rounded-lg uppercase tracking-widest text-xs shadow-lg shadow-yellow-900/20 transition-all flex items-center gap-3">
                            <span className="text-xl">+</span> Create New
                        </button>
                    </div>
                </div>

                {/* ADMIN SECTION */}
                <section className="mb-12">
                    <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span> Organizing
                    </h3>
                    {myTournaments.length === 0 ? (
                        <div className="border border-dashed border-zinc-800 rounded-2xl p-8 text-center opacity-50">
                            <p className="text-zinc-600 text-xs font-mono uppercase">You are not organizing any tournaments.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {myTournaments.map(t => (
                                <TournamentCard key={t.id} tournament={t} role="admin" onClick={() => navigate(`/tournament/${t.id}/manage`)} />
                            ))}
                        </div>
                    )}
                </section>

                {/* SCORER SECTION */}
                <section>
                    <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Volunteering
                    </h3>
                    {joinedTournaments.length === 0 ? (
                        <div className="border border-dashed border-zinc-800 rounded-2xl p-8 text-center opacity-50">
                            <p className="text-zinc-600 text-xs font-mono uppercase">You haven't joined any tournaments yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {joinedTournaments.map(t => (
                                <TournamentCard key={t.id} tournament={t} role="scorer" onClick={() => navigate(`/tournament/${t.id}/manage`)} />
                            ))}
                        </div>
                    )}
                </section>
            </main>

            {/* JOIN MODAL */}
            {showJoinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-xl p-6 relative">
                        <button onClick={() => setShowJoinModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">&times;</button>
                        <h3 className="text-lg font-black italic text-white uppercase mb-1">Join Event</h3>
                        <p className="text-xs text-zinc-500 mb-6">Enter the 6-digit Tournament Code.</p>
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="CODE" maxLength={6} className="w-full bg-black border-2 border-zinc-700 p-4 text-center text-2xl font-mono font-bold text-white rounded-lg outline-none focus:border-yellow-500 mb-4 uppercase tracking-widest" />
                        {joinStatus === 'error' && <div className="text-red-500 text-xs font-bold text-center mb-4">Invalid Code or Network Error</div>}
                        {joinStatus === 'success' && <div className="text-green-500 text-xs font-bold text-center mb-4">Request Sent!</div>}
                        <button onClick={handleJoin} disabled={joinStatus === 'loading' || joinStatus === 'success' || !joinCode} className="w-full bg-white hover:bg-zinc-200 text-black font-black py-4 rounded-lg uppercase tracking-widest text-xs disabled:opacity-50">
                            {joinStatus === 'loading' ? 'Verifying...' : 'Request Access'}
                        </button>
                    </div>
                </div>
            )}

            {/* SLIDE MENU (Simplified) */}
            {isMenuOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setIsMenuOpen(false)}></div>}
            <div className={`fixed top-0 right-0 w-[300px] h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 transform transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-6 h-full flex flex-col">
                    <button onClick={() => setIsMenuOpen(false)} className="self-end text-2xl text-zinc-500 hover:text-white">&times;</button>
                    <div className="mt-8 space-y-2">
                        <button onClick={() => navigate('/dashboard')} className="w-full text-left text-zinc-400 hover:text-white font-bold uppercase text-xs p-2">Standard Dashboard</button>
                    </div>
                    <div className="mt-auto pt-6 border-t border-zinc-900">
                        <button onClick={handleLogout} className="text-red-500 font-bold uppercase text-xs">Log Out</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Safe Card Component
const TournamentCard = ({ tournament, role, onClick }: { tournament: Tournament; role: 'admin' | 'scorer'; onClick: () => void }) => {
    const activeCourts = Object.values(tournament.config.sports).reduce((total: number, s: any) => total + (s?.isActive ? (s.courts || 0) : 0), 0);
    const activeSports = Object.values(tournament.config.sports).filter((s: any) => s?.isActive).length;
    return (
        <div onClick={onClick} className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl relative overflow-hidden group hover:border-yellow-600/50 transition-all cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span className="text-6xl">🏆</span></div>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest ${role === 'admin' ? 'bg-yellow-900/20 text-yellow-500' : 'bg-blue-900/20 text-blue-500'}`}>{role}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{tournament.id}</span>
                </div>
                <h3 className="text-2xl font-black italic text-white uppercase tracking-tight mb-2 truncate">{tournament.name}</h3>
                <div className="flex gap-4 text-xs text-zinc-400 font-mono mt-4"><span>{activeSports} Sports</span><span>•</span><span>{activeCourts} Courts</span></div>
            </div>
        </div>
    );
};