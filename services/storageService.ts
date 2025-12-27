
import { db } from './firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  query, 
  getDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { AppData, DispatchEntry, Challan, Party, SlittingJob, ChemicalLog, ChemicalStock, ChemicalPurchase, ProductionPlan, PlantProductionPlan } from '../types';

/**
 * PERMANENT DEPLOYMENT LINK
 */
const PERMANENT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjB3X1iYIeLhYhS8B3X1iYI/exec";

let GOOGLE_SHEET_URL = localStorage.getItem('rdms_sheet_url') || PERMANENT_SCRIPT_URL;

export const setGoogleSheetUrl = (url: string) => {
    GOOGLE_SHEET_URL = url.trim();
    localStorage.setItem('rdms_sheet_url', GOOGLE_SHEET_URL);
};

export const getGoogleSheetUrl = () => GOOGLE_SHEET_URL;

/**
 * ROBUST CIRCULAR-SAFE DATA SANITIZER
 * Creates a deep copy of the object, removing circular references and non-serializable values.
 */
const sanitize = (obj: any): any => {
  const seen = new WeakSet();
  
  const recursiveSanitize = (val: any): any => {
    // 1. Handle Primitives & Null
    if (val === null || typeof val !== 'object') {
      return val;
    }
    
    // 2. Detect Circular Reference
    if (seen.has(val)) {
      return null;
    }
    seen.add(val);

    // 3. Handle Dates
    if (val instanceof Date) {
      return val.toISOString();
    }

    // 4. Handle Arrays
    if (Array.isArray(val)) {
      return val.map(item => recursiveSanitize(item));
    }

    // 5. Handle Objects
    const clean: any = {};
    // Iterate over own enumerable properties
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        // Skip internal or private keys often used by frameworks
        if (key.startsWith('_') || key === 'nativeEvent' || key === 'view' || key === 'sourceCapabilities') continue;
        
        const safeVal = recursiveSanitize(val[key]);
        if (safeVal !== undefined && typeof safeVal !== 'function') {
          clean[key] = safeVal;
        }
      }
    }
    return clean;
  };

  return recursiveSanitize(obj);
};

export const subscribeToData = (onDataChange: (data: AppData) => void) => {
  const localData: AppData = { 
      parties: [], dispatches: [], challans: [], slittingJobs: [], 
      productionPlans: [], 
      plantProductionPlans: [],
      chemicalLogs: [], chemicalStock: { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 },
      chemicalPurchases: [] 
  };
  
  let partiesLoaded = false;
  let dispatchesLoaded = false;
  let challansLoaded = false;
  let slittingLoaded = false;
  let plansLoaded = false;
  let plantPlansLoaded = false;
  let chemicalsLoaded = false;
  let stockLoaded = false;
  let purchasesLoaded = false;

  const checkLoad = () => {
    if (partiesLoaded && dispatchesLoaded && challansLoaded && slittingLoaded && plansLoaded && plantPlansLoaded && chemicalsLoaded && stockLoaded && purchasesLoaded) {
      onDataChange({ ...localData });
    }
  };

  const handleError = (context: string, err: any) => {
      console.error(`Firebase Sync Error (${context}):`, err);
      return true; 
  };

  const unsubParties = onSnapshot(collection(db, "parties"), (snapshot) => {
    localData.parties = snapshot.docs.map(doc => doc.data() as Party);
    partiesLoaded = true;
    checkLoad();
  }, (err) => { partiesLoaded = handleError('Parties', err); checkLoad(); });

  const unsubDispatches = onSnapshot(query(collection(db, "dispatches")), (snapshot) => {
    localData.dispatches = snapshot.docs.map(doc => doc.data() as DispatchEntry)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    dispatchesLoaded = true;
    checkLoad();
  }, (err) => { dispatchesLoaded = handleError('Dispatches', err); checkLoad(); });

  const unsubChallans = onSnapshot(query(collection(db, "challans")), (snapshot) => {
    localData.challans = snapshot.docs.map(doc => doc.data() as Challan)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    challansLoaded = true;
    checkLoad();
  }, (err) => { challansLoaded = handleError('Challans', err); checkLoad(); });

  const unsubSlitting = onSnapshot(query(collection(db, "slitting_jobs")), (snapshot) => {
    localData.slittingJobs = snapshot.docs.map(doc => doc.data() as SlittingJob)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    slittingLoaded = true;
    checkLoad();
  }, (err) => { slittingLoaded = handleError('Slitting', err); checkLoad(); });

  const unsubPlans = onSnapshot(query(collection(db, "production_plans")), (snapshot) => {
    localData.productionPlans = snapshot.docs.map(doc => doc.data() as ProductionPlan)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    plansLoaded = true;
    checkLoad();
  }, (err) => { plansLoaded = handleError('Plans', err); checkLoad(); });

  const unsubPlantPlans = onSnapshot(query(collection(db, "plant_production_plans")), (snapshot) => {
    localData.plantProductionPlans = snapshot.docs.map(doc => doc.data() as PlantProductionPlan)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    plantPlansLoaded = true;
    checkLoad();
  }, (err) => { plantPlansLoaded = handleError('PlantPlans', err); checkLoad(); });

  const unsubChemicals = onSnapshot(query(collection(db, "chemical_logs")), (snapshot) => {
    localData.chemicalLogs = snapshot.docs.map(doc => doc.data() as ChemicalLog)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    chemicalsLoaded = true;
    checkLoad();
  }, (err) => { chemicalsLoaded = handleError('Chemicals', err); checkLoad(); });

  const unsubPurchases = onSnapshot(query(collection(db, "chemical_purchases")), (snapshot) => {
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
    unsubParties(); unsubDispatches(); unsubChallans(); unsubSlitting();
    unsubPlans(); unsubPlantPlans(); unsubChemicals(); unsubPurchases(); unsubStock();
  };
};

const syncToSheet = async (payload: any) => {
    if (!GOOGLE_SHEET_URL) return;
    try {
        // Sanitize first to remove any circular references or DOM events
        const sanitized = sanitize(payload);
        const safePayload = JSON.stringify(sanitized);
        
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: safePayload
        });
    } catch (e) {
        console.error("Sheet Sync Error:", e);
    }
};

export const saveParty = async (party: Party) => {
  await setDoc(doc(db, "parties", party.id), sanitize(party));
};

export const updateParty = async (party: Party) => {
  await updateDoc(doc(db, "parties", party.id), sanitize(party));
};

export const deleteParty = async (id: string) => {
  await deleteDoc(doc(db, "parties", id));
};

export const saveDispatch = async (dispatch: DispatchEntry) => {
  try {
    await setDoc(doc(db, "dispatches", dispatch.id), sanitize(dispatch));
    const pDoc = await getDoc(doc(db, "parties", dispatch.partyId));
    const pName = pDoc.exists() ? pDoc.data().name : "Unknown";

    syncToSheet({
        type: 'JOB',
        dispatchNo: String(dispatch.dispatchNo), 
        date: dispatch.date,
        partyName: pName,
        rows: dispatch.rows
    });
  } catch (e) { console.error("Save Dispatch Error:", e); }
};

export const deleteDispatch = async (id: string) => {
  const docSnap = await getDoc(doc(db, "dispatches", id));
  const dNo = docSnap.exists() ? (docSnap.data() as DispatchEntry).dispatchNo : null;
  await deleteDoc(doc(db, "dispatches", id));
  if (dNo) syncToSheet({ type: 'DELETE_JOB', dispatchNo: String(dNo) });
};

export const saveChallan = async (challan: Challan) => {
  try {
    await setDoc(doc(db, "challans", challan.id), sanitize(challan));
    const pDoc = await getDoc(doc(db, "parties", challan.partyId));
    const pName = pDoc.exists() ? pDoc.data().name : "Unknown";

    syncToSheet({
        type: 'BILL',
        date: challan.date,
        challanNumber: String(challan.challanNumber), 
        partyName: pName,
        paymentMode: challan.paymentMode,
        lines: challan.lines
    });
  } catch (e) { console.error(e); }
};

export const deleteChallan = async (id: string) => {
  const docSnap = await getDoc(doc(db, "challans", id));
  const cNo = docSnap.exists() ? (docSnap.data() as Challan).challanNumber : null;
  await deleteDoc(doc(db, "challans", id));
  if (cNo) syncToSheet({ type: 'DELETE_BILL', challanNumber: String(cNo) });
};

export const saveSlittingJob = async (job: SlittingJob) => {
  try {
    await setDoc(doc(db, "slitting_jobs", job.id), sanitize(job));
    const flatRows = job.rows.map(row => {
        const coil = job.coils.find(c => c.id === row.coilId);
        return {
            srNo: row.srNo,
            size: coil ? coil.size : row.size,
            grossWeight: row.grossWeight,
            coreWeight: row.coreWeight,
            netWeight: row.netWeight,
            meter: row.meter,
            micron: job.planMicron
        };
    });

    syncToSheet({
        type: 'SLITTING_JOB',
        jobNo: String(job.jobNo),
        date: job.date,
        jobCode: job.jobCode,
        status: job.status,
        planQty: job.planQty,
        planMicron: job.planMicron,
        rows: flatRows
    });
  } catch (e) { console.error(e); }
};

export const deleteSlittingJob = async (id: string) => {
  const docSnap = await getDoc(doc(db, "slitting_jobs", id));
  const jNo = docSnap.exists() ? (docSnap.data() as SlittingJob).jobNo : null;
  await deleteDoc(doc(db, "slitting_jobs", id));
  if (jNo) syncToSheet({ type: 'DELETE_SLITTING_JOB', jobNo: String(jNo) });
};

export const saveProductionPlan = async (plan: ProductionPlan) => {
  try {
    await setDoc(doc(db, "production_plans", plan.id), sanitize(plan));
    syncToSheet({
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
    });
  } catch (e) { console.error(e); }
};

export const updateProductionPlan = async (plan: Partial<ProductionPlan> & { id: string }) => {
    await updateDoc(doc(db, "production_plans", plan.id), sanitize(plan));
};

export const deleteProductionPlan = async (id: string) => {
  await deleteDoc(doc(db, "production_plans", id));
  syncToSheet({ type: 'DELETE_PLAN', id: id });
};

export const savePlantPlan = async (plan: PlantProductionPlan) => {
  try {
    await setDoc(doc(db, "plant_production_plans", plan.id), sanitize(plan));
    syncToSheet({
        type: 'PLANT_PLAN',
        ...plan
    });
  } catch (e) { console.error(e); }
};

export const updatePlantPlan = async (plan: Partial<PlantProductionPlan> & { id: string }) => {
    await updateDoc(doc(db, "plant_production_plans", plan.id), sanitize(plan));
};

export const deletePlantPlan = async (id: string) => {
  await deleteDoc(doc(db, "plant_production_plans", id));
  syncToSheet({ type: 'DELETE_PLANT_PLAN', id: id });
};

export const saveChemicalLog = async (log: ChemicalLog) => {
    await setDoc(doc(db, "chemical_logs", log.id), sanitize(log));
    syncToSheet({ type: 'CHEMICAL_LOG', ...log });
};

export const saveChemicalPurchase = async (purchase: ChemicalPurchase) => {
    await setDoc(doc(db, "chemical_purchases", purchase.id), sanitize(purchase));
    syncToSheet({ type: 'CHEMICAL_PURCHASE', ...purchase });
};

export const deleteChemicalPurchase = async (id: string) => {
    await deleteDoc(doc(db, "chemical_purchases", id));
    syncToSheet({ type: 'DELETE_CHEMICAL_PURCHASE', id: id });
};

export const updateChemicalStock = async (newStock: ChemicalStock) => {
    await setDoc(doc(db, "chemical_stock", "main"), sanitize(newStock));
    syncToSheet({ type: 'CHEMICAL_STOCK', stock: newStock });
};

export const ensurePartyExists = async (parties: Party[], name: string): Promise<string> => {
  const existing = parties.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const newId = `p-${Date.now()}`;
  await saveParty({ id: newId, name: name, contact: '', address: '' });
  return newId;
};

export const syncAllDataToCloud = async (data: AppData, onProgress: (current: number, total: number) => void) => {
    if (!GOOGLE_SHEET_URL) return alert("Sheet Connection Missing!");
    
    const items: any[] = [];
    
    data.dispatches.forEach(d => items.push({ type: 'JOB', data: d }));
    data.challans.forEach(c => items.push({ type: 'BILL', data: c }));
    data.slittingJobs.forEach(s => items.push({ type: 'SLITTING_JOB', data: s }));
    data.productionPlans.forEach(p => items.push({ type: 'PLAN', data: p }));
    data.plantProductionPlans.forEach(p => items.push({ type: 'PLANT_PLAN', data: p }));
    data.chemicalLogs.forEach(l => items.push({ type: 'CHEMICAL_LOG', data: l }));
    data.chemicalPurchases.forEach(p => items.push({ type: 'CHEMICAL_PURCHASE', data: p }));

    const total = items.length;
    for (let i = 0; i < total; i++) {
        const item = items[i];
        onProgress(i + 1, total);
        
        let payload: any = { type: item.type };
        if (item.type === 'JOB') {
            const d = item.data as DispatchEntry;
            const pName = data.parties.find(p => p.id === d.partyId)?.name || "Unknown";
            payload = { ...payload, dispatchNo: String(d.dispatchNo), date: d.date, partyName: pName, rows: d.rows };
        } else if (item.type === 'BILL') {
            const c = item.data as Challan;
            const pName = data.parties.find(p => p.id === c.partyId)?.name || "Unknown";
            payload = { ...payload, date: c.date, challanNumber: String(c.challanNumber), partyName: pName, paymentMode: c.paymentMode, lines: c.lines };
        } else if (item.type === 'SLITTING_JOB') {
            const s = item.data as SlittingJob;
            const flatRows = s.rows.map(row => ({
                srNo: row.srNo,
                size: s.coils.find(c => c.id === row.coilId)?.size || row.size,
                grossWeight: row.grossWeight,
                coreWeight: row.coreWeight,
                netWeight: row.netWeight,
                meter: row.meter,
                micron: s.planMicron
            }));
            payload = { ...payload, jobNo: String(s.jobNo), date: s.date, jobCode: s.jobCode, status: s.status, planQty: s.planQty, planMicron: s.planMicron, rows: flatRows };
        } else if (item.type === 'PLAN') {
            const p = item.data as ProductionPlan;
            payload = { ...payload, ...p, planType: p.type };
        } else if (item.type === 'PLANT_PLAN') {
            payload = { ...payload, ...item.data };
        } else if (item.type === 'CHEMICAL_LOG') {
            payload = { ...payload, ...item.data };
        } else if (item.type === 'CHEMICAL_PURCHASE') {
            payload = { ...payload, ...item.data };
        }

        await syncToSheet(payload);
        await new Promise(r => setTimeout(r, 150)); 
    }
    
    await updateChemicalStock(data.chemicalStock);
};

export const triggerDashboardSetup = async () => {
    if (!GOOGLE_SHEET_URL) return alert("Sheet Connection Missing!");
    await syncToSheet({ type: 'SETUP_DASHBOARD' });
};

/**
 * FULL DATABASE RESTORE (Optimized with Batched Writes)
 */
export const restoreFullBackup = async (backupData: AppData, onProgress: (step: string, current: number, total: number) => void) => {
    const collections = [
        { key: 'parties', name: 'parties' },
        { key: 'dispatches', name: 'dispatches' },
        { key: 'challans', name: 'challans' },
        { key: 'slittingJobs', name: 'slitting_jobs' },
        { key: 'productionPlans', name: 'production_plans' },
        { key: 'plantProductionPlans', name: 'plant_production_plans' },
        { key: 'chemicalLogs', name: 'chemical_logs' },
        { key: 'chemicalPurchases', name: 'chemical_purchases' }
    ];

    for (const coll of collections) {
        const items = (backupData as any)[coll.key] || [];
        const total = items.length;
        
        // Use chunks of 500 (Firestore limit)
        for (let i = 0; i < total; i += 500) {
            const batch = writeBatch(db);
            const chunk = items.slice(i, i + 500);
            
            chunk.forEach((item: any) => {
                const docRef = doc(db, coll.name, item.id);
                batch.set(docRef, sanitize(item));
                onProgress(coll.key, i + chunk.indexOf(item) + 1, total);
            });
            
            await batch.commit();
        }
    }

    if (backupData.chemicalStock) {
        onProgress('stock', 1, 1);
        await updateChemicalStock(backupData.chemicalStock);
    }
};
