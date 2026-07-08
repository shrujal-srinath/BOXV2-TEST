// src/services/statsPersistService.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — After-Game Stats Persistence (PLAN-U P3)
//
// Turns a computed GameReport into durable per-player / per-team rows
// (migration 014: game_player_stats, game_team_stats) so careers accumulate
// and linked players' accounts receive their stats automatically.
//
// Design:
//   • reportToRows() is PURE and golden-tested — the row shapes are the
//     contract careers/views/cards read; keep them stable.
//   • persistGameReport() is IDEMPOTENT (upsert on the migration's unique
//     keys) and GRACEFUL: if migration 014 isn't applied yet (table missing,
//     42P01/404) it logs once and returns 'unavailable' — callers never break.
//   • Triggered LAZILY from the stats surfaces (useGameStats on the web,
//     PiMatchReport on the referee box) — both compute the report anyway, so
//     every viewed game persists, including historical ones. No daemon change.
//   • player_profile_id fills from roster linking (Player.profileId, once
//     GameSetup ships it — reads optional field today) or later retro-claims.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';
import type { GameReport, PlayerReport } from './gameReport';

export interface GamePlayerStatsRow {
    game_code: string;
    sport_id: string;
    roster_player_id: string;
    player_profile_id: string | null;
    player_name: string;
    player_number: string;
    team_side: 'A' | 'B';
    team_id: string | null;
    team_name: string;
    line: Record<string, unknown>;
    zones: unknown[] | null;
    quality: Record<string, unknown> | null;
    attributes: unknown[] | null;
    periods: unknown[] | null;
}

export interface GameTeamStatsRow {
    game_code: string;
    sport_id: string;
    team_side: 'A' | 'B';
    team_id: string | null;
    team_name: string;
    totals: Record<string, unknown>;
    special: Record<string, unknown>;
    four_factors: Record<string, unknown> | null;
    ratings: Record<string, unknown> | null;
    result: { ptsFor: number; ptsAgainst: number; won: boolean; opponentName: string };
}

/** Roster objects MAY carry a passport link (GameSetup linking, PLAN-U P5). */
interface LinkableRosterEntry { id: string; profileId?: string | null; teamId?: string | null }

const profileIdFor = (p: PlayerReport, gameData: unknown): string | null => {
    const teams = gameData as { teamA?: { players?: LinkableRosterEntry[] }; teamB?: { players?: LinkableRosterEntry[] } } | null;
    const roster = (p.side === 'A' ? teams?.teamA?.players : teams?.teamB?.players) ?? [];
    return roster.find(r => r.id === p.playerId)?.profileId ?? null;
};

/**
 * PURE: shape a report into the migration-014 rows.
 * `gameData` is the games.data JSONB (for optional roster→profile links).
 */
export const reportToRows = (
    report: GameReport,
    gameData?: unknown
): { players: GamePlayerStatsRow[]; teams: GameTeamStatsRow[] } | null => {
    const code = report.header.gameCode?.toUpperCase();
    if (!code) return null;
    if (report.header.mode === 'quick') return null;   // nothing tracked — never persist

    const players: GamePlayerStatsRow[] = report.players.map(p => ({
        game_code: code,
        sport_id: 'basketball',
        roster_player_id: p.playerId,
        player_profile_id: profileIdFor(p, gameData),
        player_name: p.name,
        player_number: p.number,
        team_side: p.side,
        team_id: null,                                  // fills when teams entity ships (P5)
        team_name: p.side === 'A' ? report.header.teamA.name : report.header.teamB.name,
        line: { ...p.row, gameScore: p.gameScore, pie: p.pie } as unknown as Record<string, unknown>,
        zones: p.zones.length ? p.zones : null,
        quality: p.quality.fga > 0 ? (p.quality as unknown as Record<string, unknown>) : null,
        attributes: p.attributes.length ? p.attributes : null,
        periods: p.periods,
    }));

    const teamRow = (side: 'A' | 'B'): GameTeamStatsRow => {
        const own = side === 'A' ? report.header.teamA : report.header.teamB;
        const opp = side === 'A' ? report.header.teamB : report.header.teamA;
        const box = side === 'A' ? report.box.teamA : report.box.teamB;
        const adv = report.advanced ? (side === 'A' ? report.advanced.teamA : report.advanced.teamB) : null;
        return {
            game_code: code,
            sport_id: 'basketball',
            team_side: side,
            team_id: null,
            team_name: own.name,
            totals: box.totals as unknown as Record<string, unknown>,
            special: (side === 'A' ? report.special.teamA : report.special.teamB) as unknown as Record<string, unknown>,
            four_factors: adv ? (adv.fourFactors as unknown as Record<string, unknown>) : null,
            ratings: adv ? (adv.ratings as unknown as Record<string, unknown>) : null,
            result: {
                ptsFor: own.score,
                ptsAgainst: opp.score,
                won: report.header.winner === side,
                opponentName: opp.name,
            },
        };
    };

    return { players, teams: [teamRow('A'), teamRow('B')] };
};

// ── persistence ──────────────────────────────────────────────────────────────

export type PersistResult = 'persisted' | 'skipped' | 'unavailable' | 'failed';

let unavailableLogged = false;
/** Missing-relation errors mean migration 014 isn't applied yet — soft skip. */
const isMissingTable = (err: { code?: string; message?: string } | null): boolean =>
    !!err && (err.code === '42P01' || err.code === 'PGRST205' || /does not exist|find the table/i.test(err.message ?? ''));

// Once-per-session guard: idempotent anyway, this just avoids rewrites on tab hops.
const persistedThisSession = new Set<string>();

/**
 * Upsert the report's rows + stamp games.stats_generated_at.
 * Never throws — stats persistence must not break a stats VIEW.
 */
export const persistGameReport = async (
    report: GameReport,
    gameData?: unknown
): Promise<PersistResult> => {
    try {
        const rows = reportToRows(report, gameData);
        if (!rows) return 'skipped';
        const code = rows.teams[0].game_code;
        if (persistedThisSession.has(code)) return 'skipped';

        const { error: pErr } = await supabase
            .from('game_player_stats')
            .upsert(rows.players, { onConflict: 'game_code,roster_player_id' });
        if (pErr) {
            if (isMissingTable(pErr)) {
                if (!unavailableLogged) {
                    unavailableLogged = true;
                    console.warn('[statsPersist] migration 014 not applied — career persistence idle');
                }
                return 'unavailable';
            }
            console.error('[statsPersist] player rows failed:', pErr);
            return 'failed';
        }

        const { error: tErr } = await supabase
            .from('game_team_stats')
            .upsert(rows.teams, { onConflict: 'game_code,team_side' });
        if (tErr) {
            console.error('[statsPersist] team rows failed:', tErr);
            return 'failed';
        }

        // Best-effort marker (column exists only post-014; failure is fine).
        await supabase.from('games')
            .update({ stats_generated_at: new Date().toISOString() })
            .eq('code', code);

        persistedThisSession.add(code);
        return 'persisted';
    } catch (e) {
        console.error('[statsPersist] unexpected:', e);
        return 'failed';
    }
};
