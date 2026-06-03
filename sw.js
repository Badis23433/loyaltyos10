/* ============================================================
   LoyaltyOS — Service Worker v6
   Fix : cache HTML network-first + push notifications + icônes
   ============================================================ */

const CACHE_NAME = 'loyaltyos-v7-ui-push-2026-06-03';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/client.html',
  '/merchant.html',
  '/admin.html',
  '/manifest.json',
  '/icons/icon-72.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/html5-qrcode.min.js',
];

const BYPASS_DOMAINS = ['supabase.co', 'supabase.com'];
const HTML_PATHS = ['/', '/index.html', '/client.html', '/merchant.html', '/admin.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallbackUrl = '/index.html') {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (fresh && fresh.status === 200) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch (e) {
    return (await cache.match(request)) || cache.match(fallbackUrl);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const freshPromise = fetch(request).then(response => {
    if (response && response.status === 200 && response.type !== 'opaque') {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }).catch(() => null);
  return cached || freshPromise;
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (BYPASS_DOMAINS.some(d => url.hostname.includes(d)) || event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  const isHtml = event.request.mode === 'navigate' || HTML_PATHS.includes(url.pathname);
  if (isHtml) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});

self.addEventListener('push', event => {
  let data = { title: 'LoyaltyOS', body: 'Nouveau message', url: '/client.html' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-72.png',
    data: { url: data.url || '/client.html' },
    vibrate: [100, 50, 100],
    tag: data.tag || `loyaltyos-${Date.now()}`,
    renotify: false,
    actions: [
      { action: 'open', title: 'Voir ma carte' },
      { action: 'dismiss', title: 'Ignorer' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = new URL(event.notification.data?.url || '/client.html', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ((client.url === targetUrl || client.url.startsWith(targetUrl.split('?')[0])) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
