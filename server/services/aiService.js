/**
 * FA GENESIS - AI Service
 * Jérémie, le conseiller IA conversationnel (Claude API).
 * Utilise var pour compatibilite maximale.
 */

var fetch = require('node-fetch');

// ============================================================
// JEREMIE - CONSEILLER IA CONVERSATIONNEL (Claude API)
// ============================================================

var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || null;
var ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
var ANTHROPIC_MODEL = 'claude-sonnet-4-6';

/**
 * Verifier si Jeremie est disponible (cle API fournie).
 * @returns {boolean}
 */
function isJeremieAvailable() {
    return ANTHROPIC_API_KEY !== null;
}

/**
 * Demander une reponse a Jeremie via l'API Claude.
 * @param {string} systemPrompt - contexte plateforme + instructions (construit par server.js)
 * @param {Array} history - historique [{role:'user'|'assistant', content:string}, ...]
 * @param {string} userMessage - nouveau message de l'utilisateur
 * @returns {Promise<Object>} { success, reply, error }
 */
function askJeremie(systemPrompt, history, userMessage) {
    if (!ANTHROPIC_API_KEY) {
        return Promise.resolve({ success: false, error: 'Jeremie n\'est pas encore configure (cle API manquante).' });
    }
    var messages = (history || []).map(function(m) {
        return { role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') };
    });
    messages.push({ role: 'user', content: String(userMessage || '') });

    return fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages
        })
    }).then(function(res) {
        return res.json().then(function(data) {
            if (!res.ok) {
                return { success: false, error: (data && data.error && data.error.message) || ('Erreur API Claude (' + res.status + ')') };
            }
            var reply = (data && data.content && data.content[0] && data.content[0].text) || '';
            return { success: true, reply: reply };
        });
    }).catch(function(err) {
        return { success: false, error: 'Erreur appel API Claude: ' + (err.message || err) };
    });
}

// ============================================================
// RÉSUMÉ D'UNE DEMANDE DE DEVIS (Jérémie, transfert automatique — voir server.js : DEVIS NON
// PRIS EN CHARGE). SDK officiel Anthropic : délai court, une seule nouvelle tentative, effort
// « low » (un résumé de quelques phrases), repli automatique sur un autre modèle si le modèle
// principal refuse la demande (fallbacks: 'default').
// ============================================================
var Anthropic = (function() {
    try { var sdk = require('@anthropic-ai/sdk'); return sdk.Anthropic || sdk.default || sdk; }
    catch (e) { return null; }
})();
var QUOTE_SUMMARY_MODEL = 'claude-opus-5-5';
var _anthropicClient = null;
function _getAnthropicClient() {
    if (!_anthropicClient && Anthropic && ANTHROPIC_API_KEY) {
        _anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 30000, maxRetries: 1 });
    }
    return _anthropicClient;
}

/**
 * @param {string} systemPrompt - consignes (langue, longueur, données à ne jamais reprendre)
 * @param {string} requestText - la demande du client, présentée comme une donnée à résumer
 * @returns {Promise<Object>} { success, summary } ou { success:false, unavailable, retryable, error }
 */
function summarizeQuoteRequest(systemPrompt, requestText) {
    var client = _getAnthropicClient();
    if (!client) return Promise.resolve({ success: false, unavailable: true, error: 'Clé API Claude absente.' });
    return client.beta.messages.create({
        model: QUOTE_SUMMARY_MODEL,
        max_tokens: 4000,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: systemPrompt,
        messages: [{ role: 'user', content: String(requestText || '') }]
    }).then(function(response) {
        if (response.stop_reason === 'refusal') return { success: false, retryable: false, error: 'refusal' };
        var text = (response.content || []).filter(function(b) { return b.type === 'text'; })
            .map(function(b) { return b.text; }).join('\n').trim();
        if (!text) return { success: false, retryable: true, error: 'réponse vide (' + response.stop_reason + ')' };
        return { success: true, summary: text, model: response.model };
    }).catch(function(err) {
        // Requête invalide, clé refusée, accès interdit : inutile de réessayer. Limite de débit,
        // erreur serveur, coupure réseau ou délai dépassé : nouvelle tentative plus tard.
        var permanent = Anthropic && (err instanceof Anthropic.BadRequestError
            || err instanceof Anthropic.AuthenticationError
            || err instanceof Anthropic.PermissionDeniedError
            || err instanceof Anthropic.NotFoundError);
        var label = (Anthropic && err instanceof Anthropic.APIError && err.status) ? 'API ' + err.status + ' : ' : '';
        return { success: false, retryable: !permanent, error: label + ((err && err.message) || String(err)) };
    });
}

module.exports = {
    askJeremie: askJeremie,
    isJeremieAvailable: isJeremieAvailable,
    summarizeQuoteRequest: summarizeQuoteRequest
};
