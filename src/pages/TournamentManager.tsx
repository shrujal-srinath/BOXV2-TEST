// src/pages/TournamentManager.tsx
// THE ARENA — Sport Division Hub
// Refined: monochrome cards, hybrid sport images, dramatic gender transition

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
import type { Tournament, TournamentFixture, GenderCategory, SportType, DivisionConfig } from '../types';

// ─────────────────────────────────────────────────────────────────
// GENDER THEMES — drives the dramatic page-wide transition
// ─────────────────────────────────────────────────────────────────
const GENDER_THEME = {
    men: {
        label: "Men's",
        overline: "MEN'S SPORTS",
        accentHex: '#f59e0b',
        glowStyle: 'radial-gradient(ellipse 80% 45% at 50% -8%, rgba(245,158,11,0.14) 0%, transparent 70%)',
        sweepStyle: 'radial-gradient(ellipse 120% 30% at 0% 50%, rgba(245,158,11,0.07) 0%, transparent 60%)',
        tabActive: 'bg-amber-500 text-black shadow-lg shadow-amber-900/40',
        lineFrom: 'from-amber-500',
        dotClass: 'bg-amber-400',
    },
    women: {
        label: "Women's",
        overline: "WOMEN'S SPORTS",
        accentHex: '#f43f5e',
        glowStyle: 'radial-gradient(ellipse 80% 45% at 50% -8%, rgba(244,63,94,0.14) 0%, transparent 70%)',
        sweepStyle: 'radial-gradient(ellipse 120% 30% at 100% 50%, rgba(244,63,94,0.07) 0%, transparent 60%)',
        tabActive: 'bg-rose-500 text-white shadow-lg shadow-rose-900/40',
        lineFrom: 'from-rose-500',
        dotClass: 'bg-rose-400',
    },
} as const;

// ─────────────────────────────────────────────────────────────────
// SPORT REGISTRY
// imageUrl  → /public/sports/{sport}.png  (drop file = auto-loads)
// icon      → SVG fallback when image is missing / 404s
// accentHex → ONLY used on: top stripe, icon badge tint, CTA button
//             Everything else stays zinc. No colour overload.
// ─────────────────────────────────────────────────────────────────
interface SportMeta {
    label: string;
    accentHex: string;
    description: string;
    imageUrl: string;
    icon: React.ReactNode;
}

const SVGIcon = (paths: React.ReactNode) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        className="w-full h-full">
        {paths}
    </svg>
);

const SPORT_REGISTRY: Record<string, SportMeta> = {
    basketball: {
        label: 'Basketball', accentHex: '#f97316',
        description: 'Knockout bracket',
        imageUrl: '/sports/basketball.png',
        icon: SVGIcon(<>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9M12 3a15 15 0 0 0-4 9 15 15 0 0 0 4 9M3 12h18" />
        </>),
    },
    badminton: {
        label: 'Badminton', accentHex: '#0ea5e9',
        description: 'Singles & doubles',
        imageUrl: '/sports/badminton.png',
        icon: SVGIcon(<>
            <path d="M12 2c4 2 7 6 7 10a7 7 0 0 1-14 0c0-4 3-8 7-10z" />
            <path d="M12 12v10M8 16h8" />
        </>),
    },
    volleyball: {
        label: 'Volleyball', accentHex: '#eab308',
        description: 'Indoor knockout',
        imageUrl: '/sports/volleyball.png',
        icon: SVGIcon(<>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3c2 3 2 6 0 9M12 12c3 2 6 2 9 0M3 12c0 3 3 6 5 7" />
        </>),
    },
    kabaddi: {
        label: 'Kabaddi', accentHex: '#ef4444',
        description: 'Contact elimination',
        imageUrl: '/sports/kabaddi.png',
        icon: SVGIcon(<>
            <circle cx="9" cy="5" r="2" /><circle cx="15" cy="5" r="2" />
            <path d="M6 21v-6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6M9 12v3m6-3v3" />
        </>),
    },
    football: {
        label: 'Football', accentHex: '#22c55e',
        description: '7-a-side knockout',
        imageUrl: '/sports/football.png',
        icon: SVGIcon(<>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" />
        </>),
    },
    cricket: {
        label: 'Cricket', accentHex: '#84cc16',
        description: 'T10 / T20 format',
        imageUrl: '/sports/cricket.png',
        icon: SVGIcon(<>
            <path d="M5 19L19 5M5 5l3 3-3 7 7-3 3 3" />
            <circle cx="19" cy="19" r="3" />
            <path d="M8 6h8M8 10h8" />
        </>),
    },
    tabletennis: {
        label: 'Table Tennis', accentHex: '#3b82f6',
        description: 'Singles knockout',
        imageUrl: '/sports/tabletennis.png',
        icon: SVGIcon(<>
            <path d="M12 5a7 7 0 0 1 7 7" />
            <circle cx="8" cy="15" r="3" />
            <path d="M11 15h10M3 12h4" />
        </>),
    },
    general: {
        label: 'General', accentHex: '#a855f7',
        description: 'Open format',
        imageUrl: '/sports/general.png',
        icon: SVGIcon(<>
            <path d="M8 21h8M12 17v4M5 3h14l-1 8a6 6 0 0 1-12 0L5 3z" />
            <path d="M5 7H3a2 2 0 0 0 0 4h2M19 7h2a2 2 0 0 0 0 4h-2" />
        </>),
    },
    default: {
        label: 'Sport', accentHex: '#ca8a04',
        description: 'Tournament format',
        imageUrl: '',
        icon: SVGIcon(<>
            <path d="M8 21h8M12 17v4M5 3h14l-1 8a6 6 0 0 1-12 0L5 3z" />
            <path d="M5 7H3a2 2 0 0 0 0 4h2M19 7h2a2 2 0 0 0 0 4h-2" />
        </>),
    },
};

const getSportMeta = (sport: string): SportMeta => {
    const key = sport.toLowerCase();
    if (SPORT_REGISTRY[key]) return SPORT_REGISTRY[key];
    return {
        ...SPORT_REGISTRY.default,
        label: sport.charAt(0).toUpperCase() + sport.slice(1),
        imageUrl: `/sports/${key}.png`,
    };
};

// ─────────────────────────────────────────────────────────────────
// SPORT ICON BADGE — tries image first, SVG fallback on error
// ─────────────────────────────────────────────────────────────────
const SportIconBadge: React.FC<{
    meta: SportMeta;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    accentOverride?: string;   // when set, overrides meta.accentHex for tint/icon colour
}> = ({ meta, size = 'md', className = '', accentOverride }) => {
    const [imgFailed, setImgFailed] = useState(false);
    const sizes = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-16 h-16' };
    const iconSizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
    const accent = accentOverride ?? meta.accentHex;

    return (
        <div
            className={`${sizes[size]} rounded-xl flex items-center justify-center border flex-shrink-0 overflow-hidden ${className}`}
            style={{ background: `${accent}10`, borderColor: `${accent}22` }}
        >
            {meta.imageUrl && !imgFailed ? (
                <img
                    src={meta.imageUrl}
                    alt={meta.label}
                    className="w-full h-full object-contain p-1.5"
                    onError={() => setImgFailed(true)}
                />
            ) : (
                <div className={iconSizes[size]} style={{ color: accent }}>
                    {meta.icon}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
// STATUS CONFIG — CTA uses sport accent only for draft/published
// ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    setup_required: {
        labelShort: 'Setup',
        dotClass: 'bg-zinc-500',
        textClass: 'text-zinc-400',
        pillClass: 'bg-zinc-800/70 border-zinc-700/50',
        actionLabel: 'Initialize',
        ctaClass: 'bg-zinc-700 hover:bg-zinc-600 text-white',
        useAccentCta: false,
    },
    draft: {
        labelShort: 'Draft',
        dotClass: 'bg-yellow-500',
        textClass: 'text-yellow-400',
        pillClass: 'bg-yellow-950/40 border-yellow-800/40',
        actionLabel: 'Configure Bracket',
        ctaClass: '',
        useAccentCta: true,
    },
    published: {
        labelShort: 'Live',
        dotClass: 'bg-green-500 animate-pulse',
        textClass: 'text-green-400',
        pillClass: 'bg-green-950/40 border-green-800/40',
        actionLabel: 'Manage Matches',
        ctaClass: '',
        useAccentCta: true,
    },
    completed: {
        labelShort: 'Done',
        dotClass: 'bg-blue-500',
        textClass: 'text-blue-400',
        pillClass: 'bg-blue-950/40 border-blue-800/40',
        actionLabel: 'View Results',
        ctaClass: 'bg-blue-700 hover:bg-blue-600 text-white',
        useAccentCta: false,
    },
} as const;

// ─────────────────────────────────────────────────────────────────
// SPORT DIVISION CARD
// All cards share the gender accent — unified, calm palette.
// genderAccent passed from parent, drives all colour touches.
// ─────────────────────────────────────────────────────────────────
const SportDivisionCard: React.FC<{
    division: DivisionConfig;
    isAdmin: boolean;
    onSelect: () => void;
    onDelete?: () => void;
    index: number;
    genderAccent: string;
}> = ({ division, isAdmin, onSelect, onDelete, index, genderAccent }) => {
    const meta = getSportMeta(division.sport);
    const status = STATUS_CONFIG[division.status] ?? STATUS_CONFIG.setup_required;
    const bracketSize = division.bracketSize ?? 0;
    const ctaStyle = status.useAccentCta ? { background: '#a1a1aa', color: '#000' } : {};

    return (
        <div
            className="group relative rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden
                       cursor-pointer transition-all duration-300 hover:-translate-y-1
                       hover:border-zinc-700 hover:shadow-xl hover:shadow-black/50"
            style={{ animationDelay: `${index * 55}ms` }}
            onClick={onSelect}
        >
            {/* Hover glow — gender accent, very faint */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${genderAccent}08 0%, transparent 65%)` }}
            />

            {/* Top accent stripe — solid full width, gender colour */}
            <div className="h-[2px] w-full flex-shrink-0" style={{ background: genderAccent }} />

            {/* Watermark — zinc, no colour, just depth */}
            <div className="absolute -bottom-6 -right-6 w-36 h-36 text-zinc-800/25 group-hover:text-zinc-700/30 transition-all duration-500 pointer-events-none rotate-12">
                {meta.icon}
            </div>

            <div className="p-5 relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <SportIconBadge
                        meta={meta}
                        size="md"
                        accentOverride={genderAccent}
                        className="transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${status.pillClass} ${status.textClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dotClass}`} />
                            {status.labelShort}
                        </span>
                        {isAdmin && division.status === 'setup_required' && onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 hover:border-red-800/60 hover:bg-red-950/30 flex items-center justify-center transition-all"
                                title="Remove division"
                            >
                                <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Name & gender */}
                <h3 className="text-xl font-black italic uppercase tracking-tight text-white leading-none mb-0.5
                               group-hover:text-zinc-100 transition-colors">
                    {meta.label}
                </h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-4">
                    {division.gender === 'men' ? "Men's" : division.gender === 'women' ? "Women's" : "Mixed"} · {meta.description}
                </p>

                {/* Bracket stats or placeholder */}
                {bracketSize > 0 ? (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                            { val: bracketSize, label: 'Teams' },
                            { val: Math.log2(bracketSize) | 0, label: 'Rounds' },
                            { val: bracketSize - 1, label: 'Matches' },
                        ].map(({ val, label }) => (
                            <div key={label} className="bg-zinc-900/80 rounded-xl py-2.5 text-center border border-zinc-800/60">
                                <div className="text-sm font-black text-white">{val}</div>
                                <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mt-0.5">{label}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 mb-4 py-2.5 px-3 rounded-xl bg-zinc-900/50 border border-zinc-800/40">
                        <svg className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Not yet configured</span>
                    </div>
                )}

                {/* CTA */}
                <button
                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                    className={`w-full py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px]
                                transition-all flex items-center justify-center gap-2 ${status.ctaClass}`}
                    style={ctaStyle}
                >
                    {status.actionLabel}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
// ANIMATED OVERLINE — fades out, swaps, fades in on gender change
// ─────────────────────────────────────────────────────────────────
const AnimatedOverline: React.FC<{ text: string; accentHex: string }> = ({ text, accentHex }) => {
    const [displayText, setDisplayText] = useState(text);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        setVisible(false);
        const t = setTimeout(() => { setDisplayText(text); setVisible(true); }, 160);
        return () => clearTimeout(t);
    }, [text]);

    return (
        <div className="flex items-center gap-3 mb-3" style={{ opacity: visible ? 1 : 0, transition: 'opacity 160ms ease' }}>
            <div className="h-px w-8 transition-all duration-700" style={{ background: accentHex }} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] transition-colors duration-700" style={{ color: accentHex }}>
                {displayText}
            </span>
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
    const sport = divisionId.split('_')[0];
    const gender = divisionId.split('_')[1];
    const meta = getSportMeta(sport);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onCancel} />
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md relative z-10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${meta.accentHex}, transparent)` }} />
                <div className="p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <SportIconBadge meta={meta} size="md" />
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-widest mb-0.5 text-zinc-500">Initialize Division</div>
                            <h2 className="text-xl font-black italic uppercase text-white">
                                {meta.label}
                                <span className="text-zinc-500 font-bold not-italic"> · {gender === 'men' ? "Men's" : gender === 'women' ? "Women's" : 'Mixed'}</span>
                            </h2>
                        </div>
                    </div>

                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-5 text-center">
                        Number of Teams
                    </label>
                    <div className="flex items-center justify-center gap-6 mb-8">
                        <button onClick={() => onTeamCountChange(Math.max(2, teamCount - 1))}
                            className="w-12 h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-xl font-black text-white transition-all active:scale-95">−</button>
                        <div className="text-center w-20">
                            <div className="text-5xl font-black text-white">{teamCount}</div>
                            <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">teams</div>
                        </div>
                        <button onClick={() => onTeamCountChange(Math.min(64, teamCount + 1))}
                            className="w-12 h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-xl font-black text-white transition-all active:scale-95">+</button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-8">
                        {[{ val: bracketSize, label: 'Bracket Size' }, { val: Math.log2(bracketSize) | 0, label: 'Rounds' }, { val: byes, label: 'Byes' }].map(({ val, label }) => (
                            <div key={label} className="bg-zinc-900 rounded-xl p-3 text-center border border-zinc-800">
                                <div className="text-2xl font-black text-white">{val}</div>
                                <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mt-0.5">{label}</div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onCancel} className="flex-1 py-3.5 rounded-xl bg-zinc-900 text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-white hover:bg-zinc-800 transition-all border border-zinc-800">
                            Cancel
                        </button>
                        <button onClick={onConfirm} className="flex-1 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-[0.98]"
                            style={{ background: meta.accentHex, color: '#000' }}>
                            Generate Bracket
                        </button>
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
    addableSports: SportType[]; onAddSport: (sport: SportType) => void; onClose: () => void;
}> = ({ addableSports, onAddSport, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
        <div className="bg-zinc-950 border border-zinc-800 w-full max-w-xl relative z-10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="h-[2px] bg-gradient-to-r from-yellow-600 via-yellow-500/60 to-transparent" />
            <div className="p-8">
                <div className="flex items-center justify-between mb-7">
                    <div>
                        <div className="text-[9px] font-black text-yellow-500 uppercase tracking-widest mb-1">Tournament</div>
                        <h2 className="text-2xl font-black italic uppercase text-white">Add Sport</h2>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white text-xl transition-all">×</button>
                </div>

                {addableSports.length === 0 ? (
                    <div className="py-12 text-center">
                        <div className="text-4xl mb-4 opacity-20">🏆</div>
                        <p className="text-zinc-500 font-bold uppercase text-xs tracking-wider">All available sports have been added</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                        {addableSports.map((sport) => {
                            const meta = getSportMeta(sport);
                            return (
                                <button key={sport} onClick={() => onAddSport(sport)}
                                    className="group p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 transition-all duration-200 text-left">
                                    <SportIconBadge meta={meta} size="sm" className="mb-3 transition-transform duration-200 group-hover:scale-110" />
                                    <div className="text-sm font-black uppercase text-white">{meta.label}</div>
                                    <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mt-0.5">{meta.description}</div>
                                </button>
                            );
                        })}
                    </div>
                )}

                <button onClick={onClose} className="w-full py-3 rounded-xl bg-zinc-900 text-zinc-500 font-black uppercase text-[10px] tracking-widest hover:text-white hover:bg-zinc-800 transition-all border border-zinc-800">
                    Close
                </button>
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
    const [customTeamCount, setCustomTeamCount] = useState<number>(8);
    const [showAddSportModal, setShowAddSportModal] = useState(false);
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

    const handleGenderSwitch = (g: GenderCategory) => {
        if (g === activeGender) return;
        setActiveGender(g);
        setSelectedDivisionId(null);
    };

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

    const isAdmin = auth.currentUser?.uid === tournament?.adminId;
    const divisionsList = tournament?.divisions ? Object.values(tournament.divisions) : [];
    const filteredDivisions = divisionsList.filter(d => d.gender === activeGender);
    const currentDivision = selectedDivisionId && tournament?.divisions ? tournament.divisions[selectedDivisionId] : null;

    const availableSports: SportType[] = ['basketball', 'badminton', 'volleyball', 'kabaddi', 'football', 'cricket', 'tabletennis', 'general'];
    const existingSports = new Set(divisionsList.map(d => d.sport));
    const addableSports = availableSports.filter(s => !existingSports.has(s));

    const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, customTeamCount))));
    const byes = bracketSize - customTeamCount;
    const liveCount = filteredDivisions.filter(d => d.status === 'published').length;
    const doneCount = filteredDivisions.filter(d => d.status === 'completed').length;
    const theme = GENDER_THEME[activeGender];

    if (!tournament) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-zinc-500 animate-spin mx-auto" />
                <div className="text-zinc-600 font-black uppercase text-[10px] tracking-widest animate-pulse">Loading Tournament</div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-black text-white relative overflow-x-hidden">

            {/* ── BACKGROUND ─────────────────────────────── */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-black" />
                {/* Subtle top glow — reduced opacity, transitions with gender */}
                <div className="absolute inset-0 transition-all duration-700" style={{ background: theme.glowStyle }} />
                {/* Grid */}
                <div className="absolute inset-0 opacity-[0.02]" style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }} />
            </div>

            {/* ── STICKY HEADER ─────────────────────────────── */}
            <header className="relative z-20 sticky top-0">
                <div className="absolute inset-0 bg-black/75 backdrop-blur-xl border-b border-zinc-900/80" />
                <div className="relative px-6 lg:px-10 h-[72px] flex items-center justify-between gap-4">

                    {/* Back + tournament name */}
                    <div className="flex items-center gap-4 min-w-0">
                        <button
                            onClick={() => navigate('/tournament')}
                            className="group w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center transition-all flex-shrink-0"
                        >
                            <svg className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:-translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div className="h-5 w-px bg-zinc-800 flex-shrink-0" />
                        <div className="min-w-0">
                            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Tournament</div>
                            <h1 className="text-sm font-black italic uppercase text-white truncate leading-tight">{tournament.name}</h1>
                        </div>
                    </div>

                    {/* Gender tabs — the visual core of the transition */}
                    <div className="hidden md:flex items-center gap-1 bg-zinc-950 border border-zinc-800/80 rounded-xl p-1">
                        {(['men', 'women'] as GenderCategory[]).map((g) => {
                            const t = GENDER_THEME[g];
                            const isActive = activeGender === g;
                            return (
                                <button key={g} onClick={() => handleGenderSwitch(g)}
                                    className={`relative px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? t.tabActive : 'text-zinc-500 hover:text-white'}`}>
                                    {isActive && <span className={`absolute top-1.5 right-1.5 w-1 h-1 rounded-full ${t.dotClass}`} />}
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Contextual right actions */}
                    <div className="flex items-center gap-3">
                        {selectedDivisionId && (
                            <button onClick={() => setSelectedDivisionId(null)}
                                className="px-4 py-2 rounded-xl border border-zinc-700 hover:border-white text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Sports
                            </button>
                        )}
                        {!selectedDivisionId && isAdmin && (
                            <button onClick={() => setShowAddSportModal(true)}
                                className="px-5 py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-yellow-900/20 flex items-center gap-2">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Sport
                            </button>
                        )}
                    </div>
                </div>

                {/* Gender accent line — solid, full-width, transitions colour */}
                <div
                    className="h-[2px] w-full transition-all duration-700"
                    style={{ background: theme.accentHex }}
                />
            </header>

            {/* Colour wash band — bleeds full viewport width below header,
                fades downward so it doesn't tint the cards */}
            <div
                className="relative z-10 w-full h-20 pointer-events-none transition-all duration-700"
                style={{
                    background: `linear-gradient(to bottom, ${theme.accentHex}12 0%, transparent 100%)`,
                }}
            />

            {/* ── MAIN ──────────────────────────────────────── */}
            <main className="relative z-10 px-6 lg:px-10 py-10">

                {/* ── BRACKET VIEW ─────────────────────────── */}
                {selectedDivisionId && currentDivision && (() => {
                    const meta = getSportMeta(currentDivision.sport);
                    return (
                        <div className="animate-in fade-in slide-in-from-bottom-3 duration-400">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <SportIconBadge meta={meta} size="lg" />
                                    <div>
                                        <h2 className="text-3xl font-black italic uppercase tracking-tight text-white">{meta.label}</h2>
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                                            {currentDivision.gender === 'men' ? "Men's" : "Women's"} Division
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {isAdmin && currentDivision.status === 'draft' && (
                                        <button onClick={handlePublish} className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all">
                                            📡 Publish
                                        </button>
                                    )}
                                    {isAdmin && currentDivision.status === 'published' && (
                                        <button onClick={handleUnpublish} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl font-bold uppercase text-xs tracking-widest transition-all border border-zinc-700">
                                            🔒 Unpublish
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="bg-zinc-950/50 backdrop-blur-sm border border-zinc-900 rounded-2xl p-6 min-h-[600px]">
                                <BracketEditor
                                    tournamentId={id!}
                                    fixtures={divisionFixtures}
                                    isAdmin={isAdmin}
                                    divisionStatus={currentDivision.status}
                                    isEditMode={isEditMode}
                                />
                            </div>
                        </div>
                    );
                })()}

                {/* ── SPORT GRID ────────────────────────────── */}
                {!selectedDivisionId && (
                    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">

                        {/* Mobile gender tabs */}
                        <div className="flex md:hidden gap-2 mb-8">
                            {(['men', 'women'] as GenderCategory[]).map((g) => {
                                const t = GENDER_THEME[g];
                                return (
                                    <button key={g} onClick={() => handleGenderSwitch(g)}
                                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
                                            ${activeGender === g ? t.tabActive : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}>
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Section header */}
                        <div className="flex items-end justify-between mb-8 gap-4">
                            <div>
                                <AnimatedOverline text={theme.overline} accentHex={theme.accentHex} />
                                <h2 className="text-4xl lg:text-5xl font-black italic uppercase tracking-tighter text-white leading-none">
                                    Select Division
                                </h2>
                            </div>
                            {filteredDivisions.length > 0 && (
                                <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                                    {[{ val: filteredDivisions.length, label: 'Sports' }, { val: liveCount, label: 'Live' }, { val: doneCount, label: 'Done' }].map(({ val, label }) => (
                                        <div key={label} className="text-center px-4 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 backdrop-blur-sm">
                                            <div className="text-lg font-black text-white">{val}</div>
                                            <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">{label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Empty state */}
                        {filteredDivisions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 text-center">
                                <div className="text-6xl mb-6 opacity-10">🏆</div>
                                <h3 className="text-xl font-black italic uppercase text-zinc-500 mb-2">
                                    No {theme.label.toLowerCase()} sports yet
                                </h3>
                                <p className="text-zinc-700 text-xs font-bold uppercase tracking-wider mb-8">Add a sport to create divisions</p>
                                {isAdmin && (
                                    <button onClick={() => setShowAddSportModal(true)}
                                        className="bg-yellow-600 hover:bg-yellow-500 text-black font-black py-3 px-6 rounded-xl uppercase text-xs tracking-widest transition-all flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add Sport
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {filteredDivisions.map((div, index) => (
                                    <SportDivisionCard
                                        key={div.id}
                                        division={div}
                                        isAdmin={isAdmin}
                                        index={index}
                                        genderAccent={theme.accentHex}
                                        onSelect={() => div.isActive ? setSelectedDivisionId(div.id) : setSetupDivId(div.id)}
                                        onDelete={isAdmin && div.status === 'setup_required' ? () => handleRemoveDivision(div.id) : undefined}
                                    />
                                ))}
                                {isAdmin && (
                                    <button onClick={() => setShowAddSportModal(true)}
                                        className="group rounded-2xl border-2 border-dashed border-zinc-800 hover:border-zinc-700 bg-transparent hover:bg-zinc-950/60 transition-all duration-300 flex flex-col items-center justify-center gap-3 min-h-[240px] cursor-pointer">
                                        <div className="w-12 h-12 rounded-2xl bg-zinc-900 group-hover:bg-zinc-800 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center transition-all duration-300">
                                            <svg className="w-6 h-6 text-zinc-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                            </svg>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-sm font-black italic uppercase text-zinc-600 group-hover:text-white transition-colors">New Sport</div>
                                            <div className="text-[9px] text-zinc-700 font-bold uppercase tracking-wider mt-0.5 group-hover:text-zinc-500 transition-colors">Add Division</div>
                                        </div>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ── MODALS ────────────────────────────────────── */}
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
        </div>
    );
};