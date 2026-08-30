const CACHE_NAME = 'bcc-riders-v7';
const PRECACHE_ASSETS = [
  '/',
  '/?source=pwa',
  '/manifest.json',
  '/logo.png',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/pwa-maskable-192.png',
  '/pwa-maskable-512.png',
  '/badge-b.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Precache partial warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
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
  const logoUrl = resolveNotificationUrl('/pwa-icon-512.png');
  const iconUrl = resolveNotificationUrl(data.icon || '/pwa-icon-512.png');
  const badgeUrl = resolveNotificationUrl(data.badge || '/badge-b.svg');

  const options = {
    body: data.body || data.message || 'You have a new update from BCC Riders Club.',
    icon: iconUrl || logoUrl,
    badge: badgeUrl || logoUrl,
    image: data.image ? resolveNotificationUrl(data.image) : undefined,
    tag: data.tag || 'bcc-club-thread',
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
      if (self.clients.openWindow) {
        const urlToOpen = targetTab ? `${targetUrl}#${targetTab}` : targetUrl;
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Network first, then fallback to cache for offline mode
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // Exclude API requests and WebSockets from cache fallback
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful static asset responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Fallback to offline start page if navigation request
          if (event.request.mode === 'navigate') {
            return caches.match('/?source=pwa') || caches.match('/');
          }
          return new Response('Network offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});
