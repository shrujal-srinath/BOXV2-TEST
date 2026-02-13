// src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  // ⚠️ REQUIRED: Add your RTDB URL to your .env file:
  // VITE_FIREBASE_DATABASE_URL=https://YOUR-PROJECT-default-rtdb.firebaseio.com
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);

if (missingFields.length > 0) {
  throw new Error(`Missing Firebase config: ${missingFields.join(', ')}`);
}

if (!firebaseConfig.databaseURL) {
  console.warn('[Firebase] VITE_FIREBASE_DATABASE_URL not set. Hardware bridge will use Firestore fallback only.');
}

export const app = initializeApp(firebaseConfig);

// Firestore — for games, users, tournaments (rich queries, complex data)
export const db = getFirestore(app);

// Realtime Database — for hardware bridge (low latency, high frequency writes)
// Will be undefined if databaseURL is not configured, handled gracefully in the bridge
export const rtdb = firebaseConfig.databaseURL ? getDatabase(app) : null;

export const auth = getAuth(app);
export default app;