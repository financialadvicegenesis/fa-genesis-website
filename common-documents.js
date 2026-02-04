// Données des documents communs accessibles à tous les clients
// Structure: { id, title, category, fileUrl, fileType, updatedAt, description }

console.log('🔵 Chargement de common-documents.js');

const COMMON_DOCUMENTS = [
    // ========== DOCUMENTS D'ACCUEIL ==========
    {
        id: 'accueil-1',
        title: "Fonctionnement de l'accompagnement",
        category: "Documents d'accueil",
        fileUrl: "documents-communs/Documents d'acceuil/Fonctionnement de l'accompagnement.pdf",
        fileType: 'PDF',
        updatedAt: '2024-01-15',
        description: "Guide complet sur le déroulement de votre accompagnement"
    },
    {
        id: 'accueil-2',
        title: "Comment bien réussir son accompagnement",
        category: "Documents d'accueil",
        fileUrl: "documents-communs/Documents d'acceuil/Comment bien réussir son accompagnement.pdf",
        fileType: 'PDF',
        updatedAt: '2024-01-15',
        description: "Conseils pratiques pour maximiser votre expérience"
    },
    {
        id: 'accueil-3',
        title: "Règles & engagement client",
        category: "Documents d'accueil",
        fileUrl: "documents-communs/Documents d'acceuil/Règles & engagement client.pdf",
        fileType: 'PDF',
        updatedAt: '2024-01-15',
        description: "Cadre de notre collaboration et engagements mutuels"
    },

    // ========== DOCUMENTS MÉTHODOLOGIQUES SIMPLES ==========
    {
        id: 'methodo-1',
        title: "Comment parler de son projet clairement",
        category: "Documents méthodologiques simples",
        fileUrl: "documents-communs/Documents méthodologiques simples/Comment parler de son projet clairement.pdf",
        fileType: 'PDF',
        updatedAt: '2024-01-10',
        description: "Méthode pour structurer et présenter votre projet"
    },
    {
        id: 'methodo-2',
        title: "Les erreurs fréquentes à éviter quand on débute",
        category: "Documents méthodologiques simples",
        fileUrl: "documents-communs/Documents méthodologiques simples/Les erreurs fréquentes à éviter quand on débute.pdf",
        fileType: 'PDF',
        updatedAt: '2024-01-10',
        description: "Pièges courants et comment les éviter"
    },

    // ========== DOCUMENTS ADMINISTRATIFS ==========
    {
        id: 'admin-1',
        title: "Charte d'accompagnement",
        category: "Documents administratifs",
        fileUrl: "documents-communs/Documents administratifs/Charte d'accompagnement.pdf",
        fileType: 'PDF',
        updatedAt: '2024-02-02',
        description: "Charte officielle de l'accompagnement FA Genesis"
    },
    {
        id: 'admin-2',
        title: "Conditions Générales d'Accompagnement",
        category: "Documents administratifs",
        fileUrl: "documents-communs/Documents administratifs/Conditions Générales d'Accompagnement.pdf",
        fileType: 'PDF',
        updatedAt: '2024-02-02',
        description: "Conditions générales de nos services d'accompagnement"
    }
];

// Ordre des catégories pour l'affichage
const CATEGORIES_ORDER = [
    "Documents d'accueil",
    "Documents méthodologiques simples",
    "Documents administratifs"
];

console.log('🟢 common-documents.js chargé avec succès');
console.log('📊 Nombre total de documents:', COMMON_DOCUMENTS.length);
console.log('📋 Catégories:', CATEGORIES_ORDER);
console.log('📁 Documents méthodologiques:', COMMON_DOCUMENTS.filter(d => d.category === "Documents méthodologiques simples"));

/**
 * Récupère tous les documents communs
 * @returns {Array}
 */
function getCommonDocuments() {
    return COMMON_DOCUMENTS;
}

/**
 * Récupère les documents groupés par catégorie
 * @returns {Object}
 */
function getDocumentsByCategory() {
    const grouped = {};

    // Initialiser toutes les catégories
    CATEGORIES_ORDER.forEach(category => {
        grouped[category] = [];
    });

    // Grouper les documents
    COMMON_DOCUMENTS.forEach(doc => {
        if (grouped[doc.category]) {
            grouped[doc.category].push(doc);
        }
    });

    return grouped;
}

/**
 * Récupère les documents d'une catégorie spécifique
 * @param {string} category - Nom de la catégorie
 * @returns {Array}
 */
function getDocumentsBySpecificCategory(category) {
    return COMMON_DOCUMENTS.filter(doc => doc.category === category);
}

/**
 * Obtient l'icône selon le type de fichier
 * @param {string} fileType - Type de fichier (PDF, WORD)
 * @returns {string}
 */
function getFileIcon(fileType) {
    const icons = {
        'PDF': 'fa-file-pdf',
        'WORD': 'fa-file-word'
    };
    return icons[fileType] || 'fa-file';
}

/**
 * Obtient le badge de couleur selon le type de fichier
 * @param {string} fileType - Type de fichier
 * @returns {string}
 */
function getFileTypeBadgeClass(fileType) {
    const classes = {
        'PDF': 'bg-red-600',
        'WORD': 'bg-blue-600'
    };
    return classes[fileType] || 'bg-gray-600';
}
