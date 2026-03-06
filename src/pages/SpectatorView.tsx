// src/pages/SpectatorView.tsx
//
// CHANGE: Added subscribeToGameBroadcast subscription.
// Live score (teamA.score, teamB.score, fouls, timeouts, possession) now
// overrides the stale Firestore snapshot for online games, matching the
// same pattern already used for the clock. Zero UI changes.

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeToGame } from '../services/supabaseGameService';
import { getLocalGame } from '../services/localGameService';
import { useSupabaseBroadcast } from '../hooks/useSupabaseBroadcast';
import { subscribeToGameBroadcast } from '../services/supabaseBroadcastService';
import { type BasketballGame } from '../types';
import { SPORT_REGISTRY, isSportSupported } from '../sports/registry';

// ─── UTILITY ─────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

const getPeriodLabel = (period: number) =>
  period <= 4 ? `Q${period}` : `OT${period - 4}`;

const getFullPeriodLabel = (period: number) =>
  period <= 4 ? `QUARTER ${period}` : `OVERTIME ${period - 4}`;

// ─── ANIMATED DIGIT (FLIP-STYLE) ─────────────────────────────────────────────

const FlipDigit: React.FC<{ value: string; color?: string }> = ({ value, color = '#FFFFFF' }) => {
  const [display, setDisplay] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (value !== prev.current) {
      setFlipping(true);
      const t = setTimeout(() => {
        setDisplay(value);
        setFlipping(false);
        prev.current = value;
      }, 100);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span
      style={{
        color,
        display: 'inline-block',
        transition: 'transform 0.1s ease, opacity 0.1s ease',
        transform: flipping ? 'scaleY(0.3)' : 'scaleY(1)',
        opacity: flipping ? 0.3 : 1,
      }}
    >
      {display}
    </span>
  );
};

// ─── SCORE DISPLAY ───────────────────────────────────────────────────────────

const ScoreDisplay: React.FC<{
  score: number;
  color: string;
  hasPossession: boolean;
}> = ({ score, color, hasPossession }) => {
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
        <div
          style={{
            position: 'absolute',
            inset: '-20%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
            animation: 'burstFade 0.8s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: '"Oswald", "Barlow Condensed", "Arial Narrow", sans-serif',
          fontWeight: 900,
          fontSize: 'clamp(10rem, 18vw, 22rem)',
          lineHeight: 0.9,
          letterSpacing: '-0.02em',
          color: '#FFFFFF',
          textShadow: pulse
            ? `0 0 80px ${color}, 0 0 40px ${color}99, 0 0 160px ${color}33`
            : `0 0 40px ${color}33`,
          transition: 'text-shadow 0.3s ease',
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"tnum"',
        }}
      >
        {pad(score)}
      </div>

      {hasPossession && (
        <div
          style={{
            position: 'absolute',
            bottom: '-2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '1.2rem solid transparent',
            borderRight: '1.2rem solid transparent',
            borderBottom: `2rem solid ${color}`,
            filter: `drop-shadow(0 0 12px ${color})`,
            animation: 'possessionBlink 1.2s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
};

// ─── CLOCK DISPLAY ───────────────────────────────────────────────────────────

const ClockDisplay: React.FC<{
  minutes: number;
  seconds: number;
  tenths?: number;
  running: boolean;
}> = ({ minutes, seconds, tenths, running }) => {
  const isLow = minutes === 0 && seconds <= 30;
  const isCritical = minutes === 0 && seconds <= 10;
  const showTenths = minutes === 0 && tenths !== undefined;
  const timeStr = showTenths
    ? `${seconds}.${tenths}`
    : `${pad(minutes)}:${pad(seconds)}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'clamp(0.3rem, 0.5vw, 0.8rem)',
      }}
    >
      <div
        style={{
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 400,
          fontSize: 'clamp(0.7rem, 1.2vw, 1.4rem)',
          letterSpacing: '0.3em',
          color: isCritical ? '#FF6060' : '#666666',
        }}
      >
        GAME CLOCK
      </div>
      <div
        style={{
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 900,
          fontSize: 'clamp(5rem, 9vw, 12rem)',
          lineHeight: 1,
          color: isCritical ? '#FF3030' : isLow ? '#FF8C00' : '#FFFFFF',
          textShadow: isCritical
            ? '0 0 40px #FF3030'
            : isLow
              ? '0 0 30px #FF8C0066'
              : '0 0 20px rgba(255,255,255,0.1)',
          fontVariantNumeric: 'tabular-nums',
          animation: running && isCritical ? 'clockPulse 0.5s ease-in-out infinite alternate' : 'none',
        }}
      >
        {timeStr}
      </div>
      <span
        style={{
          fontSize: 'clamp(0.55rem, 0.9vw, 1rem)',
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: running ? '#00FF88' : '#FF4444',
          opacity: 0.9,
        }}
      >
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
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: isCritical
          ? 'linear-gradient(135deg, #3A0000 0%, #200000 100%)'
          : 'linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)',
        border: `2px solid ${isCritical ? '#FF3030' : isWarning ? '#FF8C00' : '#333333'}`,
        borderRadius: '1.2rem',
        padding: 'clamp(0.8rem, 1.5vw, 2rem) clamp(1.5rem, 3vw, 4rem)',
        boxShadow: isCritical
          ? '0 0 40px #FF303066, inset 0 0 20px #FF303011'
          : '0 0 20px rgba(0,0,0,0.5)',
        transition: 'all 0.3s ease',
        animation: isCritical ? 'criticalFlash 0.3s ease-in-out infinite alternate' : 'none',
      }}
    >
      <span
        style={{
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 400,
          fontSize: 'clamp(0.7rem, 1.2vw, 1.4rem)',
          letterSpacing: '0.3em',
          color: isCritical ? '#FF6060' : '#888888',
          marginBottom: '0.3rem',
        }}
      >
        SHOT CLOCK
      </span>
      <span
        style={{
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 900,
          fontSize: 'clamp(3.5rem, 7vw, 8rem)',
          lineHeight: 1,
          color: isCritical ? '#FF3030' : isWarning ? '#FF8C00' : '#FFFFFF',
          textShadow: isCritical ? '0 0 30px #FF3030' : isWarning ? '0 0 20px #FF8C00' : 'none',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {pad(value)}
      </span>
    </div>
  );
};

// ─── TEAM PANEL ──────────────────────────────────────────────────────────────

const TeamPanel: React.FC<{
  name: string;
  score: number;
  fouls: number;
  timeouts: number;
  color: string;
  hasPossession: boolean;
  side: 'left' | 'right';
  players?: Array<{ name: string; number: string; points: number; fouls: number }>;
}> = ({ name, score, fouls, timeouts, color, hasPossession, side, players = [] }) => {
  const topPlayers = [...players]
    .filter(p => p.name)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: side === 'left' ? 'flex-start' : 'flex-end',
        justifyContent: 'center',
        padding: 'clamp(2rem, 4vw, 6rem)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          [side === 'left' ? 'left' : 'right']: 0,
          width: '60%',
          height: '100%',
          background: `radial-gradient(ellipse at ${side === 'left' ? '0%' : '100%'} 50%, ${color}0D 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Team color stripe */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          [side === 'left' ? 'left' : 'right']: 0,
          width: '6px',
          height: '100%',
          background: `linear-gradient(to bottom, transparent, ${color}, transparent)`,
        }}
      />

      {/* Team name */}
      <div
        style={{
          fontFamily: '"Oswald", "Barlow Condensed", sans-serif',
          fontWeight: 700,
          fontSize: 'clamp(2rem, 4.5vw, 5.5rem)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color,
          textShadow: `0 0 30px ${color}55`,
          textAlign: side === 'left' ? 'left' : 'right',
          marginBottom: 'clamp(0.5rem, 1vw, 1.5rem)',
          lineHeight: 1.1,
          maxWidth: '90%',
        }}
      >
        {name}
      </div>

      {/* Score */}
      <div style={{ textAlign: side === 'left' ? 'left' : 'right' }}>
        <ScoreDisplay score={score} color={color} hasPossession={hasPossession} />
      </div>

      {/* Fouls & Timeouts */}
      <div
        style={{
          display: 'flex',
          gap: 'clamp(1.5rem, 2.5vw, 3.5rem)',
          marginTop: 'clamp(1.5rem, 2.5vw, 3.5rem)',
          flexDirection: side === 'left' ? 'row' : 'row-reverse',
        }}
      >
        {/* Fouls */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: '"Oswald", sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(0.6rem, 1vw, 1.1rem)',
              letterSpacing: '0.25em',
              color: '#666666',
              marginBottom: '0.4rem',
            }}
          >
            FOULS
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: 'clamp(0.8rem, 1.2vw, 1.6rem)',
                  height: 'clamp(0.8rem, 1.2vw, 1.6rem)',
                  borderRadius: '50%',
                  background: i < fouls ? '#FF8C00' : 'transparent',
                  border: `2px solid ${i < fouls ? '#FF8C00' : '#333333'}`,
                  boxShadow: i < fouls ? '0 0 8px #FF8C0066' : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* Timeouts */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: '"Oswald", sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(0.6rem, 1vw, 1.1rem)',
              letterSpacing: '0.25em',
              color: '#666666',
              marginBottom: '0.4rem',
            }}
          >
            T.O.
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: 'clamp(0.6rem, 1vw, 1.3rem)',
                  height: 'clamp(0.6rem, 1vw, 1.3rem)',
                  borderRadius: '2px',
                  background: i < timeouts ? color : 'transparent',
                  border: `2px solid ${i < timeouts ? color : '#333333'}`,
                  opacity: i < timeouts ? 0.9 : 0.3,
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Top players */}
      {topPlayers.length > 0 && (
        <div
          style={{
            marginTop: 'clamp(1rem, 2vw, 3rem)',
            width: '100%',
            maxWidth: '90%',
          }}
        >
          <div
            style={{
              fontFamily: '"Oswald", sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(0.55rem, 0.85vw, 1rem)',
              letterSpacing: '0.25em',
              color: '#444444',
              marginBottom: '0.6rem',
              textAlign: side === 'left' ? 'left' : 'right',
            }}
          >
            SCORERS
          </div>
          {topPlayers.map((player, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
                marginBottom: '0.3rem',
                flexDirection: side === 'left' ? 'row' : 'row-reverse',
              }}
            >
              {side === 'left' ? (
                <>
                  <span
                    style={{
                      fontFamily: '"Oswald", sans-serif',
                      fontWeight: 700,
                      fontSize: 'clamp(0.8rem, 1.3vw, 1.5rem)',
                      color: '#555555',
                      minWidth: '2rem',
                    }}
                  >
                    #{player.number}
                  </span>
                  <span
                    style={{
                      fontFamily: '"Oswald", sans-serif',
                      fontWeight: 400,
                      fontSize: 'clamp(0.8rem, 1.3vw, 1.5rem)',
                      color: '#CCCCCC',
                      flex: 1,
                    }}
                  >
                    {player.name}
                  </span>
                  <span
                    style={{
                      fontFamily: '"Oswald", sans-serif',
                      fontWeight: 700,
                      fontSize: 'clamp(1rem, 1.6vw, 1.8rem)',
                      color: player.points > 0 ? color : '#333333',
                    }}
                  >
                    {player.points}
                  </span>
                </>
              ) : (
                <>
                  <span
                    style={{
                      fontFamily: '"Oswald", sans-serif',
                      fontWeight: 700,
                      fontSize: 'clamp(1rem, 1.6vw, 1.8rem)',
                      color: player.points > 0 ? color : '#333333',
                    }}
                  >
                    {player.points}
                  </span>
                  <span
                    style={{
                      fontFamily: '"Oswald", sans-serif',
                      fontWeight: 400,
                      fontSize: 'clamp(0.8rem, 1.3vw, 1.5rem)',
                      color: '#CCCCCC',
                      flex: 1,
                      textAlign: 'right',
                    }}
                  >
                    {player.name}
                  </span>
                  <span
                    style={{
                      fontFamily: '"Oswald", sans-serif',
                      fontWeight: 700,
                      fontSize: 'clamp(0.8rem, 1.3vw, 1.5rem)',
                      color: '#555555',
                      minWidth: '2rem',
                      textAlign: 'right',
                    }}
                  >
                    #{player.number}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── CENTER COLUMN ────────────────────────────────────────────────────────────

const CenterPanel: React.FC<{ game: BasketballGame }> = ({ game }) => {
  const { gameTime, period, gameRunning, shotClock } = game.gameState;
  const scoreDiff = Math.abs(game.teamA.score - game.teamB.score);
  const leader = game.teamA.score > game.teamB.score ? 'A' : game.teamB.score > game.teamA.score ? 'B' : null;

  return (
    <div
      style={{
        width: 'clamp(280px, 28vw, 480px)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'clamp(1rem, 2vw, 3rem)',
        padding: 'clamp(1rem, 2vw, 3rem) 0',
      }}
    >
      {/* Period */}
      <div
        style={{
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 700,
          fontSize: 'clamp(1.2rem, 2.5vw, 3rem)',
          letterSpacing: '0.25em',
          color: '#FFFFFF',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #1A1A1A 0%, #111111 100%)',
          border: '1px solid #2A2A2A',
          borderRadius: '0.8rem',
          padding: 'clamp(0.4rem, 0.8vw, 1rem) clamp(1rem, 2vw, 2.5rem)',
        }}
      >
        {getFullPeriodLabel(period)}
      </div>

      {/* Clock */}
      <ClockDisplay
        minutes={gameTime.minutes}
        seconds={gameTime.seconds}
        tenths={gameTime.tenths}
        running={gameRunning}
      />

      {/* Shot clock */}
      <ShotClock value={shotClock} />

      {/* Lead indicator */}
      {scoreDiff > 0 && leader && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: '"Oswald", sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(0.55rem, 0.85vw, 1rem)',
              letterSpacing: '0.2em',
              color: '#444444',
              marginBottom: '0.3rem',
            }}
          >
            LEAD
          </div>
          <div
            style={{
              fontFamily: '"Oswald", sans-serif',
              fontWeight: 900,
              fontSize: 'clamp(2rem, 4vw, 5rem)',
              color: leader === 'A' ? game.teamA.color : game.teamB.color,
              lineHeight: 1,
            }}
          >
            +{scoreDiff}
          </div>
        </div>
      )}

      {/* Game title */}
      <div
        style={{
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 400,
          fontSize: 'clamp(0.55rem, 0.85vw, 1rem)',
          letterSpacing: '0.2em',
          color: '#2A2A2A',
          textTransform: 'uppercase',
          textAlign: 'center',
          maxWidth: '100%',
          wordBreak: 'break-word',
        }}
      >
        {game.settings?.gameName || 'BASKETBALL'}
      </div>
    </div>
  );
};

// ─── HEADER ──────────────────────────────────────────────────────────────────

const Header: React.FC<{ gameName: string; period: number }> = ({ gameName, period }) => (
  <div
    style={{
      height: 'clamp(3rem, 5vh, 5rem)',
      background: '#050505',
      borderBottom: '1px solid #1A1A1A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 clamp(1.5rem, 3vw, 4rem)',
      flexShrink: 0,
      zIndex: 10,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div
        style={{
          width: 'clamp(0.5rem, 0.8vw, 1rem)',
          height: 'clamp(0.5rem, 0.8vw, 1rem)',
          borderRadius: '50%',
          background: '#FF3030',
          boxShadow: '0 0 8px #FF3030',
          animation: 'ledPulse 1s ease-in-out infinite alternate',
        }}
      />
      <span
        style={{
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 400,
          fontSize: 'clamp(0.6rem, 1vw, 1.2rem)',
          letterSpacing: '0.3em',
          color: '#FF3030',
        }}
      >
        LIVE
      </span>
    </div>

    <div
      style={{
        fontFamily: '"Oswald", sans-serif',
        fontWeight: 700,
        fontSize: 'clamp(0.8rem, 1.4vw, 1.8rem)',
        letterSpacing: '0.3em',
        color: '#FFFFFF',
        textTransform: 'uppercase',
      }}
    >
      {gameName}
    </div>

    <div
      style={{
        fontFamily: '"Oswald", sans-serif',
        fontWeight: 400,
        fontSize: 'clamp(0.6rem, 1vw, 1.2rem)',
        letterSpacing: '0.2em',
        color: '#444444',
      }}
    >
      {getPeriodLabel(period)}
    </div>
  </div>
);

// ─── TICKER BAR ──────────────────────────────────────────────────────────────

const TickerBar: React.FC<{ game: BasketballGame }> = ({ game }) => {
  const { period, gameRunning, gameTime } = game.gameState;
  const diff = game.teamA.score - game.teamB.score;
  const diffStr =
    diff > 0
      ? `${game.teamA.name} leads by +${diff}`
      : diff < 0
        ? `${game.teamB.name} leads by +${Math.abs(diff)}`
        : 'GAME IS TIED';

  const items = [
    `🏀 ${game.settings?.gameName || 'BASKETBALL'}`,
    `${getPeriodLabel(period)} — ${pad(gameTime.minutes)}:${pad(gameTime.seconds)}`,
    diffStr,
    `${game.teamA.name.toUpperCase()}  ${pad(game.teamA.score)}  :  ${pad(game.teamB.score)}  ${game.teamB.name.toUpperCase()}`,
    `FOULS — ${game.teamA.name}: ${game.teamA.fouls}  |  ${game.teamB.name}: ${game.teamB.fouls}`,
    `TIMEOUTS — ${game.teamA.name}: ${game.teamA.timeouts}  |  ${game.teamB.name}: ${game.teamB.timeouts}`,
    gameRunning ? '▶ CLOCK RUNNING' : '⏸ CLOCK STOPPED',
  ];

  const repeated = [...items, ...items];

  return (
    <div
      style={{
        height: 'clamp(2rem, 3.5vh, 3.5rem)',
        background: '#050505',
        borderTop: '1px solid #1A1A1A',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          background: '#FF3030',
          height: '100%',
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: '"Oswald", sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(0.6rem, 1vw, 1rem)',
            letterSpacing: '0.2em',
            color: '#FFFFFF',
          }}
        >
          LIVE
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            gap: 'clamp(2rem, 4vw, 6rem)',
            animation: 'ticker 30s linear infinite',
            whiteSpace: 'nowrap',
          }}
        >
          {repeated.map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: '"Oswald", sans-serif',
                fontWeight: 400,
                fontSize: 'clamp(0.6rem, 1vw, 1.1rem)',
                letterSpacing: '0.15em',
                color: '#555555',
                flexShrink: 0,
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── LOADING / ERROR STATES ───────────────────────────────────────────────────

const LoadingScreen = () => (
  <div
    style={{
      minHeight: '100vh',
      background: '#000000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '3rem',
      fontFamily: '"Oswald", sans-serif',
    }}
  >
    <div style={{ position: 'relative', width: '8rem', height: '8rem' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: '3px solid #1A1A1A',
          borderTopColor: '#FF3030',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '1.5rem',
          border: '2px solid #1A1A1A',
          borderTopColor: '#FF3030',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite reverse',
          opacity: 0.5,
        }}
      />
    </div>
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: '3rem',
          fontWeight: 700,
          letterSpacing: '0.4em',
          color: '#333333',
          animation: 'breathe 2s ease-in-out infinite',
        }}
      >
        CONNECTING
      </div>
      <div
        style={{
          fontSize: '1.2rem',
          fontWeight: 400,
          letterSpacing: '0.2em',
          color: '#1A1A1A',
          marginTop: '0.5rem',
        }}
      >
        ESTABLISHING LIVE FEED
      </div>
    </div>
  </div>
);

const ErrorScreen: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      minHeight: '100vh',
      background: '#000000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2rem',
      fontFamily: '"Oswald", sans-serif',
      textAlign: 'center',
      padding: '4rem',
    }}
  >
    <div style={{ fontSize: '6rem', fontWeight: 900, letterSpacing: '0.1em', color: '#1A1A1A' }}>
      NO SIGNAL
    </div>
    <div style={{ fontSize: '1.4rem', fontWeight: 400, letterSpacing: '0.2em', color: '#333333' }}>
      {message}
    </div>
  </div>
);

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { width: 100%; height: 100%; background: #000000; overflow: hidden; }

    @keyframes burstFade {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(2.5); opacity: 0; }
    }
    @keyframes ledPulse { from { opacity: 0.6; } to { opacity: 1; } }
    @keyframes possessionBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    @keyframes clockPulse { from { transform: scale(1); } to { transform: scale(1.015); } }
    @keyframes criticalFlash {
      from { border-color: #FF303066; }
      to { border-color: #FF3030; box-shadow: 0 0 60px #FF303099; }
    }
    @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes breathe { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }
  `}</style>
);

// ─── MAIN SPECTATOR VIEW ─────────────────────────────────────────────────────

interface SpectatorViewProps {
  gameCode?: string;
}

export const SpectatorView: React.FC<SpectatorViewProps> = ({ gameCode: propGameCode }) => {
  const { gameCode: routeGameCode } = useParams<{ gameCode: string }>();
  const gameCode = propGameCode || routeGameCode;

  const navigate = useNavigate();
  const [game, setGame] = useState<BasketballGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isLocalGame = gameCode?.startsWith('LOCAL-');

  // Live score state — updated instantly via broadcast, DB is the fallback
  const [liveScore, setLiveScore] = useState<{
    scoreA: number; scoreB: number;
    foulsA: number; foulsB: number;
    timeoutsA: number; timeoutsB: number;
    possession: 'A' | 'B';
    fromBroadcast: boolean;
  } | null>(null);
  const liveScoreRef = useRef<typeof liveScore>(null);

  const rtdbTimer = useSupabaseBroadcast({
    gameCode: gameCode || '',
    isHost: false,
    periodDuration: game?.settings?.periodDuration || 10,
    shotClockDuration: game?.settings?.shotClockDuration || 24,
  });

  // Firestore subscription (cold data — names, colors, rosters)
  useEffect(() => {
    if (!gameCode) {
      setError('No game code provided');
      setLoading(false);
      return;
    }

    if (isLocalGame) {
      const loadGame = () => {
        const metadata = getLocalGame(gameCode);
        if (metadata && metadata.game) {
          setGame(metadata.game);
          setLoading(false);
          setError(null);
        } else if (loading) {
          setError('Game not found');
          setLoading(false);
        }
      };
      loadGame();
      const interval = setInterval(loadGame, 1000);
      return () => clearInterval(interval);
    } else {
      const unsubscribe = subscribeToGame(gameCode, (gameData) => {
        if (gameData) {
          setGame(gameData);
          setLoading(false);
          setError(null);
        } else {
          setError('Game not found');
          setLoading(false);
        }
      });
      return () => unsubscribe();
    }
  }, [gameCode, isLocalGame, loading]);

  // ── Instant score updates via broadcast (fixes Team B never updating) ─────
  useEffect(() => {
    if (!gameCode || isLocalGame) return;

    const unsub = subscribeToGameBroadcast(gameCode, {
      onScoreUpdate: (payload) => {
        const updated = {
          scoreA: payload.teamA,
          scoreB: payload.teamB,
          foulsA: payload.foulsA,
          foulsB: payload.foulsB,
          timeoutsA: payload.timeoutsA,
          timeoutsB: payload.timeoutsB,
          possession: payload.possession,
          fromBroadcast: true,
        };
        liveScoreRef.current = updated;
        setLiveScore(updated);
      },
      onGameSnapshot: (payload) => {
        const updated = {
          scoreA: payload.score.teamA,
          scoreB: payload.score.teamB,
          foulsA: payload.score.foulsA,
          foulsB: payload.score.foulsB,
          timeoutsA: payload.score.timeoutsA,
          timeoutsB: payload.score.timeoutsB,
          possession: payload.score.possession,
          fromBroadcast: true,
        };
        liveScoreRef.current = updated;
        setLiveScore(updated);
      },
    });
    return unsub;
  }, [gameCode, isLocalGame]);

  // Merge logic:
  // - Clock fields: From fast Delta-Time engine (useSupabaseBroadcast)
  // - Game State: Map the new engine state over the legacy team schema
  const activeGame = game ? {
    ...game,
    teamA: {
      ...game.teamA,
      score: liveScore?.scoreA ?? (game as any).state?.scoreA ?? game.teamA?.score ?? 0,
      fouls: liveScore?.foulsA ?? (game as any).state?.foulsA ?? game.teamA?.fouls ?? 0,
      timeouts: liveScore?.timeoutsA ?? (game as any).state?.timeoutsA ?? game.teamA?.timeouts ?? 0,
    },
    teamB: {
      ...game.teamB,
      score: liveScore?.scoreB ?? (game as any).state?.scoreB ?? game.teamB?.score ?? 0,
      fouls: liveScore?.foulsB ?? (game as any).state?.foulsB ?? game.teamB?.fouls ?? 0,
      timeouts: liveScore?.timeoutsB ?? (game as any).state?.timeoutsB ?? game.teamB?.timeouts ?? 0,
    },
    gameState: {
      ...game.gameState,
      possession: liveScore?.possession ?? (game as any).state?.possession ?? game.gameState?.possession,
      gameTime: isLocalGame ? game.gameState.gameTime : {
        minutes: rtdbTimer.minutes,
        seconds: rtdbTimer.seconds,
        tenths: rtdbTimer.tenths,
      },
      period: isLocalGame ? game.gameState.period : rtdbTimer.period,
      gameRunning: isLocalGame ? game.gameState.gameRunning : rtdbTimer.gameRunning,
      shotClock: isLocalGame ? game.gameState.shotClock : rtdbTimer.shotClock,
    },
  } : null;

  if (loading) return (<><GlobalStyles /><LoadingScreen /></>);
  if (error || !activeGame) return (<><GlobalStyles /><ErrorScreen message={error || 'Game unavailable'} /></>);

  // --- BEGIN MULTI-SPORT INTERCEPTOR ---
  const currentSport = activeGame.sportId || 'basketball';

  if (currentSport !== 'basketball' && isSportSupported(currentSport)) {
    const DynamicSportView = SPORT_REGISTRY[currentSport].components.SpectatorView;
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000000', overflow: 'hidden' }}>
        <DynamicSportView state={(activeGame as any).state || (activeGame as any).gameState} />
      </div>
    );
  }
  // --- END MULTI-SPORT INTERCEPTOR ---

  return (
    <>
      <GlobalStyles />
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#000000',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Subtle scanline texture */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
            pointerEvents: 'none',
            zIndex: 100,
          }}
        />

        <Header gameName={activeGame.settings?.gameName || 'BASKETBALL'} period={activeGame.gameState.period} />

        <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', overflow: 'hidden', minHeight: 0 }}>
          <TeamPanel
            name={activeGame.teamA.name}
            score={activeGame.teamA.score}
            fouls={activeGame.teamA.fouls}
            timeouts={activeGame.teamA.timeouts}
            color={activeGame.teamA.color || '#DC2626'}
            hasPossession={activeGame.gameState.possession === 'A'}
            side="left"
            players={activeGame.teamA.players}
          />

          <div style={{ width: '1px', background: 'linear-gradient(to bottom, transparent 0%, #1E1E1E 20%, #1E1E1E 80%, transparent 100%)', flexShrink: 0 }} />

          <CenterPanel game={activeGame} />

          <div style={{ width: '1px', background: 'linear-gradient(to bottom, transparent 0%, #1E1E1E 20%, #1E1E1E 80%, transparent 100%)', flexShrink: 0 }} />

          <TeamPanel
            name={activeGame.teamB.name}
            score={activeGame.teamB.score}
            fouls={activeGame.teamB.fouls}
            timeouts={activeGame.teamB.timeouts}
            color={activeGame.teamB.color || '#2563EB'}
            hasPossession={activeGame.gameState.possession === 'B'}
            side="right"
            players={activeGame.teamB.players}
          />
        </div>

        <TickerBar game={activeGame} />
      </div>
    </>
  );
};

export default SpectatorView;