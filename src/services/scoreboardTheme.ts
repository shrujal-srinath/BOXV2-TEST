// src/services/scoreboardTheme.ts
// ───────────────────────────────────────────────────────────────
// Persists the referee's preferred scoreboard theme to localStorage
// and notifies subscribers when it changes (so a switch from the
// settings panel takes effect immediately on the live screen).
// ───────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';

export type ScoreboardTheme = 'classic' | 'minimal';

const LS_KEY = 'THE_BOX_SCOREBOARD_THEME';
const EVT = 'scoreboard-theme-change';

export function getScoreboardTheme(): ScoreboardTheme {
    try {
        const v = localStorage.getItem(LS_KEY);
        return v === 'minimal' ? 'minimal' : 'classic';
    } catch {
        return 'classic';
    }
}

export function setScoreboardTheme(t: ScoreboardTheme): void {
    try { localStorage.setItem(LS_KEY, t); } catch { /* swallow */ }
    window.dispatchEvent(new CustomEvent<ScoreboardTheme>(EVT, { detail: t }));
}

/** React hook — returns the active theme and a setter that persists + broadcasts. */
export function useScoreboardTheme(): [ScoreboardTheme, (t: ScoreboardTheme) => void] {
    const [theme, setTheme] = useState<ScoreboardTheme>(() => getScoreboardTheme());
    useEffect(() => {
        const handler = (e: Event) => setTheme((e as CustomEvent<ScoreboardTheme>).detail);
        window.addEventListener(EVT, handler);
        return () => window.removeEventListener(EVT, handler);
    }, []);
    return [theme, setScoreboardTheme];
}
