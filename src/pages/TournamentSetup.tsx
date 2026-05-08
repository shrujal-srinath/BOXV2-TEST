// src/pages/TournamentSetup.tsx
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTournament } from '../services/tournamentService';
import { ImageCropperModal } from '../components/ImageCropperModal';
import type { SchedulableSport } from '../types';

const inp = [
  'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-150',
  'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400',
  'focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10',
  'dark:bg-black dark:border-zinc-800 dark:text-white dark:placeholder:text-zinc-700',
  'dark:focus:border-yellow-600 dark:focus:ring-yellow-600/10',
].join(' ');

export const TournamentSetup: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [name, setName] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    const [organizer, setOrganizer] = useState("");
    const [location, setLocation] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [selectedSports, setSelectedSports] = useState<SchedulableSport[]>(['basketball']);
    const [sportConfig, setSportConfig] = useState<{ [key: string]: { courts: number } }>({
        basketball: { courts: 1 }
    });

    const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const availableSports: SchedulableSport[] = [
      'basketball', 'badminton', 'volleyball', 'kabaddi', 'tabletennis', 'general',
      'cricket', 'football', 'hockey', 'khokho', 'netball', 'tennis', 'handball', 'throwball', 'chess', 'carrom', 'athletics',
    ];

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
        <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white font-sans flex items-center justify-center p-4">
            {tempImageSrc && (
                <ImageCropperModal
                    imageSrc={tempImageSrc}
                    onCancel={() => setTempImageSrc(null)}
                    onCropComplete={onCropComplete}
                />
            )}

            <div className="w-full max-w-4xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[85vh] [box-shadow:0_1px_3px_rgba(0,0,0,0.08),0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-none">

                {/* Header */}
                <div className="bg-white dark:bg-zinc-950 border-b border-slate-100 dark:border-zinc-800 px-6 py-5 flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">New Tournament</h1>
                        <div className="flex gap-2 mt-2.5">
                            {[1, 2, 3].map(s => (
                                <div key={s} className={`h-1 w-8 rounded-full transition-colors duration-300 ${step >= s ? 'bg-red-600' : 'bg-slate-200 dark:bg-zinc-800'}`} />
                            ))}
                        </div>
                    </div>
                    <button onClick={() => navigate('/tournament')} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-xl leading-none">
                        &times;
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-8 overflow-y-auto">

                    {/* STEP 1: IDENTITY */}
                    {step === 1 && (
                        <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-5">
                                    <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200 border-l-4 border-red-600 pl-3">Identity</h2>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-wide block mb-1.5">Event Name <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Required</span></label>
                                        <input value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="Summer Olympics 2026" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-wide block mb-2">Event Logo <span className="text-[9px] text-slate-400 dark:text-zinc-500">Optional</span></label>
                                        <input type="file" accept="image/*" onChange={onSelectFile} ref={fileInputRef} className="hidden" />
                                        <div className="flex items-center gap-5">
                                            <div onClick={() => fileInputRef.current?.click()} className="relative group w-20 h-20 rounded-2xl bg-slate-50 dark:bg-zinc-900 border-2 border-dashed border-slate-300 dark:border-zinc-700 flex items-center justify-center overflow-hidden hover:border-red-500 dark:hover:border-yellow-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer">
                                                {logoUrl ? (
                                                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-slate-400 dark:text-zinc-600 group-hover:text-slate-600 dark:group-hover:text-white text-xs font-bold uppercase transition-colors">Upload</span>
                                                )}
                                            </div>
                                            <button onClick={() => fileInputRef.current?.click()} className="text-[11px] font-bold uppercase tracking-widest text-red-600 dark:text-yellow-600 hover:text-red-700 dark:hover:text-yellow-500 underline">Choose Image</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-5">
                                    <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200 border-l-4 border-red-600 pl-3">Details</h2>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-wide block mb-1.5">Organizer</label>
                                        <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} className={inp} placeholder="Organization name" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-wide block mb-1.5">Location</label>
                                        <input value={location} onChange={(e) => setLocation(e.target.value)} className={inp} placeholder="Venue" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-wide block mb-1.5">Start</label>
                                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inp} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-wide block mb-1.5">End</label>
                                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inp} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: SPORTS */}
                    {step === 2 && (
                        <div className="animate-in slide-in-from-right-8 duration-500">
                            <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200 border-l-4 border-red-600 pl-3 mb-6">Select Events</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {availableSports.map(sport => {
                                    const selected = selectedSports.includes(sport);
                                    return (
                                        <div
                                            key={sport}
                                            onClick={() => toggleSport(sport)}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all select-none ${
                                                selected
                                                    ? 'bg-red-50 dark:bg-zinc-800 border-red-500 dark:border-yellow-500'
                                                    : 'bg-white dark:bg-black border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-600'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={`text-sm font-bold capitalize ${selected ? 'text-red-700 dark:text-white' : 'text-slate-700 dark:text-zinc-300'}`}>{sport}</span>
                                                {selected && (
                                                    <span className="w-4 h-4 bg-red-600 dark:bg-yellow-500 rounded-full flex items-center justify-center">
                                                        <svg className="w-2.5 h-2.5 text-white dark:text-black" viewBox="0 0 10 10" fill="none">
                                                            <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-[10px] uppercase tracking-widest font-semibold ${selected ? 'text-red-500 dark:text-yellow-500' : 'text-slate-400 dark:text-zinc-500'}`}>
                                                {selected ? 'Included' : 'Click to add'}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: COURTS */}
                    {step === 3 && (
                        <div className="animate-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                            <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200 border-l-4 border-red-600 pl-3 mb-6">Configure Venues</h2>
                            <div className="space-y-3">
                                {selectedSports.map(sport => (
                                    <div key={sport} className="bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 p-4 rounded-xl flex items-center justify-between [box-shadow:0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-slate-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center text-base font-black text-slate-500 dark:text-zinc-500 capitalize">{sport[0].toUpperCase()}</div>
                                            <span className="font-bold text-slate-800 dark:text-white capitalize text-sm">{sport}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => updateCourts(sport, -1)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 font-bold text-sm transition-colors">−</button>
                                            <span className="font-mono font-black w-6 text-center text-red-600 dark:text-yellow-500 text-lg">{sportConfig[sport]?.courts || 1}</span>
                                            <button onClick={() => updateCourts(sport, 1)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 font-bold text-sm transition-colors">+</button>
                                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-widest ml-1">Courts</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="bg-white dark:bg-zinc-950 border-t border-slate-100 dark:border-zinc-800 px-6 py-4 flex justify-between items-center shrink-0">
                    <button
                        onClick={() => setStep(Math.max(1, step - 1))}
                        disabled={step === 1}
                        className="px-5 py-2.5 text-slate-400 dark:text-zinc-500 font-bold uppercase text-xs tracking-widest hover:text-slate-700 dark:hover:text-white transition-colors disabled:opacity-30"
                    >
                        Back
                    </button>
                    {step < 3 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={step === 1 && !name}
                            className="bg-slate-900 hover:bg-slate-700 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black px-8 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            Next Step
                        </button>
                    ) : (
                        <button
                            onClick={handleCreate}
                            disabled={isSubmitting}
                            className="bg-red-600 hover:bg-red-700 dark:bg-yellow-600 dark:hover:bg-yellow-500 text-white dark:text-black px-8 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Creating...' : 'Launch Tournament'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
