// src/hooks/useShotChart.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Shot Chart Hook
//
// Subscribes to shot_events for a game and provides:
//   - Raw shot list (for scatter plot)
//   - Zone stats (for efficiency map)
//   - Player summaries (for box score)
//   - Filter state management
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useCallback } from 'react';
import { subscribeToShots, computeZoneStats, computePlayerShotSummaries } from '../services/shotService';
import type { ShotEvent, ZoneStat, PlayerShotSummary } from '../components/shotchart/types/shotTypes';

interface ShotFilter {
    teamSide: 'A' | 'B' | 'all';
    playerId: string | null;
    period: number | null;       // null = all periods
    result: 'made' | 'missed' | 'all';
    shotPoints: 1 | 2 | 3 | null; // null = all
}

const DEFAULT_FILTER: ShotFilter = {
    teamSide: 'all',
    playerId: null,
    period: null,
    result: 'all',
    shotPoints: null,
};

export function useShotChart(gameCode: string | null) {
    const [allShots, setAllShots] = useState<ShotEvent[]>([]);
    const [filter, setFilter] = useState<ShotFilter>(DEFAULT_FILTER);
    const [loading, setLoading] = useState(true);

    // Subscribe to real-time shot updates
    useEffect(() => {
        if (!gameCode) {
            setAllShots([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeToShots(gameCode, (shots) => {
            setAllShots(shots);
            setLoading(false);
        });

        return unsubscribe;
    }, [gameCode]);

    // Apply filters
    const filteredShots = useMemo(() => {
        return allShots.filter(shot => {
            if (filter.teamSide !== 'all' && shot.teamSide !== filter.teamSide) return false;
            if (filter.playerId && shot.playerId !== filter.playerId) return false;
            if (filter.period !== null && shot.period !== filter.period) return false;
            if (filter.result === 'made' && !shot.made) return false;
            if (filter.result === 'missed' && shot.made) return false;
            if (filter.shotPoints !== null && shot.points !== filter.shotPoints) return false;
            return true;
        });
    }, [allShots, filter]);

    // Computed analytics
    const zoneStats = useMemo(() => computeZoneStats(filteredShots), [filteredShots]);
    const playerSummaries = useMemo(() => computePlayerShotSummaries(filteredShots), [filteredShots]);

    // Aggregate stats
    const aggregateStats = useMemo(() => {
        const fg = filteredShots.filter(s => s.shotType === 'field_goal');
        const fga = fg.length;
        const fgm = fg.filter(s => s.made).length;
        const threePa = fg.filter(s => s.points === 3).length;
        const threePm = fg.filter(s => s.points === 3 && s.made).length;
        const ft = filteredShots.filter(s => s.shotType === 'free_throw');
        const fta = ft.length;
        const ftm = ft.filter(s => s.made).length;
        const totalPoints = fgm * 2 + threePm + ftm; // approximate
        const pts = filteredShots.filter(s => s.made).reduce((sum, s) => sum + s.points, 0);

        return {
            fga, fgm,
            fgPct: fga > 0 ? (fgm / fga) * 100 : 0,
            threePa, threePm,
            threePct: threePa > 0 ? (threePm / threePa) * 100 : 0,
            fta, ftm,
            ftPct: fta > 0 ? (ftm / fta) * 100 : 0,
            totalPoints: pts,
            efgPct: fga > 0 ? ((fgm + 0.5 * threePm) / fga) * 100 : 0,
            ptsPerShot: fga > 0 ? pts / fga : 0,
        };
    }, [filteredShots]);

    // Unique players in the data
    const players = useMemo(() => {
        const seen = new Map<string, string>();
        allShots.forEach(s => {
            if (s.playerId && !seen.has(s.playerId)) {
                seen.set(s.playerId, s.playerId);
            }
        });
        return Array.from(seen.keys());
    }, [allShots]);

    // Unique periods
    const periods = useMemo(() => {
        return [...new Set(allShots.map(s => s.period))].sort();
    }, [allShots]);

    const updateFilter = useCallback((updates: Partial<ShotFilter>) => {
        setFilter(prev => ({ ...prev, ...updates }));
    }, []);

    const resetFilter = useCallback(() => {
        setFilter(DEFAULT_FILTER);
    }, []);

    return {
        allShots,
        filteredShots,
        filter,
        updateFilter,
        resetFilter,
        zoneStats,
        playerSummaries,
        aggregateStats,
        players,
        periods,
        loading,
        shotCount: allShots.length,
        hasLocationData: allShots.some(s => s.zone !== 'unlocated'),
    };
}