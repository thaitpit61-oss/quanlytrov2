import { supabase } from './supabaseClient';
import { DatabaseRoom, DatabaseMonthlyRecord, DatabaseSettings } from './supabaseTypes';

/*
SQL Schema for Supabase:

-- Create rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  default_rent NUMERIC DEFAULT 0,
  default_trash NUMERIC DEFAULT 0,
  default_internet NUMERIC DEFAULT 0,
  tenant_name TEXT DEFAULT '',
  tenant_id TEXT DEFAULT '',
  tenant_phone TEXT DEFAULT '',
  is_occupied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create monthly_records table
CREATE TABLE monthly_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  elec_old NUMERIC DEFAULT 0,
  elec_new NUMERIC DEFAULT 0,
  water_old NUMERIC DEFAULT 0,
  water_new NUMERIC DEFAULT 0,
  elec_price NUMERIC DEFAULT 0,
  water_price NUMERIC DEFAULT 0,
  rent NUMERIC DEFAULT 0,
  trash NUMERIC DEFAULT 0,
  internet NUMERIC DEFAULT 0,
  debt NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, month, year)
);

-- Create settings table
CREATE TABLE settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  global_elec_price NUMERIC DEFAULT 3500,
  global_water_price NUMERIC DEFAULT 15000,
  global_trash_price NUMERIC DEFAULT 20000,
  global_internet_price NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO settings (id, global_elec_price, global_water_price, global_trash_price, global_internet_price)
VALUES (1, 3500, 15000, 20000, 0)
ON CONFLICT (id) DO NOTHING;
*/

export const roomService = {
  async getRooms() {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data as DatabaseRoom[];
  },

  async createRoom(room: Omit<DatabaseRoom, 'id' | 'created_at'>) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('rooms')
      .insert([room])
      .select()
      .single();
    if (error) throw error;
    return data as DatabaseRoom;
  },

  async updateRoom(id: string, room: Partial<DatabaseRoom>) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('rooms')
      .update(room)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as DatabaseRoom;
  },

  async deleteRoom(id: string) {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

export const settingsService = {
  async getSettings() {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
    return data as DatabaseSettings | null;
  },

  async updateSettings(settings: Partial<DatabaseSettings>) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('settings')
      .upsert({ id: 1, ...settings, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data as DatabaseSettings;
  }
};

export const recordService = {
  async getMonthlyRecords(month: number, year: number) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('monthly_records')
      .select('*')
      .eq('month', month)
      .eq('year', year);
    if (error) throw error;
    return data as DatabaseMonthlyRecord[];
  },

  async upsertMonthlyRecord(record: DatabaseMonthlyRecord) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('monthly_records')
      .upsert(record, { onConflict: 'room_id, month, year' })
      .select()
      .single();
    if (error) throw error;
    return data as DatabaseMonthlyRecord;
  },

  async deleteMonthlyRecord(roomId: string, month: number, year: number) {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('monthly_records')
      .delete()
      .eq('room_id', roomId)
      .eq('month', month)
      .eq('year', year);
    if (error) throw error;
  }
};
