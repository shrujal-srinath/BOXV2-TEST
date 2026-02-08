import { doc, setDoc, getDoc, updateDoc, collection, query, where, onSnapshot, arrayUnion, deleteField, orderBy } from 'firebase/firestore';
import { db, auth } from './firebase';
import { initializeNewGame } from './gameService';
import type { Tournament, TournamentConfig, TournamentFixture, SportType } from '../types';

// Helper: Generate random 4-digit PIN
const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

// Helper: Generate 6-char ID
const generateId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
};

// --- CORE TOURNAMENT MANAGEMENT ---

export const createTournament = async (name: string, logoUrl: string, config: TournamentConfig): Promise<string> => {
    if (!auth.currentUser) throw new Error("Must be logged in");
    const id = generateId();
    const newTournament: Tournament = {
        id,
        adminId: auth.currentUser.uid,
        name,
        logoUrl,
        scorerPin: generatePin(),
        status: 'active',
        config,
        approvedScorers: [auth.currentUser.uid],
        pendingRequests: {},
        createdAt: Date.now()
    };
    await setDoc(doc(db, 'tournaments', id), newTournament);
    return id;
};

// --- REAL-TIME SUBSCRIPTIONS ---

export const subscribeToMyTournaments = (userId: string, callback: (data: Tournament[]) => void) => {
    const q = query(collection(db, 'tournaments'), where('adminId', '==', userId));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(d => d.data() as Tournament));
    });
};

export const subscribeToJoinedTournaments = (userId: string, callback: (data: Tournament[]) => void) => {
    const q = query(collection(db, 'tournaments'), where('approvedScorers', 'array-contains', userId));
    return onSnapshot(q, (snapshot) => {
        // Filter out owned tournaments client-side to avoid complex compound queries
        const all = snapshot.docs.map(d => d.data() as Tournament);
        callback(all.filter(t => t.adminId !== userId));
    });
};

export const subscribeToTournament = (id: string, callback: (data: Tournament | null) => void) => {
    return onSnapshot(doc(db, 'tournaments', id), (doc) => {
        callback(doc.exists() ? (doc.data() as Tournament) : null);
    });
};

export const subscribeToFixtures = (tournamentId: string, callback: (data: TournamentFixture[]) => void) => {
    const q = query(collection(db, `tournaments/${tournamentId}/fixtures`), orderBy('id', 'desc')); // Simple ordering
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(d => d.data() as TournamentFixture));
    });
};

// --- VOLUNTEER ACCESS FLOW ---

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

// --- FIXTURE & GAME LOGIC ---

export const createFixture = async (tournamentId: string, data: Partial<TournamentFixture>): Promise<string> => {
    const id = `fix-${Date.now()}`;
    const fixture: TournamentFixture = {
        id,
        tournamentId,
        sport: data.sport || 'basketball',
        teamA: data.teamA || 'Team A',
        teamB: data.teamB || 'Team B',
        court: data.court || 'Court 1',
        time: data.time || 'TBD',
        status: 'scheduled'
    };
    await setDoc(doc(db, `tournaments/${tournamentId}/fixtures`, id), fixture);
    return id;
};

// CRITICAL: Converts a scheduled Fixture into a Live Game
export const startTournamentMatch = async (tournamentId: string, fixtureId: string, fixtureData: TournamentFixture): Promise<string> => {
    if (!auth.currentUser) throw new Error("Auth required");

    // 1. Initialize the actual Game Document (using existing gameService)
    // We pass the Tournament ID so the game knows it belongs to a tournament
    const gameCode = await initializeNewGame(
        {
            gameName: `${fixtureData.teamA} vs ${fixtureData.teamB}`,
            periodDuration: 10,
            shotClockDuration: 24,
            periodType: 'quarter',
            courtNumber: fixtureData.court,
            tournamentId: tournamentId
        },
        { name: fixtureData.teamA, color: '#DC2626', players: [] },
        { name: fixtureData.teamB, color: '#2563EB', players: [] },
        false, // Track stats default false for quick start
        fixtureData.sport,
        auth.currentUser.uid
    );

    // 2. Update the Fixture to point to this new Game
    await updateDoc(doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId), {
        status: 'live',
        gameCode: gameCode
    });

    return gameCode;
};