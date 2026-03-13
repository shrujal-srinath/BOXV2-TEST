// src/hooks/usePersistEngine.ts
//
// v2.0 — BROADCAST FIX
//
// [FIX] Added broadcastScoreUpdate() call alongside the DB write.
//       Before this fix, SpectatorView only received score updates via the
//       Postgres subscription (500ms–2s delay). Team B scores appeared not
//       to update because the broadcast channel never received score changes.
//       Now: every time scores change, we BOTH persist to DB (durable) AND
//       broadcast to spectators (instant, <50ms).

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { broadcastScoreUpdate } from '../services/supabaseBroadcastService';

/**
 * usePersistEngine
 *
 * Watches `engineState` (scores, fouls, timeouts, possession from useGameEngine)
 * and:
 *   1. Writes the full game snapshot to Supabase Postgres (durable, 300ms debounce)
 *   2. Broadcasts score update via Supabase Realtime (instant, no debounce)
 *
 * The broadcast is what makes SpectatorView update scores in real time.
 * The DB write is what persists data across sessions.
 */
export const usePersistEngine = (
    gameCode: string | null,
    dbGame: any,
    engineState: {
        scoreA: number;
        scoreB: number;
        foulsA: number;
        foulsB: number;
        timeoutsA: number;
        timeoutsB: number;
        possession: 'A' | 'B';
    },
    enabled: boolean
) => {
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevStateRef = useRef<string>('');

    // Persist to Supabase Postgres (debounced)
    const persist = useCallback(async () => {
        if (!gameCode || !dbGame || !enabled) return;

        const snapshot = {
            ...dbGame,
            teamA: {
                ...dbGame.teamA,
                score: engineState.scoreA,
                fouls: engineState.foulsA,
                timeouts: engineState.timeoutsA,
            },
            teamB: {
                ...dbGame.teamB,
                score: engineState.scoreB,
                fouls: engineState.foulsB,
                timeouts: engineState.timeoutsB,
            },
            gameState: {
                ...dbGame.gameState,
                possession: engineState.possession,
            },
            lastUpdate: Date.now(),
        };

        const { error } = await supabase
            .from('games')
            .update({
                data: snapshot,
                lastUpdate: Date.now(),
            })
            .eq('code', gameCode);

        if (error) {
            console.error('[usePersistEngine] Write failed:', error.message);
        } else {
            console.debug('[usePersistEngine] Synced →', engineState.scoreA, '-', engineState.scoreB);
        }
    }, [gameCode, dbGame, engineState, enabled]);

    // Broadcast score update instantly (no debounce — spectators need this NOW)
    const broadcastNow = useCallback(() => {
        if (!gameCode || !enabled) return;
        broadcastScoreUpdate(
            gameCode,
            engineState.scoreA,
            engineState.scoreB,
            engineState.foulsA,
            engineState.foulsB,
            engineState.timeoutsA,
            engineState.timeoutsB,
            engineState.possession,
        );
    }, [gameCode, engineState, enabled]);

    useEffect(() => {
        if (!enabled || !gameCode || !dbGame) return;

        const stateKey = JSON.stringify(engineState);
        if (stateKey === prevStateRef.current) return;
        prevStateRef.current = stateKey;

        // Broadcast immediately — spectators see it in <50ms
        broadcastNow();

        // Debounce the DB write — collapse rapid updates (e.g. +3 quick taps)
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(persist, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [engineState, enabled, gameCode, dbGame, persist, broadcastNow]);
};