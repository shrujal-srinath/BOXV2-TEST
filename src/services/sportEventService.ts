// src/services/sportEventService.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Sport Event Service
//
// Generic event log for all non-basketball sports.
// Basketball uses shotService.ts (richer x/y/zone schema).
//
// Each sport records its events here with an event_type string.
// See migration 002_add_sport_events_table.sql for the full
// event_type vocabulary per sport.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';
import type { BasketballGame } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SportEvent {
  id?: string;
  gameCode: string;
  sportId: string;
  eventType: string;
  teamSide?: 'A' | 'B' | 'N';
  playerId?: string | null;
  playerName?: string | null;
  period?: number;
  clockSec?: number | null;
  value?: number;
  payload?: Record<string, unknown>;
  createdAt?: string;
}

export interface RecordEventParams extends Omit<SportEvent, 'id' | 'createdAt'> {}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Record a single sport event via the validated record_sport_event() RPC.
 * Returns the new event UUID, or null on failure.
 *
 * The RPC validates that auth.uid() owns the game before inserting,
 * so no extra auth check is needed here.
 */
export const recordSportEvent = async (
  params: RecordEventParams
): Promise<string | null> => {
  const { data, error } = await supabase.rpc('record_sport_event', {
    p_game_code:   params.gameCode,
    p_sport_id:    params.sportId,
    p_event_type:  params.eventType,
    p_team_side:   params.teamSide   ?? null,
    p_player_id:   params.playerId   ?? null,
    p_player_name: params.playerName ?? null,
    p_period:      params.period     ?? 1,
    p_clock_sec:   params.clockSec   ?? null,
    p_value:       params.value      ?? 0,
    p_payload:     params.payload    ?? {},
  });

  if (error) {
    console.error('[SportEventService] recordSportEvent failed:', error);
    return null;
  }
  return data as string | null;
};

/**
 * Undo (delete) a sport event by ID.
 * Only the game host can delete (enforced by RLS policy).
 */
export const deleteSportEvent = async (eventId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('sport_events')
    .delete()
    .eq('id', eventId);

  if (error) {
    console.error('[SportEventService] deleteSportEvent failed:', error);
    return false;
  }
  return true;
};

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * One-time fetch of all sport events for a game, ordered chronologically.
 */
export const getSportEventsForGame = async (
  gameCode: string
): Promise<SportEvent[]> => {
  const { data, error } = await supabase
    .from('sport_events')
    .select('*')
    .eq('game_code', gameCode)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[SportEventService] getSportEventsForGame failed:', error);
    return [];
  }
  return (data ?? []).map(mapRowToSportEvent);
};

/**
 * Fetch events filtered by type within a game.
 * e.g. getSportEventsByType('ABCD', 'goal') for just goals.
 */
export const getSportEventsByType = async (
  gameCode: string,
  eventType: string
): Promise<SportEvent[]> => {
  const { data, error } = await supabase
    .from('sport_events')
    .select('*')
    .eq('game_code', gameCode)
    .eq('event_type', eventType)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[SportEventService] getSportEventsByType failed:', error);
    return [];
  }
  return (data ?? []).map(mapRowToSportEvent);
};

// ─── Realtime ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to sport events for a game.
 * Re-fetches all events on any INSERT (same pattern as subscribeToShots).
 * Returns an unsubscribe function for cleanup.
 */
export const subscribeToSportEvents = (
  gameCode: string,
  onEvents: (events: SportEvent[]) => void
): (() => void) => {
  // Initial load
  getSportEventsForGame(gameCode).then(onEvents);

  const channel = supabase
    .channel(`sport_events:${gameCode}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'sport_events',
        filter: `game_code=eq.${gameCode}`,
      },
      () => {
        getSportEventsForGame(gameCode).then(onEvents);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'sport_events',
        filter: `game_code=eq.${gameCode}`,
      },
      () => {
        getSportEventsForGame(gameCode).then(onEvents);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// ─── Live Games Discovery ─────────────────────────────────────────────────────

/**
 * Fetch currently live games, with optional sport filter.
 * Uses the get_live_games() RPC which hits the composite index
 * idx_games_sport_status — much faster than full-table scan.
 *
 * Replaces the subscribeToLiveGames() polling pattern in WatchPage.
 */
export const getLiveGamesBySport = async (
  sportId?: string
): Promise<BasketballGame[]> => {
  const { data, error } = await supabase.rpc('get_live_games', {
    p_sport_id: sportId ?? null,
    p_limit:    20,
  });

  if (error) {
    console.error('[SportEventService] getLiveGamesBySport failed:', error);
    return [];
  }

  return ((data ?? []) as any[]).map((row) =>
    row.data ? row.data as BasketballGame : row as BasketballGame
  );
};

/**
 * Subscribe to live games feed using Postgres Changes.
 * Fetches via indexed RPC on every change instead of full-table scan.
 * Returns unsubscribe function.
 */
export const subscribeToLiveGamesBySport = (
  onGames: (games: BasketballGame[]) => void,
  sportId?: string
): (() => void) => {
  // Initial load
  getLiveGamesBySport(sportId).then(onGames);

  const channel = supabase
    .channel(`live_games${sportId ? `:${sportId}` : ''}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'games' },
      () => {
        getLiveGamesBySport(sportId).then(onGames);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// ─── Post-Game Summary ────────────────────────────────────────────────────────

export interface GameSummary {
  game: BasketballGame;
  sport_events: Record<string, number>;
  shot_stats: {
    total: number;
    made: number;
    missed: number;
    total_pts: number;
    fg_pct: number | null;
  };
}

/**
 * Fetch the post-game summary (game data + event counts + shot stats).
 * Uses the get_game_summary() RPC.
 */
export const getGameSummary = async (
  gameCode: string
): Promise<GameSummary | null> => {
  const { data, error } = await supabase.rpc('get_game_summary', {
    p_game_code: gameCode,
  });

  if (error) {
    console.error('[SportEventService] getGameSummary failed:', error);
    return null;
  }
  return data as GameSummary | null;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function mapRowToSportEvent(row: Record<string, unknown>): SportEvent {
  return {
    id:          row.id          as string,
    gameCode:    row.game_code   as string,
    sportId:     row.sport_id    as string,
    eventType:   row.event_type  as string,
    teamSide:    row.team_side   as 'A' | 'B' | 'N' | undefined,
    playerId:    row.player_id   as string | null,
    playerName:  row.player_name as string | null,
    period:      row.period      as number,
    clockSec:    row.clock_sec   as number | null,
    value:       row.value       as number,
    payload:     row.payload     as Record<string, unknown>,
    createdAt:   row.created_at  as string,
  };
}
