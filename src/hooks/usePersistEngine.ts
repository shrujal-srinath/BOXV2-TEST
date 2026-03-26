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
import { fromBasketballGame, toBasketballGame } from '../adapters/basketballAdapter';
import type { Game } from '../core/types/Game';
import type { BasketballState, BasketballRules } from '../sports/basketball/manifest';
import type { BasketballGame } from '../types';

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
    dbGame: Game<BasketballState, BasketballRules> | null,
    engineState: BasketballState,
    enabled: boolean
) => {
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevStateRef = useRef<string>('');

    // Persist to Supabase Postgres (debounced)
    // IMPORTANT: We do a fresh read → merge → write to avoid overwriting
    // changes made by ESP32 hardware or other tabs since dbGame was last fetched.
    const persist = useCallback(async () => {
        if (!gameCode || !enabled) return;

        // Step 1: Read the CURRENT row from DB (not the stale closure copy)
        const { data: row, error: readErr } = await supabase
            .from('games')
            .select('data')
            .eq('code', gameCode)
            .single();

        if (readErr || !row) {
            console.error('[usePersistEngine] Fresh read failed:', readErr?.message);
            return;
        }

        const originalData = row.data as BasketballGame;
        const freshGame = fromBasketballGame(originalData);

        // Step 2: Merge the new engine state into the fresh Game object
        const mergedGame: Game<BasketballState, BasketballRules> = {
            ...freshGame,
            state: {
                ...freshGame.state,
                ...engineState,
            },
            teamA: { ...freshGame.teamA, score: engineState.scoreA },
            teamB: { ...freshGame.teamB, score: engineState.scoreB },
            lastUpdate: Date.now(),
        };

        // Step 3: Convert back to the legacy BasketballGame format for writing
        const dataToWrite = toBasketballGame(mergedGame, originalData);

        // Step 4: Write merged snapshot
        const { error } = await supabase
            .from('games')
            .update({
                data: dataToWrite,
                lastUpdate: Date.now(),
            })
            .eq('code', gameCode);

        if (error) {
            console.error('[usePersistEngine] Write failed:', error.message);
        } else {
            console.debug('[usePersistEngine] Synced →', engineState.scoreA, '-', engineState.scoreB);
        }
    }, [gameCode, engineState, enabled]);

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
            engineState.possession as 'A' | 'B'
        );
    }, [gameCode, engineState, enabled]);

    useEffect(() => {
        if (!enabled || !gameCode) return;

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
    }, [engineState, enabled, gameCode, persist, broadcastNow]);
};