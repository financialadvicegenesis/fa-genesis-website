'use strict';

/**
 * MarketplacePaymentService — couche métier unique pour tous les paiements FA GENESIS.
 *
 * Cette couche est le seul point d'entrée pour la logique de paiement.
 * Elle ne dépend pas directement de Stripe : elle délègue à stripeProvider
 * (implémentation de PaymentProvider). Remplacer Stripe = changer le provider injecté.
 */

var fs     = require('fs');
var path   = require('path');
var crypto = require('crypto');

var stripeProvider = require('./stripe-connect-provider');

var PAYMENT_CONFIG_FILE  = path.join(__dirname, '..', 'data', 'payment-config.json');
var STRIPE_PAYMENTS_FILE = path.join(__dirname, '..', 'data', 'stripe-payments.json');

// ── Config ────────────────────────────────────────────────────────────────────

function loadConfig() {
    try { return JSON.parse(fs.readFileSync(PAYMENT_CONFIG_FILE, 'utf8')); }
    catch(e) {
        return {
            globalCommissionRate: 0.15,
            categoryCommissions:  {},
            payoutSchedule:       'daily',
            paymentsEnabled:      true,
            currency:             'eur'
        };
    }
}

function saveConfig(cfg) {
    fs.writeFileSync(PAYMENT_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

// ── Stripe Payments (historique local) ───────────────────────────────────────

function loadStripePayments() {
    try { return JSON.parse(fs.readFileSync(STRIPE_PAYMENTS_FILE, 'utf8')); } catch(e) { return []; }
}

function saveStripePayments(data) {
    fs.writeFileSync(STRIPE_PAYMENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Commission ────────────────────────────────────────────────────────────────

function getCommissionRate(partnerType) {
    var cfg = loadConfig();
    if (cfg.categoryCommissions && typeof cfg.categoryCommissions[partnerType] === 'number') {
        return cfg.categoryCommissions[partnerType];
    }
    return typeof cfg.globalCommissionRate === 'number' ? cfg.globalCommissionRate : 0.15;
}

// amountCents : total en centimes — retourne la répartition exacte (arrondie)
function calculateSplit(amountCents, partnerType) {
    var rate = getCommissionRate(partnerType);
    var commissionCents = Math.round(amountCents * rate);
    var partnerCents    = amountCents - commissionCents;
    return {
        totalCents:      amountCents,
        commissionCents: commissionCents,
        partnerCents:    partnerCents,
        commissionRate:  rate
    };
}

// ── Partner onboarding ────────────────────────────────────────────────────────

async function setupPartnerStripeAccount(partnerData) {
    var account = await stripeProvider.createConnectedAccount({
        email:              partnerData.email,
        country:            partnerData.country       || 'FR',
        entityType:         partnerData.entityType    || 'particulier',
        prenom:             partnerData.prenom,
        nom:                partnerData.nom,
        raisonSociale:      partnerData.raisonSociale,
        registrationNumber: partnerData.registrationNumber,
        representantPrenom: partnerData.representantPrenom,
        representantNom:    partnerData.representantNom,
        partnerId:          partnerData.partnerId
    });
    return account; // { id, ... }
}

async function getPartnerOnboardingLink(stripeAccountId, baseUrl) {
    var returnUrl  = (baseUrl || 'https://fagenesis.com') + '/app.html?stripe_return=1';
    var refreshUrl = (baseUrl || 'https://fagenesis.com') + '/app.html?stripe_refresh=1';
    var link = await stripeProvider.getAccountLink(stripeAccountId, returnUrl, refreshUrl);
    return link.url;
}

// Déduit le statusLabel du compte Stripe.
async function getPartnerStripeStatus(stripeAccountId) {
    var raw = await stripeProvider.getAccountStatus(stripeAccountId);
    var label;
    if (raw.chargesEnabled && raw.payoutsEnabled) {
        label = 'active';
    } else if (!raw.detailsSubmitted) {
        label = 'pending';
    } else if (raw.requirementsDue.length > 0) {
        label = 'requires_info';
    } else if (raw.disabledReason && raw.disabledReason.indexOf('rejected') !== -1) {
        label = 'rejected';
    } else {
        label = 'pending';
    }
    return Object.assign({ statusLabel: label }, raw);
}

// ── Client payment ────────────────────────────────────────────────────────────

async function createClientPaymentIntent(data) {
    var cfg = loadConfig();
    if (!cfg.paymentsEnabled) throw new Error('Les paiements sont temporairement désactivés.');

    var amountCents = Math.round((parseFloat(data.amountEuros) || 0) * 100);
    if (amountCents < 50) throw new Error('Montant minimum : 0,50 €');

    var split = calculateSplit(amountCents, data.partnerType || 'other');

    var intent = await stripeProvider.createPaymentIntent({
        amount:               amountCents,
        currency:             cfg.currency || 'eur',
        applicationFeeAmount: split.commissionCents,
        connectedAccountId:   data.stripeConnectedAccountId,
        customerId:           data.clientStripeCustomerId || null,
        description:          data.description || 'FA GENESIS — Prestation',
        receiptEmail:         data.clientEmail || null,
        metadata: {
            order_id:     data.orderId    || '',
            stage:        data.stage      || 'deposit',
            partner_id:   data.partnerId  || '',
            partner_type: data.partnerType || ''
        }
    });

    var record = {
        id:                    'STRP-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
        orderId:               data.orderId    || null,
        partnerId:             data.partnerId  || null,
        clientEmail:           data.clientEmail || null,
        amountCents:           amountCents,
        currency:              cfg.currency || 'eur',
        commissionRate:        split.commissionRate,
        commissionCents:       split.commissionCents,
        partnerCents:          split.partnerCents,
        stripePaymentIntentId: intent.id,
        stage:                 data.stage || 'deposit',
        status:                'pending',
        refundedCents:         0,
        createdAt:             new Date().toISOString(),
        succeededAt:           null
    };
    var payments = loadStripePayments();
    payments.push(record);
    saveStripePayments(payments);

    return {
        clientSecret:    intent.client_secret,
        paymentIntentId: intent.id,
        split:           split,
        recordId:        record.id
    };
}

// ── Webhook handler ───────────────────────────────────────────────────────────

function handleWebhookRaw(rawBody, signature, secret) {
    return stripeProvider.constructWebhookEvent(rawBody, signature, secret);
}

// Met à jour le statut d'un paiement local après succès webhook.
function markPaymentSucceeded(paymentIntentId) {
    var payments = loadStripePayments();
    var idx = payments.findIndex(function(p) { return p.stripePaymentIntentId === paymentIntentId; });
    if (idx !== -1) {
        payments[idx].status      = 'succeeded';
        payments[idx].succeededAt = new Date().toISOString();
        saveStripePayments(payments);
    }
    return idx !== -1;
}

function markPaymentFailed(paymentIntentId) {
    var payments = loadStripePayments();
    var idx = payments.findIndex(function(p) { return p.stripePaymentIntentId === paymentIntentId; });
    if (idx !== -1) {
        payments[idx].status = 'failed';
        saveStripePayments(payments);
    }
}

// ── Refunds ───────────────────────────────────────────────────────────────────

async function refundPayment(paymentIntentId, amountEuros, reason) {
    var amountCents = amountEuros ? Math.round(parseFloat(amountEuros) * 100) : undefined;
    var refund = await stripeProvider.createRefund({
        paymentIntentId: paymentIntentId,
        amount:          amountCents,
        reason:          reason || 'requested_by_customer'
    });

    var payments = loadStripePayments();
    var idx = payments.findIndex(function(p) { return p.stripePaymentIntentId === paymentIntentId; });
    if (idx !== -1) {
        payments[idx].refundedCents = (payments[idx].refundedCents || 0) + refund.amount;
        payments[idx].status = payments[idx].refundedCents >= payments[idx].amountCents
            ? 'refunded'
            : 'partially_refunded';
        saveStripePayments(payments);
    }
    return refund;
}

// ── Admin stats ───────────────────────────────────────────────────────────────

function getMarketplaceStats() {
    var payments = loadStripePayments();
    var succeeded  = payments.filter(function(p) { return p.status === 'succeeded'; });
    var refunded   = payments.filter(function(p) { return p.status === 'refunded' || p.status === 'partially_refunded'; });
    var totalGross = succeeded.reduce(function(s, p) { return s + (p.amountCents || 0); }, 0) / 100;
    var totalComm  = succeeded.reduce(function(s, p) { return s + (p.commissionCents || 0); }, 0) / 100;
    var totalPtnr  = succeeded.reduce(function(s, p) { return s + (p.partnerCents || 0); }, 0) / 100;
    return {
        totalGross:       Math.round(totalGross  * 100) / 100,
        totalCommission:  Math.round(totalComm   * 100) / 100,
        totalToPartners:  Math.round(totalPtnr   * 100) / 100,
        paymentsCount:    succeeded.length,
        refundsCount:     refunded.length,
        pendingCount:     payments.filter(function(p) { return p.status === 'pending'; }).length
    };
}

// ── Customer ──────────────────────────────────────────────────────────────────

async function ensureStripeCustomer(user) {
    if (user.stripeCustomerId) return user.stripeCustomerId;
    var customer = await stripeProvider.createCustomer({
        email:  user.email,
        prenom: user.prenom,
        nom:    user.nom,
        userId: user.id
    });
    return customer.id;
}

// ── Config CRUD ───────────────────────────────────────────────────────────────

function getConfig()         { return loadConfig(); }
function updateConfig(patch) {
    var cfg = loadConfig();
    Object.assign(cfg, patch);
    saveConfig(cfg);
    return cfg;
}

module.exports = {
    // Partner
    setupPartnerStripeAccount,
    getPartnerOnboardingLink,
    getPartnerStripeStatus,
    // Client payment
    createClientPaymentIntent,
    ensureStripeCustomer,
    // Webhooks
    handleWebhookRaw,
    markPaymentSucceeded,
    markPaymentFailed,
    // Refunds
    refundPayment,
    // Admin
    getMarketplaceStats,
    getConfig,
    updateConfig,
    getCommissionRate,
    calculateSplit,
    // Data access
    loadStripePayments,
    // Provider (accès direct si nécessaire — limité aux routes webhook)
    provider: stripeProvider
};
