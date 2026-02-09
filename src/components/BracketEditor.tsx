import React, { useMemo } from 'react';
import type { TournamentFixture } from '../types';
import { updateFixtureData, advanceBracketWinner } from '../services/tournamentService';

interface Props {
    tournamentId: string;
    fixtures: TournamentFixture[];
    isAdmin: boolean;
    divisionStatus: 'setup_required' | 'draft' | 'published' | 'completed';
    isEditMode: boolean; // God mode passed down from parent
}

// CONFIGURATION
const CARD_WIDTH = 220;
const CARD_HEIGHT = 86;
const GAP_Y = 20;
const COLUMN_GAP = 100;
const ROW_HEIGHT = CARD_HEIGHT + GAP_Y;

export const BracketEditor: React.FC<Props> = ({ tournamentId, fixtures, isAdmin, divisionStatus, isEditMode }) => {

    // 1. POSITIONING LOGIC (Keep existing)
    const { matchesWithCoords, svgPaths, containerWidth, containerHeight } = useMemo(() => {
        const rounds: { [key: number]: TournamentFixture[] } = {};
        let maxRound = 0;

        fixtures.forEach(f => {
            if (!f.round) return;
            if (!rounds[f.round]) rounds[f.round] = [];
            rounds[f.round].push(f);
            if (f.round > maxRound) maxRound = f.round;
        });

        Object.keys(rounds).forEach(r => {
            rounds[Number(r)].sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
        });

        const positions = new Map<string, { x: number, y: number }>();

        const round1 = rounds[1] || [];
        round1.forEach(match => {
            const x = 0;
            const y = (match.matchNumber || 0) * ROW_HEIGHT;
            positions.set(match.id, { x, y });
        });

        for (let r = 2; r <= maxRound; r++) {
            const currentRoundMatches = rounds[r] || [];
            currentRoundMatches.forEach(match => {
                const x = (r - 1) * (CARD_WIDTH + COLUMN_GAP);

                const childA_Index = (match.matchNumber || 0) * 2;
                const childB_Index = (match.matchNumber || 0) * 2 + 1;

                const prevRoundMatches = rounds[r - 1] || [];
                const feederA = prevRoundMatches.find(m => m.matchNumber === childA_Index);
                const feederB = prevRoundMatches.find(m => m.matchNumber === childB_Index);

                if (feederA && feederB) {
                    const posA = positions.get(feederA.id);
                    const posB = positions.get(feederB.id);
                    if (posA && posB) {
                        const y = (posA.y + posB.y) / 2;
                        positions.set(match.id, { x, y });
                    }
                } else {
                    positions.set(match.id, { x, y: 0 });
                }
            });
        }

        const paths: JSX.Element[] = [];
        fixtures.forEach(match => {
            if (!match.nextMatchId) return;
            const start = positions.get(match.id);
            const end = positions.get(match.nextMatchId);
            if (start && end) {
                const x1 = start.x + CARD_WIDTH;
                const y1 = start.y + CARD_HEIGHT / 2;
                const x2 = end.x;
                const y2 = end.y + CARD_HEIGHT / 2;
                const controlPointX = (x1 + x2) / 2;

                paths.push(
                    <path
                        key={`${match.id}-path`}
                        d={`M ${x1} ${y1} C ${controlPointX} ${y1}, ${controlPointX} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke={match.winnerSide ? '#22c55e' : '#52525b'}
                        strokeWidth="2"
                        className="transition-colors duration-500"
                    />
                );
            }
        });

        const totalWidth = maxRound * (CARD_WIDTH + COLUMN_GAP);
        const totalHeight = (rounds[1]?.length || 0) * ROW_HEIGHT;

        return { matchesWithCoords: Array.from(positions.entries()), svgPaths: paths, containerWidth: totalWidth, containerHeight: totalHeight };
    }, [fixtures]);

    // 2. INTERACTION LOGIC

    // Allow rename if: (Admin) AND (Draft Mode OR (Published AND EditMode))
    const canRename = isAdmin && (divisionStatus === 'draft' || isEditMode);

    // Allow game start if: (Admin) AND (Published) AND (Not EditMode)
    const canStartGame = isAdmin && divisionStatus === 'published' && !isEditMode;

    const handleTeamClick = async (fixture: TournamentFixture, side: 'A' | 'B') => {
        if (fixture.isBye) return;

        // SCENARIO 1: SETUP (Rename)
        if (canRename) {
            const currentName = side === 'A' ? fixture.teamA : fixture.teamB;
            if (currentName === 'BYE') return;

            const newName = prompt(`RENAME TEAM ${side} (Round ${fixture.round}):`, currentName !== 'TBD' ? currentName : "");

            if (newName && newName !== currentName) {
                await updateFixtureData(tournamentId, fixture.id, {
                    [side === 'A' ? 'teamA' : 'teamB']: newName
                });
            }
            return;
        }

        // SCENARIO 2: LIVE (Advance / Start)
        if (canStartGame) {
            const teamName = side === 'A' ? fixture.teamA : fixture.teamB;
            if (teamName === 'TBD' || teamName === 'BYE') return;

            // If it's the final or just advancing manually
            if (window.confirm(`Declare ${teamName} the winner of Match #${fixture.matchNumber! + 1}?`)) {
                await advanceBracketWinner(tournamentId, fixture, side);
            }
        }
    };

    return (
        <div className="w-full h-full overflow-auto bg-zinc-950/30 p-10 cursor-grab active:cursor-grabbing">
            <div
                className="relative"
                style={{ width: Math.max(containerWidth, 800), height: Math.max(containerHeight, 600) }}
            >
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    {svgPaths}
                </svg>

                {matchesWithCoords.map(([id, pos]) => {
                    const match = fixtures.find(f => f.id === id);
                    if (!match) return null;

                    // Visual Style based on Mode
                    const borderStyle = divisionStatus === 'draft'
                        ? 'border-dashed border-yellow-800'
                        : match.status === 'live'
                            ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                            : 'border-zinc-800';

                    return (
                        <div
                            key={id}
                            className={`absolute flex flex-col justify-center transition-all duration-300 ${match.isBye ? 'opacity-50 grayscale' : ''}`}
                            style={{ left: pos.x, top: pos.y, width: CARD_WIDTH, height: CARD_HEIGHT }}
                        >
                            <div className={`bg-zinc-900 border rounded-lg overflow-hidden w-full shadow-lg z-10 ${borderStyle}`}>
                                <div className="bg-zinc-950 px-3 py-1 flex justify-between items-center border-b border-zinc-800">
                                    <span className="text-[9px] text-zinc-500 font-mono">#{match.matchNumber! + 1}</span>
                                    <span className={`text-[9px] font-bold uppercase ${match.status === 'live' ? 'text-green-500 animate-pulse' : 'text-zinc-600'}`}>
                                        {match.isBye ? 'AUTO' : match.status}
                                    </span>
                                </div>

                                <div className="flex flex-col">
                                    {/* Team A */}
                                    <div
                                        onClick={() => handleTeamClick(match, 'A')}
                                        className={`px-3 py-1.5 flex justify-between items-center cursor-pointer hover:bg-zinc-800 transition-colors border-b border-zinc-800/30 ${match.winnerSide === 'A' ? 'bg-green-900/20' : ''}`}
                                    >
                                        <span className={`text-xs truncate font-bold uppercase ${match.teamA === 'TBD' ? 'text-zinc-600 italic' : match.winnerSide === 'A' ? 'text-green-400' : 'text-zinc-200'}`}>
                                            {match.teamA}
                                        </span>
                                        {canRename && <span className="text-[8px] text-yellow-600">EDIT</span>}
                                        {match.winnerSide === 'A' && <span className="text-green-500 text-[10px]">✔</span>}
                                    </div>

                                    {/* Team B */}
                                    <div
                                        onClick={() => handleTeamClick(match, 'B')}
                                        className={`px-3 py-1.5 flex justify-between items-center cursor-pointer hover:bg-zinc-800 transition-colors ${match.winnerSide === 'B' ? 'bg-green-900/20' : ''}`}
                                    >
                                        <span className={`text-xs truncate font-bold uppercase ${match.teamB === 'TBD' ? 'text-zinc-600 italic' : match.winnerSide === 'B' ? 'text-green-400' : 'text-zinc-200'}`}>
                                            {match.teamB}
                                        </span>
                                        {canRename && <span className="text-[8px] text-yellow-600">EDIT</span>}
                                        {match.winnerSide === 'B' && <span className="text-green-500 text-[10px]">✔</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};