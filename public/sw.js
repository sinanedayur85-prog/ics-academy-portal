// ICS Academy Service Worker for PWA & Offline Support
const CACHE_NAME = 'ics-academy-pwa-v4';
const PRECACHE_URLS = [
  '/manifest.json',
  '/images/ics-mark.svg',
  '/images/ics-mark-transparent.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Do not intercept non-GET requests, backend API calls, or Vite dev modules
  if (event.request.method !== 'GET') return;
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('/@vite/') ||
    event.request.url.includes('/src/') ||
    event.request.url.includes('/node_modules/')
  ) {
    return;
  }

  // Network-first (no-store) for HTML navigation so fresh index.html is always loaded immediately after a push
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
