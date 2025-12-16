
import { db } from './firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  query, 
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { AppData, DispatchEntry, Challan, Party, SlittingJob, ChemicalLog, ChemicalStock, ChemicalPurchase, ProductionPlan } from '../types';

// Dynamic URL handling
let GOOGLE_SHEET_URL = localStorage.getItem('rdms_sheet_url') || "";

export const setGoogleSheetUrl = (url: string) => {
    GOOGLE_SHEET_URL = url.trim();
    localStorage.setItem('rdms_sheet_url', GOOGLE_SHEET_URL);
};

export const getGoogleSheetUrl = () => GOOGLE_SHEET_URL;

export const subscribeToData = (onDataChange: (data: AppData) => void) => {
  const localData: AppData = { 
      parties: [], dispatches: [], challans: [], slittingJobs: [], 
      productionPlans: [], // Init
      chemicalLogs: [], chemicalStock: { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 },
      chemicalPurchases: [] 
  };
  
  let partiesLoaded = false;
  let dispatchesLoaded = false;
  let challansLoaded = false;
  let slittingLoaded = false;
  let plansLoaded = false;
  let chemicalsLoaded = false;
  let stockLoaded = false;
  let purchasesLoaded = false;

  const checkLoad = () => {
    // We try to render whatever we have, even if some parts failed, 
    // but initially we wait for critical parts.
    // However, to prevent UI hanging, we'll just push updates as they come 
    // once the 'main' parts are roughly ready or just always push.
    // For a smoother UX, we debounce slightly or just push.
    // Given the "immediately" requirement, we push immediately.
    if (partiesLoaded && dispatchesLoaded && challansLoaded && slittingLoaded && plansLoaded && chemicalsLoaded && stockLoaded && purchasesLoaded) {
      onDataChange({ ...localData });
    } else {
        // Optional: Trigger partial load if needed, but safe to wait for init.
        // For subsequent updates, this condition is always true.
    }
  };

  // Error handler helper
  const handleError = (context: string, err: any) => {
      console.error(`Firebase Sync Error (${context}):`, err);
      // Mark as loaded to prevent app hanging on loading screen
      return true; 
  };

  const unsubParties = onSnapshot(collection(db, "parties"), (snapshot) => {
    localData.parties = snapshot.docs.map(doc => doc.data() as Party);
    partiesLoaded = true;
    checkLoad();
  }, (err) => { partiesLoaded = handleError('Parties', err); checkLoad(); });

  const qDispatches = query(collection(db, "dispatches")); 
  const unsubDispatches = onSnapshot(qDispatches, (snapshot) => {
    localData.dispatches = snapshot.docs.map(doc => doc.data() as DispatchEntry)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    dispatchesLoaded = true;
    checkLoad();
  }, (err) => { dispatchesLoaded = handleError('Dispatches', err); checkLoad(); });

  const qChallans = query(collection(db, "challans"));
  const unsubChallans = onSnapshot(qChallans, (snapshot) => {
    localData.challans = snapshot.docs.map(doc => doc.data() as Challan)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    challansLoaded = true;
    checkLoad();
  }, (err) => { challansLoaded = handleError('Challans', err); checkLoad(); });

  const qSlitting = query(collection(db, "slitting_jobs"));
  const unsubSlitting = onSnapshot(qSlitting, (snapshot) => {
    localData.slittingJobs = snapshot.docs.map(doc => doc.data() as SlittingJob)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    slittingLoaded = true;
    checkLoad();
  }, (err) => { slittingLoaded = handleError('Slitting', err); checkLoad(); });

  // Production Plans (Printing/Cutting)
  const qPlans = query(collection(db, "production_plans"));
  const unsubPlans = onSnapshot(qPlans, (snapshot) => {
    const plans = snapshot.docs.map(doc => doc.data() as ProductionPlan)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    localData.productionPlans = plans;
    plansLoaded = true;
    
    // Immediate callback for Plans to ensure admin updates reflect instantly on user side
    if (partiesLoaded && dispatchesLoaded) { // Basic sanity check
        onDataChange({ ...localData });
    } else {
        checkLoad();
    }
  }, (err) => { plansLoaded = handleError('Plans', err); checkLoad(); });

  const qChemicals = query(collection(db, "chemical_logs"));
  const unsubChemicals = onSnapshot(qChemicals, (snapshot) => {
    localData.chemicalLogs = snapshot.docs.map(doc => doc.data() as ChemicalLog)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    chemicalsLoaded = true;
    checkLoad();
  }, (err) => { chemicalsLoaded = handleError('Chemicals', err); checkLoad(); });

  const qPurchases = query(collection(db, "chemical_purchases"));
  const unsubPurchases = onSnapshot(qPurchases, (snapshot) => {
    localData.chemicalPurchases = snapshot.docs.map(doc => doc.data() as ChemicalPurchase)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    purchasesLoaded = true;
    checkLoad();
  }, (err) => { purchasesLoaded = handleError('Purchases', err); checkLoad(); });

  const unsubStock = onSnapshot(doc(db, "chemical_stock", "main"), (doc) => {
      if (doc.exists()) {
          localData.chemicalStock = doc.data() as ChemicalStock;
      }
      stockLoaded = true;
      checkLoad();
  }, (err) => { stockLoaded = handleError('Stock', err); checkLoad(); });

  return () => {
    unsubParties();
    unsubDispatches();
    unsubChallans();
    unsubSlitting();
    unsubPlans();
    unsubChemicals();
    unsubPurchases();
    unsubStock();
  };
};

export const saveParty = async (party: Party) => {
  try {
    await setDoc(doc(db, "parties", party.id), party);
  } catch (e) {
    console.error("Error saving party: ", e);
    alert("Error saving party to cloud");
  }
};

export const updateParty = async (party: Party) => {
  try {
    await updateDoc(doc(db, "parties", party.id), { ...party });
  } catch (e) {
    console.error("Error updating party: ", e);
    alert("Error updating party");
  }
};

export const deleteParty = async (id: string) => {
  try {
    await deleteDoc(doc(db, "parties", id));
  } catch (e) {
    console.error("Error deleting party: ", e);
    alert("Error deleting party");
  }
};

export const saveDispatch = async (dispatch: DispatchEntry) => {
  try {
    await setDoc(doc(db, "dispatches", dispatch.id), dispatch);

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
          dispatchNo: dispatch.dispatchNo, 
          date: dispatch.date,
          partyName: pName,
          rows: dispatch.rows.map(r => ({
              ...r,
              size: r.size,
              sizeType: r.sizeType,
              micron: r.micron
          }))
        })
      })
      .then(() => console.log("✅ Job Sync Request Sent"))
      .catch(err => console.error("❌ Google Sheet Sync Failed:", err));
    }

  } catch (e) {
    console.error("Error saving dispatch: ", e);
    alert("Error saving job to cloud");
  }
};

export const deleteDispatch = async (id: string) => {
  try {
    let dispatchNo = '';
    if (GOOGLE_SHEET_URL) {
        const docSnap = await getDoc(doc(db, "dispatches", id));
        if (docSnap.exists()) {
            dispatchNo = (docSnap.data() as DispatchEntry).dispatchNo;
        }
    }

    await deleteDoc(doc(db, "dispatches", id));

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
          challanNumber: challan.challanNumber, 
          partyName: pName,
          paymentMode: challan.paymentMode,
          lines: challan.lines.map(l => ({
              ...l,
              size: l.size,
              sizeType: l.sizeType, // Send Type
              micron: l.micron      // Send Micron
          }))
        })
      })
      .then(() => console.log("✅ Bill Sync Request Sent"))
      .catch(err => console.error("❌ Google Sheet Sync Failed:", err));
    }

  } catch (e) {
    console.error("Error saving challan: ", e);
    alert("Error saving bill to cloud");
  }
};

export const deleteChallan = async (id: string) => {
  try {
    let challanNumber = '';
    if (GOOGLE_SHEET_URL) {
        const docSnap = await getDoc(doc(db, "challans", id));
        if (docSnap.exists()) {
            challanNumber = (docSnap.data() as Challan).challanNumber;
        }
    }

    await deleteDoc(doc(db, "challans", id));

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

export const saveSlittingJob = async (job: SlittingJob) => {
  try {
    await setDoc(doc(db, "slitting_jobs", job.id), job);

    if (GOOGLE_SHEET_URL) {
        console.log(`☁️ Syncing Slitting Job [${job.jobNo}] to Google Sheet...`);
        
        // Flatten rows for sheet
        const flatRows = job.rows.map(row => {
            const coil = job.coils.find(c => c.id === row.coilId);
            return {
                srNo: row.srNo,
                size: coil ? coil.size : row.size, // Use coil size if available
                grossWeight: row.grossWeight,
                coreWeight: row.coreWeight,
                netWeight: row.netWeight,
                meter: row.meter,
                micron: job.planMicron // Add micron to row for context
            };
        });

        fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'SLITTING_JOB',
                id: job.id,
                jobNo: job.jobNo,
                date: job.date,
                jobCode: job.jobCode,
                status: job.status,
                planQty: job.planQty,
                planMicron: job.planMicron,
                rows: flatRows
            })
        }).catch(err => console.error("Slitting Sync Failed:", err));
    }

  } catch (e) {
    console.error("Error saving slitting job:", e);
  }
}

export const deleteSlittingJob = async (id: string) => {
  try {
    let jobNo = '';
    if (GOOGLE_SHEET_URL) {
        const docSnap = await getDoc(doc(db, "slitting_jobs", id));
        if (docSnap.exists()) {
            jobNo = (docSnap.data() as SlittingJob).jobNo;
        }
    }

    await deleteDoc(doc(db, "slitting_jobs", id));

    if (GOOGLE_SHEET_URL && jobNo) {
        console.log(`🗑️ Deleting Slitting Job [${jobNo}] from Google Sheet...`);
        fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'DELETE_SLITTING_JOB',
                jobNo: jobNo
            })
        }).catch(err => console.error("Slitting Delete Sync Failed:", err));
    }

  } catch (e) {
    console.error("Error deleting slitting job:", e);
  }
}

// --- PLANNING FUNCTIONS ---

export const saveProductionPlan = async (plan: ProductionPlan) => {
    try {
        await setDoc(doc(db, "production_plans", plan.id), plan);
        
        if (GOOGLE_SHEET_URL) {
            console.log(`☁️ Syncing Plan [${plan.partyName}] to Google Sheet...`);
            fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'PLAN',
                    id: plan.id,
                    date: plan.date,
                    partyName: plan.partyName,
                    planType: plan.type,
                    size: plan.size,
                    printName: plan.printName,
                    micron: plan.micron,
                    weight: plan.weight,
                    meter: plan.meter,
                    cuttingSize: plan.cuttingSize,
                    pcs: plan.pcs,
                    notes: plan.notes,
                    status: plan.status
                })
            }).catch(err => console.error("Plan Sync Failed:", err));
        }
    } catch (e) {
        console.error("Error saving plan:", e);
    }
}

export const updateProductionPlan = async (plan: Partial<ProductionPlan> & { id: string }) => {
    try {
        await updateDoc(doc(db, "production_plans", plan.id), plan);
        
        if (GOOGLE_SHEET_URL) {
            // Need full doc to sync properly, fetch it first
            const fullDoc = await getDoc(doc(db, "production_plans", plan.id));
            if (fullDoc.exists()) {
                const fullPlan = fullDoc.data() as ProductionPlan;
                saveProductionPlan(fullPlan); // Re-use save to sync
            }
        }
    } catch (e) {
        console.error("Error updating plan:", e);
    }
}

export const deleteProductionPlan = async (id: string) => {
    try {
        await deleteDoc(doc(db, "production_plans", id));
        
        if (GOOGLE_SHEET_URL) {
            console.log(`🗑️ Deleting Plan [${id}] from Google Sheet...`);
            fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'DELETE_PLAN',
                    id: id
                })
            }).catch(err => console.error("Plan Delete Sync Failed:", err));
        }
    } catch (e) {
        console.error("Error deleting plan:", e);
    }
}

// --- CHEMICAL FUNCTIONS ---

export const saveChemicalLog = async (log: ChemicalLog) => {
    try {
        await setDoc(doc(db, "chemical_logs", log.id), log);
    } catch (e) {
        console.error("Error saving chemical log:", e);
    }
}

export const saveChemicalPurchase = async (purchase: ChemicalPurchase) => {
    try {
        await setDoc(doc(db, "chemical_purchases", purchase.id), purchase);
    } catch (e) {
        console.error("Error saving chemical purchase:", e);
    }
}

export const deleteChemicalPurchase = async (id: string) => {
    try {
        await deleteDoc(doc(db, "chemical_purchases", id));
    } catch (e) {
        console.error("Error deleting chemical purchase:", e);
    }
}

export const updateChemicalStock = async (newStock: ChemicalStock) => {
    try {
        await setDoc(doc(db, "chemical_stock", "main"), newStock);
    } catch (e) {
        console.error("Error updating stock:", e);
    }
}

export const ensurePartyExists = async (parties: Party[], name: string): Promise<string> => {
  const existing = parties.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;

  const newId = `p-${Date.now()}`;
  const newParty: Party = { id: newId, name: name, contact: '', address: '' };
  await saveParty(newParty);
  return newId;
};

export const syncAllDataToCloud = async (data: AppData, onProgress: (current: number, total: number) => void) => {
    if (!GOOGLE_SHEET_URL) {
        alert("Google Sheet URL is missing! Please Configure in Setup.");
        return;
    }
    
    // Combine ALL items: Dispatches, Challans, Slitting Jobs AND Plans
    const items = [
        ...data.dispatches.map(d => ({ type: 'JOB', data: d })),
        ...data.challans.map(c => ({ type: 'BILL', data: c })),
        ...data.slittingJobs.map(s => ({ type: 'SLITTING', data: s })),
        ...data.productionPlans.map(p => ({ type: 'PLAN', data: p })) // Added Plans
    ];

    const total = items.length;
    console.log(`Starting Batch Sync for ${total} items...`);

    for (let i = 0; i < total; i++) {
        const item = items[i];
        onProgress(i + 1, total);
        
        let payload: any = {};
        
        if (item.type === 'JOB') {
            const d = item.data as DispatchEntry;
            const pName = data.parties.find(p => p.id === d.partyId)?.name || "Unknown";
            payload.type = 'JOB';
            payload.dispatchNo = d.dispatchNo;
            payload.date = d.date;
            payload.partyName = pName;
            payload.rows = d.rows.map(r => ({ ...r, size: r.size, sizeType: r.sizeType, micron: r.micron }));
        } else if (item.type === 'BILL') {
            const c = item.data as Challan;
            const pName = data.parties.find(p => p.id === c.partyId)?.name || "Unknown";
            payload.type = 'BILL';
            payload.date = c.date;
            payload.challanNumber = c.challanNumber;
            payload.partyName = pName;
            payload.paymentMode = c.paymentMode;
            payload.lines = c.lines.map(l => ({ ...l, size: l.size, sizeType: l.sizeType, micron: l.micron }));
        } else if (item.type === 'SLITTING') {
            const s = item.data as SlittingJob;
            const flatRows = s.rows.map(row => {
                const coil = s.coils.find(c => c.id === row.coilId);
                return {
                    srNo: row.srNo,
                    size: coil ? coil.size : row.size,
                    grossWeight: row.grossWeight,
                    coreWeight: row.coreWeight,
                    netWeight: row.netWeight,
                    meter: row.meter,
                    micron: s.planMicron
                };
            });
            payload = {
                type: 'SLITTING_JOB',
                id: s.id,
                jobNo: s.jobNo,
                date: s.date,
                jobCode: s.jobCode,
                status: s.status,
                planQty: s.planQty,
                planMicron: s.planMicron,
                rows: flatRows
            };
        } else if (item.type === 'PLAN') {
            const p = item.data as ProductionPlan;
            payload = {
                type: 'PLAN',
                id: p.id,
                date: p.date,
                partyName: p.partyName,
                planType: p.type,
                size: p.size,
                printName: p.printName,
                micron: p.micron,
                weight: p.weight,
                meter: p.meter,
                cuttingSize: p.cuttingSize,
                pcs: p.pcs,
                notes: p.notes,
                status: p.status
            };
        }

        try {
            await fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            await new Promise(resolve => setTimeout(resolve, 800)); 
        } catch (e) {
            console.error("Sync error for item:", item, e);
        }
    }
};

export const triggerDashboardSetup = async () => {
    if (!GOOGLE_SHEET_URL) {
        alert("Please setup the Google Sheet URL first in 'Setup & Instructions'");
        return;
    }
    console.log("Triggering Dashboard Setup...");
    try {
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'SETUP_DASHBOARD' })
        });
        alert("Dashboard Create Request Sent! Check your Google Sheet in 10 seconds.");
    } catch (e) {
        console.error("Failed to trigger setup", e);
        alert("Failed to contact Google Script");
    }
};

export const getAppData = () => ({ parties: [], dispatches: [], challans: [], slittingJobs: [], productionPlans: [], chemicalLogs: [], chemicalPurchases: [], chemicalStock: { dop:0, stabilizer:0, epoxy:0, g161:0, nbs:0 } });
export const saveAppData = () => {};
