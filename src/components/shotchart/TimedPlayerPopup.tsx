// src/components/shotchart/TimedPlayerPopup.tsx
// ═════════════════════════════════════════════════════════════════════════════
// Timed Player Popup - Deferred Attribution System
//
// INTEGRATION INSTRUCTIONS:
// 1. Copy this file to src/components/shotchart/TimedPlayerPopup.tsx
// 2. Import in AdvancedConsole.tsx:
//    import { TimedPlayerPopup } from './TimedPlayerPopup';
// 3. Add state in AdvancedConsole:
//    const [deferredShot, setDeferredShot] = useState(null);
// 4. In handleCourtTap, check if player is selected:
//    if (!selectedPlayer) {
//        setDeferredShot({ x, y, zone, points, shotType, teamSide });
//        return; // Don't record yet
//    }
// 5. Render component:
//    {deferredShot && (
//        <TimedPlayerPopup
//            shotInfo={deferredShot}
//            players={getPlayersForTeam(deferredShot.teamSide)}
//            teamColor={getTeamColor(deferredShot.teamSide)}
//            onSelectPlayer={(playerId) => {
//                recordShot({ ...deferredShot, playerId });
//                setDeferredShot(null);
//            }}
//            onSkip={() => {
//                // Note: You'll need to add needs_review to your shot recording function
//                recordShot({ ...deferredShot, playerId: null, needs_review: true });
//                setDeferredShot(null);
//            }}
//            onCancel={() => setDeferredShot(null)}
//        />
//    )}
// ═════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import type { Player } from '../../types';
import type { ShotZoneId, ShotType } from './types/shotTypes';

interface TimedPlayerPopupProps {
    shotInfo: {
        x: number;
        y: number;
        zone: ShotZoneId;
        points: 1 | 2 | 3;
        shotType: ShotType;
        teamSide: 'A' | 'B';
    };
    players: Player[];
    teamColor: string;
    onSelectPlayer: (playerId: string) => void;
    onSkip: () => void;
    onCancel: () => void;
}

export const TimedPlayerPopup: React.FC<TimedPlayerPopupProps> = ({
    shotInfo,
    players,
    teamColor,
    onSelectPlayer,
    onSkip,
    onCancel,
}) => {
    const [timeLeft, setTimeLeft] = useState(8); // 8 seconds
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Start countdown
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // Time's up - auto-skip
                    clearInterval(timerRef.current!);
                    onSkip();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Cleanup
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [onSkip]);

    const getZoneLabel = (zone: ShotZoneId): string => {
        const labels: Record<string, string> = {
            'restricted': 'Restricted Area',
            'paint': 'Paint',
            'left_elbow': 'Left Elbow',
            'right_elbow': 'Right Elbow',
            'left_wing': 'Left Wing',
            'right_wing': 'Right Wing',
            'top_key': 'Top of Key',
            'left_corner_three': 'Left Corner',
            'right_corner_three': 'Right Corner',
            'above_break_three': 'Above Break',
        };
        return labels[zone] || zone;
    };

    const shotLabel = `${shotInfo.points}PT from ${getZoneLabel(shotInfo.zone)}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Modal */}
            <div className="relative bg-zinc-950 border-2 border-yellow-400 rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
                            Who Scored?
                        </div>
                        <div className="text-sm font-black uppercase tracking-wide text-white mt-1"
                            style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                            {shotLabel}
                        </div>
                    </div>

                    {/* Circular Timer */}
                    <div className="relative w-14 h-14 flex items-center justify-center">
                        <svg className="absolute inset-0 w-14 h-14 -rotate-90">
                            <circle
                                cx="28"
                                cy="28"
                                r="24"
                                stroke="#27272a"
                                strokeWidth="3"
                                fill="none"
                            />
                            <circle
                                cx="28"
                                cy="28"
                                r="24"
                                stroke="#facc15"
                                strokeWidth="3"
                                fill="none"
                                strokeDasharray={`${(timeLeft / 8) * 150.8} 150.8`}
                                style={{ transition: 'stroke-dasharray 1s linear' }}
                            />
                        </svg>
                        <span className="text-xl font-black text-yellow-400"
                            style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                            {timeLeft}
                        </span>
                    </div>
                </div>

                {/* Player List */}
                <div className="px-4 py-4 max-h-[400px] overflow-y-auto">
                    <div className="space-y-2">
                        {players.filter(p => p.name).map(player => (
                            <button
                                key={player.id}
                                onClick={() => onSelectPlayer(player.id)}
                                className="w-full h-12 px-4 rounded-lg border-2 flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
                                style={{
                                    fontFamily: '"Barlow Condensed", sans-serif',
                                    borderColor: '#27272a',
                                    background: '#18181b',
                                }}
                            >
                                <span className="text-lg font-black italic" style={{ color: teamColor }}>
                                    #{player.number}
                                </span>
                                <span className="text-sm font-bold uppercase text-white flex-1 text-left">
                                    {player.name}
                                </span>
                                <span className="text-xs text-zinc-500 font-bold uppercase">
                                    {player.points} PTS
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer - Skip Button */}
                <div className="px-4 py-4 border-t border-zinc-800">
                    <button
                        onClick={onSkip}
                        className="w-full h-12 rounded-lg font-black uppercase text-sm tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2"
                        style={{
                            fontFamily: '"Barlow Condensed", sans-serif',
                            background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)',
                            color: '#000',
                        }}
                    >
                        <span>🚩</span>
                        <span>Skip — Mark for Later Review</span>
                    </button>
                    <div className="text-[9px] text-zinc-600 text-center mt-2 font-medium">
                        Shot will be flagged for post-game review
                    </div>
                </div>
            </div>
        </div>
    );
};