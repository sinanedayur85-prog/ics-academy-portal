// ICS Academy Service Worker for Instant Black Launch & Offline Support
const CACHE_NAME = 'ics-academy-pwa-v26';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/ics-mark.svg',
  '/images/ics-mark-transparent.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(url, { cache: 'reload' }).then((res) => {
            if (res && res.ok) {
              return cache.put(url, res);
            }
          })
        )
      );
    })
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

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // 1. Navigation requests ('/' or '/index.html'):
  // Serve cached HTML immediately (<5ms) so the WebView paints #0A0B0E black while
  // the splash screen is still visible (eliminating any old native green WebView flash),
  // and revalidate/update the cache in the background.
  if (
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html'
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedNav =
          (await cache.match('/index.html')) ||
          (await cache.match('/')) ||
          (await cache.match(event.request));

        const networkFetch = fetch(event.request, { cache: 'no-store' })
          .then((res) => {
            if (res && res.ok) {
              cache.put('/index.html', res.clone());
              cache.put('/', res.clone());
            }
            return res;
          })
          .catch(() => cachedNav);

        if (cachedNav) {
          event.waitUntil(networkFetch);
          return cachedNav;
        }

        return networkFetch;
      })
    );
    return;
  }

  // 2. Hashed static bundles & icons (/assets/*, /icons/*, /images/*):
  // Cache-first for instant startup, with background update.
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((res) => {
            if (res && res.ok) {
              cache.put(event.request, res.clone());
            }
            return res;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3. Other GET requests (e.g. /version.json, /manifest.json): Network first with cache fallback
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetHref = (event.notification.data && event.notification.data.href) || '/#notices';
  const targetUrl = targetHref.startsWith('/') ? targetHref : `/${targetHref}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({ type: 'ICS_CLEAR_GROUPED_NOTIFICATIONS', href: targetHref });
        if ('focus' in client) {
          client.focus();
          if (targetHref.startsWith('#')) {
            client.postMessage({ type: 'ICS_NAVIGATE_HASH', href: targetHref });
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

