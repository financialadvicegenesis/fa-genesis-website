# Espace Client FA GENESIS

## 📋 Vue d'ensemble

L'espace client FA GENESIS est maintenant opérationnel avec un système d'authentification complet et 5 pages privées :

- **Dashboard** : Vue d'ensemble de la progression
- **Parcours** : Étapes jour par jour avec checklist interactive
- **Livrables** : Documents, photos et vidéos téléchargeables
- **Séances** : Planning des rendez-vous et visioconférences
- **Mon compte** : Informations personnelles et changement de mot de passe

## 🔐 Accès à l'espace client

### Bouton "Espace client"
Un bouton "Espace client" a été ajouté sur toutes les pages publiques (index.html, a-propos.html, offres.html, contact.html) dans la barre de navigation en haut à droite.

### Comptes de test disponibles

#### 1. Étudiant - Offre LAUNCH
- **Email** : `etudiant@test.com`
- **Mot de passe** : `etudiant123`
- **Offre** : LAUNCH (14 jours)
- **Progression** : Jour 3/14

#### 2. Particulier - Offre IMPACT
- **Email** : `particulier@test.com`
- **Mot de passe** : `particulier123`
- **Offre** : IMPACT (30 jours)
- **Progression** : Jour 15/30

#### 3. Entreprise - Offre VISIBILITY
- **Email** : `entreprise@test.com`
- **Mot de passe** : `entreprise123`
- **Offre** : VISIBILITY (14 jours)
- **Progression** : Jour 7/14

#### 4. Compte de démonstration
- **Email** : `demo@fagenesis.com`
- **Mot de passe** : `demo123`
- **Offre** : STARTER (7 jours)
- **Progression** : Jour 2/7

## 🎨 Pages de l'espace client

### 1. Dashboard (dashboard.html)
- Message de bienvenue personnalisé
- 3 statistiques principales (Offre, Étape actuelle, Progression)
- Barre de progression visuelle
- 4 boutons d'actions rapides vers les autres pages
- Message d'encouragement

### 2. Parcours (parcours.html)
- Timeline complète des étapes jour par jour
- Statuts visuels : À venir / En cours / Terminé
- Description détaillée de chaque étape
- Checklist interactive avec sauvegarde automatique
- Système de filtrage des étapes

### 3. Livrables (livrables.html)
- Grille de documents téléchargeables
- Filtres par type : Tous / Documents / Photos / Vidéos
- Cartes avec icônes, titre, description et date
- Boutons de téléchargement
- État vide si aucun livrable

### 4. Séances (seances.html)
- Planning complet des rendez-vous
- Filtres : Toutes / À venir / Passées
- Informations détaillées : Date, heure, type, durée
- Liens de visioconférence pour les séances en ligne
- Indication du lieu pour les séances physiques

### 5. Mon compte (mon-compte.html)
- Informations personnelles (prénom, nom, email, téléphone)
- Détails de l'offre active
- Formulaire de changement de mot de passe
- Lien vers le support

## 🔒 Sécurité

### Système d'authentification
- **Fichier principal** : `auth.js`
- **Stockage** : localStorage (pour prototype uniquement)
- **Protection** : Toutes les pages privées redirigent vers login.html si l'utilisateur n'est pas connecté
- **Session** : Maintenue entre les pages
- **Déconnexion** : Disponible sur toutes les pages privées

### Fonctionnalités de sécurité
- Vérification de mot de passe
- Protection des pages privées
- Gestion de session sécurisée
- Changement de mot de passe avec validation

## 📱 Responsive Design

Toutes les pages sont conçues avec une approche mobile-first :
- Navigation adaptative
- Grilles responsive
- Cartes empilées sur mobile
- Textes et images optimisés

## 🎯 Charte graphique

Le design respecte la charte néo-brutaliste de FA GENESIS :
- **Couleurs** : Jaune (#FFD700), Noir (#000000), Blanc (#FFFFFF)
- **Typographies** : Unbounded (titres), Space Grotesk (corps)
- **Éléments** : Bordures épaisses (4px), ombres décalées, effets hover
- **Style** : Bold, italique, majuscules

## 🚀 Fonctionnalités avancées

### Parcours personnalisés
Chaque offre dispose d'un parcours spécifique avec des étapes adaptées :
- **IDEA** (2 jours) : Mini plan d'action
- **STARTER** (7 jours) : Structuration complète
- **LAUNCH** (14 jours) : Vidéo et média
- **IMPACT** (30 jours) : Photo, vidéo et communication complète

### Checklist interactive
- Coches sauvegardées automatiquement
- État persistant entre les sessions
- Animation au clic
- Séparation par utilisateur

### Livrables dynamiques
- Affichage conditionnel selon l'offre
- Types de fichiers variés (PDF, ZIP, MP4)
- Dates de mise à disposition
- Filtrage en temps réel

## 📝 Notes techniques

### Structure des fichiers
```
fa-genesis-landing/
├── index.html (page d'accueil)
├── a-propos.html
├── offres.html
├── contact.html
├── login.html (page de connexion)
├── dashboard.html (tableau de bord)
├── parcours.html (étapes du projet)
├── livrables.html (documents)
├── seances.html (rendez-vous)
├── mon-compte.html (profil)
├── auth.js (système d'authentification)
└── parcours-data.js (données des parcours)
```

### Base de données utilisateurs
Les utilisateurs sont stockés dans l'objet `USERS_DB` dans `auth.js`.
**⚠️ Important** : Dans un environnement de production, il faudra :
- Utiliser un backend sécurisé (Node.js, PHP, etc.)
- Base de données réelle (MySQL, PostgreSQL, MongoDB)
- API REST pour l'authentification
- Hachage des mots de passe (bcrypt)
- Tokens JWT pour les sessions
- HTTPS obligatoire

### localStorage
Les données suivantes sont stockées localement :
- Session utilisateur (`fa_genesis_session`)
- État des tâches du parcours (`fa_genesis_tasks_[email]`)

## 🎓 Guide d'utilisation

1. **Connexion**
   - Cliquer sur "Espace client" dans la navigation
   - Entrer un email et mot de passe de test
   - Redirection automatique vers le dashboard

2. **Navigation**
   - Menu principal en haut avec 5 liens
   - Bouton de déconnexion toujours visible
   - Nom de l'utilisateur affiché

3. **Dashboard**
   - Vue d'ensemble de la progression
   - Accès rapide à toutes les sections

4. **Parcours**
   - Suivre les étapes jour par jour
   - Cocher les tâches au fur et à mesure
   - État sauvegardé automatiquement

5. **Livrables**
   - Filtrer par type de document
   - Télécharger les fichiers
   - Vérifier les dates de mise à disposition

6. **Séances**
   - Voir les prochains rendez-vous
   - Accéder aux liens de visioconférence
   - Consulter l'historique

7. **Mon compte**
   - Vérifier les informations personnelles
   - Changer le mot de passe
   - Contacter le support

## 🎉 Prochaines étapes

Pour améliorer l'espace client :

### Backend (recommandé pour production)
- API REST sécurisée
- Base de données SQL/NoSQL
- Authentification JWT
- Upload de fichiers réels
- Envoi d'emails automatiques

### Fonctionnalités additionnelles
- Notifications en temps réel
- Chat avec l'équipe
- Calendrier interactif
- Prévisualisation des documents
- Partage social des livrables
- Système de feedback
- Badge de progression
- Certificat de fin de parcours

### Optimisations
- Cache navigateur
- Lazy loading des images
- Compression des assets
- PWA (Progressive Web App)
- Mode hors ligne

## 📞 Support

Pour toute question ou problème :
- Page de contact : [contact.html](contact.html)
- Email : financialadvicegenesis@gmail.com

---

**Développé avec ❤️ par L'ÉLITE WEB pour FA GENESIS**
*Build. Launch. Impact.*
