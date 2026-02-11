// src/pages/TournamentManager.tsx
// ULTIMATE PREMIUM VERSION - Best UI/UX
// Professional icons, perfect spacing, premium feel

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    subscribeToTournament,
    subscribeToFixtures,
    activateDivision,
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
    const [showExportMenu, setShowExportMenu] = useState<string | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    useEffect(() => {
        if (!id) return;
        return subscribeToTournament(id, setTournament);
    }, [id]);

    useEffect(() => {
        if (!id || !selectedDivisionId) return;
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
        if (window.confirm("DANGER: RESET TO DRAFT?\n\nThis will HIDE the bracket from scorers.")) {
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
        if (window.confirm("DELETE THIS DIVISION?\n\nAll bracket data will be lost.")) {
            await removeDivision(id, divId);
        }
    };

    const handleExport = (divisionId: string, format: 'pdf' | 'image') => {
        alert(`Exporting ${divisionId} as ${format.toUpperCase()}...`);
        setShowExportMenu(null);
    };

    if (!tournament) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <div className="text-zinc-500 font-mono text-sm animate-pulse">LOADING TOURNAMENT...</div>
            </div>
        </div>
    );

    // --- DERIVED STATE ---
    const isAdmin = auth.currentUser?.uid === tournament.adminId;
    const divisionsList = tournament.divisions ? Object.values(tournament.divisions) : [];
    const filteredDivisions = divisionsList.filter(d => d.gender === activeGender);
    const currentDivision = (selectedDivisionId && tournament.divisions) ? tournament.divisions[selectedDivisionId] : null;

    const availableSports: SportType[] = ['basketball', 'badminton', 'volleyball', 'kabaddi', 'football', 'cricket'];
    const existingSports = new Set(divisionsList.map(d => d.sport));
    const addableSports = availableSports.filter(s => !existingSports.has(s));

    // REFINED COLOR THEMES
    const theme = {
        men: {
            primary: 'text-amber-500',
            bg: 'bg-amber-900/10',
            border: 'border-amber-600/30',
            line: 'bg-gradient-to-r from-transparent via-amber-500 to-transparent',
            bgGradient: 'from-amber-950/10 via-black to-black',
            glow: 'shadow-amber-500/10',
            accent: 'from-amber-600 to-amber-500'
        },
        women: {
            primary: 'text-rose-500',
            bg: 'bg-rose-900/10',
            border: 'border-rose-600/30',
            line: 'bg-gradient-to-r from-transparent via-rose-500 to-transparent',
            bgGradient: 'from-rose-950/10 via-black to-black',
            glow: 'shadow-rose-500/10',
            accent: 'from-rose-600 to-rose-500'
        }
    };
    const activeTheme = theme[activeGender];

    const bracketSize = Math.pow(2, Math.ceil(Math.log2(customTeamCount)));
    const byes = bracketSize - customTeamCount;

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden">
            {/* Animated Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${activeTheme.bgGradient} transition-all duration-1000 pointer-events-none`}></div>

            {/* Grid Pattern Overlay - RESTORED */}
            <div
                className="absolute inset-0 opacity-[0.02] pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                }}
            ></div>

            {/* HEADER */}
            <header className="relative z-20 bg-black/50 backdrop-blur-xl border-b border-zinc-900/50 sticky top-0">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    {/* Left */}
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate('/tournament')}
                            className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-all"
                        >
                            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                            </svg>
                            <span className="text-xs font-bold uppercase tracking-widest">Back</span>
                        </button>

                        <div className="h-8 w-px bg-zinc-800"></div>

                        <div>
                            <h1 className="text-2xl font-black italic uppercase tracking-tight text-white">{tournament.name}</h1>
                            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">{tournament.id}</p>
                        </div>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-4">
                        {!selectedDivisionId && (
                            <div className="flex items-center gap-2 bg-zinc-900/50 backdrop-blur-sm p-1.5 rounded-xl border border-zinc-800">
                                {(['men', 'women'] as const).map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setActiveGender(g)}
                                        className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeGender === g
                                                ? `${theme[g].bg} ${theme[g].primary} border ${theme[g].border}`
                                                : 'text-zinc-500 hover:text-white'
                                            }`}
                                    >
                                        {g === 'men' ? "Men's" : "Women's"}
                                    </button>
                                ))}
                            </div>
                        )}

                        {selectedDivisionId && (
                            <button
                                onClick={() => setSelectedDivisionId(null)}
                                className="px-5 py-2.5 border border-zinc-700 hover:border-white text-zinc-400 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                            >
                                ← Back to Grid
                            </button>
                        )}

                        {!selectedDivisionId && isAdmin && (
                            <button
                                onClick={() => setShowAddSportModal(true)}
                                className="px-5 py-2.5 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-yellow-900/30 hover:-translate-y-0.5"
                            >
                                + Add Sport
                            </button>
                        )}
                    </div>
                </div>

                {/* Gender Accent Line */}
                <div className={`w-full h-px ${activeTheme.line}`}></div>
            </header>

            <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
                {/* DIVISION GRID */}
                {!selectedDivisionId && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Section Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-4xl font-black italic uppercase tracking-tight mb-2">
                                    <span className={activeTheme.primary}>{activeGender === 'men' ? "Men's" : "Women's"}</span> Divisions
                                </h2>
                                <p className="text-zinc-500 text-sm">Select a division to manage bracket and fixtures</p>
                            </div>
                            {filteredDivisions.length > 0 && (
                                <div className="text-right">
                                    <div className="text-4xl font-black text-white">{filteredDivisions.length}</div>
                                    <div className="text-[10px] text-zinc-600 uppercase tracking-widest">Active Sports</div>
                                </div>
                            )}
                        </div>

                        {filteredDivisions.length === 0 ? (
                            <div className="border-2 border-dashed border-zinc-900 rounded-3xl p-20 text-center">
                                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-zinc-900 flex items-center justify-center">
                                    <svg className="w-12 h-12 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-zinc-400 mb-2">No {activeGender === 'men' ? "men's" : "women's"} divisions configured</h3>
                                <p className="text-zinc-600 text-sm mb-8">Add a sport to get started</p>
                                {isAdmin && (
                                    <button
                                        onClick={() => setShowAddSportModal(true)}
                                        className="bg-yellow-600 hover:bg-yellow-500 text-black font-black py-3 px-6 rounded-xl uppercase text-xs transition-all"
                                    >
                                        + Add Sport
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredDivisions.map((div, index) => (
                                    <PremiumDivisionCard
                                        key={div.id}
                                        division={div}
                                        theme={activeTheme}
                                        index={index}
                                        isAdmin={isAdmin}
                                        showExportMenu={showExportMenu === div.id}
                                        onSelect={() => div.isActive ? setSelectedDivisionId(div.id) : setSetupDivId(div.id)}
                                        onDelete={() => handleRemoveDivision(div.id)}
                                        onExportMenuToggle={() => setShowExportMenu(showExportMenu === div.id ? null : div.id)}
                                        onExport={(format) => handleExport(div.id, format)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* BRACKET EDITOR */}
                {selectedDivisionId && currentDivision && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        <div className="bg-zinc-950/50 backdrop-blur-sm border border-zinc-900 rounded-2xl p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 flex items-center justify-center">
                                    <PremiumSportIcon sport={currentDivision.sport} className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black italic uppercase tracking-tight">{currentDivision.sport}</h3>
                                    <p className="text-xs text-zinc-500 uppercase tracking-widest">{currentDivision.gender === 'men' ? "Men's" : "Women's"} Division</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {isAdmin && currentDivision.status === 'draft' && (
                                    <button
                                        onClick={handlePublish}
                                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-green-900/30"
                                    >
                                        📡 Publish
                                    </button>
                                )}

                                {isAdmin && currentDivision.status === 'published' && (
                                    <button
                                        onClick={handleUnpublish}
                                        className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl font-bold uppercase text-xs tracking-widest transition-all border border-zinc-700"
                                    >
                                        🔒 Unpublish
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="bg-zinc-950/30 backdrop-blur-sm border border-zinc-900 rounded-2xl p-6 min-h-[600px]">
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

            {/* MODALS */}
            {setupDivId && (
                <SetupModal
                    divisionId={setupDivId}
                    teamCount={customTeamCount}
                    bracketSize={bracketSize}
                    byes={byes}
                    onTeamCountChange={setCustomTeamCount}
                    onConfirm={handleActivate}
                    onCancel={() => setSetupDivId(null)}
                />
            )}

            {showAddSportModal && (
                <AddSportModal
                    addableSports={addableSports}
                    onAddSport={handleAddSport}
                    onClose={() => setShowAddSportModal(false)}
                />
            )}
        </div>
    );
};

// ============================================
// PREMIUM SPORT ICONS (Clean SVG Line Icons)
// ============================================

const PremiumSportIcon: React.FC<{ sport: SportType; className?: string }> = ({ sport, className = "w-6 h-6" }) => {
    const icons = {
        basketball: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2v20M2 12h20" />
                <path d="M12 2c0 5.523 4.477 10 10 10M2 12c0-5.523 4.477-10 10-10" />
            </svg>
        ),
        badminton: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L8 6 12 10 16 6z" />
                <ellipse cx="12" cy="18" rx="4" ry="3" />
                <path d="M12 10v5" />
            </svg>
        ),
        volleyball: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12c0-4 3-7 7-7M4 12c3 0 5-2 8-2" />
            </svg>
        ),
        kabaddi: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="6" r="3" />
                <path d="M12 10v4M9 14l-2 4M15 14l2 4M12 14l-3 2M12 14l3 2" />
            </svg>
        ),
        football: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2l3 6h5l-4 4 2 6-6-4-6 4 2-6-4-4h5z" />
            </svg>
        ),
        cricket: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="10" y="2" width="4" height="12" rx="2" />
                <circle cx="12" cy="19" r="3" />
                <path d="M8 6h8M8 10h8" />
            </svg>
        )
    };

    return icons[sport] || icons.basketball;
};

// ============================================
// PREMIUM DIVISION CARD
// ============================================

const PremiumDivisionCard: React.FC<any> = ({
    division, theme, index, isAdmin, showExportMenu,
    onSelect, onDelete, onExportMenuToggle, onExport
}) => {
    const statusConfig: any = {
        setup_required: {
            badge: 'Setup',
            badgeColor: 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50',
            borderColor: 'border-zinc-800',
            gradientFrom: 'from-zinc-900',
            gradientTo: 'to-zinc-950',
            action: 'Initialize',
            actionGradient: 'from-zinc-700 to-zinc-600 hover:from-zinc-600 hover:to-zinc-500',
            canDelete: true
        },
        draft: {
            badge: 'Draft',
            badgeColor: 'bg-yellow-900/30 text-yellow-500 border-yellow-900/50',
            borderColor: 'border-yellow-900/30',
            gradientFrom: 'from-yellow-950/20',
            gradientTo: 'to-zinc-950',
            action: 'Configure',
            actionGradient: 'from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400',
            canDelete: false
        },
        published: {
            badge: 'Live',
            badgeColor: 'bg-green-900/30 text-green-500 border-green-900/50',
            borderColor: 'border-green-900/30',
            gradientFrom: 'from-green-950/20',
            gradientTo: 'to-zinc-950',
            action: 'Manage',
            actionGradient: 'from-green-600 to-green-500 hover:from-green-500 hover:to-green-400',
            canDelete: false
        },
        completed: {
            badge: 'Complete',
            badgeColor: 'bg-blue-900/30 text-blue-500 border-blue-900/50',
            borderColor: 'border-blue-900/30',
            gradientFrom: 'from-blue-950/20',
            gradientTo: 'to-zinc-950',
            action: 'Results',
            actionGradient: 'from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400',
            canDelete: false
        }
    };

    const config = statusConfig[division.status as keyof typeof statusConfig];

    return (
        <div
            onClick={onSelect}
            className={`group relative bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo} border ${config.borderColor} hover:border-yellow-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-yellow-900/20 overflow-hidden animate-in fade-in slide-in-from-bottom-4`}
            style={{ animationDelay: `${index * 100}ms` }}
        >
            {/* Gradient Overlay on Hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/0 via-yellow-900/0 to-yellow-900/0 group-hover:from-yellow-900/5 group-hover:via-transparent group-hover:to-transparent transition-all duration-500 pointer-events-none"></div>

            {/* Header Row */}
            <div className="relative z-10 flex justify-between items-start mb-6">
                <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest border backdrop-blur-sm ${config.badgeColor}`}>
                    {config.badge}
                </span>

                <div className="flex items-center gap-2">
                    {/* Export Menu */}
                    {division.isActive && (
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); onExportMenuToggle(); }}
                                className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-700 hover:border-zinc-600 transition-all opacity-0 group-hover:opacity-100"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onExport('pdf'); }}
                                        className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-3"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        Export as PDF
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onExport('image'); }}
                                        className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-3"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 15.5M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Export as Image
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Delete Button */}
                    {isAdmin && config.canDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            className="p-2 rounded-lg bg-red-900/20 border border-red-900/30 text-red-500 hover:bg-red-900/40 hover:border-red-900/50 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Sport Icon - Smaller & More Professional */}
            <div className="relative z-10 mb-6 flex justify-center">
                <div className="w-16 h-16 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center group-hover:scale-110 group-hover:border-zinc-700 transition-all duration-300">
                    <PremiumSportIcon sport={division.sport} className="w-8 h-8 text-zinc-400 group-hover:text-white transition-colors" />
                </div>
            </div>

            {/* Sport Name */}
            <h3 className="relative z-10 text-xl font-black italic uppercase text-center mb-3 text-white group-hover:text-yellow-500 transition-colors tracking-tight">
                {division.sport}
            </h3>

            {/* Team Info */}
            {division.bracketSize ? (
                <div className="relative z-10 text-center mb-5">
                    <p className="text-sm text-zinc-500 mb-2">
                        <span className="font-bold text-white">{division.bracketSize}</span> Teams
                    </p>
                    <div className="flex items-center justify-center gap-2 text-xs text-zinc-600">
                        <span>{Math.log2(division.bracketSize)} Rounds</span>
                        <span>•</span>
                        <span>{division.bracketSize - 1} Matches</span>
                    </div>
                </div>
            ) : (
                <div className="relative z-10 text-center mb-5">
                    <p className="text-sm text-zinc-600">Not configured</p>
                </div>
            )}

            {/* Action Button */}
            <button
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                className={`relative z-10 w-full py-3 rounded-xl bg-gradient-to-r ${config.actionGradient} text-white font-bold uppercase text-xs tracking-wider transition-all shadow-lg hover:shadow-xl`}
            >
                {config.action}
            </button>
        </div>
    );
};

// ============================================
// SETUP MODAL
// ============================================

const SetupModal: React.FC<any> = ({ divisionId, teamCount, bracketSize, byes, onTeamCountChange, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onCancel}></div>
        <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md p-10 relative z-10 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black uppercase text-white mb-8 tracking-wide text-center">
                Setup <span className="text-yellow-500">{divisionId.split('_')[0]}</span>
            </h2>

            <div className="mb-10">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-6 text-center">
                    Participating Teams
                </label>

                <div className="flex items-center justify-center gap-6 mb-6">
                    <button
                        onClick={() => onTeamCountChange(Math.max(2, teamCount - 1))}
                        className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    >
                        −
                    </button>

                    <div className="text-6xl font-black text-white w-32 text-center tabular-nums">
                        {teamCount}
                    </div>

                    <button
                        onClick={() => onTeamCountChange(teamCount + 1)}
                        className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    >
                        +
                    </button>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center space-y-2">
                    <p className="text-sm text-zinc-400">
                        Bracket size: <span className="text-white font-bold">{bracketSize} slots</span>
                    </p>
                    <p className="text-xs text-zinc-600">
                        {byes > 0 ? `${byes} team${byes > 1 ? 's' : ''} receive first-round BYE` : 'Perfect bracket - no BYEs needed'}
                    </p>
                </div>
            </div>

            <div className="flex gap-4">
                <button
                    onClick={onCancel}
                    className="flex-1 py-4 rounded-xl bg-zinc-900 text-zinc-400 font-bold uppercase text-xs hover:text-white hover:bg-zinc-800 transition-all border border-zinc-800"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className="flex-1 py-4 rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-black uppercase text-xs hover:from-yellow-500 hover:to-yellow-400 transition-all shadow-lg shadow-yellow-900/30"
                >
                    Generate
                </button>
            </div>
        </div>
    </div>
);

// ============================================
// ADD SPORT MODAL
// ============================================

const AddSportModal: React.FC<any> = ({ addableSports, onAddSport, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
        <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl p-8 relative z-10 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black uppercase text-white mb-6">Add Sport</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {addableSports.map((sport: SportType) => (
                    <button
                        key={sport}
                        onClick={() => onAddSport(sport)}
                        className="group p-6 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-yellow-600 transition-all text-center"
                    >
                        <div className="mb-4 flex justify-center">
                            <div className="w-12 h-12 rounded-lg bg-zinc-800 group-hover:bg-zinc-700 border border-zinc-700 group-hover:border-zinc-600 flex items-center justify-center transition-all">
                                <PremiumSportIcon sport={sport} className="w-6 h-6 text-zinc-500 group-hover:text-white transition-colors" />
                            </div>
                        </div>
                        <div className="text-sm font-bold text-white uppercase">{sport}</div>
                    </button>
                ))}
            </div>

            {addableSports.length === 0 && (
                <p className="text-center text-zinc-600 text-sm py-8">All sports have been added</p>
            )}

            <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-zinc-900 text-zinc-400 font-bold uppercase text-xs hover:text-white hover:bg-zinc-800 transition-all"
            >
                Close
            </button>
        </div>
    </div>
);