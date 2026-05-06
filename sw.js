/* ============================================================
   LoyaltyOS — Service Worker
   Stratégie : Cache-first pour les assets statiques,
               Network-first pour Supabase (données temps réel).
   ============================================================ */

const CACHE_NAME = 'loyaltyos-v1';

// Assets à mettre en cache immédiatement à l'installation
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
  // Fonts Google (si offline, fallback système)
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap'
];

// Domaines qui ne doivent JAMAIS être mis en cache (données live)
const BYPASS_DOMAINS = [
  'supabase.co',
  'supabase.com'
];

// ── Installation : précache les assets statiques ──────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // On ignore les erreurs individuelles (ex: font offline pendant install)
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(() => {
            console.warn('[SW] Impossible de mettre en cache :', url);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activation : nettoyer les anciens caches ──────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Suppression ancien cache :', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie hybride ─────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Supabase & APIs externes → Network only (jamais cacher des données live)
  if (BYPASS_DOMAINS.some(d => url.hostname.includes(d))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Requêtes POST/PUT/DELETE → Network only
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. Assets statiques → Cache first, fallback network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Ne mettre en cache que les réponses valides (pas les erreurs)
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback : servir index.html pour la navigation
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── Message : forcer la mise à jour depuis l'app ──────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
