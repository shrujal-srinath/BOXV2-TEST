// src/pages/TournamentManager.tsx
// THE BOX — Admin Tournament Control Centre
// Includes: bracket editor, team name entry, PIN reveal, share/QR, scorer management

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import {
    subscribeToTournament,
    subscribeToFixtures,
    activateDivision,
    publishDivision,
    unpublishDivision,
    addTournamentSport,
    removeDivision,
    updateFixtureData,
    revokeScorer,
    updateTeamName,
    getAdminPin,
    handleRequest,
} from '../services/tournamentService';
import type {
    Tournament,
    TournamentFixture,
    DivisionConfig,
    GenderCategory,
    SchedulableSport,
    TournamentFormat,
} from '../types';

// ─────────────────────────────────────────────────────────────────
// SPORT METADATA
// ─────────────────────────────────────────────────────────────────
interface SportMeta { label: string; accentHex: string; icon: React.ReactNode }

const SPORTS_META: Record<string, SportMeta> = {
    basketball: {
        label: 'Basketball', accentHex: '#f59e0b',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><circle cx="12" cy="12" r="9" /><path d="M12 3c0 4.97 4.03 9 9 9M12 3c0 4.97-4.03 9-9 9M12 21c0-4.97 4.03-9 9-9M12 21c0-4.97-4.03-9-9-9" /><line x1="3" y1="12" x2="21" y2="12" /></svg>
    },
    badminton: {
        label: 'Badminton', accentHex: '#10b981',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><line x1="4" y1="20" x2="14" y2="10" strokeWidth="2" /><circle cx="16" cy="8" r="4" /><path d="M14 10l2-2" /></svg>
    },
    volleyball: {
        label: 'Volleyball', accentHex: '#3b82f6',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><circle cx="12" cy="12" r="9" /><path d="M12 3c3 3 3 6 0 9s-3 6 0 9" /><path d="M3.6 9h16.8M3.6 15h16.8" /></svg>
    },
    football: {
        label: 'Football', accentHex: '#22c55e',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><circle cx="12" cy="12" r="9" /><path d="M12 7l1.5 4.5H18M12 7l-1.5 4.5H6M8.5 17l1.5-5M15.5 17l-1.5-5M9 12h6" /></svg>
    },
    kabaddi: {
        label: 'Kabaddi', accentHex: '#f97316',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><circle cx="12" cy="7" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /><path d="M8 14l-3 4M16 14l3 4" /></svg>
    },
    tabletennis: {
        label: 'Table Tennis', accentHex: '#e11d48',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><circle cx="8" cy="12" r="5" /><line x1="12" y1="12" x2="20" y2="4" strokeWidth="2" /><circle cx="20" cy="4" r="2" /></svg>
    },
    cricket: {
        label: 'Cricket', accentHex: '#8b5cf6',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><line x1="5" y1="19" x2="19" y2="5" strokeWidth="2.5" /><line x1="17" y1="17" x2="20" y2="20" /><line x1="4" y1="20" x2="7" y2="20" /><line x1="4" y1="17" x2="4" y2="20" /></svg>
    },
    general: {
        label: 'General', accentHex: '#64748b',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" /></svg>
    },
};
const getSportMeta = (sport: string): SportMeta => SPORTS_META[sport] ?? SPORTS_META.general;

const GENDER_THEME: Record<GenderCategory, { label: string; accentHex: string; dimHex: string }> = {
    men: { label: "Men's", accentHex: '#f59e0b', dimHex: '#78350f' },
    women: { label: "Women's", accentHex: '#ec4899', dimHex: '#831843' },
    mixed: { label: 'Mixed', accentHex: '#a78bfa', dimHex: '#4c1d95' },
};

// ─────────────────────────────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────

const SportIconBadge: React.FC<{ meta: SportMeta; size?: 'sm' | 'md' | 'lg' }> = ({ meta, size = 'md' }) => {
    const dim = size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-10 h-10' : 'w-14 h-14';
    const inner = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-7 h-7';
    return (
        <div className={`${dim} rounded-xl flex items-center justify-center flex-shrink-0`}
            style={{ background: `${meta.accentHex}18`, border: `1px solid ${meta.accentHex}30` }}>
            <div className={inner} style={{ color: meta.accentHex }}>{meta.icon}</div>
        </div>
    );
};

const StatusPill: React.FC<{ status: DivisionConfig['status'] }> = ({ status }) => {
    const map: Record<string, { label: string; cls: string }> = {
        setup_required: { label: 'Setup Required', cls: 'text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-950' },
        draft: { label: 'Draft', cls: 'text-amber-600 dark:text-yellow-500 border-amber-200 dark:border-yellow-900/50 bg-amber-50 dark:bg-yellow-950/20' },
        published: { label: 'Live', cls: 'text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/50 bg-green-100 dark:bg-green-950/20' },
        completed: { label: 'Completed', cls: 'text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900' },
    };
    const s = map[status] ?? map.setup_required;
    return (
        <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${s.cls}`}>
            {status === 'published' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
            {s.label}
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────
// SPORT DIVISION CARD
// ─────────────────────────────────────────────────────────────────
const SportDivisionCard: React.FC<{
    division: DivisionConfig;
    isSelected: boolean;
    onClick: () => void;
    onDelete?: () => void;
}> = ({ division, isSelected, onClick, onDelete }) => {
    const meta = getSportMeta(division.sport);
    return (
        <div
            onClick={onClick}
            className={`relative group rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden min-h-[200px] flex flex-col ${isSelected ? '' : 'bg-white dark:bg-[#09090b] border-slate-200 dark:border-zinc-800 [box-shadow:0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none'}`}
            style={isSelected ? {
                background: `${meta.accentHex}10`,
                borderColor: meta.accentHex,
                boxShadow: `0 0 0 1px ${meta.accentHex}40, 0 8px 30px ${meta.accentHex}10`,
            } : undefined}
        >
            <div className="h-[2px]" style={{ background: isSelected ? meta.accentHex : 'transparent' }} />

            <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-4">
                    <SportIconBadge meta={meta} size="md" />
                    <StatusPill status={division.status} />
                </div>

                <div className="flex-1">
                    <div className="text-[9px] font-black uppercase tracking-[0.25em] mb-1" style={{ color: meta.accentHex }}>
                        {division.gender === 'men' ? "Men's" : division.gender === 'women' ? "Women's" : 'Mixed'}
                    </div>
                    <div className="text-xl font-black italic uppercase text-slate-900 dark:text-white leading-none">
                        {meta.label}
                    </div>
                    {division.bracketSize && (
                        <div className="text-[10px] text-zinc-600 font-bold mt-1 uppercase tracking-wider">
                            {division.bracketSize} Team Knockout
                        </div>
                    )}
                    {division.champion && (
                        <div className="mt-2 text-[10px] font-black uppercase tracking-wider" style={{ color: meta.accentHex }}>
                            Champion: {division.champion}
                        </div>
                    )}
                </div>

                {onDelete && (
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(); }}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-red-950/60 border border-red-900/40 flex items-center justify-center transition-all hover:bg-red-900/60"
                    >
                        <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
// SETUP MODAL
// ─────────────────────────────────────────────────────────────────
const SetupModal: React.FC<{
    divisionId: string; teamCount: number; bracketSize: number; byes: number;
    onTeamCountChange: (n: number) => void; onConfirm: () => void; onCancel: () => void;
}> = ({ divisionId, teamCount, bracketSize, byes, onTeamCountChange, onConfirm, onCancel }) => {
    const sport = divisionId.split('_').slice(0, -1).join('_');
    const meta = getSportMeta(sport);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 dark:bg-black/90 backdrop-blur-xl" onClick={onCancel} />
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-sm relative z-10 rounded-3xl [box-shadow:0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl overflow-hidden">
                <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${meta.accentHex}, transparent)` }} />
                <div className="p-7">
                    <div className="flex items-center gap-4 mb-7">
                        <SportIconBadge meta={meta} size="md" />
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-0.5">Initialize Division</div>
                            <h2 className="text-lg font-black italic uppercase text-slate-900 dark:text-white leading-none">{meta.label}</h2>
                        </div>
                    </div>

                    <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest text-center mb-4">Number of Teams</div>
                    <div className="flex items-center justify-center gap-5 mb-7">
                        <button onClick={() => onTeamCountChange(Math.max(2, teamCount - 1))}
                            className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xl font-black text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all active:scale-95">−</button>
                        <div className="text-center w-16">
                            <div className="text-5xl font-black text-slate-900 dark:text-white">{teamCount}</div>
                            <div className="text-[9px] text-slate-400 dark:text-zinc-600 font-bold uppercase tracking-widest mt-0.5">teams</div>
                        </div>
                        <button onClick={() => onTeamCountChange(Math.min(64, teamCount + 1))}
                            className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xl font-black text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all active:scale-95">+</button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-7">
                        {[{ v: bracketSize, l: 'Bracket' }, { v: Math.log2(bracketSize) | 0, l: 'Rounds' }, { v: byes, l: 'Byes' }].map(({ v, l }) => (
                            <div key={l} className="bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl p-3 text-center">
                                <div className="text-2xl font-black text-slate-900 dark:text-white">{v}</div>
                                <div className="text-[9px] text-slate-400 dark:text-zinc-600 font-bold uppercase tracking-wider mt-0.5">{l}</div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 dark:hover:text-white transition-all">Cancel</button>
                        <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-[0.98]"
                            style={{ background: meta.accentHex, color: '#000' }}>Generate</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
// ADD SPORT MODAL
// ─────────────────────────────────────────────────────────────────
const AddSportModal: React.FC<{
    addableSports: SchedulableSport[];
    onAddSport: (sport: SchedulableSport) => void;
    onClose: () => void;
}> = ({ addableSports, onAddSport, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 dark:bg-black/90 backdrop-blur-xl" onClick={onClose} />
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-sm relative z-10 rounded-3xl [box-shadow:0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl p-7">
            <h3 className="text-sm font-black italic uppercase text-slate-900 dark:text-white mb-5">Add Sport Division</h3>
            {addableSports.length === 0 ? (
                <div className="text-slate-400 dark:text-zinc-600 text-xs font-bold uppercase tracking-widest text-center py-6">All sports added</div>
            ) : (
                <div className="space-y-2">
                    {addableSports.map(sport => {
                        const meta = getSportMeta(sport);
                        return (
                            <button key={sport} onClick={() => { onAddSport(sport); onClose(); }}
                                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-700 transition-all group">
                                <SportIconBadge meta={meta} size="sm" />
                                <span className="font-black uppercase text-xs tracking-wide text-slate-600 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{meta.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
            <button onClick={onClose} className="w-full mt-4 py-3 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 dark:hover:text-white transition-all">Close</button>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────
// PIN REVEAL MODAL
// ─────────────────────────────────────────────────────────────────
const PinRevealModal: React.FC<{ tournamentId: string; onClose: () => void }> = ({ tournamentId, onClose }) => {
    const [pin, setPin] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        getAdminPin(tournamentId).then(p => { setPin(p); setLoading(false); });
    }, [tournamentId]);

    const handleCopy = () => {
        if (pin) {
            navigator.clipboard.writeText(pin);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 dark:bg-black/90 backdrop-blur-xl" onClick={onClose} />
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-xs relative z-10 rounded-3xl [box-shadow:0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl overflow-hidden">
                <div className="h-[2px] bg-gradient-to-r from-yellow-500 to-transparent" />
                <div className="p-7 text-center">
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-zinc-500 mb-1">Scorer Access</div>
                    <div className="text-sm font-black italic uppercase text-slate-900 dark:text-white mb-6">PIN Code</div>
                    {loading ? (
                        <div className="h-16 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full border-2 border-slate-200 dark:border-zinc-800 border-t-yellow-500 animate-spin" />
                        </div>
                    ) : pin ? (
                        <>
                            <div className="flex items-center justify-center gap-2 mb-6">
                                {pin.split('').map((digit, i) => (
                                    <div key={i} className="w-14 h-16 rounded-xl bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-700 flex items-center justify-center">
                                        <span className="text-4xl font-black text-amber-600 dark:text-yellow-400 tabular-nums">{digit}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-zinc-600 font-bold uppercase tracking-widest mb-5">
                                Share with your scorers only
                            </div>
                            <button onClick={handleCopy}
                                className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${copied ? 'bg-green-600 text-white' : 'bg-red-600 dark:bg-yellow-500 text-white dark:text-black hover:bg-red-700 dark:hover:bg-yellow-400'}`}>
                                {copied ? 'Copied!' : 'Copy PIN'}
                            </button>
                        </>
                    ) : (
                        <div className="text-red-500 dark:text-red-400 text-xs font-bold uppercase tracking-widest py-4">
                            Could not fetch PIN.<br />
                            <span className="text-slate-400 dark:text-zinc-600">Check Supabase RLS policy.</span>
                        </div>
                    )}
                    <button onClick={onClose} className="w-full mt-3 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 dark:hover:text-white transition-all">Close</button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
// SHARE MODAL (URL + QR)
// ─────────────────────────────────────────────────────────────────
const ShareModal: React.FC<{ tournamentId: string; tournamentName: string; onClose: () => void }> = ({ tournamentId, tournamentName, onClose }) => {
    const url = `${window.location.origin}/t/${tournamentId}`;
    const [copied, setCopied] = useState(false);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&bgcolor=09090b&color=facc15&data=${encodeURIComponent(url)}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 dark:bg-black/90 backdrop-blur-xl" onClick={onClose} />
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-sm relative z-10 rounded-3xl [box-shadow:0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl overflow-hidden">
                <div className="h-[2px] bg-gradient-to-r from-yellow-500 to-transparent" />
                <div className="p-7 text-center">
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-zinc-500 mb-1">Spectator Link</div>
                    <div className="text-sm font-black italic uppercase text-slate-900 dark:text-white mb-5">{tournamentName}</div>

                    {/* QR Code */}
                    <div className="w-[180px] h-[180px] mx-auto rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 mb-5 bg-[#09090b] flex items-center justify-center">
                        <img
                            src={qrUrl}
                            alt="Tournament QR Code"
                            className="w-full h-full"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    </div>

                    <div className="text-[10px] text-slate-400 dark:text-zinc-600 font-mono mb-4 break-all">{url}</div>

                    <div className="flex gap-2">
                        <button onClick={handleCopy}
                            className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${copied ? 'bg-green-600 text-white' : 'bg-red-600 dark:bg-yellow-500 text-white dark:text-black hover:bg-red-700 dark:hover:bg-yellow-400'}`}>
                            {copied ? 'Copied!' : 'Copy Link'}
                        </button>
                        <button onClick={onClose}
                            className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 dark:hover:text-white transition-all">
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
// SCHEDULE MANAGER (inline modal for time/court editing)
// ─────────────────────────────────────────────────────────────────
const ScheduleManager: React.FC<{
    fixtures: TournamentFixture[];
    tournamentId: string;
    onClose: () => void;
}> = ({ fixtures, tournamentId, onClose }) => {
    const [startTime, setStartTime] = useState('09:00');
    const [interval, setInterval] = useState(45);
    const [saving, setSaving] = useState(false);

    const schedulable = fixtures.filter(f => !f.isBye && f.status === 'scheduled');

    const handleQuickSchedule = async () => {
        setSaving(true);
        let current = new Date(`2000-01-01T${startTime}:00`);
        for (const f of schedulable) {
            const h = current.getHours().toString().padStart(2, '0');
            const m = current.getMinutes().toString().padStart(2, '0');
            const suffix = current.getHours() < 12 ? 'AM' : 'PM';
            const h12 = (current.getHours() % 12 || 12).toString();
            const timeStr = `${h12}:${m} ${suffix}`;
            await updateFixtureData(tournamentId, f.id, { time: timeStr });
            current = new Date(current.getTime() + interval * 60 * 1000);
        }
        setSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 dark:bg-black/90 backdrop-blur-xl" onClick={onClose} />
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-sm relative z-10 rounded-3xl [box-shadow:0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl p-7">
                <div className="text-sm font-black italic uppercase text-slate-900 dark:text-white mb-1">Quick Schedule</div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest mb-6">Auto-fill times for {schedulable.length} matches</div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-[9px] font-black text-slate-500 dark:text-zinc-500 uppercase tracking-widest block mb-2">Start Time</label>
                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl p-3 text-slate-900 dark:text-white font-mono font-bold text-sm outline-none focus:border-violet-500 dark:focus:border-yellow-600 transition-colors" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-slate-500 dark:text-zinc-500 uppercase tracking-widest block mb-2">Interval per Match (minutes)</label>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setInterval(Math.max(10, interval - 5))} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-white font-black hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">−</button>
                            <div className="flex-1 text-center font-black text-2xl text-slate-900 dark:text-white">{interval}</div>
                            <button onClick={() => setInterval(Math.min(180, interval + 5))} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-white font-black hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">+</button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 dark:hover:text-white transition-all">Cancel</button>
                    <button onClick={handleQuickSchedule} disabled={saving || schedulable.length === 0}
                        className="flex-1 py-3 rounded-xl bg-red-600 dark:bg-yellow-500 text-white dark:text-black font-black uppercase text-[10px] tracking-widest hover:bg-red-700 dark:hover:bg-yellow-400 transition-all disabled:opacity-50">
                        {saving ? 'Saving...' : 'Apply'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
// BRACKET VIEW
// ─────────────────────────────────────────────────────────────────
const BracketView: React.FC<{
    fixtures: TournamentFixture[];
    isEditMode: boolean;
    tournamentId: string;
    division: DivisionConfig;
    isAdmin: boolean;
}> = ({ fixtures, isEditMode, tournamentId, division, isAdmin }) => {
    const meta = getSportMeta(division.sport);
    const [editingNames, setEditingNames] = useState<Record<string, string>>({});
    const [savingId, setSavingId] = useState<string | null>(null);

    const rounds = useMemo(() => {
        const map: Record<number, TournamentFixture[]> = {};
        fixtures.forEach(f => {
            const r = f.round ?? 1;
            if (!map[r]) map[r] = [];
            map[r].push(f);
        });
        return Object.entries(map)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([round, matches]) => ({ round: Number(round), matches: matches.sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0)) }));
    }, [fixtures]);

    const totalRounds = rounds.length;
    const getRoundLabel = (r: number) => {
        if (r === totalRounds) return 'Final';
        if (r === totalRounds - 1) return 'Semi-Final';
        if (r === totalRounds - 2) return 'Quarter-Final';
        return `Round ${r}`;
    };

    const handleNameChange = (fixtureId: string, side: 'A' | 'B', value: string) => {
        setEditingNames(prev => ({ ...prev, [`${fixtureId}_${side}`]: value }));
    };

    const handleNameSave = async (fixture: TournamentFixture, side: 'A' | 'B') => {
        const key = `${fixture.id}_${side}`;
        const raw = editingNames[key];
        const name = raw?.trim();
        // Reject empty or unchanged values — revert the input to its previous value
        if (!name || name === (side === 'A' ? fixture.teamA : fixture.teamB)) {
            setEditingNames(prev => { const n = { ...prev }; delete n[key]; return n; });
            return;
        }
        setSavingId(key);
        await updateTeamName(tournamentId, fixture.id, side, name);
        setSavingId(null);
    };

    return (
        <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
                {rounds.map(({ round, matches }) => (
                    <div key={round} className="flex flex-col gap-3" style={{ width: 200 }}>
                        {/* Round header */}
                        <div className="text-center mb-1">
                            <div className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: meta.accentHex }}>
                                {getRoundLabel(round)}
                            </div>
                            <div className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mt-0.5">
                                {matches.filter(m => !m.isBye).length} match{matches.filter(m => !m.isBye).length !== 1 ? 'es' : ''}
                            </div>
                        </div>

                        {/* Fixtures */}
                        {matches.map(fixture => {
                            if (fixture.isBye) return (
                                <div key={fixture.id} className="h-20 rounded-xl border border-zinc-900/50 bg-zinc-950/30 flex items-center justify-center">
                                    <span className="text-[9px] font-black text-zinc-800 uppercase tracking-widest">Bye</span>
                                </div>
                            );

                            const isCompleted = fixture.status === 'completed';
                            const isLive = fixture.status === 'live';
                            const editableA = isEditMode && isAdmin && round === 1 && division.status === 'draft';
                            const editableB = isEditMode && isAdmin && round === 1 && division.status === 'draft' && fixture.teamB !== 'BYE';
                            const keyA = `${fixture.id}_A`;
                            const keyB = `${fixture.id}_B`;

                            return (
                                <div key={fixture.id}
                                    className="rounded-xl border overflow-hidden transition-all duration-200"
                                    style={{
                                        borderColor: isLive ? `${meta.accentHex}60` : isCompleted ? '#27272a' : '#3f3f46',
                                        background: isLive ? `${meta.accentHex}08` : '#09090b',
                                        opacity: isCompleted ? 0.7 : 1,
                                    }}>
                                    <div className="h-[2px]" style={{ background: isLive ? meta.accentHex : isCompleted ? '#27272a' : '#3f3f46' }} />

                                    {/* Team A */}
                                    <div className={`flex items-center justify-between px-3 py-2 border-b border-zinc-900 ${isCompleted && fixture.winnerSide === 'A' ? 'bg-white/5' : ''}`}>
                                        {editableA ? (
                                            <input
                                                className="flex-1 bg-transparent text-white text-xs font-black uppercase outline-none border-b border-yellow-600/50 focus:border-yellow-500 pr-1"
                                                placeholder="Team name"
                                                defaultValue={fixture.teamA !== 'TBD' ? fixture.teamA : ''}
                                                onBlur={e => { handleNameChange(fixture.id, 'A', e.target.value); handleNameSave(fixture, 'A'); }}
                                                onKeyDown={e => { if (e.key === 'Enter') { handleNameChange(fixture.id, 'A', (e.target as HTMLInputElement).value); handleNameSave(fixture, 'A'); } }}
                                            />
                                        ) : (
                                            <span className={`text-xs font-black uppercase truncate ${fixture.teamA === 'TBD' ? 'text-zinc-700 italic font-normal' : isCompleted && fixture.winnerSide === 'A' ? 'text-white' : 'text-zinc-300'}`}>
                                                {fixture.teamA}
                                            </span>
                                        )}
                                        {isCompleted && (
                                            <span className={`text-xs font-black tabular-nums ml-2 ${fixture.winnerSide === 'A' ? 'text-white' : 'text-zinc-600'}`}>
                                                {fixture.finalScore?.teamA ?? 0}
                                            </span>
                                        )}
                                        {savingId === keyA && <span className="w-2 h-2 rounded-full border border-yellow-500 border-t-transparent animate-spin ml-1" />}
                                    </div>

                                    {/* Team B */}
                                    <div className={`flex items-center justify-between px-3 py-2 ${isCompleted && fixture.winnerSide === 'B' ? 'bg-white/5' : ''}`}>
                                        {editableB ? (
                                            <input
                                                className="flex-1 bg-transparent text-white text-xs font-black uppercase outline-none border-b border-yellow-600/50 focus:border-yellow-500 pr-1"
                                                placeholder="Team name"
                                                defaultValue={fixture.teamB !== 'TBD' && fixture.teamB !== 'BYE' ? fixture.teamB : ''}
                                                onBlur={e => { handleNameChange(fixture.id, 'B', e.target.value); handleNameSave(fixture, 'B'); }}
                                                onKeyDown={e => { if (e.key === 'Enter') { handleNameChange(fixture.id, 'B', (e.target as HTMLInputElement).value); handleNameSave(fixture, 'B'); } }}
                                            />
                                        ) : (
                                            <span className={`text-xs font-black uppercase truncate ${fixture.teamB === 'TBD' || fixture.teamB === 'BYE' ? 'text-zinc-700 italic font-normal' : isCompleted && fixture.winnerSide === 'B' ? 'text-white' : 'text-zinc-300'}`}>
                                                {fixture.teamB}
                                            </span>
                                        )}
                                        {isCompleted && (
                                            <span className={`text-xs font-black tabular-nums ml-2 ${fixture.winnerSide === 'B' ? 'text-white' : 'text-zinc-600'}`}>
                                                {fixture.finalScore?.teamB ?? 0}
                                            </span>
                                        )}
                                        {savingId === keyB && <span className="w-2 h-2 rounded-full border border-yellow-500 border-t-transparent animate-spin ml-1" />}
                                    </div>

                                    {/* Status / Court */}
                                    {(fixture.court !== 'Unassigned' || fixture.time !== 'Pending' || isLive) && (
                                        <div className="px-3 py-1.5 flex items-center gap-1.5">
                                            {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                                            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
                                                {isLive ? 'Live' : fixture.time !== 'Pending' ? fixture.time : ''}{fixture.court !== 'Unassigned' ? ` · ${fixture.court}` : ''}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
// CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────
const ConfirmModal: React.FC<{
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 dark:bg-black/90 backdrop-blur-xl" onClick={onCancel} />
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-sm relative z-10 rounded-3xl [box-shadow:0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl overflow-hidden">
            <div className={`h-[2px] ${danger ? 'bg-gradient-to-r from-red-500 to-transparent' : 'bg-gradient-to-r from-yellow-500 to-transparent'}`} />
            <div className="p-7">
                <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-zinc-500 mb-1">Confirm Action</div>
                <h2 className="text-sm font-black italic uppercase text-slate-900 dark:text-white mb-3">{title}</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-7 leading-relaxed">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel}
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 dark:hover:text-white transition-all">
                        Cancel
                    </button>
                    <button onClick={onConfirm}
                        className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-[0.98] ${danger ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-600 dark:bg-yellow-500 hover:bg-red-700 dark:hover:bg-yellow-400 text-white dark:text-black'}`}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export const TournamentManager: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [activeGender, setActiveGender] = useState<GenderCategory>('men');
    const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
    const [divisionFixtures, setDivisionFixtures] = useState<TournamentFixture[]>([]);
    const [setupDivId, setSetupDivId] = useState<string | null>(null);
    const [customTeamCount, setCustomTeamCount] = useState(8);
    const [showAddSportModal, setShowAddSportModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showScheduler, setShowScheduler] = useState(false);
    const [activeTab, setActiveTab] = useState<'bracket' | 'staff'>('bracket');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{
        title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
    } | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
    }, []);

    useEffect(() => {
        if (!id) return;
        return subscribeToTournament(id, setTournament);
    }, [id]);

    useEffect(() => {
        if (!id || !selectedDivisionId) return;
        setIsEditMode(false);
        return subscribeToFixtures(id, selectedDivisionId, setDivisionFixtures);
    }, [id, selectedDivisionId]);

    const handleActivate = async () => {
        if (!id || !setupDivId) return;
        await activateDivision(id, setupDivId, { format: 'knockout', bracketSize: customTeamCount });
        setSetupDivId(null);
        setSelectedDivisionId(setupDivId);
    };

    const handlePublish = () => {
        if (!id || !selectedDivisionId) return;
        setConfirmAction({
            title: 'Publish Bracket',
            message: 'Scorers will be able to start matches once published. The bracket structure will be locked.',
            confirmLabel: 'Publish',
            onConfirm: async () => {
                setConfirmAction(null);
                await publishDivision(id, selectedDivisionId);
            },
        });
    };

    const handleUnpublish = () => {
        if (!id || !selectedDivisionId) return;
        setConfirmAction({
            title: 'Unpublish Bracket',
            message: 'This will hide the bracket from scorers. No data will be deleted.',
            confirmLabel: 'Unpublish',
            danger: true,
            onConfirm: async () => {
                setConfirmAction(null);
                await unpublishDivision(id, selectedDivisionId);
            },
        });
    };

    const handleAddSport = async (sport: SchedulableSport) => {
        if (!id) return;
        await addTournamentSport(id, sport as any);
    };

    const handleRemoveDivision = (divId: string) => {
        if (!id) return;
        setConfirmAction({
            title: 'Delete Division',
            message: 'This will permanently delete the division and all its fixture data. This cannot be undone.',
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: async () => {
                setConfirmAction(null);
                await removeDivision(id, divId);
                if (selectedDivisionId === divId) setSelectedDivisionId(null);
            },
        });
    };

    const handleRevokeScorer = (userId: string) => {
        if (!id) return;
        setConfirmAction({
            title: 'Remove Scorer',
            message: 'This scorer will lose access to start matches for this tournament.',
            confirmLabel: 'Remove',
            danger: true,
            onConfirm: async () => {
                setConfirmAction(null);
                setRevokingId(userId);
                await revokeScorer(id, userId);
                setRevokingId(null);
            },
        });
    };

    if (!tournament) return (
        <div className="min-h-screen bg-[#F0EEE9] dark:bg-black flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-slate-200 dark:border-zinc-900 border-t-red-600 dark:border-t-yellow-500 animate-spin" />
        </div>
    );

    const isAdmin = currentUserId === tournament.adminId;
    const divisionsList = tournament.divisions ? Object.values(tournament.divisions) : [];
    const filteredDivisions = divisionsList.filter(d => d.gender === activeGender);
    const currentDivision = selectedDivisionId && tournament.divisions ? tournament.divisions[selectedDivisionId] : null;
    const availableSports: SchedulableSport[] = ['basketball', 'badminton', 'volleyball', 'kabaddi', 'football', 'cricket', 'tabletennis', 'general'];
    const existingSports = new Set(divisionsList.map(d => d.sport));
    const addableSports = availableSports.filter(s => !existingSports.has(s as any));
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, customTeamCount))));
    const byes = bracketSize - customTeamCount;
    const pendingRequests = Object.entries(tournament.pendingRequests || {}).filter(([, req]) => req.status === 'pending');
    const approvedScorers = Array.isArray(tournament.approvedScorers) ? tournament.approvedScorers : [];
    // Scorers = approved minus admin
    const scorerList = approvedScorers.filter(uid => uid !== tournament.adminId);
    const scorerUserData = tournament.pendingRequests || {};
    const theme = GENDER_THEME[activeGender];
    const liveCount = divisionsList.filter(d => d.status === 'published').length;

    return (
        <div className="min-h-screen bg-[#F0EEE9] dark:bg-black text-slate-900 dark:text-white relative">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/4 w-[600px] h-[300px] rounded-full dark:opacity-[0.03] opacity-0"
                    style={{ background: `radial-gradient(circle, ${theme.accentHex} 0%, transparent 70%)` }} />
            </div>

            {/* ── HEADER ────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-xl [box-shadow:0_1px_0_rgba(0,0,0,0.08)] dark:border-b dark:border-zinc-900">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
                    {/* Left */}
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={() => navigate('/tournament')} className="text-slate-400 dark:text-zinc-600 hover:text-slate-900 dark:hover:text-white transition-colors flex-shrink-0">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="min-w-0">
                            <div className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-zinc-600 mb-0.5 flex items-center gap-2">
                                <span className="font-mono">{tournament.id}</span>
                                {liveCount > 0 && (
                                    <span className="flex items-center gap-1 text-green-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                        {liveCount} Live
                                    </span>
                                )}
                            </div>
                            <h1 className="text-lg font-black italic uppercase text-slate-900 dark:text-white leading-none truncate">{tournament.name}</h1>
                        </div>
                    </div>

                    {/* Right — admin actions */}
                    {isAdmin && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Wall view — opens in new tab for a live game code */}
                            {divisionFixtures.some(f => f.status === 'live' && f.gameCode) && (
                                <button
                                    onClick={() => {
                                        const live = divisionFixtures.find(f => f.status === 'live' && f.gameCode);
                                        if (live?.gameCode) window.open(`/t/${id}/wall/${live.gameCode}`, '_blank');
                                    }}
                                    className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-green-700/50 flex items-center justify-center transition-all group"
                                    title="Open Wall Scoreboard">
                                    <svg className="w-4 h-4 text-zinc-500 group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                </button>
                            )}
                            {/* PIN reveal */}
                            <button onClick={() => setShowPinModal(true)}
                                className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-yellow-700/50 flex items-center justify-center transition-all group"
                                title="Reveal Scorer PIN">
                                <svg className="w-4 h-4 text-zinc-500 group-hover:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            {/* Share */}
                            <button onClick={() => setShowShareModal(true)}
                                className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-yellow-700/50 flex items-center justify-center transition-all group"
                                title="Share Tournament">
                                <svg className="w-4 h-4 text-zinc-500 group-hover:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            </button>
                            {/* Tabs */}
                            <div className="flex bg-zinc-900 rounded-xl border border-zinc-800 p-0.5">
                                <button onClick={() => setActiveTab('bracket')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'bracket' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                    Bracket
                                </button>
                                <button onClick={() => setActiveTab('staff')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'staff' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                    Staff
                                    {pendingRequests.length > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">{pendingRequests.length}</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* ── MAIN ──────────────────────────────────────────────────── */}
            <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 relative z-10">

                {/* ═══ BRACKET TAB ══════════════════════════════════════ */}
                {(!isAdmin || activeTab === 'bracket') && (
                    <>
                        {/* Gender tabs */}
                        <div className="flex items-center gap-1 mb-8 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-2xl p-1 w-fit">
                            {(['men', 'women', 'mixed'] as GenderCategory[]).map(g => {
                                const t = GENDER_THEME[g];
                                const divCount = divisionsList.filter(d => d.gender === g).length;
                                if (!isAdmin && divCount === 0) return null;
                                return (
                                    <button key={g} onClick={() => { setActiveGender(g); setSelectedDivisionId(null); }}
                                        className={`px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${activeGender === g ? 'text-black' : 'text-slate-500 dark:text-zinc-600 hover:text-slate-800 dark:hover:text-zinc-300'}`}
                                        style={activeGender === g ? { background: t.accentHex } : {}}>
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Division grid */}
                        {filteredDivisions.length === 0 && !isAdmin ? (
                            <div className="text-center py-20 text-zinc-700 font-bold text-xs uppercase tracking-widest">No divisions in this category</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-8">
                                {filteredDivisions.map(div => (
                                    <SportDivisionCard
                                        key={div.id}
                                        division={div}
                                        isSelected={selectedDivisionId === div.id}
                                        onClick={() => div.status === 'setup_required' && isAdmin ? setSetupDivId(div.id) : setSelectedDivisionId(div.id)}
                                        onDelete={isAdmin && div.status === 'setup_required' ? () => handleRemoveDivision(div.id) : undefined}
                                    />
                                ))}
                                {isAdmin && (
                                    <button onClick={() => setShowAddSportModal(true)}
                                        className="group rounded-2xl border-2 border-dashed border-slate-300 dark:border-zinc-900 hover:border-red-400 dark:hover:border-zinc-700 bg-white dark:bg-transparent hover:bg-red-50 dark:hover:bg-zinc-950/60 transition-all duration-300 flex flex-col items-center justify-center gap-3 min-h-[200px]">
                                        <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-zinc-900 group-hover:bg-red-100 dark:group-hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 flex items-center justify-center transition-all">
                                            <svg className="w-5 h-5 text-slate-400 dark:text-zinc-600 group-hover:text-red-600 dark:group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                                        </div>
                                        <span className="text-xs font-black italic uppercase text-slate-400 dark:text-zinc-600 group-hover:text-red-600 dark:group-hover:text-white transition-colors">Add Sport</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ── BRACKET PANEL ─────────────────────────────────── */}
                        {currentDivision && (
                            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden [box-shadow:0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none">
                                {/* Panel header */}
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-900 flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <SportIconBadge meta={getSportMeta(currentDivision.sport)} size="sm" />
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-500">
                                                {currentDivision.gender === 'men' ? "Men's" : currentDivision.gender === 'women' ? "Women's" : 'Mixed'} Division
                                            </div>
                                            <div className="text-sm font-black italic uppercase text-slate-900 dark:text-white leading-none">
                                                {getSportMeta(currentDivision.sport).label}
                                            </div>
                                        </div>
                                        <StatusPill status={currentDivision.status} />
                                        {currentDivision.champion && (
                                            <div className="text-[10px] font-black uppercase tracking-widest text-yellow-500">
                                                Champion: {currentDivision.champion}
                                            </div>
                                        )}
                                    </div>

                                    {isAdmin && (
                                        <div className="flex items-center gap-2">
                                            {/* Edit teams toggle (only draft + round 1 has TBDs) */}
                                            {currentDivision.status === 'draft' && (
                                                <>
                                                    <button
                                                        onClick={() => setIsEditMode(!isEditMode)}
                                                        className={`px-3 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border ${isEditMode ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'}`}>
                                                        {isEditMode ? 'Done Editing' : 'Edit Teams'}
                                                    </button>
                                                    <button onClick={() => setShowScheduler(true)}
                                                        className="px-3 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white hover:border-zinc-700">
                                                        Schedule
                                                    </button>
                                                    <button onClick={handlePublish}
                                                        className="px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all bg-green-600 hover:bg-green-500 text-white">
                                                        Publish
                                                    </button>
                                                </>
                                            )}
                                            {currentDivision.status === 'published' && (
                                                <>
                                                    <button onClick={() => setShowScheduler(true)}
                                                        className="px-3 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white hover:border-zinc-700">
                                                        Schedule
                                                    </button>
                                                    <button onClick={handleUnpublish}
                                                        className="px-3 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all bg-zinc-900 text-red-400 border border-zinc-800 hover:border-red-900/50">
                                                        Unpublish
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Status guidance banner */}
                                {currentDivision.status === 'setup_required' && isAdmin && (
                                    <div className="px-6 py-3 bg-zinc-900/60 border-b border-zinc-800 flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Click the division card above to set team count and generate fixtures.</span>
                                    </div>
                                )}
                                {currentDivision.status === 'draft' && !isEditMode && (
                                    <div className="px-6 py-3 bg-yellow-950/20 border-b border-yellow-900/30 flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest">Draft — Enter team names via Edit Teams, then Publish to let scorers start matches.</span>
                                    </div>
                                )}
                                {currentDivision.status === 'published' && (
                                    <div className="px-6 py-3 bg-green-950/20 border-b border-green-900/30 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                                        <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Live — Scorers can now start matches from the volunteer console.</span>
                                    </div>
                                )}
                                {currentDivision.status === 'completed' && currentDivision.champion && (
                                    <div className="px-6 py-3 bg-yellow-950/20 border-b border-yellow-900/30 flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h14M5 3a2 2 0 00-2 2v3a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2M5 3l2 8M19 3l-2 8m-5 0v8m0 0H9m3 0h3" /></svg>
                                        <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Champion: {currentDivision.champion}</span>
                                    </div>
                                )}
                                {/* Edit mode hint */}
                                {isEditMode && (
                                    <div className="px-6 py-3 bg-yellow-950/20 border-b border-yellow-900/30">
                                        <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">
                                            Team Name Edit Mode — Click any Round 1 slot and type the team name. Press Enter or click away to save.
                                        </div>
                                    </div>
                                )}

                                {/* Bracket */}
                                <div className="p-6">
                                    {divisionFixtures.length === 0 ? (
                                        <div className="text-center py-8 text-zinc-700 font-bold text-xs uppercase tracking-widest">
                                            No fixtures generated yet
                                        </div>
                                    ) : (
                                        <BracketView
                                            fixtures={divisionFixtures}
                                            isEditMode={isEditMode}
                                            tournamentId={id!}
                                            division={currentDivision}
                                            isAdmin={isAdmin}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ═══ STAFF TAB ════════════════════════════════════════ */}
                {isAdmin && activeTab === 'staff' && (
                    <div className="max-w-2xl space-y-8">
                        {/* Pending requests */}
                        <div>
                            <div className="text-base font-bold text-slate-800 dark:text-zinc-200 border-l-4 border-red-600 pl-3 mb-4">
                                Pending Requests ({pendingRequests.length})
                            </div>
                            {pendingRequests.length === 0 ? (
                                <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-2xl p-6 text-center text-slate-400 dark:text-zinc-700 text-xs font-bold uppercase tracking-widest">
                                    No pending requests
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingRequests.map(([uid, req]) => (
                                        <div key={uid} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-4 [box-shadow:0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none">
                                            <div className="min-w-0">
                                                <div className="font-black text-slate-900 dark:text-white text-sm truncate">{req.displayName || 'Unknown'}</div>
                                                <div className="text-[10px] text-slate-500 dark:text-zinc-500 truncate">{req.email}</div>
                                            </div>
                                            <div className="flex gap-2 flex-shrink-0">
                                                <button onClick={() => id && handleRequest(id, uid, 'reject')}
                                                    className="px-3 py-1.5 rounded-lg border border-red-900/40 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-950/20 transition-all">
                                                    Reject
                                                </button>
                                                <button onClick={() => id && handleRequest(id, uid, 'approve')}
                                                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-green-500 transition-all">
                                                    Approve
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Active scorers */}
                        <div>
                            <div className="text-base font-bold text-slate-800 dark:text-zinc-200 border-l-4 border-red-600 pl-3 mb-4">
                                Active Scorers ({scorerList.length})
                            </div>
                            {scorerList.length === 0 ? (
                                <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-2xl p-6 text-center text-slate-400 dark:text-zinc-700 text-xs font-bold uppercase tracking-widest">
                                    No scorers added yet — share the PIN to invite them
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {scorerList.map(uid => {
                                        const userData = scorerUserData[uid];
                                        return (
                                            <div key={uid} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-4 [box-shadow:0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none">
                                                <div className="min-w-0 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-xs font-black text-slate-500 dark:text-zinc-400">
                                                        {userData?.displayName?.[0] ?? '?'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-black text-slate-900 dark:text-white text-sm truncate">{userData?.displayName || 'Scorer'}</div>
                                                        <div className="text-[10px] text-slate-400 dark:text-zinc-600 font-mono truncate">{uid.slice(0, 12)}...</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRevokeScorer(uid)}
                                                    disabled={revokingId === uid}
                                                    className="px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:border-red-900/40 hover:text-red-400 transition-all disabled:opacity-40">
                                                    {revokingId === uid ? '...' : 'Revoke'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* PIN shortcut */}
                        <button onClick={() => setShowPinModal(true)}
                            className="flex items-center gap-3 w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-yellow-700/40 rounded-2xl p-4 transition-all group text-left [box-shadow:0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none">
                            <div className="w-10 h-10 rounded-xl bg-yellow-950/30 border border-yellow-900/30 flex items-center justify-center group-hover:bg-yellow-950/50 transition-all">
                                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </div>
                            <div>
                                <div className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wide">Reveal Scorer PIN</div>
                                <div className="text-[10px] text-slate-400 dark:text-zinc-600 font-bold uppercase tracking-widest mt-0.5">Share with scorers to grant access</div>
                            </div>
                        </button>
                    </div>
                )}
            </main>

            {/* ── MODALS ───────────────────────────────────────────────── */}
            {setupDivId && (
                <SetupModal
                    divisionId={setupDivId} teamCount={customTeamCount}
                    bracketSize={bracketSize} byes={byes}
                    onTeamCountChange={setCustomTeamCount}
                    onConfirm={handleActivate} onCancel={() => setSetupDivId(null)}
                />
            )}
            {showAddSportModal && (
                <AddSportModal
                    addableSports={addableSports}
                    onAddSport={handleAddSport}
                    onClose={() => setShowAddSportModal(false)}
                />
            )}
            {showPinModal && id && (
                <PinRevealModal tournamentId={id} onClose={() => setShowPinModal(false)} />
            )}
            {showShareModal && id && (
                <ShareModal tournamentId={id} tournamentName={tournament.name} onClose={() => setShowShareModal(false)} />
            )}
            {showScheduler && id && (
                <ScheduleManager
                    fixtures={divisionFixtures}
                    tournamentId={id}
                    onClose={() => setShowScheduler(false)}
                />
            )}
            {confirmAction && (
                <ConfirmModal
                    title={confirmAction.title}
                    message={confirmAction.message}
                    confirmLabel={confirmAction.confirmLabel}
                    danger={confirmAction.danger}
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
        </div>
    );
};