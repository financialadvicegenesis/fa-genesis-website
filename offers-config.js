// Configuration centrale des offres et tarifs FA GENESIS
// Système de paiement progressif : 30% acompte + 70% solde

console.log('🔵 Chargement de offers-config.js');

/**
 * Fonction pour calculer automatiquement l'acompte et le solde
 * @param {number} prixTotal - Prix total de l'offre
 * @returns {Object} - { acompte, solde }
 */
function calculatePaymentSplit(prixTotal) {
    const acompte = Math.round(prixTotal * 0.30);
    const solde = prixTotal - acompte;
    return { acompte, solde };
}

/**
 * Toutes les offres FA GENESIS (prestations de prestataires indépendants partenaires)
 * Structure : { id, nom, categorie, prixTotal, acompte, solde, duree, description }
 */
const FA_GENESIS_OFFERS = [
    // ========== TARIFS INDIVIDUELS - PHOTO (sur devis) ==========
    {
        id: 'photo-devis',
        nom: 'Photo - Sur Devis',
        categorie: 'TARIFS INDIVIDUELS - PHOTO',
        productType: 'prestation_individuelle',
        prixTotal: 0,
        acompte: 0,
        solde: 0,
        duree: 'Variable',
        echelonsPaiement: 1,
        description: 'Prestation photo sur devis - photographes professionnels ind\u00e9pendants partenaires',
        inclus: ['Photographe professionnel ind\u00e9pendant', 'Tarif selon projet, format et dur\u00e9e', 'Devis personnalis\u00e9']
    },

    // ========== TARIFS INDIVIDUELS - VIDÉO (sur devis) ==========
    {
        id: 'video-devis',
        nom: 'Vid\u00e9o - Sur Devis',
        categorie: 'TARIFS INDIVIDUELS - VID\u00c9O',
        productType: 'prestation_individuelle',
        prixTotal: 0,
        acompte: 0,
        solde: 0,
        duree: 'Variable',
        echelonsPaiement: 1,
        description: 'Prestation vid\u00e9o sur devis - vid\u00e9astes professionnels partenaires',
        inclus: ['Vid\u00e9aste professionnel partenaire', 'Tarif selon format et objectifs', 'Devis personnalis\u00e9']
    },

    // ========== TARIFS INDIVIDUELS - MARKETING ==========
    {
        id: 'marketing-express',
        nom: 'Marketing EXPRESS',
        categorie: 'TARIFS INDIVIDUELS - MARKETING',
        productType: 'prestation_individuelle',
        prixTotal: 120,
        ...calculatePaymentSplit(120),
        duree: '1 semaine',
        echelonsPaiement: 2, // Paiement possible en 2x
        description: 'Audit marketing rapide et recommandations',
        inclus: ['Analyse du projet', 'Clarification cible & message', 'Recommandations concrètes']
    },
    {
        id: 'marketing-strategy',
        nom: 'Marketing STRATEGY',
        categorie: 'TARIFS INDIVIDUELS - MARKETING',
        productType: 'prestation_individuelle',
        prixTotal: 150,
        ...calculatePaymentSplit(150),
        duree: '1 mois',
        echelonsPaiement: 2, // Paiement possible en 2x
        description: 'Stratégie marketing complète',
        inclus: ['Positionnement', 'Message central', 'Branding']
    },
    {
        id: 'marketing-impact',
        nom: 'Marketing IMPACT',
        categorie: 'TARIFS INDIVIDUELS - MARKETING',
        productType: 'prestation_individuelle',
        prixTotal: 350,
        ...calculatePaymentSplit(350),
        duree: '3 mois',
        echelonsPaiement: 2, // Paiement possible en 2x
        description: 'Accompagnement marketing intensif',
        inclus: ['Diagnostic approfondi', 'Priorités claires', 'Storytelling du projet', 'Plan de publication (30 jours)']
    },
    {
        id: 'marketing-option-digitales',
        nom: 'Marketing DIGITALES',
        categorie: 'TARIFS INDIVIDUELS - MARKETING',
        productType: 'prestation_individuelle',
        prixTotal: 70,
        ...calculatePaymentSplit(70),
        duree: 'Complément',
        echelonsPaiement: 2,
        description: 'Option digitale en complément de Marketing STRATEGY',
        inclus: ['Choix des plateformes', 'Conseils contenus']
    },

    // ========== TARIFS INDIVIDUELS - MÉDIA ==========
    {
        id: 'media-simple',
        nom: 'Média SIMPLE',
        categorie: 'TARIFS INDIVIDUELS - MÉDIA',
        productType: 'prestation_individuelle',
        prixTotal: 55,
        ...calculatePaymentSplit(55),
        duree: '1 publication',
        echelonsPaiement: 2, // Paiement possible en 2x dont 1x/mois (27,5 €/mois)
        description: 'Accès à un média crédible pour une première visibilité',
        inclus: ['Accès à 1 média crédible', 'Publication (1 Post et/ou 1 Story)', 'Brief en amont pour cadrer le message']
    },
    {
        id: 'media-visibility',
        nom: 'Média VISIBILITY',
        categorie: 'TARIFS INDIVIDUELS - MÉDIA',
        productType: 'prestation_individuelle',
        prixTotal: 223,
        ...calculatePaymentSplit(223),
        duree: '1 mois',
        echelonsPaiement: 2, // Paiement possible en 2x
        description: 'Pack visibilité médiatique',
        inclus: ['Accès à 1 média crédible', 'Publication (4 Post et/ou 4 Story)', 'Brief en amont pour cadrer le message']
    },
    {
        id: 'media-impact',
        nom: 'Média IMPACT',
        categorie: 'TARIFS INDIVIDUELS - MÉDIA',
        productType: 'prestation_individuelle',
        prixTotal: 420,
        ...calculatePaymentSplit(420),
        duree: '2 mois',
        echelonsPaiement: 2, // Paiement possible en 2x
        description: 'Campagne média pour maximiser votre impact',
        inclus: ['Accès à 1 média crédible', 'Publication (6 Post et/ou 6 Story)', 'Brief en amont pour cadrer le message', 'Conseils pour réutiliser la publication sur les réseaux sociaux']
    },
    {
        id: 'media-premium',
        nom: 'Média PREMIUM',
        categorie: 'TARIFS INDIVIDUELS - MÉDIA',
        productType: 'prestation_individuelle',
        prixTotal: 590,
        ...calculatePaymentSplit(590),
        duree: '3 mois',
        echelonsPaiement: 2, // Paiement possible en 2x
        description: 'Package média premium complet',
        inclus: ['Accès à 1 média crédible', 'Publication (8 Post et/ou 8 Story)', 'Brief en amont pour cadrer le message', 'Stratégie de visibilité pour avoir une crédibilité sur du long terme']
    },
    {
        id: 'media-promotion',
        nom: 'Média PROMOTION',
        categorie: 'TARIFS INDIVIDUELS - MÉDIA',
        productType: 'prestation_individuelle',
        prixTotal: 679,
        ...calculatePaymentSplit(679),
        duree: '1 mois',
        echelonsPaiement: 2, // Paiement possible en 2x
        description: 'Promotion médiatique ciblée',
        inclus: ['Accès à 1 média crédible', 'Publication (12 Post et/ou 12 Story)', 'Visibilité auprès d\'une audience ciblée et engagée', 'Mise en avant de votre contenus (Artiste, marque ou évènement)', 'Gain de notoriété et de crédibilité grâce à un relais média']
    }
];

/**
 * Récupérer une offre par son ID
 * @param {string} offerId - ID de l'offre
 * @returns {Object|null}
 */
function getOfferById(offerId) {
    return FA_GENESIS_OFFERS.find(offer => offer.id === offerId) || null;
}

/**
 * Récupérer toutes les offres d'une catégorie
 * @param {string} categorie - Nom de la catégorie
 * @returns {Array}
 */
function getOffersByCategory(categorie) {
    return FA_GENESIS_OFFERS.filter(offer => offer.categorie === categorie);
}

/**
 * Récupérer le montant de l'acompte pour une offre
 * @param {string} offerId - ID de l'offre
 * @returns {number}
 */
function getDepositAmount(offerId) {
    const offer = getOfferById(offerId);
    return offer ? offer.acompte : 0;
}

/**
 * Récupérer le montant du solde pour une offre
 * @param {string} offerId - ID de l'offre
 * @returns {number}
 */
function getBalanceAmount(offerId) {
    const offer = getOfferById(offerId);
    return offer ? offer.solde : 0;
}

/**
 * Calcule le plan d'echeances pour une offre donnee.
 * Utilise cote frontend pour afficher le calendrier dans checkout.html et payment.html.
 * @param {string} offerId
 * @param {Date|null} refDate - Date de reference (aujourd'hui si null)
 * @returns {Array} - tableau de versements { number, label, amount, due_date_label, stage }
 */
function getInstallmentPlan(offerId, refDate) {
    var offer = getOfferById(offerId);
    if (!offer) return [];
    var total = offer.prixTotal || 0;
    var deposit = offer.acompte || Math.round(total * 0.30);
    var count = offer.echelonsPaiement || 2;
    var ref = refDate ? new Date(refDate) : new Date();

    var plan = [];
    plan.push({
        number: 1,
        label: 'Acompte (30%)',
        amount: deposit,
        due_date_label: "Aujourd'hui",
        stage: 'deposit'
    });

    if (count <= 2) {
        // Paiement standard : acompte + solde
        if (total - deposit > 0) {
            plan.push({
                number: 2,
                label: 'Solde (70%)',
                amount: total - deposit,
                due_date_label: "A la fin de la prestation",
                stage: 'balance'
            });
        }
        return plan;
    }

    // Mode installements N > 2
    var balanceAmount = total - deposit;
    var numBalanceInstallments = count - 1;
    var baseAmount = Math.floor(balanceAmount / numBalanceInstallments);
    var lastAmount = balanceAmount - baseAmount * (numBalanceInstallments - 1);
    var labelMap = { 2: '2eme', 3: '3eme', 4: '4eme', 5: '5eme', 6: '6eme', 7: '7eme', 8: '8eme', 9: '9eme' };

    for (var i = 2; i <= count; i++) {
        var amount = (i === count) ? lastAmount : baseAmount;
        var daysLabel = 'J+' + ((i - 1) * 30) + ' jours';
        plan.push({
            number: i,
            label: (labelMap[i] || (i + 'eme')) + ' versement',
            amount: amount,
            due_date_label: daysLabel,
            stage: 'installment_' + i
        });
    }
    return plan;
}

console.log('🟢 offers-config.js chargé avec succès');
console.log('📊 Nombre total d\'offres:', FA_GENESIS_OFFERS.length);
console.log('💰 Système de paiement: 30% acompte + 70% solde');
