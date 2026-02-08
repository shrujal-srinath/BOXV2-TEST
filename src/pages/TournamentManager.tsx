import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTournament } from '../services/tournamentService';
import type { Tournament } from '../types';

export const TournamentManager: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            getTournament(id).then(t => {
                setTournament(t);
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-mono animate-pulse">LOADING COMMAND CENTER...</div>;
    if (!tournament) return <div className="min-h-screen bg-black flex items-center justify-center text-red-500 font-bold">TOURNAMENT NOT FOUND</div>;

    return (
        <div className="min-h-screen bg-black text-white font-sans">

            {/* HEADER */}
            <header className="border-b border-zinc-800 bg-zinc-900/50 p-6 flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <button onClick={() => navigate('/tournament')} className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest">&larr; Dashboard</button>
                        <span className="text-zinc-700">/</span>
                        <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{tournament.id}</span>
                    </div>
                    <h1 className="text-2xl font-black italic uppercase text-white">{tournament.name}</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Status</div>
                        <div className="text-green-500 font-bold text-xs uppercase flex items-center gap-2 justify-end">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Active
                        </div>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="max-w-7xl mx-auto p-6 md:p-12 grid grid-cols-1 md:grid-cols-12 gap-8">

                {/* LEFT COL: OPERATIONS */}
                <div className="md:col-span-8 space-y-8">

                    {/* QUICK STATS */}
                    <div className="grid grid-cols-3 gap-4">
                        <StatCard label="Live Matches" value="0" />
                        <StatCard label="Pending Staff" value={Object.values(tournament.pendingRequests).length.toString()} accent="red" />
                        <StatCard label="Total Fixtures" value="0" />
                    </div>

                    {/* FIXTURE MANAGER (Placeholder) */}
                    <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-8 text-center min-h-[300px] flex flex-col items-center justify-center border-dashed">
                        <div className="text-4xl mb-4 grayscale opacity-30">📅</div>
                        <h3 className="text-xl font-bold text-white mb-2">Fixture Manager</h3>
                        <p className="text-zinc-500 text-sm max-w-sm mb-6">Schedule matches in advance so scorers don't have to type team names manually.</p>
                        <button className="px-6 py-3 bg-zinc-800 hover:bg-white hover:text-black text-white font-bold uppercase tracking-widest text-xs rounded transition-colors">
                            + Add First Match
                        </button>
                    </div>
                </div>

                {/* RIGHT COL: ACCESS & TOOLS */}
                <div className="md:col-span-4 space-y-6">

                    {/* ACCESS CARD */}
                    <div className="bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-xl p-6 shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="text-[10px] text-yellow-200 font-bold uppercase tracking-widest mb-1">Scorer Access PIN</div>
                            <div className="text-5xl font-mono font-black text-white tracking-widest mb-4">{tournament.scorerPin}</div>
                            <button
                                onClick={() => navigator.clipboard.writeText(`Join ${tournament.name} as a Scorer! ID: ${tournament.id} PIN: ${tournament.scorerPin}`)}
                                className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-2 rounded text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                            >
                                <span>📋</span> Copy Invite
                            </button>
                        </div>
                        {/* Deco */}
                        <div className="absolute -right-6 -bottom-6 text-9xl text-black opacity-10 rotate-12">🔑</div>
                    </div>

                    {/* CHECKLIST */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b border-zinc-800 pb-2">Launch Checklist</h3>
                        <div className="space-y-3">
                            <CheckItem label="Share PIN with Volunteers" done={false} />
                            <CheckItem label="Approve Staff Requests" done={false} />
                            <CheckItem label="Open Wall View on Big Screen" done={false} onClick={() => window.open('/wall', '_blank')} />
                            <CheckItem label="Add First Fixture" done={false} />
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};

// --- HELPERS ---
const StatCard = ({ label, value, accent }: any) => (
    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">{label}</div>
        <div className={`text-3xl font-black ${accent === 'red' && value !== '0' ? 'text-red-500' : 'text-white'}`}>{value}</div>
    </div>
);

const CheckItem = ({ label, done, onClick }: any) => (
    <button onClick={onClick} className="flex items-center gap-3 w-full text-left group hover:bg-zinc-800/50 p-2 -ml-2 rounded transition-colors">
        <div className={`w-5 h-5 rounded border flex items-center justify-center ${done ? 'bg-green-500 border-green-500' : 'border-zinc-700 bg-black'}`}>
            {done && <span className="text-black text-xs font-bold">✓</span>}
        </div>
        <span className={`text-xs font-bold ${done ? 'text-zinc-500 line-through' : 'text-zinc-300 group-hover:text-white'}`}>{label}</span>
        {onClick && <span className="ml-auto text-[10px] text-blue-500 uppercase font-bold">Open &rarr;</span>}
    </button>
);