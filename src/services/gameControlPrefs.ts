// src/services/gameControlPrefs.ts
// Game-flow preferences that change how the daemon's clock events are reacted
// to and how the on-screen referee deck behaves. Stored in localStorage so they
// persist across reloads.

import { useEffect, useState } from 'react';

const LS_KEEP_CLOCK_ON_SHOT_VIOLATION = 'boxv2-game-keep-clock-on-shot-violation';
const LS_MINIMIZE_HEADER              = 'boxv2-game-minimize-header';
const LS_DISABLE_SCORE_POPUP          = 'boxv2-game-disable-score-popup';
const LS_DISABLE_TOUCH_DECK           = 'boxv2-game-disable-touch-deck';
const LS_SHOT_TYPE_SELECTION          = 'boxv2-game-shot-type-selection';
const LS_QUICK_ENTRY                  = 'boxv2-game-quick-entry';
const LS_HAPTICS                      = 'boxv2-pi-haptics';
const LS_RIM_ACCENT                   = 'boxv2-pi-court-rimaccent';
const LS_CHEVRONS                     = 'boxv2-pi-court-chevrons';

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

export const getShotTypeSelection = () => readBool(LS_SHOT_TYPE_SELECTION, false);
export const setShotTypeSelection = (v: boolean) => writeBool(LS_SHOT_TYPE_SELECTION, v);

export const useShotTypeSelection = () =>
    useBoolPref(getShotTypeSelection, setShotTypeSelection);

export const getQuickEntry = () => readBool(LS_QUICK_ENTRY, false);
export const setQuickEntry = (v: boolean) => writeBool(LS_QUICK_ENTRY, v);

export const useQuickEntry = () =>
    useBoolPref(getQuickEntry, setQuickEntry);

export const getHaptics = () => readBool(LS_HAPTICS, true);
export const setHaptics = (v: boolean) => writeBool(LS_HAPTICS, v);

export const useHaptics = () =>
    useBoolPref(getHaptics, setHaptics);

export const getRimAccent = () => readBool(LS_RIM_ACCENT, false);
export const setRimAccent = (v: boolean) => writeBool(LS_RIM_ACCENT, v);
export const useRimAccent = () => useBoolPref(getRimAccent, setRimAccent);

export const getChevrons = () => readBool(LS_CHEVRONS, false);
export const setChevrons = (v: boolean) => writeBool(LS_CHEVRONS, v);
export const useChevrons = () => useBoolPref(getChevrons, setChevrons);
