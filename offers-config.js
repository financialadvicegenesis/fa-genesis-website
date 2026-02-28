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
 * Toutes les offres d'accompagnement FA GENESIS
 * Structure : { id, nom, categorie, prixTotal, acompte, solde, duree, description }
 */
const FA_GENESIS_OFFERS = [
    // ========== OFFRES ÉTUDIANTS ==========
    {
        id: 'etudiant-idea',
        nom: 'Étudiant IDEA',
        categorie: 'ÉTUDIANTS',
        productType: 'accompagnement', // Type de produit
        prixTotal: 50,
        ...calculatePaymentSplit(50),
        duree: '2 jours',
        echelonsPaiement: 2, // Paiement en 2x
        description: 'Accompagnement de base pour étudiants entrepreneurs',
        inclus: ['1 Mini séance stratégique (45 min)', 'Structuration claire du projet', 'Mini plan d\'action (7 jours)']
    },
    {
        id: 'etudiant-starter',
        nom: 'Étudiant STARTER',
        categorie: 'ÉTUDIANTS',
        productType: 'accompagnement',
        prixTotal: 100,
        ...calculatePaymentSplit(100),
        duree: '7 jours',
        echelonsPaiement: 4, // Paiement en 4x
        description: 'Accompagnement intermédiaire pour structurer son projet',
        inclus: ['1 Séance stratégique (1h30)', 'Structuration claire du projet', 'Conseils visibilité gratuits (sans tournage)', 'Plan d\'action (14 jours)']
    },
    {
        id: 'etudiant-launch',
        nom: 'Étudiant LAUNCH',
        categorie: 'ÉTUDIANTS',
        productType: 'accompagnement',
        prixTotal: 189,
        ...calculatePaymentSplit(189),
        duree: '14 jours',
        echelonsPaiement: 6, // Paiement en 6x
        description: 'Lancement complet de votre projet étudiant',
        inclus: ['1 Séance stratégique (1h30)', 'Structuration claire & storytelling simple du projet', '1 Mini tournage vidéo (45 min)', '1 vidéo courte (1 min)', 'Accès à 1 Média crédible (1 Post et/ou 1 Story)', 'Plan de diffusion (30 jours)']
    },
    {
        id: 'etudiant-impact',
        nom: 'Étudiant IMPACT',
        categorie: 'ÉTUDIANTS',
        productType: 'accompagnement',
        prixTotal: 290,
        ...calculatePaymentSplit(290),
        duree: '1 mois',
        echelonsPaiement: 8, // Paiement en 8x
        description: 'Accompagnement complet pour maximiser l\'impact',
        inclus: ['1 Séance stratégique (1h30)', 'Structuration claire du projet', '1 Shooting photo (5 photos retouchées)', '1 Tournage vidéo (1h00)', '1 vidéo longue (2 min)', 'Accès à 1 Média crédible (1 Post et/ou 1 Story)', 'Plan de communication (30 jours)']
    },
    {
        id: 'etudiant-custom',
        nom: 'Étudiant CUSTOM',
        categorie: 'ÉTUDIANTS',
        productType: 'accompagnement',
        prixTotal: 0, // Sur mesure
        acompte: 0,
        solde: 0,
        duree: 'Variable',
        echelonsPaiement: 1, // Sur devis
        description: 'Accompagnement sur mesure adapté à vos besoins',
        inclus: ['Programme personnalisé', 'Durée flexible', 'Services sur mesure']
    },

    // ========== OFFRES PARTICULIERS ==========
    {
        id: 'particulier-idea',
        nom: 'Particulier IDEA',
        categorie: 'PARTICULIERS',
        productType: 'accompagnement',
        prixTotal: 149,
        ...calculatePaymentSplit(149),
        duree: '2 jours',
        echelonsPaiement: 2, // Paiement en 2x (acompte + solde)
        description: 'Accompagnement starter pour entrepreneurs particuliers',
        inclus: ['1 Séance stratégique (1h30)', 'Structuration claire du projet', 'Plan d\'action (7 jours)']
    },
    {
        id: 'particulier-starter',
        nom: 'Particulier STARTER',
        categorie: 'PARTICULIERS',
        productType: 'accompagnement',
        prixTotal: 490,
        ...calculatePaymentSplit(490),
        duree: '7 jours',
        echelonsPaiement: 2, // Paiement en 2x
        description: 'Développement structuré de votre activité',
        inclus: ['1 Séance stratégique (1h30)', 'Structuration claire du projet', 'Conseils visibilité gratuits (sans tournage)', 'Plan d\'action (14 jours)']
    },
    {
        id: 'particulier-launch',
        nom: 'Particulier LAUNCH',
        categorie: 'PARTICULIERS',
        productType: 'accompagnement',
        prixTotal: 790,
        ...calculatePaymentSplit(790),
        duree: '14 jours',
        echelonsPaiement: 2, // Paiement en 2x
        description: 'Lancement professionnel de votre activité',
        inclus: ['1 Séance stratégique (1h30)', 'Structuration claire & storytelling simple du projet', '1 Mini tournage vidéo (45 min)', '1 vidéo courte (1 min)', 'Accès à 1 Média crédible (2 Post et/ou 2 Story)', 'Plan de diffusion (30 jours)']
    },
    {
        id: 'particulier-impact',
        nom: 'Particulier IMPACT',
        categorie: 'PARTICULIERS',
        productType: 'accompagnement',
        prixTotal: 1490,
        ...calculatePaymentSplit(1490),
        duree: '1 mois',
        echelonsPaiement: 2, // Paiement en 2x
        description: 'Accompagnement intensif pour maximiser votre impact',
        inclus: ['1 Séance stratégique (1h30)', 'Structuration claire du projet', '1 Shooting photo (9 photos retouchées)', '1 Tournage vidéo (1h00)', '1 vidéo longue (2 min)', 'Accès à 1 Média crédible (4 Post et/ou 4 Story)', 'Plan de communication (30 jours)']
    },
    {
        id: 'particulier-custom',
        nom: 'Particulier CUSTOM',
        categorie: 'PARTICULIERS',
        productType: 'accompagnement',
        prixTotal: 0,
        acompte: 0,
        solde: 0,
        duree: 'Variable',
        echelonsPaiement: 1, // Sur devis
        description: 'Programme entièrement personnalisé',
        inclus: ['Sur mesure', 'Durée adaptée', 'Services modulables']
    },

    // ========== OFFRES ENTREPRISES ==========
    {
        id: 'entreprise-start',
        nom: 'Entreprise START',
        categorie: 'ENTREPRISES',
        productType: 'accompagnement',
        prixTotal: 1490,
        ...calculatePaymentSplit(1490),
        duree: '7 jours',
        echelonsPaiement: 2, // Paiement en 2x (non affiché sur le site mais logique pour ce montant)
        description: 'Accompagnement de démarrage pour entreprises',
        inclus: ['1 Séance stratégique (1h30)', 'Clarification du positionnement', 'Message central & discours clair', 'Conseils visibilité (sans tournage)', 'Mini plan d\'action (30 jours)']
    },
    {
        id: 'entreprise-visibility',
        nom: 'Entreprise VISIBILITY',
        categorie: 'ENTREPRISES',
        productType: 'accompagnement',
        prixTotal: 2990,
        ...calculatePaymentSplit(2990),
        duree: '14 jours',
        echelonsPaiement: 2, // Paiement en 2x
        description: 'Développez votre visibilité et votre notoriété',
        inclus: ['1 Séance stratégique (1h30)', 'Structuration du storytelling de l\'entreprise', '1 shooting photo professionnel (24 photos retouchées)', '1 tournage vidéo (1h30)', '1 Vidéo longue (2 min)', 'Format réseaux sociaux', 'Accès à 1 Média crédible (6 Post et/ou 6 Story)', 'Plan de diffusion (30 jours)']
    },
    {
        id: 'entreprise-impact',
        nom: 'Entreprise IMPACT',
        categorie: 'ENTREPRISES',
        productType: 'accompagnement',
        prixTotal: 4900,
        ...calculatePaymentSplit(4900),
        duree: '30 jours',
        echelonsPaiement: 2, // Paiement en 2x
        description: 'Accompagnement premium pour maximiser votre impact',
        inclus: ['1 Séance stratégique (1h30)', 'Structuration du positionnement & discours', '1 Shooting photo professionnel (40 photos retouchées)', '2 tournages vidéos (1h30 chacun)', '2 vidéos longues (2 min chacune) + Direction narrative', 'Format réseaux sociaux', 'Accès à 1 Média crédible (9 Post et/ou 9 Story)', 'Plan de communication (60 jours)']
    },
    {
        id: 'entreprise-custom',
        nom: 'Entreprise CUSTOM',
        categorie: 'ENTREPRISES',
        productType: 'accompagnement',
        prixTotal: 0,
        acompte: 0,
        solde: 0,
        duree: 'Variable',
        echelonsPaiement: 1, // Sur devis
        description: 'Solution sur mesure pour votre entreprise',
        inclus: ['Programme dédié', 'Flexibilité totale', 'Services exclusifs']
    },

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
                due_date_label: "A la fin de l'accompagnement",
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
