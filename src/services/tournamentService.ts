import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from './firebase';
import type { Tournament, TournamentConfig } from '../types';

// Helper: Generate random 4-digit PIN
const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

// Helper: Generate 6-char ID (Uppercase)
const generateId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
};

// --- CORE FUNCTIONS ---

export const createTournament = async (
    name: string,
    logoUrl: string,
    config: TournamentConfig
): Promise<string> => {
    if (!auth.currentUser) throw new Error("Must be logged in");

    const id = generateId();
    const scorerPin = generatePin();

    // Create the tournament document
    const newTournament: Tournament = {
        id,
        adminId: auth.currentUser.uid,
        name,
        logoUrl,
        scorerPin,
        status: 'active',
        config,
        approvedScorers: [auth.currentUser.uid], // Admin is auto-approved
        pendingRequests: {},
        createdAt: Date.now()
    };

    await setDoc(doc(db, 'tournaments', id), newTournament);
    return id;
};

export const getMyTournaments = async (): Promise<Tournament[]> => {
    if (!auth.currentUser) return [];

    // Query tournaments where I am the admin
    const q = query(
        collection(db, 'tournaments'),
        where('adminId', '==', auth.currentUser.uid)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as Tournament);
};

export const getTournament = async (id: string): Promise<Tournament | null> => {
    const docRef = await getDoc(doc(db, 'tournaments', id));
    return docRef.exists() ? (docRef.data() as Tournament) : null;
};