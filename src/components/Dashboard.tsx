import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { store, safeFetchJson, getCachedData } from '../lib/db';
import { loadFromSession } from '../lib/storageSecurity';
import { TabType } from './Navigation';
import { User } from '../types';
import { RoleAvatarBadge } from './RoleAvatarBadge';
import { CardValueSkeleton, CardSubSkeleton } from './OfficialLoader';
import {
  Users,
  ArrowUpRight,
  Sparkles,
  Coins,
  TrendingDown,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Bike,
  ShieldCheck,
  Calendar,
  Search,
} from 'lucide-react';

interface DashboardProps {
  setActiveTab: (tab: TabType) => void;
  onOpenDuesModal?: () => void;
  onOpenLogRideModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  setActiveTab,
}) => {
  const { currentUser, isAdmin } = useAuth();

  const [allUsers, setAllUsers] = useState<User[]>(() => store.getUsers());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(() => allUsers.length === 0);

  // Fetch latest members and registrations from MongoDB database on mount and listen to updates
  useEffect(() => {
    const fetchLatestUsers = async () => {
      try {
        await store.initMongoDb();
        const freshUsers = store.getUsers();
        if (freshUsers && freshUsers.length > 0) {
          setAllUsers([...freshUsers]);
        }
      } catch (err) {
        console.warn('Notice while loading dashboard members:', err);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchLatestUsers();

    const handleUsersUpdated = (e: Event) => {
      const updated = (e as CustomEvent).detail || store.getUsers();
      if (Array.isArray(updated)) {
        setAllUsers([...updated]);
        setIsLoadingUsers(false);
      }
    };

    window.addEventListener('bcc_users_updated', handleUsersUpdated);
    return () => window.removeEventListener('bcc_users_updated', handleUsersUpdated);
  }, []);

  const members = allUsers.filter((m) => m.role !== 'admin' && m.id !== 'usr_admin');
  const totalMembers = members.length;
  const activeMembersCount = members.filter(
    (m) => m.approvalStatus === 'Approved' || (m.approvalStatus && m.approvalStatus.toLowerCase() !== 'pending')
  ).length;
  const pendingApprovalsCount = allUsers.filter(
    (m) => m.approvalStatus === 'Pending' || (m.approvalStatus && m.approvalStatus.toLowerCase() === 'pending')
  ).length;

  // Treasury stats state with instant cache hydration
  const [financeRecords, setFinanceRecords] = useState<any[]>(() => {
    return (
      getCachedData('/api/mongodb/financeLogs', null) ||
      getCachedData('bcc_finance_records_v3', null) ||
      loadFromSession<any[]>('bcc_finance_records_v3', [])
    );
  });

  const [expenseRecords, setExpenseRecords] = useState<any[]>(() => {
    return (
      getCachedData('/api/mongodb/liquidationLogs', null) ||
      getCachedData('/api/mongodb/expenseLogs', null) ||
      getCachedData('bcc_expense_records_v1', null) ||
      loadFromSession<any[]>('bcc_expense_records_v1', [])
    );
  });

  const [isLoadingFinances, setIsLoadingFinances] = useState<boolean>(() => financeRecords.length === 0);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState<boolean>(() => expenseRecords.length === 0);

  useEffect(() => {
    if (!currentUser) return;

    const fetchFinances = () => {
      safeFetchJson('/api/mongodb/financeLogs')
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setFinanceRecords(data.data);
          } else {
            setFinanceRecords(loadFromSession<any[]>('bcc_finance_records_v3', []));
          }
        })
        .catch(() => {
          setFinanceRecords(loadFromSession<any[]>('bcc_finance_records_v3', []));
        })
        .finally(() => {
          setIsLoadingFinances(false);
        });

      safeFetchJson('/api/mongodb/liquidationLogs')
        .then((data) => {
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setExpenseRecords(data.data);
            setIsLoadingExpenses(false);
          } else {
            safeFetchJson('/api/mongodb/expenseLogs')
              .then((expData) => {
                if (expData.success && Array.isArray(expData.data)) {
                  setExpenseRecords(expData.data);
                } else {
                  setExpenseRecords(loadFromSession<any[]>('bcc_expense_records_v1', []));
                }
              })
              .catch(() => {
                setExpenseRecords(loadFromSession<any[]>('bcc_expense_records_v1', []));
              })
              .finally(() => {
                setIsLoadingExpenses(false);
              });
          }
        })
        .catch(() => {
          setExpenseRecords(loadFromSession<any[]>('bcc_expense_records_v1', []));
          setIsLoadingExpenses(false);
        });
    };

    fetchFinances();

    const handleFinanceUpdated = () => {
      fetchFinances();
    };

    window.addEventListener('bcc_finance_updated', handleFinanceUpdated);
    return () => window.removeEventListener('bcc_finance_updated', handleFinanceUpdated);
  }, [currentUser]);

  const pendingUserIds = new Set(allUsers.filter((u) => u.approvalStatus === 'Pending').map((u) => u.id));
  const validFinanceRecords = financeRecords.filter(
    (r) => !r.userId || !pendingUserIds.has(r.userId)
  );

  const totalCollected = validFinanceRecords
    .filter((r) => r.status === 'Paid')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const totalExpenses = expenseRecords.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
  const netBalance = totalCollected - totalExpenses;
  const totalPaidCount = validFinanceRecords.filter((r) => r.status === 'Paid').length;

  const approvedUsersList = allUsers.filter(u => {
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
      const hasAnnualPromo = validFinanceRecords.some(r => r.userId === u.id && r.itemType === 'Annual Upfront Promo' && r.status === 'Paid');
      const hasPaid = validFinanceRecords.some(r => r.userId === u.id && r.itemType === 'Monthly Due' && (r.coveredMonth === `${due.month} ${due.year}` || r.customItemName === due.title) && r.status === 'Paid');
      if (!hasAnnualPromo && !hasPaid) {
        calculatedPendingMonthlyDues += due.amount;
      }
    });
  });

  const otherPendingRecordsTotal = validFinanceRecords
    .filter(r => (r.status === 'Pending' || r.status === 'Overdue') && r.itemType !== 'Monthly Due')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const totalPending = calculatedPendingMonthlyDues + otherPendingRecordsTotal;

  const [dashboardPage, setDashboardPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setDashboardPage(1);
  }, [searchTerm]);

  const filteredMembersList = members.filter((m) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.username && m.username.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.memberNumber && m.memberNumber.toLowerCase().includes(q)) ||
      (m.bikeInfo?.make && m.bikeInfo.make.toLowerCase().includes(q)) ||
      (m.bikeInfo?.model && m.bikeInfo.model.toLowerCase().includes(q))
    );
  });

  const totalDashboardPages = Math.max(1, Math.ceil(filteredMembersList.length / itemsPerPage));
  const validDashboardPage = Math.min(Math.max(1, dashboardPage), totalDashboardPages);
  const paginatedMembersList = filteredMembersList.slice(
    (validDashboardPage - 1) * itemsPerPage,
    validDashboardPage * itemsPerPage
  );

  return (
    <div className="space-y-3 sm:space-y-6 lg:space-y-8 pb-4 sm:pb-6">
      {/* Welcome Banner */}
      <div className="relative rounded-xl sm:rounded-3xl bg-[#1b4332] text-white border border-[#2d6a4f] p-3 sm:p-6 lg:p-8 overflow-hidden glow-forest">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-[#74c69d]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-6">
          <div className="space-y-1 sm:space-y-2 max-w-xl">
            {!isAdmin && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2d6a4f] text-[#d8f3dc] text-[9px] sm:text-xs font-semibold border border-[#74c69d]/30">
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#74c69d]" />
                <span>BCC Riders Club Console</span>
              </div>
            )}
            <h1 className="font-heading text-base sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, <span className="text-[#74c69d]">{isAdmin ? 'Admin' : currentUser?.name}</span>!
            </h1>
            <p className="text-[#d8f3dc]/90 text-[10px] sm:text-xs lg:text-sm leading-relaxed">
              {isAdmin ? (
                <>
                  Role: <span className="capitalize text-[#74c69d] font-semibold">Administrator</span>. Executive management portal for club operations and membership management.
                </>
              ) : (
                <>
                  Member ID: <strong className="text-white">{currentUser?.memberNumber || 'N/A'}</strong> | Role:{' '}
                  <span className="capitalize text-[#74c69d] font-semibold">{currentUser?.role === 'admin' ? 'Admin' : 'Member'}</span>. Welcome to the BCC Riders Club Portal.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Section */}
      <div className="space-y-2 sm:space-y-3 sm:gap-4">
        {/* Row 1: Active Members & Pending Approvals (Side-by-side on mobile: grid-cols-2) */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {/* Active Members */}
          <div
            onClick={() => {
              localStorage.setItem('bcc_roster_tab', 'active');
              setActiveTab('members');
            }}
            className="p-2.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex flex-col justify-between shadow-xs cursor-pointer hover:border-[#74c69d] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 select-none"
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[9px] sm:text-xs text-[#52605d] font-bold uppercase tracking-wider">Active Members</span>
              <div className="p-1 sm:p-2.5 rounded-lg sm:rounded-xl bg-[#d8f3dc] text-[#1b4332] shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              {isLoadingUsers ? (
                <div className="py-1 space-y-1">
                  <CardValueSkeleton className="w-16 h-6 sm:h-8" />
                  <CardSubSkeleton className="w-14 h-3" />
                </div>
              ) : (
                <>
                  <p className="font-heading text-sm sm:text-2xl font-extrabold text-[#1b4332]">
                    {activeMembersCount}{' '}
                    <span className="text-[9px] sm:text-xs font-normal text-[#52605d]">/ {totalMembers}</span>
                  </p>
                  <span className="text-[8.5px] sm:text-[11px] text-[#2d6a4f] font-medium flex items-center gap-0.5 mt-0.5">
                    <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    {totalMembers > 0 ? Math.round((activeMembersCount / totalMembers) * 100) : 0}% active
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Pending Approvals */}
          <div
            onClick={() => {
              localStorage.setItem('bcc_roster_tab', 'pending');
              setActiveTab('members');
            }}
            className="p-2.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex flex-col justify-between shadow-xs cursor-pointer hover:border-[#74c69d] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 select-none"
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[9px] sm:text-xs text-[#52605d] font-bold uppercase tracking-wider">Pending Approvals</span>
              <div className={`p-1 sm:p-2.5 rounded-lg sm:rounded-xl shrink-0 ${pendingApprovalsCount > 0 ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
                <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              {isLoadingUsers ? (
                <div className="py-1 space-y-1">
                  <CardValueSkeleton className="w-12 h-6 sm:h-8" />
                  <CardSubSkeleton className="w-14 h-3" />
                </div>
              ) : (
                <>
                  <p className={`font-heading text-sm sm:text-2xl font-extrabold ${pendingApprovalsCount > 0 ? 'text-amber-900' : 'text-[#1b4332]'}`}>
                    {pendingApprovalsCount}
                  </p>
                  <span className="text-[8.5px] sm:text-[11px] text-[#52605d] font-medium block mt-0.5 truncate">
                    {pendingApprovalsCount > 0 ? 'Action in Roster' : 'All processed'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Total Funds, Total Expenses, Net Treasury Balance, Pending Dues Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          {/* Total Funds */}
          <div
            onClick={() => setActiveTab('finances')}
            className="p-2.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex items-center justify-between shadow-xs cursor-pointer hover:border-[#74c69d] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 select-none"
          >
            <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
              <span className="text-[9px] sm:text-xs text-[#52605d] font-bold uppercase tracking-wider block">Total Funds</span>
              {isLoadingFinances ? (
                <div className="py-1 space-y-1">
                  <CardValueSkeleton className="w-28 h-6 sm:h-8" />
                  <CardSubSkeleton className="w-20 h-3" />
                </div>
              ) : (
                <>
                  <p className="font-heading text-sm sm:text-2xl font-black text-[#1b4332] truncate">
                    ₱{totalCollected.toLocaleString()}.00
                  </p>
                  <span className="text-[8.5px] sm:text-[11px] text-[#2d6a4f] font-semibold block truncate">
                    {totalPaidCount} verified payments
                  </span>
                </>
              )}
            </div>
            <div className="p-1.5 sm:p-3 rounded-lg sm:rounded-xl bg-[#d8f3dc] text-[#1b4332] shrink-0 ml-2">
              <Coins className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>

          {/* Total Expenses */}
          <div
            onClick={() => setActiveTab('finances')}
            className="p-2.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex items-center justify-between shadow-xs cursor-pointer hover:border-[#74c69d] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 select-none"
          >
            <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
              <span className="text-[9px] sm:text-xs text-[#52605d] font-bold uppercase tracking-wider block">Total Expenses</span>
              {isLoadingExpenses ? (
                <div className="py-1 space-y-1">
                  <CardValueSkeleton className="w-28 h-6 sm:h-8" />
                  <CardSubSkeleton className="w-20 h-3" />
                </div>
              ) : (
                <>
                  <p className="font-heading text-sm sm:text-2xl font-black text-rose-700 truncate">
                    ₱{totalExpenses.toLocaleString()}.00
                  </p>
                  <span className="text-[8.5px] sm:text-[11px] text-rose-600 font-semibold block truncate">
                    {expenseRecords.length} liquidated items
                  </span>
                </>
              )}
            </div>
            <div className="p-1.5 sm:p-3 rounded-lg sm:rounded-xl bg-rose-100 text-rose-800 shrink-0 ml-2">
              <TrendingDown className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>

          {/* Net Treasury Balance */}
          <div
            onClick={() => setActiveTab('finances')}
            className="p-2.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex items-center justify-between shadow-xs cursor-pointer hover:border-[#74c69d] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 select-none"
          >
            <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
              <span className="text-[9px] sm:text-xs text-[#52605d] font-bold uppercase tracking-wider block">Net Treasury</span>
              {isLoadingFinances || isLoadingExpenses ? (
                <div className="py-1 space-y-1">
                  <CardValueSkeleton className="w-28 h-6 sm:h-8" />
                  <CardSubSkeleton className="w-24 h-3" />
                </div>
              ) : (
                <>
                  <p className={`font-heading text-sm sm:text-2xl font-black truncate ${netBalance >= 0 ? 'text-[#1b4332]' : 'text-rose-700'}`}>
                    ₱{netBalance.toLocaleString()}.00
                  </p>
                  <span className="text-[8.5px] sm:text-[11px] text-[#52605d] font-semibold block truncate">
                    Funds minus Expenses
                  </span>
                </>
              )}
            </div>
            <div className={`p-1.5 sm:p-3 rounded-lg sm:rounded-xl shrink-0 ml-2 ${netBalance >= 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
              <Wallet className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>

          {/* Pending Dues */}
          <div
            onClick={() => setActiveTab('finances')}
            className="p-2.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex items-center justify-between shadow-xs cursor-pointer hover:border-[#74c69d] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 select-none"
          >
            <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
              <span className="text-[9px] sm:text-xs text-[#52605d] font-bold uppercase tracking-wider block">Pending Dues</span>
              {isLoadingFinances ? (
                <div className="py-1 space-y-1">
                  <CardValueSkeleton className="w-28 h-6 sm:h-8" />
                  <CardSubSkeleton className="w-20 h-3" />
                </div>
              ) : (
                <>
                  <p className="font-heading text-sm sm:text-2xl font-black text-amber-900 truncate">
                    ₱{totalPending.toLocaleString()}.00
                  </p>
                  <span className="text-[8.5px] sm:text-[11px] text-amber-700 font-semibold block truncate">
                    Uncollected balance
                  </span>
                </>
              )}
            </div>
            <div className="p-1.5 sm:p-3 rounded-lg sm:rounded-xl bg-amber-100 text-amber-800 shrink-0 ml-2">
              <Clock className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Admin Registered Members & Applications Roster Card */}
      {isAdmin && (
        <div className="p-3 sm:p-6 rounded-xl sm:rounded-3xl bg-white border border-[#e2ece2] space-y-3 sm:space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-2.5 sm:pb-3 border-b border-[#e2ece2]">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[#d8f3dc] text-[#1b4332] shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-heading font-extrabold text-xs sm:text-lg text-[#1b4332] truncate">
                  Registered Members & Applicants
                </h3>
                <p className="text-[9px] sm:text-xs text-[#52605d] truncate">
                  Live records synced directly from MongoDB database ({members.length} {members.length === 1 ? 'record' : 'records'})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#52605d]" />
                <input
                  type="text"
                  placeholder="Filter members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-7 sm:pl-8 pr-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-[#e2ece2] text-[11px] sm:text-xs focus:outline-none focus:border-[#2d6a4f]"
                />
              </div>
              <button
                onClick={() => setActiveTab('members')}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#1b4332] text-white hover:bg-[#2d6a4f] transition-colors text-[11px] sm:text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <span>Directory</span>
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          </div>

          {filteredMembersList.length === 0 ? (
            <div className="py-6 sm:py-10 text-center space-y-2 sm:space-y-3 bg-[#f7f9f7] rounded-xl sm:rounded-2xl border border-dashed border-[#e2ece2]">
              <div className="w-9 h-9 sm:w-12 sm:h-12 mx-auto rounded-full bg-white flex items-center justify-center text-[#52605d] shadow-2xs">
                <Users className="w-4.5 h-4.5 sm:w-6 sm:h-6" />
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <h4 className="font-bold text-[#1b4332] text-xs sm:text-sm">No Members Match Search</h4>
                <p className="text-[10px] sm:text-xs text-[#52605d] max-w-sm mx-auto px-3">
                  {searchTerm
                    ? 'No registered member records matched your search query.'
                    : 'No member registrations found in the MongoDB database yet.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile View: High-Density Compact Card List (visible on sm:hidden) */}
              <div className="block sm:hidden divide-y divide-[#e2ece2]">
                {paginatedMembersList.map((m) => {
                  const isPending = m.approvalStatus === 'Pending' || m.approvalStatus?.toLowerCase() === 'pending';
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        if (isPending) {
                          localStorage.setItem('bcc_roster_tab', 'pending');
                        } else {
                          localStorage.setItem('bcc_roster_tab', 'active');
                        }
                        setActiveTab('members');
                      }}
                      className="py-2.5 px-1 hover:bg-[#f0f4f1]/50 transition-colors cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <RoleAvatarBadge
                          avatarUrl={m.avatar || '/avatar.svg'}
                          name={m.name || m.username || 'Club Member'}
                          role={m.role}
                          sizeClass="w-8 h-8 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-[#1b4332] text-[11px] truncate">
                              {m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.username}
                            </p>
                            <span className="font-mono text-[9px] font-bold text-[#2d6a4f] bg-[#d8f3dc]/60 px-1.5 py-0.2 rounded border border-[#74c69d]/40 whitespace-nowrap">
                              {m.memberNumber || (isPending ? 'Pending' : 'BRC-MEMBER')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9.5px] text-[#52605d] truncate mt-0.5">
                            <span>@{m.username}</span>
                            <span>•</span>
                            <span className="truncate">{m.mobileNo || m.phone || m.email || 'No contact'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPending ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-2.5 h-2.5" />
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Active
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-[#52605d]" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tablet & Desktop View: Table (hidden on sm:hidden) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#e2ece2] text-[#52605d] font-bold uppercase text-[10px] bg-[#f7f9f7]/50">
                      <th className="py-2.5 px-3">Member / Applicant</th>
                      <th className="py-2.5 px-3">Member ID</th>
                      <th className="py-2.5 px-3">Contact</th>
                      <th className="py-2.5 px-3">Motorcycle</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2ece2]">
                    {paginatedMembersList.map((m) => {
                      const isPending = m.approvalStatus === 'Pending' || m.approvalStatus?.toLowerCase() === 'pending';
                      return (
                        <tr
                          key={m.id}
                          className="hover:bg-[#f0f4f1]/50 transition-colors group cursor-pointer"
                          onClick={() => {
                            if (isPending) {
                              localStorage.setItem('bcc_roster_tab', 'pending');
                            } else {
                              localStorage.setItem('bcc_roster_tab', 'active');
                            }
                            setActiveTab('members');
                          }}
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <RoleAvatarBadge
                                avatarUrl={m.avatar || '/avatar.svg'}
                                name={m.name || m.username || 'Club Member'}
                                role={m.role}
                                sizeClass="w-9 h-9"
                              />
                              <div className="min-w-0">
                                <p className="font-bold text-[#1b4332] text-xs truncate">
                                  {m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.username}
                                </p>
                                <p className="text-[10px] text-[#52605d] truncate">@{m.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-mono text-[11px] font-semibold text-[#2d6a4f] bg-[#d8f3dc]/50 px-2 py-0.5 rounded-md border border-[#74c69d]/30 whitespace-nowrap">
                              {m.memberNumber || (isPending ? 'Pending' : 'BRC-MEMBER')}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="space-y-0.5">
                              <p className="text-[11px] text-[#1b4332] truncate">{m.email || 'No email'}</p>
                              <p className="text-[10px] text-[#52605d]">{m.mobileNo || m.phone || 'No phone'}</p>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 text-[11px] text-[#1b4332]">
                              <Bike className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                              <span className="truncate">
                                {m.bikeInfo?.make ? `${m.bikeInfo.make} ${m.bikeInfo.model || ''}` : 'Motorcycle'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                <CheckCircle2 className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isPending) {
                                  localStorage.setItem('bcc_roster_tab', 'pending');
                                } else {
                                  localStorage.setItem('bcc_roster_tab', 'active');
                                }
                                setActiveTab('members');
                              }}
                              className="p-1.5 rounded-lg bg-[#f0f4f1] hover:bg-[#d8f3dc] text-[#1b4332] text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalDashboardPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#e2ece2] text-xs text-[#52605d]">
                  <div>
                    Showing <span className="font-extrabold text-[#1b4332]">{(validDashboardPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-extrabold text-[#1b4332]">
                      {Math.min(validDashboardPage * itemsPerPage, filteredMembersList.length)}
                    </span>{' '}
                    of <span className="font-extrabold text-[#1b4332]">{filteredMembersList.length}</span> members
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={validDashboardPage === 1}
                      onClick={() => setDashboardPage((prev) => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 rounded-xl border border-[#e2ece2] bg-[#f7f9f7] hover:bg-[#e2ece2] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[#1b4332] flex items-center gap-1 transition-all cursor-pointer text-xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>

                    <span className="px-3 py-1.5 rounded-xl bg-[#1b4332] text-white font-extrabold text-xs shadow-2xs">
                      {validDashboardPage} / {totalDashboardPages}
                    </span>

                    <button
                      type="button"
                      disabled={validDashboardPage === totalDashboardPages}
                      onClick={() => setDashboardPage((prev) => Math.min(prev + 1, totalDashboardPages))}
                      className="px-3 py-1.5 rounded-xl border border-[#e2ece2] bg-[#f7f9f7] hover:bg-[#e2ece2] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[#1b4332] flex items-center gap-1 transition-all cursor-pointer text-xs"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};


