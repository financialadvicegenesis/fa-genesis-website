# 🔒 SYSTÈME DE CONSULTATION AVEC BLOCAGE DE TÉLÉCHARGEMENT

## 🎯 Vue d'ensemble

Un système de consultation des livrables a été mis en place pour les **prestations individuelles** uniquement (Photo, Vidéo, Marketing, Média). Ce système permet aux clients de visualiser leurs contenus après le paiement de l'acompte (30%), mais bloque le téléchargement jusqu'au règlement du solde (70%).

---

## 📊 Logique de consultation

### Pour les PRESTATIONS INDIVIDUELLES (`prestation_individuelle`)

| Statut de paiement | Accès | Fonctionnalités |
|-------------------|-------|-----------------|
| **Acompte payé (30%)** | Consultation uniquement | ✅ Visualisation en mode prévisualisation<br>❌ Téléchargement bloqué<br>📌 Bouton "Consulter" affiché<br>💬 Message "Téléchargement disponible après règlement du solde" |
| **Solde payé (70%)** | Téléchargement débloqué | ✅ Téléchargement des fichiers originaux<br>✅ Accès complet aux livrables HD/4K<br>✅ Bouton "Télécharger" affiché |

### Pour les ACCOMPAGNEMENTS (`accompagnement`)

| Statut de paiement | Accès | Fonctionnalités |
|-------------------|-------|-----------------|
| **Acompte payé (30%)** | Photos/Vidéos téléchargeables | ✅ Téléchargement immédiat photos/vidéos<br>❌ Documents finaux bloqués |
| **Solde payé (70%)** | Accès total | ✅ Téléchargement de tous les livrables |

> **Note importante** : Les accompagnements conservent leur logique normale de livraison, sans restriction de téléchargement après l'acompte.

---

## 🔧 Modifications techniques

### Fichier modifié : `livrables.html`

#### 1. Fonction `loadLivrables()` - Ligne 479

**Ajouts** :
- Détection du `productType` de l'utilisateur
- Affichage d'un bandeau informatif pour les prestations individuelles
- Passage du `productType` à la fonction `createLivrableCard()`

```javascript
// Déterminer le type de produit
const productType = user.productType || 'accompagnement';

// Afficher un bandeau informatif pour les prestations individuelles
if (productType === 'prestation_individuelle' && !canAccessFinalDeliverables && canAccessDuringAccompaniment) {
    const infoBar = document.createElement('div');
    infoBar.className = 'bg-[var(--genesis-yellow)] text-black p-6 border-4 border-black mb-8 font-bold';
    infoBar.innerHTML = `
        <div class="flex items-start gap-4">
            <i class="fas fa-info-circle text-2xl"></i>
            <div>
                <h4 class="font-black uppercase mb-2">Mode consultation activé</h4>
                <p class="text-sm">Vous pouvez consulter vos livrables, mais le téléchargement des fichiers sera disponible après le règlement du solde (70%).</p>
            </div>
        </div>
    `;
    container.appendChild(infoBar);
}
```

#### 2. Fonction `createLivrableCard()` - Ligne 770

**Modifications** :
- Ajout de 2 nouveaux paramètres : `productType` et `canAccessDuringAccompaniment`
- Logique conditionnelle selon le type de produit
- Bouton "Consulter" pour les prestations individuelles (acompte payé)
- Bouton "Télécharger" pour le solde payé

```javascript
function createLivrableCard(livrable, index, canAccessFinalDeliverables, productType, canAccessDuringAccompaniment) {
    // ...

    if (productType === 'prestation_individuelle') {
        // PRESTATION INDIVIDUELLE
        if (canAccessFinalDeliverables) {
            // Solde payé → Téléchargement débloqué
            buttonHTML = `<a href="${livrable.file}" download>Télécharger</a>`;
        } else if (canAccessDuringAccompaniment && isPhotoOrVideo) {
            // Acompte payé → Consultation uniquement
            buttonHTML = `
                <button onclick="previewLivrable('${livrable.type}', '${livrable.title}')">
                    Consulter
                </button>
                <p>Téléchargement disponible après règlement du solde</p>
            `;
        }
    } else {
        // ACCOMPAGNEMENT (logique normale)
        // ...
    }
}
```

#### 3. Fonction `previewLivrable()` - Nouvelle fonction

**Rôle** : Afficher une modale de prévisualisation pour les photos et vidéos

```javascript
function previewLivrable(type, title) {
    // Affiche une modale informative expliquant :
    // - Le mode consultation actif
    // - La résolution limitée (photos) ou streaming (vidéos)
    // - Le déblocage du téléchargement après paiement du solde
}
```

**Fonctionnalités** :
- Modale stylée en néo-brutalisme (cohérent avec le design)
- Messages adaptés selon le type (photo vs vidéo)
- Icônes Font Awesome pour le visuel
- Bouton de fermeture avec hover effect
- Fermeture en cliquant en dehors de la modale

---

## 🎨 Interface utilisateur

### Bandeau informatif (prestations individuelles uniquement)

```
┌─────────────────────────────────────────────────────────────┐
│ ℹ️  Mode consultation activé                                │
│                                                              │
│ Vous pouvez consulter vos livrables, mais le téléchargement │
│ des fichiers sera disponible après le règlement du solde.   │
└─────────────────────────────────────────────────────────────┘
```

### Carte de livrable - Acompte payé (prestation individuelle)

```
┌────────────────────────────┐
│  📷  Photo                 │
│                            │
│  PHOTOS ENTREPRISE (24)    │
│  Archive ZIP avec toutes   │
│  les photos                │
│                            │
│  Ajouté le 12 janvier 2024 │
│                            │
│  [ 👁️  Consulter ]         │
│                            │
│  🔒 Téléchargement         │
│  disponible après          │
│  règlement du solde        │
└────────────────────────────┘
```

### Carte de livrable - Solde payé (prestation individuelle)

```
┌────────────────────────────┐
│  📷  Photo                 │
│                            │
│  PHOTOS ENTREPRISE (24)    │
│  Archive ZIP avec toutes   │
│  les photos                │
│                            │
│  Ajouté le 12 janvier 2024 │
│                            │
│  [ ⬇️  Télécharger ]       │
└────────────────────────────┘
```

### Modale de prévisualisation

```
┌─────────────────────────────────────────────┐
│  📷                                         │
│                                             │
│  PRÉVISUALISATION PHOTO                     │
│                                             │
│  Photos Entreprise (24)                     │
│                                             │
│  ┌────────────────────────────────────┐   │
│  │ ℹ️  Mode consultation activé       │   │
│  │                                     │   │
│  │ Vous visualisez actuellement vos   │   │
│  │ photos en résolution limitée.      │   │
│  └────────────────────────────────────┘   │
│                                             │
│  Le téléchargement des photos en haute     │
│  résolution sera disponible après le       │
│  règlement du solde (70%).                 │
│                                             │
│  💡 Cette prévisualisation vous permet de  │
│  valider les contenus avant le paiement    │
│  final.                                    │
│                                             │
│  [        Fermer        ]                  │
└─────────────────────────────────────────────┘
```

---

## 🔐 Sécurité et protection des fichiers

### Recommandations techniques

Pour un système de production complet, voici les améliorations à implémenter :

#### 1. Stockage sécurisé des fichiers

```
✅ Fichiers stockés hors du répertoire web public
✅ URL non accessible directement
✅ Serveur de fichiers avec authentification
```

#### 2. Watermarking pour les photos

```javascript
// Générer des versions watermarkées pour la prévisualisation
function generatePreviewPhoto(originalPath) {
    // Ajouter un watermark "PRÉVISUALISATION - FA GENESIS"
    // Réduire la résolution (max 1024px)
    // Compresser la qualité (60-70%)
    return previewPath;
}
```

#### 3. Streaming vidéo sécurisé

```javascript
// Utiliser un lecteur vidéo avec protection
<video controls controlsList="nodownload" oncontextmenu="return false;">
    <source src="/api/stream/video?token={token}" type="video/mp4">
</video>
```

#### 4. API de téléchargement avec vérification

```javascript
// Backend (Node.js/PHP)
app.get('/api/download/:livrableId', async (req, res) => {
    const user = await authenticateUser(req);
    const livrable = await getLivrable(req.params.livrableId);

    // Vérifier le statut de paiement
    if (user.productType === 'prestation_individuelle' && user.paymentStatus !== 'fully_paid') {
        return res.status(403).json({ error: 'Solde non réglé' });
    }

    // Autoriser le téléchargement
    res.download(livrable.originalFilePath);
});
```

---

## 🧪 Tests à effectuer

### Scénario 1 : Prestation individuelle - Acompte payé

1. Créer un compte avec offre "Photo PRO"
2. Payer l'acompte de 30%
3. Accéder à la section "Livrables"
4. **Vérifications** :
   - ✅ Bandeau "Mode consultation activé" affiché
   - ✅ Bouton "Consulter" sur les photos/vidéos
   - ✅ Message "Téléchargement disponible après règlement du solde"
   - ✅ Clic sur "Consulter" ouvre la modale de prévisualisation

### Scénario 2 : Prestation individuelle - Solde payé

1. Payer le solde de 70%
2. Accéder à la section "Livrables"
3. **Vérifications** :
   - ✅ Bandeau informatif masqué
   - ✅ Bouton "Télécharger" affiché
   - ✅ Téléchargement fonctionnel

### Scénario 3 : Accompagnement - Acompte payé

1. Créer un compte avec offre "Particulier LAUNCH"
2. Payer l'acompte de 30%
3. Accéder à la section "Livrables"
4. **Vérifications** :
   - ✅ Pas de bandeau "Mode consultation"
   - ✅ Bouton "Télécharger" immédiatement disponible pour photos/vidéos
   - ✅ Documents finaux bloqués (logique normale)

---

## 📈 Avantages du système

### Pour les clients

| Avantage | Description |
|----------|-------------|
| 🎯 **Validation avant paiement final** | Possibilité de consulter les livrables avant de payer le solde |
| 💰 **Flexibilité de paiement** | Paiement échelonné possible sans perdre l'accès aux contenus |
| 🛡️ **Transparence** | Visibilité sur les livrables dès l'acompte payé |
| ✅ **Confiance renforcée** | Le client voit le résultat avant de payer le solde |

### Pour FA Genesis

| Avantage | Description |
|----------|-------------|
| 🔒 **Protection des fichiers** | Téléchargement bloqué tant que le solde n'est pas payé |
| 💵 **Sécurisation du paiement** | Incitation à payer le solde pour accéder aux fichiers HD |
| 📊 **Réduction des litiges** | Le client valide les livrables avant le paiement final |
| 🚀 **Expérience client optimisée** | Consultation possible dès l'acompte = satisfaction accrue |

---

## 🔄 Workflow complet

```
1. Client s'inscrit à une prestation individuelle (Photo PRO, Vidéo, etc.)
   ↓
2. Client paie acompte 30%
   ↓
3. Accès à la section "Livrables"
   - Bandeau "Mode consultation activé" affiché
   - Bouton "Consulter" visible sur les livrables
   ↓
4. Client clique sur "Consulter"
   - Modale de prévisualisation s'ouvre
   - Message explicatif affiché
   - Indication du déblocage après paiement du solde
   ↓
5. Prestation terminée par l'admin
   - Statut passe à "delivery_pending_payment"
   - Client peut toujours consulter
   ↓
6. Client paie le solde 70%
   - Statut passe à "fully_paid"
   - Bouton "Consulter" remplacé par "Télécharger"
   - Téléchargement débloqué
   ↓
7. Client télécharge les fichiers originaux HD/4K
   - Accès total et définitif
```

---

## 📞 Support

Pour toute question sur le système :
- **Email** : financialadvicegenesis@gmail.com
- **Téléphone** : +33 7 64 16 36 09

---

**Version** : 1.0
**Date** : Février 2025
**FA GENESIS - Groupe FA Industries**
