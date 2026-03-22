// src/services/shotService.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Shot Chart Service (Supabase)
//
// CRUD operations for shot_events and game_actions tables.
// Real-time subscription for live shot updates on spectator views.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';
import type {
    ShotEvent,
    ShotAttribute,
    ShotZoneId,
    ShotType,
    GameAction,
    GameActionType,
    ZoneStat,
    PlayerShotSummary,
} from '../components/shotchart/types/shotTypes';
import { ZONES, classifyZone } from '../components/shotchart/courtZones';

// ═══════════════════════════════════════════════════════════════════════════
// SHOT EVENTS — WRITE
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateShotParams {
    gameCode: string;
    playerId: string | null;
    teamSide: 'A' | 'B';
    x: number | null;
    y: number | null;
    zone: ShotZoneId;
    made: boolean;
    points: 1 | 2 | 3;
    shotType: ShotType;
    period: number;
    gameClockSec: number | null;
    attributes?: ShotAttribute[];
    assistedBy?: string | null;
    inputMethod?: 'live' | 'post_game_edit';
}

export const createShotEvent = async (params: CreateShotParams): Promise<string | null> => {
    const finalX = params.x ?? (ZONES[params.zone]?.cx ?? 50);
    const finalY = params.y ?? (ZONES[params.zone]?.cy ?? 47);
    const finalZone = params.zone !== 'unlocated' && params.x !== null
        ? classifyZone(params.x, params.y!)
        : params.zone;

    const { data, error } = await supabase
        .from('shot_events')
        .insert({
            game_code: params.gameCode,
            player_id: params.playerId,
            team_side: params.teamSide,
            x: finalX,
            y: finalY,
            zone: finalZone,
            made: params.made,
            points: params.points,
            shot_type: params.shotType,
            period: params.period,
            game_clock_sec: params.gameClockSec,
            attributes: params.attributes || [],
            assisted_by: params.assistedBy || null,
            input_method: params.inputMethod || 'live',
        })
        .select('id')
        .single();

    if (error) {
        console.error('[ShotService] createShotEvent failed:', error);
        return null;
    }
    return data?.id || null;
};

// ═══════════════════════════════════════════════════════════════════════════
// SHOT EVENTS — READ
// ═══════════════════════════════════════════════════════════════════════════

export const getShotsForGame = async (gameCode: string): Promise<ShotEvent[]> => {
    const { data, error } = await supabase
        .from('shot_events')
        .select('*')
        .eq('game_code', gameCode)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[ShotService] getShotsForGame failed:', error);
        return [];
    }

    return (data || []).map(mapRowToShotEvent);
};

export const getShotsForPlayer = async (playerId: string): Promise<ShotEvent[]> => {
    const { data, error } = await supabase
        .from('shot_events')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[ShotService] getShotsForPlayer failed:', error);
        return [];
    }

    return (data || []).map(mapRowToShotEvent);
};

// ═══════════════════════════════════════════════════════════════════════════
// SHOT EVENTS — UPDATE (post-game editing)
// ═══════════════════════════════════════════════════════════════════════════

export const updateShotEvent = async (
    shotId: string,
    updates: Partial<{
        playerId: string | null;
        x: number;
        y: number;
        zone: ShotZoneId;
        made: boolean;
        attributes: ShotAttribute[];
    }>
): Promise<boolean> => {
    const dbUpdates: Record<string, any> = { edited_at: new Date().toISOString() };

    if (updates.playerId !== undefined) dbUpdates.player_id = updates.playerId;
    if (updates.x !== undefined) dbUpdates.x = updates.x;
    if (updates.y !== undefined) dbUpdates.y = updates.y;
    if (updates.zone !== undefined) dbUpdates.zone = updates.zone;
    if (updates.made !== undefined) dbUpdates.made = updates.made;
    if (updates.attributes !== undefined) dbUpdates.attributes = updates.attributes;

    // If coordinates changed, reclassify zone
    if (updates.x !== undefined && updates.y !== undefined) {
        dbUpdates.zone = classifyZone(updates.x, updates.y);
    }

    dbUpdates.input_method = 'post_game_edit';

    const { error } = await supabase
        .from('shot_events')
        .update(dbUpdates)
        .eq('id', shotId);

    if (error) {
        console.error('[ShotService] updateShotEvent failed:', error);
        return false;
    }
    return true;
};

export const deleteShotEvent = async (shotId: string): Promise<boolean> => {
    const { error } = await supabase
        .from('shot_events')
        .delete()
        .eq('id', shotId);

    if (error) {
        console.error('[ShotService] deleteShotEvent failed:', error);
        return false;
    }
    return true;
};

// ═══════════════════════════════════════════════════════════════════════════
// GAME ACTIONS — WRITE
// ═══════════════════════════════════════════════════════════════════════════

export const createGameAction = async (params: {
    gameCode: string;
    playerId: string | null;
    teamSide: 'A' | 'B';
    actionType: GameActionType;
    subtype?: string;
    period: number;
    gameClockSec?: number | null;
    relatedShotId?: string | null;
}): Promise<string | null> => {
    const { data, error } = await supabase
        .from('game_actions')
        .insert({
            game_code: params.gameCode,
            player_id: params.playerId,
            team_side: params.teamSide,
            action_type: params.actionType,
            subtype: params.subtype || null,
            period: params.period,
            game_clock_sec: params.gameClockSec ?? null,
            related_shot_id: params.relatedShotId || null,
        })
        .select('id')
        .single();

    if (error) {
        console.error('[ShotService] createGameAction failed:', error);
        return null;
    }
    return data?.id || null;
};

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME SUBSCRIPTION
// ═══════════════════════════════════════════════════════════════════════════

export const subscribeToShots = (
    gameCode: string,
    callback: (shots: ShotEvent[]) => void
): (() => void) => {
    // Initial fetch
    getShotsForGame(gameCode).then(callback);

    // Real-time updates
    const channel = supabase
        .channel(`shots:${gameCode}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'shot_events',
                filter: `game_code=eq.${gameCode}`,
            },
            () => {
                // Re-fetch all shots on any change (simple, correct)
                getShotsForGame(gameCode).then(callback);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS — Computed from shot data
// ═══════════════════════════════════════════════════════════════════════════

export function computeZoneStats(shots: ShotEvent[]): ZoneStat[] {
    const fieldGoals = shots.filter(s => s.shotType === 'field_goal');
    const byZone = new Map<ShotZoneId, { fga: number; fgm: number; pts: number }>();

    for (const shot of fieldGoals) {
        const zone = shot.zone;
        const current = byZone.get(zone) || { fga: 0, fgm: 0, pts: 0 };
        current.fga++;
        if (shot.made) {
            current.fgm++;
            current.pts += shot.points;
        }
        byZone.set(zone, current);
    }

    return Array.from(byZone.entries()).map(([zoneId, stats]) => ({
        zone: zoneId,
        label: ZONES[zoneId]?.label || zoneId,
        fga: stats.fga,
        fgm: stats.fgm,
        fgPct: stats.fga > 0 ? (stats.fgm / stats.fga) * 100 : 0,
        points: stats.pts,
        ptsPerShot: stats.fga > 0 ? stats.pts / stats.fga : 0,
    })).sort((a, b) => b.fga - a.fga);
}

export function computePlayerShotSummaries(shots: ShotEvent[]): PlayerShotSummary[] {
    const byPlayer = new Map<string, {
        name: string; fga: number; fgm: number; threePa: number; threePm: number;
        ftA: number; ftM: number; pts: number;
    }>();

    for (const shot of shots) {
        const key = shot.playerId || '__unknown__';
        const current = byPlayer.get(key) || {
            name: shot.playerId ? (shot as any).playerName || `Player` : 'Unknown',
            fga: 0, fgm: 0, threePa: 0, threePm: 0, ftA: 0, ftM: 0, pts: 0,
        };

        if (shot.shotType === 'free_throw') {
            current.ftA++;
            if (shot.made) { current.ftM++; current.pts += 1; }
        } else {
            current.fga++;
            if (shot.made) { current.fgm++; current.pts += shot.points; }
            if (shot.points === 3) {
                current.threePa++;
                if (shot.made) current.threePm++;
            }
        }

        byPlayer.set(key, current);
    }

    return Array.from(byPlayer.entries()).map(([playerId, s]) => {
        const fgPct = s.fga > 0 ? (s.fgm / s.fga) * 100 : 0;
        const threePct = s.threePa > 0 ? (s.threePm / s.threePa) * 100 : 0;
        const ftPct = s.ftA > 0 ? (s.ftM / s.ftA) * 100 : 0;
        const efgPct = s.fga > 0 ? ((s.fgm + 0.5 * s.threePm) / s.fga) * 100 : 0;
        const tsa = s.fga + 0.44 * s.ftA;
        const tsPct = tsa > 0 ? (s.pts / (2 * tsa)) * 100 : 0;
        const ptsPerShot = s.fga > 0 ? s.pts / s.fga : 0;

        return {
            playerId,
            playerName: s.name,
            fga: s.fga, fgm: s.fgm, fgPct,
            threePa: s.threePa, threePm: s.threePm, threePct,
            ftA: s.ftA, ftM: s.ftM, ftPct,
            efgPct, tsPct, ptsPerShot,
        };
    }).sort((a, b) => b.fga - a.fga);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function mapRowToShotEvent(row: any): ShotEvent {
    return {
        id: row.id,
        gameCode: row.game_code,
        playerId: row.player_id,
        teamSide: row.team_side,
        x: row.x,
        y: row.y,
        zone: row.zone,
        made: row.made,
        points: row.points,
        shotType: row.shot_type,
        period: row.period,
        gameClockSec: row.game_clock_sec,
        attributes: row.attributes || [],
        assistedBy: row.assisted_by,
        reboundedBy: row.rebounded_by,
        reboundType: row.rebound_type,
        blockedBy: row.blocked_by,
        inputMethod: row.input_method || 'live',
        editedAt: row.edited_at,
        createdAt: row.created_at,
    };
}