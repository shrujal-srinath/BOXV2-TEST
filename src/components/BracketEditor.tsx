// BracketEditor.tsx - FINAL POLISHED PRODUCTION VERSION
// Theme: Tournament consistency (zinc/black/yellow + green for LIVE only)
// Specs: Yellow BYE bars, center lines shifting to winner, subtle hover states

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { TournamentFixture } from '../types';
import { updateFixtureData, advanceBracketWinner } from '../services/tournamentService';

interface Props {
    tournamentId: string;
    fixtures: TournamentFixture[];
    isAdmin: boolean;
    divisionStatus: 'setup_required' | 'draft' | 'published' | 'completed';
    isEditMode: boolean;
}

// PREMIUM CONFIGURATION
const CARD_WIDTH = 280;
const CARD_HEIGHT = 110;
const COLUMN_GAP = 180;

const calculateRowHeight = (bracketSize: number) => {
    if (bracketSize <= 8) return 200;
    if (bracketSize <= 16) return 160;
    if (bracketSize <= 32) return 120;
    return 100;
};

export const BracketEditor: React.FC<Props> = ({
    tournamentId,
    fixtures,
    isAdmin,
    divisionStatus,
    isEditMode
}) => {
    const [hoveredMatch, setHoveredMatch] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [celebratingMatch, setCelebratingMatch] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [editingTeam, setEditingTeam] = useState<{ fixtureId: string; side: 'A' | 'B' } | null>(null);
    const [editValue, setEditValue] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const bracketSize = useMemo(() => {
        const maxRound = Math.max(...fixtures.map(f => f.round || 0));
        return Math.pow(2, maxRound);
    }, [fixtures]);

    const ROW_HEIGHT = calculateRowHeight(bracketSize);
    const maxRound = useMemo(() => Math.max(...fixtures.map(f => f.round || 0)), [fixtures]);

    useEffect(() => {
        if (editingTeam && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingTeam]);

    // POSITIONING ALGORITHM
    const { matchesWithCoords, svgPaths, containerWidth, containerHeight, championMatch } = useMemo(() => {
        const rounds: { [key: number]: TournamentFixture[] } = {};
        let maxRnd = 0;

        fixtures.forEach(f => {
            if (!f.round) return;
            if (!rounds[f.round]) rounds[f.round] = [];
            rounds[f.round].push(f);
            if (f.round > maxRnd) maxRnd = f.round;
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

        for (let r = 2; r <= maxRnd; r++) {
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

        // SMART CONNECTION LINES
        // Rule: From CENTER of two teams, shift to winner after declaration
        const paths: React.ReactElement[] = [];
        fixtures.forEach(match => {
            if (!match.nextMatchId) return;
            const start = positions.get(match.id);
            const end = positions.get(match.nextMatchId);
            if (start && end) {
                const hasWinner = match.winnerSide !== undefined;
                const isBye = match.isBye;

                // Calculate center point between the two team slots
                const teamACenter = CARD_HEIGHT / 4;  // Center of Team A slot
                const teamBCenter = (CARD_HEIGHT * 3) / 4;  // Center of Team B slot
                const centerBetweenTeams = (teamACenter + teamBCenter) / 2;  // Midpoint

                // Line position logic:
                // BEFORE winner: From center between both teams
                // AFTER winner: From the winning team's center
                const startY = hasWinner || isBye
                    ? start.y + (match.winnerSide === 'A' || match.teamB === 'BYE' ? teamACenter : teamBCenter)
                    : start.y + centerBetweenTeams;

                const x1 = start.x + CARD_WIDTH;
                const y1 = startY;
                const x2 = end.x;
                const y2 = end.y + CARD_HEIGHT / 2;

                const controlPointX1 = x1 + COLUMN_GAP * 0.4;
                const controlPointX2 = x2 - COLUMN_GAP * 0.4;

                const isHovered = hoveredMatch === match.id;
                const isCompleted = match.winnerSide !== undefined;
                const isLive = match.status === 'live';

                // COLOR SCHEME: Zinc-gray + Yellow (completed) + Green (LIVE only)
                const strokeColor = isLive ? '#22c55e' :  // Green for LIVE
                    isCompleted || isBye ? '#eab308' :  // Yellow for completed
                        '#52525b';  // Zinc for default

                paths.push(
                    <path
                        key={`${match.id}-path`}
                        d={`M ${x1} ${y1} C ${controlPointX1} ${y1}, ${controlPointX2} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={2}
                        className="transition-all duration-500"
                        style={{
                            filter: isLive ? 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.5))' :
                                isCompleted ? 'drop-shadow(0 0 4px rgba(234, 179, 8, 0.3))' : 'none'
                        }}
                    />
                );
            }
        });

        const totalWidth = maxRnd * (CARD_WIDTH + COLUMN_GAP);
        const totalHeight = (rounds[1]?.length || 0) * ROW_HEIGHT;
        const finalMatch = fixtures.find(f => f.round === maxRnd);

        return {
            matchesWithCoords: Array.from(positions.entries()),
            svgPaths: paths,
            containerWidth: totalWidth,
            containerHeight: totalHeight,
            championMatch: finalMatch
        };
    }, [fixtures, hoveredMatch, ROW_HEIGHT, maxRound]);

    // ZOOM CONTROLS
    const handleZoomIn = useCallback(() => setZoom(prev => Math.min(prev + 0.15, 2)), []);
    const handleZoomOut = useCallback(() => setZoom(prev => Math.max(prev - 0.15, 0.4)), []);
    const handleZoomReset = useCallback(() => setZoom(1), []);
    const handleZoomFit = useCallback(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const scaleX = container.clientWidth / containerWidth;
        const scaleY = container.clientHeight / containerHeight;
        setZoom(Math.min(scaleX, scaleY) * 0.85);
    }, [containerWidth, containerHeight]);

    useEffect(() => {
        const timer = setTimeout(() => handleZoomFit(), 100);
        return () => clearTimeout(timer);
    }, [handleZoomFit, fixtures.length]);

    // INTERACTION LOGIC
    const canRename = isAdmin && (divisionStatus === 'draft' || isEditMode);
    const canStartGame = isAdmin && divisionStatus === 'published' && !isEditMode;

    // INLINE EDITING
    const handleStartEdit = (fixture: TournamentFixture, side: 'A' | 'B') => {
        if (!canRename || !fixture.round || fixture.round !== 1) return;

        const currentName = side === 'A' ? fixture.teamA : fixture.teamB;
        if (currentName === 'BYE') return;

        setEditingTeam({ fixtureId: fixture.id, side });
        setEditValue(currentName === 'TBD' ? '' : currentName);
    };

    const handleSaveEdit = async () => {
        if (!editingTeam) return;

        const trimmedValue = editValue.trim();
        if (!trimmedValue) {
            setEditingTeam(null);
            return;
        }

        try {
            setError(null);
            await updateFixtureData(tournamentId, editingTeam.fixtureId, {
                [editingTeam.side === 'A' ? 'teamA' : 'teamB']: trimmedValue
            });
            setEditingTeam(null);
            setEditValue('');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Update failed';
            setError(message);
        }
    };

    const handleCancelEdit = () => {
        setEditingTeam(null);
        setEditValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    const handleTeamClick = async (fixture: TournamentFixture, side: 'A' | 'B') => {
        if (fixture.isBye && side === 'B') return;

        if (canRename && fixture.round === 1) {
            handleStartEdit(fixture, side);
            return;
        }

        if (canStartGame) {
            const teamName = side === 'A' ? fixture.teamA : fixture.teamB;
            if (teamName === 'TBD' || teamName === 'BYE') return;

            if (window.confirm(`🏆 DECLARE WINNER?\n\n${teamName} advances to next round`)) {
                try {
                    setError(null);
                    await advanceBracketWinner(tournamentId, fixture, side);

                    setCelebratingMatch(fixture.id);
                    setTimeout(() => setCelebratingMatch(null), 2000);
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Advancement failed';
                    setError(message);
                }
            }
        }
    };

    return (
        <div className="relative w-full h-full bg-gradient-to-br from-black via-zinc-950 to-black overflow-hidden">
            {/* BACKGROUND EFFECTS */}
            <div className="absolute inset-0 opacity-30 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px]" />
            </div>

            {/* GRID OVERLAY */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            />

            {/* ERROR BANNER */}
            {error && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/10 border border-red-500/50 backdrop-blur-xl px-6 py-3 rounded-full animate-pulse">
                    <p className="text-red-400 text-sm font-bold">⚠️ {error}</p>
                </div>
            )}

            {/* CHAMPION TROPHY */}
            {championMatch?.winnerSide && (
                <div className="absolute top-8 right-8 z-40 bg-yellow-500/10 border border-yellow-500/30 backdrop-blur-xl rounded-2xl p-6 animate-pulse">
                    <div className="text-center">
                        <div className="text-5xl mb-2">🏆</div>
                        <p className="text-yellow-400 font-black text-xl tracking-wider">CHAMPION</p>
                        <p className="text-white text-2xl font-black mt-2">
                            {championMatch.winnerSide === 'A' ? championMatch.teamA : championMatch.teamB}
                        </p>
                    </div>
                </div>
            )}

            {/* ZOOM CONTROLS */}
            <div className="absolute top-6 right-6 z-30 flex flex-col gap-2">
                <button
                    onClick={handleZoomIn}
                    className="w-11 h-11 bg-zinc-900/90 border border-zinc-700 hover:border-yellow-500 rounded-lg flex items-center justify-center text-white font-bold transition-all hover:bg-zinc-800 hover:scale-110 active:scale-95"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
                <button
                    onClick={handleZoomOut}
                    className="w-11 h-11 bg-zinc-900/90 border border-zinc-700 hover:border-yellow-500 rounded-lg flex items-center justify-center text-white font-bold transition-all hover:bg-zinc-800 hover:scale-110 active:scale-95"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                </button>
                <button
                    onClick={handleZoomReset}
                    className="w-11 h-11 bg-zinc-900/90 border border-zinc-700 hover:border-yellow-500 rounded-lg flex items-center justify-center text-white text-xs font-black transition-all hover:bg-zinc-800 hover:scale-110 active:scale-95"
                >
                    1:1
                </button>
                <button
                    onClick={handleZoomFit}
                    className="w-11 h-11 bg-zinc-900/90 border border-zinc-700 hover:border-yellow-500 rounded-lg flex items-center justify-center text-white transition-all hover:bg-zinc-800 hover:scale-110 active:scale-95"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                    </svg>
                </button>
                <div className="mt-1 text-center text-[10px] text-zinc-500 font-mono font-bold">
                    {Math.round(zoom * 100)}%
                </div>
            </div>

            {/* MINIMAP */}
            <div className="absolute bottom-6 right-6 z-30 w-64 h-40 bg-zinc-900/95 border border-zinc-700 rounded-lg overflow-hidden shadow-2xl">
                <svg
                    viewBox={`0 0 ${containerWidth} ${containerHeight}`}
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {matchesWithCoords.map(([id, pos]) => {
                        const match = fixtures.find(f => f.id === id);
                        const isCompleted = match?.winnerSide !== undefined;
                        const isLive = match?.status === 'live';
                        return (
                            <rect
                                key={id}
                                x={pos.x}
                                y={pos.y}
                                width={CARD_WIDTH}
                                height={CARD_HEIGHT}
                                fill={isLive ? '#22c55e' : isCompleted ? '#eab308' : '#3f3f46'}
                                stroke="#52525b"
                                strokeWidth="3"
                                opacity={isLive ? 0.9 : isCompleted ? 0.7 : 0.4}
                            />
                        );
                    })}
                    <g opacity="0.2">{svgPaths.map((path, idx) => <g key={idx}>{path}</g>)}</g>
                </svg>
                <div className="absolute top-2 left-2 text-[9px] text-zinc-400 font-bold uppercase tracking-widest bg-black/50 px-2 py-1 rounded">
                    Overview
                </div>
            </div>

            {/* SCROLLABLE BRACKET CANVAS */}
            <div
                ref={containerRef}
                className="w-full h-full overflow-auto scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700 hover:scrollbar-thumb-zinc-600 p-12"
            >
                <div
                    className="origin-top-left transition-transform duration-500 ease-out"
                    style={{
                        transform: `scale(${zoom})`,
                        width: Math.max(containerWidth + 200, 1000),
                        height: Math.max(containerHeight + 200, 800),
                        minHeight: '100%'
                    }}
                >
                    <div className="relative w-full h-full">
                        {/* SVG CONNECTION LINES */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                            {svgPaths}
                        </svg>

                        {/* MATCH CARDS */}
                        {matchesWithCoords.map(([id, pos]) => {
                            const match = fixtures.find(f => f.id === id);
                            if (!match) return null;

                            const isFinal = match.round === maxRound;
                            const isRound1 = match.round === 1;
                            const isHovered = hoveredMatch === match.id;
                            const isCelebrating = celebratingMatch === match.id;
                            const isLive = match.status === 'live';
                            const isCompleted = match.status === 'completed';
                            const isDraft = divisionStatus === 'draft';
                            const canEdit = isRound1 && canRename;

                            const isEditingA = editingTeam?.fixtureId === match.id && editingTeam.side === 'A';
                            const isEditingB = editingTeam?.fixtureId === match.id && editingTeam.side === 'B';

                            return (
                                <div
                                    key={id}
                                    className={`absolute transition-all duration-500 ${isFinal ? 'scale-110' : ''
                                        } ${isCelebrating ? 'animate-bounce' : ''} ${match.isBye ? 'opacity-40' : ''}`}
                                    style={{
                                        left: pos.x,
                                        top: pos.y,
                                        width: CARD_WIDTH,
                                        height: CARD_HEIGHT,
                                        zIndex: isHovered ? 20 : 10
                                    }}
                                    onMouseEnter={() => setHoveredMatch(match.id)}
                                    onMouseLeave={() => setHoveredMatch(null)}
                                >
                                    <div className={`
                                        relative w-full h-full rounded-xl overflow-hidden backdrop-blur-md
                                        ${isDraft && isRound1 ? 'border-2 border-dashed border-yellow-500/40' :
                                            isLive ? 'border-2 border-green-500' :
                                                isCompleted ? 'border border-yellow-500/30' :
                                                    'border border-zinc-700/50'}
                                        ${isHovered ? 'shadow-2xl shadow-blue-500/20 scale-105' : 'shadow-xl'}
                                        ${isFinal ? 'shadow-2xl shadow-yellow-500/30' : ''}
                                        transition-all duration-300
                                    `}>
                                        {/* YELLOW ACCENT BAR FOR BYE MATCHES */}
                                        {match.isBye && (
                                            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 z-20" />
                                        )}

                                        <div className={`absolute inset-0 ${isLive ? 'bg-gradient-to-br from-green-950/80 via-zinc-900/90 to-zinc-950/90' :
                                            isCompleted ? 'bg-gradient-to-br from-zinc-900/90 via-zinc-900/95 to-zinc-950/95' :
                                                'bg-gradient-to-br from-zinc-900/70 via-zinc-900/80 to-zinc-950/90'
                                            }`} />

                                        {isLive && <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-green-500/5 to-transparent" />}

                                        <div className="relative z-10 flex flex-col h-full">
                                            {/* HEADER */}
                                            <div className="px-4 py-2 flex items-center justify-between border-b border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono text-zinc-500 tracking-widest">
                                                        R{match.round} • #{(match.matchNumber || 0) + 1}
                                                    </span>
                                                    {isFinal && <span className="text-lg">🏆</span>}
                                                </div>
                                                <div className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${isLive ? 'bg-green-500/20 text-green-400 animate-pulse' :
                                                    match.isBye ? 'bg-yellow-500/20 text-yellow-500' :
                                                        isCompleted ? 'bg-yellow-500/20 text-yellow-500' :
                                                            'bg-zinc-800/50 text-zinc-500'
                                                    }`}>
                                                    {match.isBye ? 'BYE' : match.status}
                                                </div>
                                            </div>

                                            {/* TEAMS */}
                                            <div className="flex-1 flex flex-col">
                                                {/* TEAM A */}
                                                <div
                                                    onClick={() => !isEditingA && handleTeamClick(match, 'A')}
                                                    className={`flex-1 px-4 flex items-center justify-between border-b border-white/5 transition-all duration-200
                                                        ${(canEdit || canStartGame) && match.teamA !== 'BYE' && !isEditingA ? 'cursor-pointer hover:bg-yellow-500/5' : ''}
                                                        ${match.winnerSide === 'A' ? 'bg-yellow-500/10' : ''}`}
                                                >
                                                    {isEditingA ? (
                                                        <input
                                                            ref={inputRef}
                                                            type="text"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onKeyDown={handleKeyDown}
                                                            onBlur={handleSaveEdit}
                                                            className="flex-1 bg-black border-2 border-yellow-500 text-white text-sm font-bold uppercase px-2 py-1 rounded outline-none shadow-lg"
                                                            placeholder="Enter team name"
                                                            maxLength={30}
                                                        />
                                                    ) : (
                                                        <>
                                                            <span className={`text-sm font-black uppercase tracking-wide truncate ${match.teamA === 'TBD' ? 'text-zinc-600 italic font-normal' :
                                                                match.winnerSide === 'A' ? 'text-yellow-400' :
                                                                    'text-zinc-100'
                                                                }`}>
                                                                {match.teamA}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                {canEdit && match.teamA !== 'BYE' && <span className="text-[8px] text-yellow-500 font-bold">EDIT</span>}
                                                                {match.winnerSide === 'A' && <span className="text-yellow-500 text-sm">✓</span>}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                {/* TEAM B */}
                                                <div
                                                    onClick={() => !isEditingB && match.teamB !== 'BYE' && handleTeamClick(match, 'B')}
                                                    className={`flex-1 px-4 flex items-center justify-between transition-all duration-200
                                                        ${(canEdit || canStartGame) && match.teamB !== 'BYE' && !isEditingB ? 'cursor-pointer hover:bg-yellow-500/5' : ''}
                                                        ${match.winnerSide === 'B' ? 'bg-yellow-500/10' : ''}`}
                                                >
                                                    {isEditingB ? (
                                                        <input
                                                            ref={inputRef}
                                                            type="text"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onKeyDown={handleKeyDown}
                                                            onBlur={handleSaveEdit}
                                                            className="flex-1 bg-black border-2 border-yellow-500 text-white text-sm font-bold uppercase px-2 py-1 rounded outline-none shadow-lg"
                                                            placeholder="Enter team name"
                                                            maxLength={30}
                                                        />
                                                    ) : (
                                                        <>
                                                            <span className={`text-sm font-black uppercase tracking-wide truncate ${match.teamB === 'TBD' || match.teamB === 'BYE' ? 'text-zinc-600 italic font-normal' :
                                                                match.winnerSide === 'B' ? 'text-yellow-400' :
                                                                    'text-zinc-100'
                                                                }`}>
                                                                {match.teamB}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                {canEdit && match.teamB !== 'BYE' && <span className="text-[8px] text-yellow-500 font-bold">EDIT</span>}
                                                                {match.winnerSide === 'B' && <span className="text-yellow-500 text-sm">✓</span>}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {isLive && <div className="absolute inset-0 pointer-events-none"><div className="absolute inset-0 rounded-xl bg-green-500/5 animate-pulse" /></div>}
                                        {!isRound1 && <div className="absolute top-2 right-2 opacity-10">
                                            <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* LEGEND */}
            <div className="absolute bottom-8 left-8 flex gap-4 text-xs text-zinc-500">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span>Live</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500" /><span>Completed</span></div>
                {canRename && <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-dashed border-yellow-500/40" /><span>Round 1 - Click to Edit</span></div>}
            </div>
        </div>
    );
};