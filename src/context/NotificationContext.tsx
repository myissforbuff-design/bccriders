import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { NotificationItem } from '../types';
import { store } from '../lib/db';
import {
  registerServiceWorker,
  requestPushPermission as requestPushPermissionLib,
  getPushNotificationConfig,
  savePushNotificationConfig,
  initPushNotifications,
  syncPushSubscriptionWithServer,
  getUserNotificationState,
  saveUserNotificationState,
  fetchMissedNotifications,
  sendThreadedPushNotification,
} from '../lib/pushNotifications';

export interface ToastNotificationPayload {
  title: string;
  message: string;
  type?: string;
  tab?: string;
  appName?: string;
  icon?: string;
  timeAgo?: string;
  isThread?: boolean;
  threadItems?: Array<{
    id: string;
    title: string;
    message: string;
    type?: string;
    category?: string;
    tab?: string;
    timeAgo?: string;
    timestamp?: number | string;
  }>;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  pushEnabled: boolean;
  requestPushPermission: () => Promise<boolean>;
  togglePushNotifications: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAllNotifications: () => void;
  checkForMissedNotifications: (force?: boolean) => Promise<void>;
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
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const isCheckingRef = useRef<boolean>(false);

  const getCurrentUserId = (): string => {
    try {
      const sessionUser = sessionStorage.getItem('bcc_session_user') || localStorage.getItem('bcc_user');
      if (sessionUser) {
        const u = JSON.parse(sessionUser);
        return u.id || u.username || 'guest';
      }
    } catch {}
    return 'guest';
  };

  const refreshNotifs = useCallback(() => {
    setNotifications([...store.getNotifications()]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  /**
   * Checks for notifications that occurred since the last time the user checked/cleared their notifications.
   * Compiles them into a Thread if multiple updates exist.
   */
  const checkForMissedNotifications = useCallback(async (force: boolean = false) => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const userId = getCurrentUserId();
      let { lastClearedAt } = getUserNotificationState(userId);

      // If user has never cleared notifications, set baseline to 24 hours ago
      if (!lastClearedAt || lastClearedAt <= 0) {
        lastClearedAt = Date.now() - 24 * 60 * 60 * 1000;
        saveUserNotificationState(userId, { lastClearedAt });
      }

      const missedList = await fetchMissedNotifications(lastClearedAt, 30);

      if (missedList && missedList.length > 0) {
        // Filter out items already presented in current session unless force is true
        const newItems = force
          ? missedList
          : missedList.filter((item) => !seenNotificationIdsRef.current.has(item.id));

        if (newItems.length > 0) {
          // Record seen IDs
          newItems.forEach((item) => seenNotificationIdsRef.current.add(item.id));

          // Merge into local store if not already present
          const currentStoreNotifs = store.getNotifications();
          const existingIds = new Set(currentStoreNotifs.map((n) => n.id));
          const itemsToAdd = newItems.filter((item) => !existingIds.has(item.id));

          if (itemsToAdd.length > 0) {
            const formattedForStore: NotificationItem[] = itemsToAdd.map((item) => ({
              id: item.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              title: item.title,
              message: item.message || item.body || '',
              type: (item.type as any) || (item.category === 'activities' ? 'ride' : item.category === 'finance' ? 'due' : 'social'),
              category: item.category,
              tab: item.tab,
              tag: item.tag,
              timestamp: item.timestamp
                ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Just now',
              createdAt: item.createdAt || new Date().toISOString(),
              read: false,
            }));

            // Prepend new items to store
            store.setNotifications([...formattedForStore, ...currentStoreNotifs]);
            refreshNotifs();
          }

          // Deliver as a cohesive Thread
          await sendThreadedPushNotification(newItems, false);
        }
      }
    } catch (err) {
      console.warn('[NotificationContext] Catch-up check notice:', err);
    } finally {
      isCheckingRef.current = false;
    }
  }, [refreshNotifs]);

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

    // Initial missed notifications check on mount / login
    checkForMissedNotifications();

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
          isThread: detail.isThread,
          threadItems: detail.threadItems,
        });
        refreshNotifs();
      }
    };

    // Listen for visibility / app resume: when mobile user returns to app from lockscreen / background
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForMissedNotifications();
      }
    };

    const handleFocus = () => {
      checkForMissedNotifications();
    };

    // Listen for user login / account switch events
    const handleUserChanged = () => {
      checkForMissedNotifications(true);
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
    window.addEventListener('bcc_user_session_changed', handleUserChanged);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      window.removeEventListener('bcc_inapp_push_alert', handleInAppAlert);
      window.removeEventListener('bcc_push_config_changed', handleConfigChange);
      window.removeEventListener('bcc_user_session_changed', handleUserChanged);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [checkForMissedNotifications, refreshNotifs]);

  const requestPushPermission = async (): Promise<boolean> => {
    const granted = await requestPushPermissionLib();
    setPushEnabled(granted);
    if (granted) {
      checkForMissedNotifications(true);
    }
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

    // Trigger Toast banner
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

  const clearAllNotifications = () => {
    const userId = getCurrentUserId();
    const now = Date.now();
    // Record that the user cleared all notifications at this timestamp
    saveUserNotificationState(userId, { lastClearedAt: now, lastCheckedAt: now });
    store.clearAllNotifications();
    refreshNotifs();
    setToastMessage(null);
  };

  const clearToast = () => setToastMessage(null);

  // Auto-dismiss toast after delay (longer if thread)
  useEffect(() => {
    if (toastMessage) {
      const delay = toastMessage.isThread ? 8000 : 5000;
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, delay);
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
        clearAllNotifications,
        checkForMissedNotifications,
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
