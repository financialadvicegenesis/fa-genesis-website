'use strict';

/**
 * PayoneerProvider — intégration API Mass Payouts Payoneer.
 *
 * Variables d'environnement requises :
 *   PAYONEER_PROGRAM_ID   — program_id fourni par Payoneer (ex: "100xxxxxx")
 *   PAYONEER_CLIENT_ID    — client_id OAuth Payoneer
 *   PAYONEER_SECRET       — client_secret OAuth Payoneer
 *
 * Environnements :
 *   sandbox    : api.sandbox.payoneer.com  (tests)
 *   production : api.payoneer.com          (réel)
 */

var https = require('https');

var SANDBOX_BASE    = 'https://api.sandbox.payoneer.com';
var PRODUCTION_BASE = 'https://api.payoneer.com';
var REDIRECT_URL    = 'https://fagenesis.com/app.html?payoneer_return=1';

function _baseUrl() {
    return process.env.PAYONEER_ENV === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
}

function _programId() {
    return process.env.PAYONEER_PROGRAM_ID || '';
}

function isConfigured() {
    return !!(process.env.PAYONEER_PROGRAM_ID && process.env.PAYONEER_CLIENT_ID && process.env.PAYONEER_SECRET);
}

// ── OAuth2 : obtenir un Bearer token ──────────────────────────────────────────

var _tokenCache = null;
var _tokenExpiry = 0;

async function _getBearerToken() {
    if (_tokenCache && Date.now() < _tokenExpiry) return _tokenCache;

    var clientId = process.env.PAYONEER_CLIENT_ID;
    var secret   = process.env.PAYONEER_SECRET;
    var base64   = Buffer.from(clientId + ':' + secret).toString('base64');
    var base     = _baseUrl();

    var body = 'grant_type=client_credentials&scope=read%20write';
    var result = await _httpRequest({
        method:  'POST',
        url:     base + '/v2/oauth2/token',
        headers: {
            'Authorization': 'Basic ' + base64,
            'Content-Type':  'application/x-www-form-urlencoded'
        },
        body: body
    });

    if (!result.access_token) throw new Error('Payoneer OAuth failed: ' + JSON.stringify(result));
    _tokenCache  = result.access_token;
    _tokenExpiry = Date.now() + ((result.expires_in || 3600) - 60) * 1000;
    return _tokenCache;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function _httpRequest(opts) {
    return new Promise(function(resolve, reject) {
        var url  = new URL(opts.url);
        var data = opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : null;
        var reqOpts = {
            hostname: url.hostname,
            path:     url.pathname + url.search,
            method:   opts.method || 'GET',
            headers:  opts.headers || {}
        };
        if (data) {
            reqOpts.headers['Content-Length'] = Buffer.byteLength(data);
        }
        var req = https.request(reqOpts, function(res) {
            var chunks = [];
            res.on('data', function(c) { chunks.push(c); });
            res.on('end', function() {
                try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
                catch(e) { resolve({}); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

// ── Créer un lien d'inscription bénéficiaire ─────────────────────────────────

/**
 * Génère un lien d'inscription Payoneer personnalisé pour un prestataire.
 * Les données du prestataire sont pré-remplies dans le formulaire Payoneer.
 *
 * @param {{ id: string, email: string, prenom: string, nom: string, country: string }} partner
 * @returns {{ ok: boolean, url: string }}
 */
async function generateRegistrationLink(partner) {
    if (!isConfigured()) {
        return { ok: false, error: 'Payoneer non configuré — credentials manquants.', fallback: true };
    }

    try {
        var token = await _getBearerToken();
        var programId = _programId();

        var requestBody = {
            payee_id:     partner.email,
            redirect_url: REDIRECT_URL,
            payee: {
                contact: {
                    first_name: partner.prenom || '',
                    last_name:  partner.nom    || '',
                    email:      partner.email  || ''
                },
                address: {
                    country: (partner.country || '').toUpperCase()
                }
            }
        };

        var result = await _httpRequest({
            method: 'POST',
            url:    _baseUrl() + '/v4/programs/' + programId + '/payees/registration-link',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type':  'application/json',
                'Accept':        'application/json'
            },
            body: requestBody
        });

        if (result.registration_link || result.url) {
            return { ok: true, url: result.registration_link || result.url };
        }
        return { ok: false, error: JSON.stringify(result) };

    } catch(e) {
        return { ok: false, error: e.message };
    }
}

// ── Statut d'un bénéficiaire ──────────────────────────────────────────────────

/**
 * Vérifie si le compte Payoneer du prestataire est actif (approuvé).
 * @param {string} payeeEmail — l'email utilisé comme payee_id
 */
async function getPayeeStatus(payeeEmail) {
    if (!isConfigured()) return { ok: false, status: 'unconfigured' };

    try {
        var token = await _getBearerToken();
        var programId = _programId();

        var result = await _httpRequest({
            method: 'GET',
            url:    _baseUrl() + '/v4/programs/' + programId + '/payees/' + encodeURIComponent(payeeEmail) + '/status',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Accept':        'application/json'
            }
        });

        return { ok: true, status: result.status || 'unknown', raw: result };
    } catch(e) {
        return { ok: false, status: 'error', error: e.message };
    }
}

// ── Déclencher un payout ──────────────────────────────────────────────────────

/**
 * Envoie un paiement vers le compte Payoneer d'un prestataire.
 * @param {{ payeeEmail: string, amountCents: number, currency: string, referenceId: string, description: string }} data
 */
/**
 * Envoie un ou plusieurs payouts via l'API Mass Payouts Payoneer.
 * Endpoint : POST /v4/programs/{program_id}/masspayouts
 *
 * @param {Array<{ payeeId: string, amountCents: number, currency: string, referenceId: string, description: string }>} payments
 *   payeeId = identifiant Payoneer du bénéficiaire (stocké lors de l'onboarding)
 */
async function sendPayout(payments) {
    // Normaliser : accepte un objet unique ou un tableau
    var list = Array.isArray(payments) ? payments : [payments];

    if (!isConfigured()) {
        return {
            ok:     true,
            method: 'payoneer_manual',
            status: 'pending',
            note:   'Credentials Payoneer non configurés — payout à traiter manuellement.',
            items:  list
        };
    }

    try {
        var token     = await _getBearerToken();
        var programId = _programId();

        var paymentItems = list.map(function(p) {
            return {
                client_reference_id: p.referenceId || ('genesis-' + Date.now() + '-' + Math.random().toString(36).slice(2)),
                payee_id:            p.payeeId,
                description:         p.description || 'Versement GENESIS',
                currency:            p.currency || 'EUR',
                amount:              (p.amountCents / 100).toFixed(2)
            };
        });

        var result = await _httpRequest({
            method: 'POST',
            url:    _baseUrl() + '/v4/programs/' + programId + '/masspayouts',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type':  'application/json',
                'Accept':        'application/json'
            },
            body: { Payments: paymentItems }
        });

        if (result.payout_id || result.status || result.Payments) {
            return {
                ok:       true,
                method:   'payoneer_api',
                status:   result.status || 'submitted',
                payoutId: result.payout_id,
                raw:      result
            };
        }
        return { ok: false, error: JSON.stringify(result) };

    } catch(e) {
        return { ok: false, error: e.message };
    }
}

module.exports = {
    isConfigured,
    generateRegistrationLink,
    getPayeeStatus,
    sendPayout
};
