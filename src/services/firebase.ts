import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- FIREBASE CONFIGURATION (Project: boxv2-1) ---
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

// Initialize Firestore with PERSISTENT cache for offline support
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const auth = getAuth(app);

export { db, auth, analytics };