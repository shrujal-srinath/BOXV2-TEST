// src/hooks/useClockSync.ts
//
// Lightweight NTP-style clock offset measurement using Supabase Realtime.
// Measures round-trip time once on mount and keeps a rolling average offset
// so that getSyncedNow() returns a server-corrected timestamp.

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';

const SYNC_CHANNEL = 'clock-sync';
const SAMPLE_COUNT = 4; // Number of round-trips to average

export function useClockSync() {
    // The calculated offset in ms: serverTime ≈ Date.now() + offset
    const offsetRef = useRef<number>(0);

    useEffect(() => {
        let samples: number[] = [];

        const channel = supabase.channel(SYNC_CHANNEL, {
            config: { broadcast: { self: true, ack: false } },
        });

        channel
            .on('broadcast', { event: 'sync_pong' }, ({ payload }) => {
                const now = Date.now();
                const rtt = now - payload.clientSentAt;
                // Server time at the midpoint of the round trip
                const serverTimeAtMidpoint = payload.serverReceivedAt + rtt / 2;
                const offset = serverTimeAtMidpoint - now;
                samples.push(offset);

                if (samples.length >= SAMPLE_COUNT) {
                    // Use median to discard outliers from noisy pings
                    const sorted = [...samples].sort((a, b) => a - b);
                    offsetRef.current = sorted[Math.floor(sorted.length / 2)];
                    console.log(`[ClockSync] Offset locked: ${offsetRef.current.toFixed(1)}ms`);
                    supabase.removeChannel(channel);
                } else {
                    // Send next ping
                    ping();
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') ping();
            });

        const ping = () => {
            channel.send({
                type: 'broadcast',
                event: 'sync_ping',
                payload: { clientSentAt: Date.now() },
            });
        };

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    /**
     * Returns a server-corrected timestamp (ms).
     * Use this wherever you previously used Date.now() for clock startedAt values.
     */
    const getSyncedNow = useCallback((): number => {
        return Date.now() + offsetRef.current;
    }, []);

    return { getSyncedNow };
}
