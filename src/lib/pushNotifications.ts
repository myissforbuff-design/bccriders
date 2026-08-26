export interface PushNotificationConfig {
  enabled: boolean;
  categories: {
    finance: boolean;
    memberApprovals: boolean;
    activities: boolean;
    announcements: boolean;
    sos: boolean;
  };
  sound: boolean;
  vibration: boolean;
}

export const DEFAULT_PUSH_CONFIG: PushNotificationConfig = {
  enabled: true,
  categories: {
    finance: true,
    memberApprovals: true,
    activities: true,
    announcements: true,
    sos: true,
  },
  sound: true,
  vibration: true,
};

const STORAGE_KEY = 'bcc_push_notification_config_v1';

export function getPushNotificationConfig(): PushNotificationConfig {
  if (typeof window === 'undefined') return DEFAULT_PUSH_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PUSH_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PUSH_CONFIG,
      ...parsed,
      categories: {
        ...DEFAULT_PUSH_CONFIG.categories,
        ...(parsed.categories || {}),
      },
    };
  } catch (e) {
    console.error('Failed to parse push notification config:', e);
    return DEFAULT_PUSH_CONFIG;
  }
}

export function savePushNotificationConfig(config: PushNotificationConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('bcc_push_config_changed', { detail: config }));
  } catch (e) {
    console.error('Failed to save push notification config:', e);
  }
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function getPushPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  try {
    await registerServiceWorker();
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';

    if (granted) {
      const current = getPushNotificationConfig();
      savePushNotificationConfig({ ...current, enabled: true });
    }

    return granted;
  } catch (err) {
    console.error('Failed requesting push permission:', err);
    return false;
  }
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  category: keyof PushNotificationConfig['categories'];
  icon?: string;
  badge?: string;
  url?: string;
  tab?: string;
  tag?: string;
  requireInteraction?: boolean;
  customData?: Record<string, any>;
}

export async function sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
  const config = getPushNotificationConfig();

  // Check master switch
  if (!config.enabled) {
    return false;
  }

  // Check category switch
  if (payload.category && !config.categories[payload.category]) {
    return false;
  }

  // Dispatch an in-app event so open views can show toasts/alerts
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('bcc_inapp_push_alert', {
        detail: payload,
      })
    );
  }

  // Play audio chime if enabled
  if (config.sound && typeof window !== 'undefined' && typeof Audio !== 'undefined') {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // ignore audio context policy errors
    }
  }

  // If Notification permission is granted, display OS notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon || '/bcc_logo.png',
            badge: payload.badge || '/bcc_logo.png',
            tag: payload.tag || `bcc-${payload.category}-${Date.now()}`,
            vibrate: config.vibration ? [200, 100, 200] : undefined,
            data: {
              url: payload.url || '/',
              tab: payload.tab,
              type: payload.category,
              customData: payload.customData,
            },
          } as any);
          return true;
        }
      }

      // Fallback to standard Notification constructor
      new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/bcc_logo.png',
        tag: payload.tag || `bcc-${payload.category}-${Date.now()}`,
      });
      return true;
    } catch (e) {
      console.warn('Native notification dispatch error:', e);
    }
  }

  return false;
}

// 1. Finance Transactions Push Alert Trigger
export async function triggerFinancePushNotification(
  type: 'collection' | 'expense' | 'income' | 'payment' | string,
  amount: number,
  description: string
): Promise<boolean> {
  const formattedAmount = `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  const title = `💰 Treasury: New ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  const body = `${formattedAmount} — ${description}`;

  return sendPushNotification({
    title,
    body,
    category: 'finance',
    tab: 'finances',
    tag: `finance-${Date.now()}`,
    customData: { amount, type, description },
  });
}

// 2. Member Approvals Push Alert Trigger
export async function triggerMemberApprovalPushNotification(
  memberName: string,
  approved: boolean
): Promise<boolean> {
  const title = approved ? '👤 Member Approved!' : '👤 Membership Status Updated';
  const body = approved
    ? `Welcome to BCC Riders! ${memberName} has been officially approved into the club.`
    : `Membership application for ${memberName} was updated.`;

  return sendPushNotification({
    title,
    body,
    category: 'memberApprovals',
    tab: 'members',
    tag: `member-${Date.now()}`,
    customData: { memberName, approved },
  });
}

// 3. Activities & Rides Created Push Alert Trigger
export async function triggerActivityCreatedPushNotification(
  title: string,
  date: string,
  location?: string
): Promise<boolean> {
  const heading = `🏍️ New Club Ride: ${title}`;
  const body = location
    ? `Scheduled for ${date} at ${location}. Tap to view itinerary & RSVP!`
    : `Scheduled for ${date}. Tap to view details and join the pack!`;

  return sendPushNotification({
    title: heading,
    body,
    category: 'activities',
    tab: 'rides',
    tag: `activity-${Date.now()}`,
    customData: { title, date, location },
  });
}

// 4. Announcements & Updates Push Alert Trigger
export async function triggerAnnouncementPushNotification(
  title: string,
  content: string
): Promise<boolean> {
  const heading = `📢 Club Announcement: ${title}`;
  const truncated = content.length > 120 ? `${content.slice(0, 117)}...` : content;

  return sendPushNotification({
    title: heading,
    body: truncated,
    category: 'announcements',
    tab: 'announcements',
    tag: `announcement-${Date.now()}`,
    customData: { title, content },
  });
}

// 5. Emergency SOS Broadcast Push Alert Trigger
export async function triggerSosPushNotification(
  riderName: string,
  location?: string,
  message?: string
): Promise<boolean> {
  const heading = `🚨 EMERGENCY SOS: ${riderName} needs assistance!`;
  const body = location
    ? `Location: ${location}. ${message || 'Immediate assistance requested by rider.'}`
    : `${message || 'Emergency broadcast signal triggered. Tap to view live telemetry and contact rider.'}`;

  return sendPushNotification({
    title: heading,
    body,
    category: 'sos',
    tab: 'dashboard',
    tag: `sos-${Date.now()}`,
    requireInteraction: true,
    customData: { riderName, location, message },
  });
}
