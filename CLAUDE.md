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

### Pas de notification inutile (ménage du 2026-11-05)

Avant d'ajouter un `notifyUser()`, vérifier que la personne a quelque chose à apprendre ou à faire :
- **Jamais pour une action qu'elle vient de faire elle-même** dans l'app (boost activé, retrait
  demandé…) : la réponse de l'API + le toast suffisent. Le retrait renvoie `sent` + un message exact.
- **Une seule notification par événement.** Si un même événement touche plusieurs choses (gains
  crédités + prestation validée, récompense de parrainage + mission + classement), on fait UN
  message. `processDispatchPayout(d, stage, { silent: true })` quand l'appelant annonce lui-même les
  gains (validate-delivery, libération à 7 jours). Une notif pour le client à l'acompte d'une
  prestation (`payment_success`), pas aussi « Paiement confirmé ».
- **Vagues** (plusieurs livrables publiés à la suite) : `_mergeIntoRecentNotif()` met à jour la
  notification non lue au lieu d'en créer une nouvelle — un seul push.
- **Rien d'invérifiable** (« votre prestataire travaille toujours… ») et **aucune relance
  marketing** hors du circuit d'offres opt-in (« Palier en vue », alerte nouveau prestataire :
  supprimées). Pas de bandeau qui explique le mécanisme des notifications.
- Niveau client : annoncé seulement quand il monte.
- **Annonces GENESIS** (nouvelle fonctionnalité, événement à places limitées, et leur envoi
  différé de 24 h) : `notifyAnnouncement()` — tout le monde la voit dans l'app, mais le push ne part
  qu'avec « Nouveautés et promos » accepté (`offers_push === true`), dans les plafonds et le journal
  des notifications d'offres (kind `annonce`). `notifyUser(..., { push: false })` = liste seulement.
- **Réponse de FA GENESIS depuis la messagerie admin** (`/api/admin/inbox/reply`) : notifie le client
  (`message-admin`, lien `#open-messages-admin`). Côté app, la conversation « FA GENESIS » apparaît
  dans la liste Messages (clé `__admin__`, lue via `/api/messages/conversation/read`) et compte dans
  le badge — avant, le client ne voyait jamais la réponse.

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

## Métiers multiples d'un prestataire : UN compte, jamais un compte par métier
- `partner_type` = métier principal (inchangé, fixé à l'inscription). `secondary_types` = 2 métiers
  secondaires max (pas `coworking`), modifiables dans Profil → « Mes métiers ».
- Secondaire `other` = « Autre métier » écrit par le prestataire dans `secondary_type_other`
  (2–40 car., contrôlé comme la bio par `rejectExternalLink`). Sans texte, `cleanSecondaryTypes(list,
  primary, otherText)` l'écarte ; impossible si le principal est déjà `other`. Libellés :
  `partnerTypeLabelFor` (serveur) / `partnerTypeLabelOf` (app) — jamais `PARTNER_TYPE_LABELS['other']`.
  Pour l'instant proposé seulement dans « Mes métiers » (pas à l'inscription).
- Chaque prestation a `category` (un des métiers du prestataire, sinon métier principal —
  `serviceCategoryOf`). Retirer un métier ramène ses prestations au métier principal.
- Filtrer une catégorie de l'annuaire avec `partnerListedInType(p, cat)`, JAMAIS
  `p.partner_type === cat` : métier principal toujours listé, secondaire seulement avec au moins une
  prestation active dans ce métier (anti « je coche tout »).
- `partnerDirectoryShape(p, promos, category)` renvoie `partner_types`, `matched_type` (libellé de
  la carte côté app via `partnerTypeLabel`) et le prix « à partir de » du métier parcouru.
- Les usages internes de `partner_type` (dispatch/kickoff, densité par catégorie, pairs) restent sur
  le métier principal, volontairement.
- Saisie des métiers secondaires : inscription app (`_ptnrRegSecondary`) ET site
  (`partner-register.html`, `selectedSecondaryTypes`), Profil → « Mes métiers », admin (fiche
  prestataire → « Métiers », PUT `/api/admin/partners/:id` avec `partner_type`/`secondary_types`).
  Toujours passer par `cleanSecondaryTypes` côté serveur.

## Messagerie client ↔ prestataire : texte seulement, photos via un appel séparé
- Aucune pièce jointe entre client et prestataire (`PEER_ATTACHMENTS_MESSAGE`, refus 400
  `attachments_not_allowed` dans `POST /api/messages` vers un prestataire et
  `POST /api/partner/inbox/reply`) : un PDF/une image contourne le filtre anti-coordonnées. Les
  fichiers de travail passent par les livrables. Ne pas remettre de trombone dans ces conversations.
- Photos des interlocuteurs : `POST /api/messages/avatars` (client) et
  `POST /api/partner/inbox/avatars` (prestataire), limités aux personnes avec qui l'appelant a
  échangé. Côté app : `_msgAvatarSlot` / `_msgLoadAvatars` (cache par email). Ne JAMAIS mettre les
  photos dans `GET /api/messages` ou `/api/partner/inbox` (pollés en continu, photos en data URI).

## Étudiants : tarifs réservés aux étudiants VÉRIFIÉS + justificatifs persistés
- `studentPriceBlocked(service, user)` : un compte `etudiant` dont `student_status !== 'verified'`
  voit les offres étudiants mais ne peut pas les commander (`/api/partner-requests` et
  `/api/orders/create` → 403 `student_not_verified`). Promotions ouvertes à tous. Tout nouveau
  chemin de commande doit appeler ce contrôle.
- `student_certificates` est un OBJET `{ userId: {data, submitted_at} }` en mémoire, persisté dans
  MongoDB en TABLEAU `[{userId, ...}]` (collection `student_certificates`, dans COLLECTIONS de
  persistent-store.js). `loadCertificates` accepte les deux formats. Avant le 2026-11-02 rien
  n'était persisté : les justificatifs disparaissaient à chaque redéploiement.
- Admin → Étudiants : `reject` sert aussi à « Demander un nouveau justificatif » et « Retirer la
  vérification » (motif envoyé à l'étudiant).

## Admin → Prospects = recrutement de PRESTATAIRES (plus d'entreprises clientes)
- Recherche Google Places par métier GENESIS (`PROSPECT_TYPE_QUERIES`, clés = PARTNER_TYPES),
  score de recrutement /9 (`prospectRecruitScore`), établissements fermés ignorés.
- `findPartnerForProspect` (e-mail, téléphone, site) : un prospect inscrit passe en `converted`
  (« Inscrit sur GENESIS ») à chaque GET. `prospects` est persisté dans MongoDB.
- Messages d'invitation (e-mail + message court à copier pour Instagram/TikTok) : 5 %, sans
  abonnement, inscription gratuite, lien partner-register.html, mention « STOP ».

## Notifications d'offres (nouveaux prestataires + promos) — accord obligatoire, plafonds
- `runDiscoveryPushes` (server.js) : 1 passage/jour entre 18 h 30 et 21 h (heure de Paris), verrou
  `last_run_date` persisté AVANT envoi. Par destinataire : 1/jour, 3/7 jours glissants, jamais deux
  fois le même prestataire ni la même promo, filtré par catégorie client (`scopePartnerForAudience`).
- N'envoyer QU'aux personnes ayant accepté : `users[].offers_push === true`, ou jeton visiteur
  `fcm_tokens[].guest && offers` (`/api/push/register-guest`). Exigence Apple 4.5.4 + CNIL : ne jamais
  ajouter de notification promotionnelle hors de ce circuit.
- Canal Android : `genesis_general` (un nouveau canal exige une nouvelle version native, sinon la
  notification est perdue sans erreur — voir GenesisMessagingService.ensureChannelExists).
- Textes traduits par fragments dans app-i18n-dict-*.js (métiers entre parenthèses « (Photographe) »).
- Lien `#decouverte:OFR-xxx:<partnerId>` → `/api/push/opened` (mesure) + fiche du prestataire.

## Remise sur une prestation : prix facturé = `serviceCurrentPrice(service)`, jamais `service.price`
Un prestataire peut mettre une remise (5 à 90 %, date de fin facultative) sur une prestation à prix fixe étudiant/particulier/entreprise, sans passer par la catégorie « Promo » (2026-11-06). Toute commande, demande ou affichage client doit utiliser `serviceCurrentPrice(s)` / `serviceDiscountPct(s)` (server.js) : un `parseFloat(service.price)` ajouté dans un nouveau chemin de paiement facturerait le prix plein pendant qu'on affiche le prix remisé. Le versement au prestataire se calcule sur le prix remisé (il finance sa remise) ; l'avantage bienvenue s'applique ensuite. Côté app, le serveur envoie `price` = prix remisé et `price_before_discount` = prix d'origine : le panier et les totaux n'ont rien à recalculer. `_ptnrCollectServiceItems()` reconstruit TOUTES les prestations depuis le DOM : un champ de prestation non relu là est effacé au prochain enregistrement.

## Devis non pris en charge : transfert automatique par Jérémie (2026-11-06)
Refus du prestataire, ou pas de réponse dans son temps de réponse annoncé (24 h par défaut, borné 6 h–48 h) → `startQuoteTransfer()` transmet la demande à 3 prestataires max du même secteur, classés surtout par réactivité (`findQuoteTransferCandidates`). Tout est dans `partner_requests` : demande d'origine = `transfer {status, candidates, ...}`, demandes transmises = `transferred_from` + `jeremie_brief`. Statuts propres : `transfer_accepted` (accepté, attend le choix du client), `transfer_closed`, `transfer_refused`, `expired`. Une demande transmise n'est visible du client qu'une fois choisie (filtre de `/api/my-requests`) ; avant, elle apparaît dans la carte « Jérémie IA » de la demande d'origine (Mes réservations). Tâche `processQuoteRequestDeadlines` toutes les 10 min. `QUOTE_TRANSFER_START` : les demandes plus anciennes ne sont jamais transmises (pas de vague de transferts au déploiement). Choix des prestataires par règles déterministes ; résumé de la demande rédigé par Claude (`aiService.summarizeQuoteRequest`, SDK officiel, `claude-opus-5-5`, effort low, `fallbacks: 'default'`) en tâche de fond, une fois par langue de prestataire, nettoyé par `publicText` ; jamais bloquant (sans clé ou en échec, la carte garde l'analyse par règles ; échec temporaire réessayé 3 fois). « Explorer GENESIS » côté prestataire (liste et messagerie entre concurrents) est retiré : ne pas le réintroduire, les routes `/api/partner/peer*` répondent 410.

## Devis filtrés par statut client (2026-11-07) — contrôle serveur à chaque accès
Chaque demande de devis (`partner_requests`) porte `audience` (etudiant | particulier | entreprise | promo), fixée par le serveur à la création depuis la prestation (`audienceForServiceRequest`) — jamais lue depuis l'app ; une demande transmise par Jérémie hérite de celle d'origine ; une ancienne demande la retrouve via `requestAudience()`. Toute nouvelle route client qui lit ou fait avancer un devis doit appeler `rejectRequestAudience(res, r, user)` (403 `audience_mismatch`), et toute route prestataire qui notifie le client `rejectPartnerRequestAudience`. Promo = visible de tous. Compte client sans statut = Particulier (`clientAudienceOfUser`, aussi `_clientAudience()` côté app). Un devis déjà payé reste toujours accessible (commande sous contrat). Une prestation sans catégorie valide est refusée (400), plus de « Particulier » par défaut.

## Messages de Jérémie (bulle près de l'avatar) ≠ notifications système (2026-11-07)
Deux mécanismes complémentaires. `notifyUser()` = cloche + push (registre des événements). `jeremieSay(role, email, {text, action_label, link, important, dedupe_key})` = bulle près de l'avatar (collection `jeremie_messages`, persistée MongoDB : sert à la diffusion, à l'anti-doublon et à la relecture au retour dans l'app), JAMAIS de push. Pas d'historique dans la fenêtre de Jérémie ni de pastille sur l'avatar (retirés le 2026-11-07 à la demande : doublon de la cloche) — l'historique, c'est la cloche. Pour qu'un événement ait aussi sa bulle : `notifyUser(..., { jeremie: { text, action_label } })` au point exact de l'événement, ou une règle par type dans `JEREMIE_COMPANION_RULES` ; `{ jeremie: false }` pour l'empêcher. La bulle est liée à la notification (`notif_id`) : la lire marque la notification lue (jamais deux fois la même nouvelle). Texte = état RÉEL (jamais « accepté » avant l'acceptation, jamais « payé » avant confirmation). Le lien doit viser la ressource exacte (routeur `_handleNotifHash`). Temps réel par le WebSocket existant (`sendToChatSocket`, types `jeremie_message` et `notification`), relecture au démarrage/reconnexion/retour au premier plan (`_jerFetchMessages`). Jérémie fonctionne aussi pour les prestataires (`_jerChatToken()` = session affichée, jamais `USER._token` en dur). La conversation (`jeremie_memory`) est maintenant persistée. Forme de la bulle : un SEUL tracé SVG continu (pointe incluse) recalculé par `_jerDrawBubbleShape` à chaque affichage/redimensionnement/déplacement de l'avatar — ne pas revenir à une bordure CSS + triangle séparé.

## Notifications au prestataire : prénom du client seulement (2026-11-07)
Toute notification/push envoyée à un prestataire nomme le client avec `_clientFirstName(client_name, 'Le client')` : jamais son nom complet, jamais son e-mail (`client_name` vaut l'e-mail quand le client n'a pas de nom). Côté client, jamais l'e-mail du prestataire à la place de son nom (`_partnerDisplayName`). Textes de notification traduits via `translateNotifText` (guillemets anglais remis en “…”), pas `translateServerText` — réservé aux contrats HTML.

## Découverte interactive des prestataires (cartes à glisser, 2026-11-07)
`#jer-discover` (app.html, module `_jd*`) présente en cartes les prestataires RÉELLEMENT trouvés par Jérémie : glisser à gauche / ✕ = passer, à droite / ★ = ajouter aux favoris (la « sélection » = `toggleFavorite`, rien de neuf côté serveur), ↶ = profil précédent, 👤 = fiche complète (`openPartnerDetail`, la pile reprend à la fermeture). Deux sources seulement : (1) conversation Jérémie — `/api/jeremie/chat` renvoie `discovery {partner_ids, label}` UNIQUEMENT si un métier est reconnu dans le message et que des prestataires de ce métier existent (`buildPartnerContextForJeremie(..., out)`, `out.matched`) ; un classement général n'est jamais présenté comme « correspondant à votre besoin » ; (2) transfert de devis — `#client:discover:<id>` lit `/api/my-requests` (`transfer.accepted` + `transfer.waiting_partner_ids`). États distincts, jamais confondus : en sélection (favori) ≠ contacté/en attente (`waiting`) ≠ a accepté (`accepted`, bouton « Choisir ce prestataire » = `_transferChoose`, même demande réutilisée) ≠ choisi. Ajouter à la sélection n'envoie AUCUNE demande (le toast le dit). Ne pas reprendre l'identité visuelle d'une appli de rencontre (couleurs GENESIS, pas de cœur/flamme).

## Apostrophes dans le texte JS : toujours ’ (typographique), jamais ' dans une chaîne entre '…'
Le 2026-11-08, « de l'app » dans une chaîne `'…'` d'admin.html (7096eef) a cassé TOUT le gros bloc `<script>` : plus de gestionnaire sur le formulaire, « Se connecter » rechargeait la page sans rien faire. Une erreur de syntaxe dans un bloc inline ne s'affiche nulle part pour l'utilisateur. Après toute modification de texte dans app.html / admin.html, vérifier chaque bloc `<script>` inline avec `node --check` (extraire le contenu de chaque bloc, ignorer les `<script>` cités dans des commentaires HTML).

## Visites invitées (admin → « Invités », 2026-11-09) — mesure d'audience ANONYME
L'app enregistre les appareils entrés sans compte (`goGuest` / `goPartner`) via `POST /api/guest/visit` (module `_gv*` d'app.html, collection `guest_visits`, synthèse `GET /api/admin/guests`). Identifiant aléatoire local `fa_guest_device` ; écrans et actions sur listes fermées (`GUEST_SCREENS`, `GUEST_ACTIONS`). Pour rester dans le cadre CNIL des mesures d'audience dispensées de consentement : NE JAMAIS y ajouter IP, navigateur complet, e-mail, nom, ni relier l'appareil au compte créé (l'issue `outcome` = seulement « compte client / prestataire créé » ou « connexion »). Conservation 13 mois après la dernière visite. Toute nouvelle donnée collectée doit aussi être décrite dans confidentialite.html et cookies.html. Sauvegarde groupée (30 s), pas une écriture par écran.

## Vidéos du portfolio prestataire : fichier brut à part, JAMAIS de base64 dans la fiche (2026-11-09)
Avant : vidéo lue en base64 et envoyée dans le JSON du portfolio → au-delà de la limite JSON (50 Mo) le serveur répondait 413 en HTML, l'app affichait « Erreur de connexion au serveur » ; une fiche MongoDB est limitée à 16 Mo ; une vidéo en data: ne se lit pas sur iPhone. Maintenant : `POST /api/partner/portfolio/video` (corps = le fichier, signature MP4/MOV/WebM vérifiée, 95 Mo max = sous la limite Cloudflare de 100 Mo) → `server/media-store.js` (GridFS « portfolio_media » si MongoDB, sinon data/media) → l'élément du portfolio garde seulement `https://…/api/media/VID-…` (adresse réécrite par le serveur, vidéo propriété du prestataire vérifiée) + `thumb` (aperçu JPEG créé sur le téléphone). `GET /api/media/:id` sert par morceaux (Range, 206) : obligatoire pour iPhone. Vidéos retirées supprimées ; envois jamais enregistrés supprimés après 24 h ; anciennes vidéos base64 déplacées au démarrage. `httpServer.requestTimeout` = 30 min (envoi en 4G). Champs `_…` de l'app (envoi en cours) jamais envoyés au serveur. Compression (2026-11-09, paquet `ffmpeg-static` autorisé par l'utilisateur) : après l'envoi, file d'attente d'UNE compression à la fois (`queueVideoTranscode`) → H.264/AAC, 1280 px max, faststart ; la version compressée remplace l'original à la MÊME adresse (`mediaStore.put` range la nouvelle version avant de supprimer l'ancienne ; `processed:true` = cache long, sinon `no-cache`). Échec ffmpeg = original gardé. Au démarrage, les vidéos non compressées sont remises en file. Ne pas compresser de façon synchrone dans la requête (délai Cloudflare de 100 s). PANNE DU 2026-11-09 (API entière en 502 ~40 min) : une compression a saturé la mémoire de l'instance Render, et la reprise au démarrage relançait la même vidéo → boucle de plantages. Règles depuis (5564346) : `markAttempt` AVANT toute compression (une vidéo tentée n'est JAMAIS relancée automatiquement), ffmpeg en 1 fil / superfast, source > 1080p laissée telle quelle si la limite mémoire du conteneur (cgroup) < 1,5 Go, reprise différée de 3 min, interrupteur `VIDEO_TRANSCODE=off`. Toute tâche lourde lancée au démarrage doit être protégée de la même façon contre la boucle de redémarrage. Garde-fou mémoire (2026-11-10, après l'alerte Render « exceeded its memory limit » du 9/11) : `_runVideoQueue` ne lance une compression que s'il reste `VIDEO_TRANSCODE_MIN_FREE_MB` (200 Mo par défaut ; 300 Mo bloquait tout : le serveur occupe jusqu’à ~50 % de ses 512 Mo au repos) de libre (`_serverMemoryUsed` = cgroup moins le cache inactif) ; sinon report de 2 min, 15 fois max, puis abandon SANS `markAttempt` (reprise au prochain démarrage). Une compression 1080p consomme ~120 Mo (mesuré). `[MEMOIRE]` dans les journaux Render = serveur au-delà de 80 % de sa limite (relevé toutes les 5 min).

## admin.html : jamais `color:black` / `#000` / `text-black` hors fond doré
Le thème sombre de l'admin (CSS « CORRECTION TOTALE VISIBILITÉ ») repeint automatiquement tout `color:black`, `color:#000`, `#111` et la classe `text-black` en gris clair (#e0e0e0), sauf sur fond doré (#FFD700 / #ffd43b / var(--genesis-yellow)). Un texte noir sur fond blanc, vert ou bleu devient donc illisible (badges des métiers secondaires, onglet « Uploads », pastilles, signalé le 2026-11-10). Pour un texte foncé sur fond coloré, écrire `color:#0a0a0a` (non visé par la règle) ; préférer sinon un badge à contour doré sur fond transparent. Depuis le 2026-11-10 (règle « 13bis »), un `color:black`/`#000` accompagné d'un `background:` explicite en ligne (hors transparent/white/#f8f9fa/#eee), ou `text-black` + `bg-[#…]`/`bg-gray-400`, reste foncé ; mais la fenêtre `.modal-content` est HORS `#adminPanel` et a ses propres règles (`p` → #ccc) : y donner des couleurs explicites.

## Textes saisis par le public : toujours échappés dans l'admin
Le formulaire de contact est public. Dans admin.html, tout champ venant d'un utilisateur (nom, e-mail, objet, message, téléphone…) passe par `_escHtml` (texte) ou `_studEsc` (attributs) avant `innerHTML`. Le serveur neutralise aussi à l'entrée (`sanitizeBody`) ; FAILLE CORRIGÉE 2026-11-10 : les champs e-mail en étaient exclus et « <svg onload=…>@x.io » passait le contrôle « a@b.c » → `sanitizeEmailValue` + `antiAbuse.isStrictEmail` (server/anti-abuse.js) partout où un e-mail est créé.

## Anti-abus (server/anti-abuse.js, 2026-11-10)
- Inscriptions client ET prestataire : `antiAbuse.checkSignupEmail` (format strict, adresses jetables refusées, domaine sans serveur de courrier refusé ; panne DNS = on laisse passer). `example.com` est refusé (null MX) : les fixtures de test doivent utiliser un vrai domaine (gmail.com).
- Contact : `scoreContactMessage` → statut `spam` (onglet « Indésirables » de l'admin, exclu de « Tous »), AUCUN e-mail envoyé (sinon le formulaire sert à faire envoyer nos e-mails à n'importe qui), réponse identique pour ne pas renseigner les robots. Messages déjà reçus triés une fois au démarrage (`spam_checked`), jamais ceux répondus/archivés.
- Admin : `risk_flags` calculés à chaque lecture de `/api/admin/users` et `/api/admin/partners` (adresse jetable/peu fiable, même téléphone que d'autres comptes) → pastille « À VÉRIFIER ». Informatif, jamais bloquant.

## Vérification des prestataires (justificatifs, 2026-11-10) — `server/partner-verification.js`
- Inscription app en 4 étapes (2026-11-11, demandé par FA GENESIS) : 1 profil (indépendant / freelance ou entreprise) → 2 pays → 3 informations (+ SIRET en France, immatriculation à l'étranger ; entreprise = raison sociale + représentant, et forcément immatriculée) → compte créé → 4 justificatifs dans la foulée (`_pvSignupMode`, même rendu que « Vérifier mon compte »), puis biométrie, profil, contrat. Hors de France le profil choisi est gardé dans `business_kind`.
- Statut légal choisi à l'inscription (app ; le site `partner-register.html` et les anciennes versions de l'app s'inscrivent encore sans, le prestataire choisit alors dans « Vérifier mon compte ») : `micro` / `company` en France (pays de `SIRET_COUNTRIES`, SIRET obligatoire, clé de Luhn), `foreign` ailleurs (`registered` + numéro local, sinon preuve d'activité). PAS de profil « étudiant » prestataire : un étudiant doit être micro-entrepreneur ; le public visé se règle prestation par prestation.
- SIRET contrôlé dans l'annuaire officiel `recherche-entreprises.api.gouv.fr` (gratuit, sans clé) : établissement fermé = refus ; introuvable / API en panne = accepté et signalé à l'admin (jamais bloquant).
- Pièces (2026-11-11, option A validée par FA GENESIS) : type de pièce (`id_doc_type` : carte / titre de séjour → recto `identity` + verso `identity_back` ; passeport → une page) + `face_video` (3 à 5 s, tête à gauche puis à droite, caméra de face ; convertie en H.264 sans son par la file de compression avec `store: privateDocStore`, lisible dans l'admin ; vue « Comparer la pièce et le visage ») pour TOUS. Un dossier commencé avec l'ancien `selfie` garde l'ancienne liste (`requiredFor`, rien à refaire). Toujours utiliser `PartnerVerif.requiredFor(v)`, jamais une liste en dur. Avant : + immatriculation (avis SIRENE / RNE / URSSAF, Kbis < 3 mois, document local) ou preuve d'activité. Fichiers bruts (jamais base64) dans `privateDocStore` = `media-store.js` avec bucket GridFS `partner_documents` / dossier `data/private_documents` : JAMAIS servis par `/api/media`, lus seulement par `/api/admin/partners/:id/verification/document/:kind`, supprimés à la validation (`_removeVerificationDocs`), au refus pour les pièces « à refaire », et à la suppression du compte. Ne jamais renvoyer les identifiants `DOC-…` au client (`partnerView`).
- Un compte `pending` ne s'active QUE par « Valider le dossier » (`/verification/approve`), contrat de partenariat signé obligatoire ; `PUT /api/admin/partners/:id` refuse `active` sans dossier validé (et sans contrat). Statuts acceptés : active / pending / deactivated.
- Prestataires déjà actifs : l'admin envoie la demande (carte « Vérification des prestataires », textes validés par FA GENESIS) → `verification_deadline` = J+30, une seule fois. Délai dépassé sans dossier envoyé ou validé = masqué des clients : utiliser `partnerIsListed(p)` pour TOUT ce qui montre un prestataire à un client ou crée une nouvelle demande/commande. NE PAS l'utiliser pour les missions en cours, paiements et remboursements (`accountStatus` seul) : un prestataire masqué n'est pas « inactif » (sinon ses clients en cours pourraient être remboursés à tort). Dossier envoyé = visible pendant l'examen.
- Badge client : `verified` + `verification_level` (`business` = « Entreprise vérifiée », `identity` = « Identité vérifiée », le seul possible sans immatriculation) dans l'annuaire et la fiche. Avant, `verified: true` était codé en dur.
- Un SIRET vérifié ne se remplace pas par « Coordonnées de versement » (409) : il passe par l'assistance.
- Contrat de partenariat v4 (article 13 : obligations légales et fiscales du prestataire), traduit dans `app-i18n-dict-*.js`. Les contrats déjà signés restent en v3.
- Écrans : app « Vérifier mon compte » (`_ptnrLoadVerification`, sous-écran `verification`, lien de notification `partner:verification`), bandeau d'accueil `ptnr-verif-bar` ; admin fiche prestataire → « Vérification ». Données décrites dans confidentialite.html.
- Inscription « Entreprise » : mêmes catégories d'annuaire que les indépendants, mais libellés d'entreprise (`PARTNER_TYPE_LABELS_COMPANY` : Studio photo, Agence web…), aussi pour les « autres activités ». Aucune mention « étudiant » dans l'inscription ni la vérification (demande de FA GENESIS, 2026-11-11).
- Caméra iPhone : l'app iOS < 1.0.4 n'a pas `NSCameraUsageDescription` → iOS FERME l'app dès que la caméra s'ouvre (« Prendre une photo » du menu, ou `capture`). `_pvCheckCamera()` (Capacitor App.getInfo) : sur ces versions, jamais de `capture`, avis + confirmation qui guident vers « Photothèque ». Le même risque existe pour tout `<input type=file>` image/vidéo de l'app tant que la 1.0.4 n'est pas installée.
