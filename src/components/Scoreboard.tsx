import React, { useEffect, useRef } from 'react';
import { BasketballGame } from '../types';
import { useBasketballGame } from '../hooks/useBasketballGame';

interface ScoreboardProps {
  gameCode: string;
  gameType: 'local' | 'online';
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ gameCode, gameType }) => {
  const game = useBasketballGame(gameCode, gameType);

  // CRITICAL FIX: Use refs to avoid stale closure in interval
  const timerRef = useRef<number | null>(null);
  const gameStateRef = useRef(game.game.gameState);

  // Update ref whenever game state changes
  useEffect(() => {
    gameStateRef.current = game.game.gameState;
  }, [game.game.gameState]);

  // FIXED: Timer with proper shot clock decrement
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Only run timer if game is running
    if (!game.game.gameState.gameRunning) {
      return;
    }

    // Set up new interval
    timerRef.current = window.setInterval(() => {
      // CRITICAL: Use ref to get current state, avoiding stale closure
      const current = gameStateRef.current;

      // Calculate total seconds
      const totalSeconds = (current.gameTime.minutes * 60) + current.gameTime.seconds;

      if (totalSeconds > 0) {
        // Decrement game clock
        const newTotalSeconds = totalSeconds - 1;
        const newMinutes = Math.floor(newTotalSeconds / 60);
        const newSeconds = newTotalSeconds % 60;

        // CRITICAL FIX: Actually decrement shot clock!
        let newShotClock = current.shotClock;
        if (current.shotClockRunning && newShotClock > 0) {
          newShotClock = newShotClock - 1;
        }

        // Clamp shot clock to 0 minimum
        newShotClock = Math.max(0, newShotClock);

        // Update both clocks
        game.updateGameTime(newMinutes, newSeconds, newShotClock);

        // Sound alert if shot clock expires
        if (newShotClock === 0 && current.shotClock > 0) {
          playBuzzer();
        }
      } else {
        // Period ended
        game.toggleTimer();
        playHorn();
      }
    }, 1000);

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [game.game.gameState.gameRunning]); // Only re-run when running state changes

  // Sound effects
  const playBuzzer = () => {
    // Shot clock violation sound
    const audio = new Audio('/sounds/buzzer.mp3');
    audio.play().catch(() => { });
  };

  const playHorn = () => {
    // Period end sound
    const audio = new Audio('/sounds/horn.mp3');
    audio.play().catch(() => { });
  };

  // Format time display
  const formatTime = (minutes: number, seconds: number): string => {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get period display text
  const getPeriodText = (period: number): string => {
    if (period <= 4) {
      return `Q${period}`;
    } else {
      return `OT${period - 4}`;
    }
  };

  // Check if team is in bonus (4+ fouls this quarter)
  const isInBonus = (foulsThisQuarter: number): boolean => {
    return foulsThisQuarter >= 4;
  };

  return (
    <div className="scoreboard" style={{
      background: '#000',
      color: '#fff',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      {/* Main Scoreboard */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
      }}>
        {/* Team A */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 style={{
            fontSize: '24px',
            color: game.game.teamA.color,
            marginBottom: '10px',
          }}>
            {game.game.teamA.name}
          </h2>
          <div style={{
            fontSize: '72px',
            fontWeight: 'bold',
            color: '#fff',
          }}>
            {game.game.teamA.score}
          </div>
          <div style={{ marginTop: '10px', fontSize: '16px' }}>
            <div>Timeouts: {game.game.teamA.timeouts}</div>
            <div>
              Fouls: {game.game.teamA.foulsThisQuarter}
              {isInBonus(game.game.teamA.foulsThisQuarter) && (
                <span style={{ color: '#FF0000', marginLeft: '8px' }}>BONUS</span>
              )}
            </div>
          </div>
        </div>

        {/* Game Clock & Period */}
        <div style={{
          flex: 1,
          textAlign: 'center',
          borderLeft: '2px solid #333',
          borderRight: '2px solid #333',
          padding: '0 40px',
        }}>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>
            {getPeriodText(game.game.gameState.period)}
          </div>
          <div style={{
            fontSize: '64px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: '#0F0',
          }}>
            {formatTime(
              game.game.gameState.gameTime.minutes,
              game.game.gameState.gameTime.seconds
            )}
          </div>
          <div style={{
            fontSize: '32px',
            marginTop: '10px',
            color: game.game.gameState.shotClock <= 5 ? '#FF0000' : '#FFA500',
          }}>
            {game.game.gameState.shotClock}
          </div>
          <div style={{ fontSize: '14px', color: '#888' }}>
            SHOT CLOCK
          </div>
        </div>

        {/* Team B */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 style={{
            fontSize: '24px',
            color: game.game.teamB.color,
            marginBottom: '10px',
          }}>
            {game.game.teamB.name}
          </h2>
          <div style={{
            fontSize: '72px',
            fontWeight: 'bold',
            color: '#fff',
          }}>
            {game.game.teamB.score}
          </div>
          <div style={{ marginTop: '10px', fontSize: '16px' }}>
            <div>Timeouts: {game.game.teamB.timeouts}</div>
            <div>
              Fouls: {game.game.teamB.foulsThisQuarter}
              {isInBonus(game.game.teamB.foulsThisQuarter) && (
                <span style={{ color: '#FF0000', marginLeft: '8px' }}>BONUS</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        marginTop: '30px',
      }}>
        <button
          onClick={game.toggleTimer}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            background: game.game.gameState.gameRunning ? '#FF0000' : '#00FF00',
            color: '#000',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {game.game.gameState.gameRunning ? 'STOP' : 'START'}
        </button>

        <button
          onClick={() => game.resetShotClock(24)}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            background: '#FFA500',
            color: '#000',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          RESET 24
        </button>

        <button
          onClick={() => game.resetShotClock(14)}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            background: '#FFA500',
            color: '#000',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          RESET 14
        </button>

        <button
          onClick={() => game.setPeriod(game.game.gameState.period + 1)}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            background: '#0080FF',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          NEXT PERIOD
        </button>
      </div>

      {/* Debug Info */}
      <div style={{
        marginTop: '20px',
        padding: '10px',
        background: '#111',
        borderRadius: '5px',
        fontSize: '12px',
        color: '#666',
        fontFamily: 'monospace',
      }}>
        <div>Timer Running: {game.game.gameState.gameRunning ? 'YES' : 'NO'}</div>
        <div>Shot Clock Running: {game.game.gameState.shotClockRunning ? 'YES' : 'NO'}</div>
        <div>Game Type: {gameType}</div>
        <div>Game Code: {gameCode}</div>
      </div>
    </div>
  );
};