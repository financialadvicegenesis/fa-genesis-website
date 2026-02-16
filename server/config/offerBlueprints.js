/**
 * FA GENESIS - Offer Blueprints (Source de verite des timelines)
 * Definit STRICTEMENT la timeline de chaque offre et ses livrables.
 * Utilise var pour compatibilite maximale.
 */

// ============================================================
// HELPER : generer les steps pour une offre selon ses inclus
// ============================================================

// ---------- ETUDIANTS ----------

var OFFER_BLUEPRINTS = {

    // ===== ETUDIANT IDEA (2 jours) =====
    'etudiant-idea': {
        offer_key: 'etudiant-idea',
        category: 'ETUDIANTS',
        name: 'Etudiant IDEA',
        duration_days: 2,
        steps: [
            {
                order: 1, day_number: 1, step_name: 'Inscription et questionnaire',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'questionnaire', name: 'Questionnaire de projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: false, is_form: true, is_ai_generated: false },
                    { type: 'pre-analyse', name: 'Pre-analyse du projet', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 2, day_number: 1, step_name: 'Mini seance strategique (45 min)',
                actor: 'admin', domain: 'strategy',
                deliverables: [
                    { type: 'agenda', name: 'Agenda de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'synthese', name: 'Synthese de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 3, day_number: 2, step_name: 'Structuration et plan d\'action',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'structuration', name: 'Structuration claire du projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true },
                    { type: 'plan-action', name: 'Mini plan d\'action (7 jours)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            }
        ]
    },

    // ===== ETUDIANT STARTER (7 jours) =====
    'etudiant-starter': {
        offer_key: 'etudiant-starter',
        category: 'ETUDIANTS',
        name: 'Etudiant STARTER',
        duration_days: 7,
        steps: [
            {
                order: 1, day_number: 1, step_name: 'Inscription et questionnaire',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'questionnaire', name: 'Questionnaire de projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: false, is_form: true, is_ai_generated: false },
                    { type: 'pre-analyse', name: 'Pre-analyse du projet', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 2, day_number: 2, step_name: 'Seance strategique (1h30)',
                actor: 'admin', domain: 'strategy',
                deliverables: [
                    { type: 'agenda', name: 'Agenda de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'synthese', name: 'Synthese de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 3, day_number: 3, step_name: 'Structuration du projet',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'structuration', name: 'Structuration claire du projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 4, day_number: 4, step_name: 'Conseils visibilite',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'plan-diffusion', name: 'Conseils visibilite (sans tournage)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 5, day_number: 7, step_name: 'Plan d\'action',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'plan-action', name: 'Plan d\'action (14 jours)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            }
        ]
    },

    // ===== ETUDIANT LAUNCH (14 jours) =====
    'etudiant-launch': {
        offer_key: 'etudiant-launch',
        category: 'ETUDIANTS',
        name: 'Etudiant LAUNCH',
        duration_days: 14,
        steps: [
            {
                order: 1, day_number: 1, step_name: 'Inscription et questionnaire',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'questionnaire', name: 'Questionnaire de projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: false, is_form: true, is_ai_generated: false },
                    { type: 'pre-analyse', name: 'Pre-analyse du projet', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 2, day_number: 2, step_name: 'Seance strategique (1h30)',
                actor: 'admin', domain: 'strategy',
                deliverables: [
                    { type: 'agenda', name: 'Agenda de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'synthese', name: 'Synthese de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 3, day_number: 3, step_name: 'Structuration et storytelling',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'structuration', name: 'Structuration claire & storytelling simple', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 4, day_number: 5, step_name: 'Brief et mini tournage video',
                actor: 'partner', domain: 'video',
                deliverables: [
                    { type: 'brief-video', name: 'Brief tournage video (45 min)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'video', name: 'Video courte (1 min)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 5, day_number: 8, step_name: 'Diffusion media',
                actor: 'partner', domain: 'media',
                deliverables: [
                    { type: 'brief-media', name: 'Brief media (1 Post et/ou 1 Story)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'media_post', name: 'Publication media (1 Post/Story)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 6, day_number: 14, step_name: 'Plan de diffusion',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'plan-diffusion', name: 'Plan de diffusion (30 jours)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            }
        ]
    },

    // ===== ETUDIANT IMPACT (30 jours) =====
    'etudiant-impact': {
        offer_key: 'etudiant-impact',
        category: 'ETUDIANTS',
        name: 'Etudiant IMPACT',
        duration_days: 30,
        steps: [
            {
                order: 1, day_number: 1, step_name: 'Inscription et questionnaire',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'questionnaire', name: 'Questionnaire de projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: false, is_form: true, is_ai_generated: false },
                    { type: 'pre-analyse', name: 'Pre-analyse du projet', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 2, day_number: 2, step_name: 'Seance strategique (1h30)',
                actor: 'admin', domain: 'strategy',
                deliverables: [
                    { type: 'agenda', name: 'Agenda de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'synthese', name: 'Synthese de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 3, day_number: 3, step_name: 'Structuration du projet',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'structuration', name: 'Structuration claire du projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 4, day_number: 5, step_name: 'Shooting photo',
                actor: 'partner', domain: 'photo',
                deliverables: [
                    { type: 'brief-photo', name: 'Brief shooting photo', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'photo', name: 'Shooting photo (5 photos retouchees)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 5, day_number: 8, step_name: 'Tournage video',
                actor: 'partner', domain: 'video',
                deliverables: [
                    { type: 'brief-video', name: 'Brief tournage video (1h00)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'video', name: 'Video longue (2 min)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 6, day_number: 15, step_name: 'Diffusion media',
                actor: 'partner', domain: 'media',
                deliverables: [
                    { type: 'brief-media', name: 'Brief media (1 Post et/ou 1 Story)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'media_post', name: 'Publication media (1 Post/Story)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 7, day_number: 30, step_name: 'Plan de communication',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'plan-diffusion', name: 'Plan de communication (30 jours)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            }
        ]
    },

    // ---------- PARTICULIERS ----------

    // ===== PARTICULIER IDEA (2 jours) =====
    'particulier-idea': {
        offer_key: 'particulier-idea',
        category: 'PARTICULIERS',
        name: 'Particulier IDEA',
        duration_days: 2,
        steps: [
            {
                order: 1, day_number: 1, step_name: 'Inscription et questionnaire',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'questionnaire', name: 'Questionnaire de projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: false, is_form: true, is_ai_generated: false },
                    { type: 'pre-analyse', name: 'Pre-analyse du projet', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 2, day_number: 1, step_name: 'Seance strategique (1h30)',
                actor: 'admin', domain: 'strategy',
                deliverables: [
                    { type: 'agenda', name: 'Agenda de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'synthese', name: 'Synthese de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 3, day_number: 2, step_name: 'Structuration et plan d\'action',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'structuration', name: 'Structuration claire du projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true },
                    { type: 'plan-action', name: 'Plan d\'action (7 jours)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            }
        ]
    },

    // ===== PARTICULIER STARTER (7 jours) =====
    'particulier-starter': {
        offer_key: 'particulier-starter',
        category: 'PARTICULIERS',
        name: 'Particulier STARTER',
        duration_days: 7,
        steps: [
            {
                order: 1, day_number: 1, step_name: 'Inscription et questionnaire',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'questionnaire', name: 'Questionnaire de projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: false, is_form: true, is_ai_generated: false },
                    { type: 'pre-analyse', name: 'Pre-analyse du projet', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 2, day_number: 2, step_name: 'Seance strategique (1h30)',
                actor: 'admin', domain: 'strategy',
                deliverables: [
                    { type: 'agenda', name: 'Agenda de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'synthese', name: 'Synthese de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 3, day_number: 3, step_name: 'Structuration du projet',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'structuration', name: 'Structuration claire du projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 4, day_number: 4, step_name: 'Conseils visibilite',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'plan-diffusion', name: 'Conseils visibilite (sans tournage)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 5, day_number: 7, step_name: 'Plan d\'action',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'plan-action', name: 'Plan d\'action (14 jours)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            }
        ]
    },

    // ===== PARTICULIER LAUNCH (14 jours) =====
    'particulier-launch': {
        offer_key: 'particulier-launch',
        category: 'PARTICULIERS',
        name: 'Particulier LAUNCH',
        duration_days: 14,
        steps: [
            {
                order: 1, day_number: 1, step_name: 'Inscription et questionnaire',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'questionnaire', name: 'Questionnaire de projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: false, is_form: true, is_ai_generated: false },
                    { type: 'pre-analyse', name: 'Pre-analyse du projet', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 2, day_number: 2, step_name: 'Seance strategique (1h30)',
                actor: 'admin', domain: 'strategy',
                deliverables: [
                    { type: 'agenda', name: 'Agenda de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'synthese', name: 'Synthese de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 3, day_number: 3, step_name: 'Structuration et storytelling',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'structuration', name: 'Structuration claire & storytelling simple', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 4, day_number: 5, step_name: 'Brief et mini tournage video',
                actor: 'partner', domain: 'video',
                deliverables: [
                    { type: 'brief-video', name: 'Brief tournage video (45 min)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'video', name: 'Video courte (1 min)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 5, day_number: 8, step_name: 'Diffusion media',
                actor: 'partner', domain: 'media',
                deliverables: [
                    { type: 'brief-media', name: 'Brief media (2 Post et/ou 2 Story)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'media_post', name: 'Publication media (2 Post/Story)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 6, day_number: 14, step_name: 'Plan de diffusion',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'plan-diffusion', name: 'Plan de diffusion (30 jours)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            }
        ]
    },

    // ===== PARTICULIER IMPACT (30 jours) =====
    'particulier-impact': {
        offer_key: 'particulier-impact',
        category: 'PARTICULIERS',
        name: 'Particulier IMPACT',
        duration_days: 30,
        steps: [
            {
                order: 1, day_number: 1, step_name: 'Inscription et questionnaire',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'questionnaire', name: 'Questionnaire de projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: false, is_form: true, is_ai_generated: false },
                    { type: 'pre-analyse', name: 'Pre-analyse du projet', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 2, day_number: 2, step_name: 'Seance strategique (1h30)',
                actor: 'admin', domain: 'strategy',
                deliverables: [
                    { type: 'agenda', name: 'Agenda de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'synthese', name: 'Synthese de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 3, day_number: 3, step_name: 'Structuration du projet',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'structuration', name: 'Structuration claire du projet', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 4, day_number: 5, step_name: 'Shooting photo',
                actor: 'partner', domain: 'photo',
                deliverables: [
                    { type: 'brief-photo', name: 'Brief shooting photo', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'photo', name: 'Shooting photo (9 photos retouchees)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 5, day_number: 8, step_name: 'Tournage video',
                actor: 'partner', domain: 'video',
                deliverables: [
                    { type: 'brief-video', name: 'Brief tournage video (1h00)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'video', name: 'Video longue (2 min)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 6, day_number: 15, step_name: 'Diffusion media',
                actor: 'partner', domain: 'media',
                deliverables: [
                    { type: 'brief-media', name: 'Brief media (4 Post et/ou 4 Story)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'media_post', name: 'Publication media (4 Post/Story)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 7, day_number: 30, step_name: 'Plan de communication',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'plan-diffusion', name: 'Plan de communication (30 jours)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            }
        ]
    },

    // ---------- ENTREPRISES ----------

    // ===== ENTREPRISE START (7 jours) =====
    'entreprise-start': {
        offer_key: 'entreprise-start',
        category: 'ENTREPRISES',
        name: 'Entreprise START',
        duration_days: 7,
        steps: [
            {
                order: 1, day_number: 1, step_name: 'Inscription et questionnaire',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'questionnaire', name: 'Questionnaire de projet entreprise', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: false, is_form: true, is_ai_generated: false },
                    { type: 'pre-analyse', name: 'Pre-analyse entreprise', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 2, day_number: 2, step_name: 'Seance strategique (1h30)',
                actor: 'admin', domain: 'strategy',
                deliverables: [
                    { type: 'agenda', name: 'Agenda de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'synthese', name: 'Synthese de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 3, day_number: 3, step_name: 'Clarification positionnement et message',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'structuration', name: 'Clarification du positionnement', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true },
                    { type: 'structuration', name: 'Message central & discours clair', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 4, day_number: 5, step_name: 'Conseils visibilite',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'plan-diffusion', name: 'Conseils visibilite (sans tournage)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 5, day_number: 7, step_name: 'Mini plan d\'action',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'plan-action', name: 'Mini plan d\'action (30 jours)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            }
        ]
    },

    // ===== ENTREPRISE VISIBILITY (14 jours) =====
    'entreprise-visibility': {
        offer_key: 'entreprise-visibility',
        category: 'ENTREPRISES',
        name: 'Entreprise VISIBILITY',
        duration_days: 14,
        steps: [
            {
                order: 1, day_number: 1, step_name: 'Inscription et questionnaire',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'questionnaire', name: 'Questionnaire de projet entreprise', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: false, is_form: true, is_ai_generated: false },
                    { type: 'pre-analyse', name: 'Pre-analyse entreprise', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 2, day_number: 2, step_name: 'Seance strategique (1h30)',
                actor: 'admin', domain: 'strategy',
                deliverables: [
                    { type: 'agenda', name: 'Agenda de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'synthese', name: 'Synthese de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 3, day_number: 3, step_name: 'Structuration storytelling entreprise',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'structuration', name: 'Structuration du storytelling de l\'entreprise', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 4, day_number: 4, step_name: 'Shooting photo professionnel',
                actor: 'partner', domain: 'photo',
                deliverables: [
                    { type: 'brief-photo', name: 'Brief shooting photo professionnel', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'photo', name: 'Shooting photo (24 photos retouchees)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 5, day_number: 6, step_name: 'Tournage video',
                actor: 'partner', domain: 'video',
                deliverables: [
                    { type: 'brief-video', name: 'Brief tournage video (1h30)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'video', name: 'Video longue (2 min) + format reseaux sociaux', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 6, day_number: 9, step_name: 'Diffusion media',
                actor: 'partner', domain: 'media',
                deliverables: [
                    { type: 'brief-media', name: 'Brief media (6 Post et/ou 6 Story)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'media_post', name: 'Publication media (6 Post/Story)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 7, day_number: 14, step_name: 'Plan de diffusion',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'plan-diffusion', name: 'Plan de diffusion (30 jours)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            }
        ]
    },

    // ===== ENTREPRISE IMPACT (30 jours) =====
    'entreprise-impact': {
        offer_key: 'entreprise-impact',
        category: 'ENTREPRISES',
        name: 'Entreprise IMPACT',
        duration_days: 30,
        steps: [
            {
                order: 1, day_number: 1, step_name: 'Inscription et questionnaire',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'questionnaire', name: 'Questionnaire de projet entreprise', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: false, is_form: true, is_ai_generated: false },
                    { type: 'pre-analyse', name: 'Pre-analyse entreprise', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 2, day_number: 2, step_name: 'Seance strategique (1h30)',
                actor: 'admin', domain: 'strategy',
                deliverables: [
                    { type: 'agenda', name: 'Agenda de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'synthese', name: 'Synthese de seance', visibility: 'ADMIN_ONLY', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 3, day_number: 3, step_name: 'Structuration positionnement et discours',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'structuration', name: 'Structuration du positionnement & discours', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            },
            {
                order: 4, day_number: 5, step_name: 'Shooting photo professionnel',
                actor: 'partner', domain: 'photo',
                deliverables: [
                    { type: 'brief-photo', name: 'Brief shooting photo professionnel', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'photo', name: 'Shooting photo (40 photos retouchees)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 5, day_number: 8, step_name: 'Tournage video 1',
                actor: 'partner', domain: 'video',
                deliverables: [
                    { type: 'brief-video', name: 'Brief tournage video 1 (1h30)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'video', name: 'Video longue 1 (2 min) + direction narrative', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 6, day_number: 12, step_name: 'Tournage video 2',
                actor: 'partner', domain: 'video',
                deliverables: [
                    { type: 'brief-video', name: 'Brief tournage video 2 (1h30)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'video', name: 'Video longue 2 (2 min) + format reseaux sociaux', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 7, day_number: 16, step_name: 'Diffusion media',
                actor: 'partner', domain: 'media',
                deliverables: [
                    { type: 'brief-media', name: 'Brief media (9 Post et/ou 9 Story)', visibility: 'PARTNER_ONLY', requires_admin_approval: false, is_form: false, is_ai_generated: true },
                    { type: 'media_post', name: 'Publication media (9 Post/Story)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: false }
                ]
            },
            {
                order: 8, day_number: 30, step_name: 'Plan de communication',
                actor: 'ai', domain: 'strategy',
                deliverables: [
                    { type: 'plan-diffusion', name: 'Plan de communication (60 jours)', visibility: 'CLIENT_ON_PUBLISH', requires_admin_approval: true, is_form: false, is_ai_generated: true }
                ]
            }
        ]
    }
};

/**
 * Recuperer le blueprint d'une offre par sa cle
 * @param {string} offerKey - ID de l'offre (ex: 'etudiant-idea')
 * @returns {Object|null}
 */
function getOfferBlueprint(offerKey) {
    return OFFER_BLUEPRINTS[offerKey] || null;
}

/**
 * Recuperer tous les blueprints d'une categorie
 * @param {string} category - Categorie (ETUDIANTS, PARTICULIERS, ENTREPRISES)
 * @returns {Array}
 */
function getBlueprintsByCategory(category) {
    var results = [];
    for (var key in OFFER_BLUEPRINTS) {
        if (OFFER_BLUEPRINTS[key].category === category) {
            results.push(OFFER_BLUEPRINTS[key]);
        }
    }
    return results;
}

/**
 * Recuperer les cles de toutes les offres disponibles
 * @returns {Array}
 */
function getAllOfferKeys() {
    return Object.keys(OFFER_BLUEPRINTS);
}

module.exports = {
    OFFER_BLUEPRINTS: OFFER_BLUEPRINTS,
    getOfferBlueprint: getOfferBlueprint,
    getBlueprintsByCategory: getBlueprintsByCategory,
    getAllOfferKeys: getAllOfferKeys
};
