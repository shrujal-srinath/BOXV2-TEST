// src/components/FixtureListView.tsx
// PREMIUM FIXTURE LIST WITH FILTERS
// Zero risk - Isolated new component

import React, { useState, useMemo } from 'react';
import type { TournamentFixture } from '../types';

interface Props {
    fixtures: TournamentFixture[];
    onStartScoring: (fixture: TournamentFixture) => void;
    canStartGames: boolean;
}

type FilterType = 'all' | 'scheduled' | 'live' | 'completed';

export const FixtureListView: React.FC<Props> = ({ fixtures, onStartScoring, canStartGames }) => {
    const [filter, setFilter] = useState<FilterType>('all');

    // Filter fixtures
    const filteredFixtures = useMemo(() => {
        if (filter === 'all') return fixtures;
        return fixtures.filter(f => f.status === filter);
    }, [fixtures, filter]);

    // Count by status
    const counts = useMemo(() => {
        return {
            all: fixtures.length,
            scheduled: fixtures.filter(f => f.status === 'scheduled').length,
            live: fixtures.filter(f => f.status === 'live').length,
            completed: fixtures.filter(f => f.status === 'completed').length
        };
    }, [fixtures]);

    const getStatusBadge = (status: TournamentFixture['status']) => {
        switch (status) {
            case 'live':
                return (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-full animate-pulse">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                        <span className="text-xs font-black uppercase tracking-wider text-green-400">Live</span>
                    </div>
                );
            case 'completed':
                return (
                    <div className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-full">
                        <span className="text-xs font-black uppercase tracking-wider text-yellow-400">Completed</span>
                    </div>
                );
            default:
                return (
                    <div className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full">
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Scheduled</span>
                    </div>
                );
        }
    };

    const getSportIcon = (sport: string) => {
        switch (sport) {
            case 'basketball': return '🏀';
            case 'badminton': return '🏸';
            case 'volleyball': return '🏐';
            case 'kabaddi': return '🤼';
            case 'tabletennis': return '🏓';
            default: return '⚽';
        }
    };

    if (fixtures.length === 0) {
        return (
            <div className="border-2 border-dashed border-zinc-800 rounded-2xl p-16 text-center">
                <div className="text-6xl mb-4 opacity-20">📋</div>
                <p className="text-zinc-600 font-bold uppercase tracking-wider text-sm">
                    No matches scheduled yet
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* FILTERS */}
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
                {(['all', 'scheduled', 'live', 'completed'] as FilterType[]).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`
                            px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-wider transition-all
                            ${filter === f
                                ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                                : 'bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800 hover:text-white'
                            }
                        `}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-black ${filter === f ? 'bg-black/20 text-black' : 'bg-zinc-900 text-zinc-600'
                            }`}>
                            {counts[f]}
                        </span>
                    </button>
                ))}
            </div>

            {/* FIXTURE LIST */}
            <div className="space-y-3">
                {filteredFixtures.length === 0 ? (
                    <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center">
                        <p className="text-zinc-600 font-bold uppercase tracking-wider text-sm">
                            No {filter !== 'all' ? filter : ''} matches
                        </p>
                    </div>
                ) : (
                    filteredFixtures.map(fixture => (
                        <div
                            key={fixture.id}
                            className={`
                                bg-zinc-900/50 border rounded-xl p-6 transition-all duration-300 hover:bg-zinc-900
                                ${fixture.status === 'live' ? 'border-green-500/50 shadow-lg shadow-green-500/10' : 'border-zinc-800 hover:border-zinc-700'}
                            `}
                        >
                            <div className="flex items-center justify-between gap-6">
                                {/* LEFT: Match Info */}
                                <div className="flex items-center gap-6 flex-1">
                                    {/* Sport Icon */}
                                    <div className="text-4xl">
                                        {getSportIcon(fixture.sport)}
                                    </div>

                                    {/* Teams */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-4 mb-2">
                                            <span className={`text-xl font-black uppercase tracking-wide ${fixture.winnerSide === 'A' ? 'text-yellow-400' : 'text-white'
                                                }`}>
                                                {fixture.teamA}
                                            </span>
                                            {fixture.winnerSide === 'A' && <span className="text-yellow-500 text-xl">🏆</span>}
                                        </div>

                                        <div className="text-sm text-zinc-600 font-bold uppercase tracking-wider mb-2">VS</div>

                                        <div className="flex items-center gap-4">
                                            <span className={`text-xl font-black uppercase tracking-wide ${fixture.winnerSide === 'B' ? 'text-yellow-400' : 'text-white'
                                                }`}>
                                                {fixture.teamB}
                                            </span>
                                            {fixture.winnerSide === 'B' && <span className="text-yellow-500 text-xl">🏆</span>}
                                        </div>
                                    </div>

                                    {/* Match Details */}
                                    <div className="text-right">
                                        <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">
                                            {fixture.round && `Round ${fixture.round}`}
                                            {fixture.matchNumber !== undefined && ` • Match ${fixture.matchNumber + 1}`}
                                        </div>
                                        {fixture.court !== 'Unassigned' && (
                                            <div className="text-xs text-zinc-600 font-bold uppercase tracking-wider">
                                                📍 {fixture.court}
                                            </div>
                                        )}
                                        {fixture.time !== 'Pending' && (
                                            <div className="text-xs text-zinc-600 font-bold uppercase tracking-wider">
                                                🕐 {fixture.time}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* RIGHT: Status & Actions */}
                                <div className="flex items-center gap-4">
                                    {/* Status Badge */}
                                    {getStatusBadge(fixture.status)}

                                    {/* Action Button */}
                                    {canStartGames && fixture.status === 'scheduled' && !fixture.isBye && (
                                        <button
                                            onClick={() => onStartScoring(fixture)}
                                            className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase text-sm tracking-wider rounded-lg transition-all hover:scale-105 shadow-lg shadow-yellow-500/20"
                                        >
                                            ▶ Start Scoring
                                        </button>
                                    )}

                                    {canStartGames && fixture.status === 'live' && fixture.gameCode && (
                                        <button
                                            onClick={() => onStartScoring(fixture)}
                                            className="px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-black uppercase text-sm tracking-wider rounded-lg transition-all hover:scale-105 shadow-lg shadow-green-500/20 animate-pulse"
                                        >
                                            ↗ Resume Match
                                        </button>
                                    )}

                                    {fixture.isBye && (
                                        <div className="px-6 py-3 bg-zinc-800 text-zinc-600 font-black uppercase text-sm tracking-wider rounded-lg">
                                            BYE Match
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Final Score (if completed) */}
                            {fixture.status === 'completed' && fixture.finalScore && (
                                <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
                                    <div className="text-xs text-zinc-600 font-bold uppercase tracking-widest">
                                        Final Score
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`text-2xl font-black ${fixture.winnerSide === 'A' ? 'text-yellow-400' : 'text-zinc-600'
                                            }`}>
                                            {fixture.finalScore.teamA}
                                        </span>
                                        <span className="text-zinc-700 font-black">-</span>
                                        <span className={`text-2xl font-black ${fixture.winnerSide === 'B' ? 'text-yellow-400' : 'text-zinc-600'
                                            }`}>
                                            {fixture.finalScore.teamB}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};