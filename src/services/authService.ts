import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged, 
  type User 
} from "firebase/auth";
import { auth } from "./firebase";

// 1. Log In with Google
export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Google Login failed", error);
    return null;
  }
};

// 2. Log In with Email
export const loginWithEmail = async (email: string, pass: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error) {
    console.error("Email Login failed", error);
    throw error;
  }
};

// 3. Register with Email
export const registerWithEmail = async (email: string, pass: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error) {
    console.error("Registration failed", error);
    throw error;
  }
};

// 4. Log Out
export const logoutUser = async () => {
  await signOut(auth);
};

// 5. Listen for User Changes
export const subscribeToAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};