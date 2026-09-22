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

module.exports = {
    askJeremie: askJeremie,
    isJeremieAvailable: isJeremieAvailable
};
