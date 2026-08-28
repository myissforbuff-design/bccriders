const CACHE_NAME = 'bcc-riders-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Helper to ensure icon and badge paths are always absolute URLs for OS notifications
function resolveNotificationUrl(path) {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  try {
    return new URL(path, self.location.origin).href;
  } catch (e) {
    return path;
  }
}

// Listen for incoming Push Events
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'BCC Riders Club', body: event.data.text() };
    }
  }

  const title = data.title || 'BCC Riders Club';
  const logoUrl = resolveNotificationUrl('/app-logo.png');
  const iconUrl = resolveNotificationUrl(data.icon || '/app-logo.png');
  const badgeUrl = resolveNotificationUrl(data.badge || '/app-logo.png');

  const options = {
    body: data.body || data.message || 'You have a new update from BCC Riders Club.',
    icon: iconUrl || logoUrl,
    badge: badgeUrl || logoUrl,
    image: data.image ? resolveNotificationUrl(data.image) : undefined,
    tag: data.tag || `bcc-push-${Date.now()}`,
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    vibrate: data.vibrate || [200, 100, 200],
    data: {
      url: data.url || '/',
      tab: data.tab || 'dashboard',
      timestamp: Date.now(),
      type: data.type || 'general',
      ...data.customData,
    },
    actions: data.actions || [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Listen for Notification Clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';
  const targetTab = notificationData.tab;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and post a message with target tab
      for (const client of clientList) {
        if ('focus' in client) {
          if (targetTab) {
            client.postMessage({
              type: 'BCC_PUSH_NAVIGATE',
              tab: targetTab,
              data: notificationData,
            });
          }
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        const urlToOpen = targetTab ? `${targetUrl}#${targetTab}` : targetUrl;
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Cache fallback for offline mode
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
