import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { app } from './firebase';

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// --- 1. GOOGLE LOGIN (Fixed) ---
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Google Login Error:", error);
    // Throw error so the UI can catch it and alert the user
    throw new Error(error.message);
  }
};

// --- 2. EMAIL LOGIN (Fixed) ---
export const loginWithEmail = async (email: string, pass: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error: any) {
    console.error("Email Login Error:", error);
    throw new Error(error.message);
  }
};

// --- 3. EMAIL REGISTRATION (Fixed) ---
export const registerWithEmail = async (email: string, pass: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error: any) {
    console.error("Registration Error:", error);
    throw new Error(error.message);
  }
};

// --- 4. GUEST LOGIN ---
export const loginAnonymously = async () => {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error: any) {
    console.error("Anonymous Login Error:", error);
    throw new Error(error.message);
  }
};

// --- 5. LOGOUT ---
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
  }
};

// --- 6. AUTH STATE OBSERVER ---
export const subscribeToAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export { auth };