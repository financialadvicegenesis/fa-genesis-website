# FA GENESIS — Règles critiques pour tout changement de code

Ce fichier documente des pièges déjà rencontrés dans ce projet. Avant de toucher aux zones
listées ci-dessous, relire la règle correspondante — elle existe parce que le bug s'est déjà
produit une fois (parfois plusieurs).

## Notifications push : `notifyUser()` uniquement pour un client/partenaire

`sendPushToUser(email, payload)` et `sendPushToRole(role, payload)` (server.js) envoient du
**Web Push uniquement** (navigateur/PWA) et n'ont **aucun lien avec Firebase/FCM** — un client ou
un partenaire utilisant l'application Android/iOS native ne recevra donc **rien du tout** sur son
téléphone si on les appelle directement, même avec un token FCM valide enregistré.

Pour notifier un **client** ou un **partenaire**, toujours passer par :

```js
notifyUser(email, role, type, title, body, link);
```

Elle persiste la notification (historique/cloche) ET déclenche Web Push + FCM en un seul appel.

`sendPushToUser`/`sendPushToRole` ne doivent être appelées directement que :
- pour le rôle `'admin'` (espace web uniquement — `sendFcmToRole` exclut ce rôle exprès, l'équipe
  n'utilise pas l'app native) ;
- pour un cas où l'absence de notification native est un choix assumé et documenté en commentaire
  sur place.

**Historique** : trouvé et corrigé le 2026-09-21 sur `/api/admin/support/:id/reply` (réponse du
support jamais notifiée sur Android), le statut des réservations coworking, et le chat "COM VISA".
Avant tout nouvel appel à `sendPushToUser`/`sendPushToRole`, vérifier si `notifyUser()` ne devrait
pas être utilisée à la place.

## AOS (Animate on Scroll) peut cacher tout le contenu

Le CSS d'AOS met `opacity: 0` sur tout élément `data-aos`. Si `AOS.js`/`AOS.init()` échoue à
charger, le contenu reste invisible. Ne jamais utiliser AOS sur une page fonctionnelle (dashboard,
formulaire) — uniquement sur les pages marketing/vitrine.

## Un seul routeur de liens de notification : `_handleNotifHash()`

Toute nouvelle destination de notification (nouveau format de `link` passé à `notifyUser()`) doit
être ajoutée **uniquement** dans `_handleNotifHash(hash)` (app.html). C'est le seul routeur —
`openNotifItem()` (clic dans le panneau cloche) et le tap sur une notification système/push
délèguent tous les deux à cette même fonction. Ne jamais réintroduire de logique de routage
directement dans `openNotifItem()` : un second routeur qui se désynchronise du premier a déjà
provoqué un bug réel (2026-09-21, commit 403bdf2) où la plupart des clics sur une notification
dans la cloche ne redirigeaient nulle part, faute d'écouteur `hashchange` derrière le
`window.location.href` utilisé en repli.

## `persistToCloud()` : toute nouvelle collection doit être ajoutée à la liste de sauvegarde

Toute nouvelle donnée persistée via `persistToCloud('nom-collection', data)` doit avoir son nom
exact ajouté à `COLLECTIONS` dans `server/persistent-store.js`, **dans le même commit**. Une
collection oubliée ici est invisible à la restauration MongoDB après un déploiement — bug déjà
rencontré plusieurs fois (wallets, partner_requests, chat, etc.), avec une perte de données réelle
à chaque fois.

## Modifier `mobile-bridge.js` sans changer `?v=` dans `app.html` = correctif invisible

`app.html` charge `mobile-bridge.js` via `<script src="mobile-bridge.js?v=DATE" defer>`. Comme
`ios/`/`android/` sont régénérés à chaque build mais que `mobile-bridge.js` est servi en direct
depuis le serveur (comme `app.html`), toute édition de ce fichier doit s'accompagner d'un bump du
paramètre `?v=` dans `app.html` **dans le même commit** — sinon le cache HTTP (téléphone/CDN
GitHub Pages) continue de servir l'ancienne version indéfiniment, malgré des pushs répétés. Bug
réel le 2026-09-30 : 3 commits successifs sur `mobile-bridge.js` (pont Firebase iOS, retry
getToken, instrumentation diagnostique) n'ont eu strictement aucun effet observable pendant des
heures, jusqu'à ce que ce bump manquant soit identifié comme cause racine.

## Même règle pour TOUTE image/asset remplacé plusieurs fois (pas que `mobile-bridge.js`)

Bug réel le 2026-10-13 : l'avatar de Jérémie (`assets/images/jeremie-avatar.png`) a été remplacé
3 fois de suite sans jamais changer son URL — un prestataire a continué à voir l'ancienne icône/
l'ancien bug de clignement bien après le push et la confirmation que le fichier était à jour côté
serveur, simplement parce que son téléphone avait déjà l'ancienne image en cache HTTP. Dès qu'un
fichier binaire (image, police...) référencé par une URL fixe est modifié, ajouter/bumper un
`?v=DATE` sur CETTE URL précise, dans le même commit — sinon aucune confirmation serveur ne reflète
ce que l'appareil affiche réellement.

## Ne jamais appeler `location.reload()` sur `controllerchange` du Service Worker

Bug réel le 2026-10-16 : `pwa-init.js` rechargeait automatiquement la page dès qu'un nouveau
Service Worker prenait le contrôle (`navigator.serviceWorker.addEventListener('controllerchange',
() => location.reload())`). Comme `sw.js` utilise `skipWaiting()` + `clients.claim()`, CHAQUE
activation d'un SW (y compris sa toute première, pas seulement une mise à jour) prend
immédiatement le contrôle de toute page déjà ouverte et déclenche ce reload — sur un projet qui
déploie aussi souvent que celui-ci, ça veut dire qu'un visiteur peut se faire recharger sa page
en pleine interaction (formulaire, sélecteur de langue...) à peu près n'importe quand. Confirmé
par test réel : `login.html` se rechargeait seul ~2-3s après son chargement, sans aucune action
utilisateur. Le SW reste actif et sert les ressources à jour sans ce reload forcé — le JS déjà en
mémoire continue simplement de tourner jusqu'à la prochaine navigation naturelle. Ne jamais
réintroduire ce pattern sans un garde-fou explicite (ex: ignorer le tout premier événement, ou ne
reload que si aucune interaction n'est en cours).

## App native hors-ligne : app.html doit s'ouvrir même sans réseau (données mobiles + wifi off)

Bug réel le 2026-10-22 : données mobiles ET wifi désactivés, l'app Android/iOS restait bloquée
indéfiniment sur l'écran de démarrage natif, contrairement à Facebook/Instagram qui s'ouvrent
hors-ligne (juste sans données à jour). Trois faits à connaître ENSEMBLE avant de retoucher ce
mécanisme, sinon le correctif de l'un casse l'autre :

1. **Le Service Worker est désactivé en natif, par choix assumé** (`pwa-init.js`, `_isNative`) —
   incident écran noir déjà vécu sur un appareil réel. `sw.js` ne protège donc QUE le web/PWA, jamais
   l'app native. Ne jamais compter sur `sw.js` pour un correctif natif.
2. **app.html ajoute un paramètre `_cb=<timestamp>` unique à chaque lancement natif** (voir le
   script en tête de `app.html`) pour forcer un cache-miss garanti sur GitHub Pages/Fastly et éviter
   qu'un correctif mette jusqu'à 10 min à atteindre un téléphone. Ce `_cb=` est TOUJOURS une URL
   jamais vue — donc incompatible par nature avec un repli cache natif si on ne le neutralise pas :
   repli cache + `_cb=` actif = l'app retente une URL qui n'a jamais pu être mise en cache, et reste
   bloquée quand même. Le garde-fou : ce script ne redirige vers `_cb=` que si `navigator.onLine !==
   false` — hors-ligne, il garde la page telle que resservie par le cache natif, sans re-rediriger.
3. **Le vrai repli hors-ligne passe par le cache HTTP natif de la WebView elle-même**, pas par un
   mécanisme JS : `MainActivity.setupOfflineCacheFallback()` (Android, sous-classe
   `BridgeWebViewClient`, `LOAD_CACHE_ONLY`) et l'étape `codemagic.yaml` "Add offline launch fallback"
   (iOS, sous-classe `CAPBridgeViewController` en `OfflineCacheViewController`, `cachePolicy
   .returnCacheDataDontLoad`) — une seule tentative de rechargement depuis le cache sur échec de la
   navigation principale. Toujours sous-classer (jamais remplacer entièrement le WebViewClient/
   WKNavigationDelegate de Capacitor) pour ne pas casser le pont JS↔natif ni les deep links.

Conséquence pratique : un changement natif Android nécessite un nouveau build+publish local
(`android/` gitignored, jamais poussé) ; un changement iOS nécessite un nouveau build Codemagic
(`ios/` régénéré à chaque build, jamais local) — aucun des deux n'est un simple push `app.html`.

## iOS : signature du pont push notifications Firebase

Contrairement à Android (jeton FCM direct via `@capacitor/push-notifications`), iOS nécessite
`@capacitor-firebase/messaging` (jeton APNs → FCM). Trois pièces natives sont obligatoires et
**aucune n'est générée automatiquement** par Capacitor ni par ce plugin — toutes régénérées à
chaque build (`ios/` gitignored), donc injectées via des étapes `codemagic.yaml` :
1. `GoogleService-Info.plist` enregistré dans `project.pbxproj` (pas juste copié sur le disque —
   Xcode ne l'inclut pas dans le bundle sinon, et `FirebaseApp.configure()` plante au lancement).
2. 3 méthodes ajoutées à `AppDelegate.swift` (`didRegisterForRemoteNotificationsWithDeviceToken`
   etc.) pour transmettre l'enregistrement APNs au SDK Firebase.
3. `App.entitlements` avec `aps-environment: production` (TestFlight utilise l'environnement
   APNs **production**, pas sandbox) référencé via `CODE_SIGN_ENTITLEMENTS`. Sans lui,
   `getToken()` échoue en boucle avec "No APNS token specified" — aucune erreur ailleurs, symptôme
   identique à un simple problème de timing, à ne pas confondre avec lui.

Voir `project_ios_push_notifications_firebase_bridge.md` pour l'historique complet du diagnostic.

## AppI18n ne traduit QUE du texte statique — contenu dynamique (base de données) = mécanisme séparé

Le dictionnaire `app-i18n-<lang>.js` fait un **match exact** sur des chaînes françaises connues au
moment de la traduction manuelle. Tout texte rédigé après coup par un admin (actualités, avis,
descriptions de profil...) et stocké en base ne peut **jamais** matcher une clé du dictionnaire —
il reste silencieusement en français quelle que soit la langue choisie, sans erreur visible.

Pour ce cas (voir `/api/actualites` et `_translateActualite()` dans `server.js`), le bon pattern est
une traduction à la demande via l'API Anthropic (`claude-haiku-4-5`, même pattern que
`/api/admin/linkedin/generate-message`), mise en cache dans un champ `translations[lang]` sur
l'enregistrement et persistée (`saveActualites()`/`persistToCloud`) — traduit une seule fois par
texte/langue, pas à chaque visite. **Piège associé** : toute route d'édition de ce contenu doit
invalider (`translations = {}`) le cache si le texte source français change, sinon les traductions
affichées restent désynchronisées du français indéfiniment.
