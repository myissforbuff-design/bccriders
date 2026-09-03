import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  Users,
  User,
  ChevronDown,
  RefreshCw,
  Eye,
  Info,
  Check,
  FileText,
  MailCheck,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  Mail,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authFetch, store, safeFetchJson } from '../lib/db';
import { OutboundEmail, User as UserType } from '../types';
import { ModalPortal } from './ModalPortal';
import { OfficialLoader } from './OfficialLoader';

interface EmailSenderProps {
  onEmailSent?: () => void;
  members?: UserType[];
}

export const EmailSender: React.FC<EmailSenderProps> = ({ onEmailSent, members: initialPropMembers }) => {
  const { currentUser, isAdmin } = useAuth();

  // Form State
  const [recipientMode, setRecipientMode] = useState<'custom' | 'member' | 'all_members'>('custom');
  const [toInput, setToInput] = useState('');
  const [selectedMemberEmail, setSelectedMemberEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [fromAddress, setFromAddress] = useState('BCC Riders Club <info@bccriders.cc>');
  const [replyTo, setReplyTo] = useState('contact@bccriders.cc');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');

  // Interactive Member Dropdown State
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const memberDropdownRef = useRef<HTMLDivElement>(null);
  const memberSearchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(event.target as Node)) {
        setIsMemberDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMemberDropdownOpen) {
        setIsMemberDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMemberDropdownOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isMemberDropdownOpen) {
      setTimeout(() => {
        memberSearchInputRef.current?.focus();
      }, 60);
    }
  }, [isMemberDropdownOpen]);

  // Status & Feedback State
  const [isSending, setIsSending] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Outbox history
  const [outboxList, setOutboxList] = useState<OutboundEmail[]>([]);
  const [isLoadingOutbox, setIsLoadingOutbox] = useState(false);
  const [selectedSentEmail, setSelectedSentEmail] = useState<OutboundEmail | null>(null);
  const [outboxPage, setOutboxPage] = useState<number>(1);
  const outboxItemsPerPage = 10;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingOutbox, setIsDeletingOutbox] = useState(false);
  const [outboxItemToDelete, setOutboxItemToDelete] = useState<OutboundEmail | null>(null);
  const [showConfirmSendModal, setShowConfirmSendModal] = useState(false);

  const totalOutboxPages = Math.max(1, Math.ceil(outboxList.length / outboxItemsPerPage));
  const validOutboxPage = Math.min(Math.max(1, outboxPage), totalOutboxPages);
  const paginatedOutbox = outboxList.slice(
    (validOutboxPage - 1) * outboxItemsPerPage,
    validOutboxPage * outboxItemsPerPage
  );

  const handleOpenDeleteOutboxModal = (e: React.MouseEvent, item: OutboundEmail) => {
    e.stopPropagation();
    setOutboxItemToDelete(item);
  };

  const handleConfirmDeleteOutbox = async () => {
    if (!outboxItemToDelete) return;
    const targetItem = outboxItemToDelete;
    const id = targetItem.id;
    
    // Close confirm modal immediately and activate full loader
    setOutboxItemToDelete(null);
    setDeletingId(id);
    setIsDeletingOutbox(true);

    try {
      const res = await authFetch(`/api/emails/outbox/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setOutboxList((prev) => prev.filter((item) => item.id !== id));
        // Return / close details modal if open
        if (selectedSentEmail?.id === id) {
          setSelectedSentEmail(null);
        }
        setStatusFeedback({
          type: 'info',
          message: 'Sent message record deleted successfully from outbox.',
        });
      } else {
        setStatusFeedback({
          type: 'error',
          message: data.error || 'Failed to delete outbox message',
        });
      }
    } catch (err) {
      console.error('Error deleting outbox message:', err);
      setStatusFeedback({
        type: 'error',
        message: 'Failed to delete outbox message',
      });
    } finally {
      setDeletingId(null);
      setIsDeletingOutbox(false);
    }
  };

  // Helper to ensure admin accounts and admin email addresses are never included in member picker or broadcasts
  const isNonAdminApprovedMember = (m: UserType | undefined | null): boolean => {
    if (!m) return false;
    if (m.approvalStatus === 'Pending' || m.approvalStatus === 'Rejected') return false;
    if (!m.email || !m.email.includes('@')) return false;

    const role = (m.role || '').toLowerCase().trim();
    const email = (m.email || '').toLowerCase().trim();
    const username = (m.username || '').toLowerCase().trim();
    const id = (m.id || '').toLowerCase().trim();
    const name = (m.name || '').toLowerCase().trim();

    if (
      role === 'admin' ||
      role === 'administrator' ||
      id === 'usr_admin' ||
      id === 'admin' ||
      username === 'admin' ||
      email.startsWith('admin@') ||
      email.includes('admin@') ||
      email === 'admin@bccriders.org' ||
      email === 'admin@bccriders.cc' ||
      name === 'admin' ||
      name.includes('(admin)') ||
      name.toLowerCase().includes('bcc riders (admin)')
    ) {
      return false;
    }

    return true;
  };

  // Members list for quick selection - initialized immediately with local store or props (excluding admins)
  const [membersList, setMembersList] = useState<UserType[]>(() => {
    if (initialPropMembers && initialPropMembers.length > 0) {
      return initialPropMembers.filter(isNonAdminApprovedMember);
    }
    const localUsers = store.getUsers() || [];
    return localUsers.filter(isNonAdminApprovedMember);
  });

  // Quick Templates
  const EMAIL_TEMPLATES = [
    {
      title: 'Announcement / Update',
      subject: 'Official Update: Upcoming BCC Riders Club Ride & Meeting',
      body: `Dear Riders,\n\nWe would like to share an important update regarding our upcoming weekend club ride and assembly.\n\nAssembly Point: Clubhouse Grounds\nDate & Time: Saturday, 6:00 AM\n\nPlease ensure your safety gear and motorcycle inspections are up to date.\n\nRide safe and see you there!\n\nBest regards,\nBCC Riders Club Team`,
    },
    {
      title: 'Membership Approval Notice',
      subject: 'Welcome to BCC Riders Club - Membership Confirmed',
      body: `Dear Member,\n\nWelcome to the brotherhood of BCC Riders Club! Your membership registration has been officially approved.\n\nYou can now log in to your official rider portal, access your member QR card, and track rides and club activities.\n\nRide with passion, ride with honor!\n\nBCC Riders Club Executive Board`,
    },
    {
      title: 'Monthly Dues Reminder',
      subject: 'Reminder: Monthly Club Dues Contribution',
      body: `Greetings Brother/Sister,\n\nThis is a friendly reminder regarding your club dues for this period. Your contributions go directly towards our community rides, charity drives, and road safety initiatives.\n\nYou may settle your dues conveniently through your portal dashboard.\n\nThank you for your continuous support!\n\nBCC Treasury Office`,
    },
  ];

  // Synchronize members list when initialPropMembers prop changes
  useEffect(() => {
    if (initialPropMembers && initialPropMembers.length > 0) {
      const validProps = initialPropMembers.filter(isNonAdminApprovedMember);
      setMembersList((prev) => {
        if (
          prev.length === validProps.length &&
          prev.every((m, idx) => m.id === validProps[idx]?.id)
        ) {
          return prev;
        }
        return validProps;
      });
    }
  }, [initialPropMembers]);

  // Initial mount hydration and real-time event listener
  useEffect(() => {
    // 1. If we don't have members from props, hydrate from local store
    if (!initialPropMembers || initialPropMembers.length === 0) {
      const local = store.getUsers() || [];
      const validLocal = local.filter(isNonAdminApprovedMember);
      if (validLocal.length > 0) {
        setMembersList((prev) => (prev.length === 0 ? validLocal : prev));
      } else {
        // Fallback single silent fetch if store is completely empty on mount
        safeFetchJson('/api/mongodb/members')
          .then((res) => {
            if (res.success && Array.isArray(res.data) && res.data.length > 0) {
              const validRemote = res.data.filter(isNonAdminApprovedMember);
              if (validRemote.length > 0) {
                setMembersList(validRemote);
              }
            }
          })
          .catch(() => {});
      }
    }

    // 2. Listen to real-time member updates
    const handleUsersUpdated = (e: Event) => {
      const updated = ((e as CustomEvent).detail || store.getUsers()) as UserType[];
      if (Array.isArray(updated)) {
        const valid = updated.filter(isNonAdminApprovedMember);
        if (valid.length > 0) {
          setMembersList((prev) => {
            if (
              prev.length === valid.length &&
              prev.every((m, idx) => m.id === valid[idx]?.id)
            ) {
              return prev;
            }
            return valid;
          });
        }
      }
    };

    window.addEventListener('bcc_users_updated', handleUsersUpdated);
    return () => window.removeEventListener('bcc_users_updated', handleUsersUpdated);
  }, []);

  // Filtered members for interactive search dropdown
  const filteredMembers = useMemo(() => {
    if (!memberSearchQuery.trim()) return membersList;
    const q = memberSearchQuery.toLowerCase().trim();
    return membersList.filter((m) => {
      const name = (m.name || '').toLowerCase();
      const username = (m.username || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      const memberNo = (m.memberNumber || '').toLowerCase();
      const role = (m.role || '').toLowerCase();
      const chapter = (m.chapter || '').toLowerCase();
      const phone = (m.phone || m.mobileNo || '').toLowerCase();
      return (
        name.includes(q) ||
        username.includes(q) ||
        email.includes(q) ||
        memberNo.includes(q) ||
        role.includes(q) ||
        chapter.includes(q) ||
        phone.includes(q)
      );
    });
  }, [membersList, memberSearchQuery]);

  const selectedMemberObj = useMemo(() => {
    return membersList.find((m) => m.email?.toLowerCase() === selectedMemberEmail.toLowerCase());
  }, [membersList, selectedMemberEmail]);

  // Fetch sent emails outbox
  const fetchOutbox = async () => {
    setIsLoadingOutbox(true);
    try {
      const res = await authFetch('/api/emails/outbox');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setOutboxList(data.data);
      }
    } catch (err) {
      console.warn('Could not load outbox:', err);
    } finally {
      setIsLoadingOutbox(false);
    }
  };

  useEffect(() => {
    fetchOutbox();
  }, []);

  const handleApplyTemplate = (template: { subject: string; body: string }) => {
    setSubject(template.subject);
    setBody(template.body);
  };

  const [pendingRecipients, setPendingRecipients] = useState<string[]>([]);

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusFeedback(null);

    let targetRecipients: string[] = [];

    if (recipientMode === 'custom') {
      targetRecipients = toInput
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter((s) => s.includes('@'));
      if (targetRecipients.length === 0) {
        setStatusFeedback({
          type: 'error',
          message: 'Please provide at least one valid recipient email address.',
        });
        return;
      }
    } else if (recipientMode === 'member') {
      if (!selectedMemberEmail || !selectedMemberEmail.includes('@')) {
        setStatusFeedback({
          type: 'error',
          message: 'Please select a registered club member.',
        });
        return;
      }
      const matchedMember = membersList.find(
        (m) => (m.email || '').toLowerCase() === selectedMemberEmail.toLowerCase()
      );
      if (!matchedMember || !isNonAdminApprovedMember(matchedMember)) {
        setStatusFeedback({
          type: 'error',
          message: 'Admin email addresses cannot be selected as recipient.',
        });
        return;
      }
      targetRecipients = [selectedMemberEmail];
    } else if (recipientMode === 'all_members') {
      targetRecipients = membersList
        .filter(isNonAdminApprovedMember)
        .map((m) => (m.email || '').trim())
        .filter((e) => e && e.includes('@'));
      if (targetRecipients.length === 0) {
        setStatusFeedback({
          type: 'error',
          message: 'No registered member email addresses found in the database.',
        });
        return;
      }
    }

    if (!subject.trim()) {
      setStatusFeedback({
        type: 'error',
        message: 'Please enter an email subject.',
      });
      return;
    }

    if (!body.trim()) {
      setStatusFeedback({
        type: 'error',
        message: 'Please enter message content in the body.',
      });
      return;
    }

    setPendingRecipients(targetRecipients);
    setShowConfirmSendModal(true);
  };

  const handleExecuteSendEmail = async () => {
    setShowConfirmSendModal(false);
    setIsSending(true);

    try {
      const res = await authFetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: pendingRecipients,
          subject: subject.trim(),
          body: body.trim(),
          from: fromAddress,
          replyTo,
          cc: ccInput ? ccInput.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : undefined,
          bcc: bccInput ? bccInput.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : undefined,
          senderName: currentUser?.name || 'Administrator',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatusFeedback({
          type: 'success',
          message: data.message || `Email sent successfully to ${pendingRecipients.length} recipient(s)!`,
        });

        // Reset inputs
        if (recipientMode === 'custom') setToInput('');
        setSubject('');
        setBody('');
        setCcInput('');
        setBccInput('');

        fetchOutbox();
        if (onEmailSent) onEmailSent();
      } else {
        setStatusFeedback({
          type: 'error',
          message: data.error || 'Failed to dispatch email via Resend API.',
        });
      }
    } catch (err: any) {
      setStatusFeedback({
        type: 'error',
        message: err.message || 'Network error occurred while attempting to send email.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Send Email Form Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-[#e2ece2] shadow-xs space-y-4">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#e2ece2]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#1b4332] text-white flex items-center justify-center shadow-xs shrink-0">
              <Send className="w-4 h-4 sm:w-5 sm:h-5 text-[#74c69d]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading text-sm sm:text-base md:text-lg font-black text-[#1b4332]">
                  Send Email via Resend
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                  Live Dispatch
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5">
                Dispatch official club notifications, dues reminders & broadcast emails
              </p>
            </div>
          </div>
        </div>

        {/* Status Toast Alert */}
        <AnimatePresence>
          {statusFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={`p-3 rounded-xl border flex items-start justify-between gap-2 text-xs font-bold ${
                statusFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : statusFeedback.type === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-blue-50 border-blue-300 text-blue-950'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                {statusFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="leading-snug break-words">{statusFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusFeedback(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer p-0.5"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Templates Bar */}
        <div className="space-y-1.5 bg-[#f7f9f7] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#e2ece2]">
          <div className="flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-extrabold text-[#1b4332]">
            <FileText className="w-3.5 h-3.5 text-[#2d6a4f]" />
            <span>Quick Email Templates</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {EMAIL_TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-[#e2ece2] text-[10px] sm:text-[11px] font-bold text-[#1b4332] transition-colors cursor-pointer shadow-2xs"
              >
                {tmpl.title}
              </button>
            ))}
          </div>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSendEmail} className="space-y-3 sm:space-y-4 text-xs">
          {/* Recipient Mode Selection */}
          <div className="space-y-1">
            <label className="text-[11px] sm:text-xs font-bold text-[#1b4332] block">
              Recipient Target <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setRecipientMode('custom')}
                className={`p-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  recipientMode === 'custom'
                    ? 'bg-[#1b4332] text-white border-[#1b4332] shadow-xs'
                    : 'bg-white hover:bg-[#f7f9f7] text-[#52605d] border-[#e2ece2]'
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Custom Email</span>
              </button>

              <button
                type="button"
                onClick={() => setRecipientMode('member')}
                className={`p-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  recipientMode === 'member'
                    ? 'bg-[#1b4332] text-white border-[#1b4332] shadow-xs'
                    : 'bg-white hover:bg-[#f7f9f7] text-[#52605d] border-[#e2ece2]'
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Select Member</span>
              </button>

              <button
                type="button"
                onClick={() => setRecipientMode('all_members')}
                className={`p-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  recipientMode === 'all_members'
                    ? 'bg-[#1b4332] text-white border-[#1b4332] shadow-xs'
                    : 'bg-white hover:bg-[#f7f9f7] text-[#52605d] border-[#e2ece2]'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Broadcast ({membersList.length})</span>
              </button>
            </div>
          </div>

          {/* Dynamic Recipient Input based on Mode */}
          {recipientMode === 'custom' && (
            <div className="space-y-1">
              <label className="text-[11px] sm:text-xs font-bold text-[#1b4332] block">
                To Email Address(es) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                placeholder="rider@example.com, chapter.lead@domain.com"
                className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-semibold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] placeholder:text-stone-400"
              />
              <p className="text-[10px] text-[#52605d]">
                Separate multiple email addresses with commas or semicolons.
              </p>
            </div>
          )}

          {recipientMode === 'member' && (
            <div className="space-y-1 relative" ref={memberDropdownRef}>
              <div className="flex items-center justify-between">
                <label className="text-[11px] sm:text-xs font-bold text-[#1b4332] block">
                  Select Registered Member <span className="text-rose-600">*</span>
                </label>
                <span className="text-[10px] text-[#52605d] font-bold">
                  {membersList.length} member{membersList.length === 1 ? '' : 's'} available
                </span>
              </div>

              <div className="relative">
                {/* Interactive Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsMemberDropdownOpen((prev) => !prev)}
                  className={`w-full text-left p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer select-none ${
                    isMemberDropdownOpen
                      ? 'bg-white border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20 shadow-xs'
                      : selectedMemberObj
                      ? 'bg-emerald-50/40 hover:bg-emerald-50 border-emerald-300/80 text-[#1b4332]'
                      : 'bg-[#f7f9f7] hover:bg-white hover:border-[#2d6a4f]/60 border-[#e2ece2] text-[#52605d]'
                  }`}
                >
                  {selectedMemberObj ? (
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Avatar / Initials */}
                      <div className="w-8 h-8 rounded-xl overflow-hidden bg-[#1b4332] text-white flex items-center justify-center font-black text-xs shrink-0 border border-emerald-700/20 shadow-2xs">
                        {selectedMemberObj.avatar ? (
                          <img
                            src={selectedMemberObj.avatar}
                            alt={selectedMemberObj.name || selectedMemberObj.username}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span>
                            {(selectedMemberObj.name || selectedMemberObj.username || 'M').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Name, Role & Email */}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-[#1b4332] truncate">
                            {selectedMemberObj.name || selectedMemberObj.username}
                          </span>
                          <span className="px-1.5 py-0.2 rounded-md text-[9px] font-extrabold bg-[#1b4332] text-white">
                            {selectedMemberObj.role || 'Member'}
                          </span>
                          {selectedMemberObj.memberNumber && (
                            <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-white text-[#2d6a4f] border border-[#c8e6c9]">
                              {selectedMemberObj.memberNumber}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10.5px] text-[#52605d] font-mono truncate">
                          <Mail className="w-3 h-3 text-[#2d6a4f] shrink-0" />
                          <span className="truncate">{selectedMemberObj.email}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 text-[#52605d]">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100/60 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-stone-700 block">
                          -- Choose Member from Roster --
                        </span>
                        <span className="text-[10px] text-[#52605d] block">
                          Search by name, callsign, member #, role or email
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions Right */}
                  <div className="flex items-center gap-1 shrink-0">
                    {selectedMemberObj && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMemberEmail('');
                        }}
                        title="Clear selection"
                        className="p-1 rounded-lg hover:bg-rose-100 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <div className={`p-1 rounded-lg transition-transform duration-200 ${isMemberDropdownOpen ? 'rotate-180 text-[#1b4332]' : 'text-[#52605d]'}`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </button>

                {/* Dropdown Popover */}
                <AnimatePresence>
                  {isMemberDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 4, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute z-50 left-0 right-0 w-full bg-white border border-[#e2ece2] rounded-2xl shadow-xl overflow-hidden flex flex-col mt-1 divide-y divide-[#f0f4f1]"
                    >
                      {/* Sticky Search Input Bar */}
                      <div className="p-2.5 bg-[#f7f9f7] sticky top-0 z-10 space-y-1.5">
                        <div className="relative flex items-center">
                          <Search className="w-4 h-4 text-[#2d6a4f] absolute left-3 pointer-events-none" />
                          <input
                            ref={memberSearchInputRef}
                            type="text"
                            value={memberSearchQuery}
                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                            placeholder="Type to search name, email, member #, role..."
                            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-[#e2ece2] text-xs font-bold text-[#1b4332] placeholder:text-stone-400 placeholder:font-normal focus:outline-none focus:border-[#2d6a4f] focus:ring-1 focus:ring-[#2d6a4f]"
                          />
                          {memberSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setMemberSearchQuery('')}
                              className="absolute right-2.5 p-1 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Search Filter Status */}
                        <div className="flex items-center justify-between text-[10px] text-[#52605d] px-1 font-semibold">
                          <span>
                            {memberSearchQuery.trim()
                              ? `Matching results: ${filteredMembers.length}`
                              : `Total active members: ${membersList.length}`}
                          </span>
                          {memberSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setMemberSearchQuery('')}
                              className="text-[#2d6a4f] hover:underline font-bold cursor-pointer"
                            >
                              Reset filter
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Members List Container */}
                      <div className="overflow-y-auto max-h-64 sm:max-h-72 p-1.5 space-y-1">
                        {filteredMembers.length === 0 ? (
                          <div className="p-6 text-center space-y-2">
                            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
                              <Search className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-[#1b4332]">No matching members found</p>
                              <p className="text-[10.5px] text-[#52605d]">
                                {memberSearchQuery.trim()
                                  ? `No members found matching "${memberSearchQuery}"`
                                  : 'No members available in the directory'}
                              </p>
                            </div>
                            {memberSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setMemberSearchQuery('')}
                                className="px-3 py-1 rounded-lg bg-[#f7f9f7] hover:bg-[#e8f5e9] border border-[#e2ece2] text-xs font-bold text-[#1b4332] transition-colors cursor-pointer inline-block"
                              >
                                Clear search query
                              </button>
                            )}
                          </div>
                        ) : (
                          filteredMembers.map((m) => {
                            const isSelected = m.email?.toLowerCase() === selectedMemberEmail?.toLowerCase();
                            return (
                              <div
                                key={m.id || m.email}
                                onClick={() => {
                                  setSelectedMemberEmail(m.email);
                                  setIsMemberDropdownOpen(false);
                                  setMemberSearchQuery('');
                                }}
                                className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-left ${
                                  isSelected
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold shadow-2xs'
                                    : 'bg-white hover:bg-[#f7f9f7] border-transparent hover:border-[#e2ece2] text-[#1b4332]'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {/* Avatar */}
                                  <div className="w-8 h-8 rounded-xl overflow-hidden bg-[#1b4332] text-white flex items-center justify-center font-black text-xs shrink-0 border border-emerald-800/20">
                                    {m.avatar ? (
                                      <img
                                        src={m.avatar}
                                        alt={m.name || m.username}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <span>{(m.name || m.username || 'M').charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>

                                  {/* Member Info */}
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-extrabold text-xs text-[#1b4332] truncate">
                                        {m.name || m.username}
                                      </span>
                                      <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        {m.role || 'Member'}
                                      </span>
                                      {m.memberNumber && (
                                        <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-[#f7f9f7] text-[#52605d] border border-[#e2ece2]">
                                          {m.memberNumber}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-[#52605d] font-mono truncate">
                                      <Mail className="w-3 h-3 text-[#2d6a4f] shrink-0" />
                                      <span className="truncate">{m.email}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Selection Checkmark */}
                                {isSelected ? (
                                  <div className="w-5 h-5 rounded-full bg-[#1b4332] text-white flex items-center justify-center shrink-0 shadow-2xs">
                                    <Check className="w-3 h-3" />
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-stone-400 font-bold hover:text-[#1b4332] shrink-0 opacity-0 group-hover:opacity-100">
                                    Select
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {recipientMode === 'all_members' && (
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1">
              <div className="flex items-center gap-1.5 font-black text-[11px]">
                <Users className="w-3.5 h-3.5 text-amber-700" />
                <span>Broadcasting to all {membersList.length} registered club members</span>
              </div>
              <p className="text-[10.5px] text-amber-900 leading-relaxed">
                This will dispatch an individual message to all verified email addresses in the MongoDB members directory.
              </p>
            </div>
          )}

          {/* Email Subject */}
          <div className="space-y-1">
            <label className="text-[11px] sm:text-xs font-bold text-[#1b4332] block">
              Email Subject <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Announcement: Official Club Ride Schedule"
              className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-semibold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] placeholder:text-stone-400"
            />
          </div>

          {/* Email Body */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] sm:text-xs font-bold text-[#1b4332] block">
                Message Content (Body) <span className="text-rose-600">*</span>
              </label>
              <span className="text-[10px] font-bold text-[#52605d]">
                {body.length} characters
              </span>
            </div>
            <textarea
              required
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your official email communication here..."
              className="w-full px-3 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-normal text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] placeholder:text-stone-400 leading-relaxed font-sans resize-y min-h-[120px]"
            />
          </div>

          {/* Advanced Options Toggle (Sender Info, CC, BCC) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[11px] text-[#2d6a4f] font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
              <span>{showAdvanced ? 'Hide Advanced Sender & Header Settings' : 'Show Advanced Sender & Header Settings (CC, BCC, From)'}</span>
            </button>

            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2.5 p-3 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2.5 overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-[#1b4332] block">From Header</label>
                    <input
                      type="text"
                      value={fromAddress}
                      onChange={(e) => setFromAddress(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e2ece2] text-xs font-mono text-[#1b4332]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-[#1b4332] block">Reply-To Address</label>
                    <input
                      type="text"
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e2ece2] text-xs font-mono text-[#1b4332]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-[#1b4332] block">CC (Carbon Copy)</label>
                    <input
                      type="text"
                      value={ccInput}
                      onChange={(e) => setCcInput(e.target.value)}
                      placeholder="treasury@bccriders.cc"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e2ece2] text-xs text-[#1b4332] placeholder:text-stone-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-[#1b4332] block">BCC (Blind Copy)</label>
                    <input
                      type="text"
                      value={bccInput}
                      onChange={(e) => setBccInput(e.target.value)}
                      placeholder="admin.archive@bccriders.cc"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e2ece2] text-xs text-[#1b4332] placeholder:text-stone-400"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Submit Action Button */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={isSending}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold text-xs text-white transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                isSending
                  ? 'bg-[#2d6a4f]/70 cursor-not-allowed'
                  : 'bg-[#1b4332] hover:bg-[#2d6a4f]'
              }`}
            >
              {isSending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
                  <span>Dispatching via Resend...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Email via Resend</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Outbox History Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-[#e2ece2] shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-[#e2ece2] gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#1b4332] shrink-0">
              <MailCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#2d6a4f]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading text-sm sm:text-base font-black text-[#1b4332]">
                  Sent Messages History (Outbox)
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[10.5px] font-black bg-[#f7f9f7] text-[#1b4332] border border-[#e2ece2]">
                  {outboxList.length}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5">
                Log of dispatched emails via Resend service
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchOutbox}
            disabled={isLoadingOutbox}
            className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#2d6a4f] ${isLoadingOutbox ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Outbox</span>
          </button>
        </div>

        {outboxList.length === 0 ? (
          <div className="p-6 sm:p-10 text-center rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-dashed border-[#e2ece2] space-y-1.5">
            <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <p className="text-xs sm:text-sm font-black text-[#1b4332]">No Outbound Emails Dispatched Yet</p>
            <p className="text-[11px] text-[#52605d] max-w-sm mx-auto">
              Emails sent using the form above will be logged here for tracking and delivery confirmation.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedOutbox.map((item) => {
                const formattedDate = new Date(item.sentAt || Date.now()).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedSentEmail(item)}
                    className="p-3 rounded-xl sm:rounded-2xl border border-[#e2ece2] hover:border-[#2d6a4f]/40 hover:bg-[#f7f9f7] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 group"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] sm:text-xs font-extrabold text-[#1b4332] truncate">
                          To: {Array.isArray(item.to) ? item.to.join(', ') : item.to}
                        </span>
                        <span className="text-[10px] text-[#52605d] shrink-0 font-medium">
                          • {formattedDate}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${
                            item.status === 'sent'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : item.status === 'simulated'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {item.status === 'sent' ? 'Delivered' : item.status === 'simulated' ? 'Dispatched' : 'Failed'}
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-stone-800 truncate">
                        {item.subject}
                      </h4>

                      {item.bodyText && (
                        <p className="text-[10.5px] sm:text-[11px] text-[#52605d] line-clamp-1">
                          {item.bodyText}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedSentEmail(item)}
                        className="p-1.5 rounded-lg sm:rounded-xl bg-white hover:bg-emerald-50 text-[#1b4332] border border-[#e2ece2] transition-colors cursor-pointer"
                        title="View Sent Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === item.id}
                        onClick={(e) => handleOpenDeleteOutboxModal(e, item)}
                        className="p-1.5 rounded-lg sm:rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete from Outbox"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalOutboxPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#e2ece2] text-xs text-[#52605d]">
                <div>
                  Showing <span className="font-extrabold text-[#1b4332]">{(validOutboxPage - 1) * outboxItemsPerPage + 1}</span> to{' '}
                  <span className="font-extrabold text-[#1b4332]">
                    {Math.min(validOutboxPage * outboxItemsPerPage, outboxList.length)}
                  </span>{' '}
                  of <span className="font-extrabold text-[#1b4332]">{outboxList.length}</span> sent emails
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={validOutboxPage === 1}
                    onClick={() => setOutboxPage((prev) => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 rounded-xl border border-[#e2ece2] bg-[#f7f9f7] hover:bg-[#e2ece2] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[#1b4332] flex items-center gap-1 transition-all cursor-pointer text-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <span className="px-3 py-1.5 rounded-xl bg-[#1b4332] text-white font-extrabold text-xs shadow-2xs">
                    {validOutboxPage} / {totalOutboxPages}
                  </span>

                  <button
                    type="button"
                    disabled={validOutboxPage === totalOutboxPages}
                    onClick={() => setOutboxPage((prev) => Math.min(prev + 1, totalOutboxPages))}
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

      {/* Sent Email Details Modal */}
      <ModalPortal>
        <AnimatePresence>
          {selectedSentEmail && (
            <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-white rounded-2xl sm:rounded-3xl max-w-sm sm:max-w-md w-full max-h-[82vh] sm:max-h-[80vh] flex flex-col overflow-hidden shadow-2xl border border-[#e2ece2] my-auto"
              >
                {/* Modal Header */}
                <div className="p-3 sm:p-3.5 border-b border-[#e2ece2] bg-[#fafcfa] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                      <Send className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-black text-[#1b4332] truncate">
                        {selectedSentEmail.subject}
                      </h3>
                      <p className="text-[9.5px] sm:text-[10px] text-[#52605d]">
                        Sent {new Date(selectedSentEmail.sentAt || Date.now()).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSentEmail(null)}
                    className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 cursor-pointer text-xs"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body - Scrollable */}
                <div className="p-3 sm:p-3.5 overflow-y-auto space-y-2.5 flex-1 min-h-0">
                  {/* Meta details */}
                  <div className="bg-[#f7f9f7] rounded-xl p-2.5 border border-[#e2ece2] space-y-1.5 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 pb-1 border-b border-[#e2ece2]">
                      <span className="text-[#52605d] font-bold text-[10px]">To:</span>
                      <span className="font-mono font-bold text-[10.5px] sm:text-[11px] text-[#1b4332] break-all">
                        {Array.isArray(selectedSentEmail.to) ? selectedSentEmail.to.join(', ') : selectedSentEmail.to}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 pb-1 border-b border-[#e2ece2]">
                      <span className="text-[#52605d] font-bold text-[10px]">From:</span>
                      <span className="font-mono text-[10.5px] sm:text-[11px] text-[#1b4332] break-all">
                        {selectedSentEmail.from}
                      </span>
                    </div>
                    {selectedSentEmail.resendId && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 pb-1 border-b border-[#e2ece2]">
                        <span className="text-[#52605d] font-bold text-[10px]">Resend Message ID:</span>
                        <span className="font-mono text-[9.5px] sm:text-[10px] text-[#52605d] truncate">
                          {selectedSentEmail.resendId}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-0.5">
                      <span className="text-[#52605d] font-bold text-[10px]">Delivery Status:</span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 capitalize">
                        {selectedSentEmail.status}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="space-y-1">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-[#52605d]">
                      Message Body
                    </span>
                    <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-[#e2ece2] text-[11px] sm:text-xs text-stone-700 leading-relaxed whitespace-pre-wrap font-sans max-h-40 sm:max-h-52 overflow-y-auto">
                      {selectedSentEmail.bodyText || selectedSentEmail.bodyHtml || '(No text body content)'}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-2.5 sm:p-3 border-t border-[#e2ece2] bg-[#fafcfa] flex items-center justify-between gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={deletingId === selectedSentEmail.id}
                    onClick={(e) => handleOpenDeleteOutboxModal(e, selectedSentEmail)}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3 text-rose-600" />
                    <span>Delete Outbox Log</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSentEmail(null)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#1b4332] text-white hover:bg-[#2d6a4f] text-[11px] font-black transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ModalPortal>

      {/* Custom Confirmation Modal: Confirm Send Official Email */}
      <ModalPortal>
        <AnimatePresence>
          {showConfirmSendModal && (
            <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-[#e2ece2] space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#1b4332] border border-emerald-200 flex items-center justify-center mx-auto">
                  <Send className="w-6 h-6 text-[#2d6a4f]" />
                </div>

                <div className="text-center space-y-1">
                  <h3 className="text-base sm:text-lg font-heading font-black text-[#1b4332]">
                    Confirm Email Dispatch
                  </h3>
                  <p className="text-xs text-[#52605d]">
                    Please verify message parameters before dispatching through Resend.
                  </p>
                </div>

                <div className="bg-[#f7f9f7] rounded-xl p-3 border border-[#e2ece2] space-y-1.5 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[#52605d] font-bold">Recipients ({pendingRecipients.length}):</span>
                    <span className="font-mono font-bold text-[#1b4332] text-right break-all">
                      {pendingRecipients.length > 2
                        ? `${pendingRecipients.slice(0, 2).join(', ')} +${pendingRecipients.length - 2} more`
                        : pendingRecipients.join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[#52605d] font-bold">Subject:</span>
                    <span className="font-bold text-stone-800 text-right truncate max-w-[220px]">
                      {subject}
                    </span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[#52605d] font-bold">From:</span>
                    <span className="text-stone-700 text-right truncate max-w-[220px]">
                      {fromAddress}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmSendModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-stone-50 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel / Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteSendEmail}
                    className="flex-1 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm & Send</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ModalPortal>

      {/* Custom Confirmation Modal: Delete Outbox Item */}
      <ModalPortal>
        <AnimatePresence>
          {outboxItemToDelete && (
            <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full p-4 sm:p-6 shadow-2xl border border-rose-200 space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6" />
                </div>

                <div className="text-center space-y-1">
                  <h3 className="text-base font-heading font-black text-rose-950">
                    Delete Outbox Record?
                  </h3>
                  <p className="text-xs text-[#52605d]">
                    Are you sure you want to permanently delete this sent message from your outbox log?
                  </p>
                </div>

                <div className="bg-[#f7f9f7] rounded-xl p-2.5 border border-[#e2ece2] text-xs space-y-1">
                  <p className="font-bold text-[#1b4332] truncate">
                    Subject: {outboxItemToDelete.subject}
                  </p>
                  <p className="text-[#52605d] text-[11px] truncate">
                    To: {Array.isArray(outboxItemToDelete.to) ? outboxItemToDelete.to.join(', ') : outboxItemToDelete.to}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOutboxItemToDelete(null)}
                    className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === outboxItemToDelete.id}
                    onClick={handleConfirmDeleteOutbox}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ModalPortal>

      {/* Outbox Deletion Official Loader */}
      <OfficialLoader isLoading={isDeletingOutbox} message="Deleting Outbox Record..." />
    </div>
  );
};
