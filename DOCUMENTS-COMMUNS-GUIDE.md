# Guide des Documents Communs - FA GENESIS

## 📋 Vue d'ensemble

Les documents communs sont des fichiers accessibles à **tous les clients** de l'espace FA GENESIS, quelle que soit leur offre. Ils sont automatiquement affichés sur la page **Livrables** et organisés par catégorie.

## 📂 Structure des dossiers

Les documents communs sont stockés dans :
```
fa-genesis-landing/
└── DOCUMENTS COMMUNS (TOUS LES CLIENTS)/
    ├── Documents d'acceuil/
    ├── Documents méthodologiques simples/
    └── Documents administratifs/
```

## 🏷️ Catégories disponibles

Les documents sont organisés en 3 catégories principales :

### 1. Documents d'accueil
Documents de bienvenue et de prise en main pour les nouveaux clients.

**Exemples :**
- Fonctionnement de l'accompagnement
- Comment bien réussir son accompagnement
- Règles & engagement client

### 2. Documents méthodologiques simples
Guides pratiques et méthodologies pour aider les clients dans leur projet.

**Exemples :**
- Comment parler de son projet clairement
- Les erreurs fréquentes à éviter quand on débute

### 3. Documents administratifs
Documents officiels, chartes et conditions générales.

**Exemples :**
- Charte d'accompagnement
- Conditions Générales d'Accompagnement

## ➕ Comment ajouter un nouveau document

### Étape 1 : Placer le fichier
Placer votre fichier PDF ou Word dans le dossier correspondant :
```
DOCUMENTS COMMUNS (TOUS LES CLIENTS)/[Catégorie]/votre-fichier.pdf
```

### Étape 2 : Ajouter l'entrée dans common-documents.js
Ouvrir le fichier `common-documents.js` et ajouter une nouvelle entrée dans le tableau `COMMON_DOCUMENTS` :

```javascript
{
    id: 'accueil-4',  // ID unique
    title: 'Titre du document',
    category: 'Documents d\'accueil',  // Choisir parmi les 3 catégories
    fileUrl: 'DOCUMENTS COMMUNS (TOUS LES CLIENTS)/Documents d\'acceuil/votre-fichier.pdf',
    fileType: 'PDF',  // PDF ou WORD
    updatedAt: '2024-01-20',  // Date au format YYYY-MM-DD (optionnel)
    description: 'Description courte du document'  // Une phrase max (optionnel)
}
```

### Exemple complet

```javascript
const COMMON_DOCUMENTS = [
    // ... documents existants ...

    // Nouveau document
    {
        id: 'methodo-3',
        title: 'Guide de la visibilité digitale',
        category: 'Documents méthodologiques simples',
        fileUrl: 'DOCUMENTS COMMUNS (TOUS LES CLIENTS)/Documents méthodologiques simples/Guide visibilité digitale.pdf',
        fileType: 'PDF',
        updatedAt: '2024-01-25',
        description: 'Stratégies concrètes pour développer votre présence en ligne'
    }
];
```

### Étape 3 : C'est tout !
Le document apparaîtra automatiquement sur la page Livrables, dans la bonne catégorie, pour tous les clients.

## 📝 Paramètres détaillés

### `id` (obligatoire)
- Identifiant unique du document
- Format recommandé : `[catégorie]-[numéro]`
- Exemples : `accueil-1`, `methodo-2`, `admin-1`

### `title` (obligatoire)
- Titre affiché du document
- Soyez clair et descriptif
- Évitez les titres trop longs

### `category` (obligatoire)
- Catégorie d'appartenance
- **Valeurs possibles** :
  - `Documents d'accueil`
  - `Documents méthodologiques simples`
  - `Documents administratifs`

### `fileUrl` (obligatoire)
- Chemin relatif vers le fichier
- Doit correspondre exactement au chemin du fichier
- Format : `DOCUMENTS COMMUNS (TOUS LES CLIENTS)/[Catégorie]/[nom-fichier]`

### `fileType` (obligatoire)
- Type de fichier
- **Valeurs possibles** : `PDF` ou `WORD`
- Détermine l'icône et le badge de couleur

### `updatedAt` (optionnel)
- Date de dernière mise à jour
- Format : `YYYY-MM-DD` (ex: `2024-01-20`)
- Affichée comme "Mis à jour le [date]"
- Si omis, aucune date ne sera affichée

### `description` (optionnel)
- Description courte (1 phrase maximum)
- Aide les clients à comprendre le contenu
- Affiché sous le titre

## 🎨 Affichage sur la page Livrables

### Onglet "Tous"
- Affiche les documents communs EN HAUT
- Puis les documents personnels de l'utilisateur (photos, vidéos, etc.)

### Onglet "Documents"
- Affiche UNIQUEMENT les documents communs + documents personnels
- Documents communs groupés par catégorie
- Titre "Documents communs" en haut
- Titre "Vos documents personnels" pour les docs spécifiques

### Onglets "Photos" et "Vidéos"
- Les documents communs sont masqués
- Seuls les livrables photos/vidéos personnels sont affichés

## 🎯 Bonnes pratiques

### Nommage des fichiers
- Utiliser des noms clairs et descriptifs
- Éviter les caractères spéaux (accents OK)
- Format recommandé : `Titre du document.pdf`

### Organisation
- Placer chaque fichier dans la bonne catégorie
- Respecter l'ordre des catégories dans common-documents.js
- Grouper les documents similaires

### Descriptions
- Garder les descriptions courtes (1 ligne)
- Être explicite sur le contenu
- Utiliser un ton professionnel mais accessible

### Dates de mise à jour
- Mettre à jour la date `updatedAt` lors de modifications
- Format strict : YYYY-MM-DD
- Permet aux clients de voir les documents récents

## 🔄 Mise à jour d'un document existant

Pour mettre à jour un document :

1. **Remplacer le fichier** dans le dossier correspondant
2. **Modifier la date** `updatedAt` dans `common-documents.js`
3. **Optionnellement**, mettre à jour le titre ou la description

```javascript
{
    id: 'accueil-1',
    title: 'Fonctionnement de l\'accompagnement',  // Pas changé
    category: 'Documents d\'accueil',  // Pas changé
    fileUrl: 'DOCUMENTS COMMUNS (TOUS LES CLIENTS)/Documents d\'acceuil/Fonctionnement de l\'accompagnement.pdf',
    fileType: 'PDF',
    updatedAt: '2024-02-01',  // ✅ DATE MISE À JOUR
    description: 'Guide complet sur le déroulement de votre accompagnement (version 2.0)'  // ✅ DESCRIPTION MISE À JOUR
}
```

## ⚠️ Erreurs courantes à éviter

### ❌ Chemin de fichier incorrect
```javascript
fileUrl: 'Documents/mon-fichier.pdf'  // Mauvais
fileUrl: 'DOCUMENTS COMMUNS (TOUS LES CLIENTS)/Documents d\'acceuil/mon-fichier.pdf'  // ✅ Bon
```

### ❌ Catégorie invalide
```javascript
category: 'Documents méthodologiques'  // Mauvais (manque "simples")
category: 'Documents méthodologiques simples'  // ✅ Bon
```

### ❌ Format de date incorrect
```javascript
updatedAt: '20/01/2024'  // Mauvais
updatedAt: '2024-01-20'  // ✅ Bon
```

### ❌ ID en double
```javascript
// Document 1
{ id: 'accueil-1', ... }

// Document 2
{ id: 'accueil-1', ... }  // ❌ Mauvais : ID déjà utilisé

{ id: 'accueil-2', ... }  // ✅ Bon
```

## 🚀 Ajouter une nouvelle catégorie

Si vous devez ajouter une nouvelle catégorie (ex: "Documents commerciaux") :

### 1. Créer le dossier
```
DOCUMENTS COMMUNS (TOUS LES CLIENTS)/Documents commerciaux/
```

### 2. Ajouter la catégorie dans `common-documents.js`
```javascript
const CATEGORIES_ORDER = [
    'Documents d\'accueil',
    'Documents méthodologiques simples',
    'Documents administratifs',
    'Documents commerciaux'  // ✅ Nouvelle catégorie
];
```

### 3. Ajouter vos documents
```javascript
{
    id: 'commercial-1',
    title: 'Grille tarifaire',
    category: 'Documents commerciaux',  // ✅ Nouvelle catégorie
    fileUrl: 'DOCUMENTS COMMUNS (TOUS LES CLIENTS)/Documents commerciaux/Grille tarifaire.pdf',
    fileType: 'PDF',
    updatedAt: '2024-01-25',
    description: 'Nos tarifs détaillés par offre'
}
```

## 📊 Exemple complet

Voici un exemple complet d'ajout de 3 documents dans 3 catégories différentes :

```javascript
const COMMON_DOCUMENTS = [
    // DOCUMENTS D'ACCUEIL
    {
        id: 'accueil-4',
        title: 'FAQ - Questions fréquentes',
        category: 'Documents d\'accueil',
        fileUrl: 'DOCUMENTS COMMUNS (TOUS LES CLIENTS)/Documents d\'acceuil/FAQ.pdf',
        fileType: 'PDF',
        updatedAt: '2024-01-28',
        description: 'Réponses aux questions les plus courantes'
    },

    // DOCUMENTS MÉTHODOLOGIQUES
    {
        id: 'methodo-3',
        title: 'Template Business Plan',
        category: 'Documents méthodologiques simples',
        fileUrl: 'DOCUMENTS COMMUNS (TOUS LES CLIENTS)/Documents méthodologiques simples/Template Business Plan.pdf',
        fileType: 'PDF',
        updatedAt: '2024-01-25',
        description: 'Modèle de business plan à compléter'
    },

    // DOCUMENTS ADMINISTRATIFS
    {
        id: 'admin-3',
        title: 'Politique de confidentialité',
        category: 'Documents administratifs',
        fileUrl: 'DOCUMENTS COMMUNS (TOUS LES CLIENTS)/Documents administratifs/Politique confidentialité.pdf',
        fileType: 'PDF',
        updatedAt: '2024-01-15',
        description: 'Notre politique RGPD et protection des données'
    }
];
```

## 🎓 Résumé : Workflow complet

1. **Préparer le fichier** (PDF ou Word)
2. **Le placer** dans le bon dossier de catégorie
3. **Ouvrir** `common-documents.js`
4. **Ajouter** une entrée dans `COMMON_DOCUMENTS` avec tous les champs
5. **Sauvegarder** le fichier
6. **Rafraîchir** la page Livrables
7. **Vérifier** que le document apparaît dans la bonne catégorie

C'est tout ! Aucune modification d'UI nécessaire.

## 📞 Support

Pour toute question sur la gestion des documents communs :
- Documentation technique : voir `ESPACE-CLIENT-README.md`
- Contact : financialadvicegenesis@gmail.com

---

**Développé avec ❤️ par L'ÉLITE WEB pour FA GENESIS**
*Build. Launch. Impact.*
