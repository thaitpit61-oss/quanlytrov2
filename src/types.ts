export interface Room {
  id: string;
  name: string;
  defaultRent: number;
  defaultTrash: number;
  defaultInternet: number;
  tenantName: string;
  tenantId: string;
  tenantPhone: string;
  isOccupied: boolean;
}

export interface MonthlyRecord {
  elecOld: number;
  elecNew: number;
  waterOld: number;
  waterNew: number;
  elecPrice: number;
  waterPrice: number;
  rent: number;
  trash: number;
  internet: number;
  debt: number;
  notes: string;
  isPaid: boolean;
}

export interface MonthlyData {
  month: number; // 1-12
  year: number;
  records: Record<string, MonthlyRecord>; // roomId -> record
}

export interface AppData {
  rooms: Room[];
  history: MonthlyData[];
}
