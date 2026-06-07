// FA GENESIS — Service Worker
var CACHE_NAME = 'fa-genesis-v1';

var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offres.html',
  '/login.html',
  '/register.html',
  '/espace-client.html',
  '/contact.html',
  '/a-propos.html',
  '/panier.html',
  '/checkout.html',
  '/manifest.json',
  '/config.js',
  '/auth.js',
  '/offers-config.js',
  '/assets/images/logo-favicon-192.png',
  '/assets/images/logo-favicon.png',
  '/assets/images/logo-fa-genesis.png'
];

// Installation : mise en cache des assets statiques
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS.map(function(url) {
        return new Request(url, { cache: 'reload' });
      })).catch(function() {
        // Certains assets peuvent ne pas exister, on ignore les erreurs
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activation : suppression des anciens caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch : stratégie network-first pour HTML/API, cache-first pour images/CSS/JS
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Ne pas intercepter les appels API ni les ressources externes
  if (url.hostname !== self.location.hostname) return;
  if (url.pathname.startsWith('/api/')) return;

  // Images et fonts : cache-first
  if (event.request.destination === 'image' ||
      event.request.destination === 'font' ||
      url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
          }
          return response;
        });
      })
    );
    return;
  }

  // JS/CSS : stale-while-revalidate
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          var networkFetch = fetch(event.request).then(function(response) {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // HTML et autres : network-first avec fallback cache
  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request).then(function(cached) {
        return cached || caches.match('/index.html');
      });
    })
  );
});
