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
        echelonsPaiement: 1, // Paiement comptant uniquement
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
        echelonsPaiement: 3, // Paiement en 3x (non affiché sur le site mais logique pour ce montant)
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
        echelonsPaiement: 4, // Paiement en 4x (non affiché sur le site mais logique pour ce montant)
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

    // ========== TARIFS INDIVIDUELS - PHOTO ==========
    {
        id: 'photo-essentiel',
        nom: 'Photo ESSENTIEL',
        categorie: 'TARIFS INDIVIDUELS - PHOTO',
        productType: 'prestation_individuelle',
        prixTotal: 180,
        ...calculatePaymentSplit(180),
        duree: '1 séance',
        echelonsPaiement: 2, // Paiement 2x possible
        description: 'Séance photo essentielle pour vos besoins',
        inclus: ['1 Séance Photo', '8 Photos retouchées', 'Formats réseaux sociaux']
    },
    {
        id: 'photo-pro',
        nom: 'Photo PRO',
        categorie: 'TARIFS INDIVIDUELS - PHOTO',
        productType: 'prestation_individuelle',
        prixTotal: 400,
        ...calculatePaymentSplit(400),
        duree: '1 séance',
        echelonsPaiement: 2, // Paiement 2x possible
        description: 'Shooting professionnel complet',
        inclus: ['1 Séance photo', '22 Photos retouchées', 'Orientation posture & image pro', 'Format réseaux sociaux', 'Conseils d\'utilisation des images']
    },
    {
        id: 'photo-event',
        nom: 'Photo EVENT',
        categorie: 'TARIFS INDIVIDUELS - PHOTO',
        productType: 'prestation_individuelle',
        prixTotal: 900,
        ...calculatePaymentSplit(900),
        duree: '1 événement',
        echelonsPaiement: 2, // Paiement 2x possible
        description: 'Couverture photo complète d\'événement',
        inclus: ['Présence du photographe (6 heures Max)', '50 photos retouchées', 'Captation des moments clés', 'Format réseaux sociaux', 'Conseils de sélection et d\'utilisation des images']
    },
    {
        id: 'photo-custom',
        nom: 'Photo CUSTOM',
        categorie: 'TARIFS INDIVIDUELS - PHOTO',
        productType: 'prestation_individuelle',
        prixTotal: 0,
        acompte: 0,
        solde: 0,
        duree: 'Variable',
        echelonsPaiement: 1, // Sur devis
        description: 'Prestation photo sur mesure',
        inclus: ['Durée adaptée', 'Photos illimitées', 'Services modulables']
    },

    // ========== TARIFS INDIVIDUELS - VIDÉO ==========
    {
        id: 'video-pro',
        nom: 'Vidéo PRO',
        categorie: 'TARIFS INDIVIDUELS - VIDÉO',
        productType: 'prestation_individuelle',
        prixTotal: 120,
        ...calculatePaymentSplit(120),
        duree: '1 projet',
        echelonsPaiement: 2, // Paiement 2x possible
        description: 'Vidéo professionnelle de qualité',
        inclus: ['1 Mini tournage vidéo (45 min)', '1 Vidéo courte (1 min)', 'Son + cadrage pro', 'Format réseaux sociaux']
    },
    {
        id: 'video-storytelling',
        nom: 'Vidéo STORYTELLING',
        categorie: 'TARIFS INDIVIDUELS - VIDÉO',
        productType: 'prestation_individuelle',
        prixTotal: 390,
        ...calculatePaymentSplit(390),
        duree: '1 projet',
        echelonsPaiement: 2, // Paiement 2x possible
        description: 'Vidéo narrative pour raconter votre histoire',
        inclus: ['1 Tournage vidéo (1h00)', '1 Vidéo longue (2 min)', 'Son + cadrage pro', 'Format réseaux sociaux', 'Orientation posture & discours']
    },
    {
        id: 'video-visibility',
        nom: 'Vidéo VISIBILITY',
        categorie: 'TARIFS INDIVIDUELS - VIDÉO',
        productType: 'prestation_individuelle',
        prixTotal: 530,
        ...calculatePaymentSplit(530),
        duree: '1 campagne',
        echelonsPaiement: 2, // Paiement 2x possible
        description: 'Campagne vidéo complète pour votre visibilité',
        inclus: ['1 Tournage vidéo (1h30)', '1 Vidéo longue (2 min) + Direction narrative + storytelling', 'Son + cadrage pro', 'Format réseaux sociaux', 'Orientation posture & discours', 'Conseils de diffusion']
    },
    {
        id: 'video-custom',
        nom: 'Vidéo CUSTOM',
        categorie: 'TARIFS INDIVIDUELS - VIDÉO',
        productType: 'prestation_individuelle',
        prixTotal: 0,
        acompte: 0,
        solde: 0,
        duree: 'Variable',
        echelonsPaiement: 1, // Sur devis
        description: 'Production vidéo sur mesure',
        inclus: ['Projet personnalisé', 'Durée flexible', 'Services modulables']
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

console.log('🟢 offers-config.js chargé avec succès');
console.log('📊 Nombre total d\'offres:', FA_GENESIS_OFFERS.length);
console.log('💰 Système de paiement: 30% acompte + 70% solde');
