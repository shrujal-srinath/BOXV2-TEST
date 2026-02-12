// src/hooks/useLocalGameTimer.ts
// ─────────────────────────────────────────────────────────────
// STANDALONE TIMER HOOK — replaces useLocalGameTimer in useLocalGame.ts
//
// THE BUG THAT WAS KILLED:
//   The old useLocalGameTimer called useLocalGame(gameId) internally.
//   React hooks create isolated state per call-site.
//   So the timer was ticking against a GHOST COPY of the game —
//   a second independent state instance that nobody else could read.
//   The visible game state never changed. Clock appeared frozen.
//
// THE FIX:
//   The timer no longer creates its own useLocalGame instance.
//   Instead, TabletController passes its OWN updateGameState + game
//   directly into this hook. One state owner. No ghost copies.
//
// USAGE in TabletController.tsx:
//   Replace:
//     useLocalGameTimer(gameCode || '');
//   With:
//     useStandaloneTimer(
//       localGameHook.game?.gameState.gameRunning ?? false,
//       localGameHook.updateGameState
//     );
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';

type UpdateFn = (updater: (game: any) => void) => void;

export const useStandaloneTimer = (
    isRunning: boolean,
    updateGameState: UpdateFn
) => {
    const timerRef = useRef<number | null>(null);
    // Keep a stable ref to updateGameState so the interval closure never goes stale
    const updateRef = useRef<UpdateFn>(updateGameState);
    useEffect(() => { updateRef.current = updateGameState; }, [updateGameState]);

    useEffect(() => {
        if (!isRunning) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        timerRef.current = window.setInterval(() => {
            updateRef.current((g) => {
                const totalSec =
                    g.gameState.gameTime.minutes * 60 + g.gameState.gameTime.seconds;

                if (totalSec > 0) {
                    const newTotal = totalSec - 1;
                    g.gameState.gameTime.minutes = Math.floor(newTotal / 60);
                    g.gameState.gameTime.seconds = newTotal % 60;

                    // Shot clock counts down in sync (stops at 0)
                    if (g.gameState.shotClock > 0) {
                        g.gameState.shotClock = Math.max(0, g.gameState.shotClock - 1);
                    }
                } else {
                    // Period ended
                    g.gameState.gameRunning = false;
                    g.gameState.gameTime.minutes = 0;
                    g.gameState.gameTime.seconds = 0;
                    if (navigator.vibrate) {
                        navigator.vibrate([200, 100, 200, 100, 200]);
                    }
                }
            });
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isRunning]); // only re-subscribe when running state changes
};