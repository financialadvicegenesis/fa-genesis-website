// ──────────────────────────────────────────────────────────────
// FA GENESIS — Mobile Bridge
// Activé uniquement dans l'app native (Android / iOS via Capacitor)
// Fournit : push notifications, biométrie, caméra, haptics
// ──────────────────────────────────────────────────────────────
(function() {
    'use strict';

    // Détecte l'environnement Capacitor
    var IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    var IS_ANDROID = IS_NATIVE && window.Capacitor.getPlatform() === 'android';
    var IS_IOS = IS_NATIVE && window.Capacitor.getPlatform() === 'ios';

    if (!IS_NATIVE) return;

    console.log('[FAG Mobile] Plateforme native détectée:', window.Capacitor.getPlatform());

    // ── Raccourcis plugins ──────────────────────────────────────────────────────
    var Plugins = window.Capacitor.Plugins;

    // ── Barre de statut ─────────────────────────────────────────────────────────
    try {
        if (Plugins.StatusBar) {
            Plugins.StatusBar.setStyle({ style: 'DARK' });
            Plugins.StatusBar.setBackgroundColor({ color: '#000000' });
        }
    } catch(e) {}

    // ── Push Notifications ─────────────────────────────────────────────────────
    window.FAGMobile = window.FAGMobile || {};

    window.FAGMobile.initPushNotifications = async function(userId) {
        try {
            if (!Plugins.PushNotifications) return;
            var perm = await Plugins.PushNotifications.requestPermissions();
            if (perm.receive !== 'granted') return;

            await Plugins.PushNotifications.register();

            Plugins.PushNotifications.addListener('registration', function(token) {
                console.log('[FAG Mobile] Push token:', token.value.substring(0, 20) + '...');
                // Enregistrer le token auprès du backend
                if (window.FA_GENESIS_API && userId) {
                    fetch(window.FA_GENESIS_API + '/api/push/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('fa_genesis_token') || '') },
                        body: JSON.stringify({ userId: userId, token: token.value, platform: window.Capacitor.getPlatform() })
                    }).catch(function(e) { console.warn('[FAG Mobile] Push register failed:', e.message); });
                }
            });

            Plugins.PushNotifications.addListener('registrationError', function(err) {
                console.warn('[FAG Mobile] Push registration error:', err.error);
            });

            Plugins.PushNotifications.addListener('pushNotificationReceived', function(notif) {
                // L'app est au premier plan : afficher une alerte ou un toast custom
                if (window._showFAGToast) {
                    window._showFAGToast((notif.notification && notif.notification.title) || 'FA Genesis', 4000);
                }
            });

            Plugins.PushNotifications.addListener('pushNotificationActionPerformed', function(action) {
                // Utilisateur a tapé sur la notification
                var data = (action.notification && action.notification.data) || {};
                if (data.url) window.location.href = data.url;
                else if (data.tab) { try { if(typeof nav === 'function') nav(data.tab); } catch(e) {} }
            });

        } catch(e) {
            console.warn('[FAG Mobile] Push init failed:', e.message);
        }
    };

    // ── Authentification biométrique ────────────────────────────────────────────
    window.FAGMobile.biometricLogin = async function() {
        try {
            if (!Plugins.NativeBiometric) return { success: false, error: 'Plugin indisponible' };
            var available = await Plugins.NativeBiometric.isAvailable();
            if (!available.isAvailable) return { success: false, error: 'Biométrie non disponible sur cet appareil' };

            var result = await Plugins.NativeBiometric.verifyIdentity({
                reason: 'Accédez à votre compte FA Genesis',
                title: 'FA Genesis',
                subtitle: 'Connexion sécurisée',
                negativeButtonText: 'Annuler',
                maxAttempts: 3
            });
            return { success: true };
        } catch(e) {
            return { success: false, error: e.message || 'Biométrie annulée' };
        }
    };

    window.FAGMobile.saveBiometricCredentials = async function(email, token) {
        try {
            if (!Plugins.NativeBiometric) return;
            await Plugins.NativeBiometric.setCredentials({
                username: email, password: token,
                server: 'com.fagenesis.app'
            });
        } catch(e) {}
    };

    window.FAGMobile.getBiometricCredentials = async function() {
        try {
            if (!Plugins.NativeBiometric) return null;
            var creds = await Plugins.NativeBiometric.getCredentials({ server: 'com.fagenesis.app' });
            return creds;
        } catch(e) { return null; }
    };

    window.FAGMobile.deleteBiometricCredentials = async function() {
        try {
            if (!Plugins.NativeBiometric) return;
            await Plugins.NativeBiometric.deleteCredentials({ server: 'com.fagenesis.app' });
        } catch(e) {}
    };

    // ── Caméra / Galerie ────────────────────────────────────────────────────────
    window.FAGMobile.pickPhoto = async function(fromCamera) {
        try {
            if (!Plugins.Camera) return null;
            var result = await Plugins.Camera.getPhoto({
                quality: 88,
                allowEditing: false,
                resultType: 'dataUrl',
                source: fromCamera ? 'CAMERA' : 'PHOTOS',
                correctOrientation: true,
                width: 1200
            });
            return result.dataUrl || null;
        } catch(e) {
            if (e.message && e.message.toLowerCase().includes('cancel')) return null;
            console.warn('[FAG Mobile] Camera error:', e.message);
            return null;
        }
    };

    // ── Haptics (retour tactile) ────────────────────────────────────────────────
    window.FAGMobile.haptic = async function(style) {
        try {
            if (!Plugins.Haptics) return;
            await Plugins.Haptics.impact({ style: style || 'MEDIUM' });
        } catch(e) {}
    };

    // ── Safe-area (notch iPhone / Android) ─────────────────────────────────────
    document.documentElement.style.setProperty('--safe-top',    'env(safe-area-inset-top, 0px)');
    document.documentElement.style.setProperty('--safe-bottom', 'env(safe-area-inset-bottom, 0px)');
    document.documentElement.style.setProperty('--safe-left',   'env(safe-area-inset-left, 0px)');
    document.documentElement.style.setProperty('--safe-right',  'env(safe-area-inset-right, 0px)');

    // Ajouter une classe css sur le body pour le ciblage CSS natif
    document.body.classList.add('is-native-app');
    if (IS_ANDROID) document.body.classList.add('is-android');
    if (IS_IOS) document.body.classList.add('is-ios');

    // ── Bouton retour Android ───────────────────────────────────────────────────
    if (IS_ANDROID && Plugins.App) {
        Plugins.App.addListener('backButton', function(data) {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                // Si on ne peut pas reculer, minimiser l'app (ne pas quitter)
                Plugins.App.minimizeApp && Plugins.App.minimizeApp();
            }
        });
    }

    // ── Signale au reste de l'app que le bridge est prêt ───────────────────────
    window.FAGMobile.ready = true;
    document.dispatchEvent(new CustomEvent('fagmobile:ready', { detail: { platform: window.Capacitor.getPlatform() } }));

    console.log('[FAG Mobile] Bridge initialisé ✓');
})();
