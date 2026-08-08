import React, { createContext, useContext, useState, useEffect } from 'react';
import { NotificationItem } from '../types';
import { store } from '../lib/db';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  pushEnabled: boolean;
  requestPushPermission: () => Promise<boolean>;
  togglePushNotifications: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  triggerPushAlert: (title: string, message: string, type?: NotificationItem['type']) => void;
  toastMessage: { title: string; message: string; type?: string } | null;
  clearToast: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => store.getNotifications());
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    return localStorage.getItem('bcc_push_enabled') === 'true';
  });
  const [toastMessage, setToastMessage] = useState<{ title: string; message: string; type?: string } | null>(null);

  const refreshNotifs = () => {
    setNotifications([...store.getNotifications()]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const requestPushPermission = async (): Promise<boolean> => {
    if ('Notification' in window) {
      const perm = await window.Notification.requestPermission();
      const granted = perm === 'granted';
      setPushEnabled(granted);
      localStorage.setItem('bcc_push_enabled', String(granted));
      return granted;
    } else {
      setPushEnabled(true);
      localStorage.setItem('bcc_push_enabled', 'true');
      return true;
    }
  };

  const togglePushNotifications = () => {
    const nextState = !pushEnabled;
    setPushEnabled(nextState);
    localStorage.setItem('bcc_push_enabled', String(nextState));
    if (nextState) {
      requestPushPermission();
    }
  };

  const triggerPushAlert = (title: string, message: string, type: NotificationItem['type'] = 'ride') => {
    // Add to store
    store.addNotification({
      title,
      message,
      type,
      read: false,
    });
    refreshNotifs();

    // Trigger Toast
    setToastMessage({ title, message, type });

    // Trigger Native Browser Notification if enabled
    if (pushEnabled && 'Notification' in window && window.Notification.permission === 'granted') {
      try {
        new window.Notification(`BCC Riders Club: ${title}`, {
          body: message,
          icon: '/favicon.ico',
        });
      } catch (err) {
        console.warn('Native notification failed:', err);
      }
    }
  };

  const markAsRead = (id: string) => {
    store.markNotificationRead(id);
    refreshNotifs();
  };

  const markAllAsRead = () => {
    store.markAllNotificationsRead();
    refreshNotifs();
  };

  const clearToast = () => setToastMessage(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        pushEnabled,
        requestPushPermission,
        togglePushNotifications,
        markAsRead,
        markAllAsRead,
        triggerPushAlert,
        toastMessage,
        clearToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
