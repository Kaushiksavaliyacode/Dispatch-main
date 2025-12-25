import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  enableMultiTabIndexedDbPersistence,
  enableIndexedDbPersistence
} from "firebase/firestore";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD5aAS5dPDWOIejnYK6C-pp8BBHiajrG4g",
  authDomain: "rdms-55601.firebaseapp.com",
  projectId: "rdms-55601",
  storageBucket: "rdms-55601.firebasestorage.app",
  messagingSenderId: "88273977398",
  appId: "1:88273977398:web:e3fe4b6b137e09363c9897",
  measurementId: "G-30X23H9S2K"
};

// Init app
export const app = initializeApp(firebaseConfig);

// Analytics. Browser only.
export const analytics =
  typeof window !== "undefined" ? getAnalytics(app) : null;

// Auth
export const auth = getAuth(app);

// Firestore
export const db = getFirestore(app);

// Auth init. Call once on app start.
export const initializeAuth = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        try {
          if (!user) {
            const cred = await signInAnonymously(auth);
            console.log("Anonymous auth OK");
            console.log("UID:", cred.user.uid);
            resolve(cred.user);
          } else {
            console.log("Auth already active");
            console.log("UID:", user.uid);
            resolve(user);
          }
          unsubscribe();
        } catch (e) {
          console.error("Auth failed", e);
          reject(e);
        }
      },
      (e) => {
        console.error("Auth listener error", e);
        unsubscribe();
        reject(e);
      }
    );
  });
};

// Firestore persistence
const enablePersistence = async () => {
  try {
    await enableMultiTabIndexedDbPersistence(db);
    console.log("Multi-tab persistence enabled");
  } catch (e: any) {
    if (e.code === "failed-precondition") {
      console.warn("Multiple tabs open");
    } else if (e.code === "unimplemented") {
      try {
        await enableIndexedDbPersistence(db);
        console.log("Single-tab persistence enabled");
      } catch (err) {
        console.warn("Persistence disabled", err);
      }
    }
  }
};

enablePersistence();