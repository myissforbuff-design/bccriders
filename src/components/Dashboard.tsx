import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { store, safeFetchJson } from '../lib/db';
import { TabType } from './Navigation';
import {
  Users,
  ArrowUpRight,
  Sparkles,
  Coins,
  TrendingDown,
  Wallet,
  Clock,
} from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  setActiveTab: (tab: TabType) => void;
  onOpenDuesModal?: () => void;
  onOpenLogRideModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  setActiveTab,
}) => {
  const { currentUser, isAdmin } = useAuth();

  const allUsers = store.getUsers();
  const members = allUsers.filter((m) => m.role !== 'admin');
  const totalMembers = members.length;
  const activeMembersCount = members.filter((m) => m.approvalStatus === 'Approved' || m.approvalStatus !== 'Pending').length;
  const pendingApprovalsCount = allUsers.filter((m) => m.approvalStatus === 'Pending').length;

  // Treasury stats state
  const [financeRecords, setFinanceRecords] = useState<any[]>(() => {
    try {
      const item = localStorage.getItem('bcc_finance_records_v3');
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  });

  const [expenseRecords, setExpenseRecords] = useState<any[]>(() => {
    try {
      const item = localStorage.getItem('bcc_expense_records_v1');
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    safeFetchJson('/api/mongodb/financeLogs')
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setFinanceRecords(data.data);
        }
      })
      .catch(() => {});

    safeFetchJson('/api/mongodb/liquidationLogs')
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setExpenseRecords(data.data);
        } else {
          safeFetchJson('/api/mongodb/expenseLogs')
            .then((expData) => {
              if (expData.success && Array.isArray(expData.data)) {
                setExpenseRecords(expData.data);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const totalCollected = financeRecords
    .filter((r) => r.status === 'Paid')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const totalExpenses = expenseRecords.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
  const netBalance = totalCollected - totalExpenses;
  const totalPaidCount = financeRecords.filter((r) => r.status === 'Paid').length;

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 pb-6">
      {/* Welcome Banner */}
      <div className="relative rounded-2xl sm:rounded-3xl bg-[#1b4332] text-white border border-[#2d6a4f] p-4 sm:p-6 lg:p-8 overflow-hidden glow-forest">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-[#74c69d]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-6">
          <div className="space-y-1 sm:space-y-2 max-w-xl">
            {!isAdmin && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2d6a4f] text-[#d8f3dc] text-[10px] sm:text-xs font-semibold border border-[#74c69d]/30">
                <Sparkles className="w-3 h-3 text-[#74c69d]" />
                <span>BCC Riders Club Console</span>
              </div>
            )}
            <h1 className="font-heading text-lg sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, <span className="text-[#74c69d]">{isAdmin ? 'Admin' : currentUser?.name}</span>!
            </h1>
            <p className="text-[#d8f3dc]/90 text-[11px] sm:text-xs lg:text-sm leading-relaxed">
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
      <div className="space-y-3 sm:gap-4">
        {/* Row 1: Active Members & Pending Approvals (Side-by-side on mobile: grid-cols-2) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Active Members */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setActiveTab('members')}
            className="p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex flex-col justify-between shadow-xs cursor-pointer hover:border-[#74c69d] transition-colors"
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] sm:text-xs text-[#52605d] font-bold uppercase tracking-wider">Active Members</span>
              <div className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-[#d8f3dc] text-[#1b4332] shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <p className="font-heading text-lg sm:text-2xl font-extrabold text-[#1b4332]">
                {activeMembersCount}{' '}
                <span className="text-[10px] sm:text-xs font-normal text-[#52605d]">/ {totalMembers}</span>
              </p>
              <span className="text-[9px] sm:text-[11px] text-[#2d6a4f] font-medium flex items-center gap-0.5 mt-0.5">
                <ArrowUpRight className="w-3 h-3" />
                {totalMembers > 0 ? Math.round((activeMembersCount / totalMembers) * 100) : 0}% active
              </span>
            </div>
          </motion.div>

          {/* Pending Approvals */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setActiveTab('members')}
            className="p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex flex-col justify-between shadow-xs cursor-pointer hover:border-[#74c69d] transition-colors"
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] sm:text-xs text-[#52605d] font-bold uppercase tracking-wider">Pending Approvals</span>
              <div className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <p className="font-heading text-lg sm:text-2xl font-extrabold text-amber-900">
                {pendingApprovalsCount}
              </p>
              <span className="text-[9px] sm:text-[11px] text-[#52605d] font-medium block mt-0.5 truncate">
                Awaiting review
              </span>
            </div>
          </motion.div>
        </div>

        {/* Row 2: Total Funds, Total Expenses, Net Treasury Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Total Funds */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setActiveTab('finances')}
            className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex items-center justify-between shadow-xs cursor-pointer hover:border-[#74c69d] transition-colors"
          >
            <div className="space-y-0.5 sm:space-y-1 min-w-0">
              <span className="text-[10px] sm:text-xs text-[#52605d] font-bold uppercase tracking-wider block">Total Funds</span>
              <p className="font-heading text-base sm:text-2xl font-black text-[#1b4332] truncate">
                ₱{totalCollected.toLocaleString()}.00
              </p>
              <span className="text-[9px] sm:text-[11px] text-[#2d6a4f] font-semibold block truncate">
                {totalPaidCount} verified payments
              </span>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-[#d8f3dc] text-[#1b4332] shrink-0 ml-2">
              <Coins className="w-4.5 h-4.5 sm:w-6 sm:h-6" />
            </div>
          </motion.div>

          {/* Total Expenses */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setActiveTab('finances')}
            className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex items-center justify-between shadow-xs cursor-pointer hover:border-[#74c69d] transition-colors"
          >
            <div className="space-y-0.5 sm:space-y-1 min-w-0">
              <span className="text-[10px] sm:text-xs text-[#52605d] font-bold uppercase tracking-wider block">Total Expenses</span>
              <p className="font-heading text-base sm:text-2xl font-black text-rose-700 truncate">
                ₱{totalExpenses.toLocaleString()}.00
              </p>
              <span className="text-[9px] sm:text-[11px] text-rose-600 font-semibold block truncate">
                {expenseRecords.length} liquidated items
              </span>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-rose-100 text-rose-800 shrink-0 ml-2">
              <TrendingDown className="w-4.5 h-4.5 sm:w-6 sm:h-6" />
            </div>
          </motion.div>

          {/* Net Treasury Balance */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setActiveTab('finances')}
            className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex items-center justify-between shadow-xs cursor-pointer hover:border-[#74c69d] transition-colors"
          >
            <div className="space-y-0.5 sm:space-y-1 min-w-0">
              <span className="text-[10px] sm:text-xs text-[#52605d] font-bold uppercase tracking-wider block">Net Treasury Balance</span>
              <p className={`font-heading text-base sm:text-2xl font-black truncate ${netBalance >= 0 ? 'text-[#1b4332]' : 'text-rose-700'}`}>
                ₱{netBalance.toLocaleString()}.00
              </p>
              <span className="text-[9px] sm:text-[11px] text-[#52605d] font-semibold block truncate">
                Funds Collected minus Expenses
              </span>
            </div>
            <div className={`p-2 sm:p-3 rounded-xl shrink-0 ml-2 ${netBalance >= 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
              <Wallet className="w-4.5 h-4.5 sm:w-6 sm:h-6" />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};


