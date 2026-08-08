import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { store } from '../lib/db';
import {
  ShieldCheck,
  DollarSign,
  Users,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  CreditCard,
  Building,
  Lock,
} from 'lucide-react';

export const AdminERPPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const [payments, setPayments] = useState(() => store.getPayments());
  const [users, setUsers] = useState(() => store.getUsers().filter((u) => u.role !== 'admin'));

  const totalRevenue = payments
    .filter((p) => p.status === 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const duesPendingCount = users.filter((u) => u.duesStatus === 'Pending Renewal' || u.duesStatus === 'Overdue').length;

  return (
    <div className="space-y-8 pb-12">
      {/* Admin Header */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#1b4332] border border-[#2d6a4f] space-y-2 text-white shadow-md">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#74c69d]" />
          <span className="text-xs font-bold text-[#74c69d] uppercase tracking-wider">
            Executive Admin Command Center
          </span>
        </div>
        <h2 className="font-heading text-2xl font-extrabold text-white">
          Club Financial Ledger & Dues Audit
        </h2>
        <p className="text-xs text-[#d8f3dc]/80 max-w-xl">
          Logged in as <strong className="text-white">{currentUser?.name}</strong> (President / System Admin).
          Manage treasury balances, dues status overrides, and transaction receipts.
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#e2ece2] space-y-1 shadow-xs">
          <span className="text-xs text-[#52605d] font-bold">Total Club Revenue</span>
          <p className="font-heading text-2xl font-black text-[#1b4332]">
            ₱{totalRevenue.toLocaleString()}.00
          </p>
          <span className="text-[10px] text-[#52605d]">Verified transaction receipts</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2ece2] space-y-1 shadow-xs">
          <span className="text-xs text-[#52605d] font-bold">Pending / Overdue Dues</span>
          <p className="font-heading text-2xl font-black text-[#2d6a4f]">
            {duesPendingCount} Members
          </p>
          <span className="text-[10px] text-[#52605d]">Requires renewal outreach</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2ece2] space-y-1 shadow-xs">
          <span className="text-xs text-[#52605d] font-bold">Total Club Accounts</span>
          <p className="font-heading text-2xl font-black text-[#1b4332]">
            {users.length} Active Profiles
          </p>
          <span className="text-[10px] text-[#52605d]">Full audit logging</span>
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className="p-6 rounded-3xl bg-white border border-[#e2ece2] space-y-4 shadow-xs">
        <h3 className="font-heading font-bold text-[#1b4332] text-base">
          Recent Financial Transactions Ledger
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#e2ece2] text-[#52605d] font-bold uppercase text-[10px]">
                <th className="py-3 px-3">Ref Code</th>
                <th className="py-3 px-3">Member</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Method</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2ece2]">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#52605d]">
                    No financial transaction receipts recorded in the ledger yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[#f7f9f7]">
                    <td className="py-3 px-3 font-mono text-[#2d6a4f] font-bold">{p.transactionRef}</td>
                    <td className="py-3 px-3 text-[#1b4332] font-semibold">{p.userName}</td>
                    <td className="py-3 px-3 text-[#52605d]">{p.type}</td>
                    <td className="py-3 px-3 text-[#52605d]">{p.paymentMethod}</td>
                    <td className="py-3 px-3 font-bold text-[#1b4332]">₱{p.amount.toLocaleString()}.00</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d8f3dc] text-[#1b4332] border border-[#b7e4c7]">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#52605d]">{p.createdAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
