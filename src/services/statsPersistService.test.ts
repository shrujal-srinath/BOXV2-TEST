// Goldens for the persistence row shapes — the contract that careers, views,
// and future cards read. Reuses the scripted golden game from gameReport.test.
import { describe, it, expect } from 'vitest';
import { buildGameReport } from './gameReport';
import { reportToRows } from './statsPersistService';
import type { ShotEvent } from '../components/shotchart/types/shotTypes';
import type { Player } from '../types';

const mkPlayer = (id: string, name: string, number: string, profileId?: string): Player & { profileId?: string } => ({
    id, name, number, position: '',
    points: 0, fouls: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0,
    turnovers: 0, disqualified: false,
    fieldGoalsMade: 0, fieldGoalsAttempted: 0,
    threePointsMade: 0, threePointsAttempted: 0,
    freeThrowsMade: 0, freeThrowsAttempted: 0,
    ...(profileId ? { profileId } : {}),
});

const gameData = {
    code: 'PRSV',
    createdAt: '2026-07-08T18:00:00Z',
    settings: { gameName: 'Persist Game', gameMode: 'advanced', periodDuration: 10, periods: 4, periodType: 'quarter' as const },
    teamA: { name: 'Hawks', color: '#dc2626', score: 0, players: [mkPlayer('a1', 'Ananya', '7', 'prof-uuid-1'), mkPlayer('a2', 'Bea', '11')] },
    teamB: { name: 'Wolves', color: '#2563eb', score: 0, players: [mkPlayer('b1', 'Chir', '23')] },
};

let n = 0;
const shot = (over: Partial<ShotEvent>): ShotEvent => ({
    id: `p${++n}`, gameCode: 'PRSV', playerId: 'a1', teamSide: 'A',
    x: 50, y: 16, zone: 'restricted', made: true, points: 2,
    shotType: 'field_goal', period: 1, gameClockSec: 400, shotClockSec: null,
    attributes: [], assistedBy: null, reboundedBy: null, reboundType: null,
    blockedBy: null, inputMethod: 'live', editedAt: null,
    createdAt: new Date(2026, 6, 8, 18, 0, n).toISOString(), ...over,
});

const shots = [
    shot({}),
    shot({ zone: 'three_corner_left', x: 3, y: 10, points: 3, attributes: ['fastbreak'] }),
    shot({ playerId: 'a2', made: false, zone: 'mid_top', x: 50, y: 46 }),
    shot({ playerId: 'b1', teamSide: 'B', period: 2 }),
];

describe('reportToRows', () => {
    const report = buildGameReport(gameData, shots, []);
    const rows = reportToRows(report, gameData)!;

    it('one player row per active player, keyed for the idempotent upsert', () => {
        expect(rows.players.map(r => r.roster_player_id).sort()).toEqual(['a1', 'a2', 'b1']);
        for (const r of rows.players) {
            expect(r.game_code).toBe('PRSV');
            expect(r.sport_id).toBe('basketball');
        }
    });

    it('save-all-now/link-when-known: profileId copied when the roster carries it, null otherwise', () => {
        expect(rows.players.find(r => r.roster_player_id === 'a1')!.player_profile_id).toBe('prof-uuid-1');
        expect(rows.players.find(r => r.roster_player_id === 'a2')!.player_profile_id).toBeNull();
    });

    it('line carries the box row PLUS gameScore and PIE', () => {
        const a1 = rows.players.find(r => r.roster_player_id === 'a1')!;
        expect(a1.line.pts).toBe(5);
        expect(typeof a1.line.gameScore).toBe('number');
        expect(typeof a1.line.pie).toBe('number');
    });

    it('team rows: result is from each side of the scoreboard', () => {
        const A = rows.teams.find(t => t.team_side === 'A')!;
        const B = rows.teams.find(t => t.team_side === 'B')!;
        expect(A.result).toEqual({ ptsFor: 5, ptsAgainst: 2, won: true, opponentName: 'Wolves' });
        expect(B.result).toEqual({ ptsFor: 2, ptsAgainst: 5, won: false, opponentName: 'Hawks' });
        expect(A.four_factors).not.toBeNull();          // advanced game
    });

    it('quick games and code-less games never persist', () => {
        const quick = buildGameReport({ ...gameData, settings: { ...gameData.settings, gameMode: 'quick' } }, shots, []);
        expect(reportToRows(quick, gameData)).toBeNull();
        const noCode = buildGameReport({ ...gameData, code: undefined }, shots, []);
        expect(reportToRows(noCode, gameData)).toBeNull();
    });
});
