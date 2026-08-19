import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  FileEdit,
  Trash2,
  Search,
  User,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { TreasurerActionRequest } from '../types';
import { store } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useLoader } from '../context/LoaderContext';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface TreasurerRequestsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction?: (request: TreasurerActionRequest) => void;
}

export const TreasurerRequestsManagerModal: React.FC<TreasurerRequestsManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const { runWithLoader } = useLoader();
  useModalDismiss(isOpen, onClose);

  const [activeTab, setActiveTab] = useState<'pending' | 'granted' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminNoteInput, setAdminNoteInput] = useState<Record<string, string>>({});
  const [actionSuccessToast, setActionSuccessToast] = useState('');

  if (!isOpen) return null;

  const allRequests = store.getTreasurerRequests();

  // If user is not admin, only show their own requests
  const userRequests = isAdmin
    ? allRequests
    : allRequests.filter((r) => r.requesterId === currentUser?.id || r.requesterRole === 'Treasurer');

  const pendingCount = userRequests.filter((r) => r.status === 'Pending').length;
  const grantedCount = userRequests.filter((r) => r.status === 'Granted').length;

  const filteredRequests = userRequests.filter((r) => {
    if (activeTab === 'pending' && r.status !== 'Pending') return false;
    if (activeTab === 'granted' && r.status !== 'Granted') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = r.targetTitle.toLowerCase().includes(q);
      const matchRequester = r.requesterName.toLowerCase().includes(q);
      const matchReason = r.reason.toLowerCase().includes(q);
      const matchSubtitle = (r.targetSubtitle || '').toLowerCase().includes(q);
      if (!matchTitle && !matchRequester && !matchReason && !matchSubtitle) return false;
    }
    return true;
  });

  const handleGrantAccess = async (request: TreasurerActionRequest) => {
    const note = adminNoteInput[request.id] || 'Approved by Administrator';
    await runWithLoader(
      async () => {
        store.updateTreasurerRequestStatus(
          request.id,
          'Granted',
          currentUser?.name || 'System Administrator',
          note
        );

        setActionSuccessToast(`Approved access for ${request.requesterName} to ${request.actionType} "${request.targetTitle}".`);
        setTimeout(() => setActionSuccessToast(''), 4000);
      },
      { message: 'Granting Authorization & Refreshing...' }
    );
  };

  const handleDenyAccess = async (request: TreasurerActionRequest) => {
    const note = adminNoteInput[request.id] || 'Denied by Administrator.';
    await runWithLoader(
      async () => {
        store.updateTreasurerRequestStatus(
          request.id,
          'Denied',
          currentUser?.name || 'System Administrator',
          note
        );

        setActionSuccessToast(`Request denied.`);
        setTimeout(() => setActionSuccessToast(''), 4000);
      },
      { message: 'Updating Request & Refreshing...' }
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden my-auto flex flex-col max-h-[92vh] animate-scaleUp">
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
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-400 text-stone-900">
                  {isAdmin ? 'Admin Portal' : 'Security Center'}
                </span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500 text-white animate-pulse">
                    {pendingCount} Pending
                  </span>
                )}
              </div>
              <h3 className="font-heading text-base sm:text-lg font-extrabold text-white leading-tight truncate">
                Authorization Requests
              </h3>
              <p className="text-emerald-100 text-[11px] leading-none mt-0.5">
                Review financial record edit & delete permissions
              </p>
            </div>
          </div>
        </div>

        {/* Action Toast */}
        {actionSuccessToast && (
          <div className="bg-emerald-600 text-white text-xs px-3.5 py-2 flex items-center justify-between font-bold shrink-0 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{actionSuccessToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionSuccessToast('')}
              className="text-white/80 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter Bar & Tabs */}
        <div className="p-2.5 sm:p-3 bg-stone-50 border-b border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'pending'
                  ? 'bg-[#1b4332] text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span>Pending</span>
              {pendingCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                  activeTab === 'pending' ? 'bg-amber-400 text-stone-900' : 'bg-rose-500 text-white'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('granted')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'granted'
                  ? 'bg-[#1b4332] text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span>Approved</span>
              {grantedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800">
                  {grantedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-[#1b4332] text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span>All ({userRequests.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-7 pr-2.5 py-1 rounded-lg bg-white border border-stone-200 text-xs text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
            />
          </div>
        </div>

        {/* Requests List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-stone-400">
              <ShieldCheck className="w-10 h-10 mx-auto mb-1.5 text-stone-300" />
              <p className="font-bold text-stone-600 text-xs sm:text-sm">No authorization requests found</p>
              <p className="text-[11px] text-stone-400 mt-0.5">
                {activeTab === 'pending'
                  ? 'There are no pending requests.'
                  : 'No requests match the selected criteria.'}
              </p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const isPending = req.status === 'Pending';
              const isGranted = req.status === 'Granted';
              const isDenied = req.status === 'Denied';
              const isCompleted = req.status === 'Completed';

              const isEdit = req.actionType === 'edit';
              const actionBadgeColor = isEdit
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-rose-50 text-rose-700 border-rose-200';

              return (
                <div
                  key={req.id}
                  className={`rounded-xl border transition-all p-3 space-y-2.5 ${
                    isPending
                      ? 'bg-amber-50/40 border-amber-200 shadow-xs'
                      : isGranted
                      ? 'bg-emerald-50/30 border-emerald-200'
                      : isDenied
                      ? 'bg-rose-50/30 border-rose-200'
                      : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  {/* Top Bar: Requester, Action & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center font-black text-xs shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-[#1b4332] block leading-tight truncate">
                          {req.requesterName}
                        </span>
                        <span className="text-[9px] text-stone-500 font-medium">
                          {req.requesterRole} &bull; {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${actionBadgeColor}`}>
                        {isEdit ? <FileEdit className="w-2.5 h-2.5" /> : <Trash2 className="w-2.5 h-2.5" />}
                        {req.actionType}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          isPending
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isGranted
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : isDenied
                            ? 'bg-rose-100 text-rose-900 border border-rose-300'
                            : 'bg-stone-200 text-stone-800'
                        }`}
                      >
                        {isPending && <Clock className="w-2.5 h-2.5 animate-spin" />}
                        {isGranted && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {isDenied && <XCircle className="w-2.5 h-2.5" />}
                        {isCompleted && <CheckCircle2 className="w-2.5 h-2.5" />}
                        <span>{req.status}</span>
                      </span>
                    </div>
                  </div>

                  {/* Target Details Card */}
                  <div className="bg-white rounded-lg p-2.5 border border-stone-200 grid grid-cols-2 gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold text-stone-400 uppercase block">Item / Payee</span>
                      <p className="font-extrabold text-[#1b4332] text-xs truncate" title={req.targetTitle}>
                        {req.targetTitle}
                      </p>
                      {req.targetSubtitle && (
                        <p className="text-[10px] text-stone-500 truncate">{req.targetSubtitle}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-stone-400 uppercase block">Amount</span>
                      <p className="font-black text-xs text-[#1b4332]">
                        ₱{(Number(req.targetAmount) || 0).toLocaleString()}.00
                      </p>
                      {req.targetDate && (
                        <p className="text-[9px] text-stone-500">{req.targetDate}</p>
                      )}
                    </div>
                  </div>

                  {/* Reason provided */}
                  <div className="text-[11px] bg-white/80 p-2 rounded-lg border border-stone-200/80">
                    <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
                      Reason:
                    </span>
                    <p className="text-stone-800 italic">"{req.reason}"</p>
                  </div>

                  {/* Admin Resolution & Actions */}
                  {isPending && isAdmin && (
                    <div className="pt-2 border-t border-amber-200/80 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3 text-stone-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="Optional audit notes..."
                          value={adminNoteInput[req.id] || ''}
                          onChange={(e) =>
                            setAdminNoteInput({
                              ...adminNoteInput,
                              [req.id]: e.target.value,
                            })
                          }
                          className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-xs text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDenyAccess(req)}
                          className="px-3 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Deny</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGrantAccess(req)}
                          className="px-3.5 py-1 rounded-lg bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* If Granted, and Treasurer is viewing, provide direct button to proceed */}
                  {isGranted && onSelectAction && (
                    <div className="pt-1 flex items-center justify-between gap-2 border-t border-emerald-200">
                      <span className="text-[10px] text-emerald-800 font-bold">
                        Approved by {req.resolvedBy || 'Admin'}.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectAction(req);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-lg text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <span>Proceed to {req.actionType}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Resolution info if not pending */}
                  {!isPending && req.resolvedBy && (
                    <div className="text-[10px] text-stone-500 pt-1 border-t border-stone-200 flex flex-wrap items-center justify-between gap-1">
                      <span>
                        By: <strong>{req.resolvedBy}</strong> &bull;{' '}
                        {req.resolvedAt ? new Date(req.resolvedAt).toLocaleDateString() : 'Recently'}
                      </span>
                      {req.adminNotes && (
                        <span className="italic text-stone-600 font-medium">"{req.adminNotes}"</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500 shrink-0">
          <span className="truncate mr-2">🔒 Cryptographically logged for audit integrity.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 hover:bg-stone-100 rounded-lg font-bold text-xs transition-colors cursor-pointer shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

