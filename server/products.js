/**
 * Configuration des produits FA GENESIS - COTE SERVEUR
 *
 * SECURITE: Les prix sont definis uniquement cote serveur.
 * Le frontend envoie seulement l'ID du produit, le serveur
 * calcule les montants reels (30% acompte, 70% solde).
 *
 * installments_count : nombre total de paiements (acompte inclus)
 *   - 2  = acompte 30% + solde 70% en 1 fois (comportement standard)
 *   - N>2 = acompte 30% + solde 70% divisé en (N-1) versements égaux
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
        duration_days: 2,
        installments_count: 2
    },
    {
        id: 'etudiant-starter',
        name: 'Etudiant STARTER',
        category: 'ETUDIANTS',
        product_type: 'accompagnement',
        total_price: 100,
        duration: '7 jours',
        duration_days: 7,
        installments_count: 4
    },
    {
        id: 'etudiant-launch',
        name: 'Etudiant LAUNCH',
        category: 'ETUDIANTS',
        product_type: 'accompagnement',
        total_price: 189,
        duration: '14 jours',
        duration_days: 14,
        installments_count: 6
    },
    {
        id: 'etudiant-impact',
        name: 'Etudiant IMPACT',
        category: 'ETUDIANTS',
        product_type: 'accompagnement',
        total_price: 390,
        duration: '1 mois',
        duration_days: 30,
        installments_count: 8
    },

    // ========== OFFRES PARTICULIERS ==========
    {
        id: 'particulier-idea',
        name: 'Particulier IDEA',
        category: 'PARTICULIERS',
        product_type: 'accompagnement',
        total_price: 149,
        duration: '2 jours',
        duration_days: 2,
        installments_count: 2
    },
    {
        id: 'particulier-starter',
        name: 'Particulier STARTER',
        category: 'PARTICULIERS',
        product_type: 'accompagnement',
        total_price: 490,
        duration: '7 jours',
        duration_days: 7,
        installments_count: 2
    },
    {
        id: 'particulier-launch',
        name: 'Particulier LAUNCH',
        category: 'PARTICULIERS',
        product_type: 'accompagnement',
        total_price: 790,
        duration: '14 jours',
        duration_days: 14,
        installments_count: 2
    },
    {
        id: 'particulier-impact',
        name: 'Particulier IMPACT',
        category: 'PARTICULIERS',
        product_type: 'accompagnement',
        total_price: 1490,
        duration: '1 mois',
        duration_days: 30,
        installments_count: 2
    },

    // ========== OFFRES ENTREPRISES ==========
    {
        id: 'entreprise-start',
        name: 'Entreprise START',
        category: 'ENTREPRISES',
        product_type: 'accompagnement',
        total_price: 1490,
        duration: '7 jours',
        duration_days: 7,
        installments_count: 2
    },
    {
        id: 'entreprise-visibility',
        name: 'Entreprise VISIBILITY',
        category: 'ENTREPRISES',
        product_type: 'accompagnement',
        total_price: 2990,
        duration: '14 jours',
        duration_days: 14,
        installments_count: 2
    },
    {
        id: 'entreprise-impact',
        name: 'Entreprise IMPACT',
        category: 'ENTREPRISES',
        product_type: 'accompagnement',
        total_price: 4900,
        duration: '30 jours',
        duration_days: 30,
        installments_count: 2
    },

    // ========== OFFRES SUR MESURE (prix défini après contact) ==========
    {
        id: 'etudiant-custom',
        name: 'Etudiant Sur Mesure',
        category: 'ETUDIANTS',
        product_type: 'accompagnement',
        total_price: 0,
        duration: 'Variable',
        duration_days: 0,
        installments_count: 2
    },
    {
        id: 'particulier-custom',
        name: 'Particulier Sur Mesure',
        category: 'PARTICULIERS',
        product_type: 'accompagnement',
        total_price: 0,
        duration: 'Variable',
        duration_days: 0,
        installments_count: 2
    },
    {
        id: 'entreprise-custom',
        name: 'Entreprise Sur Mesure',
        category: 'ENTREPRISES',
        product_type: 'accompagnement',
        total_price: 0,
        duration: 'Variable',
        duration_days: 0,
        installments_count: 2
    },

    // ========== TARIFS INDIVIDUELS - PHOTO (sur devis) ==========
    {
        id: 'photo-devis',
        name: 'Photo - Sur Devis',
        category: 'TARIFS INDIVIDUELS - PHOTO',
        product_type: 'prestation_individuelle',
        total_price: 0,
        duration: 'Variable',
        duration_days: 0,
        installments_count: 2
    },

    // ========== TARIFS INDIVIDUELS - VIDEO (sur devis) ==========
    {
        id: 'video-devis',
        name: 'Video - Sur Devis',
        category: 'TARIFS INDIVIDUELS - VIDEO',
        product_type: 'prestation_individuelle',
        total_price: 0,
        duration: 'Variable',
        duration_days: 0,
        installments_count: 2
    },

    // ========== TARIFS INDIVIDUELS - MARKETING ==========
    {
        id: 'marketing-express',
        name: 'Marketing EXPRESS',
        category: 'TARIFS INDIVIDUELS - MARKETING',
        product_type: 'prestation_individuelle',
        total_price: 120,
        duration: '1 semaine',
        duration_days: 0,
        installments_count: 2
    },
    {
        id: 'marketing-strategy',
        name: 'Marketing STRATEGY',
        category: 'TARIFS INDIVIDUELS - MARKETING',
        product_type: 'prestation_individuelle',
        total_price: 150,
        duration: '1 mois',
        duration_days: 0,
        installments_count: 2
    },
    {
        id: 'marketing-impact',
        name: 'Marketing IMPACT',
        category: 'TARIFS INDIVIDUELS - MARKETING',
        product_type: 'prestation_individuelle',
        total_price: 350,
        duration: '3 mois',
        duration_days: 0,
        installments_count: 2
    },
    {
        id: 'marketing-option-digitales',
        name: 'Option Digitales',
        category: 'TARIFS INDIVIDUELS - MARKETING',
        product_type: 'prestation_individuelle',
        total_price: 70,
        duration: 'Complément',
        duration_days: 0,
        installments_count: 2
    },

    // ========== TARIFS INDIVIDUELS - MEDIA ==========
    {
        id: 'media-simple',
        name: 'Media SIMPLE',
        category: 'TARIFS INDIVIDUELS - MEDIA',
        product_type: 'prestation_individuelle',
        total_price: 55,
        duration: '1 publication',
        duration_days: 0,
        installments_count: 2
    },
    {
        id: 'media-visibility',
        name: 'Media VISIBILITY',
        category: 'TARIFS INDIVIDUELS - MEDIA',
        product_type: 'prestation_individuelle',
        total_price: 223,
        duration: '1 mois',
        duration_days: 0,
        installments_count: 2
    },
    {
        id: 'media-impact',
        name: 'Media IMPACT',
        category: 'TARIFS INDIVIDUELS - MEDIA',
        product_type: 'prestation_individuelle',
        total_price: 420,
        duration: '2 mois',
        duration_days: 0,
        installments_count: 2
    },
    {
        id: 'media-premium',
        name: 'Media PREMIUM',
        category: 'TARIFS INDIVIDUELS - MEDIA',
        product_type: 'prestation_individuelle',
        total_price: 590,
        duration: '3 mois',
        duration_days: 0,
        installments_count: 2
    },
    {
        id: 'media-promotion',
        name: 'Media PROMOTION',
        category: 'TARIFS INDIVIDUELS - MEDIA',
        product_type: 'prestation_individuelle',
        total_price: 679,
        duration: '1 mois',
        duration_days: 0,
        installments_count: 2
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

/**
 * Calculer les montants pour une commande multi-items
 * @param {string[]} productIds - tableau d'IDs produit
 * @returns {Object}
 */
function calculateMultiItemAmounts(productIds) {
    var totalPrice = 0;
    var items = [];
    var hasDevisItems = false;
    var maxInstallments = 2; // Par défaut 2x (acompte + solde)

    for (var i = 0; i < productIds.length; i++) {
        var product = getProductById(productIds[i]);
        if (!product) continue;
        if (product.total_price === 0) hasDevisItems = true;
        totalPrice += product.total_price;
        // Prendre le maximum d'installments parmi tous les produits du panier
        if (product.installments_count && product.installments_count > maxInstallments) {
            maxInstallments = product.installments_count;
        }
        items.push({
            product_id: product.id,
            product_name: product.name,
            product_type: product.product_type,
            category: product.category,
            unit_price: product.total_price,
            duration: product.duration,
            duration_days: product.duration_days,
            installments_count: product.installments_count || 2
        });
    }
    var deposit = Math.round(totalPrice * 0.30);
    return {
        items: items,
        total_amount: totalPrice,
        deposit_amount: deposit,
        balance_amount: totalPrice - deposit,
        has_devis_items: hasDevisItems,
        installments_count: maxInstallments
    };
}

/**
 * Génère le tableau d'échéances pour une commande en plusieurs fois.
 *
 * @param {number} totalAmount     - montant total de la commande
 * @param {number} depositAmount   - montant de l'acompte (30%)
 * @param {number} count           - nombre total de paiements (acompte inclus)
 * @param {string|Date} refDate    - date de référence (dépôt payé), pour calculer les échéances
 * @returns {Array|null}  null si count <= 2 (comportement standard sans installments)
 */
function generateInstallments(totalAmount, depositAmount, count, refDate) {
    if (!count || count <= 2) return null; // Comportement standard

    var balanceAmount = totalAmount - depositAmount;
    var numBalanceInstallments = count - 1;

    // Montant de base de chaque versement (solde divisé équitablement)
    var baseAmount = Math.floor(balanceAmount / numBalanceInstallments);
    // Le dernier versement prend le reste pour éviter les erreurs d'arrondi
    var lastAmount = balanceAmount - baseAmount * (numBalanceInstallments - 1);

    var ref = refDate ? new Date(refDate) : new Date();

    var installments = [];

    // Versement #1 : acompte (déjà payé ou à payer immédiatement)
    installments.push({
        number: 1,
        label: 'Acompte 30%',
        amount: depositAmount,
        due_date: null, // immédiat
        paid: false,
        paid_at: null,
        stage: 'deposit'
    });

    // Versements #2..N : solde divisé
    for (var i = 2; i <= count; i++) {
        var dueDate = new Date(ref);
        dueDate.setDate(dueDate.getDate() + (i - 1) * 30); // J+30, J+60, J+90...

        var amount = (i === count) ? lastAmount : baseAmount;

        var labelMap = { 2: '2ème', 3: '3ème', 4: '4ème', 5: '5ème',
                         6: '6ème', 7: '7ème', 8: '8ème', 9: '9ème' };
        var label = (labelMap[i] || (i + 'ème')) + ' versement';

        installments.push({
            number: i,
            label: label,
            amount: amount,
            due_date: dueDate.toISOString().split('T')[0], // YYYY-MM-DD
            paid: false,
            paid_at: null,
            stage: 'installment_' + i
        });
    }

    return installments;
}

module.exports = {
    PRODUCTS,
    getProductById,
    calculatePaymentAmounts,
    calculateMultiItemAmounts,
    getAmountForStage,
    generateInstallments
};
