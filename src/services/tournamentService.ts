// src/services/tournamentService.ts
import { supabase } from './supabase';
import { initializeNewGame } from './supabaseGameService';
import type { Tournament, DivisionConfig, TournamentFixture, SportType, GenderCategory, TournamentFormat } from '../types';

// ============================================
// HELPER FUNCTIONS
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
    const selectedSports = Object.keys(sportConfig) as SportType[];

    selectedSports.forEach(sport => {
        genders.forEach(gender => {
            const divId = `${sport}_${gender}`;
            initialDivisions[divId] = { id: divId, sport, gender, isActive: false, format: 'knockout', status: 'setup_required' };
        });
    });

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
        tournament.divisions[divId] = { id: divId, sport, gender: gender as GenderCategory, isActive: false, format: 'knockout', status: 'setup_required' };
    });

    tournament.sportConfig[sport] = { courts: 1 };
    const { error } = await supabase.from('tournaments').update({ divisions: tournament.divisions, sportConfig: tournament.sportConfig }).eq('id', tournamentId);
    if (error) throw error;
};

export const removeDivision = async (tournamentId: string, divisionId: string) => {
    const { data: tData } = await supabase.from('tournaments').select('divisions').eq('id', tournamentId).single();
    if (!tData) return;
    const divisions = tData.divisions;
    delete divisions[divisionId];
    await supabase.from('tournaments').update({ divisions }).eq('id', tournamentId);
};

// ============================================
// LIFECYCLE MANAGEMENT
// ============================================
export const activateDivision = async (tournamentId: string, divisionId: string, config: { format: TournamentFormat; bracketSize: number }) => {
    const { data: tData } = await supabase.from('tournaments').select('divisions').eq('id', tournamentId).single();
    if (!tData) return;

    const divisions = tData.divisions;
    divisions[divisionId] = { ...divisions[divisionId], isActive: true, status: 'draft', format: config.format, bracketSize: config.bracketSize };
    await supabase.from('tournaments').update({ divisions }).eq('id', tournamentId);

    if (config.format === 'knockout') {
        const [sport, gender] = divisionId.split('_');
        const fixtures = generateBracketSlotsArray(tournamentId, divisionId, sport as SportType, gender as GenderCategory, config.bracketSize);
        if (fixtures.length > 0) {
            const { error } = await supabase.from('tournament_fixtures').insert(fixtures);
            if (error) throw error;
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
// BRACKET GENERATION
// ============================================
const getByeIndices = (totalMatches: number, numByes: number): Set<number> => {
    const indices = new Set<number>();
    const priorityList = [0, totalMatches - 1];
    if (totalMatches > 2) { priorityList.push(Math.floor(totalMatches / 2) - 1, Math.floor(totalMatches / 2)); }
    for (let i = 0; i < totalMatches; i++) { if (!priorityList.includes(i)) priorityList.push(i); }
    for (let i = 0; i < numByes; i++) { if (i < priorityList.length) indices.add(priorityList[i]); }
    return indices;
};

const generateBracketSlotsArray = (tId: string, divId: string, sport: SportType, gender: GenderCategory, teamCount: number): TournamentFixture[] => {
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
            let nextMatchId = null, bracketParent = null;

            if (round < totalRounds) {
                const nextMatchIdx = Math.floor(matchIdx / 2);
                nextMatchId = getMatchId(round + 1, nextMatchIdx);
                bracketParent = matchIdx % 2 === 0 ? 'A' : 'B';
            }

            const isByeMatch = round === 1 && byeIndices.has(matchIdx);
            const fixture: TournamentFixture = {
                id: matchId, tournamentId: tId, divisionId: divId, sport, gender,
                teamA: 'TBD', teamB: isByeMatch ? 'BYE' : 'TBD',
                court: 'Unassigned', time: 'Pending', status: isByeMatch ? 'completed' : 'scheduled',
                round, matchNumber: matchIdx, nextMatchId, bracketParent: bracketParent as 'A' | 'B', isBye: isByeMatch
            };
            if (isByeMatch) fixture.winnerSide = 'A';
            fixtures.push(fixture);
        }
    }
    return fixtures;
};

// ============================================
// FIXTURE MANAGEMENT
// ============================================
export const updateFixtureData = async (tournamentId: string, fixtureId: string, data: Partial<TournamentFixture>) => {
    try {
        const { data: currentFixture, error: fetchErr } = await supabase.from('tournament_fixtures').select('*').eq('id', fixtureId).single();
        if (fetchErr || !currentFixture) return;

        await supabase.from('tournament_fixtures').update(data).eq('id', fixtureId);

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

export const checkSchedulingConflict = async (tournamentId: string, court: string, time: string, date: string, excludeFixtureId?: string): Promise<TournamentFixture | null> => {
    let query = supabase.from('tournament_fixtures').select('*').eq('tournamentId', tournamentId).eq('court', court).eq('time', time).neq('status', 'completed').is('isBye', false);
    if (excludeFixtureId) query = query.neq('id', excludeFixtureId);
    const { data } = await query.limit(1);
    return data && data.length > 0 ? (data[0] as TournamentFixture) : null;
};

// ============================================
// GAME STARTING
// ============================================
export const startTournamentMatch = async (tournamentId: string, fixtureId: string, fixtureData: TournamentFixture, court: string = fixtureData.court || 'Court 1'): Promise<string> => {
    const userId = await getCurrentUserId();

    const { data: updatedFixture, error: lockErr } = await supabase
        .from('tournament_fixtures').update({ status: 'live', court: court, scorerId: userId, actualStartTime: Date.now() })
        .eq('id', fixtureId).neq('status', 'live').select().single();

    if (lockErr || !updatedFixture) throw new Error('This match has already been started by another scorer or could not be found.');

    const newGameCode = await initializeNewGame(
        { gameName: `${fixtureData.teamA} vs ${fixtureData.teamB}`, periodDuration: 10, shotClockDuration: 24, periodType: 'quarter', courtNumber: court, tournamentId: tournamentId },
        { name: fixtureData.teamA, color: '#DC2626', players: [], score: 0, timeouts: 2, timeoutsFirstHalf: 2, timeoutsSecondHalf: 3, fouls: 0, foulsThisQuarter: 0 },
        { name: fixtureData.teamB, color: '#2563EB', players: [], score: 0, timeouts: 2, timeoutsFirstHalf: 2, timeoutsSecondHalf: 3, fouls: 0, foulsThisQuarter: 0 },
        false, fixtureData.sport, userId
    );

    await supabase.from('tournament_fixtures').update({ gameCode: newGameCode }).eq('id', fixtureId);
    return newGameCode;
};

export const advanceBracketWinner = async (tournamentId: string, fixture: TournamentFixture, winnerSide: 'A' | 'B', finalScore?: { teamA: number; teamB: number }) => {
    await supabase.from('tournament_fixtures').update({ status: 'completed', winnerSide: winnerSide, finalScore: finalScore || { teamA: 0, teamB: 0 }, actualEndTime: Date.now() }).eq('id', fixture.id);
    if (fixture.nextMatchId) {
        const winnerName = winnerSide === 'A' ? fixture.teamA : fixture.teamB;
        const updateField = fixture.bracketParent === 'A' ? { teamA: winnerName } : { teamB: winnerName };
        await supabase.from('tournament_fixtures').update(updateField).eq('id', fixture.nextMatchId);
    }
};

// ============================================
// SUBSCRIPTIONS
// ============================================
export const subscribeToTournament = (id: string, callback: (data: Tournament | null) => void) => {
    const fetchIt = async () => { const { data } = await supabase.from('tournaments').select('*').eq('id', id).single(); callback(data ? (data as Tournament) : null); };
    fetchIt();
    const channel = supabase.channel(`tournaments_${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, fetchIt).subscribe();
    return () => { supabase.removeChannel(channel); };
};

export const subscribeToFixtures = (tournamentId: string, divisionId: string | null, callback: (data: TournamentFixture[]) => void) => {
    const fetchIt = async () => {
        let q = supabase.from('tournament_fixtures').select('*').eq('tournamentId', tournamentId);
        if (divisionId) q = q.eq('divisionId', divisionId).order('id', { ascending: true });
        else q = q.order('time', { ascending: true });
        const { data } = await q;
        if (data) callback(data as TournamentFixture[]);
    };
    fetchIt();
    const channel = supabase.channel(`fixtures_${tournamentId}_${divisionId || 'all'}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_fixtures', filter: `tournamentId=eq.${tournamentId}` }, fetchIt).subscribe();
    return () => { supabase.removeChannel(channel); };
};

export const checkCourtAvailability = async (tournamentId: string, court: string): Promise<boolean> => {
    try {
        const { count } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'live').contains('settings', { tournamentId: tournamentId, courtNumber: court });
        return count === 0;
    } catch (error) { return false; }
};

export const subscribeToMyTournaments = (userId: string, callback: (data: Tournament[]) => void) => {
    const fetchIt = async () => { const { data } = await supabase.from('tournaments').select('*').eq('adminId', userId); if (data) callback(data as Tournament[]); };
    fetchIt();
    const channel = supabase.channel(`my_tournaments_${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `adminId=eq.${userId}` }, fetchIt).subscribe();
    return () => { supabase.removeChannel(channel); };
};

export const subscribeToJoinedTournaments = (userId: string, callback: (data: Tournament[]) => void) => {
    const fetchIt = async () => {
        const { data } = await supabase.from('tournaments').select('*').contains('approvedScorers', [userId]).neq('adminId', userId);
        if (data) callback(data as Tournament[]);
    };
    fetchIt();
    const channel = supabase.channel(`joined_tournaments_${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, fetchIt).subscribe();
    return () => { supabase.removeChannel(channel); };
};

export const subscribeToPublicTournaments = (callback: (data: Tournament[]) => void) => {
    const fetchIt = async () => { const { data } = await supabase.from('tournaments').select('*').eq('status', 'active'); if (data) callback(data as Tournament[]); };
    fetchIt();
    const channel = supabase.channel(`public_tournaments`).on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `status=eq.active` }, fetchIt).subscribe();
    return () => { supabase.removeChannel(channel); };
};

export const getTournamentPublicInfo = async (tournamentId: string): Promise<Tournament | null> => {
    const { data } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
    return data ? (data as Tournament) : null;
};

export const joinTournament = async (tournamentId: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Must be logged in");

    const { data: tData, error: fetchErr } = await supabase.from('tournaments').select('pendingRequests').eq('id', tournamentId).single();
    if (fetchErr || !tData) throw new Error("Invalid Tournament Code");

    const pendingRequests = tData.pendingRequests || {};
    pendingRequests[user.id] = { displayName: user.user_metadata?.full_name || 'Volunteer', email: user.email, timestamp: Date.now(), status: 'pending' };
    await supabase.from('tournaments').update({ pendingRequests }).eq('id', tournamentId);
};

export const handleRequest = async (tournamentId: string, userId: string, action: 'approve' | 'reject') => {
    const { data: tData } = await supabase.from('tournaments').select('pendingRequests, approvedScorers').eq('id', tournamentId).single();
    if (!tData) return;
    const pendingRequests = tData.pendingRequests;
    let approvedScorers = tData.approvedScorers || [];

    if (action === 'approve') {
        if (!approvedScorers.includes(userId)) approvedScorers.push(userId);
        if (pendingRequests[userId]) pendingRequests[userId].status = 'approved';
    } else { delete pendingRequests[userId]; }

    await supabase.from('tournaments').update({ pendingRequests, approvedScorers }).eq('id', tournamentId);
};

/**
 * NEW: Verify a scorer PIN for a specific tournament.
 * Returns true if valid, false otherwise.
 */
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