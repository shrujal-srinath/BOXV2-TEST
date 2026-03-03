// src/hooks/usePersistEngine.ts
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';

/**
 * usePersistEngine
 *
 * Watches `engineState` (scores, fouls, timeouts, possession from useGameEngine)
 * and writes the full game snapshot back to Supabase whenever it changes.
 *
 * Debounced at 300ms — collapses rapid dispatches into one DB write.
 * This is what makes SpectatorView update in real time.
 *
 * @param gameCode   - The 6-digit game code
 * @param dbGame     - The full BasketballGame object from subscribeToGame()
 * @param engineState - The state object from useGameEngine (scoreA, scoreB, etc.)
 * @param enabled    - Set false when gameCode is missing or game hasn't loaded yet
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

    const persist = useCallback(async () => {
        if (!gameCode || !dbGame || !enabled) return;

        // Build the full snapshot merging engine state into dbGame structure
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
            console.debug('[usePersistEngine] Synced scores to DB →', engineState.scoreA, '-', engineState.scoreB);
        }
    }, [gameCode, dbGame, engineState, enabled]);

    useEffect(() => {
        if (!enabled || !gameCode || !dbGame) return;

        // Serialize the parts we care about to detect actual changes
        const stateKey = JSON.stringify({
            sA: engineState.scoreA,
            sB: engineState.scoreB,
            fA: engineState.foulsA,
            fB: engineState.foulsB,
            tA: engineState.timeoutsA,
            tB: engineState.timeoutsB,
            pos: engineState.possession,
        });

        // Skip if nothing changed (prevents write on initial mount)
        if (stateKey === prevStateRef.current) return;
        prevStateRef.current = stateKey;

        // Debounce: cancel previous pending write, schedule new one
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(persist, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [
        engineState.scoreA,
        engineState.scoreB,
        engineState.foulsA,
        engineState.foulsB,
        engineState.timeoutsA,
        engineState.timeoutsB,
        engineState.possession,
        enabled,
        persist,
    ]);
};
