import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../lib/db';
import { OutboundEmail, User as UserType } from '../types';

interface EmailSenderProps {
  onEmailSent?: () => void;
}

export const EmailSender: React.FC<EmailSenderProps> = ({ onEmailSent }) => {
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

  // Members list for quick selection
  const [membersList, setMembersList] = useState<UserType[]>([]);

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

  // Fetch registered members for autocomplete dropdown
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await authFetch('/api/mongodb/members');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setMembersList(data.data.filter((m: UserType) => m.email && m.email.includes('@')));
        }
      } catch (err) {
        console.warn('Could not load members for email picker:', err);
      }
    };
    fetchMembers();
  }, []);

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

  const handleSendEmail = async (e: React.FormEvent) => {
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
      targetRecipients = [selectedMemberEmail];
    } else if (recipientMode === 'all_members') {
      targetRecipients = membersList
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

    setIsSending(true);

    try {
      const res = await authFetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetRecipients,
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
          message: data.message || `Email sent successfully to ${targetRecipients.length} recipient(s)!`,
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
            <div className="space-y-1">
              <label className="text-[11px] sm:text-xs font-bold text-[#1b4332] block">
                Select Registered Member <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={selectedMemberEmail}
                  onChange={(e) => setSelectedMemberEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-semibold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] appearance-none cursor-pointer"
                >
                  <option value="">-- Choose Member from Roster --</option>
                  {membersList.map((m) => (
                    <option key={m.id} value={m.email}>
                      {m.name || m.username} ({m.memberNumber || 'BRC-MEMBER'}) — {m.email}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#52605d] absolute right-3 top-2.5 pointer-events-none" />
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
          <div className="space-y-2">
            {outboxList.map((item) => {
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
                  className="p-3 rounded-xl sm:rounded-2xl border border-[#e2ece2] hover:border-[#2d6a4f]/40 hover:bg-[#f7f9f7] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] sm:text-xs font-extrabold text-[#1b4332] truncate">
                        To: {Array.isArray(item.to) ? item.to.join(', ') : item.to}
                      </span>
                      <span className="text-[10px] text-[#52605d] shrink-0 font-medium">
                        • {formattedDate}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${
                        item.status === 'sent'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : item.status === 'simulated'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sent Email Details Modal */}
      <AnimatePresence>
        {selectedSentEmail && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-[#e2ece2]"
            >
              {/* Modal Header */}
              <div className="p-3.5 sm:p-4 border-b border-[#e2ece2] bg-[#fafcfa] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-black text-[#1b4332] truncate">
                      {selectedSentEmail.subject}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-[#52605d]">
                      Sent {new Date(selectedSentEmail.sentAt || Date.now()).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSentEmail(null)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3 flex-1">
                {/* Meta details */}
                <div className="bg-[#f7f9f7] rounded-xl p-2.5 sm:p-3 border border-[#e2ece2] space-y-1.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 pb-1 border-b border-[#e2ece2]">
                    <span className="text-[#52605d] font-bold text-[11px]">To:</span>
                    <span className="font-mono font-bold text-[11px] text-[#1b4332] break-all">
                      {Array.isArray(selectedSentEmail.to) ? selectedSentEmail.to.join(', ') : selectedSentEmail.to}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 pb-1 border-b border-[#e2ece2]">
                    <span className="text-[#52605d] font-bold text-[11px]">From:</span>
                    <span className="font-mono text-[11px] text-[#1b4332] break-all">
                      {selectedSentEmail.from}
                    </span>
                  </div>
                  {selectedSentEmail.resendId && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 pb-1 border-b border-[#e2ece2]">
                      <span className="text-[#52605d] font-bold text-[11px]">Resend Message ID:</span>
                      <span className="font-mono text-[10px] text-[#52605d] truncate">
                        {selectedSentEmail.resendId}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5">
                    <span className="text-[#52605d] font-bold text-[11px]">Delivery Status:</span>
                    <span className="font-bold text-[11px] text-emerald-800 capitalize">
                      {selectedSentEmail.status}
                    </span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#52605d]">
                    Message Body
                  </span>
                  <div className="p-3 rounded-xl bg-white border border-[#e2ece2] text-xs text-stone-800 leading-relaxed whitespace-pre-wrap font-sans min-h-[100px]">
                    {selectedSentEmail.bodyText || selectedSentEmail.bodyHtml || '(No text body content)'}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3 border-t border-[#e2ece2] bg-[#fafcfa] flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedSentEmail(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#1b4332] text-white hover:bg-[#2d6a4f] text-xs font-black transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
