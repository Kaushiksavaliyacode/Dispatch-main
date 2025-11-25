
import { AppData, DispatchStatus, PaymentMode, Party, DispatchEntry, Challan } from '../types';

const STORAGE_KEY = 'dispatch_flow_data_v2';

const MOCK_PARTIES: Party[] = [
  { id: 'p1', name: 'Alpha Textiles', contact: '555-0101', address: '123 Ind. Estate' },
  { id: 'p2', name: 'Beta Fabrics', contact: '555-0202', address: '456 Loom Rd' },
  { id: 'p3', name: 'Gamma Garments', contact: '555-0303', address: '789 Stitch Ln' },
  { id: 'p4', name: 'Delta Distributors', contact: '555-0404', address: '101 Cargo Way' },
];

const generateMockData = (): AppData => {
  const dispatches: DispatchEntry[] = [];
  const challans: Challan[] = [];
  
  // Generate some past data
  const now = new Date();
  
  for (let i = 0; i < 20; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const party = MOCK_PARTIES[i % MOCK_PARTIES.length];

    // Determine Job Status
    const jobStatus = i < 3 ? DispatchStatus.PENDING : (i < 5 ? DispatchStatus.LOADING : DispatchStatus.DISPATCHED);
    const rowStatus = jobStatus; // For mock, sync rows with job

    // Dispatch
    dispatches.push({
      id: `d-${i}`,
      dispatchNo: `DSP-${1000 + i}`,
      date: dateStr,
      partyId: party.id,
      status: jobStatus,
      rows: [
        { id: `r-${i}-1`, size: '1200mm', weight: 50 + i, pcs: 10, bundle: 'Roll', status: rowStatus, isCompleted: true, isLoaded: i > 5 },
        { id: `r-${i}-2`, size: '1400mm', weight: 70 + i, pcs: 15, bundle: 'Pallet', status: rowStatus, isCompleted: true, isLoaded: i > 5 },
      ],
      totalWeight: 120 + (i * 2),
      totalPcs: 25,
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
    });

    // Challan (some missing for alerts)
    if (i % 3 !== 0) {
      challans.push({
        id: `c-${i}`,
        challanNumber: `CH-${5000 + i}`,
        partyId: party.id,
        date: dateStr,
        lines: [
          { id: `l-${i}-1`, size: '1200mm', weight: 50 + i, rate: 2.5, amount: (50 + i) * 2.5 },
        ],
        totalWeight: 50 + i,
        totalAmount: (50 + i) * 2.5,
        paymentMode: i % 4 === 0 ? PaymentMode.UNPAID : PaymentMode.CASH,
        createdAt: date.toISOString(),
      });
    }
  }

  return {
    parties: MOCK_PARTIES,
    dispatches,
    challans
  };
};

export const getAppData = (): AppData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  const initial = generateMockData();
  saveAppData(initial);
  return initial;
};

export const saveAppData = (data: AppData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const createBackup = (): string => {
  const data = getAppData();
  return JSON.stringify(data, null, 2);
};

export const restoreBackup = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString) as AppData;
    // Basic validation
    if (Array.isArray(data.parties) && Array.isArray(data.dispatches) && Array.isArray(data.challans)) {
      saveAppData(data);
      return true;
    }
    return false;
  } catch (e) {
    console.error("Failed to restore data", e);
    return false;
  }
};
