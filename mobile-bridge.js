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

    // Copie le jeton de session (client ou prestataire) dans les SharedPreferences natives —
    // seul moyen pour ReplyReceiver.java (répondre à un message depuis la notification, sans
    // ouvrir l'app) d'avoir accès à un jeton valide, le JS/localStorage n'étant pas accessible
    // au code natif qui tourne en dehors du contexte de la WebView.
    window.FAGMobile.setAuthToken = async function(token, role, email) {
        try {
            if (!Plugins.TokenStore || !token || !role) return;
            await Plugins.TokenStore.setToken({ token: token, role: role, email: email || '' });
        } catch(e) { console.warn('[FAG Mobile] setAuthToken:', e.message); }
    };

    // Rafraîchit le badge numérique de l'icône (comme WhatsApp/Messenger) en interrogeant le
    // serveur pour l'état RÉEL et actuel des non-lus (voir GET /api/notifications/badge-count) —
    // nécessaire chaque fois qu'un message est lu/répondu DANS l'app (donc sans jamais passer
    // par ReplyReceiver.java ni redémarrer l'app, seuls autres endroits qui mettent le badge à
    // jour), sinon il restait affiché avec l'ancien chiffre posé par la dernière notification
    // FCM reçue. Appelé côté app.html depuis _ptnrRefreshBadges/_clientRefreshMsgBadge.
    window.FAGMobile.refreshBadge = async function(role) {
        try {
            if (!Plugins.TokenStore || !role) return;
            await Plugins.TokenStore.refreshBadge({ role: role });
        } catch(e) { console.warn('[FAG Mobile] refreshBadge:', e.message); }
    };

    // Annule la notification de message affichée pour ce contact précis (façon Instagram/
    // WhatsApp) — nécessaire quand la conversation est ouverte/lue DANS l'app plutôt qu'en tapant
    // la notification elle-même (auto-annulée nativement dans ce cas) ou qu'en y répondant
    // directement (remplacée par ReplyReceiver côté natif) : sans cet appel, la notification
    // restait visible dans le volet même après avoir déjà lu/répondu au message dans l'app.
    // Appelé côté app.html depuis _ptnrOpenConversation/openConversation.
    window.FAGMobile.cancelMessageNotification = async function(counterpart) {
        try {
            if (!Plugins.TokenStore || !counterpart) return;
            await Plugins.TokenStore.cancelMessageNotification({ counterpart: counterpart });
        } catch(e) { console.warn('[FAG Mobile] cancelMessageNotification:', e.message); }
    };

    window.FAGMobile.initPushNotifications = async function(userId) {
        try {
            if (!Plugins.PushNotifications) {
                console.warn('[FAG Mobile] PushNotifications plugin non disponible');
                return;
            }

            // Créer le canal de notification AVANT tout enregistrement. Sur Android 8+ (API 26+),
            // une notification FCM référençant un channelId qui n'existe pas sur l'appareil est
            // silencieusement ignorée par le système — aucune erreur nulle part, la notification
            // n'apparaît juste jamais. Le serveur envoie toujours channelId:'genesis_general'
            // (voir server.js, sendFcmToUser) : ce canal doit donc exister ici, côté app.
            if (IS_ANDROID && Plugins.PushNotifications.createChannel) {
                try {
                    await Plugins.PushNotifications.createChannel({
                        id: 'genesis_general',
                        name: 'GENESIS',
                        description: 'Messages, missions, commandes et alertes GENESIS',
                        importance: 4, // IMPORTANCE_HIGH : notification "heads-up" + son, comme les autres apps
                        visibility: 1, // VISIBILITY_PUBLIC
                        vibration: true
                    });
                } catch(chErr) {
                    console.warn('[FAG Mobile] createChannel a échoué:', chErr.message);
                }
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
                    // Utilisateur a tapé sur la notification dans le tiroir Android.
                    // L'app native charge toujours https://fagenesis.com/app.html (server.url) :
                    // au moment où ce listener se déclenche, cette page est déjà chargée. Changer
                    // window.location.href vers une URL qui ne diffère que par le hash (le cas de
                    // presque tous nos liens de notif) ne recharge PAS la page dans un navigateur —
                    // ça ne fait donc jamais tourner la logique de routage d'app.html. On appelle
                    // directement _handleNotifHash() (exposée globalement, script classique non-module),
                    // exactement comme le fait déjà sw.js pour le Web Push quand l'onglet est déjà ouvert.
                    var data = (action.notification && action.notification.data) || {};
                    var hash = null;
                    if (data.url) {
                        var idx = data.url.indexOf('#');
                        hash = idx !== -1 ? data.url.slice(idx + 1) : null;
                    }
                    if (hash && typeof window._handleNotifHash === 'function') {
                        window._handleNotifHash(hash);
                    } else if (data.url) {
                        // Repli : app pas encore prête (cas rare, lancement à froid) — un
                        // chargement complet exécutera le routage au démarrage (voir app.html).
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

    // ── Authentification biométrique (Face ID / empreinte / iris) ────────────────
    // Plugin natif @aparajita/capacitor-biometric-auth, appelé directement via son nom
    // d'enregistrement natif (BiometricAuthNative) — comme pour tous les autres plugins de
    // ce fichier, sans passer par son wrapper JS (non chargeable sans bundler ici).
    // checkBiometry()/internalAuthenticate() sont des méthodes 100% natives, donc cet appel
    // direct expose exactement le même comportement que le wrapper officiel.
    window.FAGMobile.checkBiometry = async function() {
        try {
            if (!Plugins.BiometricAuthNative) return { isAvailable: false };
            return await Plugins.BiometricAuthNative.checkBiometry();
        } catch(e) {
            return { isAvailable: false };
        }
    };

    window.FAGMobile.authenticateBiometric = async function(reason) {
        try {
            // GenesisBiometric (natif, com.fagenesis.genesis.GenesisBiometricPlugin) — remplace
            // le plugin tiers @aparajita/capacitor-biometric-auth (BiometricAuthNative) pour
            // l'authentification elle-même. Cause racine corrigée : ce dernier affichait son
            // invite depuis une Activity Android SÉPARÉE (AuthActivity), ce qui faisait passer
            // MainActivity — et sa WebView — en arrière-plan pendant l'authentification,
            // l'exposant à un recyclage du processus de rendu Chromium par le système (perte
            // silencieuse de tout l'état JS, dont la destination d'une notification en cours de
            // traitement). Confirmé par un test A/B réel sur compte réel (biométrie désactivée :
            // aucun problème : biométrie activée : problème systématique). GenesisBiometric
            // affiche l'invite directement sur MainActivity (comportement officiellement
            // documenté par Android), qui ne quitte donc jamais le premier plan.
            var params = {
                reason: reason || 'Accédez à votre compte FA Genesis',
                androidTitle: 'FA Genesis',
                androidSubtitle: 'Déverrouillage sécurisé',
                cancelTitle: 'Annuler',
                // Autorise le repli sur le code PIN / schéma de l'appareil après plusieurs
                // échecs biométriques, pour ne jamais bloquer totalement l'accès au compte.
                allowDeviceCredential: true
            };
            // Repli sur l'ancien plugin tant que la version native contenant GenesisBiometric
            // n'est pas encore installée sur l'appareil (app.html/mobile-bridge.js sont chargés
            // en direct depuis le serveur — ce code peut donc être actif AVANT que la nouvelle
            // version native ne soit publiée/installée par chaque utilisateur). Sans ce repli,
            // la biométrie serait indisponible pour tout le monde jusqu'à mise à jour native.
            if (Plugins.GenesisBiometric) {
                await Plugins.GenesisBiometric.authenticate(params);
            } else if (Plugins.BiometricAuthNative) {
                await Plugins.BiometricAuthNative.internalAuthenticate(params);
            } else {
                return { success: false, error: 'Biométrie indisponible' };
            }
            return { success: true };
        } catch(e) {
            return { success: false, error: (e && e.message) || 'Authentification annulée' };
        }
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

    // Dictée vocale (conversation Jérémie) : plus de plugin natif ici. Après trois implémentations
    // natives successives (une maison, puis un plugin Capacitor tiers éprouvé) toutes échouées de
    // façon silencieuse et inexpliquée sur au moins un appareil de test réel, le champ de texte
    // de Jérémie (app.html, #jeremie-input) s'appuie désormais uniquement sur le micro du clavier
    // Android lui-même (Gboard) — gratuit, sans clé API, et confirmé fiable sur ce même appareil
    // là où l'intégration native ne l'était pas. Rien à faire ici : un <textarea> standard suffit.

    // ── Voix de sortie native (Jérémie lit ses réponses) ───────────────────────
    // @capacitor-community/text-to-speech — window.speechSynthesis (Web Speech Synthesis API) du
    // navigateur n'est PAS implémenté par la WebView Android système (même limitation déjà
    // rencontrée avec window.SpeechRecognition pour la dictée) : découvert après coup, le bouton
    // haut-parleur de la conversation Jérémie se masquait donc silencieusement dans l'app native
    // (voir app.html, _jeremieUpdateVoiceBtn) sans que ça ait jamais été vérifié avant. Ce plugin
    // utilise le moteur de synthèse vocale du SYSTÈME Android (android.speech.tts.TextToSpeech),
    // un sous-système nettement plus universellement disponible que la reconnaissance vocale
    // (pas la même restriction de visibilité de package pour les apps tierces).
    window.FAGMobile.isNativeVoiceOutputAvailable = function() {
        return !!Plugins.TextToSpeech;
    };
    // Voix par défaut de Jérémie, identifiée avec l'utilisateur directement sur son appareil via
    // un sélecteur temporaire (testé une voix à la fois, à l'oreille) : "fr-fr-x-frd-local" est
    // l'identifiant interne (voice.getName() côté Android) d'une voix masculine du moteur Google
    // Text-to-Speech - le moteur TTS le plus répandu sur Android, donc un bon choix par défaut
    // pour la majorité des appareils. Android n'a pas de champ "genre" sur les voix TTS, donc pas
    // de moyen de sélectionner "une voix d'homme" autrement que par cet identifiant précis validé
    // manuellement. Si cette voix n'existe pas sur l'appareil (moteur OEM différent de Google TTS),
    // repli sur un pitch abaissé + tentative de repérage par nom, moins fiable mais sans dépendance
    // à un identifiant figé.
    var JEREMIE_VOICE_URI = 'fr-fr-x-frd-local';
    var _ttsResolved;
    async function _resolveJeremieVoice(lang) {
        if (_ttsResolved) return _ttsResolved;
        var result = { pitch: 0.82 };
        try {
            var res = await Plugins.TextToSpeech.getSupportedVoices();
            var voices = (res && res.voices) || [];
            var langPrefix = (lang || 'fr-FR').split('-')[0].toLowerCase();
            var maleGuessIdx;
            for (var i = 0; i < voices.length; i++) {
                var v = voices[i];
                if (!v.lang || v.lang.toLowerCase().indexOf(langPrefix) !== 0) continue;
                if (v.voiceURI === JEREMIE_VOICE_URI) { result.voice = i; result.pitch = 1.0; break; }
                if (maleGuessIdx === undefined && /(^|[^a-z])(male|homme|man)([^a-z]|$)/i.test(v.voiceURI || v.name || '')) maleGuessIdx = i;
            }
            if (result.voice === undefined && maleGuessIdx !== undefined) result.voice = maleGuessIdx;
        } catch(e) {}
        _ttsResolved = result;
        return result;
    }
    window.FAGMobile.speak = async function(text, lang) {
        try {
            if (!Plugins.TextToSpeech || !text) return false;
            var resolved = await _resolveJeremieVoice(lang);
            var opts = { text: text, lang: lang || 'fr-FR', rate: 1.0, pitch: resolved.pitch, volume: 1.0 };
            if (resolved.voice !== undefined) opts.voice = resolved.voice;
            await Plugins.TextToSpeech.speak(opts);
            return true;
        } catch(e) { console.warn('[FAG Mobile] speak:', e.message); return false; }
    };
    window.FAGMobile.stopSpeaking = async function() {
        try { if (Plugins.TextToSpeech) await Plugins.TextToSpeech.stop(); } catch(e) {}
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

    // ── Re-verrouillage biométrique au retour au premier plan ────────────────────
    // Dès que l'app repasse en arrière-plan (verrouillage du téléphone, changement
    // d'appli...), on prévient l'app.html pour qu'elle réarme l'écran de verrouillage
    // biométrique du prestataire — sinon quelqu'un qui récupère le téléphone déverrouillé
    // pendant que l'app tourne en arrière-plan retrouverait l'espace prestataire ouvert.
    if (Plugins.App) {
        Plugins.App.addListener('appStateChange', function(state) {
            if (!state.isActive) {
                document.dispatchEvent(new CustomEvent('fagmobile:backgrounded'));
            } else {
                // Ne se déclenche que sur une VRAIE reprise depuis l'arrière-plan (pas au
                // lancement à froid) — permet à app.html de reposer le voile biométrique
                // immédiatement si l'espace prestataire était affiché avant la mise en
                // arrière-plan, sans attendre qu'une navigation le redéclenche.
                document.dispatchEvent(new CustomEvent('fagmobile:resumed'));
            }
        });
    }

    window.FAGMobile.ready = true;
    document.dispatchEvent(new CustomEvent('fagmobile:ready', { detail: { platform: window.Capacitor.getPlatform() } }));

    console.log('[FAG Mobile] Bridge initialisé ✓');
})();
