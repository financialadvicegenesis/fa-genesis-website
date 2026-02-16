/**
 * FA GENESIS - AI Service
 * Genere des documents a partir de templates.
 * Supporte optionnellement une API IA externe (future).
 * Utilise var pour compatibilite maximale.
 */

var documentTemplates = require('../config/documentTemplates');
var fillTemplate = documentTemplates.fillTemplate;

// ============================================================
// CONFIGURATION IA (optionnelle)
// ============================================================

var AI_API_ENABLED = process.env.AI_API_ENABLED === 'true';
var AI_API_KEY = process.env.AI_API_KEY || null;

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
    getServiceStatus: getServiceStatus
};
