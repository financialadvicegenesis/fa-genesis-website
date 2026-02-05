// Système de gestion des paiements et statuts clients FA GENESIS

console.log('🔵 Chargement de payment-system.js');

/**
 * Statuts de paiement possibles
 */
const PAYMENT_STATUS = {
    REGISTERED: 'registered',              // Compte créé, aucune offre active
    DEPOSIT_PAID: 'deposit_paid',          // Acompte de 30% payé, accompagnement démarré
    DELIVERY_PENDING: 'delivery_pending_payment',  // Accompagnement terminé, livrables bloqués
    FULLY_PAID: 'fully_paid'               // Solde payé, accès total et définitif
};

/**
 * Types de paiement
 */
const PAYMENT_TYPE = {
    DEPOSIT: 'acompte',
    BALANCE: 'solde'
};

/**
 * Statuts de livraison pour prestations individuelles
 */
const DELIVERY_STATUS = {
    CONFIRMED: 'confirmed',           // Commande confirmée (acompte payé)
    IN_PROGRESS: 'in_progress',       // Prestation en cours
    READY: 'ready',                   // Livrable prêt
    DELIVERED: 'delivered'            // Livré (solde réglé)
};

/**
 * Classe pour gérer un paiement
 */
class Payment {
    constructor(userId, offerId, amount, type) {
        this.id = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.userId = userId;
        this.offerId = offerId;
        this.amount = amount;
        this.type = type; // 'acompte' ou 'solde'
        this.date = new Date().toISOString();
        this.status = 'completed'; // Pour simulation, en production: 'pending', 'completed', 'failed'
    }
}

/**
 * Obtenir l'utilisateur depuis localStorage (compatible avec auth.js backend)
 * @param {string} email - Email de l'utilisateur
 * @returns {Object|null}
 */
function getUserFromStorage(email) {
    // D'abord vérifier la session backend (fa_genesis_session)
    const session = localStorage.getItem('fa_genesis_session');
    if (session) {
        try {
            const sessionUser = JSON.parse(session);
            if (sessionUser && sessionUser.email === email) {
                return sessionUser;
            }
        } catch (e) {
            console.error('Erreur lecture session:', e);
        }
    }

    // Fallback: vérifier l'ancien système localStorage (users array)
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email);
    if (user) return user;

    // Fallback: currentUser (ancien système)
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        try {
            const parsed = JSON.parse(currentUser);
            if (parsed && parsed.email === email) {
                return parsed;
            }
        } catch (e) {
            console.error('Erreur lecture currentUser:', e);
        }
    }

    return null;
}

/**
 * Récupérer le statut de paiement d'un utilisateur
 * @param {string} email - Email de l'utilisateur
 * @returns {string}
 */
function getUserPaymentStatus(email) {
    const user = getUserFromStorage(email);
    if (!user) return PAYMENT_STATUS.REGISTERED;
    return user.paymentStatus || user.payment_status || PAYMENT_STATUS.REGISTERED;
}

/**
 * Mettre à jour l'utilisateur dans le storage (compatible backend et ancien système)
 * @param {string} email - Email de l'utilisateur
 * @param {Object} updates - Champs à mettre à jour
 * @returns {boolean}
 */
function updateUserInStorage(email, updates) {
    let updated = false;

    // 1. Mettre à jour la session backend (fa_genesis_session)
    const session = localStorage.getItem('fa_genesis_session');
    if (session) {
        try {
            const sessionUser = JSON.parse(session);
            if (sessionUser && sessionUser.email === email) {
                Object.assign(sessionUser, updates);
                localStorage.setItem('fa_genesis_session', JSON.stringify(sessionUser));
                console.log('✅ Session backend mise à jour');
                updated = true;
            }
        } catch (e) {
            console.error('Erreur mise à jour session:', e);
        }
    }

    // 2. Mettre à jour aussi dans users array (ancien système / fallback)
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.email === email);
    if (userIndex !== -1) {
        Object.assign(users[userIndex], updates);
        localStorage.setItem('users', JSON.stringify(users));
        console.log('✅ Users array mis à jour');
        updated = true;
    }

    // 3. Si aucun stockage trouvé, créer dans users array
    if (!updated) {
        const user = getUserFromStorage(email);
        if (user) {
            Object.assign(user, updates);
            users.push(user);
            localStorage.setItem('users', JSON.stringify(users));
            console.log('✅ Utilisateur ajouté au users array');
            updated = true;
        }
    }

    return updated;
}

/**
 * Mettre à jour le statut de paiement d'un utilisateur
 * @param {string} email - Email de l'utilisateur
 * @param {string} newStatus - Nouveau statut
 * @returns {boolean}
 */
function updateUserPaymentStatus(email, newStatus) {
    const result = updateUserInStorage(email, {
        paymentStatus: newStatus,
        lastPaymentUpdate: new Date().toISOString()
    });

    if (result) {
        console.log(`✅ Statut de paiement mis à jour: ${email} → ${newStatus}`);
    }
    return result;
}

/**
 * Enregistrer un paiement
 * @param {string} email - Email de l'utilisateur
 * @param {string} offerId - ID de l'offre
 * @param {number} amount - Montant payé
 * @param {string} type - Type de paiement ('acompte' ou 'solde')
 * @returns {Payment|null}
 */
function recordPayment(email, offerId, amount, type) {
    // Récupérer l'utilisateur depuis le storage
    const user = getUserFromStorage(email);

    if (!user) {
        console.error('❌ Utilisateur non trouvé pour:', email);
        return null;
    }

    // Créer le paiement
    const payment = new Payment(email, offerId, amount, type);

    // Préparer les mises à jour
    const currentPayments = user.payments || [];
    currentPayments.push(payment);

    const updates = {
        payments: currentPayments,
        lastPaymentUpdate: new Date().toISOString()
    };

    // Mettre à jour le statut selon le type de paiement
    if (type === PAYMENT_TYPE.DEPOSIT) {
        updates.paymentStatus = PAYMENT_STATUS.DEPOSIT_PAID;
        updates.activeOfferId = offerId;
    } else if (type === PAYMENT_TYPE.BALANCE) {
        updates.paymentStatus = PAYMENT_STATUS.FULLY_PAID;
    }

    // Appliquer les mises à jour
    const success = updateUserInStorage(email, updates);

    if (!success) {
        console.error('❌ Échec de la mise à jour du paiement');
        return null;
    }

    console.log(`✅ Paiement enregistré:`, payment);
    console.log(`💰 ${type} de ${amount}€ pour l'offre ${offerId}`);

    return payment;
}

/**
 * Récupérer tous les paiements d'un utilisateur
 * @param {string} email - Email de l'utilisateur
 * @returns {Array}
 */
function getUserPayments(email) {
    const user = getUserFromStorage(email);
    return user && user.payments ? user.payments : [];
}

/**
 * Vérifier si l'acompte a été payé pour une offre
 * @param {string} email - Email de l'utilisateur
 * @param {string} offerId - ID de l'offre
 * @returns {boolean}
 */
function isDepositPaid(email, offerId) {
    const payments = getUserPayments(email);
    return payments.some(p => p.offerId === offerId && p.type === PAYMENT_TYPE.DEPOSIT);
}

/**
 * Vérifier si le solde a été payé pour une offre
 * @param {string} email - Email de l'utilisateur
 * @param {string} offerId - ID de l'offre
 * @returns {boolean}
 */
function isBalancePaid(email, offerId) {
    const payments = getUserPayments(email);
    return payments.some(p => p.offerId === offerId && p.type === PAYMENT_TYPE.BALANCE);
}

/**
 * Vérifier les droits d'accès selon le statut de paiement
 * @param {string} email - Email de l'utilisateur
 * @returns {Object}
 */
function checkAccessRights(email) {
    const status = getUserPaymentStatus(email);

    const rights = {
        status: status,
        canAccessDocuments: false,
        canAccessParcours: false,
        canScheduleSeances: false,
        canDownloadLivrables: false,
        message: ''
    };

    switch (status) {
        case PAYMENT_STATUS.REGISTERED:
            rights.message = 'Un acompte de 30% est requis pour démarrer l\'accompagnement.';
            break;

        case PAYMENT_STATUS.DEPOSIT_PAID:
            rights.canAccessDocuments = true;
            rights.canAccessParcours = true;
            rights.canScheduleSeances = true;
            rights.message = 'Acompte payé. Vous avez accès aux documents communs, au parcours et aux séances. Réglez le solde pour accéder à vos livrables.';
            break;

        case PAYMENT_STATUS.DELIVERY_PENDING:
            rights.canAccessDocuments = true;
            rights.canAccessParcours = false;
            rights.canScheduleSeances = false;
            rights.message = 'Accompagnement terminé. Réglez le solde (70%) pour accéder à tous vos services et livrables.';
            break;

        case PAYMENT_STATUS.FULLY_PAID:
            rights.canAccessDocuments = true;
            rights.canAccessParcours = true;
            rights.canScheduleSeances = true;
            rights.canDownloadLivrables = true;
            rights.message = 'Paiement complet. Accès total à tous vos services, parcours et livrables.';
            break;
    }

    return rights;
}

/**
 * Marquer l'accompagnement comme terminé (passage en delivery_pending)
 * @param {string} email - Email de l'utilisateur
 * @returns {boolean}
 */
function markAccompanimentCompleted(email) {
    const currentStatus = getUserPaymentStatus(email);

    if (currentStatus !== PAYMENT_STATUS.DEPOSIT_PAID) {
        console.error('❌ L\'accompagnement ne peut être marqué comme terminé que si l\'acompte est payé');
        return false;
    }

    return updateUserPaymentStatus(email, PAYMENT_STATUS.DELIVERY_PENDING);
}

/**
 * Simuler un paiement d'acompte (pour tests)
 * @param {string} email - Email de l'utilisateur
 * @param {string} offerId - ID de l'offre
 * @returns {Payment|null}
 */
function simulateDepositPayment(email, offerId) {
    // Récupérer l'offre
    const offer = getOfferById(offerId);
    if (!offer) {
        console.error('❌ Offre non trouvée');
        return null;
    }

    console.log(`🔄 Simulation de paiement d'acompte: ${offer.acompte}€`);
    return recordPayment(email, offerId, offer.acompte, PAYMENT_TYPE.DEPOSIT);
}

/**
 * Simuler un paiement de solde (pour tests)
 * @param {string} email - Email de l'utilisateur
 * @param {string} offerId - ID de l'offre
 * @returns {Payment|null}
 */
function simulateBalancePayment(email, offerId) {
    // Vérifier que l'acompte a été payé
    if (!isDepositPaid(email, offerId)) {
        console.error('❌ L\'acompte doit être payé avant le solde');
        return null;
    }

    // Récupérer l'offre
    const offer = getOfferById(offerId);
    if (!offer) {
        console.error('❌ Offre non trouvée');
        return null;
    }

    console.log(`🔄 Simulation de paiement de solde: ${offer.solde}€`);
    return recordPayment(email, offerId, offer.solde, PAYMENT_TYPE.BALANCE);
}

/**
 * Obtenir un résumé du statut de paiement pour l'affichage
 * @param {string} email - Email de l'utilisateur
 * @returns {Object}
 */
function getPaymentSummary(email) {
    const user = getUserFromStorage(email);

    if (!user) {
        console.error('❌ Utilisateur non trouvé pour:', email);
        return null;
    }

    const status = user.paymentStatus || user.payment_status || PAYMENT_STATUS.REGISTERED;
    const payments = user.payments || [];

    // Chercher l'offre active - compatible avec différents formats
    const offerId = user.activeOfferId || user.active_offer_id || user.offre;
    const activeOffer = offerId ? getOfferById(offerId) : null;

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
        status: status,
        statusLabel: getStatusLabel(status),
        activeOffer: activeOffer,
        totalPaid: totalPaid,
        payments: payments,
        accessRights: checkAccessRights(email)
    };
}

/**
 * Obtenir le libellé du statut en français
 * @param {string} status - Statut de paiement
 * @returns {string}
 */
function getStatusLabel(status) {
    const labels = {
        [PAYMENT_STATUS.REGISTERED]: 'Compte créé - En attente de paiement',
        [PAYMENT_STATUS.DEPOSIT_PAID]: 'Acompte payé - Accompagnement en cours',
        [PAYMENT_STATUS.DELIVERY_PENDING]: 'Accompagnement terminé - En attente du solde',
        [PAYMENT_STATUS.FULLY_PAID]: 'Paiement complet - Accès total'
    };
    return labels[status] || 'Statut inconnu';
}

/**
 * Calculer le plan de paiement échelonné pour le solde selon l'offre
 * @param {string} offerId - ID de l'offre
 * @returns {Object}
 */
function calculateInstallmentPlan(offerId) {
    const offer = getOfferById(offerId);
    if (!offer || offer.solde === 0) return null;

    // Utiliser les échelons de paiement configurés dans l'offre
    const numberOfInstallments = offer.echelonsPaiement || 1;

    // Si l'offre ne permet qu'un paiement comptant (échelons = 1), retourner null
    if (numberOfInstallments === 1) return null;

    const monthlyAmount = Math.ceil(offer.solde / numberOfInstallments);
    const lastMonthAmount = offer.solde - (monthlyAmount * (numberOfInstallments - 1));

    const installments = [];
    for (let i = 1; i <= numberOfInstallments; i++) {
        installments.push({
            number: i,
            amount: i === numberOfInstallments ? lastMonthAmount : monthlyAmount,
            dueDate: `Mensualité ${i}`,
            status: 'pending'
        });
    }

    return {
        totalAmount: offer.solde,
        numberOfInstallments: numberOfInstallments,
        monthlyAmount: monthlyAmount,
        installments: installments
    };
}

/**
 * Initialiser le plan de paiement échelonné pour un utilisateur
 * @param {string} email - Email de l'utilisateur
 * @returns {boolean}
 */
function initializeInstallmentPlan(email) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.email === email);

    if (userIndex === -1) return false;

    const plan = calculateInstallmentPlan(users[userIndex].activeOfferId);
    if (!plan) return false;

    users[userIndex].installmentPlan = plan;
    users[userIndex].installmentPlan.startDate = new Date().toISOString();
    localStorage.setItem('users', JSON.stringify(users));

    console.log('✅ Plan de paiement échelonné initialisé:', plan);
    return true;
}

/**
 * Enregistrer un paiement de mensualité
 * @param {string} email - Email de l'utilisateur
 * @param {number} installmentNumber - Numéro de la mensualité
 * @returns {Payment|null}
 */
function recordInstallmentPayment(email, installmentNumber) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.email === email);

    if (userIndex === -1 || !users[userIndex].installmentPlan) {
        console.error('❌ Plan de paiement non trouvé');
        return null;
    }

    const plan = users[userIndex].installmentPlan;
    const installment = plan.installments.find(i => i.number === installmentNumber);

    if (!installment || installment.status === 'paid') {
        console.error('❌ Mensualité invalide ou déjà payée');
        return null;
    }

    // Créer le paiement
    const payment = new Payment(
        users[userIndex].email,
        users[userIndex].activeOfferId,
        installment.amount,
        `mensualite_${installmentNumber}`
    );

    // Enregistrer le paiement
    if (!users[userIndex].payments) {
        users[userIndex].payments = [];
    }
    users[userIndex].payments.push(payment);

    // Marquer la mensualité comme payée
    installment.status = 'paid';
    installment.paidDate = new Date().toISOString();

    // Vérifier si toutes les mensualités sont payées
    const allPaid = plan.installments.every(i => i.status === 'paid');
    if (allPaid) {
        users[userIndex].paymentStatus = PAYMENT_STATUS.FULLY_PAID;
        console.log('🎉 Toutes les mensualités payées - Accès total débloqué');
    }

    localStorage.setItem('users', JSON.stringify(users));
    console.log(`✅ Mensualité ${installmentNumber} payée:`, payment);

    return payment;
}

/**
 * Obtenir le plan de paiement échelonné d'un utilisateur
 * @param {string} email - Email de l'utilisateur
 * @returns {Object|null}
 */
function getInstallmentPlan(email) {
    const user = getUserFromStorage(email);
    return user && user.installmentPlan ? user.installmentPlan : null;
}

/**
 * Obtenir la prochaine mensualité à payer
 * @param {string} email - Email de l'utilisateur
 * @returns {Object|null}
 */
function getNextInstallment(email) {
    const plan = getInstallmentPlan(email);
    if (!plan) return null;

    return plan.installments.find(i => i.status === 'pending') || null;
}

/**
 * Obtenir le statut de livraison pour une prestation individuelle
 * @param {string} email - Email de l'utilisateur
 * @returns {string|null} - Statut de livraison ou null
 */
function getDeliveryStatus(email) {
    const user = getUserFromStorage(email);

    if (!user) return null;

    // Vérifier que c'est une prestation individuelle
    const productType = user.productType || user.product_type;
    if (productType !== 'prestation_individuelle') return null;

    const paymentStatus = user.paymentStatus || user.payment_status;

    // Mapper les statuts de paiement aux statuts de livraison
    if (paymentStatus === 'registered') return DELIVERY_STATUS.CONFIRMED;
    if (paymentStatus === 'deposit_paid') return DELIVERY_STATUS.IN_PROGRESS;
    if (paymentStatus === 'delivery_pending_payment') return DELIVERY_STATUS.READY;
    if (paymentStatus === 'fully_paid') return DELIVERY_STATUS.DELIVERED;

    return DELIVERY_STATUS.CONFIRMED; // Par défaut
}

/**
 * Obtenir les étapes de livraison pour les prestations individuelles
 * @param {string} productType - Type de produit
 * @returns {Array|null} - Liste des étapes ou null
 */
function getDeliverySteps(productType) {
    if (productType !== 'prestation_individuelle') return null;

    return [
        {
            id: 'confirmed',
            label: 'Commande confirmée',
            description: 'Acompte de 30% payé',
            icon: 'fa-check-circle'
        },
        {
            id: 'in_progress',
            label: 'Prestation en cours',
            description: 'Notre équipe travaille sur votre projet',
            icon: 'fa-spinner'
        },
        {
            id: 'ready',
            label: 'Livrable prêt',
            description: 'Votre prestation est terminée',
            icon: 'fa-box'
        },
        {
            id: 'delivered',
            label: 'Livré',
            description: 'Solde de 70% réglé',
            icon: 'fa-download'
        }
    ];
}

/**
 * Obtenir l'index de l'étape actuelle (pour progression)
 * @param {string} email - Email de l'utilisateur
 * @returns {number} - Index de l'étape actuelle (0-3)
 */
function getDeliveryStepIndex(email) {
    const status = getDeliveryStatus(email);
    if (!status) return 0;

    const steps = ['confirmed', 'in_progress', 'ready', 'delivered'];
    const index = steps.indexOf(status);
    return index !== -1 ? index : 0;
}

console.log('🟢 payment-system.js chargé avec succès');
console.log('💳 Système de paiement progressif actif');
console.log('💰 Système de paiement échelonné actif');
console.log('📊 Statuts disponibles:', Object.values(PAYMENT_STATUS));
console.log('🚚 Statuts de livraison disponibles:', Object.values(DELIVERY_STATUS));
