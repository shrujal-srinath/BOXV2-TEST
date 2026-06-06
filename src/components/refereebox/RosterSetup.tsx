// src/components/refereebox/RosterSetup.tsx

import React, { useState } from 'react';

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

interface RosterSetupProps {
    config: GameConfig;
    onConfirm: (config: GameConfig) => void;
    onBack: () => void;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
// Elevation system: the page stays dark, but every surface that holds content
// is lifted with a lighter fill so structure reads from contrast, not outlines.
const BG       = '#0A0A0B';   // page — house dark
const SURFACE  = '#161618';   // panels / cards (raised)
const SURFACE2 = '#202023';   // inputs, nested fills (raised more)
const SURFACE3 = '#2A2A2E';   // hover / pressed
const BDR_DIM  = 'rgba(255,255,255,0.08)';  // hairline dividers
const BDR_MD   = 'rgba(255,255,255,0.16)';  // visible structural border
const BDR_HI   = 'rgba(255,255,255,0.55)';  // emphasized
const RED      = '#DC2626';
const GREEN    = '#22C55E';
const TXT      = '#F4F4F5';
const TXT_DIM  = '#A1A1AA';   // secondary
const TXT_MUT  = '#71717A';   // muted (was #555 — invisible on black)
const RM       = "'JetBrains Mono', monospace";
const OSW      = "'Oswald', sans-serif";
const SG       = "'Space Grotesk', sans-serif";

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const IconPlus = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square"/>
        <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square"/>
    </svg>
);

const IconRemove = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square"/>
        <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square"/>
    </svg>
);

// ── Module-level helpers ───────────────────────────────────────────────────────
// IMPORTANT: these must live outside RosterSetup. Defining components inside a
// render function causes React to treat them as a new type on every re-render,
// which unmounts and remounts the input — losing cursor focus on every keystroke.

const getInputStyle = (id: string, focusedInput: string | null): React.CSSProperties => ({
    background: focusedInput === id ? '#26181a' : SURFACE2,
    border: `1px solid ${focusedInput === id ? RED : BDR_MD}`,
    color: TXT, fontFamily: RM, fontSize: 12,
    padding: '11px 13px',
    boxSizing: 'border-box' as const,
    outline: 'none', borderRadius: 4,
    boxShadow: focusedInput === id
        ? `0 0 0 3px rgba(220,38,38,0.15)`
        : 'inset 0 1px 0 rgba(255,255,255,0.03)',
    transition: 'border-color 0.12s, background 0.12s, box-shadow 0.12s',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
});

const TeamPanel: React.FC<{
    team: 'A' | 'B'; color: string; players: Player[]; name: string;
    pName: string; pNum: string;
    onPName: (v: string) => void; onPNum: (v: string) => void;
    onAdd: () => void; onRemove: (id: string) => void;
    focusName: string; focusNum: string;
    focusedInput: string | null;
    setFocusedInput: (id: string | null) => void;
}> = ({
    team, color, players, name, pName, pNum,
    onPName, onPNum, onAdd, onRemove, focusName, focusNum,
    focusedInput, setFocusedInput,
}) => (
    <div style={{
        display: 'flex', flexDirection: 'column',
        border: `1px solid ${BDR_MD}`,
        borderTop: `3px solid ${color}`,
        borderRadius: 6,
        background: SURFACE,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        overflow: 'hidden',
    }}>
        {/* Panel header */}
        <div style={{
            padding: '11px 16px',
            borderBottom: `1px solid ${BDR_DIM}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.04)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 20, background: color, flexShrink: 0 }} />
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 16, color: TXT, textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                }}>{name}</span>
                <span style={{
                    fontFamily: RM, fontSize: 8, color: TXT_MUT,
                    letterSpacing: '0.2em', textTransform: 'uppercase',
                }}>TEAM {team}</span>
            </div>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                border: `1px solid ${color}44`,
                background: `${color}12`,
                padding: '3px 10px',
            }}>
                <span style={{
                    fontFamily: RM, fontSize: 10, fontWeight: 700,
                    color: players.length >= 12 ? RED : color,
                    letterSpacing: '0.1em',
                }}>{players.length}/12</span>
            </div>
        </div>

        {/* Add-player row */}
        <div style={{
            padding: '10px 14px', borderBottom: `1px solid ${BDR_DIM}`,
            display: 'flex', gap: 6, alignItems: 'stretch', flexShrink: 0,
        }}>
            <input
                value={pName}
                onChange={e => onPName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onAdd()}
                onFocus={() => setFocusedInput(focusName)}
                onBlur={() => setFocusedInput(null)}
                placeholder="PLAYER NAME"
                style={{ ...getInputStyle(focusName, focusedInput), flex: 1 }}
                disabled={players.length >= 12}
                autoComplete="off"
            />
            <input
                value={pNum}
                onChange={e => onPNum(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onAdd()}
                onFocus={() => setFocusedInput(focusNum)}
                onBlur={() => setFocusedInput(null)}
                placeholder="#"
                style={{ ...getInputStyle(focusNum, focusedInput), width: 52, textAlign: 'center', letterSpacing: '0.15em' }}
                disabled={players.length >= 12}
                autoComplete="off"
                maxLength={3}
            />
            <button
                onClick={onAdd}
                disabled={players.length >= 12 || !pName.trim() || !pNum.trim()}
                style={{
                    background: (players.length >= 12 || !pName.trim() || !pNum.trim()) ? SURFACE2 : RED,
                    color: (players.length >= 12 || !pName.trim() || !pNum.trim()) ? TXT_MUT : TXT,
                    border: `1px solid ${(players.length >= 12 || !pName.trim() || !pNum.trim()) ? BDR_MD : RED}`,
                    cursor: (players.length >= 12 || !pName.trim() || !pNum.trim()) ? 'not-allowed' : 'pointer',
                    fontFamily: RM, fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.1em',
                    padding: '0 14px', borderRadius: 4,
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background 0.12s, border-color 0.12s',
                    flexShrink: 0, minWidth: 70, justifyContent: 'center',
                }}
            >
                <IconPlus /> ADD
            </button>
        </div>

        {/* Player list */}
        <div style={{ flex: 1, minHeight: 160, overflowY: 'auto' }}>
            {players.length === 0 ? (
                <div style={{
                    margin: '16px 14px',
                    border: `1px dashed ${BDR_MD}`,
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.015)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '24px 0', gap: 7,
                }}>
                    <div style={{ fontFamily: RM, fontSize: 9, color: TXT_DIM, letterSpacing: '0.25em', textTransform: 'uppercase' }}>NO PLAYERS ADDED</div>
                    <div style={{ fontFamily: RM, fontSize: 8, color: TXT_MUT, letterSpacing: '0.2em', textTransform: 'uppercase' }}>USE THE FORM ABOVE TO ADD</div>
                </div>
            ) : (
                players.map((p, idx) => (
                    <div key={p.id} style={{
                        display: 'flex', alignItems: 'center',
                        padding: '0 14px',
                        borderBottom: `1px solid ${BDR_DIM}`,
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                        minHeight: 40,
                    }}>
                        <div style={{
                            fontFamily: RM, fontWeight: 700, fontSize: 11,
                            color: color,
                            background: `${color}18`,
                            border: `1px solid ${color}44`,
                            padding: '2px 7px',
                            letterSpacing: '0.05em',
                            flexShrink: 0, marginRight: 12,
                            minWidth: 36, textAlign: 'center',
                        }}>#{p.number}</div>
                        <span style={{
                            fontFamily: SG, fontWeight: 600, fontSize: 11,
                            color: TXT, letterSpacing: '0.08em',
                            textTransform: 'uppercase', flex: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{p.name}</span>
                        <button
                            onClick={() => onRemove(p.id)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: TXT_MUT, padding: '4px 6px',
                                display: 'flex', alignItems: 'center',
                                transition: 'color 0.1s', flexShrink: 0,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = RED)}
                            onMouseLeave={e => (e.currentTarget.style.color = TXT_MUT)}
                            onTouchStart={e => (e.currentTarget.style.color = RED)}
                            onTouchEnd={e => (e.currentTarget.style.color = TXT_MUT)}
                        >
                            <IconRemove />
                        </button>
                    </div>
                ))
            )}
        </div>
    </div>
);

// ── Component ─────────────────────────────────────────────────────────────────
const RosterSetup: React.FC<RosterSetupProps> = ({ config, onConfirm, onBack }) => {

    const [playersA,    setPlayersA]    = useState<Player[]>([]);
    const [playersB,    setPlayersB]    = useState<Player[]>([]);
    const [playerNameA, setPlayerNameA] = useState('');
    const [playerNumA,  setPlayerNumA]  = useState('');
    const [playerNameB, setPlayerNameB] = useState('');
    const [playerNumB,  setPlayerNumB]  = useState('');
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

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

    const configSummary = [
        `${config.teamAName} VS ${config.teamBName}`,
        `${config.periods}×${config.periodMinutes}MIN`,
        config.shotClockSeconds ? `${config.shotClockSeconds}S CLOCK` : 'NO CLOCK',
        config.gameMode.toUpperCase(),
    ].join('  ·  ');

    const totalPlayers = playersA.length + playersB.length;

    // ── JSX ───────────────────────────────────────────────────────────────────
    return (
        <>
            <style>{`
                @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: ${SURFACE}; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 2px; }
                input::placeholder { color: #6B6B72; letter-spacing: 0.1em; }
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
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                        <span style={{
                            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                            fontSize: 13, color: TXT, letterSpacing: '0.05em', flexShrink: 0,
                        }}>ROSTER_INPUT</span>
                        <span style={{
                            display: 'inline-block', width: 7, height: 13,
                            background: RED, verticalAlign: 'middle',
                            animation: 'blink 1s step-end infinite', flexShrink: 0,
                        }} />
                        <span style={{
                            fontFamily: RM, fontSize: 8, color: TXT_MUT,
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            marginLeft: 8,
                        }}>{configSummary}</span>
                    </div>
                    <button onClick={onBack} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: RM, fontSize: 9, color: TXT_MUT,
                        letterSpacing: '0.15em', textTransform: 'uppercase',
                        padding: 0, flexShrink: 0,
                    }}>← BACK</button>
                </div>

                {/* ── SCROLLABLE CONTENT ──────────────────────────────── */}
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px 24px 0' }}>

                    {/* Section header */}
                    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{
                                fontFamily: RM, fontSize: 8, color: RED,
                                letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 6,
                            }}>SYS_MSG: ADD PLAYERS OR SKIP TO BEGIN MATCH</div>
                            <div style={{
                                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                fontSize: 26, color: TXT, textTransform: 'uppercase',
                                letterSpacing: '-0.01em', lineHeight: 1,
                            }}>Player Selection</div>
                        </div>
                        {/* Total count */}
                        <div style={{
                            fontFamily: RM, fontSize: 9, color: totalPlayers > 0 ? GREEN : TXT_MUT,
                            letterSpacing: '0.18em', textTransform: 'uppercase',
                            display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 2,
                        }}>
                            {totalPlayers > 0 && (
                                <div style={{ width: 6, height: 6, background: GREEN, flexShrink: 0 }} />
                            )}
                            {totalPlayers} PLAYER{totalPlayers !== 1 ? 'S' : ''} ADDED
                        </div>
                    </div>

                    {/* Two-column team panels */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                        <TeamPanel
                            team="A" color={config.teamAColor} players={playersA} name={config.teamAName}
                            pName={playerNameA} pNum={playerNumA}
                            onPName={setPlayerNameA} onPNum={setPlayerNumA}
                            onAdd={addPlayerA}
                            onRemove={id => setPlayersA(prev => prev.filter(x => x.id !== id))}
                            focusName="nameA" focusNum="numA"
                            focusedInput={focusedInput} setFocusedInput={setFocusedInput}
                        />

                        <TeamPanel
                            team="B" color={config.teamBColor} players={playersB} name={config.teamBName}
                            pName={playerNameB} pNum={playerNumB}
                            onPName={setPlayerNameB} onPNum={setPlayerNumB}
                            onAdd={addPlayerB}
                            onRemove={id => setPlayersB(prev => prev.filter(x => x.id !== id))}
                            focusName="nameB" focusNum="numB"
                            focusedInput={focusedInput} setFocusedInput={setFocusedInput}
                        />

                    </div>
                    <div style={{ height: 24 }} />
                </div>

                {/* ── FOOTER 48px ─────────────────────────────────────── */}
                <div style={{
                    height: 56, flexShrink: 0,
                    background: SURFACE, borderTop: `1px solid ${BDR_MD}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 24px',
                }}>
                    {/* Left: daemon status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 7, height: 7, background: GREEN, flexShrink: 0 }} />
                        <span style={{ fontFamily: RM, fontSize: 8, color: TXT_MUT, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                            DAEMON: CONNECTED
                        </span>
                    </div>

                    {/* Right: skip + begin */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                            onClick={() => onConfirm({ ...config, playersA: [], playersB: [] })}
                            style={{
                                background: SURFACE2,
                                border: `1px solid ${BDR_MD}`,
                                color: TXT_DIM,
                                fontFamily: RM, fontSize: 10, fontWeight: 700,
                                letterSpacing: '0.18em', textTransform: 'uppercase',
                                padding: '0 20px', height: 38,
                                cursor: 'pointer', borderRadius: 4,
                                transition: 'border-color 0.1s, color 0.1s, background 0.1s',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.borderColor = BDR_HI;
                                (e.currentTarget as HTMLElement).style.color = TXT;
                                (e.currentTarget as HTMLElement).style.background = SURFACE3;
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.borderColor = BDR_MD;
                                (e.currentTarget as HTMLElement).style.color = TXT_DIM;
                                (e.currentTarget as HTMLElement).style.background = SURFACE2;
                            }}
                        >SKIP ROSTER →</button>
                        <button
                            onClick={() => onConfirm({ ...config, playersA, playersB })}
                            style={{
                                padding: '0 32px', height: 38, border: 'none', borderRadius: 4,
                                background: RED, color: TXT,
                                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 13,
                                letterSpacing: '0.1em', textTransform: 'uppercase',
                                cursor: 'pointer', transition: 'background 0.12s',
                                boxShadow: '0 2px 12px rgba(220,38,38,0.35)',
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#b91c1c'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = RED}
                            onTouchStart={e => (e.currentTarget as HTMLElement).style.background = '#b91c1c'}
                            onTouchEnd={e => (e.currentTarget as HTMLElement).style.background = RED}
                        >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <polygon points="1,1 9,5 1,9" fill="white"/>
                            </svg>
                            BEGIN MATCH
                        </button>
                    </div>
                </div>

            </div>
        </>
    );
};

export default RosterSetup;
