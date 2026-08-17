'use strict';

/**
 * PayoneerProvider — fournisseur de payout Payoneer.
 *
 * Couverture annoncée : 190+ pays / 70 devises.
 * API marketplace : https://developer.payoneer.com
 *
 * État d'intégration :
 *   - Onboarding prestataire : redirigé vers payoneer.com + stockage Payoneer email
 *   - Payouts automatiques via API : nécessite PAYONEER_PARTNER_ID + PAYONEER_API_KEY (env vars)
 *   - Tant que les credentials ne sont pas configurés, les payouts sont marqués
 *     payout_method='payoneer_manual' et traités manuellement par l'admin GENESIS.
 */

var PAYONEER_SIGNUP_URL = 'https://www.payoneer.com/accounts/signup/?provId=394760';

function isConfigured() {
    return !!(process.env.PAYONEER_PARTNER_ID && process.env.PAYONEER_API_KEY);
}

/**
 * Retourne le lien d'inscription Payoneer pour un prestataire.
 * Le prestataire crée/connecte son compte Payoneer, puis renseigne son email Payoneer dans GENESIS.
 */
function getSignupUrl() {
    return PAYONEER_SIGNUP_URL;
}

/**
 * Valide et enregistre les informations Payoneer d'un prestataire.
 * @param {{ payoneerEmail: string, payoneerAccountId?: string }} data
 * @returns {{ ok: boolean, payoutProvider: string, payoutStatus: string, payoneerEmail: string }}
 */
function setupPayoneerAccount(data) {
    if (!data.payoneerEmail || !data.payoneerEmail.includes('@')) {
        throw new Error('Email Payoneer invalide.');
    }
    return {
        ok:              true,
        payoutProvider:  'payoneer',
        payoutStatus:    'pending_verification',
        payoneerEmail:   data.payoneerEmail.trim().toLowerCase(),
        payoneerAccountId: data.payoneerAccountId || null
    };
}

/**
 * Déclenche un payout vers le compte Payoneer du prestataire.
 * Nécessite PAYONEER_PARTNER_ID et PAYONEER_API_KEY dans les variables d'environnement.
 * Sans ces credentials, retourne un payout à traitement manuel.
 *
 * @param {{ payoneerEmail: string, amountCents: number, currency: string, referenceId: string }} data
 */
async function sendPayout(data) {
    if (!isConfigured()) {
        return {
            ok:            true,
            method:        'payoneer_manual',
            status:        'pending',
            note:          'Credentials Payoneer API non configurés. Payout à traiter manuellement.',
            referenceId:   data.referenceId,
            payoneerEmail: data.payoneerEmail,
            amountCents:   data.amountCents,
            currency:      data.currency || 'EUR'
        };
    }

    // TODO: intégration API Payoneer (nécessite PAYONEER_PARTNER_ID + PAYONEER_API_KEY)
    // Endpoint: POST https://api.payoneer.com/v4/programs/{partner_id}/payouts
    throw new Error('Payoneer API non encore configurée. Contacter l\'administrateur GENESIS.');
}

module.exports = { getSignupUrl, setupPayoneerAccount, sendPayout, isConfigured };
