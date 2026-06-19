/**
 * FA GENESIS - AI Service
 * Genere des documents a partir de templates.
 * Supporte optionnellement une API IA externe (future).
 * Utilise var pour compatibilite maximale.
 */

var documentTemplates = require('../config/documentTemplates');
var fillTemplate = documentTemplates.fillTemplate;
var fetch = require('node-fetch');

// ============================================================
// CONFIGURATION IA (optionnelle)
// ============================================================

var AI_API_ENABLED = process.env.AI_API_ENABLED === 'true';
var AI_API_KEY = process.env.AI_API_KEY || null;

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
// GENERATION DE DOCUMENT
// ============================================================

/**
 * Generer un document a partir d'un template.
 * @param {string} templateType - cle du template (questionnaire, pre-analyse, etc.)
 * @param {Object} data - donnees pour remplir les placeholders
 * @returns {Object} { success, content, title, type, method }
 */
function generateDocument(templateType, data) {
    try {
        // Ajouter la date si pas fournie
        if (!data.date) {
            var now = new Date();
            data.date = now.toLocaleDateString('fr-FR', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        }

        // Mode template (defaut)
        var result = fillTemplate(templateType, data);

        if (!result.success) {
            return { success: false, error: result.error, method: 'template' };
        }

        return {
            success: true,
            content: result.content,
            title: result.title,
            description: result.description,
            type: result.type,
            method: 'template'
        };
    } catch (err) {
        return {
            success: false,
            error: 'Erreur generateDocument: ' + (err.message || err),
            method: 'template'
        };
    }
}

/**
 * Generer un lot de documents pour une etape de projet.
 * @param {Array} deliverableTypes - ex: ['questionnaire', 'pre-analyse']
 * @param {Object} data - donnees communes
 * @returns {Array} resultats de generation
 */
function generateBatch(deliverableTypes, data) {
    var results = [];
    for (var i = 0; i < deliverableTypes.length; i++) {
        var result = generateDocument(deliverableTypes[i], data);
        result.requested_type = deliverableTypes[i];
        results.push(result);
    }
    return results;
}

/**
 * Verifier si le service IA est disponible.
 * @returns {Object} { template_available, ai_api_available }
 */
function getServiceStatus() {
    return {
        template_available: true,
        ai_api_available: AI_API_ENABLED && AI_API_KEY !== null,
        ai_api_enabled: AI_API_ENABLED
    };
}

module.exports = {
    generateDocument: generateDocument,
    generateBatch: generateBatch,
    getServiceStatus: getServiceStatus,
    askJeremie: askJeremie,
    isJeremieAvailable: isJeremieAvailable
};
