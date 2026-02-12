import {
    doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs,
    onSnapshot, arrayUnion, deleteField, orderBy, writeBatch, runTransaction
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { initializeNewGame } from './gameService';
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

// ============================================
// CORE TOURNAMENT MANAGEMENT
// ============================================

export const createTournament = async (
    name: string,
    logoUrl: string,
    details: { organizer?: string; location?: string; startDate?: string; endDate?: string },
    sportConfig: { [key in SportType]?: { courts: number } }
): Promise<string> => {
    if (!auth.currentUser) throw new Error("Must be logged in");

    const id = generateId();
    const initialDivisions: { [key: string]: DivisionConfig } = {};
    const genders: GenderCategory[] = ['men', 'women'];
    const selectedSports = Object.keys(sportConfig) as SportType[];

    selectedSports.forEach(sport => {
        genders.forEach(gender => {
            const divId = `${sport}_${gender}`;
            initialDivisions[divId] = {
                id: divId,
                sport,
                gender,
                isActive: false,
                format: 'knockout',
                status: 'setup_required'
            };
        });
    });

    const newTournament: Tournament = {
        id,
        adminId: auth.currentUser.uid,
        name,
        logoUrl,
        ...details,
        scorerPin: generatePin(),
        status: 'active',
        sportConfig,
        divisions: initialDivisions,
        approvedScorers: [auth.currentUser.uid],
        pendingRequests: {},
        createdAt: Date.now()
    };

    await setDoc(doc(db, 'tournaments', id), newTournament);
    return id;
};

export const addTournamentSport = async (tournamentId: string, sport: SportType) => {
    const batch = writeBatch(db);
    const tRef = doc(db, 'tournaments', tournamentId);

    ['men', 'women'].forEach(gender => {
        const divId = `${sport}_${gender}`;
        const newDiv: DivisionConfig = {
            id: divId,
            sport,
            gender: gender as GenderCategory,
            isActive: false,
            format: 'knockout',
            status: 'setup_required'
        };
        batch.update(tRef, { [`divisions.${divId}`]: newDiv });
    });

    batch.update(tRef, { [`sportConfig.${sport}`]: { courts: 1 } });
    await batch.commit();
};

export const removeDivision = async (tournamentId: string, divisionId: string) => {
    const tRef = doc(db, 'tournaments', tournamentId);
    await updateDoc(tRef, { [`divisions.${divisionId}`]: deleteField() });
};

// ============================================
// LIFECYCLE MANAGEMENT
// ============================================

export const activateDivision = async (
    tournamentId: string,
    divisionId: string,
    config: { format: TournamentFormat; bracketSize: number }
) => {
    const batch = writeBatch(db);
    const tRef = doc(db, 'tournaments', tournamentId);

    batch.update(tRef, {
        [`divisions.${divisionId}.isActive`]: true,
        [`divisions.${divisionId}.status`]: 'draft',
        [`divisions.${divisionId}.format`]: config.format,
        [`divisions.${divisionId}.bracketSize`]: config.bracketSize
    });

    if (config.format === 'knockout') {
        const [sport, gender] = divisionId.split('_');
        generateBracketSlots(tournamentId, divisionId, sport as SportType, gender as GenderCategory, config.bracketSize, batch);
    }

    await batch.commit();
};

export const publishDivision = async (tournamentId: string, divisionId: string) => {
    const tRef = doc(db, 'tournaments', tournamentId);
    await updateDoc(tRef, { [`divisions.${divisionId}.status`]: 'published' });
};

export const unpublishDivision = async (tournamentId: string, divisionId: string) => {
    const tRef = doc(db, 'tournaments', tournamentId);
    await updateDoc(tRef, { [`divisions.${divisionId}.status`]: 'draft' });
};

// ============================================
// BRACKET GENERATION (Standard Seeding)
// ============================================

const getByeIndices = (totalMatches: number, numByes: number): Set<number> => {
    const indices = new Set<number>();
    const priorityList = [];

    // Standard Seeding Pattern: Top, Bottom, Mid-Top, Mid-Bottom
    priorityList.push(0);
    priorityList.push(totalMatches - 1);

    if (totalMatches > 2) {
        priorityList.push(Math.floor(totalMatches / 2) - 1);
        priorityList.push(Math.floor(totalMatches / 2));
    }

    // Fill remaining
    for (let i = 0; i < totalMatches; i++) {
        if (!priorityList.includes(i)) priorityList.push(i);
    }

    for (let i = 0; i < numByes; i++) {
        if (i < priorityList.length) indices.add(priorityList[i]);
    }
    return indices;
};

const generateBracketSlots = (tId: string, divId: string, sport: SportType, gender: GenderCategory, teamCount: number, batch: any) => {
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

            let nextMatchId = null;
            let bracketParent = null;

            if (round < totalRounds) {
                const nextMatchIdx = Math.floor(matchIdx / 2);
                nextMatchId = getMatchId(round + 1, nextMatchIdx);
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
                // Auto-complete byes so they look correct visually
                status: isByeMatch ? 'completed' : 'scheduled',
                round,
                matchNumber: matchIdx,
                nextMatchId,
                bracketParent: bracketParent as 'A' | 'B',
                isBye: isByeMatch
            };

            if (isByeMatch) fixture.winnerSide = 'A';

            batch.set(doc(db, `tournaments/${tId}/fixtures`, matchId), fixture);
        }
    }
};

// ============================================
// FIXTURE MANAGEMENT (WITH PROPAGATION FIX)
// ============================================

export const updateFixtureData = async (tournamentId: string, fixtureId: string, data: Partial<TournamentFixture>) => {
    const fixtureRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId);

    try {
        const snap = await getDoc(fixtureRef);
        if (!snap.exists()) return;
        const currentFixture = snap.data() as TournamentFixture;

        // 1. Perform the update
        await updateDoc(fixtureRef, data);

        // 2. PROPAGATION LOGIC (CRITICAL RESTORATION)
        // If this match is already finished (e.g. Bye), and we change a name, 
        // we MUST update the next match.
        if (currentFixture.status === 'completed' && currentFixture.nextMatchId && currentFixture.winnerSide) {

            const newTeamA = data.teamA !== undefined ? data.teamA : currentFixture.teamA;
            const newTeamB = data.teamB !== undefined ? data.teamB : currentFixture.teamB;

            const winnerName = currentFixture.winnerSide === 'A' ? newTeamA : newTeamB;

            // Only propagate if the winner name is valid (not TBD)
            if (winnerName && winnerName !== 'TBD') {
                const nextRef = doc(db, `tournaments/${tournamentId}/fixtures`, currentFixture.nextMatchId);
                const fieldToUpdate = currentFixture.bracketParent === 'A' ? { teamA: winnerName } : { teamB: winnerName };

                await updateDoc(nextRef, fieldToUpdate);
                console.log(`Propagated update: ${winnerName} -> Match ${currentFixture.nextMatchId}`);
            }
        }
    } catch (error) {
        console.error("Error updating fixture:", error);
        throw error;
    }
};

export const checkSchedulingConflict = async (tournamentId: string, court: string, time: string, date: string, excludeFixtureId?: string): Promise<TournamentFixture | null> => {
    const q = query(
        collection(db, `tournaments/${tournamentId}/fixtures`),
        where('court', '==', court),
        where('time', '==', time)
    );

    const snapshot = await getDocs(q);
    const conflicts = snapshot.docs
        .map(d => d.data() as TournamentFixture)
        .filter(f => f.id !== excludeFixtureId && f.status !== 'completed' && !f.isBye);

    return conflicts.length > 0 ? conflicts[0] : null;
};

// ============================================
// GAME STARTING (YOUR NEW LOGIC)
// ============================================

export const startTournamentMatch = async (
    tournamentId: string,
    fixtureId: string,
    fixtureData: TournamentFixture,
    court: string = fixtureData.court || 'Court 1'
): Promise<string> => {
    if (!auth.currentUser) throw new Error("Authentication required");

    const fixtureRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId);

    try {
        // Use Firestore transaction for optimistic locking
        await runTransaction(db, async (transaction) => {
            const fixtureSnap = await transaction.get(fixtureRef);
            if (!fixtureSnap.exists()) throw new Error('Fixture not found');

            const currentFixture = fixtureSnap.data() as TournamentFixture;
            if (currentFixture.status === 'live') {
                throw new Error('This match has already been started by another scorer');
            }

            transaction.update(fixtureRef, {
                status: 'live',
                court: court,
                scorerId: auth.currentUser!.uid,
                actualStartTime: Date.now()
            });
        });

        // Create the game
        const newGameCode = await initializeNewGame(
            {
                gameName: `${fixtureData.teamA} vs ${fixtureData.teamB}`,
                periodDuration: 10,
                shotClockDuration: 24,
                periodType: 'quarter',
                courtNumber: court,
                tournamentId: tournamentId,
                sport: fixtureData.sport
            },
            {
                name: fixtureData.teamA,
                color: '#DC2626',
                players: [],
                score: 0,
                timeouts: 2,
                timeoutsFirstHalf: 2,
                timeoutsSecondHalf: 3,
                fouls: 0,
                foulsThisQuarter: 0
            },
            {
                name: fixtureData.teamB,
                color: '#2563EB',
                players: [],
                score: 0,
                timeouts: 2,
                timeoutsFirstHalf: 2,
                timeoutsSecondHalf: 3,
                fouls: 0,
                foulsThisQuarter: 0
            },
            false,
            fixtureData.sport,
            auth.currentUser!.uid
        );

        await updateDoc(fixtureRef, { gameCode: newGameCode });
        return newGameCode;

    } catch (error: any) {
        console.error('❌ Failed to start match:', error);
        throw error;
    }
};

// ============================================
// BRACKET ADVANCEMENT
// ============================================

export const advanceBracketWinner = async (
    tournamentId: string,
    fixture: TournamentFixture,
    winnerSide: 'A' | 'B',
    finalScore?: { teamA: number; teamB: number }
) => {
    // 1. Safety Check for Next Match
    if (fixture.nextMatchId) {
        const nextRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixture.nextMatchId);
        const nextSnap = await getDoc(nextRef);
        if (!nextSnap.exists()) {
            console.error("Next match not found via advancement.");
            // We still complete the current match, but warn logic is broken
        }
    }

    const fixtureRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixture.id);

    // 2. Update current fixture
    await updateDoc(fixtureRef, {
        status: 'completed',
        winnerSide: winnerSide,
        finalScore: finalScore || { teamA: 0, teamB: 0 },
        actualEndTime: Date.now()
    });

    // 3. Advance to next round
    if (fixture.nextMatchId) {
        const winnerName = winnerSide === 'A' ? fixture.teamA : fixture.teamB;
        const nextMatchRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixture.nextMatchId);

        const updateField = fixture.bracketParent === 'A'
            ? { teamA: winnerName }
            : { teamB: winnerName };

        await updateDoc(nextMatchRef, updateField);
    }
};

// ============================================
// SUBSCRIPTIONS & OTHERS
// ============================================

export const subscribeToTournament = (id: string, callback: (data: Tournament | null) => void) => {
    return onSnapshot(doc(db, 'tournaments', id), (doc) => {
        callback(doc.exists() ? (doc.data() as Tournament) : null);
    });
};

export const subscribeToFixtures = (tournamentId: string, divisionId: string | null, callback: (data: TournamentFixture[]) => void) => {
    let q;
    if (divisionId) {
        q = query(
            collection(db, `tournaments/${tournamentId}/fixtures`),
            where('divisionId', '==', divisionId),
            orderBy('id', 'asc')
        );
    } else {
        q = query(
            collection(db, `tournaments/${tournamentId}/fixtures`),
            orderBy('time', 'asc')
        );
    }
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(d => d.data() as TournamentFixture));
    });
};

export const checkCourtAvailability = async (tournamentId: string, court: string): Promise<boolean> => {
    try {
        const gamesQuery = query(collection(db, 'games'), where('settings.tournamentId', '==', tournamentId), where('settings.courtNumber', '==', court), where('status', '==', 'live'));
        const snapshot = await getDocs(gamesQuery);
        return snapshot.empty;
    } catch (error) {
        return false;
    }
};

export const subscribeToMyTournaments = (userId: string, callback: (data: Tournament[]) => void) => {
    const q = query(collection(db, 'tournaments'), where('adminId', '==', userId));
    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(d => d.data() as Tournament)));
};

export const subscribeToJoinedTournaments = (userId: string, callback: (data: Tournament[]) => void) => {
    const q = query(collection(db, 'tournaments'), where('approvedScorers', 'array-contains', userId));
    return onSnapshot(q, (snapshot) => {
        // 1. Get all tournaments where I am a scorer
        const allTournaments = snapshot.docs.map(d => d.data() as Tournament);

        // 2. Filter out tournaments where I am ALSO the admin (to avoid duplicates in UI)
        const filtered = allTournaments.filter(t => t.adminId !== userId);

        // 3. Update state
        callback(filtered);
    });
};

// ============================================
// VOLUNTEER ACCESS FLOW (UPDATED)
// ============================================

/**
 * 1. Verify code and get basic info (Name, Sports) to populate the Modal
 */
export const getTournamentPublicInfo = async (tournamentId: string): Promise<Tournament | null> => {
    try {
        const tRef = doc(db, 'tournaments', tournamentId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            return snap.data() as Tournament;
        }
        return null;
    } catch (error) {
        console.error("Error fetching tournament info:", error);
        return null;
    }
};

/**
 * 2. Submit the detailed request
 */
export const joinTournament = async (tournamentId: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("Must be logged in");
    const tRef = doc(db, 'tournaments', tournamentId);
    const snap = await getDoc(tRef);
    if (!snap.exists()) throw new Error("Invalid Tournament Code");
    const user = auth.currentUser;
    await updateDoc(tRef, {
        [`pendingRequests.${user.uid}`]: {
            displayName: user.displayName || 'Volunteer',
            email: user.email,
            timestamp: Date.now(),
            status: 'pending'
        }
    });
};

export const handleRequest = async (tournamentId: string, userId: string, action: 'approve' | 'reject') => {
    const tRef = doc(db, 'tournaments', tournamentId);
    if (action === 'approve') {
        await updateDoc(tRef, { approvedScorers: arrayUnion(userId), [`pendingRequests.${userId}.status`]: 'approved' });
    } else {
        await updateDoc(tRef, { [`pendingRequests.${userId}`]: deleteField() });
    }
};