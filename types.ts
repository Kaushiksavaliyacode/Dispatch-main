
export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export enum DispatchStatus {
  PENDING = 'PENDING',
  LOADING = 'LOADING', // Maps to 'RUNNING' in UI
  COMPLETED = 'COMPLETED',
  DISPATCHED = 'DISPATCHED'
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
  weight: number;
  pcs: number; 
  bundle: string;
  status: DispatchStatus; // New granular status
  isCompleted: boolean; // Deprecated but kept for compatibility
  isLoaded: boolean;    // Deprecated but kept for compatibility
}

export interface DispatchEntry {
  id: string;
  dispatchNo: string;
  date: string;
  partyId: string;
  status: DispatchStatus; // Aggregate status
  rows: DispatchRow[];
  totalWeight: number;
  totalPcs: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChallanLine {
  id: string;
  size: string;
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
}
