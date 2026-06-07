// FA GENESIS — PWA Init
(function() {
  // Enregistrement du service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').then(function(reg) {
        console.log('[PWA] Service Worker enregistré:', reg.scope);
      }).catch(function(err) {
        console.warn('[PWA] Echec enregistrement SW:', err);
      });
    });
  }

  // Bouton d'installation
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;
    var banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = [
      'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
      'background:#000', 'color:#FFD700', 'border:3px solid #FFD700',
      'padding:12px 20px', 'display:flex', 'align-items:center', 'gap:12px',
      'font-family:\'Unbounded\',sans-serif', 'font-size:12px', 'font-weight:900',
      'text-transform:uppercase', 'letter-spacing:1px', 'z-index:99999',
      'box-shadow:4px 4px 0 #FFD700', 'white-space:nowrap'
    ].join(';');

    banner.innerHTML = '<span>Installer l\'application FA GENESIS</span>'
      + '<button id="pwa-install-btn" style="background:#FFD700;color:#000;border:none;padding:8px 16px;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:1px;cursor:pointer;">Installer</button>'
      + '<button id="pwa-dismiss-btn" style="background:transparent;color:#FFD700;border:none;font-size:18px;cursor:pointer;line-height:1;">&#x2715;</button>';

    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', function() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function(result) {
          deferredPrompt = null;
          banner.remove();
        });
      }
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', function() {
      banner.remove();
      sessionStorage.setItem('pwa-dismissed', '1');
    });
  }

  // Ne plus afficher si déjà refusé dans la session
  if (sessionStorage.getItem('pwa-dismissed')) {
    window.removeEventListener('beforeinstallprompt', showInstallBanner);
  }

  // Rechargement automatique quand une nouvelle version est disponible
  navigator.serviceWorker && navigator.serviceWorker.addEventListener('controllerchange', function() {
    window.location.reload();
  });
})();
