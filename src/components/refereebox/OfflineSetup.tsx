// src/components/refereebox/OfflineSetup.tsx — THE BOX Offline Setup v2
// Adds: mode selector (Quick/Stats/Advanced) + optional player roster entry

import React, { useState } from 'react';

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

const COLOR_PRESETS = [
    { value: '#3B82F6' }, { value: '#EF4444' }, { value: '#22C55E' },
    { value: '#8B5CF6' }, { value: '#F97316' }, { value: '#06B6D4' },
    { value: '#EC4899' }, { value: '#EAB308' }, { value: '#FFFFFF' },
];

const PERIOD_OPTIONS = [
    { label: '5', value: 5 }, { label: '8', value: 8 },
    { label: '10', value: 10 }, { label: '12', value: 12 },
];

const MODES = [
    { id: 'quick' as const, label: 'QUICK', icon: '⚡', desc: 'Score only, no stats' },
    { id: 'stats' as const, label: 'STATS', icon: '📊', desc: 'Player attribution' },
    { id: 'advanced' as const, label: 'ADVANCED', icon: '🏀', desc: 'Full shot chart' },
];

const font = { fontFamily: "'JetBrains Mono', monospace" };
const displayFont = { fontFamily: "'Oswald', sans-serif" };

const OfflineSetup: React.FC<OfflineSetupProps> = ({ onConfirm, onBack }) => {
    const [step, setStep] = useState<'config' | 'roster'>('config');
    const [config, setConfig] = useState<Omit<GameConfig, 'playersA' | 'playersB'>>({
        teamAName: '', teamBName: '',
        teamAColor: '#3B82F6', teamBColor: '#EF4444',
        periodMinutes: 10, shotClockSeconds: 24,
        periods: 4, periodType: 'quarter',
        timeoutsPerTeam: 2, gameMode: 'quick',
    });

    const [playersA, setPlayersA] = useState<Player[]>([]);
    const [playersB, setPlayersB] = useState<Player[]>([]);
    const [activeTeam, setActiveTeam] = useState<'A' | 'B'>('A');
    const [playerName, setPlayerName] = useState('');
    const [playerNumber, setPlayerNumber] = useState('');

    const isValid = config.teamAName.trim().length > 0 && config.teamBName.trim().length > 0;
    const needsRoster = config.gameMode === 'stats' || config.gameMode === 'advanced';

    const handleNext = () => {
        if (needsRoster) { setStep('roster'); }
        else { onConfirm({ ...config, playersA: [], playersB: [] }); }
    };

    const handleFinish = () => {
        onConfirm({ ...config, playersA, playersB });
    };

    const addPlayer = () => {
        if (!playerName.trim() || !playerNumber.trim()) return;
        const player: Player = { id: `p-${Date.now()}`, name: playerName.trim().toUpperCase(), number: playerNumber.trim() };
        if (activeTeam === 'A') setPlayersA(prev => [...prev, player]);
        else setPlayersB(prev => [...prev, player]);
        setPlayerName(''); setPlayerNumber('');
    };

    const removePlayer = (team: 'A' | 'B', id: string) => {
        if (team === 'A') setPlayersA(prev => prev.filter(p => p.id !== id));
        else setPlayersB(prev => prev.filter(p => p.id !== id));
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', height: '48px',
        background: '#111', border: '2px solid #2a2a2a',
        borderRadius: '10px', color: '#fff',
        ...displayFont, fontSize: '20px', fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        padding: '0 16px', outline: 'none',
        transition: 'border-color 0.15s',
    };

    // ── ROSTER STEP ──────────────────────────────────────────
    if (step === 'roster') {
        const activePlayers = activeTeam === 'A' ? playersA : playersB;
        const activeColor = activeTeam === 'A' ? config.teamAColor : config.teamBColor;
        const activeName = activeTeam === 'A' ? config.teamAName : config.teamBName;

        return (
            <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ height: 52, background: '#080808', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
                    <button onClick={() => setStep('config')} style={{ background: 'none', border: '1px solid #222', borderRadius: 6, color: '#555', ...font, fontSize: 11, letterSpacing: '0.1em', padding: '6px 14px', cursor: 'pointer' }}>← BACK</button>
                    <span style={{ ...font, fontSize: 11, color: '#444', letterSpacing: '0.2em' }}>ROSTER SETUP</span>
                    <button onClick={handleFinish} style={{ background: '#22C55E', border: 'none', borderRadius: 8, color: '#fff', ...displayFont, fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', padding: '8px 20px', cursor: 'pointer' }}>
                        START GAME →
                    </button>
                </div>

                {/* Team tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #111', flexShrink: 0 }}>
                    {(['A', 'B'] as const).map(t => {
                        const name = t === 'A' ? config.teamAName : config.teamBName;
                        const color = t === 'A' ? config.teamAColor : config.teamBColor;
                        const count = t === 'A' ? playersA.length : playersB.length;
                        const active = activeTeam === t;
                        return (
                            <button key={t} onClick={() => setActiveTeam(t)} style={{
                                flex: 1, height: 48, background: active ? '#0a0a0a' : '#050505',
                                border: 'none', borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                            }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                                <span style={{ ...displayFont, fontWeight: 700, fontSize: 16, color: active ? '#fff' : '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{name}</span>
                                <span style={{ ...font, fontSize: 11, color: color, background: `${color}20`, padding: '2px 8px', borderRadius: 10 }}>{count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Body */}
                <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>
                    {/* Add player form */}
                    <div style={{ width: 300, borderRight: '1px solid #111', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
                        <div style={{ ...font, fontSize: 10, color: '#555', letterSpacing: '0.2em' }}>ADD PLAYER</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                value={playerNumber} onChange={e => setPlayerNumber(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addPlayer()}
                                placeholder="#" style={{ ...inputStyle, width: 80, fontSize: 18, textAlign: 'center', flexShrink: 0 }}
                            />
                            <input
                                value={playerName} onChange={e => setPlayerName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addPlayer()}
                                placeholder="NAME" style={{ ...inputStyle, flex: 1 }}
                            />
                        </div>
                        <button onClick={addPlayer} disabled={!playerName.trim() || !playerNumber.trim()} style={{
                            height: 48, background: playerName.trim() && playerNumber.trim() ? activeColor : '#111',
                            border: 'none', borderRadius: 10, color: '#fff', ...displayFont, fontWeight: 700,
                            fontSize: 16, letterSpacing: '0.1em', cursor: 'pointer', transition: 'background 0.2s', opacity: playerName.trim() && playerNumber.trim() ? 1 : 0.4,
                        }}>+ ADD</button>
                        <div style={{ ...font, fontSize: 9, color: '#333', letterSpacing: '0.1em', marginTop: 8 }}>
                            You can skip roster — players can be attributed as "UNKNOWN"
                        </div>
                    </div>

                    {/* Player list */}
                    <div style={{ flex: 1, padding: 24, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {activePlayers.length === 0 ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', ...font, fontSize: 11, color: '#333', letterSpacing: '0.15em' }}>
                                NO PLAYERS ADDED YET
                            </div>
                        ) : activePlayers.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#0a0a0a', border: '1px solid #111', borderRadius: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${activeColor}20`, border: `1px solid ${activeColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...displayFont, fontWeight: 700, fontSize: 14, color: activeColor, flexShrink: 0 }}>
                                    {p.number}
                                </div>
                                <span style={{ ...displayFont, fontWeight: 600, fontSize: 16, color: '#fff', letterSpacing: '0.08em', flex: 1 }}>{p.name}</span>
                                <button onClick={() => removePlayer(activeTeam, p.id)} style={{ background: 'none', border: '1px solid #222', borderRadius: 6, color: '#555', ...font, fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── CONFIG STEP ──────────────────────────────────────────
    return (
        <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ height: 52, background: '#080808', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
                <button onClick={onBack} style={{ background: 'none', border: '1px solid #222', borderRadius: 6, color: '#555', ...font, fontSize: 11, letterSpacing: '0.1em', padding: '6px 14px', cursor: 'pointer' }}>← BACK</button>
                <span style={{ ...font, fontSize: 11, color: '#444', letterSpacing: '0.2em' }}>OFFLINE SETUP</span>
                <div style={{ width: 80 }} />
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* MODE SELECTOR */}
                <div>
                    <div style={{ ...font, fontSize: 10, color: '#555', letterSpacing: '0.2em', marginBottom: 12 }}>SCORING MODE</div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {MODES.map(mode => (
                            <div key={mode.id} onClick={() => setConfig({ ...config, gameMode: mode.id })} style={{
                                flex: 1, padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                                background: config.gameMode === mode.id ? '#111' : '#080808',
                                border: `2px solid ${config.gameMode === mode.id ? '#3B82F6' : '#1a1a1a'}`,
                                transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 6,
                            }}>
                                <div style={{ fontSize: 22 }}>{mode.icon}</div>
                                <div style={{ ...displayFont, fontWeight: 700, fontSize: 14, color: config.gameMode === mode.id ? '#fff' : '#555', letterSpacing: '0.1em' }}>{mode.label}</div>
                                <div style={{ ...font, fontSize: 9, color: '#444', letterSpacing: '0.05em' }}>{mode.desc}</div>
                            </div>
                        ))}
                    </div>
                    {config.gameMode !== 'quick' && (
                        <div style={{ marginTop: 10, padding: '10px 14px', background: '#0a0a0a', borderRadius: 8, border: '1px solid #111' }}>
                            <span style={{ ...font, fontSize: 10, color: '#555' }}>
                                {config.gameMode === 'stats' ? '📊 After each score, you\'ll be prompted to select which player scored.' : '🏀 After each score, select the player AND tap the court location.'}
                                {' You can skip attribution — score updates immediately regardless.'}
                            </span>
                        </div>
                    )}
                </div>

                {/* TEAMS */}
                <div style={{ display: 'flex', gap: 20 }}>
                    {/* Team A */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ ...font, fontSize: 10, color: '#555', letterSpacing: '0.2em' }}>TEAM A</div>
                        <input
                            value={config.teamAName} onChange={e => setConfig({ ...config, teamAName: e.target.value })}
                            placeholder="TEAM A NAME" style={{ ...inputStyle, borderColor: config.teamAColor + '60' }}
                            onFocus={e => (e.target.style.borderColor = config.teamAColor)}
                            onBlur={e => (e.target.style.borderColor = config.teamAColor + '60')}
                            maxLength={12} autoComplete="off"
                        />
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {COLOR_PRESETS.map(c => (
                                <div key={c.value + 'A'} onClick={() => setConfig({ ...config, teamAColor: c.value })} style={{ width: 30, height: 30, borderRadius: 6, background: c.value, border: config.teamAColor === c.value ? '3px solid #fff' : '3px solid transparent', cursor: 'pointer', opacity: config.teamAColor === c.value ? 1 : 0.5, transition: 'all 0.15s' }} />
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', ...font, fontSize: 12, color: '#333', fontWeight: 700 }}>VS</div>

                    {/* Team B */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ ...font, fontSize: 10, color: '#555', letterSpacing: '0.2em' }}>TEAM B</div>
                        <input
                            value={config.teamBName} onChange={e => setConfig({ ...config, teamBName: e.target.value })}
                            placeholder="TEAM B NAME" style={{ ...inputStyle, borderColor: config.teamBColor + '60' }}
                            onFocus={e => (e.target.style.borderColor = config.teamBColor)}
                            onBlur={e => (e.target.style.borderColor = config.teamBColor + '60')}
                            maxLength={12} autoComplete="off"
                        />
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {COLOR_PRESETS.map(c => (
                                <div key={c.value + 'B'} onClick={() => setConfig({ ...config, teamBColor: c.value })} style={{ width: 30, height: 30, borderRadius: 6, background: c.value, border: config.teamBColor === c.value ? '3px solid #fff' : '3px solid transparent', cursor: 'pointer', opacity: config.teamBColor === c.value ? 1 : 0.5, transition: 'all 0.15s' }} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* RULES */}
                <div style={{ display: 'flex', gap: 20 }}>
                    {/* Period length */}
                    <div style={{ flex: 1 }}>
                        <div style={{ ...font, fontSize: 10, color: '#555', letterSpacing: '0.2em', marginBottom: 8 }}>PERIOD LENGTH</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {PERIOD_OPTIONS.map(opt => (
                                <div key={opt.value} onClick={() => setConfig({ ...config, periodMinutes: opt.value })} style={{
                                    flex: 1, height: 40, background: config.periodMinutes === opt.value ? '#1a2a1a' : '#111',
                                    border: `1.5px solid ${config.periodMinutes === opt.value ? '#22C55E' : '#222'}`,
                                    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    ...font, fontSize: 13, color: config.periodMinutes === opt.value ? '#22C55E' : '#555',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}>
                                    {opt.label}m
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Shot clock */}
                    <div style={{ flex: 1 }}>
                        <div style={{ ...font, fontSize: 10, color: '#555', letterSpacing: '0.2em', marginBottom: 8 }}>SHOT CLOCK</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {[24, 14, 0].map(s => (
                                <div key={s} onClick={() => setConfig({ ...config, shotClockSeconds: s })} style={{
                                    flex: 1, height: 40, background: config.shotClockSeconds === s ? '#1a2a3a' : '#111',
                                    border: `1.5px solid ${config.shotClockSeconds === s ? '#3B82F6' : '#222'}`,
                                    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    ...font, fontSize: 13, color: config.shotClockSeconds === s ? '#3B82F6' : '#555',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}>
                                    {s === 0 ? 'OFF' : `${s}s`}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Periods */}
                    <div style={{ flex: 1 }}>
                        <div style={{ ...font, fontSize: 10, color: '#555', letterSpacing: '0.2em', marginBottom: 8 }}>FORMAT</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {[{ label: '4Q', periods: 4, type: 'quarter' as const }, { label: '2H', periods: 2, type: 'half' as const }].map(opt => (
                                <div key={opt.label} onClick={() => setConfig({ ...config, periods: opt.periods, periodType: opt.type })} style={{
                                    flex: 1, height: 40, background: config.periods === opt.periods ? '#1a1a2a' : '#111',
                                    border: `1.5px solid ${config.periods === opt.periods ? '#8B5CF6' : '#222'}`,
                                    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    ...font, fontSize: 13, color: config.periods === opt.periods ? '#8B5CF6' : '#555',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}>
                                    {opt.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Timeouts */}
                <div>
                    <div style={{ ...font, fontSize: 10, color: '#555', letterSpacing: '0.2em', marginBottom: 8 }}>TIMEOUTS PER TEAM</div>
                    <div style={{ display: 'flex', gap: 6, width: 200 }}>
                        {[1, 2, 3, 4].map(n => (
                            <div key={n} onClick={() => setConfig({ ...config, timeoutsPerTeam: n })} style={{
                                width: 44, height: 40, background: config.timeoutsPerTeam === n ? '#111' : '#080808',
                                border: `1.5px solid ${config.timeoutsPerTeam === n ? '#F59E0B' : '#1a1a1a'}`,
                                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                ...font, fontSize: 14, color: config.timeoutsPerTeam === n ? '#F59E0B' : '#444',
                                cursor: 'pointer', transition: 'all 0.15s',
                            }}>
                                {n}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA */}
            <div style={{ padding: '16px 32px', borderTop: '1px solid #111', flexShrink: 0 }}>
                <div onClick={isValid ? handleNext : undefined} style={{
                    width: '100%', height: 56,
                    background: isValid ? 'linear-gradient(135deg, #22C55E, #16A34A)' : '#111',
                    borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                    cursor: isValid ? 'pointer' : 'not-allowed', opacity: isValid ? 1 : 0.3, transition: 'all 0.2s',
                }}>
                    <span style={{ ...displayFont, fontWeight: 700, fontSize: 20, letterSpacing: '0.15em', color: isValid ? '#fff' : '#444' }}>
                        {needsRoster ? 'NEXT: ROSTER →' : 'START GAME →'}
                    </span>
                </div>
            </div>

            <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=JetBrains+Mono:wght@400;600;700&display=swap');`}</style>
        </div>
    );
};

export default OfflineSetup;