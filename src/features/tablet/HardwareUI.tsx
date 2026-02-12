// src/features/tablet/HardwareUI.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — REFEREE CONSOLE v6
// Target: iPad Air 2, 1024×768px landscape
//
// LAYOUT (landscape, full bleed):
//
//  ┌─────────────────────────────────────────────────────────┐
//  │  HEADER BAR  — period · game name · status LEDs         │  44px
//  ├──────────────────┬──────────────┬────────────────────────┤
//  │                  │              │                        │
//  │   TEAM A         │   C L O C K  │   TEAM B               │
//  │                  │              │                        │
//  │  Score (huge)    │  Game Clock  │  Score (huge)          │
//  │  +1 +2 +3        │  START/STOP  │  +1 +2 +3              │
//  │                  │  Shot Clock  │                        │
//  │  Fouls (LEDs)    │  24 | 14     │  Fouls (LEDs)          │
//  │  Timeouts (dots) │  ◀ POSS ▶    │  Timeouts (dots)       │
//  │  −1  FOUL  T.O.  │              │  −1  FOUL  T.O.        │
//  │                  │              │                        │
//  ├──────────────────┴──────────────┴────────────────────────┤
//  │  FOOTER — undo · redo · next period · diagnostics        │  40px
//  └─────────────────────────────────────────────────────────┘
//
// ═══════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import type { BasketballGame } from '../../types';

interface HardwareUIProps {
  game: BasketballGame;
  onAction: (team: 'A' | 'B', type: 'points' | 'foul' | 'timeout', value: number) => void;
  onToggleClock: () => void;
  onResetShotClock: (seconds: number) => void;
  onTogglePossession: () => void;
  onNextPeriod: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  offlineQueue: any[];
  onOpenDiagnostics: () => void;
  onOpenSettings: () => void;
  isOnline: boolean;
}

// ── Foul LED strip (up to 5 visible, bonus at 4+) ──────────
const FoulLEDs: React.FC<{ count: number; color: string }> = ({ count, color }) => {
  const MAX = 5;
  const bonus = count >= 4;
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="text-[9px] font-black uppercase tracking-[0.15em]"
        style={{ color: '#52525b' }}
      >
        FOULS
      </div>
      <div className="flex gap-1.5 items-center">
        {Array.from({ length: MAX }).map((_, i) => {
          const lit = i < count;
          const isBonus = i === 3; // 4th foul = bonus threshold
          return (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: lit
                  ? isBonus
                    ? '#f97316'   // orange for bonus foul
                    : color
                  : '#1c1c1c',
                boxShadow: lit
                  ? `0 0 8px ${isBonus ? '#f97316' : color}, 0 0 2px ${isBonus ? '#f97316' : color}`
                  : 'inset 0 1px 3px rgba(0,0,0,0.8)',
                border: `1px solid ${lit ? (isBonus ? '#f9731660' : color + '60') : '#2a2a2a'}`,
                transition: 'all 0.15s',
              }}
            />
          );
        })}
        {count > MAX && (
          <span style={{ color, fontSize: 10, fontWeight: 900 }}>+{count - MAX}</span>
        )}
      </div>
      {bonus && (
        <div
          className="text-[8px] font-black uppercase tracking-wider animate-pulse"
          style={{ color: '#f97316' }}
        >
          BONUS
        </div>
      )}
    </div>
  );
};

// ── Timeout dots (remaining timeouts) ──────────────────────
const TimeoutDots: React.FC<{ remaining: number; total?: number; color: string }> = ({
  remaining,
  total = 2,
  color,
}) => {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: '#52525b' }}>
        T.OUTS
      </div>
      <div className="flex gap-2 items-center">
        {Array.from({ length: total }).map((_, i) => {
          const used = i >= remaining;
          return (
            <div
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                background: used ? '#111' : color,
                boxShadow: used
                  ? 'inset 0 1px 3px rgba(0,0,0,0.8)'
                  : `0 0 8px ${color}80, 0 0 2px ${color}`,
                border: `1.5px solid ${used ? '#2a2a2a' : color + '80'}`,
                transition: 'all 0.2s',
              }}
            />
          );
        })}
      </div>
      <div className="text-[9px] font-mono" style={{ color: remaining > 0 ? color : '#52525b' }}>
        {remaining}/{total}
      </div>
    </div>
  );
};

// ── Score button ───────────────────────────────────────────
const ScoreBtn: React.FC<{
  pts: number;
  color: string;
  onPress: () => void;
}> = ({ pts, color, onPress }) => (
  <button
    onPointerDown={onPress}
    style={{
      flex: 1,
      borderRadius: 10,
      background: `linear-gradient(160deg, ${color}18 0%, ${color}08 100%)`,
      border: `2px solid ${color}35`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
      transition: 'transform 0.08s, background 0.08s',
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.4)`,
      userSelect: 'none',
    }}
    onPointerUp={(e) => {
      (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
    }}
    onPointerEnter={() => { }}
  >
    <span
      style={{
        fontSize: 'clamp(1.6rem, 4vw, 2.8rem)',
        fontWeight: 900,
        color,
        lineHeight: 1,
        fontFamily: "'DM Mono', 'Courier New', monospace",
        textShadow: `0 0 12px ${color}60`,
      }}
    >
      +{pts}
    </span>
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: '#52525b',
      }}
    >
      {pts === 1 ? 'FREE' : pts === 2 ? 'FIELD' : '3‑PTR'}
    </span>
  </button>
);

// ── Secondary action button ────────────────────────────────
const ActionBtn: React.FC<{
  label: string;
  sub?: string;
  color?: string;
  bg?: string;
  onPress: () => void;
}> = ({ label, sub, color = '#71717a', bg = '#111', onPress }) => (
  <button
    onPointerDown={onPress}
    style={{
      flex: 1,
      height: 52,
      borderRadius: 8,
      background: bg,
      border: `1.5px solid #2a2a2a`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
      userSelect: 'none',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 6px rgba(0,0,0,0.5)',
      transition: 'transform 0.08s',
    }}
  >
    <span style={{ fontSize: 13, fontWeight: 900, color, letterSpacing: '0.05em' }}>{label}</span>
    {sub && <span style={{ fontSize: 8, fontWeight: 700, color: '#52525b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{sub}</span>}
  </button>
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export const HardwareUI: React.FC<HardwareUIProps> = ({
  game,
  onAction,
  onToggleClock,
  onResetShotClock,
  onTogglePossession,
  onNextPeriod,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  offlineQueue,
  onOpenDiagnostics,
  onOpenSettings,
  isOnline,
}) => {
  const [flashA, setFlashA] = useState(false);
  const [flashB, setFlashB] = useState(false);

  const vibrate = useCallback((p: number | number[]) => {
    if (navigator.vibrate) navigator.vibrate(p);
  }, []);

  const score = useCallback((team: 'A' | 'B', pts: number) => {
    onAction(team, 'points', pts);
    if (team === 'A') { setFlashA(true); setTimeout(() => setFlashA(false), 220); }
    else { setFlashB(true); setTimeout(() => setFlashB(false), 220); }
    vibrate(pts >= 3 ? [20, 8, 20, 8, 20] : [25, 10, 25]);
  }, [onAction, vibrate]);

  const foul = useCallback((team: 'A' | 'B') => {
    onAction(team, 'foul', 1);
    vibrate(90);
  }, [onAction, vibrate]);

  const timeout = useCallback((team: 'A' | 'B') => {
    onAction(team, 'timeout', -1);
    vibrate([50, 25, 50, 25, 50]);
  }, [onAction, vibrate]);

  const fmt = (m: number, s: number) =>
    `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const { gameState, teamA, teamB, settings } = game;
  const isRunning = gameState.gameRunning;
  const shotClock = gameState.shotClock;
  const period = gameState.period;
  const posA = gameState.possession === 'A';

  const periodLabel =
    settings.periodType === 'half'
      ? period <= 2 ? `HALF ${period}` : 'OT'
      : period <= 4 ? `Q${period}` : `OT${period - 4}`;

  const colorA = teamA.color || '#3b82f6';
  const colorB = teamB.color || '#ef4444';
  const shotCritical = shotClock <= 5 && shotClock > 0;

  // ── Layout constants ─────────────────────────────────────
  const HEADER_H = 44;
  const FOOTER_H = 44;
  const CENTER_W = 236;  // fixed center spine width

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#080808',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: "'DM Mono', 'Courier New', monospace",
        // Subtle brushed-metal texture via repeating gradient
        backgroundImage: `
          repeating-linear-gradient(
            90deg,
            rgba(255,255,255,0.012) 0px,
            rgba(255,255,255,0.012) 1px,
            transparent 1px,
            transparent 40px
          ),
          repeating-linear-gradient(
            0deg,
            rgba(0,0,0,0.3) 0px,
            rgba(0,0,0,0.3) 1px,
            transparent 1px,
            transparent 2px
          )`,
      }}
    >
      {/* ╔═══════════════════════════════════════════════════╗
          ║  HEADER BAR                                       ║
          ╚═══════════════════════════════════════════════════╝ */}
      <div
        style={{
          height: HEADER_H,
          flexShrink: 0,
          background: 'linear-gradient(180deg, #141414 0%, #0c0c0c 100%)',
          borderBottom: '1px solid #1f1f1f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 16,
          paddingRight: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.8)',
        }}
      >
        {/* Left: game name + period */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#f59e0b',
            }}
          >
            {periodLabel}
          </span>
          <div style={{ width: 1, height: 16, background: '#2a2a2a' }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#3f3f46',
            }}
          >
            {settings.gameName || 'LIVE MATCH'}
          </span>
        </div>

        {/* Center: THE BOX branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: '0.25em',
              color: '#27272a',
              textTransform: 'uppercase',
            }}
          >
            THE BOX
          </span>
        </div>

        {/* Right: status LEDs + pending */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {offlineQueue.length > 0 && (
            <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.1em' }}>
              {offlineQueue.length} PENDING
            </span>
          )}
          {/* Network LED */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isOnline ? '#22c55e' : '#ef4444',
              boxShadow: `0 0 6px ${isOnline ? '#22c55e' : '#ef4444'}`,
            }}
          />
          {/* Clock running LED */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isRunning ? '#22c55e' : '#27272a',
              boxShadow: isRunning ? '0 0 6px #22c55e' : 'none',
              transition: 'all 0.3s',
            }}
          />
        </div>
      </div>

      {/* ╔═══════════════════════════════════════════════════╗
          ║  MAIN BODY                                        ║
          ╚═══════════════════════════════════════════════════╝ */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          gap: 0,
        }}
      >

        {/* ┌─────────────────────────────────────────────────┐
            │  TEAM A — LEFT PANEL                            │
            └─────────────────────────────────────────────────┘ */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #1a1a1a',
            background: `linear-gradient(160deg, ${colorA}06 0%, transparent 60%)`,
            overflow: 'hidden',
          }}
        >
          {/* Team name bar */}
          <div
            style={{
              height: 36,
              flexShrink: 0,
              borderBottom: `1px solid ${colorA}25`,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 14,
              paddingRight: 14,
              justifyContent: 'space-between',
              background: `linear-gradient(90deg, ${colorA}12 0%, transparent 70%)`,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: colorA,
                textShadow: `0 0 20px ${colorA}40`,
              }}
            >
              {teamA.name}
            </span>
            {/* Possession indicator arrow */}
            {posA && (
              <div
                style={{
                  fontSize: 14,
                  color: colorA,
                  fontWeight: 900,
                  textShadow: `0 0 10px ${colorA}`,
                  animation: 'none',
                }}
              >
                ◀
              </div>
            )}
          </div>

          {/* Score */}
          <div
            style={{
              flexShrink: 0,
              height: '30%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: flashA ? `${colorA}10` : 'transparent',
              transition: 'background 0.15s',
              borderBottom: '1px solid #111',
            }}
          >
            <span
              style={{
                fontSize: 'clamp(4.5rem, 11vw, 8.5rem)',
                fontWeight: 900,
                lineHeight: 1,
                color: flashA ? '#ffffff' : colorA,
                textShadow: flashA
                  ? `0 0 60px ${colorA}, 0 0 20px ${colorA}`
                  : `0 0 30px ${colorA}50`,
                transition: 'color 0.12s, text-shadow 0.12s',
                // 7-segment phosphor feel
                fontFamily: "'Courier New', 'DM Mono', monospace",
                letterSpacing: '-0.02em',
              }}
            >
              {teamA.score}
            </span>
          </div>

          {/* Scoring buttons +1 +2 +3 */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '8px 10px',
              gap: 8,
            }}
          >
            {/* Score row */}
            <div style={{ display: 'flex', gap: 8, flex: 1 }}>
              <ScoreBtn pts={1} color={colorA} onPress={() => score('A', 1)} />
              <ScoreBtn pts={2} color={colorA} onPress={() => score('A', 2)} />
              <ScoreBtn pts={3} color={colorA} onPress={() => score('A', 3)} />
            </div>

            {/* Stats row — fouls + timeouts */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                padding: '6px 8px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 8,
                border: '1px solid #1a1a1a',
                flexShrink: 0,
              }}
            >
              <FoulLEDs count={teamA.fouls} color={colorA} />
              <div style={{ width: 1, height: 40, background: '#1f1f1f' }} />
              <TimeoutDots remaining={teamA.timeouts} total={2} color={colorA} />
            </div>

            {/* Action row — correction, foul, timeout */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <ActionBtn
                label="−1"
                sub="CORRECT"
                color="#52525b"
                onPress={() => { onAction('A', 'points', -1); vibrate(40); }}
              />
              <ActionBtn
                label="FOUL"
                sub="CALL"
                color="#f97316"
                bg="#1c0f00"
                onPress={() => foul('A')}
              />
              <ActionBtn
                label="T.OUT"
                sub="CALL"
                color={colorA}
                bg="#0a0a0f"
                onPress={() => timeout('A')}
              />
            </div>
          </div>
        </div>

        {/* ┌─────────────────────────────────────────────────┐
            │  CENTER — CLOCK SPINE                           │
            └─────────────────────────────────────────────────┘ */}
        <div
          style={{
            width: CENTER_W,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #1a1a1a',
            background: 'linear-gradient(180deg, #0e0e0e 0%, #090909 100%)',
          }}
        >
          {/* Clock label */}
          <div
            style={{
              height: 36,
              flexShrink: 0,
              borderBottom: '1px solid #151515',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.3em', color: '#27272a', textTransform: 'uppercase' }}>
              CONTROL
            </span>
          </div>

          {/* ── GAME CLOCK ── */}
          <div
            style={{
              flexShrink: 0,
              padding: '12px 14px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              borderBottom: '1px solid #151515',
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', color: '#3f3f46', marginBottom: 4, textTransform: 'uppercase' }}>
              GAME CLOCK
            </div>

            {/* Digital display */}
            <div
              style={{
                background: '#000',
                border: '2px solid #1a1a1a',
                borderRadius: 8,
                padding: '8px 14px',
                marginBottom: 8,
                width: '100%',
                textAlign: 'center',
                boxShadow: `inset 0 4px 16px rgba(0,0,0,0.9), 0 0 20px ${isRunning ? 'rgba(34,197,94,0.2)' : 'rgba(0,0,0,0.5)'}`,
                transition: 'box-shadow 0.4s',
              }}
            >
              <span
                style={{
                  fontSize: 'clamp(2.2rem, 5vw, 3.2rem)',
                  fontWeight: 900,
                  fontFamily: "'Courier New', monospace",
                  letterSpacing: '0.05em',
                  color: isRunning ? '#22c55e' : '#3f3f46',
                  textShadow: isRunning ? '0 0 20px rgba(34,197,94,0.8)' : 'none',
                  transition: 'color 0.3s, text-shadow 0.3s',
                }}
              >
                {fmt(gameState.gameTime.minutes, gameState.gameTime.seconds)}
              </span>
            </div>

            {/* START / STOP — the dominant button */}
            <button
              onPointerDown={() => { onToggleClock(); vibrate(60); }}
              style={{
                width: '100%',
                height: 56,
                borderRadius: 10,
                border: `2.5px solid ${isRunning ? '#ef4444' : '#22c55e'}`,
                background: isRunning
                  ? 'linear-gradient(160deg, #450a0a 0%, #2d0606 100%)'
                  : 'linear-gradient(160deg, #052e16 0%, #021a0e 100%)',
                color: isRunning ? '#fca5a5' : '#86efac',
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: isRunning
                  ? '0 0 20px rgba(239,68,68,0.25), inset 0 1px 0 rgba(255,255,255,0.05)'
                  : '0 0 20px rgba(34,197,94,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>{isRunning ? '⏸' : '▶'}</span>
              {isRunning ? 'STOP' : 'START'}
            </button>
          </div>

          {/* ── SHOT CLOCK ── */}
          <div
            style={{
              flexShrink: 0,
              padding: '10px 14px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              borderBottom: '1px solid #151515',
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', color: '#3f3f46', marginBottom: 6, textTransform: 'uppercase' }}>
              SHOT CLOCK
            </div>

            <div
              style={{
                background: '#000',
                border: `2px solid ${shotCritical ? '#ef444460' : '#1a1a1a'}`,
                borderRadius: 8,
                padding: '4px 14px',
                marginBottom: 8,
                width: '100%',
                textAlign: 'center',
                boxShadow: shotCritical
                  ? 'inset 0 4px 16px rgba(0,0,0,0.9), 0 0 16px rgba(239,68,68,0.3)'
                  : 'inset 0 4px 16px rgba(0,0,0,0.9)',
                transition: 'all 0.3s',
              }}
            >
              <span
                style={{
                  fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                  fontWeight: 900,
                  fontFamily: "'Courier New', monospace",
                  color: shotClock === 0
                    ? '#7f1d1d'
                    : shotCritical
                      ? '#ef4444'
                      : '#f59e0b',
                  textShadow: shotCritical ? '0 0 16px rgba(239,68,68,0.8)' : '0 0 8px rgba(245,158,11,0.4)',
                  transition: 'color 0.2s',
                }}
              >
                {shotClock}
              </span>
            </div>

            {/* Reset buttons */}
            <div style={{ display: 'flex', gap: 6, width: '100%' }}>
              {[24, 14].map((sec) => (
                <button
                  key={sec}
                  onPointerDown={() => { onResetShotClock(sec); vibrate(30); }}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 7,
                    background: '#111',
                    border: '1.5px solid #2a2a2a',
                    color: '#f59e0b',
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.5)',
                    transition: 'transform 0.08s',
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>

          {/* ── POSSESSION ── */}
          <div
            style={{
              flexShrink: 0,
              padding: '10px 14px',
              borderBottom: '1px solid #151515',
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', color: '#3f3f46', marginBottom: 6, textAlign: 'center', textTransform: 'uppercase' }}>
              POSSESSION
            </div>
            <button
              onPointerDown={() => { onTogglePossession(); vibrate(35); }}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 8,
                background: '#0d0d0d',
                border: '1.5px solid #222',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 10px',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.7)',
                transition: 'transform 0.08s',
              }}
            >
              {/* Team A side */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: posA ? colorA : '#1a1a1a',
                    boxShadow: posA ? `0 0 8px ${colorA}` : 'none',
                    transition: 'all 0.2s',
                    border: `1.5px solid ${posA ? colorA : '#2a2a2a'}`,
                  }}
                />
                <span style={{ fontSize: 9, fontWeight: 700, color: posA ? colorA : '#3f3f46', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {teamA.name.slice(0, 6)}
                </span>
              </div>

              <span style={{ fontSize: 11, color: '#27272a', fontWeight: 900 }}>⇄</span>

              {/* Team B side */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: 'row-reverse' }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: !posA ? colorB : '#1a1a1a',
                    boxShadow: !posA ? `0 0 8px ${colorB}` : 'none',
                    transition: 'all 0.2s',
                    border: `1.5px solid ${!posA ? colorB : '#2a2a2a'}`,
                  }}
                />
                <span style={{ fontSize: 9, fontWeight: 700, color: !posA ? colorB : '#3f3f46', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {teamB.name.slice(0, 6)}
                </span>
              </div>
            </button>
          </div>

          {/* ── PERIOD INFO ── */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 14px',
              gap: 8,
            }}
          >
            <div
              style={{
                background: '#000',
                border: '1px solid #1f1f1f',
                borderRadius: 8,
                width: '100%',
                padding: '6px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <div style={{ fontSize: 9, color: '#3f3f46', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>PERIOD</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#f59e0b', fontFamily: "'Courier New', monospace", lineHeight: 1 }}>
                {period}
              </div>
            </div>

            {/* Score diff */}
            <div style={{ fontSize: 10, color: '#27272a', fontWeight: 700, letterSpacing: '0.1em' }}>
              {teamA.score === teamB.score
                ? 'TIED'
                : Math.abs(teamA.score - teamB.score) + (teamA.score > teamB.score ? ` — ${teamA.name.slice(0, 4)} LEAD` : ` — ${teamB.name.slice(0, 4)} LEAD`)}
            </div>
          </div>
        </div>

        {/* ┌─────────────────────────────────────────────────┐
            │  TEAM B — RIGHT PANEL                           │
            └─────────────────────────────────────────────────┘ */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: `linear-gradient(200deg, ${colorB}06 0%, transparent 60%)`,
            overflow: 'hidden',
          }}
        >
          {/* Team name bar */}
          <div
            style={{
              height: 36,
              flexShrink: 0,
              borderBottom: `1px solid ${colorB}25`,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 14,
              paddingRight: 14,
              justifyContent: 'space-between',
              background: `linear-gradient(270deg, ${colorB}12 0%, transparent 70%)`,
            }}
          >
            {/* Possession indicator */}
            {!posA && (
              <div style={{ fontSize: 14, color: colorB, fontWeight: 900, textShadow: `0 0 10px ${colorB}` }}>
                ▶
              </div>
            )}
            {posA && <div />}
            <span
              style={{
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: colorB,
                textShadow: `0 0 20px ${colorB}40`,
              }}
            >
              {teamB.name}
            </span>
          </div>

          {/* Score */}
          <div
            style={{
              flexShrink: 0,
              height: '30%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: flashB ? `${colorB}10` : 'transparent',
              transition: 'background 0.15s',
              borderBottom: '1px solid #111',
            }}
          >
            <span
              style={{
                fontSize: 'clamp(4.5rem, 11vw, 8.5rem)',
                fontWeight: 900,
                lineHeight: 1,
                color: flashB ? '#ffffff' : colorB,
                textShadow: flashB
                  ? `0 0 60px ${colorB}, 0 0 20px ${colorB}`
                  : `0 0 30px ${colorB}50`,
                transition: 'color 0.12s, text-shadow 0.12s',
                fontFamily: "'Courier New', 'DM Mono', monospace",
                letterSpacing: '-0.02em',
              }}
            >
              {teamB.score}
            </span>
          </div>

          {/* Scoring + controls */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '8px 10px',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 8, flex: 1 }}>
              <ScoreBtn pts={1} color={colorB} onPress={() => score('B', 1)} />
              <ScoreBtn pts={2} color={colorB} onPress={() => score('B', 2)} />
              <ScoreBtn pts={3} color={colorB} onPress={() => score('B', 3)} />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                padding: '6px 8px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 8,
                border: '1px solid #1a1a1a',
                flexShrink: 0,
              }}
            >
              <FoulLEDs count={teamB.fouls} color={colorB} />
              <div style={{ width: 1, height: 40, background: '#1f1f1f' }} />
              <TimeoutDots remaining={teamB.timeouts} total={2} color={colorB} />
            </div>

            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <ActionBtn
                label="−1"
                sub="CORRECT"
                color="#52525b"
                onPress={() => { onAction('B', 'points', -1); vibrate(40); }}
              />
              <ActionBtn
                label="FOUL"
                sub="CALL"
                color="#f97316"
                bg="#1c0f00"
                onPress={() => foul('B')}
              />
              <ActionBtn
                label="T.OUT"
                sub="CALL"
                color={colorB}
                bg="#0a0a0f"
                onPress={() => timeout('B')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ╔═══════════════════════════════════════════════════╗
          ║  FOOTER BAR                                       ║
          ╚═══════════════════════════════════════════════════╝ */}
      <div
        style={{
          height: FOOTER_H,
          flexShrink: 0,
          borderTop: '1px solid #141414',
          background: 'linear-gradient(0deg, #0a0a0a 0%, #111 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 14,
          paddingRight: 14,
          gap: 8,
        }}
      >
        {/* Left: undo / redo */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onPointerDown={() => { onUndo(); vibrate([40, 20, 40]); }}
            disabled={!canUndo}
            style={{
              height: 30,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 6,
              background: canUndo ? '#141414' : '#0a0a0a',
              border: `1.5px solid ${canUndo ? '#2a2a2a' : '#141414'}`,
              color: canUndo ? '#71717a' : '#27272a',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: canUndo ? 'pointer' : 'default',
              WebkitTapHighlightColor: 'transparent',
              transition: 'all 0.15s',
            }}
          >
            ↩ UNDO
          </button>
          <button
            onPointerDown={() => { onRedo(); vibrate([40, 20, 40]); }}
            disabled={!canRedo}
            style={{
              height: 30,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 6,
              background: canRedo ? '#141414' : '#0a0a0a',
              border: `1.5px solid ${canRedo ? '#2a2a2a' : '#141414'}`,
              color: canRedo ? '#71717a' : '#27272a',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: canRedo ? 'pointer' : 'default',
              WebkitTapHighlightColor: 'transparent',
              transition: 'all 0.15s',
            }}
          >
            REDO ↪
          </button>
        </div>

        {/* Center: next period */}
        <button
          onPointerDown={() => { onNextPeriod(); }}
          style={{
            height: 32,
            paddingLeft: 20,
            paddingRight: 20,
            borderRadius: 7,
            background: '#141414',
            border: '1.5px solid #f59e0b30',
            color: '#f59e0b',
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            boxShadow: '0 0 10px rgba(245,158,11,0.1)',
          }}
        >
          NEXT PERIOD →
        </button>

        {/* Right: diagnostics */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#27272a', letterSpacing: '0.1em' }}>
            v6.0
          </span>
          <button
            onPointerDown={onOpenDiagnostics}
            style={{
              height: 30,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 6,
              background: '#0d0d0d',
              border: '1.5px solid #1f1f1f',
              color: '#3f3f46',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ⋮ DIAG
          </button>
        </div>
      </div>
    </div>
  );
};