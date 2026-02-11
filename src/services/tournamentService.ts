// src/services/tournamentService.ts
// COMPLETE FILE - Ready to replace your existing tournamentService.ts

import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot, arrayUnion, deleteField, orderBy, writeBatch, runTransaction } from 'firebase/firestore';
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
// BRACKET GENERATION
// ============================================

const generateBracketSlots = (tId: string, divId: string, sport: SportType, gender: GenderCategory, teamCount: number, batch: any) => {
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(teamCount)));
    const totalRounds = Math.log2(bracketSize);
    const numByes = bracketSize - teamCount;

    const round1Matches = bracketSize / 2;
    const byeIndices = new Set<number>();

    // Distribute BYEs evenly (NCAA standard)
    let allocatedByes = 0;
    for (let i = 0; i < round1Matches && allocatedByes < numByes; i++) {
        if (i % 2 === 0) { byeIndices.add(i); allocatedByes++; }
    }
    for (let i = 0; i < round1Matches && allocatedByes < numByes; i++) {
        if (!byeIndices.has(i)) { byeIndices.add(i); allocatedByes++; }
    }

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
// DATA ACCESS - SUBSCRIPTIONS
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

export const subscribeToMyTournaments = (userId: string, callback: (data: Tournament[]) => void) => {
    const q = query(collection(db, 'tournaments'), where('adminId', '==', userId));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(d => d.data() as Tournament));
    });
};

export const subscribeToJoinedTournaments = (userId: string, callback: (data: Tournament[]) => void) => {
    const q = query(collection(db, 'tournaments'), where('approvedScorers', 'array-contains', userId));
    return onSnapshot(q, (snapshot) => {
        const all = snapshot.docs.map(d => d.data() as Tournament);
        callback(all.filter(t => t.adminId !== userId));
    });
};

// ============================================
// FIXTURE MANAGEMENT
// ============================================

export const updateFixtureData = async (tournamentId: string, fixtureId: string, data: Partial<TournamentFixture>) => {
    await updateDoc(doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId), data);
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
// GAME STARTING (UPDATED WITH COURT SELECTION)
// ============================================

/**
 * Start a tournament match with court selection
 * BACKWARDS COMPATIBLE: court parameter has default value
 */
export const startTournamentMatch = async (
    tournamentId: string,
    fixtureId: string,
    fixtureData: TournamentFixture,
    court: string = fixtureData.court || 'Court 1'
): Promise<string> => {
    if (!auth.currentUser) throw new Error("Authentication required");

    const fixtureRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId);

    try {
        // Use Firestore transaction for optimistic locking (prevents double-start)
        await runTransaction(db, async (transaction) => {
            const fixtureSnap = await transaction.get(fixtureRef);

            if (!fixtureSnap.exists()) {
                throw new Error('Fixture not found');
            }

            const currentFixture = fixtureSnap.data() as TournamentFixture;

            // SAFETY: Prevent double-start (first-come-first-served)
            if (currentFixture.status === 'live') {
                throw new Error('This match has already been started by another scorer');
            }

            // Lock the fixture immediately
            transaction.update(fixtureRef, {
                status: 'live',
                court: court,
                scorerId: auth.currentUser!.uid,
                actualStartTime: Date.now()
            });
        });

        // Create the game (outside transaction)
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
            { name: fixtureData.teamA, color: '#DC2626', players: [] },
            { name: fixtureData.teamB, color: '#2563EB', players: [] },
            false,
            fixtureData.sport,
            auth.currentUser!.uid
        );

        // Link game code to fixture
        await updateDoc(fixtureRef, {
            gameCode: newGameCode
        });

        console.log(`✅ Match started: ${fixtureData.teamA} vs ${fixtureData.teamB} on ${court}`);
        return newGameCode;

    } catch (error: any) {
        console.error('❌ Failed to start match:', error);
        throw error;
    }
};

/**
 * Check if a court is currently in use
 */
export const checkCourtAvailability = async (
    tournamentId: string,
    court: string
): Promise<boolean> => {
    try {
        const gamesQuery = query(
            collection(db, 'games'),
            where('settings.tournamentId', '==', tournamentId),
            where('settings.courtNumber', '==', court),
            where('status', '==', 'live')
        );

        const snapshot = await getDocs(gamesQuery);
        return snapshot.empty;
    } catch (error) {
        console.error('Failed to check court availability:', error);
        return false;
    }
};

/**
 * Get fixture by game code (for winner selection)
 */
export const getFixtureByGameCode = async (
    tournamentId: string,
    gameCode: string
): Promise<TournamentFixture | null> => {
    try {
        const fixturesQuery = query(
            collection(db, `tournaments/${tournamentId}/fixtures`),
            where('gameCode', '==', gameCode)
        );

        const snapshot = await getDocs(fixturesQuery);

        if (snapshot.empty) return null;

        return snapshot.docs[0].data() as TournamentFixture;
    } catch (error) {
        console.error('Failed to get fixture by game code:', error);
        return null;
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
    const fixtureRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixture.id);

    // Update current fixture with winner and score
    await updateDoc(fixtureRef, {
        status: 'completed',
        winnerSide: winnerSide,
        finalScore: finalScore || { teamA: 0, teamB: 0 },
        actualEndTime: Date.now()
    });

    // If there's a next match, advance the winner
    if (fixture.nextMatchId) {
        const winnerName = winnerSide === 'A' ? fixture.teamA : fixture.teamB;
        const nextMatchRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixture.nextMatchId);

        const updateField = fixture.bracketParent === 'A'
            ? { teamA: winnerName }
            : { teamB: winnerName };

        await updateDoc(nextMatchRef, updateField);

        console.log(`✅ Winner advanced: ${winnerName} → ${fixture.nextMatchId}`);
    }
};

// ============================================
// VOLUNTEER ACCESS FLOW
// ============================================

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
        await updateDoc(tRef, {
            approvedScorers: arrayUnion(userId),
            [`pendingRequests.${userId}.status`]: 'approved'
        });
    } else {
        await updateDoc(tRef, { [`pendingRequests.${userId}`]: deleteField() });
    }
};