// src/components/refereebox/sharedScoreboard.tsx
// ═══════════════════════════════════════════════════════════════
// Shared visual primitives used by LockedScoreboard, UnlockedSettings,
// and PiTouchScoringScreen. Kept free of business logic — these are
// pure display components plus a couple of header-button affordances.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';

// ── Theme tokens (mirror LockedScoreboard) ────────────────────
export const SB_BG       = '#000';
export const SB_SURFACE  = '#0a0a0a';
export const SB_HOME_C   = '#2563EB';
export const SB_AWAY_C   = '#DC2626';
export const SB_GREEN    = '#22C55E';
export const SB_AMBER    = '#F59E0B';
export const SB_ORANGE   = '#F97316';
export const SB_WHITE    = '#FFFFFF';
export const SB_DIM      = 'rgba(255,255,255,0.42)';
export const SB_MUTED    = 'rgba(255,255,255,0.22)';
export const SB_BDR      = 'rgba(255,255,255,0.07)';
export const SB_BDR_HI   = 'rgba(255,255,255,0.16)';

export const SB_OSW = "'Oswald', sans-serif";
export const SB_RM  = "'JetBrains Mono', monospace";

export const SB_DOT_GRID =
    `radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px) 0 0 / 14px 14px`;

// ── Corner brackets (FUI accent) ─────────────────────────────
export const CornerBrackets: React.FC<{
    color: string;
    size?: number;
    thickness?: number;
}> = ({ color, size = 12, thickness = 1.5 }) => (
    <>
        {(['tl', 'tr', 'bl', 'br'] as const).map(pos => {
            const top  = pos.startsWith('t');
            const left = pos.endsWith('l');
            return (
                <div key={pos} style={{
                    position: 'absolute',
                    [top ? 'top' : 'bottom']: -1,
                    [left ? 'left' : 'right']: -1,
                    width: size, height: size,
                    borderTop:    top  ? `${thickness}px solid ${color}` : 'none',
                    borderBottom: !top ? `${thickness}px solid ${color}` : 'none',
                    borderLeft:   left  ? `${thickness}px solid ${color}` : 'none',
                    borderRight:  !left ? `${thickness}px solid ${color}` : 'none',
                    pointerEvents: 'none',
                }} />
            );
        })}
    </>
);

// ── Inline icons ─────────────────────────────────────────────
export const IconCast = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M2 16h.01" /><path d="M2 12a8 8 0 0 1 8 8" /><path d="M2 8a12 12 0 0 1 12 12" />
        <rect x="13" y="13" width="9" height="7" />
    </svg>
);
export const IconHW = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
        <rect x="5" y="5" width="14" height="14" />
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
    </svg>
);
export const IconGear = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M5 5l2 2M17 17l2 2M2 12h3M19 12h3M5 19l2-2M17 7l2-2" />
    </svg>
);
export const IconStop = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <rect x="6" y="6" width="12" height="12" />
    </svg>
);
export const IconUndo = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M3 7v6h6" />
        <path d="M3 13a9 9 0 1 0 3-7" />
    </svg>
);
export const IconLock = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
        <rect x="3" y="11" width="18" height="11" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

// ── Header action button — shared across scoreboard screens ──
export const HeaderBtn: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick?: () => void;
    accent?: string;
    filled?: boolean;
    disabled?: boolean;
}> = ({ label, icon, onClick, accent = SB_WHITE, filled = false, disabled = false }) => {
    const enabled = !!onClick && !disabled;
    return (
        <div
            onClick={enabled ? onClick : undefined}
            style={{
                height: 36, padding: '0 14px',
                display: 'flex', alignItems: 'center', gap: 8,
                border: `1px solid ${filled ? accent : SB_BDR_HI}`,
                background: filled ? `${accent}1f` : 'rgba(255,255,255,0.025)',
                color: enabled ? accent : SB_MUTED,
                fontFamily: SB_RM, fontSize: 9, fontWeight: 700,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                cursor: enabled ? 'pointer' : 'default',
                opacity: enabled ? 1 : 0.4,
                userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.12s, transform 0.06s',
                boxShadow: filled ? `0 0 12px ${accent}33, inset 0 1px 0 ${accent}33` : 'none',
            }}
            onTouchStart={e => {
                if (!enabled) return;
                (e.currentTarget as HTMLElement).style.background = `${accent}33`;
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
            }}
            onTouchEnd={e => {
                (e.currentTarget as HTMLElement).style.background = filled ? `${accent}1f` : 'rgba(255,255,255,0.025)';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
        >
            {icon}
            <span>{label}</span>
        </div>
    );
};

// ── LED-bezel score panel ────────────────────────────────────
export const ScorePanel: React.FC<{
    value: number;
    color: string;
    /** Default: 132 (override for compact contexts). */
    fontSize?: number;
    /** Default: 340 px (override for compact contexts). */
    maxWidth?: number;
}> = ({ value, color, fontSize = 132, maxWidth = 340 }) => {
    const [flash, setFlash] = useState(false);
    const prev = useRef(value);
    const t = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (prev.current !== value) {
            prev.current = value;
            setFlash(true);
            if (t.current) clearTimeout(t.current);
            t.current = setTimeout(() => setFlash(false), 420);
        }
        return () => { if (t.current) clearTimeout(t.current); };
    }, [value]);

    return (
        <div style={{
            position: 'relative',
            width: '90%', maxWidth,
            padding: '10px 0 14px',
            border: `1px solid ${color}44`,
            background: flash
                ? `linear-gradient(180deg, ${color}18 0%, ${color}08 100%)`
                : `linear-gradient(180deg, ${color}08 0%, transparent 60%)`,
            boxShadow: flash
                ? `0 0 48px ${color}66, inset 0 0 24px ${color}22`
                : `0 0 12px ${color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'box-shadow 0.42s, background 0.42s',
        }}>
            <CornerBrackets color={`${color}99`} size={12} thickness={1.5} />
            <span style={{
                fontFamily: SB_OSW, fontWeight: 700, fontStyle: 'italic',
                fontSize, lineHeight: 1, color,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.04em',
                textShadow: flash
                    ? `0 0 40px ${color}, 0 0 20px ${color}bb`
                    : `0 0 18px ${color}66`,
                transition: 'text-shadow 0.42s',
            }}>
                {value}
            </span>
        </div>
    );
};

// ── FIBA-style team-foul marker row (1–5, fifth always red) ──
export const FibaFoulMarkers: React.FC<{
    count: number;
    color: string;
    align: 'left' | 'right';
}> = ({ count, color, align }) => (
    <div style={{
        display: 'flex',
        flexDirection: align === 'left' ? 'row' : 'row-reverse',
        gap: 4,
    }}>
        {Array.from({ length: 5 }).map((_, i) => {
            const lit = i < count;
            const isFifth = i === 4;
            const baseBorder = isFifth ? '#EF4444' : color;
            const litBg      = isFifth ? '#EF4444' : color;
            return (
                <div key={i} style={{
                    width: 28, height: 28,
                    background: lit ? litBg : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${lit ? litBg : `${baseBorder}55`}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 16, color: lit ? '#000' : `${baseBorder}88`,
                    fontVariantNumeric: 'tabular-nums',
                    boxShadow: lit ? `0 0 10px ${litBg}88` : 'none',
                    transition: 'all 0.18s',
                }}>
                    {i + 1}
                </div>
            );
        })}
    </div>
);
