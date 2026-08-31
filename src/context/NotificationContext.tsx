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
  getSeenNotificationIds,
  markNotificationsAsSeen,
  clearSeenNotificationIds,
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
   * Compiles them into a Thread ONLY if genuinely new, unseen updates exist.
   */
  const checkForMissedNotifications = useCallback(async (force: boolean = false) => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const userId = getCurrentUserId();
      const userState = getUserNotificationState(userId);
      const seenIds = getSeenNotificationIds(userId);
      const currentStoreNotifs = store.getNotifications();
      const storeIds = new Set(currentStoreNotifs.map((n) => n.id));

      // Also ensure all existing store IDs are tracked as seen in memory
      currentStoreNotifs.forEach((n) => seenIds.add(n.id));

      // Determine baseline since timestamp
      let sinceTimestamp = Math.max(userState.lastClearedAt || 0, userState.lastCheckedAt || 0);

      // If user has no recorded check timestamp yet, set baseline to now so we don't spam historical seed items
      if (sinceTimestamp <= 0) {
        const now = Date.now();
        saveUserNotificationState(userId, { lastCheckedAt: now, lastClearedAt: 0 });
        markNotificationsAsSeen(userId, currentStoreNotifs.map((n) => n.id));
        return;
      }

      const missedList = await fetchMissedNotifications(sinceTimestamp, 30);
      const now = Date.now();
      saveUserNotificationState(userId, { lastCheckedAt: now });

      if (missedList && missedList.length > 0) {
        // Filter out items already seen or already in local store unless force is explicitly passed
        const newItems = force
          ? missedList
          : missedList.filter((item) => !seenIds.has(item.id) && !storeIds.has(item.id));

        if (newItems.length > 0) {
          // Record seen IDs persistently in localStorage
          markNotificationsAsSeen(userId, newItems.map((item) => item.id));

          // Merge into local store if not already present
          const itemsToAdd = newItems.filter((item) => !storeIds.has(item.id));

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

          // Deliver as a cohesive Thread ONLY for actually new notifications
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
        const userId = getCurrentUserId();
        if (detail.id) {
          markNotificationsAsSeen(userId, [detail.id]);
        }
        if (detail.threadItems && Array.isArray(detail.threadItems)) {
          markNotificationsAsSeen(userId, detail.threadItems.map((t: any) => t.id));
        }
        saveUserNotificationState(userId, { lastCheckedAt: Date.now() });

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
    const newNotif = store.addNotification({
      title,
      message,
      type,
      tab,
      read: false,
    });
    const userId = getCurrentUserId();
    markNotificationsAsSeen(userId, [newNotif.id]);
    saveUserNotificationState(userId, { lastCheckedAt: Date.now() });
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
    const userId = getCurrentUserId();
    markNotificationsAsSeen(userId, [id]);
    saveUserNotificationState(userId, { lastCheckedAt: Date.now() });
    refreshNotifs();
  };

  const markAllAsRead = () => {
    store.markAllNotificationsRead();
    const userId = getCurrentUserId();
    const currentStoreNotifs = store.getNotifications();
    markNotificationsAsSeen(userId, currentStoreNotifs.map((n) => n.id));
    saveUserNotificationState(userId, { lastCheckedAt: Date.now() });
    refreshNotifs();
  };

  const clearAllNotifications = () => {
    const userId = getCurrentUserId();
    const now = Date.now();
    // Record that the user cleared all notifications at this timestamp
    saveUserNotificationState(userId, { lastClearedAt: now, lastCheckedAt: now });
    clearSeenNotificationIds(userId);
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
