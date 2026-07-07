// src/pages/RefereeScreen.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — MASTER REFEREE SCREEN CONTROLLER v4
//
// Screen state machine:
//   SPLASH → DASHBOARD
//     → MATCH_SETUP → (ROSTER_SETUP?) → CONNECTING → PRE_GAME
//     → WATCH (stub, back → DASHBOARD)
//   PRE_GAME → LIVE_GAME ↔ SETTINGS
//   SETTINGS → END_GAME_CONFIRM → POST_GAME
//   LIVE_GAME → END_GAME_CONFIRM → POST_GAME
//   DASHBOARD (hold SETTINGS) → QUICK_GAME_CONFIRM → CONNECTING
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRefereeBox } from '../hooks/useRefereeBox';
import type { GameConfig } from '../hooks/useRefereeBox';
import { resetBoxUnit } from '../services/boxUnitService';

// Eager — these paint first / are reached on every flow
import SplashScreen from '../components/refereebox/SplashScreen';
import PiDashboard from '../components/refereebox/PiDashboard';

// Lazy — only loaded once the user actually navigates that direction.
// This drops the initial /referee bundle dramatically (Safari memory + cold-start).
const PiWatchScreen      = lazy(() => import('../components/refereebox/PiWatchScreen'));
const MatchSetup         = lazy(() => import('../components/refereebox/MatchSetup'));
const LiveScoreboard        = lazy(() => import('../components/refereebox/LockedScoreboard'));
const LiveScoreboardMinimal = lazy(() => import('../components/refereebox/LockedScoreboardMinimal'));
const SettingsPanel      = lazy(() => import('../components/refereebox/UnlockedSettings'));
const RosterSetup        = lazy(() => import('../components/refereebox/RosterSetup'));
const PhoneSetupOverlay  = lazy(() => import('../components/refereebox/PhoneSetupOverlay'));
const GameReviewScreen   = lazy(() => import('../components/refereebox/GameReviewScreen'));
const PiTouchScoring        = lazy(() => import('../components/refereebox/PiTouchScoringScreen'));
const PiTouchScoringMinimal = lazy(() => import('../components/refereebox/PiTouchScoringScreenMinimal'));

// Eager — shot attribution UIs must appear instantly the moment a basket is scored.
// Lazy-loading here causes a noticeable delay between press and popup.
// ADVANCED mode → full-court PiAdvancedShotFlow (court + player + context)
// STATS    mode → compact PiStatsPlayerPicker  (player only, modal style)
// QUICK    mode → no popup (auto-dismissed upstream)
import PiAdvancedShotFlow from '../components/refereebox/PiAdvancedShotFlow';
import PiStatsPlayerPicker from '../components/refereebox/PiStatsPlayerPicker';

import { subscribePhoneControl } from '../services/castControlService';
import { useScoreboardTheme } from '../services/scoreboardTheme';
import {
    getKeepClockOnShotViolation,
    useDisableScorePopup,
    useDisableTouchDeck,
} from '../services/gameControlPrefs';
import {
    fibaTimeoutsForPeriod,
    timeoutBucketKey,
    inLast2MinQ4Cap,
} from '../services/fibaTimeouts';

// Tiny fallback shown while a lazy chunk loads (≤200ms in practice).
// Black so it never flashes white on the kiosk.
const LazyFallback = () => (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }} />
);

// ─── Screen type ──────────────────────────────────────────────

type Screen =
    | 'splash'
    | 'dashboard'
    | 'watch'
    | 'match_setup'
    | 'game_review'
    | 'connecting'
    | 'live_game'
    | 'settings'
    | 'end_game_confirm'
    | 'quick_game_confirm'
    | 'roster_setup'
    | 'post_game'
    | 'phone_setup'
    | 'touch_scoring';

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function RefereeScreen() {
    const navigate = useNavigate();
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
        requestMiss,
        dismissScorePending,
        devPico,
    } = useRefereeBox();

    // Live scoreboard theme — toggled via Settings panel, persisted in localStorage.
    const [scoreboardTheme] = useScoreboardTheme();
    const ScoreboardComponent = scoreboardTheme === 'minimal' ? LiveScoreboardMinimal : LiveScoreboard;
    const TouchDeckComponent  = scoreboardTheme === 'minimal' ? PiTouchScoringMinimal : PiTouchScoring;
    const [disableTouchDeck]  = useDisableTouchDeck();

    const [screen, setScreen] = useState<Screen>('splash');
    const [pendingConfig, setPendingConfig] = useState<GameConfig | null>(() => {
        // ── Restore from localStorage on mount so a refresh keeps timeoutMode etc.
        try {
            const raw = localStorage.getItem('THE_BOX_PENDING_CONFIG');
            return raw ? JSON.parse(raw) as GameConfig : null;
        } catch { return null; }
    });
    const [activeGameCode, setActiveGameCode] = useState<string | null>(null);
    const [boxCode, setBoxCode] = useState<string | null>(null);
    const [possession, setPossession] = useState<'A' | 'B' | null>(null);
    const [dashboardIndex, setDashboardIndex] = useState(1); // 0=watch, 1=start (default start)
    const settingsHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Aux-screen return target ──────────────────────────────
    // When the user opens Cast / Hardware / Settings from a screen,
    // we remember where they came from so the back button returns there
    // (instead of always dropping to the dashboard).
    const [auxReturn, setAuxReturn] = useState<Screen>('dashboard');
    const openAux = useCallback((target: Screen, from: Screen) => {
        setAuxReturn(from);
        setScreen(target);
    }, []);

    // ── Phone control state ───────────────────────────────────
    const [tvCode, setTvCode] = useState<string | null>(null);
    const [livePhoneConfig, setLivePhoneConfig] = useState<Partial<GameConfig>>({});
    const activePhoneIdRef = useRef<string | null>(null);
    const screenRef = useRef<Screen>('splash');
    const [finalScore, setFinalScore] = useState<{
        a: number; b: number; teamA: string; teamB: string;
        teamAColor?: string; teamBColor?: string;
        foulsA?: number; foulsB?: number;
        period?: number; totalPeriods?: number;
        gameCode?: string; gameMode?: string;
    } | null>(null);

    // ── Load box code ─────────────────────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem('THE_BOX_UNIT_CODE');
        if (stored) setBoxCode(stored);
    }, []);

    // ── Persist pendingConfig so a browser refresh during a game
    //    doesn't lose the FIBA timeoutMode / colors / mode flags.
    useEffect(() => {
        if (pendingConfig) {
            try { localStorage.setItem('THE_BOX_PENDING_CONFIG', JSON.stringify(pendingConfig)); } catch {}
        }
    }, [pendingConfig]);

    // ── Auto-resume into live_game on refresh / cold-boot ─────
    // The daemon owns the canonical game state. If we mount and it
    // already has an active game, jump straight from splash/dashboard
    // into the live scoreboard so the ref isn't bounced back to setup.
    useEffect(() => {
        if (!gameState?.meta?.gameActive) return;
        if (screen !== 'splash' && screen !== 'dashboard') return;
        if (gameCode) setActiveGameCode(gameCode);
        setScreen('live_game');
    }, [gameState?.meta?.gameActive, gameCode, screen]);

    // ── Keep screenRef in sync (for stale-closure safety) ────
    useEffect(() => { screenRef.current = screen; }, [screen]);

    // ── Load tvCode once SplashScreen has created it ─────────
    useEffect(() => {
        const code = localStorage.getItem('tv_kiosk_code');
        if (code) setTvCode(code);
    }, []);

    // ── Re-check tvCode after splash completes ────────────────
    // SplashScreen writes tv_kiosk_code on its first render. By the time
    // screen transitions to 'dashboard', the key is guaranteed to exist.
    useEffect(() => {
        if (screen === 'dashboard' && !tvCode) {
            const code = localStorage.getItem('tv_kiosk_code');
            if (code) setTvCode(code);
        }
    }, [screen, tvCode]);

    // ── Phone control subscription ────────────────────────────
    useEffect(() => {
        if (!tvCode) return;
        const unsub = subscribePhoneControl(tvCode, (event) => {
            if (event.event === 'phone-connected') {
                activePhoneIdRef.current = event.phoneId;
                setLivePhoneConfig({});
                // Remember where the user was so cancelling phone-setup returns there
                setAuxReturn(screenRef.current);
                setScreen('phone_setup');
                return;
            }
            if (event.event === 'config-update') {
                setLivePhoneConfig(event.config);
                return;
            }
            if (event.event === 'setup-start') {
                setPendingConfig(event.config);
                setupGame(event.config);
                setLivePhoneConfig({});
                setScreen('connecting');
                return;
            }
            if (event.event === 'watch-game') {
                setAuxReturn(screenRef.current);
                setScreen('watch');
                return;
            }
            if (event.event === 'phone-disconnected') {
                activePhoneIdRef.current = null;
                setLivePhoneConfig({});
                if (screenRef.current === 'phone_setup') setScreen(auxReturn);
                return;
            }
        });
        return unsub;
    }, [tvCode, setupGame, auxReturn]);

    // ── Hardware button navigation ────────────────────────────
    useEffect(() => {
        const handler = (e: Event) => {
            const msg = (e as CustomEvent).detail as string;

            // SPLASH — any button skips splash
            if (screen === 'splash') {
                handleSplashComplete();
                return;
            }

            // DASHBOARD — Score A=watch, Score B=start, Shot Clock=confirm.
            // Messages match the daemon's SCORE_MESSAGES vocabulary (SCORE_A1 …),
            // which is what the Pico actually sends, so hardware buttons (and the
            // dev keyboard) drive the menu.
            if (screen === 'dashboard') {
                if (msg === 'SCORE_A1' || msg === 'SCORE_A2' || msg === 'SCORE_A3') {
                    setDashboardIndex(0); // watch
                } else if (msg === 'SCORE_B1' || msg === 'SCORE_B2' || msg === 'SCORE_B3') {
                    setDashboardIndex(1); // start
                } else if (msg === 'SHOT_CLOCK_24' || msg === 'SHOT_CLOCK_14') {
                    if (dashboardIndex === 0) {
                        openAux('watch', 'dashboard');
                    } else {
                        setScreen('match_setup');
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

    // ── Score popup gating ────────────────────────────────────
    // - "Disable score popup" pref ON  → dismiss every popup (refs only see score change).
    // - +1 free throws                 → keep the player picker so attribution still works;
    //                                    PiAdvancedShotFlow skips the court step internally.
    const [disablePopup] = useDisableScorePopup();
    useEffect(() => {
        if (!scorePending) return;
        if (disablePopup) {
            dismissScorePending();
        }
    }, [scorePending, disablePopup]);

    // ── Touch deck ↔ daemon unlock ────────────────────────────
    // The daemon rejects every ui_action while touch is locked. Unlock while in
    // touch_scoring OR settings so that the manual override controls actually work.
    // Re-lock when leaving both screens entirely.
    useEffect(() => {
        if (screen !== 'touch_scoring' && screen !== 'settings') return;
        sendAction('UNLOCK_TOUCH');
        return () => { sendAction('LOCK_TOUCH'); };
    }, [screen, sendAction]);

    // ── CONNECTING → LIVE_GAME ───────────────────────────────
    useEffect(() => {
        if (screen === 'connecting' && gameCode && !isSettingUp && !setupError) {
            setActiveGameCode(gameCode);
            setScreen('live_game');
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
    // Mirror to local state for instant UI response; always forward to daemon
    // so the spectator screen (HDMI 2) sees possession changes via broadcast.
    // ── Shot-clock violation auto-resume ──────────────────────
    // The running daemon stops the game clock when the shot clock hits 0.
    // When the "keep game clock running" pref is on (default), immediately
    // re-issue CLOCK_START so only the shot clock is dead and the refs see
    // it blinking until they hit the 24/14 reset.
    const wasRunningRef = useRef(false);
    const prevShotMsRef = useRef<number | null>(null);
    useEffect(() => {
        const clk = gameState?.clock;
        if (!clk) return;
        const prevShot = prevShotMsRef.current;
        const wasRunning = wasRunningRef.current;
        const shotJustHitZero = prevShot !== null && prevShot > 0 && clk.shotMs === 0;
        const periodNotOver = clk.gameMs > 0;
        // Only auto-resume if (a) clock was running before this tick, (b) shot
        // clock just transitioned to 0, (c) game clock has time left, (d) daemon
        // has paused (isRunning is now false), and (e) the pref says to keep it
        // running.
        if (shotJustHitZero && wasRunning && periodNotOver && !clk.isRunning && getKeepClockOnShotViolation()) {
            devPico('CLOCK_START');
        }
        prevShotMsRef.current = clk.shotMs;
        wasRunningRef.current = clk.isRunning;
    }, [gameState?.clock, devPico]);

    const handleSendAction = useCallback((type: string, payload: Record<string, unknown> = {}) => {
        if (type === 'SET_POSSESSION') {
            setPossession((payload.team as 'A' | 'B') ?? null);
        }
        // The currently-running daemon handles CLOCK_TOGGLE/START/STOP via the
        // Pico UART pipeline (handlePicoMessage), not via ui_action. Route these
        // through devPico so the touch deck works without a daemon restart.
        if (type === 'CLOCK_TOGGLE' || type === 'CLOCK_START' || type === 'CLOCK_STOP') {
            devPico(type);
            return;
        }
        sendAction(type, payload);
    }, [sendAction, devPico]);

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

    // ── FIBA timeout bucket reset on period change ────────────
    // When the period crosses a bucket boundary (H1→H2, H2→OT, OT→OT),
    // the daemon's flat `team.timeouts` field needs to be refilled to
    // the new bucket's allotment (2 / 3 / 1). RefereeScreen owns this
    // because the daemon doesn't know about FIBA bucket semantics.
    const prevPeriodRef = useRef<number | null>(null);
    useEffect(() => {
        if (!gameState?.meta?.gameActive) return;
        if (pendingConfig?.timeoutMode !== 'fiba') return;

        const period = gameState.clock.period;
        const total  = gameState.clock.totalPeriods;
        const prev   = prevPeriodRef.current;

        if (prev !== null && prev !== period) {
            const prevBucket = timeoutBucketKey(prev, total);
            const newBucket  = timeoutBucketKey(period, total);
            if (prevBucket !== newBucket) {
                const target = fibaTimeoutsForPeriod(period, total);
                const dA = target - gameState.teamA.timeouts;
                const dB = target - gameState.teamB.timeouts;
                if (dA !== 0) sendAction('EDIT_TIMEOUTS', { team: 'teamA', amount: dA });
                if (dB !== 0) sendAction('EDIT_TIMEOUTS', { team: 'teamB', amount: dB });
            }
        }
        prevPeriodRef.current = period;
    }, [gameState?.clock?.period]);

    // ── FIBA "last 2:00 of Q4" cap (max 2 timeouts remaining) ─
    // Fires once when the game clock crosses 2:00 in the final regulation period.
    const last2MinClampedRef = useRef(false);
    useEffect(() => {
        if (!gameState?.meta?.gameActive) return;
        if (pendingConfig?.timeoutMode !== 'fiba') return;

        const { period, totalPeriods, gameMs } = gameState.clock;
        if (!inLast2MinQ4Cap(period, totalPeriods, gameMs)) {
            // reset the latch when we're no longer in the window
            // (e.g. the ref bumped the clock back above 2:00 manually)
            if (gameMs > 120_000) last2MinClampedRef.current = false;
            return;
        }
        if (last2MinClampedRef.current) return;
        last2MinClampedRef.current = true;

        const dA = Math.min(0, 2 - gameState.teamA.timeouts);
        const dB = Math.min(0, 2 - gameState.teamB.timeouts);
        if (dA < 0) sendAction('EDIT_TIMEOUTS', { team: 'teamA', amount: dA });
        if (dB < 0) sendAction('EDIT_TIMEOUTS', { team: 'teamB', amount: dB });
    }, [gameState?.clock?.gameMs, gameState?.clock?.period]);

    // Reset bucket-tracking refs when a new game starts
    useEffect(() => {
        if (!gameState?.meta?.gameActive) {
            prevPeriodRef.current = null;
            last2MinClampedRef.current = false;
        }
    }, [gameState?.meta?.gameActive]);

    // ── Cache score while live (updated on every score change) ──
    useEffect(() => {
        if (gameState?.meta?.gameActive) {
            setFinalScore({
                a: gameState.teamA.score,
                b: gameState.teamB.score,
                teamA: gameState.teamA.name,
                teamB: gameState.teamB.name,
                teamAColor: gameState.teamA.color,
                teamBColor: gameState.teamB.color,
                foulsA: gameState.teamA.fouls,
                foulsB: gameState.teamB.fouls,
                period: gameState.clock.period,
                totalPeriods: gameState.clock.totalPeriods,
                gameCode: gameState.meta.gameCode ?? undefined,
                gameMode: gameState.meta.gameMode,
            });
        }
    }, [gameState?.teamA.score, gameState?.teamB.score]);

    // ── Handlers ──────────────────────────────────────────────

    const handleSplashComplete = useCallback(() => setScreen('dashboard'), []);

    const handlePhoneCancelled = useCallback(() => {
        activePhoneIdRef.current = null;
        setLivePhoneConfig({});
        setScreen(auxReturn);
        // Keep subscription alive — ready for next phone connection
    }, [auxReturn]);

    const handleSetupConfirm = useCallback((config: GameConfig) => {
        setPendingConfig(config);
        if (config.gameMode === 'stats' || config.gameMode === 'advanced') {
            setScreen('roster_setup');
        } else {
            setScreen('connecting');
            setupGame(config);
        }
    }, [setupGame]);

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
                teamAColor: gameState.teamA.color,
                teamBColor: gameState.teamB.color,
                foulsA: gameState.teamA.fouls,
                foulsB: gameState.teamB.fouls,
                period: gameState.clock.period,
                totalPeriods: gameState.clock.totalPeriods,
                gameCode: gameState.meta.gameCode ?? undefined,
                gameMode: gameState.meta.gameMode,
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
        try { localStorage.removeItem('THE_BOX_PENDING_CONFIG'); } catch {}
        setPendingConfig(null);
        setFinalScore(null);
        setActiveGameCode(null);
        setPossession(null);
        setDashboardIndex(1);
        setScreen('dashboard');
    }, []);

    // "PAUSE & EXIT" — leave the game running on the daemon, drop the ref
    // back to the dashboard. The auto-resume effect will bring them right
    // back into live_game next time they land on splash/dashboard or refresh.
    const handlePauseAndExit = useCallback(() => {
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

    const renderScreen = (): React.ReactNode => {
    switch (screen) {

        case 'splash':
            return <SplashScreen isDaemonConnected={isConnected} onComplete={handleSplashComplete} />;

        case 'dashboard':
            return (
                <PiDashboard
                    onSelectWatch={() => openAux('watch', 'dashboard')}
                    onSelectStart={() => setScreen('match_setup')}
                    onSelectArena={(code) => navigate(`/arena/${code.toUpperCase()}`)}
                    selectedIndex={dashboardIndex}
                />
            );

        case 'watch':
            return (
                <PiWatchScreen
                    onBack={() => setScreen(auxReturn)}
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

        case 'match_setup':
            return (
                <MatchSetup
                    onConfirm={handleSetupConfirm}
                    onBack={() => setScreen('dashboard')}
                />
            );

        case 'roster_setup':
            return pendingConfig ? (
                <RosterSetup
                    config={pendingConfig as Parameters<typeof RosterSetup>[0]['config']}
                    onConfirm={(finalConfig) => {
                        setPendingConfig(finalConfig as GameConfig);
                        setScreen('game_review');
                    }}
                    onBack={() => setScreen('match_setup')}
                />
            ) : null;

        case 'game_review':
            return pendingConfig ? (
                <>
                    {/* RosterSetup sits frozen behind the modal — gives visual context */}
                    <div style={{ pointerEvents: 'none', filter: 'brightness(0.35)' }}>
                        <RosterSetup
                            config={pendingConfig as Parameters<typeof RosterSetup>[0]['config']}
                            onConfirm={() => {}}
                            onBack={() => {}}
                        />
                    </div>
                    <GameReviewScreen
                        config={pendingConfig}
                        isConnected={isConnected}
                        onConfirm={() => {
                            setScreen('connecting');
                            setupGame(pendingConfig);
                        }}
                        onBack={() => setScreen('roster_setup')}
                    />
                </>
            ) : null;

        case 'connecting':
            return (
                <ConnectingScreen
                    config={pendingConfig}
                    error={setupError}
                    onRetry={handleRetry}
                    onBack={() => setScreen('dashboard')}
                />
            );

        case 'live_game':
            if (!gameState) return <DaemonReconnectingScreen />;
            // ADVANCED mode → full-screen court flow takes over the display.
            if (scorePending && gameState.meta.gameMode === 'advanced') {
                return (
                    <PiAdvancedShotFlow
                        // Key forces a clean remount when a new score event lands
                        // mid-attribution, so a half-completed flow can't leak
                        // its court/player selections into the new event.
                        key={`${scorePending.team}-${scorePending.points}-${gameState.teamA.score}-${gameState.teamB.score}`}
                        event={scorePending}
                        teamA={gameState.teamA}
                        teamB={gameState.teamB}
                        teamAColor={teamAColor}
                        teamBColor={teamBColor}
                        clock={gameState.clock}
                        gameCode={displayGameCode ?? undefined}
                        onAttribute={attributeShot}
                        onSkip={dismissScorePending}
                        onUndo={() => sendAction('UNDO')}
                    />
                );
            }
            // STATS mode → compact player-picker modal overlays the live scoreboard.
            return (
                <>
                <ScoreboardComponent
                    teamA={gameState.teamA}
                    teamB={gameState.teamB}
                    clock={gameState.clock}
                    possession={possession}
                    canUndo={true}
                    teamAColor={teamAColor}
                    teamBColor={teamBColor}
                    isConnected={isConnected}
                    isTouchUnlocked={gameState.ui?.isTouchUnlocked}
                    undoFlash={undoFlash}
                    settingsFlash={settingsFlash}
                    gameMode={gameState.meta?.gameMode}
                    gameCode={displayGameCode ?? undefined}
                    onCast={() => openAux('watch', 'live_game')}
                    onConnectHardware={() => openAux('phone_setup', 'live_game')}
                    onSettings={() => setScreen('settings')}
                    onEndGame={handleEndGameRequest}
                    onUnlockTouchScoring={disableTouchDeck ? undefined : () => setScreen('touch_scoring')}
                />
                {scorePending && gameState.meta.gameMode === 'stats' && (
                    <PiStatsPlayerPicker
                        // Key forces a clean remount on each new score event so
                        // rapid back-to-back baskets each get a fresh countdown.
                        key={`${scorePending.team}-${scorePending.points}-${gameState.teamA.score}-${gameState.teamB.score}`}
                        event={scorePending}
                        teamA={gameState.teamA}
                        teamB={gameState.teamB}
                        teamAColor={teamAColor}
                        teamBColor={teamBColor}
                        clock={gameState.clock}
                        onAttribute={attributeShot}
                        onSkip={dismissScorePending}
                    />
                )}
                </>
            );

        case 'settings':
            return gameState ? (
                <SettingsPanel
                    teamA={gameState.teamA}
                    teamB={gameState.teamB}
                    clock={gameState.clock}
                    possession={possession}
                    teamAColor={teamAColor}
                    teamBColor={teamBColor}
                    isConnected={isConnected}
                    gameCode={displayGameCode ?? undefined}
                    sendAction={handleSendAction}
                    onEndGame={handleEndGameRequest}
                    onClose={() => setScreen('live_game')}
                    onCast={() => openAux('watch', 'settings')}
                    onConnectHardware={() => openAux('phone_setup', 'settings')}
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
                    onPauseExit={handlePauseAndExit}
                />
            );

        case 'post_game':
            return <PostGameScreen score={finalScore} onNewGame={handleNewGame} />;

        case 'touch_scoring':
            if (!gameState) return <DaemonReconnectingScreen />;
            // ADVANCED mode → full-screen court flow.
            if (scorePending && gameState.meta.gameMode === 'advanced') {
                return (
                    <PiAdvancedShotFlow
                        // Remount on each new score event (see live_game note).
                        key={`${scorePending.team}-${scorePending.points}-${gameState.teamA.score}-${gameState.teamB.score}`}
                        event={scorePending}
                        teamA={gameState.teamA}
                        teamB={gameState.teamB}
                        teamAColor={teamAColor}
                        teamBColor={teamBColor}
                        clock={gameState.clock}
                        gameCode={displayGameCode ?? undefined}
                        onAttribute={attributeShot}
                        onSkip={dismissScorePending}
                        onUndo={() => sendAction('UNDO')}
                    />
                );
            }
            // STATS mode → player-picker modal overlays the touch deck.
            return (
                <>
                <TouchDeckComponent
                    teamA={gameState.teamA}
                    teamB={gameState.teamB}
                    clock={gameState.clock}
                    possession={possession}
                    teamAColor={teamAColor}
                    teamBColor={teamBColor}
                    isConnected={isConnected}
                    gameCode={displayGameCode ?? undefined}
                    sendAction={handleSendAction}
                    onClose={() => setScreen('live_game')}
                    onCast={() => openAux('watch', 'touch_scoring')}
                    onConnectHardware={() => openAux('phone_setup', 'touch_scoring')}
                    onSettings={() => setScreen('settings')}
                    onEndGame={handleEndGameRequest}
                    onLogMiss={gameState.meta.gameMode === 'advanced' ? requestMiss : undefined}
                />
                {scorePending && gameState.meta.gameMode === 'stats' && (
                    <PiStatsPlayerPicker
                        // Key forces a clean remount on each new score event so
                        // rapid back-to-back baskets each get a fresh countdown.
                        key={`${scorePending.team}-${scorePending.points}-${gameState.teamA.score}-${gameState.teamB.score}`}
                        event={scorePending}
                        teamA={gameState.teamA}
                        teamB={gameState.teamB}
                        teamAColor={teamAColor}
                        teamBColor={teamBColor}
                        clock={gameState.clock}
                        onAttribute={attributeShot}
                        onSkip={dismissScorePending}
                    />
                )}
                </>
            );

        case 'phone_setup':
            return tvCode ? (
                <PhoneSetupOverlay
                    liveConfig={livePhoneConfig}
                    tvCode={tvCode}
                    onCancel={handlePhoneCancelled}
                />
            ) : null;

        default:
            return null;
    }
    };

    return (
        <Suspense fallback={<LazyFallback />}>
            {renderScreen()}
        </Suspense>
    );
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
            gap: '24px',
            border: '2px solid #F59E0B',
            position: 'relative',
        }}>
            {/* FUI corner accents */}
            {([
                { top: 20, left: 20, borderRight: 'none', borderBottom: 'none' },
                { top: 20, right: 20, borderLeft: 'none', borderBottom: 'none' },
                { bottom: 20, left: 20, borderRight: 'none', borderTop: 'none' },
                { bottom: 20, right: 20, borderLeft: 'none', borderTop: 'none' },
            ] as const).map((s, i) => (
                <div key={i} style={{
                    position: 'absolute', width: 16, height: 16,
                    border: '2px solid #F59E0B', pointerEvents: 'none', ...s,
                }} />
            ))}

            {/* Header bar */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '40px',
                background: 'linear-gradient(90deg, #0e0900, #1a1000, #0e0900)',
                borderBottom: '1px solid #F59E0B',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            }}>
                <div style={{
                    width: '6px', height: '6px',
                    background: '#F59E0B', animation: 'qgPulse 1s infinite',
                }} />
                <span style={{
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.28em',
                    color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace",
                    textTransform: 'uppercase',
                }}>
                    QUICK GAME
                </span>
                <div style={{
                    width: '6px', height: '6px',
                    background: '#F59E0B', animation: 'qgPulse 1s infinite',
                }} />
            </div>

            {/* Label */}
            <div style={{
                marginTop: '40px',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
                color: '#444', letterSpacing: '0.28em', textTransform: 'uppercase',
            }}>
                START A QUICK GAME?
            </div>

            {/* Teams */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '8px',
                        color: '#3B82F6', letterSpacing: '0.22em', marginBottom: '8px',
                        textTransform: 'uppercase',
                    }}>TEAM A</div>
                    <div style={{
                        width: 64, height: 64,
                        background: '#3B82F610',
                        border: '2px solid #3B82F644',
                        borderLeft: '4px solid #3B82F6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Oswald', sans-serif", fontSize: '32px',
                        fontWeight: 700, fontStyle: 'italic', color: '#3B82F6',
                    }}>A</div>
                </div>

                <div style={{
                    fontFamily: "'Oswald', sans-serif", fontSize: '28px',
                    color: '#1a1a1a', fontWeight: 700, fontStyle: 'italic',
                    letterSpacing: '0.05em',
                }}>VS</div>

                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '8px',
                        color: '#EF4444', letterSpacing: '0.22em', marginBottom: '8px',
                        textTransform: 'uppercase',
                    }}>TEAM B</div>
                    <div style={{
                        width: 64, height: 64,
                        background: '#EF444410',
                        border: '2px solid #EF444444',
                        borderRight: '4px solid #EF4444',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Oswald', sans-serif", fontSize: '32px',
                        fontWeight: 700, fontStyle: 'italic', color: '#EF4444',
                    }}>B</div>
                </div>
            </div>

            {/* Config summary */}
            <div style={{
                display: 'flex', gap: '16px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '9px', color: '#444', letterSpacing: '0.12em',
                textTransform: 'uppercase',
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '7px 20px',
            }}>
                <span>4 × 10 MIN</span>
                <span style={{ color: '#1a1a1a' }}>·</span>
                <span>24S SHOT CLOCK</span>
                <span style={{ color: '#1a1a1a' }}>·</span>
                <span>QUICK MODE</span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
                <div
                    onClick={onCancel}
                    style={{
                        padding: '12px 28px',
                        border: '1px solid rgba(255,255,255,0.12)', background: '#080808',
                        color: '#555', fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        cursor: 'pointer', userSelect: 'none',
                    }}
                    onTouchStart={e => { (e.currentTarget as HTMLElement).style.background = '#111'; }}
                    onTouchEnd={e => { (e.currentTarget as HTMLElement).style.background = '#080808'; }}
                >
                    ← CANCEL
                </div>
                <div
                    onClick={onConfirm}
                    style={{
                        padding: '12px 28px',
                        border: '2px solid #F59E0B', background: '#F59E0B',
                        color: '#000', fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        cursor: 'pointer', userSelect: 'none',
                    }}
                    onTouchStart={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                    onTouchEnd={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                >
                    START GAME →
                </div>
            </div>

            <style>{`
                @keyframes qgPulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
            `}</style>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// END GAME CONFIRMATION SCREEN
// ═══════════════════════════════════════════════════════════════

function EndGameConfirmScreen({
    teamA, teamB, scoreA, scoreB, period, totalPeriods,
    teamAColor, teamBColor, onConfirm, onCancel, onPauseExit,
}: {
    teamA: string; teamB: string;
    scoreA: number; scoreB: number;
    period: number; totalPeriods: number;
    teamAColor: string; teamBColor: string;
    onConfirm: () => void;
    onCancel: () => void;
    onPauseExit?: () => void;
}) {
    const [confirmCount, setConfirmCount] = useState(0);
    const winner = scoreA > scoreB ? teamA : scoreA < scoreB ? teamB : null;

    const getPeriodLabel = (p: number, total: number) => {
        if (total === 2) return p <= 2 ? `H${p}` : `OT${p - 2}`;
        return p <= 4 ? `Q${p}` : `OT${p - 4}`;
    };

    const handleConfirmTap = () => {
        if (confirmCount === 0) setConfirmCount(1);
        else onConfirm();
    };

    const RM = "'JetBrains Mono', monospace";
    const OSW = "'Oswald', sans-serif";

    return (
        <div style={{
            width: '100vw', height: '100vh', background: '#000',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '28px',
            border: '2px solid #EF4444',
            position: 'relative',
        }}>
            {/* FUI corner accents */}
            {([
                { top: 20, left: 20, borderRight: 'none', borderBottom: 'none' },
                { top: 20, right: 20, borderLeft: 'none', borderBottom: 'none' },
                { bottom: 20, left: 20, borderRight: 'none', borderTop: 'none' },
                { bottom: 20, right: 20, borderLeft: 'none', borderTop: 'none' },
            ] as const).map((s, i) => (
                <div key={i} style={{
                    position: 'absolute', width: 16, height: 16,
                    border: '2px solid #EF4444', pointerEvents: 'none', ...s,
                }} />
            ))}

            {/* Warning header */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '40px',
                background: 'linear-gradient(90deg, #110000, #1a0000, #110000)',
                borderBottom: '1px solid #EF4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            }}>
                <div style={{ width: '6px', height: '6px', background: '#EF4444', animation: 'pulse 0.8s infinite' }} />
                <span style={{
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.28em',
                    color: '#EF4444', fontFamily: RM, textTransform: 'uppercase',
                }}>
                    END GAME — CHOOSE ACTION
                </span>
                <div style={{ width: '6px', height: '6px', background: '#EF4444', animation: 'pulse 0.8s infinite' }} />
            </div>

            {/* Period label */}
            <div style={{
                marginTop: '40px',
                fontFamily: RM, fontSize: '9px',
                color: '#444', letterSpacing: '0.28em', textTransform: 'uppercase',
            }}>
                {getPeriodLabel(period, totalPeriods)} IN PROGRESS
            </div>

            {/* Score display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        fontFamily: RM, fontSize: '10px', letterSpacing: '0.18em',
                        color: teamAColor, marginBottom: '8px', textTransform: 'uppercase',
                    }}>{teamA}</div>
                    <div style={{
                        fontFamily: OSW, fontStyle: 'italic',
                        fontSize: '88px', fontWeight: 700, color: '#fff', lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                    }}>{scoreA}</div>
                </div>

                <div style={{
                    fontFamily: OSW, fontSize: '36px', color: '#1a1a1a',
                    fontWeight: 700, fontStyle: 'italic',
                }}>—</div>

                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        fontFamily: RM, fontSize: '10px', letterSpacing: '0.18em',
                        color: teamBColor, marginBottom: '8px', textTransform: 'uppercase',
                    }}>{teamB}</div>
                    <div style={{
                        fontFamily: OSW, fontStyle: 'italic',
                        fontSize: '88px', fontWeight: 700, color: '#fff', lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                    }}>{scoreB}</div>
                </div>
            </div>

            {/* Winner / tie indicator */}
            {winner && (
                <div style={{
                    fontFamily: RM, fontSize: '10px', color: '#22C55E',
                    letterSpacing: '0.28em', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <div style={{ width: 6, height: 6, background: '#22C55E' }} />
                    {winner.toUpperCase()} LEADS
                </div>
            )}

            {scoreA === scoreB && (
                <div style={{
                    fontFamily: RM, fontSize: '10px', color: '#F59E0B',
                    letterSpacing: '0.22em', textTransform: 'uppercase',
                    border: '1px solid #F59E0B33', padding: '5px 16px',
                }}>
                    TIED GAME — END ANYWAY?
                </div>
            )}

            {/* Action buttons — CANCEL · PAUSE & EXIT · END & DECLARE */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div
                    onClick={onCancel}
                    style={{
                        padding: '14px 28px',
                        border: '1px solid rgba(255,255,255,0.12)', background: '#080808',
                        color: '#888', fontFamily: RM,
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        cursor: 'pointer', userSelect: 'none',
                    }}
                    onTouchStart={e => { (e.currentTarget as HTMLElement).style.background = '#111'; }}
                    onTouchEnd={e => { (e.currentTarget as HTMLElement).style.background = '#080808'; }}
                >
                    ← CANCEL
                </div>

                {onPauseExit && (
                    <div
                        onClick={onPauseExit}
                        style={{
                            padding: '14px 28px',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 4,
                            border: '2px solid #F59E0B',
                            background: 'rgba(245,158,11,0.1)',
                            color: '#F59E0B', fontFamily: RM,
                            fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            cursor: 'pointer', userSelect: 'none',
                            transition: 'all 0.15s',
                            minWidth: 200, textAlign: 'center',
                            boxShadow: '0 0 14px rgba(245,158,11,0.25)',
                        }}
                        onTouchStart={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                        onTouchEnd={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                    >
                        <span>PAUSE &amp; EXIT</span>
                        <span style={{ fontSize: 7, color: 'rgba(245,158,11,0.7)', letterSpacing: '0.22em' }}>
                            GAME STAYS LIVE · RESUME LATER
                        </span>
                    </div>
                )}

                <div
                    onClick={handleConfirmTap}
                    style={{
                        padding: '14px 28px',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 4,
                        border: `2px solid ${confirmCount === 1 ? '#EF4444' : '#5a0000'}`,
                        background: confirmCount === 1 ? '#EF4444' : '#0e0000',
                        color: confirmCount === 1 ? '#000' : '#EF4444',
                        fontFamily: RM,
                        fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        cursor: 'pointer', userSelect: 'none',
                        transition: 'all 0.15s',
                        minWidth: 220, textAlign: 'center',
                    }}
                    onTouchStart={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                    onTouchEnd={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                >
                    {confirmCount === 0 ? (
                        <>
                            <span>END &amp; DECLARE</span>
                            <span style={{
                                fontSize: 7,
                                color: 'rgba(239,68,68,0.7)',
                                letterSpacing: '0.22em',
                            }}>
                                FINALIZE RESULT · NO UNDO
                            </span>
                        </>
                    ) : (
                        <span>TAP AGAIN TO CONFIRM</span>
                    )}
                </div>
            </div>

            <div style={{
                fontFamily: RM, fontSize: '8px', color: '#1e1e1e',
                letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>
                PAUSE KEEPS THE GAME RUNNING ON THE BOX
            </div>

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
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
    const RM = "'JetBrains Mono', monospace";
    const OSW = "'Oswald', sans-serif";
    const AMBER = '#F59E0B';
    const RED = '#EF4444';
    const borderColor = error ? RED : AMBER;

    return (
        <div style={{
            width: '100vw', height: '100vh', background: '#000',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${borderColor}`,
            position: 'relative', overflow: 'hidden',
        }}>
            {/* FUI corner brackets */}
            {([
                { top: 20, left: 20, borderRight: 'none', borderBottom: 'none' },
                { top: 20, right: 20, borderLeft: 'none', borderBottom: 'none' },
                { bottom: 20, left: 20, borderRight: 'none', borderTop: 'none' },
                { bottom: 20, right: 20, borderLeft: 'none', borderTop: 'none' },
            ] as const).map((s, i) => (
                <div key={i} style={{
                    position: 'absolute', width: 16, height: 16,
                    border: `2px solid ${borderColor}`, pointerEvents: 'none', ...s,
                }} />
            ))}

            {/* Header bar */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '40px',
                background: error
                    ? 'linear-gradient(90deg, #110000, #1a0000, #110000)'
                    : 'linear-gradient(90deg, #0e0900, #1a1000, #0e0900)',
                borderBottom: `1px solid ${borderColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            }}>
                <div style={{ width: '6px', height: '6px', background: borderColor, animation: 'cxPulse 0.9s infinite' }} />
                <span style={{
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.28em',
                    color: borderColor, fontFamily: RM, textTransform: 'uppercase',
                }}>
                    {error ? 'CONNECTION ERROR' : 'ESTABLISHING SESSION'}
                </span>
                <div style={{ width: '6px', height: '6px', background: borderColor, animation: 'cxPulse 0.9s infinite' }} />
            </div>

            {!error ? (
                /* ── Loading state ───────────────────────────────── */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', marginTop: '40px' }}>

                    {/* Scanning bar array */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '200px' }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{ position: 'relative', height: '4px', background: '#0d0d0d', overflow: 'hidden' }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, height: '100%', width: '60%',
                                    background: `linear-gradient(90deg, transparent, ${AMBER}, transparent)`,
                                    animation: `cxScan 1.4s ease-in-out ${i * 0.18}s infinite`,
                                }} />
                            </div>
                        ))}
                    </div>

                    {/* Status text */}
                    <div style={{
                        fontFamily: RM, fontSize: '12px', color: AMBER,
                        letterSpacing: '0.22em', textTransform: 'uppercase',
                    }}>
                        STARTING GAME...
                    </div>

                    {/* Team matchup */}
                    {config && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <span style={{
                                fontFamily: OSW, fontSize: '18px', fontWeight: 700,
                                fontStyle: 'italic', color: config.teamAColor || '#3B82F6',
                                letterSpacing: '0.08em', textTransform: 'uppercase',
                            }}>{config.teamAName}</span>
                            <span style={{
                                fontFamily: RM, fontSize: '9px', color: '#333',
                                letterSpacing: '0.2em',
                            }}>VS</span>
                            <span style={{
                                fontFamily: OSW, fontSize: '18px', fontWeight: 700,
                                fontStyle: 'italic', color: config.teamBColor || '#EF4444',
                                letterSpacing: '0.08em', textTransform: 'uppercase',
                            }}>{config.teamBName}</span>
                        </div>
                    )}

                    {/* Dim status indicators */}
                    <div style={{ display: 'flex', gap: '24px' }}>
                        {['DAEMON', 'SESSION', 'SYNC'].map((label, i) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                    width: 5, height: 5, background: AMBER,
                                    animation: `cxPulse 0.9s ${i * 0.3}s infinite`,
                                }} />
                                <span style={{
                                    fontFamily: RM, fontSize: '8px', color: '#333',
                                    letterSpacing: '0.18em', textTransform: 'uppercase',
                                }}>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* ── Error state ─────────────────────────────────── */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', marginTop: '40px' }}>
                    {/* Error box */}
                    <div style={{
                        border: '1px solid #5a0000', background: '#0a0000',
                        padding: '16px 32px', maxWidth: '360px', textAlign: 'center',
                    }}>
                        <div style={{
                            fontFamily: RM, fontSize: '8px', color: '#5a0000',
                            letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '8px',
                        }}>DAEMON ERROR</div>
                        <div style={{
                            fontFamily: RM, fontSize: '11px', color: RED,
                            letterSpacing: '0.08em',
                        }}>{error}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div
                            onClick={onBack}
                            style={{
                                padding: '12px 28px',
                                border: '1px solid rgba(255,255,255,0.1)', background: '#080808',
                                color: '#444', fontFamily: RM,
                                fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
                                textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none',
                            }}
                            onTouchStart={e => { (e.currentTarget as HTMLElement).style.background = '#111'; }}
                            onTouchEnd={e => { (e.currentTarget as HTMLElement).style.background = '#080808'; }}
                        >← BACK</div>
                        <div
                            onClick={onRetry}
                            style={{
                                padding: '12px 28px',
                                border: `2px solid ${AMBER}`, background: AMBER,
                                color: '#000', fontFamily: RM,
                                fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
                                textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none',
                            }}
                            onTouchStart={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                            onTouchEnd={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                        >RETRY →</div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes cxPulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
                @keyframes cxScan { 0%{transform:translateX(-120%)} 100%{transform:translateX(280%)} }
            `}</style>
        </div>
    );
}

function DaemonReconnectingScreen() {
    const RM = "'JetBrains Mono', monospace";
    const AMBER = '#F59E0B';

    return (
        <div style={{
            width: '100vw', height: '100vh', background: '#000',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '28px',
            border: '1px solid rgba(245,158,11,0.25)',
            position: 'relative',
        }}>
            {/* FUI corner brackets — dim amber */}
            {([
                { top: 20, left: 20, borderRight: 'none', borderBottom: 'none' },
                { top: 20, right: 20, borderLeft: 'none', borderBottom: 'none' },
                { bottom: 20, left: 20, borderRight: 'none', borderTop: 'none' },
                { bottom: 20, right: 20, borderLeft: 'none', borderTop: 'none' },
            ] as const).map((s, i) => (
                <div key={i} style={{
                    position: 'absolute', width: 16, height: 16,
                    border: '2px solid rgba(245,158,11,0.4)', pointerEvents: 'none', ...s,
                }} />
            ))}

            {/* Header */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '36px',
                borderBottom: '1px solid rgba(245,158,11,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <span style={{
                    fontFamily: RM, fontSize: '9px', color: 'rgba(245,158,11,0.4)',
                    letterSpacing: '0.28em', textTransform: 'uppercase',
                }}>DAEMON LINK LOST</span>
            </div>

            {/* Spinner in a sharp frame */}
            <div style={{
                width: '72px', height: '72px',
                border: '1px solid rgba(245,158,11,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
            }}>
                <div style={{
                    width: '36px', height: '36px',
                    border: '2px solid rgba(245,158,11,0.15)',
                    borderTop: `2px solid ${AMBER}`,
                    borderRadius: '50%',
                    animation: 'drSpin 1s linear infinite',
                }} />
            </div>

            {/* Status */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    fontFamily: RM, fontSize: '12px', color: AMBER,
                    letterSpacing: '0.22em', textTransform: 'uppercase',
                    animation: 'drPulse 1.5s ease-in-out infinite',
                }}>
                    RECONNECTING TO DAEMON...
                </div>
                <div style={{
                    fontFamily: RM, fontSize: '8px', color: '#2a2a2a',
                    letterSpacing: '0.18em', textTransform: 'uppercase',
                }}>
                    GAME PAUSED — WAITING FOR SIGNAL
                </div>
            </div>

            <style>{`
                @keyframes drSpin { to { transform: rotate(360deg); } }
                @keyframes drPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
            `}</style>
        </div>
    );
}

function PostGameScreen({ score, onNewGame }: {
    score: {
        a: number; b: number; teamA: string; teamB: string;
        teamAColor?: string; teamBColor?: string;
        foulsA?: number; foulsB?: number;
        period?: number; totalPeriods?: number;
        gameCode?: string; gameMode?: string;
    } | null;
    onNewGame: () => void;
}) {
    const RM = "'JetBrains Mono', monospace";
    const OSW = "'Oswald', sans-serif";
    const winner = score
        ? score.a > score.b ? score.teamA : score.a < score.b ? score.teamB : 'TIE'
        : null;
    const GREEN = '#22C55E';
    const AMBER = '#F59E0B';
    const accentColor = winner === 'TIE' ? AMBER : GREEN;
    const colorA = score?.teamAColor || '#2563EB';
    const colorB = score?.teamBColor || '#DC2626';

    return (
        <div style={{
            width: '100vw', height: '100vh', background: '#000',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '0',
            border: `2px solid ${accentColor}`,
            position: 'relative', overflow: 'hidden',
        }}>
            {/* FUI corner brackets */}
            {([
                { top: 20, left: 20, borderRight: 'none', borderBottom: 'none' },
                { top: 20, right: 20, borderLeft: 'none', borderBottom: 'none' },
                { bottom: 20, left: 20, borderRight: 'none', borderTop: 'none' },
                { bottom: 20, right: 20, borderLeft: 'none', borderTop: 'none' },
            ] as const).map((s, i) => (
                <div key={i} style={{
                    position: 'absolute', width: 16, height: 16,
                    border: `2px solid ${accentColor}`, pointerEvents: 'none', ...s,
                }} />
            ))}

            {/* "GAME OVER" watermark */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                fontFamily: OSW, fontSize: '200px', fontWeight: 700, fontStyle: 'italic',
                color: 'rgba(255,255,255,0.018)', letterSpacing: '0.05em',
                whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none',
            }}>FINAL</div>

            {/* Header bar */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '40px',
                background: winner === 'TIE'
                    ? 'linear-gradient(90deg, #0e0900, #1a1000, #0e0900)'
                    : 'linear-gradient(90deg, #001a00, #002800, #001a00)',
                borderBottom: `1px solid ${accentColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            }}>
                <div style={{ width: '5px', height: '5px', background: accentColor }} />
                <span style={{
                    fontFamily: RM, fontSize: '11px', fontWeight: 700,
                    letterSpacing: '0.3em', color: accentColor, textTransform: 'uppercase',
                }}>GAME OVER — FINAL SCORE</span>
                <div style={{ width: '5px', height: '5px', background: accentColor }} />
            </div>

            {/* Winner banner */}
            {winner && winner !== 'TIE' && (
                <div style={{
                    marginTop: '56px', marginBottom: '16px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '7px 28px',
                    border: `1px solid ${GREEN}44`,
                    background: `${GREEN}0a`,
                }}>
                    <div style={{ width: 7, height: 7, background: GREEN }} />
                    <span style={{
                        fontFamily: RM, fontSize: '11px', color: GREEN,
                        letterSpacing: '0.28em', textTransform: 'uppercase', fontWeight: 700,
                    }}>{winner.toUpperCase()} WINS</span>
                    <div style={{ width: 7, height: 7, background: GREEN }} />
                </div>
            )}
            {winner === 'TIE' && (
                <div style={{
                    marginTop: '56px', marginBottom: '16px',
                    padding: '7px 28px',
                    border: `1px solid ${AMBER}44`,
                }}>
                    <span style={{
                        fontFamily: RM, fontSize: '11px', color: AMBER,
                        letterSpacing: '0.28em', textTransform: 'uppercase',
                    }}>TIED GAME</span>
                </div>
            )}
            {!winner && <div style={{ marginTop: '56px', marginBottom: '16px', height: '30px' }} />}

            {/* Score display */}
            {score ? (
                <div style={{
                    display: 'flex', alignItems: 'stretch', gap: '0',
                    marginBottom: '28px',
                }}>
                    {/* Team A */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '20px 52px',
                        borderTop: `3px solid ${score.a >= score.b ? accentColor : '#111'}`,
                        background: score.a > score.b ? `${accentColor}08` : 'transparent',
                    }}>
                        <div style={{
                            fontFamily: RM, fontSize: '10px', letterSpacing: '0.22em',
                            color: score.a > score.b ? accentColor : '#333',
                            textTransform: 'uppercase', marginBottom: '12px',
                        }}>{score.teamA}</div>
                        <div style={{
                            fontFamily: OSW, fontStyle: 'italic', fontSize: '104px',
                            fontWeight: 700, color: score.a > score.b ? '#fff' : '#3a3a3a',
                            lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                        }}>{score.a}</div>
                    </div>

                    {/* Separator */}
                    <div style={{
                        width: '1px', background: 'rgba(255,255,255,0.06)',
                        margin: '0 8px',
                        alignSelf: 'stretch',
                    }} />

                    {/* Team B */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '20px 52px',
                        borderTop: `3px solid ${score.b >= score.a ? accentColor : '#111'}`,
                        background: score.b > score.a ? `${accentColor}08` : 'transparent',
                    }}>
                        <div style={{
                            fontFamily: RM, fontSize: '10px', letterSpacing: '0.22em',
                            color: score.b > score.a ? accentColor : '#333',
                            textTransform: 'uppercase', marginBottom: '12px',
                        }}>{score.teamB}</div>
                        <div style={{
                            fontFamily: OSW, fontStyle: 'italic', fontSize: '104px',
                            fontWeight: 700, color: score.b > score.a ? '#fff' : '#3a3a3a',
                            lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                        }}>{score.b}</div>
                    </div>
                </div>
            ) : (
                <div style={{ height: '140px', marginBottom: '28px' }} />
            )}

            {/* Stats strip — fouls + game metadata */}
            {score && (
                <div style={{
                    display: 'flex', alignItems: 'stretch',
                    border: '1px solid rgba(255,255,255,0.07)',
                    background: '#080808',
                    marginBottom: '24px',
                    minWidth: 480,
                }}>
                    {/* Team A fouls */}
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '12px 20px',
                        borderRight: '1px solid rgba(255,255,255,0.06)',
                        borderLeft: `3px solid ${colorA}`,
                    }}>
                        <span style={{ fontFamily: RM, fontSize: 8, color: '#333', letterSpacing: '0.22em', marginBottom: 6 }}>FOULS</span>
                        <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 32, color: colorA }}>{score.foulsA ?? 0}</span>
                        <span style={{ fontFamily: RM, fontSize: 8, color: '#333', letterSpacing: '0.16em', marginTop: 4 }}>{score.teamA.toUpperCase()}</span>
                    </div>

                    {/* Center — game metadata */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '12px 28px', gap: 6,
                    }}>
                        {score.gameCode && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: RM, fontSize: 7, color: '#333', letterSpacing: '0.2em' }}>CODE</span>
                                <span style={{ fontFamily: RM, fontSize: 11, color: '#666', letterSpacing: '0.22em', fontWeight: 700 }}>{score.gameCode.toUpperCase()}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: RM, fontSize: 7, color: '#333', letterSpacing: '0.2em' }}>PERIOD</span>
                            <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: '#555' }}>
                                {score.period ?? '?'}/{score.totalPeriods ?? '?'}
                            </span>
                        </div>
                        {score.gameMode && (
                            <div style={{
                                padding: '3px 10px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                fontFamily: RM, fontSize: 7,
                                color: score.gameMode === 'advanced' ? '#8B5CF6' : score.gameMode === 'stats' ? '#3B82F6' : '#F59E0B',
                                letterSpacing: '0.22em', fontWeight: 700,
                            }}>{score.gameMode.toUpperCase()}</div>
                        )}
                    </div>

                    {/* Team B fouls */}
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '12px 20px',
                        borderLeft: '1px solid rgba(255,255,255,0.06)',
                        borderRight: `3px solid ${colorB}`,
                    }}>
                        <span style={{ fontFamily: RM, fontSize: 8, color: '#333', letterSpacing: '0.22em', marginBottom: 6 }}>FOULS</span>
                        <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 32, color: colorB }}>{score.foulsB ?? 0}</span>
                        <span style={{ fontFamily: RM, fontSize: 8, color: '#333', letterSpacing: '0.16em', marginTop: 4 }}>{score.teamB.toUpperCase()}</span>
                    </div>
                </div>
            )}

            {/* New game button */}
            <div
                onClick={onNewGame}
                style={{
                    padding: '14px 48px',
                    border: `1px solid ${accentColor}44`, background: `${accentColor}0d`,
                    color: accentColor, fontFamily: RM,
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em',
                    textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none',
                    transition: 'all 0.15s',
                    boxShadow: `0 0 20px ${accentColor}22`,
                }}
                onTouchStart={e => { (e.currentTarget as HTMLElement).style.background = `${accentColor}22`; }}
                onTouchEnd={e => { (e.currentTarget as HTMLElement).style.background = `${accentColor}0d`; }}
            >
                ↺ NEW GAME
            </div>

            {/* Footer */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '36px',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
                <span style={{ fontFamily: RM, fontSize: '8px', color: '#1a1a1a', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                    SESSION CLOSED
                </span>
                {score?.gameCode && (
                    <span style={{ fontFamily: RM, fontSize: '8px', color: '#1a1a1a', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                        · SAVED TO CLOUD · {score.gameCode.toUpperCase()}
                    </span>
                )}
            </div>
        </div>
    );
}