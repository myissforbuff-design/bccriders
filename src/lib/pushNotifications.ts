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

// Converts base64 URL safe string to Uint8Array for VAPID applicationServerKey
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function syncPushSubscriptionWithServer(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await registerServiceWorker();
    if (!registration) return false;

    // Fetch VAPID Public Key from server
    const keyRes = await fetch('/api/push/vapid-public-key');
    if (!keyRes.ok) return false;
    const { publicKey } = await keyRes.json();
    if (!publicKey) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    if (subscription) {
      // Get current logged-in user from storage
      let currentUser: any = null;
      try {
        const stored = sessionStorage.getItem('bcc_session_user') || localStorage.getItem('bcc_user');
        if (stored) currentUser = JSON.parse(stored);
      } catch {}

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          userId: currentUser?.id || 'usr_guest',
          userName: currentUser?.name || 'Club Rider',
          userAgent: navigator.userAgent,
        }),
      });
      return true;
    }
  } catch (err) {
    console.warn('[Push] Error syncing push subscription with backend:', err);
  }
  return false;
}

export async function unsubscribePushFromServer(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
      return true;
    }
  } catch (err) {
    console.warn('[Push] Unsubscribe error:', err);
  }
  return false;
}

export async function getRegisteredPushDevicesCount(): Promise<{ count: number; activeSockets: number }> {
  try {
    const res = await fetch('/api/push/subscriptions/count');
    if (res.ok) {
      const data = await res.json();
      return { count: data.count || 0, activeSockets: data.activeSockets || 0 };
    }
  } catch {}
  return { count: 0, activeSockets: 0 };
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
      // Register device subscription with backend for background OS push delivery
      await syncPushSubscriptionWithServer();
    }

    return granted;
  } catch (err) {
    console.error('Failed requesting push permission:', err);
    return false;
  }
}

// Auto-sync push registration if already granted
export async function initPushNotifications(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isPushSupported() && Notification.permission === 'granted') {
    void syncPushSubscriptionWithServer();
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

/**
 * Sends a push notification:
 * 1. Triggers local in-app alert card and audio chime on current screen
 * 2. If `broadcast = true` (default), broadcasts to ALL connected mobile and desktop users via:
 *    - Real-time Socket.io channel (instant active screen delivery across devices)
 *    - Web Push standard background push notifications (OS-level delivery to registered phones)
 */
export async function sendPushNotification(
  payload: PushNotificationPayload,
  broadcast: boolean = true
): Promise<boolean> {
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
        }
      } else {
        // Fallback to standard Notification constructor
        new Notification(payload.title, {
          body: payload.body,
          icon: payload.icon || '/bcc_logo.png',
          tag: payload.tag || `bcc-${payload.category}-${Date.now()}`,
        });
      }
    } catch (e) {
      console.warn('Native notification dispatch error:', e);
    }
  }

  // Cross-Device Broadcast to other mobile riders & dashboard users
  if (broadcast && typeof window !== 'undefined') {
    fetch('/api/push/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => console.warn('[Push] Broadcast request error:', err));
  }

  return true;
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
