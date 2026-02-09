/**
 * Configuration des produits FA GENESIS - COTE SERVEUR
 *
 * SECURITE: Les prix sont definis uniquement cote serveur.
 * Le frontend envoie seulement l'ID du produit, le serveur
 * calcule les montants reels (30% acompte, 70% solde).
 */

const PRODUCTS = [
    // ========== OFFRES ETUDIANTS ==========
    {
        id: 'etudiant-idea',
        name: 'Etudiant IDEA',
        category: 'ETUDIANTS',
        product_type: 'accompagnement',
        total_price: 50,
        duration: '2 jours',
        duration_days: 2
    },
    {
        id: 'etudiant-starter',
        name: 'Etudiant STARTER',
        category: 'ETUDIANTS',
        product_type: 'accompagnement',
        total_price: 100,
        duration: '7 jours',
        duration_days: 7
    },
    {
        id: 'etudiant-launch',
        name: 'Etudiant LAUNCH',
        category: 'ETUDIANTS',
        product_type: 'accompagnement',
        total_price: 189,
        duration: '14 jours',
        duration_days: 14
    },
    {
        id: 'etudiant-impact',
        name: 'Etudiant IMPACT',
        category: 'ETUDIANTS',
        product_type: 'accompagnement',
        total_price: 290,
        duration: '1 mois',
        duration_days: 30
    },

    // ========== OFFRES PARTICULIERS ==========
    {
        id: 'particulier-idea',
        name: 'Particulier IDEA',
        category: 'PARTICULIERS',
        product_type: 'accompagnement',
        total_price: 149,
        duration: '2 jours',
        duration_days: 2
    },
    {
        id: 'particulier-starter',
        name: 'Particulier STARTER',
        category: 'PARTICULIERS',
        product_type: 'accompagnement',
        total_price: 490,
        duration: '7 jours',
        duration_days: 7
    },
    {
        id: 'particulier-launch',
        name: 'Particulier LAUNCH',
        category: 'PARTICULIERS',
        product_type: 'accompagnement',
        total_price: 790,
        duration: '14 jours',
        duration_days: 14
    },
    {
        id: 'particulier-impact',
        name: 'Particulier IMPACT',
        category: 'PARTICULIERS',
        product_type: 'accompagnement',
        total_price: 1490,
        duration: '1 mois',
        duration_days: 30
    },

    // ========== OFFRES ENTREPRISES ==========
    {
        id: 'entreprise-start',
        name: 'Entreprise START',
        category: 'ENTREPRISES',
        product_type: 'accompagnement',
        total_price: 1490,
        duration: '7 jours',
        duration_days: 7
    },
    {
        id: 'entreprise-visibility',
        name: 'Entreprise VISIBILITY',
        category: 'ENTREPRISES',
        product_type: 'accompagnement',
        total_price: 2990,
        duration: '14 jours',
        duration_days: 14
    },
    {
        id: 'entreprise-impact',
        name: 'Entreprise IMPACT',
        category: 'ENTREPRISES',
        product_type: 'accompagnement',
        total_price: 4900,
        duration: '30 jours',
        duration_days: 30
    },

    // ========== TARIFS INDIVIDUELS - PHOTO ==========
    {
        id: 'photo-essentiel',
        name: 'Photo ESSENTIEL',
        category: 'TARIFS INDIVIDUELS - PHOTO',
        product_type: 'prestation_individuelle',
        total_price: 180,
        duration: '1 seance',
        duration_days: 0
    },
    {
        id: 'photo-pro',
        name: 'Photo PRO',
        category: 'TARIFS INDIVIDUELS - PHOTO',
        product_type: 'prestation_individuelle',
        total_price: 400,
        duration: '1 seance',
        duration_days: 0
    },
    {
        id: 'photo-event',
        name: 'Photo EVENT',
        category: 'TARIFS INDIVIDUELS - PHOTO',
        product_type: 'prestation_individuelle',
        total_price: 900,
        duration: '1 evenement',
        duration_days: 0
    },

    // ========== TARIFS INDIVIDUELS - VIDEO ==========
    {
        id: 'video-pro',
        name: 'Video PRO',
        category: 'TARIFS INDIVIDUELS - VIDEO',
        product_type: 'prestation_individuelle',
        total_price: 120,
        duration: '1 projet',
        duration_days: 0
    },
    {
        id: 'video-storytelling',
        name: 'Video STORYTELLING',
        category: 'TARIFS INDIVIDUELS - VIDEO',
        product_type: 'prestation_individuelle',
        total_price: 390,
        duration: '1 projet',
        duration_days: 0
    },
    {
        id: 'video-visibility',
        name: 'Video VISIBILITY',
        category: 'TARIFS INDIVIDUELS - VIDEO',
        product_type: 'prestation_individuelle',
        total_price: 530,
        duration: '1 campagne',
        duration_days: 0
    },

    // ========== TARIFS INDIVIDUELS - MARKETING ==========
    {
        id: 'marketing-express',
        name: 'Marketing EXPRESS',
        category: 'TARIFS INDIVIDUELS - MARKETING',
        product_type: 'prestation_individuelle',
        total_price: 120,
        duration: '1 semaine',
        duration_days: 0
    },
    {
        id: 'marketing-strategy',
        name: 'Marketing STRATEGY',
        category: 'TARIFS INDIVIDUELS - MARKETING',
        product_type: 'prestation_individuelle',
        total_price: 150,
        duration: '1 mois',
        duration_days: 0
    },
    {
        id: 'marketing-impact',
        name: 'Marketing IMPACT',
        category: 'TARIFS INDIVIDUELS - MARKETING',
        product_type: 'prestation_individuelle',
        total_price: 350,
        duration: '3 mois',
        duration_days: 0
    },

    // ========== TARIFS INDIVIDUELS - MEDIA ==========
    {
        id: 'media-visibility',
        name: 'Media VISIBILITY',
        category: 'TARIFS INDIVIDUELS - MEDIA',
        product_type: 'prestation_individuelle',
        total_price: 223,
        duration: '1 mois',
        duration_days: 0
    },
    {
        id: 'media-impact',
        name: 'Media IMPACT',
        category: 'TARIFS INDIVIDUELS - MEDIA',
        product_type: 'prestation_individuelle',
        total_price: 420,
        duration: '2 mois',
        duration_days: 0
    },
    {
        id: 'media-premium',
        name: 'Media PREMIUM',
        category: 'TARIFS INDIVIDUELS - MEDIA',
        product_type: 'prestation_individuelle',
        total_price: 590,
        duration: '3 mois',
        duration_days: 0
    },
    {
        id: 'media-promotion',
        name: 'Media PROMOTION',
        category: 'TARIFS INDIVIDUELS - MEDIA',
        product_type: 'prestation_individuelle',
        total_price: 679,
        duration: '1 mois',
        duration_days: 0
    }
];

/**
 * Recuperer un produit par son ID
 * @param {string} productId
 * @returns {Object|null}
 */
function getProductById(productId) {
    return PRODUCTS.find(p => p.id === productId) || null;
}

/**
 * Calculer les montants de paiement (30% acompte, 70% solde)
 * @param {number} totalPrice
 * @returns {Object}
 */
function calculatePaymentAmounts(totalPrice) {
    const depositAmount = Math.round(totalPrice * 0.30); // 30% arrondi a l'euro
    const balanceAmount = totalPrice - depositAmount; // 70% = reste exact

    return {
        total_amount: totalPrice,
        deposit_amount: depositAmount,
        balance_amount: balanceAmount
    };
}

/**
 * Obtenir le montant a payer selon le stage
 * @param {string} productId
 * @param {string} stage - 'deposit' ou 'balance'
 * @returns {number|null}
 */
function getAmountForStage(productId, stage) {
    const product = getProductById(productId);
    if (!product) return null;

    const amounts = calculatePaymentAmounts(product.total_price);

    if (stage === 'deposit') {
        return amounts.deposit_amount;
    } else if (stage === 'balance') {
        return amounts.balance_amount;
    }

    return null;
}

module.exports = {
    PRODUCTS,
    getProductById,
    calculatePaymentAmounts,
    getAmountForStage
};
