import { initializeApp } from "firebase/app";
import { 
  getFirestore,
  enableMultiTabIndexedDbPersistence,
  enableIndexedDbPersistence
} from "firebase/firestore";
import { 
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDeC_ZLtfxSZOP_egt42tjGQwRFP-PtDcw",
  authDomain: "rdms-dispatch.firebaseapp.com",
  projectId: "rdms-dispatch",
  storageBucket: "rdms-dispatch.firebasestorage.app",
  messagingSenderId: "811836790780",
  appId: "1:811836790780:web:1dc9054aca63c5962c0479"
};

const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    await signInAnonymously(auth);
    console.log("Signed in anonymously");
  } else {
    console.log("Auth UID:", user.uid);
  }
});

// Firestore
export const db = getFirestore(app);

// Persistence
const enablePersistence = async () => {
  try {
    await enableMultiTabIndexedDbPersistence(db);
    console.log("Multi-tab persistence enabled");
  } catch (err: any) {
    if (err.code === "failed-precondition") {
      console.warn("Multiple tabs open");
    } else if (err.code === "unimplemented") {
      try {
        await enableIndexedDbPersistence(db);
        console.log("Single-tab persistence enabled");
      } catch (e) {
        console.warn("Persistence disabled", e);
      }
    }
  }
};

enablePersistence();