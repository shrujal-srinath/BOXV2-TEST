// src/services/gameMode.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Game-mode resolution + data-driven capability flags.
//
// The mode is set at setup (quick/stats/advanced) but we NEVER trust it alone for
// rendering — referee consoles sometimes record game_actions with a null player_id,
// so per-player columns must be gated on whether the data actually exists.
// ─────────────────────────────────────────────────────────────────────────────

import type { GameMode, StatCapabilities, StatCategory, GameBoxScore } from '../components/stats/types';
import type { ShotEvent, GameAction } from '../components/shotchart/types/shotTypes';

/** Read the configured mode from a persisted game's JSONB `data`. Defaults to 'quick'. */
export const resolveGameMode = (gameData: any): GameMode => {
  const m = gameData?.settings?.gameMode;
  return m === 'advanced' || m === 'stats' || m === 'quick' ? m : 'quick';
};

/** True if any shot carries a real (non-defaulted) court location. */
const hasRealShotLocations = (shots: ShotEvent[]): boolean =>
  shots.some(
    s => s.zone !== 'unlocated' && s.x != null && s.y != null && s.shotType !== 'free_throw'
  );

/**
 * Derive what we can actually show, from the computed box score + raw events.
 * A category is "tracked" if any player has a non-zero value for it OR an
 * attributed event exists.
 */
export const deriveCapabilities = (
  mode: GameMode,
  box: GameBoxScore | null,
  shots: ShotEvent[],
  actions: GameAction[]
): StatCapabilities => {
  const rows = box ? [...box.teamA.rows, ...box.teamB.rows] : [];
  const any = (pred: (r: typeof rows[number]) => boolean) => rows.some(pred);

  const hasPlayers = mode !== 'quick' && rows.length > 0;
  const hasRebounds = any(r => r.reb > 0) || actions.some(a => a.actionType === 'rebound' && a.playerId);
  const hasAssists = any(r => r.ast > 0) || shots.some(s => s.assistedBy) || actions.some(a => a.actionType === 'assist' && a.playerId);
  const hasSteals = any(r => r.stl > 0) || actions.some(a => a.actionType === 'steal' && a.playerId);
  const hasBlocks = any(r => r.blk > 0) || actions.some(a => a.actionType === 'block' && a.playerId);
  const hasTurnovers = any(r => r.tov > 0) || actions.some(a => a.actionType === 'turnover' && a.playerId);
  const hasFouls = any(r => r.pf > 0) || actions.some(a => a.actionType === 'foul' && a.playerId);
  const hasFreeThrows = any(r => r.fta > 0);
  const hasThrees = any(r => r.tpa > 0);
  const hasShotLocations = mode === 'advanced' && hasRealShotLocations(shots);
  const hasMisses = shots.some(s => s.shotType !== 'free_throw' && !s.made);
  const hasShotClock = shots.some(s => (s as any).shotClockSec != null);

  // Build the box-score column set in display order, dropping untracked optionals.
  const columns: StatCategory[] = ['pts', 'fg'];
  if (hasThrees) columns.push('tp');
  if (hasFreeThrows) columns.push('ft');
  if (hasRebounds) columns.push('reb');
  if (hasAssists) columns.push('ast');
  if (hasSteals) columns.push('stl');
  if (hasBlocks) columns.push('blk');
  if (hasTurnovers) columns.push('tov');
  if (hasFouls) columns.push('pf');

  return {
    mode,
    exportable: mode !== 'quick',
    hasPlayers,
    hasShotLocations,
    hasRebounds,
    hasAssists,
    hasSteals,
    hasBlocks,
    hasTurnovers,
    hasFouls,
    hasFreeThrows,
    hasThrees,
    hasMisses,
    hasShotClock,
    columns,
  };
};
