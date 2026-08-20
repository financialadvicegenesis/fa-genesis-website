'use strict';

var fs   = require('fs');
var path = require('path');

var COUNTRY_TABLE_PATH = path.join(__dirname, '../data/payout_country_support.json');

function loadCountryTable() {
    try {
        return JSON.parse(fs.readFileSync(COUNTRY_TABLE_PATH, 'utf8'));
    } catch (e) {
        console.error('[PayoutRouting] Impossible de lire payout_country_support.json:', e.message);
        return { countries: {}, _provider_priority: ['stripe', 'payoneer'] };
    }
}

/**
 * Retourne le meilleur fournisseur de payout pour un pays donné.
 * La priorité des fournisseurs est définie dans payout_country_support.json.
 *
 * @param {string} countryCode - Code ISO 3166-1 alpha-2 (ex: 'FR', 'MA')
 * @returns {{ provider: string|null, available: boolean, currency: string|null, allProviders: string[] }}
 */
function getBestPayoutProvider(countryCode) {
    if (!countryCode) return { provider: null, available: false, currency: null, allProviders: [] };

    var table   = loadCountryTable();
    var code    = countryCode.toUpperCase();
    var country = table.countries[code];

    if (!country) {
        return { provider: null, available: false, currency: null, allProviders: [], countryName: null };
    }

    var priority  = table._provider_priority || ['stripe', 'wise'];
    var available = [];

    priority.forEach(function(p) {
        if (p === 'stripe'    && country.stripe_connect) available.push('stripe');
        if (p === 'wise'      && country.wise)           available.push('wise');
        if (p === 'airwallex' && country.airwallex)      available.push('airwallex');
        if (p === 'adyen'     && country.adyen)          available.push('adyen');
    });

    var best = available[0] || null;

    return {
        provider:     best,
        available:    best !== null,
        currency:     country.currency || null,
        countryName:  country.name || code,
        allProviders: available
    };
}

/**
 * Retourne toutes les infos d'un pays.
 */
function getCountryInfo(countryCode) {
    if (!countryCode) return null;
    var table = loadCountryTable();
    return table.countries[countryCode.toUpperCase()] || null;
}

/**
 * Met à jour la disponibilité d'un fournisseur pour un pays (admin).
 */
function updateCountryProvider(countryCode, provider, enabled) {
    var table = loadCountryTable();
    var code  = countryCode.toUpperCase();
    if (!table.countries[code]) return false;
    var fieldMap = { stripe: 'stripe_connect', wise: 'wise', airwallex: 'airwallex', adyen: 'adyen' };
    var field = fieldMap[provider];
    if (!field) return false;
    table.countries[code][field] = !!enabled;
    table._last_verified = new Date().toISOString().split('T')[0];
    fs.writeFileSync(COUNTRY_TABLE_PATH, JSON.stringify(table, null, 2), 'utf8');
    return true;
}

module.exports = { getBestPayoutProvider, getCountryInfo, updateCountryProvider, loadCountryTable };
