import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTournament } from '../services/tournamentService';
import { ImageCropperModal } from '../components/ImageCropperModal'; // NEW IMPORT
import type { TournamentConfig } from '../types';

export const TournamentSetup: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Config State
    const [config, setConfig] = useState<TournamentConfig>({
        sports: {
            basketball: { isActive: true, courts: 1 },
            badminton: { isActive: false, courts: 0 },
            volleyball: { isActive: false, courts: 0 }
        }
    });

    // Branding State
    const [name, setName] = useState("");
    const [logoUrl, setLogoUrl] = useState(""); // Stores Base64 string now

    // Image Upload State
    const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- HANDLERS ---

    const updateSport = (sport: keyof TournamentConfig['sports'], field: 'isActive' | 'courts', value: any) => {
        setConfig(prev => ({
            ...prev,
            sports: {
                ...prev.sports,
                [sport]: {
                    ...prev.sports[sport],
                    [field]: value
                }
            }
        }));
    };

    // 1. Handle File Selection
    const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            reader.addEventListener('load', () => setTempImageSrc(reader.result as string));
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    // 2. Handle Crop Completion
    const onCropComplete = (croppedBase64: string) => {
        setLogoUrl(croppedBase64); // Save the result
        setTempImageSrc(null);     // Close modal
    };

    const handleCreate = async () => {
        if (!name) return;
        setIsSubmitting(true);
        try {
            const id = await createTournament(name, logoUrl, config);
            navigate(`/tournament/${id}/manage`);
        } catch (error) {
            console.error(error);
            alert("Failed to create tournament.");
            setIsSubmitting(false);
        }
    };

    // --- RENDER ---

    return (
        <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center p-4">

            {/* Cropper Modal Overlay */}
            {tempImageSrc && (
                <ImageCropperModal
                    imageSrc={tempImageSrc}
                    onCancel={() => setTempImageSrc(null)}
                    onCropComplete={onCropComplete}
                />
            )}

            <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[80vh]">

                {/* Header */}
                <div className="bg-zinc-950 border-b border-zinc-800 p-6 flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-xl font-black italic uppercase text-white">New Tournament</h1>
                        <div className="flex gap-2 mt-2">
                            <div className={`h-1 w-8 rounded-full ${step >= 1 ? 'bg-yellow-500' : 'bg-zinc-800'}`}></div>
                            <div className={`h-1 w-8 rounded-full ${step >= 2 ? 'bg-yellow-500' : 'bg-zinc-800'}`}></div>
                            <div className={`h-1 w-8 rounded-full ${step >= 3 ? 'bg-yellow-500' : 'bg-zinc-800'}`}></div>
                        </div>
                    </div>
                    <button onClick={() => navigate('/tournament')} className="text-zinc-500 hover:text-white text-2xl">&times;</button>
                </div>

                {/* Content */}
                <div className="flex-1 p-8 overflow-y-auto">

                    {/* STEP 1: SPORTS SELECTION */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                            <h2 className="text-lg font-bold uppercase tracking-wide">Select Sports</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(['basketball', 'badminton', 'volleyball'] as const).map(sport => (
                                    <div key={sport} className={`p-4 border rounded-xl cursor-pointer transition-all ${config.sports[sport]?.isActive ? 'bg-yellow-900/20 border-yellow-600' : 'bg-black border-zinc-800 opacity-60 hover:opacity-100'}`} onClick={() => updateSport(sport, 'isActive', !config.sports[sport]?.isActive)}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-2xl capitalize">{sport}</span>
                                            <div className={`w-4 h-4 rounded-full border-2 ${config.sports[sport]?.isActive ? 'bg-yellow-500 border-yellow-500' : 'border-zinc-600'}`}></div>
                                        </div>
                                        <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                            {config.sports[sport]?.isActive ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 2: COURTS CONFIG */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                            <h2 className="text-lg font-bold uppercase tracking-wide">Configure Venues</h2>
                            <div className="space-y-4">
                                {(Object.entries(config.sports) as [keyof TournamentConfig['sports'], any][]).map(([sport, data]) => {
                                    if (!data.isActive) return null;
                                    return (
                                        <div key={sport} className="bg-black border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-lg capitalize font-bold text-zinc-500">
                                                    {sport[0]}
                                                </div>
                                                <span className="font-bold text-white capitalize">{sport}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => updateSport(sport, 'courts', Math.max(1, data.courts - 1))} className="w-8 h-8 rounded bg-zinc-900 text-white hover:bg-zinc-800">-</button>
                                                <span className="font-mono font-bold w-4 text-center">{data.courts}</span>
                                                <button onClick={() => updateSport(sport, 'courts', Math.min(10, data.courts + 1))} className="w-8 h-8 rounded bg-zinc-900 text-white hover:bg-zinc-800">+</button>
                                                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest ml-2">Courts</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: BRANDING (UPDATED WITH IMAGE UPLOAD) */}
                    {step === 3 && (
                        <div className="space-y-8 animate-in slide-in-from-right-8 duration-500 max-w-lg mx-auto">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Tournament Name</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-black border border-zinc-800 p-4 text-lg font-bold text-white rounded-lg outline-none focus:border-yellow-600 uppercase placeholder-zinc-700"
                                    placeholder="E.G. SUMMER LEAGUE 2026"
                                />
                            </div>

                            {/* NEW: Image Upload Section */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-4 uppercase">Official Logo</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={onSelectFile}
                                    ref={fileInputRef}
                                    className="hidden"
                                />

                                <div className="flex items-center gap-6">
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="relative group w-32 h-32 rounded-full bg-zinc-900 border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-hidden hover:border-yellow-500 hover:bg-zinc-800 transition-all cursor-pointer shadow-lg"
                                    >
                                        {logoUrl ? (
                                            <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <span className="text-3xl text-zinc-600 group-hover:text-yellow-500 mb-1">+</span>
                                                <span className="text-[9px] font-bold text-zinc-600 uppercase group-hover:text-white">Upload</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-bold text-white mb-1">Upload Brand Asset</h3>
                                        <p className="text-xs text-zinc-500 leading-relaxed mb-3">
                                            Select a high-quality PNG or JPG from your device. <br />
                                            You will be able to crop it to fit the circular profile.
                                        </p>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-[10px] font-bold uppercase tracking-widest text-yellow-600 hover:text-yellow-500 underline"
                                        >
                                            Browse Files
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Controls */}
                <div className="bg-zinc-950 border-t border-zinc-800 p-6 flex justify-between shrink-0">
                    <button
                        onClick={() => setStep(Math.max(1, step - 1))}
                        disabled={step === 1}
                        className="px-6 py-3 rounded text-zinc-500 font-bold uppercase text-xs tracking-widest hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500"
                    >
                        Back
                    </button>
                    {step < 3 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            className="bg-white hover:bg-zinc-200 text-black px-8 py-3 rounded font-black uppercase text-xs tracking-widest transition-transform hover:-translate-y-0.5"
                        >
                            Next Step
                        </button>
                    ) : (
                        <button
                            onClick={handleCreate}
                            disabled={!name || isSubmitting}
                            className="bg-yellow-600 hover:bg-yellow-500 text-black px-8 py-3 rounded font-black uppercase text-xs tracking-widest shadow-lg shadow-yellow-900/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                            {isSubmitting ? 'Creating System...' : 'Launch Tournament'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};