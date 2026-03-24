// src/pages/RefereeScreen.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — MASTER REFEREE SCREEN CONTROLLER
// 
// State machine:
//   SPLASH → MODE_SELECT → ONLINE_SETUP | OFFLINE_SETUP →
//   PRE_GAME → LIVE_GAME ↔ SETTINGS
//
// This replaces the old RefereeScreen.tsx entirely.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { useRefereeBox } from '../hooks/useRefereeBox';
import type { GameState } from '../hooks/useRefereeBox';

// Screens
import SplashScreen from '../components/referee/SplashScreen';
import ModeSelect from '../components/referee/ModeSelect';
import OnlineSetup from '../components/referee/OnlineSetup';
import OfflineSetup from '../components/referee/OfflineSetup';
import PreGameConfirm from '../components/referee/PreGameConfirm';
import LiveScoreboard from '../components/referee/LiveScoreboard';
import SettingsPanel from '../components/referee/SettingsPanel';

// Import styles
import '../components/referee/RefereeStyles.css';

type Screen =
    | 'splash'
    | 'mode_select'
    | 'online_setup'
    | 'offline_setup'
    | 'pre_game'
    | 'live_game'
    | 'settings';

interface GameConfig {
    teamAName: string;
    teamBName: string;
    teamAColor: string;
    teamBColor: string;
    periodMinutes: number;
    shotClockSeconds: number;
    periods: number;
}

export default function RefereeScreen() {
    const {
        gameState,
        isConnected,
        sendAction,
    } = useRefereeBox();

    const [screen, setScreen] = useState<Screen>('splash');
    const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
    const [isOnline, setIsOnline] = useState(false);

    // Check internet connectivity
    useEffect(() => {
        const check = async () => {
            try {
                // Simple connectivity check — ping Supabase or any endpoint
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                const res = await fetch('https://www.google.com/generate_204', {
                    method: 'HEAD',
                    signal: controller.signal,
                    mode: 'no-cors',
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

    // Listen for settings button from daemon (toggles between live and settings)
    useEffect(() => {
        if (!gameState) return;
        if (screen === 'live_game' && gameState.ui.isTouchUnlocked) {
            setScreen('settings');
        } else if (screen === 'settings' && !gameState.ui.isTouchUnlocked) {
            setScreen('live_game');
        }
    }, [gameState?.ui.isTouchUnlocked, screen]);

    // Handle splash complete
    const handleSplashComplete = useCallback(() => {
        setScreen('mode_select');
    }, []);

    // Handle offline setup confirm
    const handleOfflineConfirm = useCallback((config: GameConfig) => {
        setGameConfig(config);
        // Send config to daemon
        sendAction('CONFIGURE_GAME', {
            teamAName: config.teamAName,
            teamBName: config.teamBName,
            teamAColor: config.teamAColor,
            teamBColor: config.teamBColor,
            periodMinutes: config.periodMinutes,
            shotClockSeconds: config.shotClockSeconds,
            periods: config.periods,
        });
        setScreen('pre_game');
    }, [sendAction]);

    // Handle online game found
    const handleGameFound = useCallback((gameData: any) => {
        const config: GameConfig = {
            teamAName: gameData.teamA?.name || 'HOME',
            teamBName: gameData.teamB?.name || 'AWAY',
            teamAColor: gameData.teamA?.color || '#3B82F6',
            teamBColor: gameData.teamB?.color || '#EF4444',
            periodMinutes: gameData.settings?.periodDuration || 10,
            shotClockSeconds: gameData.settings?.shotClockDuration || 24,
            periods: gameData.settings?.periods || 4,
        };
        setGameConfig(config);
        sendAction('CONFIGURE_GAME', config);
        setScreen('pre_game');
    }, [sendAction]);

    // Handle game start
    const handleStartGame = useCallback(() => {
        sendAction('START_GAME');
        setScreen('live_game');
    }, [sendAction]);

    // Derive display values
    const teamAColor = gameConfig?.teamAColor || '#3B82F6';
    const teamBColor = gameConfig?.teamBColor || '#EF4444';

    // ── RENDER ──
    switch (screen) {
        case 'splash':
            return (
                <SplashScreen
                    isDaemonConnected={isConnected}
                    onComplete={handleSplashComplete}
                />
            );

        case 'mode_select':
            return (
                <ModeSelect
                    onSelectOnline={() => setScreen('online_setup')}
                    onSelectOffline={() => setScreen('offline_setup')}
                    isOnline={isOnline}
                />
            );

        case 'online_setup':
            return (
                <OnlineSetup
                    onGameFound={handleGameFound}
                    onBack={() => setScreen('mode_select')}
                />
            );

        case 'offline_setup':
            return (
                <OfflineSetup
                    onConfirm={handleOfflineConfirm}
                    onBack={() => setScreen('mode_select')}
                />
            );

        case 'pre_game':
            return gameConfig ? (
                <PreGameConfirm
                    config={gameConfig}
                    onStart={handleStartGame}
                    onBack={() => setScreen('offline_setup')}
                />
            ) : null;

        case 'live_game':
            return gameState ? (
                <LiveScoreboard
                    teamA={gameState.teamA}
                    teamB={gameState.teamB}
                    clock={gameState.clock}
                    possession={null} // TODO: add to daemon state
                    lastAction={undefined}
                    canUndo={true}
                    teamAColor={teamAColor}
                    teamBColor={teamBColor}
                />
            ) : (
                <div style={{
                    width: '1024px',
                    height: '600px',
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '14px',
                    color: '#F59E0B',
                    animation: 'breathe 1.5s infinite',
                }}>
                    RECONNECTING TO DAEMON...
                </div>
            );

        case 'settings':
            return gameState ? (
                <SettingsPanel
                    teamA={gameState.teamA}
                    teamB={gameState.teamB}
                    clock={gameState.clock}
                    teamAColor={teamAColor}
                    teamBColor={teamBColor}
                    sendAction={sendAction}
                />
            ) : null;

        default:
            return null;
    }
}