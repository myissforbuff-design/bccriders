import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { store } from '../lib/db';
import { User as UserType } from '../types';
import {
  markNotificationsAsSeen,
  saveUserNotificationState,
} from '../lib/pushNotifications';
import {
  Bell,
  CheckCheck,
  BellRing,
  BellOff,
  X,
  Calendar,
  User,
  Megaphone,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Layers,
  MessageSquare,
  Heart,
  ThumbsUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PushNotificationCenterProps {
  buttonClassName?: string;
}

export const PushNotificationCenter: React.FC<PushNotificationCenterProps> = ({
  buttonClassName,
}) => {
  const {
    notifications,
    unreadCount,
    pushEnabled,
    togglePushNotifications,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    checkForMissedNotifications,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [users, setUsers] = useState<UserType[]>(() => store.getUsers());
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync users list whenever user/member data updates
  useEffect(() => {
    const updateUsers = () => {
      setUsers([...store.getUsers()]);
    };
    window.addEventListener('bcc_users_updated', updateUsers);
    window.addEventListener('bcc_members_updated', updateUsers);
    return () => {
      window.removeEventListener('bcc_users_updated', updateUsers);
      window.removeEventListener('bcc_members_updated', updateUsers);
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Mark all currently listed notifications as seen and update lastCheckedAt when opening center
  useEffect(() => {
    if (isOpen) {
      const user = store.getCurrentUser();
      const userId = user?.id || user?.username || 'guest';
      if (notifications.length > 0) {
        markNotificationsAsSeen(userId, notifications.map((n) => n.id));
      }
      saveUserNotificationState(userId, { lastCheckedAt: Date.now() });
    }
  }, [isOpen, notifications]);

  const handleRefreshMissed = async () => {
    setIsRefreshing(true);
    try {
      await checkForMissedNotifications(true);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  /**
   * Resolves the rider profile associated with a transaction or notification
   */
  const findRiderForNotification = (item: any): UserType | undefined => {
    // 1. Check direct user ID or payer/member ID
    const targetId =
      item.userId ||
      item.memberId ||
      item.customData?.userId ||
      item.customData?.memberId ||
      item.customData?.payerId;
    if (targetId) {
      const u = users.find((usr) => usr.id === targetId);
      if (u) return u;
    }

    // 2. Check direct user name, payer name, or member name
    const rawTargetName =
      item.payerName ||
      item.userName ||
      item.memberName ||
      item.customData?.userName ||
      item.customData?.payerName ||
      item.customData?.memberName;

    if (rawTargetName && typeof rawTargetName === 'string') {
      const cleanTarget = rawTargetName.replace(/^(Bro\.|Sis\.|Brother|Sister|Rider)\s+/i, '').trim().toLowerCase();
      const u = users.find((usr) => {
        const uName = (usr.name || '').toLowerCase();
        const uUser = (usr.username || '').toLowerCase();
        return (
          uName === cleanTarget ||
          uUser === cleanTarget ||
          (cleanTarget.length >= 3 && (uName.includes(cleanTarget) || cleanTarget.includes(uName)))
        );
      });
      if (u) return u;
    }

    // 3. Extract name from parenthesized expressions (e.g., "Membership Fee (Juan Dela Cruz)", "Monthly Due (Bro. Juan)")
    const fullText = `${item.title || ''} ${item.message || ''} ${item.body || ''}`;
    const parenMatch = fullText.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1]) {
      const insideParen = parenMatch[1].replace(/^(Bro\.|Sis\.|Brother|Sister|Rider)\s+/i, '').trim().toLowerCase();
      if (insideParen.length >= 3) {
        const u = users.find((usr) => {
          const uName = (usr.name || '').toLowerCase();
          return uName === insideParen || uName.includes(insideParen) || insideParen.includes(uName);
        });
        if (u) return u;
      }
    }

    // 4. Search in full item message, title, or body for member names, usernames, or member numbers
    const lowerText = fullText.toLowerCase();
    const sortedUsers = [...users].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));

    for (const u of sortedUsers) {
      if (u.name && u.name.length >= 3) {
        const cleanName = u.name.toLowerCase();
        if (lowerText.includes(cleanName)) {
          return u;
        }
      }
      if (u.memberNumber && u.memberNumber.length >= 4) {
        if (lowerText.includes(u.memberNumber.toLowerCase())) {
          return u;
        }
      }
      if (u.username && u.username.length >= 3) {
        if (lowerText.includes(u.username.toLowerCase())) {
          return u;
        }
      }
    }

    return undefined;
  };

  /**
   * Renders the visual badge / rider profile for each notification item
   */
  const renderItemVisual = (item: any) => {
    const key = (item.category || item.type || '').toLowerCase();
    const titleText = (item.title || '').toLowerCase();
    const msgText = (item.message || item.body || '').toLowerCase();

    const isFinanceOrMembershipTransaction =
      key.includes('finance') ||
      key.includes('due') ||
      key.includes('membership') ||
      key.includes('member') ||
      key.includes('fee') ||
      key.includes('collection') ||
      key.includes('payment') ||
      item.tab === 'finances' ||
      item.tab === 'members' ||
      titleText.includes('treasury') ||
      titleText.includes('membership fee') ||
      titleText.includes('member approved') ||
      titleText.includes('membership status') ||
      msgText.includes('membership fee') ||
      msgText.includes('monthly due') ||
      msgText.includes('approved into the club');

    if (isFinanceOrMembershipTransaction) {
      const rider = findRiderForNotification(item);
      const avatarUrl =
        item.avatar ||
        item.customData?.userAvatar ||
        item.customData?.avatar ||
        rider?.avatar;

      const displayName =
        rider?.name ||
        item.customData?.userName ||
        item.customData?.memberName ||
        item.payerName ||
        item.userName ||
        'Rider';

      const cleanDisplayName = displayName.replace(/^(Bro\.|Sis\.|Brother|Sister|Rider)\s+/i, '').trim();
      const nameParts = cleanDisplayName.split(/\s+/).filter(Boolean);
      const initials =
        nameParts.length > 1
          ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
          : (cleanDisplayName.slice(0, 2) || 'RD').toUpperCase();

      if (avatarUrl) {
        return (
          <div className={`relative w-9 h-9 rounded-full overflow-hidden shrink-0 border border-emerald-300 shadow-xs flex items-center justify-center mt-0.5 ${avatarUrl.includes('bcc-logo.png') ? 'bg-white' : 'bg-stone-100'}`}>
            <img
              src={avatarUrl}
              alt={cleanDisplayName}
              className={`w-full h-full ${avatarUrl.includes('bcc-logo.png') ? 'object-contain p-0.5 bg-white' : 'object-cover'}`}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.className =
                    'w-9 h-9 rounded-full bg-[#1b4332] text-white flex items-center justify-center text-[11px] font-bold tracking-wider shrink-0 border border-[#2d6a4f] shadow-xs mt-0.5';
                  parent.innerText = initials;
                }
              }}
            />
          </div>
        );
      }

      if (rider || cleanDisplayName !== 'Rider') {
        return (
          <div
            className="w-9 h-9 rounded-full bg-[#1b4332] text-white flex items-center justify-center text-[11px] font-bold tracking-wider shrink-0 border border-[#2d6a4f] shadow-xs mt-0.5"
            title={cleanDisplayName}
          >
            {initials}
          </div>
        );
      }

      return (
        <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#1b4332] flex items-center justify-center shrink-0 border border-emerald-300 shadow-xs mt-0.5">
          <User className="w-4.5 h-4.5 text-[#1b4332]" />
        </div>
      );
    }

    if (key.includes('activ') || key.includes('ride')) {
      return (
        <div className="p-2 rounded-xl bg-stone-100 border border-stone-200 shrink-0 mt-0.5">
          <Calendar className="w-4 h-4 text-sky-700" />
        </div>
      );
    }

    if (key.includes('sos') || key.includes('emerg')) {
      return (
        <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 shrink-0 mt-0.5">
          <ShieldAlert className="w-4 h-4 text-rose-700" />
        </div>
      );
    }

    // Social Feed / Newsfeed interactions (reactions, comments, replies)
    if (
      key.includes('post_') ||
      key.includes('comment_') ||
      key.includes('reply_') ||
      key.includes('feed') ||
      key.includes('social') ||
      item.customData?.postId
    ) {
      const actorAvatar = item.customData?.actorAvatar;
      const actorName = item.customData?.actorName || 'Member';
      const reactionType = item.customData?.reactionType;

      if (actorAvatar) {
        return (
          <div className="relative shrink-0 mt-0.5">
            <img
              src={actorAvatar}
              alt={actorName}
              className="w-9 h-9 rounded-full object-cover border border-[#b7e4c7] shadow-xs"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />
            {reactionType === 'heart' ? (
              <span className="absolute -bottom-1 -right-1 text-xs">❤️</span>
            ) : reactionType ? (
              <span className="absolute -bottom-1 -right-1 text-xs">👍</span>
            ) : (
              <span className="absolute -bottom-1 -right-1 p-0.5 bg-[#2d6a4f] rounded-full text-white">
                <MessageSquare className="w-2.5 h-2.5" />
              </span>
            )}
          </div>
        );
      }

      if (key.includes('reaction')) {
        return (
          <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 shrink-0 mt-0.5">
            {reactionType === 'heart' ? (
              <Heart className="w-4 h-4 text-rose-600 fill-rose-500" />
            ) : (
              <ThumbsUp className="w-4 h-4 text-[#2d6a4f]" />
            )}
          </div>
        );
      }

      return (
        <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 shrink-0 mt-0.5">
          <MessageSquare className="w-4 h-4 text-[#2d6a4f]" />
        </div>
      );
    }

    return (
      <div className="p-2 rounded-xl bg-stone-100 border border-stone-200 shrink-0 mt-0.5">
        <Megaphone className="w-4 h-4 text-amber-700" />
      </div>
    );
  };

  const handleItemClick = (item: any) => {
    markAsRead(item.id);
    const targetTab = item.tab || (item.customData?.postId ? 'community' : undefined);
    if (targetTab) {
      localStorage.setItem('bcc_active_tab', targetTab);
      window.location.hash = targetTab;
      window.dispatchEvent(new CustomEvent('bcc_tab_navigate', { detail: targetTab }));
      if (item.customData?.postId) {
        window.dispatchEvent(new CustomEvent('bcc_open_newsfeed', { detail: item.customData }));
      }
      setIsOpen(false);
    }
  };

  const defaultButtonClass =
    buttonClassName ||
    'relative p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer';

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={defaultButtonClass}
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-xs">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Click-outside backdrop without screen blurring */}
            <div
              className="fixed inset-0 z-40 bg-black/10 transition-opacity"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-84 sm:w-96 z-50 rounded-2xl bg-white border border-stone-200 shadow-2xl shadow-stone-900/15 overflow-hidden text-stone-900"
            >
              {/* Header */}
              <div className="p-3.5 sm:p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-bold text-stone-900 text-sm sm:text-base flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#1b4332]" />
                    Notification
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-[#1b4332] font-bold border border-emerald-200">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleRefreshMissed}
                    disabled={isRefreshing}
                    className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
                    title="Check missed updates"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#1b4332]' : ''}`} />
                  </button>

                  <button
                    onClick={togglePushNotifications}
                    className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                      pushEnabled
                        ? 'bg-emerald-100 text-[#1b4332] border border-emerald-300'
                        : 'bg-stone-200 text-stone-700 border border-stone-300 hover:bg-stone-300'
                    }`}
                    title={pushEnabled ? 'Push Alerts Active' : 'Enable Push Alerts'}
                  >
                    {pushEnabled ? <BellRing className="w-3.5 h-3.5 text-emerald-600" /> : <BellOff className="w-3.5 h-3.5 text-stone-500" />}
                    <span className="hidden sm:inline">{pushEnabled ? 'Push ON' : 'Push OFF'}</span>
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-stone-400 hover:text-stone-800 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="px-3.5 py-2 bg-stone-50/60 border-b border-stone-200 flex items-center justify-between text-xs">
                <span className="text-[11px] text-stone-500 font-medium">
                  {notifications.length > 0
                    ? `${notifications.length} update${notifications.length > 1 ? 's' : ''}`
                    : 'All clear'}
                </span>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[#1b4332] hover:text-emerald-700 flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark read
                    </button>
                  )}

                  {notifications.length > 0 && (
                    <button
                      onClick={clearAllNotifications}
                      className="text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer font-semibold"
                      title="Clear notifications"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-stone-100 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 text-sm">
                    <Layers className="w-8 h-8 mx-auto text-stone-300 mb-2" />
                    <p className="font-semibold text-stone-700">No new notifications.</p>
                    <p className="text-xs text-stone-400 mt-1">
                      Missed alerts will automatically appear here.
                    </p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`p-3 sm:p-3.5 transition-colors cursor-pointer flex gap-3 items-start ${
                        item.read ? 'bg-white hover:bg-stone-50' : 'bg-emerald-50/40 hover:bg-emerald-50/70'
                      }`}
                    >
                      {renderItemVisual(item)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-xs truncate ${item.read ? 'font-semibold text-stone-800' : 'font-extrabold text-stone-950'}`}>
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-stone-400 whitespace-nowrap shrink-0 font-medium">
                            {item.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 mt-0.5 line-clamp-2 leading-relaxed font-normal">
                          {item.message}
                        </p>
                        {item.tab && (
                          <span className="inline-block mt-1 text-[10px] text-[#1b4332] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                            Tap to open {item.tab}
                          </span>
                        )}
                      </div>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

