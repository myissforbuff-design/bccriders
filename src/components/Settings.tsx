import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { store } from '../lib/db';
import { CustomSelect } from './CustomSelect';
import { useModalDismiss } from '../hooks/useModalDismiss';
import {
  FinanceSettings,
  MonthlyDue,
  DynamicCollection,
  User,
} from '../types';
import {
  Coins,
  Wallet,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Users,
  Shield,
  Settings as SettingsIcon,
  Save,
  X,
  AlertTriangle,
  Receipt,
  PiggyBank,
  TrendingUp,
  Layers,
  HelpCircle,
  FileSpreadsheet,
  LogOut,
  ChevronDown,
  Check,
} from 'lucide-react';

const MONTH_OPTIONS = [
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

const YEAR_OPTIONS = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];

const SUB_TAB_OPTIONS = [
  { id: 'finance', label: 'Finance & Fee Settings', icon: Wallet, description: 'Manage club fees, dues, & custom collections' },
  { id: 'security', label: 'System & Security', icon: Shield, description: 'Executive permissions and security controls' },
] as const;

export const Settings: React.FC = () => {
  const { currentUser, isAdmin, logout } = useAuth();

  // Settings Sub-Navigation Dropdown & Tabs
  const [activeSubTab, setActiveSubTab] = useState<'finance' | 'security'>('finance');
  const [isSubTabDropdownOpen, setIsSubTabDropdownOpen] = useState(false);
  const subTabDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subTabDropdownRef.current && !subTabDropdownRef.current.contains(event.target as Node)) {
        setIsSubTabDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Database States
  const [financeSettings, setFinanceSettings] = useState<FinanceSettings>(() =>
    store.getFinanceSettings()
  );
  const [monthlyDues, setMonthlyDues] = useState<MonthlyDue[]>(() =>
    store.getMonthlyDues()
  );
  const [dynamicCollections, setDynamicCollections] = useState<DynamicCollection[]>(
    () => store.getDynamicCollections()
  );
  const [approvedMembers, setApprovedMembers] = useState<User[]>([]);

  // Fee Form State
  const [membershipFeeInput, setMembershipFeeInput] = useState<number>(
    financeSettings.membershipFee
  );
  const [annualFeeInput, setAnnualFeeInput] = useState<number>(
    financeSettings.annualFee
  );
  const [feeSavedToast, setFeeSavedToast] = useState(false);

  // Monthly Due Modal State
  const [showMonthlyDueModal, setShowMonthlyDueModal] = useState(false);
  const [editingDue, setEditingDue] = useState<MonthlyDue | null>(null);
  const [dueTitle, setDueTitle] = useState('');
  const [dueAmount, setDueAmount] = useState<number>(150);
  const [dueMonth, setDueMonth] = useState<string>('January');
  const [dueYear, setDueYear] = useState<string>('2026');
  const [dueNotes, setDueNotes] = useState('');

  // Dynamic Collection Modal State
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<DynamicCollection | null>(null);
  const [colName, setColName] = useState('');
  const [colAmount, setColAmount] = useState<number>(500);
  const [colDescription, setColDescription] = useState('');

  // Custom Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'monthly_due' | 'dynamic_collection';
    id: string;
    name: string;
  } | null>(null);

  useModalDismiss(showMonthlyDueModal, () => setShowMonthlyDueModal(false));
  useModalDismiss(showCollectionModal, () => setShowCollectionModal(false));
  useModalDismiss(Boolean(deleteTarget), () => setDeleteTarget(null));
  useModalDismiss(showLogoutModal, () => setShowLogoutModal(false));

  useEffect(() => {
    // Load approved members for collection calculations (excluding admin accounts)
    const allUsers = store.getUsers();
    const approved = allUsers.filter((u) => {
      const isUserAdmin =
        u.role === 'admin' ||
        u.role?.toLowerCase() === 'admin' ||
        u.role?.toLowerCase() === 'administrator' ||
        u.id === 'usr_admin' ||
        u.id === 'admin' ||
        u.username?.toLowerCase() === 'admin' ||
        u.email?.toLowerCase().includes('admin@');
      if (isUserAdmin) return false;
      return u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin');
    });
    setApprovedMembers(approved);
  }, []);

  const refreshFinanceData = () => {
    setFinanceSettings(store.getFinanceSettings());
    setMonthlyDues([...store.getMonthlyDues()]);
    setDynamicCollections([...store.getDynamicCollections()]);
    const allUsers = store.getUsers();
    const approved = allUsers.filter((u) => {
      const isUserAdmin =
        u.role === 'admin' ||
        u.role?.toLowerCase() === 'admin' ||
        u.role?.toLowerCase() === 'administrator' ||
        u.id === 'usr_admin' ||
        u.id === 'admin' ||
        u.username?.toLowerCase() === 'admin' ||
        u.email?.toLowerCase().includes('admin@');
      if (isUserAdmin) return false;
      return u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin');
    });
    setApprovedMembers(approved);
  };

  // Handle Save Fee Configuration
  const handleSaveFees = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = store.updateFinanceSettings({
      membershipFee: Number(membershipFeeInput) || 0,
      annualFee: Number(annualFeeInput) || 0,
    });
    setFinanceSettings(updated);
    setFeeSavedToast(true);
    setTimeout(() => setFeeSavedToast(false), 3000);
  };

  // Monthly Due Handlers
  const handleOpenCreateDue = () => {
    setEditingDue(null);
    setDueTitle('');
    setDueAmount(150);
    const currMonthName = new Date().toLocaleString('en-US', { month: 'long' });
    setDueMonth(MONTH_OPTIONS.includes(currMonthName) ? currMonthName : 'January');
    setDueYear(String(new Date().getFullYear()));
    setDueNotes('');
    setShowMonthlyDueModal(true);
  };

  const handleOpenEditDue = (due: MonthlyDue) => {
    setEditingDue(due);
    setDueTitle(due.title);
    setDueAmount(due.amount);
    setDueMonth(due.month);
    setDueYear(String(due.year));
    setDueNotes(due.notes || '');
    setShowMonthlyDueModal(true);
  };

  const handleSubmitDue = (e: React.FormEvent) => {
    e.preventDefault();
    const titleVal = `${dueMonth} ${dueYear} Monthly Due`;

    let savedDue: MonthlyDue;
    if (editingDue) {
      savedDue = store.updateMonthlyDue({
        ...editingDue,
        title: titleVal,
        amount: Number(dueAmount) || 0,
        month: dueMonth,
        year: Number(dueYear) || 2026,
        notes: dueNotes.trim(),
      });
    } else {
      savedDue = store.createMonthlyDue({
        title: titleVal,
        amount: Number(dueAmount) || 0,
        month: dueMonth,
        year: Number(dueYear) || 2026,
        status: 'Active',
        notes: dueNotes.trim(),
      });
    }

    if (savedDue) {
      generatePendingMonthlyDueRecords(savedDue);
    }

    refreshFinanceData();
    setShowMonthlyDueModal(false);
  };

  // Helper to generate pending monthly due records for all approved non-admin members
  const generatePendingMonthlyDueRecords = (due: { id: string; month: string; year: number; amount: number; title: string }) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const recItem = localStorage.getItem('bcc_finance_records_v3');
      let recs: any[] = recItem ? JSON.parse(recItem) : [];
      const allUsers = store.getUsers();
      const approved = allUsers.filter(u => {
        const isUserAdmin =
          u.role === 'admin' ||
          u.role?.toLowerCase() === 'admin' ||
          u.role?.toLowerCase() === 'administrator' ||
          u.id === 'usr_admin' ||
          u.id === 'admin' ||
          u.username?.toLowerCase() === 'admin' ||
          u.email?.toLowerCase().includes('admin@');
        if (isUserAdmin) return false;
        return u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin');
      });

      const coveredMonthStr = `${due.month} ${due.year}`;
      let updated = false;

      approved.forEach(u => {
        const existingIdx = recs.findIndex(r =>
          r.userId === u.id &&
          r.itemType === 'Monthly Due' &&
          (r.coveredMonth === coveredMonthStr || r.customItemName === due.title || r.id === `rec_md_${due.id}_${u.id}`)
        );

        if (existingIdx === -1) {
          const newRec = {
            id: `rec_md_${due.id}_${u.id}`,
            itemType: 'Monthly Due',
            userId: u.id,
            userName: u.name,
            userMemberNo: u.memberNumber || 'BRC-MEMBER',
            amount: due.amount,
            coveredMonth: coveredMonthStr,
            customItemName: due.title,
            dueDate: todayStr,
            status: 'Pending',
            paymentMethod: 'GCash',
            notes: `Automated pending monthly due for ${coveredMonthStr}`,
            updatedAt: todayStr,
          };
          recs.push(newRec);
          updated = true;
          fetch('/api/mongodb/financeLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRec),
          }).catch(err => console.warn('MongoDB auto monthly due sync error:', err));
        } else if (recs[existingIdx].status === 'Pending' && recs[existingIdx].amount !== due.amount) {
          recs[existingIdx].amount = due.amount;
          updated = true;
          fetch('/api/mongodb/financeLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recs[existingIdx]),
          }).catch(err => console.warn('MongoDB update monthly due sync error:', err));
        }
      });

      if (updated) {
        localStorage.setItem('bcc_finance_records_v3', JSON.stringify(recs));
      }
    } catch (err) {
      console.error('Error generating pending monthly due records:', err);
    }
  };

  const deletePendingMonthlyDueRecords = (dueId: string) => {
    try {
      const recItem = localStorage.getItem('bcc_finance_records_v3');
      if (!recItem) return;
      let recs: any[] = JSON.parse(recItem);
      const filtered = recs.filter(r => {
        if (r.itemType === 'Monthly Due' && r.status === 'Pending' && r.id.startsWith(`rec_md_${dueId}_`)) {
          fetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
          return false;
        }
        return true;
      });
      localStorage.setItem('bcc_finance_records_v3', JSON.stringify(filtered));
    } catch (e) {
      console.error(e);
    }
  };

  // Dynamic Collection Handlers
  const handleOpenCreateCollection = () => {
    setEditingCollection(null);
    setColName('');
    setColAmount(500);
    setColDescription('');
    setShowCollectionModal(true);
  };

  const handleOpenEditCollection = (col: DynamicCollection) => {
    setEditingCollection(col);
    setColName(col.name);
    setColAmount(col.amount);
    setColDescription(col.description || '');
    setShowCollectionModal(true);
  };

  const handleSubmitCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!colName.trim()) return;

    if (editingCollection) {
      store.updateDynamicCollection({
        ...editingCollection,
        name: colName.trim(),
        amount: Number(colAmount) || 0,
        description: colDescription.trim(),
      });
    } else {
      store.createDynamicCollection({
        name: colName.trim(),
        amount: Number(colAmount) || 0,
        status: 'Active',
        description: colDescription.trim(),
      });
    }
    refreshFinanceData();
    setShowCollectionModal(false);
  };

  // Execute Deletion
  const confirmDeleteAction = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'monthly_due') {
      store.deleteMonthlyDue(deleteTarget.id);
      deletePendingMonthlyDueRecords(deleteTarget.id);
    } else if (deleteTarget.type === 'dynamic_collection') {
      store.deleteDynamicCollection(deleteTarget.id);
    }
    refreshFinanceData();
    setDeleteTarget(null);
  };

  const approvedMemberCount = approvedMembers.length;

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        {/* MEMBER SETTINGS CARD */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e2ece2] shadow-xs space-y-6">
          <div className="pb-4 border-b border-[#e2ece2] flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-lg font-black text-[#1b4332] flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-[#2d6a4f]" />
                Account & App Settings
              </h2>
              <p className="text-xs text-[#52605d] mt-1">
                Manage your member account session and app preferences
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#d8f3dc] text-[#1b4332] text-xs font-bold shrink-0">
              {currentUser?.role || 'Member'}
            </span>
          </div>

          {/* Member Profile Overview */}
          <div className="p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[#52605d] block text-[11px] font-medium">Logged in as</span>
              <span className="font-extrabold text-[#1b4332] text-sm">{currentUser?.name}</span>
            </div>
            <div>
              <span className="text-[#52605d] block text-[11px] font-medium">Username / Member ID</span>
              <span className="font-extrabold text-[#2d6a4f] text-sm">@{currentUser?.username} {currentUser?.memberNumber ? `(#${currentUser.memberNumber})` : ''}</span>
            </div>
          </div>

          {/* Account Session / Sign Out Card */}
          <div className="p-5 rounded-2xl bg-rose-50/60 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <LogOut className="w-4 h-4 text-rose-700" />
                <h3 className="font-heading font-extrabold text-rose-950 text-sm">
                  Account Session
                </h3>
              </div>
              <p className="text-xs text-[#52605d]">
                Sign out of your account session safely when you are done.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2 shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out Account</span>
            </button>
          </div>
        </div>

        {/* SIGN OUT CONFIRMATION MODAL FOR MEMBER */}
        <AnimatePresence>
          {showLogoutModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-5 border border-[#e2ece2] shadow-2xl relative"
              >
                <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 shadow-inner">
                  <LogOut className="w-7 h-7" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-heading text-lg font-extrabold text-[#1b4332]">
                    Sign Out of Account?
                  </h3>
                  <p className="text-xs text-[#52605d] leading-relaxed">
                    Are you sure you want to sign out of your account? You will need to log in again to access the BCC Riders Club app.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#e2ece2]">
                  <button
                    type="button"
                    onClick={() => setShowLogoutModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-[#f7f9f7] font-extrabold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogoutModal(false);
                      logout();
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Interactive Sub-Navigation Dropdown */}
      <div className="relative max-w-sm w-full" ref={subTabDropdownRef}>
        <button
          type="button"
          onClick={() => setIsSubTabDropdownOpen((prev) => !prev)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-[#f7f9f7] rounded-2xl border border-[#e2ece2] shadow-xs text-left transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#1b4332]/20"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-[#1b4332] text-white shrink-0 shadow-xs">
              {activeSubTab === 'finance' && <Wallet className="w-4 h-4 text-[#74c69d]" />}
              {activeSubTab === 'security' && <Shield className="w-4 h-4 text-[#74c69d]" />}
            </div>
            <div className="truncate">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#52605d]">Settings Category</p>
              <p className="text-sm font-extrabold text-[#1b4332] truncate">
                {SUB_TAB_OPTIONS.find((t) => t.id === activeSubTab)?.label}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-[#2d6a4f] shrink-0 transition-transform duration-200 ${
              isSubTabDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        <AnimatePresence>
          {isSubTabDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 4, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full z-30 p-1.5 bg-white rounded-2xl border border-[#e2ece2] shadow-xl space-y-1 mt-1 overflow-hidden"
            >
              {SUB_TAB_OPTIONS.map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveSubTab(tab.id as 'finance' | 'security');
                      setIsSubTabDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[#1b4332] text-white shadow-xs'
                        : 'hover:bg-[#f0f7f2] text-[#1b4332]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isSelected ? 'bg-white/10 text-white' : 'bg-[#e8f5e9] text-[#1b4332]'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-[#74c69d]' : 'text-[#2d6a4f]'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-[#1b4332]'}`}>
                          {tab.label}
                        </p>
                        <p
                          className={`text-[10px] truncate ${
                            isSelected ? 'text-[#d8f3dc]' : 'text-[#52605d]'
                          }`}
                        >
                          {tab.description}
                        </p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#74c69d] shrink-0" />}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SUB TAB 1: FINANCE SETTINGS */}
      {activeSubTab === 'finance' && (
        <div className="space-y-6 sm:space-y-8">
          {/* Section 1: Standard Fee Configuration */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-[#e2ece2] shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#e2ece2]">
              <div>
                <h2 className="font-heading text-base sm:text-lg font-black text-[#1b4332] flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#2d6a4f]" />
                  Standard Fee Rates
                </h2>
              </div>

              {feeSavedToast && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Fee Rates Saved Successfully!</span>
                </motion.div>
              )}
            </div>

            <form onSubmit={handleSaveFees} className="space-y-4 max-w-md w-full">
              {/* Membership Fee */}
              <div className="space-y-1.5 bg-[#f7f9f7] p-3.5 sm:p-4 rounded-2xl border border-[#e2ece2]">
                <label className="text-xs font-bold text-[#1b4332] block">
                  Membership Fee (₱)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={membershipFeeInput}
                    onChange={(e) => setMembershipFeeInput(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-[#e2ece2] text-sm font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                  />
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-[#52605d]">₱</span>
                </div>
                <span className="text-[10px] text-[#52605d]">Base membership joining fee</span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02]"
                >
                  <Save className="w-4 h-4" />
                  <span>Update & Save Fee Rates</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Monthly Dues Management */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-[#e2ece2] shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#e2ece2]">
              <div>
                <h2 className="font-heading text-base sm:text-lg font-black text-[#1b4332] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#2d6a4f]" />
                  Monthly Dues Management
                </h2>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateDue}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl sm:rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] shrink-0"
              >
                <Plus className="w-4 h-4 text-[#74c69d]" />
                <span>Create Monthly Due</span>
              </button>
            </div>

            {/* Monthly Dues Grid / List */}
            <div className="space-y-4">
              {monthlyDues.length === 0 ? (
                <div className="p-6 sm:p-8 text-center bg-[#f7f9f7] rounded-2xl border border-dashed border-[#e2ece2] space-y-2">
                  <Receipt className="w-8 h-8 text-[#52605d] mx-auto" />
                  <p className="text-xs text-[#52605d] font-bold">No Monthly Dues Configured</p>
                  <p className="text-[11px] text-[#52605d]">
                    Click "Create Monthly Due" to set up a monthly due amount for a specific month and year.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {monthlyDues.map((due) => {
                    const totalPendingCollection = approvedMemberCount * due.amount;
                    return (
                      <div
                        key={due.id}
                        className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e2ece2] shadow-xs hover:border-[#2d6a4f] transition-all space-y-3 sm:space-y-4 relative overflow-hidden"
                      >
                        {/* Header: Period & Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#d8f3dc] text-[#1b4332] text-[10px] font-extrabold mb-1">
                              <Calendar className="w-3 h-3 text-[#2d6a4f]" />
                              {due.month} {due.year}
                            </span>
                            <h3 className="font-heading font-extrabold text-[#1b4332] text-sm sm:text-base leading-tight">
                              {due.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditDue(due)}
                              className="p-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 transition-colors cursor-pointer"
                              title="Edit Monthly Due"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'monthly_due',
                                  id: due.id,
                                  name: due.title,
                                })
                              }
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                              title="Delete Monthly Due"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Calculated Stats Grid */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-3 border-t border-[#e2ece2] text-xs">
                          <div className="bg-[#f7f9f7] p-2.5 sm:p-3 rounded-xl border border-[#e2ece2] min-w-0">
                            <span className="text-[9px] sm:text-[10px] text-[#52605d] font-bold block truncate">
                              Due Amount Per Member
                            </span>
                            <span className="text-sm sm:text-base font-black text-[#1b4332] truncate block">
                              ₱{due.amount.toLocaleString()}
                            </span>
                          </div>

                          <div className="bg-[#e8f5e9] p-2.5 sm:p-3 rounded-xl border border-[#c8e6c9] min-w-0">
                            <span className="text-[9px] sm:text-[10px] text-[#2d6a4f] font-extrabold block truncate">
                              Total Pending Collection
                            </span>
                            <span className="text-sm sm:text-base font-black text-[#1b4332] truncate block">
                              ₱{totalPendingCollection.toLocaleString()}
                            </span>
                            <span className="text-[9px] text-[#2d6a4f] block mt-0.5 truncate">
                              ({approvedMemberCount} members × ₱{due.amount})
                            </span>
                          </div>
                        </div>

                        {due.notes && (
                          <p className="text-[11px] text-[#52605d] italic bg-[#f7f9f7] p-2 rounded-lg border border-[#e2ece2]">
                            "{due.notes}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Dynamic Collections Management */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-[#e2ece2] shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#e2ece2]">
              <div>
                <h2 className="font-heading text-base sm:text-lg font-black text-[#1b4332] flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-[#2d6a4f]" />
                  Dynamic Custom Collections
                </h2>
                <p className="text-xs text-[#52605d] mt-1">
                  Create custom payment drives, special event tickets, or uniform/merchandise collections with custom amounts.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateCollection}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl sm:rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] shrink-0"
              >
                <Plus className="w-4 h-4 text-[#74c69d]" />
                <span>Create Collection</span>
              </button>
            </div>

            {/* Collections Grid */}
            <div className="space-y-4">
              {dynamicCollections.length === 0 ? (
                <div className="p-6 sm:p-8 text-center bg-[#f7f9f7] rounded-2xl border border-dashed border-[#e2ece2] space-y-2">
                  <Layers className="w-8 h-8 text-[#52605d] mx-auto" />
                  <p className="text-xs text-[#52605d] font-bold">No Custom Collections Created</p>
                  <p className="text-[11px] text-[#52605d]">
                    Add dynamic collections for merchandise, fellowship tours, or special fundraisers.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {dynamicCollections.map((col) => {
                    const totalTargetCollection = approvedMemberCount * col.amount;
                    return (
                      <div
                        key={col.id}
                        className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e2ece2] shadow-xs hover:border-[#2d6a4f] transition-all space-y-3 sm:space-y-4 relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold mb-1">
                              <Receipt className="w-3 h-3 text-amber-700" />
                              Custom Collection
                            </span>
                            <h3 className="font-heading font-extrabold text-[#1b4332] text-sm sm:text-base leading-tight">
                              {col.name}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCollection(col)}
                              className="p-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 transition-colors cursor-pointer"
                              title="Edit Collection"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'dynamic_collection',
                                  id: col.id,
                                  name: col.name,
                                })
                              }
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                              title="Delete Collection"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {col.description && (
                          <p className="text-xs text-[#52605d] leading-relaxed">
                            {col.description}
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-3 border-t border-[#e2ece2] text-xs">
                          <div className="bg-[#f7f9f7] p-2.5 sm:p-3 rounded-xl border border-[#e2ece2] min-w-0">
                            <span className="text-[9px] sm:text-[10px] text-[#52605d] font-bold block truncate">
                              Set Collection Amount
                            </span>
                            <span className="text-sm sm:text-base font-black text-[#1b4332] truncate block">
                              ₱{col.amount.toLocaleString()}
                            </span>
                          </div>

                          <div className="bg-amber-50 p-2.5 sm:p-3 rounded-xl border border-amber-200 min-w-0">
                            <span className="text-[9px] sm:text-[10px] text-amber-800 font-extrabold block truncate">
                              Expected Target Collection
                            </span>
                            <span className="text-sm sm:text-base font-black text-[#1b4332] truncate block">
                              ₱{totalTargetCollection.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: SYSTEM SECURITY */}
      {activeSubTab === 'security' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e2ece2] shadow-xs space-y-6">
          <div className="pb-4 border-b border-[#e2ece2]">
            <h2 className="font-heading text-lg font-black text-[#1b4332] flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#2d6a4f]" />
              System & Security Settings
            </h2>
            <p className="text-xs text-[#52605d] mt-1">
              Manage your administrator session and account security
            </p>
          </div>

          {/* Sign Out Card */}
          <div className="p-5 rounded-2xl bg-rose-50/60 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <LogOut className="w-4 h-4 text-rose-700" />
                <h3 className="font-heading font-extrabold text-rose-950 text-sm">
                  Executive Account Session
                </h3>
              </div>
              <p className="text-xs text-[#52605d]">
                Sign out of your administrator account session safely when done.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2 shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out Account</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT MONTHLY DUE */}
      <AnimatePresence>
        {showMonthlyDueModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#e2ece2] space-y-6 relative my-8"
            >
              <button
                type="button"
                onClick={() => setShowMonthlyDueModal(false)}
                className="absolute top-5 right-5 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-[#1b4332] text-lg">
                    {editingDue ? 'Edit Monthly Due' : 'Create Monthly Due'}
                  </h3>
                  <p className="text-xs text-[#52605d]">
                    Set monthly due amount for a specific month and year period
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitDue} className="space-y-4 text-xs">
                {/* Amount Due */}
                <div>
                  <label className="font-bold text-[#1b4332] mb-1 block">
                    Amount Due Per Member (₱) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={dueAmount}
                      onChange={(e) => setDueAmount(Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-sm font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                    />
                    <span className="absolute left-3 top-3 text-xs font-bold text-[#52605d]">₱</span>
                  </div>
                </div>

                {/* Amount Due Period: Month & Year Dropdown Selection */}
                <div className="grid grid-cols-2 gap-3 bg-[#f0f9f1] p-3.5 rounded-2xl border border-[#c8e6c9]">
                  <CustomSelect
                    label="Select Month"
                    required
                    value={dueMonth}
                    onChange={(val) => setDueMonth(val)}
                    options={MONTH_OPTIONS}
                  />

                  <CustomSelect
                    label="Select Year"
                    required
                    value={dueYear}
                    onChange={(val) => setDueYear(val)}
                    options={YEAR_OPTIONS}
                  />
                </div>

                {/* Live Calculated Pending Collection Preview */}
                <div className="p-3.5 bg-[#1b4332] text-white rounded-2xl space-y-1">
                  <span className="text-[10px] text-[#74c69d] font-bold uppercase tracking-wider block">
                    Calculated Total Pending Collection
                  </span>
                  <div className="text-lg font-black text-white">
                    ₱{(approvedMemberCount * (Number(dueAmount) || 0)).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-[#d8f3dc] block">
                    Based on {approvedMemberCount} approved member account(s)
                  </span>
                </div>



                {/* Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e2ece2]">
                  <button
                    type="button"
                    onClick={() => setShowMonthlyDueModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#74c69d]" />
                    <span>{editingDue ? 'Save Changes' : 'Save Monthly Due'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE / EDIT DYNAMIC COLLECTION */}
      <AnimatePresence>
        {showCollectionModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#e2ece2] space-y-6 relative my-8"
            >
              <button
                type="button"
                onClick={() => setShowCollectionModal(false)}
                className="absolute top-5 right-5 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-[#1b4332] text-lg">
                    {editingCollection ? 'Edit Dynamic Collection' : 'Create Dynamic Collection'}
                  </h3>
                  <p className="text-xs text-[#52605d]">
                    Name the custom collection and set amount & target period
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitCollection} className="space-y-4 text-xs">
                {/* Collection Name */}
                <div>
                  <label className="font-bold text-[#1b4332] mb-1 block">
                    Collection Name / Title <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={colName}
                    onChange={(e) => setColName(e.target.value)}
                    placeholder="e.g., Annual Fellowship Gala Shirt, Outreach Relief Fund"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-sm font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="font-bold text-[#1b4332] mb-1 block">
                    Amount Per Contributor (₱) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={colAmount}
                      onChange={(e) => setColAmount(Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-sm font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                    />
                    <span className="absolute left-3 top-3 text-xs font-bold text-[#52605d]">₱</span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="font-bold text-[#1b4332] mb-1 block">
                    Description / Details
                  </label>
                  <textarea
                    rows={2}
                    value={colDescription}
                    onChange={(e) => setColDescription(e.target.value)}
                    placeholder="Details about what this custom collection covers..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] resize-none"
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e2ece2]">
                  <button
                    type="button"
                    onClick={() => setShowCollectionModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#74c69d]" />
                    <span>{editingCollection ? 'Save Collection' : 'Create Collection'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRMATION DELETE MODAL */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 border border-[#e2ece2] shadow-2xl relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-extrabold text-[#1b4332] text-base">
                  Confirm Item Deletion?
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-rose-700">"{deleteTarget.name}"</strong>?
                  This financial item will be removed from your system records.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAction}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
                >
                  Yes, Delete Item
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* SIGN OUT CONFIRMATION MODAL */}
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-5 border border-[#e2ece2] shadow-2xl relative"
            >
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 shadow-inner">
                <LogOut className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-heading text-lg font-extrabold text-[#1b4332]">
                  Sign Out of Account?
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Are you sure you want to sign out of your executive account? You will need to log in again to access the BCC Riders Club app.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#e2ece2]">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-[#f7f9f7] font-extrabold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutModal(false);
                    logout();
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
