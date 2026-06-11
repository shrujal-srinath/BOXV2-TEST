// src/components/refereebox/TimeEditor.tsx
// Min/Sec/Ms editor with PRECISION toggle, presets, numpad, and absolute APPLY.
// Used to override the game clock or shot clock.

import React, { useState } from 'react';
import {
    SB_BDR, SB_BDR_HI, SB_DIM, SB_AMBER, SB_OSW, SB_RM, SB_WHITE,
    CornerBrackets,
} from './sharedScoreboard';

export type TimeEditorMode = 'game' | 'shot';

interface Props {
    mode: TimeEditorMode;
    /** Current value in milliseconds (the modal opens against this snapshot). */
    currentMs: number;
    /** Called with the absolute target ms; parent decides which sendAction to use. */
    onApply: (targetMs: number) => void;
    onCancel: () => void;
}

// Centiseconds (1/100s) — 2-digit precision shown to user.
// Internally we store centiseconds (0-99); multiply by 10 to get ms.
type Column = 'min' | 'sec' | 'cs';

const GAME_PRESETS: Array<{ label: string; ms: number }> = [
    { label: '10:00', ms: 600_000 },
    { label: '5:00',  ms: 300_000 },
    { label: '2:00',  ms: 120_000 },
    { label: '1:00',  ms:  60_000 },
    { label: '0:30',  ms:  30_000 },
    { label: '0:10',  ms:  10_000 },
    { label: '0:00',  ms:       0 },
];
const SHOT_PRESETS: Array<{ label: string; ms: number }> = [
    { label: '24', ms: 24_000 },
    { label: '14', ms: 14_000 },
    { label: '8',  ms:  8_000 },
    { label: '5',  ms:  5_000 },
    { label: '0',  ms:      0 },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function msToParts(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const cs  = Math.floor(Math.max(0, ms - totalSec * 1000) / 10); // centiseconds 0-99
    return { min, sec, cs };
}
function partsToMs(min: number, sec: number, cs: number) {
    return Math.max(0, (min * 60 + sec) * 1000 + cs * 10);
}

const TimeEditor: React.FC<Props> = ({ mode, currentMs, onApply, onCancel }) => {
    const init = msToParts(currentMs);
    const [min,  setMin]  = useState<number>(init.min);
    const [sec,  setSec]  = useState<number>(init.sec);
    const [cs,   setCs]   = useState<number>(init.cs);
    const [focusCol, setFocusCol] = useState<Column>(mode === 'shot' ? 'sec' : 'min');
    const [draft, setDraft] = useState<string>('');

    const accent = mode === 'game' ? SB_WHITE : SB_AMBER;

    const targetMs    = partsToMs(min, sec, cs);
    const targetLabel = `${pad2(min)}:${pad2(sec)}.${pad2(cs)}`;
    const currentLabel = (() => {
        const p = msToParts(currentMs);
        return `${pad2(p.min)}:${pad2(p.sec)}.${pad2(p.cs)}`;
    })();

    // ── Numpad input flows into focused column ───────────────
    const press = (k: string) => {
        if (k === '⌫') {
            setDraft(d => {
                const next = d.slice(0, -1);
                applyDraftToColumn(focusCol, next);
                return next;
            });
            return;
        }
        if (k === '✕') { setDraft(''); applyDraftToColumn(focusCol, ''); return; }

        if (draft.length >= 2) return;
        const next = (draft === '0' ? '' : draft) + k;
        setDraft(next);
        applyDraftToColumn(focusCol, next);
    };

    const applyDraftToColumn = (col: Column, str: string) => {
        const n = str === '' ? 0 : parseInt(str, 10);
        if (col === 'min') setMin(clamp(n, 0, 99));
        if (col === 'sec') setSec(clamp(n, 0, 59));
        if (col === 'cs')  setCs(clamp(n, 0, 99));
    };

    const focusColumn = (c: Column) => { setFocusCol(c); setDraft(''); };

    const bumpFocused = (delta: number) => {
        if (focusCol === 'min')      setMin(m => clamp(m + delta, 0, 99));
        else if (focusCol === 'sec') setSec(s => clamp(s + delta, 0, 59));
        else                          setCs(v  => clamp(v + delta, 0, 99));
        setDraft('');
    };

    const applyPreset = (ms: number) => {
        const p = msToParts(ms);
        setMin(p.min); setSec(p.sec); setCs(p.cs);
        setDraft('');
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
        }}>
            <div style={{
                position: 'relative',
                width: 620, maxWidth: '100%',
                background: '#0a0a0a',
                border: `1px solid ${accent}66`,
                boxShadow: `0 0 60px ${accent}33`,
                padding: 24,
                fontFamily: SB_RM,
            }}>
                <CornerBrackets color={accent} size={14} thickness={2} />

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 18, paddingBottom: 12,
                    borderBottom: `1px solid ${SB_BDR_HI}`,
                }}>
                    <span style={{
                        fontFamily: SB_RM, fontSize: 11, color: accent,
                        fontWeight: 700, letterSpacing: '0.28em',
                        textTransform: 'uppercase',
                    }}>
                        EDIT {mode === 'game' ? 'GAME CLOCK' : 'SHOT CLOCK'}
                    </span>
                    <div
                        onClick={onCancel}
                        style={{
                            cursor: 'pointer', padding: '2px 8px',
                            color: SB_DIM, fontFamily: SB_RM, fontSize: 14, fontWeight: 700,
                        }}
                    >✕</div>
                </div>

                {/* Body — 2 columns: stepper grid (left) + numpad (right) */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 200px',
                    gap: 20,
                }}>
                    {/* LEFT: stepper columns + presets + readout */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                        {/* Stepper columns — always MM:SS.CC */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 8,
                        }}>
                            <StepperColumn
                                label="MIN"
                                value={pad2(min)}
                                accent={accent}
                                focused={focusCol === 'min'}
                                onTap={() => focusColumn('min')}
                                onUp={() => { setFocusCol('min'); bumpFocused(1); }}
                                onDown={() => { setFocusCol('min'); bumpFocused(-1); }}
                            />
                            <Separator label=":" />
                            <StepperColumn
                                label="SEC"
                                value={pad2(sec)}
                                accent={accent}
                                focused={focusCol === 'sec'}
                                onTap={() => focusColumn('sec')}
                                onUp={() => { setFocusCol('sec'); bumpFocused(1); }}
                                onDown={() => { setFocusCol('sec'); bumpFocused(-1); }}
                            />
                            <Separator label="." />
                            <StepperColumn
                                label="1/100s"
                                value={pad2(cs)}
                                accent={accent}
                                focused={focusCol === 'cs'}
                                onTap={() => focusColumn('cs')}
                                onUp={() => { setFocusCol('cs'); bumpFocused(1); }}
                                onDown={() => { setFocusCol('cs'); bumpFocused(-1); }}
                            />
                        </div>

                        {/* Presets */}
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: 6,
                        }}>
                            <span style={{ fontSize: 8, color: SB_DIM, letterSpacing: '0.28em', fontWeight: 700, textAlign: 'center' }}>
                                PRESETS
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                                {(mode === 'game' ? GAME_PRESETS : SHOT_PRESETS).map(p => (
                                    <PresetChip
                                        key={p.label}
                                        label={p.label}
                                        onClick={() => applyPreset(p.ms)}
                                        accent={accent}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Current vs target readout */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            padding: '8px 12px',
                            border: `1px solid ${SB_BDR}`,
                            background: 'rgba(255,255,255,0.02)',
                        }}>
                            <div>
                                <div style={{ fontSize: 7, color: SB_DIM, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 2 }}>CURRENT</div>
                                <div style={{ fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: SB_DIM }}>{currentLabel}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 7, color: accent, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 2 }}>TARGET</div>
                                <div style={{ fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: accent, textShadow: `0 0 10px ${accent}66` }}>{targetLabel}</div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: numpad */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 6, alignContent: 'start',
                    }}>
                        {['7','8','9','4','5','6','1','2','3','0','⌫','✕'].map(k => (
                            <NumKey key={k} label={k} onClick={() => press(k)} accent={accent} />
                        ))}
                    </div>
                </div>

                {/* Footer actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                    <ActionBtn label="CANCEL" color={SB_DIM} onClick={onCancel} />
                    <ActionBtn
                        label={`APPLY → ${targetLabel}`}
                        color={accent}
                        onClick={() => onApply(targetMs)}
                        primary
                    />
                </div>
            </div>
        </div>
    );
};

// ── helpers ──────────────────────────────────────────────────
function pad2(n: number): string { return String(n).padStart(2, '0'); }

const StepperColumn: React.FC<{
    label: string;
    value: string;
    accent: string;
    focused: boolean;
    onTap: () => void;
    onUp: () => void;
    onDown: () => void;
}> = ({ label, value, accent, focused, onTap, onUp, onDown }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span style={{
            fontFamily: SB_RM, fontSize: 8,
            color: focused ? accent : SB_DIM,
            letterSpacing: '0.32em', fontWeight: 700,
        }}>{label}</span>
        <Arrow direction="up" onClick={onUp} accent={accent} />
        <div
            onClick={onTap}
            style={{
                width: 64, height: 56,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: focused ? `${accent}1a` : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${focused ? accent : SB_BDR_HI}`,
                color: SB_WHITE,
                fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
                fontSize: 32, fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
                cursor: 'pointer', userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: focused ? `0 0 14px ${accent}55, inset 0 0 8px ${accent}22` : 'none',
                transition: 'all 0.12s',
            }}
        >
            {value}
        </div>
        <Arrow direction="down" onClick={onDown} accent={accent} />
    </div>
);

const Separator: React.FC<{ label: string }> = ({ label }) => (
    <span style={{
        fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
        fontSize: 32, color: SB_DIM, alignSelf: 'center',
        marginTop: 22,   // align with the digit cell
    }}>{label}</span>
);

const Arrow: React.FC<{ direction: 'up' | 'down'; onClick: () => void; accent: string }> = ({
    direction, onClick, accent,
}) => (
    <div
        onClick={onClick}
        style={{
            width: 64, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${SB_BDR_HI}`,
            color: accent, fontFamily: SB_OSW, fontWeight: 700, fontSize: 14,
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.12s, transform 0.06s',
        }}
        onTouchStart={e => {
            (e.currentTarget as HTMLElement).style.background = `${accent}33`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)';
        }}
        onTouchEnd={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
    >
        {direction === 'up' ? '▲' : '▼'}
    </div>
);


const PresetChip: React.FC<{ label: string; onClick: () => void; accent: string }> = ({
    label, onClick, accent,
}) => (
    <div
        onClick={onClick}
        style={{
            padding: '6px 12px',
            border: `1px solid ${SB_BDR_HI}`,
            background: 'rgba(255,255,255,0.025)',
            color: SB_WHITE,
            fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
            fontSize: 13, letterSpacing: '0.04em',
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.12s, transform 0.06s',
        }}
        onTouchStart={e => {
            (e.currentTarget as HTMLElement).style.background = `${accent}33`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)';
        }}
        onTouchEnd={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)';
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
    >{label}</div>
);

const NumKey: React.FC<{ label: string; onClick: () => void; accent: string }> = ({
    label, onClick, accent,
}) => (
    <div
        onClick={onClick}
        style={{
            height: 48,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${SB_BDR_HI}`,
            color: SB_WHITE,
            fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
            fontSize: 22,
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.12s, transform 0.06s',
        }}
        onTouchStart={e => {
            (e.currentTarget as HTMLElement).style.background = `${accent}33`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)';
        }}
        onTouchEnd={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
    >{label}</div>
);

const ActionBtn: React.FC<{
    label: string; color: string; onClick: () => void; primary?: boolean;
}> = ({ label, color, onClick, primary = false }) => (
    <div
        onClick={onClick}
        style={{
            flex: 1, height: 48,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: primary ? `${color}1f` : 'rgba(255,255,255,0.025)',
            border: `1px solid ${primary ? color : SB_BDR_HI}`,
            color: primary ? color : SB_DIM,
            fontFamily: SB_RM, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            boxShadow: primary ? `0 0 14px ${color}33, inset 0 1px 0 ${color}33` : 'none',
            transition: 'transform 0.06s',
        }}
        onTouchStart={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
        onTouchEnd={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
    >{label}</div>
);

export default TimeEditor;
