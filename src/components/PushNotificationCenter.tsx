import React, { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { Bell, CheckCheck, BellRing, BellOff, X, Calendar, DollarSign, MessageSquare, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PushNotificationCenter: React.FC = () => {
  const {
    notifications,
    unreadCount,
    pushEnabled,
    togglePushNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  useModalDismiss(isOpen, () => setIsOpen(false));

  const getIcon = (type: string) => {
    switch (type) {
      case 'ride':
        return <Calendar className="w-4 h-4 text-emerald-400" />;
      case 'due':
        return <DollarSign className="w-4 h-4 text-amber-400" />;
      case 'social':
        return <MessageSquare className="w-4 h-4 text-cyan-400" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-emerald-300" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-700/60 transition-all cursor-pointer"
        title="Notifications"
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
              className="absolute right-0 mt-3 w-80 sm:w-96 z-50 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl shadow-emerald-950/30 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 bg-slate-800/60 border-b border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-semibold text-white text-base">
                    Push Alerts
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
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
                    <span>{pushEnabled ? 'Push ON' : 'Push OFF'}</span>
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
              {unreadCount > 0 && (
                <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex justify-end">
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                </div>
              )}

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => markAsRead(item.id)}
                      className={`p-3.5 transition-colors cursor-pointer flex gap-3 items-start ${
                        item.read ? 'bg-slate-900/40 hover:bg-slate-800/30' : 'bg-slate-800/40 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 mt-0.5">
                        {getIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-xs font-semibold ${item.read ? 'text-slate-300' : 'text-white'}`}>
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">
                            {item.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {item.message}
                        </p>
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
