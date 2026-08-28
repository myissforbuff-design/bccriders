import React, { createContext, useContext, useState, useEffect } from 'react';
import { NotificationItem } from '../types';
import { store } from '../lib/db';
import {
  registerServiceWorker,
  requestPushPermission as requestPushPermissionLib,
  getPushNotificationConfig,
  savePushNotificationConfig,
  initPushNotifications,
  syncPushSubscriptionWithServer,
} from '../lib/pushNotifications';

export interface ToastNotificationPayload {
  title: string;
  message: string;
  type?: string;
  tab?: string;
  appName?: string;
  icon?: string;
  timeAgo?: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  pushEnabled: boolean;
  requestPushPermission: () => Promise<boolean>;
  togglePushNotifications: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  triggerPushAlert: (title: string, message: string, type?: NotificationItem['type'], tab?: string) => void;
  toastMessage: ToastNotificationPayload | null;
  clearToast: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => store.getNotifications());
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    return getPushNotificationConfig().enabled;
  });
  const [toastMessage, setToastMessage] = useState<ToastNotificationPayload | null>(null);

  const refreshNotifs = () => {
    setNotifications([...store.getNotifications()]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    // Register service worker on startup
    registerServiceWorker();

    // If permission is already granted, ensure config is active and synced with server
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      setPushEnabled(true);
      const conf = getPushNotificationConfig();
      if (!conf.enabled) {
        savePushNotificationConfig({ ...conf, enabled: true });
      }
      initPushNotifications();
      syncPushSubscriptionWithServer();
    }

    // Listen for push notifications triggered across tabs / components
    const handleInAppAlert = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      if (detail) {
        setToastMessage({
          title: detail.title || 'BCC Riders Club Update',
          message: detail.body || detail.message || '',
          type: detail.category || 'general',
          tab: detail.tab,
          appName: 'BCC Riders',
          icon: detail.icon || '/logo.png',
          timeAgo: 'Just now',
        });
        refreshNotifs();
      }
    };

    // Listen for service worker navigation messages
    const handleSwMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'BCC_PUSH_NAVIGATE') {
        const targetTab = e.data.tab;
        if (targetTab) {
          localStorage.setItem('bcc_active_tab', targetTab);
          window.location.hash = targetTab;
          window.dispatchEvent(new CustomEvent('bcc_tab_navigate', { detail: targetTab }));
        }
      }
    };

    const handleConfigChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setPushEnabled(customEvent.detail.enabled);
      }
    };

    window.addEventListener('bcc_inapp_push_alert', handleInAppAlert);
    window.addEventListener('bcc_push_config_changed', handleConfigChange);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      window.removeEventListener('bcc_inapp_push_alert', handleInAppAlert);
      window.removeEventListener('bcc_push_config_changed', handleConfigChange);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  const requestPushPermission = async (): Promise<boolean> => {
    const granted = await requestPushPermissionLib();
    setPushEnabled(granted);
    return granted;
  };

  const togglePushNotifications = () => {
    const nextState = !pushEnabled;
    setPushEnabled(nextState);
    const conf = getPushNotificationConfig();
    savePushNotificationConfig({ ...conf, enabled: nextState });
    if (nextState) {
      requestPushPermission();
    }
  };

  const triggerPushAlert = (
    title: string,
    message: string,
    type: NotificationItem['type'] = 'ride',
    tab?: string
  ) => {
    // Add to store
    store.addNotification({
      title,
      message,
      type,
      read: false,
    });
    refreshNotifs();

    // Trigger Toast banner matching reference image style
    setToastMessage({
      title,
      message,
      type,
      tab,
      appName: 'BCC Riders',
      icon: '/logo.png',
      timeAgo: 'Just now',
    });

    // Trigger Native Browser Notification if enabled
    if (pushEnabled && 'Notification' in window && window.Notification.permission === 'granted') {
      try {
        new window.Notification(`BCC Riders Club: ${title}`, {
          body: message,
          icon: '/logo.png',
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
