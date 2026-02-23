// src/pages/TournamentSetup.tsx
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTournament } from '../services/tournamentService';
import { ImageCropperModal } from '../components/ImageCropperModal';
import type { SchedulableSport } from '../types';

export const TournamentSetup: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Identity
    const [name, setName] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    const [organizer, setOrganizer] = useState("");
    const [location, setLocation] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Config
    const [selectedSports, setSelectedSports] = useState<SchedulableSport[]>(['basketball']);
    const [sportConfig, setSportConfig] = useState<{ [key: string]: { courts: number } }>({
        basketball: { courts: 1 }
    });

    // Image Upload
    const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const availableSports: SchedulableSport[] = ['basketball', 'badminton', 'volleyball', 'kabaddi', 'football', 'cricket'];

    // HANDLERS
    const toggleSport = (sport: SchedulableSport) => {
        if (selectedSports.includes(sport)) {
            setSelectedSports(prev => prev.filter(s => s !== sport));
            const newConfig = { ...sportConfig };
            delete newConfig[sport];
            setSportConfig(newConfig);
        } else {
            setSelectedSports(prev => [...prev, sport]);
            setSportConfig(prev => ({ ...prev, [sport]: { courts: 1 } }));
        }
    };

    const updateCourts = (sport: SchedulableSport, delta: number) => {
        setSportConfig(prev => ({
            ...prev,
            [sport]: { courts: Math.max(1, Math.min(20, (prev[sport]?.courts || 1) + delta)) }
        }));
    };

    const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            reader.addEventListener('load', () => setTempImageSrc(reader.result as string));
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const onCropComplete = (croppedBase64: string) => {
        setLogoUrl(croppedBase64);
        setTempImageSrc(null);
    };

    const handleCreate = async () => {
        if (!name) return;
        setIsSubmitting(true);
        try {
            const id = await createTournament(
                name,
                logoUrl,
                { organizer, location, startDate, endDate },
                sportConfig as any
            );
            navigate(`/tournament/${id}/manage`);
        } catch (error) {
            console.error(error);
            alert("Failed to create tournament.");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center p-4">
            {tempImageSrc && (
                <ImageCropperModal
                    imageSrc={tempImageSrc}
                    onCancel={() => setTempImageSrc(null)}
                    onCropComplete={onCropComplete}
                />
            )}

            <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[85vh]">

                {/* Header */}
                <div className="bg-zinc-950 border-b border-zinc-800 p-6 flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-xl font-black italic uppercase text-white">New Tournament</h1>
                        <div className="flex gap-2 mt-2">
                            {[1, 2, 3].map(s => (
                                <div key={s} className={`h-1 w-8 rounded-full transition-colors duration-300 ${step >= s ? 'bg-yellow-500' : 'bg-zinc-800'}`}></div>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => navigate('/tournament')} className="text-zinc-500 hover:text-white text-2xl">&times;</button>
                </div>

                {/* Content */}
                <div className="flex-1 p-8 overflow-y-auto">

                    {/* STEP 1: IDENTITY */}
                    {step === 1 && (
                        <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <h2 className="text-lg font-bold uppercase tracking-wide">Identity</h2>
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Event Name *</label>
                                        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 text-lg font-bold text-white rounded-lg outline-none focus:border-yellow-600 uppercase placeholder-zinc-700" placeholder="E.G. SUMMER OLYMPICS 2026" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-4 uppercase">Event Logo</label>
                                        <input type="file" accept="image/*" onChange={onSelectFile} ref={fileInputRef} className="hidden" />
                                        <div className="flex items-center gap-6">
                                            <div onClick={() => fileInputRef.current?.click()} className="relative group w-20 h-20 rounded-full bg-zinc-900 border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-hidden hover:border-yellow-500 hover:bg-zinc-800 transition-all cursor-pointer shadow-lg">
                                                {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : <span className="text-zinc-600 group-hover:text-white text-xs font-bold uppercase">Upload</span>}
                                            </div>
                                            <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold uppercase tracking-widest text-yellow-600 hover:text-yellow-500 underline">Choose Image</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <h2 className="text-lg font-bold uppercase tracking-wide">Details</h2>
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Organizer</label>
                                        <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 text-sm text-white rounded outline-none focus:border-zinc-600 placeholder-zinc-800" placeholder="Organization" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Location</label>
                                        <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 text-sm text-white rounded outline-none focus:border-zinc-600 placeholder-zinc-800" placeholder="Venue" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Start</label>
                                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 text-sm text-white rounded outline-none focus:border-zinc-600 uppercase" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">End</label>
                                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 text-sm text-white rounded outline-none focus:border-zinc-600 uppercase" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: SPORTS */}
                    {step === 2 && (
                        <div className="animate-in slide-in-from-right-8 duration-500">
                            <h2 className="text-lg font-bold uppercase tracking-wide mb-6">Select Events</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {availableSports.map(sport => (
                                    <div
                                        key={sport}
                                        onClick={() => toggleSport(sport)}
                                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${selectedSports.includes(sport) ? 'bg-zinc-800 border-yellow-500' : 'bg-black border-zinc-800 hover:border-zinc-600 opacity-60 hover:opacity-100'}`}
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xl capitalize font-bold text-white">{sport}</span>
                                            {selectedSports.includes(sport) && <span className="text-yellow-500">✓</span>}
                                        </div>
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                                            {selectedSports.includes(sport) ? 'Included' : 'Click to Add'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: COURTS */}
                    {step === 3 && (
                        <div className="animate-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                            <h2 className="text-lg font-bold uppercase tracking-wide mb-6 text-center">Configure Venues</h2>
                            <div className="space-y-4">
                                {selectedSports.map(sport => (
                                    <div key={sport} className="bg-black border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-lg capitalize font-bold text-zinc-500">{sport[0]}</div>
                                            <span className="font-bold text-white capitalize">{sport}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => updateCourts(sport, -1)} className="w-8 h-8 rounded bg-zinc-900 text-white hover:bg-zinc-800 font-bold">-</button>
                                            <span className="font-mono font-bold w-6 text-center text-yellow-500 text-lg">{sportConfig[sport]?.courts || 1}</span>
                                            <button onClick={() => updateCourts(sport, 1)} className="w-8 h-8 rounded bg-zinc-900 text-white hover:bg-zinc-800 font-bold">+</button>
                                            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest ml-2">Courts</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Controls */}
                <div className="bg-zinc-950 border-t border-zinc-800 p-6 flex justify-between shrink-0">
                    <button
                        onClick={() => setStep(Math.max(1, step - 1))}
                        disabled={step === 1}
                        className="px-6 py-3 rounded text-zinc-500 font-bold uppercase text-xs tracking-widest hover:text-white disabled:opacity-30"
                    >
                        Back
                    </button>
                    {step < 3 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={step === 1 && !name}
                            className="bg-white hover:bg-zinc-200 text-black px-8 py-3 rounded font-black uppercase text-xs tracking-widest transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            Next Step
                        </button>
                    ) : (
                        <button
                            onClick={handleCreate}
                            disabled={isSubmitting}
                            className="bg-yellow-600 hover:bg-yellow-500 text-black px-8 py-3 rounded font-black uppercase text-xs tracking-widest shadow-lg shadow-yellow-900/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Initializing...' : 'Launch Tournament'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};