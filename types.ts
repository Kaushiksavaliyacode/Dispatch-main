

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER'
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

export interface Party {
  id: string;
  name: string;
  contact: string;
  address: string;
}

export interface AppData {
  parties: Party[];
  dispatches: DispatchEntry[];
  challans: Challan[];
  settings?: {
      googleSheetUrl?: string;
  };
}