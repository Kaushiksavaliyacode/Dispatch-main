
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore,
  enableMultiTabIndexedDbPersistence, 
  enableIndexedDbPersistence 
} from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDeC_ZLtfxSZOP_egt42tjGQwRFP-PtDcw",
  authDomain: "rdms-dispatch.firebaseapp.com",
  projectId: "rdms-dispatch",
  storageBucket: "rdms-dispatch.firebasestorage.app",
  messagingSenderId: "811836790780",
  appId: "1:811836790780:web:1dc9054aca63c5962c0479"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

/**
 * FIX: Use initializeFirestore to force long-polling.
 * This resolves "Could not reach Cloud Firestore backend" errors in environments
 * where WebSockets might be blocked or intermittent.
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Enable Offline Persistence
const enablePersistence = async () => {
  try {
    await enableMultiTabIndexedDbPersistence(db);
    console.log("Multi-tab persistence enabled");
  } catch (err: any) {
    if (err.code == 'failed-precondition') {
        console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
    } else if (err.code == 'unimplemented') {
        try {
            await enableIndexedDbPersistence(db);
            console.log("Single-tab persistence enabled");
        } catch (innerErr) {
            console.warn("Persistence could not be enabled", innerErr);
        }
    } else {
        console.warn("Persistence error:", err);
    }
  }
};

enablePersistence();
