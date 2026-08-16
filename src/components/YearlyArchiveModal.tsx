import React, { useState, useMemo } from 'react';
import {
  Archive,
  CheckCircle2,
  AlertTriangle,
  FileArchive,
  ShieldCheck,
  Coins,
  TrendingDown,
  Wallet,
  Users,
  X,
  Lock,
  Download,
  Calendar,
  Layers,
} from 'lucide-react';
import { FinanceRecord, ExpenseRecord, User, DynamicCollection, FinanceYearArchive } from '../types';
import { store } from '../lib/db';
import { buildArchivePackageData, downloadZipArchive } from '../lib/yearlyArchiveUtils';

interface YearlyArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: FinanceRecord[];
  expenses: ExpenseRecord[];
  users: User[];
  dynamicCols?: DynamicCollection[];
  currentUser?: User | null;
  onArchiveComplete?: (archivedYear: number, netSurplus: number, archive?: FinanceYearArchive) => void;
  deleteRecordsForYear: (year: number) => Promise<void>;
}

export const YearlyArchiveModal: React.FC<YearlyArchiveModalProps> = ({
  isOpen,
  onClose,
  records,
  expenses,
  users,
  dynamicCols = [],
  currentUser = null,
  onArchiveComplete,
  deleteRecordsForYear,
}) => {
  const currentCalYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentCalYear - 1 > 2023 ? currentCalYear - 1 : currentCalYear);
  const [auditedByName, setAuditedByName] = useState<string>(
    currentUser?.name ? `${currentUser.name} (${currentUser.role || 'Treasurer'})` : 'Club Treasurer & System Administrator'
  );
  const [auditNotes, setAuditNotes] = useState<string>(
    `Annual Financial Audit completed and verified against official receipts and bank balances.`
  );
  const [isAuditConfirmed, setIsAuditConfirmed] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Extract available years from records and expenses
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentCalYear);
    yearsSet.add(currentCalYear - 1);
    yearsSet.add(2025);
    yearsSet.add(2026);

    records.forEach((r) => {
      if (r.paidDate) {
        const y = parseInt(r.paidDate.slice(0, 4), 10);
        if (!isNaN(y)) yearsSet.add(y);
      }
      if (r.coveredMonth) {
        const parts = r.coveredMonth.split(' ');
        const yr = parseInt(parts[1] || parts[0], 10);
        if (!isNaN(yr)) yearsSet.add(yr);
      }
    });

    expenses.forEach((e) => {
      if (e.date) {
        const y = parseInt(e.date.slice(0, 4), 10);
        if (!isNaN(y)) yearsSet.add(y);
      }
    });

    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [records, expenses, currentCalYear]);

  // Compute stats for selected year
  const yearStats = useMemo(() => {
    const yearStr = String(selectedYear);
    const yrRecords = records.filter((r) => {
      const pDate = r.paidDate || r.dueDate || r.updatedAt || '';
      const covMonth = r.coveredMonth || '';
      const custName = r.customItemName || '';
      return pDate.includes(yearStr) || covMonth.includes(yearStr) || custName.includes(yearStr);
    });

    const yrExpenses = expenses.filter((e) => {
      const eDate = e.date || e.updatedAt || '';
      return eDate.includes(yearStr);
    });

    const paidYrRecords = yrRecords.filter((r) => r.status === 'Paid');
    const totalIncome = paidYrRecords.reduce((sum, r) => {
      if (r.itemType === 'Monthly Due' && r.notes?.includes('Satisfied by Annual Upfront Promo Package')) {
        return sum;
      }
      return sum + (Number(r.amount) || 0);
    }, 0);

    const totalDisbursements = yrExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netSurplus = totalIncome - totalDisbursements;

    const activeMembersCount = users.filter((u) => {
      const isUserAdmin =
        u.role === 'admin' ||
        u.role?.toLowerCase() === 'admin' ||
        u.role?.toLowerCase() === 'administrator' ||
        u.id === 'usr_admin';
      return !isUserAdmin && (u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin'));
    }).length;

    return {
      recordsCount: yrRecords.length,
      paidCount: paidYrRecords.length,
      expensesCount: yrExpenses.length,
      totalIncome,
      totalDisbursements,
      netSurplus,
      activeMembersCount,
    };
  }, [selectedYear, records, expenses, users]);

  // Check if year already archived
  const existingArchives = store.getFinanceArchives();
  const isAlreadyArchived = existingArchives.some((a) => a.year === selectedYear);

  if (!isOpen) return null;

  const handleExecuteArchive = async () => {
    if (!isAuditConfirmed) {
      setErrorMsg('Please confirm the audit verification checklist before executing archive.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg('');

      // 1. Build full archive package
      const packageData = buildArchivePackageData({
        year: selectedYear,
        records,
        expenses,
        users,
        dynamicCols,
        auditedBy: auditedByName.trim() || 'Club Treasurer & System Administrator',
        auditNotes: auditNotes.trim(),
      });

      // 2. Download .zip file to local device
      await downloadZipArchive(packageData);

      // 3. Save Year Archive Record to DataStore & MongoDB
      const newArchive: FinanceYearArchive = {
        id: `archive_${selectedYear}`,
        year: selectedYear,
        archivedAt: new Date().toISOString(),
        archivedBy: auditedByName.trim() || 'Club Treasurer & System Administrator',
        totalIncome: yearStats.totalIncome,
        totalDisbursements: yearStats.totalDisbursements,
        netSurplus: yearStats.netSurplus,
        carriedOverTreasury: yearStats.netSurplus,
        activeMemberCount: yearStats.activeMembersCount,
        totalTransactionsCount: yearStats.recordsCount,
        totalExpensesCount: yearStats.expensesCount,
        auditNotes: auditNotes.trim(),
        isAudited: true,
        status: 'Audited & Closed',
      };
      store.saveFinanceArchive(newArchive);

      // 4. Delete outgoing year records from active ledger
      await deleteRecordsForYear(selectedYear);

      // 5. Notify Parent Component to refresh cards & trigger toast
      onArchiveComplete?.(selectedYear, yearStats.netSurplus, newArchive);
      onClose();
    } catch (err: any) {
      console.error('Archiving error:', err);
      setErrorMsg(err.message || 'Failed to complete yearly archiving. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-stone-900/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-[#e2ece2] flex flex-col max-h-[92dvh] my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#e2ece2] pb-3 sm:pb-4 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#1b4332] text-white flex items-center justify-center shadow-md shrink-0">
              <Archive className="w-5 h-5 sm:w-6 sm:h-6 text-[#74c69d]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="font-heading text-base sm:text-lg md:text-xl font-black text-[#1b4332] truncate">
                  Yearly Financial Archiving
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Jan - Dec
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#52605d] truncate sm:whitespace-normal">
                Audit, close, and compress the fiscal year into a certified .ZIP archive.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-stone-700 hover:bg-stone-100 transition-all cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content Body */}
        <div className="overflow-y-auto flex-1 space-y-4 sm:space-y-5 py-3 sm:py-4 pr-1 sm:pr-1.5">
          {/* Existing Archive Warning */}
          {isAlreadyArchived && (
            <div className="p-3 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-bold text-amber-950 text-xs">Year {selectedYear} was already archived previously.</p>
                <p className="text-amber-800 text-[10.5px] sm:text-[11px] mt-0.5 leading-snug">
                  Archiving again will re-generate the certified .zip backup and update the carried-over Net Treasury balance.
                </p>
              </div>
            </div>
          )}

          {/* Year Selector */}
          <div className="bg-[#f7f9f7] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#e2ece2] space-y-2.5">
            <label className="block text-[10px] sm:text-xs font-black text-[#1b4332] uppercase tracking-wider">
              Select Fiscal Year to Close & Archive (January 1 - December 31)
            </label>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedYear === yr
                      ? 'bg-[#1b4332] text-white shadow-xs ring-2 ring-[#74c69d]'
                      : 'bg-white text-stone-700 border border-[#e2ece2] hover:bg-[#e2ece2]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>FY {yr}</span>
                  {existingArchives.some((a) => a.year === yr) && (
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 inline-block ml-0.5" title="Archived" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Pre-Audit Financial Summary Cards */}
          <div className="space-y-1.5 sm:space-y-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#52605d] uppercase tracking-wider block">
              Audited Summary for Year {selectedYear} (Jan - Dec)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              {/* Total Income */}
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] flex flex-col justify-between">
                <div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-[#2d6a4f] uppercase block truncate">Total Income</span>
                  <p className="font-heading text-xs sm:text-sm md:text-base font-black text-[#1b4332] truncate mt-0.5">
                    ₱{yearStats.totalIncome.toLocaleString()}.00
                  </p>
                </div>
                <span className="text-[8.5px] sm:text-[9px] text-[#2d6a4f] block mt-1 truncate">
                  {yearStats.paidCount} paid collections
                </span>
              </div>

              {/* Total Disbursements */}
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-rose-50 border border-rose-100 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-rose-800 uppercase block truncate">Disbursements</span>
                  <p className="font-heading text-xs sm:text-sm md:text-base font-black text-rose-950 truncate mt-0.5">
                    ₱{yearStats.totalDisbursements.toLocaleString()}.00
                  </p>
                </div>
                <span className="text-[8.5px] sm:text-[9px] text-rose-700 block mt-1 truncate">
                  {yearStats.expensesCount} expense vouchers
                </span>
              </div>

              {/* Net Surplus */}
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-[#e8f5e9] border border-[#c8e6c9] flex flex-col justify-between">
                <div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-[#1b4332] uppercase block truncate">Net Surplus</span>
                  <p className="font-heading text-xs sm:text-sm md:text-base font-black text-[#1b4332] truncate mt-0.5">
                    ₱{yearStats.netSurplus.toLocaleString()}.00
                  </p>
                </div>
                <span className="text-[8.5px] sm:text-[9px] text-[#2d6a4f] block mt-1 truncate">
                  Audited year balance
                </span>
              </div>

              {/* Carryover */}
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-[#d8f3dc] border border-[#b7e4c7] flex flex-col justify-between">
                <div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-[#1b4332] uppercase block truncate">Carryover Net Treasury</span>
                  <p className="font-heading text-xs sm:text-sm md:text-base font-black text-[#1b4332] truncate mt-0.5">
                    +₱{yearStats.netSurplus.toLocaleString()}.00
                  </p>
                </div>
                <span className="text-[8.5px] sm:text-[9px] text-[#2d6a4f] block mt-1 font-bold truncate">
                  Added to Total Funds
                </span>
              </div>
            </div>
          </div>

          {/* Audit Details Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Audited & Reconciled By
              </label>
              <input
                type="text"
                value={auditedByName}
                onChange={(e) => setAuditedByName(e.target.value)}
                placeholder="e.g. John Doe (Club Treasurer)"
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#e2ece2] text-xs font-medium text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-[#1b4332]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Audit Resolution / Remarks
              </label>
              <input
                type="text"
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
                placeholder="e.g. Approved and certified year-end audit"
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#e2ece2] text-xs font-medium text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-[#1b4332]"
              />
            </div>
          </div>

          {/* Audit Checklist Confirmation */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
            <label className="flex items-start gap-2.5 sm:gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAuditConfirmed}
                onChange={(e) => setIsAuditConfirmed(e.target.checked)}
                className="mt-0.5 sm:mt-1 w-4 h-4 text-[#1b4332] rounded-md border-stone-300 focus:ring-[#1b4332] cursor-pointer shrink-0"
              />
              <div className="text-xs">
                <span className="font-bold text-stone-900 block text-xs">
                  Audit Verification & Irreversible Year Close
                </span>
                <p className="text-stone-700 text-[10.5px] sm:text-[11px] leading-relaxed mt-0.5">
                  I hereby certify as Club Treasurer / Administrator that all transactions from <strong>January 1 to December 31, {selectedYear}</strong> have been liquidated, audited, and reconciled. Archiving will export a complete compressed (.ZIP) archive, delete the outgoing year transactions from active records, and carry forward the remaining <strong>₱{yearStats.netSurplus.toLocaleString()}.00 Net Treasury</strong> to active funds.
                </p>
              </div>
            </label>
          </div>

          {errorMsg && (
            <div className="p-2.5 sm:p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-[#e2ece2] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-auto px-4 py-2 sm:py-2.5 rounded-xl border border-[#e2ece2] text-stone-700 hover:bg-stone-100 font-bold text-xs transition-all cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteArchive}
            disabled={!isAuditConfirmed || isProcessing}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span>Auditing & Zipping Archive...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-[#74c69d] shrink-0" />
                <span className="truncate">Download .ZIP & Execute Year-End Archive</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
