'use strict';

var fs = require('fs');
var path = require('path');
var PDFDocument = require('pdfkit');

var CONTRACTS_FILE = path.join(__dirname, 'data', 'contracts.json');
var CONTRACT_VERSION = 'v2-2026';

// Logo FA GENESIS embarqué en base64 (lu une fois au démarrage)
var _LOGO_DATA_URI = '';
try {
    var _logoFile = path.join(__dirname, '../assets/images/logo-genesis-transparent.png');
    _LOGO_DATA_URI = 'data:image/png;base64,' + fs.readFileSync(_logoFile).toString('base64');
} catch (e) {
    console.warn('[CONTRACT] Logo introuvable, fallback texte :', e.message);
}

// ── Fuseau horaire par pays ───────────────────────────────────────────────────
var _COUNTRY_TIMEZONE = {
    'France': 'Europe/Paris',
    'Belgique': 'Europe/Brussels', 'Belgium': 'Europe/Brussels',
    'Suisse': 'Europe/Zurich', 'Switzerland': 'Europe/Zurich',
    'Luxembourg': 'Europe/Luxembourg',
    'Canada': 'America/Toronto',
    'Québec': 'America/Toronto',
    'États-Unis': 'America/New_York', 'USA': 'America/New_York', 'United States': 'America/New_York',
    'Maroc': 'Africa/Casablanca', 'Morocco': 'Africa/Casablanca',
    'Algérie': 'Africa/Algiers', 'Algeria': 'Africa/Algiers',
    'Tunisie': 'Africa/Tunis', 'Tunisia': 'Africa/Tunis',
    'Sénégal': 'Africa/Dakar', 'Senegal': 'Africa/Dakar',
    "Côte d'Ivoire": 'Africa/Abidjan', 'Ivory Coast': 'Africa/Abidjan',
    'Cameroun': 'Africa/Douala', 'Cameroon': 'Africa/Douala',
    'Gabon': 'Africa/Libreville',
    'Congo': 'Africa/Brazzaville',
    "République démocratique du Congo": 'Africa/Kinshasa', 'RDC': 'Africa/Kinshasa',
    'Mali': 'Africa/Bamako',
    'Burkina Faso': 'Africa/Ouagadougou',
    'Togo': 'Africa/Lome',
    'Bénin': 'Africa/Porto-Novo', 'Benin': 'Africa/Porto-Novo',
    'Niger': 'Africa/Niamey',
    'Guinée': 'Africa/Conakry', 'Guinea': 'Africa/Conakry',
    'Madagascar': 'Indian/Antananarivo',
    'Maurice': 'Indian/Mauritius', 'Mauritius': 'Indian/Mauritius',
    'Réunion': 'Indian/Reunion',
    'Martinique': 'America/Martinique',
    'Guadeloupe': 'America/Guadeloupe',
    'Guyane': 'America/Cayenne',
    'Royaume-Uni': 'Europe/London', 'UK': 'Europe/London',
    'Allemagne': 'Europe/Berlin', 'Germany': 'Europe/Berlin',
    'Espagne': 'Europe/Madrid', 'Spain': 'Europe/Madrid',
    'Italie': 'Europe/Rome', 'Italy': 'Europe/Rome',
    'Portugal': 'Europe/Lisbon',
    'Pays-Bas': 'Europe/Amsterdam', 'Netherlands': 'Europe/Amsterdam',
};

function _getTimezone(country) {
    if (!country) return 'Europe/Paris';
    return _COUNTRY_TIMEZONE[country] || _COUNTRY_TIMEZONE[(country || '').trim()] || 'Europe/Paris';
}

function _formatSignedAt(isoDate, country) {
    if (!isoDate) return 'Non signé';
    var resolvedCountry = country || 'France';
    try {
        var tz = _getTimezone(resolvedCountry);
        var dateStr = new Date(isoDate).toLocaleString('fr-FR', {
            timeZone: tz,
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        return dateStr + ' (heure de ' + resolvedCountry + ')';
    } catch (e) {
        return new Date(isoDate).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
}

// ── Stockage ─────────────────────────────────────────────────────────────────

function loadContracts() {
    try {
        if (fs.existsSync(CONTRACTS_FILE)) {
            return JSON.parse(fs.readFileSync(CONTRACTS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[CONTRACT] Erreur lecture contracts.json:', e.message);
    }
    return [];
}

function saveContracts(contracts) {
    try {
        fs.writeFileSync(CONTRACTS_FILE, JSON.stringify(contracts, null, 2), 'utf8');
    } catch (e) {
        console.error('[CONTRACT] Erreur sauvegarde contracts.json:', e.message);
    }
}

// ── Clauses du contrat de partenariat ────────────────────────────────────────

var PARTNERSHIP_CLAUSES = [
    {
        id: 'objet',
        title: 'Article 1 — Objet du contrat',
        body: 'Le présent contrat définit les conditions dans lesquelles le Prestataire propose ses services sur la plateforme FA GENESIS, en contrepartie d\'une commission prélevée sur chaque prestation réalisée. Il régit la relation commerciale entre les parties pour une durée indéterminée.'
    },
    {
        id: 'fonctionnement',
        title: 'Article 2 — Fonctionnement de la plateforme',
        body: 'FA GENESIS est une plateforme de mise en relation entre des professionnels indépendants (prestataires) et des clients (particuliers, étudiants, entreprises). GENESIS agit en qualité d\'intermédiaire de confiance et de gestionnaire des paiements. Le système GENESIS SAFE™ garantit la sécurisation des fonds jusqu\'à la livraison et la validation de chaque prestation. Le Prestataire reste juridiquement un professionnel indépendant ; aucun lien de subordination n\'existe entre lui et GENESIS.'
    },
    {
        id: 'commission',
        title: 'Article 3 — Commission FA GENESIS',
        body: 'En contrepartie de l\'accès à la plateforme, de la gestion sécurisée des paiements, de la mise en relation avec les clients et des outils professionnels mis à disposition, GENESIS prélève une commission sur chaque paiement reçu. Le taux applicable est déterminé par le badge détenu par le Prestataire au moment de la création de chaque mission, conformément au barème ci-dessus. Les badges sont attribués automatiquement selon le nombre de missions réalisées et la note moyenne obtenue. La commission est déduite automatiquement avant tout versement.'
    },
    {
        id: 'obligations_prestataire',
        title: 'Article 4 — Obligations du Prestataire',
        body: 'Le Prestataire s\'engage à : (1) réaliser les prestations avec sérieux, professionnalisme et dans les délais convenus ; (2) ne pas communiquer ses coordonnées personnelles aux clients avant la signature du contrat de prestation, conformément aux règles de la plateforme ; (3) respecter les standards de qualité définis par GENESIS ; (4) signaler tout incident ou litige dans les 48 heures suivant sa survenance via la messagerie interne ; (5) ne pas exercer de pratiques anticoncurrentielles, notamment le démarchage direct de clients hors plateforme ; (6) maintenir son profil, ses prestations et ses disponibilités à jour.'
    },
    {
        id: 'engagements_genesis',
        title: 'Article 5 — Engagements de FA GENESIS',
        body: 'GENESIS s\'engage à : (1) mettre à disposition une plateforme sécurisée, fonctionnelle et régulièrement mise à jour ; (2) assurer la gestion et la sécurisation des paiements via GENESIS SAFE™ ; (3) verser la rémunération du Prestataire selon les étapes de livraison validées, dans les délais prévus ; (4) traiter équitablement les litiges via le système de médiation ; (5) communiquer avec un préavis de 30 jours tout changement tarifaire majeur affectant les commissions.'
    },
    {
        id: 'qualite',
        title: 'Article 6 — Qualité et standards',
        body: 'Le Prestataire s\'engage à maintenir une note moyenne satisfaisante et à traiter les demandes clients dans des délais raisonnables. En cas de non-respect répété des standards de qualité, de signalements abusifs ou de comportements contraires aux intérêts des clients, GENESIS se réserve le droit de suspendre temporairement ou définitivement l\'accès à la plateforme, après notification au Prestataire.'
    },
    {
        id: 'genesis_safe',
        title: 'Article 7 — Protection des clients et GENESIS SAFE™',
        body: 'Les fonds versés par les clients sont conservés en escrow par GENESIS SAFE™ et ne sont reversés au Prestataire qu\'après livraison validée, conformément au plan de paiement (acompte 30% — livrable intermédiaire 40% — livraison finale 30% pour les prestations supérieures à 300 €). En cas de litige non résolu par la médiation interne, GENESIS peut décider d\'un remboursement partiel ou total au client. Le Prestataire accepte ce mécanisme de protection comme condition d\'utilisation de la plateforme.'
    },
    {
        id: 'confidentialite',
        title: 'Article 8 — Confidentialité',
        body: 'Les informations personnelles des clients (coordonnées, données de paiement, informations professionnelles) sont strictement confidentielles. Le Prestataire s\'interdit de les utiliser à des fins autres que l\'exécution de la prestation commandée, et s\'engage à ne pas les transmettre à des tiers. Cette obligation perdure après la fin du contrat.'
    },
    {
        id: 'propriete_intellectuelle',
        title: 'Article 9 — Propriété intellectuelle',
        body: 'Sauf accord spécifique écrit entre les parties, les créations réalisées dans le cadre d\'une prestation (visuels, contenus, codes, productions audiovisuelles, etc.) sont cédées au client à l\'issue du paiement intégral. Le Prestataire conserve le droit de mentionner la prestation dans son portfolio ou ses références commerciales, sous réserve de l\'accord du client et de l\'absence de clause de confidentialité spécifique.'
    },
    {
        id: 'resiliation',
        title: 'Article 10 — Durée et résiliation',
        body: 'Le présent contrat est conclu pour une durée indéterminée à compter de sa signature. Il peut être résilié par l\'une ou l\'autre des parties avec un préavis de 15 jours calendaires, sous réserve de l\'achèvement de toutes les missions en cours. GENESIS se réserve le droit de résilier immédiatement le contrat en cas de manquement grave aux obligations du Prestataire, notamment en cas de fraude, de violation répétée des règles de la plateforme ou de comportement préjudiciable envers les clients.'
    },
    {
        id: 'loi',
        title: 'Article 11 — Loi applicable et juridiction',
        body: 'Le présent contrat est soumis au droit français. Tout litige relatif à son interprétation ou à son exécution, qui ne pourrait être résolu amiablement par les parties, sera soumis à la juridiction compétente du ressort du siège social de FA GENESIS. Les parties s\'engagent à recourir en priorité à la procédure de médiation prévue par la plateforme avant toute action contentieuse.'
    }
];

// ── Clauses du contrat de prestation ─────────────────────────────────────────

var SERVICE_CLAUSES = [
    {
        id: 'objet',
        title: 'Article 1 — Objet de la prestation',
        body: 'Le présent contrat formalise la commande d\'une prestation de service réalisée via la plateforme FA GENESIS, dans les conditions décrites ci-dessus. Il engage les deux parties dès sa signature électronique par le Client.'
    },
    {
        id: 'paiement',
        title: 'Article 2 — Prix et conditions de paiement',
        body: 'Le paiement est sécurisé par le système GENESIS SAFE™. Pour les prestations supérieures à 300 €, le montant est réparti en trois tranches : acompte (30 %) à la commande, livrable intermédiaire (40 %) validé par le Client, livraison finale (30 %) à la remise des livrables définitifs. Pour les prestations inférieures ou égales à 300 €, le paiement intégral est effectué à la commande et les fonds sont libérés à la livraison. Aucun versement au Prestataire n\'intervient avant validation de chaque étape.'
    },
    {
        id: 'obligations_prestataire',
        title: 'Article 3 — Obligations du Prestataire',
        body: 'Le Prestataire s\'engage à : (1) réaliser la prestation selon les caractéristiques convenues, dans un délai raisonnable ; (2) livrer les éléments commandés via la plateforme FA GENESIS ; (3) informer le Client de tout retard ou empêchement dans les meilleurs délais ; (4) respecter les règles de confidentialité concernant les informations communiquées par le Client.'
    },
    {
        id: 'obligations_client',
        title: 'Article 4 — Obligations du Client',
        body: 'Le Client s\'engage à : (1) fournir au Prestataire les informations et éléments nécessaires à la réalisation de la prestation dans des délais raisonnables ; (2) régler les montants dus selon l\'échéancier GENESIS SAFE™ ; (3) valider ou contester la livraison dans un délai de 3 jours ouvrés — à défaut, la livraison sera réputée acceptée et les fonds libérés automatiquement ; (4) utiliser les livrables dans le respect de la propriété intellectuelle.'
    },
    {
        id: 'annulation',
        title: 'Article 5 — Annulation et remboursement',
        body: 'En cas d\'annulation par le Client après paiement de l\'acompte mais avant le début de la prestation, l\'acompte (30 %) est retenu conformément à la politique d\'annulation FA GENESIS. En cas d\'annulation par le Prestataire, les montants versés sont remboursés intégralement au Client. En cas de litige sur la qualité de la livraison, la procédure de médiation FA GENESIS s\'applique en priorité.'
    },
    {
        id: 'pi',
        title: 'Article 6 — Propriété intellectuelle',
        body: 'Sauf mention contraire dans les conditions particulières ci-dessous, les droits d\'utilisation des livrables sont cédés au Client à l\'issue du paiement intégral, pour un usage personnel ou professionnel non exclusif. Le Prestataire conserve la possibilité de mentionner la réalisation à titre de référence commerciale, sauf opposition écrite du Client.'
    },
    {
        id: 'mediation',
        title: 'Article 7 — Médiation et litiges',
        body: 'En cas de désaccord entre les parties concernant la réalisation ou la qualité de la prestation, celles-ci s\'engagent à recourir en priorité à la procédure de médiation interne de FA GENESIS (système Jérémie IA). À défaut d\'accord à l\'issue de la médiation, le litige sera soumis à la juridiction compétente du ressort du siège social de FA GENESIS, conformément au droit français.'
    },
    {
        id: 'signature',
        title: 'Article 8 — Valeur juridique de la signature électronique',
        body: 'La signature électronique apposée par le Client constitue son consentement éclairé et irrévocable aux termes du présent contrat. Elle est enregistrée avec horodatage certifié, adresse IP et identifiant unique de contrat, conformément aux dispositions applicables en matière de signature électronique.'
    }
];

// ── Rendu HTML — Contrat de partenariat ──────────────────────────────────────

function generatePartnershipContractHtml(partner, badgeTable) {
    var now = new Date();
    var dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    var contractId = 'PRTN-' + (partner.id || 'DEMO').substring(0, 8).toUpperCase();
    var partnerName = ((partner.prenom || '') + ' ' + (partner.nom || '')).trim() || partner.email;
    var partnerType = _localizePartnerType(partner.partner_type || 'prestataire');
    var partnerCompany = partner.company ? (' — ' + partner.company) : '';
    var partnerCountry = partner.country || 'France';
    var standardRate = badgeTable[0] ? badgeTable[0].commissionPct : 25;

    var badgeRows = badgeTable.map(function(b) {
        return '<tr>' +
            '<td style="padding:8px 14px;font-weight:700;color:#000;">' + b.badge + '</td>' +
            '<td style="padding:8px 12px;text-align:center;color:#c0392b;font-weight:700;">' + b.commissionPct + ' %</td>' +
            '<td style="padding:8px 12px;text-align:center;color:#27ae60;font-weight:700;">' + (100 - b.commissionPct) + ' %</td>' +
            '</tr>';
    }).join('');

    var clausesHtml = PARTNERSHIP_CLAUSES.map(function(c) {
        return '<div class="clause">' +
            '<h3 class="clause-title">' + c.title + '</h3>' +
            '<p class="clause-body">' + c.body + '</p>' +
            '</div>';
    }).join('');

    return _wrapContractHtml(contractId, dateStr, 'CONTRAT DE PARTENARIAT', [
        '<div class="parties-block">',
            '<div class="party"><span class="party-label">FA GENESIS</span><br><span class="party-sub">Plateforme de services créatifs et professionnels</span><br><span class="party-role">ci-après désignée <strong>« GENESIS »</strong></span></div>',
            '<div class="party-and">ET</div>',
            '<div class="party"><span class="party-label">' + _esc(partnerName) + '</span><br><span class="party-sub">' + _esc(partnerType) + _esc(partnerCompany) + ' — ' + _esc(partnerCountry) + '</span><br><span class="party-role">ci-après désigné(e) <strong>« le Prestataire »</strong></span></div>',
        '</div>',
        '<div class="commission-block">',
            '<h3 class="section-title"><i class="fas fa-percentage" style="color:#e74c3c;margin-right:8px;"></i>Barème des commissions</h3>',
            '<p style="color:#000;font-size:13px;margin-bottom:12px;font-weight:600;">Taux appliqués automatiquement selon le badge du Prestataire au moment de chaque mission.</p>',
            '<div class="rate-table-wrap">',
            '<table class="rate-table">',
                '<thead><tr><th style="padding:8px 14px;min-width:70px;">Badge</th><th style="padding:8px 14px;text-align:center;min-width:130px;">Commission GENESIS</th><th style="padding:8px 14px;text-align:center;min-width:120px;">Part Prestataire</th></tr></thead>',
                '<tbody>' + badgeRows + '</tbody>',
            '</table>',
            '</div>',
        '</div>',
        clausesHtml
    ].join('\n'));
}

// ── Rendu HTML — Contrat de prestation ───────────────────────────────────────

function _addMonths(date, n) {
    var d = new Date(date);
    var day = d.getDate();
    d.setMonth(d.getMonth() + n);
    // Si débordement (ex: 31 jan + 1 mois → 3 mars), reculer au dernier jour du mois voulu
    if (d.getDate() !== day) d.setDate(0);
    return d;
}

function _fmtDate(date) {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function _buildPaymentSection(order) {
    var totalAmount = parseFloat(order.total_amount || 0);
    var paymentTier = order.payment_tier || 'small';
    var installments = Array.isArray(order.installments) ? order.installments : [];
    var baseDate = order.created_at ? new Date(order.created_at) : new Date();

    var paymentHtml, article2, article4extra, article5;

    if (paymentTier === 'partner_installments' && installments.length >= 2) {
        // ── Mode "Plusieurs fois" : mensualités versées directement au Prestataire ──
        var n = installments.length;
        paymentHtml = installments.map(function(inst, idx) {
            var due = _addMonths(baseDate, idx);
            var dueStr = _fmtDate(due);
            var label = idx === 0
                ? 'Mensualité 1/' + n + ' — payée à la commande (' + dueStr + ')'
                : 'Mensualité ' + (idx + 1) + '/' + n + ' — le Client a jusqu\'au ' + dueStr + ' pour régler cette mensualité';
            return '<tr' + (idx % 2 === 1 ? ' style="background:#f5f5f5;"' : '') + '>' +
                '<td style="padding:8px 12px;">' + label + '</td>' +
                '<td style="text-align:right;font-weight:700;padding:8px 12px;">' + parseFloat(inst.amount).toFixed(2) + ' €</td></tr>';
        }).join('') +
        '<tr style="border-top:2px solid #000;background:#fff8e1;"><td style="padding:8px 12px;font-weight:700;">Total TTC</td>' +
        '<td style="text-align:right;font-weight:900;padding:8px 12px;">' + totalAmount.toFixed(2) + ' €</td></tr>';

        article2 = 'Le paiement est échelonné en ' + n + ' mensualités égales de ' +
            parseFloat(installments[0].amount).toFixed(2) + ' € chacune. ' +
            'La première mensualité est réglée à la commande. Pour chaque mensualité suivante, le Client dispose jusqu\'à la date d\'échéance indiquée dans le tableau ci-dessus pour en effectuer le règlement. ' +
            'Les mensualités sont encaissées par FA GENESIS et versées directement au Prestataire dès réception, sans période d\'escrow. ' +
            'Le non-paiement d\'une mensualité avant sa date d\'échéance entraîne la suspension de la prestation jusqu\'à régularisation.';
        article4extra = 'régler chaque mensualité à la date d\'échéance figurant au présent contrat ;';
        article5 = 'En cas d\'annulation par le Client après paiement de la première mensualité, ' +
            'les mensualités déjà versées au Prestataire sont acquises à titre d\'indemnité. ' +
            'En cas d\'annulation par le Prestataire, les mensualités versées sont remboursées intégralement au Client. ' +
            'En cas de litige sur la qualité de la livraison, la procédure de médiation FA GENESIS s\'applique en priorité.';

    } else if (paymentTier === 'custom' && installments.length >= 2) {
        // ── Mode "Acompte + reste" ──
        var acompteInst = installments[0];
        var soldeInst = installments[installments.length - 1];
        var acomptePct = Math.round(parseFloat(acompteInst.amount) / totalAmount * 100);
        var soldePct = 100 - acomptePct;
        paymentHtml =
            '<tr><td style="padding:8px 12px;">Acompte (' + acomptePct + '%) — versé au Prestataire dès acceptation de la mission</td>' +
            '<td style="text-align:right;font-weight:700;padding:8px 12px;">' + parseFloat(acompteInst.amount).toFixed(2) + ' €</td></tr>' +
            '<tr style="background:#f5f5f5;"><td style="padding:8px 12px;">Solde (' + soldePct + '%) — GENESIS SAFE™ · libéré après confirmation de livraison par le Client (ou 7 jours auto)</td>' +
            '<td style="text-align:right;font-weight:700;padding:8px 12px;">' + parseFloat(soldeInst.amount).toFixed(2) + ' €</td></tr>' +
            '<tr style="border-top:2px solid #000;background:#fff8e1;"><td style="padding:8px 12px;font-weight:700;">Total TTC</td>' +
            '<td style="text-align:right;font-weight:900;padding:8px 12px;">' + totalAmount.toFixed(2) + ' €</td></tr>';
        article2 = 'Le paiement est sécurisé par GENESIS SAFE™. ' +
            'Un acompte de ' + acomptePct + '% (' + parseFloat(acompteInst.amount).toFixed(2) + ' €) est versé directement au Prestataire dès qu\'il accepte la mission. ' +
            'Le solde de ' + soldePct + '% (' + parseFloat(soldeInst.amount).toFixed(2) + ' €) est conservé en escrow par GENESIS SAFE™ et libéré uniquement après confirmation de livraison par le Client, ' +
            'ou à l\'expiration d\'un délai de 7 jours suivant la déclaration de fin de prestation par le Prestataire, si le Client ne formule aucune contestation.';
        article4extra = 'régler le solde de la prestation conformément à l\'échéancier GENESIS SAFE™ ;';
        article5 = 'En cas d\'annulation par le Client après versement de l\'acompte mais avant le début effectif de la prestation, ' +
            'l\'acompte est retenu par le Prestataire à titre d\'indemnité d\'immobilisation. ' +
            'En cas d\'annulation par le Prestataire, les montants versés sont remboursés intégralement au Client. ' +
            'En cas de litige sur la qualité de la livraison, la procédure de médiation FA GENESIS s\'applique en priorité.';

    } else if (paymentTier === 'large' && installments.length === 3) {
        // ── Mode 30/40/30 (GENESIS classique) ──
        var i1 = installments[0]; var i2 = installments[1]; var i3 = installments[2];
        paymentHtml =
            '<tr><td style="padding:8px 12px;">Acompte (30%) — à la commande — GENESIS SAFE™</td>' +
            '<td style="text-align:right;font-weight:700;padding:8px 12px;">' + parseFloat(i1.amount).toFixed(2) + ' €</td></tr>' +
            '<tr style="background:#f5f5f5;"><td style="padding:8px 12px;">Livrable intermédiaire (40%) — après validation du 1er jalon par le Client</td>' +
            '<td style="text-align:right;font-weight:700;padding:8px 12px;">' + parseFloat(i2.amount).toFixed(2) + ' €</td></tr>' +
            '<tr><td style="padding:8px 12px;">Livraison finale (30%) — après validation complète par le Client</td>' +
            '<td style="text-align:right;font-weight:700;padding:8px 12px;">' + parseFloat(i3.amount).toFixed(2) + ' €</td></tr>' +
            '<tr style="border-top:2px solid #000;background:#fff8e1;"><td style="padding:8px 12px;font-weight:700;">Total TTC</td>' +
            '<td style="text-align:right;font-weight:900;padding:8px 12px;">' + totalAmount.toFixed(2) + ' €</td></tr>';
        article2 = 'Le paiement est sécurisé par GENESIS SAFE™ et réparti en trois tranches : ' +
            'acompte (30 %) à la commande, livrable intermédiaire (40 %) après validation par le Client du premier jalon, ' +
            'livraison finale (30 %) à la remise et validation des livrables définitifs. ' +
            'Aucun versement au Prestataire n\'intervient avant validation de chaque étape par le Client.';
        article4extra = 'régler les montants dus selon l\'échéancier GENESIS SAFE™ et valider chaque jalon ;';
        article5 = 'En cas d\'annulation par le Client après paiement de l\'acompte mais avant le début de la prestation, ' +
            'l\'acompte (30 %) est retenu à titre d\'indemnité conformément à la politique FA GENESIS. ' +
            'En cas d\'annulation par le Prestataire, les montants versés sont remboursés intégralement au Client. ' +
            'En cas de litige sur la qualité d\'un livrable, la procédure de médiation FA GENESIS s\'applique en priorité.';

    } else {
        // ── Mode "1 fois" — paiement intégral, GENESIS SAFE™ jusqu'à livraison ──
        paymentHtml = '<tr><td style="padding:8px 12px;">Paiement intégral — GENESIS SAFE™ · versé au Prestataire après confirmation de livraison (ou 7 jours auto)</td>' +
            '<td style="text-align:right;font-weight:700;padding:8px 12px;">' + totalAmount.toFixed(2) + ' €</td></tr>';
        article2 = 'Le paiement intégral est effectué à la commande et sécurisé par GENESIS SAFE™. ' +
            'Les fonds sont conservés en escrow par FA GENESIS et versés au Prestataire uniquement après confirmation de livraison par le Client. ' +
            'À défaut de confirmation ou de contestation dans un délai de 7 jours suivant la déclaration de fin de prestation par le Prestataire, ' +
            'les fonds sont automatiquement libérés. Aucun versement au Prestataire n\'intervient avant ce délai.';
        article4extra = 'confirmer ou contester la livraison dans un délai de 7 jours suivant la notification de fin de prestation ;';
        article5 = 'En cas d\'annulation par le Client après paiement et avant le début effectif de la prestation, ' +
            'une indemnité peut être retenue selon les règles de la plateforme FA GENESIS. ' +
            'En cas d\'annulation par le Prestataire, le paiement est remboursé intégralement au Client. ' +
            'En cas de litige sur la qualité de la livraison, la procédure de médiation FA GENESIS s\'applique en priorité.';
    }

    return { paymentHtml: paymentHtml, article2: article2, article4extra: article4extra, article5: article5 };
}

function generateServiceContractHtml(order, partnerObj, clientUser, customConditions) {
    var now = new Date();
    var dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    var contractId = 'SRVCE-' + (order.id || 'DEMO').replace('ORD-', '');
    var partnerName = ((partnerObj.prenom || '') + ' ' + (partnerObj.nom || '')).trim() || partnerObj.email;
    var partnerType = _localizePartnerType(partnerObj.partner_type || 'prestataire');
    var clientName = (clientUser
        ? ((clientUser.prenom || clientUser.firstName || '') + ' ' + (clientUser.nom || clientUser.lastName || '')).trim()
        : '') || (order.client_info ? ((order.client_info.first_name || '') + ' ' + (order.client_info.last_name || '')).trim() : 'Client');
    var clientType = _localizeClientType(
        (order.client_info && order.client_info.client_type) ||
        (clientUser && clientUser.clientType) || 'particulier'
    );
    var totalAmount = parseFloat(order.total_amount || 0).toFixed(2);
    var serviceName = order.product_name || 'Prestation de service';

    var paymentInfo = _buildPaymentSection(order);

    // Clauses dynamiques adaptées au mode de paiement
    var dynamicClauses = SERVICE_CLAUSES.map(function(c) {
        if (c.id === 'paiement') {
            return { id: c.id, title: c.title, body: paymentInfo.article2 };
        }
        if (c.id === 'obligations_client') {
            return { id: c.id, title: c.title, body: 'Le Client s\'engage à : (1) fournir au Prestataire les informations et éléments nécessaires à la réalisation de la prestation dans des délais raisonnables ; (2) ' + paymentInfo.article4extra + ' (3) utiliser les livrables dans le respect de la propriété intellectuelle.' };
        }
        if (c.id === 'annulation') {
            return { id: c.id, title: c.title, body: paymentInfo.article5 };
        }
        return c;
    });

    var conditionsHtml = customConditions
        ? '<div class="clause"><h3 class="clause-title">Conditions particulières fixées par le Prestataire</h3><p class="clause-body" style="white-space:pre-line;">' + _esc(customConditions) + '</p></div>'
        : '';

    var clausesHtml = dynamicClauses.map(function(c) {
        return '<div class="clause"><h3 class="clause-title">' + c.title + '</h3><p class="clause-body">' + c.body + '</p></div>';
    }).join('');

    return _wrapContractHtml(contractId, dateStr, 'CONTRAT DE PRESTATION DE SERVICE', [
        '<div class="parties-block">',
            '<div class="party"><span class="party-label">' + _esc(partnerName) + '</span><br><span class="party-sub">' + _esc(partnerType) + '</span><br><span class="party-role">ci-après désigné(e) <strong>« le Prestataire »</strong></span></div>',
            '<div class="party-and">ET</div>',
            '<div class="party"><span class="party-label">' + _esc(clientName) + '</span><br><span class="party-sub">' + _esc(clientType) + '</span><br><span class="party-role">ci-après désigné(e) <strong>« le Client »</strong></span></div>',
        '</div>',
        '<div class="commission-block">',
            '<h3 class="section-title"><i class="fas fa-clipboard-list" style="color:#2980b9;margin-right:8px;"></i>Détails de la prestation</h3>',
            '<table class="rate-table">',
                '<tbody>',
                    '<tr><td style="font-weight:700;">Référence commande</td><td style="text-align:right;">' + _esc(order.id || '') + '</td></tr>',
                    '<tr><td style="font-weight:700;">Prestation</td><td style="text-align:right;">' + _esc(serviceName) + '</td></tr>',
                    '<tr><td style="font-weight:700;">Type de client</td><td style="text-align:right;">' + _esc(clientType) + '</td></tr>',
                    '<tr style="border-top:2px solid #000;"><td style="font-weight:900;font-size:15px;">Montant total TTC</td><td style="text-align:right;font-weight:900;font-size:15px;">' + totalAmount + ' €</td></tr>',
                '</tbody>',
            '</table>',
            '<h3 class="section-title" style="margin-top:16px;"><i class="fas fa-shield-halved" style="color:#27ae60;margin-right:8px;"></i>Échéancier de paiement</h3>',
            '<table class="rate-table"><tbody>' + paymentInfo.paymentHtml + '</tbody></table>',
        '</div>',
        conditionsHtml,
        clausesHtml
    ].join('\n'));
}

// ── Génération PDF (pdfkit) ───────────────────────────────────────────────────

function generatePdfBuffer(contract, callback) {
    try {
        var doc = new PDFDocument({ margin: 50, size: 'A4' });
        var buffers = [];
        doc.on('data', function(chunk) { buffers.push(chunk); });
        doc.on('end', function() { callback(null, Buffer.concat(buffers)); });
        doc.on('error', function(err) { callback(err); });

        var isPartnership = contract.type === 'partnership';
        var title = isPartnership ? 'CONTRAT DE PARTENARIAT FA GENESIS' : 'CONTRAT DE PRESTATION DE SERVICE';
        var contractId = contract.id || 'CTR-INCONNU';
        var signedAt = _formatSignedAt(contract.signed_at, contract.partner_country);

        // En-tête — logo ou texte de fallback
        var _pdfLogoDrawn = false;
        if (_LOGO_DATA_URI) {
            try {
                var _pdfLogoBuf = Buffer.from(_LOGO_DATA_URI.replace(/^data:image\/png;base64,/, ''), 'base64');
                var _pdfLogoW = 90;
                var _pdfLogoX = (doc.page.width - _pdfLogoW) / 2;
                doc.image(_pdfLogoBuf, _pdfLogoX, doc.y, { width: _pdfLogoW });
                doc.moveDown(0.4);
                _pdfLogoDrawn = true;
            } catch (_e) { /* fallback */ }
        }
        if (!_pdfLogoDrawn) {
            doc.fontSize(18).font('Helvetica-Bold').fillColor('#000').text('FA GENESIS', { align: 'center' });
        }
        doc.fontSize(11).font('Helvetica').fillColor('#000').text('Plateforme de services créatifs et professionnels', { align: 'center' });
        doc.moveDown(0.5);
        doc.strokeColor('#FFD700').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        doc.fontSize(14).font('Helvetica-Bold').fillColor('#000').text(title, { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica').fillColor('#000')
            .text('Identifiant : ' + contractId + '  |  Version : ' + (contract.contract_version || CONTRACT_VERSION) + '  |  Date de signature : ' + signedAt, { align: 'center' });
        doc.moveDown(1);

        // Parties
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text('PARTIES AU CONTRAT');
        doc.strokeColor('#eee').lineWidth(1).moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).stroke();
        doc.moveDown(0.5);

        if (isPartnership) {
            doc.fontSize(10).font('Helvetica-Bold').text('FA GENESIS', { continued: true });
            doc.font('Helvetica').text(' (ci-après « GENESIS »)');
            doc.moveDown(0.3);
            doc.font('Helvetica-Bold').text((contract.partner_name || '') + (contract.partner_company ? ' — ' + contract.partner_company : ''), { continued: true });
            doc.font('Helvetica').text(' — ' + (contract.partner_type || '') + ' (ci-après « le Prestataire »)');
        } else {
            doc.fontSize(10).font('Helvetica-Bold').text(contract.partner_name || '', { continued: true });
            doc.font('Helvetica').text(' — ' + (contract.partner_type || '') + ' (ci-après « le Prestataire »)');
            doc.moveDown(0.3);
            doc.font('Helvetica-Bold').text(contract.client_name || '', { continued: true });
            doc.font('Helvetica').text(' — ' + (contract.client_type || '') + ' (ci-après « le Client »)');
        }
        doc.moveDown(1);

        // Barème commissions ou détails prestation
        if (isPartnership && contract.badge_table) {
            doc.fontSize(11).font('Helvetica-Bold').text('BARÈME DES COMMISSIONS');
            doc.strokeColor('#eee').lineWidth(1).moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).stroke();
            doc.moveDown(0.5);
            var tableY = doc.y;
            var cols = [50, 220, 360, 490];
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('Badge', cols[0], tableY);
            doc.text('Commission GENESIS', cols[1], tableY);
            doc.text('Part Prestataire', cols[2], tableY);
            doc.moveDown(0.4);
            contract.badge_table.forEach(function(b) {
                doc.font('Helvetica');
                var rowY = doc.y;
                doc.text(b.badge, cols[0], rowY);
                doc.text(b.commissionPct + ' %', cols[1], rowY);
                doc.text((100 - b.commissionPct) + ' %', cols[2], rowY);
                doc.moveDown(0.3);
            });
            doc.moveDown(0.8);
        } else if (!isPartnership) {
            doc.fontSize(11).font('Helvetica-Bold').text('DÉTAILS DE LA PRESTATION');
            doc.strokeColor('#eee').lineWidth(1).moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.text('Prestation : ' + (contract.service_name || ''));
            doc.text('Référence : ' + (contract.order_id || ''));
            doc.text('Type de client : ' + (contract.client_type || ''));
            doc.font('Helvetica-Bold').text('Montant total : ' + parseFloat(contract.service_price || 0).toFixed(2) + ' €');
            doc.moveDown(0.5);

            // Échéancier adapté au mode de paiement
            var _pdfOrder = { total_amount: contract.service_price, payment_tier: contract.payment_tier, installments: contract.installments, created_at: contract.created_at };
            var _pdfPayInfo = _buildPaymentSection(_pdfOrder);
            doc.fontSize(10).font('Helvetica-Bold').text('ÉCHÉANCIER DE PAIEMENT');
            doc.moveDown(0.2);
            doc.fontSize(9).font('Helvetica').text(_pdfPayInfo.article2, { align: 'justify' });
            doc.moveDown(0.8);
        }

        // Clauses
        var clauses = isPartnership ? PARTNERSHIP_CLAUSES : SERVICE_CLAUSES;
        clauses.forEach(function(c) {
            if (doc.y > 700) doc.addPage();
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(c.title);
            doc.moveDown(0.2);
            doc.fontSize(9).font('Helvetica').fillColor('#000').text(c.body, { align: 'justify' });
            doc.moveDown(0.8);
        });

        // Conditions particulières (service contract)
        if (!isPartnership && contract.custom_conditions) {
            if (doc.y > 700) doc.addPage();
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('CONDITIONS PARTICULIÈRES');
            doc.moveDown(0.2);
            doc.fontSize(9).font('Helvetica').fillColor('#000').text(contract.custom_conditions, { align: 'justify' });
            doc.moveDown(0.8);
        }

        // Signature
        if (doc.y > 650) doc.addPage();
        doc.moveDown(0.5);
        doc.strokeColor('#000').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica-Bold').text('SIGNATURE ÉLECTRONIQUE', { align: 'center' });
        doc.moveDown(0.4);
        doc.fontSize(9).font('Helvetica').fillColor('#000');
        doc.text('Signataire : ' + (contract.signature_name || '(non signé)'), { align: 'center' });
        doc.text('Date et heure : ' + signedAt, { align: 'center' });
        if (contract.signed_ip) doc.text('Adresse IP : ' + contract.signed_ip, { align: 'center' });
        doc.text('Identifiant contrat : ' + contractId, { align: 'center' });
        doc.moveDown(0.5);
        doc.fillColor('#000').fontSize(8).text(
            'Document généré par FA GENESIS — Ce document électronique tient lieu de contrat conformément aux dispositions applicables en matière de signature électronique.',
            { align: 'center' }
        );

        doc.end();
    } catch (err) {
        callback(err);
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _localizePartnerType(type) {
    var map = {
        photographer: 'Photographe', videographer: 'Vidéaste', marketer: 'Marketeur',
        media: 'Média', graphic_designer: 'Graphiste', developer: 'Développeur',
        coach: 'Coach', consultant: 'Consultant', event_planner: 'Organisateur d\'événements',
        writer: 'Rédacteur', translator: 'Traducteur', other: 'Prestataire'
    };
    return map[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Prestataire');
}

function _localizeClientType(type) {
    var map = { etudiant: 'Étudiant(e)', particulier: 'Particulier', entreprise: 'Entreprise / Professionnel' };
    return map[type] || type || 'Particulier';
}

function _wrapContractHtml(contractId, dateStr, title, sectionsHtml) {
    return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">' +
        '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">' +
        '<style>' +
        'body{font-family:Georgia,serif;background:#f8f8f6;color:#1a1a1a;margin:0;padding:0;}' +
        '.contract-wrap{max-width:820px;margin:0 auto;padding:40px 32px;background:#fff;box-shadow:0 4px 32px rgba(0,0,0,.08);}' +
        '.contract-header{text-align:center;border-bottom:3px solid #FFD700;padding-bottom:24px;margin-bottom:28px;}' +
        '.contract-header .logo-img{height:50px;max-width:150px;object-fit:contain;display:block;margin:0 auto 8px;}' +
        '.contract-header .org{font-family:\'Arial Black\',Arial,sans-serif;font-size:22px;font-weight:900;letter-spacing:2px;color:#1a1a1a;}' +
        '.contract-header .sub{font-size:12px;color:#000;margin-top:2px;font-weight:600;}' +
        '.contract-header h1{font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin:16px 0 6px;font-family:\'Arial Black\',Arial,sans-serif;color:#000;}' +
        '.contract-meta{display:flex;justify-content:center;gap:24px;flex-wrap:wrap;font-size:11px;color:#000;margin-top:8px;font-weight:600;}' +
        '.contract-meta span{display:flex;align-items:center;gap:5px;}' +
        '.parties-block{display:flex;align-items:center;gap:24px;background:#f9f9f9;border:2px solid #eee;padding:20px;margin:0 0 24px;flex-wrap:wrap;}' +
        '.party{flex:1;min-width:180px;} .party-label{font-size:15px;font-weight:900;font-family:\'Arial Black\',Arial,sans-serif;color:#000;}' +
        '.party-sub{font-size:12px;color:#000;display:block;margin:2px 0;font-weight:600;} .party-role{font-size:12px;color:#2980b9;}' +
        '.party-and{font-size:20px;font-weight:900;color:#000;padding:0 8px;}' +
        '.commission-block{background:#fafafa;border-left:4px solid #FFD700;padding:18px 20px;margin:0 0 24px;}' +
        '.section-title{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;margin:0 0 10px;font-family:\'Arial Black\',Arial,sans-serif;color:#000;}' +
        '.rate-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:0;}' +
        '.rate-table{width:100%;border-collapse:collapse;font-size:13px;min-width:280px;}' +
        '.rate-table th{background:#1a1a1a;color:#FFD700;font-weight:900;text-align:left;font-family:\'Arial Black\',Arial,sans-serif;font-size:11px;text-transform:uppercase;white-space:nowrap;}' +
        '.rate-table tr:nth-child(even){background:#f5f5f5;} .rate-table td,.rate-table th{border:1px solid #e0e0e0;white-space:nowrap;word-break:normal;}' +
        '.clause{margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f0f0f0;}' +
        '.clause:last-child{border-bottom:none;}' +
        '.clause-title{font-size:13px;font-weight:900;font-family:\'Arial Black\',Arial,sans-serif;margin:0 0 8px;color:#1a1a1a;}' +
        '.clause-body{font-size:12.5px;color:#000;line-height:1.7;margin:0;}' +
        '.signature-block{background:#1a1a1a;color:#fff;padding:24px;margin-top:32px;border-radius:2px;}' +
        '.signature-block h3{color:#FFD700;font-family:\'Arial Black\',Arial,sans-serif;font-size:13px;margin:0 0 16px;}' +
        '.sig-field{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:12px;}' +
        '.sig-item{font-size:11px;} .sig-item .label{color:#888;text-transform:uppercase;font-size:10px;letter-spacing:.5px;display:block;margin-bottom:2px;}' +
        '.sig-item .val{color:#fff;font-weight:700;}' +
        '.sig-canvas-area{margin-top:12px;background:#fff;padding:8px;border-radius:2px;}' +
        '.sig-canvas-area img{max-width:200px;height:60px;object-fit:contain;}' +
        '.footer-note{font-size:10px;color:#888;text-align:center;margin-top:28px;border-top:1px solid #eee;padding-top:12px;}' +
        '@media print{body{background:#fff;} .contract-wrap{box-shadow:none;padding:20px;} .no-print{display:none;}}' +
        '</style></head><body>' +
        '<div class="contract-wrap">' +
        '<div class="contract-header">' +
            (_LOGO_DATA_URI
                ? '<img src="' + _LOGO_DATA_URI + '" alt="FA GENESIS" class="logo-img">'
                : '<div class="org">FA GENESIS</div>') +
            '<div class="sub">Plateforme de services créatifs et professionnels</div>' +
            '<h1>' + title + '</h1>' +
            '<div class="contract-meta">' +
                '<span><i class="fas fa-hashtag"></i> ' + _esc(contractId) + '</span>' +
                '<span><i class="fas fa-code-branch"></i> ' + CONTRACT_VERSION + '</span>' +
                '<span><i class="fas fa-calendar-day"></i> ' + _esc(dateStr) + '</span>' +
            '</div>' +
        '</div>' +
        sectionsHtml +
        '</div>' +
        '</body></html>';
}

module.exports = {
    loadContracts,
    saveContracts,
    generatePartnershipContractHtml,
    generateServiceContractHtml,
    generatePdfBuffer,
    CONTRACT_VERSION,
    CONTRACTS_FILE
};
