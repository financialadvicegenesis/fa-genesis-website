// FA GENESIS — PWA Init + Push Notifications
(function() {
  var VAPID_PUBLIC_KEY = 'BMfYDfWWoNiitqwi1OYkGAuksro9t4bE_udb6vqVRNEFPy54CWaSM2fBoIjSUbT97SOdypKSollhkNqTgyCsUUs';
  var API_BASE = (typeof window !== 'undefined' && window.FA_GENESIS_API) || 'https://fa-genesis-website.onrender.com';

  // ── Service Worker ──────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').then(function(reg) {
        console.log('[PWA] SW enregistré:', reg.scope);
        // Tenter l'abonnement push après enregistrement SW
        setTimeout(tryPushSubscribe, 2000);
      }).catch(function(err) {
        console.warn('[PWA] Echec SW:', err);
      });
    });
  }

  // ── Conversion clé VAPID Base64 → Uint8Array ────────────────
  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  // ── Détecter le rôle et le token ────────────────────────────
  function getAuthInfo() {
    try {
      var clientToken = localStorage.getItem('fa_genesis_token');
      if (clientToken) return { token: clientToken, role: 'client' };

      var adminSession = localStorage.getItem('admin_session') || sessionStorage.getItem('admin_session');
      if (adminSession) {
        var aKey = localStorage.getItem('admin_key') || sessionStorage.getItem('admin_key');
        return { token: null, role: 'admin', adminKey: aKey };
      }

      var cwToken = sessionStorage.getItem('cw_partner_access') || localStorage.getItem('cw_partner_access');
      if (cwToken) return { token: cwToken, role: 'partner' };
    } catch(e) {}
    return null;
  }

  // ── S'abonner aux push notifications ─────────────────────────
  function subscribeToPush(swReg, auth) {
    return swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    }).then(function(subscription) {
      var headers = { 'Content-Type': 'application/json' };
      if (auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
      if (auth.adminKey) headers['x-admin-key'] = auth.adminKey;

      return fetch(API_BASE + '/api/push/subscribe', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ subscription: subscription, role: auth.role })
      }).then(function(r) {
        if (r.ok) {
          console.log('[PUSH] Abonné avec succès — rôle:', auth.role);
          localStorage.setItem('fa_push_subscribed', '1');
          hidePushBanner();
        }
      });
    });
  }

  // ── Essayer de s'abonner ──────────────────────────────────────
  function tryPushSubscribe() {
    if (!('PushManager' in window)) return;
    if (!('serviceWorker' in navigator)) return;

    var auth = getAuthInfo();
    if (!auth) return; // Pas connecté

    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(function(reg) {
        reg.pushManager.getSubscription().then(function(existing) {
          if (!existing || !localStorage.getItem('fa_push_subscribed')) {
            subscribeToPush(reg, auth).catch(function(e) {
              console.warn('[PUSH] Erreur abonnement:', e);
            });
          }
        });
      });
    } else if (Notification.permission === 'default') {
      showPushBanner(auth);
    }
  }

  // ── Bannière "Activer les notifications" ─────────────────────
  function showPushBanner(auth) {
    if (document.getElementById('fa-push-banner')) return;
    if (sessionStorage.getItem('fa-push-dismissed')) return;

    var banner = document.createElement('div');
    banner.id = 'fa-push-banner';
    banner.style.cssText = [
      'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
      'background:#000', 'color:#fff', 'border:3px solid #FFD700',
      'padding:14px 18px', 'display:flex', 'align-items:center', 'gap:12px',
      'font-family:sans-serif', 'font-size:13px', 'font-weight:700',
      'z-index:99999', 'box-shadow:4px 4px 0 #FFD700',
      'max-width:320px', 'width:90%'
    ].join(';');

    banner.innerHTML = '<span style="flex:1">🔔 Activer les notifications FA GENESIS ?</span>'
      + '<button id="fa-push-yes" style="background:#FFD700;color:#000;border:none;padding:8px 14px;font-weight:900;font-size:12px;cursor:pointer;flex-shrink:0;">OUI</button>'
      + '<button id="fa-push-no" style="background:transparent;color:#aaa;border:none;font-size:18px;cursor:pointer;flex-shrink:0;line-height:1;">✕</button>';

    document.body.appendChild(banner);

    document.getElementById('fa-push-yes').addEventListener('click', function() {
      Notification.requestPermission().then(function(permission) {
        if (permission === 'granted') {
          navigator.serviceWorker.ready.then(function(reg) {
            subscribeToPush(reg, auth).catch(function(e) { console.warn('[PUSH]', e); });
          });
        }
        banner.remove();
      });
    });

    document.getElementById('fa-push-no').addEventListener('click', function() {
      banner.remove();
      sessionStorage.setItem('fa-push-dismissed', '1');
    });
  }

  function hidePushBanner() {
    var b = document.getElementById('fa-push-banner');
    if (b) b.remove();
  }

  // ── Bannière d'installation PWA ──────────────────────────────
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;
    if (sessionStorage.getItem('pwa-dismissed')) return;

    var banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = [
      'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
      'background:#000', 'color:#FFD700', 'border:3px solid #FFD700',
      'padding:12px 20px', 'display:flex', 'align-items:center', 'gap:12px',
      'font-family:sans-serif', 'font-size:12px', 'font-weight:900',
      'text-transform:uppercase', 'letter-spacing:1px', 'z-index:99998',
      'box-shadow:4px 4px 0 #FFD700', 'white-space:nowrap'
    ].join(';');

    banner.innerHTML = '<span>Installer l\'app FA GENESIS</span>'
      + '<button id="pwa-install-btn" style="background:#FFD700;color:#000;border:none;padding:8px 16px;font-weight:900;font-size:11px;text-transform:uppercase;cursor:pointer;">Installer</button>'
      + '<button id="pwa-dismiss-btn" style="background:transparent;color:#FFD700;border:none;font-size:18px;cursor:pointer;line-height:1;">✕</button>';

    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', function() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function() { deferredPrompt = null; banner.remove(); });
      }
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', function() {
      banner.remove();
      sessionStorage.setItem('pwa-dismissed', '1');
    });
  }

  // Rechargement automatique sur nouvelle version SW
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      window.location.reload();
    });
  }
})();
