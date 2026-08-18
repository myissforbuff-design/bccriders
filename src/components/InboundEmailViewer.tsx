import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Eye,
  Paperclip,
  Inbox,
  AlertTriangle,
} from 'lucide-react';
import { InboundEmail } from '../types';
import { useAuth } from '../context/AuthContext';

export const InboundEmailViewer: React.FC = () => {
  const { isAdmin } = useAuth();
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [emailToDelete, setEmailToDelete] = useState<InboundEmail | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  const fetchEmails = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/inbound-emails');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setEmails(data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch inbound emails:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const openDeleteModal = (email: InboundEmail, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEmailToDelete(email);
  };

  const handleConfirmDelete = async () => {
    if (!emailToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/inbound-emails/${encodeURIComponent(emailToDelete.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const deletedId = emailToDelete.id;
        setEmails((prev) => prev.filter((item) => item.id !== deletedId && item.emailId !== deletedId));
        if (selectedEmail?.id === deletedId || selectedEmail?.emailId === deletedId) {
          setSelectedEmail(null);
        }
        setDeleteSuccessMessage('Email deleted successfully');
        setTimeout(() => setDeleteSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to delete email:', err);
    } finally {
      setIsDeleting(false);
      setEmailToDelete(null);
    }
  };

  const handleMarkAsRead = async (email: InboundEmail) => {
    setSelectedEmail(email);
    if (!email.read) {
      try {
        await fetch(`/api/inbound-emails/${encodeURIComponent(email.id)}/mark-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read: true }),
        });
        setEmails((prev) =>
          prev.map((item) => (item.id === email.id ? { ...item, read: true } : item))
        );
      } catch (err) {
        console.warn('Error marking email as read:', err);
      }
    }
  };

  const unreadCount = emails.filter((e) => !e.read).length;

  return (
    <div className="space-y-4">
      {/* Delete Notification Banner */}
      <AnimatePresence>
        {deleteSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-2.5 sm:p-3 bg-rose-50 border border-rose-200 rounded-xl sm:rounded-2xl flex items-center justify-between text-xs text-rose-900 font-bold"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{deleteSuccessMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Received Messages Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-[#e2ece2] shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-[#e2ece2] gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#1b4332] shrink-0">
              <Inbox className="w-4 h-4 sm:w-5 sm:h-5 text-[#2d6a4f]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading text-sm sm:text-base font-black text-[#1b4332]">
                  Received Messages
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[10.5px] font-black bg-[#f7f9f7] text-[#1b4332] border border-[#e2ece2]">
                  {emails.length}
                </span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10.5px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5 truncate">
                Inbox for <span className="font-bold text-[#1b4332]">contact@bccriders.cc</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchEmails}
            disabled={isLoading}
            className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#2d6a4f] ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {emails.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-dashed border-[#e2ece2] space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-black text-[#1b4332]">No Received Emails Yet</p>
              <p className="text-[11px] text-[#52605d] max-w-sm mx-auto">
                Incoming emails sent to <strong className="text-[#1b4332]">contact@bccriders.cc</strong> will appear here automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {emails.map((email) => {
              const isUnread = !email.read;
              const formattedDate = new Date(email.receivedAt || email.createdAt || Date.now()).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={email.id}
                  onClick={() => handleMarkAsRead(email)}
                  className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    isUnread
                      ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300 shadow-xs'
                      : 'bg-white border-[#e2ece2] hover:border-[#2d6a4f]/40 hover:bg-[#f7f9f7]'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                      )}
                      <span className={`text-[11px] sm:text-xs truncate ${isUnread ? 'font-black text-[#1b4332]' : 'font-bold text-[#52605d]'}`}>
                        {email.from}
                      </span>
                      <span className="text-[10px] text-[#52605d] shrink-0 font-medium">
                        • {formattedDate}
                      </span>
                    </div>

                    <h4 className={`text-xs sm:text-sm truncate ${isUnread ? 'font-black text-[#1b4332]' : 'font-bold text-stone-800'}`}>
                      {email.subject || '(No Subject)'}
                    </h4>

                    {email.bodyText && (
                      <p className="text-[10.5px] sm:text-[11px] text-[#52605d] line-clamp-1">
                        {email.bodyText}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[9.5px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-white border border-[#e2ece2] text-[#1b4332] truncate max-w-[180px]">
                        To: {Array.isArray(email.to) ? email.to.join(', ') : email.to}
                      </span>
                      {email.attachments && email.attachments.length > 0 && (
                        <span className="text-[9.5px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-1">
                          <Paperclip className="w-2.5 h-2.5" />
                          {email.attachments.length}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(email)}
                      className="p-1.5 rounded-lg sm:rounded-xl bg-white hover:bg-emerald-50 text-[#1b4332] border border-[#e2ece2] transition-colors cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => openDeleteModal(email, e)}
                        className="p-1.5 rounded-lg sm:rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-[#e2ece2] transition-colors cursor-pointer"
                        title="Delete Email"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Email Reader Modal */}
      <AnimatePresence>
        {selectedEmail && (
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
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-black text-[#1b4332] truncate">
                      {selectedEmail.subject || '(No Subject)'}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-[#52605d]">
                      {new Date(selectedEmail.receivedAt || Date.now()).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmail(null)}
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
                    <span className="text-[#52605d] font-bold text-[11px]">From:</span>
                    <span className="font-mono font-bold text-[11px] text-[#1b4332] break-all">{selectedEmail.from}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 pb-1 border-b border-[#e2ece2]">
                    <span className="text-[#52605d] font-bold text-[11px]">To:</span>
                    <span className="font-mono font-bold text-[11px] text-[#1b4332] break-all">
                      {Array.isArray(selectedEmail.to) ? selectedEmail.to.join(', ') : selectedEmail.to}
                    </span>
                  </div>
                  {selectedEmail.emailId && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5">
                      <span className="text-[#52605d] font-bold text-[11px]">ID:</span>
                      <span className="font-mono text-[10px] text-[#52605d] truncate">{selectedEmail.emailId}</span>
                    </div>
                  )}
                </div>

                {/* Body Content */}
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#52605d]">
                    Message Body
                  </span>
                  <div className="p-3 rounded-xl bg-white border border-[#e2ece2] text-xs text-stone-800 leading-relaxed whitespace-pre-wrap font-sans min-h-[100px]">
                    {selectedEmail.bodyText || selectedEmail.bodyHtml || '(No text body content provided)'}
                  </div>
                </div>

                {/* Attachments Section */}
                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#52605d] flex items-center gap-1">
                      <Paperclip className="w-3 h-3 text-[#2d6a4f]" /> Attachments ({selectedEmail.attachments.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {selectedEmail.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-2 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 pr-1.5">
                            <p className="font-bold text-[11px] text-[#1b4332] truncate">{att.filename}</p>
                            <p className="text-[9.5px] text-[#52605d]">{att.content_type}</p>
                          </div>
                          {att.size && (
                            <span className="text-[9.5px] text-[#52605d] font-medium shrink-0">
                              {(att.size / 1024).toFixed(1)} KB
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 border-t border-[#e2ece2] bg-[#fafcfa] flex items-center justify-between shrink-0">
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={(e) => openDeleteModal(selectedEmail, e)}
                    className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => setSelectedEmail(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#1b4332] text-white hover:bg-[#2d6a4f] text-xs font-black transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Delete Confirmation Modal */}
      <AnimatePresence>
        {emailToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-60">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full p-4 sm:p-5 border border-rose-100 shadow-2xl space-y-3.5"
            >
              {/* Alert Header */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-stone-900">
                    Delete Received Email?
                  </h3>
                  <p className="text-[11px] text-[#52605d] mt-0.5">
                    This permanently removes this message from MongoDB.
                  </p>
                </div>
              </div>

              {/* Email Summary Box */}
              <div className="bg-[#f7f9f7] rounded-xl p-2.5 border border-[#e2ece2] space-y-1 text-xs">
                <p className="text-[11px] text-[#52605d] truncate">
                  <strong className="text-[#1b4332]">From:</strong> {emailToDelete.from}
                </p>
                <p className="text-[11px] font-bold text-stone-800 truncate">
                  <strong className="text-[#1b4332]">Subject:</strong> {emailToDelete.subject || '(No Subject)'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEmailToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2 px-3 rounded-xl border border-[#e2ece2] hover:bg-[#f7f9f7] text-stone-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isDeleting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
