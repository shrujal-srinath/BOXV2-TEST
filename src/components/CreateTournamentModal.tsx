import React, { useState } from 'react';
import { createTournament } from '../services/tournamentService';
import type { TournamentConfig, SportType } from '../types';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateTournamentModal: React.FC<Props> = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1 Data
    const [name, setName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');

    // Step 2 Data
    const [config, setConfig] = useState<TournamentConfig>({
        sports: {
            basketball: { isActive: true, courts: 1 },
            badminton: { isActive: false, courts: 3 },
            volleyball: { isActive: false, courts: 1 },
        }
    });

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

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await createTournament(name, logoUrl, config);
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to create tournament");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg p-0 relative z-10 rounded-xl shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]">

                {/* HEADER */}
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Create Event</h3>
                        <div className="flex gap-2 mt-2">
                            <div className={`h-1 w-8 rounded-full transition-colors ${step >= 1 ? 'bg-yellow-500' : 'bg-zinc-800'}`}></div>
                            <div className={`h-1 w-8 rounded-full transition-colors ${step >= 2 ? 'bg-yellow-500' : 'bg-zinc-800'}`}></div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white text-2xl transition-colors">&times;</button>
                </div>

                {/* CONTENT */}
                <div className="p-6 overflow-y-auto flex-1">

                    {/* STEP 1: IDENTITY */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Tournament Name</label>
                                <input
                                    autoFocus
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="KREEDOTSAV 2026"
                                    className="w-full bg-black border border-zinc-700 p-4 text-white font-black text-xl rounded focus:border-yellow-500 outline-none uppercase placeholder:text-zinc-800"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Logo URL (Optional)</label>
                                <input
                                    value={logoUrl}
                                    onChange={e => setLogoUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-black border border-zinc-700 p-3 text-zinc-300 text-sm rounded focus:border-yellow-500 outline-none"
                                />
                                <p className="text-[9px] text-zinc-600 mt-2">This logo will appear on the big screen and spectator links.</p>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: INFRASTRUCTURE */}
                    {step === 2 && (
                        <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                            <p className="text-xs text-zinc-400 mb-4">Select sports and assign the number of active courts.</p>

                            {/* Sport Toggles */}
                            {(['basketball', 'badminton', 'volleyball'] as SportType[]).map(sport => (
                                <div key={sport} className={`p-4 rounded-lg border transition-all ${config.sports[sport]?.isActive ? 'bg-zinc-900 border-yellow-600/50' : 'bg-black border-zinc-800 opacity-60'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={config.sports[sport]?.isActive}
                                                onChange={() => toggleSport(sport)}
                                                className="w-5 h-5 accent-yellow-500 bg-zinc-800 border-zinc-600 rounded cursor-pointer"
                                            />
                                            <span className="font-bold uppercase text-sm text-white">{sport}</span>
                                        </div>

                                        {config.sports[sport]?.isActive && (
                                            <div className="flex items-center gap-2 bg-black rounded border border-zinc-700 px-2 py-1">
                                                <button
                                                    onClick={() => updateCourts(sport, (config.sports[sport]?.courts || 1) - 1)}
                                                    className="text-zinc-400 hover:text-white px-2 font-bold"
                                                >-</button>
                                                <span className="text-sm font-mono font-bold w-4 text-center text-yellow-500">{config.sports[sport]?.courts}</span>
                                                <button
                                                    onClick={() => updateCourts(sport, (config.sports[sport]?.courts || 1) + 1)}
                                                    className="text-zinc-400 hover:text-white px-2 font-bold"
                                                >+</button>
                                                <span className="text-[9px] font-bold text-zinc-600 uppercase ml-1">Courts</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                {/* FOOTER */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-between items-center">
                    {step > 1 ? (
                        <button onClick={() => setStep(step - 1)} className="text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest px-4">Back</button>
                    ) : (
                        <div></div>
                    )}

                    {step < 2 ? (
                        <button
                            onClick={() => name && setStep(step + 1)}
                            disabled={!name}
                            className="bg-zinc-100 hover:bg-white text-black font-bold py-3 px-8 rounded uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next Step &rarr;
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="bg-yellow-600 hover:bg-yellow-500 text-black font-black py-3 px-8 rounded uppercase tracking-widest text-xs shadow-lg shadow-yellow-900/20 transition-all"
                        >
                            {loading ? 'Launching...' : 'Launch Event'}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};