import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously, // <--- NEW IMPORT
  signOut,
  onAuthStateChanged,
  User,
  browserPopupRedirectResolver
} from 'firebase/auth';
import { app } from './firebase';

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// --- EXISTING METHODS (Login, Register, etc.) KEEP AS IS ---
export const loginWithGoogle = async () => { /* ... */ };
export const loginWithEmail = async (email: string, pass: string) => { /* ... */ };
export const registerWithEmail = async (email: string, pass: string) => { /* ... */ };

// --- NEW METHOD: GUEST LOGIN ---
export const loginAnonymously = async () => {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error: any) {
    console.error("Anonymous Login Error:", error);
    throw new Error(error.message);
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
  }
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export { auth };