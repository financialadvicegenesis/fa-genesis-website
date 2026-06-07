// FA GENESIS — PWA Init + Push Notifications
(function() {
  var VAPID_PUBLIC_KEY = 'BMfYDfWWoNiitqwi1OYkGAuksro9t4bE_udb6vqVRNEFPy54CWaSM2fBoIjSUbT97SOdypKSollhkNqTgyCsUUs';

  function getApiBase() {
    return (typeof window !== 'undefined' && window.FA_GENESIS_API) || 'https://fa-genesis-website.onrender.com';
  }

  // ── Service Worker ───────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').then(function(reg) {
        console.log('[PWA] SW enregistré:', reg.scope);
        setTimeout(tryPushSubscribe, 3000);
      }).catch(function(err) {
        console.warn('[PWA] Echec SW:', err);
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      window.location.reload();
    });
  }

  // ── Utilitaires ──────────────────────────────────────────────
  function urlBase64ToUint8Array(b64) {
    var padding = '='.repeat((4 - b64.length % 4) % 4);
    var base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  // ── Détecter rôle + token de l'utilisateur connecté ─────────
  function getAuthInfo() {
    try {
      // Client FA GENESIS
      var clientToken = localStorage.getItem('fa_genesis_token');
      if (clientToken) return { token: clientToken, role: 'client', header: 'Authorization' };

      // Administrateur (clé 'adminSession' — sans underscore)
      var adminSess = localStorage.getItem('adminSession');
      if (adminSess) {
        // L'admin utilise aussi fa_genesis_token s'il est connecté en tant qu'utilisateur
        var adminToken = localStorage.getItem('fa_genesis_token');
        return { token: adminToken, role: 'admin', header: 'Authorization' };
      }

      // Partenaire coworking
      var cwToken = sessionStorage.getItem('cw_partner_access') || localStorage.getItem('cw_partner_access');
      if (cwToken) return { token: cwToken, role: 'partner', header: 'Authorization' };
    } catch(e) {}
    return null;
  }

  // ── Abonnement push ──────────────────────────────────────────
  function subscribeToPush(swReg, auth) {
    return swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    }).then(function(sub) {
      var headers = { 'Content-Type': 'application/json' };
      if (auth && auth.token) headers['Authorization'] = 'Bearer ' + auth.token;

      return fetch(getApiBase() + '/api/push/subscribe', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ subscription: sub, role: auth ? auth.role : 'client' })
      }).then(function(r) {
        if (r.ok) {
          console.log('[PUSH] Abonné — rôle:', auth ? auth.role : 'inconnu');
          localStorage.setItem('fa_push_subscribed', '1');
          removePushBanner();
        }
        return r;
      });
    });
  }

  // ── Essai d'abonnement automatique ──────────────────────────
  function tryPushSubscribe() {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) return;
    var auth = getAuthInfo();
    if (!auth) return;

    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(function(reg) {
        reg.pushManager.getSubscription().then(function(existing) {
          if (!existing || !localStorage.getItem('fa_push_subscribed')) {
            subscribeToPush(reg, auth).catch(function(e) { console.warn('[PUSH] Abonnement auto échoué:', e.message); });
          }
        });
      });
    } else if (Notification.permission === 'default') {
      // Attendre encore 5s avant d'afficher la bannière pour ne pas être intrusif
      setTimeout(function() { showPushBanner(auth); }, 5000);
    }
  }

  // ── Bannière permission notifications ────────────────────────
  function showPushBanner(auth) {
    if (!('Notification' in window)) return;
    if (document.getElementById('fa-push-banner')) return;
    if (sessionStorage.getItem('fa-push-dismissed')) return;
    if (Notification.permission === 'denied') return;

    var banner = document.createElement('div');
    banner.id = 'fa-push-banner';
    banner.setAttribute('style', [
      'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
      'background:#111', 'color:#fff', 'border:3px solid #FFD700',
      'padding:16px 20px', 'display:flex', 'align-items:center', 'gap:14px',
      'font-family:sans-serif', 'font-size:13px', 'font-weight:700',
      'z-index:99999', 'box-shadow:0 4px 20px rgba(0,0,0,0.6)',
      'max-width:340px', 'width:90%', 'border-radius:4px'
    ].join(';'));

    banner.innerHTML = [
      '<span style="font-size:22px">🔔</span>',
      '<span style="flex:1;line-height:1.4">Recevoir les notifications<br><span style="font-size:11px;color:#aaa;font-weight:400">Messages, confirmations, alertes en temps réel</span></span>',
      '<button id="fa-push-yes" style="background:#FFD700;color:#000;border:none;padding:10px 16px;font-weight:900;font-size:12px;cursor:pointer;white-space:nowrap;flex-shrink:0;">Activer</button>',
      '<button id="fa-push-no" style="background:transparent;color:#777;border:none;font-size:20px;cursor:pointer;line-height:1;flex-shrink:0;padding:0 4px;">✕</button>'
    ].join('');

    document.body.appendChild(banner);

    document.getElementById('fa-push-yes').addEventListener('click', function() {
      Notification.requestPermission().then(function(perm) {
        banner.remove();
        if (perm === 'granted') {
          navigator.serviceWorker.ready.then(function(reg) {
            subscribeToPush(reg, auth).catch(function(e) { console.warn('[PUSH]', e); });
          });
        }
      });
    });

    document.getElementById('fa-push-no').addEventListener('click', function() {
      banner.remove();
      sessionStorage.setItem('fa-push-dismissed', '1');
    });
  }

  function removePushBanner() {
    var b = document.getElementById('fa-push-banner');
    if (b) b.remove();
  }

  // ── API publique : activer push manuellement depuis un bouton UI ──
  window.FA_activerNotifications = function() {
    if (!('Notification' in window)) {
      alert('Votre navigateur ne supporte pas les notifications.');
      return;
    }
    if (Notification.permission === 'denied') {
      alert('Les notifications ont été bloquées. Autorisez-les dans les paramètres de votre navigateur.');
      return;
    }
    var auth = getAuthInfo();
    Notification.requestPermission().then(function(perm) {
      if (perm === 'granted') {
        navigator.serviceWorker.ready.then(function(reg) {
          subscribeToPush(reg, auth).then(function() {
            var btn = document.getElementById('fa-notif-btn');
            if (btn) { btn.textContent = '🔔 Notifications activées'; btn.disabled = true; btn.style.opacity = '0.6'; }
          }).catch(function(e) { console.warn('[PUSH]', e); });
        });
      }
    });
  };

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
    banner.setAttribute('style', [
      'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
      'background:#000', 'color:#FFD700', 'border:3px solid #FFD700',
      'padding:12px 18px', 'display:flex', 'align-items:center', 'gap:12px',
      'font-family:sans-serif', 'font-size:12px', 'font-weight:900',
      'text-transform:uppercase', 'letter-spacing:1px', 'z-index:99998',
      'box-shadow:4px 4px 0 #FFD700', 'white-space:nowrap'
    ].join(';'));
    banner.innerHTML = '<span>Installer l\'app FA GENESIS</span>'
      + '<button id="pwa-install-btn" style="background:#FFD700;color:#000;border:none;padding:8px 14px;font-weight:900;font-size:11px;text-transform:uppercase;cursor:pointer;">Installer</button>'
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
})();
