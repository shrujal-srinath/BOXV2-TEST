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
        doSwitch(mode);
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
                            <p className="text-xs font-black uppercase tracking-widest text-green-400">
                                ESP32 Has Control
                            </p>
                            <p className="text-zinc-600 text-[10px] font-mono mt-0.5">
                                Referee is scoring from the handheld controller
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