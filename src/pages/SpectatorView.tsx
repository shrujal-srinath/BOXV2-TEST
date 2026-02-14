import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeToGame } from '../services/gameService';
import { getLocalGame } from '../services/localGameService';
import { BasketballGame } from '../types';

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
      {/* Score glow burst on change */}
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

      {/* Possession triangle */}
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
  running: boolean;
}> = ({ minutes, seconds, running }) => {
  const isLow = minutes === 0 && seconds <= 30;
  const isCritical = minutes === 0 && seconds <= 10;

  const timeStr = `${pad(minutes)}:${pad(seconds)}`;

  return (
    <div style={{ textAlign: 'center', position: 'relative' }}>
      <div
        style={{
          fontFamily: '"Oswald", "Barlow Condensed", "Arial Narrow", sans-serif',
          fontWeight: 900,
          fontSize: 'clamp(7rem, 14vw, 16rem)',
          lineHeight: 1,
          letterSpacing: '0.05em',
          color: isCritical ? '#FF3030' : isLow ? '#FF8C00' : '#FFFFFF',
          textShadow: isCritical
            ? '0 0 60px #FF303088, 0 0 120px #FF303044'
            : isLow
              ? '0 0 40px #FF8C0066'
              : '0 0 30px rgba(255,255,255,0.15)',
          transition: 'color 0.5s ease, text-shadow 0.5s ease',
          animation: isCritical && running ? 'clockPulse 0.5s ease-in-out infinite alternate' : 'none',
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"tnum"',
        }}
      >
        {timeStr.split('').map((ch, i) => (
          <span key={i}>{ch}</span>
        ))}
      </div>

      {/* Running indicator */}
      <div
        style={{
          marginTop: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.8rem',
        }}
      >
        <div
          style={{
            width: '0.8rem',
            height: '0.8rem',
            borderRadius: '50%',
            background: running ? '#00FF88' : '#FF4444',
            boxShadow: running
              ? '0 0 12px #00FF88, 0 0 24px #00FF8866'
              : '0 0 12px #FF4444',
            animation: running ? 'ledPulse 1s ease-in-out infinite alternate' : 'none',
          }}
        />
        <span
          style={{
            fontFamily: '"Oswald", sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(0.9rem, 1.8vw, 2rem)',
            letterSpacing: '0.25em',
            color: running ? '#00FF88' : '#FF4444',
            opacity: 0.9,
          }}
        >
          {running ? 'LIVE' : 'PAUSED'}
        </span>
      </div>
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
                  boxShadow: i < fouls ? '0 0 8px #FF8C0088' : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
          <div
            style={{
              fontFamily: '"Oswald", sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(1.2rem, 2.5vw, 2.8rem)',
              color: fouls >= 4 ? '#FF4444' : '#FFFFFF',
              marginTop: '0.3rem',
              textShadow: fouls >= 4 ? '0 0 20px #FF4444' : 'none',
            }}
          >
            {fouls}
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
            TIMEOUTS
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: 'clamp(0.8rem, 1.2vw, 1.6rem)',
                  height: 'clamp(0.8rem, 1.2vw, 1.6rem)',
                  borderRadius: '2px',
                  background: i < timeouts ? color : 'transparent',
                  border: `2px solid ${i < timeouts ? color : '#333333'}`,
                  boxShadow: i < timeouts ? `0 0 8px ${color}88` : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
          <div
            style={{
              fontFamily: '"Oswald", sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(1.2rem, 2.5vw, 2.8rem)',
              color: '#FFFFFF',
              marginTop: '0.3rem',
            }}
          >
            {timeouts}
          </div>
        </div>
      </div>

      {/* Top scorers */}
      {topPlayers.length > 0 && (
        <div
          style={{
            marginTop: 'clamp(1.5rem, 2.5vw, 3.5rem)',
            width: '100%',
            maxWidth: '90%',
          }}
        >
          <div
            style={{
              fontFamily: '"Oswald", sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(0.55rem, 0.9vw, 1rem)',
              letterSpacing: '0.25em',
              color: '#444444',
              marginBottom: '0.6rem',
              textAlign: side === 'left' ? 'left' : 'right',
            }}
          >
            TOP SCORERS
          </div>
          {topPlayers.map((player, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: side === 'left' ? 'flex-start' : 'flex-end',
                gap: 'clamp(0.5rem, 0.8vw, 1rem)',
                padding: 'clamp(0.3rem, 0.5vw, 0.7rem) 0',
                borderBottom: idx < topPlayers.length - 1 ? '1px solid #1A1A1A' : 'none',
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

const CenterPanel: React.FC<{
  game: BasketballGame;
}> = ({ game }) => {
  const { gameTime, period, gameRunning, shotClock } = game.gameState;
  const scoreDiff = Math.abs(game.teamA.score - game.teamB.score);
  const leader = game.teamA.score > game.teamB.score ? 'A' : game.teamB.score > game.teamA.score ? 'B' : null;

  return (
    <div
      style={{
        width: 'clamp(280px, 28vw, 480px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'clamp(1rem, 2vw, 3rem)',
        padding: 'clamp(1rem, 2vw, 3rem) 0',
        position: 'relative',
      }}
    >
      {/* Period badge */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1E1E1E 0%, #111111 100%)',
          border: '1px solid #2A2A2A',
          borderRadius: '0.8rem',
          padding: 'clamp(0.4rem, 0.8vw, 1rem) clamp(1rem, 2vw, 2.5rem)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: '"Oswald", sans-serif',
            fontWeight: 400,
            fontSize: 'clamp(0.6rem, 0.9vw, 1.1rem)',
            letterSpacing: '0.3em',
            color: '#555555',
          }}
        >
          {getFullPeriodLabel(period)}
        </div>
      </div>

      {/* Clock */}
      <ClockDisplay
        minutes={gameTime.minutes}
        seconds={gameTime.seconds}
        running={gameRunning}
      />

      {/* VS divider */}
      <div
        style={{
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 900,
          fontSize: 'clamp(1.5rem, 2.5vw, 3rem)',
          color: '#222222',
          letterSpacing: '0.1em',
        }}
      >
        VS
      </div>

      {/* Shot clock */}
      {game.settings?.shotClockDuration > 0 && (
        <ShotClock value={shotClock ?? 24} />
      )}

      {/* Score differential */}
      {scoreDiff > 0 && leader && (
        <div
          style={{
            background: '#0D0D0D',
            border: '1px solid #1E1E1E',
            borderRadius: '0.6rem',
            padding: 'clamp(0.3rem, 0.5vw, 0.8rem) clamp(0.8rem, 1.5vw, 2rem)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: '"Oswald", sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(0.55rem, 0.8vw, 1rem)',
              letterSpacing: '0.25em',
              color: '#444444',
            }}
          >
            LEAD BY
          </div>
          <div
            style={{
              fontFamily: '"Oswald", sans-serif',
              fontWeight: 900,
              fontSize: 'clamp(1.8rem, 3.5vw, 4rem)',
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

// ─── TICKER BAR ───────────────────────────────────────────────────────────────

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

  const fullText = items.join('   ·   ');

  return (
    <div
      style={{
        height: 'clamp(2.5rem, 4.5vh, 4.5rem)',
        background: 'linear-gradient(90deg, #0A0A0A 0%, #111111 50%, #0A0A0A 100%)',
        borderTop: '1px solid #1E1E1E',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          whiteSpace: 'nowrap',
          animation: 'ticker 40s linear infinite',
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 400,
          fontSize: 'clamp(0.7rem, 1.2vw, 1.3rem)',
          letterSpacing: '0.15em',
          color: '#555555',
        }}
      >
        {[fullText, fullText].map((text, i) => (
          <span key={i} style={{ paddingRight: '8rem' }}>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── HEADER ──────────────────────────────────────────────────────────────────

const Header: React.FC<{ gameName: string; period: number }> = ({ gameName, period }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        height: 'clamp(2.5rem, 5vh, 5rem)',
        background: '#050505',
        borderBottom: '1px solid #1A1A1A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 clamp(1.5rem, 3vw, 4rem)',
        flexShrink: 0,
      }}
    >
      {/* Logo / Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          style={{
            width: 'clamp(0.6rem, 1vw, 1.2rem)',
            height: 'clamp(0.6rem, 1vw, 1.2rem)',
            borderRadius: '50%',
            background: '#FF3030',
            boxShadow: '0 0 10px #FF303088',
            animation: 'ledPulse 1s ease-in-out infinite alternate',
          }}
        />
        <span
          style={{
            fontFamily: '"Oswald", sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(0.8rem, 1.5vw, 1.8rem)',
            letterSpacing: '0.3em',
            color: '#333333',
          }}
        >
          THE BOX
        </span>
        <span
          style={{
            fontFamily: '"Oswald", sans-serif',
            fontWeight: 400,
            fontSize: 'clamp(0.55rem, 0.9vw, 1rem)',
            letterSpacing: '0.2em',
            color: '#222222',
          }}
        >
          LIVE
        </span>
      </div>

      {/* Center: Game name */}
      <div
        style={{
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 700,
          fontSize: 'clamp(0.8rem, 1.5vw, 1.8rem)',
          letterSpacing: '0.2em',
          color: '#2A2A2A',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
      >
        {gameName}
      </div>

      {/* Right: Time + Period */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <span
          style={{
            fontFamily: '"Oswald", sans-serif',
            fontWeight: 400,
            fontSize: 'clamp(0.7rem, 1.1vw, 1.3rem)',
            letterSpacing: '0.15em',
            color: '#2A2A2A',
          }}
        >
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span
          style={{
            fontFamily: '"Oswald", sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(0.7rem, 1.1vw, 1.3rem)',
            letterSpacing: '0.2em',
            color: '#333333',
          }}
        >
          {getFullPeriodLabel(period)}
        </span>
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
    <div
      style={{
        fontSize: '6rem',
        fontWeight: 900,
        letterSpacing: '0.1em',
        color: '#1A1A1A',
      }}
    >
      NO SIGNAL
    </div>
    <div
      style={{
        fontSize: '1.4rem',
        fontWeight: 400,
        letterSpacing: '0.2em',
        color: '#333333',
      }}
    >
      {message}
    </div>
  </div>
);

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap');

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body, #root {
      width: 100%;
      height: 100%;
      background: #000000;
      overflow: hidden;
    }

    @keyframes burstFade {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(2.5); opacity: 0; }
    }

    @keyframes ledPulse {
      from { opacity: 0.6; }
      to { opacity: 1; }
    }

    @keyframes possessionBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    @keyframes clockPulse {
      from { transform: scale(1); }
      to { transform: scale(1.015); }
    }

    @keyframes criticalFlash {
      from { border-color: #FF303066; }
      to { border-color: #FF3030; box-shadow: 0 0 60px #FF303099; }
    }

    @keyframes ticker {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes breathe {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.7; }
    }

    @keyframes scanlines {
      0% { transform: translateY(0); }
      100% { transform: translateY(4px); }
    }
  `}</style>
);

// ─── MAIN SPECTATOR VIEW ──────────────────────────────────────────────────────

export const SpectatorView: React.FC = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<BasketballGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isLocalGame = gameCode?.startsWith('LOCAL-');

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

  if (loading) return (
    <>
      <GlobalStyles />
      <LoadingScreen />
    </>
  );

  if (error || !game) return (
    <>
      <GlobalStyles />
      <ErrorScreen message={error || 'Game unavailable'} />
    </>
  );

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

        {/* Header bar */}
        <Header
          gameName={game.settings?.gameName || 'BASKETBALL'}
          period={game.gameState.period}
        />

        {/* Main content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'stretch',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* Team A */}
          <TeamPanel
            name={game.teamA.name}
            score={game.teamA.score}
            fouls={game.teamA.fouls}
            timeouts={game.teamA.timeouts}
            color={game.teamA.color || '#DC2626'}
            hasPossession={game.gameState.possession === 'A'}
            side="left"
            players={game.teamA.players}
          />

          {/* Divider */}
          <div
            style={{
              width: '1px',
              background: 'linear-gradient(to bottom, transparent 0%, #1E1E1E 20%, #1E1E1E 80%, transparent 100%)',
              flexShrink: 0,
            }}
          />

          {/* Center */}
          <CenterPanel game={game} />

          {/* Divider */}
          <div
            style={{
              width: '1px',
              background: 'linear-gradient(to bottom, transparent 0%, #1E1E1E 20%, #1E1E1E 80%, transparent 100%)',
              flexShrink: 0,
            }}
          />

          {/* Team B */}
          <TeamPanel
            name={game.teamB.name}
            score={game.teamB.score}
            fouls={game.teamB.fouls}
            timeouts={game.teamB.timeouts}
            color={game.teamB.color || '#2563EB'}
            hasPossession={game.gameState.possession === 'B'}
            side="right"
            players={game.teamB.players}
          />
        </div>

        {/* Ticker */}
        <TickerBar game={game} />
      </div>
    </>
  );
};

export default SpectatorView;