import React from 'react';
import { useRefereeBox } from '../hooks/useRefereeBox';
import LockedScoreboard from '../components/refereebox/LockedScoreboard';
import UnlockedSettings from '../components/refereebox/UnlockedSettings';

export default function RefereeScreen() {
    const { gameState, isConnected, formatGameClock, formatShotClock, sendAction } = useRefereeBox();

    if (!gameState || !isConnected) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#000', color: '#fff', fontFamily: 'monospace' }}>
                <h2>Connecting to BOX Hardware Daemon...</h2>
            </div>
        );
    }

    const gameClockDisplay = formatGameClock(gameState.clock.gameMs);
    const shotClockDisplay = formatShotClock(gameState.clock.shotMs);

    if (gameState.ui.isTouchUnlocked) {
        return (
            <UnlockedSettings
                data={gameState}
                gameClock={gameClockDisplay}
                shotClock={shotClockDisplay}
                sendAction={sendAction}
            />
        );
    }

    return (
        <LockedScoreboard
            data={gameState}
            gameClock={gameClockDisplay}
            shotClock={shotClockDisplay}
        />
    );
}