// FA GENESIS — PWA Init + Push Notifications
(function() {
  var VAPID_PUBLIC_KEY = 'BMfYDfWWoNiitqwi1OYkGAuksro9t4bE_udb6vqVRNEFPy54CWaSM2fBoIjSUbT97SOdypKSollhkNqTgyCsUUs';

  function getApiBase() {
    return (typeof window !== 'undefined' && window.FA_GENESIS_API) || 'https://fa-genesis-website.onrender.com';
  }

  // ── Détection plateforme ─────────────────────────────────────
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isAndroid() {
    return /Android/.test(navigator.userAgent);
  }
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }
  function isChrome() {
    return /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
  }
  function isSafari() {
    return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
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

  // ── Expo install prompt (Android/Chrome) ─────────────────────
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] beforeinstallprompt capturé');
    // Notifier app.html si présent
    if (typeof window._onInstallPromptReady === 'function') {
      window._onInstallPromptReady();
    }
  });

  window.addEventListener('appinstalled', function() {
    console.log('[PWA] Application installée !');
    deferredPrompt = null;
    var b = document.getElementById('pwa-install-banner');
    if (b) b.remove();
    localStorage.setItem('fa_pwa_installed', '1');
  });

  // ── API publique d'installation ──────────────────────────────
  window.FA_installApp = function() {
    if (isStandalone()) {
      alert('L\'application est déjà installée !');
      return;
    }
    if (isIOS()) {
      showIOSInstallGuide();
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choice) {
        console.log('[PWA] Choix installation:', choice.outcome);
        deferredPrompt = null;
      });
    } else {
      showManualInstallGuide();
    }
  };

  // ── Guide d'installation iOS ─────────────────────────────────
  function showIOSInstallGuide() {
    if (document.getElementById('ios-install-guide')) return;
    var overlay = document.createElement('div');
    overlay.id = 'ios-install-guide';
    overlay.setAttribute('style', [
      'position:fixed', 'inset:0', 'z-index:99999',
      'background:rgba(0,0,0,0.85)', 'backdrop-filter:blur(10px)',
      'display:flex', 'align-items:flex-end', 'justify-content:center',
      'padding:20px', 'animation:fadeIn 0.3s ease'
    ].join(';'));

    overlay.innerHTML = [
      '<div style="background:#1a1a1a;border:1px solid #333;border-radius:20px;padding:28px 24px;width:100%;max-width:420px;animation:slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)">',
      '<div style="text-align:center;margin-bottom:20px;">',
      '<img src="assets/images/logo-favicon-192.png" style="width:56px;height:56px;border-radius:14px;object-fit:cover;">',
      '</div>',
      '<h2 style="font-family:Unbounded,cursive;font-size:18px;font-weight:900;color:#fff;text-align:center;margin-bottom:8px;">Installer FA GENESIS</h2>',
      '<p style="font-size:13px;color:#888;text-align:center;margin-bottom:24px;line-height:1.5;">Suivez ces 3 étapes dans Safari pour ajouter l\'app sur votre écran d\'accueil.</p>',

      '<div style="display:flex;flex-direction:column;gap:14px;margin-bottom:28px;">',

      step('1', 'Appuyez sur', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2.5"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>',
      'le bouton <strong style="color:#fff">Partager</strong> (carré avec flèche ↑) en bas de Safari'),

      step('2', 'Faites défiler', '<span style="font-size:18px">👆</span>',
      'vers le bas et appuyez sur <strong style="color:#fff">« Sur l\'écran d\'accueil »</strong>'),

      step('3', 'Confirmez', '<span style="font-size:18px">✅</span>',
      'en appuyant sur <strong style="color:#fff">« Ajouter »</strong> en haut à droite'),

      '</div>',

      '<div style="background:#111;border-radius:10px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;">',
      '<span style="font-size:20px">💡</span>',
      '<span style="font-size:12px;color:#888;line-height:1.5;">L\'app s\'ouvrira en plein écran, <strong style="color:#ccc">sans barre de navigation Safari</strong>, comme une vraie application.</span>',
      '</div>',

      '<button onclick="document.getElementById(\'ios-install-guide\').remove()" style="width:100%;padding:16px;background:#FFD700;color:#000;border:none;font-family:Unbounded,cursive;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;border-radius:8px;cursor:pointer;">',
      'Compris, merci !',
      '</button>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  function step(num, label, icon, text) {
    return [
      '<div style="display:flex;gap:14px;align-items:flex-start;">',
      '<div style="width:28px;height:28px;border-radius:50%;background:#FFD700;color:#000;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0;">' + num + '</div>',
      '<div style="flex:1;">',
      '<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">' + label + '</div>',
      '<div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#ccc;line-height:1.5;">',
      icon, '<span>' + text + '</span>',
      '</div>',
      '</div>',
      '</div>'
    ].join('');
  }

  // ── Guide générique (Chrome Desktop / autres) ────────────────
  function showManualInstallGuide() {
    if (document.getElementById('manual-install-guide')) return;
    var d = document.createElement('div');
    d.id = 'manual-install-guide';
    d.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px;');
    d.innerHTML = '<div style="background:#1a1a1a;border:1px solid #333;border-radius:16px;padding:28px 24px;width:100%;max-width:360px;text-align:center;">'
      + '<div style="font-size:40px;margin-bottom:16px;">📲</div>'
      + '<h2 style="font-family:Unbounded,cursive;font-size:18px;font-weight:900;color:#fff;margin-bottom:10px;">Installer l\'app</h2>'
      + '<p style="font-size:13px;color:#888;line-height:1.6;margin-bottom:24px;">Dans votre navigateur, cherchez l\'option <strong style="color:#fff">« Installer l\'application »</strong> ou <strong style="color:#fff">« Ajouter à l\'écran d\'accueil »</strong> dans le menu (⋮ ou ⊕).</p>'
      + '<button onclick="document.getElementById(\'manual-install-guide\').remove()" style="width:100%;padding:14px;background:#FFD700;color:#000;border:none;font-family:Unbounded,cursive;font-size:12px;font-weight:900;text-transform:uppercase;border-radius:6px;cursor:pointer;">OK</button>'
      + '</div>';
    document.body.appendChild(d);
    d.addEventListener('click', function(e) { if (e.target === d) d.remove(); });
  }

  // ── Bannière install automatique ─────────────────────────────
  function showInstallBanner() {
    if (isStandalone()) return;
    if (sessionStorage.getItem('pwa-dismissed')) return;
    if (document.getElementById('pwa-install-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.setAttribute('style', [
      'position:fixed', 'bottom:0', 'left:0', 'right:0',
      'background:#111', 'border-top:2px solid #FFD700',
      'padding:14px 20px', 'display:flex', 'align-items:center', 'gap:12px',
      'z-index:9998', 'animation:slideUp 0.3s ease'
    ].join(';'));

    var iosHint = isIOS() ? 'Appuyez sur ⬆ puis "Sur l\'écran d\'accueil"' : 'Installez l\'app pour une expérience optimale';

    banner.innerHTML = '<img src="assets/images/logo-favicon-192.png" style="width:40px;height:40px;border-radius:10px;object-fit:cover;flex-shrink:0;">'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-family:Unbounded,cursive;font-size:12px;font-weight:900;color:#FFD700;">FA GENESIS</div>'
      + '<div style="font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + iosHint + '</div>'
      + '</div>'
      + '<button onclick="window.FA_installApp && window.FA_installApp()" style="background:#FFD700;color:#000;border:none;padding:9px 16px;font-size:12px;font-weight:900;text-transform:uppercase;cursor:pointer;border-radius:6px;flex-shrink:0;">Installer</button>'
      + '<button onclick="this.parentNode.remove();sessionStorage.setItem(\'pwa-dismissed\',\'1\')" style="background:transparent;color:#555;border:none;font-size:20px;cursor:pointer;padding:0 4px;flex-shrink:0;">✕</button>';

    document.body.appendChild(banner);
  }

  // Afficher la bannière selon la plateforme
  window.addEventListener('load', function() {
    if (isStandalone()) return;
    if (sessionStorage.getItem('pwa-dismissed')) return;

    if (isIOS() && isSafari()) {
      // iOS Safari : montrer la bannière après 3s
      setTimeout(showInstallBanner, 3000);
    } else {
      // Android / autres : attendre le beforeinstallprompt
      window._onInstallPromptReady = function() {
        setTimeout(showInstallBanner, 1000);
      };
      // Fallback : si le prompt ne vient pas dans 8s, montrer quand même
      setTimeout(function() {
        if (!deferredPrompt && !isStandalone()) showInstallBanner();
      }, 8000);
    }
  });

  // ── Push Notifications ───────────────────────────────────────
  function urlBase64ToUint8Array(b64) {
    var padding = '='.repeat((4 - b64.length % 4) % 4);
    var base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function getAuthInfo() {
    try {
      var clientToken = localStorage.getItem('fa_genesis_token');
      if (clientToken) return { token: clientToken, role: 'client' };
      var adminSess = localStorage.getItem('adminSession');
      if (adminSess) {
        var adminToken = localStorage.getItem('fa_genesis_token');
        return { token: adminToken, role: 'admin' };
      }
      var cwToken = sessionStorage.getItem('cw_partner_access') || localStorage.getItem('cw_partner_access');
      if (cwToken) return { token: cwToken, role: 'partner' };
    } catch(e) {}
    return null;
  }

  function subscribeToPush(swReg, auth) {
    return swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    }).then(function(sub) {
      var headers = { 'Content-Type': 'application/json' };
      if (auth && auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
      return fetch(getApiBase() + '/api/push/subscribe', {
        method: 'POST', headers: headers,
        body: JSON.stringify({ subscription: sub, role: auth ? auth.role : 'client' })
      }).then(function(r) {
        if (r.ok) {
          localStorage.setItem('fa_push_subscribed', '1');
          var b = document.getElementById('fa-push-banner');
          if (b) b.remove();
        }
      });
    });
  }

  function tryPushSubscribe() {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) return;
    var auth = getAuthInfo();
    if (!auth) return;
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(function(reg) {
        reg.pushManager.getSubscription().then(function(existing) {
          if (!existing || !localStorage.getItem('fa_push_subscribed')) {
            subscribeToPush(reg, auth).catch(function(e) { console.warn('[PUSH]', e.message); });
          }
        });
      });
    } else if (Notification.permission === 'default') {
      setTimeout(function() { showPushBanner(auth); }, 5000);
    }
  }

  function showPushBanner(auth) {
    if (!('Notification' in window)) return;
    if (document.getElementById('fa-push-banner')) return;
    if (sessionStorage.getItem('fa-push-dismissed')) return;
    if (Notification.permission === 'denied') return;

    var banner = document.createElement('div');
    banner.id = 'fa-push-banner';
    banner.setAttribute('style', [
      'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
      'background:#111', 'color:#fff', 'border:2px solid #FFD700',
      'padding:16px 20px', 'display:flex', 'align-items:center', 'gap:14px',
      'font-family:sans-serif', 'font-size:13px', 'font-weight:700',
      'z-index:99999', 'box-shadow:0 4px 24px rgba(0,0,0,0.7)',
      'max-width:340px', 'width:90%', 'border-radius:12px'
    ].join(';'));

    banner.innerHTML = '<span style="font-size:24px">🔔</span>'
      + '<div style="flex:1;line-height:1.4;">Recevoir les notifications<br><span style="font-size:11px;color:#888;font-weight:400;">Messages, confirmations, alertes</span></div>'
      + '<button id="fa-push-yes" style="background:#FFD700;color:#000;border:none;padding:10px 16px;font-weight:900;font-size:12px;cursor:pointer;border-radius:6px;flex-shrink:0;">Activer</button>'
      + '<button id="fa-push-no" style="background:transparent;color:#555;border:none;font-size:20px;cursor:pointer;padding:0 4px;flex-shrink:0;">✕</button>';

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

  window.FA_activerNotifications = function() {
    if (!('Notification' in window)) { alert('Votre navigateur ne supporte pas les notifications.'); return; }
    if (Notification.permission === 'denied') { alert('Notifications bloquées. Modifiez les paramètres de votre navigateur.'); return; }
    var auth = getAuthInfo();
    Notification.requestPermission().then(function(perm) {
      if (perm === 'granted') {
        navigator.serviceWorker.ready.then(function(reg) {
          subscribeToPush(reg, auth).then(function() {
            var btn = document.getElementById('fa-notif-btn');
            if (btn) { btn.textContent = '🔔 Activées'; btn.disabled = true; btn.style.opacity = '0.5'; }
          }).catch(function(e) { console.warn('[PUSH]', e); });
        });
      }
    });
  };

  // Ajouter CSS animations si pas déjà présentes
  if (!document.getElementById('pwa-animations')) {
    var style = document.createElement('style');
    style.id = 'pwa-animations';
    style.textContent = '@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}';
    document.head.appendChild(style);
  }
})();
