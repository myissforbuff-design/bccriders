import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { store } from '../lib/db';
import {
  FileText,
  Download,
  Users,
  DollarSign,
  Trophy,
  Calendar,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  PieChart,
  Printer,
  Bike,
} from 'lucide-react';

export const Reports: React.FC = () => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const members = store.getUsers().filter((u) => u.role !== 'admin');
  const payments = store.getPayments();
  const rideLogs = store.getRideLogs();
  const events = store.getEvents();

  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.approvalStatus === 'Approved' || m.approvalStatus !== 'Pending').length;
  const pendingMembers = members.filter((m) => m.approvalStatus === 'Pending').length;

  const duesRevenue = payments
    .filter((p) => p.status === 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalMiles = members.reduce((sum, m) => sum + (m.totalMiles || 0), 0);

  const handleExportXLSX = () => {
    const wb = XLSX.utils.book_new();
    const headers = ['Member ID', 'Name', 'Email', 'Role', 'Approval Status', 'Total Miles'];
    const rows = members.map((m) => [
      m.memberNumber || '',
      m.name,
      m.email,
      m.role === 'admin' ? 'Admin' : 'Member',
      m.approvalStatus || 'Approved',
      m.totalMiles || 0,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Riders Report');
    XLSX.writeFile(wb, `bcc_riders_club_report_${new Date().toISOString().split('T')[0]}.xlsx`);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header Banner */}
      <div className="rounded-3xl bg-[#1b4332] text-white p-6 sm:p-8 border border-[#2d6a4f] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 glow-forest">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2d6a4f] text-[#74c69d] text-xs font-semibold border border-[#74c69d]/30">
            <FileText className="w-3.5 h-3.5" />
            <span>Club Analytics & Auditing</span>
          </div>
          <h1 className="font-heading text-2xl font-extrabold text-white">Reports & Financial Audit</h1>
          <p className="text-xs text-[#d8f3dc]/80">
            Comprehensive overview of BCC Riders Club membership health, annual dues revenue, and riding activities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportXLSX}
            className="py-2.5 px-4 rounded-xl bg-[#74c69d] hover:bg-[#52b788] text-[#081c15] font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            Export Excel (.xlsx)
          </button>
          <button
            onClick={handlePrint}
            className="py-2.5 px-4 rounded-xl bg-[#2d6a4f] hover:bg-[#1b4332] text-white font-bold text-xs border border-[#74c69d]/30 transition-colors cursor-pointer flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-[#74c69d]" />
            Print Report
          </button>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-4 rounded-2xl bg-[#d8f3dc] border border-[#b7e4c7] text-[#1b4332] text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2d6a4f]" />
            <span>Excel (.xlsx) Report generated and downloaded successfully!</span>
          </div>
          <button onClick={() => setDownloadSuccess(false)} className="text-xs font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div className="p-5 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-[#52605d] font-semibold">Total Roster</span>
            <p className="font-heading text-2xl font-extrabold text-[#1b4332]">{totalMembers}</p>
            <span className="text-[11px] text-[#2d6a4f] font-medium flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {activeMembers} Active ({Math.round((activeMembers / (totalMembers || 1)) * 100)}%)
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-[#d8f3dc] text-[#1b4332]">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Dues Treasury */}
        <div className="p-5 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-[#52605d] font-semibold">Annual Dues Revenue</span>
            <p className="font-heading text-2xl font-extrabold text-[#1b4332]">
              ${duesRevenue.toLocaleString()}
            </p>
            <span className="text-[11px] text-[#2d6a4f] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#2d6a4f]" />
              {payments.filter((p) => p.status === 'Paid').length} paid receipts
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-[#d8f3dc] text-[#1b4332]">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total Club Mileage */}
        <div className="p-5 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-[#52605d] font-semibold">Total Club Mileage</span>
            <p className="font-heading text-2xl font-extrabold text-[#1b4332]">
              {totalMiles.toLocaleString()} <span className="text-xs font-normal text-[#52605d]">mi</span>
            </p>
            <span className="text-[11px] text-[#2d6a4f] font-medium flex items-center gap-1">
              <Bike className="w-3 h-3" />
              {rideLogs.length} verified logs
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-[#d8f3dc] text-[#1b4332]">
            <Trophy className="w-6 h-6" />
          </div>
        </div>

        {/* Club Events */}
        <div className="p-5 rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-[#52605d] font-semibold">Scheduled Events</span>
            <p className="font-heading text-2xl font-extrabold text-[#1b4332]">{events.length}</p>
            <span className="text-[11px] text-[#2d6a4f] font-medium flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {events.filter((e) => e.status === 'Upcoming').length} upcoming rides
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-[#d8f3dc] text-[#1b4332]">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Membership Dues Status Distribution */}
        <div className="p-6 rounded-3xl bg-white border border-[#e2ece2] shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#e2ece2]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#d8f3dc] text-[#1b4332]">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-heading text-base font-bold text-[#1b4332]">Membership Status Summary</h2>
                <p className="text-xs text-[#52605d]">Active, Pending Renewal, and Expired accounts</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Active Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#1b4332] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2d6a4f]" />
                  Active Dues Members
                </span>
                <span className="text-[#2d6a4f]">
                  {activeMembers} ({Math.round((activeMembers / (totalMembers || 1)) * 100)}%)
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#f7f9f7] border border-[#e2ece2] overflow-hidden">
                <div
                  className="h-full bg-[#2d6a4f] rounded-full transition-all duration-500"
                  style={{ width: `${(activeMembers / (totalMembers || 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Pending Renewal Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#1b4332] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Pending Renewal
                </span>
                <span className="text-amber-700">
                  {pendingMembers} ({Math.round((pendingMembers / (totalMembers || 1)) * 100)}%)
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#f7f9f7] border border-[#e2ece2] overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${(pendingMembers / (totalMembers || 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Pending Approvals Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#1b4332] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Pending Approvals
                </span>
                <span className="text-amber-700">
                  {pendingMembers} ({Math.round((pendingMembers / (totalMembers || 1)) * 100)}%)
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#f7f9f7] border border-[#e2ece2] overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${(pendingMembers / (totalMembers || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] flex items-center justify-between text-xs">
            <span className="text-[#52605d] font-semibold">Club Active Member Ratio:</span>
            <strong className="text-[#1b4332] font-heading font-extrabold text-sm">
              {Math.round((activeMembers / (totalMembers || 1)) * 100)}% Active
            </strong>
          </div>
        </div>

        {/* Member Dues Table */}
        <div className="p-6 rounded-3xl bg-white border border-[#e2ece2] shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-[#e2ece2]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#d8f3dc] text-[#1b4332]">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-heading text-base font-bold text-[#1b4332]">Roster & Dues Audit</h2>
                <p className="text-xs text-[#52605d]">Member compliance records</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#e2ece2] text-[#52605d] font-bold">
                  <th className="pb-2">Member</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Miles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2ece2]">
                {members.slice(0, 5).map((m) => (
                  <tr key={m.id} className="hover:bg-[#f7f9f7] transition-colors">
                    <td className="py-2.5 font-bold text-[#1b4332]">
                      <div>{m.name}</div>
                      <div className="text-[10px] text-[#52605d] font-mono">{m.memberNumber}</div>
                    </td>
                    <td className="py-2.5 text-[#52605d] font-medium">{m.role === 'admin' ? 'Admin' : 'Member'}</td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          (m.approvalStatus || 'Approved') === 'Approved'
                            ? 'bg-[#d8f3dc] text-[#1b4332] border-[#b7e4c7]'
                            : 'bg-amber-100 text-amber-900 border-amber-200'
                        }`}
                      >
                        {m.approvalStatus || 'Approved'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-[#2d6a4f]">
                      {(m.totalMiles || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
