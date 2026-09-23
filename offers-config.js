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
 * Chaque prestataire fixe désormais librement son propre tarif via l'annuaire (fiche prestataire) :
 * ce catalogue ne référence plus aucune offre à prix fixé par FA GENESIS.
 */
const FA_GENESIS_OFFERS = [];

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
