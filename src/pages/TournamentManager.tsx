import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    subscribeToTournament,
    subscribeToFixtures,
    activateDivision,
    updateFixtureData,
    checkSchedulingConflict,
    addTournamentSport,
    removeDivision,
    publishDivision,
    unpublishDivision
} from '../services/tournamentService';
import { auth } from '../services/authService';
import { BracketEditor } from '../components/BracketEditor';
import type { Tournament, TournamentFixture, GenderCategory, SportType } from '../types';

export const TournamentManager: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // --- DATA STATE ---
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [activeGender, setActiveGender] = useState<GenderCategory>('men');
    const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
    const [divisionFixtures, setDivisionFixtures] = useState<TournamentFixture[]>([]);

    // --- UI STATE ---
    const [setupDivId, setSetupDivId] = useState<string | null>(null);
    const [customTeamCount, setCustomTeamCount] = useState<number>(8);
    const [showAddSportModal, setShowAddSportModal] = useState(false);

    // NEW: "God Mode" for editing while live
    const [isEditMode, setIsEditMode] = useState(false);

    useEffect(() => {
        if (!id) return;
        return subscribeToTournament(id, setTournament);
    }, [id]);

    useEffect(() => {
        if (!id || !selectedDivisionId) return;
        // Reset edit mode when switching views
        setIsEditMode(false);
        return subscribeToFixtures(id, selectedDivisionId, setDivisionFixtures);
    }, [id, selectedDivisionId]);

    // --- HANDLERS ---
    const handleActivate = async () => {
        if (!id || !setupDivId) return;
        await activateDivision(id, setupDivId, { format: 'knockout', bracketSize: customTeamCount });
        setSetupDivId(null);
        setSelectedDivisionId(setupDivId);
    };

    const handlePublish = async () => {
        if (!id || !selectedDivisionId) return;
        if (window.confirm("CONFIRM PUBLISH\n\n- Matches will go LIVE.\n- Scorers can now access games.\n- Re-generation will be locked.")) {
            await publishDivision(id, selectedDivisionId);
        }
    };

    const handleUnpublish = async () => {
        if (!id || !selectedDivisionId) return;
        if (window.confirm("DANGER: RESET TO DRAFT?\n\nThis will HIDE the bracket from scorers. Do this only if you need to perform major maintenance.")) {
            await unpublishDivision(id, selectedDivisionId);
        }
    };

    const handleAddSport = async (sport: SportType) => {
        if (!id) return;
        await addTournamentSport(id, sport);
        setShowAddSportModal(false);
    };

    const handleRemoveDivision = async (e: React.MouseEvent, divId: string) => {
        e.stopPropagation();
        if (!id) return;
        if (window.confirm("Delete this division?")) {
            await removeDivision(id, divId);
        }
    };

    if (!tournament) return <div className="min-h-screen bg-black flex items-center justify-center font-mono text-zinc-500 animate-pulse">SYSTEM LOADING...</div>;

    // --- DERIVED STATE ---
    const isAdmin = auth.currentUser?.uid === tournament.adminId;
    const divisionsList = tournament.divisions ? Object.values(tournament.divisions) : [];
    const filteredDivisions = divisionsList.filter(d => d.gender === activeGender);
    const currentDivision = (selectedDivisionId && tournament.divisions) ? tournament.divisions[selectedDivisionId] : null;

    const availableSports: SportType[] = ['basketball', 'badminton', 'volleyball', 'kabaddi', 'football', 'cricket'];
    const existingSports = new Set(divisionsList.map(d => d.sport));
    const addableSports = availableSports.filter(s => !existingSports.has(s));

    const theme = {
        men: { line: 'bg-cyan-500 shadow-[0_0_20px_#06b6d4]', bgGradient: 'from-cyan-900/10 via-black to-black' },
        women: { line: 'bg-rose-500 shadow-[0_0_20px_#f43f5e]', bgGradient: 'from-rose-900/10 via-black to-black' }
    };
    const activeTheme = theme[activeGender as keyof typeof theme] || theme.men;

    const bracketSize = Math.pow(2, Math.ceil(Math.log2(customTeamCount)));
    const byes = bracketSize - customTeamCount;

    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col relative overflow-hidden transition-colors duration-700">
            <div className={`absolute inset-0 bg-gradient-to-br ${activeTheme.bgGradient} pointer-events-none transition-all duration-1000 z-0`}></div>

            <header className="relative z-10 bg-black/40 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigate('/tournament')} className="text-zinc-500 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                            </button>
                            <h1 className="text-xl font-black italic uppercase tracking-wider text-white">{tournament.name}</h1>
                        </div>

                        {!selectedDivisionId && (
                            <div className="flex items-center gap-2 pl-4 border-l border-zinc-800">
                                {(['men', 'women'] as const).map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setActiveGender(g)}
                                        className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeGender === g
                                                ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                                                : 'bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700'
                                            }`}
                                    >
                                        {g}'s
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        {selectedDivisionId ? (
                            <button
                                onClick={() => setSelectedDivisionId(null)}
                                className="border border-zinc-700 hover:border-white text-zinc-400 hover:text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-all"
                            >
                                Close View
                            </button>
                        ) : isAdmin ? (
                            <button
                                onClick={() => setShowAddSportModal(true)}
                                className="bg-white text-black px-5 py-2 rounded font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-transform hover:-translate-y-0.5"
                            >
                                + Add Event
                            </button>
                        ) : null}
                    </div>
                </div>
                <div className={`w-full h-[1px] ${activeTheme.line} transition-all duration-700 ease-in-out`}></div>
            </header>

            <main className="flex-1 relative z-10 overflow-hidden flex flex-col">

                {/* DASHBOARD */}
                {!selectedDivisionId && (
                    <div className="flex-1 overflow-y-auto p-8">
                        <div className="max-w-7xl mx-auto">
                            {filteredDivisions.length === 0 ? (
                                <div className="h-[60vh] flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl">
                                    <p className="text-zinc-600 font-mono text-sm mb-4">NO EVENTS CONFIGURED FOR {activeGender.toUpperCase()}</p>
                                    {isAdmin && <button onClick={() => setShowAddSportModal(true)} className="text-yellow-600 hover:text-yellow-500 text-xs font-bold uppercase underline">Add Your First Sport</button>}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {filteredDivisions.map(div => {
                                        // Dynamic Style based on Status
                                        let statusColor = 'bg-zinc-700';
                                        let statusText = 'Unknown';
                                        let borderColor = 'border-zinc-800';
                                        let buttonText = 'Initialize';

                                        if (div.status === 'setup_required') {
                                            statusText = 'Setup Required';
                                            buttonText = 'Initialize';
                                        } else if (div.status === 'draft') {
                                            statusColor = 'bg-yellow-500 shadow-[0_0_10px_#eab308]';
                                            statusText = 'Draft Mode';
                                            borderColor = 'border-yellow-900';
                                            buttonText = 'Configure';
                                        } else if (div.status === 'published') {
                                            statusColor = 'bg-green-500 shadow-[0_0_10px_#22c55e]';
                                            statusText = 'Live / Published';
                                            borderColor = 'border-green-900';
                                            buttonText = 'Manage Console';
                                        }

                                        return (
                                            <div
                                                key={div.id}
                                                onClick={() => div.isActive ? setSelectedDivisionId(div.id) : setSetupDivId(div.id)}
                                                className={`group relative p-6 rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${div.isActive ? `bg-zinc-900/50 ${borderColor} hover:border-white` : 'bg-black border-zinc-800 opacity-70 hover:opacity-100 hover:border-zinc-600'}`}
                                            >
                                                <div className="flex justify-between items-start mb-6">
                                                    <h3 className={`text-2xl font-black italic uppercase tracking-tight ${div.isActive ? 'text-white' : 'text-zinc-600'}`}>
                                                        {div.sport}
                                                    </h3>
                                                    {isAdmin && (
                                                        <button onClick={(e) => handleRemoveDivision(e, div.id)} className="text-zinc-600 hover:text-red-500 p-1">&times;</button>
                                                    )}
                                                </div>

                                                <div className="space-y-1 mb-8">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                                                            {statusText}
                                                        </span>
                                                    </div>
                                                    {div.isActive && (
                                                        <div className="text-xs font-mono text-zinc-400">
                                                            {div.bracketSize} Teams
                                                        </div>
                                                    )}
                                                </div>

                                                <div className={`w-full py-3 text-center rounded font-black uppercase text-[10px] tracking-[0.2em] transition-colors ${div.isActive ? 'bg-white text-black group-hover:bg-yellow-500' : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'}`}>
                                                    {buttonText}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* BRACKET EDITOR WITH LIFECYCLE CONTROLS */}
                {selectedDivisionId && currentDivision && (
                    <div className="flex-1 flex flex-col h-full bg-black/50 backdrop-blur-sm">
                        {/* LIFECYCLE HEADER */}
                        <div className="h-14 border-b border-zinc-800 bg-zinc-950 px-6 flex justify-between items-center">

                            {/* Left: Context */}
                            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em]">
                                <span className="text-yellow-500 font-bold">{currentDivision.gender}</span>
                                <span className="text-zinc-600">//</span>
                                <span className="text-white font-bold">{currentDivision.sport}</span>
                                {currentDivision.status === 'draft' && <span className="bg-yellow-900/40 text-yellow-500 px-2 py-0.5 rounded border border-yellow-900">DRAFT</span>}
                                {currentDivision.status === 'published' && <span className="bg-green-900/40 text-green-500 px-2 py-0.5 rounded border border-green-900 animate-pulse">LIVE</span>}
                            </div>

                            {/* Right: Controls */}
                            {isAdmin && (
                                <div className="flex items-center gap-4">
                                    {/* DRAFT MODE ACTIONS */}
                                    {currentDivision.status === 'draft' && (
                                        <>
                                            <button onClick={handleActivate} className="text-zinc-500 hover:text-white text-xs font-bold uppercase">Regenerate</button>
                                            <button
                                                onClick={handlePublish}
                                                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-green-900/20"
                                            >
                                                Publish Bracket
                                            </button>
                                        </>
                                    )}

                                    {/* LIVE MODE ACTIONS */}
                                    {currentDivision.status === 'published' && (
                                        <div className="flex items-center gap-4">
                                            {/* GOD MODE TOGGLE */}
                                            <div className="flex items-center gap-2 border-r border-zinc-800 pr-4">
                                                <span className={`text-[9px] font-bold uppercase tracking-widest ${isEditMode ? 'text-red-500' : 'text-zinc-600'}`}>
                                                    {isEditMode ? 'EDIT MODE ACTIVE' : 'EDIT MODE LOCKED'}
                                                </span>
                                                <div
                                                    onClick={() => setIsEditMode(!isEditMode)}
                                                    className={`w-8 h-4 rounded-full cursor-pointer relative transition-colors ${isEditMode ? 'bg-red-500' : 'bg-zinc-800'}`}
                                                >
                                                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isEditMode ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleUnpublish}
                                                className="text-zinc-700 hover:text-red-900 text-[10px] font-bold uppercase"
                                                title="Reset to Draft (Danger)"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 relative overflow-hidden">
                            <BracketEditor
                                tournamentId={id!}
                                fixtures={divisionFixtures}
                                isAdmin={isAdmin}
                                divisionStatus={currentDivision.status}
                                isEditMode={isEditMode}
                            />
                        </div>
                    </div>
                )}
            </main>

            {/* MODALS (Keep existing) */}
            {setupDivId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-zinc-700 p-10 rounded-2xl w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-black uppercase text-white mb-1 tracking-wide">
                            Setup <span className="text-yellow-500">{setupDivId.split('_')[0]}</span>
                        </h2>
                        <div className="mb-8 mt-8">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-4 text-center">Participating Teams</label>
                            <div className="flex items-center justify-center gap-6 mb-6">
                                <button onClick={() => setCustomTeamCount(Math.max(2, customTeamCount - 1))} className="w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xl flex items-center justify-center transition-colors">-</button>
                                <div className="text-5xl font-black text-white w-24 text-center">{customTeamCount}</div>
                                <button onClick={() => setCustomTeamCount(customTeamCount + 1)} className="w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xl flex items-center justify-center transition-colors">+</button>
                            </div>
                            <p className="text-[10px] text-zinc-600 mt-2 text-center italic">* {byes} teams will automatically advance to Round 2.</p>
                        </div>
                        <div className="flex gap-4 pt-4 border-t border-zinc-800">
                            <button onClick={() => setSetupDivId(null)} className="flex-1 py-4 rounded-lg bg-zinc-950 text-zinc-400 font-bold uppercase text-xs hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleActivate} className="flex-1 py-4 rounded-lg bg-white text-black font-black uppercase text-xs hover:bg-yellow-500 transition-colors">Generate System</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD SPORT MODAL */}
            {showAddSportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-zinc-700 p-8 rounded-2xl w-full max-w-lg shadow-2xl">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-lg font-black uppercase text-white">Add Sport Discipline</h2>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Select event to initialize</p>
                            </div>
                            <button onClick={() => setShowAddSportModal(false)} className="text-zinc-500 hover:text-white">&times;</button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-8">
                            {addableSports.length === 0 && <div className="col-span-2 py-8 text-center text-zinc-600 italic">All supported sports are already active.</div>}
                            {addableSports.map(s => (
                                <button
                                    key={s}
                                    onClick={() => handleAddSport(s)}
                                    className="p-4 rounded bg-black border border-zinc-800 hover:border-yellow-600 hover:text-yellow-500 text-left transition-all group"
                                >
                                    <span className="block text-sm font-bold uppercase group-hover:translate-x-1 transition-transform">{s}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};