// ICS Academy Service Worker for Instant Black Launch, Offline Support & Real-Time Web Push (Android + iOS Home Screen PWA)
const CACHE_NAME = 'ics-academy-pwa-v27';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/ics-mark.svg',
  '/images/ics-mark-transparent.png',
  '/icons/icon-192.png',
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
          }),
        ),
      );
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        );
      })
      .then(() => self.clients.claim()),
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

  // 1. Navigation requests ('/' or '/index.html')
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
      }),
    );
    return;
  }

  // 2. Hashed static bundles & icons (/assets/*, /icons/*, /images/*)
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
      }),
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
      .catch(() => caches.match(event.request)),
  );
});

// Real-Time Background Web Push Handler (Android Chrome/PWA + iPhone iOS 16.4+ Add to Home Screen)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'ICS Academy',
    body: 'You have a new campus update.',
    href: '#notices',
    tag: 'ics-academy-push',
    notificationId: '',
    type: 'notice',
    requireInteraction: false,
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = {
          title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'ICS Academy',
          body: typeof parsed.body === 'string' ? parsed.body.trim() : '',
          href: typeof parsed.href === 'string' && parsed.href.trim() ? parsed.href.trim() : '#notices',
          tag: typeof parsed.tag === 'string' && parsed.tag.trim() ? parsed.tag.trim() : 'ics-academy-push',
          notificationId: typeof parsed.notificationId === 'string' ? parsed.notificationId : '',
          type: typeof parsed.type === 'string' ? parsed.type : 'notice',
          requireInteraction: Boolean(parsed.requireInteraction),
        };
      }
    } catch {
      try {
        const text = event.data.text();
        if (text) payload.body = text;
      } catch {
        // Keep default payload
      }
    }
  }

  event.waitUntil(
    (async () => {
      // If user already has the app visible & focused, notify open window so it can suppress duplicate local alerts
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      let hasFocusedClient = false;
      for (const client of windowClients) {
        if (client.visibilityState === 'visible' && client.focused) {
          hasFocusedClient = true;
        }
        try {
          client.postMessage({
            type: 'ICS_PUSH_RECEIVED',
            notificationId: payload.notificationId,
            notifType: payload.type,
            href: payload.href,
          });
        } catch {
          // Ignore postMessage failure
        }
      }

      // Skip system banner only if user is actively focused inside the app AND it is not a call/test alert
      if (hasFocusedClient && payload.type !== 'call' && payload.type !== 'test') {
        return;
      }

      try {
        if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
          await self.navigator.setAppBadge(1);
        }
      } catch {
        // Ignore badge unsupported
      }

      const notifOptions = {
        body: payload.body || 'Open ICS Academy to view details.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: payload.tag || `ics-push-${payload.notificationId || Date.now()}`,
        renotify: true,
        silent: false,
        requireInteraction: payload.requireInteraction || payload.type === 'call',
        vibrate: payload.type === 'call' ? [300, 150, 300, 150, 300] : [180, 90, 180],
        data: {
          href: payload.href,
          notificationId: payload.notificationId,
          type: payload.type,
        },
      };

      await self.registration.showNotification(payload.title, notifOptions);
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetHref = (event.notification.data && event.notification.data.href) || '#notices';
  const targetUrl = targetHref.startsWith('/') ? targetHref : `/${targetHref}`;

  event.waitUntil(
    (async () => {
      try {
        if (self.navigator && typeof self.navigator.clearAppBadge === 'function') {
          await self.navigator.clearAppBadge();
        }
      } catch {
        // Ignore badge clear errors
      }

      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        client.postMessage({ type: 'ICS_CLEAR_GROUPED_NOTIFICATIONS', href: targetHref });
        if ('focus' in client) {
          await client.focus();
          if (targetHref.startsWith('#')) {
            client.postMessage({ type: 'ICS_NAVIGATE_HASH', href: targetHref });
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
