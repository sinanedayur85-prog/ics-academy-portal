// ICS Academy Service Worker for PWA & Offline Support
const CACHE_NAME = 'ics-academy-pwa-v13';
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
  if (event.request.method !== 'GET') return;
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('/@vite/') ||
    event.request.url.includes('/src/') ||
    event.request.url.includes('/node_modules/')
  ) {
    return;
  }

  // Always prefer fresh network response so iPad/mobile Home Screen apps stay up-to-date
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).catch(() =>
      caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match('/'))
    )
  );
});
