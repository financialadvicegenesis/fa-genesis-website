# 🛡️ ESPACE ADMINISTRATEUR FA GENESIS

## 📋 Vue d'ensemble

L'espace administrateur vous permet de gérer tous vos clients et d'ajouter des documents personnalisés jour après jour tout au long de leur accompagnement.

## 🔐 Accès à l'administration

### Identifiants de connexion
- **URL**: `admin.html`
- **Email**: `admin@fagenesis.com`
- **Mot de passe**: `FAGenesis2024!`

⚠️ **Important**: En production, ces identifiants doivent être changés et le système doit utiliser une vraie base de données sécurisée.

## 🎯 Fonctionnalités principales

### 1. Dashboard
- **Statistiques globales**:
  - Nombre total de clients
  - Clients ayant payé l'acompte
  - Clients avec paiement complet
  - Revenu total généré
- **Derniers clients inscrits**: Vue rapide des 5 derniers clients

### 2. Gestion des clients
- **Liste complète** de tous les clients
- **Recherche** par nom, email ou offre
- **Informations détaillées** pour chaque client:
  - Coordonnées complètes
  - Offre choisie
  - Statut de paiement
  - Jour actuel de l'accompagnement
  - Nombre de documents ajoutés

### 3. Ajout de documents jour par jour

#### Comment ajouter un document à un client:

1. **Ouvrir la fiche client**: Cliquez sur un client dans la liste
2. **Remplir le formulaire**:
   - **Jour**: Numéro du jour de l'accompagnement (ex: 1, 2, 3...)
   - **Titre**: Nom du document (ex: "Plan d'action Jour 5")
   - **Description**: (Optionnel) Description du document
   - **Fichier**: Sélectionnez le fichier à envoyer
3. **Cliquer sur "Ajouter le document"**

#### Formats de fichiers acceptés:
- PDF
- DOCX (Word)
- XLSX (Excel)
- PNG, JPG (Images)
- ZIP (Archives)

#### Organisation des documents:
- Les documents sont automatiquement groupés par jour
- Le client voit les documents dans l'ordre chronologique (du plus récent au plus ancien)
- Chaque document affiche: titre, description, nom du fichier, date d'ajout

### 4. Gestion des documents
- **Visualisation**: Voir tous les documents ajoutés pour un client
- **Suppression**: Possibilité de supprimer un document
- **Organisation**: Documents classés par jour d'accompagnement

## 📊 Côté client (espace client)

### Ce que voit le client:

1. **Dans la page "Livrables"**, le client trouve 3 types de documents:

   **a) Documents communs** (pour tous les clients)
   - Documents d'accueil
   - Documents méthodologiques
   - Documents administratifs

   **b) Documents spécifiques à son offre** (selon l'offre choisie)
   - Documents personnalisés pour sa formule

   **c) Documents de l'accompagnement** (ajoutés jour par jour par vous)
   - Documents organisés par jour
   - Mis à jour au fur et à mesure de son avancement

2. **Accès selon le statut de paiement**:
   - **Après l'acompte (30%)**: Accès aux documents communs, spécifiques et de l'accompagnement
   - **Après le solde (70%)**: Accès total + livrables finaux (photos, vidéos, etc.)

## 🔄 Workflow d'accompagnement

### Exemple pour un accompagnement de 30 jours:

**Jour 1**:
1. Le client paie son acompte
2. Vous ajoutez le document "Plan d'action Jour 1"
3. Le client le reçoit immédiatement dans son espace

**Jour 5**:
1. Vous ajoutez "Analyse de marché Jour 5"
2. Le document apparaît automatiquement

**Jour 15**:
1. Vous ajoutez plusieurs documents pour ce jour
2. Tous apparaissent groupés sous "JOUR 15"

**Jour 30** (fin de l'accompagnement):
1. Vous ajoutez les derniers documents
2. Le client paie le solde
3. Il accède à tous ses livrables finaux

## 💡 Bonnes pratiques

### Organisation des documents:
- **Nommez clairement** vos documents (ex: "Stratégie Marketing - Jour 7")
- **Ajoutez des descriptions** pour guider le client
- **Suivez une progression logique** dans la numérotation des jours
- **Groupez les documents** du même jour

### Suivi client:
- Le "Jour actuel" est automatiquement mis à jour selon le plus haut jour de document ajouté
- Utilisez la recherche pour retrouver rapidement un client
- Vérifiez régulièrement le statut de paiement

### Sécurité:
- Les fichiers sont stockés en base64 dans localStorage (simulation)
- En production, utiliser un système de stockage sécurisé (AWS S3, Azure Blob, etc.)
- Limiter la taille des fichiers uploadés

## 🚀 Améliorations futures possibles

1. **Notifications**:
   - Email au client quand un nouveau document est ajouté
   - Rappels de paiement automatiques

2. **Calendrier**:
   - Planning visuel de l'accompagnement
   - Jalons et objectifs

3. **Templates**:
   - Documents pré-configurés par type d'offre
   - Upload en batch

4. **Statistiques**:
   - Taux de complétion des accompagnements
   - Satisfaction clients
   - Revenus par offre

5. **Communication**:
   - Messagerie intégrée
   - Commentaires sur les documents

## 📞 Support

Pour toute question sur l'utilisation de l'espace admin:
- Email: financialadvicegenesis@gmail.com
- Téléphone: +33 7 64 16 36 09

---

**Version**: 1.0
**Dernière mise à jour**: Février 2025
**FA GENESIS - Groupe FA Industries**
