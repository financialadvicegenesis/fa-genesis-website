// ============================================================
// FA GENESIS - Vérification des prestataires (2026-11-10)
// ============================================================
// Avant : un prestataire s'inscrivait sans aucun justificatif ; un clic « Approuver » dans l'admin
// le rendait visible des clients. Maintenant, chaque prestataire choisit son statut légal et
// envoie ses justificatifs (pièce d'identité + selfie avec la pièce pour tous) ; l'admin les
// examine avant de le rendre visible.
//
// Statuts légaux (pas de « profil étudiant » : un étudiant doit être micro-entrepreneur, et le
// public visé — étudiants, particuliers, entreprises — se règle prestation par prestation) :
//   micro   : indépendant / micro-entrepreneur établi en France → SIRET + preuve d'immatriculation
//   company : entreprise / société établie en France → SIRET + Kbis de moins de 3 mois
//   foreign : professionnel établi hors de France → immatriculation locale + document officiel,
//             ou, sans immatriculation, une preuve d'activité (badge « Identité vérifiée » seul)
//
// Ce module ne touche à aucun fichier : logique pure + appel à l'annuaire officiel des
// entreprises (recherche-entreprises.api.gouv.fr, gratuit, sans clé), utilisé par server.js.

var LEGAL_PROFILES = ['micro', 'company', 'foreign'];
var DOC_KINDS = ['identity', 'selfie', 'registration', 'activity'];
// Pays où le SIRET existe (France métropolitaine + départements et collectivités d'outre-mer).
var SIRET_COUNTRIES = ['FR', 'GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'BL', 'MF'];
var DOC_MAX_BYTES = 10 * 1024 * 1024;
var DEADLINE_DAYS = 30;

function usesSiret(country) {
    return SIRET_COUNTRIES.indexOf(String(country || '').toUpperCase()) !== -1;
}

function cleanSiret(v) {
    return String(v == null ? '' : v).replace(/[\s.\-]/g, '');
}

// Clé de contrôle du SIRET (algorithme de Luhn). Exception : les établissements de La Poste
// (SIREN 356000000), dont la somme des chiffres doit être un multiple de 5.
function isValidSiret(v) {
    var s = cleanSiret(v);
    if (!/^\d{14}$/.test(s)) return false;
    if (s.slice(0, 9) === '356000000') {
        var t = 0;
        for (var j = 0; j < 14; j++) t += +s[j];
        return t % 5 === 0;
    }
    var sum = 0;
    for (var i = 0; i < 14; i++) {
        var d = +s[13 - i];
        if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
        sum += d;
    }
    return sum % 10 === 0;
}

// Pièces demandées selon le statut. registered : un professionnel à l'étranger a-t-il une
// immatriculation dans son pays ?
function requiredDocs(profile, registered) {
    var docs = ['identity', 'selfie'];
    if (profile === 'micro' || profile === 'company') docs.push('registration');
    else if (profile === 'foreign') docs.push(registered ? 'registration' : 'activity');
    return docs;
}

// Niveau de badge obtenu une fois le dossier validé.
function levelFor(v) {
    if (!v) return null;
    if (v.legal_profile === 'foreign' && !v.registered) return 'identity';
    return 'business';
}

// Nettoie et contrôle le statut déclaré (inscription ou envoi du dossier).
// Retour : { ok:true, data } ou { ok:false, error, code }.
function normalizeLegalInfo(body, country) {
    body = body || {};
    var inFrance = usesSiret(country);
    var profile = String(body.legal_profile || '').trim();
    if (!inFrance) profile = 'foreign';
    if (LEGAL_PROFILES.indexOf(profile) === -1 || (inFrance && profile === 'foreign')) {
        return { ok: false, code: 'legal_profile_required', error: 'Choisissez votre statut : indépendant / micro-entrepreneur ou entreprise.' };
    }
    var data = { legal_profile: profile };
    if (profile === 'micro' || profile === 'company') {
        var siret = cleanSiret(body.siret);
        if (!/^\d{14}$/.test(siret)) return { ok: false, code: 'siret_format', error: 'Le SIRET doit contenir 14 chiffres.' };
        if (!isValidSiret(siret)) return { ok: false, code: 'siret_invalid', error: 'Ce SIRET n’est pas valide. Vérifiez les 14 chiffres.' };
        data.siret = siret;
        if (profile === 'company') {
            var cname = String(body.company_name || '').trim().slice(0, 120);
            var rep = String(body.representative || '').trim().slice(0, 120);
            if (cname.length < 2) return { ok: false, code: 'company_name_required', error: 'Indiquez la raison sociale de votre entreprise.' };
            if (rep.length < 3) return { ok: false, code: 'representative_required', error: 'Indiquez le nom du représentant légal.' };
            data.company_name = cname;
            data.representative = rep;
        }
    } else {
        var registered = body.registered === true || body.registered === 'true' || body.registered === 1;
        data.registered = registered;
        if (registered) {
            var num = String(body.registration_number || '').trim().slice(0, 60);
            if (num.length < 3) return { ok: false, code: 'registration_number_required', error: 'Indiquez votre numéro d’immatriculation (par exemple ICE, RCCM ou NIF).' };
            data.registration_number = num;
        }
    }
    return { ok: true, data: data };
}

function _norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

// Le nom déclaré correspond-il à l'entreprise trouvée ? true / false, ou null si l'annuaire
// ne publie pas le nom (entrepreneur ayant demandé la non-diffusion).
function nameMatches(check, person) {
    if (!check || !check.found) return null;
    var hay = _norm([check.name || ''].concat((check.directors || [])).join(' '));
    if (!hay || /NON DIFFUSIBLE/.test(hay)) return null;
    var words = _norm((person.nom || '') + ' ' + (person.company_name || '')).split(' ').filter(function(w) { return w.length >= 3; });
    if (!words.length) return null;
    return words.some(function(w) { return (' ' + hay + ' ').indexOf(' ' + w + ' ') !== -1; });
}

// Interroge l'annuaire officiel des entreprises. Ne lève jamais d'erreur :
// status = active | closed | not_found | unavailable (réseau, quota…).
function checkSiret(siret, opts) {
    opts = opts || {};
    var s = cleanSiret(siret);
    var now = new Date().toISOString();
    if (!isValidSiret(s)) return Promise.resolve({ status: 'invalid', found: false, checked_at: now });
    var fetchFn = opts.fetch || (typeof fetch === 'function' ? fetch : null);
    if (!fetchFn) return Promise.resolve({ status: 'unavailable', found: false, checked_at: now });
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function() { if (ctrl) ctrl.abort(); }, opts.timeoutMs || 6000);
    var url = 'https://recherche-entreprises.api.gouv.fr/search?q=' + s + '&page=1&per_page=1';
    return Promise.resolve().then(function() {
        return fetchFn(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'GENESIS-verification' }, signal: ctrl ? ctrl.signal : undefined });
    }).then(function(r) {
        if (!r || !r.ok) throw new Error('HTTP ' + (r && r.status));
        return r.json();
    }).then(function(j) {
        clearTimeout(timer);
        var u = j && Array.isArray(j.results) ? j.results.find(function(x) { return x && x.siren === s.slice(0, 9); }) : null;
        if (!u) return { status: 'not_found', found: false, checked_at: now };
        var etab = (u.matching_etablissements || []).find(function(e) { return e && e.siret === s; })
            || (u.siege && u.siege.siret === s ? u.siege : null);
        if (!etab) return { status: 'not_found', found: false, checked_at: now };
        var open = etab.etat_administratif === 'A' && u.etat_administratif !== 'C';
        return {
            status: open ? 'active' : 'closed',
            found: true,
            name: String(u.nom_complet || u.nom_raison_sociale || '').slice(0, 160),
            directors: (u.dirigeants || []).slice(0, 6).map(function(d) { return [d.prenoms, d.nom, d.denomination].filter(Boolean).join(' '); }),
            activity: etab.activite_principale || u.activite_principale || '',
            address: String(etab.adresse || '').slice(0, 200),
            created: etab.date_creation || u.date_creation || '',
            individual: !!(u.complements && u.complements.est_entrepreneur_individuel),
            checked_at: now
        };
    }).catch(function() {
        clearTimeout(timer);
        return { status: 'unavailable', found: false, checked_at: now };
    });
}

// Signature réelle du fichier (le type annoncé par le téléphone ne compte pas).
function sniffDocument(buf) {
    if (!buf || buf.length < 12) return null;
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
    if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'image/png';
    if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
    if (buf.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf';
    if (buf.toString('latin1', 4, 8) === 'ftyp' && /^(heic|heix|hevc|mif1|msf1)$/.test(buf.toString('latin1', 8, 12))) return 'image/heic';
    return null;
}

// Masqué des clients parce que le délai pour envoyer les justificatifs est dépassé ? Un dossier
// envoyé (en cours d'examen) ou validé n'est jamais masqué : le retard de l'équipe ne doit pas
// pénaliser le prestataire.
function isHiddenForVerification(p, nowMs) {
    if (!p || !p.verification_deadline) return false;
    var st = p.verification && p.verification.status;
    if (st === 'verified' || st === 'submitted') return false;
    var d = Date.parse(p.verification_deadline);
    return !isNaN(d) && (nowMs || Date.now()) > d;
}

// Ce que le client peut savoir : rien d'autre que le niveau de badge.
function publicLevel(p) {
    var v = p && p.verification;
    if (!v || v.status !== 'verified') return null;
    return v.level || levelFor(v);
}

// Vue du dossier renvoyée au prestataire lui-même (jamais les identifiants de fichiers).
function partnerView(p) {
    var v = (p && p.verification) || {};
    var docs = {};
    DOC_KINDS.forEach(function(k) {
        var d = v.docs && v.docs[k];
        if (d) docs[k] = { uploaded_at: d.uploaded_at, content_type: d.content_type, deleted: !!d.deleted };
    });
    var profile = v.legal_profile || null;
    return {
        status: v.status || 'none',
        legal_profile: profile,
        siret: v.siret || '',
        company_name: v.company_name || '',
        representative: v.representative || '',
        registered: !!v.registered,
        registration_number: v.registration_number || '',
        activity_proof: v.activity_proof || '',
        docs: docs,
        required: profile ? requiredDocs(profile, !!v.registered) : null,
        siret_status: v.siret_check ? v.siret_check.status : null,
        siret_name: v.siret_check && v.siret_check.found ? v.siret_check.name : '',
        reject_reason: v.status === 'rejected' ? (v.reject_reason || '') : '',
        submitted_at: v.submitted_at || null,
        verified_at: v.verified_at || null,
        level: publicLevel(p),
        deadline: (p && p.verification_deadline) || null,
        hidden: isHiddenForVerification(p),
        uses_siret: usesSiret(p && p.country)
    };
}

module.exports = {
    LEGAL_PROFILES: LEGAL_PROFILES,
    DOC_KINDS: DOC_KINDS,
    SIRET_COUNTRIES: SIRET_COUNTRIES,
    DOC_MAX_BYTES: DOC_MAX_BYTES,
    DEADLINE_DAYS: DEADLINE_DAYS,
    usesSiret: usesSiret,
    cleanSiret: cleanSiret,
    isValidSiret: isValidSiret,
    requiredDocs: requiredDocs,
    levelFor: levelFor,
    normalizeLegalInfo: normalizeLegalInfo,
    nameMatches: nameMatches,
    checkSiret: checkSiret,
    sniffDocument: sniffDocument,
    isHiddenForVerification: isHiddenForVerification,
    publicLevel: publicLevel,
    partnerView: partnerView
};
