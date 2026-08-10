// FA GENESIS — Service Worker v13
var CACHE_NAME = 'fa-genesis-v13';

// Pages critiques : jamais mises en cache (toujours réseau)
var NO_CACHE = ['/app.html', '/home.html', '/sw.js'];

var STATIC_ASSETS = [
  '/index.html',
  '/offres.html',
  '/login.html',
  '/register.html',
  '/espace-client.html',
  '/contact.html',
  '/manifest.json',
  '/assets/images/logo-favicon-192.png',
  '/assets/images/logo-favicon.png'
];

// Installation
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS.map(function(url) {
        return new Request(url, { cache: 'reload' });
      })).catch(function() { return Promise.resolve(); });
    })
  );
});

// Activation : supprimer TOUS les anciens caches sans exception
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        console.log('[SW] Suppression cache:', key);
        return caches.delete(key);
      }));
    }).then(function() {
      console.log('[SW] Tous les caches supprimés - v7 actif');
      return self.clients.claim();
    }).then(function() {
      // Signaler à tous les onglets ouverts qu'une nouvelle version est disponible
      return self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    }).then(function(clients) {
      clients.forEach(function(client) {
        client.postMessage({ type: 'SW_ACTIVATED' });
      });
    })
  );
});

// Fetch
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Ressources externes et API : ne pas intercepter
  if (url.hostname !== self.location.hostname) return;
  if (url.pathname.startsWith('/api/')) return;

  // Pages critiques : toujours depuis le réseau, jamais en cache
  var isNoCacheUrl = NO_CACHE.some(function(p) { return url.pathname === p; });
  if (isNoCacheUrl) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(function() {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Images : cache-first
  if (event.request.destination === 'image' ||
      url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(resp) {
          if (resp.ok) {
            var clone = resp.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
          }
          return resp;
        });
      })
    );
    return;
  }

  // Tout le reste : network-first
  event.respondWith(
    fetch(event.request).then(function(resp) {
      if (resp.ok) {
        var clone = resp.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
      }
      return resp;
    }).catch(function() {
      return caches.match(event.request).then(function(c) {
        return c || caches.match('/index.html');
      });
    })
  );
});

// ── Push : afficher la notification ──────────────────────────────────────────
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}
  event.waitUntil(self.registration.showNotification(data.title || 'GENESIS', {
    body: data.body || '',
    icon: data.icon || '/assets/images/logo-favicon-192.png',
    badge: data.badge || '/assets/images/logo-favicon-32.png',
    tag: data.tag || 'fa-genesis',
    renotify: true,
    data: { url: data.url || '/app.html' },
    vibrate: [200, 100, 200]
  }));
});

// ── Clic sur notification → naviguer vers la bonne page ─────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var data = event.notification.data || {};
  var rawUrl = data.url || '/app.html';

  // URL absolue pour clients.openWindow()
  var fullUrl = rawUrl.startsWith('http') ? rawUrl : (self.location.origin + rawUrl);

  // Extraire chemin et hash
  var hashIdx = rawUrl.indexOf('#');
  var targetPath = hashIdx !== -1 ? rawUrl.slice(0, hashIdx) : rawUrl;
  var targetHash = hashIdx !== -1 ? rawUrl.slice(hashIdx + 1) : '';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Chercher une fenêtre déjà ouverte sur la bonne page
      var bestClient = null;
      for (var i = 0; i < clientList.length; i++) {
        var cu = clientList[i].url || '';
        if (cu.indexOf(targetPath) !== -1) {
          bestClient = clientList[i];
          break;
        }
      }

      if (bestClient) {
        // Page déjà ouverte → focus + navigation interne via postMessage
        if ('focus' in bestClient) bestClient.focus();
        if (targetHash) {
          bestClient.postMessage({ action: 'deep-link', hash: targetHash, url: rawUrl });
        }
        return;
      }

      // Page fermée → ouvrir directement à la bonne URL (avec hash inclus)
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});
