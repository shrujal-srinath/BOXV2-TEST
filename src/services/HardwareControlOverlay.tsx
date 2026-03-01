// src/components/HardwareControlOverlay.tsx
//
// v3.0 — Simplified to 2 modes only.
//
// Shown inside HostConsole when controlMode === 'hardware'.
// The scoring/foul/timeout buttons are locked — this overlay explains why
// and provides a one-tap option to take web control.
//
// When controlMode === 'web', this component is not rendered (isLocked = false).

import React, { useState } from 'react';
import { setControlMode, type ControlMode } from '../services/handheldService';

interface HardwareControlOverlayProps {
    controlMode: ControlMode;
    deviceId: string | null;
    teamAName?: string;
    teamBName?: string;
    /** If true, web buttons are disabled. Overlay is shown. */
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

    if (!isLocked) return null;

    const doSwitch = async (mode: ControlMode) => {
        if (!deviceId || switching) return;
        setSwitching(true);
        await setControlMode(deviceId, mode, teamAName, teamBName);
        setSwitching(false);
    };

    return (
        <div className="relative">
            {/* Lock banner */}
            <div className="bg-zinc-950 border border-green-900/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    {/* Left: Status */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/10 border border-green-600/40">
                            {/* Controller icon */}
                            <svg className="w-4 h-4 text-green-400"
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

                    {/* Right: Take Control button */}
                    <div className="flex items-center gap-2">
                        {switching ? (
                            <span className="text-[10px] font-mono text-zinc-600 animate-pulse">Switching...</span>
                        ) : (
                            <button
                                onClick={() => doSwitch('web')}
                                className="px-3 py-1.5 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-zinc-200 transition-colors"
                            >
                                Take Control
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};