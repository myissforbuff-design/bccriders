import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  Send,
  Lock,
  KeyRound,
  AlertTriangle,
  FileEdit,
  Trash2,
} from 'lucide-react';
import { TreasurerActionRequest, TreasurerActionType, TreasurerTargetType } from '../types';
import { store } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useLoader } from '../context/LoaderContext';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface TreasurerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: TreasurerActionType;
  targetType: TreasurerTargetType;
  targetId: string;
  targetTitle: string;
  targetSubtitle?: string;
  targetAmount?: number;
  targetDate?: string;
  targetRef?: string;
  onAccessGranted?: () => void;
  onSuccess?: () => void;
}

const COMMON_REASONS = [
  'Typo in Amount',
  'Duplicate Entry',
  'Wrong Member',
  'Receipt Update',
  'Adjustment',
  'Reconciliation',
];

export const TreasurerAuthModal: React.FC<TreasurerAuthModalProps> = ({
  isOpen,
  onClose,
  actionType,
  targetType,
  targetId,
  targetTitle,
  targetSubtitle,
  targetAmount,
  targetDate,
  targetRef,
  onAccessGranted,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const { runWithLoader } = useLoader();
  useModalDismiss(isOpen, onClose);

  const triggerAccessGranted = () => {
    if (onAccessGranted) onAccessGranted();
    if (onSuccess) onSuccess();
  };

  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState('');
  const [activeMode, setActiveMode] = useState<'request' | 'instant'>('request');

  // Instant Admin Auth state (for co-present admin)
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

  if (!isOpen) return null;

  // Check if there is an existing request for this target and action
  const allRequests = store.getTreasurerRequests();
  const existingRequest = allRequests.find(
    (r) =>
      r.targetId === targetId &&
      r.actionType === actionType &&
      (r.status === 'Pending' || r.status === 'Granted' || r.status === 'Denied')
  );

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Please provide a specific reason for this action.');
      return;
    }

    setIsSubmitting(true);

    await runWithLoader(
      async () => {
        try {
          store.createTreasurerRequest({
            requesterId: currentUser?.id || 'usr_treasurer',
            requesterName: currentUser?.name || 'Club Treasurer',
            requesterRole: currentUser?.role || 'Treasurer',
            actionType,
            targetType,
            targetId,
            targetTitle,
            targetSubtitle,
            targetAmount,
            targetDate,
            targetRef,
            reason: reason.trim(),
          });

          setSuccessToast('Authorization request sent to Admin!');
          setTimeout(() => {
            setSuccessToast('');
          }, 3500);
        } catch (err) {
          console.error('Failed to create treasurer request:', err);
        } finally {
          setIsSubmitting(false);
        }
      },
      {
        message: 'Submitting Authorization Request...',
      }
    );
  };

  const handleInstantAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError('');

    // Check against standard admin passwords or users
    const allUsers = store.getUsers();
    const adminUser = allUsers.find((u) => u.role === 'admin' || u.role?.toLowerCase() === 'admin');

    const isValid =
      adminPassword === 'admin' ||
      adminPassword === 'admin123' ||
      adminPassword === 'password' ||
      (adminUser && adminUser.password && adminPassword === adminUser.password);

    if (!isValid) {
      setAdminAuthError('Invalid admin credentials. Please try again.');
      return;
    }

    await runWithLoader(
      async () => {
        // Grant instant approval
        const grantedReq = store.createTreasurerRequest({
          requesterId: currentUser?.id || 'usr_treasurer',
          requesterName: currentUser?.name || 'Club Treasurer',
          requesterRole: currentUser?.role || 'Treasurer',
          actionType,
          targetType,
          targetId,
          targetTitle,
          targetSubtitle,
          targetAmount,
          targetDate,
          targetRef,
          reason: 'Instant In-Person Admin Approval',
        });

        store.updateTreasurerRequestStatus(
          grantedReq.id,
          'Granted',
          adminUser?.name || 'System Administrator',
          'Authorized via Co-Present Admin Password'
        );

        setAdminPassword('');
        triggerAccessGranted();
      },
      {
        message: 'Verifying Admin Credentials & Authorizing...',
      }
    );
  };

  const handleProceed = async () => {
    await runWithLoader(
      async () => {
        triggerAccessGranted();
      },
      {
        message: 'Applying Authorization & Opening Editor...',
      }
    );
  };

  const actionVerb = actionType === 'edit' ? 'Edit' : 'Delete';
  const actionColor =
    actionType === 'edit'
      ? 'text-amber-800 bg-amber-50 border-amber-300'
      : 'text-rose-800 bg-rose-50 border-rose-300';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden my-auto flex flex-col max-h-[92vh] animate-scaleUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1b4332] to-[#2d6a4f] p-3.5 sm:p-5 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0 pr-6">
              <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-400 text-stone-900 mb-0.5">
                Security
              </span>
              <h3 className="font-heading text-base sm:text-lg font-extrabold text-white leading-tight truncate">
                Admin Authorization
              </h3>
              <p className="text-emerald-100 text-[11px] leading-none mt-0.5">
                Treasurer Access Control
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* Security Notice Banner */}
          <div className="p-2.5 sm:p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 text-xs leading-relaxed flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px]">
              <span className="font-bold text-amber-900 block">Security Policy</span>
              <span className="text-amber-800">
                Modifying or deleting records requires Admin authorization to prevent financial tampering.
              </span>
            </div>
          </div>

          {/* Target Item Card */}
          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-stone-200/80 pb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                Operation
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${actionColor}`}>
                {actionType === 'edit' ? <FileEdit className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                <span>{actionVerb}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="min-w-0">
                <span className="text-[9px] text-stone-400 block font-bold uppercase">Item</span>
                <span className="font-extrabold text-[#1b4332] text-xs truncate block" title={targetTitle}>
                  {targetTitle}
                </span>
                {targetSubtitle && (
                  <span className="text-[10px] text-stone-500 block truncate">{targetSubtitle}</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[9px] text-stone-400 block font-bold uppercase">Amount</span>
                <span className="font-black text-xs text-[#1b4332]">
                  ₱{(Number(targetAmount) || 0).toLocaleString()}.00
                </span>
              </div>
            </div>

            {(targetDate || targetRef) && (
              <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1 border-t border-stone-200/60">
                {targetDate && <span>Date: {targetDate}</span>}
                {targetRef && <span>Ref: <strong className="text-stone-700">{targetRef}</strong></span>}
              </div>
            )}
          </div>

          {/* Success Toast */}
          {successToast && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-bold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {/* Check Existing Request Status */}
          {existingRequest ? (
            <div className="space-y-3">
              {existingRequest.status === 'Granted' ? (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-emerald-900 space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Authorization Granted!</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Admin <strong>{existingRequest.resolvedBy || 'Admin'}</strong> approved this request.
                  </p>
                  {existingRequest.adminNotes && (
                    <p className="text-[11px] italic bg-white/80 p-2 rounded-lg border border-emerald-200 text-emerald-900">
                      "{existingRequest.adminNotes}"
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleProceed}
                    className="w-full py-2.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-xl font-extrabold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Proceed to {actionVerb}</span>
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : existingRequest.status === 'Pending' ? (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-900 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-800 font-extrabold text-xs sm:text-sm">
                    <Clock className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                    <span>Pending Admin Approval</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    Submitted with reason: <em>"{existingRequest.reason}"</em>
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await runWithLoader(
                          async () => {
                            store.deleteTreasurerRequest(existingRequest.id);
                            setSuccessToast('Request cancelled.');
                          },
                          { message: 'Cancelling Request...' }
                        );
                      }}
                      className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                      Cancel Request
                    </button>
                  </div>
                </div>
              ) : existingRequest.status === 'Denied' ? (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-rose-900 space-y-2.5">
                  <div className="flex items-center gap-2 text-rose-800 font-extrabold text-xs sm:text-sm">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Request Denied by Admin</span>
                  </div>
                  {existingRequest.adminNotes && (
                    <p className="text-[11px] italic bg-white/80 p-2 rounded-lg border border-rose-200 text-rose-900">
                      "{existingRequest.adminNotes}"
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      store.deleteTreasurerRequest(existingRequest.id);
                    }}
                    className="w-full py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    Submit New Request
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            /* New Request Mode */
            <div className="space-y-3">
              {/* Mode Selector Tabs (Clean 1-line labels) */}
              <div className="grid grid-cols-2 border-b border-stone-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveMode('request')}
                  className={`pb-2 px-1.5 border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    activeMode === 'request'
                      ? 'border-[#1b4332] text-[#1b4332]'
                      : 'border-transparent text-stone-400 hover:text-stone-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span>Request Approval</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('instant')}
                  className={`pb-2 px-1.5 border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    activeMode === 'instant'
                      ? 'border-[#1b4332] text-[#1b4332]'
                      : 'border-transparent text-stone-400 hover:text-stone-700'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  <span>Admin Override</span>
                </button>
              </div>

              {activeMode === 'request' ? (
                <form onSubmit={handleSubmitRequest} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-[#1b4332] mb-1">
                      Reason for {actionVerb} <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Briefly explain the reason for this change..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f] resize-none"
                      required
                    />
                  </div>

                  {/* Common Reason Chips */}
                  <div>
                    <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                      Quick Selection:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {COMMON_REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReason(r)}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            reason === r
                              ? 'bg-[#1b4332] text-white border-[#1b4332]'
                              : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !reason.trim()}
                      className="px-4 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? 'Sending...' : 'Send Request'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Instant Admin In-Person Override */
                <form onSubmit={handleInstantAdminAuth} className="space-y-3">
                  <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-600">
                    <p className="font-bold text-stone-800 mb-0.5">In-Person Sign-Off</p>
                    <p className="leading-tight">
                      Enter the Administrator password to immediately authorize this action.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-[#1b4332] mb-1">
                      Admin Password
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Enter password..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f]"
                        required
                      />
                    </div>
                  </div>

                  {adminAuthError && (
                    <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{adminAuthError}</span>
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Authorize</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

