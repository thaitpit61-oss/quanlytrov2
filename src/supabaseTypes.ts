export interface DatabaseRoom {
  id: string;
  name: string;
  default_rent: number;
  default_trash: number;
  default_internet: number;
  tenant_name: string;
  tenant_id: string;
  tenant_phone: string;
  is_occupied: boolean;
  created_at?: string;
}

export interface DatabaseMonthlyRecord {
  id?: string;
  room_id: string;
  month: number;
  year: number;
  elec_old: number;
  elec_new: number;
  water_old: number;
  water_new: number;
  elec_price: number;
  water_price: number;
  rent: number;
  trash: number;
  internet: number;
  debt: number;
  notes: string;
  is_paid: boolean;
  created_at?: string;
}

export interface DatabaseSettings {
  id: number;
  global_elec_price: number;
  global_water_price: number;
  global_trash_price: number;
  global_internet_price: number;
  updated_at?: string;
}
