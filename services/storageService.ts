import { db } from './firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  query, 
  getDoc
} from 'firebase/firestore';
import { AppData, DispatchEntry, Challan, Party } from '../types';

// YOUR GOOGLE SCRIPT URL FOR AUTO-SAVE
const GOOGLE_SHEET_URL_RAW = "https://script.google.com/macros/s/AKfycbyOAKZL4S0GCyttWMrKvBns8k3Pba14iKegCFd6q1Vq0fnFjjz7zFdYQcvzMvBak0fk/exec";
const GOOGLE_SHEET_URL = GOOGLE_SHEET_URL_RAW.trim();

// --- Firestore Collections ---
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

  const unsubParties = onSnapshot(collection(db, "parties"), (snapshot) => {
    localData.parties = snapshot.docs.map(doc => doc.data() as Party);
    partiesLoaded = true;
    checkLoad();
  });

  const qDispatches = query(collection(db, "dispatches")); 
  const unsubDispatches = onSnapshot(qDispatches, (snapshot) => {
    localData.dispatches = snapshot.docs.map(doc => doc.data() as DispatchEntry)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    dispatchesLoaded = true;
    checkLoad();
  });

  const qChallans = query(collection(db, "challans"));
  const unsubChallans = onSnapshot(qChallans, (snapshot) => {
    localData.challans = snapshot.docs.map(doc => doc.data() as Challan)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    challansLoaded = true;
    checkLoad();
  });

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

    // --- AUTOMATION: AUTO-SAVE TO GOOGLE SHEET (CREATE OR UPDATE) ---
    if (GOOGLE_SHEET_URL) {
      console.log(`☁️ Syncing Job [${dispatch.dispatchNo}] to Google Sheet...`);
      const pDoc = await getDoc(doc(db, "parties", dispatch.partyId));
      const pName = pDoc.exists() ? pDoc.data().name : "Unknown";

      fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'JOB',
          dispatchNo: dispatch.dispatchNo, // Critical for identifying updates
          date: dispatch.date,
          partyName: pName,
          rows: dispatch.rows.map(r => ({
              ...r,
              // Append Type to Size for Google Sheet visibility
              size: r.size + (r.sizeType ? ` ${r.sizeType}` : '') 
          }))
        })
      })
      .then(() => console.log("✅ Job Sync Request Sent"))
      .catch(err => console.error("❌ Google Sheet Sync Failed:", err));
    }
    // ---------------------------------------------

  } catch (e) {
    console.error("Error saving dispatch: ", e);
    alert("Error saving job to cloud");
  }
};

export const deleteDispatch = async (id: string) => {
  try {
    // Get data before delete to sync deletion to sheet
    let dispatchNo = '';
    if (GOOGLE_SHEET_URL) {
        const docSnap = await getDoc(doc(db, "dispatches", id));
        if (docSnap.exists()) {
            dispatchNo = (docSnap.data() as DispatchEntry).dispatchNo;
        }
    }

    await deleteDoc(doc(db, "dispatches", id));

    // --- AUTOMATION: DELETE FROM GOOGLE SHEET ---
    if (GOOGLE_SHEET_URL && dispatchNo) {
      console.log(`🗑️ Deleting Job [${dispatchNo}] from Google Sheet...`);
      fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DELETE_JOB',
          dispatchNo: dispatchNo
        })
      }).catch(err => console.error("Google Sheet Delete Failed:", err));
    }

  } catch (e) {
    console.error("Error deleting dispatch: ", e);
  }
};

export const saveChallan = async (challan: Challan) => {
  try {
    await setDoc(doc(db, "challans", challan.id), challan);

    // --- AUTOMATION: AUTO-SAVE TO GOOGLE SHEET (CREATE OR UPDATE) ---
    if (GOOGLE_SHEET_URL) {
      console.log(`☁️ Syncing Bill [${challan.challanNumber}] to Google Sheet...`);
      const pDoc = await getDoc(doc(db, "parties", challan.partyId));
      const pName = pDoc.exists() ? pDoc.data().name : "Unknown";

      fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'BILL',
          date: challan.date,
          challanNumber: challan.challanNumber, // Critical for identifying updates
          partyName: pName,
          paymentMode: challan.paymentMode,
          lines: challan.lines
        })
      })
      .then(() => console.log("✅ Bill Sync Request Sent"))
      .catch(err => console.error("❌ Google Sheet Sync Failed:", err));
    }
    // ---------------------------------------------

  } catch (e) {
    console.error("Error saving challan: ", e);
    alert("Error saving bill to cloud");
  }
};

export const deleteChallan = async (id: string) => {
  try {
    // Get data before delete
    let challanNumber = '';
    if (GOOGLE_SHEET_URL) {
        const docSnap = await getDoc(doc(db, "challans", id));
        if (docSnap.exists()) {
            challanNumber = (docSnap.data() as Challan).challanNumber;
        }
    }

    await deleteDoc(doc(db, "challans", id));

    // --- AUTOMATION: DELETE FROM GOOGLE SHEET ---
    if (GOOGLE_SHEET_URL && challanNumber) {
        console.log(`🗑️ Deleting Bill [${challanNumber}] from Google Sheet...`);
        fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'DELETE_BILL',
            challanNumber: challanNumber
          })
        }).catch(err => console.error("Google Sheet Delete Failed:", err));
    }

  } catch (e) {
    console.error("Error deleting challan: ", e);
  }
};

export const ensurePartyExists = async (parties: Party[], name: string): Promise<string> => {
  const existing = parties.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;

  const newId = `p-${Date.now()}`;
  const newParty: Party = { id: newId, name: name, contact: '', address: '' };
  await saveParty(newParty);
  return newId;
};

// --- NEW FUNCTION: SYNC ALL EXISTING DATA ---
export const syncAllDataToCloud = async (data: AppData, onProgress: (current: number, total: number) => void) => {
    if (!GOOGLE_SHEET_URL) {
        console.error("No Google Sheet URL configured");
        return;
    }
    
    // Combine all jobs and bills into one queue
    const items = [
        ...data.dispatches.map(d => ({ type: 'JOB', data: d })),
        ...data.challans.map(c => ({ type: 'BILL', data: c }))
    ];

    const total = items.length;
    console.log(`Starting Batch Sync for ${total} items...`);

    // Process one by one to avoid hitting Google Script rate limits/locks
    for (let i = 0; i < total; i++) {
        const item = items[i];
        onProgress(i + 1, total);
        
        const payload: any = {};
        
        if (item.type === 'JOB') {
            const d = item.data as DispatchEntry;
            const pName = data.parties.find(p => p.id === d.partyId)?.name || "Unknown";
            payload.type = 'JOB';
            payload.dispatchNo = d.dispatchNo;
            payload.date = d.date;
            payload.partyName = pName;
            payload.rows = d.rows.map(r => ({
                ...r,
                size: r.size + (r.sizeType ? ` ${r.sizeType}` : '') 
            }));
        } else {
            const c = item.data as Challan;
            const pName = data.parties.find(p => p.id === c.partyId)?.name || "Unknown";
            payload.type = 'BILL';
            payload.date = c.date;
            payload.challanNumber = c.challanNumber;
            payload.partyName = pName;
            payload.paymentMode = c.paymentMode;
            payload.lines = c.lines;
        }

        try {
            await fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            // Artificial delay (800ms) to allow Google Sheet LockService to release
            await new Promise(resolve => setTimeout(resolve, 800)); 
        } catch (e) {
            console.error("Sync error for item:", item, e);
        }
    }
};

export const getAppData = () => ({ parties: [], dispatches: [], challans: [] });
export const saveAppData = () => {};