import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLoader } from '../context/LoaderContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { store, safeFetchJson, authFetch, getCachedData, setCachedData } from '../lib/db';
import { loadFromSession, saveToSession } from '../lib/storageSecurity';
import { triggerFinancePushNotification } from '../lib/pushNotifications';
import { User, FinanceYearArchive, ArchivePackageData, TreasurerActionRequest } from '../types';
import { CustomSelect } from './CustomSelect';
import { InteractiveDatePicker } from './InteractiveDatePicker';
import { OfficialLoader, CardValueSkeleton, CardSubSkeleton, CardMiniSpinner } from './OfficialLoader';
import { YearlyArchiveModal } from './YearlyArchiveModal';
import { ArchiveExportModal } from './ArchiveExportModal';
import { TreasurerAuthModal } from './TreasurerAuthModal';
import { TreasurerRequestsManagerModal } from './TreasurerRequestsManagerModal';
import { ModalPortal } from './ModalPortal';
import { extractZipArchive } from '../lib/yearlyArchiveUtils';
import {
  Wallet,
  Plus,
  Coins,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Lock,
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
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  TrendingDown,
  FileText,
  DollarSign,
  Building,
  ShoppingBag,
  PieChart,
  Sparkles,
  HeartHandshake,
  Archive,
  FolderArchive,
  Upload,
  Download,
  FileArchive,
  Layers,
} from 'lucide-react';

export type FinanceItemType = 'Membership Fee' | 'Monthly Due' | 'Vest Payment' | 'Annual Upfront Promo' | 'Donation Collection' | 'Other';

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

export type ExpenseCategory =
  | 'Event Logistics'
  | 'Equipment & Gear'
  | 'Venue & Rental'
  | 'Food & Catering'
  | 'Administrative'
  | 'Fuel & Travel'
  | 'Utilities'
  | 'Other';

export interface ExpenseRecord {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  receiptRef?: string;
  payeeOrDisbursedTo?: string;
  loggedBy?: string;
  notes?: string;
  updatedAt: string;
}

const LOCAL_STORAGE_REC_KEY = 'bcc_finance_records_v3';
const LOCAL_STORAGE_EXPENSE_KEY = 'bcc_expense_records_v1';

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

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Event Logistics',
  'Equipment & Gear',
  'Venue & Rental',
  'Food & Catering',
  'Administrative',
  'Fuel & Travel',
  'Utilities',
  'Other',
];

const INITIAL_EXPENSES: ExpenseRecord[] = [];

export const Finances: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const { runWithLoader, refreshTick } = useLoader();
  const isMember = !currentUser?.role || currentUser?.role === 'Member' || currentUser?.role?.toLowerCase() === 'member';
  const isOfficer = !isMember;
  const isTreasurer = currentUser?.role === 'Treasurer' || currentUser?.role?.toLowerCase() === 'treasurer';
  const canManageFinances = isAdmin || isTreasurer;

  const [users, setUsers] = useState<User[]>(() => {
    return store.getUsers().filter(u => {
      const isUserAdmin =
        u.role === 'admin' ||
        u.role?.toLowerCase() === 'admin' ||
        u.role?.toLowerCase() === 'administrator' ||
        u.id === 'usr_admin' ||
        u.id === 'admin' ||
        u.username?.toLowerCase() === 'admin' ||
        u.email?.toLowerCase().includes('admin@');
      return !isUserAdmin;
    });
  });

  const [records, setRecords] = useState<FinanceRecord[]>(() => {
    return (
      getCachedData<FinanceRecord[]>('/api/mongodb/financeLogs', null as any) ||
      getCachedData<FinanceRecord[]>(LOCAL_STORAGE_REC_KEY, null as any) ||
      loadFromSession<FinanceRecord[]>(LOCAL_STORAGE_REC_KEY, [])
    );
  });

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    return (
      getCachedData<ExpenseRecord[]>('/api/mongodb/liquidationLogs', null as any) ||
      getCachedData<ExpenseRecord[]>('/api/mongodb/expenseLogs', null as any) ||
      getCachedData<ExpenseRecord[]>(LOCAL_STORAGE_EXPENSE_KEY, null as any) ||
      loadFromSession<ExpenseRecord[]>(LOCAL_STORAGE_EXPENSE_KEY, [])
    );
  });

  // Local Loading States for Individual Cards (does not block whole page)
  const [isLoadingFinances, setIsLoadingFinances] = useState<boolean>(() => records.length === 0);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState<boolean>(() => expenses.length === 0);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(() => users.length === 0);

  // Main Mode Toggle: "funds", "expenses", or "accounts"
  const [activeTab, setActiveTab] = useState<'funds' | 'expenses' | 'accounts'>(() => {
    const saved = loadFromSession<string>('bcc_finances_tab', 'funds');
    return (saved === 'funds' || saved === 'expenses' || saved === 'accounts') ? (saved as any) : 'funds';
  });

  useEffect(() => {
    saveToSession('bcc_finances_tab', activeTab);
  }, [activeTab]);

  // Filters & Search for Accounts
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [accountMemberId, setAccountMemberId] = useState<string>(() => (isAdmin || currentUser?.role === 'admin' || isOfficer) ? 'all_members' : 'my_account');
  const [accountMembersCurrentPage, setAccountMembersCurrentPage] = useState(1);
  const [accountTxCurrentPage, setAccountTxCurrentPage] = useState(1);

  useEffect(() => {
    if ((isAdmin || currentUser?.role === 'admin' || isOfficer) && accountMemberId === 'my_account') {
      setAccountMemberId('all_members');
    }
  }, [isAdmin, currentUser, isOfficer, accountMemberId]);

  // Filters & Search for Funds
  const [searchQuery, setSearchQuery] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Waived'>('All');
  const [currentPage, setCurrentPage] = useState(1);

  // Filters & Search for Expenses
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('All');
  const [expenseCurrentPage, setExpenseCurrentPage] = useState(1);

  const itemsPerPage = 10;

  useEffect(() => {
    setExpenseCurrentPage(1);
  }, [expenseSearchQuery, expenseCategoryFilter]);

  // Modal State for Funds
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [showConfirmRecordModal, setShowConfirmRecordModal] = useState(false);
  const [isWaiveAction, setIsWaiveAction] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);
  const [recordSuccessNotice, setRecordSuccessNotice] = useState<string | null>(null);
  const [financeNoticeModal, setFinanceNoticeModal] = useState<{ title: string; message: string; isError?: boolean } | null>(null);
  const [showDeleteAllConfirmModal, setShowDeleteAllConfirmModal] = useState(false);

  useEffect(() => {
    if (recordSuccessNotice) {
      const timer = setTimeout(() => {
        setRecordSuccessNotice(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [recordSuccessNotice]);

  // Form State for Payment Record
  const [recUserId, setRecUserId] = useState('');
  const [recItemType, setRecItemType] = useState<FinanceItemType>('Monthly Due');
  const [recOptionKey, setRecOptionKey] = useState<string>('opt_membership_fee');
  const [recMonth, setRecMonth] = useState('August');
  const [recYear, setRecYear] = useState('2026');
  const [recCustomItemName, setRecCustomItemName] = useState('');
  const [recAmount, setRecAmount] = useState('200');
  const [recStatus, setRecStatus] = useState<'Paid' | 'Pending' | 'Overdue' | 'Waived'>('Paid');
  const [recMethod, setRecMethod] = useState<'GCash' | 'Cash' | 'Bank Transfer' | 'Credit Card' | 'Other'>('Cash');
  const [recRefNo, setRecRefNo] = useState('');
  const [recNotes, setRecNotes] = useState('');
  const [recDueDate, setRecDueDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Modal State for Expenses
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);

  // Form State for Expense Liquidation
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Event Logistics');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expReceiptRef, setExpReceiptRef] = useState('');
  const [expPayee, setExpPayee] = useState('');
  const [expLoggedBy, setExpLoggedBy] = useState(() => {
    const allUsers = store.getUsers();
    const officerUsers = allUsers.filter(u => u.role && u.role.toLowerCase() !== 'member');
    return officerUsers.length > 0 ? officerUsers[0].name : 'No officers assigned yet';
  });
  const [expNotes, setExpNotes] = useState('');

  // Officers options list for Liquidate Expense modal
  const officerOptions = useMemo(() => {
    const allUsers = store.getUsers();
    const officerUsers = allUsers.filter(u => u.role && u.role.toLowerCase() !== 'member');

    if (officerUsers.length === 0) {
      return [{ value: 'No officers assigned yet', label: 'No officers assigned yet' }];
    }

    const optionsMap = new Map<string, { value: string; label: string }>();

    officerUsers.forEach(u => {
      const roleTitle = u.role === 'admin' ? 'System Admin' : u.role;
      const label = `${u.name} (${roleTitle})`;
      optionsMap.set(u.name, { value: u.name, label });
    });

    if (expLoggedBy && !optionsMap.has(expLoggedBy)) {
      optionsMap.set(expLoggedBy, { value: expLoggedBy, label: expLoggedBy });
    }

    return Array.from(optionsMap.values());
  }, [users, expLoggedBy]);

  // Archive & Audit State
  const [financeArchives, setFinanceArchives] = useState<FinanceYearArchive[]>(() => store.getFinanceArchives());
  const [showYearlyArchiveModal, setShowYearlyArchiveModal] = useState(false);
  const [showArchiveExportModal, setShowArchiveExportModal] = useState(false);
  const [importedArchiveData, setImportedArchiveData] = useState<ArchivePackageData | null>(null);
  const [archiveSuccessToast, setArchiveSuccessToast] = useState<{ year: number; surplus: number } | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'fund' | 'expense';
    id: string;
    title: string;
    subtitle?: string;
    amount: number;
  } | null>(null);

  // Treasurer Access Control & Security State
  const [showTreasurerRequestsModal, setShowTreasurerRequestsModal] = useState(false);
  const [treasurerAuthTarget, setTreasurerAuthTarget] = useState<{
    actionType: 'edit' | 'delete';
    targetType: 'fund' | 'expense';
    targetId: string;
    targetTitle: string;
    targetSubtitle?: string;
    targetAmount?: number;
    targetDate?: string;
    targetRef?: string;
    onGrant: () => void;
  } | null>(null);

  // Official Loader Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');

  useModalDismiss(showAddRecordModal, () => {
    setShowAddRecordModal(false);
    setEditingRecord(null);
  });
  useModalDismiss(showConfirmRecordModal, () => setShowConfirmRecordModal(false));
  useModalDismiss(showExpenseModal, () => {
    setShowExpenseModal(false);
    setEditingExpense(null);
  });
  useModalDismiss(Boolean(deleteTarget), () => setDeleteTarget(null));
  useModalDismiss(showYearlyArchiveModal, () => setShowYearlyArchiveModal(false));
  useModalDismiss(showArchiveExportModal, () => setShowArchiveExportModal(false));
  useModalDismiss(showTreasurerRequestsModal, () => setShowTreasurerRequestsModal(false));
  useModalDismiss(Boolean(treasurerAuthTarget), () => setTreasurerAuthTarget(null));

  // Load Users, Funds, and Expenses
  useEffect(() => {
    if (!currentUser) return;

    const getApprovedUsers = () => {
      return store.getUsers().filter(u => {
        const isUserAdmin =
          u.role === 'admin' ||
          u.role?.toLowerCase() === 'admin' ||
          u.role?.toLowerCase() === 'administrator' ||
          u.id === 'usr_admin' ||
          u.id === 'admin' ||
          u.username?.toLowerCase() === 'admin' ||
          u.email?.toLowerCase().includes('admin@');
        return !isUserAdmin && u.approvalStatus !== 'Pending';
      });
    };

    const initialUsers = store.getUsers().filter(u => {
      const isUserAdmin =
        u.role === 'admin' ||
        u.role?.toLowerCase() === 'admin' ||
        u.role?.toLowerCase() === 'administrator' ||
        u.id === 'usr_admin' ||
        u.id === 'admin' ||
        u.username?.toLowerCase() === 'admin' ||
        u.email?.toLowerCase().includes('admin@');
      return !isUserAdmin;
    });
    setUsers(initialUsers);

    // 1. Load Funds Records
    let savedRecs: FinanceRecord[] = loadFromSession<FinanceRecord[]>(LOCAL_STORAGE_REC_KEY, []);

    const ensureApprovedMembersHaveFeesAndMonthlyDues = (currentRecs: FinanceRecord[]) => {
      let updatedList = [...currentRecs];
      let hasNew = false;
      const todayStr = new Date().toISOString().split('T')[0];
      const allCurrentUsers = store.getUsers();
      const approvedUsers = getApprovedUsers();

      // 0. Clean up any Pending records if a Paid record already exists for the same user and item
      const paidKeys = new Set<string>();
      updatedList.forEach(r => {
        if (r.status === 'Paid') {
          if (r.itemType === 'Membership Fee') {
            paidKeys.add(`${r.userId}_mf`);
          } else if (r.itemType === 'Monthly Due' && (r.coveredMonth || r.customItemName)) {
            if (r.coveredMonth) paidKeys.add(`${r.userId}_md_${r.coveredMonth}`);
            if (r.customItemName) paidKeys.add(`${r.userId}_md_${r.customItemName}`);
          } else if (r.itemType === 'Other' && (r.customItemName || r.coveredMonth)) {
            if (r.customItemName) paidKeys.add(`${r.userId}_col_${r.customItemName}`);
            if (r.coveredMonth) paidKeys.add(`${r.userId}_col_${r.coveredMonth}`);
          }
        }
      });

      const lenBefore = updatedList.length;
      updatedList = updatedList.filter(r => {
        if (r.status === 'Pending' || r.status === 'Overdue') {
          if (r.itemType === 'Membership Fee' && paidKeys.has(`${r.userId}_mf`)) {
            authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
            return false;
          }
          if (r.itemType === 'Monthly Due' && ((r.coveredMonth && paidKeys.has(`${r.userId}_md_${r.coveredMonth}`)) || (r.customItemName && paidKeys.has(`${r.userId}_md_${r.customItemName}`)))) {
            authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
            return false;
          }
          if (r.itemType === 'Other' && ((r.customItemName && paidKeys.has(`${r.userId}_col_${r.customItemName}`)) || (r.coveredMonth && paidKeys.has(`${r.userId}_col_${r.coveredMonth}`)))) {
            authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
            return false;
          }
        }
        return true;
      });
      if (updatedList.length !== lenBefore) {
        hasNew = true;
      }

      // 0.5. Clean up / purge any Pending or Overdue monthly dues or collections whose configured MonthlyDue or DynamicCollection was deleted in Settings
      const activeMDues = store.getMonthlyDues();
      const activeDynamicCols = store.getDynamicCollections();

      const lenBeforeOrphans = updatedList.length;
      updatedList = updatedList.filter(r => {
        if (r.status === 'Pending' || r.status === 'Overdue') {
          if (r.itemType === 'Monthly Due') {
            const isMatch = activeMDues.some(due => {
              const coveredStr = `${due.month} ${due.year}`;
              return (
                (due.id && r.id.startsWith(`rec_md_${due.id}_`)) ||
                r.coveredMonth === coveredStr ||
                r.customItemName === due.title
              );
            });
            if (!isMatch) {
              authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
              return false;
            }
          } else if (r.itemType === 'Other') {
            const isMatch = activeDynamicCols.some(col => {
              return (
                (col.id && r.id.startsWith(`rec_col_${col.id}_`)) ||
                r.customItemName === col.name ||
                r.coveredMonth === col.name
              );
            });
            if (!isMatch) {
              authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
              return false;
            }
          } else if (r.itemType === 'Membership Fee') {
            // Membership fee for approved members is marked Paid upon approval; purge stray pending fee records
            authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
            return false;
          } else {
            // Purge any other orphan pending/overdue records
            authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
            return false;
          }
        }
        return true;
      });

      if (updatedList.length !== lenBeforeOrphans) {
        hasNew = true;
      }

      // 0.6. Clean up / purge any orphan records with 'Satisfied by Annual Upfront Promo Package' where the user has no paid Annual Upfront Promo
      const lenBeforePromoCleanup = updatedList.length;
      const paidPromoUserYears = new Set(
        updatedList
          .filter(r => r.itemType === 'Annual Upfront Promo' && r.status === 'Paid')
          .map(r => {
            const yr = r.coveredMonth?.match(/\d{4}/)?.[0] || r.paidDate?.slice(0, 4) || r.dueDate?.slice(0, 4) || String(new Date().getFullYear());
            return `${r.userId}_${yr}`;
          })
      );

      updatedList = updatedList.filter(r => {
        if (r.notes?.includes('Satisfied by Annual Upfront Promo Package')) {
          const recYear = r.coveredMonth?.match(/\d{4}/)?.[0] || r.paidDate?.slice(0, 4) || r.dueDate?.slice(0, 4) || String(new Date().getFullYear());
          const key = `${r.userId}_${recYear}`;
          if (!paidPromoUserYears.has(key)) {
            authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
            return false;
          }
        }
        return true;
      });

      if (updatedList.length !== lenBeforePromoCleanup) {
        hasNew = true;
      }

      // 0.7. Clean up / purge any records that were permanently deleted by Admin/Treasurer
      let deletedFeeUserIds: string[] = [];
      try {
        deletedFeeUserIds = loadFromSession<string[]>('bcc_deleted_membership_fee_user_ids', []);
      } catch (e) {
        console.error(e);
      }

      let deletedRecordIds: string[] = [];
      try {
        deletedRecordIds = loadFromSession<string[]>('bcc_deleted_finance_record_ids', []);
      } catch (e) {
        console.error(e);
      }

      if (deletedRecordIds.length > 0 || deletedFeeUserIds.length > 0) {
        const lenBeforeDelCheck = updatedList.length;
        updatedList = updatedList.filter(r => {
          if (deletedRecordIds.includes(r.id)) {
            authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
            return false;
          }
          if (r.itemType === 'Membership Fee' && deletedFeeUserIds.includes(r.userId)) {
            authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
            return false;
          }
          return true;
        });
        if (updatedList.length !== lenBeforeDelCheck) {
          hasNew = true;
        }
      }

      // 0.8. Clean up / purge any records belonging to Pending applicants or non-approved members
      const pendingUsersList = allCurrentUsers.filter(u => u.approvalStatus === 'Pending');
      const pendingIdsSet = new Set(pendingUsersList.map(u => u.id));
      const approvedIdsSet = new Set(approvedUsers.map(u => u.id));

      const lenBeforePendingPurge = updatedList.length;
      updatedList = updatedList.filter(r => {
        if (r.userId && pendingIdsSet.has(r.userId) && !approvedIdsSet.has(r.userId)) {
          authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
          return false;
        }
        return true;
      });
      if (updatedList.length !== lenBeforePendingPurge) {
        hasNew = true;
      }

      // If no approved registered members exist, mute pending generation
      if (approvedUsers.length === 0) {
        if (hasNew) {
          setRecords(updatedList);
          saveToSession(LOCAL_STORAGE_REC_KEY, updatedList);
        }
        return;
      }

      // 1. Monthly Dues
      const mDues = store.getMonthlyDues();
      mDues.forEach(due => {
        const coveredMonthStr = `${due.month} ${due.year}`;
        approvedUsers.forEach(u => {
          // Check if this member has availed the Annual Upfront Promo for this year
          const hasAnnualPromo = updatedList.some(r =>
            r.userId === u.id &&
            r.itemType === 'Annual Upfront Promo' &&
            r.status === 'Paid' &&
            (r.coveredMonth?.includes(String(due.year)) || r.customItemName?.includes(String(due.year)) || !r.coveredMonth)
          );

          const expectedId = `rec_md_${due.id}_${u.id}`;
          if (deletedRecordIds.includes(expectedId)) {
            return; // Skip if explicitly deleted by admin
          }

          const existsIdx = updatedList.findIndex(r =>
            r.userId === u.id &&
            r.itemType === 'Monthly Due' &&
            (r.coveredMonth === coveredMonthStr || r.customItemName === due.title || r.id === expectedId)
          );

          if (existsIdx === -1) {
            hasNew = true;
            const newDueRec: FinanceRecord = {
              id: expectedId,
              itemType: 'Monthly Due',
              userId: u.id,
              userName: u.name,
              userMemberNo: u.memberNumber || 'BRC-MEMBER',
              amount: due.amount,
              coveredMonth: coveredMonthStr,
              customItemName: due.title,
              dueDate: todayStr,
              paidDate: hasAnnualPromo ? todayStr : undefined,
              status: hasAnnualPromo ? 'Paid' : 'Pending',
              paymentMethod: 'GCash',
              notes: hasAnnualPromo
                ? 'Satisfied by Annual Upfront Promo Package'
                : `Automated pending monthly due for ${coveredMonthStr}`,
              updatedAt: todayStr,
            };
            updatedList.push(newDueRec);
            if (hasAnnualPromo) {
              authFetch('/api/mongodb/monthlyDueLogs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDueRec),
              }).catch(err => console.warn('MongoDB auto monthly due log sync error:', err));
            }
          } else {
            const existingRec = updatedList[existsIdx];
            if (hasAnnualPromo && (existingRec.status === 'Pending' || existingRec.status === 'Overdue')) {
              hasNew = true;
              const updatedRec: FinanceRecord = {
                ...existingRec,
                status: 'Paid',
                paidDate: existingRec.paidDate || todayStr,
                notes: 'Satisfied by Annual Upfront Promo Package',
                updatedAt: todayStr,
              };
              updatedList[existsIdx] = updatedRec;
              authFetch('/api/mongodb/financeLogs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRec),
              }).catch(err => console.warn('MongoDB sync notice:', err));
            } else if (!hasAnnualPromo && existingRec.notes?.includes('Satisfied by Annual Upfront Promo Package')) {
              // Promo was deleted or is not present; remove this auto-generated satisfied record completely
              hasNew = true;
              authFetch(`/api/mongodb/financeLogs/${existingRec.id}`, { method: 'DELETE' }).catch(() => {});
              updatedList.splice(existsIdx, 1);
            } else if (!hasAnnualPromo && existingRec.status === 'Pending' && existingRec.amount !== due.amount) {
              hasNew = true;
              const updatedRec = { ...existingRec, amount: due.amount };
              updatedList[existsIdx] = updatedRec;
              authFetch('/api/mongodb/financeLogs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRec),
              }).catch(err => console.warn('MongoDB sync notice:', err));
            }
          }
        });
      });

      // 3. Dynamic Custom Collections
      const dynamicCols = store.getDynamicCollections();
      const approvedCount = approvedUsers.length;
      dynamicCols.forEach(col => {
        if (col.status === 'Completed' || col.status === 'Archived' || col.collectionType === 'Donation' || col.name?.toLowerCase().includes('donation')) return;

        const targetTotal =
          col.targetAmount !== undefined && col.targetAmount !== null && !isNaN(Number(col.targetAmount)) && Number(col.targetAmount) > 0
            ? Number(col.targetAmount)
            : approvedCount * col.amount;

        const perMemberAmount = col.amount > 0 ? col.amount : Math.ceil(targetTotal / (approvedCount || 1));

        approvedUsers.forEach(u => {
          const existsIdx = updatedList.findIndex(r =>
            r.userId === u.id &&
            (r.id === `rec_col_${col.id}_${u.id}` || (r.itemType === 'Other' && r.customItemName === col.name))
          );

          if (existsIdx === -1) {
            hasNew = true;
            const newColRec: FinanceRecord = {
              id: `rec_col_${col.id}_${u.id}`,
              itemType: 'Other',
              userId: u.id,
              userName: u.name,
              userMemberNo: u.memberNumber || 'BRC-MEMBER',
              amount: perMemberAmount,
              coveredMonth: col.name,
              customItemName: col.name,
              dueDate: todayStr,
              status: 'Pending',
              paymentMethod: 'GCash',
              notes: `Automated pending collection for ${col.name}`,
              updatedAt: todayStr,
            };
            updatedList.push(newColRec);
            authFetch('/api/mongodb/financeLogs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newColRec),
            }).catch(err => console.warn('MongoDB auto collection sync error:', err));
          } else {
            const existingRec = updatedList[existsIdx];
            if (existingRec.status === 'Pending' && existingRec.amount !== perMemberAmount) {
              hasNew = true;
              const updatedRec = { ...existingRec, amount: perMemberAmount };
              updatedList[existsIdx] = updatedRec;
              authFetch('/api/mongodb/financeLogs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRec),
              }).catch(err => console.warn('MongoDB sync notice:', err));
            }
          }
        });
      });

      // 4. Membership Fee Auto-Creation & Normalization
      const configuredMembershipFee = Number(store.getFinanceSettings()?.membershipFee) || 200;

      // Ensure every approved member has their Membership Fee transaction recorded
      approvedUsers.forEach(u => {
        if (deletedFeeUserIds.includes(u.id) || (u.username && deletedFeeUserIds.includes(u.username))) return;
        const exists = updatedList.some(r =>
          r.itemType === 'Membership Fee' &&
          (r.userId === u.id || (u.username && r.userId === u.username) || (r.userMemberNo && u.memberNumber && r.userMemberNo.trim().toUpperCase() === u.memberNumber.trim().toUpperCase()) || (r.userName && u.name && r.userName.trim().toLowerCase() === u.name.trim().toLowerCase()))
        );
        if (!exists) {
          hasNew = true;
          const feeRec: FinanceRecord = {
            id: `rec_mf_${u.id}`,
            itemType: 'Membership Fee',
            userId: u.id,
            userName: u.name,
            userMemberNo: u.memberNumber || 'BRC-MEMBER',
            amount: configuredMembershipFee,
            dueDate: u.joinDate || todayStr,
            paidDate: todayStr,
            status: 'Paid',
            paymentMethod: 'Cash',
            notes: 'Payment recorded upon member approval',
            updatedAt: todayStr,
          };
          updatedList.unshift(feeRec);
          authFetch('/api/mongodb/financeLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feeRec),
          }).catch(err => console.warn('MongoDB fee auto-sync notice:', err));
        }
      });

      updatedList.forEach((r, idx) => {
        if (r.itemType === 'Membership Fee' && (r.amount === undefined || r.amount === null || isNaN(Number(r.amount)))) {
          hasNew = true;
          const updatedRec: FinanceRecord = {
            ...r,
            amount: configuredMembershipFee,
            updatedAt: todayStr,
          };
          updatedList[idx] = updatedRec;
          authFetch('/api/mongodb/financeLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedRec),
          }).catch(err => console.warn('MongoDB fee update sync notice:', err));
        }
      });

      if (hasNew) {
        setRecords(updatedList);
        setCachedData(LOCAL_STORAGE_REC_KEY, updatedList);
        setCachedData('/api/mongodb/financeLogs', updatedList);
        saveToSession(LOCAL_STORAGE_REC_KEY, updatedList);
        localStorage.setItem(LOCAL_STORAGE_REC_KEY, JSON.stringify(updatedList));
      } else {
        setRecords(currentRecs);
      }
    };

    setRecords(savedRecs);

    store.initMongoDb().then(() => {
      const freshUsers = store.getUsers().filter(u => {
        const isUserAdmin =
          u.role === 'admin' ||
          u.role?.toLowerCase() === 'admin' ||
          u.role?.toLowerCase() === 'administrator' ||
          u.id === 'usr_admin' ||
          u.id === 'admin' ||
          u.username?.toLowerCase() === 'admin' ||
          u.email?.toLowerCase().includes('admin@');
        return !isUserAdmin;
      });
      setUsers(freshUsers);
      setIsLoadingUsers(false);
      const latestRecs = loadFromSession<FinanceRecord[]>(LOCAL_STORAGE_REC_KEY, savedRecs);
      ensureApprovedMembersHaveFeesAndMonthlyDues(latestRecs);
    }).catch(() => {
      setIsLoadingUsers(false);
    });

    Promise.all([
      safeFetchJson('/api/mongodb/financeLogs'),
      safeFetchJson('/api/mongodb/monthlyDueLogs'),
    ]).then(([finData, mdData]) => {
      let combined: FinanceRecord[] = [];
      let deletedRecordIds: string[] = [];
      try {
        deletedRecordIds = loadFromSession<string[]>('bcc_deleted_finance_record_ids', []);
      } catch (e) {}

      if (finData.success && Array.isArray(finData.data)) {
        combined = [...combined, ...finData.data];
      }
      if (mdData.success && Array.isArray(mdData.data)) {
        const existingIds = new Set(combined.map(r => r.id));
        mdData.data.forEach((r: FinanceRecord) => {
          if (!existingIds.has(r.id)) {
            combined.push(r);
            existingIds.add(r.id);
          }
        });
      }
      if (combined.length > 0) {
        if (deletedRecordIds.length > 0) {
          combined = combined.filter(r => {
            if (deletedRecordIds.includes(r.id)) {
              authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
              authFetch(`/api/mongodb/monthlyDueLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
              return false;
            }
            return true;
          });
        }
        setRecords(combined);
        setCachedData(LOCAL_STORAGE_REC_KEY, combined);
        setCachedData('/api/mongodb/financeLogs', combined);
        setCachedData('/api/mongodb/monthlyDueLogs', combined);
        saveToSession(LOCAL_STORAGE_REC_KEY, combined);
        localStorage.setItem(LOCAL_STORAGE_REC_KEY, JSON.stringify(combined));
        ensureApprovedMembersHaveFeesAndMonthlyDues(combined);
      } else {
        ensureApprovedMembersHaveFeesAndMonthlyDues(savedRecs);
        if (savedRecs.length > 0) {
          const mdRecs = savedRecs.filter(r => r.itemType === 'Monthly Due' || r.id.startsWith('rec_md_'));
          const otherRecs = savedRecs.filter(r => !(r.itemType === 'Monthly Due' || r.id.startsWith('rec_md_')));
          if (otherRecs.length > 0) {
            authFetch('/api/mongodb/financeLogs/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ records: otherRecs }),
            }).catch(() => {});
          }
          if (mdRecs.length > 0) {
            authFetch('/api/mongodb/monthlyDueLogs/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ records: mdRecs }),
            }).catch(() => {});
          }
        }
      }
    })
      .catch(err => {
        console.warn('MongoDB records fetch error:', err);
        ensureApprovedMembersHaveFeesAndMonthlyDues(savedRecs);
      })
      .finally(() => {
        setIsLoadingFinances(false);
      });

    // 2. Load Expense Records
    const sampleIds = ['exp_101', 'exp_102', 'exp_103', 'exp_104', 'exp_105'];
    let savedExpenses: ExpenseRecord[] = [];
    try {
      const expItem = localStorage.getItem(LOCAL_STORAGE_EXPENSE_KEY);
      if (expItem) savedExpenses = JSON.parse(expItem);
      if (!savedExpenses || savedExpenses.length === 0) {
        savedExpenses = loadFromSession<ExpenseRecord[]>(LOCAL_STORAGE_EXPENSE_KEY, []);
      }
    } catch (e) {
      console.error(e);
    }

    // Filter out sample records
    savedExpenses = (savedExpenses || []).filter(x => !sampleIds.includes(x.id));
    setCachedData(LOCAL_STORAGE_EXPENSE_KEY, savedExpenses);
    setCachedData('/api/mongodb/liquidationLogs', savedExpenses);
    saveToSession(LOCAL_STORAGE_EXPENSE_KEY, savedExpenses);
    localStorage.setItem(LOCAL_STORAGE_EXPENSE_KEY, JSON.stringify(savedExpenses));
    if (savedExpenses.length > 0) {
      setExpenses(savedExpenses);
    }

    safeFetchJson('/api/mongodb/liquidationLogs')
      .then(data => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const cleanData = data.data.filter((x: ExpenseRecord) => !sampleIds.includes(x.id));
          setExpenses(cleanData);
          setCachedData(LOCAL_STORAGE_EXPENSE_KEY, cleanData);
          setCachedData('/api/mongodb/liquidationLogs', cleanData);
          saveToSession(LOCAL_STORAGE_EXPENSE_KEY, cleanData);
          localStorage.setItem(LOCAL_STORAGE_EXPENSE_KEY, JSON.stringify(cleanData));

          sampleIds.forEach(id => {
            authFetch(`/api/mongodb/liquidationLogs/${id}`, { method: 'DELETE' }).catch(() => {});
            authFetch(`/api/mongodb/expenseLogs/${id}`, { method: 'DELETE' }).catch(() => {});
          });
          setIsLoadingExpenses(false);
        } else {
          // Fallback to expenseLogs if liquidationLogs is empty
          safeFetchJson('/api/mongodb/expenseLogs')
            .then(expData => {
              if (expData.success && Array.isArray(expData.data)) {
                const cleanData = expData.data.filter((x: ExpenseRecord) => !sampleIds.includes(x.id));
                setExpenses(cleanData);
                setCachedData(LOCAL_STORAGE_EXPENSE_KEY, cleanData);
                setCachedData('/api/mongodb/liquidationLogs', cleanData);
                saveToSession(LOCAL_STORAGE_EXPENSE_KEY, cleanData);
                localStorage.setItem(LOCAL_STORAGE_EXPENSE_KEY, JSON.stringify(cleanData));

                sampleIds.forEach(id => {
                  authFetch(`/api/mongodb/expenseLogs/${id}`, { method: 'DELETE' }).catch(() => {});
                  authFetch(`/api/mongodb/liquidationLogs/${id}`, { method: 'DELETE' }).catch(() => {});
                });
              }
            })
            .catch(err => console.warn('MongoDB expenseLogs fetch error:', err))
            .finally(() => {
              setIsLoadingExpenses(false);
            });
        }
      })
      .catch(() => {
        safeFetchJson('/api/mongodb/expenseLogs')
          .then(expData => {
            if (expData.success && Array.isArray(expData.data)) {
              const cleanData = expData.data.filter((x: ExpenseRecord) => !sampleIds.includes(x.id));
              setExpenses(cleanData);
              setCachedData(LOCAL_STORAGE_EXPENSE_KEY, cleanData);
              setCachedData('/api/mongodb/liquidationLogs', cleanData);
              saveToSession(LOCAL_STORAGE_EXPENSE_KEY, cleanData);
              localStorage.setItem(LOCAL_STORAGE_EXPENSE_KEY, JSON.stringify(cleanData));
            }
          })
          .catch(err => console.warn('MongoDB expense/liquidation fetch error:', err))
          .finally(() => {
            setIsLoadingExpenses(false);
          });
      });

    setFinanceArchives(store.getFinanceArchives());

    const handleUsersOrFinancesUpdated = () => {
      const freshUsers = store.getUsers().filter(u => {
        const isUserAdmin =
          u.role === 'admin' ||
          u.role?.toLowerCase() === 'admin' ||
          u.role?.toLowerCase() === 'administrator' ||
          u.id === 'usr_admin' ||
          u.id === 'admin' ||
          u.username?.toLowerCase() === 'admin' ||
          u.email?.toLowerCase().includes('admin@');
        return !isUserAdmin;
      });
      setUsers(freshUsers);
      const latestRecs = loadFromSession<FinanceRecord[]>(LOCAL_STORAGE_REC_KEY, []);
      ensureApprovedMembersHaveFeesAndMonthlyDues(latestRecs);
    };

    window.addEventListener('bcc_users_updated', handleUsersOrFinancesUpdated);
    window.addEventListener('bcc_finance_updated', handleUsersOrFinancesUpdated);

    return () => {
      window.removeEventListener('bcc_users_updated', handleUsersOrFinancesUpdated);
      window.removeEventListener('bcc_finance_updated', handleUsersOrFinancesUpdated);
    };
  }, [refreshTick]);

  // Save Funds Records
  const saveRecordsToStorage = (updatedRecs: FinanceRecord[]) => {
    setRecords(updatedRecs);
    saveToSession(LOCAL_STORAGE_REC_KEY, updatedRecs);
  };

  const syncRecordToMongo = (rec: FinanceRecord) => {
    const isMd = rec.itemType === 'Monthly Due' || rec.id.startsWith('rec_md_');
    if (isMd) {
      if (rec.status === 'Paid' || rec.status === 'Waived') {
        return authFetch('/api/mongodb/monthlyDueLogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rec),
        }).catch(err => console.warn('MongoDB monthlyDueLogs sync error:', err));
      } else {
        return authFetch(`/api/mongodb/monthlyDueLogs/${rec.id}`, {
          method: 'DELETE',
        }).catch(() => {});
      }
    } else {
      return authFetch('/api/mongodb/financeLogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rec),
      }).catch(err => console.warn('MongoDB financeLogs sync error:', err));
    }
  };

  const deleteRecordFromMongo = (rec: FinanceRecord | string) => {
    const recordId = typeof rec === 'string' ? rec : rec.id;
    const isMd = recordId.startsWith('rec_md_') || (typeof rec === 'object' && rec.itemType === 'Monthly Due');
    const endpoint1 = isMd ? `/api/mongodb/monthlyDueLogs/${recordId}` : `/api/mongodb/financeLogs/${recordId}`;
    const endpoint2 = isMd ? `/api/mongodb/financeLogs/${recordId}` : `/api/mongodb/monthlyDueLogs/${recordId}`;
    return Promise.all([
      authFetch(endpoint1, { method: 'DELETE' }).catch(() => {}),
      authFetch(endpoint2, { method: 'DELETE' }).catch(() => {}),
    ]);
  };

  const handleDeleteAllFinanceLogs = () => {
    setShowDeleteAllConfirmModal(true);
  };

  const confirmDeleteAllFinanceLogs = async () => {
    setShowDeleteAllConfirmModal(false);
    try {
      const [res1, res2] = await Promise.all([
        authFetch('/api/mongodb/financeLogs/all', { method: 'DELETE' }),
        authFetch('/api/mongodb/monthlyDueLogs/all', { method: 'DELETE' }),
      ]);
      const data1 = await res1.json().catch(() => ({ success: true }));
      const data2 = await res2.json().catch(() => ({ success: true }));
      if (data1.success || data2.success) {
        const existingIds = records.map(r => r.id);
        const mDues = store.getMonthlyDues();
        const approvedUsers = store.getUsers().filter(u => {
          const isUserAdmin =
            u.role === 'admin' ||
            u.role?.toLowerCase() === 'admin' ||
            u.role?.toLowerCase() === 'administrator' ||
            u.id === 'usr_admin' ||
            u.id === 'admin' ||
            u.username?.toLowerCase() === 'admin' ||
            u.email?.toLowerCase().includes('admin@');
          return !isUserAdmin && u.approvalStatus !== 'Pending';
        });
        const autoIds: string[] = [];
        mDues.forEach(due => {
          approvedUsers.forEach(u => {
            autoIds.push(`rec_md_${due.id}_${u.id}`);
          });
        });
        const combinedDeleted = Array.from(new Set([...existingIds, ...autoIds]));
        saveToSession('bcc_deleted_finance_record_ids', combinedDeleted);
        localStorage.setItem('bcc_deleted_finance_record_ids', JSON.stringify(combinedDeleted));

        const allApprovedUserIds = approvedUsers.map(u => u.id);
        saveToSession('bcc_deleted_membership_fee_user_ids', allApprovedUserIds);
        localStorage.setItem('bcc_deleted_membership_fee_user_ids', JSON.stringify(allApprovedUserIds));

        setRecords([]);
        setCachedData(LOCAL_STORAGE_REC_KEY, []);
        setCachedData('/api/mongodb/financeLogs', []);
        setCachedData('/api/mongodb/monthlyDueLogs', []);
        saveToSession(LOCAL_STORAGE_REC_KEY, []);
        localStorage.setItem(LOCAL_STORAGE_REC_KEY, JSON.stringify([]));
        setFinanceNoticeModal({
          title: 'Finance Logs Cleared',
          message: `Successfully deleted all finance and monthly due log documents from MongoDB.`,
        });
      } else {
        setFinanceNoticeModal({
          title: 'Deletion Failed',
          message: 'Failed to delete finance logs.',
          isError: true,
        });
      }
    } catch (err: any) {
      setFinanceNoticeModal({
        title: 'Error',
        message: err.message || 'Error deleting finance logs.',
        isError: true,
      });
    }
  };

  // Save Expense Records
  const saveExpensesToStorage = (updatedExpenses: ExpenseRecord[]) => {
    setExpenses(updatedExpenses);
    saveToSession(LOCAL_STORAGE_EXPENSE_KEY, updatedExpenses);
  };

  const syncExpenseToMongo = (exp: ExpenseRecord) => {
    const p1 = authFetch('/api/mongodb/liquidationLogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exp),
    }).catch(err => console.warn('MongoDB liquidationLogs sync error:', err));

    const p2 = authFetch('/api/mongodb/expenseLogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exp),
    }).catch(err => console.warn('MongoDB expenseLogs sync error:', err));

    return Promise.all([p1, p2]);
  };

  // Yearly Archiving Execution: Purges outgoing year's records from active database & refreshes archives
  const deleteRecordsForYear = async (yearToArchive: number) => {
    const yearStr = String(yearToArchive);

    // 1. Separate current active records from archived year's records
    const recordsToKeep: FinanceRecord[] = [];
    const recordsToDelete: FinanceRecord[] = [];

    records.forEach(r => {
      const pDate = r.paidDate || r.dueDate || r.updatedAt || '';
      const covMonth = r.coveredMonth || '';
      const custName = r.customItemName || '';
      if (pDate.includes(yearStr) || covMonth.includes(yearStr) || custName.includes(yearStr)) {
        recordsToDelete.push(r);
      } else {
        recordsToKeep.push(r);
      }
    });

    // 2. Separate current active expenses from archived year's expenses
    const expensesToKeep: ExpenseRecord[] = [];
    const expensesToDelete: ExpenseRecord[] = [];

    expenses.forEach(e => {
      const eDate = e.date || e.updatedAt || '';
      if (eDate.includes(yearStr)) {
        expensesToDelete.push(e);
      } else {
        expensesToKeep.push(e);
      }
    });

    // 3. Save remaining records to local storage & state
    saveRecordsToStorage(recordsToKeep);
    saveExpensesToStorage(expensesToKeep);

    // 4. Delete outgoing records from MongoDB
    recordsToDelete.forEach(r => {
      deleteRecordFromMongo(r.id);
    });
    expensesToDelete.forEach(e => {
      deleteExpenseFromMongo(e.id);
    });

    // 5. Refresh finance archives list
    setFinanceArchives(store.getFinanceArchives());
  };

  // Archive Completion Handler
  const handleArchiveComplete = (archivedYear: number, netSurplus: number) => {
    const updatedArchives = store.getFinanceArchives();
    setFinanceArchives(updatedArchives);
    setArchiveSuccessToast({ year: archivedYear, surplus: netSurplus });
    setTimeout(() => {
      setArchiveSuccessToast(null);
    }, 8000);
  };

  // Zip Archive Import Handler
  const handleImportZipFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await runWithLoader(
      async () => {
        try {
          const extracted = await extractZipArchive(file);
          setImportedArchiveData(extracted);
          setShowArchiveExportModal(true);
        } catch (err: any) {
          console.error('Error parsing zip archive:', err);
          setFinanceNoticeModal({
            title: 'Archive Import Error',
            message: 'Failed to read or parse the compressed archive (.zip) file. Please ensure it is a valid BCC financial archive package.',
            isError: true,
          });
        } finally {
          if (zipInputRef.current) {
            zipInputRef.current.value = '';
          }
        }
      },
      { message: 'Extracting & Validating Compressed Archive Package...' }
    );
  };

  const deleteExpenseFromMongo = (expenseId: string) => {
    const p1 = authFetch(`/api/mongodb/liquidationLogs/${expenseId}`, {
      method: 'DELETE',
    }).catch(err => console.warn('MongoDB liquidationLogs delete error:', err));

    const p2 = authFetch(`/api/mongodb/expenseLogs/${expenseId}`, {
      method: 'DELETE',
    }).catch(err => console.warn('MongoDB expenseLogs delete error:', err));

    return Promise.all([p1, p2]);
  };

  // Dynamic Finance Collections & Settings for Payment Options Dropdown
  const finSettings = store.getFinanceSettings();
  const monthlyDuesList = store.getMonthlyDues();
  const dynamicColsList = store.getDynamicCollections();

  const registeredMembersList = useMemo(() => {
    return users.filter(u => u.role !== 'admin' && u.role?.toLowerCase() !== 'admin');
  }, [users]);
  const hasMembers = registeredMembersList.length > 0;

  const isPromoEnabled = finSettings?.annualPromoEnabled !== false;

  const isMembershipFeePaidForSelectedMember = useMemo(() => {
    if (!recUserId) return false;
    return records.some(
      r => r.userId === recUserId &&
           r.itemType === 'Membership Fee' &&
           r.status === 'Paid' &&
           (!editingRecord || editingRecord.id !== r.id)
    );
  }, [recUserId, records, editingRecord]);

  const rawPaymentOptionsList: { value: string; label: string; disabled?: boolean }[] = [
    {
      value: 'opt_membership_fee',
      label: isMembershipFeePaidForSelectedMember
        ? `Membership Fee (₱${(Number(finSettings?.membershipFee) || 200).toLocaleString()}) - Already Paid`
        : `Membership Fee (₱${(Number(finSettings?.membershipFee) || 200).toLocaleString()})`,
      disabled: isMembershipFeePaidForSelectedMember,
    },
    { value: 'opt_monthly_due', label: 'Monthly Due' },
    {
      value: 'opt_annual_promo',
      label: `Annual Upfront Promo - ₱1,000 (Full Year Dues${!isPromoEnabled ? ' [Promo Disabled in Settings]' : ' [Special Promo Package]'})`,
      disabled: !isPromoEnabled,
    },
    ...dynamicColsList.map(col => ({
      value: `dc_${col.id}`,
      label: col.collectionType === 'Donation'
        ? `Donation Collection: ${col.name} (₱${(Number(col?.amount) || 0).toLocaleString()})`
        : `Custom Collection: ${col.name} (₱${(Number(col?.amount) || 0).toLocaleString()})`
    })),
    { value: 'opt_other', label: 'Other / Custom Payment' },
  ];

  const paymentOptionsList = rawPaymentOptionsList.map(opt => ({
    ...opt,
    disabled: !hasMembers || Boolean(opt.disabled),
  }));

  const recMonthOptions = useMemo(() => {
    if (recItemType === 'Monthly Due') {
      const createdDuesForYear = monthlyDuesList.filter(d => String(d.year) === String(recYear));

      if (createdDuesForYear.length === 0) {
        return [{ value: '', label: `No monthly dues created for ${recYear}`, disabled: true }];
      }

      const createdMonths = MONTHS_LIST.filter(m => createdDuesForYear.some(d => d.month === m));

      return createdMonths.map(m => {
        const monthStr = `${m} ${recYear}`;
        const paidOrWaivedRec = records.find(r =>
          r.userId === recUserId &&
          (r.status === 'Paid' || r.status === 'Waived') &&
          (
            (r.itemType === 'Monthly Due' && (r.coveredMonth === monthStr || r.customItemName?.includes(monthStr))) ||
            (r.itemType === 'Annual Upfront Promo' && (r.coveredMonth?.includes(recYear) || r.customItemName?.includes(recYear)))
          )
        );

        const isSettled = Boolean(paidOrWaivedRec);
        const settledLabel = paidOrWaivedRec?.status === 'Waived' ? `${m} (Waived)` : `${m} (Already Paid)`;

        return {
          value: m,
          label: isSettled ? settledLabel : m,
          disabled: isSettled,
        };
      });
    }

    return MONTHS_LIST.map(m => {
      const monthStr = `${m} ${recYear}`;
      const paidOrWaivedRec = records.find(r =>
        r.userId === recUserId &&
        (r.status === 'Paid' || r.status === 'Waived') &&
        (
          (r.itemType === 'Monthly Due' && (r.coveredMonth === monthStr || r.customItemName?.includes(monthStr))) ||
          (r.itemType === 'Annual Upfront Promo' && (r.coveredMonth?.includes(recYear) || r.customItemName?.includes(recYear)))
        )
      );

      const isSettled = Boolean(paidOrWaivedRec);
      const settledLabel = paidOrWaivedRec?.status === 'Waived' ? `${m} (Waived)` : `${m} (Already Paid)`;

      return {
        value: m,
        label: isSettled ? settledLabel : m,
        disabled: isSettled,
      };
    });
  }, [recItemType, recYear, recUserId, records, monthlyDuesList]);

  const isSelectedMonthAlreadyPaid = useMemo(() => {
    if (recItemType !== 'Monthly Due') return false;
    const monthStr = `${recMonth} ${recYear}`;
    return records.some(r =>
      r.userId === recUserId &&
      (r.status === 'Paid' || r.status === 'Waived') &&
      (!editingRecord || editingRecord.id !== r.id) &&
      (
        (r.itemType === 'Monthly Due' && (r.coveredMonth === monthStr || r.customItemName?.includes(monthStr))) ||
        (r.itemType === 'Annual Upfront Promo' && (r.coveredMonth?.includes(recYear) || r.customItemName?.includes(recYear)))
      )
    );
  }, [recItemType, recMonth, recYear, recUserId, records, editingRecord]);

  // Validation for Waiving Monthly Dues
  const isWaiveValid = useMemo(() => {
    if (!hasMembers || !recUserId) return false;
    if (recItemType !== 'Monthly Due') return false;
    if (monthlyDuesList.length === 0) return false;
    if (!recMonth || !recYear) return false;
    const dueExists = monthlyDuesList.some(
      d => String(d.year) === String(recYear) && d.month === recMonth
    );
    if (!dueExists) return false;
    if (isSelectedMonthAlreadyPaid) return false;
    return true;
  }, [hasMembers, recUserId, recItemType, monthlyDuesList, recMonth, recYear, isSelectedMonthAlreadyPaid]);

  // Form Validation for Recording Payment
  const isRecordFormValid = useMemo(() => {
    if (!hasMembers || !recUserId) return false;

    const parsedAmount = parseFloat(recAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return false;
    if (!recDueDate || recDueDate.trim() === '') return false;
    if (!recMethod) return false;

    if (recItemType === 'Monthly Due') {
      if (monthlyDuesList.length === 0) return false;
      if (!recMonth || !recYear) return false;
      const dueExists = monthlyDuesList.some(
        d => String(d.year) === String(recYear) && d.month === recMonth
      );
      if (!dueExists) return false;
      if (isSelectedMonthAlreadyPaid) return false;
    } else if (recItemType === 'Annual Upfront Promo') {
      if (!isPromoEnabled) return false;
      if (!recYear) return false;
    } else if (recItemType === 'Membership Fee') {
      if (isMembershipFeePaidForSelectedMember) return false;
    } else if (recItemType === 'Donation Collection' || recItemType === 'Other') {
      if (!recCustomItemName || !recCustomItemName.trim()) return false;
    }

    return true;
  }, [
    hasMembers,
    recUserId,
    recAmount,
    recDueDate,
    recMethod,
    recItemType,
    recMonth,
    recYear,
    monthlyDuesList,
    isSelectedMonthAlreadyPaid,
    isPromoEnabled,
    isMembershipFeePaidForSelectedMember,
    recCustomItemName,
  ]);

  const recordFormInvalidReason = useMemo(() => {
    if (!hasMembers) return 'No registered club members available to receive payment.';
    if (!recUserId) return 'Please select a club member.';
    if (recItemType === 'Membership Fee' && isMembershipFeePaidForSelectedMember) {
      return 'This member has already paid their Membership Fee.';
    }
    if (recItemType === 'Monthly Due') {
      if (monthlyDuesList.length === 0) return 'No monthly dues have been configured yet in Settings.';
      if (!recMonth) return 'Please select an active covered month.';
      const dueExists = monthlyDuesList.some(d => String(d.year) === String(recYear) && d.month === recMonth);
      if (!dueExists) return `No monthly due created for ${recMonth} ${recYear}.`;
      if (isSelectedMonthAlreadyPaid) return `${recMonth} ${recYear} is already recorded as paid for this member.`;
    }
    if (recItemType === 'Annual Upfront Promo' && !isPromoEnabled) {
      return 'The Annual Upfront Promo package is currently disabled in Settings.';
    }
    if ((recItemType === 'Donation Collection' || recItemType === 'Other') && (!recCustomItemName || !recCustomItemName.trim())) {
      return 'Please enter or select a valid collection item name.';
    }
    const parsedAmount = parseFloat(recAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return 'Please specify a valid payment amount greater than ₱0.00.';
    if (!recDueDate || !recDueDate.trim()) return 'Please choose a payment date.';
    if (!recMethod) return 'Please select a payment method.';
    return null;
  }, [
    hasMembers,
    recUserId,
    recItemType,
    isMembershipFeePaidForSelectedMember,
    monthlyDuesList,
    recMonth,
    recYear,
    isSelectedMonthAlreadyPaid,
    isPromoEnabled,
    recCustomItemName,
    recAmount,
    recDueDate,
    recMethod,
  ]);

  const handleRecMonthChange = (m: string) => {
    setRecMonth(m);
    if (recItemType === 'Monthly Due') {
      const matchedDue = monthlyDuesList.find(d => `${d.month} ${d.year}` === `${m} ${recYear}`);
      if (matchedDue) {
        setRecAmount(String(matchedDue.amount));
      } else {
        setRecAmount('0');
      }
    }
  };

  const handleRecYearChange = (y: string) => {
    setRecYear(y);
    if (recItemType === 'Monthly Due') {
      const createdForYear = monthlyDuesList.filter(d => String(d.year) === String(y));
      if (createdForYear.length > 0) {
        const matched = createdForYear.find(d => d.month === recMonth);
        if (matched) {
          setRecAmount(String(matched.amount));
        } else {
          setRecMonth(createdForYear[0].month);
          setRecAmount(String(createdForYear[0].amount));
        }
      } else {
        setRecMonth('');
        setRecAmount('0');
      }
    }
  };

  const handleRecUserIdChange = (newUserId: string) => {
    setRecUserId(newUserId);
    const memberPaidMf = records.some(
      r => r.userId === newUserId &&
           r.itemType === 'Membership Fee' &&
           r.status === 'Paid' &&
           (!editingRecord || editingRecord.id !== r.id)
    );
    if (memberPaidMf && recOptionKey === 'opt_membership_fee') {
      handleSelectPaymentOption('opt_monthly_due');
    }
  };

  const handleSelectPaymentOption = (val: string) => {
    if (val === 'opt_annual_promo' && !isPromoEnabled) {
      return;
    }
    if (val === 'opt_membership_fee' && isMembershipFeePaidForSelectedMember) {
      return;
    }
    setRecOptionKey(val);
    if (val === 'opt_membership_fee') {
      setRecItemType('Membership Fee');
      setRecAmount(String(finSettings.membershipFee || 200));
      setRecCustomItemName('');
    } else if (val === 'opt_monthly_due') {
      setRecItemType('Monthly Due');
      setRecCustomItemName('');
      const createdForYear = monthlyDuesList.filter(d => String(d.year) === String(recYear));
      if (createdForYear.length > 0) {
        const matched = createdForYear.find(d => d.month === recMonth);
        if (matched) {
          setRecAmount(String(matched.amount));
        } else {
          setRecMonth(createdForYear[0].month);
          setRecAmount(String(createdForYear[0].amount));
        }
      } else if (monthlyDuesList.length > 0) {
        setRecYear(String(monthlyDuesList[0].year));
        setRecMonth(monthlyDuesList[0].month);
        setRecAmount(String(monthlyDuesList[0].amount));
      } else {
        setRecMonth('');
        setRecAmount('0');
      }
    } else if (val === 'opt_annual_promo') {
      setRecItemType('Annual Upfront Promo');
      setRecCustomItemName('Annual Upfront Promo (Full Year Dues)');
      setRecAmount('1000');
      setRecStatus('Paid');
    } else if (val === 'opt_other') {
      setRecItemType('Other');
      setRecCustomItemName('');
      setRecAmount('0');
    } else if (val.startsWith('dc_')) {
      const colId = val.replace('dc_', '');
      const col = dynamicColsList.find(c => c.id === colId);
      if (col) {
        if (col.collectionType === 'Donation') {
          setRecItemType('Donation Collection');
          setRecCustomItemName(col.name);
          setRecAmount(String(col.amount));
          setRecStatus('Paid');
        } else {
          setRecItemType('Other');
          setRecCustomItemName(col.name);
          setRecAmount(String(col.amount));
        }
      }
    }
  };

  // Open Funds Modal Directly (internal helper)
  const openLogRecordDirectly = (presetRecord?: FinanceRecord) => {
    const settings = store.getFinanceSettings();
    const mDues = store.getMonthlyDues();
    const dCols = store.getDynamicCollections();
    setRecordSuccessNotice(null);

    if (presetRecord) {
      setEditingRecord(presetRecord);
      setRecUserId(presetRecord.userId);
      setRecItemType(presetRecord.itemType);
      
      if (presetRecord.coveredMonth) {
        const parts = presetRecord.coveredMonth.split(' ');
        setRecMonth(parts[0] || 'August');
        setRecYear(parts[1] || parts[0] || '2026');
      } else {
        setRecMonth('August');
        setRecYear('2026');
      }

      setRecCustomItemName(presetRecord.customItemName || '');
      setRecAmount(presetRecord.amount.toString());
      setRecStatus(presetRecord.status);
      setRecMethod(presetRecord.paymentMethod || 'Cash');
      setRecRefNo(presetRecord.referenceNo || '');
      setRecNotes(presetRecord.notes || '');
      const initialDate = presetRecord.paidDate || presetRecord.dueDate || new Date().toISOString().split('T')[0];
      setRecDueDate(initialDate);

      // Derive dropdown option key
      if (presetRecord.itemType === 'Membership Fee') {
        setRecOptionKey('opt_membership_fee');
      } else if (presetRecord.itemType === 'Monthly Due') {
        setRecOptionKey('opt_monthly_due');
      } else if (presetRecord.itemType === 'Annual Upfront Promo') {
        setRecOptionKey('opt_annual_promo');
      } else if (presetRecord.itemType === 'Donation Collection') {
        const matchedCol = dCols.find(c => c.name === presetRecord.customItemName);
        setRecOptionKey(matchedCol ? `dc_${matchedCol.id}` : 'opt_other');
      } else if (presetRecord.customItemName) {
        const matchedCol = dCols.find(c => c.name === presetRecord.customItemName);
        setRecOptionKey(matchedCol ? `dc_${matchedCol.id}` : 'opt_other');
      } else {
        setRecOptionKey(presetRecord.itemType === 'Other' ? 'opt_other' : 'opt_monthly_due');
      }
    } else {
      setEditingRecord(null);
      setRecUserId(users[0]?.id || '');
      setRecStatus('Paid');
      setRecMethod('Cash');
      setRecRefNo('');
      setRecNotes('');
      setRecDueDate(new Date().toISOString().split('T')[0]);

      setRecOptionKey('opt_monthly_due');
      setRecItemType('Monthly Due');
      const now = new Date();
      const currentMonthName = MONTHS_LIST[now.getMonth()] || 'August';
      const currentYearStr = String(now.getFullYear()) || '2026';

      const createdForCurrentYear = mDues.filter(d => String(d.year) === currentYearStr);
      if (createdForCurrentYear.length > 0) {
        setRecYear(currentYearStr);
        const matched = createdForCurrentYear.find(d => d.month === currentMonthName);
        if (matched) {
          setRecMonth(currentMonthName);
          setRecAmount(String(matched.amount));
        } else {
          setRecMonth(createdForCurrentYear[0].month);
          setRecAmount(String(createdForCurrentYear[0].amount));
        }
      } else if (mDues.length > 0) {
        setRecYear(String(mDues[0].year));
        setRecMonth(mDues[0].month);
        setRecAmount(String(mDues[0].amount));
      } else {
        setRecYear(currentYearStr);
        setRecMonth('');
        setRecAmount('0');
      }
      setRecCustomItemName('');
    }
    setShowAddRecordModal(true);
  };

  // Open Funds Modal with Security Check for Treasurer Role
  const handleOpenLogRecord = (presetRecord?: FinanceRecord) => {
    if (!canManageFinances) return;
    const isTreasurerUser = isTreasurer && !isAdmin;

    if (presetRecord && isTreasurerUser) {
      const hasGrantedAccess = store.hasGrantedTreasurerAccess(
        currentUser?.id || '',
        presetRecord.id,
        'edit'
      );

      if (!hasGrantedAccess) {
        setTreasurerAuthTarget({
          actionType: 'edit',
          targetType: 'fund',
          targetId: presetRecord.id,
          targetTitle: getItemTitle(presetRecord),
          targetSubtitle: presetRecord.userName,
          targetAmount: presetRecord.amount,
          targetDate: presetRecord.paidDate || presetRecord.dueDate,
          targetRef: presetRecord.referenceNo,
          onGrant: () => {
            setTreasurerAuthTarget(null);
            openLogRecordDirectly(presetRecord);
          },
        });
        return;
      }
    }

    openLogRecordDirectly(presetRecord);
  };

  // Initiate Save Payment Record (Opens Confirmation Modal)
  const handleInitiateSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageFinances) return;
    if (!hasMembers) {
      setFinanceNoticeModal({
        title: 'No Registered Members',
        message: 'No registered members found. Please register members in the Members Directory before recording payments.',
        isError: true,
      });
      return;
    }
    if (!isRecordFormValid) {
      return;
    }
    setIsWaiveAction(false);
    setShowConfirmRecordModal(true);
  };

  // Initiate Waive Record for Monthly Due
  const handleInitiateWaiveRecord = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!canManageFinances) return;
    if (!hasMembers) {
      setFinanceNoticeModal({
        title: 'No Registered Members',
        message: 'No registered members found. Please register members in the Members Directory before recording waivers.',
        isError: true,
      });
      return;
    }
    if (!isWaiveValid) {
      return;
    }
    setIsWaiveAction(true);
    setShowConfirmRecordModal(true);
  };

  // Proceed with Saving Payment Record after confirmation
  const handleProceedSaveRecord = async () => {
    setShowConfirmRecordModal(false);
    if (!canManageFinances || !hasMembers) return;
    if (isWaiveAction) {
      if (!isWaiveValid) return;
    } else {
      if (!isRecordFormValid) return;
    }

    const isWaiving = isWaiveAction;
    const effectiveYear = recYear || String(new Date().getFullYear());
    const amountNum = isWaiving ? 0 : (parseFloat(recAmount) || 0);
    const selectedUser = users.find(u => u.id === recUserId);
    const todayStr = new Date().toISOString().split('T')[0];
    const coveredMonthStr = recItemType === 'Monthly Due' 
      ? `${recMonth} ${effectiveYear}` 
      : recItemType === 'Annual Upfront Promo'
      ? `Full Year ${effectiveYear}`
      : undefined;
    const effectiveStatus: 'Paid' | 'Pending' | 'Overdue' | 'Waived' = isWaiving
      ? 'Waived'
      : (recItemType === 'Monthly Due' || recItemType === 'Annual Upfront Promo')
      ? 'Paid'
      : recStatus;

    const effectiveNotes = isWaiving
      ? (recNotes.trim() || 'Waived (Joined before club started)')
      : (recItemType === 'Monthly Due' ? (recNotes.trim() || undefined) : (recNotes.trim() || (recItemType === 'Annual Upfront Promo' ? 'Annual Upfront Promo Package (Full Year Dues)' : undefined)));

    await runWithLoader(
      async () => {
        // Base working records list
        let workingRecords = records;
        const syncPromises: Promise<any>[] = [];

        // If Annual Upfront Promo is selected, mark all existing pending monthly dues for this user in effectiveYear as Paid and ensure all active configured dues for that year are marked Paid
        if (recItemType === 'Annual Upfront Promo' && recUserId) {
          const mDuesConfig = store.getMonthlyDues();
          workingRecords = workingRecords.map(r => {
            if (r.userId === recUserId && r.itemType === 'Monthly Due' && (r.coveredMonth?.includes(effectiveYear) || !r.coveredMonth)) {
              const satisfiedRec: FinanceRecord = {
                ...r,
                status: 'Paid',
                paidDate: r.paidDate || todayStr,
                notes: 'Satisfied by Annual Upfront Promo Package',
                updatedAt: todayStr,
              };
              syncPromises.push(syncRecordToMongo(satisfiedRec));
              return satisfiedRec;
            }
            return r;
          });

          // Also ensure any configured monthly dues for effectiveYear exist in records as Paid
          mDuesConfig.forEach(due => {
            if (String(due.year) === effectiveYear) {
              const coveredMonthStr = `${due.month} ${due.year}`;
              const exists = workingRecords.some(r =>
                r.userId === recUserId &&
                r.itemType === 'Monthly Due' &&
                (r.coveredMonth === coveredMonthStr || r.customItemName === due.title || r.id === `rec_md_${due.id}_${recUserId}`)
              );
              if (!exists) {
                const autoPaidDue: FinanceRecord = {
                  id: `rec_md_${due.id}_${recUserId}`,
                  itemType: 'Monthly Due',
                  userId: recUserId,
                  userName: selectedUser?.name || 'Club Member',
                  userMemberNo: selectedUser?.memberNumber || 'BRC-MEMBER',
                  amount: due.amount,
                  coveredMonth: coveredMonthStr,
                  customItemName: due.title,
                  dueDate: todayStr,
                  paidDate: todayStr,
                  status: 'Paid',
                  paymentMethod: recMethod,
                  notes: 'Satisfied by Annual Upfront Promo Package',
                  updatedAt: todayStr,
                };
                workingRecords.push(autoPaidDue);
                syncPromises.push(syncRecordToMongo(autoPaidDue));
              }
            }
          });
        }

        if (recItemType === 'Membership Fee' && recUserId) {
          try {
            const dItem = localStorage.getItem('bcc_deleted_membership_fee_user_ids');
            if (dItem) {
              const current: string[] = JSON.parse(dItem);
              const filtered = current.filter(id => id !== recUserId);
              localStorage.setItem('bcc_deleted_membership_fee_user_ids', JSON.stringify(filtered));
            }
          } catch (e) {
            console.error(e);
          }
        }

        if (editingRecord) {
          try {
            const current = loadFromSession<string[]>('bcc_deleted_finance_record_ids', []);
            if (current && Array.isArray(current)) {
              const filtered = current.filter(id => id !== editingRecord.id);
              saveToSession('bcc_deleted_finance_record_ids', filtered);
            }
          } catch (e) {
            console.error(e);
          }

          const updatedRecord: FinanceRecord = {
            ...editingRecord,
            userId: recUserId,
            userName: selectedUser?.name || editingRecord.userName,
            userMemberNo: selectedUser?.memberNumber || editingRecord.userMemberNo,
            itemType: recItemType,
            coveredMonth: coveredMonthStr,
            customItemName: recItemType === 'Other' || recItemType === 'Donation Collection' ? recCustomItemName : (recItemType === 'Annual Upfront Promo' ? 'Annual Upfront Promo (Full Year Dues)' : undefined),
            amount: amountNum,
            status: effectiveStatus,
            dueDate: recDueDate,
            paidDate: (effectiveStatus === 'Paid' || effectiveStatus === 'Waived') ? recDueDate : editingRecord.paidDate,
            paymentMethod: isWaiving ? 'N/A' : recMethod,
            referenceNo: isWaiving ? undefined : (editingRecord.referenceNo || undefined),
            notes: effectiveNotes,
            updatedAt: todayStr,
          };

          let updated = workingRecords.map(r => (r.id === editingRecord.id ? updatedRecord : r));
          if (effectiveStatus === 'Paid' || effectiveStatus === 'Waived') {
            const itemKey = recItemType === 'Other' ? recCustomItemName : (recItemType === 'Monthly Due' ? coveredMonthStr : undefined);
            updated = updated.filter(r => {
              if (r.id !== editingRecord.id && r.userId === recUserId && (r.status === 'Pending' || r.status === 'Overdue')) {
                if (recItemType === 'Membership Fee' && r.itemType === 'Membership Fee') {
                  authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
                  return false;
                }
                if (itemKey && (r.customItemName === itemKey || r.coveredMonth === itemKey)) {
                  authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
                  return false;
                }
              }
              return true;
            });
          }
          saveRecordsToStorage(updated);
          syncPromises.push(syncRecordToMongo(updatedRecord));
        } else {
          // Look for an existing pending record for this user and coveredMonth/Monthly Due or Custom Collection
          let existingPending = null;
          if (recItemType === 'Monthly Due' && coveredMonthStr) {
            existingPending = workingRecords.find(r =>
              r.userId === recUserId &&
              r.itemType === 'Monthly Due' &&
              (r.coveredMonth === coveredMonthStr || r.id.includes(coveredMonthStr)) &&
              (r.status === 'Pending' || r.status === 'Overdue')
            );
          } else if (recItemType === 'Membership Fee') {
            existingPending = workingRecords.find(r =>
              r.userId === recUserId &&
              r.itemType === 'Membership Fee' &&
              (r.status === 'Pending' || r.status === 'Overdue')
            );
          } else if (recItemType === 'Other' && recCustomItemName.trim()) {
            existingPending = workingRecords.find(r =>
              r.userId === recUserId &&
              r.itemType === 'Other' &&
              (r.customItemName === recCustomItemName.trim() || r.coveredMonth === recCustomItemName.trim() || r.id.startsWith('rec_col_')) &&
              (r.status === 'Pending' || r.status === 'Overdue')
            );
          }

          if (existingPending) {
            const updatedRecord: FinanceRecord = {
              ...existingPending,
              userName: selectedUser?.name || existingPending.userName,
              userMemberNo: selectedUser?.memberNumber || existingPending.userMemberNo,
              itemType: recItemType,
              customItemName: recItemType === 'Other' || recItemType === 'Donation Collection' ? recCustomItemName.trim() : existingPending.customItemName,
              coveredMonth: coveredMonthStr || existingPending.coveredMonth,
              amount: amountNum,
              dueDate: recDueDate,
              paidDate: (effectiveStatus === 'Paid' || effectiveStatus === 'Waived') ? recDueDate : undefined,
              status: effectiveStatus,
              paymentMethod: isWaiving ? 'N/A' : recMethod,
              notes: effectiveNotes || existingPending.notes,
              updatedAt: todayStr,
            };
            const updated = workingRecords.map(r => (r.id === existingPending.id ? updatedRecord : r));
            saveRecordsToStorage(updated);
            syncPromises.push(syncRecordToMongo(updatedRecord));
          } else {
            const newRec: FinanceRecord = {
              id: `rec_${Date.now()}`,
              userId: recUserId || (users[0]?.id || 'usr_guest'),
              userName: selectedUser?.name || 'Walk-in Member',
              userMemberNo: selectedUser?.memberNumber || 'BRC-N/A',
              itemType: recItemType,
              coveredMonth: coveredMonthStr,
              customItemName: recItemType === 'Other' || recItemType === 'Donation Collection' ? recCustomItemName : (recItemType === 'Annual Upfront Promo' ? 'Annual Upfront Promo (Full Year Dues)' : undefined),
              amount: amountNum,
              dueDate: recDueDate,
              paidDate: (effectiveStatus === 'Paid' || effectiveStatus === 'Waived') ? recDueDate : undefined,
              status: effectiveStatus,
              paymentMethod: isWaiving ? 'N/A' : recMethod,
              referenceNo: undefined,
              notes: effectiveNotes,
              updatedAt: todayStr,
            };

            let updatedList = [...workingRecords, newRec];
            if (effectiveStatus === 'Paid' || effectiveStatus === 'Waived') {
              const itemKey = recItemType === 'Other' ? recCustomItemName : (recItemType === 'Monthly Due' ? coveredMonthStr : undefined);
              updatedList = updatedList.filter(r => {
                if (r.id !== newRec.id && r.userId === recUserId && (r.status === 'Pending' || r.status === 'Overdue')) {
                  if (recItemType === 'Membership Fee' && r.itemType === 'Membership Fee') {
                    authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
                    return false;
                  }
                  if (itemKey && (r.customItemName === itemKey || r.coveredMonth === itemKey)) {
                    authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
                    return false;
                  }
                }
                return true;
              });
            }

            saveRecordsToStorage(updatedList);
            syncPromises.push(syncRecordToMongo(newRec));
          }
        }

        if (editingRecord) {
          store.completeTreasurerRequest(editingRecord.id, 'edit');
          setShowAddRecordModal(false);
          setEditingRecord(null);
        } else {
          if (effectiveStatus === 'Paid') {
            // Broadcast Push Notification to all mobile users and devices
            const itemDescription = recItemType === 'Other' && recCustomItemName ? recCustomItemName : (recItemType === 'Monthly Due' ? `Monthly Due: ${coveredMonthStr}` : recItemType);
            const memberLabel = selectedUser?.name || 'Club Member';
            void triggerFinancePushNotification('collection', amountNum, `${itemDescription} (${memberLabel})`);
          }
          // In "Save & Add" mode: keep modal open to allow logging additional payments smoothly
          setShowAddRecordModal(true);
          setRecordSuccessNotice(`Payment for ${selectedUser?.name || 'Member'} successfully saved! You can record another payment below.`);
          
          // Reset fields for next entry
          setRecNotes('');
          setRecRefNo('');
          if (recItemType === 'Other') {
            setRecCustomItemName('');
          }
        }

        await Promise.all(syncPromises);
      },
      {
        message: isWaiving ? 'Waiving Monthly Due & Refreshing...' : (editingRecord ? 'Updating Payment Record & Refreshing...' : 'Recording Transaction & Refreshing...'),
      }
    );
  };

  // Request Delete Funds Record Directly (internal helper)
  const requestDeleteRecordDirectly = (rec: FinanceRecord) => {
    setDeleteTarget({
      type: 'fund',
      id: rec.id,
      title: rec.userName,
      subtitle: `${getItemTitle(rec)}${rec.userMemberNo ? ` (${rec.userMemberNo})` : ''}`,
      amount: rec.amount,
    });
  };

  // Request Delete Funds Record with Treasurer Security Check
  const handleRequestDeleteRecord = (rec: FinanceRecord) => {
    if (!canManageFinances) return;
    const isTreasurerUser = isTreasurer && !isAdmin;

    if (isTreasurerUser) {
      const hasGrantedAccess = store.hasGrantedTreasurerAccess(
        currentUser?.id || '',
        rec.id,
        'delete'
      );

      if (!hasGrantedAccess) {
        setTreasurerAuthTarget({
          actionType: 'delete',
          targetType: 'fund',
          targetId: rec.id,
          targetTitle: getItemTitle(rec),
          targetSubtitle: rec.userName,
          targetAmount: rec.amount,
          targetDate: rec.paidDate || rec.dueDate,
          targetRef: rec.referenceNo,
          onGrant: () => {
            setTreasurerAuthTarget(null);
            requestDeleteRecordDirectly(rec);
          },
        });
        return;
      }
    }

    requestDeleteRecordDirectly(rec);
  };

  // Open Expense Modal Directly (internal helper)
  const openExpenseModalDirectly = (presetExpense?: ExpenseRecord) => {
    if (presetExpense) {
      setEditingExpense(presetExpense);
      setExpTitle(presetExpense.title);
      setExpCategory(presetExpense.category);
      setExpAmount(presetExpense.amount.toString());
      setExpDate(presetExpense.date);
      setExpReceiptRef(presetExpense.receiptRef || '');
      setExpPayee(presetExpense.payeeOrDisbursedTo || '');
      setExpLoggedBy(presetExpense.loggedBy || 'Treasury Admin');
      setExpNotes(presetExpense.notes || '');
    } else {
      setEditingExpense(null);
      setExpTitle('');
      setExpCategory('Event Logistics');
      setExpAmount('');
      setExpDate(new Date().toISOString().split('T')[0]);
      setExpReceiptRef('');
      setExpPayee('');
      const allUsers = store.getUsers();
      const officerUsers = allUsers.filter(u => u.role && u.role.toLowerCase() !== 'member');
      if (officerUsers.length > 0) {
        const isCurrentOfficer = currentUser && officerUsers.some(u => u.id === currentUser.id);
        setExpLoggedBy(isCurrentOfficer ? currentUser.name : officerUsers[0].name);
      } else {
        setExpLoggedBy('No officers assigned yet');
      }
      setExpNotes('');
    }
    setShowExpenseModal(true);
  };

  // Open Expense Modal with Security Check for Treasurer Role
  const handleOpenExpenseModal = (presetExpense?: ExpenseRecord) => {
    if (!canManageFinances) return;
    const isTreasurerUser = isTreasurer && !isAdmin;

    if (presetExpense && isTreasurerUser) {
      const hasGrantedAccess = store.hasGrantedTreasurerAccess(
        currentUser?.id || '',
        presetExpense.id,
        'edit'
      );

      if (!hasGrantedAccess) {
        setTreasurerAuthTarget({
          actionType: 'edit',
          targetType: 'expense',
          targetId: presetExpense.id,
          targetTitle: presetExpense.title,
          targetSubtitle: presetExpense.category,
          targetAmount: presetExpense.amount,
          targetDate: presetExpense.date,
          targetRef: presetExpense.receiptRef,
          onGrant: () => {
            setTreasurerAuthTarget(null);
            openExpenseModalDirectly(presetExpense);
          },
        });
        return;
      }
    }

    openExpenseModalDirectly(presetExpense);
  };

  // Save Expense Handler
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageFinances) return;

    const amountNum = parseFloat(expAmount) || 0;
    const todayStr = new Date().toISOString().split('T')[0];

    await runWithLoader(
      async () => {
        if (editingExpense) {
          const updatedExpense: ExpenseRecord = {
            ...editingExpense,
            title: expTitle.trim(),
            category: expCategory,
            amount: amountNum,
            date: expDate || todayStr,
            receiptRef: expReceiptRef.trim() || undefined,
            payeeOrDisbursedTo: expPayee.trim() || undefined,
            loggedBy: expLoggedBy.trim() || 'No officers assigned yet',
            notes: expNotes.trim() || undefined,
            updatedAt: todayStr,
          };
          const updated = expenses.map(x => (x.id === editingExpense.id ? updatedExpense : x));
          saveExpensesToStorage(updated);
          await syncExpenseToMongo(updatedExpense);

          // Complete any active treasurer edit authorization
          store.completeTreasurerRequest(editingExpense.id, 'edit');
        } else {
          const newExpense: ExpenseRecord = {
            id: `exp_${Date.now()}`,
            title: expTitle.trim(),
            category: expCategory,
            amount: amountNum,
            date: expDate || todayStr,
            receiptRef: expReceiptRef.trim() || undefined,
            payeeOrDisbursedTo: expPayee.trim() || undefined,
            loggedBy: expLoggedBy.trim() || 'No officers assigned yet',
            notes: expNotes.trim() || undefined,
            updatedAt: todayStr,
          };
          saveExpensesToStorage([newExpense, ...expenses]);
          await syncExpenseToMongo(newExpense);

          // Broadcast Push Notification for expense disbursement
          void triggerFinancePushNotification('expense', amountNum, `${expTitle.trim()} (${expCategory})`);
        }

        setShowExpenseModal(false);
      },
      {
        message: editingExpense ? 'Updating Expense & Refreshing...' : 'Recording Expense & Refreshing...',
      }
    );
  };

  // Request Delete Expense Directly (internal helper)
  const requestDeleteExpenseDirectly = (exp: ExpenseRecord) => {
    setDeleteTarget({
      type: 'expense',
      id: exp.id,
      title: exp.title,
      subtitle: `${exp.category}${exp.receiptRef ? ` • Ref: ${exp.receiptRef}` : ''}`,
      amount: exp.amount,
    });
  };

  // Request Delete Expense Handler with Treasurer Security Check
  const handleRequestDeleteExpense = (exp: ExpenseRecord) => {
    if (!canManageFinances) return;
    const isTreasurerUser = isTreasurer && !isAdmin;

    if (isTreasurerUser) {
      const hasGrantedAccess = store.hasGrantedTreasurerAccess(
        currentUser?.id || '',
        exp.id,
        'delete'
      );

      if (!hasGrantedAccess) {
        setTreasurerAuthTarget({
          actionType: 'delete',
          targetType: 'expense',
          targetId: exp.id,
          targetTitle: exp.title,
          targetSubtitle: `${exp.category}${exp.receiptRef ? ` • Ref: ${exp.receiptRef}` : ''}`,
          targetAmount: exp.amount,
          targetDate: exp.date,
          targetRef: exp.receiptRef,
          onGrant: () => {
            setTreasurerAuthTarget(null);
            requestDeleteExpenseDirectly(exp);
          },
        });
        return;
      }
    }

    requestDeleteExpenseDirectly(exp);
  };

  // Confirm Delete Action Handler
  const handleConfirmDelete = async () => {
    if (!canManageFinances || !deleteTarget) return;

    await runWithLoader(
      async () => {
        if (deleteTarget.type === 'fund') {
          const targetRec = records.find(r => r.id === deleteTarget.id);
          let updated = records.filter(r => r.id !== deleteTarget.id);
          const syncDeletePromises: Promise<any>[] = [deleteRecordFromMongo(deleteTarget.id)];

          // If the deleted record is a Membership Fee, track user ID in bcc_deleted_membership_fee_user_ids to prevent any automated recreation
          if (
            targetRec?.itemType === 'Membership Fee' ||
            deleteTarget.title?.toLowerCase().includes('membership fee') ||
            deleteTarget.subtitle?.toLowerCase().includes('membership fee') ||
            targetRec?.id?.startsWith('rec_mf_') ||
            deleteTarget.id.startsWith('rec_mf_')
          ) {
            const feeUserId = targetRec?.userId || deleteTarget.id.replace('rec_mf_', '');
            if (feeUserId) {
              try {
                const currentDel = loadFromSession<string[]>('bcc_deleted_membership_fee_user_ids', []);
                if (!currentDel.includes(feeUserId)) {
                  currentDel.push(feeUserId);
                  saveToSession('bcc_deleted_membership_fee_user_ids', currentDel);
                }
              } catch (e) {
                console.error(e);
              }
              // Also ensure MongoDB doesn't keep rec_mf_ for this user
              syncDeletePromises.push(deleteRecordFromMongo(`rec_mf_${feeUserId}`));
            }
          }

          // Always record the deleted record ID so it cannot be resurrected
          try {
            const currentDelIds = loadFromSession<string[]>('bcc_deleted_finance_record_ids', []);
            if (!currentDelIds.includes(deleteTarget.id)) {
              currentDelIds.push(deleteTarget.id);
              saveToSession('bcc_deleted_finance_record_ids', currentDelIds);
            }
          } catch (e) {
            console.error(e);
          }

          // If the deleted record is an Annual Upfront Promo, completely delete all satisfied/auto-generated records for that promo
          if (
            targetRec?.itemType === 'Annual Upfront Promo' ||
            deleteTarget.title?.toLowerCase().includes('annual upfront promo') ||
            targetRec?.customItemName?.toLowerCase().includes('annual upfront promo')
          ) {
            const promoUserId = targetRec?.userId;
            const promoYear =
              targetRec?.coveredMonth?.match(/\d{4}/)?.[0] ||
              targetRec?.paidDate?.slice(0, 4) ||
              targetRec?.dueDate?.slice(0, 4) ||
              targetRec?.customItemName?.match(/\d{4}/)?.[0] ||
              String(new Date().getFullYear());

            if (promoUserId) {
              updated = updated.filter(r => {
                const isSameUser = r.userId === promoUserId;
                const isSameYear =
                  !r.coveredMonth ||
                  r.coveredMonth.includes(promoYear) ||
                  r.dueDate?.startsWith(promoYear) ||
                  r.paidDate?.startsWith(promoYear);

                if (isSameUser && isSameYear) {
                  if (
                    r.notes?.includes('Satisfied by Annual Upfront Promo Package') ||
                    r.id.startsWith('rec_md_') ||
                    r.itemType === 'Annual Upfront Promo'
                  ) {
                    syncDeletePromises.push(deleteRecordFromMongo(r.id));
                    return false;
                  }
                }
                return true;
              });
            }
          }

          saveRecordsToStorage(updated);
          await Promise.all(syncDeletePromises);
        } else {
          const updated = expenses.filter(x => x.id !== deleteTarget.id);
          saveExpensesToStorage(updated);
          await deleteExpenseFromMongo(deleteTarget.id);
        }

        // Complete any active treasurer delete authorization
        store.completeTreasurerRequest(deleteTarget.id, 'delete');
        setDeleteTarget(null);
      },
      {
        message: deleteTarget.type === 'fund' ? 'Deleting Transaction & Refreshing...' : 'Deleting Expense & Refreshing...',
      }
    );
  };

  // Helper for Payment Title
  const getItemTitle = (rec: FinanceRecord) => {
    if (rec.itemType === 'Monthly Due') {
      return `Monthly Due${rec.coveredMonth ? ` (${rec.coveredMonth})` : ''}`;
    }
    if (rec.itemType === 'Donation Collection') {
      return rec.customItemName ? `Donation: ${rec.customItemName}` : 'Donation Collection';
    }
    if (rec.itemType === 'Other' && rec.customItemName) {
      return rec.customItemName;
    }
    return rec.itemType;
  };

  // Helper for Date Formatting
  const formatDisplayDate = (dateVal?: string): string => {
    if (!dateVal) return '-';
    // Match simple YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      try {
        const [year, month, day] = dateVal.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return dateVal;
      }
    }
    // Match ISO timestamp strings or generic dates
    try {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {
      // fallback
    }
    return dateVal;
  };

  // Filtered Funds Records
  const filteredRecords = records.filter(r => {
    // Hide pending and overdue records in the Funds tab ledger (only collected/paid/waived funds belong in Funds)
    if (r.status === 'Pending' || r.status === 'Overdue') {
      return false;
    }

    const title = getItemTitle(r).toLowerCase();
    const matchesSearch =
      r.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      title.includes(searchQuery.toLowerCase()) ||
      (r.userMemberNo && r.userMemberNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.referenceNo && r.referenceNo.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesItemType = itemTypeFilter === 'All' || r.itemType === itemTypeFilter;
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;

    return matchesSearch && matchesItemType && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemTypeFilter, statusFilter]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const validCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginatedRecords = filteredRecords.slice(
    (validCurrentPage - 1) * itemsPerPage,
    validCurrentPage * itemsPerPage
  );

  // Filtered Expense Records
  const filteredExpenses = expenses.filter(x => {
    const query = expenseSearchQuery.toLowerCase();
    const matchesSearch =
      x.title.toLowerCase().includes(query) ||
      (x.payeeOrDisbursedTo && x.payeeOrDisbursedTo.toLowerCase().includes(query)) ||
      (x.receiptRef && x.receiptRef.toLowerCase().includes(query)) ||
      (x.notes && x.notes.toLowerCase().includes(query));

    const matchesCategory = expenseCategoryFilter === 'All' || x.category === expenseCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    setExpenseCurrentPage(1);
  }, [expenseSearchQuery, expenseCategoryFilter]);

  useEffect(() => {
    setAccountMembersCurrentPage(1);
    setAccountTxCurrentPage(1);
  }, [accountSearchQuery, accountMemberId]);

  const totalExpensePages = Math.ceil(filteredExpenses.length / itemsPerPage) || 1;
  const validExpensePage = Math.min(Math.max(expenseCurrentPage, 1), totalExpensePages);
  const paginatedExpenses = filteredExpenses.slice(
    (validExpensePage - 1) * itemsPerPage,
    validExpensePage * itemsPerPage
  );

  // Financial Metrics Calculation & Carried-Over Treasury
  const totalArchivedCarryOver = financeArchives.reduce((sum, a) => sum + (Number(a.carriedOverTreasury) || 0), 0);

  const paidAnnualPromos = records.filter(r => r.itemType === 'Annual Upfront Promo' && r.status === 'Paid');
  const totalDiscount = paidAnnualPromos.length * 200;

  const totalCollected = records
    .filter(r => r.status === 'Paid')
    .reduce((sum, r) => {
      // Monthly dues satisfied by annual promo are covered by the ₱1,000 promo payment record
      if (r.itemType === 'Monthly Due' && r.notes?.includes('Satisfied by Annual Upfront Promo Package')) {
        return sum;
      }
      return sum + (Number(r.amount) || 0);
    }, 0);

  // Total funds includes all active collections plus audited net treasury carried over from prior fiscal years
  const totalFundsWithCarryOver = totalCollected + totalArchivedCarryOver;

  const approvedUsersList = store.getUsers().filter(u => {
    const isUserAdmin =
      u.role === 'admin' ||
      u.role?.toLowerCase() === 'admin' ||
      u.role?.toLowerCase() === 'administrator' ||
      u.id === 'usr_admin' ||
      u.id === 'admin' ||
      u.username?.toLowerCase() === 'admin' ||
      u.email?.toLowerCase().includes('admin@');
    return !isUserAdmin && u.approvalStatus !== 'Pending';
  });

  const activeMonthlyDues = store.getMonthlyDues();
  let calculatedPendingMonthlyDues = 0;
  activeMonthlyDues.forEach(due => {
    approvedUsersList.forEach(u => {
      const hasAnnualPromo = records.some(r => r.userId === u.id && r.itemType === 'Annual Upfront Promo' && r.status === 'Paid');
      const hasPaid = records.some(r => r.userId === u.id && r.itemType === 'Monthly Due' && (r.coveredMonth === `${due.month} ${due.year}` || r.customItemName === due.title) && r.status === 'Paid');
      if (!hasAnnualPromo && !hasPaid) {
        calculatedPendingMonthlyDues += due.amount;
      }
    });
  });

  const otherPendingRecordsTotal = records
    .filter(r => (r.status === 'Pending' || r.status === 'Overdue') && r.itemType !== 'Monthly Due')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const totalPending = calculatedPendingMonthlyDues + otherPendingRecordsTotal;

  const totalPaidCount = records.filter(r => r.status === 'Paid').length;

  const totalExpenses = expenses.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
  
  // Net Treasury Balance reflects total available funds minus liquidated expenditures
  const netBalance = totalFundsWithCarryOver - totalExpenses;

  // Category Badge Styler
  const getCategoryBadgeStyle = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'Food & Catering':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'Event Logistics':
        return 'bg-blue-100 text-blue-900 border-blue-200';
      case 'Equipment & Gear':
        return 'bg-emerald-100 text-emerald-900 border-emerald-200';
      case 'Venue & Rental':
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'Fuel & Travel':
        return 'bg-orange-100 text-orange-900 border-orange-200';
      case 'Administrative':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'Utilities':
        return 'bg-cyan-100 text-cyan-900 border-cyan-200';
      default:
        return 'bg-stone-100 text-stone-800 border-stone-200';
    }
  };

  const isTreasurerUser = isTreasurer && !isAdmin;
  const allTreasurerRequests = store.getTreasurerRequests();
  const pendingTreasurerRequests = allTreasurerRequests.filter(r => r.status === 'Pending');
  const myGrantedRequests = allTreasurerRequests.filter(
    r => r.status === 'Granted' && (r.requesterId === currentUser?.id || isTreasurerUser)
  );

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Hidden File Input for Compressed (.zip) Archive Import */}
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleImportZipFile}
        className="hidden"
      />

      {/* Success Notification Banner for Completed Archive */}
      {archiveSuccessToast && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-heading font-black text-sm text-[#1b4332]">
                FY {archiveSuccessToast.year} Financial Year Successfully Archived!
              </h4>
              <p className="text-xs text-emerald-800">
                Outgoing year records deleted. Net Treasury Surplus of <strong>₱{archiveSuccessToast.surplus.toLocaleString()}.00</strong> has been carried forward into Total Funds & Net Treasury.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setArchiveSuccessToast(null)}
            className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Alert Banner for Pending Treasurer Authorizations */}
      {isAdmin && pendingTreasurerRequests.length > 0 && (
        <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-500 text-stone-900 flex items-center justify-center shrink-0 font-black shadow-xs">
              <ShieldAlert className="w-4 h-4 sm:w-4.5 sm:h-4.5 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="font-heading font-black text-xs sm:text-sm text-[#1b4332] truncate">
                  {pendingTreasurerRequests.length} Pending Authorization{pendingTreasurerRequests.length === 1 ? '' : 's'}
                </h4>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-600 text-white uppercase tracking-wider shrink-0">
                  Action Needed
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-amber-900 font-medium truncate sm:whitespace-normal mt-0.5">
                Treasurer requested edit or delete approval.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTreasurerRequestsModal(true)}
            className="w-full sm:w-auto px-3.5 py-1.5 sm:py-2 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-lg sm:rounded-xl text-xs font-extrabold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
            <span>Review & Authorize</span>
          </button>
        </div>
      )}

      {/* Global Overview Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
        {/* Total Funds Collected */}
        <div className="p-2.5 sm:p-4 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-xl bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0">
            <Coins className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] sm:text-[11px] text-[#52605d] font-bold block uppercase tracking-wider leading-tight">
              <span className="hidden sm:inline">Total </span>Funds
            </span>
            {isLoadingFinances ? (
              <div className="py-0.5 space-y-1">
                <CardValueSkeleton className="w-24 h-5 sm:h-6" />
                <CardSubSkeleton className="w-16 h-3" />
              </div>
            ) : (
              <>
                <p className="font-heading text-sm sm:text-base lg:text-lg font-black text-[#1b4332] truncate">
                  ₱{(Number(totalFundsWithCarryOver) || 0).toLocaleString()}.00
                </p>
                <div className="space-y-0.5">
                  <span className="text-[9px] sm:text-[10px] text-[#2d6a4f] font-semibold block truncate">
                    {totalPaidCount} {totalPaidCount === 1 ? 'payment' : 'payments'}
                  </span>
                  {totalArchivedCarryOver > 0 && (
                    <span className="text-[8.5px] font-extrabold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded-md block truncate">
                      +₱{totalArchivedCarryOver.toLocaleString()} carryover
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Total Liquidated Expenses */}
        <div className="p-2.5 sm:p-4 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
            <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] sm:text-[11px] text-[#52605d] font-bold block uppercase tracking-wider leading-tight">
              <span className="hidden sm:inline">Total </span>Expenses
            </span>
            {isLoadingExpenses ? (
              <div className="py-0.5 space-y-1">
                <CardValueSkeleton className="w-24 h-5 sm:h-6" />
                <CardSubSkeleton className="w-16 h-3" />
              </div>
            ) : (
              <>
                <p className="font-heading text-sm sm:text-base lg:text-lg font-black text-rose-800 truncate">
                  ₱{(Number(totalExpenses) || 0).toLocaleString()}.00
                </p>
                <span className="text-[9px] sm:text-[10px] text-rose-700 font-semibold block truncate">
                  {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Net Treasury Balance */}
        <div className="p-2.5 sm:p-4 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-2 sm:gap-3 min-w-0">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center shrink-0 ${
            netBalance >= 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
          }`}>
            <Wallet className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] sm:text-[11px] text-[#52605d] font-bold block uppercase tracking-wider leading-tight">
              Net Treasury
            </span>
            {isLoadingFinances || isLoadingExpenses ? (
              <div className="py-0.5 space-y-1">
                <CardValueSkeleton className="w-24 h-5 sm:h-6" />
                <CardSubSkeleton className="w-20 h-3" />
              </div>
            ) : (
              <>
                <p className={`font-heading text-sm sm:text-base lg:text-lg font-black truncate ${
                  netBalance >= 0 ? 'text-[#1b4332]' : 'text-rose-700'
                }`}>
                  ₱{(Number(netBalance) || 0).toLocaleString()}.00
                </p>
                <span className="text-[9px] sm:text-[10px] text-[#52605d] font-semibold block truncate">
                  {totalArchivedCarryOver > 0 ? `Net + ₱${totalArchivedCarryOver.toLocaleString()} carryover` : 'Funds - Expenses'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Discount Card */}
        <div className="p-2.5 sm:p-4 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] sm:text-[11px] text-[#52605d] font-bold block uppercase tracking-wider leading-tight">
              Discount
            </span>
            {isLoadingFinances ? (
              <div className="py-0.5 space-y-1">
                <CardValueSkeleton className="w-20 h-5 sm:h-6" />
                <CardSubSkeleton className="w-14 h-3" />
              </div>
            ) : (
              <>
                <p className="font-heading text-sm sm:text-base lg:text-lg font-black text-indigo-950 truncate">
                  ₱{(Number(totalDiscount) || 0).toLocaleString()}.00
                </p>
                <span className="text-[9px] sm:text-[10px] text-indigo-700 font-semibold block truncate">
                  {paidAnnualPromos.length} Promo{paidAnnualPromos.length === 1 ? '' : 's'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Pending Collections */}
        <div className="col-span-2 sm:col-span-1 p-2.5 sm:p-4 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] sm:text-[11px] text-[#52605d] font-bold block uppercase tracking-wider leading-tight">
              Pending<span className="hidden sm:inline"> Dues</span>
            </span>
            {isLoadingFinances ? (
              <div className="py-0.5 space-y-1">
                <CardValueSkeleton className="w-20 h-5 sm:h-6" />
                <CardSubSkeleton className="w-16 h-3" />
              </div>
            ) : (
              <>
                <p className="font-heading text-sm sm:text-base lg:text-lg font-black text-amber-900 truncate">
                  ₱{(Number(totalPending) || 0).toLocaleString()}.00
                </p>
                <span className="text-[9px] sm:text-[10px] text-amber-700 font-semibold block truncate">
                  Uncollected balance
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* THREE-BUTTON GROUP / TAB NAVIGATION & ARCHIVE ACTION CONTROLS */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4 bg-white p-2 sm:p-2.5 rounded-2xl border border-[#e2ece2] shadow-xs">
        {/* Navigation Tabs */}
        <div className="flex p-1 bg-[#f7f9f7] rounded-xl border border-[#e2ece2] w-full lg:w-auto overflow-x-auto">
          {/* Button 1: Funds */}
          <button
            type="button"
            onClick={() => setActiveTab('funds')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeTab === 'funds'
                ? 'bg-[#1b4332] text-white shadow-sm'
                : 'text-[#52605d] hover:text-[#1b4332] hover:bg-[#e2ece2]'
            }`}
          >
            <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Funds</span>
          </button>

          {/* Button 2: Expenses */}
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeTab === 'expenses'
                ? 'bg-[#1b4332] text-white shadow-sm'
                : 'text-[#52605d] hover:text-[#1b4332] hover:bg-[#e2ece2]'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Expenses</span>
          </button>

          {/* Button 3: Accounts */}
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeTab === 'accounts'
                ? 'bg-[#1b4332] text-white shadow-sm'
                : 'text-[#52605d] hover:text-[#1b4332] hover:bg-[#e2ece2]'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Accounts</span>
          </button>
        </div>

        {/* Action Controls & Primary Action Button */}
        {canManageFinances && (
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {activeTab === 'funds' && (
              <button
                type="button"
                onClick={handleDeleteAllFinanceLogs}
                className="w-full sm:w-auto px-3 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-2"
                title="Delete all finance logs from MongoDB"
              >
                <Trash2 className="w-4 h-4 text-amber-200" />
                <span>Delete All Finance Logs</span>
              </button>
            )}
            {/* Primary Action Button: Record Payment or Liquidate Expense */}
            {activeTab === 'funds' || activeTab === 'accounts' ? (
              <button
                type="button"
                onClick={() => handleOpenLogRecord()}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 text-[#74c69d]" />
                <span>Record Payment</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenExpenseModal()}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-800 hover:bg-rose-900 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 text-rose-200" />
                <span>Liquidate Expense</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* TAB CONTENT 1: FUNDS (PAYMENT RECORDS & TRANSACTIONS) */}
      {activeTab === 'funds' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-[#e2ece2] shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-[#e2ece2]">
            <div>
              <h3 className="font-heading text-base font-extrabold text-[#1b4332] flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#2d6a4f]" />
                <span>Payment Records & Transactions</span>
              </h3>
              <p className="text-xs text-[#52605d]">
                Manage all member payments for membership fees, monthly dues, and vest orders.
              </p>
            </div>
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
              <div className="flex items-center gap-1.5 min-w-[160px]">
                <span className="text-xs font-bold text-[#52605d] whitespace-nowrap">Item:</span>
                <div className="flex-1">
                  <CustomSelect
                    value={itemTypeFilter}
                    onChange={setItemTypeFilter}
                    options={[
                      { value: 'All', label: 'All Items' },
                      { value: 'Membership Fee', label: 'Membership Fee' },
                      { value: 'Monthly Due', label: 'Monthly Due' },
                      { value: 'Annual Upfront Promo', label: 'Annual Upfront Promo' },
                      { value: 'Donation Collection', label: 'Donation Collection' },
                      { value: 'Vest Payment', label: 'Vest Payment' },
                      { value: 'Other', label: 'Other' },
                    ]}
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs font-bold text-[#52605d] mr-1 whitespace-nowrap">Status:</span>
                {(['All', 'Paid', 'Waived'] as const).map(st => (
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
              paginatedRecords.map(rec => {
                const isPaid = rec.status === 'Paid';
                const isPending = rec.status === 'Pending';
                const isOverdue = rec.status === 'Overdue';

                return (
                  <div
                    key={rec.id}
                    className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-[#1b4332] text-sm">{rec.userName}</p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPending
                            ? 'bg-amber-100 text-amber-800'
                            : isOverdue
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[#e2ece2]">
                      <div>
                        <span className="text-[10px] text-[#52605d] block uppercase font-bold">Item</span>
                        <span className="font-bold text-[#1b4332]">{getItemTitle(rec)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#52605d] block uppercase font-bold">Amount</span>
                        <span className="font-black text-[#1b4332] text-sm">₱{(Number(rec.amount) || 0).toLocaleString()}.00</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[#e2ece2]">
                      <div>
                        <span className="text-[10px] text-[#52605d] block uppercase font-bold">Payment Method</span>
                        <span className="text-[#1b4332] font-semibold">{rec.status === 'Pending' ? '-' : (rec.paymentMethod || 'Cash')}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-[#52605d] block uppercase font-bold">Date Paid</span>
                        <span className="font-medium text-[#1b4332] text-xs">{rec.status === 'Pending' ? '-' : formatDisplayDate(rec.paidDate || rec.dueDate)}</span>
                      </div>
                    </div>

                    {rec.notes && (
                      <p className="text-[11px] text-[#52605d] bg-white p-2 rounded-xl border border-[#e2ece2] italic">
                        "{rec.notes}"
                      </p>
                    )}

                    {canManageFinances && (
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => handleOpenLogRecord(rec)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#e2ece2] text-[#1b4332] hover:bg-[#e2ece2] font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestDeleteRecord(rec)}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP TRANSACTION TABLE VIEW */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#e2ece2] text-[#52605d] uppercase font-bold tracking-wider text-[10px] bg-[#f7f9f7]">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-3">Item Details</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Date Paid</th>
                  <th className="py-3 px-3">Method</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Notes</th>
                  {canManageFinances && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2ece2]">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={canManageFinances ? 8 : 7} className="py-12 text-center text-[#52605d]">
                      <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="font-bold text-stone-600">No payment records match your query</p>
                      <p className="text-xs text-stone-400 mt-1">
                        Try adjusting your search terms or filter selection.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map(rec => {
                    const isPaid = rec.status === 'Paid';
                    const isPending = rec.status === 'Pending';
                    const isOverdue = rec.status === 'Overdue';
                    const isWaived = rec.status === 'Waived';

                    return (
                      <tr key={rec.id} className="hover:bg-[#f7f9f7]/60 transition-colors">
                        {/* Member */}
                        <td className="py-3.5 px-4 font-extrabold text-[#1b4332]">
                          <p className="text-xs font-black">{rec.userName}</p>
                        </td>

                        {/* Item Details */}
                        <td className="py-3.5 px-3 font-bold text-[#1b4332]">
                          <span>{getItemTitle(rec)}</span>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-3 font-black text-[#1b4332]">
                          ₱{(Number(rec.amount) || 0).toLocaleString()}.00
                        </td>

                        {/* Dates */}
                        <td className="py-3.5 px-3 text-[#52605d]">
                          <p className="font-medium text-[#1b4332] text-[11px]">
                            {rec.status === 'Pending' ? '-' : (isWaived ? `${formatDisplayDate(rec.paidDate || rec.dueDate)}` : formatDisplayDate(rec.paidDate || rec.dueDate))}
                          </p>
                        </td>

                        {/* Method */}
                        <td className="py-3.5 px-3 text-[#52605d] font-medium">
                          {rec.status === 'Pending' ? '-' : (isWaived ? 'Waived (Exempted)' : (rec.paymentMethod || 'Cash'))}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : isWaived
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : isPending
                                ? 'bg-amber-100 text-amber-800'
                                : isOverdue
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            {isPaid && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                            {isWaived && <HeartHandshake className="w-3 h-3 text-amber-700" />}
                            {isPending && <Clock className="w-3 h-3 text-amber-700" />}
                            {isOverdue && <AlertCircle className="w-3 h-3 text-rose-700" />}
                            <span>{rec.status}</span>
                          </span>
                        </td>

                        {/* Notes */}
                        <td className="py-3.5 px-3 text-[#52605d] max-w-xs truncate text-[11px]">
                          {rec.notes || '-'}
                        </td>

                        {/* Actions */}
                        {canManageFinances && (
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenLogRecord(rec)}
                                title="Edit Record"
                                className="p-1.5 hover:bg-[#e2ece2] text-[#1b4332] rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteRecord(rec)}
                                title="Delete Record"
                                className="p-1.5 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION CONTROLS FOR FUNDS */}
          {filteredRecords.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#e2ece2] text-xs text-[#52605d]">
              <div>
                Showing{' '}
                <span className="font-extrabold text-[#1b4332]">
                  {(validCurrentPage - 1) * itemsPerPage + 1}
                </span>{' '}
                to{' '}
                <span className="font-extrabold text-[#1b4332]">
                  {Math.min(validCurrentPage * itemsPerPage, filteredRecords.length)}
                </span>{' '}
                of <span className="font-extrabold text-[#1b4332]">{filteredRecords.length}</span> payment records
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={validCurrentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-3 py-1.5 rounded-xl border border-[#e2ece2] bg-[#f7f9f7] hover:bg-[#e2ece2] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[#1b4332] flex items-center gap-1 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <span className="px-3 py-1.5 rounded-xl bg-[#1b4332] text-white font-extrabold text-xs shadow-2xs">
                  {validCurrentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={validCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-3 py-1.5 rounded-xl border border-[#e2ece2] bg-[#f7f9f7] hover:bg-[#e2ece2] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[#1b4332] flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: EXPENSES (CLUB DISBURSEMENTS & LIQUIDATIONS) */}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-[#e2ece2] shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-[#e2ece2]">
            <div>
              <h3 className="font-heading text-base font-extrabold text-[#1b4332] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-700" />
                <span>Club Expense Liquidations</span>
              </h3>
              <p className="text-xs text-[#52605d]">
                Liquidate and track all club expenditures involving member dues and treasury funds.
              </p>
            </div>
          </div>

          {/* EXPENSES SEARCH & CATEGORY FILTER BAR */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
            {/* Expense Search Box */}
            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 text-[#52605d] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search expense title, payee, or OR ref..."
                value={expenseSearchQuery}
                onChange={e => setExpenseSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#f7f9f7] border border-[#e2ece2] rounded-xl text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] focus:bg-white transition-colors"
              />
              {expenseSearchQuery && (
                <button
                  type="button"
                  onClick={() => setExpenseSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Dropdown */}
            <div className="flex items-center gap-2 min-w-[180px]">
              <span className="text-xs font-bold text-[#52605d] whitespace-nowrap">Category:</span>
              <div className="flex-1">
                <CustomSelect
                  value={expenseCategoryFilter}
                  onChange={setExpenseCategoryFilter}
                  options={[
                    { value: 'All', label: 'All Categories' },
                    ...EXPENSE_CATEGORIES.map(cat => ({ value: cat, label: cat })),
                  ]}
                />
              </div>
            </div>
          </div>

          {/* MOBILE EXPENSE CARDS VIEW */}
          <div className="block md:hidden space-y-3">
            {filteredExpenses.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-[#e2ece2] text-center text-[#52605d] space-y-2">
                <AlertCircle className="w-8 h-8 text-stone-300 mx-auto" />
                <p className="font-bold text-stone-600">No liquidated expenses found</p>
                <p className="text-xs text-stone-400">
                  Click "Liquidate Expense" to log a new club disbursement entry.
                </p>
              </div>
            ) : (
              paginatedExpenses.map(exp => (
                <div
                  key={exp.id}
                  className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-[#1b4332] text-sm">{exp.title}</p>
                      <span
                        className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getCategoryBadgeStyle(
                          exp.category
                        )}`}
                      >
                        {exp.category}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-rose-700 font-bold block uppercase">Disbursed</span>
                      <span className="font-black text-rose-700 text-sm">
                        - ₱{(Number(exp.amount) || 0).toLocaleString()}.00
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#e2ece2]">
                    <div>
                      <span className="text-[10px] text-[#52605d] block uppercase font-bold">Date</span>
                      <span className="font-medium text-[#1b4332]">{formatDisplayDate(exp.date)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#52605d] block uppercase font-bold">Receipt / Ref #</span>
                      <span className="font-mono text-[#1b4332]">{exp.receiptRef || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#e2ece2]">
                    <div>
                      <span className="text-[10px] text-[#52605d] block uppercase font-bold">Disbursed To</span>
                      <span className="font-semibold text-[#1b4332]">{exp.payeeOrDisbursedTo || 'General Vendor'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#52605d] block uppercase font-bold">Logged By</span>
                      <span className="font-medium text-[#52605d]">{exp.loggedBy || 'Treasury Admin'}</span>
                    </div>
                  </div>

                  {exp.notes && (
                    <p className="text-[11px] text-[#52605d] bg-white p-2 rounded-xl border border-[#e2ece2] italic">
                      "{exp.notes}"
                    </p>
                  )}

                  {canManageFinances && (
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleOpenExpenseModal(exp)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#e2ece2] text-[#1b4332] hover:bg-[#e2ece2] font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestDeleteExpense(exp)}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* DESKTOP EXPENSES TABLE VIEW */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#e2ece2] text-[#52605d] uppercase font-bold tracking-wider text-[10px] bg-[#f7f9f7]">
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Receipt / Ref #</th>
                  <th className="py-3 px-3">Payee / Disbursed To</th>
                  <th className="py-3 px-3">Notes</th>
                  {canManageFinances && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2ece2]">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={canManageFinances ? 8 : 7} className="py-12 text-center text-[#52605d]">
                      <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="font-bold text-stone-600">No expense liquidations match your query</p>
                      <p className="text-xs text-stone-400 mt-1">
                        Try adjusting your search query or category filter.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-[#f7f9f7]/60 transition-colors">
                      {/* Expense Title */}
                      <td className="py-3.5 px-4 font-black text-[#1b4332]">
                        <p className="text-xs font-black">{exp.title}</p>
                        <span className="text-[10px] text-[#52605d]">Logged by: {exp.loggedBy || 'Treasury Admin'}</span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black border ${getCategoryBadgeStyle(
                            exp.category
                          )}`}
                        >
                          {exp.category}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-3 font-black text-rose-700">
                        - ₱{(Number(exp.amount) || 0).toLocaleString()}.00
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-3 text-[#52605d] font-medium">
                        {formatDisplayDate(exp.date)}
                      </td>

                      {/* Receipt / Ref # */}
                      <td className="py-3.5 px-3 font-mono text-[#1b4332]">
                        {exp.receiptRef || '-'}
                      </td>

                      {/* Payee */}
                      <td className="py-3.5 px-3 font-semibold text-[#1b4332]">
                        {exp.payeeOrDisbursedTo || 'General Vendor'}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-3 text-[#52605d] max-w-xs truncate text-[11px]">
                        {exp.notes || '-'}
                      </td>

                      {/* Actions */}
                      {canManageFinances && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenExpenseModal(exp)}
                              title="Edit Expense Entry"
                              className="p-1.5 hover:bg-[#e2ece2] text-[#1b4332] rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestDeleteExpense(exp)}
                              title="Delete Expense Entry"
                              className="p-1.5 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION CONTROLS FOR EXPENSES */}
          {filteredExpenses.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#e2ece2] text-xs text-[#52605d]">
              <div>
                Showing{' '}
                <span className="font-extrabold text-[#1b4332]">
                  {(validExpensePage - 1) * itemsPerPage + 1}
                </span>{' '}
                to{' '}
                <span className="font-extrabold text-[#1b4332]">
                  {Math.min(validExpensePage * itemsPerPage, filteredExpenses.length)}
                </span>{' '}
                of <span className="font-extrabold text-[#1b4332]">{filteredExpenses.length}</span> expense items
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={validExpensePage === 1}
                  onClick={() => setExpenseCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-3 py-1.5 rounded-xl border border-[#e2ece2] bg-[#f7f9f7] hover:bg-[#e2ece2] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[#1b4332] flex items-center gap-1 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <span className="px-3 py-1.5 rounded-xl bg-[#1b4332] text-white font-extrabold text-xs shadow-2xs">
                  {validExpensePage} / {totalExpensePages}
                </span>

                <button
                  type="button"
                  disabled={validExpensePage >= totalExpensePages}
                  onClick={() => setExpenseCurrentPage(prev => Math.min(prev + 1, totalExpensePages))}
                  className="px-3 py-1.5 rounded-xl border border-[#e2ece2] bg-[#f7f9f7] hover:bg-[#e2ece2] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[#1b4332] flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: ACCOUNTS (MEMBER FINANCIAL ACCOUNTS & TRANSACTIONS) */}
      {activeTab === 'accounts' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-[#e2ece2] shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#e2ece2]">
            <div>
              <h3 className="font-heading text-base font-extrabold text-[#1b4332] flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-[#2d6a4f]" />
                <span>Member Accounts & Transaction Status</span>
              </h3>
              <p className="text-xs text-[#52605d]">
                View individual member financial accounts, membership fee status, monthly dues, and transaction histories.
              </p>
            </div>

            {/* Officer & Admin Member Selector */}
            {(canManageFinances || isOfficer) && (
              <div className="flex flex-wrap items-center gap-2 min-w-[240px]">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <span className="text-xs font-bold text-[#52605d] whitespace-nowrap">Member Account:</span>
                  <div className="flex-1">
                    <CustomSelect
                      value={accountMemberId}
                      onChange={setAccountMemberId}
                      options={[
                        ...(isAdmin || currentUser?.role === 'admin'
                          ? []
                          : [{ value: 'my_account', label: `My Account (${currentUser?.name || 'Member'})` }]),
                        { value: 'all_members', label: '📋 All Members Overview' },
                        ...users
                          .filter(u => u.role !== 'admin' && u.role?.toLowerCase() !== 'admin')
                          .map(u => ({
                            value: u.id,
                            label: `${u.name} (${u.memberNumber || 'BRC-MEMBER'})`,
                          })),
                      ]}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MODE A: ALL MEMBERS OVERVIEW (When Admin/Officer selects 'all_members') */}
          {(canManageFinances || isOfficer) && accountMemberId === 'all_members' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-[#52605d] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search member name or member #..."
                    value={accountSearchQuery}
                    onChange={e => setAccountSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#f7f9f7] border border-[#e2ece2] rounded-xl text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>
              </div>

              {/* Members Accounts Cards Grid */}
              {(() => {
                const filteredAccountUsers = users
                  .filter(u => u.role !== 'admin' && u.role?.toLowerCase() !== 'admin')
                  .filter(u =>
                    u.name.toLowerCase().includes(accountSearchQuery.toLowerCase()) ||
                    (u.memberNumber && u.memberNumber.toLowerCase().includes(accountSearchQuery.toLowerCase()))
                  );
                const totalAccountMembersPages = Math.ceil(filteredAccountUsers.length / itemsPerPage) || 1;
                const validAccountMembersPage = Math.min(Math.max(accountMembersCurrentPage, 1), totalAccountMembersPages);
                const paginatedAccountUsers = filteredAccountUsers.slice(
                  (validAccountMembersPage - 1) * itemsPerPage,
                  validAccountMembersPage * itemsPerPage
                );

                return (
                  <>
                    {filteredAccountUsers.length === 0 ? (
                      <div className="py-12 px-4 text-center text-[#52605d] bg-[#f7f9f7] rounded-2xl border border-[#e2ece2]">
                        <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                        <p className="font-bold text-stone-600 text-sm">No member accounts match your search</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paginatedAccountUsers.map(u => {
                          const uRecs = records.filter(r => r.userId === u.id);
                          const hasAnnualPromo = uRecs.some(r => r.itemType === 'Annual Upfront Promo' && r.status === 'Paid');
                          const mf = uRecs.find(r => r.itemType === 'Membership Fee');
                          const mfStatus = mf?.status || 'Pending';
                          
                          const mDues = uRecs.filter(r => r.itemType === 'Monthly Due');
                          const latestDue = mDues.slice().sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
                          const latestDueStatus = hasAnnualPromo ? 'Paid' : (latestDue?.status || 'Pending');
                          
                          const totalPaid = uRecs
                            .filter(r => r.status === 'Paid')
                            .reduce((sum, r) => {
                              if (r.itemType === 'Monthly Due' && r.notes?.includes('Satisfied by Annual Upfront Promo Package')) {
                                return sum;
                              }
                              return sum + (Number(r.amount) || 0);
                            }, 0);
                          const pendingCount = uRecs.filter(r => r.status === 'Pending' || r.status === 'Overdue').length;

                          return (
                            <div
                              key={u.id}
                              className="bg-[#f7f9f7] border border-[#e2ece2] rounded-2xl p-4 space-y-3.5 hover:border-[#2d6a4f] hover:shadow-md transition-all flex flex-col justify-between"
                            >
                              {/* Header: Avatar, Name, Member Number */}
                              <div className="flex items-center gap-3">
                                <img
                                  src={u.avatar || '/avatar.svg'}
                                  alt={u.name}
                                  className="w-11 h-11 rounded-full object-cover border-2 border-[#1b4332] shrink-0 bg-stone-100"
                                />
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-heading text-sm font-black text-[#1b4332] truncate">
                                    {u.name}
                                  </h4>
                                  <p className="text-[11px] text-[#52605d] font-mono font-bold">
                                    {u.memberNumber || 'BRC-MEMBER'}
                                  </p>
                                </div>
                              </div>

                              {/* Badges / Metrics Grid */}
                              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#e2ece2]">
                                <div className="p-2.5 rounded-xl bg-white border border-[#e2ece2]/80">
                                  <span className="text-[9px] uppercase font-extrabold text-[#52605d] block mb-1">Membership Fee</span>
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    mfStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {mfStatus}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-white border border-[#e2ece2]/80">
                                  <span className="text-[9px] uppercase font-extrabold text-[#52605d] block mb-1">Latest Monthly Due</span>
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    latestDueStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {hasAnnualPromo ? 'Paid (Promo)' : latestDueStatus}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-white border border-[#e2ece2]/80">
                                  <span className="text-[9px] uppercase font-extrabold text-[#52605d] block mb-0.5">Total Dues Paid</span>
                                  <span className="font-black text-[#1b4332] text-xs block">
                                    ₱{totalPaid.toLocaleString()}.00
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-white border border-[#e2ece2]/80">
                                  <span className="text-[9px] uppercase font-extrabold text-[#52605d] block mb-0.5">Pending Dues</span>
                                  <span className={`font-black text-xs block ${pendingCount > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                                    {pendingCount > 0 ? `${pendingCount} item(s)` : 'All Paid'}
                                  </span>
                                </div>
                              </div>

                              {/* Action Button */}
                              <button
                                type="button"
                                onClick={() => setAccountMemberId(u.id)}
                                className="w-full py-2.5 px-3 rounded-xl bg-[#1b4332] text-white hover:bg-[#2d6a4f] text-xs font-extrabold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs mt-auto"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View Transactions</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* PAGINATION CONTROLS FOR ALL MEMBERS */}
                    {filteredAccountUsers.length > 0 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#e2ece2] text-xs text-[#52605d]">
                        <div>
                          Showing{' '}
                          <span className="font-extrabold text-[#1b4332]">
                            {(validAccountMembersPage - 1) * itemsPerPage + 1}
                          </span>{' '}
                          to{' '}
                          <span className="font-extrabold text-[#1b4332]">
                            {Math.min(validAccountMembersPage * itemsPerPage, filteredAccountUsers.length)}
                          </span>{' '}
                          of <span className="font-extrabold text-[#1b4332]">{filteredAccountUsers.length}</span> members
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={validAccountMembersPage === 1}
                            onClick={() => setAccountMembersCurrentPage(prev => Math.max(prev - 1, 1))}
                            className="px-3 py-1.5 rounded-xl border border-[#e2ece2] bg-[#f7f9f7] hover:bg-[#e2ece2] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[#1b4332] flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Previous</span>
                          </button>

                          <span className="px-3 py-1.5 rounded-xl bg-[#1b4332] text-white font-extrabold text-xs shadow-2xs">
                            {validAccountMembersPage} / {totalAccountMembersPages}
                          </span>

                          <button
                            type="button"
                            disabled={validAccountMembersPage >= totalAccountMembersPages}
                            onClick={() => setAccountMembersCurrentPage(prev => Math.min(prev + 1, totalAccountMembersPages))}
                            className="px-3 py-1.5 rounded-xl border border-[#e2ece2] bg-[#f7f9f7] hover:bg-[#e2ece2] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[#1b4332] flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <span>Next</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            /* MODE B: INDIVIDUAL MEMBER ACCOUNT STATEMENT (For logged in member or selected member) */
            (() => {
              const targetMemberId =
                accountMemberId === 'my_account' || (!canManageFinances && !isOfficer)
                  ? currentUser?.id || ''
                  : accountMemberId;

              const targetUser =
                users.find(u => u.id === targetMemberId) ||
                (currentUser?.id === targetMemberId ? currentUser : null);

              const memberName = targetUser?.name || currentUser?.name || 'Member';
              const memberNo = targetUser?.memberNumber || currentUser?.memberNumber || 'BRC-MEMBER';

              const uRecords = records.filter(r => r.userId === targetMemberId);

              // Membership Fee Status
              const mfRec = uRecords.find(r => r.itemType === 'Membership Fee');
              const mfStatus = mfRec?.status || 'Pending';
              const mfAmount = mfRec?.amount || 200;

              // Latest Monthly Due Status
              const monthlyDueRecs = uRecords.filter(r => r.itemType === 'Monthly Due');
              const latestMonthlyDueRec = monthlyDueRecs.slice().sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
              const monthlyDueStatus = latestMonthlyDueRec?.status || 'Pending';
              const monthlyDueAmount = latestMonthlyDueRec?.amount || 200;
              const monthlyDueMonth = latestMonthlyDueRec?.coveredMonth || 'Current';

              // Totals & Category Breakdown
              const hasMemberPromo = uRecords.some(r => r.itemType === 'Annual Upfront Promo' && r.status === 'Paid');
              const memberPromoDiscount = hasMemberPromo ? 200 : 0;
              const totalPaid = uRecords
                .filter(r => r.status === 'Paid')
                .reduce((sum, r) => {
                  if (r.itemType === 'Monthly Due' && r.notes?.includes('Satisfied by Annual Upfront Promo Package')) {
                    return sum;
                  }
                  return sum + (Number(r.amount) || 0);
                }, 0);
              const mfPaid = uRecords.filter(r => r.status === 'Paid' && r.itemType === 'Membership Fee').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
              const duesPaid = uRecords.filter(r => r.status === 'Paid' && r.itemType === 'Monthly Due' && !r.notes?.includes('Satisfied by Annual Upfront Promo Package')).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
              const promoPaid = uRecords.filter(r => r.status === 'Paid' && r.itemType === 'Annual Upfront Promo').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
              const otherPaid = uRecords.filter(r => r.status === 'Paid' && r.itemType !== 'Membership Fee' && r.itemType !== 'Monthly Due' && r.itemType !== 'Annual Upfront Promo').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
              const totalPending = uRecords.filter(r => r.status === 'Pending' || r.status === 'Overdue').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

              // Filter member records for transaction history
              const filteredMemberRecs = uRecords.filter(r => {
                const title = getItemTitle(r).toLowerCase();
                const q = accountSearchQuery.toLowerCase();
                return (
                  title.includes(q) ||
                  r.itemType.toLowerCase().includes(q) ||
                  r.status.toLowerCase().includes(q) ||
                  (r.referenceNo && r.referenceNo.toLowerCase().includes(q))
                );
              });

              const totalAccountTxPages = Math.ceil(filteredMemberRecs.length / itemsPerPage) || 1;
              const validAccountTxPage = Math.min(Math.max(accountTxCurrentPage, 1), totalAccountTxPages);
              const paginatedMemberRecs = filteredMemberRecs.slice(
                (validAccountTxPage - 1) * itemsPerPage,
                validAccountTxPage * itemsPerPage
              );

              return (
                <div className="space-y-4">
                  {/* BACK TO ALL MEMBERS BUTTON */}
                  {(canManageFinances || isOfficer) && accountMemberId !== 'all_members' && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setAccountMemberId('all_members')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs transition-all cursor-pointer shadow-xs border border-[#1b4332]"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to All Members Overview</span>
                      </button>
                    </div>
                  )}

                  {/* MEMBER PAYMENT SUMMARY BANNER */}
                  <div className="hidden md:block p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#1b4332] via-[#2d6a4f] to-[#1b4332] text-white shadow-md space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/15 pb-3">
                      <div>
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#74c69d] block">
                          Total Payments Paid to Club (Joining to Present)
                        </span>
                        {isLoadingFinances ? (
                          <div className="py-1">
                            <CardValueSkeleton className="w-36 h-8 bg-white/20" />
                          </div>
                        ) : (
                          <h3 className="font-heading text-2xl sm:text-3xl font-black text-white mt-0.5">
                            ₱{totalPaid.toLocaleString()}.00
                          </h3>
                        )}
                        <p className="text-xs text-stone-200 mt-0.5 font-medium">
                          Accumulated paid transactions for <span className="font-bold text-white">{memberName}</span> <span className="font-mono text-stone-300">({memberNo})</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <span className="px-3 py-1 rounded-full bg-[#74c69d]/20 text-[#74c69d] text-xs font-extrabold border border-[#74c69d]/30">
                          {uRecords.filter(r => r.status === 'Paid').length} Verified Payments
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 text-xs">
                      {/* Membership Fee Paid */}
                      <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 space-y-1">
                        <span className="text-[10px] font-extrabold text-[#74c69d] uppercase block">Membership Fee</span>
                        {isLoadingFinances ? (
                          <CardValueSkeleton className="w-16 h-5 bg-white/20" />
                        ) : (
                          <p className="text-sm sm:text-base font-black text-white">₱{mfPaid.toLocaleString()}.00</p>
                        )}
                        <span className="text-[10px] text-stone-200 block">
                          {mfPaid > 0 ? '✓ Fully Paid' : 'Pending'}
                        </span>
                      </div>

                      {/* Monthly Dues / Promo Paid */}
                      <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 space-y-1">
                        <span className="text-[10px] font-extrabold text-[#74c69d] uppercase block">
                          {hasMemberPromo ? 'Monthly Dues (Promo)' : 'Monthly Dues'}
                        </span>
                        {isLoadingFinances ? (
                          <CardValueSkeleton className="w-16 h-5 bg-white/20" />
                        ) : (
                          <p className="text-sm sm:text-base font-black text-white">
                            ₱{(hasMemberPromo ? promoPaid : duesPaid).toLocaleString()}.00
                          </p>
                        )}
                        <span className="text-[10px] text-stone-200 block">
                          {hasMemberPromo ? '✓ Full Year Promo' : `${uRecords.filter(r => r.itemType === 'Monthly Due' && r.status === 'Paid').length} month(s) paid`}
                        </span>
                      </div>

                      {/* Other Collections Paid */}
                      <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 space-y-1">
                        <span className="text-[10px] font-extrabold text-[#74c69d] uppercase block">Other Collections</span>
                        {isLoadingFinances ? (
                          <CardValueSkeleton className="w-16 h-5 bg-white/20" />
                        ) : (
                          <p className="text-sm sm:text-base font-black text-white">₱{otherPaid.toLocaleString()}.00</p>
                        )}
                        <span className="text-[10px] text-stone-200 block">
                          Vests & special fees
                        </span>
                      </div>

                      {/* Promo Discount Card */}
                      <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 space-y-1">
                        <span className="text-[10px] font-extrabold text-indigo-200 uppercase block">Discount</span>
                        {isLoadingFinances ? (
                          <CardValueSkeleton className="w-16 h-5 bg-white/20" />
                        ) : (
                          <p className="text-sm sm:text-base font-black text-indigo-100">₱{memberPromoDiscount.toLocaleString()}.00</p>
                        )}
                        <span className="text-[10px] text-indigo-200 block">
                          {hasMemberPromo ? '✓ ₱200 Promo Discount' : 'Standard Rate'}
                        </span>
                      </div>

                      {/* Pending Dues */}
                      <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 space-y-1">
                        <span className="text-[10px] font-extrabold text-amber-300 uppercase block">Pending Balance</span>
                        {isLoadingFinances ? (
                          <CardValueSkeleton className="w-16 h-5 bg-white/20" />
                        ) : (
                          <p className="text-sm sm:text-base font-black text-amber-200">₱{totalPending.toLocaleString()}.00</p>
                        )}
                        <span className="text-[10px] text-stone-200 block">
                          {totalPending > 0 ? 'Unsettled dues' : '✓ All Clear'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* MEMBER TRANSACTIONS HISTORY HEADER & SEARCH */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#f7f9f7] p-3.5 sm:p-4 rounded-2xl border border-[#e2ece2]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#1b4332] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-heading text-xs sm:text-sm font-extrabold text-[#1b4332] leading-snug">
                          Statement of Transactions
                        </h4>
                        <p className="text-[10px] sm:text-xs text-[#52605d] font-medium">
                          Showing transactions for <span className="font-bold text-[#1b4332]">{memberName}</span> <span className="font-mono text-[10px] text-[#2d6a4f]">({memberNo})</span>
                        </p>
                      </div>
                    </div>

                    <div className="relative w-full sm:w-64 shrink-0">
                      <Search className="w-3.5 h-3.5 text-[#52605d] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search transactions..."
                        value={accountSearchQuery}
                        onChange={e => setAccountSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white border border-[#e2ece2] rounded-xl text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>
                  </div>

                  {/* MOBILE CARDS VIEW (Visible on small screens) */}
                  <div className="block sm:hidden space-y-2.5">
                    {filteredMemberRecs.length === 0 ? (
                      <div className="p-6 text-center text-[#52605d] bg-[#f7f9f7] rounded-2xl border border-[#e2ece2]">
                        <AlertCircle className="w-6 h-6 text-stone-300 mx-auto mb-1" />
                        <p className="font-bold text-stone-600 text-xs">No transaction records found</p>
                      </div>
                    ) : (
                      paginatedMemberRecs.map(rec => {
                        const isPaid = rec.status === 'Paid';
                        const isPending = rec.status === 'Pending';
                        const isOverdue = rec.status === 'Overdue';
                        const isWaived = rec.status === 'Waived';

                        return (
                          <div
                            key={rec.id}
                            className="p-3.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-2xl space-y-2.5 hover:border-[#2d6a4f] transition-all"
                          >
                            <div className="flex items-start justify-between gap-2 border-b border-[#e2ece2] pb-2">
                              <div>
                                <h5 className="font-bold text-xs text-[#1b4332] leading-tight">
                                  {getItemTitle(rec)}
                                </h5>
                                <p className="text-[10px] text-[#52605d] mt-0.5 font-medium">
                                  Period: <span className="font-semibold text-[#1b4332]">{rec.coveredMonth || formatDisplayDate(rec.dueDate)}</span>
                                </p>
                              </div>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                  isPaid
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : isWaived
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : isPending
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : isOverdue
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-stone-200 text-stone-700'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <span className="text-[#52605d] font-bold block">Amount:</span>
                                <span className="text-xs font-black text-[#1b4332]">
                                  ₱{(Number(rec.amount) || 0).toLocaleString()}.00
                                </span>
                              </div>
                              <div>
                                <span className="text-[#52605d] font-bold block">Method:</span>
                                <span className="font-semibold text-[#1b4332]">
                                  {isPending ? '-' : (isWaived ? 'Waived (Exempted)' : (rec.paymentMethod || 'Cash'))}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#52605d] font-bold block">Reference No:</span>
                                <span className="font-mono text-[#1b4332] font-semibold">
                                  {rec.referenceNo || '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#52605d] font-bold block">Date Updated:</span>
                                <span className="font-semibold text-[#1b4332]">
                                  {isPending ? '-' : formatDisplayDate(rec.paidDate || rec.updatedAt || rec.dueDate)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* DESKTOP TABLE VIEW (Visible on tablet/desktop screens) */}
                  <div className="hidden sm:block overflow-x-auto rounded-2xl border border-[#e2ece2]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#e2ece2] text-[#52605d] uppercase font-bold tracking-wider text-[10px] bg-[#f7f9f7]">
                          <th className="py-3 px-4">Transaction Item</th>
                          <th className="py-3 px-3">Covered Month / Date</th>
                          <th className="py-3 px-3">Amount</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3">Payment Method</th>
                          <th className="py-3 px-3">Ref #</th>
                          <th className="py-3 px-3">Date Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2ece2]">
                        {filteredMemberRecs.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-[#52605d]">
                              <AlertCircle className="w-6 h-6 text-stone-300 mx-auto mb-1" />
                              <p className="font-bold text-stone-600 text-xs">No transaction records found</p>
                            </td>
                          </tr>
                        ) : (
                          paginatedMemberRecs.map(rec => {
                            const isPaid = rec.status === 'Paid';
                            const isPending = rec.status === 'Pending';
                            const isOverdue = rec.status === 'Overdue';
                            const isWaived = rec.status === 'Waived';

                            return (
                              <tr key={rec.id} className="hover:bg-[#f7f9f7]/60 transition-colors">
                                <td className="py-3.5 px-4 font-black text-[#1b4332]">
                                  {getItemTitle(rec)}
                                </td>
                                <td className="py-3.5 px-3 text-[#52605d] font-medium">
                                  {rec.coveredMonth || formatDisplayDate(rec.dueDate)}
                                </td>
                                <td className="py-3.5 px-3 font-black text-[#1b4332]">
                                  ₱{(Number(rec.amount) || 0).toLocaleString()}.00
                                </td>
                                <td className="py-3.5 px-3">
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                      isPaid
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isWaived
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : isPending
                                        ? 'bg-amber-100 text-amber-800'
                                        : isOverdue
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-stone-200 text-stone-700'
                                    }`}
                                  >
                                    {rec.status}
                                  </span>
                                </td>
                                <td className="py-3.5 px-3 text-[#52605d] font-medium">
                                  {isPending ? '-' : (isWaived ? 'Waived (Exempted)' : (rec.paymentMethod || 'Cash'))}
                                </td>
                                <td className="py-3.5 px-3 font-mono text-[#1b4332]">
                                  {rec.referenceNo || '-'}
                                </td>
                                <td className="py-3.5 px-3 text-[#52605d] font-medium">
                                  {isPending ? '-' : formatDisplayDate(rec.paidDate || rec.updatedAt || rec.dueDate)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* PAGINATION CONTROLS FOR MEMBER TRANSACTIONS */}
                  {filteredMemberRecs.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#e2ece2] text-xs text-[#52605d]">
                      <div>
                        Showing{' '}
                        <span className="font-extrabold text-[#1b4332]">
                          {(validAccountTxPage - 1) * itemsPerPage + 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-extrabold text-[#1b4332]">
                          {Math.min(validAccountTxPage * itemsPerPage, filteredMemberRecs.length)}
                        </span>{' '}
                        of <span className="font-extrabold text-[#1b4332]">{filteredMemberRecs.length}</span> transaction records
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={validAccountTxPage === 1}
                          onClick={() => setAccountTxCurrentPage(prev => Math.max(prev - 1, 1))}
                          className="px-3 py-1.5 rounded-xl border border-[#e2ece2] bg-[#f7f9f7] hover:bg-[#e2ece2] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[#1b4332] flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Previous</span>
                        </button>

                        <span className="px-3 py-1.5 rounded-xl bg-[#1b4332] text-white font-extrabold text-xs shadow-2xs">
                          {validAccountTxPage} / {totalAccountTxPages}
                        </span>

                        <button
                          type="button"
                          disabled={validAccountTxPage >= totalAccountTxPages}
                          onClick={() => setAccountTxCurrentPage(prev => Math.min(prev + 1, totalAccountTxPages))}
                          className="px-3 py-1.5 rounded-xl border border-[#e2ece2] bg-[#f7f9f7] hover:bg-[#e2ece2] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[#1b4332] flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* MODAL: RECORD PAYMENT (FUNDS) */}
      <ModalPortal>
        {showAddRecordModal && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-[340px] sm:max-w-[390px] w-[94vw] max-h-[66dvh] sm:max-h-[70dvh] shadow-2xl border border-[#e2ece2] relative flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-2.5 sm:p-3 pb-2 border-b border-[#e2ece2] relative shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowAddRecordModal(false)}
                  className="absolute top-2 right-2 p-1 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="min-w-0 pr-6">
                  <h3 className="font-heading text-xs sm:text-sm font-black text-[#1b4332] leading-tight truncate">
                    {editingRecord ? 'Edit Payment Record' : 'Record Member Payment'}
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-[#52605d] truncate">
                    Log payment collections for fees, dues, or items
                  </p>
                </div>
              </div>

              <form onSubmit={handleInitiateSaveRecord} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2 sm:space-y-2.5 pr-1.5 text-xs">
                  {/* Success Notice Banner in Save & Add mode */}
                  {recordSuccessNotice && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-1.5 text-emerald-900 shadow-2xs animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-1.5 text-[9.5px] sm:text-[10px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{recordSuccessNotice}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecordSuccessNotice(null)}
                        className="text-emerald-700 hover:text-emerald-950 p-0.5 rounded-full hover:bg-emerald-100/50 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* No Members Warning Banner */}
                  {!hasMembers && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-1.5 text-amber-900 shadow-2xs">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
                      <div className="space-y-0.5 text-[9.5px]">
                        <p className="font-bold">No Registered Members Found</p>
                        <p className="text-amber-800 leading-snug">
                          Please add members in the <strong>Members Directory</strong> first.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Select Member */}
                  <div>
                    <CustomSelect
                      label="Select Club Member"
                      value={recUserId}
                      onChange={handleRecUserIdChange}
                      disabled={!hasMembers}
                      options={
                        !hasMembers
                          ? [{ value: '', label: 'No members registered yet', disabled: true }]
                          : registeredMembersList.map(u => ({
                              value: u.id,
                              label: `${u.name} (${u.memberNumber || 'BRC Member'})`,
                            }))
                      }
                      required
                    />
                  </div>

                  {/* Item Type */}
                  <div>
                    <CustomSelect
                      label="Item / Payment Type"
                      value={recOptionKey}
                      onChange={handleSelectPaymentOption}
                      options={paymentOptionsList}
                      disabled={!hasMembers}
                      required
                    />
                  </div>

                  {/* Covered Month if Monthly Due */}
                  {recItemType === 'Monthly Due' && (
                    <div className="p-2 bg-[#f7f9f7] rounded-lg border border-[#e2ece2] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332]">
                          Covered Month &amp; Year
                        </label>
                        {monthlyDuesList.length === 0 && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-full border border-amber-200">
                            No Dues
                          </span>
                        )}
                      </div>

                      {monthlyDuesList.length === 0 ? (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[9.5px] flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-bold text-amber-950">No Dues Configured Yet</p>
                            <p className="text-amber-800 leading-snug">
                              Configure dues in <strong>Settings &gt; Finance</strong> first.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-1">
                            <CustomSelect
                              value={recMonth}
                              onChange={handleRecMonthChange}
                              options={recMonthOptions}
                              disabled={!hasMembers}
                            />

                            <CustomSelect
                              value={recYear}
                              onChange={handleRecYearChange}
                              options={YEARS_LIST}
                              disabled={!hasMembers}
                            />
                          </div>

                          {isSelectedMonthAlreadyPaid && (
                            <div className="p-1.5 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-[9.5px] flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>
                                <strong>{recMonth} {recYear}</strong> is already paid.
                              </span>
                            </div>
                          )}

                          {!monthlyDuesList.some(d => String(d.year) === String(recYear)) && (
                            <div className="p-1.5 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-[9.5px] flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>
                                No dues created for {recYear}.
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Annual Upfront Promo Banner */}
                  {recItemType === 'Annual Upfront Promo' && (
                    isPromoEnabled ? (
                      <div className="p-2 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 rounded-lg border border-emerald-200 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-amber-400 text-slate-950 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full">
                            Promo Active
                          </span>
                          <span className="text-[10px] font-bold text-[#1b4332]">₱1,000.00 Upfront</span>
                        </div>
                        <p className="text-[9.5px] text-emerald-900 leading-snug">
                          Covers all 12 monthly dues in advance (save ₱200)!
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 bg-stone-100 rounded-lg border border-stone-300 space-y-0.5 opacity-80">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-stone-300 text-stone-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full">
                            Promo Disabled
                          </span>
                          <span className="text-[10px] font-bold text-stone-600">Disabled in Settings</span>
                        </div>
                      </div>
                    )
                  )}

                  {/* Custom Item Name if Other */}
                  {recItemType === 'Other' && (
                    <div>
                      <label className="block text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5">
                        Custom Item Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dinner Ticket"
                        value={recCustomItemName}
                        onChange={e => setRecCustomItemName(e.target.value)}
                        disabled={!hasMembers}
                        className="w-full px-2.5 py-1 sm:py-1.5 bg-[#f7f9f7] disabled:bg-[#f0f4f1] disabled:text-gray-400 border border-[#e2ece2] rounded-lg text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                        required
                      />
                    </div>
                  )}

                  {/* Amount & Status (hidden for Monthly Due) */}
                  {recItemType !== 'Monthly Due' && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5">
                          Amount (₱)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={recAmount}
                          onChange={e => setRecAmount(e.target.value)}
                          disabled={!hasMembers}
                          className="w-full px-2.5 py-1 sm:py-1.5 bg-[#f7f9f7] disabled:bg-[#f0f4f1] disabled:text-gray-400 border border-[#e2ece2] rounded-lg text-xs font-black text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                          required
                        />
                      </div>

                      <div>
                        <CustomSelect
                          label="Payment Status"
                          value={recStatus}
                          onChange={val => setRecStatus(val as any)}
                          options={['Paid', 'Pending', 'Overdue', 'Waived']}
                          disabled={!hasMembers}
                        />
                      </div>
                    </div>
                  )}

                  {/* Payment Method */}
                  <div>
                    <CustomSelect
                      label="Payment Method"
                      value={recMethod}
                      onChange={val => setRecMethod(val as any)}
                      disabled={!hasMembers}
                      options={[
                        { value: 'GCash', label: 'GCash' },
                        { value: 'Cash', label: 'Cash' },
                        { value: 'Bank Transfer', label: 'Bank Transfer' },
                        { value: 'Credit Card', label: 'Credit / Debit Card' },
                        { value: 'Other', label: 'Other' },
                      ]}
                    />
                  </div>

                  {/* Date Paid */}
                  <div>
                    <InteractiveDatePicker
                      label="Date Paid"
                      value={recDueDate}
                      onChange={val => setRecDueDate(val)}
                      disabled={!hasMembers}
                      required
                    />
                  </div>

                  {/* Notes (hidden for Monthly Due) */}
                  {recItemType !== 'Monthly Due' && (
                    <div>
                      <label className="block text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5">
                        Notes / Remarks
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Size L vest, verified"
                        value={recNotes}
                        onChange={e => setRecNotes(e.target.value)}
                        disabled={!hasMembers}
                        className="w-full px-2.5 py-1 sm:py-1.5 bg-[#f7f9f7] disabled:bg-[#f0f4f1] disabled:text-gray-400 border border-[#e2ece2] rounded-lg text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] focus:bg-white"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 p-2 sm:p-2.5 border-t border-[#e2ece2] bg-[#fafcfa] shrink-0">
                  {recordFormInvalidReason && (
                    <div className="text-[9.5px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1 shadow-2xs">
                      <AlertCircle className="w-3 h-3 shrink-0 text-amber-600" />
                      <span className="truncate">{recordFormInvalidReason}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowAddRecordModal(false)}
                      className="px-2.5 py-1 bg-white hover:bg-[#e2ece2] text-stone-700 rounded-lg text-[11px] font-bold border border-stone-200 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    {recItemType === 'Monthly Due' && !editingRecord && (
                      <button
                        type="button"
                        onClick={handleInitiateWaiveRecord}
                        disabled={!isWaiveValid}
                        title="Waive monthly due for members who joined before the club started"
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed text-white rounded-lg text-[11px] font-extrabold transition-all cursor-pointer shadow-sm flex items-center gap-1 whitespace-nowrap"
                      >
                        <HeartHandshake className="w-3 h-3 text-amber-200 shrink-0" />
                        <span>Waive</span>
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!isRecordFormValid}
                      className="px-3 py-1 bg-[#1b4332] hover:bg-[#2d6a4f] disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed text-white rounded-lg text-[11px] font-extrabold transition-all cursor-pointer shadow-sm flex items-center gap-1 whitespace-nowrap"
                    >
                      <Check className="w-3 h-3 text-[#74c69d]" />
                      <span>{editingRecord ? 'Save' : 'Save & Add'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </ModalPortal>

      {/* CONFIRM RECORD TRANSACTION MODAL */}
      <ModalPortal>
        {showConfirmRecordModal && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-[320px] sm:max-w-[360px] w-[94vw] p-3.5 sm:p-4 shadow-2xl border border-[#e2ece2] space-y-2.5 my-auto text-center animate-in zoom-in-95 duration-200">
              <div className={`w-9 h-9 ${isWaiveAction ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'} rounded-full flex items-center justify-center mx-auto shadow-inner`}>
                {isWaiveAction ? <HeartHandshake className="w-4.5 h-4.5" /> : <CheckCircle2 className="w-4.5 h-4.5" />}
              </div>

              <div className="space-y-0.5">
                <h3 className="font-heading text-sm font-extrabold text-[#1b4332]">
                  {isWaiveAction ? 'Confirm Due Waiver?' : (editingRecord ? 'Confirm Update?' : 'Confirm Payment?')}
                </h3>
                <p className="text-[10px] text-[#52605d] leading-tight">
                  {isWaiveAction ? 'Waiving this monthly due will exempt the member (e.g. joined before club started).' : 'Review payment details before saving.'}
                </p>
              </div>

              <div className="p-2.5 bg-[#f7f9f7] rounded-xl border border-[#e2ece2] text-left space-y-1.5 text-[10px] sm:text-[11px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-bold uppercase text-[#52605d]">Member</span>
                  <span className={`text-[9px] font-bold ${isWaiveAction ? 'text-amber-800 bg-amber-100 border-amber-200' : 'text-emerald-800 bg-emerald-100 border-emerald-200'} px-1.5 py-0.5 rounded-full border truncate`}>
                    {isWaiveAction ? 'Waived Due' : recItemType}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-black text-[#1b4332] truncate">
                    {users.find(u => u.id === recUserId)?.name || 'Club Member'}
                  </p>
                </div>

                <div className="pt-1.5 border-t border-[#e2ece2] space-y-1">
                  {recItemType === 'Monthly Due' && (
                    <div className="flex items-center justify-between text-[#52605d]">
                      <span>Period:</span>
                      <span className="font-bold text-[#1b4332]">{recMonth} {recYear}</span>
                    </div>
                  )}
                  {recItemType === 'Annual Upfront Promo' && (
                    <div className="flex items-center justify-between text-[#52605d]">
                      <span>Coverage:</span>
                      <span className="font-bold text-[#1b4332]">Full Year {recYear || '2026'}</span>
                    </div>
                  )}
                  {(recItemType === 'Donation Collection' || recItemType === 'Other') && recCustomItemName && (
                    <div className="flex items-center justify-between text-[#52605d]">
                      <span>Item:</span>
                      <span className="font-bold text-[#1b4332] truncate max-w-[140px]">{recCustomItemName}</span>
                    </div>
                  )}
                  {!isWaiveAction && (
                    <div className="flex items-center justify-between text-[#52605d]">
                      <span>Method:</span>
                      <span className="font-bold text-[#1b4332]">{recMethod}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[#52605d]">
                    <span>Status:</span>
                    <span className={`font-bold ${isWaiveAction ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {isWaiveAction ? 'Waived (₱0.00)' : 'Paid'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#52605d]">
                    <span>Date:</span>
                    <span className="font-bold text-[#1b4332]">{recDueDate || 'Today'}</span>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-[#e2ece2] flex items-center justify-between">
                  <span className="font-bold text-[#52605d]">Total:</span>
                  <span className="text-xs font-black text-[#1b4332]">
                    {isWaiveAction ? '₱0.00 (Waived)' : `₱${(parseFloat(recAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#e2ece2]">
                <button
                  type="button"
                  onClick={() => setShowConfirmRecordModal(false)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#e2ece2] text-[#52605d] hover:bg-[#f7f9f7] font-bold text-[11px] transition-colors cursor-pointer text-center"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleProceedSaveRecord}
                  className={`w-full px-2.5 py-1.5 rounded-lg ${isWaiveAction ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#1b4332] hover:bg-[#2d6a4f]'} text-white font-extrabold text-[11px] transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1 text-center`}
                >
                  {isWaiveAction ? <HeartHandshake className="w-3 h-3 text-amber-200 shrink-0" /> : <Check className="w-3 h-3 text-[#74c69d] shrink-0" />}
                  <span>{isWaiveAction ? 'Confirm Waive' : (editingRecord ? 'Save' : 'Confirm')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </ModalPortal>

      {/* MODAL: LIQUIDATE EXPENSE */}
      <ModalPortal>
        {showExpenseModal && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-[340px] sm:max-w-[390px] w-[94vw] max-h-[66dvh] sm:max-h-[70dvh] shadow-2xl border border-[#e2ece2] relative flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-2.5 sm:p-3 pb-2 border-b border-[#e2ece2] relative shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="absolute top-2 right-2 p-1 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="min-w-0 pr-6">
                  <h3 className="font-heading text-xs sm:text-sm font-black text-[#1b4332] leading-tight truncate">
                    {editingExpense ? 'Edit Expense Liquidation' : 'Liquidate Club Expense'}
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-[#52605d] truncate">
                    Log disbursements &amp; official expenditures
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveExpense} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2 sm:space-y-2.5 pr-1.5 text-xs">
                  {/* Expense Title */}
                  <div>
                    <label className="block text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5">
                      Expense Title / Particulars
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Food & Refreshments"
                      value={expTitle}
                      onChange={e => setExpTitle(e.target.value)}
                      className="w-full px-2.5 py-1 sm:py-1.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-lg text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] font-semibold"
                      required
                    />
                  </div>

                  {/* Category & Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div>
                      <CustomSelect
                        label="Category"
                        value={expCategory}
                        onChange={val => setExpCategory(val as ExpenseCategory)}
                        options={EXPENSE_CATEGORIES.map(cat => ({ value: cat, label: cat }))}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5">
                        Amount (₱)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="e.g. 2500"
                        value={expAmount}
                        onChange={e => setExpAmount(e.target.value)}
                        className="w-full px-2.5 py-1 sm:py-1.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-lg text-xs font-black text-rose-800 focus:outline-none focus:border-[#2d6a4f]"
                        required
                      />
                    </div>
                  </div>

                  {/* Date & Receipt Reference */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div>
                      <InteractiveDatePicker
                        label="Disbursement Date"
                        value={expDate}
                        onChange={val => setExpDate(val)}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5">
                        OR / Receipt #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. OR-88219"
                        value={expReceiptRef}
                        onChange={e => setExpReceiptRef(e.target.value)}
                        className="w-full px-2.5 py-1 sm:py-1.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-lg text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] font-mono"
                      />
                    </div>
                  </div>

                  {/* Disbursed To & Logged By */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5">
                        Payee / Vendor
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Shell Gas Station"
                        value={expPayee}
                        onChange={e => setExpPayee(e.target.value)}
                        className="w-full px-2.5 py-1 sm:py-1.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-lg text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>

                    <div>
                      <CustomSelect
                        label="Logged By"
                        value={expLoggedBy}
                        onChange={val => setExpLoggedBy(val)}
                        options={officerOptions}
                        placeholder="Select Officer..."
                        searchable
                        required
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5">
                      Purpose / Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Context on this expenditure..."
                      value={expNotes}
                      onChange={e => setExpNotes(e.target.value)}
                      className="w-full px-2.5 py-1 sm:py-1.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-lg text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                </div>

                <div className="p-2 sm:p-2.5 border-t border-[#e2ece2] bg-[#fafcfa] flex items-center justify-end gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(false)}
                    className="px-2.5 py-1 bg-white hover:bg-[#e2ece2] text-stone-700 rounded-lg text-[11px] font-bold border border-stone-200 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-rose-800 hover:bg-rose-900 text-white rounded-lg text-[11px] font-extrabold transition-all cursor-pointer shadow-sm flex items-center gap-1"
                  >
                    <Check className="w-3 h-3 text-rose-200" />
                    <span>{editingExpense ? 'Save' : 'Liquidate'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </ModalPortal>

      {/* DELETE TRANSACTION CONFIRMATION MODAL */}
      <ModalPortal>
        {deleteTarget && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#e2ece2] space-y-5 my-auto text-center animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 shadow-inner">
                <Trash2 className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-heading text-lg font-extrabold text-[#1b4332]">
                  Delete {deleteTarget.type === 'fund' ? 'Payment' : 'Expense'} Record?
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Are you sure you want to delete this {deleteTarget.type === 'fund' ? 'payment' : 'expense liquidation'} record? This action will remove it permanently from both local storage and MongoDB.
                </p>
              </div>

              <div className="p-3.5 bg-[#f7f9f7] rounded-2xl border border-[#e2ece2] text-left space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#52605d]">
                    {deleteTarget.type === 'fund' ? 'Member / Payee' : 'Title'}
                  </span>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                    {deleteTarget.type === 'fund' ? 'Payment Record' : 'Expense Liquidation'}
                  </span>
                </div>
                <p className="text-xs font-black text-[#1b4332] truncate">{deleteTarget.title}</p>
                {deleteTarget.subtitle && (
                  <p className="text-[11px] font-medium text-[#52605d] truncate">{deleteTarget.subtitle}</p>
                )}
                <div className="pt-2 border-t border-[#e2ece2] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#52605d]">Record Amount:</span>
                  <span className="text-sm font-black text-rose-700">
                    ₱{(Number(deleteTarget?.amount) || 0).toLocaleString()}.00
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#e2ece2]">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-[#f7f9f7] font-extrabold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Record</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </ModalPortal>

      {/* Yearly Archive Modal */}
      <YearlyArchiveModal
        isOpen={showYearlyArchiveModal}
        onClose={() => setShowYearlyArchiveModal(false)}
        records={records}
        expenses={expenses}
        users={users}
        dynamicCols={dynamicColsList}
        currentUser={currentUser}
        onArchiveComplete={handleArchiveComplete}
        deleteRecordsForYear={deleteRecordsForYear}
      />

      {/* Archive Export Modal for Imported or Extracted Packages */}
      <ArchiveExportModal
        isOpen={showArchiveExportModal}
        onClose={() => {
          setShowArchiveExportModal(false);
          setImportedArchiveData(null);
        }}
        data={importedArchiveData}
      />

      {/* Treasurer Authorization Request & Instant Override Modal */}
      {treasurerAuthTarget && (
        <TreasurerAuthModal
          isOpen={Boolean(treasurerAuthTarget)}
          onClose={() => setTreasurerAuthTarget(null)}
          actionType={treasurerAuthTarget.actionType}
          targetType={treasurerAuthTarget.targetType}
          targetId={treasurerAuthTarget.targetId}
          targetTitle={treasurerAuthTarget.targetTitle}
          targetSubtitle={treasurerAuthTarget.targetSubtitle}
          targetAmount={treasurerAuthTarget.targetAmount}
          targetDate={treasurerAuthTarget.targetDate}
          targetRef={treasurerAuthTarget.targetRef}
          onSuccess={() => {
            const onGrant = treasurerAuthTarget.onGrant;
            setTreasurerAuthTarget(null);
            if (onGrant) {
              onGrant();
            }
          }}
        />
      )}

      {/* Treasurer Requests Management & Review Modal (For Admins & Treasurers) */}
      <TreasurerRequestsManagerModal
        isOpen={showTreasurerRequestsModal}
        onClose={() => setShowTreasurerRequestsModal(false)}
        onSelectAction={(req) => {
          setShowTreasurerRequestsModal(false);
          if (req.targetType === 'fund') {
            const rec = records.find(r => r.id === req.targetId);
            if (rec) {
              if (req.actionType === 'edit') {
                openLogRecordDirectly(rec);
              } else {
                requestDeleteRecordDirectly(rec);
              }
            }
          } else {
            const exp = expenses.find(x => x.id === req.targetId);
            if (exp) {
              if (req.actionType === 'edit') {
                openExpenseModalDirectly(exp);
              } else {
                requestDeleteExpenseDirectly(exp);
              }
            }
          }
        }}
      />

      {/* Official Processing Loader */}
      <OfficialLoader isLoading={isProcessing} message={processingMsg} />

      {/* Delete All Finance Logs Confirmation Modal */}
      <ModalPortal>
        {showDeleteAllConfirmModal && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-heading font-black text-stone-900">
                  Delete All Finance Logs?
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Are you sure you want to delete <span className="font-bold text-stone-900">ALL finance logs</span> from MongoDB? This action is permanent and will wipe out all transaction records.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteAllConfirmModal(false)}
                  className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-black transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAllFinanceLogs}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-colors cursor-pointer shadow-sm"
                >
                  Yes, Delete All
                </button>
              </div>
            </div>
          </div>
        )}
      </ModalPortal>

      {/* Finance Action / Error Notice Modal */}
      <ModalPortal>
        {financeNoticeModal && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full p-4 sm:p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className={`w-12 h-12 rounded-2xl ${financeNoticeModal.isError ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-[#1b4332] border border-emerald-200'} flex items-center justify-center mx-auto`}>
                {financeNoticeModal.isError ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-[#2d6a4f]" />
                )}
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-heading font-black text-stone-900">
                  {financeNoticeModal.title}
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  {financeNoticeModal.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFinanceNoticeModal(null)}
                className="w-full py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black transition-colors cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        )}
      </ModalPortal>
    </div>
  );
};
