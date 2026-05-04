// src/hooks/useBoxSignaling.ts
// Listens to the Pi tabletop controller on channel box-{gameCode}.
// Pi daemon broadcasts full SCORE_STATE snapshots — not discrete action signals.
// Used in HostConsole alongside useHardwareSignaling (ESP32 handheld path).

import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

export interface BoxStateSnapshot {
    action: 'SCORE_STATE';
    deviceId: string;
    gameId: string;
    scoreA: number;
    scoreB: number;
    foulsA: number;
    foulsB: number;
    period: number;
    gameRunning: boolean;
    paused: boolean;
    possession: 'A' | 'B';
    minutes: number;
    seconds: number;
    shotClock: number;
    timestamp: number;
}

export type BoxSnapshotHandler = (snapshot: BoxStateSnapshot) => void;

export function useBoxSignaling(
    gameCode: string | null,
    boxCode: string | null,
    onSnapshot: BoxSnapshotHandler,
) {
    const onSnapshotRef = useRef(onSnapshot);
    useEffect(() => { onSnapshotRef.current = onSnapshot; }, [onSnapshot]);

    const lastTimestampRef = useRef(0);

    useEffect(() => {
        if (!gameCode || !boxCode) return;

        const channel = supabase
            .channel(`box-signal-rx:${gameCode}`)
            .on('broadcast', { event: 'signal' }, ({ payload }) => {
                const p = payload as BoxStateSnapshot;
                if (!p || p.action !== 'SCORE_STATE') return;
                // Deduplicate — drop older or equal timestamps
                if (p.timestamp && p.timestamp <= lastTimestampRef.current) return;
                if (p.timestamp) lastTimestampRef.current = p.timestamp;
                // Only accept signals from the paired box unit
                if (boxCode && p.deviceId &&
                    p.deviceId.toUpperCase() !== boxCode.toUpperCase()) return;
                onSnapshotRef.current(p);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [gameCode, boxCode]);
}
