// src/services/firebase.ts
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- FIREBASE CONFIGURATION ---
// Using type casting to ensure TS recognizes Vite's import.meta.env
const env = (import.meta as any).env;

const firebaseConfig = {
  apiKey: env?.VITE_FIREBASE_API_KEY || "",
  authDomain: env?.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: env?.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: env?.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: env?.VITE_FIREBASE_APP_ID || "",
  measurementId: env?.VITE_FIREBASE_MEASUREMENT_ID || ""
};

// Validate
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('⚠️ FIREBASE CONFIG: Some environment variables are missing.');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;

// Initialize Firestore with PERSISTENT cache
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const auth = getAuth(app);

export { db, auth, analytics };