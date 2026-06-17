// FA GENESIS — Service Worker v3
var CACHE_NAME = 'fa-genesis-v3';

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
      console.log('[SW] Tous les caches supprimés - v3 actif');
      return self.clients.claim();
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

// Push notifications
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}
  event.waitUntil(self.registration.showNotification(data.title || 'GENESIS', {
    body: data.body || '',
    icon: data.icon || '/assets/images/logo-favicon-192.png',
    badge: data.badge || '/assets/images/logo-favicon-32.png',
    tag: data.tag || 'fa-genesis',
    renotify: true,
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200]
  }));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || '/';
  var isAdmin = targetUrl.indexOf('admin') !== -1;
  var isPartner = targetUrl.indexOf('partner') !== -1;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      // Chercher une fenêtre app.html déjà ouverte
      var appClient = null;
      for (var i = 0; i < list.length; i++) {
        var cu = list[i].url || '';
        if (cu.indexOf('/app') !== -1 || cu.indexOf('app.html') !== -1) {
          appClient = list[i]; break;
        }
      }
      if (appClient) {
        if ('focus' in appClient) appClient.focus();
        if (isAdmin) appClient.postMessage({ action: 'open-admin-panel' });
        else if (isPartner) appClient.postMessage({ action: 'open-partner-tab' });
        return;
      }
      // Aucune fenêtre app ouverte — en ouvrir une avec le hash d'action
      if (clients.openWindow) {
        var openUrl = '/app.html';
        if (isAdmin) openUrl = '/app.html#open-admin';
        else if (isPartner) openUrl = '/app.html#open-partner';
        return clients.openWindow(openUrl);
      }
    })
  );
});
