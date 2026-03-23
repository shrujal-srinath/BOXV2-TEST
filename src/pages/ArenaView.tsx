// src/pages/ArenaView.tsx
// ─────────────────────────────────────────────────────────────
// ZERO-LATENCY ARENA DISPLAY
// This file uses your exact SpectatorView UI, but connects locally
// to the pi-daemon via WebSockets. No internet required.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { useRefereeBox } from '../hooks/useRefereeBox';

// ─── UTILITY ─────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const getPeriodLabel = (period: number) => period <= 4 ? `Q${period}` : `OT${period - 4}`;
const getFullPeriodLabel = (period: number) => period <= 4 ? `QUARTER ${period}` : `OVERTIME ${period - 4}`;

// ─── SCORE DISPLAY ───────────────────────────────────────────────────────────

const ScoreDisplay: React.FC<{ score: number; color: string; hasPossession: boolean; }> = ({ score, color, hasPossession }) => {
    const [prevScore, setPrevScore] = useState(score);
    const [pulse, setPulse] = useState(false);

    useEffect(() => {
        if (score !== prevScore) {
            setPulse(true);
            const t = setTimeout(() => {
                setPulse(false);
                setPrevScore(score);
            }, 800);
            return () => clearTimeout(t);
        }
    }, [score, prevScore]);

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            {pulse && (
                <div style={{ position: 'absolute', inset: '-20%', borderRadius: '50%', background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`, animation: 'burstFade 0.8s ease-out forwards', pointerEvents: 'none', zIndex: 0 }} />
            )}
            <div style={{ position: 'relative', zIndex: 1, fontFamily: '"Oswald", "Barlow Condensed", "Arial Narrow", sans-serif', fontWeight: 900, fontSize: 'clamp(10rem, 18vw, 22rem)', lineHeight: 0.9, letterSpacing: '-0.02em', color: '#FFFFFF', textShadow: pulse ? `0 0 80px ${color}, 0 0 40px ${color}99, 0 0 160px ${color}33` : `0 0 40px ${color}33`, transition: 'text-shadow 0.3s ease', fontVariantNumeric: 'tabular-nums' }}>
                {pad(score)}
            </div>
            {hasPossession && (
                <div style={{ position: 'absolute', bottom: '-2rem', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '1.2rem solid transparent', borderRight: '1.2rem solid transparent', borderBottom: `2rem solid ${color}`, filter: `drop-shadow(0 0 12px ${color})`, animation: 'possessionBlink 1.2s ease-in-out infinite' }} />
            )}
        </div>
    );
};

// ─── CLOCK DISPLAY ───────────────────────────────────────────────────────────

const ClockDisplay: React.FC<{ minutes: number; seconds: number; running: boolean; }> = ({ minutes, seconds, running }) => {
    const isLow = minutes === 0 && seconds <= 30;
    const isCritical = minutes === 0 && seconds <= 10;
    const timeStr = `${pad(minutes)}:${pad(seconds)}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(0.3rem, 0.5vw, 0.8rem)' }}>
            <div style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 400, fontSize: 'clamp(0.7rem, 1.2vw, 1.4rem)', letterSpacing: '0.3em', color: isCritical ? '#FF6060' : '#666666' }}>
                GAME CLOCK
            </div>
            <div style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 900, fontSize: 'clamp(5rem, 9vw, 12rem)', lineHeight: 1, color: isCritical ? '#FF3030' : isLow ? '#FF8C00' : '#FFFFFF', textShadow: isCritical ? '0 0 40px #FF3030' : isLow ? '0 0 30px #FF8C0066' : '0 0 20px rgba(255,255,255,0.1)', fontVariantNumeric: 'tabular-nums', animation: running && isCritical ? 'clockPulse 0.5s ease-in-out infinite alternate' : 'none' }}>
                {timeStr}
            </div>
            <span style={{ fontSize: 'clamp(0.55rem, 0.9vw, 1rem)', fontWeight: 700, letterSpacing: '0.2em', color: running ? '#00FF88' : '#FF4444', opacity: 0.9 }}>
                {running ? 'LIVE' : 'PAUSED'}
            </span>
        </div>
    );
};

// ─── SHOT CLOCK ──────────────────────────────────────────────────────────────

const ShotClock: React.FC<{ value: number }> = ({ value }) => {
    const isCritical = value <= 5;
    const isWarning = value <= 10;

    return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: isCritical ? 'linear-gradient(135deg, #3A0000 0%, #200000 100%)' : 'linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)', border: `2px solid ${isCritical ? '#FF3030' : isWarning ? '#FF8C00' : '#333333'}`, borderRadius: '1.2rem', padding: 'clamp(0.8rem, 1.5vw, 2rem) clamp(1.5rem, 3vw, 4rem)', boxShadow: isCritical ? '0 0 40px #FF303066, inset 0 0 20px #FF303011' : '0 0 20px rgba(0,0,0,0.5)', transition: 'all 0.3s ease', animation: isCritical ? 'criticalFlash 0.3s ease-in-out infinite alternate' : 'none' }}>
            <span style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 400, fontSize: 'clamp(0.7rem, 1.2vw, 1.4rem)', letterSpacing: '0.3em', color: isCritical ? '#FF6060' : '#888888', marginBottom: '0.3rem' }}>SHOT CLOCK</span>
            <span style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 900, fontSize: 'clamp(3.5rem, 7vw, 8rem)', lineHeight: 1, color: isCritical ? '#FF3030' : isWarning ? '#FF8C00' : '#FFFFFF', textShadow: isCritical ? '0 0 30px #FF3030' : isWarning ? '0 0 20px #FF8C00' : 'none', fontVariantNumeric: 'tabular-nums' }}>
                {pad(value)}
            </span>
        </div>
    );
};

// ─── TEAM PANEL ──────────────────────────────────────────────────────────────

const TeamPanel: React.FC<{ name: string; score: number; fouls: number; timeouts: number; color: string; hasPossession: boolean; side: 'left' | 'right'; }> = ({ name, score, fouls, timeouts, color, hasPossession, side }) => {
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: side === 'left' ? 'flex-start' : 'flex-end', justifyContent: 'center', padding: 'clamp(2rem, 4vw, 6rem)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, [side === 'left' ? 'left' : 'right']: 0, width: '60%', height: '100%', background: `radial-gradient(ellipse at ${side === 'left' ? '0%' : '100%'} 50%, ${color}0D 0%, transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, [side === 'left' ? 'left' : 'right']: 0, width: '6px', height: '100%', background: `linear-gradient(to bottom, transparent, ${color}, transparent)` }} />

            <div style={{ fontFamily: '"Oswald", "Barlow Condensed", sans-serif', fontWeight: 700, fontSize: 'clamp(2rem, 4.5vw, 5.5rem)', letterSpacing: '0.08em', textTransform: 'uppercase', color, textShadow: `0 0 30px ${color}55`, textAlign: side === 'left' ? 'left' : 'right', marginBottom: 'clamp(0.5rem, 1vw, 1.5rem)', lineHeight: 1.1, maxWidth: '90%' }}>
                {name}
            </div>

            <div style={{ textAlign: side === 'left' ? 'left' : 'right' }}>
                <ScoreDisplay score={score} color={color} hasPossession={hasPossession} />
            </div>

            <div style={{ display: 'flex', gap: 'clamp(1.5rem, 2.5vw, 3.5rem)', marginTop: 'clamp(1.5rem, 2.5vw, 3.5rem)', flexDirection: side === 'left' ? 'row' : 'row-reverse' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 400, fontSize: 'clamp(0.6rem, 1vw, 1.1rem)', letterSpacing: '0.25em', color: '#666666', marginBottom: '0.4rem' }}>FOULS</div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {[...Array(5)].map((_, i) => (
                            <div key={i} style={{ width: 'clamp(0.8rem, 1.2vw, 1.6rem)', height: 'clamp(0.8rem, 1.2vw, 1.6rem)', borderRadius: '50%', background: i < fouls ? '#FF8C00' : 'transparent', border: `2px solid ${i < fouls ? '#FF8C00' : '#333333'}`, boxShadow: i < fouls ? '0 0 8px #FF8C0066' : 'none', transition: 'all 0.3s ease' }} />
                        ))}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 400, fontSize: 'clamp(0.6rem, 1vw, 1.1rem)', letterSpacing: '0.25em', color: '#666666', marginBottom: '0.4rem' }}>T.O.</div>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        {[...Array(3)].map((_, i) => (
                            <div key={i} style={{ width: 'clamp(0.6rem, 1vw, 1.3rem)', height: 'clamp(0.6rem, 1vw, 1.3rem)', borderRadius: '2px', background: i < timeouts ? color : 'transparent', border: `2px solid ${i < timeouts ? color : '#333333'}`, opacity: i < timeouts ? 0.9 : 0.3, transition: 'all 0.3s ease' }} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── CENTER COLUMN ────────────────────────────────────────────────────────────

const CenterPanel: React.FC<{ state: any }> = ({ state }) => {
    const { clock, teamA, teamB } = state;
    const scoreDiff = Math.abs(teamA.score - teamB.score);
    const leader = teamA.score > teamB.score ? 'A' : teamB.score > teamA.score ? 'B' : null;

    const minutes = Math.floor(clock.gameMs / 60000);
    const seconds = Math.floor((clock.gameMs % 60000) / 1000);
    const shotSeconds = Math.ceil(clock.shotMs / 1000);

    return (
        <div style={{ width: 'clamp(280px, 28vw, 480px)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'clamp(1rem, 2vw, 3rem)', padding: 'clamp(1rem, 2vw, 3rem) 0' }}>
            <div style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 700, fontSize: 'clamp(1.2rem, 2.5vw, 3rem)', letterSpacing: '0.25em', color: '#FFFFFF', textAlign: 'center', background: 'linear-gradient(135deg, #1A1A1A 0%, #111111 100%)', border: '1px solid #2A2A2A', borderRadius: '0.8rem', padding: 'clamp(0.4rem, 0.8vw, 1rem) clamp(1rem, 2vw, 2.5rem)' }}>
                {getFullPeriodLabel(clock.period)}
            </div>
            <ClockDisplay minutes={minutes} seconds={seconds} running={clock.isRunning} />
            <ShotClock value={shotSeconds} />

            {scoreDiff > 0 && leader && (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 400, fontSize: 'clamp(0.55rem, 0.85vw, 1rem)', letterSpacing: '0.2em', color: '#444444', marginBottom: '0.3rem' }}>LEAD</div>
                    <div style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 5rem)', color: leader === 'A' ? '#DC2626' : '#2563EB', lineHeight: 1 }}>+{scoreDiff}</div>
                </div>
            )}
            <div style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 400, fontSize: 'clamp(0.55rem, 0.85vw, 1rem)', letterSpacing: '0.2em', color: '#2A2A2A', textTransform: 'uppercase', textAlign: 'center' }}>BMSCE BASKETBALL</div>
        </div>
    );
};

// ─── HEADER & TICKER ─────────────────────────────────────────────────────────

const Header: React.FC<{ period: number }> = ({ period }) => (
    <div style={{ height: 'clamp(3rem, 5vh, 5rem)', background: '#050505', borderBottom: '1px solid #1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 clamp(1.5rem, 3vw, 4rem)', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 'clamp(0.5rem, 0.8vw, 1rem)', height: 'clamp(0.5rem, 0.8vw, 1rem)', borderRadius: '50%', background: '#FF3030', boxShadow: '0 0 8px #FF3030', animation: 'ledPulse 1s ease-in-out infinite alternate' }} />
            <span style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 400, fontSize: 'clamp(0.6rem, 1vw, 1.2rem)', letterSpacing: '0.3em', color: '#FF3030' }}>LOCAL HARDWARE LINK</span>
        </div>
        <div style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 700, fontSize: 'clamp(0.8rem, 1.4vw, 1.8rem)', letterSpacing: '0.3em', color: '#FFFFFF', textTransform: 'uppercase' }}>THE BOX</div>
        <div style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 400, fontSize: 'clamp(0.6rem, 1vw, 1.2rem)', letterSpacing: '0.2em', color: '#444444' }}>{getPeriodLabel(period)}</div>
    </div>
);

const TickerBar: React.FC<{ state: any }> = ({ state }) => {
    const diff = state.teamA.score - state.teamB.score;
    const diffStr = diff > 0 ? `${state.teamA.name} leads by +${diff}` : diff < 0 ? `${state.teamB.name} leads by +${Math.abs(diff)}` : 'GAME IS TIED';

    const minutes = Math.floor(state.clock.gameMs / 60000);
    const seconds = Math.floor((state.clock.gameMs % 60000) / 1000);

    const items = [
        `🏀 BMSCE BASKETBALL`,
        `${getPeriodLabel(state.clock.period)} — ${pad(minutes)}:${pad(seconds)}`,
        diffStr,
        `${state.teamA.name.toUpperCase()}  ${pad(state.teamA.score)}  :  ${pad(state.teamB.score)}  ${state.teamB.name.toUpperCase()}`,
        `FOULS — ${state.teamA.name}: ${state.teamA.fouls}  |  ${state.teamB.name}: ${state.teamB.fouls}`,
        state.clock.isRunning ? '▶ CLOCK RUNNING' : '⏸ CLOCK STOPPED',
    ];

    return (
        <div style={{ height: 'clamp(2rem, 3.5vh, 3.5rem)', background: '#050505', borderTop: '1px solid #1A1A1A', display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ background: '#FF3030', height: '100%', padding: '0 1.5rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 700, fontSize: 'clamp(0.6rem, 1vw, 1rem)', letterSpacing: '0.2em', color: '#FFFFFF' }}>LIVE FEED</span>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <div style={{ display: 'flex', gap: 'clamp(2rem, 4vw, 6rem)', animation: 'ticker 30s linear infinite', whiteSpace: 'nowrap' }}>
                    {[...items, ...items].map((item, i) => (
                        <span key={i} style={{ fontFamily: '"Oswald", sans-serif', fontWeight: 400, fontSize: 'clamp(0.6rem, 1vw, 1.1rem)', letterSpacing: '0.15em', color: '#555555', flexShrink: 0 }}>{item}</span>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────

const GlobalStyles = () => (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { width: 100%; height: 100%; background: #000000; overflow: hidden; }
    @keyframes burstFade { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
    @keyframes ledPulse { from { opacity: 0.6; } to { opacity: 1; } }
    @keyframes possessionBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    @keyframes clockPulse { from { transform: scale(1); } to { transform: scale(1.015); } }
    @keyframes criticalFlash { from { border-color: #FF303066; } to { border-color: #FF3030; box-shadow: 0 0 60px #FF303099; } }
    @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes breathe { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }
  `}</style>
);

// ─── MAIN ARENA VIEW ─────────────────────────────────────────────────────────

export const ArenaView: React.FC = () => {
    const { gameState, isConnected } = useRefereeBox();

    if (!isConnected || !gameState) {
        return (
            <div style={{ minHeight: '100vh', background: '#000000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3rem', fontFamily: '"Oswald", sans-serif' }}>
                <GlobalStyles />
                <div style={{ position: 'relative', width: '8rem', height: '8rem' }}>
                    <div style={{ position: 'absolute', inset: 0, border: '3px solid #1A1A1A', borderTopColor: '#FF3030', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <div style={{ position: 'absolute', inset: '1.5rem', border: '2px solid #1A1A1A', borderTopColor: '#FF3030', borderRadius: '50%', animation: 'spin 0.6s linear infinite reverse', opacity: 0.5 }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', fontWeight: 700, letterSpacing: '0.4em', color: '#333333', animation: 'breathe 2s ease-in-out infinite' }}>CONNECTING</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 400, letterSpacing: '0.2em', color: '#1A1A1A', marginTop: '0.5rem' }}>WAITING FOR LOCAL HARDWARE DAEMON</div>
                </div>
            </div>
        );
    }

    return (
        <>
            <GlobalStyles />
            <div style={{ width: '100vw', height: '100vh', background: '#000000', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)', pointerEvents: 'none', zIndex: 100 }} />
                <Header period={gameState.clock.period} />

                <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', overflow: 'hidden', minHeight: 0 }}>
                    <TeamPanel name={gameState.teamA.name} score={gameState.teamA.score} fouls={gameState.teamA.fouls} timeouts={gameState.teamA.timeouts} color={'#DC2626'} hasPossession={false} side="left" />
                    <div style={{ width: '1px', background: 'linear-gradient(to bottom, transparent 0%, #1E1E1E 20%, #1E1E1E 80%, transparent 100%)', flexShrink: 0 }} />
                    <CenterPanel state={gameState} />
                    <div style={{ width: '1px', background: 'linear-gradient(to bottom, transparent 0%, #1E1E1E 20%, #1E1E1E 80%, transparent 100%)', flexShrink: 0 }} />
                    <TeamPanel name={gameState.teamB.name} score={gameState.teamB.score} fouls={gameState.teamB.fouls} timeouts={gameState.teamB.timeouts} color={'#2563EB'} hasPossession={false} side="right" />
                </div>

                <TickerBar state={gameState} />
            </div>
        </>
    );
};

export default ArenaView;