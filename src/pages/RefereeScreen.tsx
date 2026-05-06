// src/pages/RefereeScreen.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — MASTER REFEREE SCREEN CONTROLLER v4
//
// Screen state machine:
//   SPLASH → DASHBOARD
//     → OFFLINE_SETUP → CONNECTING → PRE_GAME
//     → WATCH (stub, back → DASHBOARD)
//   PRE_GAME → LIVE_GAME ↔ SETTINGS
//   SETTINGS → END_GAME_CONFIRM → POST_GAME
//   LIVE_GAME → END_GAME_CONFIRM → POST_GAME
//   DASHBOARD (hold SETTINGS) → QUICK_GAME_CONFIRM → CONNECTING
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRefereeBox } from '../hooks/useRefereeBox';
import type { GameConfig } from '../hooks/useRefereeBox';
import { resetBoxUnit } from '../services/boxUnitService';

import SplashScreen from '../components/refereebox/SplashScreen';
import PiDashboard from '../components/refereebox/PiDashboard';
import PiWatchScreen from '../components/refereebox/PiWatchScreen';
import OfflineSetup from '../components/refereebox/OfflineSetup';
import PreGameConfirm from '../components/refereebox/PreGameConfirm';
import LiveScoreboard from '../components/refereebox/LockedScoreboard';
import SettingsPanel from '../components/refereebox/UnlockedSettings';
import PiAdvancedShotFlow from '../components/refereebox/PiAdvancedShotFlow';

// ─── Screen type ──────────────────────────────────────────────

type Screen =
    | 'splash'
    | 'dashboard'
    | 'watch'
    | 'offline_setup'
    | 'connecting'
    | 'pre_game'
    | 'live_game'
    | 'settings'
    | 'end_game_confirm'
    | 'quick_game_confirm'
    | 'post_game';

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function RefereeScreen() {
    const {
        gameState,
        isConnected,
        gameCode,
        isSettingUp,
        setupError,
        scorePending,
        undoFlash,
        settingsFlash,
        setupGame,
        sendAction,
        endGame,
        attributeShot,
        dismissScorePending,
    } = useRefereeBox();

    const [screen, setScreen] = useState<Screen>('splash');
    const [pendingConfig, setPendingConfig] = useState<GameConfig | null>(null);
    const [activeGameCode, setActiveGameCode] = useState<string | null>(null);
    const [boxCode, setBoxCode] = useState<string | null>(null);
    const [possession, setPossession] = useState<'A' | 'B' | null>(null);
    const [dashboardIndex, setDashboardIndex] = useState(1); // 0=watch, 1=start (default start)
    const settingsHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [finalScore, setFinalScore] = useState<{
        a: number; b: number; teamA: string; teamB: string;
    } | null>(null);

    // ── Load box code ─────────────────────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem('THE_BOX_UNIT_CODE');
        if (stored) setBoxCode(stored);
    }, []);

    // ── Hardware button navigation ────────────────────────────
    useEffect(() => {
        const handler = (e: Event) => {
            const msg = (e as CustomEvent).detail as string;

            // SPLASH — any button skips splash
            if (screen === 'splash') {
                handleSplashComplete();
                return;
            }

            // DASHBOARD — Score A=watch, Score B=start, Shot Clock=confirm
            if (screen === 'dashboard') {
                if (msg === 'SCORE_A_PLUS1' || msg === 'SCORE_A_PLUS2' || msg === 'SCORE_A_PLUS3') {
                    setDashboardIndex(0); // watch
                } else if (msg === 'SCORE_B_PLUS1' || msg === 'SCORE_B_PLUS2' || msg === 'SCORE_B_PLUS3') {
                    setDashboardIndex(1); // start
                } else if (msg === 'SHOT_CLOCK_24' || msg === 'SHOT_CLOCK_14') {
                    if (dashboardIndex === 0) {
                        setScreen('watch');
                    } else {
                        setScreen('offline_setup');
                    }
                } else if (msg === 'SETTINGS') {
                    if (!settingsHoldTimer.current) {
                        settingsHoldTimer.current = setTimeout(() => {
                            settingsHoldTimer.current = null;
                            setScreen('quick_game_confirm');
                        }, 2000);
                    }
                } else {
                    if (settingsHoldTimer.current) {
                        clearTimeout(settingsHoldTimer.current);
                        settingsHoldTimer.current = null;
                    }
                }
                return;
            }

            // WATCH — Undo = back to dashboard
            if (screen === 'watch') {
                if (msg === 'UNDO') setScreen('dashboard');
                return;
            }

            // QUICK_GAME_CONFIRM — Shot Clock = start, Undo = cancel
            if (screen === 'quick_game_confirm') {
                if (msg === 'SHOT_CLOCK_24' || msg === 'SHOT_CLOCK_14') {
                    handleQuickGameStart();
                } else if (msg === 'UNDO') {
                    setScreen('dashboard');
                }
                return;
            }
        };

        window.addEventListener('pico_message', handler);
        return () => {
            window.removeEventListener('pico_message', handler);
            if (settingsHoldTimer.current) {
                clearTimeout(settingsHoldTimer.current);
                settingsHoldTimer.current = null;
            }
        };
    }, [screen, dashboardIndex]);

    // ── OFFLINE: CONNECTING → PRE_GAME ───────────────────────
    useEffect(() => {
        if (screen === 'connecting' && gameCode && !isSettingUp && !setupError) {
            setActiveGameCode(gameCode);
            setScreen('pre_game');
        }
    }, [gameCode, isSettingUp, setupError, screen]);

    // ── Physical SETTINGS button toggles live ↔ settings ─────
    useEffect(() => {
        if (!gameState) return;
        // Don't interrupt the confirm screen
        if (screen === 'end_game_confirm') return;

        if (screen === 'live_game' && gameState.ui?.isTouchUnlocked) {
            setScreen('settings');
        } else if (screen === 'settings' && !gameState.ui?.isTouchUnlocked) {
            setScreen('live_game');
        }
    }, [gameState?.ui?.isTouchUnlocked]);

    // ── Handle SET_POSSESSION action from settings ────────────
    // We intercept this before sendAction so possession lives in React state
    const handleSendAction = useCallback((type: string, payload: Record<string, unknown> = {}) => {
        if (type === 'SET_POSSESSION') {
            setPossession(payload.team as 'A' | 'B');
            return; // possession is local UI state — daemon doesn't need it yet
        }
        sendAction(type, payload);
    }, [sendAction]);

    // ── Game daemon ended → post_game ─────────────────────────
    useEffect(() => {
        if (!gameState) return;
        if ((screen === 'live_game' || screen === 'settings')
            && !gameState.meta?.gameActive
            && !gameCode) {
            setScreen('post_game');
            if (boxCode) resetBoxUnit(boxCode);
        }
    }, [gameState?.meta?.gameActive, gameCode]);

    // ── Cache score while live ────────────────────────────────
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

    // ── Handlers ──────────────────────────────────────────────

    const handleSplashComplete = useCallback(() => setScreen('dashboard'), []);

    const handleOfflineConfirm = useCallback((config: GameConfig) => {
        setPendingConfig(config);
        setScreen('connecting');
        setupGame(config);
    }, [setupGame]);

    const handleBeginGame = useCallback(() => setScreen('live_game'), []);

    // Called from Settings "END GAME" button — goes to confirm screen
    const handleEndGameRequest = useCallback(() => {
        setScreen('end_game_confirm');
    }, []);

    // Called from confirm screen "YES, END" button
    const handleEndGameConfirmed = useCallback(() => {
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

    const handleEndGameCancelled = useCallback(() => {
        // Return to wherever we came from
        if (gameState?.ui?.isTouchUnlocked) {
            setScreen('settings');
        } else {
            setScreen('live_game');
        }
    }, [gameState?.ui?.isTouchUnlocked]);

    const handleNewGame = useCallback(() => {
        setPendingConfig(null);
        setFinalScore(null);
        setActiveGameCode(null);
        setPossession(null);
        setDashboardIndex(1);
        setScreen('dashboard');
    }, []);

    // ── Quick Game (hardware-only) ────────────────────────────
    const handleQuickGameStart = useCallback(() => {
        const quickConfig: GameConfig = {
            teamAName: 'TEAM A',
            teamBName: 'TEAM B',
            teamAColor: '#3B82F6',
            teamBColor: '#EF4444',
            periodMinutes: 10,
            periods: 4,
            periodType: 'quarter',
            shotClockSeconds: 24,
            gameMode: 'quick',
        };
        setPendingConfig(quickConfig);
        setScreen('connecting');
        setupGame(quickConfig);
    }, [setupGame]);

    const handleRetry = useCallback(() => {
        if (pendingConfig) {
            setScreen('connecting');
            setupGame(pendingConfig);
        } else {
            setScreen('dashboard');
        }
    }, [pendingConfig, setupGame]);

    const displayGameCode = activeGameCode || gameCode;
    const teamAColor = gameState?.teamA?.color || pendingConfig?.teamAColor || '#3B82F6';
    const teamBColor = gameState?.teamB?.color || pendingConfig?.teamBColor || '#EF4444';

    // ── Render ────────────────────────────────────────────────

    switch (screen) {

        case 'splash':
            return <SplashScreen isDaemonConnected={isConnected} onComplete={handleSplashComplete} />;

        case 'dashboard':
            return (
                <PiDashboard
                    onSelectWatch={() => setScreen('watch')}
                    onSelectStart={() => setScreen('offline_setup')}
                    selectedIndex={dashboardIndex}
                />
            );

        case 'watch':
            return (
                <PiWatchScreen
                    onBack={() => setScreen('dashboard')}
                    castCode={boxCode?.slice(-4).toUpperCase() ?? 'BOX1'}
                />
            );

        case 'quick_game_confirm':
            return (
                <QuickGameConfirmScreen
                    onConfirm={handleQuickGameStart}
                    onCancel={() => setScreen('dashboard')}
                />
            );

        case 'offline_setup':
            return (
                <OfflineSetup
                    onConfirm={handleOfflineConfirm}
                    onBack={() => setScreen('dashboard')}
                />
            );

        case 'connecting':
            return (
                <ConnectingScreen
                    config={pendingConfig}
                    error={setupError}
                    onRetry={handleRetry}
                    onBack={() => setScreen('dashboard')}
                />
            );

        case 'pre_game':
            return pendingConfig && displayGameCode ? (
                <PreGameConfirm
                    config={pendingConfig}
                    gameCode={displayGameCode}
                    onStart={handleBeginGame}
                    onBack={() => setScreen('dashboard')}
                />
            ) : null;

        case 'live_game':
            // Stats/advanced mode: show shot attribution screen when a score is pending
            if (gameState && scorePending && gameState.meta.gameMode !== 'quick') {
                return (
                    <PiAdvancedShotFlow
                        event={scorePending}
                        teamA={gameState.teamA}
                        teamB={gameState.teamB}
                        teamAColor={teamAColor}
                        teamBColor={teamBColor}
                        clock={gameState.clock}
                        onAttribute={attributeShot}
                        onSkip={dismissScorePending}
                    />
                );
            }
            return gameState ? (
                <LiveScoreboard
                    teamA={gameState.teamA}
                    teamB={gameState.teamB}
                    clock={gameState.clock}
                    possession={possession}
                    lastAction={undefined}
                    canUndo={true}
                    teamAColor={teamAColor}
                    teamBColor={teamBColor}
                    isConnected={isConnected}
                    isTouchUnlocked={gameState.ui?.isTouchUnlocked}
                    undoFlash={undoFlash}
                    settingsFlash={settingsFlash}
                    gameMode={gameState.meta?.gameMode}
                />
            ) : <DaemonReconnectingScreen />;

        case 'settings':
            return gameState ? (
                <SettingsPanel
                    teamA={gameState.teamA}
                    teamB={gameState.teamB}
                    clock={gameState.clock}
                    possession={possession}
                    teamAColor={teamAColor}
                    teamBColor={teamBColor}
                    sendAction={handleSendAction}
                    onEndGame={handleEndGameRequest}
                />
            ) : null;

        case 'end_game_confirm':
            return (
                <EndGameConfirmScreen
                    teamA={gameState?.teamA.name || pendingConfig?.teamAName || 'Team A'}
                    teamB={gameState?.teamB.name || pendingConfig?.teamBName || 'Team B'}
                    scoreA={gameState?.teamA.score ?? finalScore?.a ?? 0}
                    scoreB={gameState?.teamB.score ?? finalScore?.b ?? 0}
                    period={gameState?.clock.period ?? 1}
                    totalPeriods={gameState?.clock.totalPeriods ?? 4}
                    teamAColor={teamAColor}
                    teamBColor={teamBColor}
                    onConfirm={handleEndGameConfirmed}
                    onCancel={handleEndGameCancelled}
                />
            );

        case 'post_game':
            return <PostGameScreen score={finalScore} onNewGame={handleNewGame} />;

        default:
            return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// QUICK GAME CONFIRMATION SCREEN
// ═══════════════════════════════════════════════════════════════

function QuickGameConfirmScreen({
    onConfirm, onCancel,
}: {
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div style={{
            width: '100vw', height: '100vh', background: '#000',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '28px', fontFamily: "'Oswald', sans-serif",
            border: '3px solid #F59E0B',
        }}>
            {/* Header */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: '44px',
                background: 'linear-gradient(90deg, #1a1400, #2a1800, #1a1400)',
                borderBottom: '2px solid #F59E0B',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            }}>
                <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#F59E0B', animation: 'qgPulse 1s infinite',
                }} />
                <span style={{
                    fontSize: '14px', fontWeight: 700, letterSpacing: '0.25em',
                    color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace",
                }}>
                    QUICK GAME
                </span>
                <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#F59E0B', animation: 'qgPulse 1s infinite',
                }} />
            </div>

            {/* Teams */}
            <div style={{ marginTop: '44px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', letterSpacing: '0.2em', color: '#444', fontFamily: "'JetBrains Mono', monospace", marginBottom: '16px' }}>
                    START A QUICK GAME?
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', letterSpacing: '0.15em', color: '#3B82F6', marginBottom: '6px' }}>TEAM A</div>
                        <div style={{
                            width: 60, height: 60, borderRadius: '12px',
                            background: '#3B82F615', border: '2px solid #3B82F644',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '28px', fontWeight: 700, color: '#3B82F6',
                        }}>
                            A
                        </div>
                    </div>
                    <div style={{ fontSize: '20px', color: '#222', fontWeight: 300 }}>VS</div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', letterSpacing: '0.15em', color: '#EF4444', marginBottom: '6px' }}>TEAM B</div>
                        <div style={{
                            width: 60, height: 60, borderRadius: '12px',
                            background: '#EF444415', border: '2px solid #EF444444',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '28px', fontWeight: 700, color: '#EF4444',
                        }}>
                            B
                        </div>
                    </div>
                </div>
            </div>

            {/* Config summary */}
            <div style={{
                display: 'flex', gap: '20px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px', color: '#444', letterSpacing: '0.1em',
            }}>
                <span>4 × 10 MIN</span>
                <span style={{ color: '#222' }}>•</span>
                <span>24s SHOT CLOCK</span>
                <span style={{ color: '#222' }}>•</span>
                <span>BASIC MODE</span>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                <div
                    onClick={onCancel}
                    style={{
                        padding: '14px 36px', borderRadius: '10px',
                        border: '1px solid #2a2a2a', background: '#0a0a0a',
                        color: '#666', fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em',
                        cursor: 'pointer', userSelect: 'none',
                    }}
                    onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; }}
                    onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = '#0a0a0a'; }}
                >
                    ← UNDO = CANCEL
                </div>
                <div
                    onClick={onConfirm}
                    style={{
                        padding: '14px 36px', borderRadius: '10px',
                        border: '2px solid #F59E0B', background: '#F59E0B',
                        color: '#000', fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em',
                        cursor: 'pointer', userSelect: 'none',
                    }}
                    onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                    onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                >
                    SHOT CLOCK = START →
                </div>
            </div>

            <div style={{
                fontSize: '9px', color: '#222', letterSpacing: '0.1em',
                fontFamily: "'JetBrains Mono', monospace", textAlign: 'center',
            }}>
                OR TAP THE BUTTONS ABOVE
            </div>

            <style>{`
                @keyframes qgPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
            `}</style>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// END GAME CONFIRMATION SCREEN
// ═══════════════════════════════════════════════════════════════

function EndGameConfirmScreen({
    teamA, teamB, scoreA, scoreB, period, totalPeriods,
    teamAColor, teamBColor, onConfirm, onCancel,
}: {
    teamA: string; teamB: string;
    scoreA: number; scoreB: number;
    period: number; totalPeriods: number;
    teamAColor: string; teamBColor: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const [confirmCount, setConfirmCount] = useState(0);
    const winner = scoreA > scoreB ? teamA : scoreA < scoreB ? teamB : null;

    const getPeriodLabel = (p: number, total: number) => {
        if (total === 2) return p <= 2 ? `H${p}` : `OT${p - 2}`;
        return p <= 4 ? `Q${p}` : `OT${p - 4}`;
    };

    // Require two taps to confirm — prevents accidental end
    const handleConfirmTap = () => {
        if (confirmCount === 0) {
            setConfirmCount(1);
        } else {
            onConfirm();
        }
    };

    return (
        <div style={{
            width: '100vw', height: '100vh', background: '#000',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '32px', fontFamily: "'Oswald', sans-serif",
            border: '3px solid #EF4444',
        }}>
            {/* Warning header */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: '44px',
                background: 'linear-gradient(90deg, #1a0000, #2a0000, #1a0000)',
                borderBottom: '2px solid #EF4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            }}>
                <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#EF4444', animation: 'pulse 0.8s infinite',
                }} />
                <span style={{
                    fontSize: '14px', fontWeight: 700, letterSpacing: '0.25em',
                    color: '#EF4444', fontFamily: "'JetBrains Mono', monospace",
                }}>
                    END GAME — CONFIRM
                </span>
                <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#EF4444', animation: 'pulse 0.8s infinite',
                }} />
            </div>

            {/* Current period */}
            <div style={{
                fontSize: '12px', letterSpacing: '0.2em', color: '#444',
                fontFamily: "'JetBrains Mono', monospace", marginTop: '44px',
            }}>
                {getPeriodLabel(period, totalPeriods)} IN PROGRESS
            </div>

            {/* Score display */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '40px',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', letterSpacing: '0.15em', color: teamAColor, marginBottom: '8px' }}>
                        {teamA}
                    </div>
                    <div style={{
                        fontSize: '80px', fontWeight: 700, color: '#fff',
                        lineHeight: 1, fontFamily: "'JetBrains Mono', monospace",
                    }}>
                        {scoreA}
                    </div>
                </div>

                <div style={{ fontSize: '32px', color: '#222', fontWeight: 300 }}>—</div>

                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', letterSpacing: '0.15em', color: teamBColor, marginBottom: '8px' }}>
                        {teamB}
                    </div>
                    <div style={{
                        fontSize: '80px', fontWeight: 700, color: '#fff',
                        lineHeight: 1, fontFamily: "'JetBrains Mono', monospace",
                    }}>
                        {scoreB}
                    </div>
                </div>
            </div>

            {/* Winner label if clear */}
            {winner && (
                <div style={{
                    fontSize: '12px', color: '#22C55E', letterSpacing: '0.2em',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    {winner.toUpperCase()} LEADS
                </div>
            )}

            {scoreA === scoreB && (
                <div style={{
                    fontSize: '12px', color: '#F59E0B', letterSpacing: '0.2em',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    ⚠  TIED GAME — END ANYWAY?
                </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                {/* Cancel */}
                <div
                    onClick={onCancel}
                    style={{
                        padding: '16px 40px', borderRadius: '10px',
                        border: '1px solid #2a2a2a', background: '#0a0a0a',
                        color: '#666', fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em',
                        cursor: 'pointer', userSelect: 'none',
                    }}
                    onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; }}
                    onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = '#0a0a0a'; }}
                >
                    ← CANCEL
                </div>

                {/* Confirm — changes after first tap */}
                <div
                    onClick={handleConfirmTap}
                    style={{
                        padding: '16px 40px', borderRadius: '10px',
                        border: `2px solid ${confirmCount === 1 ? '#EF4444' : '#5a0000'}`,
                        background: confirmCount === 1 ? '#EF4444' : '#1a0000',
                        color: confirmCount === 1 ? '#000' : '#EF4444',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em',
                        cursor: 'pointer', userSelect: 'none',
                        transition: 'all 0.15s',
                    }}
                    onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                    onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                >
                    {confirmCount === 0 ? 'END GAME' : 'TAP AGAIN TO CONFIRM'}
                </div>
            </div>

            <div style={{
                fontSize: '10px', color: '#222', letterSpacing: '0.1em',
                fontFamily: "'JetBrains Mono', monospace", textAlign: 'center',
            }}>
                THIS ACTION CANNOT BE UNDONE
            </div>

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
            `}</style>
        </div>
    );
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
            width: '100vw', height: '100vh', background: '#000',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '28px',
            fontFamily: "'JetBrains Mono', monospace",
        }}>
            {!error ? (
                <>
                    <div style={{
                        width: '40px', height: '40px',
                        border: '2px solid #1a1a1a', borderTop: '2px solid #F59E0B',
                        borderRadius: '50%', animation: 'spin 1s linear infinite',
                    }} />
                    <div style={{ fontSize: '12px', color: '#F59E0B', letterSpacing: '0.2em' }}>
                        STARTING GAME...
                    </div>
                    {config && (
                        <div style={{ fontSize: '10px', color: '#333', letterSpacing: '0.15em' }}>
                            {config.teamAName}  vs  {config.teamBName}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div style={{ fontSize: '11px', color: '#EF4444', letterSpacing: '0.15em' }}>
                        DAEMON ERROR: {error}
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        {[{ label: 'RETRY', action: onRetry }, { label: 'BACK', action: onBack }].map(({ label, action }) => (
                            <button key={label} onClick={action} style={{
                                padding: '12px 28px',
                                background: label === 'RETRY' ? '#F59E0B' : '#111',
                                border: label === 'RETRY' ? 'none' : '1px solid #2a2a2a',
                                borderRadius: '8px', color: label === 'RETRY' ? '#000' : '#666',
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
            width: '100vw', height: '100vh', background: '#000',
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
        ? score.a > score.b ? score.teamA : score.a < score.b ? score.teamB : 'TIE'
        : null;

    return (
        <div style={{
            width: '100vw', height: '100vh', background: '#000',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '32px',
            fontFamily: "'Oswald', sans-serif",
        }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.3em', color: '#333', fontFamily: "'JetBrains Mono', monospace" }}>
                FINAL SCORE
            </div>

            {score && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', letterSpacing: '0.15em', color: '#555', marginBottom: '8px' }}>
                            {score.teamA}
                        </div>
                        <div style={{ fontSize: '88px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                            {score.a}
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', color: '#1a1a1a' }}>—</div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', letterSpacing: '0.15em', color: '#555', marginBottom: '8px' }}>
                            {score.teamB}
                        </div>
                        <div style={{ fontSize: '88px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                            {score.b}
                        </div>
                    </div>
                </div>
            )}

            {winner && winner !== 'TIE' && (
                <div style={{
                    fontSize: '14px', letterSpacing: '0.2em', color: '#22C55E',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    {winner.toUpperCase()} WINS
                </div>
            )}

            {winner === 'TIE' && (
                <div style={{
                    fontSize: '14px', letterSpacing: '0.2em', color: '#F59E0B',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    TIED GAME
                </div>
            )}

            <div
                onClick={onNewGame}
                style={{
                    marginTop: '16px', padding: '14px 40px',
                    border: '1px solid #2a2a2a', borderRadius: '10px',
                    background: '#0a0a0a', color: '#666',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '12px', fontWeight: 700, letterSpacing: '0.15em',
                    cursor: 'pointer', userSelect: 'none',
                }}
            >
                NEW GAME
            </div>
        </div>
    );
}