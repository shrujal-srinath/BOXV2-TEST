// src/components/WinnerSelectionModal.tsx
// PREMIUM WINNER DECLARATION INTERFACE
// Zero risk - Isolated new component

import React, { useState } from 'react';

interface Props {
    teamA: { name: string; score: number };
    teamB: { name: string; score: number };
    onSelect: (winner: 'A' | 'B') => Promise<void>;
    onCancel: () => void;
}

export const WinnerSelectionModal: React.FC<Props> = ({ teamA, teamB, onSelect, onCancel }) => {
    const [selectedWinner, setSelectedWinner] = useState<'A' | 'B' | null>(null);
    const [confirming, setConfirming] = useState(false);

    const handleConfirm = async () => {
        if (!selectedWinner) return;

        setConfirming(true);
        try {
            await onSelect(selectedWinner);
        } catch (error) {
            console.error('Failed to declare winner:', error);
            setConfirming(false);
        }
    };

    const winnerTeam = selectedWinner === 'A' ? teamA : selectedWinner === 'B' ? teamB : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-black border border-zinc-700 rounded-2xl w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-300">
                {/* HEADER */}
                <div className="border-b border-zinc-800 p-8 text-center">
                    <div className="text-6xl mb-4 animate-bounce">🏆</div>
                    <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-2">
                        Declare Winner
                    </h2>
                    <p className="text-sm text-zinc-500 font-medium">
                        Select the winning team to advance in the bracket
                    </p>
                </div>

                {/* TEAM SELECTION */}
                <div className="p-8">
                    <div className="grid grid-cols-2 gap-6">
                        {/* TEAM A */}
                        <button
                            onClick={() => setSelectedWinner('A')}
                            className={`
                                relative p-8 rounded-2xl border-2 transition-all duration-300 cursor-pointer
                                ${selectedWinner === 'A'
                                    ? 'bg-yellow-500/10 border-yellow-500 shadow-2xl shadow-yellow-500/30 scale-105'
                                    : 'bg-zinc-800/50 border-zinc-700 hover:border-yellow-500/50 hover:scale-105 hover:shadow-xl'
                                }
                            `}
                        >
                            {/* Selected Badge */}
                            {selectedWinner === 'A' && (
                                <div className="absolute -top-3 -right-3 w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                    <span className="text-black text-2xl font-black">✓</span>
                                </div>
                            )}

                            {/* Team Info */}
                            <div className="text-center">
                                <div className={`text-5xl font-black mb-4 transition-all ${selectedWinner === 'A' ? 'text-yellow-400 scale-110' : 'text-white'
                                    }`}>
                                    {teamA.score}
                                </div>
                                <div className={`text-xl font-black uppercase tracking-wide mb-2 ${selectedWinner === 'A' ? 'text-yellow-400' : 'text-white'
                                    }`}>
                                    {teamA.name}
                                </div>
                                <div className={`text-xs font-bold uppercase tracking-widest ${selectedWinner === 'A' ? 'text-yellow-500' : 'text-zinc-500'
                                    }`}>
                                    Team A
                                </div>
                            </div>

                            {/* Trophy Icon for Winner */}
                            {selectedWinner === 'A' && (
                                <div className="mt-4 text-4xl animate-bounce">
                                    🏆
                                </div>
                            )}
                        </button>

                        {/* TEAM B */}
                        <button
                            onClick={() => setSelectedWinner('B')}
                            className={`
                                relative p-8 rounded-2xl border-2 transition-all duration-300 cursor-pointer
                                ${selectedWinner === 'B'
                                    ? 'bg-yellow-500/10 border-yellow-500 shadow-2xl shadow-yellow-500/30 scale-105'
                                    : 'bg-zinc-800/50 border-zinc-700 hover:border-yellow-500/50 hover:scale-105 hover:shadow-xl'
                                }
                            `}
                        >
                            {/* Selected Badge */}
                            {selectedWinner === 'B' && (
                                <div className="absolute -top-3 -right-3 w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                    <span className="text-black text-2xl font-black">✓</span>
                                </div>
                            )}

                            {/* Team Info */}
                            <div className="text-center">
                                <div className={`text-5xl font-black mb-4 transition-all ${selectedWinner === 'B' ? 'text-yellow-400 scale-110' : 'text-white'
                                    }`}>
                                    {teamB.score}
                                </div>
                                <div className={`text-xl font-black uppercase tracking-wide mb-2 ${selectedWinner === 'B' ? 'text-yellow-400' : 'text-white'
                                    }`}>
                                    {teamB.name}
                                </div>
                                <div className={`text-xs font-bold uppercase tracking-widest ${selectedWinner === 'B' ? 'text-yellow-500' : 'text-zinc-500'
                                    }`}>
                                    Team B
                                </div>
                            </div>

                            {/* Trophy Icon for Winner */}
                            {selectedWinner === 'B' && (
                                <div className="mt-4 text-4xl animate-bounce">
                                    🏆
                                </div>
                            )}
                        </button>
                    </div>

                    {/* Confirmation Message */}
                    {selectedWinner && (
                        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl animate-in slide-in-from-top-4 duration-300">
                            <div className="text-center">
                                <p className="text-sm font-bold text-yellow-400 mb-1">
                                    ⚠️ Confirm Winner
                                </p>
                                <p className="text-xs text-zinc-400">
                                    <span className="text-yellow-400 font-bold">{winnerTeam?.name}</span> will advance to the next round
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="border-t border-zinc-800 p-6 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={confirming}
                        className="px-6 py-3 rounded-lg font-bold uppercase text-sm tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedWinner || confirming}
                        className={`
                            px-8 py-3 rounded-lg font-black uppercase text-sm tracking-wider transition-all flex items-center gap-2
                            ${selectedWinner && !confirming
                                ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/30 hover:scale-105'
                                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                            }
                        `}
                    >
                        {confirming ? (
                            <>
                                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <span>🏆</span>
                                <span>Confirm Winner</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};