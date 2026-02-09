import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToMyTournaments, subscribeToJoinedTournaments, joinTournament } from '../services/tournamentService';
import { auth } from '../services/authService';
import type { Tournament, DivisionConfig } from '../types';

export const TournamentDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [myTournaments, setMyTournaments] = useState<Tournament[]>([]);
    const [joinedTournaments, setJoinedTournaments] = useState<Tournament[]>([]);
    const [joinCode, setJoinCode] = useState("");
    const [activeTab, setActiveTab] = useState<'hosting' | 'volunteering'>('hosting');

    useEffect(() => {
        if (!auth.currentUser) return;
        const unsubMy = subscribeToMyTournaments(auth.currentUser.uid, setMyTournaments);
        const unsubJoined = subscribeToJoinedTournaments(auth.currentUser.uid, setJoinedTournaments);
        return () => { unsubMy(); unsubJoined(); };
    }, []);

    const handleJoin = async () => {
        if (!joinCode) return;
        try {
            await joinTournament(joinCode);
            alert("Request sent! Wait for approval.");
            setJoinCode("");
        } catch (err) {
            alert("Invalid ID or Network Error");
        }
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans p-4 md:p-8">
            <header className="flex justify-between items-center mb-12 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter">BOX V2 <span className="text-yellow-500">Tournament</span></h1>
                    <p className="text-xs text-zinc-500 font-mono tracking-widest mt-1">EVENT MANAGEMENT SYSTEM</p>
                </div>
                <button
                    onClick={() => navigate('/')}
                    className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white"
                >
                    Exit to Main
                </button>
            </header>

            <main className="max-w-7xl mx-auto">

                {/* TABS */}
                <div className="flex gap-8 mb-8 border-b border-zinc-800">
                    <button
                        onClick={() => setActiveTab('hosting')}
                        className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'hosting' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-zinc-500 hover:text-white'}`}
                    >
                        My Events
                    </button>
                    <button
                        onClick={() => setActiveTab('volunteering')}
                        className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'volunteering' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-zinc-500 hover:text-white'}`}
                    >
                        Volunteering
                    </button>
                </div>

                {/* HOSTING VIEW */}
                {activeTab === 'hosting' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                            {/* CREATE CARD */}
                            <div
                                onClick={() => navigate('/tournament/setup')}
                                className="group bg-zinc-900/50 border border-zinc-800 hover:border-yellow-600 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[250px]"
                            >
                                <div className="w-16 h-16 rounded-full bg-zinc-800 group-hover:bg-yellow-500 text-zinc-500 group-hover:text-black flex items-center justify-center text-3xl mb-4 transition-colors">
                                    +
                                </div>
                                <h3 className="font-black uppercase text-zinc-400 group-hover:text-white tracking-widest">Create Event</h3>
                            </div>

                            {/* TOURNAMENT CARDS */}
                            {myTournaments.map(t => (
                                <TournamentCard key={t.id} tournament={t} onClick={() => navigate(`/tournament/${t.id}/manage`)} />
                            ))}
                        </div>
                    </div>
                )}

                {/* VOLUNTEERING VIEW */}
                {activeTab === 'volunteering' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <div className="mb-8 flex gap-4">
                            <input
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                placeholder="ENTER TOURNAMENT ID"
                                className="bg-black border border-zinc-800 p-4 rounded-lg text-white font-mono uppercase tracking-widest outline-none focus:border-blue-500 w-full max-w-md"
                            />
                            <button
                                onClick={handleJoin}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-8 rounded-lg font-black uppercase text-xs tracking-widest"
                            >
                                Join
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {joinedTournaments.map(t => (
                                <TournamentCard key={t.id} tournament={t} onClick={() => navigate(`/tournament/${t.id}/manage`)} />
                            ))}
                            {joinedTournaments.length === 0 && (
                                <div className="col-span-full text-zinc-500 italic">You haven't joined any tournaments yet.</div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

// --- SUB-COMPONENT: CARD ---
// This was causing the crash. We updated it to use 'divisions' instead of 'config'
const TournamentCard: React.FC<{ tournament: Tournament; onClick: () => void }> = ({ tournament, onClick }) => {

    // Safely extract sports from the new Divisions map
    const divisions = tournament.divisions ? Object.values(tournament.divisions) : [];
    const activeSports = Array.from(new Set(divisions.filter(d => d.isActive).map(d => d.sport)));
    const totalTeams = divisions.reduce((acc, curr) => acc + (curr.bracketSize || 0), 0);

    return (
        <div
            onClick={onClick}
            className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl overflow-hidden cursor-pointer transition-all hover:translate-y-[-2px] hover:shadow-2xl"
        >
            <div className="h-32 bg-zinc-800 relative overflow-hidden">
                {tournament.logoUrl ? (
                    <img src={tournament.logoUrl} alt="Logo" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-700 font-black italic text-4xl uppercase">
                        {tournament.name.substring(0, 2)}
                    </div>
                )}
                <div className="absolute top-2 right-2 bg-black/80 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded border border-zinc-700">
                    ID: {tournament.id}
                </div>
            </div>

            <div className="p-6">
                <h3 className="text-xl font-black italic uppercase text-white mb-2 truncate">{tournament.name}</h3>
                <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-4">
                    {tournament.organizer || 'Unknown Host'}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    {activeSports.length > 0 ? (
                        activeSports.slice(0, 3).map(sport => (
                            <span key={sport} className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-1 rounded uppercase font-bold">
                                {sport}
                            </span>
                        ))
                    ) : (
                        <span className="text-[10px] bg-red-900/20 text-red-500 px-2 py-1 rounded uppercase font-bold">Setup Required</span>
                    )}
                    {activeSports.length > 3 && <span className="text-[10px] text-zinc-500 px-1 py-1">+{activeSports.length - 3}</span>}
                </div>

                <div className="border-t border-zinc-800 pt-4 flex justify-between items-center">
                    <div className="text-xs text-zinc-500">
                        <span className="text-white font-bold">{divisions.length}</span> Divisions
                    </div>
                    <div className="text-xs text-zinc-500">
                        <span className="text-white font-bold">{totalTeams}</span> Teams
                    </div>
                </div>
            </div>
        </div>
    );
};