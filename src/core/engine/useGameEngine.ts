// src/core/engine/useGameEngine.ts
//
// ── BUG FIXED #1: Scores reset to 0 on page refresh ──────────────────────────
//
// ROOT CAUSE:
//   useReducer(reducer, initialGame.state) seeds itself on the FIRST render only.
//   On mount, dbGame is null → initialGame.state = createInitialState() = all zeros.
//   When dbGame arrives from Supabase 200ms later, React ignores the new initialGame
//   arg — useReducer never re-seeds. Engine stuck at 0-0 after every refresh.
//
// FIX:
//   Internal __HYDRATE__ action. When initialGame changes to a real DB object
//   (identified by presence of .code or .hostId), dispatch HYDRATE to re-seed
//   the reducer with the actual saved state.
//
// ── BUG FIXED #2: Double DB write on every action ─────────────────────────────
//   dispatch() was calling saveGameAction AND usePersistEngine was also writing.
//   Removed saveGameAction — usePersistEngine is the sole owner of DB writes.

import { useReducer, useCallback, useEffect, useRef } from 'react';
import { SportManifest } from '../types/Manifest';
import { Game, BaseGameState } from '../types/Game';

type HydrateAction<TState> = { type: '__HYDRATE__'; state: TState };

export function useGameEngine<TState extends BaseGameState, TAction, TRules>(
    gameId: string,
    initialGame: Game<TState, TRules>,
    manifest: SportManifest<TState, TAction, TRules>,
    isAdmin: boolean = false
) {
    const rulesRef = useRef(initialGame.rules);

    // Combined reducer: handles sport actions + internal HYDRATE signal
    const combinedReducer = useCallback(
        (currentState: TState, action: TAction | HydrateAction<TState>): TState => {
            if ((action as HydrateAction<TState>).type === '__HYDRATE__') {
                return (action as HydrateAction<TState>).state;
            }
            return manifest.reducer(currentState, action as TAction, rulesRef.current);
        },
        [manifest]
    );

    const [state, reactDispatch] = useReducer(combinedReducer as any, initialGame.state);

    // Tracks which state snapshot we've already hydrated from, preventing re-hydration loops
    const hydratedKeyRef = useRef<string>('');

    useEffect(() => {
        if (!gameId || !initialGame) return;

        const isRealDbGame = !!(initialGame as any).code;
        if (!isRealDbGame) return;

        // FIX: Watch the exact database timestamp. If the DB row was updated by the ESP32, 
        // lastUpdate will be completely new, forcing React to ingest the hardware scores.
        const hydrationKey = `${gameId}:${initialGame.lastUpdate}`;

        if (hydratedKeyRef.current === hydrationKey) return;

        hydratedKeyRef.current = hydrationKey;
        reactDispatch({ type: '__HYDRATE__', state: initialGame.state } as any);
    }, [gameId, initialGame]);

    const dispatch = useCallback(
        (action: TAction) => {
            // Optimistic UI — usePersistEngine owns all DB writes, no double write here
            reactDispatch(action as any);

            // Tournament bridge
            const nextState = manifest.reducer(state as TState, action, rulesRef.current);
            const result = manifest.normalizeResult(nextState, rulesRef.current);
            if (result.isComplete) {
                console.log(`[Tournament Bridge] Game ${gameId} complete! Winner: ${result.winner}`);
            }
        },
        [state, manifest, gameId]
    );

    const adminPatchState = useCallback(
        (patch: Partial<TState>) => {
            if (!isAdmin) return;
            reactDispatch({ type: '__HYDRATE__', state: { ...(state as TState), ...patch } } as any);
        },
        [isAdmin, state]
    );

    return { state: state as TState, dispatch, adminPatchState };
}