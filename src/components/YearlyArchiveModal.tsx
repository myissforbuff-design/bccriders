import React, { useState, useMemo } from 'react';
import {
  Archive,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Download,
  Calendar,
  Info,
} from 'lucide-react';
import { FinanceRecord, ExpenseRecord, User, DynamicCollection, FinanceYearArchive } from '../types';
import { store } from '../lib/db';
import { buildArchivePackageData, downloadZipArchive } from '../lib/yearlyArchiveUtils';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { ModalPortal } from './ModalPortal';

interface YearlyArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: FinanceRecord[];
  expenses: ExpenseRecord[];
  users: User[];
  dynamicCols?: DynamicCollection[];
  currentUser?: User | null;
  onArchiveComplete?: (archivedYear: number, netSurplus: number, archive?: FinanceYearArchive) => void;
  deleteRecordsForYear?: (year: number) => Promise<void>;
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
}) => {
  useModalDismiss(isOpen, onClose);
  const currentCalYear = new Date().getFullYear();
  const defaultYear = currentCalYear - 1 > 2023 ? currentCalYear - 1 : currentCalYear;
  const [yearInput, setYearInput] = useState<string>(String(defaultYear));
  const [auditedByName, setAuditedByName] = useState<string>(
    currentUser?.name ? `${currentUser.name} (${currentUser.role || 'Treasurer'})` : 'Club Treasurer & System Administrator'
  );
  const [auditNotes, setAuditNotes] = useState<string>(
    `Annual Financial Audit completed and verified.`
  );
  const [isAuditConfirmed, setIsAuditConfirmed] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Auto-scan matched records for yearInput
  const matchedYearRecords = useMemo(() => {
    if (!yearInput || yearInput.length !== 4) return [];
    return records.filter((r) => {
      const pDate = r.paidDate || r.dueDate || r.updatedAt || '';
      const covMonth = r.coveredMonth || '';
      const custName = r.customItemName || '';
      return pDate.includes(yearInput) || covMonth.includes(yearInput) || custName.includes(yearInput);
    });
  }, [yearInput, records]);

  // Auto-scan matched expenses for yearInput
  const matchedYearExpenses = useMemo(() => {
    if (!yearInput || yearInput.length !== 4) return [];
    return expenses.filter((e) => {
      const eDate = e.date || e.updatedAt || '';
      return eDate.includes(yearInput);
    });
  }, [yearInput, expenses]);

  const isYearMatched = useMemo(() => {
    return Boolean(yearInput && yearInput.length === 4 && (matchedYearRecords.length > 0 || matchedYearExpenses.length > 0));
  }, [yearInput, matchedYearRecords, matchedYearExpenses]);

  const isNoYearMatched = useMemo(() => {
    return Boolean(yearInput && yearInput.length === 4 && matchedYearRecords.length === 0 && matchedYearExpenses.length === 0);
  }, [yearInput, matchedYearRecords, matchedYearExpenses]);

  // Compute stats for the matched year
  const yearStats = useMemo(() => {
    if (!isYearMatched) {
      return {
        recordsCount: 0,
        paidCount: 0,
        expensesCount: 0,
        totalIncome: 0,
        totalDisbursements: 0,
        netSurplus: 0,
        activeMembersCount: 0,
      };
    }

    const paidYrRecords = matchedYearRecords.filter((r) => r.status === 'Paid');
    const totalIncome = paidYrRecords.reduce((sum, r) => {
      if (r.itemType === 'Monthly Due' && r.notes?.includes('Satisfied by Annual Upfront Promo Package')) {
        return sum;
      }
      return sum + (Number(r.amount) || 0);
    }, 0);

    const totalDisbursements = matchedYearExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
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
      recordsCount: matchedYearRecords.length,
      paidCount: paidYrRecords.length,
      expensesCount: matchedYearExpenses.length,
      totalIncome,
      totalDisbursements,
      netSurplus,
      activeMembersCount,
    };
  }, [isYearMatched, matchedYearRecords, matchedYearExpenses, users]);

  // Check if year already archived
  const existingArchives = store.getFinanceArchives();
  const numericYear = parseInt(yearInput, 10);
  const isAlreadyArchived = Boolean(isYearMatched && !isNaN(numericYear) && existingArchives.some((a) => a.year === numericYear));

  if (!isOpen) return null;

  const handleExecuteArchive = async () => {
    if (!isYearMatched || isNaN(numericYear)) {
      setErrorMsg('Please enter a valid fiscal year with matched records.');
      return;
    }

    if (!isAuditConfirmed) {
      setErrorMsg('Please confirm the audit verification checklist before executing archive.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg('');

      // 1. Build full archive package
      const packageData = buildArchivePackageData({
        year: numericYear,
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
        id: `archive_${numericYear}`,
        year: numericYear,
        archivedAt: new Date().toISOString(),
        archivedBy: auditedByName.trim() || 'Club Treasurer & System Administrator',
        totalIncome: yearStats.totalIncome,
        totalDisbursements: yearStats.totalDisbursements,
        netSurplus: yearStats.netSurplus,
        carriedOverTreasury: 0,
        activeMemberCount: yearStats.activeMembersCount,
        totalTransactionsCount: yearStats.recordsCount,
        totalExpensesCount: yearStats.expensesCount,
        auditNotes: auditNotes.trim(),
        isAudited: true,
        status: 'Audited & Closed',
      };
      store.saveFinanceArchive(newArchive);

      // 4. Notify Parent Component to refresh cards & trigger toast (Transactions are preserved)
      onArchiveComplete?.(numericYear, yearStats.netSurplus, newArchive);
      onClose();
    } catch (err: any) {
      console.error('Archiving error:', err);
      setErrorMsg(err.message || 'Failed to complete yearly archiving. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/70 backdrop-blur-md overflow-y-auto animate-fadeIn">
        <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full p-3.5 sm:p-5 md:p-6 shadow-2xl border border-[#e2ece2] flex flex-col max-h-[92dvh] my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#e2ece2] pb-2.5 sm:pb-3 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#1b4332] text-white flex items-center justify-center shadow-xs shrink-0">
              <Archive className="w-4 h-4 sm:w-5 sm:h-5 text-[#74c69d]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-heading text-sm sm:text-base font-black text-[#1b4332] truncate">
                  Yearly Financial Archiving
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                  Jan - Dec
                </span>
              </div>
              <p className="text-[11px] text-[#52605d] truncate">
                Audit, compress, and download a certified .ZIP archive.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content Body */}
        <div className="overflow-y-auto flex-1 space-y-3 sm:space-y-4 py-2.5 sm:py-3 pr-1">
          {/* Existing Archive Warning */}
          {isAlreadyArchived && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-bold text-amber-950 text-xs">FY {yearInput} was already archived previously.</p>
                <p className="text-amber-800 text-[10.5px] leading-snug">
                  Archiving again will re-generate and download a new certified .zip backup.
                </p>
              </div>
            </div>
          )}

          {/* Fiscal Year Input & Live Auto-Scan */}
          <div className="bg-[#f7f9f7] p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-[#e2ece2] space-y-2">
            <div className="space-y-1">
              <label className="text-[11px] sm:text-xs font-bold text-[#1b4332] block">
                Fiscal Year to Archive
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={yearInput}
                  onChange={(e) => {
                    const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setYearInput(numericOnly);
                  }}
                  placeholder="e.g. 2024"
                  className={`w-full pl-8.5 pr-3 py-2 rounded-xl bg-white border text-xs sm:text-sm font-extrabold text-[#1b4332] focus:outline-hidden transition-colors ${
                    isNoYearMatched
                      ? 'border-rose-300 ring-1 ring-rose-200'
                      : isYearMatched
                      ? 'border-emerald-400 ring-1 ring-emerald-200'
                      : 'border-[#e2ece2] focus:border-[#1b4332] focus:ring-1 focus:ring-[#1b4332]'
                  }`}
                />
                <Calendar className={`w-3.5 h-3.5 absolute left-2.5 top-3 pointer-events-none ${
                  isNoYearMatched ? 'text-rose-500' : isYearMatched ? 'text-emerald-600' : 'text-stone-400'
                }`} />
              </div>
            </div>

            {/* Live Scan Results */}
            {yearInput.length === 4 && isYearMatched && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-100/70 border border-emerald-200 text-emerald-900 text-[11px] font-bold">
                <span className="flex items-center gap-1.5 truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>FY {yearInput} Matched</span>
                </span>
                <span className="text-[10px] text-emerald-800 font-semibold shrink-0">
                  {yearStats.paidCount} paid, {yearStats.expensesCount} exp
                </span>
              </div>
            )}

            {yearInput.length === 4 && isNoYearMatched && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-100/80 border border-rose-200 text-rose-800 text-[11px] font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>No Year is matched</span>
              </div>
            )}
          </div>

          {/* Pre-Audit Financial Summary Cards (Income, Disbursements, Net Surplus) */}
          {isYearMatched && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-[#52605d] uppercase tracking-wider block">
                  Audited Summary (FY {yearInput})
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Total Income */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-[#2d6a4f] uppercase block truncate">Income</span>
                  <p className="font-heading text-xs sm:text-sm font-black text-[#1b4332] truncate mt-0.5">
                    ₱{yearStats.totalIncome.toLocaleString()}.00
                  </p>
                  <span className="text-[8.5px] text-[#2d6a4f] block mt-0.5 truncate">
                    {yearStats.paidCount} paid
                  </span>
                </div>

                {/* Total Disbursements */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-rose-50 border border-rose-100 flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-rose-800 uppercase block truncate">Disbursements</span>
                  <p className="font-heading text-xs sm:text-sm font-black text-rose-950 truncate mt-0.5">
                    ₱{yearStats.totalDisbursements.toLocaleString()}.00
                  </p>
                  <span className="text-[8.5px] text-rose-700 block mt-0.5 truncate">
                    {yearStats.expensesCount} exp
                  </span>
                </div>

                {/* Net Surplus / Balance */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-[#e8f5e9] border border-[#c8e6c9] flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-[#1b4332] uppercase block truncate">Net Surplus</span>
                  <p className="font-heading text-xs sm:text-sm font-black text-[#1b4332] truncate mt-0.5">
                    ₱{yearStats.netSurplus.toLocaleString()}.00
                  </p>
                  <span className="text-[8.5px] text-[#2d6a4f] block mt-0.5 truncate font-semibold">
                    Audited Balance
                  </span>
                </div>
              </div>

              {/* Instructions Callout for Remaining Funds / Carryover */}
              <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-950 flex items-start gap-2 text-xs">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-0.5">
                  <span className="font-extrabold text-[11px] block text-blue-900">Remaining Funds Handling</span>
                  <p className="text-[10.5px] sm:text-[11px] text-blue-800 leading-snug">
                    If there are remaining funds, the admin must record a payment in Collections with a note, e.g. <strong className="font-bold">{yearInput || '2021'} Year-End Carryover</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Audit Details Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Audited By
              </label>
              <input
                type="text"
                value={auditedByName}
                onChange={(e) => setAuditedByName(e.target.value)}
                placeholder="e.g. Treasurer Name"
                className="w-full px-2.5 py-1.5 sm:py-2 rounded-xl bg-white border border-[#e2ece2] text-xs font-medium text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-[#1b4332]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Remarks / Resolution
              </label>
              <input
                type="text"
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
                placeholder="e.g. Annual audit verified"
                className="w-full px-2.5 py-1.5 sm:py-2 rounded-xl bg-white border border-[#e2ece2] text-xs font-medium text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-[#1b4332]"
              />
            </div>
          </div>

          {/* Audit Checklist Confirmation */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-stone-50 border border-stone-200">
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAuditConfirmed}
                onChange={(e) => setIsAuditConfirmed(e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 text-[#1b4332] rounded-md border-stone-300 focus:ring-[#1b4332] cursor-pointer shrink-0"
              />
              <div className="text-xs">
                <span className="font-bold text-stone-900 block text-[11px] sm:text-xs">
                  Confirm Audit & Archive
                </span>
                <p className="text-stone-600 text-[10px] sm:text-[10.5px] leading-snug mt-0.5">
                  I certify all transactions for FY <strong>{yearInput || '----'}</strong> have been audited. Archiving downloads a certified compressed (.ZIP) archive with audit certificates. Active transactions are preserved.
                </p>
              </div>
            </label>
          </div>

          {errorMsg && (
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2.5 sm:pt-3 border-t border-[#e2ece2] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-3.5 py-1.5 sm:py-2 rounded-xl border border-[#e2ece2] text-stone-700 hover:bg-stone-100 font-bold text-xs transition-all cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteArchive}
            disabled={!isYearMatched || !isAuditConfirmed || isProcessing}
            className={`px-4 py-1.5 sm:py-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 ${
              isYearMatched && isAuditConfirmed && !isProcessing
                ? 'bg-[#1b4332] hover:bg-[#2d6a4f] text-white cursor-pointer shadow-xs active:scale-95'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed opacity-60 select-none'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span>Archiving...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-[#74c69d] shrink-0" />
                <span className="truncate">
                  {isYearMatched ? `Archive FY ${yearInput}` : 'Archive Year'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
);
};
