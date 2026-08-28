// ──────────────────────────────────────────────────────────────
// FA GENESIS — Mobile Bridge
// Activé uniquement dans l'app native (Android / iOS via Capacitor)
// Fournit : push notifications FCM, biométrie, caméra, haptics
// ──────────────────────────────────────────────────────────────
(function() {
    'use strict';

    var IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    var IS_ANDROID = IS_NATIVE && window.Capacitor.getPlatform() === 'android';
    var IS_IOS = IS_NATIVE && window.Capacitor.getPlatform() === 'ios';

    if (!IS_NATIVE) return;

    console.log('[FAG Mobile] Plateforme native détectée:', window.Capacitor.getPlatform());

    var Plugins = window.Capacitor.Plugins;
    var _pushListenersAdded = false;

    // ── Barre de statut ─────────────────────────────────────────────────────────
    try {
        if (Plugins.StatusBar) {
            Plugins.StatusBar.setStyle({ style: 'DARK' });
            Plugins.StatusBar.setBackgroundColor({ color: '#000000' });
        }
    } catch(e) {}

    // ── Push Notifications (FCM) ───────────────────────────────────────────────
    window.FAGMobile = window.FAGMobile || {};

    window.FAGMobile.initPushNotifications = async function(userId) {
        try {
            if (!Plugins.PushNotifications) {
                console.warn('[FAG Mobile] PushNotifications plugin non disponible');
                return;
            }

            // Demander la permission (Android 13+ affiche la dialog système)
            var perm = await Plugins.PushNotifications.checkPermissions();
            if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
                perm = await Plugins.PushNotifications.requestPermissions();
            }
            if (perm.receive !== 'granted') {
                console.warn('[FAG Mobile] Permission notifications refusée:', perm.receive);
                return;
            }

            // Enregistrer auprès de FCM — ne pas ajouter les listeners 2x
            if (!_pushListenersAdded) {
                _pushListenersAdded = true;

                Plugins.PushNotifications.addListener('registration', function(token) {
                    var short = token.value ? token.value.substring(0, 20) + '...' : '?';
                    console.log('[FAG Mobile] Token FCM reçu:', short);

                    // Stocker le token en local pour l'utiliser si userId arrive plus tard
                    localStorage.setItem('fag_fcm_token', token.value);

                    window.FAGMobile._sendTokenToServer(token.value, userId);
                });

                Plugins.PushNotifications.addListener('registrationError', function(err) {
                    console.warn('[FAG Mobile] Erreur enregistrement FCM:', err.error || err);
                });

                Plugins.PushNotifications.addListener('pushNotificationReceived', function(notif) {
                    // App au premier plan : afficher un toast FA GENESIS
                    var title = (notif.title) || 'FA Genesis';
                    var nData = notif.data || (notif.notification && notif.notification.data) || {};
                    // Mise à jour immédiate du statut étudiant sans rechargement
                    if (nData.type === 'student_verified') {
                        setTimeout(function() {
                            if (typeof _syncUserBadge === 'function') _syncUserBadge();
                        }, 600);
                    }
                    if (window._showFAGToast) {
                        window._showFAGToast(title, 4000);
                    } else {
                        console.log('[FAG Mobile] Notification reçue:', title);
                    }
                });

                Plugins.PushNotifications.addListener('pushNotificationActionPerformed', function(action) {
                    // Utilisateur a tapé sur la notification dans le tiroir Android
                    var data = (action.notification && action.notification.data) || {};
                    if (data.url) {
                        window.location.href = data.url;
                    } else if (data.tab) {
                        try { if (typeof nav === 'function') nav(data.tab); } catch(e) {}
                    }
                });
            }

            await Plugins.PushNotifications.register();

        } catch(e) {
            console.warn('[FAG Mobile] Push init failed:', e.message);
        }
    };

    // Envoie le token FCM au serveur GENESIS
    window.FAGMobile._sendTokenToServer = function(token, userId) {
        try {
            var api = window.FA_GENESIS_API || 'https://fa-genesis-website.onrender.com';
            // Essayer client token puis partner token
            var authToken = localStorage.getItem('fa_genesis_token')
                || localStorage.getItem('fa_genesis_partner_token')
                || '';
            var uid = userId
                || (function() { try { return JSON.parse(localStorage.getItem('fa_genesis_session') || '{}').id; } catch(e) { return null; } })()
                || (function() { try { return JSON.parse(localStorage.getItem('fa_genesis_partner_data') || '{}').id; } catch(e) { return null; } })();

            if (!uid) {
                console.warn('[FAG Mobile] Token FCM non envoyé : userId inconnu');
                return;
            }

            fetch(api + '/api/push/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + authToken
                },
                body: JSON.stringify({
                    userId: uid,
                    token: token,
                    platform: window.Capacitor.getPlatform()
                })
            }).then(function(r) {
                if (r.ok) console.log('[FAG Mobile] Token FCM enregistré sur le serveur');
                else r.text().then(function(t) { console.warn('[FAG Mobile] Serveur refus token:', t); });
            }).catch(function(e) {
                console.warn('[FAG Mobile] Push register réseau:', e.message);
            });
        } catch(e) {
            console.warn('[FAG Mobile] _sendTokenToServer error:', e.message);
        }
    };

    // ── Authentification biométrique ────────────────────────────────────────────
    window.FAGMobile.biometricLogin = async function() {
        try {
            if (!Plugins.NativeBiometric) return { success: false, error: 'Plugin indisponible' };
            var available = await Plugins.NativeBiometric.isAvailable();
            if (!available.isAvailable) return { success: false, error: 'Biométrie non disponible sur cet appareil' };

            await Plugins.NativeBiometric.verifyIdentity({
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
            return await Plugins.NativeBiometric.getCredentials({ server: 'com.fagenesis.app' });
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

    document.body.classList.add('is-native-app');
    if (IS_ANDROID) document.body.classList.add('is-android');
    if (IS_IOS) document.body.classList.add('is-ios');

    // ── Bouton retour Android ───────────────────────────────────────────────────
    if (IS_ANDROID && Plugins.App) {
        Plugins.App.addListener('backButton', function() {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                Plugins.App.minimizeApp && Plugins.App.minimizeApp();
            }
        });
    }

    window.FAGMobile.ready = true;
    document.dispatchEvent(new CustomEvent('fagmobile:ready', { detail: { platform: window.Capacitor.getPlatform() } }));

    console.log('[FAG Mobile] Bridge initialisé ✓');
})();
