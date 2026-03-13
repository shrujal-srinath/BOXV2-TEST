// src/pages/VolunteerConsole.tsx
// THE BOX — Scorer / Volunteer Console
// Route: /t/:id/volunteer (PIN-gated via sessionStorage)

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    subscribeToTournament,
    subscribeToFixtures,
    startTournamentMatch,
    advanceBracketWinner,
    getGameResult,
    checkAndCompleteDivision,
} from '../services/tournamentService';
import type { Tournament, TournamentFixture, DivisionConfig } from '../types';

const SPORT_META: Record<string, { label: string; accent: string }> = {
    basketball: { label: 'Basketball', accent: '#f59e0b' },
    badminton: { label: 'Badminton', accent: '#10b981' },
    volleyball: { label: 'Volleyball', accent: '#3b82f6' },
    football: { label: 'Football', accent: '#22c55e' },
    kabaddi: { label: 'Kabaddi', accent: '#f97316' },
    tabletennis: { label: 'Table Tennis', accent: '#e11d48' },
    cricket: { label: 'Cricket', accent: '#8b5cf6' },
    general: { label: 'General', accent: '#64748b' },
};
const getSportAccent = (sport: string) => SPORT_META[sport]?.accent ?? '#64748b';
const getSportLabel = (sport: string) => SPORT_META[sport]?.label ?? sport;

// ─── Winner Modal ──────────────────────────────────────────────────────────────
const WinnerModal: React.FC<{
    fixture: TournamentFixture;
    tournamentId: string;
    onDeclared: () => void;
    onCancel: () => void;
}> = ({ fixture, tournamentId, onDeclared, onCancel }) => {
    const [selected, setSelected] = useState<'A' | 'B' | null>(null);
    const [scoreA, setScoreA] = useState('');
    const [scoreB, setScoreB] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const accent = getSportAccent(fixture.sport);

    useEffect(() => {
        if (fixture.gameCode) {
            getGameResult(fixture.gameCode).then(result => {
                if (result) {
                    setScoreA(String(result.teamA));
                    setScoreB(String(result.teamB));
                    if (result.teamA > result.teamB) setSelected('A');
                    else if (result.teamB > result.teamA) setSelected('B');
                }
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [fixture.gameCode]);

    const handleConfirm = async () => {
        if (!selected) return;
        setSaving(true);
        const finalScore = { teamA: parseInt(scoreA) || 0, teamB: parseInt(scoreB) || 0 };
        await advanceBracketWinner(tournamentId, fixture, selected, finalScore);
        if (!fixture.nextMatchId) {
            const champion = selected === 'A' ? fixture.teamA : fixture.teamB;
            await checkAndCompleteDivision(tournamentId, fixture.divisionId, champion);
        }
        setSaving(false);
        onDeclared();
    };

    const isFinal = !fixture.nextMatchId;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onCancel} />
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-sm relative z-10 rounded-3xl shadow-2xl overflow-hidden">
                <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${accent}, transparent)` }} />
                <div className="p-6">
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-0.5">Declare Result</div>
                    <div className="text-sm font-black italic uppercase text-white mb-1">
                        {isFinal ? 'Grand Final' : fixture.round ? `Round ${fixture.round}` : 'Match'}
                    </div>
                    {isFinal && (
                        <div className="text-[9px] font-black uppercase tracking-widest text-yellow-500 mb-4">Winner becomes tournament champion</div>
                    )}

                    {loading ? (
                        <div className="h-28 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full border-2 border-zinc-800 border-t-yellow-500 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2 mb-5 mt-4">
                                {(['A', 'B'] as const).map(side => {
                                    const teamName = side === 'A' ? fixture.teamA : fixture.teamB;
                                    const score = side === 'A' ? scoreA : scoreB;
                                    const setScore = side === 'A' ? setScoreA : setScoreB;
                                    const isWinner = selected === side;
                                    return (
                                        <button key={side} onClick={() => setSelected(side)}
                                            className={`w-full rounded-2xl border p-4 transition-all flex items-center justify-between ${isWinner ? 'border-white/30 bg-white/8' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${isWinner ? 'border-white bg-white' : 'border-zinc-600'}`}>
                                                    {isWinner && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                                                </div>
                                                <span className="font-black uppercase text-sm text-white text-left">{teamName}</span>
                                            </div>
                                            <input
                                                type="number"
                                                value={score}
                                                onChange={e => setScore(e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                                className="w-14 text-center bg-black border border-zinc-700 rounded-lg py-1.5 text-white font-black tabular-nums text-lg outline-none focus:border-yellow-600 transition-colors"
                                                placeholder="0"
                                                min="0"
                                            />
                                        </button>
                                    );
                                })}
                            </div>

                            {selected && (
                                <div className="text-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-4">
                                    Winner: <span className="text-white">{selected === 'A' ? fixture.teamA : fixture.teamB}</span>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button onClick={onCancel}
                                    className="flex-1 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">
                                    Cancel
                                </button>
                                <button onClick={handleConfirm} disabled={!selected || saving}
                                    className="flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-40"
                                    style={selected && !saving ? { background: accent, color: '#000' } : { background: '#18181b', color: '#52525b' }}>
                                    {saving
                                        ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />Saving</span>
                                        : 'Confirm Result'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Match Card ────────────────────────────────────────────────────────────────
const MatchCard: React.FC<{
    fixture: TournamentFixture;
    onStart: (f: TournamentFixture) => void;
    onDeclareWinner: (f: TournamentFixture) => void;
    startingId: string | null;
    navigate: (path: string) => void;
}> = ({ fixture, onStart, onDeclareWinner, startingId, navigate }) => {
    const accent = getSportAccent(fixture.sport);
    const isStarting = startingId === fixture.id;
    const isLive = fixture.status === 'live';
    const isCompleted = fixture.status === 'completed';
    const isTBD = fixture.teamA === 'TBD' || fixture.teamB === 'TBD';
    const isFinal = !fixture.nextMatchId && fixture.round != null;

    if (fixture.isBye) return null;

    return (
        <div className={`relative bg-zinc-950 border rounded-2xl overflow-hidden transition-all duration-300
            ${isLive ? 'border-green-800/50 shadow-lg shadow-green-950/20' :
                isCompleted ? 'border-zinc-800/40 opacity-60' :
                    isTBD ? 'border-zinc-900' : 'border-zinc-800 hover:border-zinc-700'}`}>
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${isCompleted ? '#27272a' : accent}, transparent)` }} />

            <div className="p-4">
                {/* Meta */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                            {isFinal ? 'Final' : fixture.round ? `Round ${fixture.round}` : 'Match'}
                        </span>
                        {fixture.court && fixture.court !== 'Unassigned' && (
                            <><span className="text-zinc-800 text-[8px]">·</span><span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{fixture.court}</span></>
                        )}
                        {fixture.time && fixture.time !== 'Pending' && (
                            <><span className="text-zinc-800 text-[8px]">·</span><span className="text-[9px] font-bold text-zinc-500">{fixture.time}</span></>
                        )}
                    </div>
                    {isLive && <span className="flex items-center gap-1 text-[9px] font-black text-green-400 uppercase tracking-widest"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />Live</span>}
                    {isCompleted && fixture.winnerSide && <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Final</span>}
                </div>

                {/* Teams */}
                <div className="space-y-1.5 mb-4">
                    {(['A', 'B'] as const).map(side => {
                        const name = side === 'A' ? fixture.teamA : fixture.teamB;
                        const isTBDSide = name === 'TBD' || name === 'BYE';
                        const isWinner = isCompleted && fixture.winnerSide === side;
                        return (
                            <div key={side} className={`flex items-center justify-between rounded-lg px-3 py-2 ${isWinner ? 'bg-white/5' : ''}`}>
                                <span className={`font-black uppercase text-sm leading-none tracking-tight ${isTBDSide ? 'text-zinc-700 italic font-normal text-xs' : isWinner ? 'text-white' : 'text-zinc-200'}`}>
                                    {name}
                                </span>
                                {isCompleted && (
                                    <span className={`font-black tabular-nums text-sm ${isWinner ? 'text-white' : 'text-zinc-600'}`}>
                                        {side === 'A' ? (fixture.finalScore?.teamA ?? 0) : (fixture.finalScore?.teamB ?? 0)}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Actions */}
                {isCompleted ? (
                    <div className="text-center py-1 text-[9px] font-black uppercase tracking-widest text-zinc-700">
                        {fixture.winnerSide ? `${fixture.winnerSide === 'A' ? fixture.teamA : fixture.teamB} wins` : 'Complete'}
                    </div>
                ) : isLive ? (
                    <div className="space-y-2">
                        {fixture.gameCode && (
                            <button onClick={() => navigate(`/host/${fixture.gameCode}`)}
                                className="w-full py-2.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                                style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}>
                                Resume Match
                            </button>
                        )}
                        <button onClick={() => onDeclareWinner(fixture)}
                            className="w-full py-2.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500">
                            Declare Winner
                        </button>
                    </div>
                ) : isTBD ? (
                    <div className="w-full py-2.5 rounded-xl bg-zinc-900/50 text-zinc-700 text-center font-black uppercase text-xs tracking-widest border border-zinc-900">
                        Awaiting Teams
                    </div>
                ) : (
                    <button onClick={() => onStart(fixture)} disabled={!!isStarting}
                        className="w-full py-2.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50"
                        style={isStarting ? { background: '#18181b', color: '#52525b' } : { background: accent, color: '#000' }}>
                        {isStarting
                            ? <span className="flex items-center justify-center gap-2"><span className="w-3 h-3 rounded-full border border-black/30 border-t-black animate-spin" />Starting...</span>
                            : 'Start Match'}
                    </button>
                )}
            </div>
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const VolunteerConsole: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [allFixtures, setAllFixtures] = useState<TournamentFixture[]>([]);
    const [startingId, setStartingId] = useState<string | null>(null);
    const [activeDivisionId, setActiveDivisionId] = useState<string | null>(null);
    const [courtFilter, setCourtFilter] = useState('all');
    const [notAuthorized, setNotAuthorized] = useState(false);
    const [declaringFixture, setDeclaringFixture] = useState<TournamentFixture | null>(null);

    useEffect(() => {
        if (!id) return;
        if (!sessionStorage.getItem(`volunteer_pin_${id}`)) navigate(`/t/${id}`, { replace: true });
    }, [id, navigate]);

    useEffect(() => {
        if (!id) return;
        return subscribeToTournament(id, t => { if (!t) setNotAuthorized(true); else setTournament(t); });
    }, [id]);

    useEffect(() => {
        if (!id) return;
        return subscribeToFixtures(id, null, setAllFixtures);
    }, [id]);

    const publishedDivisions = useMemo<DivisionConfig[]>(() => {
        if (!tournament?.divisions) return [];
        return Object.values(tournament.divisions).filter(d => d.status === 'published' || d.status === 'completed');
    }, [tournament]);

    useEffect(() => {
        if (publishedDivisions.length > 0 && !activeDivisionId) setActiveDivisionId(publishedDivisions[0].id);
    }, [publishedDivisions, activeDivisionId]);

    const activeDivision = publishedDivisions.find(d => d.id === activeDivisionId);

    const divisionFixtures = useMemo(() =>
        allFixtures
            .filter(f => f.divisionId === activeDivisionId && !f.isBye)
            .filter(f => courtFilter === 'all' || f.court === courtFilter)
            .sort((a, b) => {
                const order = { live: 0, scheduled: 1, completed: 2 };
                const diff = (order[a.status] ?? 1) - (order[b.status] ?? 1);
                return diff !== 0 ? diff : (a.round ?? 0) - (b.round ?? 0);
            }),
        [allFixtures, activeDivisionId, courtFilter]
    );

    const allCourts = useMemo(() => {
        if (!tournament?.sportConfig || !activeDivision) return [];
        const sport = activeDivision.sport;
        const n = (tournament.sportConfig as any)[sport]?.courts ?? 1;
        return Array.from({ length: n }, (_, i) => `Court ${i + 1}`);
    }, [tournament, activeDivision]);

    const liveCount = divisionFixtures.filter(f => f.status === 'live').length;
    const scheduledCount = divisionFixtures.filter(f => f.status === 'scheduled' && f.teamA !== 'TBD' && f.teamB !== 'TBD').length;
    const completedCount = divisionFixtures.filter(f => f.status === 'completed').length;

    const handleStartMatch = async (fixture: TournamentFixture) => {
        if (!id || startingId) return;
        setStartingId(fixture.id);
        try {
            const court = fixture.court !== 'Unassigned' ? fixture.court : (allCourts[0] ?? 'Court 1');
            const gameCode = await startTournamentMatch(id, fixture.id, fixture, court);
            navigate(`/host/${gameCode}`);
        } catch (err) {
            alert((err as Error).message || 'Failed to start. Match may have been started by another scorer.');
            setStartingId(null);
        }
    };

    if (notAuthorized) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="text-center space-y-3">
                <div className="text-zinc-700 font-black uppercase text-xs tracking-widest">Access Denied</div>
                <button onClick={() => navigate(`/t/${id}`)} className="text-yellow-500 text-xs font-bold underline">Go back</button>
            </div>
        </div>
    );

    if (!tournament) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-900 border-t-yellow-500 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-xl border-b border-zinc-900">
                <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => navigate(`/t/${id}`)} className="text-zinc-600 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="min-w-0">
                            <div className="text-[8px] font-black text-yellow-500 uppercase tracking-[0.2em]">Scorer Console</div>
                            <div className="text-xs font-black italic text-white uppercase tracking-tight leading-tight truncate">{tournament.name}</div>
                        </div>
                    </div>
                    {liveCount > 0 && (
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-green-400 uppercase tracking-widest bg-green-950/40 border border-green-900/40 px-2.5 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                            {liveCount} Live
                        </div>
                    )}
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-6">
                {publishedDivisions.length === 0 && (
                    <div className="text-center py-20">
                        <div className="text-zinc-700 font-black uppercase text-xs tracking-widest">No divisions published yet</div>
                        <div className="text-zinc-800 text-[10px] font-bold mt-1">Admin needs to publish the bracket first</div>
                    </div>
                )}

                {/* Division tabs */}
                {publishedDivisions.length > 1 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        {publishedDivisions.map(div => {
                            const accent = getSportAccent(div.sport);
                            const isActive = div.id === activeDivisionId;
                            const divLive = allFixtures.filter(f => f.divisionId === div.id && f.status === 'live').length;
                            return (
                                <button key={div.id} onClick={() => { setActiveDivisionId(div.id); setCourtFilter('all'); }}
                                    className="relative px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border"
                                    style={isActive ? { background: accent, color: '#000', borderColor: accent } : { background: 'transparent', color: '#52525b', borderColor: '#27272a' }}>
                                    {getSportLabel(div.sport)} — {div.gender === 'men' ? "M" : "W"}
                                    {divLive > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-black" />}
                                </button>
                            );
                        })}
                    </div>
                )}

                {activeDivision && (
                    <>
                        {/* Court filter */}
                        {allCourts.length > 1 && (
                            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                                <span className="text-[9px] text-zinc-700 font-black uppercase tracking-widest flex-shrink-0">Court:</span>
                                {['all', ...allCourts].map(c => (
                                    <button key={c} onClick={() => setCourtFilter(c)}
                                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${courtFilter === c ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-transparent text-zinc-600 border-zinc-800 hover:text-zinc-400'}`}>
                                        {c === 'all' ? 'All' : c}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Stats strip */}
                        <div className="flex items-center gap-3 mb-5 text-[10px] font-bold uppercase tracking-widest flex-wrap">
                            <span className="text-green-400">{liveCount} Live</span>
                            <span className="text-zinc-700">·</span>
                            <span className="text-zinc-400">{scheduledCount} Ready</span>
                            <span className="text-zinc-700">·</span>
                            <span className="text-zinc-600">{completedCount} Done</span>
                            {activeDivision.champion && (
                                <><span className="text-zinc-700">·</span><span className="text-yellow-500">Champion: {activeDivision.champion}</span></>
                            )}
                        </div>

                        {/* Match grid */}
                        {divisionFixtures.length === 0 ? (
                            <div className="text-center py-12 text-zinc-700 font-bold text-xs uppercase tracking-widest border border-dashed border-zinc-900 rounded-2xl">
                                No matches for this selection
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {divisionFixtures.map(f => (
                                    <MatchCard key={f.id} fixture={f} onStart={handleStartMatch}
                                        onDeclareWinner={setDeclaringFixture} startingId={startingId} navigate={navigate} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Winner modal */}
            {declaringFixture && id && (
                <WinnerModal fixture={declaringFixture} tournamentId={id}
                    onDeclared={() => setDeclaringFixture(null)} onCancel={() => setDeclaringFixture(null)} />
            )}
        </div>
    );
};