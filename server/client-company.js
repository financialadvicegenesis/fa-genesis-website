// ════════════════════════════════════════════════════════════════════════════
// Clients « Entreprise » et statut étudiant (décision de FA GENESIS, 2026-11-11)
// ════════════════════════════════════════════════════════════════════════════
// ENTREPRISE — pas de Kbis : en France (outre-mer compris) le SIRET est obligatoire à
// l'inscription et vérifié automatiquement dans le répertoire officiel des entreprises
// (recherche-entreprises.api.gouv.fr, même contrôle que pour les prestataires). Un établissement
// fermé est refusé ; « introuvable » ou « service indisponible » est accepté et signalé à l'admin.
// Hors de France : nom de l'entreprise obligatoire, numéro d'immatriculation local facultatif.
// Les clients entreprise inscrits avant cette règle ne sont jamais bloqués : ils complètent
// depuis leur profil. Le nom et le SIREN figurent ensuite sur leurs factures.
//
// ÉTUDIANT — une vérification vaut pour une année scolaire : elle expire le 31 octobre (heure de
// Paris) qui suit. Validée de juillet à décembre → 31 octobre de l'année suivante ; de janvier à
// juin → 31 octobre de la même année. Rappel à partir du 16 septembre, et un étudiant qui envoie
// son nouveau certificat garde ses tarifs pendant la vérification (student_renewal_pending).
// Les étudiants vérifiés avant cette règle sont valables jusqu'au 31 octobre 2027 au moins.
'use strict';

var PV = require('./partner-verification');

var CLOSED_MSG = 'Ce SIRET correspond à un établissement fermé dans le répertoire officiel des entreprises. Vérifiez le numéro, ou contactez-nous si votre activité est en cours.';

function _clean(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max); }

// Champs envoyés par l'inscription ou par le profil → données propres, ou { error, code }.
function normalizeCompanyInput(body) {
    body = body || {};
    var country = String(body.company_country || 'FR').toUpperCase().slice(0, 2);
    if (!/^[A-Z]{2}$/.test(country)) country = 'FR';
    var name = _clean(body.company_name, 160);
    if (PV.usesSiret(country)) {
        var siret = PV.cleanSiret(body.company_siret);
        if (!siret) return { error: 'Indiquez le numéro SIRET de votre entreprise (14 chiffres).', code: 'siret_required' };
        if (!PV.isValidSiret(siret)) return { error: 'Ce SIRET n’est pas valide. Vérifiez les 14 chiffres.', code: 'siret_invalid' };
        return { data: { country: country, siret: siret, name: name, registration_number: '' } };
    }
    if (name.length < 2) return { error: 'Indiquez le nom de votre entreprise.', code: 'company_name_required' };
    return { data: { country: country, siret: '', name: name, registration_number: _clean(body.company_registration, 40) } };
}

// Contrôle dans le répertoire officiel (le résultat précédent est réutilisé pour le même SIRET,
// sauf s'il n'avait pas pu être vérifié). → { company } ou { error, code }.
function buildCompany(data, prev, opts) {
    var now = new Date().toISOString();
    var out = { country: data.country, name: data.name, siret: data.siret || '', siren: data.siret ? data.siret.slice(0, 9) : '', registration_number: data.registration_number || '', check: null, updated_at: now };
    if (!data.siret) return Promise.resolve({ company: out });
    var reuse = prev && prev.siret === data.siret && prev.check && prev.check.status !== 'unavailable';
    var p = reuse ? Promise.resolve(prev.check) : PV.checkSiret(data.siret, opts);
    return p.then(function(c) {
        if (c.status === 'closed') return { error: CLOSED_MSG, code: 'siret_closed' };
        if (c.status === 'invalid') return { error: 'Ce SIRET n’est pas valide. Vérifiez les 14 chiffres.', code: 'siret_invalid' };
        out.check = { status: c.status, name: c.name || '', address: c.address || '', checked_at: c.checked_at || now };
        // Un contrôle réutilisé (enregistré sans le champ found) : « active » = trouvé.
        if ((c.found || c.status === 'active') && c.name) {
            if (data.name && data.name.toLowerCase() !== String(c.name).toLowerCase()) out.declared_name = data.name;
            out.name = String(c.name).slice(0, 160);
        } else if (!out.name || out.name.length < 2) {
            return { error: 'Ce SIRET n’a pas pu être confirmé dans le répertoire officiel pour l’instant : indiquez aussi le nom de votre entreprise.', code: 'company_name_required' };
        }
        return { company: out };
    });
}

// Vue envoyée au client et à l'admin.
function companyView(c) {
    if (!c) return null;
    return {
        country: c.country || 'FR', name: c.name || '', siret: c.siret || '', siren: c.siren || '',
        registration_number: c.registration_number || '', declared_name: c.declared_name || '',
        status: c.siret ? ((c.check && c.check.status) || 'unavailable') : 'declared',
        updated_at: c.updated_at || null
    };
}

// ── Étudiants ────────────────────────────────────────────────────────────────
var STUDENT_LEGACY_UNTIL = '2027-10-31T22:59:59.000Z';
var STUDENT_REMINDER_DAYS = 45;

// 31 octobre 23:59:59 heure de Paris (UTC+1 en hiver) de l'année scolaire en cours.
function studentValidUntil(verifiedIso) {
    var d = new Date(verifiedIso || Date.now());
    if (isNaN(d.getTime())) d = new Date();
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    var year = m >= 7 ? y + 1 : y;
    return new Date(Date.UTC(year, 9, 31, 22, 59, 59)).toISOString();
}

// Étudiant vérifié ET année scolaire non terminée.
function isStudentVerified(user, nowMs) {
    if (!user || user.student_status !== 'verified') return false;
    var u = Date.parse(user.student_verified_until || '');
    return isNaN(u) || (nowMs || Date.now()) <= u;
}

function _fmtFr(iso) {
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }); } catch (e) { return ''; }
}

// Passe en revue les étudiants vérifiés : complète la date de fin (comptes vérifiés avant la
// règle), prévient avant l'échéance, puis fait expirer. Ne notifie rien lui-même : renvoie les
// listes, l'appelant envoie les messages. Modifie `users` sur place ; changed = à sauvegarder.
function sweepStudents(users, nowMs) {
    var now = nowMs || Date.now();
    var res = { changed: false, remind: [], expired: [] };
    (users || []).forEach(function(u) {
        if (!u || u.accountType !== 'etudiant' || u.student_status !== 'verified') return;
        if (!u.student_verified_until) {
            var calc = studentValidUntil(u.student_verified_at || u.updatedAt || u.createdAt);
            u.student_verified_until = Date.parse(calc) > Date.parse(STUDENT_LEGACY_UNTIL) ? calc : STUDENT_LEGACY_UNTIL;
            res.changed = true;
        }
        var until = Date.parse(u.student_verified_until);
        if (isNaN(until)) return;
        if (now > until) {
            u.student_status = u.student_renewal_pending ? 'pending' : 'expired';
            u.student_expired_at = new Date(now).toISOString();
            u.student_renewal_pending = false;
            res.changed = true;
            if (u.student_status === 'expired') res.expired.push(u);
            return;
        }
        if (!u.student_renewal_pending && u.student_renewal_reminded_for !== u.student_verified_until
            && now >= until - STUDENT_REMINDER_DAYS * 86400000) {
            u.student_renewal_reminded_for = u.student_verified_until;
            res.changed = true;
            res.remind.push(u);
        }
    });
    return res;
}

function studentReminderText(u) {
    return {
        title: 'Nouvelle année scolaire : votre certificat',
        body: 'Pour garder les tarifs étudiants, envoyez votre certificat de scolarité de cette année avant le ' + _fmtFr(u.student_verified_until) + ', depuis votre profil.'
    };
}
function studentExpiredText() {
    return {
        title: 'Statut étudiant à renouveler',
        body: 'Votre certificat de scolarité de l’an dernier n’est plus valable. Envoyez celui de cette année depuis votre profil pour retrouver les tarifs étudiants.'
    };
}

module.exports = {
    CLOSED_MSG: CLOSED_MSG,
    normalizeCompanyInput: normalizeCompanyInput,
    buildCompany: buildCompany,
    companyView: companyView,
    STUDENT_LEGACY_UNTIL: STUDENT_LEGACY_UNTIL,
    STUDENT_REMINDER_DAYS: STUDENT_REMINDER_DAYS,
    studentValidUntil: studentValidUntil,
    isStudentVerified: isStudentVerified,
    sweepStudents: sweepStudents,
    studentReminderText: studentReminderText,
    studentExpiredText: studentExpiredText,
    fmtFr: _fmtFr
};
