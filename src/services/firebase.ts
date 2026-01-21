import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  initializeFirestore, 
  memoryLocalCache // <--- Use Memory Cache instead of Persistent
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- NEW CONFIGURATION (Project: boxv2-1) ---
const firebaseConfig = {
  apiKey: "AIzaSyBC9eer79l4s22UEoFhaR1Q9L6TNuVPdIw",
  authDomain: "boxv2-1.firebaseapp.com",
  projectId: "boxv2-1",
  storageBucket: "boxv2-1.firebasestorage.app",
  messagingSenderId: "54168657545",
  appId: "1:54168657545:web:a84547766022c30449f058",
  measurementId: "G-BE6020M5WD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firestore
// FIX: We removed 'experimentalForceLongPolling' and 'persistentLocalCache'
// This forces a fresh connection every time and lets the browser choose the best network method.
const db = initializeFirestore(app, {
  localCache: memoryLocalCache() 
});

const auth = getAuth(app);

export { db, auth, analytics };