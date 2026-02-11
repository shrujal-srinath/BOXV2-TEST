// src/pages/TournamentManager.tsx
// COMPLETE FILE - Ready to replace your existing TournamentManager.tsx
// This file contains BOTH existing bracket functionality AND new fixtures/court picker features

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    subscribeToTournament,
    subscribeToFixtures,
    activateDivision,
    updateFixtureData,
    addTournamentSport,
    removeDivision,
    publishDivision,
    unpublishDivision,
    startTournamentMatch
} from '../services/tournamentService';
import { auth } from '../services/firebase';
import { BracketEditor } from '../components/BracketEditor';
import { FixtureListView } from '../components/FixtureListView';
import { CourtPickerModal } from '../components/CourtPickerModal';
import type { Tournament, TournamentFixture, GenderCategory, SportType } from '../types';

export const TournamentManager: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // === DATA STATE ===
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [activeGender, setActiveGender] = useState<GenderCategory>('men');
    const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
    const [divisionFixtures, setDivisionFixtures] = useState<TournamentFixture[]>([]);

    // === UI STATE - EXISTING ===
    const [setupDivId, setSetupDivId] = useState<string | null>(null);
    const [customTeamCount, setCustomTeamCount] = useState<number>(8);
    const [showAddSportModal, setShowAddSportModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // === UI STATE - NEW (Court Picker & Fixtures) ===
    const [showCourtPicker, setShowCourtPicker] = useState(false);
    const [selectedFixture, setSelectedFixture] = useState<TournamentFixture | null>(null);
    const [startingGame, setStartingGame] = useState(false);
    const [activeTab, setActiveTab] = useState<'bracket' | 'fixtures'>('bracket');

    // === DATA SUBSCRIPTIONS ===
    useEffect(() => {
        if (!id) return;
        return subscribeToTournament(id, setTournament);
    }, [id]);

    useEffect(() => {
        if (!id || !selectedDivisionId) return;
        setIsEditMode(false);
        return subscribeToFixtures(id, selectedDivisionId, setDivisionFixtures);
    }, [id, selectedDivisionId]);

    // === EXISTING HANDLERS ===
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

    const handleRemoveDivision = async (divId: string) => {
        if (!id) return;
        if (window.confirm("⚠️ DELETE DIVISION?\n\nThis will remove all brackets and matches.")) {
            await removeDivision(id, divId);
        }
    };

    // === NEW HANDLERS - Court Picker & Game Starting ===
    const handleStartScoring = (fixture: TournamentFixture) => {
        // If already live, just navigate to the game
        if (fixture.status === 'live' && fixture.gameCode) {
            navigate(`/host/${fixture.gameCode}`);
            return;
        }

        // Show court picker modal
        setSelectedFixture(fixture);
        setShowCourtPicker(true);
    };

    const handleCourtSelected = async (court: string) => {
        if (!id || !selectedFixture || startingGame) return;

        setStartingGame(true);

        try {
            // Start the match with selected court
            const gameCode = await startTournamentMatch(
                id,
                selectedFixture.id,
                selectedFixture,
                court
            );

            // Navigate to scoring interface
            navigate(`/host/${gameCode}`);

        } catch (error: any) {
            console.error('Failed to start match:', error);
            alert(error.message || 'Failed to start match. Please try again.');
            setStartingGame(false);
            setShowCourtPicker(false);
        }
    };

    const handleOpenWallDisplay = () => {
        if (!id) return;
        window.open(`/wall/tournament/${id}`, '_blank');
    };

    // === LOADING STATE ===
    if (!tournament || !id) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white font-bold text-xl">Loading Tournament...</p>
                </div>
            </div>
        );
    }

    // === DERIVED STATE ===
    const isAdmin = auth.currentUser?.uid === tournament.adminId;
    const isApprovedScorer = tournament.approvedScorers.includes(auth.currentUser?.uid || '');
    const canManage = isAdmin || isApprovedScorer;

    const divisionsList = tournament.divisions ? Object.values(tournament.divisions) : [];
    const filteredDivisions = divisionsList.filter(d => d.gender === activeGender);
    const selectedDivision = selectedDivisionId && tournament.divisions ? tournament.divisions[selectedDivisionId] : null;
    const canStartGames = selectedDivision?.status === 'published' && canManage;

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

    // CONTINUE IN PART 2...// src/pages/TournamentManager.tsx - PART 2 (JSX RENDER)
    // CONTINUE FROM PART 1...

    // === MAIN RENDER ===
    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col relative overflow-hidden transition-colors duration-700">
            {/* Gradient Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${activeTheme.bgGradient} pointer-events-none transition-all duration-1000 z-0`}></div>

            {/* === HEADER === */}
            <header className="relative z-10 bg-black/40 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/tournament')}
                                className="text-zinc-500 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                            </button>
                            <h1 className="text-xl font-black italic uppercase tracking-wider text-white">{tournament.name}</h1>
                        </div>

                        {/* Gender Toggle */}
                        {!selectedDivisionId && (
                            <div className="flex items-center gap-2 pl-4 border-l border-zinc-800">
                                {(['men', 'women'] as const).map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setActiveGender(g)}
                                        className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeGender === g
                                                ? g === 'men'
                                                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30'
                                                    : 'bg-rose-500 text-black shadow-lg shadow-rose-500/30'
                                                : 'bg-zinc-900 text-zinc-600 hover:text-white'
                                            }`}
                                    >
                                        {g === 'men' ? '👔 Men' : '👗 Women'}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Wall Display Button */}
                    {selectedDivision?.status === 'published' && (
                        <button
                            onClick={handleOpenWallDisplay}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-sm tracking-wider rounded-lg transition-all hover:scale-105 shadow-lg shadow-blue-600/20"
                        >
                            📺 Open Wall Display
                        </button>
                    )}
                </div>
            </header>

            {/* === MAIN CONTENT === */}
            <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-6 py-8">

                {/* Division Selection OR Division View */}
                {!selectedDivisionId ? (
                    // === DIVISION GRID ===
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tight">
                                {activeGender === 'men' ? "Men's Divisions" : "Women's Divisions"}
                            </h2>
                            {isAdmin && addableSports.length > 0 && (
                                <button
                                    onClick={() => setShowAddSportModal(true)}
                                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase text-xs rounded-lg transition-all"
                                >
                                    + Add Sport
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredDivisions.map(div => (
                                <button
                                    key={div.id}
                                    onClick={() => setSelectedDivisionId(div.id)}
                                    className="p-6 rounded-xl border-2 transition-all hover:scale-105 bg-zinc-900/50 border-zinc-800 hover:border-yellow-500"
                                >
                                    <div className="text-2xl mb-2">
                                        {div.sport === 'basketball' && '🏀'}
                                        {div.sport === 'badminton' && '🏸'}
                                        {div.sport === 'volleyball' && '🏐'}
                                        {div.sport === 'kabaddi' && '🤼'}
                                        {div.sport === 'football' && '⚽'}
                                        {div.sport === 'cricket' && '🏏'}
                                    </div>
                                    <div className="text-lg font-bold uppercase">{div.sport}</div>
                                    <div className={`text-xs uppercase tracking-wider mt-2 ${div.status === 'published' ? 'text-green-500' :
                                            div.status === 'draft' ? 'text-yellow-500' :
                                                'text-zinc-600'
                                        }`}>
                                        {div.status}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    // === SELECTED DIVISION VIEW ===
                    <div>
                        {/* Back Button */}
                        <button
                            onClick={() => setSelectedDivisionId(null)}
                            className="mb-6 text-zinc-500 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                            </svg>
                            <span className="font-bold uppercase text-sm">Back to Divisions</span>
                        </button>

                        {/* Tab Navigation */}
                        {selectedDivision && selectedDivision.status !== 'setup_required' && (
                            <div className="flex items-center gap-4 border-b border-zinc-800 mb-6">
                                <button
                                    onClick={() => setActiveTab('bracket')}
                                    className={`pb-4 px-4 font-bold uppercase text-sm tracking-wider transition-all relative ${activeTab === 'bracket' ? 'text-white' : 'text-zinc-600 hover:text-white'
                                        }`}
                                >
                                    📊 Bracket
                                    {activeTab === 'bracket' && (
                                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('fixtures')}
                                    className={`pb-4 px-4 font-bold uppercase text-sm tracking-wider transition-all relative ${activeTab === 'fixtures' ? 'text-white' : 'text-zinc-600 hover:text-white'
                                        }`}
                                >
                                    📋 Fixtures
                                    {activeTab === 'fixtures' && (
                                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500"></div>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Tab Content */}
                        {selectedDivision && (
                            <div>
                                {/* SETUP REQUIRED */}
                                {selectedDivision.status === 'setup_required' && (
                                    <div className="text-center py-16 border-2 border-dashed border-zinc-800 rounded-xl">
                                        <div className="text-6xl mb-4">🏆</div>
                                        <h3 className="text-2xl font-bold mb-2">Activate Division</h3>
                                        <p className="text-zinc-500 mb-6">Generate bracket to get started</p>
                                        <button
                                            onClick={() => setSetupDivId(selectedDivision.id)}
                                            className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase rounded-lg transition-all hover:scale-105 shadow-lg shadow-yellow-500/20"
                                        >
                                            Activate Division
                                        </button>
                                    </div>
                                )}

                                {/* BRACKET TAB */}
                                {activeTab === 'bracket' && selectedDivision.status !== 'setup_required' && (
                                    <div>
                                        {/* Publish/Unpublish Buttons */}
                                        <div className="flex justify-end gap-3 mb-4">
                                            {selectedDivision.status === 'draft' && isAdmin && (
                                                <button
                                                    onClick={handlePublish}
                                                    className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg uppercase text-sm transition-all"
                                                >
                                                    📢 Publish Division
                                                </button>
                                            )}
                                            {selectedDivision.status === 'published' && isAdmin && (
                                                <button
                                                    onClick={handleUnpublish}
                                                    className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg uppercase text-sm transition-all"
                                                >
                                                    ⚠️ Unpublish
                                                </button>
                                            )}
                                        </div>

                                        {/* Bracket Editor */}
                                        <BracketEditor
                                            tournamentId={id}
                                            fixtures={divisionFixtures}
                                            isAdmin={isAdmin}
                                            divisionStatus={selectedDivision.status}
                                            isEditMode={isEditMode}
                                        />
                                    </div>
                                )}

                                {/* FIXTURES TAB */}
                                {activeTab === 'fixtures' && selectedDivision.status !== 'setup_required' && (
                                    <div>
                                        <FixtureListView
                                            fixtures={divisionFixtures}
                                            onStartScoring={handleStartScoring}
                                            canStartGames={canStartGames}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* === MODALS === */}

            {/* Setup Modal */}
            {setupDivId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold uppercase mb-4">Activate Division</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold uppercase tracking-wider text-zinc-500 mb-2">
                                    Team Count
                                </label>
                                <select
                                    value={customTeamCount}
                                    onChange={e => setCustomTeamCount(Number(e.target.value))}
                                    className="w-full bg-black border border-zinc-700 p-3 rounded text-white"
                                >
                                    {[4, 8, 16, 32].map(n => (
                                        <option key={n} value={n}>{n} Teams → {n / 2} Round 1 Matches → {Math.log2(n)} Rounds</option>
                                    ))}
                                </select>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded text-sm">
                                <div className="text-zinc-500 mb-1">Bracket Size: {bracketSize} slots</div>
                                <div className="text-zinc-500">BYEs: {byes} teams</div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setSetupDivId(null)}
                                className="px-4 py-2 text-zinc-500 hover:text-white transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleActivate}
                                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg"
                            >
                                Generate Bracket
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Sport Modal */}
            {showAddSportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold uppercase mb-4">Add Sport</h3>
                        <div className="space-y-2">
                            {addableSports.map(sport => (
                                <button
                                    key={sport}
                                    onClick={() => handleAddSport(sport)}
                                    className="w-full p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-left font-bold uppercase transition-all"
                                >
                                    {sport}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowAddSportModal(false)}
                            className="mt-4 w-full px-4 py-2 text-zinc-500 hover:text-white transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Court Picker Modal */}
            {showCourtPicker && selectedFixture && id && (
                <CourtPickerModal
                    tournamentId={id}
                    onSelect={handleCourtSelected}
                    onCancel={() => {
                        setShowCourtPicker(false);
                        setSelectedFixture(null);
                        setStartingGame(false);
                    }}
                />
            )}
        </div>
    );
};