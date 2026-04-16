/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Save, 
  Printer, 
  Camera,
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Settings, 
  Users, 
  Home, 
  DollarSign,
  FileText,
  X,
  Edit2,
  Calendar,
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as htmlToImage from 'html-to-image';
import { Room, MonthlyData, MonthlyRecord } from './types';
import { INITIAL_ROOMS, createEmptyRecord, DEFAULT_ELE_PRICE, DEFAULT_WAT_PRICE } from './constants';
import { roomService, settingsService, recordService } from './supabaseService';
import { DatabaseRoom, DatabaseMonthlyRecord } from './supabaseTypes';
import { isSupabaseConfigured } from './supabaseClient';

// --- Utilities ---
const mapRoomToDb = (room: Room): any => ({
  name: room.name,
  default_rent: room.defaultRent,
  default_trash: room.defaultTrash,
  default_internet: room.defaultInternet,
  tenant_name: room.tenantName,
  tenant_id: room.tenantId,
  tenant_phone: room.tenantPhone,
  is_occupied: room.isOccupied,
});

const mapDbToRoom = (dbRoom: DatabaseRoom): Room => ({
  id: dbRoom.id,
  name: dbRoom.name,
  defaultRent: dbRoom.default_rent,
  defaultTrash: dbRoom.default_trash,
  defaultInternet: dbRoom.default_internet,
  tenantName: dbRoom.tenant_name,
  tenantId: dbRoom.tenant_id,
  tenantPhone: dbRoom.tenant_phone,
  isOccupied: dbRoom.is_occupied,
});

const mapRecordToDb = (roomId: string, month: number, year: number, record: MonthlyRecord): DatabaseMonthlyRecord => ({
  room_id: roomId,
  month,
  year,
  elec_old: record.elecOld,
  elec_new: record.elecNew,
  water_old: record.waterOld,
  water_new: record.waterNew,
  elec_price: record.elecPrice,
  water_price: record.waterPrice,
  rent: record.rent,
  trash: record.trash,
  internet: record.internet,
  debt: record.debt,
  notes: record.notes,
  is_paid: record.isPaid,
});

const mapDbToRecord = (dbRecord: DatabaseMonthlyRecord): MonthlyRecord => ({
  elecOld: dbRecord.elec_old,
  elecNew: dbRecord.elec_new,
  waterOld: dbRecord.water_old,
  waterNew: dbRecord.water_new,
  elecPrice: dbRecord.elec_price,
  waterPrice: dbRecord.water_price,
  rent: dbRecord.rent,
  trash: dbRecord.trash,
  internet: dbRecord.internet,
  debt: dbRecord.debt,
  notes: dbRecord.notes,
  isPaid: dbRecord.is_paid,
});

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const getMonthYearString = (month: number, year: number) => {
  return `Tháng ${month}/${year}`;
};

const calculateTotal = (record: MonthlyRecord) => {
  const elecUsage = Math.max(0, record.elecNew - record.elecOld);
  const waterUsage = Math.max(0, record.waterNew - record.waterOld);
  return (
    elecUsage * record.elecPrice +
    waterUsage * record.waterPrice +
    record.rent +
    record.trash +
    record.internet +
    record.debt
  );
};

const parseSafeNumber = (val: string) => {
  const cleanVal = val.replace(/\./g, '');
  const parsed = parseFloat(cleanVal);
  return isNaN(parsed) ? 0 : parsed;
};

const formatNumberForInput = (val: number) => {
  if (val === 0) return '';
  return val.toLocaleString('vi-VN');
};

export default function App() {
  // --- State ---
  const [rooms, setRooms] = useState<Room[]>([]);
  const [history, setHistory] = useState<MonthlyData[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Partial<Room> | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [globalElecPrice, setGlobalElecPrice] = useState(DEFAULT_ELE_PRICE);
  const [globalWaterPrice, setGlobalWaterPrice] = useState(DEFAULT_WAT_PRICE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };

  // --- Persistence ---
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        
        // Load Rooms
        const dbRooms = await roomService.getRooms();
        let currentRooms: Room[] = [];
        
        if (dbRooms.length === 0) {
          // Initialize with sample data if empty
          for (const room of INITIAL_ROOMS) {
            const created = await roomService.createRoom(mapRoomToDb(room as any));
            currentRooms.push(mapDbToRoom(created));
          }
        } else {
          currentRooms = dbRooms.map(mapDbToRoom);
        }
        setRooms(currentRooms);

        // Load Settings
        const settings = await settingsService.getSettings();
        if (settings) {
          setGlobalElecPrice(settings.global_elec_price);
          setGlobalWaterPrice(settings.global_water_price);
        }

        // Load Records for current month
        const dbRecords = await recordService.getMonthlyRecords(currentMonth, currentYear);
        const recordsMap: Record<string, MonthlyRecord> = {};
        
        if (dbRecords.length === 0) {
          // Create empty records for current month if none exist
          for (const room of currentRooms) {
            const emptyRecord = createEmptyRecord(room);
            const dbRecord = mapRecordToDb(room.id, currentMonth, currentYear, {
              ...emptyRecord,
              elecPrice: settings?.global_elec_price || DEFAULT_ELE_PRICE,
              waterPrice: settings?.global_water_price || DEFAULT_WAT_PRICE,
              isPaid: currentMonth === 3 // Tự động đánh dấu đã thanh toán cho tháng 3
            });
            const created = await recordService.upsertMonthlyRecord(dbRecord);
            recordsMap[room.id] = mapDbToRecord(created);
          }
        } else {
          dbRecords.forEach(r => {
            recordsMap[r.room_id] = mapDbToRecord(r);
          });
        }

        setHistory([{
          month: currentMonth,
          year: currentYear,
          records: recordsMap
        }]);

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Load records when month/year changes
  useEffect(() => {
    const loadMonthlyRecords = async () => {
      if (isLoading) return;
      
      try {
        const dbRecords = await recordService.getMonthlyRecords(currentMonth, currentYear);
        const recordsMap: Record<string, MonthlyRecord> = {};
        
        dbRecords.forEach(r => {
          recordsMap[r.room_id] = mapDbToRecord(r);
        });

        // Ensure all rooms have a record in the map
        for (const room of rooms) {
          if (!recordsMap[room.id]) {
            const emptyRecord = createEmptyRecord(room);
            if (currentMonth === 3) {
              emptyRecord.isPaid = true;
            }
            recordsMap[room.id] = emptyRecord;
          }
        }
        
        setHistory(prev => {
          const exists = prev.find(h => h.month === currentMonth && h.year === currentYear);
          if (exists) {
            return prev.map(h => h.month === currentMonth && h.year === currentYear ? { ...h, records: recordsMap } : h);
          }
          return [...prev, { month: currentMonth, year: currentYear, records: recordsMap }];
        });
      } catch (error) {
        console.error('Error loading monthly records:', error);
      }
    };

    loadMonthlyRecords();
  }, [currentMonth, currentYear]);

  // --- Derived State ---
  const currentMonthlyData = useMemo(() => {
    return history.find(h => h.month === currentMonth && h.year === currentYear);
  }, [history, currentMonth, currentYear]);

  const stats = useMemo(() => {
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.isOccupied).length;
    const vacantRooms = totalRooms - occupiedRooms;
    
    let totalRevenue = 0;
    let totalElec = 0;
    let totalWater = 0;
    let totalRent = 0;

    if (currentMonthlyData) {
      (Object.values(currentMonthlyData.records) as MonthlyRecord[]).forEach(record => {
        const elecUsage = Math.max(0, record.elecNew - record.elecOld);
        const waterUsage = Math.max(0, record.waterNew - record.waterOld);
        
        totalElec += elecUsage * record.elecPrice;
        totalWater += waterUsage * record.waterPrice;
        totalRent += record.rent;
        totalRevenue += calculateTotal(record);
      });
    }

    return { totalRooms, occupiedRooms, vacantRooms, totalRevenue, totalElec, totalWater, totalRent };
  }, [rooms, currentMonthlyData]);

  // Sync global prices with current month's records
  useEffect(() => {
    if (currentMonthlyData) {
      const firstRecord = Object.values(currentMonthlyData.records)[0] as MonthlyRecord | undefined;
      if (firstRecord) {
        setGlobalElecPrice(firstRecord.elecPrice);
        setGlobalWaterPrice(firstRecord.waterPrice);
      }
    }
  }, [currentMonth, currentYear]);

  // --- Handlers ---
  const handleUpdateRecord = (roomId: string, field: keyof MonthlyRecord, value: any) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    setHistory(prev => {
      const exists = prev.find(h => h.month === currentMonth && h.year === currentYear);
      if (exists) {
        return prev.map(h => {
          if (h.month === currentMonth && h.year === currentYear) {
            const currentRecord = h.records[roomId] || createEmptyRecord(room);
            const updatedRecord = { ...currentRecord, [field]: value };
            return {
              ...h,
              records: { ...h.records, [roomId]: updatedRecord }
            };
          }
          return h;
        });
      }
      // If month doesn't exist in history yet, create it
      const newRecords: Record<string, MonthlyRecord> = {};
      rooms.forEach(r => {
        newRecords[r.id] = createEmptyRecord(r);
      });
      newRecords[roomId] = { ...newRecords[roomId], [field]: value };
      return [...prev, { month: currentMonth, year: currentYear, records: newRecords }];
    });
  };

  const handleCaptureInvoice = async () => {
    const element = document.getElementById('invoice-print');
    if (!element) return;

    try {
      // Use toPng from html-to-image which handles modern CSS better
      const dataUrl = await htmlToImage.toPng(element, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      
      const link = document.createElement('a');
      const room = rooms.find(r => r.id === selectedRoomId);
      const fileName = `HoaDon_${room?.name || 'Phong'}_T${currentMonth}_${currentYear}.png`;
      
      link.href = dataUrl;
      link.download = fileName;
      link.click();
    } catch (error) {
      console.error('Error capturing invoice:', error);
    }
  };

  const handleSaveAll = async () => {
    if (!currentMonthlyData || !isSupabaseConfigured) return;
    
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      // Save Settings
      await settingsService.updateSettings({
        global_elec_price: globalElecPrice,
        global_water_price: globalWaterPrice
      });

      // Save Records
      const records = Object.entries(currentMonthlyData.records) as [string, MonthlyRecord][];
      for (const [roomId, record] of records) {
        await recordService.upsertMonthlyRecord(mapRecordToDb(roomId, currentMonth, currentYear, record));
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving data:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateGlobalPrice = (type: 'elec' | 'water', price: number) => {
    if (type === 'elec') setGlobalElecPrice(price);
    else setGlobalWaterPrice(price);

    // Update local state for all records in current month
    setHistory(prev => prev.map(h => {
      if (h.month === currentMonth && h.year === currentYear) {
        const updatedRecords: Record<string, MonthlyRecord> = {};
        Object.keys(h.records).forEach(roomId => {
          updatedRecords[roomId] = {
            ...h.records[roomId],
            [type === 'elec' ? 'elecPrice' : 'waterPrice']: price
          };
        });
        return { ...h, records: updatedRecords };
      }
      return h;
    }));
  };

  const handleCreateNewMonth = async () => {
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    // Check if already exists in history state
    if (history.find(h => h.month === nextMonth && h.year === nextYear)) {
      setCurrentMonth(nextMonth);
      setCurrentYear(nextYear);
      return;
    }

    try {
      // Check DB
      const dbRecords = await recordService.getMonthlyRecords(nextMonth, nextYear);
      if (dbRecords.length > 0) {
        const recordsMap: Record<string, MonthlyRecord> = {};
        dbRecords.forEach(r => {
          recordsMap[r.room_id] = mapDbToRecord(r);
        });
        setHistory(prev => [...prev, { month: nextMonth, year: nextYear, records: recordsMap }]);
        setCurrentMonth(nextMonth);
        setCurrentYear(nextYear);
        return;
      }

      // Create new
      const prevMonthData = currentMonthlyData;
      const newRecords: Record<string, MonthlyRecord> = {};

      for (const room of rooms) {
        const prevRecord = prevMonthData?.records[room.id];
        const recordData: MonthlyRecord = {
          ...createEmptyRecord(room),
          elecOld: prevRecord?.elecNew || 0,
          waterOld: prevRecord?.waterNew || 0,
          elecPrice: prevRecord?.elecPrice || globalElecPrice,
          waterPrice: prevRecord?.waterPrice || globalWaterPrice,
        };
        
        const created = await recordService.upsertMonthlyRecord(mapRecordToDb(room.id, nextMonth, nextYear, recordData));
        newRecords[room.id] = mapDbToRecord(created);
      }

      setHistory(prev => [...prev, { month: nextMonth, year: nextYear, records: newRecords }]);
      setCurrentMonth(nextMonth);
      setCurrentYear(nextYear);
    } catch (error) {
      console.error('Error creating new month:', error);
    }
  };

  const handleAddRoom = async () => {
    const roomData: Omit<Room, 'id'> = {
      name: editingRoom?.name || `Phòng mới`,
      defaultRent: editingRoom?.defaultRent || 0,
      defaultTrash: editingRoom?.defaultTrash || 0,
      defaultInternet: editingRoom?.defaultInternet || 0,
      tenantName: editingRoom?.tenantName || '',
      tenantId: editingRoom?.tenantId || '',
      tenantPhone: editingRoom?.tenantPhone || '',
      isOccupied: editingRoom?.isOccupied ?? !!editingRoom?.tenantName
    };

    try {
      const createdRoom = await roomService.createRoom(mapRoomToDb(roomData as Room));
      const newRoom = mapDbToRoom(createdRoom);
      
      setRooms(prev => [...prev, newRoom]);
      
      // Add record for current month
      const emptyRecord = createEmptyRecord(newRoom);
      const dbRecord = await recordService.upsertMonthlyRecord(mapRecordToDb(newRoom.id, currentMonth, currentYear, {
        ...emptyRecord,
        elecPrice: globalElecPrice,
        waterPrice: globalWaterPrice
      }));
      
      setHistory(prev => prev.map(h => {
        if (h.month === currentMonth && h.year === currentYear) {
          return {
            ...h,
            records: { ...h.records, [newRoom.id]: mapDbToRecord(dbRecord) }
          };
        }
        return h;
      }));

      setIsRoomModalOpen(false);
      setEditingRoom(null);
    } catch (error) {
      console.error('Error adding room:', error);
    }
  };

  const handleUpdateRoom = async () => {
    if (!editingRoom?.id) return;
    
    try {
      const updated = await roomService.updateRoom(editingRoom.id, mapRoomToDb(editingRoom as Room));
      const updatedRoom = mapDbToRoom(updated);
      
      setRooms(prev => prev.map(r => r.id === updatedRoom.id ? updatedRoom : r));

      // Sync with current month's record if it exists
      if (currentMonthlyData?.records[updatedRoom.id]) {
        const currentRecord = currentMonthlyData.records[updatedRoom.id];
        const updatedRecord: MonthlyRecord = {
          ...currentRecord,
          rent: updatedRoom.defaultRent,
          trash: updatedRoom.defaultTrash,
          internet: updatedRoom.defaultInternet,
        };

        // Update local history
        setHistory(prev => prev.map(h => {
          if (h.month === currentMonth && h.year === currentYear) {
            return {
              ...h,
              records: { ...h.records, [updatedRoom.id]: updatedRecord }
            };
          }
          return h;
        }));

        // Update DB record
        await recordService.upsertMonthlyRecord(mapRecordToDb(updatedRoom.id, currentMonth, currentYear, updatedRecord));
      }

      setIsRoomModalOpen(false);
      setEditingRoom(null);
    } catch (error) {
      console.error('Error updating room:', error);
    }
  };

  const handleDeleteRoom = (id: string) => {
    showConfirm(
      'Xóa phòng',
      'Bạn có chắc chắn muốn xóa phòng này? Toàn bộ dữ liệu của phòng này trong các tháng cũng sẽ bị xóa.',
      async () => {
        try {
          await roomService.deleteRoom(id);
          setRooms(prev => prev.filter(r => r.id !== id));
          setHistory(prev => prev.map(h => {
            const newRecords = { ...h.records };
            delete newRecords[id];
            return { ...h, records: newRecords };
          }));
        } catch (error) {
          console.error('Error deleting room:', error);
        }
      }
    );
  };

  const handleSyncFromPreviousMonth = () => {
    showConfirm(
      'Đồng bộ từ tháng trước',
      'Bạn có muốn cập nhật chỉ số "Cũ" của tháng này bằng chỉ số "Mới" của tháng trước không? Việc này giúp sửa lỗi khi bạn tạo tháng mới mà chưa nhập xong số liệu tháng cũ.',
      async () => {
        try {
          setIsLoading(true);
          
          let prevMonth = currentMonth - 1;
          let prevYear = currentYear;
          if (prevMonth < 1) {
            prevMonth = 12;
            prevYear -= 1;
          }

          // Fetch previous month records from DB
          const dbRecords = await recordService.getMonthlyRecords(prevMonth, prevYear);
          if (dbRecords.length === 0) {
            alert(`Không tìm thấy dữ liệu tháng ${prevMonth}/${prevYear} để đồng bộ.`);
            return;
          }

          const prevRecordsMap: Record<string, MonthlyRecord> = {};
          dbRecords.forEach(r => {
            prevRecordsMap[r.room_id] = mapDbToRecord(r);
          });

          // Update current records
          const currentRecords = { ...currentMonthlyData?.records };
          const updatedRecords: Record<string, MonthlyRecord> = {};
          
          for (const room of rooms) {
            const currentRecord = currentRecords[room.id] || createEmptyRecord(room);
            const prevRecord = prevRecordsMap[room.id];
            
            if (prevRecord) {
              const updatedRecord: MonthlyRecord = {
                ...currentRecord,
                elecOld: prevRecord.elecNew,
                waterOld: prevRecord.waterNew
              };
              
              // Save to DB
              await recordService.upsertMonthlyRecord(mapRecordToDb(room.id, currentMonth, currentYear, updatedRecord));
              updatedRecords[room.id] = updatedRecord;
            } else {
              updatedRecords[room.id] = currentRecord;
            }
          }

          // Update local state
          setHistory(prev => prev.map(h => {
            if (h.month === currentMonth && h.year === currentYear) {
              return { ...h, records: updatedRecords };
            }
            return h;
          }));

        } catch (error) {
          console.error('Error syncing from previous month:', error);
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  const navigateMonth = async (direction: 'prev' | 'next') => {
    let m = currentMonth;
    let y = currentYear;
    if (direction === 'prev') {
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    } else {
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    
    // Check if data exists locally
    const existsLocally = history.find(h => h.month === m && h.year === y);
    if (existsLocally) {
      setCurrentMonth(m);
      setCurrentYear(y);
      return;
    }

    // Check if data exists in DB
    try {
      const dbRecords = await recordService.getMonthlyRecords(m, y);
      if (dbRecords.length > 0) {
        const recordsMap: Record<string, MonthlyRecord> = {};
        dbRecords.forEach(r => {
          recordsMap[r.room_id] = mapDbToRecord(r);
        });
        setHistory(prev => [...prev, { month: m, year: y, records: recordsMap }]);
        setCurrentMonth(m);
        setCurrentYear(y);
      } else if (direction === 'next') {
        showConfirm(
          'Tạo tháng mới',
          `Dữ liệu tháng ${m}/${y} chưa có. Bạn có muốn tạo mới dựa trên tháng hiện tại?`,
          () => {
            handleCreateNewMonth();
          }
        );
      }
    } catch (error) {
      console.error('Error checking month existence:', error);
    }
  };

  // --- Render Helpers ---
  const renderInvoice = () => {
    if (!selectedRoomId) return null;
    const room = rooms.find(r => r.id === selectedRoomId);
    if (!room) return null;

    // Get record from current month's data in history
    const record = currentMonthlyData?.records[selectedRoomId] || createEmptyRecord(room);
    
    const elecUsage = Math.max(0, record.elecNew - record.elecOld);
    const waterUsage = Math.max(0, record.waterNew - record.waterOld);
    const total = calculateTotal(record);

    return (
      <div className="p-8 bg-white text-slate-800 font-sans print:p-0" id="invoice-print">
        {/* Header with Accent */}
        <div className="flex justify-between items-start mb-10 border-b-4 border-blue-600 pb-6">
          <div>
            <h2 className="text-3xl font-black text-blue-600 uppercase tracking-tighter">Hóa Đơn Tiền Phòng</h2>
            <p className="text-slate-500 font-medium mt-1">{getMonthYearString(currentMonth, currentYear)}</p>
          </div>
          <div className="text-right">
            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg inline-block font-bold mb-2">
              PHÒNG: {room.name}
            </div>
            <p className="text-xs text-slate-400">Ngày in: {new Date().toLocaleDateString('vi-VN')}</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-8 mb-10">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Thông tin khách thuê</h4>
            <div className="space-y-2">
              <p className="flex justify-between">
                <span className="text-slate-500 text-sm">Họ và tên:</span>
                <span className="font-bold text-slate-900">{room.tenantName || 'N/A'}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-500 text-sm">Số điện thoại:</span>
                <span className="font-bold text-slate-900">{room.tenantPhone || 'N/A'}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-500 text-sm">CCCD/CMND:</span>
                <span className="font-bold text-slate-900">{room.tenantId || 'N/A'}</span>
              </p>
            </div>
          </div>
          <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100/50">
            <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3">Thông tin thanh toán</h4>
            <div className="space-y-2">
              <p className="flex justify-between">
                <span className="text-slate-500 text-sm">Kỳ thanh toán:</span>
                <span className="font-semibold text-slate-900">{getMonthYearString(currentMonth, currentYear)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-500 text-sm">Trạng thái:</span>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase">Chưa thanh toán</span>
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 mb-8">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider">Hạng mục</th>
                <th className="p-3 text-center text-xs font-bold uppercase tracking-wider">Chỉ số</th>
                <th className="p-3 text-center text-xs font-bold uppercase tracking-wider">Tiêu thụ</th>
                <th className="p-3 text-right text-xs font-bold uppercase tracking-wider">Đơn giá</th>
                <th className="p-3 text-right text-xs font-bold uppercase tracking-wider">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-white">
                <td className="p-4">
                  <div className="font-bold text-slate-900">Tiền thuê phòng</div>
                  <div className="text-[10px] text-slate-400 italic">Giá cố định hàng tháng</div>
                </td>
                <td className="p-4 text-center text-slate-400">-</td>
                <td className="p-4 text-center text-slate-400">-</td>
                <td className="p-4 text-right font-medium">{formatCurrency(record.rent)}</td>
                <td className="p-4 text-right font-bold text-slate-900">{formatCurrency(record.rent)}</td>
              </tr>
              <tr className="bg-slate-50/50">
                <td className="p-4">
                  <div className="font-bold text-slate-900">Tiền điện</div>
                  <div className="text-[10px] text-slate-400 italic">Dựa trên chỉ số công tơ</div>
                </td>
                <td className="p-4 text-center">
                  <div className="text-xs font-medium text-slate-500">
                    {record.elecOld.toLocaleString('vi-VN')} <span className="text-blue-400">→</span> {record.elecNew.toLocaleString('vi-VN')}
                  </div>
                </td>
                <td className="p-4 text-center">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-xs">
                    {elecUsage.toLocaleString('vi-VN')} kWh
                  </span>
                </td>
                <td className="p-4 text-right text-slate-600 text-sm">{formatCurrency(record.elecPrice)}</td>
                <td className="p-4 text-right font-bold text-slate-900">{formatCurrency(elecUsage * record.elecPrice)}</td>
              </tr>
              <tr className="bg-white">
                <td className="p-4">
                  <div className="font-bold text-slate-900">Tiền nước</div>
                  <div className="text-[10px] text-slate-400 italic">Dựa trên chỉ số đồng hồ</div>
                </td>
                <td className="p-4 text-center">
                  <div className="text-xs font-medium text-slate-500">
                    {record.waterOld.toLocaleString('vi-VN')} <span className="text-cyan-400">→</span> {record.waterNew.toLocaleString('vi-VN')}
                  </div>
                </td>
                <td className="p-4 text-center">
                  <span className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded font-bold text-xs">
                    {waterUsage.toLocaleString('vi-VN')} m³
                  </span>
                </td>
                <td className="p-4 text-right text-slate-600 text-sm">{formatCurrency(record.waterPrice)}</td>
                <td className="p-4 text-right font-bold text-slate-900">{formatCurrency(waterUsage * record.waterPrice)}</td>
              </tr>
              <tr className="bg-slate-50/50">
                <td className="p-4">
                  <div className="font-bold text-slate-900">Phí vệ sinh & Rác</div>
                </td>
                <td className="p-4 text-center text-slate-400">-</td>
                <td className="p-4 text-center text-slate-400">-</td>
                <td className="p-4 text-right text-slate-600 text-sm">{formatCurrency(record.trash)}</td>
                <td className="p-4 text-right font-bold text-slate-900">{formatCurrency(record.trash)}</td>
              </tr>
              <tr className="bg-white">
                <td className="p-4">
                  <div className="font-bold text-slate-900">Internet / Wifi</div>
                </td>
                <td className="p-4 text-center text-slate-400">-</td>
                <td className="p-4 text-center text-slate-400">-</td>
                <td className="p-4 text-right text-slate-600 text-sm">{formatCurrency(record.internet)}</td>
                <td className="p-4 text-right font-bold text-slate-900">{formatCurrency(record.internet)}</td>
              </tr>
              {record.debt !== 0 && (
                <tr className="bg-red-50/30">
                  <td className="p-4">
                    <div className="font-bold text-red-700">Nợ cũ / Phát sinh</div>
                    {record.notes && <div className="text-[10px] text-red-400 italic">{record.notes}</div>}
                  </td>
                  <td className="p-4 text-center text-slate-400">-</td>
                  <td className="p-4 text-center text-slate-400">-</td>
                  <td className="p-4 text-right text-red-600 text-sm">{formatCurrency(record.debt)}</td>
                  <td className="p-4 text-right font-bold text-red-700">{formatCurrency(record.debt)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total Summary */}
        <div className="flex justify-end mb-12">
          <div className="w-72 bg-slate-800 text-white p-6 rounded-2xl shadow-xl transform rotate-1">
            <div className="flex justify-between items-center mb-2 opacity-70">
              <span className="text-xs font-bold uppercase tracking-widest">Tổng cộng</span>
            </div>
            <div className="text-3xl font-black tracking-tighter">
              {formatCurrency(total)}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 text-[10px] italic opacity-60">
              Vui lòng thanh toán trước ngày 05 hàng tháng. Xin cảm ơn!
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-16 pb-10">
          <div className="text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-16">Người thuê phòng</p>
            <div className="w-40 h-px bg-slate-200 mx-auto mb-2"></div>
            <p className="font-bold text-slate-900">{room.tenantName || '................................'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-16">Chủ nhà / Đại diện</p>
            <div className="w-40 h-px bg-slate-200 mx-auto mb-2"></div>
            <p className="font-bold text-slate-900">Trần Phương Thái</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-blue-100">
      {/* --- Sidebar / Header --- */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 md:h-16 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
              <Home size={24} />
            </div>
            <div className="flex-1">
              <h1 className="font-bold text-lg leading-tight">Trần Phương Thái</h1>
              <p className="text-[10px] md:text-xs text-gray-500 font-medium uppercase tracking-wider">Hệ thống quản lý thông minh</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 md:gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-blue-50 px-2 md:px-3 py-1.5 rounded-lg border border-blue-100">
              <span className="text-[9px] md:text-[10px] font-bold text-blue-600 uppercase">Điện</span>
              <input 
                type="text" 
                value={formatNumberForInput(globalElecPrice)} 
                onChange={(e) => handleUpdateGlobalPrice('elec', parseSafeNumber(e.target.value))}
                className="w-12 md:w-16 bg-transparent font-bold text-blue-700 outline-none text-xs md:text-sm"
              />
              <span className="text-[9px] md:text-[10px] text-blue-400">đ</span>
            </div>
            <div className="flex items-center gap-2 bg-cyan-50 px-2 md:px-3 py-1.5 rounded-lg border border-cyan-100">
              <span className="text-[9px] md:text-[10px] font-bold text-cyan-600 uppercase">Nước</span>
              <input 
                type="text" 
                value={formatNumberForInput(globalWaterPrice)} 
                onChange={(e) => handleUpdateGlobalPrice('water', parseSafeNumber(e.target.value))}
                className="w-12 md:w-16 bg-transparent font-bold text-cyan-700 outline-none text-xs md:text-sm"
              />
              <span className="text-[9px] md:text-[10px] text-cyan-400">đ</span>
            </div>

            <button 
              onClick={handleSyncFromPreviousMonth}
              className="flex items-center gap-2 text-blue-600 px-3 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors border border-blue-100 text-xs md:text-sm"
              title="Đồng bộ chỉ số từ tháng trước"
            >
              <RefreshCcw size={16} className="md:w-[18px] md:h-[18px]" />
              <span className="hidden sm:inline">Đồng bộ</span>
            </button>

            <button 
              onClick={() => {
                if (!currentMonthlyData) return;
                const updatedRecords = { ...currentMonthlyData.records };
                Object.keys(updatedRecords).forEach(roomId => {
                  updatedRecords[roomId] = { ...updatedRecords[roomId], isPaid: true };
                });
                setHistory(prev => prev.map(h => 
                  h.month === currentMonth && h.year === currentYear 
                    ? { ...h, records: updatedRecords } 
                    : h
                ));
              }}
              className="flex items-center gap-2 text-emerald-600 px-3 py-2 rounded-lg font-medium hover:bg-emerald-50 transition-colors border border-emerald-100 text-xs md:text-sm"
              title="Đánh dấu tất cả phòng đã thanh toán"
            >
              <DollarSign size={16} className="md:w-[18px] md:h-[18px]" />
              <span className="hidden sm:inline">Tất cả đã trả</span>
            </button>

            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button 
                onClick={() => navigateMonth('prev')}
                className="p-1 md:p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all"
              >
                <ChevronLeft size={18} className="md:w-5 md:h-5" />
              </button>
              <div className="px-2 md:px-4 py-1 flex items-center gap-1 md:gap-2 font-semibold min-w-[100px] md:min-w-[140px] justify-center text-xs md:text-sm">
                <Calendar size={14} className="text-blue-600 md:w-4 md:h-4" />
                {getMonthYearString(currentMonth, currentYear)}
              </div>
              <button 
                onClick={() => navigateMonth('next')}
                className="p-1 md:p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all"
              >
                <ChevronRight size={18} className="md:w-5 md:h-5" />
              </button>
            </div>

            <button 
              onClick={handleSaveAll}
              disabled={isSaving || !isSupabaseConfigured}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg font-medium transition-all shadow-sm text-xs md:text-sm ${
                saveStatus === 'success' 
                  ? 'bg-green-600 text-white' 
                  : saveStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSaving ? (
                <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save size={16} className="md:w-[18px] md:h-[18px]" />
              )}
              <span>{saveStatus === 'success' ? 'Đã lưu' : saveStatus === 'error' ? 'Lỗi!' : 'Lưu'}</span>
            </button>

            <button 
              onClick={() => {
                setEditingRoom(null);
                setIsRoomModalOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm text-xs md:text-sm"
            >
              <Plus size={16} className="md:w-[18px] md:h-[18px]" />
              <span>Thêm</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8">
        {!isSupabaseConfigured && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
              <Settings size={24} />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-lg">Cấu hình Supabase chưa hoàn tất</h3>
              <p className="text-amber-800 mt-1">
                Bạn cần thiết lập biến môi trường <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-sm">VITE_SUPABASE_URL</code> và <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-sm">VITE_SUPABASE_ANON_KEY</code> trong menu <strong>Settings</strong> của AI Studio để ứng dụng có thể lưu trữ dữ liệu.
              </p>
              <p className="text-amber-700 text-sm mt-2">
                Hiện tại ứng dụng đang chạy ở chế độ xem trước không có cơ sở dữ liệu.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-500 font-medium">Đang tải dữ liệu từ Supabase...</p>
          </div>
        ) : (
          <>
            {/* --- Stats Overview --- */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Home size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Tổng số phòng</p>
                <h3 className="text-2xl font-bold">{stats.totalRooms}</h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Đang thuê</p>
                <h3 className="text-2xl font-bold">{stats.occupiedRooms}</h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                <Trash2 size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Phòng trống</p>
                <h3 className="text-2xl font-bold">{stats.vacantRooms}</h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Doanh thu tháng</p>
                <h3 className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalRevenue)}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* --- Main Table --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[11px] md:text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-2 md:p-4 text-left font-bold text-gray-700 sticky left-0 bg-gray-50 z-10 w-24 md:w-32 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Phòng</th>
                  <th colSpan={4} className="p-1 md:p-2 text-center font-bold text-blue-700 bg-blue-50/50 border-x border-gray-200">Điện</th>
                  <th colSpan={4} className="p-1 md:p-2 text-center font-bold text-cyan-700 bg-cyan-50/50 border-x border-gray-200">Nước</th>
                  <th colSpan={4} className="p-1 md:p-2 text-center font-bold text-emerald-700 bg-emerald-50/50 border-x border-gray-200">Cố định</th>
                  <th className="p-2 md:p-4 text-right font-bold text-purple-700 bg-purple-50/50 border-x border-gray-200">Tổng</th>
                  <th className="p-2 md:p-4 text-center font-bold text-gray-700 border-x border-gray-200">T.Thái</th>
                  <th className="p-2 md:p-4 text-left font-bold text-gray-700">Khách</th>
                  <th className="p-2 md:p-4 text-center font-bold text-gray-700">#</th>
                </tr>
                <tr className="bg-gray-50 border-b border-gray-200 text-[9px] md:text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="p-1 md:p-2 sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"></th>
                  <th className="p-1 md:p-2 border-x border-gray-100 min-w-[60px] md:w-24 whitespace-nowrap">Cũ</th>
                  <th className="p-1 md:p-2 border-x border-gray-100 min-w-[60px] md:w-24 whitespace-nowrap">Mới</th>
                  <th className="p-1 md:p-2 border-x border-gray-100 min-w-[40px] md:w-16 whitespace-nowrap">Dùng</th>
                  <th className="p-1 md:p-2 border-x border-gray-100 min-w-[70px] md:w-28 whitespace-nowrap">Tiền</th>
                  <th className="p-1 md:p-2 border-x border-gray-100 min-w-[60px] md:w-24 whitespace-nowrap">Cũ</th>
                  <th className="p-1 md:p-2 border-x border-gray-100 min-w-[60px] md:w-24 whitespace-nowrap">Mới</th>
                  <th className="p-1 md:p-2 border-x border-gray-100 min-w-[40px] md:w-16 whitespace-nowrap">Dùng</th>
                  <th className="p-1 md:p-2 border-x border-gray-100 min-w-[70px] md:w-28 whitespace-nowrap">Tiền</th>
                  <th className="p-1 md:p-2 border-x border-gray-100 min-w-[80px] md:w-32 whitespace-nowrap">Phòng</th>
                  <th className="p-1 md:p-2 border-x border-gray-100 min-w-[60px] md:w-24 whitespace-nowrap">Rác</th>
                  <th className="p-1 md:p-2 border-x border-gray-100 min-w-[60px] md:w-24 whitespace-nowrap">Net</th>
                  <th className="p-1 md:p-2 border-x border-gray-100 min-w-[60px] md:w-24 whitespace-nowrap">Nợ</th>
                  <th className="p-1 md:p-2 border-x border-gray-100"></th>
                  <th className="p-1 md:p-2 border-x border-gray-100"></th>
                  <th className="p-1 md:p-2 border-x border-gray-100">Họ tên</th>
                  <th className="p-1 md:p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const record = currentMonthlyData?.records[room.id] || createEmptyRecord(room);
                  const elecUsage = Math.max(0, record.elecNew - record.elecOld);
                  const waterUsage = Math.max(0, record.waterNew - record.waterOld);
                  const total = calculateTotal(record);

                  return (
                    <tr key={room.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors group">
                      <td className="p-2 md:p-4 font-bold sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex flex-col">
                          <span className="truncate">{room.name}</span>
                          {!room.isOccupied && <span className="text-[9px] md:text-[10px] text-orange-500 font-normal">Trống</span>}
                        </div>
                      </td>
                      
                      {/* Điện */}
                      <td className="p-0.5 border-x border-gray-100 min-w-[60px]">
                        <input 
                          type="text" 
                          value={formatNumberForInput(record.elecOld)} 
                          onChange={(e) => handleUpdateRecord(room.id, 'elecOld', parseSafeNumber(e.target.value))}
                          className="w-full p-1 md:p-2 bg-transparent text-center focus:bg-white focus:ring-1 focus:ring-blue-400 outline-none rounded transition-all text-[10px] md:text-sm"
                        />
                      </td>
                      <td className="p-0.5 border-x border-gray-100 min-w-[60px]">
                        <input 
                          type="text" 
                          value={formatNumberForInput(record.elecNew)} 
                          onChange={(e) => handleUpdateRecord(room.id, 'elecNew', parseSafeNumber(e.target.value))}
                          className="w-full p-1 md:p-2 bg-transparent text-center font-semibold focus:bg-white focus:ring-1 focus:ring-blue-400 outline-none rounded transition-all text-[10px] md:text-sm"
                        />
                      </td>
                      <td className="p-1 md:p-2 text-center text-blue-600 font-medium border-x border-gray-100 bg-blue-50/20 text-[10px] md:text-sm whitespace-nowrap">
                        {elecUsage}
                      </td>
                      <td className="p-1 md:p-2 text-right text-blue-700 font-bold border-x border-gray-100 bg-blue-50/40 text-[10px] md:text-sm whitespace-nowrap">
                        {formatCurrency(elecUsage * record.elecPrice).replace('₫', '')}
                      </td>

                      {/* Nước */}
                      <td className="p-0.5 border-x border-gray-100 min-w-[60px]">
                        <input 
                          type="text" 
                          value={formatNumberForInput(record.waterOld)} 
                          onChange={(e) => handleUpdateRecord(room.id, 'waterOld', parseSafeNumber(e.target.value))}
                          className="w-full p-1 md:p-2 bg-transparent text-center focus:bg-white focus:ring-1 focus:ring-cyan-400 outline-none rounded transition-all text-[10px] md:text-sm"
                        />
                      </td>
                      <td className="p-0.5 border-x border-gray-100 min-w-[60px]">
                        <input 
                          type="text" 
                          value={formatNumberForInput(record.waterNew)} 
                          onChange={(e) => handleUpdateRecord(room.id, 'waterNew', parseSafeNumber(e.target.value))}
                          className="w-full p-1 md:p-2 bg-transparent text-center font-semibold focus:bg-white focus:ring-1 focus:ring-cyan-400 outline-none rounded transition-all text-[10px] md:text-sm"
                        />
                      </td>
                      <td className="p-1 md:p-2 text-center text-cyan-600 font-medium border-x border-gray-100 bg-cyan-50/20 text-[10px] md:text-sm whitespace-nowrap">
                        {waterUsage}
                      </td>
                      <td className="p-1 md:p-2 text-right text-cyan-700 font-bold border-x border-gray-100 bg-cyan-50/40 text-[10px] md:text-sm whitespace-nowrap">
                        {formatCurrency(waterUsage * record.waterPrice).replace('₫', '')}
                      </td>

                      {/* Chi phí */}
                      <td className="p-0.5 border-x border-gray-100 min-w-[80px]">
                        <input 
                          type="text" 
                          value={formatNumberForInput(record.rent)} 
                          onChange={(e) => handleUpdateRecord(room.id, 'rent', parseSafeNumber(e.target.value))}
                          className="w-full p-1 md:p-2 bg-transparent text-right focus:bg-white focus:ring-1 focus:ring-emerald-400 outline-none rounded transition-all text-[10px] md:text-sm"
                        />
                      </td>
                      <td className="p-0.5 border-x border-gray-100 min-w-[60px]">
                        <input 
                          type="text" 
                          value={formatNumberForInput(record.trash)} 
                          onChange={(e) => handleUpdateRecord(room.id, 'trash', parseSafeNumber(e.target.value))}
                          className="w-full p-1 md:p-2 bg-transparent text-right focus:bg-white focus:ring-1 focus:ring-emerald-400 outline-none rounded transition-all text-[10px] md:text-sm"
                        />
                      </td>
                      <td className="p-0.5 border-x border-gray-100 min-w-[60px]">
                        <input 
                          type="text" 
                          value={formatNumberForInput(record.internet)} 
                          onChange={(e) => handleUpdateRecord(room.id, 'internet', parseSafeNumber(e.target.value))}
                          className="w-full p-1 md:p-2 bg-transparent text-right focus:bg-white focus:ring-1 focus:ring-emerald-400 outline-none rounded transition-all text-[10px] md:text-sm"
                        />
                      </td>
                      <td className="p-0.5 border-x border-gray-100 min-w-[60px]">
                        <input 
                          type="text" 
                          value={formatNumberForInput(record.debt)} 
                          onChange={(e) => handleUpdateRecord(room.id, 'debt', parseSafeNumber(e.target.value))}
                          className="w-full p-1 md:p-2 bg-transparent text-right focus:bg-white focus:ring-1 focus:ring-emerald-400 outline-none rounded transition-all text-red-500 text-[10px] md:text-sm"
                        />
                      </td>

                      {/* Tổng */}
                      <td className="p-2 md:p-4 text-right font-bold text-purple-700 bg-purple-50/20 border-x border-gray-100 text-[10px] md:text-sm whitespace-nowrap">
                        {formatCurrency(total).replace('₫', '')}
                      </td>

                      <td className="p-2 md:p-4 text-center border-x border-gray-100">
                        <button
                          onClick={() => handleUpdateRecord(room.id, 'isPaid', !record.isPaid)}
                          className={`px-2 md:px-3 py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-wider transition-all ${
                            record.isPaid 
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                              : 'bg-red-100 text-red-700 border border-red-200'
                          }`}
                        >
                          {record.isPaid ? 'X' : '!'}
                        </button>
                      </td>

                      {/* Thông tin */}
                      <td className="p-2 md:p-4 border-x border-gray-100 max-w-[120px] md:max-w-[200px]">
                        <div className="flex flex-col truncate">
                          <span className="font-medium truncate">{room.tenantName || '---'}</span>
                          <span className="text-[10px] md:text-xs text-gray-500">{room.tenantPhone || '---'}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-2 md:p-4 text-center">
                        <div className="flex items-center justify-center gap-1 md:gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setSelectedRoomId(room.id);
                              setIsInvoiceModalOpen(true);
                            }}
                            className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all hover:scale-110"
                            title="In hóa đơn"
                          >
                            <Printer size={16} className="md:w-[18px] md:h-[18px]" />
                          </button>
                          <button 
                            onClick={() => {
                              setEditingRoom({ ...room });
                              setIsRoomModalOpen(true);
                            }}
                            className="p-1.5 md:p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all hover:scale-110"
                            title="Sửa phòng"
                          >
                            <Edit2 size={16} className="md:w-[18px] md:h-[18px]" />
                          </button>
                          <button 
                            onClick={() => handleDeleteRoom(room.id)}
                            className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all hover:scale-110"
                            title="Xóa phòng"
                          >
                            <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <td className="p-2 md:p-4 sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">TỔNG</td>
                  <td colSpan={4} className="p-2 md:p-4 text-right text-blue-700 text-[10px] md:text-sm border-x border-gray-100">
                    {formatCurrency(stats.totalElec).replace('₫', '')}
                  </td>
                  <td colSpan={4} className="p-2 md:p-4 text-right text-cyan-700 text-[10px] md:text-sm border-x border-gray-100">
                    {formatCurrency(stats.totalWater).replace('₫', '')}
                  </td>
                  <td colSpan={4} className="p-2 md:p-4 text-right text-emerald-700 text-[10px] md:text-sm border-x border-gray-100">
                    {formatCurrency(stats.totalRent).replace('₫', '')}
                  </td>
                  <td className="p-2 md:p-4 text-right text-purple-700 text-sm md:text-lg bg-purple-50/40">
                    {formatCurrency(stats.totalRevenue).replace('₫', '')}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
          </>
        )}
      </main>

      {/* --- Modals --- */}
      <AnimatePresence>
        {isRoomModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRoomModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10 mx-auto"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h3 className="font-bold text-lg">{editingRoom?.id ? 'Chỉnh sửa phòng' : 'Thêm phòng mới'}</h3>
                <button onClick={() => setIsRoomModalOpen(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Tên phòng</label>
                    <input 
                      type="text" 
                      value={editingRoom?.name || ''} 
                      onChange={e => setEditingRoom(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ví dụ: Phòng 101"
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Giá thuê mặc định</label>
                    <input 
                      type="text" 
                      value={formatNumberForInput(editingRoom?.defaultRent || 0)} 
                      onChange={e => setEditingRoom(prev => ({ ...prev, defaultRent: parseSafeNumber(e.target.value) }))}
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Họ tên người thuê</label>
                  <input 
                    type="text" 
                    value={editingRoom?.tenantName || ''} 
                    onChange={e => setEditingRoom(prev => ({ ...prev, tenantName: e.target.value }))}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Số CCCD</label>
                    <input 
                      type="text" 
                      value={editingRoom?.tenantId || ''} 
                      onChange={e => setEditingRoom(prev => ({ ...prev, tenantId: e.target.value }))}
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Số điện thoại</label>
                    <input 
                      type="text" 
                      value={editingRoom?.tenantPhone || ''} 
                      onChange={e => setEditingRoom(prev => ({ ...prev, tenantPhone: e.target.value }))}
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Tiền rác mặc định</label>
                    <input 
                      type="text" 
                      value={formatNumberForInput(editingRoom?.defaultTrash || 0)} 
                      onChange={e => setEditingRoom(prev => ({ ...prev, defaultTrash: parseSafeNumber(e.target.value) }))}
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Tiền Internet mặc định</label>
                    <input 
                      type="text" 
                      value={formatNumberForInput(editingRoom?.defaultInternet || 0)} 
                      onChange={e => setEditingRoom(prev => ({ ...prev, defaultInternet: parseSafeNumber(e.target.value) }))}
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="isOccupied"
                    checked={editingRoom?.isOccupied || false} 
                    onChange={e => setEditingRoom(prev => ({ ...prev, isOccupied: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isOccupied" className="text-sm font-medium text-gray-700">Phòng đang có người ở</label>
                </div>

                {editingRoom?.id && currentMonthlyData?.records[editingRoom.id] && (
                  <div className="pt-4 border-t border-gray-100 space-y-4">
                    <h4 className="text-sm font-bold text-blue-600 uppercase">Chỉ số tháng {currentMonth}/{currentYear}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Số điện mới</label>
                        <input 
                          type="text" 
                          value={formatNumberForInput(currentMonthlyData.records[editingRoom.id].elecNew)} 
                          onChange={e => handleUpdateRecord(editingRoom.id!, 'elecNew', parseSafeNumber(e.target.value))}
                          className="w-full p-2.5 border border-blue-100 bg-blue-50/30 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Số nước mới</label>
                        <input 
                          type="text" 
                          value={formatNumberForInput(currentMonthlyData.records[editingRoom.id].waterNew)} 
                          onChange={e => handleUpdateRecord(editingRoom.id!, 'waterNew', parseSafeNumber(e.target.value))}
                          className="w-full p-2.5 border border-cyan-100 bg-cyan-50/30 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Tiền nợ/Phát sinh</label>
                      <input 
                        type="text" 
                        value={formatNumberForInput(currentMonthlyData.records[editingRoom.id].debt)} 
                        onChange={e => handleUpdateRecord(editingRoom.id!, 'debt', parseSafeNumber(e.target.value))}
                        className="w-full p-2.5 border border-red-100 bg-red-50/30 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-red-600 font-medium"
                      />
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <input 
                        type="checkbox" 
                        id="isPaidModal"
                        checked={currentMonthlyData.records[editingRoom.id].isPaid} 
                        onChange={e => handleUpdateRecord(editingRoom.id!, 'isPaid', e.target.checked)}
                        className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor="isPaidModal" className="text-sm font-bold text-gray-700">Đã thanh toán tháng này</label>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button 
                  onClick={() => setIsRoomModalOpen(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button 
                  onClick={editingRoom?.id ? handleUpdateRoom : handleAddRoom}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  {editingRoom?.id ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative z-10"
            >
              <div className="p-6">
                <h3 className="font-bold text-lg mb-2">{confirmModal.title}</h3>
                <p className="text-gray-600 text-sm">{confirmModal.message}</p>
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                >
                  Xác nhận
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isInvoiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInvoiceModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden relative z-10 mx-auto"
            >
              <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 no-print">
                <h3 className="font-bold text-lg">Xem trước hóa đơn</h3>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button 
                    onClick={handleCaptureInvoice}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-3 md:px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors text-xs md:text-sm"
                  >
                    <Camera size={16} className="md:w-[18px] md:h-[18px]" />
                    Chụp Ảnh
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-xs md:text-sm"
                  >
                    <Printer size={16} className="md:w-[18px] md:h-[18px]" />
                    In Hóa Đơn
                  </button>
                  <button onClick={() => setIsInvoiceModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="max-h-[80vh] overflow-y-auto bg-gray-50 p-4 md:p-8">
                <div className="bg-white shadow-lg mx-auto w-full max-w-[21cm] overflow-x-auto">
                  <div className="min-w-[700px]">
                    {renderInvoice()}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Print Styles --- */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-print, #invoice-print * {
            visibility: visible;
          }
          #invoice-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}
