import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeToTournament, subscribeToFixtures, createFixture, handleRequest, startTournamentMatch } from '../services/tournamentService';
import { auth } from '../services/authService'; // Direct auth import for ID check
import type { Tournament, TournamentFixture, SportType } from '../types';

export const TournamentManager: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Data
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [fixtures, setFixtures] = useState<TournamentFixture[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'fixtures' | 'staff'>('fixtures');
    const [showFixtureModal, setShowFixtureModal] = useState(false);
    const [newFixture, setNewFixture] = useState<Partial<TournamentFixture>>({ sport: 'basketball' });
    const [isStarting, setIsStarting] = useState(false);

    useEffect(() => {
        if (!id) return;
        // Real-time listeners
        const unsubT = subscribeToTournament(id, setTournament);
        const unsubF = subscribeToFixtures(id, setFixtures);
        setLoading(false);
        return () => { unsubT(); unsubF(); };
    }, [id]);

    const handleAddFixture = async () => {
        if (!id || !newFixture.teamA || !newFixture.teamB) return;
        await createFixture(id, newFixture);
        setShowFixtureModal(false);
        setNewFixture({ sport: 'basketball' });
    };

    // SCORER ACTION: Start the game
    const handleStartMatch = async (fixture: TournamentFixture) => {
        if (!id || isStarting) return;

        // If already live, just go there
        if (fixture.status === 'live' && fixture.gameCode) {
            navigate(`/tablet/${fixture.gameCode}`);
            return;
        }

        setIsStarting(true);
        try {
            const gameCode = await startTournamentMatch(id, fixture.id, fixture);
            navigate(`/tablet/${gameCode}`); // Go to Scorer Tablet Interface
        } catch (error) {
            console.error(error);
            alert("Failed to start match.");
            setIsStarting(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-mono animate-pulse">LOADING...</div>;
    if (!tournament) return <div className="min-h-screen bg-black flex items-center justify-center text-red-500 font-bold">NOT FOUND</div>;

    const isAdmin = auth.currentUser?.uid === tournament.adminId;
    const pendingRequests = Object.entries(tournament.pendingRequests || {}).filter(([_, req]) => req.status === 'pending');

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
                <div className="flex gap-4">
                    {isAdmin ? (
                        <>
                            <button onClick={() => setActiveTab('fixtures')} className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-widest ${activeTab === 'fixtures' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'}`}>Fixtures</button>
                            <button onClick={() => setActiveTab('staff')} className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-widest ${activeTab === 'staff' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                                Staff {pendingRequests.length > 0 && <span className="ml-1 bg-red-500 text-white px-1.5 rounded-full">{pendingRequests.length}</span>}
                            </button>
                        </>
                    ) : (
                        <div className="bg-blue-900/20 text-blue-500 px-4 py-2 rounded text-xs font-bold uppercase tracking-widest border border-blue-900/50">Scorer View</div>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 md:p-12">

                {/* --- VIEW: SCORER --- */}
                {!isAdmin && (
                    <div>
                        <h2 className="text-xl font-bold uppercase tracking-wide mb-6 text-blue-500 flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span> Assigned Court</h2>
                        <div className="grid gap-4">
                            {fixtures.filter(f => f.status !== 'completed').length === 0 && <div className="text-zinc-500 italic">No scheduled matches available.</div>}

                            {fixtures.filter(f => f.status !== 'completed').map(f => (
                                <div key={f.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex items-center justify-between group hover:border-blue-500 transition-all">
                                    <div className="flex items-center gap-6">
                                        <div className="text-center">
                                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{f.court}</div>
                                            <div className="text-xl font-mono font-bold text-white">{f.time}</div>
                                        </div>
                                        <div className="h-10 w-px bg-zinc-800"></div>
                                        <div>
                                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{f.sport}</div>
                                            <div className="text-2xl font-black italic text-white uppercase">{f.teamA} <span className="text-zinc-600 not-italic font-normal text-sm mx-2">vs</span> {f.teamB}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleStartMatch(f)}
                                        className={`px-8 py-4 rounded-lg font-black uppercase tracking-widest text-xs transition-all shadow-lg ${f.status === 'live' ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'}`}
                                    >
                                        {f.status === 'live' ? 'Resume Match' : 'Start Match'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- VIEW: ADMIN (Fixtures) --- */}
                {isAdmin && activeTab === 'fixtures' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold uppercase tracking-wide">Match Schedule</h2>
                            <button onClick={() => setShowFixtureModal(true)} className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded uppercase text-xs">+ Add Match</button>
                        </div>
                        {fixtures.length === 0 ? (
                            <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center text-zinc-500 text-sm">No matches scheduled.</div>
                        ) : (
                            <div className="grid gap-3">
                                {fixtures.map(f => (
                                    <div key={f.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${f.status === 'live' ? 'bg-green-900/20 text-green-500' : 'bg-black text-zinc-500'}`}>
                                                {f.status}
                                            </span>
                                            <span className="font-bold text-white">{f.teamA} <span className="text-zinc-600 mx-1">VS</span> {f.teamB}</span>
                                        </div>
                                        <div className="text-right text-xs font-mono text-zinc-400">
                                            <div className="text-white">{f.court}</div>
                                            <div>{f.time}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* --- VIEW: ADMIN (Staff) --- */}
                {isAdmin && activeTab === 'staff' && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-xl font-bold uppercase tracking-wide mb-4 text-red-500">Pending Requests ({pendingRequests.length})</h2>
                            {pendingRequests.length === 0 && <p className="text-zinc-600 text-xs">No pending requests.</p>}
                            <div className="grid gap-3">
                                {pendingRequests.map(([uid, req]) => (
                                    <div key={uid} className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-white">{req.displayName}</div>
                                            <div className="text-xs text-zinc-500">{req.email}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => id && handleRequest(id, uid, 'reject')} className="px-3 py-1 rounded border border-red-900 text-red-500 text-xs font-bold uppercase hover:bg-red-900/20">Reject</button>
                                            <button onClick={() => id && handleRequest(id, uid, 'approve')} className="px-3 py-1 rounded bg-green-600 text-white text-xs font-bold uppercase hover:bg-green-500">Approve</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h2 className="text-xl font-bold uppercase tracking-wide mb-4 text-green-500">Active Staff ({tournament.approvedScorers.length})</h2>
                            <div className="text-zinc-600 text-xs font-mono bg-zinc-900 p-4 rounded border border-zinc-800">
                                {tournament.approvedScorers.map(uid => <span key={uid} className="inline-block bg-black px-2 py-1 rounded mr-2 mb-2 border border-zinc-700">{uid}</span>)}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* CREATE MATCH MODAL */}
            {showFixtureModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-700 w-full max-w-md rounded-xl p-6">
                        <h3 className="text-white font-bold uppercase mb-4">Schedule Match</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input placeholder="Team A" className="bg-black border border-zinc-700 p-3 rounded text-white outline-none focus:border-yellow-600" onChange={e => setNewFixture({ ...newFixture, teamA: e.target.value })} />
                                <input placeholder="Team B" className="bg-black border border-zinc-700 p-3 rounded text-white outline-none focus:border-yellow-600" onChange={e => setNewFixture({ ...newFixture, teamB: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <input placeholder="Court Name" className="bg-black border border-zinc-700 p-3 rounded text-white outline-none focus:border-yellow-600" onChange={e => setNewFixture({ ...newFixture, court: e.target.value })} />
                                <input placeholder="Time (e.g. 10:00 AM)" className="bg-black border border-zinc-700 p-3 rounded text-white outline-none focus:border-yellow-600" onChange={e => setNewFixture({ ...newFixture, time: e.target.value })} />
                            </div>
                            <select className="w-full bg-black border border-zinc-700 p-3 rounded text-white uppercase outline-none" onChange={e => setNewFixture({ ...newFixture, sport: e.target.value as SportType })}>
                                <option value="basketball">Basketball</option>
                                <option value="badminton">Badminton</option>
                                <option value="volleyball">Volleyball</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowFixtureModal(false)} className="text-zinc-500 text-xs font-bold uppercase hover:text-white">Cancel</button>
                            <button onClick={handleAddFixture} className="bg-yellow-600 hover:bg-yellow-500 text-black px-6 py-2 rounded font-bold uppercase text-xs">Create</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};