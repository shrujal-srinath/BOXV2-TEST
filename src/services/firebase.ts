import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your real configuration
const firebaseConfig = {
  apiKey: "AIzaSyAwH0ryk7YUvx37l2446J6MYOcnYzg-2gg",
  authDomain: "the-box-v2.firebaseapp.com",
  projectId: "the-box-v2",
  storageBucket: "the-box-v2.firebasestorage.app",
  messagingSenderId: "537547790625",
  appId: "1:537547790625:web:b8faf300cc43b2eef54660",
  measurementId: "G-QF3E2D6BTL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };