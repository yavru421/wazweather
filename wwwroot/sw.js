const CACHE_NAME = "wazweather-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/radar-worker.js",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).then(fetchRes => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request.url, fetchRes.clone());
            return fetchRes;
          });
        });
      }).catch(() => {
        // Fallback or offline page can go here if needed
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


