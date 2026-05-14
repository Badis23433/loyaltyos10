/* ============================================================
   LoyaltyOS — Service Worker v2
   Ajout : gestion des push notifications
   ============================================================ */

const CACHE_NAME = 'loyaltyos-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/client.html',
  '/merchant.html',
  '/admin.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/html5-qrcode.min.js',
];

const BYPASS_DOMAINS = ['supabase.co', 'supabase.com'];

// ── Installation ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

// ── Activation ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (BYPASS_DOMAINS.some(d => url.hostname.includes(d))) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') return caches.match('/index.html');
      });
    })
  );
});

// ── Push notifications ────────────────────────────────────────
// Reçoit les messages push de l'Edge Function send-push
self.addEventListener('push', event => {
  let data = { title: 'LoyaltyOS', body: 'Nouveau message', url: '/client.html' };
  
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body:    data.body,
    icon:    data.icon || '/icons/icon-192.png',
    badge:   '/icons/icon-72.png',
    data:    { url: data.url || '/client.html' },
    // Vibreur sur Android
    vibrate: [100, 50, 100],
    // Grouper les notifs LoyaltyOS ensemble
    tag:     'loyaltyos-notif',
    renotify: true,
    actions: [
      { action: 'open',    title: 'Voir ma carte' },
      { action: 'dismiss', title: 'Ignorer' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Clic sur la notification ──────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/client.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Si l'app est déjà ouverte → focus
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon → ouvrir
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Message depuis l'app ──────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
