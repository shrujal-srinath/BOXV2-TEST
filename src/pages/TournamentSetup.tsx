import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTournament } from '../services/tournamentService';
import type { TournamentConfig, SportType } from '../types';

export const TournamentSetup: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);

    // --- DATA STATE ---
    const [name, setName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [config, setConfig] = useState<TournamentConfig>({
        sports: {
            basketball: { isActive: true, courts: 1 },
            badminton: { isActive: false, courts: 3 },
            volleyball: { isActive: false, courts: 1 },
        }
    });

    // --- HANDLERS ---
    const toggleSport = (sport: SportType) => {
        setConfig(prev => ({
            sports: {
                ...prev.sports,
                [sport]: {
                    ...prev.sports[sport]!,
                    isActive: !prev.sports[sport]?.isActive
                }
            }
        }));
    };

    const updateCourts = (sport: SportType, count: number) => {
        setConfig(prev => ({
            sports: {
                ...prev.sports,
                [sport]: {
                    ...prev.sports[sport]!,
                    courts: Math.max(1, count)
                }
            }
        }));
    };

    const handleLaunch = async () => {
        setLoading(true);
        try {
            const id = await createTournament(name, logoUrl, config);
            navigate(`/tournament/${id}/manage`); // Redirect to the new Command Center
        } catch (err) {
            console.error(err);
            alert("Failed to create tournament");
            setLoading(false);
        }
    };

    // --- RENDER HELPERS ---
    const StepIndicator = ({ num, label }: { num: number, label: string }) => (
        <div className={`flex items-center gap-4 p-4 rounded-lg transition-all ${step === num ? 'bg-zinc-800 border border-yellow-500/50' : 'text-zinc-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step === num ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                {num}
            </div>
            <span className={`font-bold uppercase tracking-widest text-xs ${step === num ? 'text-white' : 'text-zinc-600'}`}>{label}</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col md:flex-row">

            {/* SIDEBAR (Progress) */}
            <aside className="w-full md:w-80 border-r border-zinc-800 bg-zinc-950 p-6 flex flex-col justify-between">
                <div>
                    <button onClick={() => navigate('/tournament')} className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest mb-8 flex items-center gap-2">
                        &larr; Cancel Setup
                    </button>
                    <h1 className="text-2xl font-black italic uppercase text-white mb-2">Setup Studio</h1>
                    <p className="text-xs text-zinc-500 mb-8">Configure your multi-sport event infrastructure.</p>

                    <div className="space-y-2">
                        <StepIndicator num={1} label="Identity" />
                        <StepIndicator num={2} label="Sports Catalog" />
                        <StepIndicator num={3} label="Infrastructure" />
                        <StepIndicator num={4} label="Launch" />
                    </div>
                </div>
                <div className="text-[10px] text-zinc-700 font-mono uppercase">System Ready • v2.0</div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col">
                <div className="flex-1 p-8 md:p-16 max-w-4xl mx-auto w-full">

                    {/* STEP 1: IDENTITY */}
                    {step === 1 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500 space-y-8">
                            <h2 className="text-4xl font-black italic uppercase text-white">Event Identity</h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Tournament Name</label>
                                    <input
                                        autoFocus
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g. KREEDOTSAV 2026"
                                        className="w-full bg-zinc-900 border border-zinc-800 p-6 text-2xl font-black text-white uppercase rounded-xl focus:border-yellow-500 outline-none transition-all placeholder:text-zinc-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Branding Logo URL (Optional)</label>
                                    <input
                                        value={logoUrl}
                                        onChange={e => setLogoUrl(e.target.value)}
                                        placeholder="https://..."
                                        className="w-full bg-black border border-zinc-800 p-4 text-sm text-zinc-300 rounded-xl focus:border-yellow-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: SPORTS CATALOG */}
                    {step === 2 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500 space-y-8">
                            <h2 className="text-4xl font-black italic uppercase text-white">Select Sports</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(['basketball', 'badminton', 'volleyball'] as SportType[]).map(sport => (
                                    <button
                                        key={sport}
                                        onClick={() => toggleSport(sport)}
                                        className={`p-6 rounded-xl border flex flex-col items-start gap-4 transition-all group ${config.sports[sport]?.isActive ? 'bg-yellow-900/10 border-yellow-500' : 'bg-zinc-900 border-zinc-800 opacity-60 hover:opacity-100'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${config.sports[sport]?.isActive ? 'border-yellow-500 bg-yellow-500' : 'border-zinc-600'}`}>
                                            {config.sports[sport]?.isActive && <span className="text-black text-xs font-bold">✓</span>}
                                        </div>
                                        <span className={`text-xl font-black uppercase italic ${config.sports[sport]?.isActive ? 'text-white' : 'text-zinc-500'}`}>{sport}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: INFRASTRUCTURE */}
                    {step === 3 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500 space-y-8">
                            <h2 className="text-4xl font-black italic uppercase text-white">Infrastructure Map</h2>
                            <p className="text-zinc-400 text-sm">Assign physical courts to each active sport.</p>

                            <div className="space-y-4">
                                {(Object.keys(config.sports) as SportType[]).filter(s => config.sports[s]?.isActive).map(sport => (
                                    <div key={sport} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl">🏟️</span>
                                            <span className="text-lg font-black uppercase italic">{sport}</span>
                                        </div>
                                        <div className="flex items-center gap-4 bg-black p-2 rounded-lg border border-zinc-800">
                                            <button onClick={() => updateCourts(sport, (config.sports[sport]?.courts || 1) - 1)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded text-white font-bold">-</button>
                                            <div className="text-center">
                                                <div className="text-xl font-mono font-bold text-yellow-500 w-12">{config.sports[sport]?.courts}</div>
                                                <div className="text-[9px] text-zinc-600 uppercase font-bold">Courts</div>
                                            </div>
                                            <button onClick={() => updateCourts(sport, (config.sports[sport]?.courts || 1) + 1)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded text-white font-bold">+</button>
                                        </div>
                                    </div>
                                ))}
                                {Object.values(config.sports).every(s => !s?.isActive) && (
                                    <div className="text-red-500 font-bold border border-red-900/50 bg-red-900/10 p-4 rounded">⚠️ No sports selected. Go back to Step 2.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 4: LAUNCH */}
                    {step === 4 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500 space-y-8 text-center pt-12">
                            <div className="w-24 h-24 bg-yellow-500 rounded-full mx-auto flex items-center justify-center animate-bounce">
                                <span className="text-4xl">🚀</span>
                            </div>
                            <h2 className="text-4xl font-black italic uppercase text-white">Ready to Launch?</h2>
                            <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-left space-y-4">
                                <div className="flex justify-between">
                                    <span className="text-zinc-500 text-xs font-bold uppercase">Event Name</span>
                                    <span className="text-white font-bold">{name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500 text-xs font-bold uppercase">Active Sports</span>
                                    <span className="text-white font-bold">{Object.values(config.sports).filter(s => s?.isActive).length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500 text-xs font-bold uppercase">Total Courts</span>
                                    <span className="text-white font-bold">{Object.values(config.sports).reduce((acc, curr) => acc + (curr?.isActive ? (curr.courts || 0) : 0), 0)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER CONTROLS */}
                <div className="p-8 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                    <button
                        onClick={() => step > 1 && setStep(step - 1)}
                        disabled={step === 1}
                        className={`text-xs font-bold uppercase tracking-widest px-6 py-4 rounded ${step === 1 ? 'opacity-0' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                    >
                        &larr; Previous
                    </button>

                    {step < 4 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={!name || (step === 3 && Object.values(config.sports).every(s => !s?.isActive))}
                            className="bg-white hover:bg-zinc-200 text-black font-bold px-8 py-4 rounded-lg uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Next Step &rarr;
                        </button>
                    ) : (
                        <button
                            onClick={handleLaunch}
                            disabled={loading}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-12 py-4 rounded-lg uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-all"
                        >
                            {loading ? 'Initializing...' : 'Launch Tournament'}
                        </button>
                    )}
                </div>
            </main>
        </div>
    );
};