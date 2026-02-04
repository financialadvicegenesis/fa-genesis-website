# 💳 SYSTÈME DE PAIEMENT ÉCHELONNÉ - FA GENESIS

## 🎯 Vue d'ensemble des modifications

Le système de paiement a été amélioré pour offrir plus de flexibilité aux clients:

### ✨ Nouvelles fonctionnalités

1. **Accès étendu après l'acompte (30%)**
2. **Paiement échelonné du solde (70%)**

---

## 📊 Nouveau système d'accès après l'acompte

### Avant (ancienne version):
- **Après acompte**: Documents communs, Documents spécifiques, Documents journaliers
- **Après solde**: Livrables finaux (photos, vidéos, documents)

### Maintenant (nouvelle version):
- **Après acompte (30%)**:
  - ✅ Documents communs
  - ✅ Documents spécifiques à l'offre
  - ✅ Documents journaliers (ajoutés par l'admin)
  - ✅ **Photos** (NOUVEAU)
  - ✅ **Vidéos** (NOUVEAU)
  - ✅ Parcours
  - ✅ Séances

- **Après solde (70%)**:
  - ✅ Livrables finaux complets
  - ✅ Documents finaux de l'accompagnement
  - ✅ Accès total définitif

### Pourquoi ce changement ?

Les photos et vidéos font partie intégrante de l'accompagnement et servent de support pendant la formation. Les clients peuvent maintenant en profiter dès le début pour optimiser leur apprentissage.

---

## 💰 Système de paiement échelonné

### Comment ça marche ?

Lorsque l'accompagnement est terminé, le client a **2 options** pour payer le solde:

#### Option 1: Paiement comptant
- Paiement du solde complet en une seule fois
- Accès immédiat à tous les livrables finaux
- Exemple: 490€ (70% de 700€)

#### Option 2: Paiement échelonné ⭐ **NOUVEAU**
- Paiement du solde réparti sur la durée de l'offre
- Mensualités automatiquement calculées
- Exemples:
  - **Offre 3 mois**: 3 mensualités de ~163€
  - **Offre 6 mois**: 6 mensualités de ~82€
  - **Offre 12 mois**: 12 mensualités de ~41€

### Fonctionnement technique

```javascript
// Le système calcule automatiquement les mensualités
Durée offre: "6 mois"
Solde: 490€
→ 6 mensualités de 82€ (490€ / 6)
```

### Interface client ([payment.html](fa-genesis-landing/payment.html))

Quand l'accompagnement est terminé, le client voit:

1. **Deux cartes de choix**:
   - Paiement comptant: Montant total + bouton "Payer maintenant"
   - Paiement échelonné: Montant/mois + bouton "Choisir ce mode"

2. **Après activation du paiement échelonné**:
   - Liste de toutes les mensualités
   - Statut de chaque mensualité (payée/en attente)
   - Bouton "Payer maintenant" sur la mensualité actuelle
   - Indication visuelle (couleurs) selon le statut

### Progression du paiement

```
Mensualité 1 ✓ Payée [163€] - Payée le 15/02/2025
Mensualité 2 → En cours [163€] - [Bouton: Payer maintenant]
Mensualité 3   En attente [164€]
```

### Accès après dernière mensualité

Quand toutes les mensualités sont payées:
- Le statut passe automatiquement à `fully_paid`
- Redirection automatique vers les livrables
- Accès total et définitif débloqué

---

## 🔧 Modifications techniques

### Fichiers modifiés

1. **[payment-system.js](fa-genesis-landing/payment-system.js)**:
   - Ajout de `calculateInstallmentPlan()`
   - Ajout de `initializeInstallmentPlan()`
   - Ajout de `recordInstallmentPayment()`
   - Ajout de `getInstallmentPlan()`
   - Ajout de `getNextInstallment()`

2. **[payment.html](fa-genesis-landing/payment.html)**:
   - Nouvelle interface avec 2 options de paiement
   - Affichage dynamique des mensualités
   - Gestion des paiements échelonnés

3. **[livrables.html](fa-genesis-landing/livrables.html)**:
   - Modification de `loadLivrables()` pour afficher photos/vidéos après acompte
   - Filtre des livrables selon le statut de paiement
   - Messages informatifs mis à jour

### Structure de données

```javascript
// Plan de paiement échelonné dans le profil utilisateur
{
  installmentPlan: {
    totalAmount: 490,
    numberOfInstallments: 3,
    monthlyAmount: 163,
    startDate: "2025-02-15",
    installments: [
      {
        number: 1,
        amount: 163,
        dueDate: "Mois 1",
        status: "paid",
        paidDate: "2025-02-15"
      },
      {
        number: 2,
        amount: 163,
        dueDate: "Mois 2",
        status: "pending"
      },
      {
        number: 3,
        amount: 164,
        dueDate: "Mois 3",
        status: "pending"
      }
    ]
  }
}
```

---

## 🎨 Interface utilisateur

### Page de paiement

**Section Solde (delivery_pending_payment)**:
1. Affichage du montant total du solde
2. Deux options visuelles:
   - **Comptant**: Icône billet 💵 + montant total
   - **Échelonné**: Icône calendrier 📅 + montant mensuel

**Après choix du paiement échelonné**:
- Section "VOS MENSUALITÉS"
- Liste détaillée avec:
  - Numéro de mensualité
  - Montant
  - Statut (icône + couleur)
  - Bouton de paiement (si mensualité actuelle)

### Page Livrables

**Après acompte**:
- Bandeau informatif jaune
- Affichage photos + vidéos accessibles
- Documents finaux: pas affichés

**Après solde complet**:
- Tout accessible
- Pas de restriction

---

## 📈 Avantages du système

### Pour les clients:
- ✅ Flexibilité de paiement
- ✅ Meilleure gestion du budget
- ✅ Accès progressif aux contenus
- ✅ Engagement facilité

### Pour FA Genesis:
- ✅ Réduction du frein financier
- ✅ Meilleur taux de conversion
- ✅ Fidélisation accrue
- ✅ Suivi automatisé des paiements

---

## 🔄 Workflow complet

```
1. Client s'inscrit
   ↓
2. Client paie acompte 30%
   ↓
3. Accès immédiat:
   - Documents communs
   - Documents spécifiques
   - Documents journaliers
   - Photos
   - Vidéos
   - Parcours
   - Séances
   ↓
4. Accompagnement en cours
   (Admin ajoute documents jour par jour)
   ↓
5. Accompagnement terminé
   Status: delivery_pending_payment
   ↓
6. Client choisit mode de paiement:

   Option A: Comptant
   → Paie 70% en 1 fois
   → Accès total immédiat

   Option B: Échelonné
   → Active le plan mensuel
   → Paie mensualité 1
   → Paie mensualité 2
   → ...
   → Paie dernière mensualité
   → Accès total débloqué
```

---

## 🚀 Pour tester

1. **Créer un compte test**: [register.html](fa-genesis-landing/register.html)
2. **Choisir une offre** (ex: Particulier STARTER - 2 mois)
3. **Payer l'acompte**: Accès immédiat aux photos/vidéos
4. **Via admin**: Marquer l'accompagnement comme terminé
5. **Tester les 2 options**:
   - Paiement comptant
   - Paiement échelonné (2 mensualités)

---

## 📞 Support

Pour toute question:
- Email: financialadvicegenesis@gmail.com
- Téléphone: +33 7 64 16 36 09

---

**Version**: 2.0
**Date**: Février 2025
**FA GENESIS - Groupe FA Industries**
