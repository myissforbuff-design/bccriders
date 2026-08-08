import React, { useState, useEffect } from 'react';
import { store } from '../lib/db';
import { User } from '../types';
import {
  Wallet,
  Plus,
  Coins,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  User as UserIcon,
  CreditCard,
  Trash2,
  Edit3,
  X,
  Check,
  Calendar,
  Filter,
  Receipt,
  Tag,
} from 'lucide-react';

export type FinanceItemType = 'Membership Fee' | 'Monthly Due' | 'Vest Payment' | 'Other';

export interface FinanceRecord {
  id: string;
  itemType: FinanceItemType;
  coveredMonth?: string; // e.g., "August 2026"
  customItemName?: string;
  userId: string;
  userName: string;
  userMemberNo?: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Waived';
  paymentMethod?: 'GCash' | 'Cash' | 'Bank Transfer' | 'Credit Card' | 'Other';
  referenceNo?: string;
  notes?: string;
  updatedAt: string;
}

const LOCAL_STORAGE_REC_KEY = 'bcc_finance_records_v3';

const MONTHS_LIST = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const YEARS_LIST = ['2024', '2025', '2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033', '2034', '2035'];

export const Finances: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [records, setRecords] = useState<FinanceRecord[]>([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending' | 'Overdue' | 'Waived'>('All');

  // Modal
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);

  // Form State for Payment Record
  const [recUserId, setRecUserId] = useState('');
  const [recItemType, setRecItemType] = useState<FinanceItemType>('Monthly Due');
  const [recMonth, setRecMonth] = useState('August');
  const [recYear, setRecYear] = useState('2026');
  const [recCustomItemName, setRecCustomItemName] = useState('');
  const [recAmount, setRecAmount] = useState('200');
  const [recStatus, setRecStatus] = useState<'Paid' | 'Pending' | 'Overdue' | 'Waived'>('Paid');
  const [recMethod, setRecMethod] = useState<'GCash' | 'Cash' | 'Bank Transfer' | 'Credit Card' | 'Other'>('GCash');
  const [recRefNo, setRecRefNo] = useState('');
  const [recNotes, setRecNotes] = useState('');
  const [recDueDate, setRecDueDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Load Users & Saved Records
  useEffect(() => {
    const loadedUsers = store.getUsers().filter(u => u.role !== 'admin');
    setUsers(loadedUsers);

    let savedRecs: FinanceRecord[] = [];
    try {
      const recItem = localStorage.getItem(LOCAL_STORAGE_REC_KEY);
      if (recItem) savedRecs = JSON.parse(recItem);
    } catch (e) {
      console.error(e);
    }

    // Helper to auto-create missing membership fee records for approved members
    const ensureApprovedMembersHaveFees = (currentRecs: FinanceRecord[]) => {
      let updatedList = [...currentRecs];
      let hasNew = false;
      const todayStr = new Date().toISOString().split('T')[0];

      // Clean up / update existing membership fee records if they have old 1500 amount or old note
      updatedList = updatedList.map(r => {
        if (r.itemType === 'Membership Fee' && (r.id.startsWith('rec_mf_') || r.amount === 1500 || r.notes?.includes('Automated'))) {
          hasNew = true;
          const updatedRec = {
            ...r,
            amount: 200,
            notes: 'Payment recorded upon member approval',
          };
          fetch('/api/mongodb/financeLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedRec),
          }).catch(err => console.warn('MongoDB fee update sync error:', err));
          return updatedRec;
        }
        return r;
      });

      loadedUsers.forEach(u => {
        if (u.approvalStatus === 'Approved' || !u.approvalStatus) {
          const exists = updatedList.some(r => r.userId === u.id && r.itemType === 'Membership Fee');
          if (!exists) {
            hasNew = true;
            const newFeeRec: FinanceRecord = {
              id: `rec_mf_${u.id}`,
              itemType: 'Membership Fee',
              userId: u.id,
              userName: u.name,
              userMemberNo: u.memberNumber || 'BRC-MEMBER',
              amount: 200,
              dueDate: u.joinDate || todayStr,
              paidDate: todayStr,
              status: 'Paid',
              paymentMethod: 'GCash',
              referenceNo: undefined,
              notes: 'Payment recorded upon member approval',
              updatedAt: todayStr,
            };
            updatedList.unshift(newFeeRec);
            // Sync individual new record to MongoDB
            fetch('/api/mongodb/financeLogs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newFeeRec),
            }).catch(err => console.warn('MongoDB auto membership fee sync error:', err));
          }
        }
      });

      if (hasNew) {
        setRecords(updatedList);
        localStorage.setItem(LOCAL_STORAGE_REC_KEY, JSON.stringify(updatedList));
      } else {
        setRecords(currentRecs);
      }
    };

    setRecords(savedRecs);

    // Sync with MongoDB financeLogs table
    fetch('/api/mongodb/financeLogs')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          ensureApprovedMembersHaveFees(data.data);
          localStorage.setItem(LOCAL_STORAGE_REC_KEY, JSON.stringify(data.data));
        } else {
          ensureApprovedMembersHaveFees(savedRecs);
          if (savedRecs.length > 0) {
            // Sync local records to MongoDB
            fetch('/api/mongodb/financeLogs/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ records: savedRecs }),
            }).catch(err => console.warn('MongoDB financeLogs bulk sync error:', err));
          }
        }
      })
      .catch(err => {
        console.warn('MongoDB financeLogs fetch error:', err);
        ensureApprovedMembersHaveFees(savedRecs);
      });
  }, []);

  // Save Records to localStorage & MongoDB
  const saveRecordsToStorage = (updatedRecs: FinanceRecord[]) => {
    setRecords(updatedRecs);
    localStorage.setItem(LOCAL_STORAGE_REC_KEY, JSON.stringify(updatedRecs));
  };

  const syncRecordToMongo = (rec: FinanceRecord) => {
    fetch('/api/mongodb/financeLogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
    }).catch(err => console.warn('MongoDB financeLogs sync error:', err));
  };

  const deleteRecordFromMongo = (recordId: string) => {
    fetch(`/api/mongodb/financeLogs/${recordId}`, {
      method: 'DELETE',
    }).catch(err => console.warn('MongoDB financeLogs delete error:', err));
  };

  // Change Item Type in Form
  const handleItemTypeChange = (type: FinanceItemType) => {
    setRecItemType(type);
  };

  // Open Log Payment Modal
  const handleOpenLogRecord = (presetRecord?: FinanceRecord) => {
    if (presetRecord) {
      setEditingRecord(presetRecord);
      setRecUserId(presetRecord.userId);
      setRecItemType(presetRecord.itemType);
      
      if (presetRecord.coveredMonth) {
        const parts = presetRecord.coveredMonth.split(' ');
        setRecMonth(parts[0] || 'August');
        setRecYear(parts[1] || '2026');
      } else {
        setRecMonth('August');
        setRecYear('2026');
      }

      setRecCustomItemName(presetRecord.customItemName || '');
      setRecAmount(presetRecord.amount.toString());
      setRecStatus(presetRecord.status);
      setRecMethod(presetRecord.paymentMethod || 'GCash');
      setRecRefNo(presetRecord.referenceNo || '');
      setRecNotes(presetRecord.notes || '');
      setRecDueDate(presetRecord.dueDate);
    } else {
      setEditingRecord(null);
      setRecUserId(users[0]?.id || '');
      setRecItemType('Monthly Due');
      setRecMonth('August');
      setRecYear('2026');
      setRecCustomItemName('');
      setRecAmount('200');
      setRecStatus('Paid');
      setRecMethod('GCash');
      setRecRefNo('');
      setRecNotes('');
      setRecDueDate(new Date().toISOString().split('T')[0]);
    }
    setShowAddRecordModal(true);
  };

  // Save Record Handler
  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(recAmount) || 0;
    const selectedUser = users.find(u => u.id === recUserId);
    const todayStr = new Date().toISOString().split('T')[0];
    const coveredMonthStr = recItemType === 'Monthly Due' ? `${recMonth} ${recYear}` : undefined;

    if (editingRecord) {
      const updatedRecord: FinanceRecord = {
        ...editingRecord,
        userId: recUserId,
        userName: selectedUser?.name || editingRecord.userName,
        userMemberNo: selectedUser?.memberNumber || editingRecord.userMemberNo,
        itemType: recItemType,
        coveredMonth: coveredMonthStr,
        customItemName: recItemType === 'Other' ? recCustomItemName : undefined,
        amount: amountNum,
        status: recStatus,
        dueDate: recDueDate,
        paidDate: recStatus === 'Paid' ? todayStr : undefined,
        paymentMethod: recMethod,
        referenceNo: undefined,
        notes: recNotes.trim() || undefined,
        updatedAt: todayStr,
      };

      const updated = records.map(r => (r.id === editingRecord.id ? updatedRecord : r));
      saveRecordsToStorage(updated);
      syncRecordToMongo(updatedRecord);
    } else {
      const newRec: FinanceRecord = {
        id: `rec_${Date.now()}`,
        userId: recUserId || (users[0]?.id || 'usr_guest'),
        userName: selectedUser?.name || 'Walk-in Member',
        userMemberNo: selectedUser?.memberNumber || 'BRC-N/A',
        itemType: recItemType,
        coveredMonth: coveredMonthStr,
        customItemName: recItemType === 'Other' ? recCustomItemName : undefined,
        amount: amountNum,
        dueDate: recDueDate,
        paidDate: recStatus === 'Paid' ? todayStr : undefined,
        status: recStatus,
        paymentMethod: recMethod,
        referenceNo: undefined,
        notes: recNotes.trim() || undefined,
        updatedAt: todayStr,
      };
      saveRecordsToStorage([...records, newRec]);
      syncRecordToMongo(newRec);
    }

    setShowAddRecordModal(false);
  };

  // Quick Status Toggle (Mark Paid / Pending)
  const handleQuickMarkPaid = (record: FinanceRecord) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newStatus = record.status === 'Paid' ? 'Pending' : 'Paid';
    let targetUpdatedRecord: FinanceRecord | null = null;

    const updated = records.map(r => {
      if (r.id === record.id) {
        targetUpdatedRecord = {
          ...r,
          status: newStatus,
          paidDate: newStatus === 'Paid' ? todayStr : undefined,
          referenceNo: undefined,
          paymentMethod: newStatus === 'Paid' ? (r.paymentMethod || 'GCash') : undefined,
          updatedAt: todayStr,
        };
        return targetUpdatedRecord;
      }
      return r;
    });

    saveRecordsToStorage(updated);
    if (targetUpdatedRecord) {
      syncRecordToMongo(targetUpdatedRecord);
    }
  };

  // Delete Record
  const handleDeleteRecord = (recordId: string) => {
    if (confirm('Are you sure you want to delete this payment record?')) {
      const updated = records.filter(r => r.id !== recordId);
      saveRecordsToStorage(updated);
      deleteRecordFromMongo(recordId);
    }
  };

  // Helper to format Item Title
  const getItemTitle = (rec: FinanceRecord) => {
    if (rec.itemType === 'Monthly Due') {
      return `Monthly Due${rec.coveredMonth ? ` (${rec.coveredMonth})` : ''}`;
    }
    if (rec.itemType === 'Other' && rec.customItemName) {
      return rec.customItemName;
    }
    return rec.itemType;
  };

  // Filtered Records
  const filteredRecords = records.filter(r => {
    const title = getItemTitle(r).toLowerCase();
    const matchesSearch =
      r.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.userMemberNo && r.userMemberNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.referenceNo && r.referenceNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      title.includes(searchQuery.toLowerCase());

    const matchesItemType = itemTypeFilter === 'All' || r.itemType === itemTypeFilter;
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;

    return matchesSearch && matchesItemType && matchesStatus;
  });

  // Financial Metrics
  const totalCollected = records
    .filter(r => r.status === 'Paid')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalPending = records
    .filter(r => r.status === 'Pending' || r.status === 'Overdue')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalMonthlyDues = records
    .filter(r => r.itemType === 'Monthly Due' && r.status === 'Paid')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalMonthlyDuesCount = records.filter(r => r.itemType === 'Monthly Due' && r.status === 'Paid').length;

  const totalPaidCount = records.filter(r => r.status === 'Paid').length;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Global Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-[11px] text-[#52605d] font-bold block">Total Funds Collected</span>
            <p className="font-heading text-xl font-black text-[#1b4332]">
              ₱{totalCollected.toLocaleString()}.00
            </p>
            <span className="text-[10px] text-[#2d6a4f] font-semibold">{totalPaidCount} verified payments</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-[11px] text-[#52605d] font-bold block">Pending Payments</span>
            <p className="font-heading text-xl font-black text-amber-900">
              ₱{totalPending.toLocaleString()}.00
            </p>
            <span className="text-[10px] text-amber-700 font-semibold">Uncollected dues</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-[11px] text-[#52605d] font-bold block">Total Monthly Dues</span>
            <p className="font-heading text-xl font-black text-[#1b4332]">
              ₱{totalMonthlyDues.toLocaleString()}.00
            </p>
            <span className="text-[10px] text-[#52605d]">{totalMonthlyDuesCount} dues collected</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#f7f9f7] text-[#2d6a4f] border border-[#e2ece2] flex items-center justify-center shrink-0">
            <UserIcon className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-[11px] text-[#52605d] font-bold block">Active Members</span>
            <p className="font-heading text-xl font-black text-[#1b4332]">
              {users.length} Accounts
            </p>
            <span className="text-[10px] text-[#52605d]">Member profiles</span>
          </div>
        </div>
      </div>

      {/* MAIN RECORDS CONTAINER */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-[#e2ece2] shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e2ece2]">
          <div>
            <h3 className="font-heading text-base font-extrabold text-[#1b4332] flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#2d6a4f]" />
              <span>Payment Records & Transactions</span>
            </h3>
            <p className="text-xs text-[#52605d]">
              Manage all member payments for membership fees, monthly dues, and vest orders.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenLogRecord()}
            className="px-4 py-2 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 self-start md:self-auto"
          >
            <Plus className="w-3.5 h-3.5 text-[#74c69d]" />
            <span>Record Payment</span>
          </button>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
          {/* Search Box */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-[#52605d] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search member name, ref #, or item..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#f7f9f7] border border-[#e2ece2] rounded-xl text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Item Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#52605d] whitespace-nowrap">Item:</span>
              <select
                value={itemTypeFilter}
                onChange={e => setItemTypeFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-xl text-xs font-bold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
              >
                <option value="All">All Items</option>
                <option value="Membership Fee">Membership Fee</option>
                <option value="Monthly Due">Monthly Due</option>
                <option value="Vest Payment">Vest Payment</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-bold text-[#52605d] mr-1 whitespace-nowrap">Status:</span>
              {(['All', 'Paid', 'Pending', 'Overdue', 'Waived'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-[#2d6a4f] text-white shadow-xs'
                      : 'bg-[#f7f9f7] hover:bg-[#e2ece2] text-[#52605d]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MOBILE TRANSACTION CARDS VIEW */}
        <div className="block md:hidden space-y-3">
          {filteredRecords.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-[#e2ece2] text-center text-[#52605d] space-y-2">
              <AlertCircle className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="font-bold text-stone-600">No payment records found</p>
              <p className="text-xs text-stone-400">
                Click "Record Payment" to log a new member payment transaction.
              </p>
            </div>
          ) : (
            filteredRecords.map(rec => {
              const isPaid = rec.status === 'Paid';
              const isPending = rec.status === 'Pending';
              const isOverdue = rec.status === 'Overdue';
              const itemTitle = getItemTitle(rec);

              return (
                <div key={rec.id} className="p-4 rounded-2xl bg-white border border-[#e2ece2] shadow-2xs space-y-3">
                  {/* Member & Status Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[#1b4332] text-sm">{rec.userName}</p>
                      <p className="text-xs font-semibold text-[#1b4332] mt-0.5">{itemTitle}</p>
                      {itemTitle.toLowerCase() !== rec.itemType.toLowerCase() &&
                        !itemTitle.toLowerCase().startsWith(rec.itemType.toLowerCase()) && (
                          <span className="text-[10px] text-[#52605d] uppercase tracking-wider font-semibold block">
                            {rec.itemType}
                          </span>
                        )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1 border shrink-0 ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isPending
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : isOverdue
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-stone-100 text-stone-700 border-stone-300'
                      }`}
                    >
                      {isPaid && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                      {isPending && <Clock className="w-3 h-3 text-amber-600" />}
                      {isOverdue && <AlertCircle className="w-3 h-3 text-rose-600" />}
                      <span>{rec.status}</span>
                    </span>
                  </div>

                  {/* Amount & Details Grid */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#e2ece2]/60 text-xs">
                    <div>
                      <span className="text-[10px] text-[#52605d] block uppercase font-bold">Amount</span>
                      <span className="font-extrabold text-[#1b4332] text-base">
                        ₱{rec.amount.toLocaleString()}.00
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#52605d] block uppercase font-bold">Due Date</span>
                      <span className="font-medium text-[#1b4332] text-xs">{rec.dueDate}</span>
                    </div>
                  </div>

                  {/* Payment Method & Notes */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-[#52605d] gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-[#52605d] font-bold mr-1">Method:</span>
                      <span className="font-semibold text-[#1b4332]">{rec.paymentMethod || '—'}</span>
                    </div>
                    {rec.notes && (
                      <div className="text-right text-[11px] italic text-[#52605d] max-w-[200px] truncate">
                        {rec.notes}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2ece2]">
                    <button
                      type="button"
                      onClick={() => handleQuickMarkPaid(rec)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        isPaid
                          ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                      }`}
                    >
                      {isPaid ? 'Undo' : 'Mark Paid'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenLogRecord(rec)}
                      title="Edit Payment Record"
                      className="p-2 rounded-xl text-stone-500 hover:text-[#1b4332] bg-[#f7f9f7] border border-[#e2ece2] transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteRecord(rec.id)}
                      title="Delete Payment Record"
                      className="p-2 rounded-xl text-stone-400 hover:text-rose-600 bg-rose-50/50 border border-rose-100 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FINANCIAL RECORDS TABLE (DESKTOP) */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#e2ece2]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#f7f9f7] border-b border-[#e2ece2] text-[#52605d] font-extrabold uppercase text-[10px]">
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-3">Item Details</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Method & Ref #</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2ece2]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#52605d] space-y-2">
                    <AlertCircle className="w-8 h-8 text-stone-300 mx-auto" />
                    <p className="font-bold text-stone-600">No payment records found</p>
                    <p className="text-xs text-stone-400">
                      Click "Record Payment" to log a new member payment transaction.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => {
                  const isPaid = rec.status === 'Paid';
                  const isPending = rec.status === 'Pending';
                  const isOverdue = rec.status === 'Overdue';
                  const itemTitle = getItemTitle(rec);

                  return (
                    <tr key={rec.id} className="hover:bg-[#f7f9f7]/80 transition-colors">
                      {/* Member Info */}
                      <td className="py-3.5 px-4 font-semibold text-[#1b4332]">
                        <p className="font-bold text-[#1b4332]">{rec.userName}</p>
                      </td>

                      {/* Item Details */}
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-[#1b4332] block">{itemTitle}</span>
                        {itemTitle.toLowerCase() !== rec.itemType.toLowerCase() &&
                          !itemTitle.toLowerCase().startsWith(rec.itemType.toLowerCase()) && (
                            <span className="text-[10px] text-[#52605d] uppercase tracking-wider font-semibold">
                              {rec.itemType}
                            </span>
                          )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-3 font-extrabold text-[#1b4332]">
                        ₱{rec.amount.toLocaleString()}.00
                      </td>

                      {/* Dates */}
                      <td className="py-3.5 px-3 text-[#52605d]">
                        <p className="font-medium text-[#1b4332] text-[11px]">Due: {rec.dueDate}</p>
                      </td>

                      {/* Method */}
                      <td className="py-3.5 px-3 text-[#52605d]">
                        {rec.paymentMethod ? (
                          <span className="font-bold text-[#1b4332] text-xs">{rec.paymentMethod}</span>
                        ) : (
                          <span className="text-stone-400 italic">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1 border ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : isPending
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : isOverdue
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-stone-100 text-stone-700 border-stone-300'
                          }`}
                        >
                          {isPaid && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isPending && <Clock className="w-3 h-3 text-amber-600" />}
                          {isOverdue && <AlertCircle className="w-3 h-3 text-rose-600" />}
                          <span>{rec.status}</span>
                        </span>
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-3 text-[#52605d] max-w-xs truncate">
                        {rec.notes || '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickMarkPaid(rec)}
                            title={isPaid ? 'Mark as Pending' : 'Mark as Paid'}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                              isPaid
                                ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                            }`}
                          >
                            {isPaid ? 'Undo' : 'Mark Paid'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenLogRecord(rec)}
                            title="Edit Payment Record"
                            className="p-1.5 rounded-lg text-stone-500 hover:text-[#1b4332] hover:bg-[#e2ece2] transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(rec.id)}
                            title="Delete Payment Record"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: RECORD PAYMENT */}
      {showAddRecordModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200 relative animate-scaleUp">
            <button
              type="button"
              onClick={() => setShowAddRecordModal(false)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#2d6a4f] text-[#74c69d] flex items-center justify-center shrink-0 shadow-sm">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-extrabold text-[#1b4332]">
                  {editingRecord ? 'Edit Payment Record' : 'Record Member Payment'}
                </h3>
                <p className="text-xs text-[#52605d]">
                  Select the item type and enter transaction details below.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-4">
              {/* Select Member */}
              <div>
                <label className="block text-xs font-bold text-[#1b4332] mb-1">
                  Select Member *
                </label>
                <select
                  required
                  value={recUserId}
                  onChange={e => setRecUserId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-xl text-xs font-bold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] focus:bg-white transition-colors"
                >
                  {users.length === 0 ? (
                    <option value="">No members found</option>
                  ) : (
                    users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.memberNumber || 'BRC'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Item Details Dropdown */}
              <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#1b4332] mb-1 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span>Item Details (Payment For) *</span>
                  </label>
                  <select
                    required
                    value={recItemType}
                    onChange={e => handleItemTypeChange(e.target.value as FinanceItemType)}
                    className="w-full px-4 py-2.5 bg-white border border-[#e2ece2] rounded-xl text-xs font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] transition-colors"
                  >
                    <option value="Membership Fee">Membership Fee</option>
                    <option value="Monthly Due">Monthly Due</option>
                    <option value="Vest Payment">Vest Payment</option>
                    <option value="Other">Other / Custom Item</option>
                  </select>
                </div>

                {/* If Monthly Due, specify covered month & year */}
                {recItemType === 'Monthly Due' && (
                  <div className="pt-1">
                    <label className="block text-xs font-bold text-[#1b4332] mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#2d6a4f]" />
                      <span>Covered Month & Year *</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={recMonth}
                        onChange={e => setRecMonth(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#e2ece2] rounded-xl text-xs font-bold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                      >
                        {MONTHS_LIST.map(m => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={recYear}
                        onChange={e => setRecYear(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#e2ece2] rounded-xl text-xs font-bold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                      >
                        {YEARS_LIST.map(y => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* If Other, custom item name */}
                {recItemType === 'Other' && (
                  <div className="pt-1">
                    <label className="block text-xs font-bold text-[#1b4332] mb-1">
                      Custom Item Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Anniversary Gala Ticket, Club Jersey"
                      value={recCustomItemName}
                      onChange={e => setRecCustomItemName(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-[#e2ece2] rounded-xl text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                )}
              </div>

              {/* Amount & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1b4332] mb-1">
                    Amount Paid (₱) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="200"
                    value={recAmount}
                    onChange={e => setRecAmount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-xl text-xs font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] focus:bg-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1b4332] mb-1">
                    Payment Status *
                  </label>
                  <select
                    value={recStatus}
                    onChange={e => setRecStatus(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-xl text-xs font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] focus:bg-white transition-colors"
                  >
                    <option value="Paid">Paid / Verified</option>
                    <option value="Pending">Pending Payment</option>
                    <option value="Overdue">Overdue Notice</option>
                    <option value="Waived">Waived / Exempted</option>
                  </select>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-[#1b4332] mb-1">
                  Payment Method
                </label>
                <select
                  value={recMethod}
                  onChange={e => setRecMethod(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-xl text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] focus:bg-white transition-colors"
                >
                  <option value="GCash">GCash E-Wallet</option>
                  <option value="Bank Transfer">Bank Online Transfer</option>
                  <option value="Cash">Cash to Treasurer</option>
                  <option value="Credit Card">Credit / Debit Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-bold text-[#1b4332] mb-1">
                  Due / Payment Date
                </label>
                <input
                  type="date"
                  value={recDueDate}
                  onChange={e => setRecDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-xl text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] focus:bg-white transition-colors"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-[#1b4332] mb-1">
                  Notes / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Size L vest order, receipt verified by Treasurer"
                  value={recNotes}
                  onChange={e => setRecNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-xl text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] focus:bg-white transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e2ece2]">
                <button
                  type="button"
                  onClick={() => setShowAddRecordModal(false)}
                  className="px-5 py-2.5 bg-[#f7f9f7] hover:bg-[#e2ece2] text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-2"
                >
                  <Check className="w-4 h-4 text-[#74c69d]" />
                  <span>{editingRecord ? 'Save Changes' : 'Record Transaction'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
