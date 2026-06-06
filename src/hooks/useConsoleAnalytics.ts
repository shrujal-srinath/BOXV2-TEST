// src/hooks/useConsoleAnalytics.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Scoring-console analytics (prop-driven, no engine coupling)
//
// Consumed only by AdvancedConsole. Derives possession time/count, And-1
// detection, quarter-end banner, and predictive-followup state from the props
// the console already receives plus imperative notifiers it calls from its
// existing handlers. Touches NOTHING in useLocalGame / shotService / the
// persisted-synced engine.
//
// Possession heuristic: the game clock counts DOWN, so the time a team held
// possession is (clock when they got it) − (clock now). Accumulated on each
// `possession` prop transition; reset when `period` changes.
//
// And-1 assumption: onSecondaryAction(side,'foul') reports the FOULING team.
// An armed made-shot offer becomes claimable when a foul on the OTHER team is
// logged within the window — the +1 FT is awarded to the shooter's team.
//
// Predictive-followup pre-highlight: ASSIST → the shooter-team player with the
// lowest jersey number (the de-facto primary handler) excluding the shooter;
// REBOUND → no pre-highlight.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';

export type Side = 'A' | 'B';

interface RosterPlayer { id: string; number: string; name: string }

export interface FollowupPlayer {
    id: string;
    number: string;
    name: string;
    teamSide: Side;
    teamColor: string;
}

export interface FollowupState {
    kind: 'assist' | 'rebound';
    /** Shooter team for an assist; null for a rebound (either team can grab). */
    teamSide: Side | null;
    players: FollowupPlayer[];
    highlightId: string | null;
}

export interface AndOneOffer {
    team: Side;
    playerId: string | null;
    playerName: string | null;
    expires: number;
    foulLogged?: boolean;
}

interface UseConsoleAnalyticsParams {
    period: number;
    minutes: number;
    seconds: number;
    possession: Side;
    teamAPlayers: RosterPlayer[];
    teamBPlayers: RosterPlayer[];
    teamAColor: string;
    teamBColor: string;
}

export interface ConsoleAnalytics {
    possessionTime: { A: number; B: number };
    possessionCount: { A: number; B: number };

    andOneOffer: AndOneOffer | null;
    registerMade: (team: Side, playerId: string | null, playerName: string | null) => void;
    registerFoul: (foulingSide: Side) => void;
    clearAndOne: () => void;

    qEndBanner: boolean;
    dismissQEnd: () => void;

    followup: FollowupState | null;
    triggerFollowup: (info: { team: Side; made: boolean; shooterPlayerId: string | null }) => void;
    resolveFollowup: () => void;
    skipFollowup: () => void;
}

const AND_ONE_ARM_MS = 3000;
const AND_ONE_CLAIM_MS = 4000;

const lowestNumberId = (players: RosterPlayer[], excludeId: string | null): string | null => {
    let best: RosterPlayer | null = null;
    for (const p of players) {
        if (p.id === excludeId) continue;
        const n = parseInt(p.number, 10);
        const bn = best ? parseInt(best.number, 10) : Number.POSITIVE_INFINITY;
        if (!Number.isNaN(n) && n < bn) best = p;
    }
    return best?.id ?? null;
};

export function useConsoleAnalytics(params: UseConsoleAnalyticsParams): ConsoleAnalytics {
    const {
        period, minutes, seconds, possession,
        teamAPlayers, teamBPlayers, teamAColor, teamBColor,
    } = params;

    const nowSec = minutes * 60 + seconds;

    // ── Possession time / count ──────────────────────────────────────────────
    const [possessionTime, setPossessionTime] = useState<{ A: number; B: number }>({ A: 0, B: 0 });
    const [possessionCount, setPossessionCount] = useState<{ A: number; B: number }>({ A: 0, B: 0 });
    const prevPossessionRef = useRef<Side>(possession);
    const startSecRef = useRef<number>(nowSec);
    const nowSecRef = useRef<number>(nowSec);
    nowSecRef.current = nowSec;

    useEffect(() => {
        if (possession === prevPossessionRef.current) return;
        const from = prevPossessionRef.current;
        const elapsed = Math.max(0, startSecRef.current - nowSecRef.current);
        setPossessionTime(pt => ({ ...pt, [from]: pt[from] + elapsed }));
        setPossessionCount(pc => ({ ...pc, [from]: pc[from] + 1 }));
        startSecRef.current = nowSecRef.current;
        prevPossessionRef.current = possession;
    }, [possession]);

    // Reset possession accrual at period boundaries.
    useEffect(() => {
        setPossessionTime({ A: 0, B: 0 });
        setPossessionCount({ A: 0, B: 0 });
        startSecRef.current = nowSecRef.current;
    }, [period]);

    // ── And-1 detector ───────────────────────────────────────────────────────
    const [andOneOffer, setAndOneOffer] = useState<AndOneOffer | null>(null);

    const registerMade = useCallback((team: Side, playerId: string | null, playerName: string | null) => {
        setAndOneOffer({ team, playerId, playerName, expires: Date.now() + AND_ONE_ARM_MS });
    }, []);

    const registerFoul = useCallback((foulingSide: Side) => {
        setAndOneOffer(prev => {
            if (!prev) return prev;
            if (prev.team === foulingSide) return prev;
            if (Date.now() >= prev.expires) return prev;
            return { ...prev, foulLogged: true, expires: Date.now() + AND_ONE_CLAIM_MS };
        });
    }, []);

    const clearAndOne = useCallback(() => setAndOneOffer(null), []);

    useEffect(() => {
        if (!andOneOffer) return;
        const ms = Math.max(0, andOneOffer.expires - Date.now());
        const t = setTimeout(() => setAndOneOffer(null), ms);
        return () => clearTimeout(t);
    }, [andOneOffer]);

    // ── Quarter-end banner ───────────────────────────────────────────────────
    const [qEndBanner, setQEndBanner] = useState(false);
    const qEndDismissedRef = useRef(false);

    useEffect(() => {
        if (nowSec === 0 && !qEndDismissedRef.current) setQEndBanner(true);
    }, [nowSec]);

    useEffect(() => {
        setQEndBanner(false);
        qEndDismissedRef.current = false;
    }, [period]);

    const dismissQEnd = useCallback(() => {
        qEndDismissedRef.current = true;
        setQEndBanner(false);
    }, []);

    // ── Predictive followup ──────────────────────────────────────────────────
    const [followup, setFollowup] = useState<FollowupState | null>(null);

    const triggerFollowup = useCallback((info: { team: Side; made: boolean; shooterPlayerId: string | null }) => {
        const meta = (side: Side) => ({
            players: side === 'A' ? teamAPlayers : teamBPlayers,
            color: side === 'A' ? teamAColor : teamBColor,
        });
        if (info.made) {
            const m = meta(info.team);
            const players: FollowupPlayer[] = m.players
                .filter(p => p.id !== info.shooterPlayerId)
                .map(p => ({ ...p, teamSide: info.team, teamColor: m.color }));
            setFollowup({
                kind: 'assist',
                teamSide: info.team,
                players,
                highlightId: lowestNumberId(m.players, info.shooterPlayerId),
            });
        } else {
            const a = meta('A');
            const b = meta('B');
            const players: FollowupPlayer[] = [
                ...a.players.map(p => ({ ...p, teamSide: 'A' as Side, teamColor: a.color })),
                ...b.players.map(p => ({ ...p, teamSide: 'B' as Side, teamColor: b.color })),
            ];
            setFollowup({ kind: 'rebound', teamSide: null, players, highlightId: null });
        }
    }, [teamAPlayers, teamBPlayers, teamAColor, teamBColor]);

    const resolveFollowup = useCallback(() => setFollowup(null), []);
    const skipFollowup = useCallback(() => setFollowup(null), []);

    return {
        possessionTime, possessionCount,
        andOneOffer, registerMade, registerFoul, clearAndOne,
        qEndBanner, dismissQEnd,
        followup, triggerFollowup, resolveFollowup, skipFollowup,
    };
}
