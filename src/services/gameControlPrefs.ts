// src/services/gameControlPrefs.ts
// Game-flow preferences that change how the daemon's clock events are reacted
// to and how the on-screen referee deck behaves. Stored in localStorage so they
// persist across reloads.

import { useEffect, useState } from 'react';

const LS_KEEP_CLOCK_ON_SHOT_VIOLATION = 'boxv2-game-keep-clock-on-shot-violation';
const LS_MINIMIZE_HEADER              = 'boxv2-game-minimize-header';
const LS_DISABLE_SCORE_POPUP          = 'boxv2-game-disable-score-popup';
const LS_DISABLE_TOUCH_DECK           = 'boxv2-game-disable-touch-deck';

const EVT = 'boxv2-game-control-prefs-changed';

const readBool = (key: string, fallback: boolean): boolean => {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === 'true';
};

const writeBool = (key: string, v: boolean): void => {
    localStorage.setItem(key, String(v));
    window.dispatchEvent(new CustomEvent(EVT));
};

export const getKeepClockOnShotViolation = () => readBool(LS_KEEP_CLOCK_ON_SHOT_VIOLATION, true);
export const setKeepClockOnShotViolation = (v: boolean) => writeBool(LS_KEEP_CLOCK_ON_SHOT_VIOLATION, v);

export const getMinimizeHeader = () => readBool(LS_MINIMIZE_HEADER, false);
export const setMinimizeHeader = (v: boolean) => writeBool(LS_MINIMIZE_HEADER, v);

export const getDisableScorePopup = () => readBool(LS_DISABLE_SCORE_POPUP, false);
export const setDisableScorePopup = (v: boolean) => writeBool(LS_DISABLE_SCORE_POPUP, v);

export const getDisableTouchDeck = () => readBool(LS_DISABLE_TOUCH_DECK, false);
export const setDisableTouchDeck = (v: boolean) => writeBool(LS_DISABLE_TOUCH_DECK, v);

function useBoolPref(read: () => boolean, write: (v: boolean) => void): [boolean, (v: boolean) => void] {
    const [val, setVal] = useState<boolean>(read);
    useEffect(() => {
        const onChange = () => setVal(read());
        window.addEventListener(EVT, onChange);
        window.addEventListener('storage', onChange);
        return () => {
            window.removeEventListener(EVT, onChange);
            window.removeEventListener('storage', onChange);
        };
    }, [read]);
    const set = (next: boolean) => {
        setVal(next);
        write(next);
    };
    return [val, set];
}

export const useKeepClockOnShotViolation = () =>
    useBoolPref(getKeepClockOnShotViolation, setKeepClockOnShotViolation);

export const useMinimizeHeader = () =>
    useBoolPref(getMinimizeHeader, setMinimizeHeader);

export const useDisableScorePopup = () =>
    useBoolPref(getDisableScorePopup, setDisableScorePopup);

export const useDisableTouchDeck = () =>
    useBoolPref(getDisableTouchDeck, setDisableTouchDeck);
