// Smoke goldens for the report-powered share cards: every builder must return
// self-contained SVG carrying its key content, in both formats. String builders
// regress silently — this pins them.
import { describe, it, expect } from 'vitest';
import { buildGameReport } from '../../../../services/gameReport';
import { buildHeatmapCard, buildMvpCard, buildMomentumCard, buildQuartersCard } from './reportCards';
import type { ShotEvent } from '../../../shotchart/types/shotTypes';
import type { Player } from '../../../../types';

const mkPlayer = (id: string, name: string, number: string): Player => ({
    id, name, number, position: '',
    points: 0, fouls: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0,
    turnovers: 0, disqualified: false,
    fieldGoalsMade: 0, fieldGoalsAttempted: 0,
    threePointsMade: 0, threePointsAttempted: 0,
    freeThrowsMade: 0, freeThrowsAttempted: 0,
});

const gameData = {
    code: 'CARD',
    createdAt: '2026-07-08T12:00:00Z',
    settings: { gameName: 'Card Game', periodDuration: 10, periods: 4, periodType: 'quarter' as const },
    teamA: { name: 'Hawks', color: '#dc2626', score: 0, players: [mkPlayer('a1', 'Ananya', '7')] },
    teamB: { name: 'Wolves', color: '#2563eb', score: 0, players: [mkPlayer('b1', 'Chirag', '23')] },
};

let n = 0;
const shot = (over: Partial<ShotEvent>): ShotEvent => ({
    id: `c${++n}`, gameCode: 'CARD', playerId: 'a1', teamSide: 'A',
    x: 50, y: 16, zone: 'restricted', made: true, points: 2,
    shotType: 'field_goal', period: 1, gameClockSec: 400, shotClockSec: null,
    attributes: [], assistedBy: null, reboundedBy: null, reboundType: null,
    blockedBy: null, inputMethod: 'live', editedAt: null,
    createdAt: new Date(2026, 6, 8, 12, 0, n).toISOString(), ...over,
});

const shots: ShotEvent[] = [
    shot({}),
    shot({ zone: 'three_corner_left', x: 3, y: 10, points: 3 }),
    shot({ made: false, zone: 'mid_top', x: 50, y: 46 }),
    shot({ playerId: 'b1', teamSide: 'B', period: 2, points: 2 }),
    shot({ playerId: 'a1', period: 3, points: 2 }),
];

const report = buildGameReport(gameData, shots, []);
const formats = ['square', 'story'] as const;

describe('report share cards render self-contained SVG in both formats', () => {
    it.each(formats)('heatmap (%s): court lines + hex fills + player identity', format => {
        const svg = buildHeatmapCard(report, shots, 'a1', { format });
        expect(svg).toContain('<svg');
        expect(svg).toContain('ANANYA');
        expect(svg).toContain('SHOT HEAT');
        expect((svg.match(/<path d="M/g) ?? []).length).toBeGreaterThanOrEqual(3); // court arcs + hexes
        expect(svg).toContain('THEBOX.APP');
    });

    it('heatmap returns empty for an unknown player', () => {
        expect(buildHeatmapCard(report, shots, 'nobody', { format: 'square' })).toBe('');
    });

    it.each(formats)('mvp (%s): crowns the top scorer with the jersey watermark', format => {
        const svg = buildMvpCard(report, { format });
        expect(svg).toContain('PLAYER OF THE GAME');
        expect(svg).toContain('ANANYA');                 // 7 pts > 2 pts
        expect(svg).toContain('WON');
    });

    it.each(formats)('momentum (%s): two step paths + lead facts', format => {
        const svg = buildMomentumCard(report, { format });
        expect(svg).toContain('GAME FLOW');
        expect(svg).toContain('#dc2626');
        expect(svg).toContain('#2563eb');
        expect(svg).toContain('LEAD CHANGES');
    });

    it.each(formats)('quarters (%s): per-period bars + legend', format => {
        const svg = buildQuartersCard(report, shots, { format });
        expect(svg).toContain('QUARTER BY QUARTER');
        expect(svg).toContain('Q1');
        expect(svg).toContain('Hawks');
        expect(svg).toContain('Wolves');
    });

    it('all four escape XML-hostile team names safely', () => {
        const hostile = {
            ...gameData,
            teamA: { ...gameData.teamA, name: 'A<&>B' },
            settings: { ...gameData.settings, gameName: 'Cup <A&B>' },
        };
        const r = buildGameReport(hostile, shots, []);
        for (const svg of [
            buildHeatmapCard(r, shots, 'a1', { format: 'square' }),
            buildMvpCard(r, { format: 'square' }),
            buildMomentumCard(r, { format: 'square' }),
            buildQuartersCard(r, shots, { format: 'square' }),
        ]) {
            expect(svg).not.toMatch(/<&|A<&>B/);
            expect(svg).toContain('&lt;&amp;&gt;');
        }
    });
});
