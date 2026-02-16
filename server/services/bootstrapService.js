/**
 * FA GENESIS - Bootstrap Service
 * Cree un projet + livrables Jour 1 apres paiement de l'acompte.
 * Utilise var pour compatibilite maximale.
 */

var fs = require('fs');
var path = require('path');
var aiService = require('./aiService');
var offerBlueprints = require('../config/offerBlueprints');

// Chemins vers les fichiers de donnees
var PROJECTS_FILE = path.join(__dirname, '..', 'data', 'projects.json');
var LIVRABLES_FILE = path.join(__dirname, '..', 'data', 'livrables.json');

// ============================================================
// HELPERS LOCAUX (lecture/ecriture JSON)
// ============================================================

function loadJSON(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            var data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('bootstrapService - Erreur lecture ' + filePath + ':', err.message);
    }
    return [];
}

function saveJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('bootstrapService - Erreur ecriture ' + filePath + ':', err.message);
    }
}

// ============================================================
// GENERATEUR D'ID
// ============================================================

function generateProjectId() {
    var now = new Date();
    var ts = now.getFullYear().toString() +
        ('0' + (now.getMonth() + 1)).slice(-2) +
        ('0' + now.getDate()).slice(-2) +
        ('0' + now.getHours()).slice(-2) +
        ('0' + now.getMinutes()).slice(-2) +
        ('0' + now.getSeconds()).slice(-2);
    var rand = Math.floor(Math.random() * 10000).toString();
    while (rand.length < 4) rand = '0' + rand;
    return 'PRJ-' + ts + '-' + rand;
}

function generateLivrableId() {
    return 'LIV-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
}

// ============================================================
// BOOTSTRAP PROJET
// ============================================================

/**
 * Cree un projet et les livrables du Jour 1 pour une commande.
 * @param {Object} order - la commande (depuis orders.json)
 * @param {Object} user - l'utilisateur (depuis users.json)
 * @returns {Object} { success, project, deliverables, errors }
 */
function bootstrapProject(order, user) {
    try {
        // Determiner l'offer_key
        var offerKey = order.activeOfferId || order.offre || null;
        if (!offerKey) {
            return { success: false, error: 'Pas d\'offre identifiee pour la commande ' + order.id };
        }

        // Verifier que le blueprint existe
        var blueprint = offerBlueprints.getOfferBlueprint(offerKey);
        if (!blueprint) {
            return { success: false, error: 'Pas de blueprint pour l\'offre: ' + offerKey };
        }

        // Verifier qu'un projet n'existe pas deja
        var projects = loadJSON(PROJECTS_FILE);
        for (var p = 0; p < projects.length; p++) {
            if (projects[p].order_id === order.id) {
                return { success: false, error: 'Un projet existe deja pour cette commande', project: projects[p] };
            }
        }

        // Creer le projet
        var now = new Date().toISOString();
        var project = {
            id: generateProjectId(),
            order_id: order.id,
            client_id: user.id || user.email,
            client_email: user.email || order.email,
            client_name: (user.firstName || '') + ' ' + (user.lastName || ''),
            offer_key: offerKey,
            offer_name: blueprint.name,
            category: blueprint.category,
            duration_days: blueprint.duration_days,
            status: 'active',
            current_day: 1,
            current_step: 1,
            timeline_progress: [],
            ai_context: {
                client_responses: null,
                session_notes: []
            },
            created_at: now,
            updated_at: now
        };

        // Initialiser la timeline progress
        for (var s = 0; s < blueprint.steps.length; s++) {
            var step = blueprint.steps[s];
            project.timeline_progress.push({
                step_order: step.order,
                step_name: step.step_name,
                day_number: step.day_number,
                status: step.order === 1 ? 'in_progress' : 'pending',
                completed_at: null
            });
        }

        // Sauvegarder le projet
        projects.push(project);
        saveJSON(PROJECTS_FILE, projects);

        // Generer les livrables du Jour 1
        var day1Steps = [];
        for (var i = 0; i < blueprint.steps.length; i++) {
            if (blueprint.steps[i].day_number === 1) {
                day1Steps.push(blueprint.steps[i]);
            }
        }

        var livrables = loadJSON(LIVRABLES_FILE);
        var newDeliverables = [];
        var errors = [];

        // Donnees pour les templates
        var templateData = {
            client_name: project.client_name.trim() || 'Client',
            client_email: project.client_email || '',
            offer_name: blueprint.name,
            offer_category: blueprint.category,
            duration: blueprint.duration_days + ' jours',
            duration_days: String(blueprint.duration_days),
            order_id: order.id,
            project_id: project.id,
            day_number: '1',
            date: new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }),
            client_responses: '[En attente des reponses du client]',
            session_notes: '[Seance non encore effectuee]',
            items_list: '',
            domain: '',
            partner_name: ''
        };

        for (var d = 0; d < day1Steps.length; d++) {
            var stepDef = day1Steps[d];
            for (var dl = 0; dl < stepDef.deliverables.length; dl++) {
                var delDef = stepDef.deliverables[dl];

                // Generer le contenu IA si applicable
                var content = null;
                if (delDef.is_ai_generated) {
                    templateData.domain = stepDef.domain || 'strategy';
                    var genResult = aiService.generateDocument(delDef.type, templateData);
                    if (genResult.success) {
                        content = genResult.content;
                    } else {
                        errors.push('Erreur generation ' + delDef.type + ': ' + genResult.error);
                    }
                }

                // Determiner le workflow_status initial
                var workflowStatus = 'PUBLISHED';
                if (delDef.is_ai_generated) {
                    workflowStatus = delDef.requires_admin_approval ? 'PENDING_ADMIN' : 'DRAFT_AI';
                }
                if (delDef.is_form) {
                    workflowStatus = 'PUBLISHED'; // Les formulaires sont visibles immediatement
                }

                var livrable = {
                    id: generateLivrableId(),
                    order_id: order.id,
                    project_id: project.id,
                    client_email: project.client_email,
                    name: delDef.name,
                    type: delDef.type,
                    day_number: stepDef.day_number,
                    step_order: stepDef.order,
                    offer_key: offerKey,
                    domain: stepDef.domain || 'strategy',
                    status: 'generated',
                    source: delDef.is_ai_generated ? 'ai' : 'admin',
                    download_url: null,
                    content_text: content,
                    visibility: delDef.visibility || 'CLIENT_ON_PUBLISH',
                    workflow_status: workflowStatus,
                    owner_role: delDef.is_ai_generated ? 'ai' : 'admin',
                    owner_partner_id: null,
                    requires_admin_approval: delDef.requires_admin_approval || false,
                    requires_partner_approval: false,
                    is_form: delDef.is_form || false,
                    is_ai_generated: delDef.is_ai_generated || false,
                    versions: [],
                    created_at: now,
                    updated_at: now
                };

                // Ajouter version initiale si contenu genere
                if (content) {
                    livrable.versions.push({
                        version_number: 1,
                        updated_by_role: 'ai',
                        updated_by_id: 'system',
                        content_text: content,
                        file_url: null,
                        change_note: 'Generation automatique depuis template',
                        created_at: now
                    });
                }

                livrables.push(livrable);
                newDeliverables.push(livrable);
            }
        }

        // Sauvegarder les livrables
        saveJSON(LIVRABLES_FILE, livrables);

        console.log('[Bootstrap] Projet ' + project.id + ' cree avec ' + newDeliverables.length + ' livrables Jour 1');

        return {
            success: true,
            project: project,
            deliverables: newDeliverables,
            errors: errors.length > 0 ? errors : null
        };
    } catch (err) {
        console.error('[Bootstrap] Erreur:', err);
        return {
            success: false,
            error: 'Erreur bootstrap: ' + (err.message || err)
        };
    }
}

module.exports = {
    bootstrapProject: bootstrapProject,
    generateProjectId: generateProjectId,
    generateLivrableId: generateLivrableId
};
