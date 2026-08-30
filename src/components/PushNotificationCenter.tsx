import React, { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import {
  Bell,
  CheckCheck,
  BellRing,
  BellOff,
  X,
  Calendar,
  DollarSign,
  Megaphone,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PushNotificationCenter: React.FC = () => {
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
  useModalDismiss(isOpen, () => setIsOpen(false));

  const handleRefreshMissed = async () => {
    setIsRefreshing(true);
    try {
      await checkForMissedNotifications(true);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const getIcon = (type?: string, category?: string) => {
    const key = (category || type || '').toLowerCase();
    if (key.includes('finance') || key.includes('due')) {
      return <DollarSign className="w-4 h-4 text-emerald-400" />;
    }
    if (key.includes('activ') || key.includes('ride')) {
      return <Calendar className="w-4 h-4 text-cyan-400" />;
    }
    if (key.includes('sos') || key.includes('emerg')) {
      return <ShieldAlert className="w-4 h-4 text-rose-400" />;
    }
    return <Megaphone className="w-4 h-4 text-amber-400" />;
  };

  const handleItemClick = (item: any) => {
    markAsRead(item.id);
    if (item.tab) {
      localStorage.setItem('bcc_active_tab', item.tab);
      window.location.hash = item.tab;
      window.dispatchEvent(new CustomEvent('bcc_tab_navigate', { detail: item.tab }));
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-700/60 transition-all cursor-pointer"
        title="Push Notification Drawer"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-xs"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-84 sm:w-96 z-50 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl shadow-emerald-950/30 overflow-hidden"
            >
              {/* Header */}
              <div className="p-3.5 sm:p-4 bg-slate-800/70 border-b border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-semibold text-white text-sm sm:text-base flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Notification Thread
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleRefreshMissed}
                    disabled={isRefreshing}
                    className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Check missed updates"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
                  </button>

                  <button
                    onClick={togglePushNotifications}
                    className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                      pushEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                    title={pushEnabled ? 'Push Alerts Active' : 'Enable Push Alerts'}
                  >
                    {pushEnabled ? <BellRing className="w-3.5 h-3.5 text-emerald-400" /> : <BellOff className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="hidden sm:inline">{pushEnabled ? 'Push ON' : 'Push OFF'}</span>
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="px-3.5 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  {notifications.length > 0
                    ? `${notifications.length} update${notifications.length > 1 ? 's' : ''} in thread`
                    : 'All clear'}
                </span>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark read
                    </button>
                  )}

                  {notifications.length > 0 && (
                    <button
                      onClick={clearAllNotifications}
                      className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer font-medium"
                      title="Clear notifications and reset missed thread baseline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {/* Notification Thread List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    <Layers className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                    <p>No new notifications in thread.</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Missed alerts since your last visit will automatically appear here.
                    </p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`p-3 sm:p-3.5 transition-colors cursor-pointer flex gap-3 items-start ${
                        item.read ? 'bg-slate-900/40 hover:bg-slate-800/30' : 'bg-slate-800/40 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 mt-0.5 shrink-0">
                        {getIcon(item.type, item.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-xs font-semibold truncate ${item.read ? 'text-slate-300' : 'text-white'}`}>
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap shrink-0">
                            {item.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {item.message}
                        </p>
                        {item.tab && (
                          <span className="inline-block mt-1 text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.2 rounded font-medium">
                            Tap to open {item.tab}
                          </span>
                        )}
                      </div>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
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
