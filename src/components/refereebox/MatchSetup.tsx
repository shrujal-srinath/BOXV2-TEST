// src/components/refereebox/MatchSetup.tsx

import React, { useState, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Player { id: string; name: string; number: string; }

interface GameConfig {
    teamAName: string; teamBName: string;
    teamAColor: string; teamBColor: string;
    periodMinutes: number; shotClockSeconds: number;
    periods: number; periodType: 'quarter' | 'half';
    timeoutsPerTeam: number;
    timeoutMode?: 'fiba' | 'custom';
    gameMode: 'quick' | 'stats' | 'advanced';
    playersA: Player[]; playersB: Player[];
}

interface OfflineSetupProps {
    onConfirm: (config: GameConfig) => void;
    onBack: () => void;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
// Shared elevation system with RosterSetup: structure reads from raised
// surfaces, not stark wireframe outlines. The old BDR (0.82 white) made every
// card look like an unfinished wireframe — replaced with a calibrated border +
// surface scale that still keeps the Pi field-terminal character.
const BG       = '#0A0A0B';   // page
const SURFACE  = '#161618';   // cards / panels
const SURFACE2 = '#202023';   // inputs, toggles, steppers (raised)
const SURFACE3 = '#2A2A2E';   // hover / pressed
const BDR      = 'rgba(255,255,255,0.16)';  // structural border (was 0.82)
const BDR_DIM  = 'rgba(255,255,255,0.08)';  // hairline dividers
const BDR_HI   = 'rgba(255,255,255,0.55)';  // emphasized / hover
const RED      = '#DC2626';
const RED_DIM  = 'rgba(220,38,38,0.12)';
const TXT      = '#F4F4F5';
const TXT_DIM  = '#A1A1AA';
const TXT_MUT  = '#71717A';
const GREEN    = '#22C55E';
const OSW      = "'Oswald', sans-serif";
const RM       = "'Roboto Mono', monospace";
const SG       = "'Space Grotesk', sans-serif";

const COLOR_PRESETS = ['#DC2626', '#3B82F6', '#22C55E', '#8B5CF6', '#F97316', '#FFFFFF'];

// ── SVG icons ─────────────────────────────────────────────────────────────────
const IconTimer = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
);
const IconBarChart = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
);
const IconTarget = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
);
const IconLink = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
);
const IconSettings = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);
const IconQR = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" />
        <line x1="20" y1="14" x2="20" y2="14" /><line x1="20" y1="20" x2="20" y2="20" />
        <line x1="17" y1="20" x2="17" y2="20" />
    </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────
// ── Module-level helpers (must NOT be inside the component — causes focus loss) ─
const SectionTitle: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => (
    <div style={{ marginBottom: 18 }}>
        <div style={{
            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
            fontSize: 26, color: TXT, textTransform: 'uppercase',
            letterSpacing: '-0.01em', lineHeight: 1,
        }}>{title}</div>
        {sub && (
            <div style={{
                fontFamily: RM, fontSize: 9, color: RED,
                letterSpacing: '0.25em', textTransform: 'uppercase', marginTop: 5,
            }}>{sub}</div>
        )}
    </div>
);

const FieldLabel: React.FC<{ text: string }> = ({ text }) => (
    <div style={{
        fontFamily: SG, fontWeight: 700, fontSize: 9,
        color: TXT_DIM, letterSpacing: '0.22em',
        textTransform: 'uppercase', marginBottom: 8,
    }}>{text}</div>
);

const MatchSetup: React.FC<OfflineSetupProps> = ({ onConfirm, onBack }) => {

    const [gameMode,          setGameMode]          = useState<'quick' | 'stats' | 'advanced' | null>(null);
    const [teamAName,         setTeamAName]          = useState('HOME');
    const [teamBName,         setTeamBName]          = useState('AWAY');
    const [showModePopup,     setShowModePopup]      = useState(false);
    const [teamAColor,        setTeamAColor]         = useState('#3B82F6');
    const [teamBColor,        setTeamBColor]         = useState('#DC2626');
    const [periodMinutes,     setPeriodMinutes]      = useState(10);
    const [periods,           setPeriods]            = useState(4);
    const [shotClockEnabled,  setShotClockEnabled]   = useState(true);
    const [timeoutsPerTeam,   setTimeoutsPerTeam]    = useState(2);
    const [timeoutMode,       setTimeoutMode]        = useState<'fiba' | 'custom'>('fiba');
    const [cursorVisible,     setCursorVisible]      = useState(true);
    const [focusedInput,      setFocusedInput]       = useState<string | null>(null);
    const [shotClockDuration, setShotClockDuration]  = useState<24 | 12>(24);

    useEffect(() => {
        const t = setInterval(() => setCursorVisible(v => !v), 530);
        return () => clearInterval(t);
    }, []);

    const isValid = teamAName.trim().length > 0 && teamBName.trim().length > 0;

    const setPeriodOption = (next: number) => {
        setPeriods(next);
    };

    const handleConfirm = () => {
        if (!isValid) return;
        if (!gameMode) {
            setShowModePopup(true);
            setTimeout(() => setShowModePopup(false), 2200);
            return;
        }
        // FIBA mode → seed the daemon with the FIRST bucket's allotment.
        // RefereeScreen watches period changes and resets to subsequent buckets.
        const initialTimeouts = timeoutMode === 'fiba'
            ? (periods >= 4 ? 2 : periods === 2 ? 2 : 1)
            : timeoutsPerTeam;
        onConfirm({
            teamAName: teamAName.trim(), teamBName: teamBName.trim(),
            teamAColor, teamBColor, periodMinutes,
            shotClockSeconds: shotClockEnabled ? shotClockDuration : 0,
            periods, periodType: periods <= 2 ? 'half' : 'quarter',
            timeoutsPerTeam: initialTimeouts, timeoutMode, gameMode,
            playersA: [], playersB: [],
        });
    };

    const fibaSummaryText =
        periods >= 4 ? 'Q1–Q2: 2 · Q3–Q4: 3 · OT: 1 · LAST 2:00 OF Q4 CAP 2' :
        periods === 2 ? 'H1: 2 · H2: 2 · OT: 1' :
                        'SINGLE PERIOD — 1 TO PER TEAM';

    const customOptions = periods === 1 ? [1, 2] : [1, 2, 3];

    void cursorVisible;

    // ── Toggle button style ───────────────────────────────────────────────────
    const toggleBtn = (active: boolean): React.CSSProperties => ({
        padding: '7px 22px',
        background: active ? TXT : SURFACE2,
        color: active ? '#000000' : TXT,
        border: `1px solid ${active ? TXT : BDR}`,
        fontFamily: RM, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase' as const,
        cursor: 'pointer', outline: 'none', borderRadius: 0,
        transition: 'background 120ms, color 120ms, border-color 120ms',
    });

    // ── Stepper button style ──────────────────────────────────────────────────
    const stepBtn: React.CSSProperties = {
        width: 38, height: 38,
        background: SURFACE2,
        border: `1px solid ${BDR}`,
        color: TXT, fontFamily: RM, fontWeight: 700, fontSize: 18,
        cursor: 'pointer', outline: 'none', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        transition: 'background 120ms, color 120ms',
        flexShrink: 0,
    };

    // ── Parameter row ─────────────────────────────────────────────────────────
    const paramRow: React.CSSProperties = {
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: `1px solid ${BDR_DIM}`,
    };


    // ── JSX ───────────────────────────────────────────────────────────────────
    return (
        <>
            <style>{`
                @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: #000; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); }
                .step-btn:hover { background: rgba(255,255,255,0.1) !important; }
                .tog-on:hover  { background: rgba(255,255,255,0.9) !important; }
                .tog-off:hover { background: rgba(255,255,255,0.08) !important; }
                .mode-card:hover { background: rgba(220,38,38,0.07) !important; border-color: ${RED} !important; }
                .mode-card-active:hover { background: rgba(220,38,38,0.16) !important; }
                .cfg-btn:hover { border-color: rgba(255,255,255,0.4) !important; color: rgba(255,255,255,0.7) !important; }
                .init-btn:hover:not(:disabled) { background: #b91c1c !important; }
                input::placeholder { color: ${TXT_MUT}; }
            `}</style>

            <div style={{
                width: '100vw', height: '100vh', background: BG,
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden', userSelect: 'none',
            }}>

                {/* ── HEADER 42px ─────────────────────────────────────── */}
                <div style={{
                    height: 42, flexShrink: 0,
                    background: BG, borderBottom: `1px solid ${BDR_DIM}`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '0 24px',
                    gap: 16,
                }}>
                    {/* Left: title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{
                            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                            fontSize: 13, color: TXT, letterSpacing: '0.05em',
                        }}>INIT_NEW_MATCH</span>
                        <span style={{
                            display: 'inline-block', width: 7, height: 13,
                            background: RED, verticalAlign: 'middle',
                            animation: 'blink 1s step-end infinite',
                        }} />
                    </div>

                    {/* Right: CFG buttons + divider + back */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {([
                            { label: 'LINK_CTRL',  icon: <IconLink /> },
                            { label: 'SETTINGS',   icon: <IconSettings /> },
                            { label: 'QR_SETUP',   icon: <IconQR /> },
                        ] as const).map(({ label, icon }) => (
                            <button key={label} className="cfg-btn" style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                background: 'transparent',
                                border: `1px solid rgba(255,255,255,0.28)`,
                                color: 'rgba(255,255,255,0.5)', fontFamily: RM, fontSize: 9,
                                letterSpacing: '0.12em', textTransform: 'uppercase',
                                padding: '0 10px', height: 24, cursor: 'pointer',
                                outline: 'none', transition: 'border-color 120ms, color 120ms',
                            }}>{icon}{label}</button>
                        ))}
                        <div style={{ width: 1, height: 16, background: BDR_DIM, margin: '0 4px' }} />
                        <button onClick={onBack} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: RM, fontSize: 9, color: TXT_MUT,
                            letterSpacing: '0.15em', textTransform: 'uppercase', padding: 0,
                        }}>← BACK</button>
                    </div>
                </div>

                {/* ── SCROLLABLE CONTENT ──────────────────────────────── */}
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px 28px 0' }}>

                    {/* ════════════════════════════════════════════════════
                        SECTION 1 — SELECT OPERATIONAL MODE
                    ════════════════════════════════════════════════════ */}
                    <SectionTitle title="Select Operational Mode" sub="SYS_MSG: WAITING FOR USER INPUT…" />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 32 }}>

                        {/* OPT_01 — QUICK GAME */}
                        {(['quick', 'stats', 'advanced'] as const).map((mode, i) => {
                            const active = gameMode === mode;
                            const labels = ['QUICK GAME', 'PLAYER STATS', 'ADVANCED ANALYTICS'];
                            const descs  = [
                                'Basic timer and score tracking for casual play.',
                                'Track individual scoring, fouls, and timeouts.',
                                'Full game tracking including shot charts and performance analysis.',
                            ];
                            const badges = ['OPT_01', 'OPT_02', 'OPT_03'];
                            const Icons  = [IconTimer, IconBarChart, IconTarget];
                            const Icon   = Icons[i];
                            return (
                                <button
                                    key={mode}
                                    onClick={() => setGameMode(mode)}
                                    className={active ? 'mode-card-active' : 'mode-card'}
                                    style={{
                                        position: 'relative',
                                        padding: '16px 18px',
                                        cursor: 'pointer',
                                        borderRadius: 6,
                                        background: active ? 'rgba(220,38,38,0.1)' : SURFACE,
                                        border: `1px solid ${active ? RED : BDR}`,
                                        boxShadow: active
                                            ? `inset 3px 0 0 ${RED}, 0 4px 20px rgba(220,38,38,0.18)`
                                            : '0 2px 12px rgba(0,0,0,0.35)',
                                        display: 'flex', flexDirection: 'column', gap: 8,
                                        minHeight: 160, textAlign: 'left',
                                        transition: 'background 120ms, border-color 120ms, box-shadow 120ms',
                                        outline: 'none',
                                    }}
                                >
                                    {/* Top-left badge */}
                                    <span style={{
                                        alignSelf: 'flex-start',
                                        fontFamily: RM, fontSize: 8,
                                        border: `1px solid ${active ? RED : 'rgba(220,38,38,0.55)'}`,
                                        background: active ? RED : 'transparent',
                                        padding: '2px 7px', letterSpacing: '0.12em',
                                        color: active ? TXT : 'rgba(220,38,38,0.8)',
                                    }}>{badges[i]}</span>

                                    <div style={{
                                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                        fontSize: 18, textTransform: 'uppercase', color: TXT,
                                        letterSpacing: '0.01em', lineHeight: 1.1,
                                    }}>{labels[i]}</div>

                                    <div style={{
                                        fontFamily: RM, fontSize: 10,
                                        color: active ? 'rgba(255,255,255,0.85)' : TXT_DIM,
                                        flex: 1, lineHeight: 1.5,
                                    }}>{descs[i]}</div>

                                    <div style={{ color: active ? TXT : 'rgba(220,38,38,0.7)', marginTop: 'auto' }}>
                                        <Icon />
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* ════════════════════════════════════════════════════
                        SECTION 2 — TEAM CONFIGURATION
                    ════════════════════════════════════════════════════ */}
                    <SectionTitle title="Team Configuration" />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>

                        {/* TEAM A */}
                        <div style={{
                            border: `1px solid ${BDR}`,
                            borderLeft: `4px solid ${teamAColor}`,
                            borderRadius: 6,
                            background: SURFACE,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                padding: '10px 16px 8px',
                                borderBottom: `1px solid ${BDR_DIM}`,
                            }}>
                                <span style={{
                                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                    fontSize: 14, color: TXT, textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                }}>TEAM A</span>
                            </div>
                            <div style={{ padding: '14px 16px' }}>
                                <FieldLabel text="IDENTIFIER:" />
                                <input
                                    value={teamAName}
                                    onChange={e => setTeamAName(e.target.value)}
                                    placeholder="TEAM_ALPHA"
                                    onFocus={() => setFocusedInput('teamA')}
                                    onBlur={() => setFocusedInput(null)}
                                    style={{
                                        background: focusedInput === 'teamA' ? '#26181a' : SURFACE2,
                                        border: `1px solid ${focusedInput === 'teamA' ? RED : BDR}`,
                                        color: TXT, fontFamily: RM, fontSize: 13,
                                        padding: '11px 14px', width: '100%', borderRadius: 4,
                                        boxSizing: 'border-box', outline: 'none',
                                        boxShadow: focusedInput === 'teamA' ? '0 0 0 3px rgba(220,38,38,0.15)' : 'none',
                                        marginBottom: 16, transition: 'border-color 0.12s, background 0.12s, box-shadow 0.12s',
                                    }}
                                    autoComplete="off" maxLength={16}
                                />
                                <FieldLabel text="JERSEY COLOR:" />
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    {COLOR_PRESETS.map(c => (
                                        <div key={c} onClick={() => setTeamAColor(c)} style={{
                                            width: 32, height: 32, background: c, cursor: 'pointer',
                                            border: '2px solid rgba(255,255,255,0.3)',
                                            ...(teamAColor === c
                                                ? { outline: '3px solid white', outlineOffset: '2px' }
                                                : { opacity: 0.5 }
                                            ),
                                        }} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* TEAM B */}
                        <div style={{
                            border: `1px solid ${BDR}`,
                            borderLeft: `4px solid ${teamBColor}`,
                            borderRadius: 6,
                            background: SURFACE,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                padding: '10px 16px 8px',
                                borderBottom: `1px solid ${BDR_DIM}`,
                            }}>
                                <span style={{
                                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                    fontSize: 14, color: TXT, textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                }}>TEAM B</span>
                            </div>
                            <div style={{ padding: '14px 16px' }}>
                                <FieldLabel text="IDENTIFIER:" />
                                <input
                                    value={teamBName}
                                    onChange={e => setTeamBName(e.target.value)}
                                    placeholder="TEAM_BRAVO"
                                    onFocus={() => setFocusedInput('teamB')}
                                    onBlur={() => setFocusedInput(null)}
                                    style={{
                                        background: focusedInput === 'teamB' ? '#26181a' : SURFACE2,
                                        border: `1px solid ${focusedInput === 'teamB' ? RED : BDR}`,
                                        color: TXT, fontFamily: RM, fontSize: 13,
                                        padding: '11px 14px', width: '100%', borderRadius: 4,
                                        boxSizing: 'border-box', outline: 'none',
                                        boxShadow: focusedInput === 'teamB' ? '0 0 0 3px rgba(220,38,38,0.15)' : 'none',
                                        marginBottom: 16, transition: 'border-color 0.12s, background 0.12s, box-shadow 0.12s',
                                    }}
                                    autoComplete="off" maxLength={16}
                                />
                                <FieldLabel text="JERSEY COLOR:" />
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    {COLOR_PRESETS.map(c => (
                                        <div key={c} onClick={() => setTeamBColor(c)} style={{
                                            width: 32, height: 32, background: c, cursor: 'pointer',
                                            border: '2px solid rgba(255,255,255,0.3)',
                                            ...(teamBColor === c
                                                ? { outline: '3px solid white', outlineOffset: '2px' }
                                                : { opacity: 0.5 }
                                            ),
                                        }} />
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* ════════════════════════════════════════════════════
                        SECTION 3 — MATCH PARAMETERS
                    ════════════════════════════════════════════════════ */}
                    <SectionTitle title="Match Parameters" />

                    <div style={{
                        border: `1px solid ${BDR}`, borderRadius: 6,
                        background: SURFACE, marginBottom: 32,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)', overflow: 'hidden',
                    }}>

                        {/* Period Duration */}
                        <div style={paramRow}>
                            <div style={{
                                fontFamily: SG, fontWeight: 700, fontSize: 10,
                                color: TXT_DIM, letterSpacing: '0.18em', textTransform: 'uppercase',
                            }}>PERIOD DURATION (MIN)</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                <button
                                    className="step-btn"
                                    onClick={() => setPeriodMinutes(Math.max(5, periodMinutes - 1))}
                                    style={stepBtn}
                                >−</button>
                                <div style={{
                                    minWidth: 56, textAlign: 'center',
                                    fontFamily: OSW, fontWeight: 700, fontSize: 26, color: TXT,
                                    lineHeight: 1,
                                }}>{periodMinutes}</div>
                                <button
                                    className="step-btn"
                                    onClick={() => setPeriodMinutes(Math.min(40, periodMinutes + 1))}
                                    style={stepBtn}
                                >+</button>
                            </div>
                        </div>

                        {/* Periods */}
                        <div style={paramRow}>
                            <div style={{
                                fontFamily: SG, fontWeight: 700, fontSize: 10,
                                color: TXT_DIM, letterSpacing: '0.18em', textTransform: 'uppercase',
                            }}>PERIODS</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                <button
                                    className="step-btn"
                                    onClick={() => setPeriodOption(Math.max(1, periods - 1))}
                                    style={stepBtn}
                                >−</button>
                                <div style={{
                                    minWidth: 56, textAlign: 'center',
                                    fontFamily: OSW, fontWeight: 700, fontSize: 26, color: TXT,
                                    lineHeight: 1,
                                }}>{periods}</div>
                                <button
                                    className="step-btn"
                                    onClick={() => setPeriodOption(Math.min(4, periods + 1))}
                                    style={stepBtn}
                                >+</button>
                            </div>
                        </div>

                        {/* Shot Clock */}
                        <div style={{ ...paramRow, flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                <div style={{
                                    fontFamily: SG, fontWeight: 700, fontSize: 10,
                                    color: TXT_DIM, letterSpacing: '0.18em', textTransform: 'uppercase',
                                }}>SHOT CLOCK</div>
                                <div style={{ display: 'flex' }}>
                                    <button
                                        className="tog-on"
                                        onClick={() => setShotClockEnabled(true)}
                                        style={toggleBtn(shotClockEnabled)}
                                    >ON</button>
                                    <button
                                        className="tog-off"
                                        onClick={() => setShotClockEnabled(false)}
                                        style={{ ...toggleBtn(!shotClockEnabled), borderLeft: 'none' }}
                                    >OFF</button>
                                </div>
                            </div>
                            {shotClockEnabled && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ display: 'flex' }}>
                                        {([24, 12] as const).map((s, idx) => (
                                            <button
                                                key={s}
                                                onClick={() => setShotClockDuration(s)}
                                                style={{
                                                    ...toggleBtn(shotClockDuration === s),
                                                    ...(idx > 0 ? { borderLeft: 'none' } : {}),
                                                    padding: '6px 20px', fontSize: 10,
                                                }}
                                            >{s}S</button>
                                        ))}
                                    </div>
                                    <div style={{ fontFamily: RM, fontSize: 9, color: TXT_MUT, letterSpacing: '0.1em' }}>
                                        24S → 5V5 FIBA  ·  12S → 3×3 FORMAT
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Timeouts — FIBA bucket-based / Custom flat */}
                        <div style={{ ...paramRow, borderBottom: 'none', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{
                                    fontFamily: SG, fontWeight: 700, fontSize: 10,
                                    color: TXT_DIM, letterSpacing: '0.18em', textTransform: 'uppercase',
                                    marginBottom: 4,
                                }}>TIMEOUTS</div>
                                <div style={{ fontFamily: RM, fontSize: 8, color: TXT_MUT, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    {timeoutMode === 'fiba'
                                        ? `FIBA · ${fibaSummaryText}`
                                        : 'CUSTOM · FLAT BUCKET FOR WHOLE GAME'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                                {/* Mode toggle */}
                                <div style={{ display: 'flex' }}>
                                    {(['fiba', 'custom'] as const).map((m, idx) => (
                                        <button
                                            key={m}
                                            onClick={() => setTimeoutMode(m)}
                                            style={{
                                                ...toggleBtn(timeoutMode === m),
                                                padding: '7px 20px',
                                                ...(idx > 0 ? { borderLeft: 'none' } : {}),
                                            }}
                                        >{m === 'fiba' ? 'FIBA' : 'CUSTOM'}</button>
                                    ))}
                                </div>
                                {/* Custom-only flat-number picker */}
                                {timeoutMode === 'custom' && (
                                    <div style={{ display: 'flex' }}>
                                        {customOptions.map((n, idx) => (
                                            <button
                                                key={n}
                                                onClick={() => setTimeoutsPerTeam(n)}
                                                style={{
                                                    ...toggleBtn(timeoutsPerTeam === n),
                                                    padding: '6px 18px', fontSize: 10,
                                                    ...(idx > 0 ? { borderLeft: 'none' } : {}),
                                                }}
                                            >{n}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    <div style={{ height: 16 }} />
                </div>

                {/* ── GAME MODE POPUP ─────────────────────────────────── */}
                {showModePopup && (
                    <div style={{
                        position: 'fixed', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        pointerEvents: 'none', zIndex: 999,
                    }}>
                        <div style={{
                            background: '#0a0a0a',
                            border: `2px solid ${RED}`,
                            padding: '18px 36px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                            boxShadow: `0 0 40px rgba(220,38,38,0.35)`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                    stroke={RED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                    <line x1="12" y1="9" x2="12" y2="13"/>
                                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                                </svg>
                                <span style={{
                                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                    fontSize: 20, color: TXT, textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                }}>SELECT GAME MODE</span>
                            </div>
                            <div style={{
                                fontFamily: RM, fontSize: 10, color: TXT_DIM,
                                letterSpacing: '0.15em', textTransform: 'uppercase',
                            }}>CHOOSE AN OPERATIONAL MODE ABOVE TO CONTINUE</div>
                        </div>
                    </div>
                )}

                {/* ── FOOTER 48px ─────────────────────────────────────── */}
                <div style={{
                    height: 56, flexShrink: 0,
                    background: SURFACE, borderTop: `1px solid ${BDR}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 24px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
                        <span style={{ fontFamily: SG, fontSize: 9, color: TXT_DIM, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                            DAEMON: CONNECTED
                        </span>
                    </div>
                    <div>
                        {gameMode === null && (
                            <span style={{ fontFamily: RM, fontSize: 9, color: TXT_MUT, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                NO MODE SELECTED
                            </span>
                        )}
                    </div>
                    <button
                        className="init-btn"
                        onClick={handleConfirm}
                        style={{
                            padding: '0 32px', height: 38, border: 'none', borderRadius: 4,
                            background: RED,
                            color: TXT,
                            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 13,
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                            cursor: 'pointer',
                            boxShadow: '0 2px 12px rgba(220,38,38,0.35)',
                            transition: 'background 120ms',
                        }}
                    >INITIALIZE MATCH →</button>
                </div>

            </div>
        </>
    );
};

export default MatchSetup;
