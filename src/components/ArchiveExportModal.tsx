import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  X,
  Users,
  Coins,
  TrendingDown,
  Wallet,
  CheckCircle2,
  ArrowDownToLine,
  FolderArchive,
} from 'lucide-react';
import { ArchivePackageData } from '../types';
import { exportArchiveToMultiTabXLSX, exportArchiveToIncomeStatementPDF } from '../lib/yearlyArchiveUtils';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { ModalPortal } from './ModalPortal';

interface ArchiveExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ArchivePackageData | null;
}

export const ArchiveExportModal: React.FC<ArchiveExportModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  useModalDismiss(isOpen, onClose);
  const [activeCategory, setActiveCategory] = useState<string>('summary');

  if (!isOpen || !data) return null;

  const { manifest, activeMembers, collectionsRegister, disbursementsLog, financialStatement, agingAndCompliance, customProjects } = data;

  const handleExportXlsx = () => {
    exportArchiveToMultiTabXLSX(data);
  };

  const handleExportPdf = () => {
    exportArchiveToIncomeStatementPDF(data);
  };

  const recordCategories = [
    { id: 'summary', name: 'Overview', count: '4 KPIs' },
    { id: 'members', name: 'Members', count: `${activeMembers.length}` },
    { id: 'collections', name: 'Collections', count: `${collectionsRegister.length}` },
    { id: 'disbursements', name: 'Disbursements', count: `${disbursementsLog.length}` },
    { id: 'statement', name: 'Statement', count: 'Monthly' },
    { id: 'aging', name: 'Aging', count: `${agingAndCompliance.length}` },
    { id: 'projects', name: 'Projects', count: `${customProjects.length}` },
  ];

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto animate-fadeIn">
        <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full p-3.5 sm:p-5 md:p-6 shadow-2xl border border-[#e2ece2] space-y-3 sm:space-y-4 my-auto max-h-[94dvh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#e2ece2] pb-2.5 sm:pb-3 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#1b4332] text-white flex items-center justify-center shadow-xs shrink-0">
              <FolderArchive className="w-4 h-4 sm:w-5 sm:h-5 text-[#74c69d]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-heading text-sm sm:text-base md:text-lg font-black text-[#1b4332] truncate">
                  FY {manifest.year} Financial Archive
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
                  <span>Audited</span>
                </span>
              </div>
              <p className="text-[10.5px] sm:text-xs text-[#52605d] truncate mt-0.5">
                Archived on {new Date(manifest.archivedAt).toLocaleDateString()} by {manifest.archivedBy}
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

        {/* 4 PRIMARY HIGHLIGHT METRIC CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5 shrink-0">
          {/* Active Members */}
          <div className="p-2 sm:p-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] shadow-2xs flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] sm:text-[9.5px] font-bold text-[#52605d] uppercase block truncate">Members</span>
              <p className="font-heading text-xs sm:text-sm font-black text-[#1b4332] truncate">
                {manifest.activeMemberCount || activeMembers.length}
              </p>
            </div>
          </div>

          {/* Total Income */}
          <div className="p-2 sm:p-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] shadow-2xs flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0">
              <Coins className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] sm:text-[9.5px] font-bold text-[#52605d] uppercase block truncate">Total Income</span>
              <p className="font-heading text-xs sm:text-sm font-black text-[#1b4332] truncate">
                ₱{(Number(manifest.totalIncome) || 0).toLocaleString()}.00
              </p>
            </div>
          </div>

          {/* Disbursements */}
          <div className="p-2 sm:p-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] shadow-2xs flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
              <TrendingDown className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] sm:text-[9.5px] font-bold text-[#52605d] uppercase block truncate">Disbursements</span>
              <p className="font-heading text-xs sm:text-sm font-black text-rose-800 truncate">
                ₱{(Number(manifest.totalDisbursements) || 0).toLocaleString()}.00
              </p>
            </div>
          </div>

          {/* Net Surplus */}
          <div className="p-2 sm:p-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] shadow-2xs flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#e8f5e9] text-[#1b4332] flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] sm:text-[9.5px] font-bold text-[#52605d] uppercase block truncate">Net Surplus</span>
              <p className="font-heading text-xs sm:text-sm font-black text-[#1b4332] truncate">
                ₱{(Number(manifest.netSurplus) || 0).toLocaleString()}.00
              </p>
            </div>
          </div>
        </div>

        {/* TWO PROMINENT EXPORT ACTION BUTTONS */}
        <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-black text-[#1b4332] uppercase tracking-wider">
              Export Archive Records:
            </span>
            <span className="text-[10px] text-[#52605d] hidden sm:inline">
              10 Complete Record Books Included
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* EXCEL (.XLSX) BUTTON */}
            <button
              type="button"
              onClick={handleExportXlsx}
              className="p-2 sm:p-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#1b4332] text-white flex items-center gap-2.5 transition-all shadow-xs active:scale-98 cursor-pointer group text-left"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-heading font-extrabold text-xs sm:text-[13px] text-white truncate">
                    Multi-Tab Excel (.xlsx)
                  </span>
                  <ArrowDownToLine className="w-3.5 h-3.5 text-[#74c69d] shrink-0" />
                </div>
                <p className="text-[9.5px] sm:text-[10px] text-emerald-100 truncate">
                  Full 10 sheets ledger with all transactions
                </p>
              </div>
            </button>

            {/* PDF BUTTON */}
            <button
              type="button"
              onClick={handleExportPdf}
              className="p-2 sm:p-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white flex items-center gap-2.5 transition-all shadow-xs active:scale-98 cursor-pointer group text-left"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#74c69d]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-heading font-extrabold text-xs sm:text-[13px] text-white truncate">
                    Income Statement (.pdf)
                  </span>
                  <ArrowDownToLine className="w-3.5 h-3.5 text-[#74c69d] shrink-0" />
                </div>
                <p className="text-[9.5px] sm:text-[10px] text-[#b7e4c7] truncate">
                  Certified Income Statement & summary report
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* RECORD INSPECTOR NAVIGATION TABS */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#e2ece2] shrink-0 scrollbar-none">
          {recordCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-[#1b4332] text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-[#e2ece2]'
              }`}
            >
              <span>{cat.name}</span>
              <span className={`text-[9px] px-1 py-0.2 rounded-full font-black ${
                activeCategory === cat.id ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* RECORD DETAILS VIEWER (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto min-h-[180px] max-h-[360px] border border-[#e2ece2] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 bg-[#fafcfa]">
          {/* TAB 1: OVERVIEW / SUMMARY */}
          {activeCategory === 'summary' && (
            <div className="space-y-2.5 sm:space-y-3">
              <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-[#e2ece2] space-y-2">
                <h4 className="font-heading text-xs sm:text-sm font-extrabold text-[#1b4332]">
                  Audit Summary & Certification
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] sm:text-xs">
                  <div>
                    <span className="text-[#52605d] block text-[10.5px]">Fiscal Period:</span>
                    <span className="font-bold text-stone-900">Jan 1, {manifest.year} – Dec 31, {manifest.year}</span>
                  </div>
                  <div>
                    <span className="text-[#52605d] block text-[10.5px]">Audited By:</span>
                    <span className="font-bold text-stone-900">{manifest.archivedBy}</span>
                  </div>
                  <div>
                    <span className="text-[#52605d] block text-[10.5px]">Net Surplus:</span>
                    <span className="font-bold text-emerald-800">₱{(Number(manifest.netSurplus) || 0).toLocaleString()}.00</span>
                  </div>
                  <div>
                    <span className="text-[#52605d] block text-[10.5px]">Audit Notes:</span>
                    <span className="font-medium text-stone-800">{manifest.auditNotes || 'Reconciled and certified.'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Revenue Breakdown */}
                <div className="bg-white p-3 rounded-xl border border-[#e2ece2]">
                  <h5 className="text-[10px] font-bold text-[#1b4332] uppercase mb-1.5">Revenue Breakdown</h5>
                  <div className="space-y-1 text-[11px]">
                    {Object.entries(financialStatement.incomeByCategory || {}).map(([cat, amt]) => (
                      <div key={cat} className="flex items-center justify-between border-b border-stone-100 pb-0.5">
                        <span className="text-stone-700 truncate pr-2">{cat}</span>
                        <span className="font-bold text-emerald-800 shrink-0">₱{amt.toLocaleString()}.00</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1 font-black text-[#1b4332]">
                      <span>Total Revenue</span>
                      <span>₱{(Number(manifest.totalIncome) || 0).toLocaleString()}.00</span>
                    </div>
                  </div>
                </div>

                {/* Expenses Breakdown */}
                <div className="bg-white p-3 rounded-xl border border-[#e2ece2]">
                  <h5 className="text-[10px] font-bold text-rose-800 uppercase mb-1.5">Disbursements Breakdown</h5>
                  <div className="space-y-1 text-[11px]">
                    {Object.entries(financialStatement.expensesByCategory || {}).map(([cat, amt]) => (
                      <div key={cat} className="flex items-center justify-between border-b border-stone-100 pb-0.5">
                        <span className="text-stone-700 truncate pr-2">{cat}</span>
                        <span className="font-bold text-rose-800 shrink-0">₱{amt.toLocaleString()}.00</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1 font-black text-rose-900">
                      <span>Total Disbursements</span>
                      <span>₱{(Number(manifest.totalDisbursements) || 0).toLocaleString()}.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVE MEMBERS */}
          {activeCategory === 'members' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] sm:text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1b4332] text-white">
                    <th className="p-2 rounded-l-lg">ID</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Chapter</th>
                    <th className="p-2">Motorcycle</th>
                    <th className="p-2 rounded-r-lg">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {activeMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-stone-50">
                      <td className="p-2 font-bold text-stone-900">{m.memberNumber}</td>
                      <td className="p-2 font-medium text-stone-900">{m.name}</td>
                      <td className="p-2"><span className="px-1.5 py-0.2 rounded-full text-[9px] bg-stone-100 text-stone-700 font-bold">{m.role}</span></td>
                      <td className="p-2 text-stone-800">{m.chapter || 'Main Chapter'}</td>
                      <td className="p-2 text-stone-800">{m.bikeInfo}</td>
                      <td className="p-2 text-stone-800">{m.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: COLLECTIONS REGISTER */}
          {activeCategory === 'collections' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] sm:text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1b4332] text-white">
                    <th className="p-2 rounded-l-lg">Date</th>
                    <th className="p-2">Member</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Method</th>
                    <th className="p-2 text-right rounded-r-lg">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {collectionsRegister.map((c) => (
                    <tr key={c.id} className="hover:bg-stone-50">
                      <td className="p-2 text-stone-800">{c.date}</td>
                      <td className="p-2 font-bold text-stone-900">{c.memberName}</td>
                      <td className="p-2 text-stone-700">{c.itemType}</td>
                      <td className="p-2 text-stone-700">{c.description}</td>
                      <td className="p-2 text-stone-700">{c.paymentMethod}</td>
                      <td className="p-2 text-right font-bold text-emerald-800">₱{c.amount.toLocaleString()}.00</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: DISBURSEMENTS LOG */}
          {activeCategory === 'disbursements' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] sm:text-xs border-collapse">
                <thead>
                  <tr className="bg-rose-800 text-white">
                    <th className="p-2 rounded-l-lg">Date</th>
                    <th className="p-2">Particulars</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Payee</th>
                    <th className="p-2">Receipt</th>
                    <th className="p-2 text-right rounded-r-lg">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {disbursementsLog.map((d) => (
                    <tr key={d.id} className="hover:bg-stone-50">
                      <td className="p-2 text-stone-800">{d.date}</td>
                      <td className="p-2 font-bold text-stone-900">{d.title}</td>
                      <td className="p-2 text-stone-700">{d.category}</td>
                      <td className="p-2 text-stone-700">{d.payee}</td>
                      <td className="p-2 text-stone-700">{d.receiptRef}</td>
                      <td className="p-2 text-right font-bold text-rose-800">₱{d.amount.toLocaleString()}.00</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: FINANCIAL STATEMENT */}
          {activeCategory === 'statement' && (
            <div className="space-y-2 bg-white p-3 rounded-xl border border-[#e2ece2]">
              <div className="flex items-center justify-between border-b border-[#e2ece2] pb-1.5">
                <h5 className="font-heading text-xs sm:text-sm font-extrabold text-[#1b4332]">
                  Income Statement & Monthly Flows
                </h5>
                <span className="font-extrabold text-xs text-emerald-800">
                  Surplus: ₱{(Number(manifest.netSurplus) || 0).toLocaleString()}.00
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] sm:text-xs">
                  <thead>
                    <tr className="bg-[#f7f9f7] text-[#1b4332]">
                      <th className="p-1.5">Month</th>
                      <th className="p-1.5 text-right">Income</th>
                      <th className="p-1.5 text-right">Expenses</th>
                      <th className="p-1.5 text-right">Net Flow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {financialStatement.monthlyBreakdown?.map((m) => (
                      <tr key={m.month} className="hover:bg-stone-50">
                        <td className="p-1.5 font-bold text-stone-900">{m.month}</td>
                        <td className="p-1.5 text-right text-emerald-800 font-bold">₱{m.income.toLocaleString()}.00</td>
                        <td className="p-1.5 text-right text-rose-800 font-bold">₱{m.expenses.toLocaleString()}.00</td>
                        <td className={`p-1.5 text-right font-black ${m.surplus >= 0 ? 'text-[#1b4332]' : 'text-rose-800'}`}>
                          ₱{m.surplus.toLocaleString()}.00
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: AGING & COMPLIANCE */}
          {activeCategory === 'aging' && (
            <div>
              {agingAndCompliance.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-600">No member aging or compliance records found for this fiscal year.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] sm:text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#1b4332] text-white">
                        <th className="p-2 rounded-l-lg">Member</th>
                        <th className="p-2">Reg. Fee</th>
                        <th className="p-2">Promo</th>
                        <th className="p-2">Paid</th>
                        <th className="p-2">Overdue</th>
                        <th className="p-2 rounded-r-lg">Compliance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                      {agingAndCompliance.map((c) => (
                        <tr key={c.memberId} className="hover:bg-stone-50">
                          <td className="p-2 font-bold text-stone-900">
                            {c.memberName} <span className="text-[10px] text-stone-700 font-normal">({c.memberNo})</span>
                          </td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                              c.membershipFeePaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {c.membershipFeePaid ? 'PAID' : 'UNPAID'}
                            </span>
                          </td>
                          <td className="p-2 text-stone-800">{c.annualPromoEnrolled ? 'Promo (₱1k)' : 'Monthly'}</td>
                          <td className="p-2 font-bold text-stone-900">{c.paidMonthsCount} / 12</td>
                          <td className="p-2 font-bold text-amber-900">₱{c.overdueAmount.toLocaleString()}.00</td>
                          <td className="p-2 font-black text-emerald-800">{c.complianceRate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: CUSTOM PROJECTS */}
          {activeCategory === 'projects' && (
            <div>
              {customProjects.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-600">No custom projects or dynamic collections recorded.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] sm:text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#1b4332] text-white">
                        <th className="p-2 rounded-l-lg">Project</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Target</th>
                        <th className="p-2 text-right">Collected</th>
                        <th className="p-2 text-right">Disbursed</th>
                        <th className="p-2 text-right rounded-r-lg">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                      {customProjects.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50">
                          <td className="p-2 font-bold text-stone-900">{p.name}</td>
                          <td className="p-2"><span className="px-1.5 py-0.2 rounded-full text-[9px] bg-stone-100 font-bold">{p.type}</span></td>
                          <td className="p-2 text-stone-800">{p.targetAmount ? `₱${p.targetAmount.toLocaleString()}.00` : 'N/A'}</td>
                          <td className="p-2 text-right font-bold text-emerald-800">₱{p.totalCollected.toLocaleString()}.00</td>
                          <td className="p-2 text-right font-bold text-rose-800">₱{p.totalExpenses.toLocaleString()}.00</td>
                          <td className="p-2 text-right font-black text-[#1b4332]">₱{p.netBalance.toLocaleString()}.00</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Close */}
        <div className="flex items-center justify-end pt-2 border-t border-[#e2ece2] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 sm:py-2 rounded-xl bg-[#1b4332] text-white font-bold text-xs hover:bg-[#2d6a4f] transition-all cursor-pointer shadow-xs active:scale-95"
          >
            Close Archive
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
);
};
