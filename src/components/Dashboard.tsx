import React from 'react';
import { useAuth } from '../context/AuthContext';
import { store } from '../lib/db';
import { TabType } from './Navigation';
import {
  Users,
  ArrowUpRight,
  Sparkles,
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

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl">
        {/* Active Members */}
        <motion.div
          whileHover={{ y: -2 }}
          className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex items-center justify-between shadow-xs"
        >
          <div className="space-y-0.5 sm:space-y-1">
            <span className="text-[11px] sm:text-xs text-[#52605d] font-semibold">Active Members</span>
            <p className="font-heading text-xl sm:text-2xl font-extrabold text-[#1b4332]">
              {activeMembersCount}{' '}
              <span className="text-[11px] sm:text-xs font-normal text-[#52605d]">/ {totalMembers} total</span>
            </p>
            <span className="text-[10px] sm:text-[11px] text-[#2d6a4f] font-medium flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              {totalMembers > 0 ? Math.round((activeMembersCount / totalMembers) * 100) : 0}% active status
            </span>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-[#d8f3dc] text-[#1b4332]">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </motion.div>

        {/* Pending Approvals */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => setActiveTab('members')}
          className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex items-center justify-between shadow-xs cursor-pointer hover:border-[#74c69d] transition-colors"
        >
          <div className="space-y-0.5 sm:space-y-1">
            <span className="text-[11px] sm:text-xs text-[#52605d] font-semibold">Pending Approvals</span>
            <p className="font-heading text-xl sm:text-2xl font-extrabold text-[#1b4332]">
              {pendingApprovalsCount}
            </p>
            <span className="text-[10px] sm:text-[11px] text-[#52605d] font-medium">
              Awaiting review in Members tab
            </span>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-amber-100 text-amber-800">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

