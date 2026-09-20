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
  (ex : diffusion `/api/coworking/messages` côté partenaire, volontairement non basculée sur FCM
  faute de ciblage précis — voir le commentaire sur place).

**Historique** : trouvé et corrigé le 2026-09-21 sur `/api/admin/support/:id/reply` (réponse du
support jamais notifiée sur Android), le statut des réservations coworking, et le chat "COM VISA".
Avant tout nouvel appel à `sendPushToUser`/`sendPushToRole`, vérifier si `notifyUser()` ne devrait
pas être utilisée à la place.

## AOS (Animate on Scroll) peut cacher tout le contenu

Le CSS d'AOS met `opacity: 0` sur tout élément `data-aos`. Si `AOS.js`/`AOS.init()` échoue à
charger, le contenu reste invisible. Ne jamais utiliser AOS sur une page fonctionnelle (dashboard,
formulaire) — uniquement sur les pages marketing/vitrine.

## `persistToCloud()` : toute nouvelle collection doit être ajoutée à la liste de sauvegarde

Toute nouvelle donnée persistée via `persistToCloud('nom-collection', data)` doit avoir son nom
exact ajouté à `COLLECTIONS` dans `server/persistent-store.js`, **dans le même commit**. Une
collection oubliée ici est invisible à la restauration MongoDB après un déploiement — bug déjà
rencontré plusieurs fois (wallets, partner_requests, chat, etc.), avec une perte de données réelle
à chaque fois.
