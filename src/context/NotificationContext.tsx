import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  NotificationItem,
  PushNotificationSettings,
  PushNotificationCategory,
  PushNotificationMode,
  TriggerPushOptions,
} from '../types';
import { store } from '../lib/db';
import { loadFromSession, saveToSession } from '../lib/storageSecurity';

const PUSH_SETTINGS_KEY = 'bcc_push_notification_settings_v2';

const DEFAULT_PUSH_SETTINGS: PushNotificationSettings = {
  masterEnabled: true,
  mode: 'all',
  notifyFinance: true,
  notifyMembers: true,
  notifyActivities: true,
  notifyAnnouncements: true,
  soundEnabled: true,
  vibrateEnabled: true,
};

interface ToastState {
  title: string;
  message: string;
  category?: PushNotificationCategory;
  type?: string;
  actionUrl?: string;
}

export interface TestPushResult {
  success: boolean;
  nativeDelivered: boolean;
  permission: NotificationPermission | 'unsupported';
  isInIframe: boolean;
  message: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  pushEnabled: boolean;
  pushSettings: PushNotificationSettings;
  permission: NotificationPermission | 'unsupported';
  isSupported: boolean;
  isInIframe: boolean;
  swRegistered: boolean;
  requestPushPermission: () => Promise<boolean>;
  togglePushNotifications: () => Promise<void>;
  updatePushSettings: (settings: Partial<PushNotificationSettings>) => void;
  sendTestPushNotification: () => Promise<TestPushResult>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearNotifications: () => void;
  triggerPushAlert: (
    optionsOrTitle: TriggerPushOptions | string,
    legacyMessage?: string,
    legacyType?: NotificationItem['type']
  ) => void;
  toastMessage: ToastState | null;
  clearToast: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Web Audio API Motorcycle Engine Start & Rev sound effect
const playPushChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // Distortion / Overdrive Curve for engine mechanical growl
    const makeDistortionCurve = (amount = 25) => {
      const k = typeof amount === 'number' ? amount : 50;
      const n_samples = 44100;
      const curve = new Float32Array(n_samples);
      const deg = Math.PI / 180;
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
      return curve;
    };

    const distortion = ctx.createWaveShaper();
    distortion.curve = makeDistortionCurve(22);
    distortion.oversample = '2x';

    // Master volume bus
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, now);
    masterGain.gain.linearRampToValueAtTime(0.4, now + 0.8);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    // Resonant lowpass filter to model motorcycle exhaust muffler
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.linearRampToValueAtTime(420, now + 0.38);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.8); // Throttle rev open
    filter.frequency.exponentialRampToValueAtTime(280, now + 1.75); // Settle down
    filter.Q.setValueAtTime(3.2, now);

    // Noise generator for starter crank & exhaust puffs
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(320, now);
    noiseFilter.Q.setValueAtTime(2.2, now);

    const noiseGain = ctx.createGain();
    // 3 starter clicks/cranks
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.setValueAtTime(0.18, now + 0.04);
    noiseGain.gain.setValueAtTime(0.01, now + 0.1);
    noiseGain.gain.setValueAtTime(0.24, now + 0.16);
    noiseGain.gain.setValueAtTime(0.01, now + 0.23);
    noiseGain.gain.setValueAtTime(0.28, now + 0.29);
    noiseGain.gain.setValueAtTime(0.01, now + 0.36);
    // Ignition burst
    noiseGain.gain.setValueAtTime(0.25, now + 0.42);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(filter);
    whiteNoise.start(now);
    whiteNoise.stop(now + 1.8);

    // Twin cylinder oscillators for engine throbbing
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const subOsc = ctx.createOscillator();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    subOsc.type = 'sawtooth';

    // Frequency sweeps: Starter Crank -> Ignition Catch -> VROOOM Rev -> Idle Throb
    osc1.frequency.setValueAtTime(34, now);
    osc1.frequency.linearRampToValueAtTime(44, now + 0.36);
    osc1.frequency.exponentialRampToValueAtTime(148, now + 0.8); // VROOM!
    osc1.frequency.linearRampToValueAtTime(118, now + 1.15);
    osc1.frequency.exponentialRampToValueAtTime(54, now + 1.75); // Idle

    osc2.frequency.setValueAtTime(50, now);
    osc2.frequency.linearRampToValueAtTime(66, now + 0.36);
    osc2.frequency.exponentialRampToValueAtTime(220, now + 0.8);
    osc2.frequency.linearRampToValueAtTime(175, now + 1.15);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 1.75);

    subOsc.frequency.setValueAtTime(26, now);
    subOsc.frequency.exponentialRampToValueAtTime(74, now + 0.8);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 1.75);

    // Gain envelope for the motor engine
    const engineGain = ctx.createGain();
    engineGain.gain.setValueAtTime(0.06, now);
    engineGain.gain.setValueAtTime(0.18, now + 0.08);
    engineGain.gain.setValueAtTime(0.08, now + 0.2);
    engineGain.gain.setValueAtTime(0.22, now + 0.3);
    // Ignition catches!
    engineGain.gain.linearRampToValueAtTime(0.48, now + 0.44);
    engineGain.gain.linearRampToValueAtTime(0.62, now + 0.8);
    engineGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    osc1.connect(distortion);
    osc2.connect(distortion);
    subOsc.connect(distortion);
    distortion.connect(engineGain);
    engineGain.connect(filter);

    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    subOsc.start(now);

    osc1.stop(now + 1.8);
    osc2.stop(now + 1.8);
    subOsc.stop(now + 1.8);
  } catch {
    // AudioContext autoplay fallback
  }
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => store.getNotifications());
  const [toastMessage, setToastMessage] = useState<ToastState | null>(null);
  const [swRegistered, setSwRegistered] = useState(false);

  // Push Settings State
  const [pushSettings, setPushSettings] = useState<PushNotificationSettings>(() => {
    try {
      const saved = localStorage.getItem(PUSH_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_PUSH_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_PUSH_SETTINGS;
  });

  // Check if running inside iframe
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Browser Permission State
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return window.Notification.permission;
  });

  // Keep permission status updated
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(window.Notification.permission);
    }
  }, []);

  // Ensure Service Worker is registered
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => setSwRegistered(true))
        .catch(() => {
          navigator.serviceWorker
            .register('/sw.js')
            .then(() => setSwRegistered(true))
            .catch(() => setSwRegistered(false));
        });
    }
  }, []);

  const refreshNotifs = useCallback(() => {
    setNotifications([...store.getNotifications()]);
  }, []);

  // Listen to external store updates and push alert events
  useEffect(() => {
    const handleUpdate = () => refreshNotifs();
    const handlePushEvent = (e: Event) => {
      const customEvent = e as CustomEvent<TriggerPushOptions>;
      if (customEvent.detail) {
        triggerPushAlert(customEvent.detail);
      }
    };

    window.addEventListener('storage', handleUpdate);
    window.addEventListener('bcc_notifications_updated', handleUpdate);
    window.addEventListener('bcc_push_alert', handlePushEvent);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('bcc_notifications_updated', handleUpdate);
      window.removeEventListener('bcc_push_alert', handlePushEvent);
    };
  }, [refreshNotifs]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const pushEnabled = pushSettings.masterEnabled;

  // Request native permission
  const requestPushPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      updatePushSettings({ masterEnabled: true });
      return true;
    }

    try {
      if (typeof window.Notification.requestPermission === 'function') {
        const perm = await window.Notification.requestPermission();
        setPermission(perm);
        const granted = perm === 'granted';
        if (granted) {
          updatePushSettings({ masterEnabled: true });
        }
        return granted;
      }
    } catch (err) {
      console.warn('Notification permission request was blocked or restricted (e.g. iframe context):', err);
    }
    return false;
  };

  const updatePushSettings = (newSettings: Partial<PushNotificationSettings>) => {
    setPushSettings((prev) => {
      const updated = {
        ...prev,
        ...newSettings,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(PUSH_SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const togglePushNotifications = async () => {
    if (!pushSettings.masterEnabled) {
      if (permission === 'default' && isSupported && !isInIframe) {
        await requestPushPermission();
      }
      updatePushSettings({ masterEnabled: true });
    } else {
      updatePushSettings({ masterEnabled: false });
    }
  };

  const triggerPushAlert = (
    optionsOrTitle: TriggerPushOptions | string,
    legacyMessage?: string,
    legacyType?: NotificationItem['type']
  ) => {
    let opts: TriggerPushOptions;

    if (typeof optionsOrTitle === 'string') {
      let derivedCat: PushNotificationCategory = 'system';
      if (legacyType === 'due') derivedCat = 'finance';
      else if (legacyType === 'ride' || legacyType === 'meeting') derivedCat = 'activities';
      else if (legacyType === 'social') derivedCat = 'announcements';

      opts = {
        title: optionsOrTitle,
        message: legacyMessage || '',
        type: legacyType || 'system',
        category: derivedCat,
      };
    } else {
      opts = optionsOrTitle;
    }

    const {
      title,
      message,
      category = 'system',
      type = 'system',
      userId,
      actionUrl,
    } = opts;

    // Check Current User for Targeted vs Broadcast Scope
    const currentUser = store.getCurrentUser();
    if (pushSettings.mode === 'targeted') {
      if (userId && currentUser && userId !== currentUser.id) {
        // Not targeted to this user in targeted mode
        return;
      }
    }

    // Check category preferences if in custom mode
    if (pushSettings.mode === 'custom' || pushSettings.mode === 'targeted') {
      if (category === 'finance' && !pushSettings.notifyFinance) return;
      if (category === 'members' && !pushSettings.notifyMembers) return;
      if (category === 'activities' && !pushSettings.notifyActivities) return;
      if (category === 'announcements' && !pushSettings.notifyAnnouncements) return;
    }

    // 1. Add notification to Store
    const saved = store.addNotification({
      title,
      message,
      type,
      category,
      userId,
      actionUrl,
      read: false,
    });
    refreshNotifs();

    // 2. Play Audio Tone if enabled
    if (pushSettings.soundEnabled) {
      playPushChime();
    }

    // 3. Vibrate device if supported and enabled
    if (pushSettings.vibrateEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {}
    }

    // 4. In-App Toast Banner
    setToastMessage({
      title,
      message,
      category,
      type,
      actionUrl,
    });

    // 5. Trigger Native Browser / Service Worker Notification if enabled
    if (pushSettings.masterEnabled && permission === 'granted') {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const icon = origin ? `${origin}/logo.png` : '/logo.png';
      const badge = origin ? `${origin}/logo.png` : '/logo.png';
      const notificationTitle = `BCC Riders Club: ${title}`;

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((reg) => {
            const notifOptions: any = {
              body: message,
              icon,
              badge,
              tag: `bcc-notif-${category}-${Date.now()}`,
              renotify: true,
              data: {
                url: actionUrl || '/',
                category,
                id: saved.id,
              },
            };
            reg.showNotification(notificationTitle, notifOptions);
          })
          .catch(() => {
            try {
              new window.Notification(notificationTitle, {
                body: message,
                icon,
              });
            } catch {}
          });
      } else if (isSupported) {
        try {
          new window.Notification(notificationTitle, {
            body: message,
            icon,
          });
        } catch {}
      }
    }
  };

  const sendTestPushNotification = async (): Promise<TestPushResult> => {
    let currentPerm = permission;

    if (isSupported && currentPerm === 'default' && !isInIframe) {
      try {
        const res = await window.Notification.requestPermission();
        setPermission(res);
        currentPerm = res;
      } catch (e) {
        console.warn('Notification permission request skipped:', e);
      }
    }

    // Always trigger Push Alert (adds to feed, triggers motorcycle engine sound, haptic feedback, and toast banner)
    triggerPushAlert({
      title: 'Push Alert Test Successful',
      message: 'Web Push & Club Alerts are active. Motorcycle engine sound, in-app banner, and notification feed updated.',
      category: 'system',
      type: 'system',
    });

    const isNativeGranted = currentPerm === 'granted';

    let msg = 'Test alert triggered! Motorcycle engine sound, vibration, and in-app banner delivered.';
    if (isNativeGranted) {
      msg = 'Test push notification sent! Delivered to your OS notification tray, with in-app banner and engine audio.';
    } else if (isInIframe) {
      msg = 'In-App push alert delivered with engine sound! (Browser is in a preview frame. Open in full tab for OS-level background tray push).';
    } else if (currentPerm === 'denied') {
      msg = 'In-App push alert delivered with engine sound! Browser OS notifications are currently blocked in site settings.';
    }

    return {
      success: true,
      nativeDelivered: isNativeGranted,
      permission: currentPerm,
      isInIframe,
      message: msg,
    };
  };

  const markAsRead = (id: string) => {
    store.markNotificationRead(id);
    refreshNotifs();
  };

  const markAllAsRead = () => {
    store.markAllNotificationsRead();
    refreshNotifs();
  };

  const deleteNotification = (id: string) => {
    store.deleteNotification(id);
    refreshNotifs();
  };

  const clearNotifications = () => {
    try {
      store.clearNotifications();
      setNotifications([]);
      refreshNotifs();
    } catch (err) {
      console.warn('Error clearing notifications:', err);
    }
  };

  const clearToast = () => setToastMessage(null);

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        pushEnabled,
        pushSettings,
        permission,
        isSupported,
        isInIframe,
        swRegistered,
        requestPushPermission,
        togglePushNotifications,
        updatePushSettings,
        sendTestPushNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearNotifications,
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
