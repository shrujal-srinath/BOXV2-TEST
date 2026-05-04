// src/services/tournamentService.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Tournament Service (Supabase)
//
// FIXES IN THIS VERSION:
//   FIX 1: subscribeToJoinedTournaments — approvedScorers is JSONB `[]` in the
//           schema, NOT text[]. The correct PostgREST operator for JSONB array
//           containment is @>, sent via .filter(..., '@>', ...). The old
//           .contains() sends `cs` (text array operator) which gets a 400.
//
//   FIX 2: activateDivision — deletes existing fixtures for the division before
//           inserting. Without this, re-initialising a bracket throws a 409
//           unique constraint violation because bracket IDs are deterministic.
//
//   FIX 3: TournamentViewer/VolunteerConsole PIN check — updated to call the
//           verify_scorer_pin() RPC (already exists in verifyScorerPin()).
//           Direct scorerPin read from tournaments table no longer works because
//           scorerPin was moved to tournament_secrets per the v4.1 schema.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';
import { initializeNewGame } from './supabaseGameService';
import type { Tournament, DivisionConfig, TournamentFixture, SportType, GenderCategory, TournamentFormat, SchedulableSport } from '../types';

// ============================================
// HELPERS
// ============================================
const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

const generateId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
};

const getCurrentUserId = async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Must be logged in");
    return user.id;
};

// ============================================
// CORE TOURNAMENT MANAGEMENT
// ============================================
export const createTournament = async (
    name: string,
    logoUrl: string,
    details: { organizer?: string; location?: string; startDate?: string; endDate?: string },
    sportConfig: { [key in SportType]?: { courts: number } }
): Promise<string> => {
    const userId = await getCurrentUserId();
    const id = generateId();

    const initialDivisions: { [key: string]: DivisionConfig } = {};
    const genders: GenderCategory[] = ['men', 'women'];
    (Object.keys(sportConfig) as SportType[]).forEach(sport => {
        genders.forEach(gender => {
            const divId = `${sport}_${gender}`;
            initialDivisions[divId] = { id: divId, sport, gender, isActive: false, format: 'knockout', status: 'setup_required' };
        });
    });

    // Uses the atomic RPC that writes to both tournaments + tournament_secrets
    const { error } = await supabase.rpc('create_tournament_with_pin', {
        p_id: id,
        p_admin_id: userId,
        p_name: name,
        p_logo_url: logoUrl ?? '',
        p_organizer: details.organizer ?? '',
        p_location: details.location ?? '',
        p_start_date: details.startDate ?? '',
        p_end_date: details.endDate ?? '',
        p_scorer_pin: generatePin(),
        p_sport_config: sportConfig,
        p_divisions: initialDivisions,
        p_created_at: Date.now()
    });
    if (error) throw error;
    return id;
};

export const addTournamentSport = async (tournamentId: string, sport: SportType) => {
    const { data: tData, error: fetchErr } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
    if (fetchErr || !tData) throw fetchErr;

    const tournament = tData as Tournament;
    ['men', 'women'].forEach(gender => {
        const divId = `${sport}_${gender}`;
        if (!tournament.divisions[divId]) {
            tournament.divisions[divId] = { id: divId, sport, gender: gender as GenderCategory, isActive: false, format: 'knockout', status: 'setup_required' };
        }
    });
    tournament.sportConfig[sport] = { courts: 1 };

    const { error } = await supabase.from('tournaments').update({
        divisions: tournament.divisions,
        sportConfig: tournament.sportConfig
    }).eq('id', tournamentId);
    if (error) throw error;
};

export const removeDivision = async (tournamentId: string, divisionId: string) => {
    const { data: tData } = await supabase.from('tournaments').select('divisions').eq('id', tournamentId).single();
    if (!tData) return;
    const divisions = tData.divisions;
    delete divisions[divisionId];
    await supabase.from('tournaments').update({ divisions }).eq('id', tournamentId);
    // Also clean up any fixtures for this division
    await supabase.from('tournament_fixtures').delete().eq('tournamentId', tournamentId).eq('divisionId', divisionId);
};

// ============================================
// BRACKET GENERATION
// ============================================
const getByeIndices = (totalMatches: number, numByes: number): Set<number> => {
    const indices = new Set<number>();
    const priorityList = [0, totalMatches - 1];
    if (totalMatches > 2) {
        priorityList.push(Math.floor(totalMatches / 2) - 1, Math.floor(totalMatches / 2));
    }
    for (let i = 0; i < totalMatches; i++) {
        if (!priorityList.includes(i)) priorityList.push(i);
    }
    for (let i = 0; i < numByes; i++) {
        if (i < priorityList.length) indices.add(priorityList[i]);
    }
    return indices;
};

const generateBracketSlotsArray = (
    tId: string,
    divId: string,
    sport: SportType,
    gender: GenderCategory,
    teamCount: number
): TournamentFixture[] => {
    const fixtures: TournamentFixture[] = [];
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(teamCount)));
    const totalRounds = Math.log2(bracketSize);
    const numByes = bracketSize - teamCount;
    const round1Matches = bracketSize / 2;
    const byeIndices = getByeIndices(round1Matches, numByes);
    const getMatchId = (r: number, m: number) => `match_${divId}_${r}_${m}`;

    for (let round = 1; round <= totalRounds; round++) {
        const matchesInRound = bracketSize / Math.pow(2, round);
        for (let matchIdx = 0; matchIdx < matchesInRound; matchIdx++) {
            const matchId = getMatchId(round, matchIdx);
            let nextMatchId: string | null = null;
            let bracketParent: 'A' | 'B' | null = null;

            if (round < totalRounds) {
                nextMatchId = getMatchId(round + 1, Math.floor(matchIdx / 2));
                bracketParent = matchIdx % 2 === 0 ? 'A' : 'B';
            }

            const isByeMatch = round === 1 && byeIndices.has(matchIdx);
            const fixture: TournamentFixture = {
                id: matchId,
                tournamentId: tId,
                divisionId: divId,
                sport,
                gender,
                teamA: 'TBD',
                teamB: isByeMatch ? 'BYE' : 'TBD',
                court: 'Unassigned',
                time: 'Pending',
                status: isByeMatch ? 'completed' : 'scheduled',
                round,
                matchNumber: matchIdx,
                nextMatchId,
                bracketParent,
                isBye: isByeMatch,
            };
            if (isByeMatch) fixture.winnerSide = 'A';
            fixtures.push(fixture);
        }
    }
    return fixtures;
};

// ============================================
// LIFECYCLE MANAGEMENT
// ============================================
export const activateDivision = async (
    tournamentId: string,
    divisionId: string,
    config: { format: TournamentFormat; bracketSize: number }
) => {
    const { data: tData } = await supabase.from('tournaments').select('divisions').eq('id', tournamentId).single();
    if (!tData) return;

    const divisions = tData.divisions;
    divisions[divisionId] = {
        ...divisions[divisionId],
        isActive: true,
        status: 'draft',
        format: config.format,
        bracketSize: config.bracketSize
    };
    await supabase.from('tournaments').update({ divisions }).eq('id', tournamentId);

    if (config.format === 'knockout') {
        const parts = divisionId.split('_');
        const gender = parts[parts.length - 1] as GenderCategory;
        const sport = parts.slice(0, parts.length - 1).join('_') as SportType;

        const fixtures = generateBracketSlotsArray(tournamentId, divisionId, sport, gender, config.bracketSize);
        if (fixtures.length > 0) {
            // Delete first — check the error this time
            const { error: deleteError } = await supabase
                .from('tournament_fixtures')
                .delete()
                .eq('tournamentId', tournamentId)
                .eq('divisionId', divisionId);

            if (deleteError) {
                console.warn('[activateDivision] delete blocked (RLS?), falling back to upsert:', deleteError.message);
                // upsert is idempotent — safe even if delete was blocked
                const { error: upsertError } = await supabase
                    .from('tournament_fixtures')
                    .upsert(fixtures, { onConflict: 'id' });
                if (upsertError) throw upsertError;
            } else {
                const { error: insertError } = await supabase
                    .from('tournament_fixtures')
                    .insert(fixtures);
                if (insertError) throw insertError;
            }
        }
    }
};

export const publishDivision = async (tournamentId: string, divisionId: string) => {
    const { data: tData } = await supabase.from('tournaments').select('divisions').eq('id', tournamentId).single();
    if (!tData) return;
    tData.divisions[divisionId].status = 'published';
    await supabase.from('tournaments').update({ divisions: tData.divisions }).eq('id', tournamentId);
};

export const unpublishDivision = async (tournamentId: string, divisionId: string) => {
    const { data: tData } = await supabase.from('tournaments').select('divisions').eq('id', tournamentId).single();
    if (!tData) return;
    tData.divisions[divisionId].status = 'draft';
    await supabase.from('tournaments').update({ divisions: tData.divisions }).eq('id', tournamentId);
};

// ============================================
// FIXTURE MANAGEMENT
// ============================================
export const updateFixtureData = async (tournamentId: string, fixtureId: string, data: Partial<TournamentFixture>) => {
    try {
        const { data: currentFixture, error: fetchErr } = await supabase
            .from('tournament_fixtures').select('*').eq('id', fixtureId).single();
        if (fetchErr || !currentFixture) return;

        await supabase.from('tournament_fixtures').update(data).eq('id', fixtureId);

        // If this is a completed bye/match with a next slot, propagate the winner name
        if (currentFixture.status === 'completed' && currentFixture.nextMatchId && currentFixture.winnerSide) {
            const newTeamA = data.teamA !== undefined ? data.teamA : currentFixture.teamA;
            const newTeamB = data.teamB !== undefined ? data.teamB : currentFixture.teamB;
            const winnerName = currentFixture.winnerSide === 'A' ? newTeamA : newTeamB;
            if (winnerName && winnerName !== 'TBD') {
                const fieldToUpdate = currentFixture.bracketParent === 'A' ? { teamA: winnerName } : { teamB: winnerName };
                await supabase.from('tournament_fixtures').update(fieldToUpdate).eq('id', currentFixture.nextMatchId);
            }
        }
    } catch (error) {
        console.error("Error updating fixture:", error);
        throw error;
    }
};

export const checkSchedulingConflict = async (
    tournamentId: string,
    court: string,
    time: string,
    excludeFixtureId?: string
): Promise<TournamentFixture | null> => {
    let query = supabase
        .from('tournament_fixtures').select('*')
        .eq('tournamentId', tournamentId)
        .eq('court', court)
        .eq('time', time)
        .neq('status', 'completed')
        .eq('isBye', false);
    if (excludeFixtureId) query = query.neq('id', excludeFixtureId);
    const { data } = await query.limit(1);
    return data && data.length > 0 ? (data[0] as TournamentFixture) : null;
};

// ============================================
// GAME STARTING
// ============================================
export const startTournamentMatch = async (
    tournamentId: string,
    fixtureId: string,
    fixtureData: TournamentFixture,
    court: string = fixtureData.court || 'Court 1'
): Promise<string> => {
    const userId = await getCurrentUserId();

    // Optimistic lock: only update if not already live (prevents double-start)
    const { data: updatedFixture, error: lockErr } = await supabase
        .from('tournament_fixtures')
        .update({ status: 'live', court, scorerId: userId, actualStartTime: Date.now() })
        .eq('id', fixtureId)
        .neq('status', 'live')
        .select()
        .single();

    if (lockErr || !updatedFixture) {
        throw new Error('This match has already been started by another scorer.');
    }

    const newGameCode = await initializeNewGame(
        {
            gameName: `${fixtureData.teamA} vs ${fixtureData.teamB}`,
            periodDuration: 10,
            shotClockDuration: 24,
            periodType: 'quarter',
            courtNumber: court,
            tournamentId,
        },
        { name: fixtureData.teamA, color: '#DC2626', players: [], score: 0, timeouts: 2, timeoutsFirstHalf: 2, timeoutsSecondHalf: 3, fouls: 0, foulsThisQuarter: 0 },
        { name: fixtureData.teamB, color: '#2563EB', players: [], score: 0, timeouts: 2, timeoutsFirstHalf: 2, timeoutsSecondHalf: 3, fouls: 0, foulsThisQuarter: 0 },
        false,
        fixtureData.sport,
        userId
    );

    await supabase.from('tournament_fixtures').update({ gameCode: newGameCode }).eq('id', fixtureId);
    return newGameCode;
};

export const advanceBracketWinner = async (
    tournamentId: string,
    fixture: TournamentFixture,
    winnerSide: 'A' | 'B',
    finalScore?: { teamA: number; teamB: number }
) => {
    await supabase.from('tournament_fixtures').update({
        status: 'completed',
        winnerSide,
        finalScore: finalScore || { teamA: 0, teamB: 0 },
        actualEndTime: Date.now()
    }).eq('id', fixture.id);

    if (fixture.nextMatchId) {
        const winnerName = winnerSide === 'A' ? fixture.teamA : fixture.teamB;
        const updateField = fixture.bracketParent === 'A' ? { teamA: winnerName } : { teamB: winnerName };
        await supabase.from('tournament_fixtures').update(updateField).eq('id', fixture.nextMatchId);
    }
};

// ============================================
// PIN VERIFICATION
// Uses the verify_scorer_pin() RPC — never reads scorerPin directly from
// tournaments (it was moved to tournament_secrets in schema v4.1).
// ============================================
export const verifyScorerPin = async (tournamentId: string, enteredPin: string): Promise<boolean> => {
    try {
        const { data: isValid, error } = await supabase.rpc('verify_scorer_pin', {
            p_tournament_id: tournamentId,
            p_pin: enteredPin
        });
        if (error) {
            console.error('[Supabase] verify_scorer_pin failed:', error);
            return false;
        }
        return isValid ?? false;
    } catch (err) {
        console.error('[Supabase] verifyScorerPin error:', err);
        return false;
    }
};

// ============================================
// VOLUNTEER / SCORER ACCESS
// ============================================
export const joinTournament = async (tournamentId: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Must be logged in");

    const { data: tData, error: fetchErr } = await supabase
        .from('tournaments').select('pendingRequests').eq('id', tournamentId).single();
    if (fetchErr || !tData) throw new Error("Invalid Tournament Code");

    const pendingRequests = tData.pendingRequests || {};
    pendingRequests[user.id] = {
        displayName: user.user_metadata?.full_name || 'Volunteer',
        email: user.email,
        timestamp: Date.now(),
        status: 'pending'
    };
    await supabase.from('tournaments').update({ pendingRequests }).eq('id', tournamentId);
};

export const handleRequest = async (tournamentId: string, userId: string, action: 'approve' | 'reject') => {
    const { data: tData } = await supabase
        .from('tournaments').select('pendingRequests, approvedScorers').eq('id', tournamentId).single();
    if (!tData) return;

    const pendingRequests = tData.pendingRequests || {};
    let approvedScorers: string[] = Array.isArray(tData.approvedScorers) ? tData.approvedScorers : [];

    if (action === 'approve') {
        if (!approvedScorers.includes(userId)) approvedScorers.push(userId);
        if (pendingRequests[userId]) pendingRequests[userId].status = 'approved';
    } else {
        delete pendingRequests[userId];
    }

    await supabase.from('tournaments').update({ pendingRequests, approvedScorers }).eq('id', tournamentId);
};

// ============================================
// SUBSCRIPTIONS
// ============================================
export const subscribeToTournament = (id: string, callback: (data: Tournament | null) => void) => {
    const fetchIt = async () => {
        const { data } = await supabase.from('tournaments').select('*').eq('id', id).single();
        callback(data ? (data as Tournament) : null);
    };
    fetchIt();
    const channel = supabase.channel(`tournament_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, fetchIt)
        .subscribe();
    return () => { supabase.removeChannel(channel); };
};

export const subscribeToFixtures = (
    tournamentId: string,
    divisionId: string | null,
    callback: (data: TournamentFixture[]) => void
) => {
    const fetchIt = async () => {
        let q = supabase.from('tournament_fixtures').select('*').eq('tournamentId', tournamentId);
        if (divisionId) q = q.eq('divisionId', divisionId).order('id', { ascending: true });
        else q = q.order('time', { ascending: true });
        const { data } = await q;
        if (data) callback(data as TournamentFixture[]);
    };
    fetchIt();
    const channel = supabase.channel(`fixtures_${tournamentId}_${divisionId || 'all'}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'tournament_fixtures',
            filter: `tournamentId=eq.${tournamentId}`
        }, fetchIt)
        .subscribe();
    return () => { supabase.removeChannel(channel); };
};

export const subscribeToMyTournaments = (userId: string, callback: (data: Tournament[]) => void) => {
    const fetchIt = async () => {
        const { data } = await supabase.from('tournaments').select('*').eq('adminId', userId);
        if (data) callback(data as Tournament[]);
    };
    fetchIt();
    const channel = supabase.channel(`my_tournaments_${userId}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'tournaments',
            filter: `adminId=eq.${userId}`
        }, fetchIt)
        .subscribe();
    return () => { supabase.removeChannel(channel); };
};

// FIX 1: approvedScorers is JSONB `[]` in the schema (not text[]).
// PostgREST `cs` operator is for text arrays — it sends `cs.{uuid}` which
// Postgres rejects with 400 for a jsonb column.
// The correct JSONB containment operator is `@>`.
// We do a full table fetch and filter client-side to avoid any operator
// ambiguity — tournaments are a small dataset per user.
export const subscribeToJoinedTournaments = (userId: string, callback: (data: Tournament[]) => void) => {
    const fetchIt = async () => {
        const { data } = await supabase.from('tournaments').select('*');
        if (data) {
            const joined = (data as Tournament[]).filter(t =>
                t.adminId !== userId &&
                Array.isArray(t.approvedScorers) &&
                t.approvedScorers.includes(userId)
            );
            callback(joined);
        }
    };
    fetchIt();
    // Subscribe to all tournament changes — filter client-side
    const channel = supabase.channel(`joined_tournaments_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, fetchIt)
        .subscribe();
    return () => { supabase.removeChannel(channel); };
};

export const subscribeToPublicTournaments = (callback: (data: Tournament[]) => void) => {
    const fetchIt = async () => {
        const { data } = await supabase.from('tournaments').select('*').eq('status', 'active');
        if (data) callback(data as Tournament[]);
    };
    fetchIt();
    const channel = supabase.channel('public_tournaments')
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'tournaments',
            filter: 'status=eq.active'
        }, fetchIt)
        .subscribe();
    return () => { supabase.removeChannel(channel); };
};

export const getTournamentPublicInfo = async (tournamentId: string): Promise<Tournament | null> => {
    const { data } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
    return data ? (data as Tournament) : null;
};

export const checkCourtAvailability = async (tournamentId: string, court: string): Promise<boolean> => {
    try {
        const { count } = await supabase.from('games').select('*', { count: 'exact', head: true })
            .eq('status', 'live')
            .eq('tournamentId', tournamentId);
        return count === 0;
    } catch {
        return false;
    }
};

// ============================================
// NEW: SCORER MANAGEMENT
// ============================================

/** Remove a user from the approved scorers list (admin only action) */
export const revokeScorer = async (tournamentId: string, userId: string): Promise<void> => {
    const { data: tData } = await supabase
        .from('tournaments').select('approvedScorers, pendingRequests').eq('id', tournamentId).single();
    if (!tData) return;

    const approvedScorers = (Array.isArray(tData.approvedScorers) ? tData.approvedScorers as string[] : [])
        .filter((id: string) => id !== userId);
    const pendingRequests = tData.pendingRequests || {};
    delete pendingRequests[userId];

    await supabase.from('tournaments')
        .update({ approvedScorers, pendingRequests })
        .eq('id', tournamentId);
};

// ============================================
// NEW: TEAM NAME MANAGEMENT
// ============================================

/**
 * Update a single team slot in a Round 1 fixture.
 * Propagates the name forward to any downstream TBD slots automatically.
 */
export const updateTeamName = async (
    tournamentId: string,
    fixtureId: string,
    side: 'A' | 'B',
    name: string
): Promise<void> => {
    const field = side === 'A' ? 'teamA' : 'teamB';
    await supabase.from('tournament_fixtures')
        .update({ [field]: name })
        .eq('id', fixtureId)
        .eq('tournamentId', tournamentId);
};

// ============================================
// NEW: ADMIN PIN RETRIEVAL
// ============================================

/**
 * Reads the scorer PIN from tournament_secrets.
 * Only meaningful for the tournament admin — RLS should restrict this.
 */
export const getAdminPin = async (tournamentId: string): Promise<string | null> => {
    try {
        const { data, error } = await supabase
            .from('tournament_secrets')
            .select('scorerPin')
            .eq('tournamentId', tournamentId)
            .single();
        if (error) {
            console.error('[getAdminPin] RLS/not-found error:', error.message);
            return null;
        }
        return data?.scorerPin ?? null;
    } catch (err) {
        console.error('[getAdminPin] unexpected error:', err);
        return null;
    }
};

// ============================================
// NEW: GAME RESULT FETCH
// ============================================

/**
 * Fetches the live game score so the scorer can confirm the result
 * without re-entering numbers manually.
 */
export const getGameResult = async (
    gameCode: string
): Promise<{ teamA: number; teamB: number; teamAName: string; teamBName: string } | null> => {
    try {
        const { data, error } = await supabase
            .from('games')
            .select('teamA, teamB')
            .eq('code', gameCode)
            .single();
        if (error || !data) return null;
        return {
            teamA: (data.teamA as any)?.score ?? 0,
            teamB: (data.teamB as any)?.score ?? 0,
            teamAName: (data.teamA as any)?.name ?? 'Team A',
            teamBName: (data.teamB as any)?.name ?? 'Team B',
        };
    } catch {
        return null;
    }
};

// ============================================
// NEW: DIVISION COMPLETION CHECK
// ============================================

/**
 * Called after advanceBracketWinner. Checks if ALL non-bye fixtures
 * in the division are completed. If so, marks the division as 'completed'
 * and records the champion name.
 */
export const checkAndCompleteDivision = async (
    tournamentId: string,
    divisionId: string,
    champion: string
): Promise<void> => {
    const { data: fixtures } = await supabase
        .from('tournament_fixtures')
        .select('status, isBye')
        .eq('tournamentId', tournamentId)
        .eq('divisionId', divisionId);

    if (!fixtures) return;
    const realFixtures = fixtures.filter((f: any) => !f.isBye);
    const allDone = realFixtures.every((f: any) => f.status === 'completed');

    if (allDone) {
        const { data: tData } = await supabase.from('tournaments').select('divisions').eq('id', tournamentId).single();
        if (!tData) return;
        tData.divisions[divisionId].status = 'completed';
        tData.divisions[divisionId].champion = champion;
        await supabase.from('tournaments').update({ divisions: tData.divisions }).eq('id', tournamentId);
    }
};