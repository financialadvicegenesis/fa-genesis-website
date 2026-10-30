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

## Ce dépôt GitHub est PUBLIC — aucun identifiant, mot de passe ou clé dans le code

Incident réel le 2026-10-27 : l'e-mail et le mot de passe admin étaient écrits en clair dans
`server/server.js` (connexion admin via `/api/partner/auth/login`, et mot de passe de secours de
`ADMIN_ACCOUNTS` pour `admin.html`), lisibles par n'importe qui sur GitHub. Retirés ; les accès
admin passent uniquement par les variables d'environnement Render (`ADMIN_PARTNER_EMAIL` /
`ADMIN_PARTNER_PASSWORD` pour l'admin dans l'app, `ADMIN_PASSWORD` pour `admin.html`). Jamais de
valeur de repli écrite en dur (`process.env.X || 'motdepasse'`) : sans la variable, l'accès doit
être refusé, pas retomber sur un secret public. L'ancien mot de passe reste dans l'historique git
et ne doit plus jamais être réutilisé.

## Build local de l'AAB Android signé pour Google Play Console

Le keystore de production et ses identifiants ne sont PAS dans ce repo (`android/` est
entièrement gitignored) : ils vivent dans `GENESIS - Google Play package/` (dossier sibling de
`fa-genesis-landing/`, un niveau au-dessus), avec `signing.keystore` + `signing-key-info.txt`
(mot de passe magasin/clé, alias `genesis-key`) et l'archive de tous les `.aab` déjà livrés
depuis versioncode11. Avant de rebuild :
1. Bumper `versionCode`/`versionName` dans `android/app/build.gradle` (Play Console exige un
   versionCode strictement croissant à chaque upload).
2. Charger les 4 variables d'environnement (`RELEASE_STORE_FILE`, `RELEASE_STORE_PASSWORD`,
   `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`) depuis `signing-key-info.txt` — ne jamais taper
   le mot de passe en clair dans une commande (bloqué par le classificateur de sécurité de toute
   façon), le lire par script (`grep`/`sed`) dans le même appel shell qui lance `./gradlew`
   (l'état d'environnement ne survit pas entre deux appels shell séparés).
3. `cd android && ./gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`.

Piège vécu le 2026-10-22 : `./gradlew bundleRelease` échouait avec "Cannot mutate the
dependencies of configuration ':app:releaseCompileClasspath' after the configuration was
resolved" — l'AGP pinné (`com.android.tools.build:gradle:8.2.1` dans `android/build.gradle`)
n'est pas compatible avec Gradle 9.7.1, pourtant devenu la valeur de
`android/gradle/wrapper/gradle-wrapper.properties` (très probablement réécrit par un `npx cap
sync android` après une mise à jour npm de `@capacitor/android`/`@capacitor/cli` — ce fichier
n'est pas versionné, rien dans git n'aurait montré ce changement). Remettre
`distributionUrl=...gradle-8.2.1-all.zip` (déjà en cache local, aucun téléchargement) a
immédiatement résolu le problème — ignorer le message d'erreur qui pointe vers google-services,
ce n'est pas la vraie cause malgré les apparences.

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
   (iOS). Côté iOS, `CAPBridgeViewController` n'est PAS lui-même le `WKNavigationDelegate` — il
   délègue à un objet interne (`WebViewDelegationHandler`, voir `node_modules/@capacitor/ios`)
   instancié dans une méthode `final`, sans aucun point d'extension officiel (première tentative de
   sous-classer `CAPBridgeViewController` : échec de compilation, "method does not override any
   method from its superclass"). La vraie approche : réassigner `webView.navigationDelegate` (depuis
   `applicationDidBecomeActive`) à un wrapper `NSObject` qui n'intercepte que
   `didFailProvisionalNavigation` et transfère tout le reste (`NSObject.forwardingTarget`) au vrai
   `WebViewDelegationHandler` de Capacitor (`bridge.webViewDelegationHandler`, exposé public).
4. **`WebView.loadUrl()` est ASYNCHRONE côté Android — un piège vécu en vrai** (2026-10-23, signalé
   par un prestataire sur la 2.5.9 : le correctif ne marchait PAS malgré un code qui semblait correct
   à la lecture et qui COMPILAIT sans erreur). `settings.setCacheMode(LOAD_CACHE_ONLY);
   view.loadUrl(url); settings.setCacheMode(LOAD_DEFAULT);` annule la contrainte "cache uniquement"
   AVANT qu'elle n'ait eu la moindre chance de s'appliquer, puisque `loadUrl()` ne fait que poster la
   navigation et revient immédiatement — la requête réelle démarre plus tard, après le reset. Le mode
   cache doit rester sur `LOAD_CACHE_ONLY` jusqu'à `onPageFinished` (succès) ou le prochain
   `onReceivedError` (échec), jamais remis à `LOAD_DEFAULT` entre les deux. Un bug de ce type est
   invisible à la simple lecture du code — seul un test réel hors-ligne sur un vrai appareil l'a
   révélé ; toujours redemander une confirmation terrain après un correctif de ce genre plutôt que de
   le déclarer résolu sur la seule base d'une compilation réussie.

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

## Anti-liens externes dans les profils prestataires : `server/link-guard.js` est partagé app + serveur

Un seul fichier décide de ce qui est un lien de redirection / une coordonnée dans les textes
PUBLICS des prestataires (bio, prestations, légendes du portfolio, promotions) : `server/link-guard.js`,
chargé par `server.js` (`require('./link-guard')`) ET par `app.html` (`<script src="server/link-guard.js?v=...">`).
- Le modifier = bumper son `?v=` dans `app.html` (sinon l'app garde l'ancienne règle, voir plus haut).
- ES5 sans lookbehind : les WebView iOS < 16.4 plantent sur toute la page sinon.
- Ne PAS le confondre avec `CONTOURNEMENT_PATTERNS` (messagerie) : ici les simples mots
  « Instagram », « YouTube » sont autorisés, seuls les vrais liens/comptes/coordonnées sont bloqués.
- Règle des anciens contenus : un texte identique à celui déjà en base est accepté (sinon le
  prestataire ne peut plus rien enregistrer) ; il est masqué aux clients via `publicText()` et les
  liens de portfolio (`type:'video'`) via `isPortfolioExternalLink()`. Toute NOUVELLE route qui
  renvoie bio/prestations/portfolio/promotions à un client doit passer par ces deux helpers. Audit :
  `GET /api/admin/external-links-audit` (admin.html › Modération). Tests de référence dans le
  commit qui a introduit ce fichier.

## Modération des images prestataires : `server/image-moderation.js` (OCR local, fail-closed)

Photos de portfolio (`type:'photo'`) et photo de prestation (`service.image`) sont analysées sur
NOTRE serveur (tesseract.js + modèles `server/tessdata/` embarqués, jsQR, sharp) — aucun service
tiers. Verdicts : `blocked` (refus 400 `image_blocked`), `review` → stocké `moderation.status:'pending'`
(ou `service.image_moderation`), `approved`.
- Toute route qui renvoie un portfolio ou une photo de prestation à un CLIENT doit filtrer avec
  `imageIsPublic()` (une image `pending`/`rejected` ne doit jamais sortir). Absence de champ
  `moderation` = ancienne image d'avant la modération = publique.
- Le statut n'est JAMAIS lu depuis la requête : recopié du serveur si l'image est inchangée,
  recalculé sinon. `/api/partner/media/check` n'est qu'un confort UX (cache du verdict).
- Fail-closed : OCR en erreur/indisponible → `pending`, jamais `approved`. Coupe-circuit d'urgence
  (mémoire Render saturée) : variable `IMAGE_MODERATION_DISABLED=1` → plus d'analyse.
- File humaine : `GET /api/admin/image-moderation` + `POST .../decide` (admin.html › Modération).
- Les vidéos (`video_upload`) ne sont PAS analysées (pas d'ffmpeg sur le serveur).

## Sécurité serveur (audit du 2026-10-30) — ne pas défaire

- **Aucun secret dans le code** (dépôt public) : `JWT_SECRET` doit être défini sur Render. Sans
  lui, secret aléatoire par démarrage. Tout jeton signé avec l'ancien secret public
  `'fa-genesis-secret-key'` est refusé, même enregistré sur le compte (`_storedTokenAllowed`).
- **Anti-injection à l'entrée** : middleware `sanitizeBody` juste après `express.json` — tout texte
  saisi par un client/prestataire perd `< > \` et voit `" '` remplacés par `” ’`. Une nouvelle
  route qui a besoin du texte brut (mot de passe, fichier, identifiant…) doit avoir une clé
  couverte par `_SANITIZE_SKIP_KEYS`, sinon sa valeur sera modifiée.
- **Connexions limitées** (8 échecs / e-mail, 30 / IP, 15 min) : `_AUTH_LIMITED_PATHS`.
- **Ne jamais renvoyer `client_email` / téléphone du client à un prestataire** avant paiement.
