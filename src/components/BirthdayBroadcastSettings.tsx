import React, { useState, useEffect } from 'react';
import {
  Mail,
  Calendar,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { User } from '../types';
import { authFetch } from '../lib/db';
import {
  calculateMemberAge,
  isMemberBirthdayToday,
  getBirthdayCelebrators,
  getCurrentGMT8Date,
  generateBirthdayEmailContent,
} from '../lib/birthdayUtils';

interface BirthdayBroadcastSettingsProps {
  members: User[];
}

const STORAGE_KEY_TOGGLE = 'bcc_birthday_email_broadcast_enabled';
const STORAGE_KEY_LOGS = 'bcc_birthday_broadcast_logs';

interface BroadcastLog {
  id: string;
  celebratorName: string;
  celebratorId: string;
  sentDate: string;
  recipientCount: number;
  timestamp: string;
  status: 'delivered' | 'failed';
}

export const BirthdayBroadcastSettings: React.FC<BirthdayBroadcastSettingsProps> = ({ members }) => {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_TOGGLE);
    return saved !== null ? saved === 'true' : true; // default enabled
  });

  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [logs, setLogs] = useState<BroadcastLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOGS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const gmt8 = getCurrentGMT8Date();
  const celebrators = getBirthdayCelebrators(members);

  // Filter all approved members with valid email addresses
  const eligibleRecipients = members.filter(
    (m) => m.approvalStatus === 'Approved' && m.email && m.email.includes('@')
  );

  // Sync with server on mount
  useEffect(() => {
    authFetch('/api/birthdays/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.success) {
          if (typeof data.isEnabled === 'boolean') {
            setIsEnabled(data.isEnabled);
            localStorage.setItem(STORAGE_KEY_TOGGLE, String(data.isEnabled));
          }
          if (Array.isArray(data.logs) && data.logs.length > 0) {
            const formatted: BroadcastLog[] = data.logs.map((l: any) => ({
              id: l.id,
              celebratorName: l.celebratorName,
              celebratorId: l.celebratorId,
              sentDate: l.sentDate,
              recipientCount: l.recipientCount || (l.recipients ? l.recipients.length : 0),
              timestamp: l.sentAt ? new Date(l.sentAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
              status: l.status === 'delivered' ? 'delivered' : 'failed',
            }));
            setLogs(formatted);
            localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(formatted));
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleToggle = async (checked: boolean) => {
    setIsEnabled(checked);
    localStorage.setItem(STORAGE_KEY_TOGGLE, String(checked));
    try {
      await authFetch('/api/birthdays/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: checked }),
      });
    } catch (e) {
      console.warn('Failed to sync toggle with server:', e);
    }
    setFeedback({
      type: 'success',
      message: checked
        ? 'Automated birthday broadcast is now ENABLED.'
        : 'Automated birthday broadcast is now DISABLED.',
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Trigger broadcast for a celebrator
  const handleSendBroadcast = async (celebrator: User, isTest = false) => {
    setFeedback(null);
    setIsSending(true);

    try {
      const response = await authFetch('/api/birthdays/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celebratorId: celebrator.id,
          force: true,
          isTest,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.details?.join(' ') || result.error || `Server error (${response.status})`);
      }

      const newLog: BroadcastLog = {
        id: `bcast_${Date.now()}`,
        celebratorName: celebrator.name,
        celebratorId: celebrator.id,
        sentDate: gmt8.dateString,
        recipientCount: eligibleRecipients.length,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered',
      };

      const updatedLogs = [newLog, ...logs.filter((l) => l.celebratorId !== celebrator.id || l.sentDate !== gmt8.dateString)].slice(0, 10);
      setLogs(updatedLogs);
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));

      setFeedback({
        type: 'success',
        message: isTest
          ? `Test birthday broadcast successfully sent to ${eligibleRecipients.length} club member(s).`
          : `Birthday broadcast for ${celebrator.name} successfully dispatched to ${eligibleRecipients.length} club member(s)!`,
      });
    } catch (err: any) {
      console.error('Failed to send birthday broadcast email:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to dispatch birthday broadcast email.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const sampleCelebrator = celebrators.length > 0 ? celebrators[0] : members[0] || {
    id: 'sample',
    name: 'Brother Rider',
    birthdate: `${gmt8.year - 32}-09-05`,
  };

  const previewContent = generateBirthdayEmailContent(
    sampleCelebrator.name,
    sampleCelebrator.birthdate
  );

  return (
    <div id="birthday-broadcast-settings-card" className="bg-white rounded-2xl border border-[#e2ece2] shadow-xs overflow-hidden">
      {/* Header & Toggle */}
      <div className="p-4 sm:p-6 border-b border-[#e2ece2] bg-gradient-to-r from-[#f7f9f7] to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0 border border-[#b7e4c7]">
              <Calendar className="w-5 h-5 text-[#2d6a4f]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-[#1b4332]">
                  Automated Member Birthday Broadcasts
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold border ${
                    isEnabled
                      ? 'bg-[#d8f3dc] text-[#1b4332] border-[#b7e4c7]'
                      : 'bg-stone-100 text-stone-600 border-stone-200'
                  }`}
                >
                  {isEnabled ? 'ACTIVE (AUTOMATED)' : 'DISABLED'}
                </span>
              </div>
              <p className="text-xs text-[#52605d] mt-1 max-w-2xl">
                Send an email to everyone in the club that greets the celebrator and encourages fellow riders to greet a member on their birthday.
              </p>
            </div>
          </div>

          {/* Switch Toggle */}
          <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="toggle-birthday-email-broadcast"
                checked={isEnabled}
                onChange={(e) => handleToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d6a4f]"></div>
            </label>
            <span className="text-xs font-bold text-[#1b4332]">
              {isEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              feedback.type === 'success'
                ? 'bg-[#d8f3dc] text-[#1b4332] border-[#b7e4c7]'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2d6a4f]" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="p-4 sm:p-6 space-y-5">
        {/* Date & Timezone Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs">
          <div className="flex items-center gap-2 text-[#52605d]">
            <Clock className="w-4 h-4 text-[#2d6a4f] shrink-0" />
            <span>
              Club Operating Timezone: <strong className="text-[#1b4332]">GMT+8 (Asia/Manila)</strong>
            </span>
            <span className="hidden sm:inline">•</span>
            <span>
              Today: <strong className="text-[#1b4332]">{gmt8.dateString}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[#52605d]">
            <Users className="w-4 h-4 text-[#2d6a4f] shrink-0" />
            <span>
              Eligible Member Recipients: <strong className="text-[#1b4332]">{eligibleRecipients.length}</strong>
            </span>
          </div>
        </div>

        {/* Today's Celebrator Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1b4332] flex items-center gap-1.5">
              <span>Today's Birthday Celebrators</span>
              <span className="px-2 py-0.2 rounded-full bg-[#d8f3dc] text-[#1b4332] text-[10px] font-bold">
                {celebrators.length}
              </span>
            </h4>
          </div>

          {celebrators.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {celebrators.map((celebrator) => {
                const age = calculateMemberAge(celebrator.birthdate, celebrator.age);
                const hasSentToday = logs.some(
                  (l) => l.celebratorId === celebrator.id && l.sentDate === gmt8.dateString
                );

                return (
                  <div
                    key={celebrator.id}
                    className="p-4 rounded-xl border-2 border-[#b7e4c7] bg-[#f0fdf4] flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-[#1b4332]">
                            {celebrator.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px]">
                            Birthday Today
                          </span>
                        </div>
                        <div className="text-xs text-[#52605d] mt-0.5">
                          Birthdate: <strong className="text-[#1b4332]">{celebrator.birthdate}</strong>
                          {age !== undefined && ` • Turning ${age} years old`}
                        </div>
                        <div className="text-[11px] text-[#2d6a4f] font-mono mt-0.5">
                          ID: #{celebrator.memberNumber || celebrator.id}
                        </div>
                      </div>

                      {hasSentToday && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#d8f3dc] text-[#1b4332] text-[10px] font-bold shrink-0 border border-[#b7e4c7]">
                          <CheckCircle2 className="w-3 h-3 text-[#2d6a4f]" />
                          Broadcast Sent Today
                        </span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#b7e4c7]/50 flex items-center justify-between">
                      <span className="text-[11px] text-[#52605d]">
                        Will dispatch to {eligibleRecipients.length} members
                      </span>
                      <button
                        type="button"
                        id={`btn-send-birthday-bcast-${celebrator.id}`}
                        disabled={isSending}
                        onClick={() => handleSendBroadcast(celebrator)}
                        className="px-3 py-1.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        {isSending ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{hasSentToday ? 'Resend Broadcast' : 'Send Birthday Broadcast Now'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-[#e2ece2] bg-[#f7f9f7] text-xs text-[#52605d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-[#1b4332]">
                  No member birthdays scheduled for today ({gmt8.dateString} GMT+8).
                </p>
                <p className="text-[11px] text-[#52605d] mt-0.5">
                  When a member's birthdate arrives, their age updates dynamically and the club broadcast activates automatically.
                </p>
              </div>

              {members.length > 0 && (
                <button
                  type="button"
                  id="btn-test-birthday-broadcast"
                  disabled={isSending}
                  onClick={() => handleSendBroadcast(sampleCelebrator, true)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#e2ece2] border border-[#e2ece2] text-[#1b4332] font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                >
                  {isSending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 text-[#2d6a4f]" />
                  )}
                  <span>Send Test Broadcast</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Email Template Preview Accordion */}
        <div className="border border-[#e2ece2] rounded-xl overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="w-full p-3 sm:p-4 bg-[#f7f9f7] hover:bg-[#eef4ee] flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#2d6a4f]" />
              <div>
                <span className="text-xs font-bold text-[#1b4332] block">
                  Broadcast Message Format & Content Preview
                </span>
                <span className="text-[10.5px] text-[#52605d]">
                  Contains no emojis, honors God, and references Jesus Christ and our God as approved.
                </span>
              </div>
            </div>
            {showPreview ? (
              <ChevronUp className="w-4 h-4 text-[#52605d]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#52605d]" />
            )}
          </button>

          {showPreview && (
            <div className="p-4 sm:p-5 border-t border-[#e2ece2] space-y-3 text-xs bg-white">
              <div className="space-y-1.5 pb-3 border-b border-[#e2ece2]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#52605d] w-16">Subject:</span>
                  <span className="font-semibold text-[#1b4332]">{previewContent.subject}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#52605d] w-16">Sender:</span>
                  <span className="text-[#1b4332]">BCC Riders Club &lt;info@bccriders.cc&gt;</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#52605d] w-16">Reply-To:</span>
                  <span className="text-[#1b4332]">contact@bccriders.cc</span>
                </div>
              </div>

              <div className="whitespace-pre-line font-sans text-[#2d3a3a] leading-relaxed bg-[#fafdfa] p-4 rounded-xl border border-[#e2ece2]">
                {previewContent.body}
              </div>
            </div>
          )}
        </div>

        {/* Broadcast Logs */}
        {logs.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#e2ece2]">
            <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-[#52605d]">
              Recent Birthday Broadcast Activity
            </h5>
            <div className="divide-y divide-[#e2ece2] border border-[#e2ece2] rounded-xl overflow-hidden bg-white text-xs">
              {logs.slice(0, 5).map((log) => (
                <div key={log.id} className="p-2.5 sm:px-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                    <div>
                      <span className="font-bold text-[#1b4332]">{log.celebratorName}</span>
                      <span className="text-[#52605d] text-[11px] ml-1.5">
                        dispatched to {log.recipientCount} members
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#52605d] font-mono shrink-0">
                    {log.sentDate} at {log.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
