// src/components/shotchart/SubstitutionPanel.tsx
// ═════════════════════════════════════════════════════════════════════════════
// Substitution Panel - Roster Management
//
// INTEGRATION INSTRUCTIONS:
// 1. Copy this file to src/components/shotchart/SubstitutionPanel.tsx
// 2. Import in AdvancedConsole.tsx:
//    import { SubstitutionPanel } from './SubstitutionPanel';
// 3. Add state in AdvancedConsole:
//    const [showSubPanel, setShowSubPanel] = useState<'A' | 'B' | null>(null);
// 4. In Player Roster Grid, wire up the [SUB ⇄] button:
//    <button onClick={() => setShowSubPanel('A')}>SUB ⇄</button>
// 5. Render component:
//    {showSubPanel && (
//        <SubstitutionPanel
//            teamSide={showSubPanel}
//            teamName={showSubPanel === 'A' ? teamAName : teamBName}
//            teamColor={showSubPanel === 'A' ? teamAColor : teamBColor}
//            allPlayers={showSubPanel === 'A' ? teamAPlayers : teamBPlayers}
//            activePlayerIds={getActivePlayerIds(showSubPanel)}
//            onConfirm={(activeIds) => {
//                updateActiveRoster(showSubPanel, activeIds);
//                setShowSubPanel(null);
//            }}
//            onCancel={() => setShowSubPanel(null)}
//        />
//    )}
// ═════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import type { Player } from '../../types';

interface SubstitutionPanelProps {
    teamSide: 'A' | 'B';
    teamName: string;
    teamColor: string;
    allPlayers: Player[];
    activePlayerIds: string[]; // Currently on court
    onConfirm: (activeIds: string[]) => void;
    onCancel: () => void;
}

export const SubstitutionPanel: React.FC<SubstitutionPanelProps> = ({
    teamSide,
    teamName,
    teamColor,
    allPlayers,
    activePlayerIds: initialActiveIds,
    onConfirm,
    onCancel,
}) => {
    const [activeIds, setActiveIds] = useState<string[]>(initialActiveIds);

    const activePlayers = allPlayers.filter(p => activeIds.includes(p.id));
    const benchPlayers = allPlayers.filter(p => !activeIds.includes(p.id) && p.name);

    const togglePlayer = (playerId: string) => {
        if (activeIds.includes(playerId)) {
            // Remove from court
            setActiveIds(prev => prev.filter(id => id !== playerId));
        } else {
            // Add to court
            setActiveIds(prev => [...prev, playerId]);
        }
    };

    const hasChanges = () => {
        if (activeIds.length !== initialActiveIds.length) return true;
        return !activeIds.every(id => initialActiveIds.includes(id));
    };

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Panel - Slide from side */}
            <div
                className={`relative w-80 bg-zinc-950 border-zinc-800 overflow-y-auto shadow-2xl animate-in slide-in-from-${teamSide === 'A' ? 'left' : 'right'} duration-300`}
                style={{
                    borderRight: teamSide === 'A' ? '1px solid' : 'none',
                    borderLeft: teamSide === 'B' ? '1px solid' : 'none',
                    marginLeft: teamSide === 'A' ? '0' : 'auto',
                }}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">
                                Substitution
                            </div>
                            <div className="text-lg font-black uppercase tracking-wide text-white mt-1 italic"
                                style={{ fontFamily: '"Barlow Condensed", sans-serif', color: teamColor }}>
                                {teamName}
                            </div>
                        </div>
                        <button
                            onClick={onCancel}
                            className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition-all"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* On Court */}
                <div className="px-6 py-4 border-b border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">
                            On Court ({activeIds.length})
                        </div>
                        <div className="text-[9px] text-zinc-600">
                            Tap to bench
                        </div>
                    </div>

                    {activePlayers.length === 0 ? (
                        <div className="text-center py-8 text-zinc-700 text-sm">
                            No players on court
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {activePlayers.map(player => (
                                <button
                                    key={player.id}
                                    onClick={() => togglePlayer(player.id)}
                                    className="w-full h-14 px-4 rounded-lg border-2 flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
                                    style={{
                                        fontFamily: '"Barlow Condensed", sans-serif',
                                        borderColor: teamColor,
                                        background: `${teamColor}15`,
                                    }}
                                >
                                    <div
                                        className="w-2 h-2 rounded-full bg-green-500"
                                        style={{ boxShadow: '0 0 8px #22c55e' }}
                                    />
                                    <span className="text-lg font-black italic" style={{ color: teamColor }}>
                                        #{player.number}
                                    </span>
                                    <span className="text-sm font-bold uppercase text-white flex-1 text-left">
                                        {player.name}
                                    </span>
                                    <span className="text-xs text-zinc-500 font-bold">
                                        {player.points} PTS
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bench */}
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">
                            Bench ({benchPlayers.length})
                        </div>
                        <div className="text-[9px] text-zinc-600">
                            Tap to sub in
                        </div>
                    </div>

                    {benchPlayers.length === 0 ? (
                        <div className="text-center py-8 text-zinc-700 text-sm">
                            All players on court
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {benchPlayers.map(player => (
                                <button
                                    key={player.id}
                                    onClick={() => togglePlayer(player.id)}
                                    className="w-full h-14 px-4 rounded-lg border flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-95 hover:border-zinc-600"
                                    style={{
                                        fontFamily: '"Barlow Condensed", sans-serif',
                                        borderColor: '#27272a',
                                        background: '#18181b',
                                    }}
                                >
                                    <span className="text-lg font-black italic text-zinc-600">
                                        #{player.number}
                                    </span>
                                    <span className="text-sm font-bold uppercase text-zinc-400 flex-1 text-left">
                                        {player.name}
                                    </span>
                                    <span className="text-xs text-zinc-600 font-bold">
                                        {player.points} PTS
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer - Confirm Button */}
                <div className="px-6 py-4 border-t border-zinc-800 sticky bottom-0 bg-zinc-950">
                    <button
                        onClick={() => onConfirm(activeIds)}
                        disabled={!hasChanges()}
                        className={`w-full h-12 rounded-lg font-black uppercase text-sm tracking-wider transition-all ${hasChanges()
                            ? 'active:scale-95 cursor-pointer'
                            : 'opacity-50 cursor-not-allowed'
                            }`}
                        style={{
                            fontFamily: '"Barlow Condensed", sans-serif',
                            background: hasChanges() ? teamColor : '#27272a',
                            color: hasChanges() ? '#000' : '#71717a',
                        }}
                    >
                        {hasChanges() ? 'Confirm Changes' : 'No Changes'}
                    </button>
                    <div className="text-[9px] text-zinc-600 text-center mt-2">
                        {hasChanges()
                            ? `${Math.abs(activeIds.length - initialActiveIds.length)} player${Math.abs(activeIds.length - initialActiveIds.length) !== 1 ? 's' : ''} changed`
                            : 'Make changes to enable confirmation'
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};