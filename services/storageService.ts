import { db } from './firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { AppData, DispatchEntry, Challan, Party } from '../types';

// --- Firestore Collections ---
// We listen to these collections in real-time
export const subscribeToData = (onDataChange: (data: AppData) => void) => {
  const localData: AppData = { parties: [], dispatches: [], challans: [] };
  let partiesLoaded = false;
  let dispatchesLoaded = false;
  let challansLoaded = false;

  const checkLoad = () => {
    if (partiesLoaded && dispatchesLoaded && challansLoaded) {
      onDataChange({ ...localData });
    }
  };

  // 1. Listen to Parties
  const unsubParties = onSnapshot(collection(db, "parties"), (snapshot) => {
    localData.parties = snapshot.docs.map(doc => doc.data() as Party);
    partiesLoaded = true;
    checkLoad();
  });

  // 2. Listen to Dispatches (Jobs)
  // We can order them by date if needed, but client-side sorting is often easier for small datasets
  const qDispatches = query(collection(db, "dispatches")); 
  const unsubDispatches = onSnapshot(qDispatches, (snapshot) => {
    localData.dispatches = snapshot.docs.map(doc => doc.data() as DispatchEntry)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first
    dispatchesLoaded = true;
    checkLoad();
  });

  // 3. Listen to Challans (Bills)
  const qChallans = query(collection(db, "challans"));
  const unsubChallans = onSnapshot(qChallans, (snapshot) => {
    localData.challans = snapshot.docs.map(doc => doc.data() as Challan)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first
    challansLoaded = true;
    checkLoad();
  });

  // Return unsubscribe function to clean up listeners
  return () => {
    unsubParties();
    unsubDispatches();
    unsubChallans();
  };
};

// --- Write Operations ---

export const saveParty = async (party: Party) => {
  try {
    await setDoc(doc(db, "parties", party.id), party);
  } catch (e) {
    console.error("Error saving party: ", e);
    alert("Error saving party to cloud");
  }
};

export const saveDispatch = async (dispatch: DispatchEntry) => {
  try {
    await setDoc(doc(db, "dispatches", dispatch.id), dispatch);
  } catch (e) {
    console.error("Error saving dispatch: ", e);
    alert("Error saving job to cloud");
  }
};

export const deleteDispatch = async (id: string) => {
  try {
    await deleteDoc(doc(db, "dispatches", id));
  } catch (e) {
    console.error("Error deleting dispatch: ", e);
  }
};

export const saveChallan = async (challan: Challan) => {
  try {
    await setDoc(doc(db, "challans", challan.id), challan);
  } catch (e) {
    console.error("Error saving challan: ", e);
    alert("Error saving bill to cloud");
  }
};

export const deleteChallan = async (id: string) => {
  try {
    await deleteDoc(doc(db, "challans", id));
  } catch (e) {
    console.error("Error deleting challan: ", e);
  }
};

// Helper for Party Management (Check if exists, if not create)
export const ensurePartyExists = async (parties: Party[], name: string): Promise<string> => {
  const existing = parties.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;

  const newId = `p-${Date.now()}`;
  const newParty: Party = { id: newId, name: name, contact: '', address: '' };
  await saveParty(newParty);
  return newId;
};

// --- Mock/Deprecated ---
// Kept empty to satisfy imports if any, but functionality is replaced
export const getAppData = () => ({ parties: [], dispatches: [], challans: [] });
export const saveAppData = () => {};