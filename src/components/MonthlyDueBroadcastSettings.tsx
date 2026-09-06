import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  Calendar,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Coins,
  ShieldCheck,
  UserX,
  AlertTriangle,
  MessageSquare,
  Search,
  Filter,
  Check,
  X,
  Receipt,
  ArrowUpRight,
} from 'lucide-react';
import { User, MonthlyDue } from '../types';
import { authFetch } from '../lib/db';
import {
  generateMonthlyDueEmailContent,
  generateIndividualDueReminderEmailContent,
  UnpaidDueItem,
} from '../lib/monthlyDueEmailUtils';
import { getCurrentGMT8Date } from '../lib/birthdayUtils';

interface MonthlyDueBroadcastSettingsProps {
  members: User[];
  monthlyDues?: MonthlyDue[];
}

const STORAGE_KEY_BROADCAST_TOGGLE = 'bcc_monthly_due_email_broadcast_enabled';
const STORAGE_KEY_BROADCAST_LOGS = 'bcc_monthly_due_broadcast_logs';
const STORAGE_KEY_INDIVIDUAL_TOGGLE = 'bcc_individual_due_email_reminder_enabled';

interface DueBroadcastLog {
  id: string;
  dueId: string;
  month: string;
  year: number;
  amount: number;
  title: string;
  sentDate: string;
  sentMonthYear: string;
  recipientCount: number;
  sentAt: string;
  status: 'delivered' | 'failed' | 'simulated';
  resendId?: string;
  triggerType?: string;
}

interface MemberUnpaidSummary {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  unpaidDues: UnpaidDueItem[];
  totalUnpaidAmount: number;
  unpaidCount: number;
  lastReminderSentAt?: string;
}

interface IndividualReminderLog {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  recipientEmail: string;
  unpaidDuesCount: number;
  unpaidDuesSummary: string[];
  totalAmountDue: number;
  sentDate: string;
  sentMonthYear: string;
  sentAt: string;
  status: 'delivered' | 'simulated' | 'failed';
  resendId?: string;
  error?: string;
  triggerType: 'manual_single' | 'manual_batch' | 'automated_cycle';
}

const isUserAdmin = (m: any) => {
  if (!m) return false;
  const role = String(m.role || m.userRole || m.clubRole || "").toLowerCase().trim();
  const username = String(m.username || "").toLowerCase().trim();
  const id = String(m.id || "").toLowerCase().trim();
  const name = String(m.name || m.fullName || "").toLowerCase().trim();
  const email = String(m.email || "").toLowerCase().trim();
  return (
    role === "admin" ||
    role === "administrator" ||
    role === "executive" ||
    id === "usr_admin" ||
    username === "admin" ||
    username === "administrator" ||
    name === "admin" ||
    name === "administrator" ||
    email === "admin@gmail.com" ||
    email === "myissforbuff@gmail.com" ||
    email.startsWith("admin@") ||
    m.isAdmin === true
  );
};

export const MonthlyDueBroadcastSettings: React.FC<MonthlyDueBroadcastSettingsProps> = ({
  members,
  monthlyDues = [],
}) => {
  const [activeTab, setActiveTab] = useState<'individual' | 'broadcast'>('individual');

  // Broadcast State
  const [isBroadcastEnabled, setIsBroadcastEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_BROADCAST_TOGGLE);
    return saved !== null ? saved === 'true' : true;
  });
  const [broadcastLogs, setBroadcastLogs] = useState<DueBroadcastLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BROADCAST_LOGS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedDueId, setSelectedDueId] = useState<string>('');
  const [customBroadcastNotes, setCustomBroadcastNotes] = useState<string>('');
  const [showBroadcastPreview, setShowBroadcastPreview] = useState<boolean>(false);
  const [isSendingBroadcast, setIsSendingBroadcast] = useState<boolean>(false);

  // Individual Reminder State
  const [isIndividualEnabled, setIsIndividualEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_INDIVIDUAL_TOGGLE);
    return saved !== null ? saved === 'true' : true;
  });
  const [disabledMemberIds, setDisabledMemberIds] = useState<string[]>([]);
  const [filterReminderStatus, setFilterReminderStatus] = useState<'all' | 'active' | 'muted'>('all');
  const [togglingMemberId, setTogglingMemberId] = useState<string | null>(null);
  const [unpaidMembers, setUnpaidMembers] = useState<MemberUnpaidSummary[]>([]);
  const [individualLogs, setIndividualLogs] = useState<IndividualReminderLog[]>([]);
  const [isLoadingUnpaid, setIsLoadingUnpaid] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSendingIndividual, setIsSendingIndividual] = useState<boolean>(false);
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);

  // Modal State for Individual Remind
  const [selectedMemberForReminder, setSelectedMemberForReminder] = useState<MemberUnpaidSummary | null>(null);
  const [individualCustomNote, setIndividualCustomNote] = useState<string>('');
  const [showIndividualPreviewModal, setShowIndividualPreviewModal] = useState<boolean>(false);

  // General Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const gmt8 = getCurrentGMT8Date();
  const eligibleRecipients = members.filter(
    (m) => m.approvalStatus === 'Approved' && m.email && m.email.includes('@')
  );

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentMonthName = monthNames[gmt8.month - 1];

  // Active or selected due for broadcast
  const activeDue =
    monthlyDues.find((d) => d.id === selectedDueId) ||
    monthlyDues.find((d) => d.month === currentMonthName && Number(d.year) === gmt8.year) ||
    monthlyDues[0] || {
      id: 'default_due',
      month: currentMonthName,
      year: gmt8.year,
      amount: 150,
      title: `${currentMonthName} ${gmt8.year} Monthly Due`,
      notes: '',
      status: 'Active',
    };

  // Fetch all data
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch broadcast status
      const resB = await authFetch('/api/monthly-dues/broadcast/status');
      if (resB.ok) {
        const dataB = await resB.json();
        if (dataB.success) {
          if (typeof dataB.isEnabled === 'boolean') {
            setIsBroadcastEnabled(dataB.isEnabled);
            localStorage.setItem(STORAGE_KEY_BROADCAST_TOGGLE, String(dataB.isEnabled));
          }
          if (Array.isArray(dataB.logs)) {
            setBroadcastLogs(dataB.logs);
            localStorage.setItem(STORAGE_KEY_BROADCAST_LOGS, JSON.stringify(dataB.logs));
          }
        }
      }

      // 2. Fetch individual unpaid summary
      setIsLoadingUnpaid(true);
      const resI = await authFetch('/api/monthly-dues/unpaid-summary');
      if (resI.ok) {
        const dataI = await resI.json();
        if (dataI.success) {
          if (typeof dataI.isEnabled === 'boolean') {
            setIsIndividualEnabled(dataI.isEnabled);
            localStorage.setItem(STORAGE_KEY_INDIVIDUAL_TOGGLE, String(dataI.isEnabled));
          }
          if (Array.isArray(dataI.disabledUserIds)) {
            setDisabledMemberIds(dataI.disabledUserIds);
          }
          if (Array.isArray(dataI.membersWithUnpaidDues)) {
            setUnpaidMembers(dataI.membersWithUnpaidDues);
          }
          if (Array.isArray(dataI.logs)) {
            setIndividualLogs(dataI.logs);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load dues email status:', e);
    } finally {
      setIsRefreshing(false);
      setIsLoadingUnpaid(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Broadcast toggle handler
  const handleToggleBroadcast = async (checked: boolean) => {
    setIsBroadcastEnabled(checked);
    localStorage.setItem(STORAGE_KEY_BROADCAST_TOGGLE, String(checked));
    try {
      await authFetch('/api/monthly-dues/broadcast/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: checked }),
      });
    } catch (e) {
      console.warn('Failed to sync broadcast toggle with server:', e);
    }
    setFeedback({
      type: 'success',
      message: checked
        ? 'Automated monthly dues creation & reminder broadcasts are now ENABLED.'
        : 'Automated monthly dues email broadcasts are now DISABLED.',
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Individual toggle handler
  const handleToggleIndividual = async (checked: boolean) => {
    setIsIndividualEnabled(checked);
    localStorage.setItem(STORAGE_KEY_INDIVIDUAL_TOGGLE, String(checked));
    try {
      await authFetch('/api/monthly-dues/individual-reminders/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: checked }),
      });
    } catch (e) {
      console.warn('Failed to sync individual toggle with server:', e);
    }
    setFeedback({
      type: 'success',
      message: checked
        ? 'Automated individual member unpaid dues reminders are now ENABLED (once a month per unpaid member).'
        : 'Automated individual member unpaid dues reminders are now DISABLED.',
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Send Broadcast
  const handleSendBroadcast = async (isTest = false) => {
    setFeedback(null);
    setIsSendingBroadcast(true);

    try {
      const response = await authFetch('/api/monthly-dues/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueId: activeDue.id,
          dueRecord: activeDue,
          force: true,
          isTest,
          customNotes: customBroadcastNotes.trim() || undefined,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.details || result.error || `Server error (${response.status})`);
      }

      setFeedback({
        type: 'success',
        message: isTest
          ? `Test monthly dues notice broadcast successfully sent to ${eligibleRecipients.length} member(s)!`
          : `Monthly dues broadcast for ${activeDue.month} ${activeDue.year} successfully dispatched to ${eligibleRecipients.length} member(s)!`,
      });

      await fetchData();
    } catch (err: any) {
      console.error('Failed to send monthly dues broadcast:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to dispatch monthly dues broadcast email.',
      });
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  // Send Individual Reminder to Single Member
  const handleSendSingleIndividualReminder = async (member: MemberUnpaidSummary, customNote?: string) => {
    setFeedback(null);
    setSendingUserId(member.userId);

    try {
      const response = await authFetch('/api/monthly-dues/remind-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.userId,
          force: true,
          customMessage: customNote?.trim() || undefined,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.details || result.error || 'Failed to send individual dues reminder email.');
      }

      setFeedback({
        type: 'success',
        message: `Personal unpaid dues reminder successfully sent to ${member.fullName} (${member.email})! Outstanding: ₱${member.totalUnpaidAmount.toFixed(2)}.`,
      });

      setSelectedMemberForReminder(null);
      setShowIndividualPreviewModal(false);
      setIndividualCustomNote('');
      await fetchData();
    } catch (err: any) {
      console.error('Failed to send individual reminder:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to send individual reminder email.',
      });
    } finally {
      setSendingUserId(null);
    }
  };


  // Toggle individual member reminder (Enable / Disable)
  const handleToggleMemberReminder = async (member: MemberUnpaidSummary, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isCurrentlyDisabled = disabledMemberIds.includes(member.userId);
    const newEnabled = isCurrentlyDisabled; // if currently disabled, new state will be enabled (not in disabledMemberIds)
    setTogglingMemberId(member.userId);

    // Optimistic update
    setDisabledMemberIds((prev) =>
      newEnabled ? prev.filter((id) => id !== member.userId) : [...prev, member.userId]
    );

    try {
      const res = await authFetch("/api/monthly-dues/individual-reminders/member-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, enabled: newEnabled }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success && Array.isArray(result.disabledUserIds)) {
        setDisabledMemberIds(result.disabledUserIds);
      }
      setFeedback({
        type: "success",
        message: newEnabled
          ? `Individual dues reminders ENABLED for ${member.fullName || member.username}.`
          : `Individual dues reminders DISABLED/MUTED for ${member.fullName || member.username}. They will not receive automated reminders.`,
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      console.error("Failed to toggle member reminder:", err);
      // Revert
      setDisabledMemberIds((prev) =>
        isCurrentlyDisabled ? [...prev, member.userId] : prev.filter((id) => id !== member.userId)
      );
      setFeedback({
        type: "error",
        message: "Failed to update reminder toggle for this member.",
      });
    } finally {
      setTogglingMemberId(null);
    }
  };

  // Send Individual Reminders to ALL Unpaid Members Batch
  const handleSendBatchIndividualReminders = async () => {
    if (unpaidMembers.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to send individual, personalized unpaid dues reminder emails to all ${unpaidMembers.length} member(s) with unsettled dues?`
      )
    ) {
      return;
    }

    setFeedback(null);
    setIsSendingIndividual(true);

    try {
      const response = await authFetch('/api/monthly-dues/remind-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          force: true,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.details || result.error || 'Failed to dispatch individual reminders batch.');
      }

      setFeedback({
        type: 'success',
        message: `Personalized unpaid dues reminder emails successfully sent to ${result.totalSent} member(s)!`,
      });

      await fetchData();
    } catch (err: any) {
      console.error('Failed to send batch individual reminders:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to send batch individual reminder emails.',
      });
    } finally {
      setIsSendingIndividual(false);
    }
  };

  // Active and Muted lists
  const activeUnpaidMembers = useMemo(() => {
    return unpaidMembers.filter((m) => !disabledMemberIds.includes(m.userId));
  }, [unpaidMembers, disabledMemberIds]);

  const mutedUnpaidMembers = useMemo(() => {
    return unpaidMembers.filter((m) => disabledMemberIds.includes(m.userId));
  }, [unpaidMembers, disabledMemberIds]);

  // Filter unpaid members by search and status
  const filteredUnpaidMembers = useMemo(() => {
    let list = unpaidMembers;
    if (filterReminderStatus === "active") {
      list = activeUnpaidMembers;
    } else if (filterReminderStatus === "muted") {
      list = mutedUnpaidMembers;
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [unpaidMembers, activeUnpaidMembers, mutedUnpaidMembers, filterReminderStatus, searchQuery]);

  const totalUnpaidBalance = useMemo(() => {
    return unpaidMembers.reduce((sum, m) => sum + m.totalUnpaidAmount, 0);
  }, [unpaidMembers]);

  // Previews
  const broadcastPreview = generateMonthlyDueEmailContent({
    month: activeDue.month,
    year: Number(activeDue.year) || gmt8.year,
    amount: Number(activeDue.amount) || 150,
    title: activeDue.title,
    notes: customBroadcastNotes.trim() || activeDue.notes,
  });

  const previewMember = selectedMemberForReminder || unpaidMembers[0] || {
    userId: 'sample',
    username: 'brother_rider',
    fullName: 'Bro. Christian Rider',
    email: 'rider@example.com',
    unpaidDues: [
      { month: 'July', year: 2026, amount: 150, title: 'July 2026 Monthly Due' },
      { month: 'August', year: 2026, amount: 150, title: 'August 2026 Monthly Due' },
      { month: 'September', year: 2026, amount: 150, title: 'September 2026 Monthly Due' },
    ],
    totalUnpaidAmount: 450,
    unpaidCount: 3,
  };

  const individualPreview = generateIndividualDueReminderEmailContent({
    memberName: previewMember.fullName || previewMember.username,
    memberEmail: previewMember.email,
    unpaidDues: previewMember.unpaidDues,
    customMessage: individualCustomNote.trim() || undefined,
  });

  return (
    <div id="monthly-due-broadcast-settings-card" className="bg-white rounded-2xl border border-[#e2ece2] shadow-xs overflow-hidden">
      {/* Top Header */}
      <div className="p-4 sm:p-6 border-b border-[#e2ece2] bg-gradient-to-r from-[#f7f9f7] to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0 border border-[#b7e4c7]">
              <Coins className="w-5 h-5 text-[#2d6a4f]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-[#1b4332]">
                  Monthly Dues Email Reminders &amp; Broadcasts
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Resend Integrated
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#4b5563] mt-0.5">
                Manage automated broadcast notices when new dues are scheduled, and send personalized individual reminder emails to members who have remaining unsettled monthly dues.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isRefreshing}
            onClick={fetchData}
            className="self-end sm:self-center px-3 py-1.5 rounded-xl border border-[#e2ece2] bg-white hover:bg-[#f7f9f7] text-[#1b4332] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="flex-1">{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Sub-Tabs Button Group */}
        <div className="mt-4 sm:mt-5 pt-3 border-t border-[#e2ece2] w-full py-0.5">
          <div
            role="group"
            aria-label="Monthly Due Reminder Tabs"
            className="grid grid-cols-2 p-1 bg-[#eaefe9] rounded-xl border border-[#d6e2d7] w-full sm:max-w-xs"
          >
            <button
              type="button"
              onClick={() => setActiveTab('individual')}
              className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                activeTab === 'individual'
                  ? 'bg-[#1b4332] text-white shadow-xs'
                  : 'text-[#2d6a4f] hover:text-[#1b4332] hover:bg-white/60'
              }`}
            >
              <UserX className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'individual' ? 'text-[#74c69d]' : 'text-[#2d6a4f]'}`} />
              <span className="truncate">Individual</span>
              {unpaidMembers.length > 0 && (
                <span
                  className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-black shrink-0 ${
                    activeTab === 'individual'
                      ? 'bg-amber-400 text-amber-950'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {unpaidMembers.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('broadcast')}
              className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                activeTab === 'broadcast'
                  ? 'bg-[#1b4332] text-white shadow-xs'
                  : 'text-[#2d6a4f] hover:text-[#1b4332] hover:bg-white/60'
              }`}
            >
              <Send className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'broadcast' ? 'text-[#74c69d]' : 'text-[#2d6a4f]'}`} />
              <span className="truncate">Broadcast</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: INDIVIDUAL UNPAID DUES REMINDERS */}
      {activeTab === 'individual' && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Master Toggle & Overview */}
          <div className="p-4 rounded-2xl bg-[#fafdfa] border border-[#e2ece2] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1b4332]">
                  Automated Monthly Individual Reminders
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isIndividualEnabled
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                  }`}
                >
                  {isIndividualEnabled ? 'Active (Once a Month)' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-[#52605d]">
                When enabled, the server automatically checks on a monthly cycle and sends a personal reminder email with itemized unpaid dues to members with remaining balances.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isIndividualEnabled}
                  onChange={(e) => handleToggleIndividual(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d6a4f]"></div>
              </label>
              <span className="text-xs font-bold text-[#1b4332]">
                {isIndividualEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
              <div>
                <span className="text-[10.5px] font-bold text-amber-900 uppercase tracking-wider block">
                  Members with Unpaid Dues
                </span>
                <div className="text-lg sm:text-xl font-black text-amber-950 mt-0.5">
                  {unpaidMembers.length} {unpaidMembers.length === 1 ? 'Member' : 'Members'}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center font-black text-sm">
                {unpaidMembers.length}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between">
              <div>
                <span className="text-[10.5px] font-bold text-rose-900 uppercase tracking-wider block">
                  Total Outstanding Balance
                </span>
                <div className="text-lg sm:text-xl font-black text-rose-950 mt-0.5">
                  ₱{totalUnpaidBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-rose-200/80 text-rose-900 flex items-center justify-center font-bold text-xs">
                ₱
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-[10.5px] font-bold text-emerald-900 uppercase tracking-wider block">
                  Reminders Sent This Cycle
                </span>
                <div className="text-lg sm:text-xl font-black text-emerald-950 mt-0.5">
                  {individualLogs.filter((l) => l.status === 'delivered').length} Delivered
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-200/80 text-emerald-900 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              </div>
            </div>
          </div>

          {/* Unpaid Members Roster & Search Bar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#2d6a4f]" />
                <h4 className="text-xs sm:text-sm font-black text-[#1b4332] uppercase tracking-wider">
                  Members Requiring Dues Reminders
                </h4>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by member name..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[#f8faf8] border border-[#e2ece2] rounded-xl text-xs text-[#2d3a3a] focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isSendingIndividual || unpaidMembers.length === 0}
                  onClick={handleSendBatchIndividualReminders}
                  className="px-3.5 py-1.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                  title="Send individual emails to all members with unpaid dues"
                >
                  {isSendingIndividual ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Batch...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-[#74c69d]" />
                      <span>Remind All ({unpaidMembers.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterReminderStatus('all')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10.5px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  filterReminderStatus === 'all'
                    ? 'bg-[#1b4332] text-white'
                    : 'bg-[#f0f4f0] hover:bg-[#e2ece2] text-[#2d3a3a]'
                }`}
              >
                All Unpaid ({unpaidMembers.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterReminderStatus('active')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10.5px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  filterReminderStatus === 'active'
                    ? 'bg-[#2d6a4f] text-white'
                    : 'bg-[#f0f4f0] hover:bg-[#e2ece2] text-[#2d3a3a]'
                }`}
              >
                Active ({activeUnpaidMembers.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterReminderStatus('muted')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10.5px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  filterReminderStatus === 'muted'
                    ? 'bg-amber-800 text-white'
                    : 'bg-[#f0f4f0] hover:bg-[#e2ece2] text-[#2d3a3a]'
                }`}
              >
                Disabled ({mutedUnpaidMembers.length})
              </button>
            </div>

            {isLoadingUnpaid ? (
              <div className="p-8 text-center bg-[#f8faf8] rounded-2xl border border-[#e2ece2] space-y-2">
                <RefreshCw className="w-5 h-5 text-[#2d6a4f] animate-spin mx-auto" />
                <p className="text-xs text-[#52605d] font-semibold">Calculating member unpaid monthly dues...</p>
              </div>
            ) : filteredUnpaidMembers.length === 0 ? (
              <div className="p-8 text-center bg-[#f8faf8] rounded-2xl border border-[#e2ece2] space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h5 className="text-sm font-black text-[#1b4332]">All Clear! No Unpaid Dues Found</h5>
                <p className="text-xs text-[#52605d] max-w-md mx-auto">
                  {searchQuery
                    ? `No unpaid members matching "${searchQuery}".`
                    : 'All active approved members are currently updated with their monthly dues payments.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#e2ece2] shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f7f9f7] text-[#1b4332] font-black border-b border-[#e2ece2]">
                    <tr>
                      <th className="p-3">Member Details</th>
                      <th className="p-3">Unpaid Monthly Dues</th>
                      <th className="p-3">Total Balance</th>
                      <th className="p-3">Reminder Toggle</th>
                      <th className="p-3">Last Reminded</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2ece2] bg-white">
                    {filteredUnpaidMembers.map((member) => {
                      const isSendingThis = sendingUserId === member.userId;
                      const hasValidEmail = Boolean(member.email && member.email.includes('@'));
                      const isMuted = disabledMemberIds.includes(member.userId);
                      const isToggling = togglingMemberId === member.userId;

                      return (
                        <tr key={member.userId} className={`hover:bg-[#fcfdfc] transition-colors ${isMuted ? 'bg-neutral-50/50' : ''}`}>
                          {/* Member Info */}
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#1b4332] text-white flex items-center justify-center font-extrabold text-[11px] shrink-0 shadow-2xs">
                                {member.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-[#1b4332] text-xs">
                                    {member.fullName}
                                  </span>
                                  {isMuted && (
                                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-sm bg-neutral-200 text-neutral-700">
                                      Disabled
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10.5px] text-[#52605d] truncate">
                                  @{member.username} • {member.email || 'No email registered'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Unpaid Months Badges */}
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1 max-w-sm">
                              {member.unpaidDues.map((due, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10.5px] font-bold"
                                >
                                  <span>{due.month} {due.year}</span>
                                  <span className="text-amber-700 font-extrabold">₱{Number(due.amount).toFixed(0)}</span>
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Total Outstanding Balance */}
                          <td className="p-3 whitespace-nowrap">
                            <div className="text-xs font-black text-rose-700">
                              ₱{member.totalUnpaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[9.5px] text-[#52605d]">
                              {member.unpaidCount} unpaid {member.unpaidCount === 1 ? 'month' : 'months'}
                            </div>
                          </td>

                          {/* Individual Reminder Toggle Button */}
                          <td className="p-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isToggling}
                                onClick={(e) => handleToggleMemberReminder(member, e)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                                  isMuted ? 'bg-neutral-300' : 'bg-[#2d6a4f]'
                                }`}
                                title={isMuted ? `Enable reminders for ${member.fullName}` : `Disable reminders for ${member.fullName}`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                    isMuted ? 'translate-x-0' : 'translate-x-4'
                                  }`}
                                />
                              </button>
                              <span
                                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                                  isMuted
                                    ? 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {isMuted ? 'Disabled' : 'Active'}
                              </span>
                            </div>
                          </td>

                          {/* Last Reminded Status */}
                          <td className="p-3 whitespace-nowrap">
                            {member.lastReminderSentAt ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Reminded</span>
                                </span>
                                <div className="text-[9px] text-[#6b7280]">
                                  {new Date(member.lastReminderSentAt).toLocaleDateString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10.5px] text-stone-500 italic bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-md">
                                Not reminded yet
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMemberForReminder(member);
                                  setShowIndividualPreviewModal(true);
                                }}
                                className="px-2 py-1 rounded-lg border border-[#e2ece2] hover:bg-[#f0f9f1] text-[#1b4332] text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                title="Preview email before sending"
                              >
                                <Eye className="w-3 h-3 text-[#2d6a4f]" />
                                <span>Preview</span>
                              </button>

                              <button
                                type="button"
                                disabled={isSendingThis || !hasValidEmail}
                                onClick={() => handleSendSingleIndividualReminder(member)}
                                className="px-2.5 py-1 rounded-lg bg-[#2d6a4f] hover:bg-[#1b4332] text-white text-[11px] font-extrabold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                                title={hasValidEmail ? 'Send individual reminder email now' : 'Cannot send: No email registered'}
                              >
                                {isSendingThis ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Sending...</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3 h-3 text-[#74c69d]" />
                                    <span>Remind</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Individual Reminder Logs Table */}
          <div className="pt-5 border-t border-[#e2ece2]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#2d6a4f]" />
                <h4 className="text-xs sm:text-sm font-black text-[#1b4332] uppercase tracking-wider">
                  Recent Individual Dues Reminder Delivery Audit Logs
                </h4>
              </div>
            </div>

            {individualLogs.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#6b7280] bg-[#f8faf8] rounded-xl border border-[#e2ece2]">
                No individual dues reminder emails recorded yet. Sent reminders will appear here in real-time.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#e2ece2]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f7f9f7] text-[#1b4332] font-bold border-b border-[#e2ece2]">
                    <tr>
                      <th className="p-2.5 sm:p-3">Recipient</th>
                      <th className="p-2.5 sm:p-3">Unpaid Dues Summary</th>
                      <th className="p-2.5 sm:p-3">Total Balance</th>
                      <th className="p-2.5 sm:p-3">Trigger Type</th>
                      <th className="p-2.5 sm:p-3">Sent At</th>
                      <th className="p-2.5 sm:p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2ece2] bg-white">
                    {individualLogs.slice(0, 10).map((l) => (
                      <tr key={l.id} className="hover:bg-[#fcfdfc]">
                        <td className="p-2.5 sm:p-3">
                          <div className="font-bold text-[#1b4332]">{l.fullName}</div>
                          <div className="text-[10px] text-[#6b7280]">{l.recipientEmail}</div>
                        </td>
                        <td className="p-2.5 sm:p-3 text-[#2d3a3a]">
                          <div className="text-[11px] font-semibold">{l.unpaidDuesCount} unpaid month(s)</div>
                          <div className="text-[9.5px] text-[#52605d] truncate max-w-xs">
                            {Array.isArray(l.unpaidDuesSummary) ? l.unpaidDuesSummary.join(', ') : ''}
                          </div>
                        </td>
                        <td className="p-2.5 sm:p-3 font-extrabold text-rose-700">
                          ₱{Number(l.totalAmountDue || 0).toFixed(2)}
                        </td>
                        <td className="p-2.5 sm:p-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                            {l.triggerType === 'manual_single' ? 'Single Send' : l.triggerType === 'manual_batch' ? 'Batch Send' : 'Auto Cycle'}
                          </span>
                        </td>
                        <td className="p-2.5 sm:p-3 text-[#6b7280]">
                          {l.sentDate} {l.sentAt ? new Date(l.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </td>
                        <td className="p-2.5 sm:p-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              l.status === 'delivered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {l.status === 'delivered' ? (
                              <>
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Delivered</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-2.5 h-2.5" />
                                <span>{l.status}</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GENERAL BROADCAST (ALL MEMBERS) */}
      {activeTab === 'broadcast' && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* Master Toggle Banner */}
          <div className="p-4 rounded-2xl bg-[#fafdfa] border border-[#e2ece2] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1b4332]">
                  Automated New Dues Broadcasts
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isBroadcastEnabled
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                  }`}
                >
                  {isBroadcastEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-[#52605d]">
                Automatically dispatches an announcement email to all approved members whenever a new monthly due is created, including a reminder to settle previous months once a month.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBroadcastEnabled}
                  onChange={(e) => handleToggleBroadcast(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d6a4f]"></div>
              </label>
              <span className="text-xs font-bold text-[#1b4332]">
                {isBroadcastEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Recipient info banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0]">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-[#2d6a4f]" />
              <span className="text-xs sm:text-sm font-semibold text-[#1b4332]">
                Broadcast Audience: {eligibleRecipients.length} Approved Club Member(s)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#2d6a4f]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Invokes Christian fellowship &amp; reminders on past dues</span>
            </div>
          </div>

          {/* Select Target Monthly Due */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2d3a3a] mb-1.5 uppercase tracking-wide">
                Target Monthly Due for Broadcast
              </label>
              {monthlyDues.length > 0 ? (
                <select
                  value={selectedDueId || activeDue.id}
                  onChange={(e) => setSelectedDueId(e.target.value)}
                  className="w-full bg-[#f8faf8] border border-[#e2ece2] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#1b4332] focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f]"
                >
                  {monthlyDues.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.month} {d.year} — PHP {Number(d.amount).toFixed(2)} ({d.title || 'Monthly Due'})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-[#6b7280] italic bg-[#f8faf8] border border-[#e2ece2] rounded-xl p-2.5">
                  {activeDue.month} {activeDue.year} — PHP {Number(activeDue.amount).toFixed(2)} (Active Auto-Detected)
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2d3a3a] mb-1.5 uppercase tracking-wide">
                Custom Remittance / Advisory Note (Optional)
              </label>
              <input
                type="text"
                value={customBroadcastNotes}
                onChange={(e) => setCustomBroadcastNotes(e.target.value)}
                placeholder="e.g. Please send GCash ref# to Sis Joy (0917-xxx-xxxx)"
                className="w-full bg-[#f8faf8] border border-[#e2ece2] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2d3a3a] focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f]"
              />
            </div>
          </div>

          {/* Actions Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowBroadcastPreview(!showBroadcastPreview)}
              className="flex items-center gap-1.5 text-xs font-bold text-[#2d6a4f] hover:text-[#1b4332] transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showBroadcastPreview ? 'Hide Message Preview' : 'Preview Broadcast Message'}</span>
              {showBroadcastPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSendingBroadcast}
                onClick={() => handleSendBroadcast(true)}
                className="px-3.5 py-2 rounded-xl border border-[#b7e4c7] bg-[#f0fdf4] hover:bg-[#d8f3dc] text-[#1b4332] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Send Test Broadcast
              </button>
              <button
                type="button"
                disabled={isSendingBroadcast || eligibleRecipients.length === 0}
                onClick={() => handleSendBroadcast(false)}
                className="px-4 py-2 rounded-xl bg-[#2d6a4f] hover:bg-[#1b4332] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSendingBroadcast ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Broadcast...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Monthly Dues Broadcast Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Message Preview */}
          {showBroadcastPreview && (
            <div className="mt-4 p-4 rounded-xl border border-[#bbf7d0] bg-[#fdfefe] space-y-3">
              <div className="flex items-center justify-between border-b border-[#e2ece2] pb-2">
                <span className="text-xs font-bold text-[#1b4332] uppercase tracking-wider">
                  Official Broadcast Email Preview
                </span>
                <span className="text-[11px] text-[#6b7280]">
                  Subject: <span className="font-semibold text-[#1b4332]">{broadcastPreview.subject}</span>
                </span>
              </div>
              <div
                className="text-xs text-[#374151] rounded-lg p-3 bg-white border border-[#e5e7eb] max-h-72 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: broadcastPreview.html }}
              />
            </div>
          )}

          {/* Recent Broadcast History */}
          <div className="mt-6 pt-5 border-t border-[#e2ece2]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#2d6a4f]" />
                <h4 className="text-xs sm:text-sm font-bold text-[#1b4332] uppercase tracking-wider">
                  Recent Monthly Dues Broadcast History
                </h4>
              </div>
            </div>

            {broadcastLogs.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#6b7280] bg-[#f8faf8] rounded-xl border border-[#e2ece2]">
                No monthly dues broadcast records logged yet. New broadcasts sent upon dues creation or reminders will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#e2ece2]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f7f9f7] text-[#1b4332] font-bold border-b border-[#e2ece2]">
                    <tr>
                      <th className="p-2.5 sm:p-3">Covered Period</th>
                      <th className="p-2.5 sm:p-3">Amount</th>
                      <th className="p-2.5 sm:p-3">Recipients</th>
                      <th className="p-2.5 sm:p-3">Type</th>
                      <th className="p-2.5 sm:p-3">Sent Date / Time</th>
                      <th className="p-2.5 sm:p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2ece2] bg-white">
                    {broadcastLogs.slice(0, 10).map((l) => (
                      <tr key={l.id} className="hover:bg-[#fcfdfc]">
                        <td className="p-2.5 sm:p-3 font-semibold text-[#1b4332]">
                          {l.sentMonthYear || `${l.month} ${l.year}`}
                        </td>
                        <td className="p-2.5 sm:p-3 text-[#2d3a3a] font-medium">
                          PHP {Number(l.amount || 150).toFixed(2)}
                        </td>
                        <td className="p-2.5 sm:p-3 text-[#4b5563]">
                          {l.recipientCount} members
                        </td>
                        <td className="p-2.5 sm:p-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                            {l.triggerType || 'Broadcast'}
                          </span>
                        </td>
                        <td className="p-2.5 sm:p-3 text-[#6b7280]">
                          {l.sentDate} {l.sentAt ? new Date(l.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </td>
                        <td className="p-2.5 sm:p-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              l.status === 'delivered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {l.status === 'delivered' ? (
                              <>
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Sent</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-2.5 h-2.5" />
                                <span>{l.status}</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: INDIVIDUAL REMINDER PREVIEW & SEND */}
      {showIndividualPreviewModal && selectedMemberForReminder && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85dvh] shadow-2xl border border-[#e2ece2] relative flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-[#e2ece2] bg-[#f7f9f7] flex items-center justify-between shrink-0">
              <div>
                <h4 className="text-sm font-black text-[#1b4332] flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-[#2d6a4f]" />
                  <span>Send Personal Dues Reminder to {selectedMemberForReminder.fullName}</span>
                </h4>
                <p className="text-[11px] text-[#52605d]">
                  Recipient: {selectedMemberForReminder.email || 'No email'} • Outstanding: ₱{selectedMemberForReminder.totalUnpaidAmount.toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowIndividualPreviewModal(false);
                  setSelectedMemberForReminder(null);
                }}
                className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 text-xs">
              {/* Optional Custom Note input */}
              <div>
                <label className="block text-[11px] font-bold text-[#1b4332] mb-1">
                  Optional Note from Club Leadership / Treasurer
                </label>
                <input
                  type="text"
                  value={individualCustomNote}
                  onChange={(e) => setIndividualCustomNote(e.target.value)}
                  placeholder="e.g. Please PM Sis Joy on Messenger or GCash to 0917-xxx-xxxx"
                  className="w-full bg-[#f8faf8] border border-[#e2ece2] rounded-xl px-3 py-2 text-xs text-[#2d3a3a] focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f]"
                />
              </div>

              {/* Rendered Email Preview */}
              <div className="border border-[#e2ece2] rounded-xl overflow-hidden">
                <div className="bg-[#f0f9f1] px-3 py-1.5 border-b border-[#e2ece2] flex items-center justify-between text-[11px] font-bold text-[#1b4332]">
                  <span>Email Content Preview</span>
                  <span className="text-[10px] text-[#52605d]">{individualPreview.subject}</span>
                </div>
                <div
                  className="p-3 bg-white max-h-64 overflow-y-auto text-xs"
                  dangerouslySetInnerHTML={{ __html: individualPreview.html }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-3.5 border-t border-[#e2ece2] bg-[#fafcfa] flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowIndividualPreviewModal(false);
                  setSelectedMemberForReminder(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(sendingUserId) || !selectedMemberForReminder.email}
                onClick={() => handleSendSingleIndividualReminder(selectedMemberForReminder, individualCustomNote)}
                className="px-4 py-1.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {sendingUserId === selectedMemberForReminder.userId ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching Email...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-[#74c69d]" />
                    <span>Send Reminder to {selectedMemberForReminder.fullName.split(' ')[0]}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
