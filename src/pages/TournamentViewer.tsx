// src/pages/TournamentViewer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — PUBLIC TOURNAMENT VIEWER
//
// Route: /t/:id  (no auth — scannable QR, shareable link)
//
// Three tabs:
//   LIVE     — games happening right now (auto-refreshed via Supabase broadcast)
//   FIXTURES — full bracket / schedule per sport division
//   RESULTS  — completed match history with scores
//
// Roles visible here: spectators, viewers — read-only.
// Volunteers click "I'm a Scorer" → enter PIN → VolunteerConsole
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import {
    subscribeToTournament,
    subscribeToFixtures,
} from '../services/tournamentService';
import type {
    Tournament,
    TournamentFixture,
    GenderCategory,
    SchedulableSport,
} from '../types';

// ─── Sport metadata ───────────────────────────────────────────────────────────
const SPORT_META: Record<string, { label: string; accent: string; icon: React.ReactNode }> = {
    basketball: {
        label: 'Basketball',
        accent: '#f59e0b',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3c0 4.97 4.03 9 9 9M12 3c0 4.97-4.03 9-9 9M12 21c0-4.97 4.03-9 9-9M12 21c0-4.97-4.03-9-9-9" />
                <line x1="3" y1="12" x2="21" y2="12" />
            </svg>
        ),
    },
    badminton: {
        label: 'Badminton',
        accent: '#10b981',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
                <line x1="4" y1="20" x2="14" y2="10" />
                <circle cx="16" cy="8" r="4" />
                <path d="M14 10l2-2" />
            </svg>
        ),
    },
    volleyball: {
        label: 'Volleyball',
        accent: '#3b82f6',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3c3 3 3 6 0 9s-3 6 0 9" />
                <path d="M3.6 9h16.8M3.6 15h16.8" />
            </svg>
        ),
    },
    football: {
        label: 'Football',
        accent: '#22c55e',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7l2 5h5M12 7l-2 5H5M7 17l2-5M17 17l-2-5M9 12h6" />
            </svg>
        ),
    },
    kabaddi: { label: 'Kabaddi', accent: '#f97316', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><circle cx="12" cy="7" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /><path d="M8 14l-3 4M16 14l3 4" /></svg> },
    tabletennis: { label: 'Table Tennis', accent: '#e11d48', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><circle cx="8" cy="12" r="5" /><line x1="12" y1="12" x2="20" y2="4" /><circle cx="20" cy="4" r="2" /></svg> },
    cricket: { label: 'Cricket', accent: '#8b5cf6', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><line x1="5" y1="19" x2="19" y2="5" strokeWidth="2.5" /><line x1="17" y1="17" x2="20" y2="20" /><line x1="4" y1="20" x2="7" y2="20" /><line x1="4" y1="17" x2="4" y2="20" /></svg> },
    general: { label: 'General', accent: '#64748b', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" /></svg> },
};

const getSportMeta = (sport: string) => SPORT_META[sport] ?? SPORT_META.general;

// ─── Animated background ─────────────────────────────────────────────────────
const ArenaBackground: React.FC = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full opacity-[0.04]"
            style={{ background: 'radial-gradient(circle, #facc15 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[300px] rounded-full opacity-[0.03]"
            style={{ background: 'radial-gradient(circle, #facc15 0%, transparent 70%)' }} />
        {/* subtle grid */}
        <div className="absolute inset-0 opacity-[0.02]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
    </div>
);

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    if (status === 'live') return (
        <span className="inline-flex items-center gap-1.5 bg-green-950/60 border border-green-800/50 text-green-400 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Live
        </span>
    );
    if (status === 'completed') return (
        <span className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
            Final
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 text-zinc-600 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
            Scheduled
        </span>
    );
};

// ─── Live Match Card ──────────────────────────────────────────────────────────
const LiveMatchCard: React.FC<{ fixture: TournamentFixture }> = ({ fixture }) => {
    const meta = getSportMeta(fixture.sport);
    const [liveGame, setLiveGame] = useState<any>(null);

    useEffect(() => {
        if (!fixture.gameCode) return;
        const fetchGame = async () => {
            const { data } = await supabase.from('games').select('teamA,teamB,gameState,status').eq('code', fixture.gameCode!).single();
            if (data) setLiveGame(data);
        };
        fetchGame();

        // Subscribe to game changes
        const channel = supabase
            .channel(`viewer_game_${fixture.gameCode}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `code=eq.${fixture.gameCode}` },
                (payload) => setLiveGame(payload.new))
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fixture.gameCode]);

    const scoreA = liveGame?.teamA?.score ?? 0;
    const scoreB = liveGame?.teamB?.score ?? 0;
    const period = liveGame?.gameState?.period ?? 1;
    const running = liveGame?.gameState?.gameRunning ?? false;
    const mins = liveGame?.gameState?.gameTime?.minutes ?? 10;
    const secs = liveGame?.gameState?.gameTime?.seconds ?? 0;

    return (
        <Link to={fixture.gameCode ? `/watch/${fixture.gameCode}` : '#'}
            className="group block bg-zinc-950 border border-zinc-800 hover:border-zinc-600 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50">
            {/* Top accent line */}
            <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${meta.accent}, transparent)` }} />

            <div className="p-5">
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 flex-shrink-0" style={{ color: meta.accent }}>{meta.icon}</div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <StatusBadge status={fixture.status} />
                        {fixture.court && fixture.court !== 'Unassigned' && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{fixture.court}</span>
                        )}
                    </div>
                </div>

                {/* Score display */}
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 truncate">{fixture.teamA}</div>
                        <div className="text-4xl font-black text-white tabular-nums leading-none">{scoreA}</div>
                    </div>
                    <div className="px-4 text-center">
                        <div className="text-zinc-600 font-black text-lg">—</div>
                        {fixture.status === 'live' && (
                            <div className="mt-1 text-[9px] font-bold text-zinc-500 uppercase">
                                {running ? (
                                    <span className="text-green-500">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
                                ) : (
                                    <span>Q{period}</span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 text-right">
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 truncate">{fixture.teamB}</div>
                        <div className="text-4xl font-black text-white tabular-nums leading-none">{scoreB}</div>
                    </div>
                </div>

                {/* Watch button */}
                {fixture.gameCode && (
                    <div className="mt-4 pt-4 border-t border-zinc-900">
                        <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300 transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Watch Live
                        </div>
                    </div>
                )}
            </div>
        </Link>
    );
};

// ─── Fixture Row ──────────────────────────────────────────────────────────────
const FixtureRow: React.FC<{ fixture: TournamentFixture; navigate: (path: string) => void }> = ({ fixture, navigate }) => {
    const meta = getSportMeta(fixture.sport);
    const isCompleted = fixture.status === 'completed';
    const isLive = fixture.status === 'live';
    const winnerA = isCompleted && fixture.winnerSide === 'A';
    const winnerB = isCompleted && fixture.winnerSide === 'B';

    const handleClick = () => {
        if (fixture.gameCode) navigate(`/watch/${fixture.gameCode}`);
    };

    return (
        <div
            onClick={handleClick}
            className={`flex items-center justify-between py-3 px-4 rounded-xl border transition-all duration-200 
                ${fixture.gameCode ? 'cursor-pointer hover:bg-zinc-900/50' : 'cursor-default'}
                ${isLive ? 'bg-green-950/10 border-green-900/30' : 'bg-zinc-950/30 border-zinc-900/50'}
            `}
        >
            {/* Time + Court */}
            <div className="w-20 flex-shrink-0">
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    {fixture.time !== 'Pending' ? fixture.time : '—'}
                </div>
                {fixture.court !== 'Unassigned' && (
                    <div className="text-[9px] text-zinc-700 font-bold mt-0.5">{fixture.court}</div>
                )}
            </div>

            {/* Teams & scores */}
            <div className="flex-1 px-3">
                <div className="flex items-center justify-between">
                    <span className={`text-sm font-black uppercase tracking-tight ${winnerA ? 'text-white' : isCompleted ? 'text-zinc-500' : 'text-zinc-200'}`}>
                        {winnerA && <span className="text-yellow-500 mr-1">▶</span>}
                        {fixture.teamA === 'TBD' ? <span className="text-zinc-700 italic font-normal">TBD</span> : fixture.teamA}
                    </span>
                    {isCompleted && (
                        <span className={`text-sm font-black tabular-nums ${winnerA ? 'text-white' : 'text-zinc-500'}`}>
                            {fixture.finalScore?.teamA ?? 0}
                        </span>
                    )}
                </div>
                <div className="my-0.5 h-px bg-zinc-900" />
                <div className="flex items-center justify-between">
                    <span className={`text-sm font-black uppercase tracking-tight ${winnerB ? 'text-white' : isCompleted ? 'text-zinc-500' : 'text-zinc-200'}`}>
                        {winnerB && <span className="text-yellow-500 mr-1">▶</span>}
                        {fixture.teamB === 'BYE' ? <span className="text-zinc-700 italic font-normal">BYE</span> :
                            fixture.teamB === 'TBD' ? <span className="text-zinc-700 italic font-normal">TBD</span> :
                                fixture.teamB}
                    </span>
                    {isCompleted && (
                        <span className={`text-sm font-black tabular-nums ${winnerB ? 'text-white' : 'text-zinc-500'}`}>
                            {fixture.finalScore?.teamB ?? 0}
                        </span>
                    )}
                </div>
            </div>

            {/* Status */}
            <div className="w-16 flex-shrink-0 flex justify-end">
                <StatusBadge status={fixture.status} />
            </div>
        </div>
    );
};

// ─── Division Fixtures Panel ──────────────────────────────────────────────────
const DivisionFixturesPanel: React.FC<{
    tournamentId: string;
    divisionId: string;
    sport: string;
    gender: GenderCategory;
    navigate: (path: string) => void;
}> = ({ tournamentId, divisionId, sport, gender, navigate }) => {
    const [fixtures, setFixtures] = useState<TournamentFixture[]>([]);

    useEffect(() => {
        return subscribeToFixtures(tournamentId, divisionId, setFixtures);
    }, [tournamentId, divisionId]);

    const meta = getSportMeta(sport);
    const rounds = useMemo(() => {
        const map: Record<number, TournamentFixture[]> = {};
        fixtures.forEach(f => {
            if (f.isBye) return;
            const r = f.round ?? 1;
            if (!map[r]) map[r] = [];
            map[r].push(f);
        });
        return map;
    }, [fixtures]);

    const roundNums = Object.keys(rounds).map(Number).sort((a, b) => a - b);
    const totalRounds = Math.max(...roundNums, 1);

    const getRoundLabel = (r: number) => {
        if (r === totalRounds) return 'Final';
        if (r === totalRounds - 1) return 'Semi-Finals';
        if (r === totalRounds - 2) return 'Quarter-Finals';
        return `Round ${r}`;
    };

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-4" style={{ color: meta.accent }}>{meta.icon}</div>
                <h3 className="text-sm font-black italic uppercase tracking-tight text-white">{meta.label}</h3>
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                    {gender === 'men' ? "Men's" : gender === 'women' ? "Women's" : "Mixed"}
                </span>
            </div>

            {roundNums.length === 0 ? (
                <div className="text-center py-8 text-zinc-700 text-xs font-bold uppercase tracking-widest">No fixtures yet</div>
            ) : (
                <div className="space-y-6">
                    {roundNums.map(r => (
                        <div key={r}>
                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2 flex items-center gap-2">
                                <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${meta.accent}30, transparent)` }} />
                                {getRoundLabel(r)}
                                <div className="h-px flex-1" style={{ background: `linear-gradient(270deg, ${meta.accent}30, transparent)` }} />
                            </div>
                            <div className="space-y-1.5">
                                {rounds[r].map(f => (
                                    <FixtureRow key={f.id} fixture={f} navigate={navigate} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
type Tab = 'live' | 'fixtures' | 'results';

export const TournamentViewer: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [allFixtures, setAllFixtures] = useState<TournamentFixture[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>('live');
    const [showVolunteerModal, setShowVolunteerModal] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [pinLoading, setPinLoading] = useState(false);
    const [notFound, setNotFound] = useState(false);

    // Load tournament
    useEffect(() => {
        if (!id) return;
        const unsub = subscribeToTournament(id, (t) => {
            if (!t) setNotFound(true);
            else setTournament(t);
        });
        return unsub;
    }, [id]);

    // Load all fixtures (no division filter — for live tab)
    useEffect(() => {
        if (!id) return;
        return subscribeToFixtures(id, null, setAllFixtures);
    }, [id]);

    const liveFixtures = useMemo(() => allFixtures.filter(f => f.status === 'live' && !f.isBye), [allFixtures]);
    const completedFixtures = useMemo(() => allFixtures.filter(f => f.status === 'completed' && !f.isBye)
        .sort((a, b) => (b as any).actualEndTime - (a as any).actualEndTime), [allFixtures]);

    // Published divisions only (spectators only see published)
    const publishedDivisions = useMemo(() => {
        if (!tournament?.divisions) return [];
        return Object.values(tournament.divisions).filter(d => d.status === 'published' || d.status === 'completed');
    }, [tournament]);

    const handleVolunteerAccess = async () => {
        if (!id || !pin.trim()) return;
        setPinLoading(true);
        setPinError('');
        try {
            const { data } = await supabase.from('tournaments').select('scorerPin, id').eq('id', id).single();
            if (data && data.scorerPin === pin.trim()) {
                // Store pin in session for this tournament
                sessionStorage.setItem(`volunteer_pin_${id}`, pin.trim());
                navigate(`/t/${id}/volunteer`);
            } else {
                setPinError('Invalid PIN. Check with your tournament admin.');
            }
        } catch {
            setPinError('Connection error. Try again.');
        } finally {
            setPinLoading(false);
        }
    };

    if (notFound) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="text-center">
                <div className="text-5xl font-black italic text-zinc-800 mb-4">404</div>
                <div className="text-zinc-600 font-bold uppercase text-xs tracking-widest">Tournament not found</div>
            </div>
        </div>
    );

    if (!tournament) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-zinc-500 animate-spin" />
        </div>
    );

    const activeSports = Object.keys(tournament.sportConfig || {});

    return (
        <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
            <ArenaBackground />

            {/* ── HEADER ─────────────────────────────────────────────────────── */}
            <header className="relative z-20 sticky top-0">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-xl border-b border-zinc-900/80" />
                <div className="relative px-4 lg:px-8 h-16 flex items-center justify-between max-w-5xl mx-auto">
                    {/* Brand + Tournament name */}
                    <div className="flex items-center gap-3 min-w-0">
                        {tournament.logoUrl ? (
                            <img src={tournament.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                </svg>
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="text-[9px] font-bold text-yellow-500 uppercase tracking-[0.2em]">The Box</div>
                            <h1 className="text-sm font-black italic text-white uppercase tracking-tight truncate leading-tight">{tournament.name}</h1>
                        </div>
                    </div>

                    {/* Volunteer access */}
                    <button
                        onClick={() => setShowVolunteerModal(true)}
                        className="flex-shrink-0 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-white rounded-lg font-black uppercase text-[9px] tracking-widest transition-all"
                    >
                        Scorer Access
                    </button>
                </div>
            </header>

            {/* ── TOURNAMENT META STRIP ───────────────────────────────────────── */}
            <div className="relative z-10 border-b border-zinc-900/50">
                <div className="max-w-5xl mx-auto px-4 lg:px-8 py-4 flex flex-wrap items-center gap-4">
                    {tournament.organizer && (
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{tournament.organizer}</div>
                    )}
                    {tournament.location && (
                        <div className="flex items-center gap-1 text-[10px] text-zinc-600 font-bold">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {tournament.location}
                        </div>
                    )}
                    {activeSports.length > 0 && (
                        <div className="flex items-center gap-1.5 ml-auto">
                            {activeSports.slice(0, 4).map(sport => {
                                const meta = getSportMeta(sport);
                                return (
                                    <div key={sport} title={meta.label}
                                        className="w-5 h-5 rounded flex items-center justify-center"
                                        style={{ color: meta.accent }}>
                                        {meta.icon}
                                    </div>
                                );
                            })}
                            {activeSports.length > 4 && (
                                <span className="text-[9px] text-zinc-600 font-bold">+{activeSports.length - 4}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── TAB BAR ──────────────────────────────────────────────────────── */}
            <div className="relative z-10 border-b border-zinc-900/50 sticky top-16 bg-black/80 backdrop-blur-xl">
                <div className="max-w-5xl mx-auto px-4 lg:px-8 flex">
                    {(['live', 'fixtures', 'results'] as Tab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`relative px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                        >
                            {tab === 'live' && liveFixtures.length > 0 && (
                                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            )}
                            {tab}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── CONTENT ──────────────────────────────────────────────────────── */}
            <main className="relative z-10 max-w-5xl mx-auto px-4 lg:px-8 py-8">

                {/* LIVE TAB */}
                {activeTab === 'live' && (
                    <div>
                        {liveFixtures.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="w-14 h-14 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-7 h-7 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="text-zinc-700 font-black uppercase text-xs tracking-widest mb-1">No games live right now</div>
                                <div className="text-zinc-800 text-[10px] font-bold uppercase tracking-widest">Check back during match time</div>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-green-500">{liveFixtures.length} Game{liveFixtures.length !== 1 ? 's' : ''} Live</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {liveFixtures.map(f => <LiveMatchCard key={f.id} fixture={f} />)}
                                </div>
                            </div>
                        )}

                        {/* Upcoming today */}
                        {allFixtures.filter(f => f.status === 'scheduled' && !f.isBye && f.time !== 'Pending').length > 0 && (
                            <div className="mt-12">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-4 flex items-center gap-3">
                                    <div className="h-px flex-1 bg-zinc-900" />
                                    Upcoming
                                    <div className="h-px flex-1 bg-zinc-900" />
                                </h2>
                                <div className="space-y-1.5">
                                    {allFixtures
                                        .filter(f => f.status === 'scheduled' && !f.isBye && f.time !== 'Pending')
                                        .slice(0, 8)
                                        .map(f => <FixtureRow key={f.id} fixture={f} navigate={navigate} />)}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* FIXTURES TAB */}
                {activeTab === 'fixtures' && (
                    <div>
                        {publishedDivisions.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="text-zinc-700 font-black uppercase text-xs tracking-widest mb-1">Fixtures not published yet</div>
                                <div className="text-zinc-800 text-[10px] font-bold uppercase tracking-widest">Check back soon</div>
                            </div>
                        ) : (
                            <div className="space-y-10">
                                {publishedDivisions.map(div => (
                                    <div key={div.id} className="bg-zinc-950/40 border border-zinc-900/50 rounded-2xl p-5">
                                        <DivisionFixturesPanel
                                            tournamentId={id!}
                                            divisionId={div.id}
                                            sport={div.sport}
                                            gender={div.gender}
                                            navigate={navigate}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* RESULTS TAB */}
                {activeTab === 'results' && (
                    <div>
                        {completedFixtures.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="text-zinc-700 font-black uppercase text-xs tracking-widest mb-1">No results yet</div>
                                <div className="text-zinc-800 text-[10px] font-bold uppercase tracking-widest">Results will appear after games finish</div>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {completedFixtures.map(f => <FixtureRow key={f.id} fixture={f} navigate={navigate} />)}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ── VOLUNTEER / SCORER PIN MODAL ────────────────────────────────── */}
            {showVolunteerModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-black italic uppercase tracking-tight text-white">Scorer Access</h2>
                                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-0.5">Enter your tournament PIN</p>
                            </div>
                            <button onClick={() => { setShowVolunteerModal(false); setPinError(''); setPin(''); }}
                                className="text-zinc-600 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={pin}
                                onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                                onKeyDown={e => e.key === 'Enter' && handleVolunteerAccess()}
                                placeholder="Enter PIN"
                                className="w-full bg-zinc-900 border border-zinc-700 text-white text-2xl font-black text-center tracking-[0.5em] rounded-xl px-4 py-4 focus:outline-none focus:border-yellow-600 transition-colors placeholder:text-zinc-700 placeholder:text-base placeholder:tracking-normal"
                                autoFocus
                            />
                            {pinError && (
                                <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest mt-2 text-center">{pinError}</p>
                            )}
                        </div>

                        <button
                            onClick={handleVolunteerAccess}
                            disabled={pin.length < 4 || pinLoading}
                            className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all"
                        >
                            {pinLoading ? 'Verifying...' : 'Enter as Scorer'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};