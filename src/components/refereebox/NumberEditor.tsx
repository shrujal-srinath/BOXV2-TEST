// src/components/refereebox/NumberEditor.tsx
// Numpad-driven absolute integer editor. Used for score override.

import React, { useState } from 'react';
import {
    SB_BG, SB_BDR_HI, SB_DIM, SB_GREEN, SB_OSW, SB_RM, SB_WHITE,
    CornerBrackets,
} from './sharedScoreboard';

interface Props {
    title: string;
    currentValue: number;
    /** Optional max digits (default 3 → 0–999). */
    maxDigits?: number;
    /** Bracket / accent colour for the modal border + APPLY button. */
    accent?: string;
    onApply: (value: number) => void;
    onCancel: () => void;
}

const NumberEditor: React.FC<Props> = ({
    title, currentValue, maxDigits = 3,
    accent = SB_GREEN,
    onApply, onCancel,
}) => {
    const [draft, setDraft] = useState<string>('');
    const target = draft === '' ? currentValue : parseInt(draft, 10);

    const press = (k: string) => {
        if (k === '⌫') { setDraft(d => d.slice(0, -1)); return; }
        if (k === '✕') { setDraft(''); return; }
        if (draft.length >= maxDigits) return;
        // Suppress leading zeros
        if (draft === '' && k === '0') { setDraft('0'); return; }
        setDraft(d => (d === '0' ? k : d + k));
    };

    const apply = () => {
        const v = isNaN(target) ? currentValue : Math.max(0, target);
        onApply(v);
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
                width: 440, maxWidth: '100%',
                background: '#0a0a0a',
                border: `1px solid ${accent}66`,
                boxShadow: `0 0 60px ${accent}33`,
                padding: 24,
            }}>
                <CornerBrackets color={accent} size={14} thickness={2} />

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 20, paddingBottom: 12,
                    borderBottom: `1px solid ${SB_BDR_HI}`,
                }}>
                    <span style={{
                        fontFamily: SB_RM, fontSize: 11, color: accent,
                        fontWeight: 700, letterSpacing: '0.28em',
                        textTransform: 'uppercase',
                    }}>{title}</span>
                    <div
                        onClick={onCancel}
                        style={{
                            cursor: 'pointer', padding: '2px 8px',
                            color: SB_DIM, fontFamily: SB_RM, fontSize: 14,
                            fontWeight: 700,
                        }}
                    >✕</div>
                </div>

                {/* Current / target readout */}
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 6, marginBottom: 20,
                }}>
                    <span style={{
                        fontFamily: SB_RM, fontSize: 8, color: SB_DIM,
                        letterSpacing: '0.32em', fontWeight: 700,
                    }}>CURRENT · {currentValue} → TARGET</span>
                    <span style={{
                        fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 88, color: SB_WHITE,
                        fontVariantNumeric: 'tabular-nums',
                        textShadow: `0 0 22px ${accent}66`,
                        lineHeight: 1,
                    }}>
                        {draft === '' ? currentValue : draft}
                    </span>
                </div>

                {/* Numpad */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8, marginBottom: 16,
                }}>
                    {['7','8','9','4','5','6','1','2','3','0','⌫','✕'].map(k => (
                        <NumKey key={k} label={k} onClick={() => press(k)} accent={accent} />
                    ))}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                    <ActionBtn label="CANCEL" color={SB_DIM} onClick={onCancel} />
                    <ActionBtn label="APPLY" color={accent} onClick={apply} primary />
                </div>
            </div>
        </div>
    );
};

const NumKey: React.FC<{ label: string; onClick: () => void; accent: string }> = ({
    label, onClick, accent,
}) => (
    <div
        onClick={onClick}
        style={{
            height: 56,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${SB_BDR_HI}`,
            color: SB_WHITE,
            fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
            fontSize: 24, letterSpacing: '0.04em',
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.12s, transform 0.06s',
        }}
        onTouchStart={e => {
            (e.currentTarget as HTMLElement).style.background = `${accent}33`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)';
        }}
        onTouchEnd={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
        onMouseDown={e => {
            (e.currentTarget as HTMLElement).style.background = `${accent}22`;
        }}
        onMouseUp={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
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

export default NumberEditor;
