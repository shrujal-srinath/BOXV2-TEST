// src/components/HardwareControlOverlay.tsx
//
// Shown inside HostConsole when controlMode === 'hardware'.
// The scoring/foul/timeout buttons are locked — this overlay explains why
// and provides one-tap options to switch modes.
//
// Design: minimal overlay strip at the bottom of the control deck, not full screen.
// We don't want to block the scoreboard view — just the action buttons.

import React, { useState } from 'react';
import { setControlMode, HW_SESSION_KEY, type ControlMode } from '../services/handheldService';

interface HardwareControlOverlayProps {
    controlMode: ControlMode;
    deviceId: string | null;
    teamAName?: string;
    teamBName?: string;
    /** If true, ESP32 buttons are disabled. Overlay is shown. */
    isLocked: boolean;
}

export const HardwareControlOverlay: React.FC<HardwareControlOverlayProps> = ({
    controlMode,
    deviceId,
    teamAName = 'TEAM A',
    teamBName = 'TEAM B',
    isLocked,
}) => {
    const [switching, setSwitching] = useState(false);
    const [showConfirm, setShowConfirm] = useState<ControlMode | null>(null);

    if (!isLocked) return null;

    const handleSwitch = (mode: ControlMode) => {
        // Web-only can be instant (no danger). Hardware re-lock also instant.
        // Shared needs a confirm since it means both can score simultaneously.
        if (mode === 'shared') {
            setShowConfirm(mode);
        } else {
            doSwitch(mode);
        }
    };

    const doSwitch = async (mode: ControlMode) => {
        if (!deviceId || switching) return;
        setSwitching(true);
        setShowConfirm(null);
        await setControlMode(deviceId, mode, teamAName, teamBName);
        setSwitching(false);
    };

    return (
        <div className="relative">
            {/* Confirm dialog for SHARED mode */}
            {showConfirm === 'shared' && (
                <div className="absolute inset-0 z-20 bg-black/95 flex items-center justify-center rounded-xl border border-amber-800/50">
                    <div className="text-center px-6">
                        <p className="text-amber-400 text-sm font-bold mb-1">Enable Shared Control?</p>
                        <p className="text-zinc-500 text-xs font-mono mb-5 leading-relaxed">
                            Both web and ESP32 can score. Last action wins. Only use as backup.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => doSwitch('shared')}
                                className="px-5 py-2 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-lg hover:bg-amber-400 transition-colors"
                            >
                                Enable
                            </button>
                            <button
                                onClick={() => setShowConfirm(null)}
                                className="px-5 py-2 border border-zinc-700 text-zinc-400 font-bold text-xs uppercase tracking-widest rounded-lg hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lock banner */}
            <div className={`
                bg-zinc-950 border rounded-xl p-4
                ${controlMode === 'hardware' ? 'border-green-900/50' : 'border-amber-900/50'}
            `}>
                <div className="flex items-center justify-between">
                    {/* Left: Status */}
                    <div className="flex items-center gap-3">
                        <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center
                            ${controlMode === 'hardware' ? 'bg-green-500/10 border border-green-600/40' : 'bg-amber-500/10 border border-amber-600/40'}
                        `}>
                            {/* Controller icon */}
                            <svg className={`w-4 h-4 ${controlMode === 'hardware' ? 'text-green-400' : 'text-amber-400'}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                            </svg>
                        </div>
                        <div>
                            <p className={`text-xs font-black uppercase tracking-widest ${controlMode === 'hardware' ? 'text-green-400' : 'text-amber-400'}`}>
                                {controlMode === 'hardware' ? 'ESP32 Has Control' : 'Shared Control'}
                            </p>
                            <p className="text-zinc-600 text-[10px] font-mono mt-0.5">
                                {controlMode === 'hardware'
                                    ? 'Referee is scoring from the handheld controller'
                                    : 'Both web and controller are active'}
                            </p>
                        </div>
                    </div>

                    {/* Right: Mode switch buttons */}
                    <div className="flex items-center gap-2">
                        {switching ? (
                            <span className="text-[10px] font-mono text-zinc-600 animate-pulse">Switching...</span>
                        ) : (
                            <>
                                <button
                                    onClick={() => handleSwitch('shared')}
                                    disabled={controlMode === 'shared'}
                                    className="px-3 py-1.5 border border-amber-800/50 text-amber-600 hover:text-amber-400 hover:border-amber-600 transition-colors text-[10px] font-bold uppercase tracking-widest rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Share
                                </button>
                                <button
                                    onClick={() => handleSwitch('web')}
                                    className="px-3 py-1.5 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-zinc-200 transition-colors"
                                >
                                    Take Control
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};