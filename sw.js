// sw.js — WaZWeather Minimal Service Worker (PWA installability only)
// No push subscription endpoints exist on standalone — all push logic gracefully silenced.

const CACHE_NAME = 'wazweather-v2';
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

// Network-first strategy for navigation requests (HTML), bypassing SW cache for HTML so Edge Worker HTMLRewriter always fires
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin API requests — let them go through directly
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || 
      url.pathname === '/subscribe' || 
      url.pathname === '/unsubscribe' || 
      url.pathname === '/check-weather' ||
      url.pathname === '/telemetry') {
    return;
  }

  // Check if navigation request (HTML document)
  const isNavigation = event.request.mode === 'navigate' || 
                       (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    // ALWAYS fetch navigation requests from network first so Cloudflare Edge HTMLRewriter injects dynamic state
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline fallback: serve cached index.html
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Cache-first for static framework assets (_framework, wasm, css, images)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Push notification handler — supports both payload and payloadless fallback
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let title = 'WaZWeather Alert';
    let body = 'New weather update available.';
    
    if (event.data) {
      try {
        const data = event.data.json();
        title = data.title || title;
        body = data.body || data.message || body;
      } catch (e) {
        // Fallback if data is not JSON
        const text = event.data.text();
        if (text) body = text;
      }
    } else {
      // Fetch latest notification
      try {
        const res = await fetch('/api/latest-notification');
        if (res.ok) {
          const data = await res.json();
          title = data.title || title;
          body = data.message || data.body || body;
        }
      } catch (e) {
        console.error('Failed to fetch latest notification:', e);
      }
    }
    
    await self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'wazweather-alert',
      renotify: true
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
