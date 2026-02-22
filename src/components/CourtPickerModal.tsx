// src/components/CourtPickerModal.tsx
// PREMIUM COURT SELECTION INTERFACE
// Zero risk - Isolated new component

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { BasketballGame } from '../types';

interface Props {
    tournamentId: string;
    onSelect: (court: string) => void;
    onCancel: () => void;
}

export const CourtPickerModal: React.FC<Props> = ({ tournamentId, onSelect, onCancel }) => {
    const [occupiedCourts, setOccupiedCourts] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [selectedCourt, setSelectedCourt] = useState<string | null>(null);

    // Available courts (you can make this configurable)
    const availableCourts = ['Court 1', 'Court 2', 'Court 3', 'Court 4', 'Court 5', 'Court 6'];

    useEffect(() => {
        checkOccupiedCourts();
    }, [tournamentId]);

    const checkOccupiedCourts = async () => {
        try {
            const { data, error } = await supabase.from('games').select('data').eq('status', 'live');
            if (error) throw error;

            const occupied = new Set<string>();
            data?.forEach(row => {
                const game = row.data as BasketballGame;
                if (game?.settings?.tournamentId === tournamentId && game?.settings?.courtNumber) {
                    occupied.add(game.settings.courtNumber);
                }
            });
            setOccupiedCourts(occupied);
            setLoading(false);
        } catch (error) {
            console.error('Failed to check court availability:', error);
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (selectedCourt && !occupiedCourts.has(selectedCourt)) {
            onSelect(selectedCourt);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                {/* HEADER */}
                <div className="border-b border-zinc-800 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-white">
                                Select Court
                            </h2>
                            <p className="text-sm text-zinc-500 mt-1 font-medium">
                                Choose an available court to start scoring
                            </p>
                        </div>
                        <button
                            onClick={onCancel}
                            className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* COURT GRID */}
                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-sm text-zinc-500 font-bold uppercase tracking-wider">
                                    Checking availability...
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {availableCourts.map(court => {
                                const isOccupied = occupiedCourts.has(court);
                                const isSelected = selectedCourt === court;

                                return (
                                    <button
                                        key={court}
                                        onClick={() => !isOccupied && setSelectedCourt(court)}
                                        disabled={isOccupied}
                                        className={`
                                            relative p-6 rounded-xl border-2 transition-all duration-300
                                            ${isOccupied
                                                ? 'bg-zinc-900 border-zinc-800 opacity-50 cursor-not-allowed'
                                                : isSelected
                                                    ? 'bg-yellow-500/10 border-yellow-500 shadow-lg shadow-yellow-500/20 scale-105'
                                                    : 'bg-zinc-800/50 border-zinc-700 hover:border-yellow-500/50 hover:bg-zinc-800 hover:scale-105 cursor-pointer'
                                            }
                                        `}
                                    >
                                        {/* Court Icon */}
                                        <div className={`text-4xl mb-3 transition-transform duration-300 ${isSelected ? 'scale-110' : ''}`}>
                                            {isOccupied ? '🔴' : isSelected ? '✅' : '🏀'}
                                        </div>

                                        {/* Court Name */}
                                        <div className={`font-black text-lg uppercase tracking-wide mb-1 ${isOccupied ? 'text-zinc-600' :
                                            isSelected ? 'text-yellow-400' :
                                                'text-white'
                                            }`}>
                                            {court}
                                        </div>

                                        {/* Status */}
                                        <div className={`text-xs font-bold uppercase tracking-widest ${isOccupied ? 'text-red-500' :
                                            isSelected ? 'text-yellow-500' :
                                                'text-green-500'
                                            }`}>
                                            {isOccupied ? 'In Use' : isSelected ? 'Selected' : 'Available'}
                                        </div>

                                        {/* Selected Indicator */}
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center animate-pulse">
                                                <span className="text-black text-xs font-black">✓</span>
                                            </div>
                                        )}

                                        {/* Occupied Indicator */}
                                        {isOccupied && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-16 h-1 bg-red-500 rotate-45 rounded-full"></div>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Legend */}
                    <div className="mt-6 flex items-center justify-center gap-6 text-xs text-zinc-500">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="font-bold uppercase tracking-wider">Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="font-bold uppercase tracking-wider">Occupied</span>
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="border-t border-zinc-800 p-6 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-6 py-3 rounded-lg font-bold uppercase text-sm tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedCourt || occupiedCourts.has(selectedCourt)}
                        className={`
                            px-8 py-3 rounded-lg font-black uppercase text-sm tracking-wider transition-all
                            ${selectedCourt && !occupiedCourts.has(selectedCourt)
                                ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/30 hover:scale-105'
                                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                            }
                        `}
                    >
                        {selectedCourt ? `Start on ${selectedCourt}` : 'Select a Court'}
                    </button>
                </div>
            </div>
        </div>
    );
};