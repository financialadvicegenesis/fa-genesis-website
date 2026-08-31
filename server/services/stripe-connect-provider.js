'use strict';

var PaymentProvider = require('./payment-provider');

// Initialisation paresseuse : évite un crash au démarrage si STRIPE_SECRET_KEY
// n'est pas encore configurée — l'erreur sera levée à l'appel.
var _stripe = null;
function getStripe() {
    if (!_stripe) {
        var key = process.env.STRIPE_SECRET_KEY;
        if (!key) throw new Error('STRIPE_SECRET_KEY non configurée dans les variables d\'environnement.');
        _stripe = require('stripe')(key, { apiVersion: '2024-06-20' });
    }
    return _stripe;
}

class StripeConnectProvider extends PaymentProvider {

    // Crée un compte Connect Express pour un prestataire.
    // Stripe France exige que toutes les données KYC soient collectées via l'outil
    // d'inscription hébergé (accountLinks). On crée donc un compte MINIMAL ici
    // (type, country, email, capabilities) sans pré-remplir individual/company —
    // Stripe collecte ces infos lors du flow d'onboarding.
    async createConnectedAccount(data) {
        var s = getStripe();
        var params = {
            type: 'express',
            country: (data.country || 'FR').toUpperCase(),
            email: data.email,
            capabilities: {
                card_payments: { requested: true },
                transfers:     { requested: true }
            },
            business_type: data.entityType === 'entreprise' ? 'company' : 'individual',
            metadata: {
                partner_id:   data.partnerId  || '',
                entity_type:  data.entityType || 'particulier',
                platform:     'fa-genesis'
            }
        };

        return await s.accounts.create(params);
    }

    // Renvoie l'URL d'onboarding Stripe Connect Express.
    async getAccountLink(accountId, returnUrl, refreshUrl) {
        return await getStripe().accountLinks.create({
            account:     accountId,
            refresh_url: refreshUrl,
            return_url:  returnUrl,
            type:        'account_onboarding'
        });
    }

    // Statut KYC du compte partenaire.
    async getAccountStatus(accountId) {
        var account = await getStripe().accounts.retrieve(accountId);
        return {
            chargesEnabled:      account.charges_enabled,
            payoutsEnabled:      account.payouts_enabled,
            detailsSubmitted:    account.details_submitted,
            requirementsDue:     (account.requirements && account.requirements.currently_due)       || [],
            requirementsPending: (account.requirements && account.requirements.pending_verification) || [],
            disabledReason:      (account.requirements && account.requirements.disabled_reason)      || null,
            email:               account.email || null,
            businessType:        account.business_type || null
        };
    }

    // Crée un Customer Stripe pour un client FA GENESIS.
    async createCustomer(data) {
        return await getStripe().customers.create({
            email:    data.email,
            name:     ((data.prenom || '') + ' ' + (data.nom || '')).trim() || data.email,
            metadata: { user_id: data.userId || '', platform: 'fa-genesis' }
        });
    }

    // Crée un PaymentIntent avec destination charge :
    //   - Le client paie FA GENESIS (platform)
    //   - Stripe prélève automatiquement application_fee_amount (commission)
    //   - Le reste est transféré au compte Connect du partenaire
    async createPaymentIntent(data) {
        var s = getStripe();
        var params = {
            amount:                  data.amount,               // centimes
            currency:                data.currency || 'eur',
            application_fee_amount:  data.applicationFeeAmount, // commission FA GENESIS (centimes)
            transfer_data:           { destination: data.connectedAccountId },
            metadata:                data.metadata || {},
            automatic_payment_methods: { enabled: true }
        };
        if (data.customerId)   params.customer     = data.customerId;
        if (data.description)  params.description  = data.description;
        if (data.receiptEmail) params.receipt_email = data.receiptEmail;
        return await s.paymentIntents.create(params);
    }

    async retrievePaymentIntent(id) {
        return await getStripe().paymentIntents.retrieve(id);
    }

    async createRefund(data) {
        var params = { payment_intent: data.paymentIntentId };
        if (data.amount) params.amount = data.amount;
        if (data.reason) params.reason = data.reason; // 'duplicate'|'fraudulent'|'requested_by_customer'
        return await getStripe().refunds.create(params);
    }

    async updatePayoutSchedule(accountId, schedule) {
        var sched = { interval: schedule.interval }; // 'daily'|'weekly'|'monthly'|'manual'
        if (schedule.interval === 'weekly'  && schedule.weeklyAnchor)  sched.weekly_anchor  = schedule.weeklyAnchor;
        if (schedule.interval === 'monthly' && schedule.monthlyAnchor) sched.monthly_anchor = schedule.monthlyAnchor;
        return await getStripe().accounts.update(accountId, {
            settings: { payouts: { schedule: sched } }
        });
    }

    // Force le schedule à 'manual' sur un compte Connect — les fonds restent dans le
    // solde Stripe du prestataire jusqu'à ce que FA GENESIS déclenche explicitement triggerConnectPayout.
    async setManualPayouts(accountId) {
        return await getStripe().accounts.update(accountId, {
            settings: { payouts: { schedule: { interval: 'manual' } } }
        });
    }

    // Déclenche le virement Stripe balance → compte bancaire du prestataire.
    // À appeler uniquement après confirmation de livraison par le client (escrow réel).
    async triggerConnectPayout(accountId, amountCents, currency, description) {
        return await getStripe().payouts.create(
            {
                amount:      amountCents,
                currency:    currency || 'eur',
                description: description || 'Versement FA GENESIS SAFE™',
                metadata:    { platform: 'fa-genesis' }
            },
            { stripeAccount: accountId }
        );
    }

    async getBalance() {
        return await getStripe().balance.retrieve();
    }

    async listPaymentIntents(params) {
        return await getStripe().paymentIntents.list(params || { limit: 100 });
    }

    // Crée un PaymentIntent direct (sans Connect) pour le panier FA GENESIS.
    async createDirectPaymentIntent(data) {
        var s = getStripe();
        var amountCents = Math.round(parseFloat(data.amountEuros) * 100);
        var params = {
            amount: amountCents,
            currency: data.currency || 'eur',
            metadata: data.metadata || {},
            automatic_payment_methods: { enabled: true }
        };
        // GENESIS SAFE™ : capture différée — la carte est autorisée mais l'argent ne
        // quitte pas le client tant que le partenaire n'a pas déclaré la prestation terminée.
        if (data.captureManual) params.capture_method = 'manual';
        if (data.description)  params.description   = data.description;
        if (data.receiptEmail) params.receipt_email  = data.receiptEmail;
        return await s.paymentIntents.create(params);
    }

    // Capture un PaymentIntent en mode manuel : l'argent quitte la carte du client
    // et atterrit sur le compte Stripe GENESIS (Financialadvicegenesis@gmail.com).
    async capturePaymentIntent(piId) {
        return await getStripe().paymentIntents.capture(piId);
    }

    // Transfère des fonds depuis le compte Stripe de la plateforme vers un compte Connect.
    // À utiliser pour les paiements directs (createDirectPaymentIntent) : les fonds sont dans
    // le compte FA GENESIS et doivent être poussés vers le compte Connect du partenaire.
    async createTransfer(amountCents, currency, destinationAccountId, metadata) {
        return await getStripe().transfers.create({
            amount:      amountCents,
            currency:    currency || 'eur',
            destination: destinationAccountId,
            metadata:    metadata || {}
        });
    }

    // Vérifie la signature webhook Stripe et retourne l'événement.
    constructWebhookEvent(rawBody, signature, secret) {
        return getStripe().webhooks.constructEvent(rawBody, signature, secret);
    }
}

module.exports = new StripeConnectProvider();
