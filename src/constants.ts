import { Room, MonthlyData, MonthlyRecord } from './types';

export const DEFAULT_ELE_PRICE = 3500;
export const DEFAULT_WAT_PRICE = 15000;
export const DEFAULT_TRA_PRICE = 20000;
export const DEFAULT_INT_PRICE = 0;

export const INITIAL_ROOMS = [
  {
    name: 'P1(bút dù)',
    defaultRent: 1200000,
    defaultTrash: 20000,
    defaultInternet: 0,
    tenantName: 'Bút dù',
    tenantId: '095083005304',
    tenantPhone: '906287227',
    isOccupied: true,
    elecOld: 6240,
    waterOld: 825,
  },
  {
    name: 'P2(anh Sang)',
    defaultRent: 1000000,
    defaultTrash: 20000,
    defaultInternet: 0,
    tenantName: 'Sang',
    tenantId: '095083005305',
    tenantPhone: '906287228',
    isOccupied: true,
    elecOld: 4177,
    waterOld: 967,
  },
  {
    name: 'P3(cửa cuốn)',
    defaultRent: 2000000,
    defaultTrash: 20000,
    defaultInternet: 0,
    tenantName: 'Ngô Minh Hiếu',
    tenantId: '095083005306',
    tenantPhone: '906287229',
    isOccupied: true,
    elecOld: 3182,
    waterOld: 254,
  },
  {
    name: 'P4(tạp hóa)',
    defaultRent: 2300000,
    defaultTrash: 20000,
    defaultInternet: 0,
    tenantName: 'Tạp hóa',
    tenantId: '095083005307',
    tenantPhone: '906287230',
    isOccupied: true,
    elecOld: 16919,
    waterOld: 1351,
  },
  {
    name: 'P5(inox)',
    defaultRent: 9000000,
    defaultTrash: 40000,
    defaultInternet: 0,
    tenantName: 'Inox',
    tenantId: '095083005308',
    tenantPhone: '0906287231',
    isOccupied: true,
    elecOld: 0,
    waterOld: 41,
  },
  {
    name: 'P6(có nắp)',
    defaultRent: 0,
    defaultTrash: 0,
    defaultInternet: 0,
    tenantName: 'Có nắp',
    tenantId: '',
    tenantPhone: '',
    isOccupied: true,
    elecOld: 10116,
    waterOld: 3066,
  },
];

export const createEmptyRecord = (room: Room): MonthlyRecord => ({
  elecOld: 0,
  elecNew: 0,
  waterOld: 0,
  waterNew: 0,
  elecPrice: DEFAULT_ELE_PRICE,
  waterPrice: DEFAULT_WAT_PRICE,
  rent: room.defaultRent,
  trash: room.defaultTrash,
  internet: room.defaultInternet,
  debt: 0,
  notes: '',
  isPaid: false
});
