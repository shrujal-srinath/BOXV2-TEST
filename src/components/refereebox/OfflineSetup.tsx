// src/components/refereebox/OfflineSetup.tsx

import React, { useState, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Player { id: string; name: string; number: string; }

interface GameConfig {
    teamAName: string; teamBName: string;
    teamAColor: string; teamBColor: string;
    periodMinutes: number; shotClockSeconds: number;
    periods: number; periodType: 'quarter' | 'half';
    timeoutsPerTeam: number;
    gameMode: 'quick' | 'stats' | 'advanced';
    playersA: Player[]; playersB: Player[];
}

interface OfflineSetupProps {
    onConfirm: (config: GameConfig) => void;
    onBack: () => void;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG    = '#080808';
const CARD  = '#111111';
const BDR   = '#2a2a2a';
const RED   = '#DC2626';
const INBG  = '#0a0a0a';
const TXT   = '#ffffff';
const DIM   = 'rgba(255,255,255,0.5)';
const MUTED = 'rgba(255,255,255,0.3)';
const OW    = "'Oswald', sans-serif";
const RM    = "'Roboto Mono', monospace";
const SG    = "'Space Grotesk', sans-serif";

const COLOR_PRESETS = [
    '#3B82F6','#EF4444','#22C55E','#8B5CF6',
    '#F97316','#06B6D4','#EC4899','#EAB308','#FFFFFF',
];

// ── Chip style helper ─────────────────────────────────────────────────────────
const chip = (active: boolean): React.CSSProperties => ({
    fontFamily: RM, fontSize: 10,
    padding: '4px 10px', borderRadius: 0,
    cursor: 'pointer',
    border: `1px solid ${active ? RED : BDR}`,
    background: active ? RED : 'transparent',
    color: active ? TXT : DIM,
    textTransform: 'uppercase',
});

// ── Input base style ──────────────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
    background: INBG, border: `1px solid ${BDR}`,
    color: TXT, fontFamily: RM, fontSize: 12,
    textTransform: 'uppercase', padding: '8px 12px',
    borderRadius: 0, outline: 'none',
    width: '100%', boxSizing: 'border-box',
};

// ── Section label ─────────────────────────────────────────────────────────────
const sectionLabel = (text: string): React.CSSProperties => ({
    fontFamily: SG, fontSize: 10, color: MUTED,
    letterSpacing: '0.2em', textTransform: 'uppercase',
    marginBottom: 10,
});

// ── Component ─────────────────────────────────────────────────────────────────
const OfflineSetup: React.FC<OfflineSetupProps> = ({ onConfirm, onBack }) => {

    const [gameMode,        setGameMode]        = useState<'quick' | 'stats' | 'advanced'>('quick');
    const [teamAName,       setTeamAName]        = useState('');
    const [teamBName,       setTeamBName]        = useState('');
    const [teamAColor,      setTeamAColor]       = useState('#3B82F6');
    const [teamBColor,      setTeamBColor]       = useState('#EF4444');
    const [periodMinutes,   setPeriodMinutes]    = useState(10);
    const [periods,         setPeriods]          = useState(4);
    const [periodType,      setPeriodType]       = useState<'quarter' | 'half'>('quarter');
    const [shotClockEnabled,setShotClockEnabled] = useState(true);
    const [shotClockSeconds]                     = useState(24);
    const [timeoutsPerTeam, setTimeoutsPerTeam]  = useState(2);
    const [playersA,        setPlayersA]         = useState<Player[]>([]);
    const [playersB,        setPlayersB]         = useState<Player[]>([]);
    const [playerNameA,     setPlayerNameA]      = useState('');
    const [playerNumA,      setPlayerNumA]       = useState('');
    const [playerNameB,     setPlayerNameB]      = useState('');
    const [playerNumB,      setPlayerNumB]       = useState('');
    const [cursorVisible,   setCursorVisible]    = useState(true);

    useEffect(() => {
        const t = setInterval(() => setCursorVisible(v => !v), 530);
        return () => clearInterval(t);
    }, []);

    const isValid = teamAName.trim().length > 0 && teamBName.trim().length > 0;

    const setPeriodOption = (p: number) => {
        setPeriods(p);
        setPeriodType(p === 2 ? 'half' : 'quarter');
    };

    const addPlayerA = () => {
        if (!playerNameA.trim() || !playerNumA.trim() || playersA.length >= 12) return;
        setPlayersA(prev => [...prev, {
            id: `pa-${Date.now()}`,
            name: playerNameA.trim().toUpperCase(),
            number: playerNumA.trim(),
        }]);
        setPlayerNameA(''); setPlayerNumA('');
    };

    const addPlayerB = () => {
        if (!playerNameB.trim() || !playerNumB.trim() || playersB.length >= 12) return;
        setPlayersB(prev => [...prev, {
            id: `pb-${Date.now()}`,
            name: playerNameB.trim().toUpperCase(),
            number: playerNumB.trim(),
        }]);
        setPlayerNameB(''); setPlayerNumB('');
    };

    const handleConfirm = () => {
        if (!isValid) return;
        onConfirm({
            teamAName: teamAName.trim(), teamBName: teamBName.trim(),
            teamAColor, teamBColor, periodMinutes,
            shotClockSeconds: shotClockEnabled ? shotClockSeconds : 0,
            periods, periodType, timeoutsPerTeam, gameMode,
            playersA, playersB,
        });
    };

    return (
        <>
            <style>{`
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.25; }
                }
            `}</style>

            <div style={{
                width: '100vw', height: '100vh',
                background: BG,
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                userSelect: 'none',
            }}>

                {/* ── HEADER 32px ────────────────────────────────────────── */}
                <div style={{
                    height: 32, flexShrink: 0,
                    background: BG, borderBottom: `1px solid ${BDR}`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 20px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                            fontFamily: SG, fontWeight: 700, fontStyle: 'italic',
                            fontSize: 11, color: TXT, letterSpacing: '0.05em',
                        }}>SCORE_CORE_V1.0</span>
                        <span style={{ color: '#3a3a3a', fontSize: 12, lineHeight: 1 }}>|</span>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            border: `1px solid ${BDR}`, padding: '2px 8px',
                        }}>
                            <div style={{
                                width: 5, height: 5,
                                borderRadius: '9999px',
                                background: RED,
                                animation: 'pulse-dot 1.2s ease-in-out infinite',
                            }} />
                            <span style={{
                                fontFamily: SG, fontSize: 9, color: DIM,
                                letterSpacing: '0.1em', textTransform: 'uppercase',
                            }}>CFG: MATCH_INIT</span>
                        </div>
                    </div>
                    <button
                        onClick={onBack}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: SG, fontSize: 10, color: MUTED,
                            letterSpacing: '0.15em', textTransform: 'uppercase',
                            padding: 0,
                        }}
                    >BACK</button>
                </div>

                {/* ── MAIN SCROLLABLE ────────────────────────────────────── */}
                <div style={{
                    flex: 1, overflowY: 'auto', overflowX: 'hidden',
                    padding: 24,
                    display: 'flex', flexDirection: 'column', gap: 22,
                }}>

                    {/* Hero */}
                    <div>
                        <div style={{
                            fontFamily: OW, fontStyle: 'italic', fontWeight: 700,
                            fontSize: 28, color: TXT, textTransform: 'uppercase',
                            letterSpacing: '0.02em', marginBottom: 6,
                        }}>INIT_NEW_MATCH</div>
                        <div style={{ width: 160, height: 4, background: RED, marginBottom: 8 }} />
                        <div style={{ fontFamily: RM, fontSize: 11, color: DIM }}>
                            {'SYS_MSG: CONFIGURE MATCH PARAMETERS > '}
                            <span style={{
                                display: 'inline-block', width: 7, height: 12,
                                background: cursorVisible ? DIM : 'transparent',
                                verticalAlign: 'middle', marginLeft: 1,
                            }} />
                        </div>
                    </div>

                    {/* ── SECTION 1: MATCH_MODE ──────────────────────────── */}
                    <div>
                        <div style={sectionLabel('MATCH_MODE')}>MATCH_MODE</div>
                        <div style={{ display: 'flex', gap: 12 }}>

                            {/* QUICK MATCH */}
                            <div
                                onClick={() => setGameMode('quick')}
                                style={{
                                    flex: 1, padding: '12px 14px', cursor: 'pointer',
                                    border: gameMode === 'quick' ? `2px solid ${RED}` : `1px solid ${BDR}`,
                                    background: gameMode === 'quick' ? '#0f0000' : CARD,
                                    display: 'flex', flexDirection: 'column', gap: 8,
                                }}
                            >
                                <div style={{
                                    alignSelf: 'flex-start', fontFamily: SG, fontSize: 9,
                                    border: `1px solid ${BDR}`, padding: '2px 6px', color: MUTED,
                                }}>OPT_01</div>
                                <div style={{
                                    fontFamily: OW, fontStyle: 'italic', fontWeight: 700,
                                    fontSize: 18, textTransform: 'uppercase',
                                    color: gameMode === 'quick' ? TXT : DIM,
                                }}>QUICK MATCH</div>
                                <div style={{ fontFamily: RM, fontSize: 10, color: DIM, flex: 1 }}>
                                    &gt; Score + clock only. Zero overhead.
                                </div>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                                    stroke={DIM} strokeWidth="1.5" strokeLinecap="round">
                                    <circle cx="12" cy="13" r="8"/>
                                    <path d="M12 9v4l2.5 2"/>
                                    <line x1="9" y1="2" x2="15" y2="2"/>
                                    <line x1="12" y1="2" x2="12" y2="5"/>
                                </svg>
                            </div>

                            {/* PLAYER STATS */}
                            <div
                                onClick={() => setGameMode('stats')}
                                style={{
                                    flex: 1, padding: '12px 14px', cursor: 'pointer',
                                    border: gameMode === 'stats' ? `2px solid ${RED}` : `1px solid ${BDR}`,
                                    background: gameMode === 'stats' ? '#0f0000' : CARD,
                                    display: 'flex', flexDirection: 'column', gap: 8,
                                }}
                            >
                                <div style={{
                                    alignSelf: 'flex-start', fontFamily: SG, fontSize: 9,
                                    border: `1px solid ${BDR}`, padding: '2px 6px', color: MUTED,
                                }}>OPT_02</div>
                                <div style={{
                                    fontFamily: OW, fontStyle: 'italic', fontWeight: 700,
                                    fontSize: 18, textTransform: 'uppercase',
                                    color: gameMode === 'stats' ? TXT : DIM,
                                }}>PLAYER STATS</div>
                                <div style={{ fontFamily: RM, fontSize: 10, color: DIM, flex: 1 }}>
                                    &gt; Player attribution + fouls + timeouts.
                                </div>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <rect x="3"   y="14" width="5" height="8"  fill={DIM}/>
                                    <rect x="9.5" y="9"  width="5" height="13" fill={DIM}/>
                                    <rect x="16"  y="4"  width="5" height="18" fill={DIM}/>
                                </svg>
                            </div>

                            {/* FULL ANALYTICS */}
                            <div
                                onClick={() => setGameMode('advanced')}
                                style={{
                                    flex: 1, padding: '12px 14px', cursor: 'pointer',
                                    border: gameMode === 'advanced' ? `2px solid ${RED}` : `1px solid ${BDR}`,
                                    background: gameMode === 'advanced' ? '#0f0000' : CARD,
                                    display: 'flex', flexDirection: 'column', gap: 8,
                                }}
                            >
                                <div style={{
                                    alignSelf: 'flex-start', fontFamily: SG, fontSize: 9,
                                    border: `1px solid ${BDR}`, padding: '2px 6px', color: MUTED,
                                }}>OPT_03</div>
                                <div style={{
                                    fontFamily: OW, fontStyle: 'italic', fontWeight: 700,
                                    fontSize: 18, textTransform: 'uppercase',
                                    color: gameMode === 'advanced' ? TXT : DIM,
                                }}>FULL ANALYTICS</div>
                                <div style={{ fontFamily: RM, fontSize: 10, color: DIM, flex: 1 }}>
                                    &gt; Shot chart + full performance data.
                                </div>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                                    stroke={DIM} strokeWidth="1.5" strokeLinecap="round">
                                    <circle cx="12" cy="12" r="9"/>
                                    <circle cx="12" cy="12" r="3"/>
                                    <line x1="12" y1="2"  x2="12" y2="6"/>
                                    <line x1="12" y1="18" x2="12" y2="22"/>
                                    <line x1="2"  y1="12" x2="6"  y2="12"/>
                                    <line x1="18" y1="12" x2="22" y2="12"/>
                                </svg>
                            </div>

                        </div>
                    </div>

                    {/* ── SECTION 2: TEAM_CONFIG ─────────────────────────── */}
                    <div>
                        <div style={sectionLabel('TEAM_CONFIGURATION')}>TEAM_CONFIGURATION</div>
                        <div style={{ display: 'flex', gap: 12 }}>

                            {/* TEAM A */}
                            <div style={{ flex: 1, background: CARD, border: `1px solid ${BDR}`, padding: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <span style={{
                                        fontFamily: SG, fontSize: 10, color: RED,
                                        letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                                    }}>TEAM_A</span>
                                    <div style={{ flex: 1, borderBottom: `1px solid ${BDR}` }} />
                                </div>
                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontFamily: RM, fontSize: 10, color: DIM, marginBottom: 6 }}>
                                        &gt; IDENTIFIER:
                                    </div>
                                    <input
                                        value={teamAName}
                                        onChange={e => setTeamAName(e.target.value)}
                                        placeholder="TEAM_ALPHA"
                                        onFocus={e => (e.target.style.borderColor = RED)}
                                        onBlur={e  => (e.target.style.borderColor = BDR)}
                                        style={inputBase}
                                        autoComplete="off"
                                        maxLength={16}
                                    />
                                </div>
                                <div>
                                    <div style={{ fontFamily: RM, fontSize: 10, color: DIM, marginBottom: 6 }}>
                                        &gt; JERSEY_COLOR:
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {COLOR_PRESETS.map(c => (
                                            <div
                                                key={c}
                                                onClick={() => setTeamAColor(c)}
                                                style={{
                                                    width: 24, height: 24, background: c,
                                                    cursor: 'pointer', borderRadius: 0,
                                                    ...(teamAColor === c
                                                        ? { outline: `2px solid ${RED}`, outlineOffset: 2 }
                                                        : { border: `1px solid ${BDR}`, opacity: 0.5 }
                                                    ),
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* TEAM B */}
                            <div style={{ flex: 1, background: CARD, border: `1px solid ${BDR}`, padding: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <span style={{
                                        fontFamily: SG, fontSize: 10, color: RED,
                                        letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                                    }}>TEAM_B</span>
                                    <div style={{ flex: 1, borderBottom: `1px solid ${BDR}` }} />
                                </div>
                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontFamily: RM, fontSize: 10, color: DIM, marginBottom: 6 }}>
                                        &gt; IDENTIFIER:
                                    </div>
                                    <input
                                        value={teamBName}
                                        onChange={e => setTeamBName(e.target.value)}
                                        placeholder="TEAM_BRAVO"
                                        onFocus={e => (e.target.style.borderColor = RED)}
                                        onBlur={e  => (e.target.style.borderColor = BDR)}
                                        style={inputBase}
                                        autoComplete="off"
                                        maxLength={16}
                                    />
                                </div>
                                <div>
                                    <div style={{ fontFamily: RM, fontSize: 10, color: DIM, marginBottom: 6 }}>
                                        &gt; JERSEY_COLOR:
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {COLOR_PRESETS.map(c => (
                                            <div
                                                key={c}
                                                onClick={() => setTeamBColor(c)}
                                                style={{
                                                    width: 24, height: 24, background: c,
                                                    cursor: 'pointer', borderRadius: 0,
                                                    ...(teamBColor === c
                                                        ? { outline: `2px solid ${RED}`, outlineOffset: 2 }
                                                        : { border: `1px solid ${BDR}`, opacity: 0.5 }
                                                    ),
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* ── SECTION 3: MATCH_PARAMETERS ────────────────────── */}
                    <div>
                        <div style={sectionLabel('MATCH_PARAMETERS')}>MATCH_PARAMETERS</div>
                        <div style={{
                            background: CARD, border: `1px solid ${BDR}`,
                            padding: '12px 16px',
                            display: 'flex', flexDirection: 'column', gap: 10,
                        }}>
                            {/* Row 1 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{
                                    fontFamily: SG, fontSize: 9, color: MUTED,
                                    letterSpacing: '0.15em', textTransform: 'uppercase',
                                    whiteSpace: 'nowrap', marginRight: 4,
                                }}>PERIOD_DURATION</span>
                                {[5, 8, 10, 12].map(m => (
                                    <button key={m} onClick={() => setPeriodMinutes(m)} style={chip(periodMinutes === m)}>
                                        {m} MIN
                                    </button>
                                ))}
                                <div style={{ flex: 1 }} />
                                <span style={{
                                    fontFamily: SG, fontSize: 9, color: MUTED,
                                    letterSpacing: '0.15em', textTransform: 'uppercase',
                                    whiteSpace: 'nowrap', marginRight: 4,
                                }}>PERIODS</span>
                                <button onClick={() => setPeriodOption(4)} style={chip(periods === 4)}>4 QTR</button>
                                <button onClick={() => setPeriodOption(2)} style={chip(periods === 2)}>2 HLV</button>
                                <button onClick={() => setPeriodOption(1)} style={chip(periods === 1)}>1 PRD</button>
                            </div>

                            <div style={{ borderTop: `1px solid ${BDR}` }} />

                            {/* Row 2 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{
                                    fontFamily: SG, fontSize: 9, color: MUTED,
                                    letterSpacing: '0.15em', textTransform: 'uppercase',
                                    whiteSpace: 'nowrap', marginRight: 4,
                                }}>SHOT_CLOCK</span>
                                <button onClick={() => setShotClockEnabled(true)} style={chip(shotClockEnabled)}>
                                    ON / 24s
                                </button>
                                {shotClockEnabled && (
                                    <div style={{
                                        fontFamily: RM, fontSize: 9,
                                        border: `1px solid ${BDR}`, padding: '3px 8px',
                                        color: MUTED,
                                    }}>14s RESET</div>
                                )}
                                <button onClick={() => setShotClockEnabled(false)} style={chip(!shotClockEnabled)}>
                                    OFF
                                </button>
                                <div style={{ flex: 1 }} />
                                <span style={{
                                    fontFamily: SG, fontSize: 9, color: MUTED,
                                    letterSpacing: '0.15em', textTransform: 'uppercase',
                                    whiteSpace: 'nowrap', marginRight: 4,
                                }}>TIMEOUTS</span>
                                {[1, 2, 3].map(n => (
                                    <button key={n} onClick={() => setTimeoutsPerTeam(n)} style={chip(timeoutsPerTeam === n)}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── SECTION 4: ROSTER_INPUT (conditional) ──────────── */}
                    {(gameMode === 'stats' || gameMode === 'advanced') && (
                        <div>
                            <div style={{
                                fontFamily: SG, fontSize: 10, color: RED,
                                letterSpacing: '0.2em', textTransform: 'uppercase',
                                marginBottom: 10,
                            }}>ROSTER_INPUT — REQUIRED FOR SELECTED MODE</div>

                            <div style={{ display: 'flex', gap: 12 }}>

                                {/* TEAM A ROSTER */}
                                <div style={{ flex: 1, background: CARD, border: `1px solid ${BDR}`, padding: 14 }}>
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', marginBottom: 10,
                                    }}>
                                        <div style={{
                                            fontFamily: OW, fontStyle: 'italic',
                                            fontSize: 14, color: TXT, textTransform: 'uppercase',
                                        }}>TEAM_A_ROSTER</div>
                                        <div style={{ fontFamily: RM, fontSize: 9, color: MUTED }}>
                                            ROSTER: {playersA.length}/12
                                        </div>
                                    </div>

                                    {/* Player list */}
                                    <div style={{ marginBottom: 10 }}>
                                        {playersA.map(p => (
                                            <div key={p.id} style={{
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'space-between',
                                                fontFamily: RM, fontSize: 11, color: DIM,
                                                padding: '4px 0',
                                                borderBottom: `1px solid ${BDR}`,
                                            }}>
                                                <span>&gt; #{p.number}{'  '}{p.name}</span>
                                                <button
                                                    onClick={() => setPlayersA(prev => prev.filter(x => x.id !== p.id))}
                                                    style={{
                                                        background: 'none', border: 'none', cursor: 'pointer',
                                                        fontFamily: RM, fontSize: 10, color: MUTED, padding: '0 4px',
                                                    }}
                                                >[×]</button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add row */}
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <input
                                            value={playerNameA}
                                            onChange={e => setPlayerNameA(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addPlayerA()}
                                            placeholder="PLAYER_NAME"
                                            style={{
                                                background: INBG, border: `1px solid ${BDR}`,
                                                color: TXT, fontFamily: RM, fontSize: 10,
                                                textTransform: 'uppercase', padding: '6px 8px',
                                                borderRadius: 0, outline: 'none', flex: 1,
                                                opacity: playersA.length >= 12 ? 0.3 : 1,
                                            }}
                                            disabled={playersA.length >= 12}
                                            autoComplete="off"
                                        />
                                        <input
                                            value={playerNumA}
                                            onChange={e => setPlayerNumA(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addPlayerA()}
                                            placeholder="NO."
                                            style={{
                                                background: INBG, border: `1px solid ${BDR}`,
                                                color: TXT, fontFamily: RM, fontSize: 10,
                                                textTransform: 'uppercase', padding: '6px 8px',
                                                borderRadius: 0, outline: 'none', width: 80,
                                                textAlign: 'center',
                                                opacity: playersA.length >= 12 ? 0.3 : 1,
                                            }}
                                            disabled={playersA.length >= 12}
                                            autoComplete="off"
                                        />
                                        <button
                                            onClick={addPlayerA}
                                            disabled={playersA.length >= 12}
                                            style={{
                                                background: RED, color: TXT,
                                                border: 'none', cursor: playersA.length >= 12 ? 'not-allowed' : 'pointer',
                                                fontFamily: RM, fontSize: 10,
                                                padding: '6px 12px', borderRadius: 0,
                                                opacity: playersA.length >= 12 ? 0.3 : 1,
                                            }}
                                        >+ ADD</button>
                                    </div>
                                </div>

                                {/* TEAM B ROSTER */}
                                <div style={{ flex: 1, background: CARD, border: `1px solid ${BDR}`, padding: 14 }}>
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', marginBottom: 10,
                                    }}>
                                        <div style={{
                                            fontFamily: OW, fontStyle: 'italic',
                                            fontSize: 14, color: TXT, textTransform: 'uppercase',
                                        }}>TEAM_B_ROSTER</div>
                                        <div style={{ fontFamily: RM, fontSize: 9, color: MUTED }}>
                                            ROSTER: {playersB.length}/12
                                        </div>
                                    </div>

                                    {/* Player list */}
                                    <div style={{ marginBottom: 10 }}>
                                        {playersB.map(p => (
                                            <div key={p.id} style={{
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'space-between',
                                                fontFamily: RM, fontSize: 11, color: DIM,
                                                padding: '4px 0',
                                                borderBottom: `1px solid ${BDR}`,
                                            }}>
                                                <span>&gt; #{p.number}{'  '}{p.name}</span>
                                                <button
                                                    onClick={() => setPlayersB(prev => prev.filter(x => x.id !== p.id))}
                                                    style={{
                                                        background: 'none', border: 'none', cursor: 'pointer',
                                                        fontFamily: RM, fontSize: 10, color: MUTED, padding: '0 4px',
                                                    }}
                                                >[×]</button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add row */}
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <input
                                            value={playerNameB}
                                            onChange={e => setPlayerNameB(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addPlayerB()}
                                            placeholder="PLAYER_NAME"
                                            style={{
                                                background: INBG, border: `1px solid ${BDR}`,
                                                color: TXT, fontFamily: RM, fontSize: 10,
                                                textTransform: 'uppercase', padding: '6px 8px',
                                                borderRadius: 0, outline: 'none', flex: 1,
                                                opacity: playersB.length >= 12 ? 0.3 : 1,
                                            }}
                                            disabled={playersB.length >= 12}
                                            autoComplete="off"
                                        />
                                        <input
                                            value={playerNumB}
                                            onChange={e => setPlayerNumB(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addPlayerB()}
                                            placeholder="NO."
                                            style={{
                                                background: INBG, border: `1px solid ${BDR}`,
                                                color: TXT, fontFamily: RM, fontSize: 10,
                                                textTransform: 'uppercase', padding: '6px 8px',
                                                borderRadius: 0, outline: 'none', width: 80,
                                                textAlign: 'center',
                                                opacity: playersB.length >= 12 ? 0.3 : 1,
                                            }}
                                            disabled={playersB.length >= 12}
                                            autoComplete="off"
                                        />
                                        <button
                                            onClick={addPlayerB}
                                            disabled={playersB.length >= 12}
                                            style={{
                                                background: RED, color: TXT,
                                                border: 'none', cursor: playersB.length >= 12 ? 'not-allowed' : 'pointer',
                                                fontFamily: RM, fontSize: 10,
                                                padding: '6px 12px', borderRadius: 0,
                                                opacity: playersB.length >= 12 ? 0.3 : 1,
                                            }}
                                        >+ ADD</button>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    <div style={{ height: 8 }} />
                </div>

                {/* ── FOOTER 40px ─────────────────────────────────────────── */}
                <div style={{
                    height: 40, flexShrink: 0,
                    background: INBG, borderTop: `1px solid ${BDR}`,
                    display: 'flex', alignItems: 'center',
                }}>
                    {/* Left: daemon status */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        paddingLeft: 20, flex: 1,
                    }}>
                        <span style={{ color: '#22C55E', fontSize: 10 }}>■</span>
                        <span style={{ fontFamily: RM, fontSize: 10, color: DIM }}>
                            DAEMON: CONNECTED
                        </span>
                    </div>

                    {/* Center: validation */}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                        {!isValid && (
                            <span style={{ fontFamily: RM, fontSize: 10, color: RED }}>
                                ⚠ TEAM IDENTIFIERS REQUIRED
                            </span>
                        )}
                    </div>

                    {/* Right: Initialize button */}
                    <button
                        onClick={handleConfirm}
                        disabled={!isValid}
                        style={{
                            height: '100%',
                            padding: '0 24px',
                            borderRadius: 0,
                            borderTop: 'none',
                            borderBottom: 'none',
                            borderLeft: isValid ? 'none' : `1px solid ${BDR}`,
                            borderRight: 'none',
                            background: isValid ? RED : '#1a1a1a',
                            color: isValid ? TXT : 'rgba(255,255,255,0.2)',
                            fontFamily: RM, fontSize: 11,
                            fontWeight: isValid ? 700 : 400,
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                            cursor: isValid ? 'pointer' : 'not-allowed',
                        }}
                    >
                        ▶ INITIALIZE MATCH
                    </button>
                </div>

            </div>
        </>
    );
};

export default OfflineSetup;
