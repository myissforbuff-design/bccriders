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
  Calendar,
  Layers,
  ArrowDownToLine,
  FolderArchive,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ArchivePackageData } from '../types';
import { exportArchiveToMultiTabXLSX, exportArchiveToIncomeStatementPDF } from '../lib/yearlyArchiveUtils';

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
  const [activeCategory, setActiveCategory] = useState<string>('summary');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

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
    { id: 'members', name: 'Active Members & Records', count: `${activeMembers.length} records` },
    { id: 'collections', name: 'Total Income & Collections', count: `${collectionsRegister.length} payments` },
    { id: 'disbursements', name: 'Disbursements Log', count: `${disbursementsLog.length} vouchers` },
    { id: 'statement', name: 'Financial Statement & Surplus', count: 'Income Statement' },
    { id: 'aging', name: 'Aging & Compliance Ledger', count: `${agingAndCompliance.length} members` },
    { id: 'projects', name: 'Custom Projects & Donations', count: `${customProjects.length} projects` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-stone-900/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-[#e2ece2] space-y-4 sm:space-y-6 my-auto max-h-[92dvh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#e2ece2] pb-3 sm:pb-4 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#1b4332] text-white flex items-center justify-center shadow-md shrink-0">
              <FolderArchive className="w-5 h-5 sm:w-6 sm:h-6 text-[#74c69d]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="font-heading text-base sm:text-lg md:text-xl font-black text-[#1b4332] truncate">
                  FY {manifest.year} Financial Archive
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  <span>Audited</span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5 truncate sm:whitespace-normal">
                Archived on {new Date(manifest.archivedAt).toLocaleDateString()} by {manifest.archivedBy}
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

        {/* 4 PRIMARY HIGHLIGHT METRIC CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
          {/* Active Members */}
          <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-[#52605d] uppercase block truncate">Active Members</span>
              <p className="font-heading text-xs sm:text-sm md:text-base font-black text-[#1b4332] truncate">
                {manifest.activeMemberCount || activeMembers.length}
              </p>
            </div>
          </div>

          {/* Total Income */}
          <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-[#52605d] uppercase block truncate">Total Income</span>
              <p className="font-heading text-xs sm:text-sm md:text-base font-black text-[#1b4332] truncate">
                ₱{(Number(manifest.totalIncome) || 0).toLocaleString()}.00
              </p>
            </div>
          </div>

          {/* Disbursements */}
          <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-[#52605d] uppercase block truncate">Disbursements</span>
              <p className="font-heading text-xs sm:text-sm md:text-base font-black text-rose-800 truncate">
                ₱{(Number(manifest.totalDisbursements) || 0).toLocaleString()}.00
              </p>
            </div>
          </div>

          {/* Net Surplus */}
          <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-[#e8f5e9] text-[#1b4332] flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-[#52605d] uppercase block truncate">Net Surplus</span>
              <p className="font-heading text-xs sm:text-sm md:text-base font-black text-[#1b4332] truncate">
                ₱{(Number(manifest.netSurplus) || 0).toLocaleString()}.00
              </p>
            </div>
          </div>
        </div>

        {/* TWO PRIMARY PROMINENT EXPORT ACTION BUTTONS */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2.5 sm:space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black text-[#1b4332] uppercase tracking-wider">
              Choose Export Format for All Records:
            </span>
            <span className="text-[10px] sm:text-[11px] text-[#52605d] hidden sm:inline">
              10 Complete Record Books Included
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {/* EXCEL (.XLSX) BUTTON */}
            <button
              type="button"
              onClick={handleExportXlsx}
              className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#2d6a4f] hover:bg-[#1b4332] text-white flex items-center gap-2.5 sm:gap-3.5 transition-all shadow-md active:scale-98 cursor-pointer group text-left"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-heading font-extrabold text-xs sm:text-sm text-white truncate">
                    Export Multi-Tab Excel (.xlsx)
                  </span>
                  <ArrowDownToLine className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#74c69d] shrink-0" />
                </div>
                <p className="text-[10px] sm:text-[11px] text-emerald-100 mt-0.5 leading-snug truncate sm:whitespace-normal">
                  Separates all 10 records into individual Excel sheet tabs.
                </p>
              </div>
            </button>

            {/* PDF BUTTON */}
            <button
              type="button"
              onClick={handleExportPdf}
              className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white flex items-center gap-2.5 sm:gap-3.5 transition-all shadow-md active:scale-98 cursor-pointer group text-left"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-[#74c69d]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-heading font-extrabold text-xs sm:text-sm text-white truncate">
                    Export Income Statement (.pdf)
                  </span>
                  <ArrowDownToLine className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#74c69d] shrink-0" />
                </div>
                <p className="text-[10px] sm:text-[11px] text-[#b7e4c7] mt-0.5 leading-snug truncate sm:whitespace-normal">
                  Certified Income Statement report with revenue & liquidation.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* RECORD INSPECTOR NAVIGATION TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#e2ece2] shrink-0">
          {recordCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'bg-[#1b4332] text-white shadow-xs'
                  : 'bg-stone-50 text-stone-700 hover:bg-[#e2ece2]'
              }`}
            >
              <span>{cat.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeCategory === cat.id ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* RECORD DETAILS VIEWER (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[380px] border border-[#e2ece2] rounded-2xl p-4 bg-[#fafcfa]">
          {/* TAB 1: OVERVIEW / SUMMARY */}
          {activeCategory === 'summary' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-[#e2ece2] space-y-3">
                <h4 className="font-heading text-sm font-extrabold text-[#1b4332]">
                  Audit Summary & Certification Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#52605d] block">Fiscal Period:</span>
                    <span className="font-bold text-stone-900">January 1, {manifest.year} - December 31, {manifest.year}</span>
                  </div>
                  <div>
                    <span className="text-[#52605d] block">Audited By:</span>
                    <span className="font-bold text-stone-900">{manifest.archivedBy}</span>
                  </div>
                  <div>
                    <span className="text-[#52605d] block">Carried Forward Treasury:</span>
                    <span className="font-bold text-emerald-800">₱{(Number(manifest.carriedOverTreasury) || 0).toLocaleString()}.00</span>
                  </div>
                  <div>
                    <span className="text-[#52605d] block">Audit Notes:</span>
                    <span className="font-medium text-stone-800">{manifest.auditNotes || 'Reconciled and certified.'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Revenue Breakdown */}
                <div className="bg-white p-4 rounded-xl border border-[#e2ece2]">
                  <h5 className="text-xs font-bold text-[#1b4332] uppercase mb-2">Revenue Breakdown</h5>
                  <div className="space-y-1.5 text-xs">
                    {Object.entries(financialStatement.incomeByCategory || {}).map(([cat, amt]) => (
                      <div key={cat} className="flex items-center justify-between border-b border-stone-100 pb-1">
                        <span className="text-stone-700">{cat}</span>
                        <span className="font-bold text-emerald-800">₱{amt.toLocaleString()}.00</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1 font-black text-[#1b4332]">
                      <span>Total Revenue</span>
                      <span>₱{(Number(manifest.totalIncome) || 0).toLocaleString()}.00</span>
                    </div>
                  </div>
                </div>

                {/* Expenses Breakdown */}
                <div className="bg-white p-4 rounded-xl border border-[#e2ece2]">
                  <h5 className="text-xs font-bold text-rose-800 uppercase mb-2">Disbursements Breakdown</h5>
                  <div className="space-y-1.5 text-xs">
                    {Object.entries(financialStatement.expensesByCategory || {}).map(([cat, amt]) => (
                      <div key={cat} className="flex items-center justify-between border-b border-stone-100 pb-1">
                        <span className="text-stone-700">{cat}</span>
                        <span className="font-bold text-rose-800">₱{amt.toLocaleString()}.00</span>
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
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1b4332] text-white">
                      <th className="p-2.5 rounded-l-lg">Member ID</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Role</th>
                      <th className="p-2.5">Chapter</th>
                      <th className="p-2.5">Motorcycle</th>
                      <th className="p-2.5 rounded-r-lg">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {activeMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-stone-50">
                        <td className="p-2.5 font-bold text-stone-900">{m.memberNumber}</td>
                        <td className="p-2.5 font-medium text-stone-900">{m.name}</td>
                        <td className="p-2.5"><span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-100 text-stone-700 font-bold">{m.role}</span></td>
                        <td className="p-2.5 text-stone-800">{m.chapter || 'Main Chapter'}</td>
                        <td className="p-2.5 text-stone-800">{m.bikeInfo}</td>
                        <td className="p-2.5 text-stone-800">{m.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: COLLECTIONS REGISTER */}
          {activeCategory === 'collections' && (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1b4332] text-white">
                      <th className="p-2.5 rounded-l-lg">Date</th>
                      <th className="p-2.5">Member</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5 text-right rounded-r-lg">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {collectionsRegister.map((c) => (
                      <tr key={c.id} className="hover:bg-stone-50">
                        <td className="p-2.5 text-stone-800">{c.date}</td>
                        <td className="p-2.5 font-bold text-stone-900">{c.memberName}</td>
                        <td className="p-2.5 text-stone-700">{c.itemType}</td>
                        <td className="p-2.5 text-stone-700">{c.description}</td>
                        <td className="p-2.5 text-stone-700">{c.paymentMethod}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-800">₱{c.amount.toLocaleString()}.00</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DISBURSEMENTS LOG */}
          {activeCategory === 'disbursements' && (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-rose-800 text-white">
                      <th className="p-2.5 rounded-l-lg">Date</th>
                      <th className="p-2.5">Particulars / Title</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Payee / Vendor</th>
                      <th className="p-2.5">Receipt Ref</th>
                      <th className="p-2.5 text-right rounded-r-lg">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {disbursementsLog.map((d) => (
                      <tr key={d.id} className="hover:bg-stone-50">
                        <td className="p-2.5 text-stone-800">{d.date}</td>
                        <td className="p-2.5 font-bold text-stone-900">{d.title}</td>
                        <td className="p-2.5 text-stone-700">{d.category}</td>
                        <td className="p-2.5 text-stone-700">{d.payee}</td>
                        <td className="p-2.5 text-stone-700">{d.receiptRef}</td>
                        <td className="p-2.5 text-right font-bold text-rose-800">₱{d.amount.toLocaleString()}.00</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: FINANCIAL STATEMENT */}
          {activeCategory === 'statement' && (
            <div className="space-y-3 bg-white p-4 rounded-xl border border-[#e2ece2]">
              <div className="flex items-center justify-between border-b border-[#e2ece2] pb-2">
                <h5 className="font-heading text-sm font-extrabold text-[#1b4332]">
                  Income Statement & Monthly Cash Flows
                </h5>
                <span className="font-extrabold text-sm text-emerald-800">
                  Net Surplus: ₱{(Number(manifest.netSurplus) || 0).toLocaleString()}.00
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#f7f9f7] text-[#1b4332]">
                      <th className="p-2">Month</th>
                      <th className="p-2 text-right">Income</th>
                      <th className="p-2 text-right">Expenses</th>
                      <th className="p-2 text-right">Net Flow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {financialStatement.monthlyBreakdown?.map((m) => (
                      <tr key={m.month} className="hover:bg-stone-50">
                        <td className="p-2 font-bold text-stone-900">{m.month}</td>
                        <td className="p-2 text-right text-emerald-800 font-bold">₱{m.income.toLocaleString()}.00</td>
                        <td className="p-2 text-right text-rose-800 font-bold">₱{m.expenses.toLocaleString()}.00</td>
                        <td className={`p-2 text-right font-black ${m.surplus >= 0 ? 'text-[#1b4332]' : 'text-rose-800'}`}>
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
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1b4332] text-white">
                      <th className="p-2.5 rounded-l-lg">Member</th>
                      <th className="p-2.5">Membership Fee</th>
                      <th className="p-2.5">Annual Promo</th>
                      <th className="p-2.5">Paid Months</th>
                      <th className="p-2.5">Overdue Amount</th>
                      <th className="p-2.5 rounded-r-lg">Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {agingAndCompliance.map((c) => (
                      <tr key={c.memberId} className="hover:bg-stone-50">
                        <td className="p-2.5 font-bold text-stone-900">
                          {c.memberName} <span className="text-[10px] text-stone-700 font-normal">({c.memberNo})</span>
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.membershipFeePaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {c.membershipFeePaid ? 'PAID' : 'UNPAID'}
                          </span>
                        </td>
                        <td className="p-2.5 text-stone-800">{c.annualPromoEnrolled ? 'Enrolled (₱1,000)' : 'Monthly'}</td>
                        <td className="p-2.5 font-bold text-stone-900">{c.paidMonthsCount} / 12</td>
                        <td className="p-2.5 font-bold text-amber-900">₱{c.overdueAmount.toLocaleString()}.00</td>
                        <td className="p-2.5 font-black text-emerald-800">{c.complianceRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: CUSTOM PROJECTS */}
          {activeCategory === 'projects' && (
            <div className="space-y-2">
              {customProjects.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-700">No custom projects or dynamic collections recorded for this year.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#1b4332] text-white">
                        <th className="p-2.5 rounded-l-lg">Project Name</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Target</th>
                        <th className="p-2.5 text-right">Collected</th>
                        <th className="p-2.5 text-right">Disbursed</th>
                        <th className="p-2.5 text-right rounded-r-lg">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                      {customProjects.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50">
                          <td className="p-2.5 font-bold text-stone-900">{p.name}</td>
                          <td className="p-2.5"><span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-100 font-bold">{p.type}</span></td>
                          <td className="p-2.5 text-stone-800">{p.targetAmount ? `₱${p.targetAmount.toLocaleString()}.00` : 'N/A'}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-800">₱{p.totalCollected.toLocaleString()}.00</td>
                          <td className="p-2.5 text-right font-bold text-rose-800">₱{p.totalExpenses.toLocaleString()}.00</td>
                          <td className="p-2.5 text-right font-black text-[#1b4332]">₱{p.netBalance.toLocaleString()}.00</td>
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
            className="px-5 py-2.5 rounded-xl bg-[#1b4332] text-white font-bold text-xs hover:bg-[#2d6a4f] transition-all cursor-pointer shadow-xs"
          >
            Close Archive Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
