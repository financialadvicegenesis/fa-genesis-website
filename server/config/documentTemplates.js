/**
 * FA GENESIS - Document Templates
 * Templates avec placeholders pour generation de documents.
 * Utilise var pour compatibilite maximale.
 *
 * Placeholders disponibles :
 *   {{client_name}}, {{client_email}}, {{offer_name}}, {{offer_category}},
 *   {{date}}, {{day_number}}, {{duration}}, {{duration_days}},
 *   {{order_id}}, {{project_id}}, {{partner_name}},
 *   {{session_notes}}, {{client_responses}}, {{domain}},
 *   {{items_list}} (pour listes dynamiques)
 */

// ============================================================
// TEMPLATES
// ============================================================

var DOCUMENT_TEMPLATES = {

    // ----- 1. QUESTIONNAIRE -----
    'questionnaire': {
        type: 'questionnaire',
        title: 'Questionnaire de projet - {{offer_name}}',
        description: 'Questionnaire initial pour le client {{client_name}}',
        content: [
            '=== QUESTIONNAIRE DE PROJET ===',
            'Client : {{client_name}}',
            'Email : {{client_email}}',
            'Offre : {{offer_name}} ({{offer_category}})',
            'Date : {{date}}',
            '',
            '--- SECTION 1 : VOTRE PROJET ---',
            '',
            '1. Decrivez votre projet en quelques phrases :',
            '   [Reponse du client]',
            '',
            '2. Quel est votre objectif principal ?',
            '   [ ] Lancer une activite / un projet',
            '   [ ] Developper ma visibilite',
            '   [ ] Structurer mon projet existant',
            '   [ ] Creer du contenu (photo, video, media)',
            '   [ ] Autre : ___',
            '',
            '3. Quel est votre public cible ?',
            '   [Reponse du client]',
            '',
            '--- SECTION 2 : VOTRE SITUATION ACTUELLE ---',
            '',
            '4. Avez-vous deja une presence en ligne ?',
            '   [ ] Oui - Site web : ___',
            '   [ ] Oui - Reseaux sociaux : ___',
            '   [ ] Non, pas encore',
            '',
            '5. Quel est votre budget marketing mensuel actuel ?',
            '   [ ] Aucun',
            '   [ ] Moins de 100 EUR',
            '   [ ] 100 - 500 EUR',
            '   [ ] Plus de 500 EUR',
            '',
            '6. Quels sont vos principaux defis actuels ?',
            '   [Reponse du client]',
            '',
            '--- SECTION 3 : VOS ATTENTES ---',
            '',
            '7. Qu\'attendez-vous de cet accompagnement ?',
            '   [Reponse du client]',
            '',
            '8. Avez-vous des contraintes particulieres (delais, budget, technique) ?',
            '   [Reponse du client]',
            '',
            '9. Autres informations utiles :',
            '   [Reponse du client]',
            '',
            '=== FIN DU QUESTIONNAIRE ==='
        ].join('\n')
    },

    // ----- 2. PRE-ANALYSE -----
    'pre-analyse': {
        type: 'pre-analyse',
        title: 'Pre-analyse du projet - {{client_name}}',
        description: 'Analyse preliminaire basee sur les reponses au questionnaire',
        content: [
            '=== PRE-ANALYSE DU PROJET ===',
            'Client : {{client_name}}',
            'Offre : {{offer_name}}',
            'Date : {{date}}',
            'Projet : {{project_id}}',
            '',
            '--- SYNTHESE DES REPONSES CLIENT ---',
            '{{client_responses}}',
            '',
            '--- ANALYSE PRELIMINAIRE ---',
            '',
            '1. Points forts identifies :',
            '   - A completer selon les reponses du questionnaire',
            '',
            '2. Points d\'attention :',
            '   - A completer selon les reponses du questionnaire',
            '',
            '3. Opportunites :',
            '   - A completer selon les reponses du questionnaire',
            '',
            '--- RECOMMANDATIONS POUR LA SEANCE ---',
            '',
            'Axes prioritaires a aborder :',
            '   1. [Axe 1 selon analyse]',
            '   2. [Axe 2 selon analyse]',
            '   3. [Axe 3 selon analyse]',
            '',
            'Documents a preparer :',
            '   - [Documents selon offre]',
            '',
            '=== DOCUMENT RESERVE A L\'EQUIPE FA GENESIS ==='
        ].join('\n')
    },

    // ----- 3. AGENDA DE SEANCE -----
    'agenda': {
        type: 'agenda',
        title: 'Agenda de seance - Jour {{day_number}}',
        description: 'Programme de la seance pour {{client_name}}',
        content: [
            '=== AGENDA DE SEANCE ===',
            'Client : {{client_name}}',
            'Offre : {{offer_name}}',
            'Jour : {{day_number}} / {{duration_days}}',
            'Date : {{date}}',
            '',
            '--- OBJECTIFS DE LA SEANCE ---',
            '',
            '1. [Objectif principal]',
            '2. [Objectif secondaire]',
            '',
            '--- DEROULEMENT ---',
            '',
            'Introduction (10 min)',
            '   - Accueil et rappel des objectifs',
            '   - Point sur l\'avancement du projet',
            '',
            'Travail principal (30-45 min)',
            '   - [Theme principal a aborder]',
            '   - [Exercices / analyses / discussions]',
            '',
            'Plan d\'action (10 min)',
            '   - Resume des decisions prises',
            '   - Actions a mener avant la prochaine etape',
            '',
            '--- DOCUMENTS DE REFERENCE ---',
            '{{items_list}}',
            '',
            '=== DOCUMENT INTERNE FA GENESIS ==='
        ].join('\n')
    },

    // ----- 4. SYNTHESE DE SEANCE -----
    'synthese': {
        type: 'synthese',
        title: 'Synthese de seance - Jour {{day_number}}',
        description: 'Compte-rendu de la seance avec {{client_name}}',
        content: [
            '=== SYNTHESE DE SEANCE ===',
            'Client : {{client_name}}',
            'Offre : {{offer_name}}',
            'Jour : {{day_number}} / {{duration_days}}',
            'Date : {{date}}',
            '',
            '--- NOTES DE SEANCE ---',
            '{{session_notes}}',
            '',
            '--- POINTS CLES ABORDES ---',
            '',
            '1. [Point cle 1]',
            '2. [Point cle 2]',
            '3. [Point cle 3]',
            '',
            '--- DECISIONS PRISES ---',
            '',
            '- [Decision 1]',
            '- [Decision 2]',
            '',
            '--- ACTIONS A MENER ---',
            '',
            'Par le client :',
            '   - [Action client 1]',
            '   - [Action client 2]',
            '',
            'Par FA GENESIS :',
            '   - [Action FA GENESIS 1]',
            '   - [Action FA GENESIS 2]',
            '',
            '--- PROCHAINE ETAPE ---',
            '[Description de la prochaine etape]',
            '',
            '=== DOCUMENT INTERNE FA GENESIS ==='
        ].join('\n')
    },

    // ----- 5. STRUCTURATION -----
    'structuration': {
        type: 'structuration',
        title: 'Structuration du projet - {{client_name}}',
        description: 'Document de structuration pour le projet de {{client_name}}',
        content: [
            '=== STRUCTURATION DU PROJET ===',
            'Client : {{client_name}}',
            'Offre : {{offer_name}}',
            'Date : {{date}}',
            '',
            '--- VISION DU PROJET ---',
            '',
            'Objectif principal : [A completer]',
            'Public cible : [A completer]',
            'Proposition de valeur : [A completer]',
            '',
            '--- ARCHITECTURE DU PROJET ---',
            '',
            '1. Pilier 1 : [Nom du pilier]',
            '   - Element A',
            '   - Element B',
            '',
            '2. Pilier 2 : [Nom du pilier]',
            '   - Element A',
            '   - Element B',
            '',
            '3. Pilier 3 : [Nom du pilier]',
            '   - Element A',
            '   - Element B',
            '',
            '--- IDENTITE ET POSITIONNEMENT ---',
            '',
            'Nom / Marque : [A completer]',
            'Ton de communication : [A completer]',
            'Elements visuels : [A completer]',
            '',
            '--- CANAUX DE DIFFUSION ---',
            '',
            '- [Canal 1] : [Strategie]',
            '- [Canal 2] : [Strategie]',
            '',
            '=== LIVRABLE CLIENT ==='
        ].join('\n')
    },

    // ----- 6. PLAN D'ACTION -----
    'plan-action': {
        type: 'plan-action',
        title: 'Plan d\'action - {{client_name}}',
        description: 'Plan d\'action personnalise sur {{duration}}',
        content: [
            '=== PLAN D\'ACTION ===',
            'Client : {{client_name}}',
            'Offre : {{offer_name}}',
            'Duree : {{duration}}',
            'Date : {{date}}',
            '',
            '--- OBJECTIFS ---',
            '',
            'Objectif 1 : [A definir]',
            'Objectif 2 : [A definir]',
            'Objectif 3 : [A definir]',
            '',
            '--- PLANNING ---',
            '',
            'Semaine 1 :',
            '   Lun : [Action]',
            '   Mar : [Action]',
            '   Mer : [Action]',
            '   Jeu : [Action]',
            '   Ven : [Action]',
            '',
            'Semaine 2 :',
            '   Lun : [Action]',
            '   Mar : [Action]',
            '   Mer : [Action]',
            '   Jeu : [Action]',
            '   Ven : [Action]',
            '',
            '--- INDICATEURS DE SUCCES ---',
            '',
            '- [KPI 1] : [Cible]',
            '- [KPI 2] : [Cible]',
            '- [KPI 3] : [Cible]',
            '',
            '--- RESSOURCES NECESSAIRES ---',
            '',
            '- [Ressource 1]',
            '- [Ressource 2]',
            '',
            '=== LIVRABLE CLIENT ==='
        ].join('\n')
    },

    // ----- 7. PLAN DE DIFFUSION -----
    'plan-diffusion': {
        type: 'plan-diffusion',
        title: 'Plan de diffusion - {{client_name}}',
        description: 'Strategie de diffusion et publication sur {{duration}}',
        content: [
            '=== PLAN DE DIFFUSION ===',
            'Client : {{client_name}}',
            'Offre : {{offer_name}}',
            'Duree : {{duration}}',
            'Date : {{date}}',
            '',
            '--- STRATEGIE DE CONTENU ---',
            '',
            'Frequence de publication : [A definir]',
            'Types de contenu :',
            '   - [Type 1 : ex. Posts reseaux sociaux]',
            '   - [Type 2 : ex. Articles blog]',
            '   - [Type 3 : ex. Videos courtes]',
            '',
            '--- CALENDRIER EDITORIAL ---',
            '',
            'Semaine 1 :',
            '   - [Plateforme] : [Type de contenu] - [Sujet]',
            '   - [Plateforme] : [Type de contenu] - [Sujet]',
            '',
            'Semaine 2 :',
            '   - [Plateforme] : [Type de contenu] - [Sujet]',
            '   - [Plateforme] : [Type de contenu] - [Sujet]',
            '',
            '--- PLATEFORMES CIBLEES ---',
            '',
            '1. [Plateforme 1] :',
            '   - Objectif : [Objectif]',
            '   - Frequence : [Frequence]',
            '   - Format privilegie : [Format]',
            '',
            '2. [Plateforme 2] :',
            '   - Objectif : [Objectif]',
            '   - Frequence : [Frequence]',
            '   - Format privilegie : [Format]',
            '',
            '--- HASHTAGS ET MOTS-CLES ---',
            '',
            '{{items_list}}',
            '',
            '=== LIVRABLE CLIENT ==='
        ].join('\n')
    },

    // ----- 8. BRIEF PHOTO -----
    'brief-photo': {
        type: 'brief-photo',
        title: 'Brief photo - {{client_name}}',
        description: 'Brief pour le partenaire photographe',
        content: [
            '=== BRIEF PHOTO ===',
            'Client : {{client_name}}',
            'Offre : {{offer_name}}',
            'Projet : {{project_id}}',
            'Date : {{date}}',
            '',
            '--- CONTEXTE ---',
            '',
            'Projet : [Description courte du projet client]',
            'Univers visuel souhaite : [A completer]',
            '',
            '--- OBJECTIFS DU SHOOTING ---',
            '',
            '1. [Objectif 1 : ex. Photos portraits professionnels]',
            '2. [Objectif 2 : ex. Photos produit]',
            '3. [Objectif 3 : ex. Photos ambiance]',
            '',
            '--- SPECIFICATIONS TECHNIQUES ---',
            '',
            'Nombre de photos attendues : [A definir]',
            'Format : [Portrait / Paysage / Carre]',
            'Resolution : [Web / Print / Les deux]',
            'Retouche : [Basique / Avancee]',
            '',
            '--- DIRECTION ARTISTIQUE ---',
            '',
            'Style : [Naturel / Studio / Lifestyle / Autre]',
            'Palette de couleurs : [A definir]',
            'References visuelles : [Liens ou descriptions]',
            '',
            '--- LOGISTIQUE ---',
            '',
            'Lieu : [A definir]',
            'Date prevue : [A definir]',
            'Duree estimee : [A definir]',
            '',
            '--- LIVRABLES ATTENDUS ---',
            '',
            '- [Nombre] photos retouchees en haute resolution',
            '- [Nombre] photos pour reseaux sociaux (format optimise)',
            '- Delai de livraison : [A definir]',
            '',
            '=== BRIEF PARTENAIRE - CONFIDENTIEL ==='
        ].join('\n')
    },

    // ----- 9. BRIEF VIDEO -----
    'brief-video': {
        type: 'brief-video',
        title: 'Brief video - {{client_name}}',
        description: 'Brief pour le partenaire videaste',
        content: [
            '=== BRIEF VIDEO ===',
            'Client : {{client_name}}',
            'Offre : {{offer_name}}',
            'Projet : {{project_id}}',
            'Date : {{date}}',
            '',
            '--- CONTEXTE ---',
            '',
            'Projet : [Description courte du projet client]',
            'Message cle : [A completer]',
            '',
            '--- OBJECTIFS DE LA VIDEO ---',
            '',
            '1. [Objectif 1 : ex. Video de presentation]',
            '2. [Objectif 2 : ex. Temoignage client]',
            '3. [Objectif 3 : ex. Contenu reseaux sociaux]',
            '',
            '--- SPECIFICATIONS TECHNIQUES ---',
            '',
            'Duree cible : [30s / 1min / 2-3min]',
            'Format : [16:9 / 9:16 / 1:1]',
            'Resolution : [1080p / 4K]',
            'Sous-titres : [Oui / Non]',
            '',
            '--- SCENARIO / STRUCTURE ---',
            '',
            'Introduction (5-10s) :',
            '   - [Description]',
            '',
            'Corps (principal) :',
            '   - [Description]',
            '',
            'Conclusion / CTA (5-10s) :',
            '   - [Description]',
            '',
            '--- DIRECTION ARTISTIQUE ---',
            '',
            'Ton : [Professionnel / Dynamique / Emotionnel]',
            'Musique : [Style souhaite]',
            'References : [Liens ou descriptions]',
            '',
            '--- LOGISTIQUE ---',
            '',
            'Lieu de tournage : [A definir]',
            'Date prevue : [A definir]',
            'Duree de tournage estimee : [A definir]',
            '',
            '--- LIVRABLES ATTENDUS ---',
            '',
            '- [Nombre] video(s) montee(s)',
            '- Formats : [MP4 / MOV]',
            '- Versions courtes pour reseaux sociaux : [Oui / Non]',
            '- Delai de livraison : [A definir]',
            '',
            '=== BRIEF PARTENAIRE - CONFIDENTIEL ==='
        ].join('\n')
    },

    // ----- 10. BRIEF MEDIA -----
    'brief-media': {
        type: 'brief-media',
        title: 'Brief media/reseaux sociaux - {{client_name}}',
        description: 'Brief pour le partenaire media / community manager',
        content: [
            '=== BRIEF MEDIA / RESEAUX SOCIAUX ===',
            'Client : {{client_name}}',
            'Offre : {{offer_name}}',
            'Projet : {{project_id}}',
            'Date : {{date}}',
            '',
            '--- CONTEXTE ---',
            '',
            'Projet : [Description courte du projet client]',
            'Objectif de visibilite : [A completer]',
            '',
            '--- PLATEFORMES ---',
            '',
            '1. [Instagram / Facebook / TikTok / LinkedIn / YouTube / Autre]',
            '   - Compte existant : [Oui/Non - Lien]',
            '   - Objectif : [Notoriete / Engagement / Conversion]',
            '',
            '--- STRATEGIE DE CONTENU ---',
            '',
            'Ton de communication : [A definir]',
            'Themes principaux :',
            '   1. [Theme 1]',
            '   2. [Theme 2]',
            '   3. [Theme 3]',
            '',
            'Frequence de publication : [X posts/semaine]',
            '',
            '--- VISUELS ET CHARTE ---',
            '',
            'Charte graphique fournie : [Oui / Non]',
            'Couleurs principales : [A definir]',
            'Typographies : [A definir]',
            'Logo : [Fourni / A creer]',
            '',
            '--- LIVRABLES ATTENDUS ---',
            '',
            '- [Nombre] publications par semaine',
            '- Stories : [Oui / Non - Frequence]',
            '- Reporting mensuel : [Oui / Non]',
            '- Duree de la mission : {{duration}}',
            '',
            '=== BRIEF PARTENAIRE - CONFIDENTIEL ==='
        ].join('\n')
    },

    // ----- 11. BRIEF MARKETING -----
    'brief-marketing': {
        type: 'brief-marketing',
        title: 'Brief marketing - {{client_name}}',
        description: 'Brief pour le partenaire marketing',
        content: [
            '=== BRIEF MARKETING ===',
            'Client : {{client_name}}',
            'Offre : {{offer_name}}',
            'Projet : {{project_id}}',
            'Date : {{date}}',
            '',
            '--- CONTEXTE ---',
            '',
            'Projet : [Description courte du projet client]',
            'Secteur d\'activite : [A completer]',
            'Concurrents identifies : [A completer]',
            '',
            '--- OBJECTIFS MARKETING ---',
            '',
            '1. [Objectif 1 : ex. Generer des leads]',
            '2. [Objectif 2 : ex. Augmenter la notoriete]',
            '3. [Objectif 3 : ex. Lancer un produit]',
            '',
            '--- PUBLIC CIBLE ---',
            '',
            'Persona 1 :',
            '   - Age : [Tranche]',
            '   - Localisation : [Zone]',
            '   - Centres d\'interet : [A definir]',
            '   - Comportement d\'achat : [A definir]',
            '',
            '--- STRATEGIE PROPOSEE ---',
            '',
            'Canaux :',
            '   - [Canal 1] : [Budget / Objectif]',
            '   - [Canal 2] : [Budget / Objectif]',
            '',
            'Messages cles :',
            '   - [Message 1]',
            '   - [Message 2]',
            '',
            '--- BUDGET ET PLANNING ---',
            '',
            'Budget total : [A definir]',
            'Repartition :',
            '   - [Canal 1] : [Montant]',
            '   - [Canal 2] : [Montant]',
            '',
            'Planning :',
            '   - Phase 1 ([dates]) : [Actions]',
            '   - Phase 2 ([dates]) : [Actions]',
            '',
            '--- LIVRABLES ATTENDUS ---',
            '',
            '- Strategie marketing detaillee',
            '- Plan media',
            '- Reporting : [Frequence]',
            '- Duree de la mission : {{duration}}',
            '',
            '=== BRIEF PARTENAIRE - CONFIDENTIEL ==='
        ].join('\n')
    }
};

// ============================================================
// FONCTION : Remplir un template avec les donnees
// ============================================================

/**
 * Remplace les placeholders {{key}} par les valeurs fournies.
 * @param {string} templateType - cle du template dans DOCUMENT_TEMPLATES
 * @param {Object} data - paires cle/valeur pour les placeholders
 * @returns {Object} { success, title, content, type } ou { success: false, error }
 */
function fillTemplate(templateType, data) {
    try {
        var template = DOCUMENT_TEMPLATES[templateType];
        if (!template) {
            return { success: false, error: 'Template inconnu: ' + templateType };
        }

        var result_title = template.title;
        var result_content = template.content;
        var result_description = template.description;

        // Remplacer tous les placeholders
        var keys = Object.keys(data || {});
        for (var i = 0; i < keys.length; i++) {
            var placeholder = '{{' + keys[i] + '}}';
            var value = data[keys[i]] != null ? String(data[keys[i]]) : '';
            // Remplacer dans titre, contenu et description
            while (result_title.indexOf(placeholder) !== -1) {
                result_title = result_title.replace(placeholder, value);
            }
            while (result_content.indexOf(placeholder) !== -1) {
                result_content = result_content.replace(placeholder, value);
            }
            while (result_description.indexOf(placeholder) !== -1) {
                result_description = result_description.replace(placeholder, value);
            }
        }

        return {
            success: true,
            type: template.type,
            title: result_title,
            description: result_description,
            content: result_content
        };
    } catch (err) {
        return { success: false, error: 'Erreur fillTemplate: ' + (err.message || err) };
    }
}

/**
 * Obtenir la liste de tous les types de templates disponibles.
 * @returns {string[]}
 */
function getAvailableTemplates() {
    return Object.keys(DOCUMENT_TEMPLATES);
}

/**
 * Obtenir un template brut (sans remplacement).
 * @param {string} templateType
 * @returns {Object|null}
 */
function getTemplate(templateType) {
    return DOCUMENT_TEMPLATES[templateType] || null;
}

module.exports = {
    DOCUMENT_TEMPLATES: DOCUMENT_TEMPLATES,
    fillTemplate: fillTemplate,
    getAvailableTemplates: getAvailableTemplates,
    getTemplate: getTemplate
};
