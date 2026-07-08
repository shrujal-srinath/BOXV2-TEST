// src/pages/UiAuditFixture.tsx
// ─────────────────────────────────────────────────────────────
// Dev-only fixture page used by uiaudit/audit.mjs to render
// the locked scoreboards and touch deck with seeded data so the
// Playwright + axe-core audit can actually inspect them.
//
// Routes (mounted in App.tsx):
//   /uiaudit/scoreboard-minimal   → LockedScoreboardMinimal
//   /uiaudit/scoreboard-classic   → LockedScoreboard
//   /uiaudit/touchdeck-minimal    → PiTouchScoringScreenMinimal
//   /uiaudit/touchdeck-classic    → PiTouchScoringScreen
//
// Query params:
//   ?bonus=1        → both teams in bonus (5+ fouls)
//   ?lowshot=1      → shot clock under 5s
//   ?shotzero=1     → shot clock at 0 (blinking)
//   ?periodOver=1   → period clock at 0
//   ?noPossession=1 → neither team has possession
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import LockedScoreboard        from '../components/refereebox/LockedScoreboard';
import LockedScoreboardMinimal from '../components/refereebox/LockedScoreboardMinimal';
import PiTouchScoring          from '../components/refereebox/PiTouchScoringScreen';
import PiTouchScoringMinimal   from '../components/refereebox/PiTouchScoringScreenMinimal';
import AdvancedFlowHost        from '../components/refereebox/AdvancedFlowHost';
import PiStatsPlayerPicker     from '../components/refereebox/PiStatsPlayerPicker';

const noop = () => {};

export default function UiAuditFixture() {
    const { variant } = useParams<{ variant: string }>();
    const [search] = useSearchParams();

    const fixture = useMemo(() => {
        const bonus       = search.get('bonus') === '1';
        const lowshot     = search.get('lowshot') === '1';
        const shotzero    = search.get('shotzero') === '1';
        const periodOver  = search.get('periodOver') === '1';
        const noPossession = search.get('noPossession') === '1';

        const teamA = { name: 'BMSCE BRUINS',  score: 84, fouls: bonus ? 6 : 3, timeouts: 2, color: '#DC2626' };
        const teamB = { name: 'CHRIST CHEETAHS', score: 71, fouls: bonus ? 7 : 4, timeouts: 1, color: '#2563EB' };
        const clock = {
            gameMs: periodOver ? 0 : 343 * 1000,
            shotMs: shotzero ? 0 : lowshot ? 3500 : 17 * 1000,
            isRunning: !periodOver,
            period: 2,
            totalPeriods: 4,
            periodMinutes: 10,
            shotClockSeconds: 24,
        };
        const possession: 'A' | 'B' | null = noPossession ? null : 'A';
        return { teamA, teamB, clock, possession };
    }, [search]);

    const common = {
        teamA: fixture.teamA,
        teamB: fixture.teamB,
        clock: fixture.clock,
        possession: fixture.possession,
        teamAColor: fixture.teamA.color,
        teamBColor: fixture.teamB.color,
        isConnected: true,
        gameCode: 'AUDIT',
    };

    // Seeded roster for the shot-attribution popups
    const roster = [
        { id: 'p1', name: 'TENZIN RAUTOLA',  number: '7'  },
        { id: 'p2', name: 'ADIT CHANNAL',    number: '13' },
        { id: 'p3', name: 'OM PRAKASH',      number: '23' },
        { id: 'p4', name: 'AKSHAY VARKEY',   number: '24' },
        { id: 'p5', name: 'NIKHIL PORE',     number: '32' },
        { id: 'p6', name: 'AKHILESH RIYAL',  number: '9'  },
        { id: 'p7', name: 'KAUSHAL JAIN',    number: '15' },
        { id: 'p8', name: 'TANAY ALAGOD',    number: '21' },
    ];

    const shotEvent: { team: 'A' | 'B'; points: 1 | 2 | 3; players: typeof roster; gameMode: 'quick' | 'stats' | 'advanced' } = {
        team:     (search.get('side') as 'A' | 'B') ?? 'A',
        points:   (parseInt(search.get('points') ?? '2', 10) as 1 | 2 | 3),
        players:  roster,
        gameMode: 'advanced',
    };

    switch (variant) {
        case 'scoreboard-minimal':
            return (
                <LockedScoreboardMinimal
                    {...common}
                    canUndo={true}
                    isTouchUnlocked={false}
                    undoFlash={false}
                    settingsFlash={null}
                    gameMode="stats"
                    onCast={noop}
                    onConnectHardware={noop}
                    onSettings={noop}
                    onEndGame={noop}
                    onUnlockTouchScoring={noop}
                />
            );

        case 'scoreboard-classic':
            return (
                <LockedScoreboard
                    {...common}
                    canUndo={true}
                    isTouchUnlocked={false}
                    undoFlash={false}
                    settingsFlash={null}
                    gameMode="stats"
                    onCast={noop}
                    onConnectHardware={noop}
                    onSettings={noop}
                    onEndGame={noop}
                    onUnlockTouchScoring={noop}
                />
            );

        case 'touchdeck-minimal':
            return (
                <PiTouchScoringMinimal
                    {...common}
                    sendAction={noop}
                    onClose={noop}
                    onCast={noop}
                    onConnectHardware={noop}
                    onSettings={noop}
                    onEndGame={noop}
                />
            );

        case 'touchdeck-classic':
            return (
                <PiTouchScoring
                    {...common}
                    sendAction={noop}
                    onClose={noop}
                    onCast={noop}
                    onConnectHardware={noop}
                    onSettings={noop}
                    onEndGame={noop}
                />
            );

        case 'shotflow-advanced':
            return (
                <AdvancedFlowHost
                    event={shotEvent}
                    teamA={fixture.teamA} teamB={fixture.teamB}
                    teamAColor={fixture.teamA.color} teamBColor={fixture.teamB.color}
                    clock={fixture.clock}
                    onAttribute={noop}
                    fallback={<div style={{ padding: 40, color: '#888', fontFamily: 'monospace' }}>flow finished — reload to replay</div>}
                />
            );

        case 'shotflow-stats':
            return (
                <PiStatsPlayerPicker
                    event={shotEvent}
                    teamA={fixture.teamA} teamB={fixture.teamB}
                    teamAColor={fixture.teamA.color} teamBColor={fixture.teamB.color}
                    clock={fixture.clock}
                    onAttribute={noop}
                    onSkip={noop}
                />
            );

        default:
            return (
                <div style={{ padding: 40, color: '#fff', fontFamily: 'monospace', background: '#000', minHeight: '100vh' }}>
                    <h1>UI Audit Fixture</h1>
                    <p>Available variants:</p>
                    <ul>
                        <li><a href="/uiaudit/scoreboard-minimal" style={{ color: '#22C55E' }}>/uiaudit/scoreboard-minimal</a></li>
                        <li><a href="/uiaudit/scoreboard-classic" style={{ color: '#22C55E' }}>/uiaudit/scoreboard-classic</a></li>
                        <li><a href="/uiaudit/touchdeck-minimal"  style={{ color: '#22C55E' }}>/uiaudit/touchdeck-minimal</a></li>
                        <li><a href="/uiaudit/touchdeck-classic"  style={{ color: '#22C55E' }}>/uiaudit/touchdeck-classic</a></li>
                        <li><a href="/uiaudit/shotflow-advanced"  style={{ color: '#22C55E' }}>/uiaudit/shotflow-advanced</a></li>
                        <li><a href="/uiaudit/shotflow-stats"     style={{ color: '#22C55E' }}>/uiaudit/shotflow-stats</a></li>
                    </ul>
                </div>
            );
    }
}
