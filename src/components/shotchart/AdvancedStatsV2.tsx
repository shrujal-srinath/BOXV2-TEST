// src/components/shotchart/AdvancedStatsV2.tsx
// ═════════════════════════════════════════════════════════════════════════════
// THE BOX — Advanced Stats V2 (UNIFIED)
//
// ONE FILE, THREE LAYOUTS:
// - Desktop/Tablet (≥768px width): 3-panel horizontal
// - Phone Landscape (<768px, width > height): 3-panel compact
// - Phone Portrait (<768px, height > width): Vertical stack
//
// Auto-detects layout and renders appropriate UI
// ═════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { HalfCourt } from './HalfCourt';
import { classifyZone } from './courtZones';
import type {
    ShotEvent, ShotAttribute, ShotZoneId, ShotType, GameActionType,
} from './types/shotTypes';
import type { Player } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdvancedStatsV2Props {
    teamAName: string;
    teamAColor: string;
    teamAPlayers: Player[];
    teamBName: string;
    teamBColor: string;
    teamBPlayers: Player[];
    onScoreChange: (team: 'A' | 'B', points: number) => void;
    onShotRecorded: (shot: {
        teamSide: 'A' | 'B';
        playerId: string | null;
        points: 1 | 2 | 3;
        made: boolean;
        shotType: ShotType;
        x: number | null;
        y: number | null;
        zone: ShotZoneId;
        attributes: ShotAttribute[];
    }) => void;
    onSecondaryAction: (team: 'A' | 'B', action: GameActionType) => void;
    existingShots: ShotEvent[];
    period: number;
    gameClockSec: number;
}

interface PendingShot {
    x: number;
    y: number;
    zone: ShotZoneId;
    teamSide: 'A' | 'B';
    playerId: string | null;
    points: 1 | 2 | 3;
    shotType: ShotType;
}

interface RecentShot {
    id: string;
    teamSide: 'A' | 'B';
    playerName: string;
    points: 1 | 2 | 3;
    made: boolean;
}

type LayoutMode = 'desktop' | 'landscape' | 'portrait';

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export const AdvancedStatsV2: React.FC<AdvancedStatsV2Props> = (props) => {
    const {
        teamAName, teamAColor, teamAPlayers,
        teamBName, teamBColor, teamBPlayers,
        onScoreChange, onShotRecorded, onSecondaryAction,
        existingShots, period, gameClockSec,
    } = props;

    // ── Responsive Layout Detection ───────────────────────────────────────────

    const [layout, setLayout] = useState<LayoutMode>(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w >= 768) return 'desktop';
        return w > h ? 'landscape' : 'portrait';
    });

    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            if (w >= 768) setLayout('desktop');
            else setLayout(w > h ? 'landscape' : 'portrait');
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', () => {
            setTimeout(handleResize, 100);
        });

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, []);

    // ── Shared State (used by all layouts) ────────────────────────────────────

    const [selectedPlayerA, setSelectedPlayerA] = useState<string | null>(null);
    const [selectedPlayerB, setSelectedPlayerB] = useState<string | null>(null);
    const [pendingShot, setPendingShot] = useState<PendingShot | null>(null);
    const [recentShots, setRecentShots] = useState<RecentShot[]>([]);
    const [activeTeam, setActiveTeam] = useState<'A' | 'B'>('A'); // For portrait only

    // ── Helpers ───────────────────────────────────────────────────────────────

    const getPlayingFive = (team: 'A' | 'B'): Player[] => {
        const roster = team === 'A' ? teamAPlayers : teamBPlayers;
        return roster.filter(p => p.name).slice(0, 5);
    };

    const getSelectedPlayer = (team: 'A' | 'B'): Player | null => {
        const playerId = team === 'A' ? selectedPlayerA : selectedPlayerB;
        const roster = team === 'A' ? teamAPlayers : teamBPlayers;
        return roster.find(p => p.id === playerId) || null;
    };

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleCourtTap = useCallback((x: number, y: number) => {
        const teamSide: 'A' | 'B' = layout === 'portrait' ? activeTeam : (x < 50 ? 'A' : 'B');
        const zone = classifyZone(x, y);

        let shotType: ShotType = 'field_goal';
        let points: 1 | 2 | 3 = 2;

        if (zone === 'free_throw_line') {
            shotType = 'free_throw';
            points = 1;
        } else if (zone.includes('three') || zone.includes('corner')) {
            points = 3;
        }

        const playerId = teamSide === 'A' ? selectedPlayerA : selectedPlayerB;

        setPendingShot({ x, y, zone, teamSide, playerId, points, shotType });
    }, [selectedPlayerA, selectedPlayerB, activeTeam, layout]);

    const handleConfirmMade = useCallback(() => {
        if (!pendingShot) return;

        const player = getSelectedPlayer(pendingShot.teamSide);

        onShotRecorded({
            teamSide: pendingShot.teamSide,
            playerId: pendingShot.playerId,
            points: pendingShot.points,
            made: true,
            shotType: pendingShot.shotType,
            x: pendingShot.x,
            y: pendingShot.y,
            zone: pendingShot.zone,
            attributes: [],
        });

        onScoreChange(pendingShot.teamSide, pendingShot.points);

        setRecentShots(prev => [...prev.slice(-2), {
            id: `shot-${Date.now()}`,
            teamSide: pendingShot.teamSide,
            playerName: player?.name || 'Unknown',
            points: pendingShot.points,
            made: true,
        }]);

        setPendingShot(null);
    }, [pendingShot, onShotRecorded, onScoreChange]);

    const handleConfirmMiss = useCallback(() => {
        if (!pendingShot) return;

        const player = getSelectedPlayer(pendingShot.teamSide);

        onShotRecorded({
            teamSide: pendingShot.teamSide,
            playerId: pendingShot.playerId,
            points: pendingShot.points,
            made: false,
            shotType: pendingShot.shotType,
            x: pendingShot.x,
            y: pendingShot.y,
            zone: pendingShot.zone,
            attributes: [],
        });

        setRecentShots(prev => [...prev.slice(-2), {
            id: `shot-${Date.now()}`,
            teamSide: pendingShot.teamSide,
            playerName: player?.name || 'Unknown',
            points: pendingShot.points,
            made: false,
        }]);

        setPendingShot(null);
    }, [pendingShot, onShotRecorded]);

    const handleQuickScore = useCallback((team: 'A' | 'B', points: 1 | 2 | 3) => {
        const playerId = team === 'A' ? selectedPlayerA : selectedPlayerB;
        const player = getSelectedPlayer(team);

        onShotRecorded({
            teamSide: team,
            playerId,
            points,
            made: true,
            shotType: points === 1 ? 'free_throw' : 'field_goal',
            x: null,
            y: null,
            zone: 'unlocated',
            attributes: [],
        });

        onScoreChange(team, points);

        setRecentShots(prev => [...prev.slice(-2), {
            id: `shot-${Date.now()}`,
            teamSide: team,
            playerName: player?.name || 'Unknown',
            points,
            made: true,
        }]);
    }, [selectedPlayerA, selectedPlayerB, onShotRecorded, onScoreChange]);

    const handleUndoShot = useCallback((shotId: string) => {
        setRecentShots(prev => prev.filter(s => s.id !== shotId));
    }, []);

    const courtDots = useMemo(() => {
        return existingShots
            .filter(s => s.zone !== 'unlocated')
            .map(s => ({
                id: s.id,
                x: s.x,
                y: s.y,
                made: s.made,
                points: s.points as 1 | 2 | 3,
            }));
    }, [existingShots]);

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: Choose layout based on screen size
    // ═════════════════════════════════════════════════════════════════════════

    const sharedProps = {
        pendingShot,
        recentShots,
        courtDots,
        selectedPlayerA,
        selectedPlayerB,
        setSelectedPlayerA,
        setSelectedPlayerB,
        handleCourtTap,
        handleConfirmMade,
        handleConfirmMiss,
        handleQuickScore,
        handleUndoShot,
        getPlayingFive,
        period,
        gameClockSec,
    };

    if (layout === 'portrait') {
        return (
            <PortraitLayout
                {...props}
                {...sharedProps}
                activeTeam={activeTeam}
                setActiveTeam={setActiveTeam}
            />
        );
    }

    if (layout === 'landscape') {
        return <LandscapeLayout {...props} {...sharedProps} />;
    }

    return <DesktopLayout {...props} {...sharedProps} />;
};

// ═════════════════════════════════════════════════════════════════════════════
// DESKTOP LAYOUT (≥768px)
// ═════════════════════════════════════════════════════════════════════════════

const DesktopLayout: React.FC<any> = ({
    teamAName, teamAColor, teamBName, teamBColor,
    pendingShot, recentShots, courtDots,
    selectedPlayerA, selectedPlayerB,
    setSelectedPlayerA, setSelectedPlayerB,
    handleCourtTap, handleConfirmMade, handleConfirmMiss,
    handleQuickScore, handleUndoShot, getPlayingFive,
    onSecondaryAction, period, gameClockSec,
}) => (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-zinc-950 border-b border-zinc-900 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">Advanced Stats</div>
                <div className="text-xs text-zinc-500">Q{period} · {Math.floor(gameClockSec / 60)}:{(gameClockSec % 60).toString().padStart(2, '0')}</div>
            </div>
            <div className="flex gap-2">
                {recentShots.map((shot: any) => (
                    <button key={shot.id} onClick={() => handleUndoShot(shot.id)}
                        className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 group">
                        <span className={shot.made ? 'text-green-500' : 'text-red-500'}>{shot.made ? '✓' : '✗'}</span>
                        <span className="text-white">{shot.playerName} +{shot.points}</span>
                        <span className="text-zinc-600 group-hover:text-red-500 ml-1">✕</span>
                    </button>
                ))}
            </div>
        </div>

        {/* 3-Panel Layout */}
        <div className="flex-1 flex overflow-hidden">
            <TeamPanel side="A" teamName={teamAName} teamColor={teamAColor} players={getPlayingFive('A')}
                selectedPlayerId={selectedPlayerA} onSelectPlayer={setSelectedPlayerA}
                onQuickScore={(pts: any) => handleQuickScore('A', pts)} onSecondaryAction={(a: any) => onSecondaryAction('A', a)}
                isPending={pendingShot?.teamSide === 'A'} panelWidth="w-64" />

            <CourtPanel pendingShot={pendingShot} courtDots={courtDots} handleCourtTap={handleCourtTap}
                handleConfirmMade={handleConfirmMade} handleConfirmMiss={handleConfirmMiss} setPendingShot={() => { }} />

            <TeamPanel side="B" teamName={teamBName} teamColor={teamBColor} players={getPlayingFive('B')}
                selectedPlayerId={selectedPlayerB} onSelectPlayer={setSelectedPlayerB}
                onQuickScore={(pts: any) => handleQuickScore('B', pts)} onSecondaryAction={(a: any) => onSecondaryAction('B', a)}
                isPending={pendingShot?.teamSide === 'B'} panelWidth="w-64" />
        </div>
    </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// LANDSCAPE LAYOUT (Phone horizontal)
// ═════════════════════════════════════════════════════════════════════════════

const LandscapeLayout: React.FC<any> = (props) => (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
        <div className="bg-zinc-950 border-b border-zinc-900 px-3 py-2 flex items-center justify-between shrink-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">Advanced Stats</div>
            <div className="flex gap-1">{props.recentShots.slice(-2).map((s: any) => (
                <button key={s.id} onClick={() => props.handleUndoShot(s.id)} className="bg-zinc-900 rounded-full px-2 py-1 text-[9px] flex items-center gap-1">
                    <span className={s.made ? 'text-green-500' : 'text-red-500'}>{s.made ? '✓' : '✗'}</span>
                    <span>+{s.points}</span><span className="text-zinc-600">✕</span>
                </button>
            ))}</div>
        </div>
        <div className="flex-1 flex">
            <TeamPanel {...props} side="A" players={props.getPlayingFive('A')} selectedPlayerId={props.selectedPlayerA}
                onSelectPlayer={props.setSelectedPlayerA} onQuickScore={(pts: any) => props.handleQuickScore('A', pts)}
                onSecondaryAction={(a: any) => props.onSecondaryAction('A', a)} panelWidth="w-40" compact />
            <CourtPanel {...props} compact />
            <TeamPanel {...props} side="B" players={props.getPlayingFive('B')} selectedPlayerId={props.selectedPlayerB}
                onSelectPlayer={props.setSelectedPlayerB} onQuickScore={(pts: any) => props.handleQuickScore('B', pts)}
                onSecondaryAction={(a: any) => props.onSecondaryAction('B', a)} panelWidth="w-40" compact />
        </div>
    </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// PORTRAIT LAYOUT (Phone vertical)
// ═════════════════════════════════════════════════════════════════════════════

const PortraitLayout: React.FC<any> = ({
    activeTeam, setActiveTeam, teamAName, teamBName, teamAColor, teamBColor,
    pendingShot, recentShots, courtDots, handleCourtTap, handleConfirmMade, handleConfirmMiss,
    handleQuickScore, handleUndoShot, getPlayingFive, onSecondaryAction, period, gameClockSec,
    selectedPlayerA, selectedPlayerB, setSelectedPlayerA, setSelectedPlayerB,
}) => {
    const activeColor = activeTeam === 'A' ? teamAColor : teamBColor;
    const activeName = activeTeam === 'A' ? teamAName : teamBName;
    const selectedPlayerId = activeTeam === 'A' ? selectedPlayerA : selectedPlayerB;
    const setSelectedPlayer = activeTeam === 'A' ? setSelectedPlayerA : setSelectedPlayerB;
    const players = getPlayingFive(activeTeam);
    const selectedPlayer = players.find((p: any) => p.id === selectedPlayerId);

    return (
        <div className="h-screen bg-black text-white flex flex-col">
            <div className="bg-zinc-950 border-b border-zinc-900 px-4 py-3 flex items-center justify-between shrink-0">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">Advanced Stats</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Q{period} · {Math.floor(gameClockSec / 60)}:{(gameClockSec % 60).toString().padStart(2, '0')}</div></div>
                <button onClick={() => setActiveTeam(activeTeam === 'A' ? 'B' : 'A')}
                    className="px-4 py-2 rounded-lg border-2 font-black uppercase text-xs tracking-wider"
                    style={{ fontFamily: '"Barlow Condensed", sans-serif', borderColor: activeColor, background: `${activeColor}15`, color: activeColor }}>
                    Switch →
                </button>
            </div>
            {recentShots.length > 0 && <div className="bg-zinc-950 border-b border-zinc-900 px-4 py-2 flex gap-2 overflow-x-auto shrink-0">{recentShots.map((s: any) => (
                <button key={s.id} onClick={() => handleUndoShot(s.id)} className="bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-[10px] font-bold uppercase flex items-center gap-2 shrink-0">
                    <span className={s.made ? 'text-green-500' : 'text-red-500'}>{s.made ? '✓' : '✗'}</span><span>{s.playerName} +{s.points}</span><span className="text-zinc-600">✕</span>
                </button>
            ))}</div>}
            <div className="px-4 py-3 border-b border-zinc-900" style={{ background: `linear-gradient(to bottom, ${activeColor}15, transparent)`, borderTop: `3px solid ${activeColor}` }}>
                <div className="text-lg font-black uppercase italic" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>{activeName}</div>
            </div>
            <div className="px-4 py-3 border-b border-zinc-900"><div className="text-[9px] font-bold uppercase text-zinc-600 mb-2">Playing 5</div>
                <div className="grid grid-cols-3 gap-2">{players.map((p: any) => {
                    const isSelected = p.id === selectedPlayerId;
                    return <button key={p.id} onClick={() => setSelectedPlayer(isSelected ? null : p.id)}
                        className="h-14 rounded-lg border-2 flex items-center justify-center text-lg font-black"
                        style={{ fontFamily: '"Barlow Condensed", sans-serif', fontStyle: 'italic', borderColor: isSelected ? activeColor : '#27272a', background: isSelected ? `${activeColor}20` : '#18181b', color: isSelected ? activeColor : '#71717a' }}>
                        {p.number || '?'}
                    </button>
                })}</div>
            </div>
            <div className="px-4 py-3 border-b border-zinc-900 bg-black/30">{selectedPlayer ? <>
                <div className="text-[9px] font-bold uppercase text-zinc-600">Active Player</div>
                <div className="text-base font-black uppercase text-white mt-1 flex items-center gap-2" style={{ fontFamily: '"Barlow Condensed", sans-serif', fontStyle: 'italic' }}>
                    <span style={{ color: activeColor }}>#{selectedPlayer.number}</span><span>{selectedPlayer.name}</span>
                </div></> : <div className="text-[9px] font-bold uppercase text-zinc-700">Select a player to begin</div>}
            </div>
            <div className="flex-1 bg-black relative flex items-center justify-center p-4">
                {pendingShot && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-zinc-950 border-2 border-yellow-400 rounded-xl px-4 py-2 shadow-2xl w-[calc(100%-2rem)]">
                    <div className="flex gap-2"><button onClick={handleConfirmMade} className="flex-1 bg-green-600 text-white font-black uppercase text-sm py-3 rounded-lg" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>Made +{pendingShot.points}</button>
                        <button onClick={handleConfirmMiss} className="flex-1 bg-red-900 text-white font-black uppercase text-sm py-3 rounded-lg" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>Miss</button>
                        <button onClick={() => { }} className="text-zinc-500 text-lg px-3">✕</button></div>
                </div>}
                <div className="w-full h-full max-w-md"><HalfCourt interactive={true} shots={courtDots} onCourtTap={handleCourtTap} /></div>
            </div>
            <div className="bg-zinc-950 border-t border-zinc-900 px-4 py-4">
                <div className="mb-3"><div className="text-[9px] font-bold uppercase text-zinc-600 mb-2">Quick Score</div>
                    <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map(pts => <button key={pts} onClick={() => handleQuickScore(activeTeam, pts as any)} className="h-12 rounded-lg font-black uppercase text-sm border-2" style={{ fontFamily: '"Barlow Condensed", sans-serif', borderColor: activeColor, background: `${activeColor}15`, color: activeColor }}>+{pts}</button>)}</div>
                </div>
                <div><div className="text-[9px] font-bold uppercase text-zinc-600 mb-2">Stats</div>
                    <div className="grid grid-cols-3 gap-2">{['rebound', 'assist', 'steal', 'block', 'turnover', 'foul'].map((a) => <button key={a} onClick={() => onSecondaryAction(activeTeam, a as any)} className="h-10 rounded-lg font-bold uppercase text-xs bg-zinc-900 border border-zinc-800 text-zinc-400" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>{a === 'rebound' ? 'REB' : a === 'assist' ? 'AST' : a === 'steal' ? 'STL' : a === 'block' ? 'BLK' : a === 'turnover' ? 'TO' : 'FOUL'}</button>)}</div>
                </div>
            </div>
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════

const TeamPanel: React.FC<any> = ({ side, teamName, teamColor, players, selectedPlayerId, onSelectPlayer, onQuickScore, onSecondaryAction, isPending, panelWidth = 'w-64', compact = false }) => {
    const selectedPlayer = players.find((p: any) => p.id === selectedPlayerId);
    return (
        <div className={`${panelWidth} bg-zinc-950 border-zinc-900 flex flex-col ${compact ? 'overflow-y-auto' : 'overflow-hidden'}`}
            style={{ borderLeft: side === 'B' ? '1px solid' : 'none', borderRight: side === 'A' ? '1px solid' : 'none' }}>
            <div className={`px-${compact ? '2' : '4'} py-${compact ? '2' : '3'} border-b border-zinc-900`} style={{ borderTop: `${compact ? '2px' : '3px'} solid ${teamColor}` }}>
                <div className={`text-${compact ? '[10px]' : 'sm'} font-black uppercase tracking-wider text-white italic truncate`} style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>{teamName}</div>
            </div>
            <div className={`px-${compact ? '2' : '4'} py-${compact ? '2' : '4'} border-b border-zinc-900`}>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-2">Playing 5</div>
                <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-${compact ? '1.5' : '2'}`}>
                    {players.slice(0, compact ? 4 : 5).map((p: any) => {
                        const isSelected = p.id === selectedPlayerId;
                        return <button key={p.id} onClick={() => onSelectPlayer(isSelected ? null : p.id)}
                            className={`${compact ? 'h-10' : 'aspect-square'} rounded-lg border-2 flex items-center justify-center text-${compact ? 'sm' : 'lg'} font-black`}
                            style={{ fontFamily: '"Barlow Condensed", sans-serif', fontStyle: 'italic', borderColor: isSelected ? teamColor : '#27272a', background: isSelected ? `${teamColor}20` : '#18181b', color: isSelected ? teamColor : '#71717a' }}>
                            {p.number || '?'}
                        </button>
                    })}
                    {compact && players[4] && <button onClick={() => onSelectPlayer(players[4].id === selectedPlayerId ? null : players[4].id)}
                        className="h-10 rounded border-2 col-span-2 flex items-center justify-center text-sm font-black"
                        style={{ fontFamily: '"Barlow Condensed", sans-serif', fontStyle: 'italic', borderColor: players[4].id === selectedPlayerId ? teamColor : '#27272a', background: players[4].id === selectedPlayerId ? `${teamColor}20` : '#18181b', color: players[4].id === selectedPlayerId ? teamColor : '#71717a' }}>
                        {players[4].number || '?'}
                    </button>}
                </div>
            </div>
            <div className={`px-${compact ? '2' : '4'} py-${compact ? '2' : '3'} border-b border-zinc-900 bg-black/30`}>
                {selectedPlayer ? <><div className="text-[8px] font-bold uppercase text-zinc-600">{compact ? 'Active' : 'Active Player'}</div>
                    <div className={`text-${compact ? '[11px]' : 'base'} font-black uppercase text-white ${compact ? '' : 'mt-1 flex items-center gap-2'}`} style={{ fontFamily: '"Barlow Condensed", sans-serif', fontStyle: 'italic' }}>
                        <span style={{ color: teamColor }}>#{selectedPlayer.number}</span>{!compact && <span>{selectedPlayer.name}</span>}
                    </div></> : <div className="text-[8px] font-bold uppercase text-zinc-700">Select player</div>}
            </div>
            <div className={`px-${compact ? '2' : '4'} py-${compact ? '2' : '4'} border-b border-zinc-900`}>
                <div className={`${compact ? 'flex flex-col gap-1.5' : 'grid grid-cols-3 gap-2'}`}>
                    {[1, 2, 3].map(pts => <button key={pts} onClick={() => onQuickScore(pts)}
                        className={`${compact ? 'h-9' : 'py-3'} rounded-lg font-black uppercase text-${compact ? 'xs' : 'sm'} border-2`}
                        style={{ fontFamily: '"Barlow Condensed", sans-serif', borderColor: teamColor, background: `${teamColor}15`, color: teamColor }}>
                        +{pts}
                    </button>)}
                </div>
            </div>
            <div className={`px-${compact ? '2' : '4'} py-${compact ? '2' : '4'} flex-1`}>
                <div className={`grid grid-cols-2 gap-${compact ? '1' : '2'}`}>
                    {['rebound', 'assist', 'steal', 'block', 'turnover', 'foul'].map((a) => <button key={a} onClick={() => onSecondaryAction(a)}
                        className={`${compact ? 'h-7 text-[9px]' : 'h-10 text-xs'} rounded-lg font-bold uppercase bg-zinc-900 border border-zinc-800 text-zinc-400`}
                        style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                        {a === 'rebound' ? 'REB' : a === 'assist' ? 'AST' : a === 'steal' ? 'STL' : a === 'block' ? 'BLK' : a === 'turnover' ? 'TO' : 'FUL'}
                    </button>)}
                </div>
            </div>
        </div>
    );
};

const CourtPanel: React.FC<any> = ({ pendingShot, courtDots, handleCourtTap, handleConfirmMade, handleConfirmMiss, compact = false }) => (
    <div className="flex-1 bg-black flex flex-col items-center justify-center relative">
        {pendingShot && <div className={`absolute ${compact ? 'top-2' : 'top-4'} left-1/2 -translate-x-1/2 z-10 bg-zinc-950 border-2 border-yellow-400 ${compact ? 'rounded-lg px-3 py-2' : 'rounded-xl px-6 py-3'} shadow-2xl`}>
            {!compact && <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 mb-1">Confirm Shot</div>}
            <div className="flex items-center gap-${compact ? '2' : '3'}">
                <button onClick={handleConfirmMade} className={`bg-green-600 text-white font-black uppercase ${compact ? 'text-xs px-4 py-2 rounded-md' : 'text-sm px-6 py-3 rounded-lg'}`} style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>Made +{pendingShot.points}</button>
                <button onClick={handleConfirmMiss} className={`bg-red-900 text-white font-black uppercase ${compact ? 'text-xs px-4 py-2 rounded-md' : 'text-sm px-6 py-3 rounded-lg'}`} style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>Miss</button>
                <button className={`text-zinc-500 ${compact ? 'text-sm px-2' : 'text-lg px-2'}`}>✕</button>
            </div>
        </div>}
        <div className={`w-full h-full ${compact ? 'max-w-full p-3' : 'max-w-[600px] p-8'}`}><HalfCourt interactive={true} shots={courtDots} onCourtTap={handleCourtTap} /></div>
    </div>
);
