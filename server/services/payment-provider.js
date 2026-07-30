'use strict';

/**
 * PaymentProvider — interface abstraite pour les systèmes de paiement.
 *
 * Toute la logique métier passe par MarketplacePaymentService.
 * StripeConnectProvider est l'implémentation actuelle.
 * Remplacer Stripe par un autre fournisseur = implémenter cette interface
 * et mettre à jour l'injection dans marketplace-payment-service.js.
 */
class PaymentProvider {
    async createConnectedAccount(data)               { throw new Error('Not implemented: createConnectedAccount'); }
    async getAccountLink(accountId, ret, refresh)    { throw new Error('Not implemented: getAccountLink'); }
    async getAccountStatus(accountId)                { throw new Error('Not implemented: getAccountStatus'); }
    async createCustomer(data)                       { throw new Error('Not implemented: createCustomer'); }
    async createPaymentIntent(data)                  { throw new Error('Not implemented: createPaymentIntent'); }
    async retrievePaymentIntent(id)                  { throw new Error('Not implemented: retrievePaymentIntent'); }
    async createRefund(data)                         { throw new Error('Not implemented: createRefund'); }
    async updatePayoutSchedule(accountId, schedule)  { throw new Error('Not implemented: updatePayoutSchedule'); }
    async getBalance()                               { throw new Error('Not implemented: getBalance'); }
    async listPaymentIntents(params)                 { throw new Error('Not implemented: listPaymentIntents'); }
    constructWebhookEvent(rawBody, sig, secret)      { throw new Error('Not implemented: constructWebhookEvent'); }
}

module.exports = PaymentProvider;
