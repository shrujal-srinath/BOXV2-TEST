// src/services/fibaTimeouts.ts
// ═══════════════════════════════════════════════════════════════
// FIBA TIMEOUT RULES (2024 Official Basketball Rules)
//
// 5v5 — 4 quarters of 10 minutes:
//   • 2 timeouts in H1 (Q1+Q2)
//   • 3 timeouts in H2 (Q3+Q4)        — fresh allotment, H1 unused timeouts are LOST
//   • 1 timeout per overtime           — fresh per OT, never carries over
//   • Last 2:00 of Q4: cap at max 2 remaining
//
// 5v5 — 2 halves (non-standard but supported):
//   • 2 per half (no FIBA rule for 2-half senior basketball, default to even split)
//   • 1 per OT
//
// 3x3 / single-period:
//   • 1 timeout per team for the whole game
// ═══════════════════════════════════════════════════════════════

export type TimeoutMode = 'fiba' | 'custom';

/** How many timeouts a team gets in the bucket that contains `period`. */
export function fibaTimeoutsForPeriod(period: number, totalPeriods: number): number {
    if (totalPeriods >= 4) {
        if (period <= 2) return 2;          // H1
        if (period <= totalPeriods) return 3; // H2
        return 1;                            // OT
    }
    if (totalPeriods === 2) {
        if (period <= 2) return 2;          // each half
        return 1;                            // OT
    }
    return 1;                                // single-period (3x3)
}

/**
 * A stable identifier for the current "timeout bucket".
 * When this value changes between two consecutive periods, the
 * timeout count must be reset to the new bucket's allotment.
 */
export function timeoutBucketKey(period: number, totalPeriods: number): string {
    if (totalPeriods >= 4) {
        if (period <= 2) return 'H1';
        if (period <= totalPeriods) return 'H2';
        return `OT${period - totalPeriods}`;
    }
    if (totalPeriods === 2) {
        if (period === 1) return 'H1';
        if (period === 2) return 'H2';
        return `OT${period - 2}`;
    }
    return period === 1 ? 'REG' : `OT${period - 1}`;
}

/** Human-readable label, e.g. "Q1–Q2 · 2 TO" / "Q3–Q4 · 3 TO" / "OT1 · 1 TO". */
export function bucketLabel(period: number, totalPeriods: number): string {
    const n = fibaTimeoutsForPeriod(period, totalPeriods);
    if (totalPeriods >= 4) {
        if (period <= 2) return `H1 · ${n} TO`;
        if (period <= totalPeriods) return `H2 · ${n} TO`;
        return `OT${period - totalPeriods} · ${n} TO`;
    }
    if (totalPeriods === 2) {
        if (period === 1) return `H1 · ${n} TO`;
        if (period === 2) return `H2 · ${n} TO`;
        return `OT${period - 2} · ${n} TO`;
    }
    return period === 1 ? `REG · ${n} TO` : `OT${period - 1} · ${n} TO`;
}

/** A short summary of the full FIBA allotment used on the setup/review screens. */
export function fibaSummary(totalPeriods: number): string {
    if (totalPeriods >= 4) return 'Q1–Q2: 2 · Q3–Q4: 3 · OT: 1';
    if (totalPeriods === 2) return 'H1: 2 · H2: 2 · OT: 1';
    return '1 PER GAME';
}

/**
 * Whether the FIBA "last 2 minutes of Q4" cap (max 2 remaining) is active.
 * Only applies in 4-quarter games during the final regulation period.
 */
export function inLast2MinQ4Cap(period: number, totalPeriods: number, gameMs: number): boolean {
    return totalPeriods >= 4 && period === totalPeriods && gameMs <= 120_000;
}
