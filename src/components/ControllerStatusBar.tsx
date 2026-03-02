// src/components/ControllerStatusBar.tsx
//
// Persistent hardware controller status bar.
// Shown at the top of Dashboard, HostConsole, GameSetup.
// Always reflects live heartbeat — no false positives.
//
// When a game is active, shows the Control Mode switcher:
//   [ESP32 ONLY]  [SHARED]  [WEB ONLY]

import React, { useState, useEffect } from 'react';
import {
    subscribeToDeviceHeartbeat,
    setControlMode,
    subscribeToControlMode,
    HW_SESSION_KEY,
    type ControlMode,
} from '../services/handheldService';

interface ControllerStatusBarProps {
    /** Pass gameId when inside an active game — enables control mode switcher */
    activeGameId?: string;
    teamAName?: string;
    teamBName?: string;
    /** Called when user opens the connect modal */
    onConnectClick?: () => void;
}

export const ControllerStatusBar: React.FC<ControllerStatusBarProps> = ({
    activeGameId,
    teamAName,
    teamBName,
    onConnectClick,
}) => {
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [online, setOnline] = useState(false);
    const [lastSeen, setLastSeen] = useState(0);
    const [controlMode, setControlModeState] = useState<ControlMode>('web');
    const [switching, setSwitching] = useState(false);

    // Read device id from session
    useEffect(() => {
        const id = sessionStorage.getItem(HW_SESSION_KEY);
        setDeviceId(id);
    }, []);

    // Subscribe to heartbeat (live, no false positives)
    useEffect(() => {
        if (!deviceId) return;
        const unsub = subscribeToDeviceHeartbeat(deviceId, (isOnline, ts) => {
            setOnline(isOnline);
            setLastSeen(ts);
        });
        return unsub;
    }, [deviceId]);

    // Subscribe to control mode changes
    useEffect(() => {
        if (!deviceId) return;
        const unsub = subscribeToControlMode(deviceId, (mode) => {
            setControlModeState(mode);
        });
        return unsub;
    }, [deviceId]);

    const handleSetMode = async (mode: ControlMode) => {
        if (!deviceId || switching) return;
        setSwitching(true);
        await setControlMode(deviceId, mode, teamAName, teamBName);
        setSwitching(false);
    };

    // ── No device paired ──────────────────────────────────────────────────────
    if (!deviceId) {
        return (
            <button
                onClick={onConnectClick}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-zinc-700 hover:border-zinc-500 transition-colors text-zinc-600 hover:text-zinc-400"
            >
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                <span className="text-[10px] font-bold uppercase tracking-widest font-mono">No Controller</span>
            </button>
        );
    }

    // ── Device paired but offline ─────────────────────────────────────────────
    if (!online) {
        const secAgo = lastSeen > 0 ? Math.round((Date.now() - lastSeen) / 1000) : null;
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-zinc-600">
                    CTRL-{deviceId}
                </span>
                <span className="text-[9px] font-mono text-zinc-700">
                    {secAgo !== null ? `${secAgo}s ago` : 'offline'}
                </span>
            </div>
        );
    }

    // ── Device online, no active game ─────────────────────────────────────────
    if (!activeGameId) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-green-900/40 bg-green-950/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-green-400">
                    CTRL-{deviceId}
                </span>
                <span className="text-[9px] font-mono text-green-700">ONLINE</span>
            </div>
        );
    }

    // ── Active game — show control mode switcher ──────────────────────────────
    const modes: { key: ControlMode; label: string; short: string }[] = [
        { key: 'hardware', label: 'ESP32 Only', short: 'HW' },
        { key: 'web', label: 'Web Only', short: 'WEB' },
    ];

    const modeColors: Record<ControlMode, string> = {
        hardware: 'bg-green-500/10 border-green-600 text-green-400',
        web: 'bg-zinc-800 border-zinc-600 text-zinc-300',
    };

    const activeModeColor = modeColors[controlMode];

    return (
        <div className="flex items-center gap-2">
            {/* Device pill */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${activeModeColor}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
                    CTRL-{deviceId}
                </span>
            </div>

            {/* Control mode switcher */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                {modes.map(m => (
                    <button
                        key={m.key}
                        onClick={() => handleSetMode(m.key)}
                        disabled={switching}
                        title={m.label}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all font-mono
                            ${controlMode === m.key
                                ? 'bg-white text-black'
                                : 'text-zinc-600 hover:text-zinc-300 disabled:opacity-50'
                            }`}
                    >
                        {m.short}
                    </button>
                ))}
            </div>
        </div>
    );
};