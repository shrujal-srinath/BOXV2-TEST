import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  browserPopupRedirectResolver
} from 'firebase/auth';
import { app } from './firebase';

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Force account selection prompt
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// 1. Log In with Google (Robust with Popup/Redirect Fallback)
export const loginWithGoogle = async () => {
  try {
    // Try Popup first (Better for Desktop)
    await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
  } catch (error: any) {
    console.error("Google Auth Error:", error);

    // ERROR HANDLING FOR MOBILE
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      // Fallback to Redirect (Better for Mobile)
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError: any) {
        alert(`Login Failed: ${redirectError.message}`);
      }
    } else if (error.code === 'auth/unauthorized-domain') {
      alert("Configuration Error: This domain is not authorized in Firebase Console.");
    } else {
      alert(`Login Error: ${error.message}`);
    }
  }
};

// 2. Log In with Email (Restored)
export const loginWithEmail = async (email: string, pass: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error: any) {
    console.error("Email Login failed", error);
    throw new Error(error.message);
  }
};

// 3. Register with Email (Restored)
export const registerWithEmail = async (email: string, pass: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error: any) {
    console.error("Registration failed", error);
    throw new Error(error.message);
  }
};

// 4. Log Out
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
  }
};

// 5. Subscribe to Auth Changes
export const subscribeToAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Export auth instance for direct usage if needed
export { auth };