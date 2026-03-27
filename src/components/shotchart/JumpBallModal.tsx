// src/components/shotchart/JumpBallModal.tsx
// ═════════════════════════════════════════════════════════════════════════════
// Jump Ball Modal - Opening Tip Flow (NCAA Style)
//
// INTEGRATION INSTRUCTIONS:
// 1. Copy this file to src/components/shotchart/JumpBallModal.tsx
// 2. Import in AdvancedConsole.tsx:
//    import { JumpBallModal } from './JumpBallModal';
// 3. Add state in AdvancedConsole to check if jump ball is needed:
//    const [showJumpBall, setShowJumpBall] = useState(() => {
//        return period === 1 && 
//               gameClockSec === periodDuration * 60 &&
//               !gameRunning;
//    });
// 4. Add handler for jump ball completion:
//    const handleJumpBallComplete = (result) => {
//        // Set possession
//        updateGameState({ 
//            possession: result.winner,
//            possessionArrow: result.winner === 'A' ? 'B' : 'A'
//        });
//        // Record jump ball event (optional)
//        recordGameEvent({
//            type: 'jump_ball',
//            teamAPlayer: result.teamAJumper,
//            teamBPlayer: result.teamBJumper,
//            winner: result.winner
//        });
//        setShowJumpBall(false);
//    };
// 5. Render component:
//    {showJumpBall && (
//        <JumpBallModal
//            teamAName={teamAName}
//            teamAColor={teamAColor}
//            teamAPlayers={teamAPlayers.filter(p => p.name)}
//            teamBName={teamBName}
//            teamBColor={teamBColor}
//            teamBPlayers={teamBPlayers.filter(p => p.name)}
//            onComplete={handleJumpBallComplete}
//            onSkip={() => setShowJumpBall(false)}
//        />
//    )}
// ═════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import type { Player } from '../../types';

interface JumpBallModalProps {
    teamAName: string;
    teamAColor: string;
    teamAPlayers: Player[];
    teamBName: string;
    teamBColor: string;
    teamBPlayers: Player[];
    onComplete: (result: {
        teamAJumper: string;
        teamBJumper: string;
        winner: 'A' | 'B';
    }) => void;
    onSkip: () => void;
}

export const JumpBallModal: React.FC<JumpBallModalProps> = ({
    teamAName,
    teamAColor,
    teamAPlayers,
    teamBName,
    teamBColor,
    teamBPlayers,
    onComplete,
    onSkip,
}) => {
    const [teamAJumper, setTeamAJumper] = useState<string>('');
    const [teamBJumper, setTeamBJumper] = useState<string>('');
    const [dropdownOpen, setDropdownOpen] = useState<'A' | 'B' | null>(null);

    const handleSelectWinner = (winner: 'A' | 'B') => {
        if (!teamAJumper || !teamBJumper) {
            alert('Please select both players before choosing winner');
            return;
        }

        onComplete({
            teamAJumper,
            teamBJumper,
            winner,
        });
    };

    const getPlayerName = (playerId: string, players: Player[]): string => {
        const player = players.find(p => p.id === playerId);
        return player ? `#${player.number} ${player.name}` : 'Select Player';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

            {/* Modal */}
            <div className="relative bg-zinc-950 border-2 border-yellow-400 rounded-2xl w-full max-w-2xl shadow-2xl">
                {/* Header */}
                <div className="px-8 py-6 border-b border-zinc-800 text-center">
                    <div className="text-4xl mb-2">🏀</div>
                    <h2 className="text-3xl font-black uppercase tracking-tight text-white italic"
                        style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                        Opening Tip
                    </h2>
                    <p className="text-sm text-zinc-500 mt-2 font-medium">
                        Select players competing for jump ball
                    </p>
                </div>

                {/* Player Selection */}
                <div className="px-8 py-6">
                    <div className="grid grid-cols-3 gap-6 items-center">
                        {/* Team A Jumper */}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600 mb-3 text-center">
                                {teamAName}
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setDropdownOpen(dropdownOpen === 'A' ? null : 'A')}
                                    className="w-full h-14 px-4 rounded-lg border-2 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-95"
                                    style={{
                                        fontFamily: '"Barlow Condensed", sans-serif',
                                        borderColor: teamAColor,
                                        background: `${teamAColor}15`,
                                    }}
                                >
                                    <span className="text-sm font-bold uppercase truncate" style={{ color: teamAColor }}>
                                        {teamAJumper ? getPlayerName(teamAJumper, teamAPlayers) : 'Select Player'}
                                    </span>
                                    <span className="text-zinc-500">▼</span>
                                </button>

                                {/* Dropdown */}
                                {dropdownOpen === 'A' && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl max-h-64 overflow-y-auto z-10">
                                        {teamAPlayers.map(player => (
                                            <button
                                                key={player.id}
                                                onClick={() => {
                                                    setTeamAJumper(player.id);
                                                    setDropdownOpen(null);
                                                }}
                                                className="w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                            >
                                                <span className="text-sm font-black" style={{ color: teamAColor }}>
                                                    #{player.number}
                                                </span>
                                                <span className="text-sm font-bold text-white">
                                                    {player.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* VS */}
                        <div className="text-center">
                            <div className="text-2xl font-black text-zinc-700 uppercase"
                                style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                                vs
                            </div>
                        </div>

                        {/* Team B Jumper */}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600 mb-3 text-center">
                                {teamBName}
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setDropdownOpen(dropdownOpen === 'B' ? null : 'B')}
                                    className="w-full h-14 px-4 rounded-lg border-2 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-95"
                                    style={{
                                        fontFamily: '"Barlow Condensed", sans-serif',
                                        borderColor: teamBColor,
                                        background: `${teamBColor}15`,
                                    }}
                                >
                                    <span className="text-sm font-bold uppercase truncate" style={{ color: teamBColor }}>
                                        {teamBJumper ? getPlayerName(teamBJumper, teamBPlayers) : 'Select Player'}
                                    </span>
                                    <span className="text-zinc-500">▼</span>
                                </button>

                                {/* Dropdown */}
                                {dropdownOpen === 'B' && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl max-h-64 overflow-y-auto z-10">
                                        {teamBPlayers.map(player => (
                                            <button
                                                key={player.id}
                                                onClick={() => {
                                                    setTeamBJumper(player.id);
                                                    setDropdownOpen(null);
                                                }}
                                                className="w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                            >
                                                <span className="text-sm font-black" style={{ color: teamBColor }}>
                                                    #{player.number}
                                                </span>
                                                <span className="text-sm font-bold text-white">
                                                    {player.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Winner Selection */}
                <div className="px-8 py-6 border-t border-zinc-800">
                    <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600 mb-4 text-center">
                        Which team gained possession?
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleSelectWinner('A')}
                            className="h-16 rounded-xl border-2 font-black uppercase text-lg tracking-wider transition-all hover:scale-[1.02] active:scale-95"
                            style={{
                                fontFamily: '"Barlow Condensed", sans-serif',
                                borderColor: teamAColor,
                                background: `${teamAColor}20`,
                                color: teamAColor,
                            }}
                        >
                            {teamAName} →
                        </button>
                        <button
                            onClick={() => handleSelectWinner('B')}
                            className="h-16 rounded-xl border-2 font-black uppercase text-lg tracking-wider transition-all hover:scale-[1.02] active:scale-95"
                            style={{
                                fontFamily: '"Barlow Condensed", sans-serif',
                                borderColor: teamBColor,
                                background: `${teamBColor}20`,
                                color: teamBColor,
                            }}
                        >
                            ← {teamBName}
                        </button>
                    </div>
                    <div className="text-[9px] text-zinc-600 text-center mt-3 font-medium">
                        Winner gets first possession
                    </div>
                </div>

                {/* Skip Button */}
                <div className="px-8 py-4 border-t border-zinc-900">
                    <button
                        onClick={onSkip}
                        className="w-full h-12 rounded-lg font-bold uppercase text-xs tracking-wider text-zinc-500 hover:text-zinc-300 transition-all"
                    >
                        Skip — Start Without Jump Ball
                    </button>
                </div>
            </div>
        </div>
    );
};