import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    subscribeToMyTournaments,
    subscribeToJoinedTournaments,
    getTournamentPublicInfo,
    joinTournament
} from '../services/tournamentService';
import { auth } from '../services/authService';
import type { Tournament, SportType } from '../types';

export const TournamentDashboard: React.FC = () => {
    const navigate = useNavigate();

    // Data State
    const [myTournaments, setMyTournaments] = useState<Tournament[]>([]);
    const [joinedTournaments, setJoinedTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // UI State
    const [joinCode, setJoinCode] = useState("");
    const [activeTab, setActiveTab] = useState<'hosting' | 'volunteering'>('hosting');

    // Modal State
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [foundTournament, setFoundTournament] = useState<Tournament | null>(null);
    const [requestName, setRequestName] = useState("");
    const [accessType, setAccessType] = useState<'all' | 'specific'>('all');
    const [selectedSports, setSelectedSports] = useState<SportType[]>([]);

    useEffect(() => {
        if (!auth.currentUser) return;
        const unsubMy = subscribeToMyTournaments(auth.currentUser.uid, (data) => {
            setMyTournaments(data);
            setIsLoading(false);
        });
        const unsubJoined = subscribeToJoinedTournaments(auth.currentUser.uid, setJoinedTournaments);
        return () => { unsubMy(); unsubJoined(); };
    }, []);

    // Step 1: Verify Code & Open Modal
    const handleVerifyCode = async () => {
        if (!joinCode || joinCode.length < 6) return;

        try {
            const tournament = await getTournamentPublicInfo(joinCode);
            if (tournament) {
                setFoundTournament(tournament);
                setRequestName(auth.currentUser?.displayName || "Volunteer"); // Default name
                setAccessType('all');
                setSelectedSports([]);
                setShowRequestModal(true);
            } else {
                alert("❌ Tournament ID not found.");
            }
        } catch (err) {
            console.error(err);
            alert("Network Error");
        }
    };

    // Step 2: Submit Request
    const handleSubmitRequest = async () => {
        if (!foundTournament) return;

        try {
            await joinTournament(foundTournament.id, {
                displayName: requestName,
                requestType: accessType,
                requestedSports: selectedSports
            });

            alert(`✅ Request Sent to ${foundTournament.organizer || 'Admin'}!`);
            setShowRequestModal(false);
            setJoinCode("");
            setFoundTournament(null);
        } catch (err) {
            alert("Failed to send request.");
        }
    };

    const toggleSport = (sport: SportType) => {
        if (selectedSports.includes(sport)) {
            setSelectedSports(selectedSports.filter(s => s !== sport));
        } else {
            setSelectedSports([...selectedSports, sport]);
        }
    };

    // Extract available sports from the found tournament for the modal
    const availableSports = foundTournament
        ? Array.from(new Set(Object.values(foundTournament.divisions).map(d => d.sport))) as SportType[]
        : [];

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-yellow-500/30 p-4 md:p-8">

            {/* AMBIENCE */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yellow-900/10 rounded-full blur-[120px]"></div>
            </div>

            {/* HEADER */}
            <header className="sticky top-0 z-50 flex justify-between items-center mb-12 max-w-7xl mx-auto bg-black/80 backdrop-blur-md py-4 px-6 rounded-2xl border border-zinc-800/50 shadow-2xl">
                <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden group cursor-default">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <span className="text-yellow-500 font-black italic text-2xl tracking-tighter group-hover:scale-110 transition-transform z-10">B</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-black italic uppercase tracking-tighter text-white leading-none">
                            TOURNAMENT <span className="text-yellow-500">DASHBOARD</span>
                        </h1>
                        <div className="flex items-center gap-2 mt-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></div>
                            <p className="text-[9px] text-zinc-500 font-mono tracking-[0.2em] uppercase">System Operational</p>
                        </div>
                    </div>
                </div>
                <button onClick={() => navigate('/')} className="group flex items-center gap-2 px-5 py-2.5 rounded-full border border-zinc-800 hover:border-zinc-600 transition-all bg-zinc-900/50 hover:bg-zinc-900">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-white">Exit Console</span>
                </button>
            </header>

            <main className="max-w-7xl mx-auto relative z-10">
                {/* TABS */}
                <div className="flex gap-8 mb-12 border-b border-zinc-800">
                    <button
                        onClick={() => setActiveTab('hosting')}
                        className={`pb-4 text-sm font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'hosting' ? 'text-yellow-500' : 'text-zinc-600 hover:text-white'}`}
                    >
                        My Events
                        {activeTab === 'hosting' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-yellow-500 shadow-[0_0_10px_#eab308]"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('volunteering')}
                        className={`pb-4 text-sm font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'volunteering' ? 'text-blue-500' : 'text-zinc-600 hover:text-white'}`}
                    >
                        Volunteering
                        {activeTab === 'volunteering' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>}
                    </button>
                </div>

                {/* HOSTING VIEW */}
                {activeTab === 'hosting' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {isLoading ? (
                            <div className="h-64 flex items-center justify-center text-zinc-600 font-mono text-xs animate-pulse">LOADING ASSETS...</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div onClick={() => navigate('/tournament/setup')} className="group relative h-[340px] rounded-2xl border-2 border-dashed border-zinc-800 hover:border-yellow-500/50 bg-black/20 hover:bg-yellow-500/5 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-4 overflow-hidden">
                                    <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 group-hover:border-yellow-500 group-hover:scale-110 transition-all flex items-center justify-center text-3xl text-zinc-500 group-hover:text-yellow-500 shadow-xl">+</div>
                                    <div className="text-center">
                                        <h3 className="text-lg font-black uppercase text-zinc-400 group-hover:text-white tracking-widest transition-colors">Initialize Event</h3>
                                        <p className="text-[10px] text-zinc-600 font-mono mt-2 uppercase">Create new tournament</p>
                                    </div>
                                </div>
                                {myTournaments.map(t => (
                                    <HostCard key={t.id} tournament={t} onClick={() => navigate(`/tournament/${t.id}/manage`)} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* VOLUNTEERING VIEW */}
                {activeTab === 'volunteering' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* JOIN TERMINAL */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 mb-12 flex flex-col md:flex-row items-center gap-6 shadow-2xl backdrop-blur-sm">
                            <div className="flex-1">
                                <h3 className="text-xl font-black uppercase text-white tracking-tight">Join Existing Event</h3>
                                <p className="text-xs text-zinc-500 font-mono mt-2">Enter the unique 6-character Tournament ID provided by the organizer.</p>
                            </div>
                            <div className="flex w-full md:w-auto gap-2">
                                <input
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    placeholder="XXXXXX"
                                    maxLength={6}
                                    className="bg-black border border-zinc-700 p-4 rounded-lg text-white font-mono text-center text-xl uppercase tracking-[0.5em] outline-none focus:border-blue-500 focus:shadow-[0_0_20px_#3b82f640] w-full md:w-48 transition-all placeholder:text-zinc-800"
                                />
                                <button
                                    onClick={handleVerifyCode}
                                    disabled={joinCode.length < 6}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 rounded-lg font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-900/20 transition-all hover:scale-105"
                                >
                                    Request
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {joinedTournaments.map(t => (
                                <VolunteerCard key={t.id} tournament={t} onClick={() => navigate(`/tournament/${t.id}/manage`)} />
                            ))}
                            {joinedTournaments.length === 0 && (
                                <div className="col-span-full py-12 text-center border border-zinc-800 rounded-2xl bg-zinc-900/20">
                                    <p className="text-zinc-600 font-mono text-xs uppercase tracking-widest">No Active Assignments</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* --- REQUEST ACCESS MODAL --- */}
            {showRequestModal && foundTournament && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden">
                        {/* Decorative Header */}
                        <div className="h-2 bg-gradient-to-r from-blue-600 to-blue-400"></div>

                        <div className="p-8">
                            <h2 className="text-xl font-black uppercase text-white mb-1">Credential Request</h2>
                            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-6">
                                Requesting access to <span className="text-white font-bold">{foundTournament.name}</span>
                            </p>

                            <div className="space-y-6">
                                {/* Name Input */}
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Volunteer Name</label>
                                    <input
                                        value={requestName}
                                        onChange={(e) => setRequestName(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-lg text-white text-sm focus:border-blue-500 outline-none transition-all"
                                        placeholder="Enter your name"
                                    />
                                </div>

                                {/* Access Type */}
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Access Level</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setAccessType('all')}
                                            className={`p-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${accessType === 'all' ? 'bg-blue-900/20 border-blue-600 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                                        >
                                            Full Access
                                        </button>
                                        <button
                                            onClick={() => setAccessType('specific')}
                                            className={`p-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${accessType === 'specific' ? 'bg-blue-900/20 border-blue-600 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                                        >
                                            Specific Sports
                                        </button>
                                    </div>
                                </div>

                                {/* Sport Selection (Only if Specific) */}
                                {accessType === 'specific' && (
                                    <div className="animate-in slide-in-from-top-2 duration-200">
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Select Sports</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {availableSports.map(sport => (
                                                <button
                                                    key={sport}
                                                    onClick={() => toggleSport(sport)}
                                                    className={`p-2 rounded border text-[10px] font-bold uppercase transition-all flex justify-between items-center ${selectedSports.includes(sport) ? 'bg-zinc-800 border-white text-white' : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                                                >
                                                    {sport}
                                                    {selectedSports.includes(sport) && <span className="text-blue-500">✓</span>}
                                                </button>
                                            ))}
                                            {availableSports.length === 0 && <div className="text-zinc-600 text-xs italic p-2">No sports configured yet.</div>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4 mt-8 pt-6 border-t border-zinc-900">
                                <button onClick={() => setShowRequestModal(false)} className="flex-1 py-3 rounded-lg border border-zinc-800 text-zinc-400 font-bold uppercase text-xs hover:text-white hover:bg-zinc-900 transition-colors">Cancel</button>
                                <button onClick={handleSubmitRequest} className="flex-1 py-3 rounded-lg bg-white text-black font-black uppercase text-xs hover:bg-blue-500 hover:text-white transition-colors">Submit Request</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SUB-COMPONENTS (Keep same as before) ---
const HostCard: React.FC<{ tournament: Tournament; onClick: () => void }> = ({ tournament, onClick }) => {
    const divisions = tournament.divisions ? Object.values(tournament.divisions) : [];
    const activeSports = Array.from(new Set(divisions.map(d => d.sport)));
    const totalTeams = divisions.reduce((acc, curr) => acc + (curr.bracketSize || 0), 0);
    const isLive = tournament.status === 'active';

    return (
        <div onClick={onClick} className="group relative h-[340px] bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-2xl hover:-translate-y-1 flex flex-col">
            <div className="h-36 bg-black relative overflow-hidden border-b border-zinc-800">
                {tournament.logoUrl ? (
                    <img src={tournament.logoUrl} alt="Logo" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-950">
                        <span className="text-4xl font-black italic text-zinc-800 group-hover:text-zinc-700 transition-colors uppercase">{tournament.name.substring(0, 2)}</span>
                    </div>
                )}
                <div className="absolute top-3 right-3 bg-black/80 backdrop-blur border border-zinc-700 rounded px-2 py-1">
                    <p className="text-[10px] font-mono text-zinc-400">ID: <span className="text-white font-bold tracking-widest">{tournament.id}</span></p>
                </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                    <h3 className="text-xl font-black italic uppercase text-white mb-1 truncate leading-tight group-hover:text-yellow-500 transition-colors">{tournament.name}</h3>
                    <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-4 space-y-1">
                        <div className="flex items-center gap-2"><span className="text-zinc-600">📍</span><span>{tournament.location || 'Unknown Location'}</span></div>
                        <div className="flex items-center gap-2"><span className="text-zinc-600">📅</span><span>{tournament.startDate || 'Date TBD'}</span></div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {activeSports.length > 0 ? activeSports.slice(0, 3).map(s => <span key={s} className="px-2 py-1 bg-zinc-800 rounded text-[9px] font-bold uppercase text-zinc-300 border border-zinc-700">{s}</span>) : <span className="px-2 py-1 bg-zinc-800/50 rounded text-[9px] font-bold uppercase text-zinc-600 italic">No Sports Configured</span>}
                        {activeSports.length > 3 && <span className="px-2 py-1 text-[9px] text-zinc-500">+{activeSports.length - 3}</span>}
                    </div>
                </div>
                <div className="pt-4 border-t border-zinc-800 flex justify-between items-end">
                    <div className="flex gap-4">
                        <div><p className="text-[9px] text-zinc-500 uppercase tracking-wider">Divisions</p><p className="text-sm font-bold text-white">{divisions.length}</p></div>
                        <div><p className="text-[9px] text-zinc-500 uppercase tracking-wider">Teams</p><p className="text-sm font-bold text-white">{totalTeams}</p></div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border flex items-center gap-2 ${isLive ? 'bg-green-900/20 border-green-900 text-green-500' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                        {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>}{isLive ? 'Active' : 'Draft'}
                    </div>
                </div>
            </div>
        </div>
    );
};

const VolunteerCard: React.FC<{ tournament: Tournament; onClick: () => void }> = ({ tournament, onClick }) => {
    return (
        <div onClick={onClick} className="group relative bg-zinc-900/50 border border-zinc-800 hover:border-blue-500/50 rounded-xl p-6 cursor-pointer transition-all hover:bg-zinc-900">
            <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-black rounded-lg border border-zinc-800 flex items-center justify-center overflow-hidden">
                    {tournament.logoUrl ? <img src={tournament.logoUrl} className="w-full h-full object-cover" /> : <span className="text-lg font-black text-zinc-700 italic">{tournament.name.substring(0, 1)}</span>}
                </div>
                <span className="px-2 py-1 bg-blue-900/20 text-blue-400 border border-blue-900/50 rounded text-[9px] font-bold uppercase tracking-wider">Scorer Access</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors truncate">{tournament.name}</h3>
            <div className="space-y-1 mb-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-2"><span className="text-zinc-700">BY</span> {tournament.organizer || 'Unknown Host'}</p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-2"><span className="text-zinc-700">AT</span> {tournament.location || 'Remote'}</p>
            </div>
            <div className="w-full bg-zinc-800 h-[1px] mb-4"></div>
            <div className="flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 font-mono">ID: {tournament.id}</span>
                <span className="text-xs font-bold text-white group-hover:translate-x-1 transition-transform">Enter Console &rarr;</span>
            </div>
        </div>
    );
};