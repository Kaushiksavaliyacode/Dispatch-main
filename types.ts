
export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
  SLITTING = 'SLITTING',
  CHEMICAL = 'CHEMICAL'
}

export enum DispatchStatus {
  PENDING = 'PENDING',
  PRINTING = 'PRINTING',
  SLITTING = 'SLITTING',
  CUTTING = 'CUTTING',
  COMPLETED = 'COMPLETED',
  DISPATCHED = 'DISPATCHED',
  LOADING = 'LOADING' // Kept for backward compatibility with old records only
}

export enum PaymentMode {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL'
}

export interface DispatchRow {
  id: string;
  planId?: string; // Link to ProductionPlan for cascade updates
  size: string;
  sizeType?: string; // INTAS, OPEN, etc.
  micron?: number;   // New Field for Google Sheet
  weight: number;
  pcs: number; 
  bundle: number; 
  status: DispatchStatus; 
  isCompleted: boolean; 
  isLoaded: boolean;    
  productionWeight?: number; 
  wastage?: number;          
}

export interface DispatchEntry {
  id: string;
  dispatchNo: string;
  date: string;
  partyId: string;
  status: DispatchStatus; 
  rows: DispatchRow[];
  totalWeight: number;
  totalPcs: number;
  isTodayDispatch?: boolean; 
  createdAt: string;
  updatedAt: string;
}

export interface ChallanLine {
  id: string;
  size: string;
  sizeType?: string; // Added Type for consistency
  micron?: number; 
  weight: number;
  rate: number; 
  amount: number;
}

export interface Challan {
  id: string;
  challanNumber: string;
  partyId: string;
  date: string;
  lines: ChallanLine[];
  totalWeight: number;
  totalAmount: number;
  paymentMode: PaymentMode;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// --- PLANNING MODULE TYPES ---

export interface ProductionPlan {
  id: string;
  date: string;
  partyName: string; // Storing name directly for ease, or link to PartyId
  size: string;
  type: string; // Added Type field
  printName?: string; // NEW: Specific for Printing Type
  weight: number;
  micron: number;
  meter: number; // Calculated
  cuttingSize: number;
  pcs: number; // Calculated
  notes?: string;
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
}

// --- SLITTING MODULE TYPES ---

export interface SlittingProductionRow {
  id: string;
  coilId: string; // Link to specific Coil
  srNo: number;
  size: string;
  meter: number;
  micron: number;
  grossWeight: number;
  coreWeight: number;
  netWeight: number; // Calculated
}

export interface SlittingCoil {
  id: string;
  number: number; // 1, 2, 3...
  size: string;
  rolls: number;
  producedBundles?: number; // Added field for tracking bundles per coil
}

export interface SlittingJob {
  id: string;
  // Admin Plan Fields
  date: string;
  jobNo: string;
  jobCode: string;
  
  // Dynamic Coils (Replaces fixed planSize1, planSize2)
  coils: SlittingCoil[];

  planMicron: number;
  planQty: number;
  planRollLength: number;
  
  // Production Data
  rows: SlittingProductionRow[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
}

// --- CHEMICAL MODULE TYPES ---

export type ChemicalPlant = '65mm' | '45mm' | 'Jumbo';

export interface ChemicalLog {
  id: string;
  date: string;
  plant: ChemicalPlant;
  dop: number;
  stabilizer: number;
  epoxy: number;
  g161?: number; // Not for 45mm
  nbs: number;
  createdAt: string;
}

export interface ChemicalStock {
  dop: number;
  stabilizer: number;
  epoxy: number;
  g161: number;
  nbs: number;
}

export interface ChemicalPurchase {
  id: string;
  date: string;
  chemical: keyof ChemicalStock;
  quantity: number;
  createdAt: string;
}

export interface Party {
  id: string;
  name: string;
  code?: string; // Added for REL/XXX
  contact: string;
  address: string;
}

export interface AppData {
  parties: Party[];
  dispatches: DispatchEntry[];
  challans: Challan[];
  slittingJobs: SlittingJob[];
  productionPlans: ProductionPlan[]; // NEW
  chemicalLogs: ChemicalLog[];
  chemicalStock: ChemicalStock;
  chemicalPurchases: ChemicalPurchase[];
  settings?: {
      googleSheetUrl?: string;
  };
}
