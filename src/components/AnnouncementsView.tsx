import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { store } from '../lib/db';
import { Announcement, AnnouncementPriority } from '../types';
import { useModalDismiss } from '../hooks/useModalDismiss';
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
  Check,
  ExternalLink,
  Share2,
  Globe,
} from 'lucide-react';

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
  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    store.getAnnouncements()
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        priorityDropdownRef.current &&
        !priorityDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPriorityDropdownOpen(false);
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

  const handleSubmit = (e: React.FormEvent) => {
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
  };

  const handleDelete = (id: string) => {
    store.deleteAnnouncement(id);
    refreshAnnouncements();
    setDeletingId(null);
  };

  const handleTogglePin = (id: string) => {
    store.togglePinAnnouncement(id);
    refreshAnnouncements();
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

  const getPriorityBadge = (priority: AnnouncementPriority) => {
    switch (priority) {
      case 'Emergency':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-800',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />,
        };
      case 'Important':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          icon: <Bell className="w-3.5 h-3.5 text-amber-600" />,
        };
      case 'Event':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          icon: <Calendar className="w-3.5 h-3.5 text-emerald-600" />,
        };
      default:
        return {
          bg: 'bg-slate-100 border-slate-200 text-slate-700',
          icon: <Info className="w-3.5 h-3.5 text-slate-500" />,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      
        {/* Admin Action Button */}
        {isAdmin && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4 text-[#74c69d]" />
            <span>Create News Update</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-[#e2ece2] shadow-xs">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search announcements..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
          />
          <Search className="w-4 h-4 text-[#52605d] absolute left-3 top-2.5" />
        </div>

        {/* Priority Filter Interactive Dropdown */}
        <div className="relative w-full sm:w-auto" ref={priorityDropdownRef}>
          <button
            type="button"
            onClick={() => setIsPriorityDropdownOpen((prev) => !prev)}
            className="w-full sm:w-60 flex items-center justify-between gap-2 px-3.5 py-2 bg-[#f7f9f7] hover:bg-[#e8f2e9] text-[#1b4332] rounded-xl border border-[#e2ece2] text-xs font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20"
          >
            <div className="flex items-center gap-2 truncate">
              <Filter className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
              <span className="text-[#52605d] text-[11px] font-normal">Category:</span>
              <span className="font-extrabold truncate">
                {PRIORITY_OPTIONS.find((p) => p.id === selectedPriority)?.label || selectedPriority}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-[#2d6a4f] shrink-0 transition-transform duration-200 ${
                isPriorityDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {isPriorityDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 4, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 left-0 sm:left-auto sm:w-64 top-full z-30 p-1.5 bg-white rounded-2xl border border-[#e2ece2] shadow-xl space-y-1 mt-1 overflow-hidden"
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
                      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-[#1b4332] text-white shadow-xs'
                          : 'hover:bg-[#f0f7f2] text-[#1b4332]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`text-xs font-extrabold truncate ${isSelected ? 'text-white' : 'text-[#1b4332]'}`}>
                          {opt.label}
                        </p>
                        <p className={`text-[10px] truncate ${isSelected ? 'text-[#d8f3dc]' : 'text-[#52605d]'}`}>
                          {opt.description}
                        </p>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#74c69d] shrink-0" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {filteredAnnouncements.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-[#e2ece2] shadow-xs space-y-3">
            <div className="w-14 h-14 bg-[#f7f9f7] rounded-full flex items-center justify-center mx-auto text-[#52605d]">
              <Megaphone className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-extrabold text-[#1b4332] text-base">
              No Announcements Found
            </h3>
            <p className="text-xs text-[#52605d] max-w-sm mx-auto">
              {searchQuery || selectedPriority !== 'All'
                ? 'No bulletins match your current search criteria. Try adjusting your filters.'
                : 'There are no active club announcements posted at this time.'}
            </p>
          </div>
        ) : (
          filteredAnnouncements.map((ann) => {
            const badge = getPriorityBadge(ann.priority);
            return (
              <motion.div
                key={ann.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`bg-white rounded-2xl p-3.5 sm:p-5 border transition-all ${
                  ann.pinned
                    ? 'border-[#2d6a4f] shadow-md bg-gradient-to-br from-white via-white to-[#f0f9f1]'
                    : 'border-[#e2ece2] shadow-xs hover:border-[#2d6a4f]/50'
                }`}
              >
                {/* Top Row: Priority Badge, Pinned Ribbon & Admin Action Buttons */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ann.pinned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold shadow-2xs">
                        <Pin className="w-3 h-3 text-amber-700 fill-amber-700" />
                        <span>Pinned Bulletin</span>
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${badge.bg}`}
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
                        className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                          ann.pinned
                            ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <Pin className={`w-3.5 h-3.5 ${ann.pinned ? 'fill-amber-700' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(ann)}
                        title="Edit Announcement"
                        className="p-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingId(ann.id)}
                        title="Delete Announcement"
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Announcement Title */}
                <h3 className="font-heading text-base sm:text-lg font-extrabold text-[#1b4332] leading-snug mb-2">
                  {ann.title}
                </h3>

                {/* Content */}
                <div className="text-xs sm:text-sm text-[#3d4b49] leading-relaxed whitespace-pre-line mb-3 font-normal">
                  {ann.content}
                </div>

                {/* Embedded Facebook Post Container */}
                {ann.facebookUrl && (
                  <div className="my-3 rounded-xl border border-[#e2ece2] bg-white overflow-hidden shadow-2xs p-1 sm:p-2 flex justify-center min-h-[300px] w-full">
                    <iframe
                      src={getFacebookEmbedSrc(ann.facebookUrl)}
                      width="100%"
                      height="500"
                      style={{ border: 'none', overflow: 'hidden', width: '100%', minHeight: '350px' }}
                      scrolling="no"
                      frameBorder="0"
                      allowFullScreen={true}
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      title={`Embedded Facebook post for ${ann.title}`}
                      className="w-full max-w-[500px] rounded-lg"
                    />
                  </div>
                )}

                {/* Footer: Author Info & Timestamp */}
                <div className="pt-3 border-t border-[#e2ece2] flex items-center justify-between text-[11px] text-[#52605d]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#d8f3dc] text-[#1b4332] font-bold flex items-center justify-center text-[10px] shrink-0">
                      {ann.authorName.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-[#1b4332]">{ann.authorName}</span>
                      {ann.authorRole && (
                        <span className="text-[10px] text-[#2d6a4f] bg-[#d8f3dc] px-1.5 py-0.2 rounded ml-1.5 font-semibold">
                          {ann.authorRole}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[#52605d] font-medium">
                    <Clock className="w-3 h-3 text-[#2d6a4f]" />
                    <span>{ann.createdAt}</span>
                    {ann.updatedAt && <span className="italic text-[10px]">(Edited)</span>}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Modal: Create / Edit Announcement */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-4 sm:p-6 max-w-lg w-full max-h-[88vh] sm:max-h-[88vh] shadow-2xl border border-[#e2ece2] relative flex flex-col my-auto"
            >
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3 shrink-0 pb-3 border-b border-[#e2ece2] pr-8">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0">
                  <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-[#1b4332] text-base sm:text-lg leading-tight">
                    {editingAnn ? 'Edit News Update' : 'Post New Activity Update'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#52605d]">
                    Broadcast official directives and embed Facebook updates
                  </p>
                </div>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0 mt-3">
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 py-1 text-xs">
                  {/* Title */}
                  <div>
                    <label className="font-bold text-[#1b4332] mb-1 block">
                      Update Title <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g., Recent Community Ride & Fellowship Activity"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs sm:text-sm font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>

                  {/* Priority Selector */}
                  <div>
                    <label className="font-bold text-[#1b4332] mb-1 block">
                      Priority Category
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['General', 'Important', 'Event', 'Emergency'] as AnnouncementPriority[]).map(
                        (p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setFormPriority(p)}
                            className={`py-1.5 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                              formPriority === p
                                ? 'bg-[#1b4332] text-white border-[#1b4332] shadow-xs'
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
                    <label className="font-bold text-[#1b4332] mb-1 block">
                      Update Description / Body Content <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder="Write details about the recent activity, event schedule, or church announcement..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs sm:text-sm font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] resize-none"
                    />
                  </div>

                  {/* Facebook Post Link / Embed URL */}
                  <div>
                    <label className="font-bold text-[#1b4332] mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <img src="/fb.ico" alt="FB" className="w-3.5 h-3.5 object-contain" />
                        <span>Embed Facebook Post Link (Optional)</span>
                      </span>
                      <span className="text-[10px] text-[#52605d] font-normal">URL or Iframe</span>
                    </label>
                    <input
                      type="text"
                      value={formFacebookUrl}
                      onChange={(e) => setFormFacebookUrl(e.target.value)}
                      placeholder="e.g., https://www.facebook.com/buhangincommunitychurch/posts/..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                    />
                    <p className="text-[10px] text-[#52605d] mt-1">
                      Paste any Facebook post link or video URL to automatically embed the interactive Facebook player in this update.
                    </p>
                  </div>

                  {/* Author Name & Role Fields */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-bold text-[#1b4332] mb-1 block">
                        Author Name
                      </label>
                      <input
                        type="text"
                        value={formAuthorName}
                        onChange={(e) => setFormAuthorName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#1b4332] mb-1 block">
                        Author Role
                      </label>
                      <input
                        type="text"
                        value={formAuthorRole}
                        onChange={(e) => setFormAuthorRole(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332]"
                      />
                    </div>
                  </div>

                  {/* Pin Checkbox */}
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] cursor-pointer hover:bg-[#e2ece2]/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formPinned}
                      onChange={(e) => setFormPinned(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2d6a4f] focus:ring-[#2d6a4f] accent-[#1b4332]"
                    />
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#1b4332]">
                      <Pin className="w-3.5 h-3.5 text-amber-600" />
                      <span>Pin to top as featured bulletin</span>
                    </div>
                  </label>
                </div>

                {/* Form Buttons Footer */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e2ece2] shrink-0 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 sm:px-5 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{editingAnn ? 'Save Changes' : 'Publish Announcement'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Confirm Delete */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
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
    </div>
  );
};
