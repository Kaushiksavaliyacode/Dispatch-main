import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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