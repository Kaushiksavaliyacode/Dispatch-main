
import { initializeApp } from "firebase/app";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";

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
export const db = getFirestore(app);

// Enable Offline Persistence
// This prevents the app from hanging if the backend is unreachable
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
      console.warn("Multiple tabs open, persistence can only be enabled in one tab at a a time.");
  } else if (err.code == 'unimplemented') {
      console.warn("The current browser does not support all of the features required to enable persistence");
  }
});
