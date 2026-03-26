import type { Game } from '../core/types/Game';
import type { BasketballGame } from '../types';
import type { BasketballState, BasketballRules } from '../sports/basketball/manifest';

/**
 * Converts a legacy BasketballGame (from DB) into the generic Game<TState, TRules>
 * used by the v2 engine and sport manifests.
 */
export function fromBasketballGame(bg: BasketballGame): Game<BasketballState, BasketballRules> {
    return {
        id: bg.code,
        code: bg.code,
        hostId: bg.hostId,
        sportId: bg.sportId || bg.sport || 'basketball',
        status: bg.status === 'completed' ? 'completed' : bg.status === 'archived' ? 'archived' : 'live',
        createdAt: bg.createdAt,
        lastUpdate: bg.lastUpdate,
        rules: {
            periods: bg.settings?.periods || 4,
            periodDurationMin: bg.settings?.periodDuration || 10,
            shotClockSec: bg.settings?.shotClockDuration || 24,
            timeoutsPerHalf: 3,
        },
        state: {
            gameRunning: bg.gameState?.gameRunning || false,
            scoreA: bg.teamA?.score || 0,
            scoreB: bg.teamB?.score || 0,
            period: bg.gameState?.period || 1,
            shotClock: bg.gameState?.shotClock || 24,
            shotClockRunning: bg.gameState?.shotClockRunning || false,
            possession: bg.gameState?.possession || 'A',
            foulsA: bg.teamA?.fouls || 0,
            foulsB: bg.teamB?.fouls || 0,
            timeoutsA: bg.teamA?.timeouts || 0,
            timeoutsB: bg.teamB?.timeouts || 0,
        },
        teamA: {
            name: bg.teamA?.name || 'HOME',
            color: bg.teamA?.color || '#DC2626',
            score: bg.teamA?.score || 0,
        },
        teamB: {
            name: bg.teamB?.name || 'AWAY',
            color: bg.teamB?.color || '#2563EB',
            score: bg.teamB?.score || 0,
        },
    };
}

/**
 * Converts a generic Game<TState, TRules> back into a legacy BasketballGame
 * for writing to the DB or passing to unmigrated components.
 */
export function toBasketballGame(game: Game<BasketballState, BasketballRules>, original?: BasketballGame): BasketballGame {
    return {
        code: game.code,
        hostId: game.hostId,
        sportId: game.sportId,
        sport: game.sportId, // legacy compat
        status: game.status as any,
        gameType: original?.gameType || 'local',
        createdAt: game.createdAt || Date.now(),
        lastUpdate: game.lastUpdate || Date.now(),
        settings: original?.settings || {
            gameName: 'Match',
            periodDuration: game.rules.periodDurationMin,
            shotClockDuration: game.rules.shotClockSec,
            periodType: 'quarter',
        },
        gameState: {
            period: game.state.period,
            gameTime: original?.gameState?.gameTime || { minutes: game.rules.periodDurationMin, seconds: 0, tenths: 0 },
            shotClock: game.state.shotClock,
            gameRunning: game.state.gameRunning,
            shotClockRunning: game.state.shotClockRunning,
            possession: game.state.possession as any,
        },
        teamA: {
            ...original?.teamA,
            name: game.teamA.name,
            color: game.teamA.color,
            score: game.teamA.score,
            fouls: game.state.foulsA,
            timeouts: game.state.timeoutsA,
            timeoutsFirstHalf: original?.teamA?.timeoutsFirstHalf || 2,
            timeoutsSecondHalf: original?.teamA?.timeoutsSecondHalf || 3,
            foulsThisQuarter: original?.teamA?.foulsThisQuarter || 0,
            players: original?.teamA?.players || [],
        },
        teamB: {
            ...original?.teamB,
            name: game.teamB.name,
            color: game.teamB.color,
            score: game.teamB.score,
            fouls: game.state.foulsB,
            timeouts: game.state.timeoutsB,
            timeoutsFirstHalf: original?.teamB?.timeoutsFirstHalf || 2,
            timeoutsSecondHalf: original?.teamB?.timeoutsSecondHalf || 3,
            foulsThisQuarter: original?.teamB?.foulsThisQuarter || 0,
            players: original?.teamB?.players || [],
        },
    };
}
