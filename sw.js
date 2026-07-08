// sw.js — WaZWeather Minimal Service Worker (PWA installability only)
// No push subscription endpoints exist on standalone — all push logic gracefully silenced.

const CACHE_NAME = 'wazweather-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/radar-worker.js',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Silently ignore cache failures (network-first anyway)
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Network-first strategy: always try network, fall back to cache for HTML
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin API requests — let them go through directly
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful same-origin responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback: serve from cache
        return caches.match(event.request).then(cached => {
          return cached || caches.match('/index.html');
        });
      })
  );
});

// Push notification handler — gracefully no-op on standalone
// (no /subscribe or /unsubscribe endpoints exist)
self.addEventListener('push', event => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'WaZWeather Alert', {
        body: data.body || 'New weather update available.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'wazweather-alert',
        renotify: true
      })
    );
  } catch(e) {
    // Ignore malformed push data
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
