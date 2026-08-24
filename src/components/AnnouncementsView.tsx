import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useLoader } from '../context/LoaderContext';
import { store } from '../lib/db';
import { Announcement, AnnouncementPriority } from '../types';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { ModalPortal } from './ModalPortal';
import {
  Megaphone,
  Plus,
  Pin,
  Search,
  Filter,
  Trash2,
  Edit2,
  AlertTriangle,
  Bell,
  Calendar,
  Info,
  ShieldCheck,
  X,
  CheckCircle2,
  UserCheck,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  ExternalLink,
  Share2,
  Globe,
  Smile,
  SmilePlus,
} from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '🏍️', '🔥', '👏', '🎉', '💯', '🤝'];
const EXTENDED_EMOJIS = [
  '👍', '❤️', '🏍️', '🔥', '👏', '🎉', '💯', '🤝',
  '🙌', '😎', '⚡', '💪', '🚀', '🏁', '🏆', '🤩',
  '🙏', '🫡', '🎯', '👌', '☕', '⭐'
];

const getFacebookEmbedSrc = (rawUrl?: string): string => {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  if (url.includes('<iframe') && url.includes('src=')) {
    const match = url.match(/src=["']([^"']+)["']/);
    if (match && match[1]) {
      url = match[1];
    }
  }
  if (url.includes('facebook.com/plugins/post.php') || url.includes('facebook.com/plugins/video.php')) {
    if (url.includes('width=')) {
      url = url.replace(/width=\d+(%25|%|px)?/gi, 'width=100%25');
    } else {
      url += '&width=100%25';
    }
    return url;
  }
  return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=100%25`;
};

const PRIORITY_OPTIONS = [
  { id: 'All', label: 'All Categories', description: 'Show all bulletins' },
  { id: 'Important', label: 'Important', description: 'High priority notices' },
  { id: 'Emergency', label: 'Emergency', description: 'Urgent security & safety alerts' },
  { id: 'Event', label: 'Event', description: 'Official club rides & schedules' },
  { id: 'General', label: 'General', description: 'Standard club directives' },
] as const;

export const AnnouncementsView: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const { runWithLoader, refreshTick } = useLoader();
  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    store.getAnnouncements()
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const [activePickerAnnId, setActivePickerAnnId] = useState<string | null>(null);

  useEffect(() => {
    setAnnouncements([...store.getAnnouncements()]);
  }, [refreshTick]);

  useEffect(() => {
    const handleAnnouncementsUpdate = () => {
      setAnnouncements([...store.getAnnouncements()]);
    };
    window.addEventListener('bcc_announcements_updated', handleAnnouncementsUpdate);
    return () => {
      window.removeEventListener('bcc_announcements_updated', handleAnnouncementsUpdate);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        priorityDropdownRef.current &&
        !priorityDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPriorityDropdownOpen(false);
      }
      // Close emoji picker if click target is not an emoji picker trigger
      const target = event.target as HTMLElement;
      if (!target.closest('.emoji-picker-container')) {
        setActivePickerAnnId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formFacebookUrl, setFormFacebookUrl] = useState('');
  const [formPriority, setFormPriority] = useState<AnnouncementPriority>('General');
  const [formPinned, setFormPinned] = useState(false);
  const [formAuthorName, setFormAuthorName] = useState(currentUser?.name || 'Executive Officer');
  const [formAuthorRole, setFormAuthorRole] = useState(currentUser?.role || 'Officer');

  // Confirmation Delete Modal
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useModalDismiss(showModal, () => setShowModal(false));
  useModalDismiss(Boolean(deletingId), () => setDeletingId(null));

  const refreshAnnouncements = () => {
    setAnnouncements([...store.getAnnouncements()]);
  };

  const handleToggleReaction = (annId: string, emoji: string) => {
    if (!currentUser) return;
    const updated = store.toggleAnnouncementReaction(annId, emoji, {
      id: currentUser.id || (currentUser as any).memberId || 'guest',
      name: currentUser.name || 'Club Member',
    });
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === annId ? { ...updated } : a))
    );
    setActivePickerAnnId(null);
  };

  const handleOpenCreate = () => {
    setEditingAnn(null);
    setFormTitle('');
    setFormContent('');
    setFormFacebookUrl('');
    setFormPriority('General');
    setFormPinned(false);
    setFormAuthorName(currentUser?.name || 'Executive Officer');
    setFormAuthorRole(currentUser?.role || 'Officer');
    setShowModal(true);
  };

  const handleOpenEdit = (ann: Announcement) => {
    setEditingAnn(ann);
    setFormTitle(ann.title);
    setFormContent(ann.content);
    setFormFacebookUrl(ann.facebookUrl || '');
    setFormPriority(ann.priority);
    setFormPinned(Boolean(ann.pinned));
    setFormAuthorName(ann.authorName);
    setFormAuthorRole(ann.authorRole);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    // Clean Facebook URL if iframe code was pasted
    let cleanFbUrl = formFacebookUrl.trim();
    if (cleanFbUrl.includes('<iframe') && cleanFbUrl.includes('src=')) {
      const match = cleanFbUrl.match(/src=["']([^"']+)["']/);
      if (match && match[1]) {
        cleanFbUrl = match[1];
      }
    }

    await runWithLoader(
      async () => {
        if (editingAnn) {
          store.updateAnnouncement({
            ...editingAnn,
            title: formTitle.trim(),
            content: formContent.trim(),
            facebookUrl: cleanFbUrl || undefined,
            priority: formPriority,
            pinned: formPinned,
            authorName: formAuthorName.trim() || 'Executive Officer',
            authorRole: formAuthorRole.trim() || 'Officer',
          });
        } else {
          store.createAnnouncement({
            title: formTitle.trim(),
            content: formContent.trim(),
            facebookUrl: cleanFbUrl || undefined,
            priority: formPriority,
            pinned: formPinned,
            authorId: currentUser?.id || 'usr_admin',
            authorName: formAuthorName.trim() || 'Executive Officer',
            authorRole: formAuthorRole.trim() || 'Officer',
          });
        }

        refreshAnnouncements();
        setShowModal(false);
      },
      {
        message: editingAnn ? 'Updating Bulletin & Refreshing...' : 'Publishing Bulletin & Refreshing...',
      }
    );
  };

  const handleDelete = async (id: string) => {
    await runWithLoader(
      async () => {
        store.deleteAnnouncement(id);
        refreshAnnouncements();
        setDeletingId(null);
      },
      {
        message: 'Deleting Bulletin & Refreshing...',
      }
    );
  };

  const handleTogglePin = async (id: string) => {
    await runWithLoader(
      async () => {
        store.togglePinAnnouncement(id);
        refreshAnnouncements();
      },
      {
        message: 'Updating Pin Status & Refreshing...',
      }
    );
  };

  // Filter & Search Logic
  const filteredAnnouncements = announcements
    .filter((a) => {
      const matchesSearch =
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.authorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority =
        selectedPriority === 'All' || a.priority === selectedPriority;
      return matchesSearch && matchesPriority;
    })
    .sort((a, b) => {
      // Pinned items first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedPriority]);

  const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / itemsPerPage));
  const currentAnnouncementsPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedAnnouncements = filteredAnnouncements.slice(
    (currentAnnouncementsPage - 1) * itemsPerPage,
    currentAnnouncementsPage * itemsPerPage
  );

  const getPriorityBadge = (priority: AnnouncementPriority) => {
    switch (priority) {
      case 'Emergency':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-800',
          icon: <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-600" />,
        };
      case 'Important':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          icon: <Bell className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600" />,
        };
      case 'Event':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          icon: <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600" />,
        };
      default:
        return {
          bg: 'bg-slate-100 border-slate-200 text-slate-700',
          icon: <Info className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500" />,
        };
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-4">
      {/* Header Row */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-[10.5px] sm:text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.98] shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-[#74c69d]" />
            <span>Create News Update</span>
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-xs">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search announcements..."
            className="w-full pl-7.5 sm:pl-8 pr-3 py-1.5 rounded-lg sm:rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[10.5px] sm:text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
          />
          <Search className="w-3.5 h-3.5 text-[#52605d] absolute left-2.5 top-2" />
        </div>

        {/* Priority Filter Interactive Dropdown */}
        <div className="relative w-full sm:w-auto" ref={priorityDropdownRef}>
          <button
            type="button"
            onClick={() => setIsPriorityDropdownOpen((prev) => !prev)}
            className="w-full sm:w-52 flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-[#f7f9f7] hover:bg-[#e8f2e9] text-[#1b4332] rounded-lg sm:rounded-xl border border-[#e2ece2] text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Filter className="w-3 h-3 text-[#2d6a4f] shrink-0" />
              <span className="text-[#52605d] text-[10px] font-normal">Category:</span>
              <span className="font-extrabold truncate">
                {PRIORITY_OPTIONS.find((p) => p.id === selectedPriority)?.label || selectedPriority}
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#2d6a4f] shrink-0 transition-transform duration-200 ${
                isPriorityDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {isPriorityDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 2, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 left-0 sm:left-auto sm:w-56 top-full z-30 p-1 bg-white rounded-xl border border-[#e2ece2] shadow-xl space-y-0.5 mt-1 overflow-hidden"
              >
                {PRIORITY_OPTIONS.map((opt) => {
                  const isSelected = selectedPriority === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedPriority(opt.id);
                        setIsPriorityDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-[#1b4332] text-white shadow-xs'
                          : 'hover:bg-[#f0f7f2] text-[#1b4332]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`text-[10.5px] font-bold truncate ${isSelected ? 'text-white' : 'text-[#1b4332]'}`}>
                          {opt.label}
                        </p>
                        <p className={`text-[9px] truncate ${isSelected ? 'text-[#d8f3dc]' : 'text-[#52605d]'}`}>
                          {opt.description}
                        </p>
                      </div>
                      {isSelected && <Check className="w-3 h-3 text-[#74c69d] shrink-0" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-2 sm:space-y-3">
        {filteredAnnouncements.length === 0 ? (
          <div className="bg-white rounded-xl sm:rounded-2xl p-8 sm:p-10 text-center border border-[#e2ece2] shadow-xs space-y-2">
            <div className="w-10 h-10 bg-[#f7f9f7] rounded-full flex items-center justify-center mx-auto text-[#52605d]">
              <Megaphone className="w-4 h-4" />
            </div>
            <h3 className="font-heading font-extrabold text-[#1b4332] text-sm sm:text-base">
              No Announcements Found
            </h3>
            <p className="text-[10px] sm:text-xs text-[#52605d] max-w-xs mx-auto">
              {searchQuery || selectedPriority !== 'All'
                ? 'No bulletins match your current search criteria. Try adjusting your filters.'
                : 'There are no active club announcements posted at this time.'}
            </p>
          </div>
        ) : (
          <>
            {paginatedAnnouncements.map((ann) => {
              const badge = getPriorityBadge(ann.priority);
            return (
              <motion.div
                key={ann.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border transition-all ${
                  ann.pinned
                    ? 'border-[#2d6a4f] shadow-sm bg-gradient-to-br from-white via-white to-[#f0f9f1]'
                    : 'border-[#e2ece2] shadow-xs hover:border-[#2d6a4f]/50'
                }`}
              >
                {/* Top Row: Priority Badge, Pinned Ribbon & Admin Action Buttons */}
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    {ann.pinned && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[8.5px] sm:text-[9.5px] font-bold shadow-2xs">
                        <Pin className="w-2.5 h-2.5 text-amber-700 fill-amber-700" />
                        <span>Pinned Bulletin</span>
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full border text-[8.5px] sm:text-[9.5px] font-bold ${badge.bg}`}
                    >
                      {badge.icon}
                      <span>{ann.priority}</span>
                    </span>
                  </div>

                  {/* Admin Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(ann.id)}
                        title={ann.pinned ? 'Unpin Announcement' : 'Pin Announcement'}
                        className={`p-1 rounded-md border text-[10px] font-semibold transition-colors cursor-pointer ${
                          ann.pinned
                            ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <Pin className={`w-3 h-3 ${ann.pinned ? 'fill-amber-700' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(ann)}
                        title="Edit Announcement"
                        className="p-1 rounded-md bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingId(ann.id)}
                        title="Delete Announcement"
                        className="p-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Announcement Title */}
                <h3 className="font-heading text-xs sm:text-sm font-bold sm:font-extrabold text-[#1b4332] leading-snug mb-1">
                  {ann.title}
                </h3>

                {/* Content */}
                <div className="text-[10.5px] sm:text-xs text-[#3d4b49] leading-relaxed whitespace-pre-line mb-2 font-normal">
                  {ann.content}
                </div>

                {/* Embedded Facebook Post Container */}
                {ann.facebookUrl && (
                  <div className="my-2 rounded-lg border border-[#e2ece2] bg-white overflow-hidden shadow-2xs p-1 flex justify-center min-h-[240px] w-full">
                    <iframe
                      src={getFacebookEmbedSrc(ann.facebookUrl)}
                      width="100%"
                      height="400"
                      style={{ border: 'none', overflow: 'hidden', width: '100%', minHeight: '260px' }}
                      scrolling="no"
                      frameBorder="0"
                      allowFullScreen={true}
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      title={`Embedded Facebook post for ${ann.title}`}
                      className="w-full max-w-[500px] rounded-md"
                    />
                  </div>
                )}

                {/* Footer: Author Info & Timestamp */}
                <div className="pt-2 border-t border-[#e2ece2] flex items-center justify-between text-[9.5px] sm:text-[10.5px] text-[#52605d]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-[#d8f3dc] text-[#1b4332] font-bold flex items-center justify-center text-[9px] shrink-0">
                      {ann.authorName.charAt(0)}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-[#1b4332] text-[10px] sm:text-[11px]">{ann.authorName}</span>
                      {ann.authorRole && (
                        <span className="text-[8px] sm:text-[9px] text-[#2d6a4f] bg-[#d8f3dc] px-1 py-0.2 rounded font-semibold">
                          {ann.authorRole}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[#52605d] font-medium text-[9px] sm:text-[10px]">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#2d6a4f]" />
                    <span>{ann.createdAt}</span>
                    {ann.updatedAt && <span className="italic text-[8.5px]">(Edited)</span>}
                  </div>
                </div>

                {/* Bottom Bar: Emoji Reactions Section (For Members, Officers & Admins) */}
                <div className="mt-2 pt-2 border-t border-[#e2ece2]/60 flex flex-wrap items-center justify-between gap-1.5 emoji-picker-container relative">
                  {/* Active Reaction Chips */}
                  <div className="flex flex-wrap items-center gap-1">
                    {ann.reactions && ann.reactions.length > 0 ? (
                      ann.reactions.map((reaction) => {
                        const currentUserId = currentUser?.id || (currentUser as any)?.memberId;
                        const hasReacted = reaction.users.some((u) => u.userId === currentUserId);
                        const userNames = reaction.users.map((u) => u.userName).join(', ');
                        return (
                          <button
                            key={reaction.emoji}
                            type="button"
                            onClick={() => handleToggleReaction(ann.id, reaction.emoji)}
                            title={userNames ? `${reaction.emoji} ${userNames}` : 'React'}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold transition-all cursor-pointer border active:scale-95 ${
                              hasReacted
                                ? 'bg-emerald-100/90 text-[#1b4332] border-[#2d6a4f] shadow-2xs'
                                : 'bg-[#f7f9f7] hover:bg-emerald-50 text-[#52605d] border-[#e2ece2]'
                            }`}
                          >
                            <span className="text-[11px] sm:text-xs">{reaction.emoji}</span>
                            <span className="text-[9px] sm:text-[10px] font-extrabold">{reaction.users.length}</span>
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-[9px] text-[#52605d]/70 italic">No reactions yet</span>
                    )}
                  </div>

                  {/* Add / React Emoji Button & Palette */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActivePickerAnnId(activePickerAnnId === ann.id ? null : ann.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer border shadow-2xs active:scale-95 ${
                        activePickerAnnId === ann.id
                          ? 'bg-[#1b4332] text-white border-[#1b4332]'
                          : 'bg-[#f7f9f7] hover:bg-[#e2ece2] text-[#1b4332] border-[#e2ece2]'
                      }`}
                      title="React with emoji"
                    >
                      <Smile className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#2d6a4f]" />
                      <span>React</span>
                    </button>

                    {/* Emoji Picker Popover */}
                    <AnimatePresence>
                      {activePickerAnnId === ann.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.92, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: 4 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 bottom-full mb-1.5 z-50 p-1.5 bg-white rounded-xl shadow-xl border border-[#e2ece2] flex flex-wrap gap-1 w-[220px] sm:w-[260px]"
                        >
                          <div className="w-full text-[9px] font-bold text-[#52605d] px-1 pb-1 border-b border-[#e2ece2] mb-1 flex items-center justify-between">
                            <span>React with Emoji</span>
                            <span className="text-[8px] text-[#2d6a4f] font-normal">Click to toggle</span>
                          </div>
                          {EXTENDED_EMOJIS.map((emoji) => {
                            const currentUserId = currentUser?.id || (currentUser as any)?.memberId;
                            const reaction = ann.reactions?.find((r) => r.emoji === emoji);
                            const hasReacted = reaction?.users.some((u) => u.userId === currentUserId);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleToggleReaction(ann.id, emoji)}
                                className={`w-7 h-7 flex items-center justify-center text-sm sm:text-base rounded-lg hover:scale-125 transition-all cursor-pointer ${
                                  hasReacted ? 'bg-emerald-100 ring-1 ring-[#2d6a4f]' : 'hover:bg-emerald-50'
                                }`}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 bg-white rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-xs text-[10px] sm:text-xs text-[#52605d] mt-2">
            <div className="font-semibold">
              Showing <span className="font-extrabold text-[#1b4332]">{(currentAnnouncementsPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-extrabold text-[#1b4332]">
                {Math.min(currentAnnouncementsPage * itemsPerPage, filteredAnnouncements.length)}
              </span>{' '}
              of <span className="font-extrabold text-[#1b4332]">{filteredAnnouncements.length}</span> news updates
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentAnnouncementsPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-[#e2ece2] bg-white text-[#1b4332] hover:bg-[#f7f9f7] disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors text-[10.5px] sm:text-xs font-bold flex items-center gap-1"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Prev</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                        currentAnnouncementsPage === pageNum
                          ? 'bg-[#1b4332] text-white shadow-xs'
                          : 'bg-white text-[#52605d] border border-[#e2ece2] hover:bg-stone-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentAnnouncementsPage === totalPages}
                  className="px-2.5 py-1 rounded-lg border border-[#e2ece2] bg-white text-[#1b4332] hover:bg-[#f7f9f7] disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors text-[10.5px] sm:text-xs font-bold flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
      </div>

      {/* Modal: Create / Edit Announcement */}
      <ModalPortal>
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl max-w-[340px] sm:max-w-[390px] w-[94vw] max-h-[66dvh] sm:max-h-[70dvh] shadow-2xl border border-[#e2ece2] relative flex flex-col my-auto overflow-hidden"
              >
                {/* Modal Header */}
                <div className="p-2.5 sm:p-3 pb-2 border-b border-[#e2ece2] relative shrink-0 bg-white">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="absolute top-2 right-2 p-1 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 pr-6">
                    <div className="w-7 h-7 rounded-lg bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0">
                      <Megaphone className="w-3.5 h-3.5 text-[#1b4332]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-heading font-extrabold text-[#1b4332] text-xs sm:text-sm leading-tight truncate">
                        {editingAnn ? 'Edit News Update' : 'Post Activity Update'}
                      </h3>
                      <p className="text-[9px] sm:text-[10px] text-[#52605d] truncate">
                        Official directives &amp; Facebook embeds
                      </p>
                    </div>
                  </div>
                </div>

                {/* Scrollable Form Body */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
                  <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2 sm:space-y-2.5 pr-1.5 text-xs">
                    {/* Title */}
                    <div>
                      <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                        Update Title <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="e.g., Recent Community Ride"
                        className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>

                    {/* Priority Selector */}
                    <div>
                      <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                        Priority Category
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                        {(['General', 'Important', 'Event', 'Emergency'] as AnnouncementPriority[]).map(
                          (p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setFormPriority(p)}
                              className={`py-0.5 px-1.5 rounded-md border text-[9.5px] sm:text-[10.5px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                formPriority === p
                                  ? 'bg-[#1b4332] text-white border-[#1b4332]'
                                  : 'bg-[#f7f9f7] text-[#52605d] border-[#e2ece2] hover:bg-[#e2ece2]'
                              }`}
                            >
                              <span>{p}</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div>
                      <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                        Description / Body <span className="text-rose-600">*</span>
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        placeholder="Write details about the update or church event..."
                        className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] resize-none"
                      />
                    </div>

                    {/* Facebook Post Link / Embed URL */}
                    <div>
                      <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <img src="/fb.ico" alt="FB" className="w-3 h-3 object-contain" />
                          <span>Embed FB Link (Optional)</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        value={formFacebookUrl}
                        onChange={(e) => setFormFacebookUrl(e.target.value)}
                        placeholder="https://facebook.com/..."
                        className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>

                    {/* Author Name & Role Fields */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                          Author Name
                        </label>
                        <input
                          type="text"
                          value={formAuthorName}
                          onChange={(e) => setFormAuthorName(e.target.value)}
                          className="w-full px-2 py-1 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332]"
                        />
                      </div>
                      <div>
                        <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                          Author Role
                        </label>
                        <input
                          type="text"
                          value={formAuthorRole}
                          onChange={(e) => setFormAuthorRole(e.target.value)}
                          className="w-full px-2 py-1 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332]"
                        />
                      </div>
                    </div>

                    {/* Pin Checkbox */}
                    <label className="flex items-center gap-1.5 p-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] cursor-pointer hover:bg-[#e2ece2]/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formPinned}
                        onChange={(e) => setFormPinned(e.target.checked)}
                        className="w-3 h-3 rounded text-[#2d6a4f] focus:ring-[#2d6a4f] accent-[#1b4332]"
                      />
                      <div className="flex items-center gap-1 text-[10px] font-bold text-[#1b4332]">
                        <Pin className="w-3 h-3 text-amber-600" />
                        <span>Pin to top as bulletin</span>
                      </div>
                    </label>
                  </div>

                  {/* Form Buttons Footer */}
                  <div className="p-2 sm:p-2.5 border-t border-[#e2ece2] bg-[#fafcfa] flex items-center justify-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-[11px] cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-lg bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-[11px] shadow-sm cursor-pointer transition-all flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-[#74c69d]" />
                      <span>{editingAnn ? 'Save' : 'Publish'}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ModalPortal>

      {/* Modal: Confirm Delete */}
      <ModalPortal>
        <AnimatePresence>
          {deletingId && (
            <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 border border-[#e2ece2] shadow-2xl relative"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading font-extrabold text-[#1b4332] text-base">
                    Delete Announcement?
                  </h3>
                  <p className="text-xs text-[#52605d]">
                    Are you sure you want to delete this bulletin? This action cannot be undone.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingId(null)}
                    className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(deletingId)}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    Yes, Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ModalPortal>
    </div>
  );
};
