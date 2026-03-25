// src/pages/RefereeScreen.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — MASTER REFEREE SCREEN CONTROLLER v2
//
// State machine:
//
//   SPLASH
//     ↓
//   MODE_SELECT
//     ↓                      ↓
//   OFFLINE_SETUP          ONLINE_SETUP (QR code shown)
//     ↓ onConfirm            ↓ onGameAssigned (auto, from Supabase)
//   CONNECTING             PRE_GAME  ← online skips CONNECTING
//     ↓ game_ready                     (game already exists in Supabase)
//   PRE_GAME
//     ↓ Begin
//   LIVE_GAME ↔ SETTINGS
//     ↓ end
//   POST_GAME
//
// Key distinction:
//   OFFLINE path: Pi creates the game (daemon calls Supabase createGame)
//   ONLINE path:  Game was created by the website. Pi just loads it by code.
//                 Skips CONNECTING entirely — goes straight to PRE_GAME.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { useRefereeBox } from '../hooks/useRefereeBox';
import type { GameConfig } from '../hooks/useRefereeBox';
import { getGameByCode } from '../services/supabaseGameService';
import { markBoxLive, resetBoxUnit } from '../services/boxUnitService';

import SplashScreen from '../components/refereebox/SplashScreen';
import ModeSelect from '../components/refereebox/ModeSelect';
import OnlineSetup from '../components/refereebox/OnlineSetup';
import OfflineSetup from '../components/refereebox/OfflineSetup';
import PreGameConfirm from '../components/refereebox/PreGameConfirm';
import LiveScoreboard from '../components/refereebox/LockedScoreboard';
import SettingsPanel from '../components/refereebox/UnlockedSettings';

// ─── Screens ─────────────────────────────────────────────────

type Screen =
    | 'splash'
    | 'mode_select'
    | 'online_setup'
    | 'offline_setup'
    | 'connecting'
    | 'pre_game'
    | 'live_game'
    | 'settings'
    | 'post_game';

// ─── Component ────────────────────────────────────────────────

export default function RefereeScreen() {
    const {
        gameState,
        isConnected,
        gameCode,
        isSettingUp,
        setupError,
        setupGame,
        sendAction,
        endGame,
    } = useRefereeBox();

    const [screen, setScreen] = useState<Screen>('splash');
    const [pendingConfig, setPendingConfig] = useState<GameConfig | null>(null);
    const [activeGameCode, setActiveGameCode] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(false);
    const [boxCode, setBoxCode] = useState<string | null>(null);
    const [finalScore, setFinalScore] = useState<{
        a: number; b: number; teamA: string; teamB: string;
    } | null>(null);

    // ── Internet check ───────────────────────────────────────
    useEffect(() => {
        const check = async () => {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                await fetch('https://www.google.com/generate_204', {
                    method: 'HEAD', signal: controller.signal, mode: 'no-cors',
                });
                clearTimeout(timeout);
                setIsOnline(true);
            } catch {
                setIsOnline(false);
            }
        };
        check();
        const interval = setInterval(check, 10000);
        return () => clearInterval(interval);
    }, []);

    // Load box code from localStorage (set by OnlineSetup)
    useEffect(() => {
        const stored = localStorage.getItem('THE_BOX_UNIT_CODE');
        if (stored) setBoxCode(stored);
    }, []);

    // ── OFFLINE: CONNECTING → PRE_GAME when daemon returns game_ready ─
    useEffect(() => {
        if (screen === 'connecting' && gameCode && !isSettingUp && !setupError) {
            setActiveGameCode(gameCode);
            setScreen('pre_game');
        }
    }, [gameCode, isSettingUp, setupError, screen]);

    // ── Physical SETTINGS button toggles live ↔ settings ────
    useEffect(() => {
        if (!gameState) return;
        if (screen === 'live_game' && gameState.ui?.isTouchUnlocked) {
            setScreen('settings');
        } else if (screen === 'settings' && !gameState.ui?.isTouchUnlocked) {
            setScreen('live_game');
        }
    }, [gameState?.ui?.isTouchUnlocked]);

    // ── Game ended → post_game ───────────────────────────────
    useEffect(() => {
        if (!gameState) return;
        if ((screen === 'live_game' || screen === 'settings')
            && !gameState.meta?.gameActive
            && !gameCode) {
            setScreen('post_game');
            if (boxCode) resetBoxUnit(boxCode);
        }
    }, [gameState?.meta?.gameActive, gameCode]);

    // Cache score while live
    useEffect(() => {
        if (gameState?.meta?.gameActive) {
            setFinalScore({
                a: gameState.teamA.score,
                b: gameState.teamB.score,
                teamA: gameState.teamA.name,
                teamB: gameState.teamB.name,
            });
        }
    }, [gameState?.teamA.score, gameState?.teamB.score]);

    // ── Handlers ─────────────────────────────────────────────

    const handleSplashComplete = useCallback(() => setScreen('mode_select'), []);

    // OFFLINE path — Pi creates the game
    const handleOfflineConfirm = useCallback((config: GameConfig) => {
        setPendingConfig(config);
        setScreen('connecting');
        setupGame(config);
    }, [setupGame]);

    // ONLINE path — game already exists in Supabase, created by website
    // Pi just needs to load the game config from Supabase and tell the daemon
    const handleGameAssigned = useCallback(async (assignedCode: string) => {
        try {
            // Fetch the game config from Supabase
            const game = await getGameByCode(assignedCode);
            if (!game) throw new Error('Game not found');

            // Build config from the existing game
            const config: GameConfig = {
                teamAName: game.teamA.name,
                teamBName: game.teamB.name,
                teamAColor: game.teamA.color,
                teamBColor: game.teamB.color,
                periodMinutes: game.settings.periodDuration,
                shotClockSeconds: game.settings.shotClockDuration || 24,
                periods: game.settings.periods || 4,
                periodType: game.settings.periodType || 'quarter',
                timeoutsPerTeam: game.teamA.timeouts,
            };

            setPendingConfig(config);
            setActiveGameCode(assignedCode);

            // Tell the daemon to load this existing game code
            // (daemon doesn't create — it just adopts the existing code)
            setupGame({ ...config, existingGameCode: assignedCode });

            // Mark box as live in Supabase
            if (boxCode) markBoxLive(boxCode);

            setScreen('pre_game');

        } catch (err) {
            console.error('[RefereeScreen] handleGameAssigned failed:', err);
            // Fall back to offline mode
            setScreen('mode_select');
        }
    }, [setupGame, boxCode]);

    const handleBeginGame = useCallback(() => setScreen('live_game'), []);

    const handleEndGame = useCallback(() => {
        if (gameState) {
            setFinalScore({
                a: gameState.teamA.score,
                b: gameState.teamB.score,
                teamA: gameState.teamA.name,
                teamB: gameState.teamB.name,
            });
        }
        endGame();
        setScreen('post_game');
        if (boxCode) resetBoxUnit(boxCode);
    }, [endGame, gameState, boxCode]);

    const handleNewGame = useCallback(() => {
        setPendingConfig(null);
        setFinalScore(null);
        setActiveGameCode(null);
        setScreen('mode_select');
    }, []);

    const handleRetry = useCallback(() => {
        if (pendingConfig) {
            setScreen('connecting');
            setupGame(pendingConfig);
        } else {
            setScreen('mode_select');
        }
    }, [pendingConfig, setupGame]);

    const displayGameCode = activeGameCode || gameCode;
    const teamAColor = gameState?.teamA?.color || pendingConfig?.teamAColor || '#3B82F6';
    const teamBColor = gameState?.teamB?.color || pendingConfig?.teamBColor || '#EF4444';

    // ── Render ────────────────────────────────────────────────

    switch (screen) {

        case 'splash':
            return <SplashScreen isDaemonConnected={isConnected} onComplete={handleSplashComplete} />;

        case 'mode_select':
            return (
                <ModeSelect
                    onSelectOnline={() => setScreen('online_setup')}
                    onSelectOffline={() => setScreen('offline_setup')}
                    isOnline={isOnline}
                />
            );

        case 'offline_setup':
            return (
                <OfflineSetup
                    onConfirm={handleOfflineConfirm}
                    onBack={() => setScreen('mode_select')}
                />
            );

        case 'online_setup':
            return (
                <OnlineSetup
                    onGameAssigned={handleGameAssigned}
                    onBack={() => setScreen('mode_select')}
                />
            );

        case 'connecting':
            return (
                <ConnectingScreen
                    config={pendingConfig}
                    error={setupError}
                    onRetry={handleRetry}
                    onBack={() => setScreen('mode_select')}
                />
            );

        case 'pre_game':
            return pendingConfig && displayGameCode ? (
                <PreGameConfirm
                    config={pendingConfig}
                    gameCode={displayGameCode}
                    onStart={handleBeginGame}
                    onBack={() => setScreen('mode_select')}
                />
            ) : null;

        case 'live_game':
            return gameState ? (
                <LiveScoreboard
                    teamA={gameState.teamA}
                    teamB={gameState.teamB}
                    clock={gameState.clock}
                    possession={null}
                    lastAction={undefined}
                    canUndo={true}
                    teamAColor={teamAColor}
                    teamBColor={teamBColor}
                />
            ) : <DaemonReconnectingScreen />;

        case 'settings':
            return gameState ? (
                <SettingsPanel
                    teamA={gameState.teamA}
                    teamB={gameState.teamB}
                    clock={gameState.clock}
                    teamAColor={teamAColor}
                    teamBColor={teamBColor}
                    sendAction={sendAction}
                    onEndGame={handleEndGame}
                />
            ) : null;

        case 'post_game':
            return <PostGameScreen score={finalScore} onNewGame={handleNewGame} />;

        default:
            return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// INLINE SUB-SCREENS
// ═══════════════════════════════════════════════════════════════

function ConnectingScreen({ config, error, onRetry, onBack }: {
    config: GameConfig | null; error: string | null;
    onRetry: () => void; onBack: () => void;
}) {
    return (
        <div style={{
            width: '1024px', height: '600px', background: '#000',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '28px',
            fontFamily: "'JetBrains Mono', monospace",
        }}>
            {!error ? (
                <>
                    <div style={{
                        width: '48px', height: '48px',
                        border: '3px solid #1a1a1a', borderTop: '3px solid #F59E0B',
                        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                    }} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '13px', color: '#F59E0B', letterSpacing: '0.2em', marginBottom: '8px' }}>
                            CREATING GAME
                        </div>
                        {config && (
                            <div style={{ fontSize: '11px', color: '#444', letterSpacing: '0.1em' }}>
                                {config.teamAName} vs {config.teamBName}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <div style={{ fontSize: '13px', color: '#EF4444', letterSpacing: '0.15em' }}>SETUP FAILED</div>
                    <div style={{ fontSize: '11px', color: '#555' }}>{error}</div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {(['RETRY', 'BACK'] as const).map((label, i) => (
                            <button key={label} onClick={i === 0 ? onRetry : onBack} style={{
                                padding: '12px 28px',
                                background: i === 0 ? '#F59E0B' : '#111',
                                border: i === 0 ? 'none' : '1px solid #2a2a2a',
                                borderRadius: '8px', color: i === 0 ? '#000' : '#666',
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer',
                            }}>{label}</button>
                        ))}
                    </div>
                </>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

function DaemonReconnectingScreen() {
    return (
        <div style={{
            width: '1024px', height: '600px', background: '#000',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '16px',
            fontFamily: "'JetBrains Mono', monospace",
        }}>
            <div style={{
                width: '40px', height: '40px',
                border: '2px solid #1a1a1a', borderTop: '2px solid #F59E0B',
                borderRadius: '50%', animation: 'spin 1s linear infinite',
            }} />
            <div style={{ fontSize: '12px', color: '#F59E0B', letterSpacing: '0.2em' }}>
                RECONNECTING TO DAEMON...
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

function PostGameScreen({ score, onNewGame }: {
    score: { a: number; b: number; teamA: string; teamB: string } | null;
    onNewGame: () => void;
}) {
    const winner = score
        ? score.a > score.b ? score.teamA : score.a < score.b ? score.teamB : null
        : null;

    return (
        <div style={{
            width: '1024px', height: '600px', background: '#000',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '28px',
        }}>
            <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px', color: '#444', letterSpacing: '0.3em',
            }}>FINAL SCORE</div>

            {score && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
                    {[{ name: score.teamA, pts: score.a }, { name: score.teamB, pts: score.b }].map((t, i) => (
                        <React.Fragment key={t.name}>
                            {i === 1 && <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '40px', color: '#1a1a1a', fontWeight: 700 }}>—</div>}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#555', letterSpacing: '0.15em', marginBottom: '8px' }}>
                                    {t.name.toUpperCase()}
                                </div>
                                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '96px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                                    {t.pts}
                                </div>
                            </div>
                        </React.Fragment>
                    ))}
                </div>
            )}

            {winner && <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '16px', color: '#F59E0B', letterSpacing: '0.2em' }}>{winner.toUpperCase()} WINS</div>}
            {score && score.a === score.b && <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '16px', color: '#666', letterSpacing: '0.2em' }}>DRAW</div>}

            <button onClick={onNewGame} style={{
                padding: '16px 56px', background: '#F59E0B', border: 'none',
                borderRadius: '10px', color: '#000', fontFamily: "'Oswald', sans-serif",
                fontSize: '18px', fontWeight: 700, letterSpacing: '0.15em', cursor: 'pointer', marginTop: '8px',
            }}>NEW GAME</button>
        </div>
    );
}