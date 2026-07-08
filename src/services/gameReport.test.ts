// Golden tests for the post-game report engine — a full synthetic game replayed
// through buildGameReport, with hand-computed expectations for the package and
// every auto-derived highlight.
import { describe, it, expect } from 'vitest';
import { buildGameReport } from './gameReport';
import type { ShotEvent } from '../components/shotchart/types/shotTypes';
import type { Player } from '../types';

// ── fixtures ─────────────────────────────────────────────────────────────────

const mkPlayer = (id: string, name: string, number: string): Player => ({
    id, name, number, position: '',
    points: 0, fouls: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0,
    turnovers: 0, disqualified: false,
    fieldGoalsMade: 0, fieldGoalsAttempted: 0,
    threePointsMade: 0, threePointsAttempted: 0,
    freeThrowsMade: 0, freeThrowsAttempted: 0,
});

const gameData = {
    code: 'GLDN',
    createdAt: '2026-07-08T10:00:00Z',
    settings: { gameName: 'Golden Game', gameMode: 'advanced', periodDuration: 10, periods: 4, periodType: 'quarter' as const },
    teamA: {
        name: 'Hawks', color: '#dc2626', score: 0,
        players: [mkPlayer('a1', 'Ananya', '7'), mkPlayer('a2', 'Bea', '11')],
    },
    teamB: {
        name: 'Wolves', color: '#2563eb', score: 0,
        players: [mkPlayer('b1', 'Chir', '23'), mkPlayer('b2', 'Dev', '4')],
    },
};

let seq = 0;
const shot = (over: Partial<ShotEvent>): ShotEvent => ({
    id: `g${++seq}`,
    gameCode: 'GLDN',
    playerId: 'a1',
    teamSide: 'A',
    x: 50, y: 16,
    zone: 'restricted',
    made: true,
    points: 2,
    shotType: 'field_goal',
    period: 1,
    gameClockSec: 500,
    shotClockSec: null,
    attributes: [],
    assistedBy: null,
    reboundedBy: null,
    reboundType: null,
    blockedBy: null,
    inputMethod: 'live',
    editedAt: null,
    createdAt: new Date(2026, 6, 8, 10, 0, seq).toISOString(),
    ...over,
});

// The scripted game (A wins wire-to-wire 21–8):
// Q1: a1 opens with three makes (an 8-0 run incl. one assisted 3 from a2, one
//     fastbreak layup); b1 answers a paint 2 (assisted by b2). A 8–2.
// Q2: a1 misses twice (contested), a2 hits an assisted corner 3. A 11–4 after
//     b1 FT pair (one make one miss → 1 pt + paint 2 earlier … see events).
// Q4 clutch (≤5:00, margin ≤5 kept false here — margin is large, so NO clutch).
// Totals A: a1 = 2+2+3+2 = 9? Let's compute precisely below in expectations.
const shots: ShotEvent[] = [
    // Q1 — the 8-0 Hawks run (a1 hot start)
    shot({ playerId: 'a1', period: 1, gameClockSec: 560, zone: 'restricted', x: 50, y: 16, points: 2, made: true, attributes: ['fastbreak'] }),
    shot({ playerId: 'a1', period: 1, gameClockSec: 520, zone: 'paint_left', x: 40, y: 26, points: 2, made: true }),
    shot({ playerId: 'a1', period: 1, gameClockSec: 470, zone: 'three_top_center', x: 50, y: 64, points: 3, made: true, assistedBy: 'a2' }),
    shot({ playerId: 'a2', period: 1, gameClockSec: 430, zone: 'at_rim', x: 50, y: 11, points: 2, made: true, attributes: ['second_chance'] }, ),
    // Wolves answer
    shot({ playerId: 'b1', teamSide: 'B', period: 1, gameClockSec: 380, zone: 'paint_right', x: 60, y: 26, points: 2, made: true, assistedBy: 'b2' }),
    // Q2 — a1 cools off, a2 assisted corner 3, b1 splits FTs
    shot({ playerId: 'a1', period: 2, gameClockSec: 500, zone: 'mid_top', x: 50, y: 46, points: 2, made: false, attributes: ['contested'] }),
    shot({ playerId: 'a1', period: 2, gameClockSec: 440, zone: 'three_wing_left', x: 6.5, y: 28, points: 3, made: false, attributes: ['contested'] }),
    shot({ playerId: 'a2', period: 2, gameClockSec: 400, zone: 'three_corner_left', x: 3, y: 10, points: 3, made: true, assistedBy: 'a1' }),
    shot({ playerId: 'b1', teamSide: 'B', period: 2, gameClockSec: 350, shotType: 'free_throw', zone: 'free_throw', x: null as unknown as number, y: null as unknown as number, points: 1, made: true }),
    shot({ playerId: 'b1', teamSide: 'B', period: 2, gameClockSec: 350, shotType: 'free_throw', zone: 'free_throw', x: null as unknown as number, y: null as unknown as number, points: 1, made: false }),
    // Q3 — trading buckets
    shot({ playerId: 'b2', teamSide: 'B', period: 3, gameClockSec: 300, zone: 'mid_baseline_right', x: 80, y: 14, points: 2, made: true }),
    shot({ playerId: 'a1', period: 3, gameClockSec: 250, zone: 'restricted', x: 50, y: 16, points: 2, made: true, assistedBy: 'a2' }),
    // Q4 — inside the last 5:00 but margin is 8 (16-7 → not close) EXCEPT the
    // last bucket after B trims… margin stays > 5, so clutch stays empty.
    shot({ playerId: 'b1', teamSide: 'B', period: 4, gameClockSec: 240, zone: 'three_top_right', x: 75, y: 60, points: 3, made: false }),
    shot({ playerId: 'a1', period: 4, gameClockSec: 200, zone: 'paint_right', x: 60, y: 26, points: 2, made: true }),
    shot({ playerId: 'b2', teamSide: 'B', period: 4, gameClockSec: 120, zone: 'restricted', x: 50, y: 16, points: 2, made: true }),
];

const report = () => buildGameReport(gameData, shots, []);

// ── tests ────────────────────────────────────────────────────────────────────

describe('buildGameReport — the post-game package', () => {
    const r = report();

    it('header: identity, settings, winner', () => {
        expect(r.header).toMatchObject({
            gameCode: 'GLDN',
            name: 'Golden Game',
            mode: 'advanced',
            periods: 4,
            periodDurationSec: 600,
            winner: 'A',
        });
        expect(r.header.teamA.score).toBe(16);   // event-derived (see box test)
    });

    it('box score from the event log: hand-computed lines', () => {
        const a1 = r.box.teamA.rows.find(p => p.playerId === 'a1')!;
        // a1: makes 2,2,3,2,2 = 11 pts on 5/7 FG (1/2 from three)
        expect(a1).toMatchObject({ pts: 11, fgm: 5, fga: 7, tpm: 1, tpa: 2 });
        const a2 = r.box.teamA.rows.find(p => p.playerId === 'a2')!;
        // a2: at_rim 2 + corner 3 = 5 pts on 2/2; 2 assists (to a1 Q1 three + a1 Q3)
        expect(a2).toMatchObject({ pts: 5, fgm: 2, fga: 2, ast: 2 });
        const b1 = r.box.teamB.rows.find(p => p.playerId === 'b1')!;
        // b1: paint 2 + 1/2 FT + missed 3 = 3 pts, 1/2 FG, 1/2 FT
        expect(b1).toMatchObject({ pts: 3, fgm: 1, fga: 2, ftm: 1, fta: 2 });
        expect(r.box.teamA.totals.pts).toBe(16);
        // b1: paint 2 + FT 1 = 3 · b2: baseline 2 + restricted 2 = 4 → 7
        expect(r.box.teamB.totals.pts).toBe(7);
    });

    it('team scores in header come from the box totals', () => {
        // (Fixture teams carry score: 0 — the engine must not trust it blindly.)
        expect(r.header.teamA.score).toBe(16);
        expect(r.header.teamB.score).toBe(7);
    });

    it('momentum: the 8-0 opening run is detected; Hawks led wire-to-wire', () => {
        const big = r.runs[0];
        expect(big).toMatchObject({ side: 'A', points: 9 });   // 2+2+3+2 before B scores
        expect(r.leadFlow.leadChanges).toBe(0);
        expect(r.highlights.some(h => h.kind === 'wire_to_wire' && h.side === 'A')).toBe(true);
    });

    it('special points: fastbreak / second-chance tags + zone-derived paint', () => {
        expect(r.special.teamA).toMatchObject({ fastbreak: 2, secondChance: 2 });
        // A paint makes: restricted 2 + paint_left 2 + at_rim 2 + restricted 2 + paint_right 2 = 10
        expect(r.special.teamA.inPaint).toBe(10);
        expect(r.special.teamB.inPaint).toBe(4);               // paint_right 2 + restricted 2
    });

    it('assist networks resolve top duo a2 → a1', () => {
        expect(r.assists.teamA.topDuo).toMatchObject({ fromPlayerId: 'a2', toPlayerId: 'a1', count: 2 });
        expect(r.assists.teamA.assistedFgm).toBe(3);
    });

    it('no clutch time in a blowout; shot-clock section null when untracked', () => {
        expect(r.clutch.hasClutchTime).toBe(false);
        expect(r.shotClockUsage).toBeNull();
        expect(r.highlights.some(h => h.kind === 'clutch_star')).toBe(false);
    });

    it('hexbins present (advanced game with located shots), FTs excluded', () => {
        expect(r.hexbins).not.toBeNull();
        // B's located FGAs: paint_right, missed top-right 3, baseline, restricted
        // — the two FTs are excluded.
        expect(r.hexbins!.teamB.totalAttempts).toBe(4);
    });

    it('player packages: sorted by PTS, zones/periods/quality attached', () => {
        expect(r.players[0].playerId).toBe('a1');
        expect(r.players[0].periods.find(p => p.period === 1)!.pts).toBe(7);
        expect(r.players[0].zones.length).toBeGreaterThan(0);
        expect(r.players[0].quality.fga).toBe(7);
        const dnpFree = r.players.every(p => !p.row.dnp);
        expect(dnpFree).toBe(true);
    });

    it('highlights: game high (a1, 11), perfect line (a2 2/2 is UNDER the 5-FGA gate → absent)', () => {
        const gh = r.highlights.find(h => h.kind === 'game_high')!;
        expect(gh).toMatchObject({ playerId: 'a1', side: 'A' });
        expect(gh.label).toContain('11 PTS');
        // a2 shot 2/2 but with fga < 5 must NOT trigger hot_hand/perfect_line.
        expect(r.highlights.some(h => h.kind === 'perfect_line' || h.kind === 'hot_hand')).toBe(
            // a1 has 7 FGA at 5/7 (eFG 78.6%) → hot hand IS expected, for a1.
            true
        );
        const hot = r.highlights.find(h => h.kind === 'hot_hand')!;
        expect(hot.playerId).toBe('a1');
    });

    it('highlights are weight-ordered, game_high first here', () => {
        expect(r.highlights[0].kind).toBe('game_high');
        const weights = r.highlights.map(h => h.weight);
        expect([...weights].sort((a, b) => b - a)).toEqual(weights);
    });
});

describe('clutch pathway (dedicated close-game fixture)', () => {
    it('a tight Q4 produces clutch stats + the clutch_star highlight', () => {
        const closeShots: ShotEvent[] = [
            shot({ playerId: 'a1', period: 1, gameClockSec: 500, points: 2, made: true }),
            shot({ playerId: 'b1', teamSide: 'B', period: 1, gameClockSec: 400, points: 2, made: true }),
            // Q4, last 5:00, margin 0 → clutch three by b1:
            shot({ playerId: 'b1', teamSide: 'B', period: 4, gameClockSec: 180, zone: 'three_top_center', x: 50, y: 64, points: 3, made: true }),
        ];
        const r = buildGameReport(gameData, closeShots, []);
        expect(r.clutch.hasClutchTime).toBe(true);
        expect(r.clutch.teamB.pts).toBe(3);
        const star = r.highlights.find(h => h.kind === 'clutch_star')!;
        expect(star).toMatchObject({ playerId: 'b1', side: 'B' });
        expect(star.detail).toContain('Chir');
    });
});
