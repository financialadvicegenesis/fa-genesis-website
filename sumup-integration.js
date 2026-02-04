// Integration SumUp pour FA GENESIS
// Documentation: https://developer.sumup.com/docs/online-payments/

console.log('Chargement de sumup-integration.js');

/**
 * Configuration SumUp
 * IMPORTANT: En production, les cles API doivent etre stockees cote serveur
 */
const SUMUP_CONFIG = {
    // Mode: 'sandbox' pour les tests, 'production' pour le live
    mode: 'sandbox',

    // URLs de callback
    returnUrl: window.location.origin + '/fa-genesis-landing/payment-success.html',
    cancelUrl: window.location.origin + '/fa-genesis-landing/payment-cancel.html',

    // URL de l'API backend (a configurer)
    apiBaseUrl: '/api/sumup',

    // Devise
    currency: 'EUR',

    // Pays
    country: 'FR'
};

/**
 * Gestionnaire SumUp
 * Note: L'integration complete necessite un backend pour:
 * - Stocker les cles API de maniere securisee
 * - Creer les checkouts
 * - Recevoir les webhooks
 */
const SumUpManager = {
    /**
     * Creer un checkout SumUp
     * Cette methode doit appeler votre backend qui creera le checkout
     *
     * @param {Object} order - La commande
     * @param {string} paymentType - 'deposit' ou 'balance'
     * @returns {Promise<Object>} - Checkout response
     */
    async createCheckout(order, paymentType = 'deposit') {
        const amount = paymentType === 'deposit'
            ? order.offer.acompte
            : order.offer.solde;

        const checkoutData = {
            checkout_reference: order.id,
            amount: amount,
            currency: SUMUP_CONFIG.currency,
            pay_to_email: 'votre-email-sumup@fagenesis.com', // A configurer
            description: `FA GENESIS - ${order.offer.nom} (${paymentType === 'deposit' ? 'Acompte' : 'Solde'})`,
            return_url: SUMUP_CONFIG.returnUrl + '?order=' + order.id,
            redirect_url: SUMUP_CONFIG.cancelUrl + '?order=' + order.id,
            merchant_code: '', // A configurer depuis le backend
            personal_details: {
                email: order.customerInfo.email,
                first_name: order.customerInfo.firstName,
                last_name: order.customerInfo.lastName
            }
        };

        console.log('Donnees checkout SumUp:', checkoutData);

        // En production, appeler votre backend
        // const response = await fetch(SUMUP_CONFIG.apiBaseUrl + '/create-checkout', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(checkoutData)
        // });
        // return response.json();

        // Pour le developpement, retourner une simulation
        return this.simulateCheckoutResponse(order, amount);
    },

    /**
     * Simuler une reponse de checkout (pour developpement)
     */
    simulateCheckoutResponse(order, amount) {
        return {
            id: 'chk_' + Date.now(),
            checkout_reference: order.id,
            amount: amount,
            currency: SUMUP_CONFIG.currency,
            status: 'PENDING',
            // En production, SumUp fournirait cette URL
            checkout_url: 'payment-success.html?order=' + order.id + '&simulated=true',
            valid_until: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        };
    },

    /**
     * Verifier le statut d'un paiement
     * Doit appeler votre backend pour verifier avec SumUp
     */
    async checkPaymentStatus(checkoutId) {
        // En production:
        // const response = await fetch(SUMUP_CONFIG.apiBaseUrl + '/check-status/' + checkoutId);
        // return response.json();

        // Simulation
        return {
            id: checkoutId,
            status: 'PAID',
            transaction_code: 'TXN_' + Date.now(),
            transaction_id: 'txn_' + Math.random().toString(36).substr(2, 9)
        };
    },

    /**
     * Rediriger vers la page de paiement SumUp
     */
    redirectToCheckout(checkoutUrl) {
        window.location.href = checkoutUrl;
    }
};

/**
 * Processus de paiement complet
 */
const PaymentFlow = {
    /**
     * Initier le paiement d'un acompte
     */
    async initiateDepositPayment(order) {
        try {
            console.log('Initiation du paiement acompte pour:', order.id);

            // Creer le checkout
            const checkout = await SumUpManager.createCheckout(order, 'deposit');

            if (!checkout || !checkout.checkout_url) {
                throw new Error('Erreur lors de la creation du checkout');
            }

            // Sauvegarder les infos de checkout
            sessionStorage.setItem('currentCheckout', JSON.stringify({
                checkoutId: checkout.id,
                orderId: order.id,
                type: 'deposit',
                amount: checkout.amount
            }));

            // Rediriger vers SumUp
            SumUpManager.redirectToCheckout(checkout.checkout_url);

            return checkout;

        } catch (error) {
            console.error('Erreur paiement:', error);
            throw error;
        }
    },

    /**
     * Initier le paiement du solde
     */
    async initiateBalancePayment(order) {
        try {
            console.log('Initiation du paiement solde pour:', order.id);

            // Verifier que l'acompte a ete paye
            const depositPayment = order.payments?.find(p => p.type === 'deposit');
            if (!depositPayment) {
                throw new Error('L\'acompte doit etre paye avant le solde');
            }

            // Creer le checkout
            const checkout = await SumUpManager.createCheckout(order, 'balance');

            if (!checkout || !checkout.checkout_url) {
                throw new Error('Erreur lors de la creation du checkout');
            }

            // Sauvegarder les infos de checkout
            sessionStorage.setItem('currentCheckout', JSON.stringify({
                checkoutId: checkout.id,
                orderId: order.id,
                type: 'balance',
                amount: checkout.amount
            }));

            // Rediriger vers SumUp
            SumUpManager.redirectToCheckout(checkout.checkout_url);

            return checkout;

        } catch (error) {
            console.error('Erreur paiement:', error);
            throw error;
        }
    },

    /**
     * Traiter le retour de SumUp (page success)
     */
    async handlePaymentReturn() {
        const checkoutData = sessionStorage.getItem('currentCheckout');
        if (!checkoutData) {
            console.log('Pas de checkout en cours');
            return null;
        }

        const checkout = JSON.parse(checkoutData);

        try {
            // Verifier le statut du paiement
            const status = await SumUpManager.checkPaymentStatus(checkout.checkoutId);

            if (status.status === 'PAID') {
                // Enregistrer le paiement
                OrdersManager.addPayment(checkout.orderId, {
                    amount: checkout.amount,
                    type: checkout.type,
                    method: 'sumup',
                    transactionId: status.transaction_id,
                    status: 'completed'
                });

                console.log('Paiement enregistre avec succes');
            }

            // Nettoyer la session
            sessionStorage.removeItem('currentCheckout');

            return status;

        } catch (error) {
            console.error('Erreur verification paiement:', error);
            throw error;
        }
    }
};

console.log('sumup-integration.js charge');
console.log('Mode SumUp:', SUMUP_CONFIG.mode);
