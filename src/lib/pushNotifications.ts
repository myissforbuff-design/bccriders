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

// Motorcycle Engine Start Audio Synthesizer (Realistic Starter Crank + Ignition Roar + Rev)
export function playMotorcycleStartSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.38, t);
    masterGain.connect(ctx.destination);

    // Distortion/Waveshaper node for authentic engine grit
    const distortion = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = ((3 + 2) * x * 20 * (Math.PI / 180)) / (Math.PI + 2 * Math.abs(x));
    }
    distortion.curve = curve;
    distortion.oversample = '2x';

    // Exhaust Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(3.2, t);
    filter.frequency.setValueAtTime(220, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + 0.2);
    filter.frequency.exponentialRampToValueAtTime(1150, t + 0.48);
    filter.frequency.exponentialRampToValueAtTime(350, t + 0.95);

    distortion.connect(filter);
    filter.connect(masterGain);

    // 1. Starter Cranking & Compression Pulses (crank-crank)
    const starterOsc = ctx.createOscillator();
    const starterGain = ctx.createGain();
    starterOsc.type = 'sawtooth';
    starterOsc.frequency.setValueAtTime(85, t);
    starterOsc.frequency.exponentialRampToValueAtTime(65, t + 0.1);
    starterOsc.frequency.exponentialRampToValueAtTime(95, t + 0.2);
    starterGain.gain.setValueAtTime(0.25, t);
    starterGain.gain.setValueAtTime(0.08, t + 0.09);
    starterGain.gain.setValueAtTime(0.3, t + 0.18);
    starterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    starterOsc.connect(starterGain);
    starterGain.connect(distortion);
    starterOsc.start(t);
    starterOsc.stop(t + 0.28);

    // 2. Starter Mechanical Churn Noise
    const bufferSize = Math.floor(ctx.sampleRate * 0.28);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(480, t);
    noiseFilter.Q.setValueAtTime(2.2, t);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.14, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(t);
    noise.stop(t + 0.26);

    // 3. Engine Ignition & Throttle Rev
    const engineOsc = ctx.createOscillator();
    const engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.setValueAtTime(52, t + 0.18);
    engineOsc.frequency.exponentialRampToValueAtTime(160, t + 0.46);
    engineOsc.frequency.exponentialRampToValueAtTime(95, t + 0.72);
    engineOsc.frequency.exponentialRampToValueAtTime(50, t + 0.98);

    engineGain.gain.setValueAtTime(0.001, t);
    engineGain.gain.setValueAtTime(0.001, t + 0.18);
    engineGain.gain.linearRampToValueAtTime(0.55, t + 0.25);
    engineGain.gain.linearRampToValueAtTime(0.48, t + 0.5);
    engineGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

    engineOsc.connect(engineGain);
    engineGain.connect(distortion);
    engineOsc.start(t + 0.18);
    engineOsc.stop(t + 1.0);

    // 4. Low-End Exhaust Thump & Rumble
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(45, t + 0.2);
    subOsc.frequency.exponentialRampToValueAtTime(80, t + 0.46);
    subOsc.frequency.exponentialRampToValueAtTime(40, t + 0.98);

    subGain.gain.setValueAtTime(0.001, t);
    subGain.gain.setValueAtTime(0.001, t + 0.2);
    subGain.gain.linearRampToValueAtTime(0.35, t + 0.28);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

    subOsc.connect(subGain);
    subGain.connect(masterGain);
    subOsc.start(t + 0.2);
    subOsc.stop(t + 1.0);
  } catch {
    // ignore audio policy errors
  }
}

/**
 * Sends a push notification:
 * 1. Broadcasts to ALL connected mobile and desktop users via:
 *    - Server API (/api/push/broadcast)
 *    - Real-time Socket.io channel (instant active screen delivery across devices)
 *    - Web Push standard background push notifications (OS-level delivery to registered phones)
 * 2. Triggers local in-app alert card and motorcycle sound on current screen if enabled
 */
export async function sendPushNotification(
  payload: PushNotificationPayload,
  broadcast: boolean = true
): Promise<boolean> {
  const config = getPushNotificationConfig();
  const hasPermission = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';

  // 1. Cross-Device Broadcast to all mobile riders & dashboard users
  // (Broadcast should NEVER be blocked by the local sender's personal audio/mute settings)
  if (broadcast && typeof window !== 'undefined') {
    fetch('/api/push/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        icon: payload.icon || '/logo.png',
        badge: payload.badge || '/logo.png',
      }),
    }).catch((err) => console.warn('[Push] Broadcast request error:', err));
  }

  // 2. Local device delivery: check if category is muted locally
  if (payload.category && config.categories && config.categories[payload.category] === false) {
    return true;
  }

  // Check master switch for local presentation (unless permission is granted and enabled)
  const isLocallyEnabled = config.enabled !== false || hasPermission;
  if (!isLocallyEnabled) {
    return true;
  }

  // Dispatch an in-app event so open views can show heads-up banners & alerts
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('bcc_inapp_push_alert', {
        detail: payload,
      })
    );
  }

  // Play motorcycle engine start sound if audio is enabled
  if (config.sound) {
    playMotorcycleStartSound();
  }

  // If Notification permission is granted, display OS notification
  if (hasPermission) {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon || '/logo.png',
            badge: payload.badge || '/logo.png',
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
          icon: payload.icon || '/logo.png',
          tag: payload.tag || `bcc-${payload.category}-${Date.now()}`,
        });
      }
    } catch (e) {
      console.warn('Native notification dispatch error:', e);
    }
  }

  return true;
}

// 1. Finance Transactions Push Alert Trigger (No Emojis, Clean Branding)
export async function triggerFinancePushNotification(
  type: 'collection' | 'expense' | 'income' | 'payment' | string,
  amount: number,
  description: string
): Promise<boolean> {
  const formattedAmount = `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  const title = `Treasury: New ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  const body = `${formattedAmount} — ${description}`;

  return sendPushNotification({
    title,
    body,
    category: 'finance',
    tab: 'finances',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: `finance-${Date.now()}`,
    customData: { amount, type, description },
  });
}

// 2. Member Approvals Push Alert Trigger (No Emojis)
export async function triggerMemberApprovalPushNotification(
  memberName: string,
  approved: boolean
): Promise<boolean> {
  const title = approved ? 'Member Approved' : 'Membership Status Updated';
  const body = approved
    ? `Welcome to BCC Riders! ${memberName} has been officially approved into the club.`
    : `Membership application for ${memberName} was updated.`;

  return sendPushNotification({
    title,
    body,
    category: 'memberApprovals',
    tab: 'members',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: `member-${Date.now()}`,
    customData: { memberName, approved },
  });
}

// 3. Activities & Rides Created Push Alert Trigger (No Emojis)
export async function triggerActivityCreatedPushNotification(
  title: string,
  date: string,
  location?: string
): Promise<boolean> {
  const heading = `New Club Ride: ${title}`;
  const body = location
    ? `Scheduled for ${date} at ${location}. Tap to view itinerary & RSVP!`
    : `Scheduled for ${date}. Tap to view details and join the pack!`;

  return sendPushNotification({
    title: heading,
    body,
    category: 'activities',
    tab: 'rides',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: `activity-${Date.now()}`,
    customData: { title, date, location },
  });
}

// 4. Announcements & Updates Push Alert Trigger (No Emojis)
export async function triggerAnnouncementPushNotification(
  title: string,
  content: string
): Promise<boolean> {
  const heading = `Club Announcement: ${title}`;
  const truncated = content.length > 120 ? `${content.slice(0, 117)}...` : content;

  return sendPushNotification({
    title: heading,
    body: truncated,
    category: 'announcements',
    tab: 'announcements',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: `announcement-${Date.now()}`,
    customData: { title, content },
  });
}

// 5. Emergency SOS Broadcast Push Alert Trigger (No Emojis)
export async function triggerSosPushNotification(
  riderName: string,
  location?: string,
  message?: string
): Promise<boolean> {
  const heading = `EMERGENCY SOS: ${riderName} needs assistance!`;
  const body = location
    ? `Location: ${location}. ${message || 'Immediate assistance requested by rider.'}`
    : `${message || 'Emergency broadcast signal triggered. Tap to view live telemetry and contact rider.'}`;

  return sendPushNotification({
    title: heading,
    body,
    category: 'sos',
    tab: 'dashboard',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: `sos-${Date.now()}`,
    requireInteraction: true,
    customData: { riderName, location, message },
  });
}
