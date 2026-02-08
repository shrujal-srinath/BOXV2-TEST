import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser, subscribeToAuth } from '../services/authService';
import { getMyTournaments } from '../services/tournamentService';
import type { User } from 'firebase/auth';
import type { Tournament } from '../types';

export const TournamentDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Fetch tournaments when user logs in
    const fetchTournaments = async () => {
        try {
            const data = await getMyTournaments();
            setTournaments(data);
        } catch (error) {
            console.error("Failed to load tournaments", error);
        }
    };

    useEffect(() => {
        const unsub = subscribeToAuth((u) => {
            setUser(u);
            if (u) {
                fetchTournaments().then(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

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

                <button onClick={() => setIsMenuOpen(true)} className="group p-2 space-y-1.5 cursor-pointer z-30 hover:bg-zinc-800 rounded transition-colors" aria-label="Open menu">
                    <div className="w-6 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors"></div>
                    <div className="w-6 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors"></div>
                    <div className="w-4 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors ml-auto"></div>
                </button>
            </header>

            {/* SLIDE-OUT MENU */}
            <div className={`fixed top-0 right-0 w-[300px] h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 transform transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-6 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Menu</h2>
                        <button onClick={() => setIsMenuOpen(false)} className="text-2xl text-zinc-500 hover:text-white transition-colors">&times;</button>
                    </div>
                    <div className="space-y-1 flex-1 overflow-y-auto">
                        <MenuItem label="Standard Dashboard" icon="⊞" onClick={() => navigate('/dashboard')} subtitle="Return to Single Games" />
                        <MenuItem label="Tournament Mode" icon="🏆" active highlight onClick={() => setIsMenuOpen(false)} />
                    </div>
                    <div className="pt-6 border-t border-zinc-900">
                        <button onClick={handleLogout} className="w-full text-left flex items-center gap-4 p-4 hover:bg-red-900/10 text-red-500 transition-colors uppercase font-bold text-xs tracking-widest rounded">
                            <span className="text-lg">↪</span> <span>Log Out</span>
                        </button>
                    </div>
                </div>
            </div>

            {isMenuOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setIsMenuOpen(false)}></div>}

            {/* MAIN CONTENT */}
            <main className="max-w-7xl mx-auto p-6 md:p-12">

                {/* ACTION BAR */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-2">My Tournaments</h1>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Manage your leagues and events</p>
                    </div>
                    <button
                        onClick={() => navigate('/tournament/create')} // DIRECT LINK TO STUDIO
                        className="bg-yellow-600 hover:bg-yellow-500 text-black font-black py-4 px-8 rounded-lg uppercase tracking-widest text-xs shadow-lg shadow-yellow-900/20 transition-all flex items-center gap-3"
                    >
                        <span className="text-xl">+</span> Create New
                    </button>
                </div>

                {/* TOURNAMENT LIST */}
                {tournaments.length === 0 ? (
                    <div className="border border-dashed border-zinc-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center hover:bg-zinc-900/30 transition-colors">
                        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                            <span className="text-4xl grayscale opacity-50">🏆</span>
                        </div>
                        <h3 className="text-white font-bold text-lg mb-2">No Tournaments Found</h3>
                        <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-8">You haven't created any tournaments yet. Start a new event to manage brackets and scorers.</p>
                        <button onClick={() => navigate('/tournament/create')} className="text-yellow-500 hover:text-white text-xs font-bold uppercase tracking-widest">Create First Tournament &rarr;</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tournaments.map(t => (
                            <div key={t.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl relative overflow-hidden group hover:border-yellow-600/50 transition-all">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <span className="text-6xl">🏆</span>
                                </div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="bg-black text-zinc-500 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest">
                                            {Object.keys(t.config.sports).length} Sports
                                        </span>
                                        <span className="text-[10px] font-mono text-yellow-500">{t.id}</span>
                                    </div>
                                    <h3 className="text-2xl font-black italic text-white uppercase tracking-tight mb-2 truncate">{t.name}</h3>
                                    <div className="flex gap-4 text-xs text-zinc-400 mb-6 font-mono">
                                        <span>{Object.values(t.config.sports).reduce((acc, curr) => acc + (curr?.isActive ? (curr.courts || 0) : 0), 0)} Courts</span>
                                        <span>•</span>
                                        <span>{Object.keys(t.pendingRequests || {}).length} Pending Requests</span>
                                    </div>
                                    <button
                                        onClick={() => navigate(`/tournament/${t.id}/manage`)}
                                        className="w-full py-3 bg-zinc-800 hover:bg-white hover:text-black text-white font-bold uppercase tracking-widest text-xs rounded transition-colors"
                                    >
                                        Manage Console
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </main>

        </div>
    );
};

// --- HELPER COMPONENT ---
const MenuItem = ({ label, icon, onClick, active, highlight, subtitle }: any) => (
    <button onClick={onClick} className={`w-full text-left flex items-center justify-between p-4 rounded transition-all uppercase font-bold text-[10px] tracking-widest relative ${active ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'} ${highlight ? 'text-yellow-500 border border-yellow-900/30 bg-yellow-900/10' : ''}`}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
            <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
                <div className="truncate">{label}</div>
                {subtitle && <div className="text-[8px] text-zinc-600 mt-0.5 normal-case tracking-normal truncate">{subtitle}</div>}
            </div>
        </div>
    </button>
);