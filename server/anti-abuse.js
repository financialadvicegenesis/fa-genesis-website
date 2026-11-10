// ============================================================
// ANTI-ABUS — inscriptions, formulaire de contact (2026-11-10)
// ============================================================
// Complète les protections déjà en place dans server.js (honeypot, délai minimum, limite par IP,
// noms aléatoires, neutralisation des textes, limite des tentatives de connexion) :
//  1. Format d'e-mail STRICT : le champ e-mail échappait à la neutralisation des textes et une
//     adresse comme « <svg onload=…>@x.io » passait le contrôle « a@b.c » → code exécuté dans
//     l'espace admin. Seuls les caractères réellement utilisés dans les adresses sont acceptés.
//  2. Adresses jetables (yopmail, mailinator…) refusées à l'inscription.
//  3. Domaine sans serveur de messagerie (inexistant) refusé à l'inscription.
//  4. Messages de contact notés : prospection commerciale, liens, arnaques → classés
//     « indésirable » (visibles dans l'admin, jamais supprimés), sans e-mail envoyé.
// Aucun service externe, aucune donnée transmise à un tiers.

var dns = require('dns');

// Caractères admis : lettres, chiffres, . _ % + - (partie locale) ; domaine en lettres/chiffres/tirets.
// Volontairement plus strict que la RFC : aucune apostrophe, guillemet, chevron ni espace.
var STRICT_EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9_%+-])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}$/i;

function normalizeEmail(v) {
    return String(v == null ? '' : v).trim().toLowerCase();
}
function isStrictEmail(v) {
    var e = normalizeEmail(v);
    return e.length <= 254 && STRICT_EMAIL_RE.test(e) && e.indexOf('..') === -1;
}
function emailDomain(v) {
    var e = normalizeEmail(v);
    var i = e.lastIndexOf('@');
    return i === -1 ? '' : e.slice(i + 1);
}

// Services d'adresses jetables les plus utilisés (comparaison sur le domaine et ses parents).
var DISPOSABLE_DOMAINS = [
    'yopmail.com', 'yopmail.fr', 'yopmail.net', 'cool.fr.nf', 'jetable.fr.nf', 'courriel.fr.nf', 'moncourrier.fr.nf', 'monemail.fr.nf', 'monmail.fr.nf',
    'jetable.org', 'jetable.com', 'jetable.net', 'mailinator.com', 'mailinator.net', 'mailinator2.com', 'reallymymail.com', 'notmailinator.com',
    'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz', 'guerrillamail.de', 'guerrillamailblock.com', 'sharklasers.com', 'grr.la', 'pokemail.net', 'spam4.me',
    '10minutemail.com', '10minutemail.net', '10minutemail.co.uk', '10minemail.com', '20minutemail.com', '20minutemail.it', 'minutemail.com',
    'temp-mail.org', 'temp-mail.io', 'tempmail.com', 'tempmail.net', 'tempmail.dev', 'tempmailo.com', 'tempmail.plus', 'tempmailaddress.com', 'tempinbox.com', 'tempr.email', 'temp-mail.ru',
    'throwawaymail.com', 'trashmail.com', 'trashmail.de', 'trashmail.net', 'trashmail.me', 'trashmail.at', 'trashmail.io', 'trash-mail.com', 'wegwerfmail.de', 'wegwerfmail.net', 'wegwerfemail.de',
    'dispostable.com', 'discard.email', 'discardmail.com', 'discardmail.de', 'spambog.com', 'spambog.de', 'spamgourmet.com', 'spamex.com', 'spamfree24.org', 'mytrashmail.com', 'mailnesia.com',
    'getnada.com', 'nada.email', 'getairmail.com', 'airmail.cc', 'maildrop.cc', 'mailcatch.com', 'mailnull.com', 'mintemail.com', 'mohmal.com', 'emailondeck.com', 'fakeinbox.com', 'fakemail.net',
    'mailpoof.com', 'mailtemp.info', 'moakt.com', 'moakt.cc', 'tmail.ws', 'tmails.net', 'tmpmail.org', 'tmpmail.net', 'tmpeml.com', 'tempail.com', 'burnermail.io', 'inboxkitten.com', 'mail.tm', 'mail.gw',
    'emailfake.com', 'email-fake.com', 'fakemailgenerator.com', 'generator.email', 'emailtemporanea.net', 'correotemporal.org', 'mailforspam.com', 'spamherelots.com', 'harakirimail.com',
    'mvrht.com', 'byom.de', 'mailbox52.ga', 'dropmail.me', '1secmail.com', '1secmail.net', '1secmail.org', 'esiix.com', 'wwjmp.com', 'xojxe.com', 'yoggm.com', 'rteet.com', 'dpptd.com',
    'linshiyouxiang.net', 'bccto.me', 'chacuo.net', 'mailto.plus', 'fexpost.com', 'fexbox.org', 'mymail.lol', 'rover.info', 'inbox.lv.fake', 'anonbox.net', 'anonymbox.com', 'mail-temp.com',
    'zetmail.com', 'emltmp.com', 'vomoto.com', 'spymail.one', 'mailsac.com', 'mailslurp.com', 'hidemail.de', 'incognitomail.org', 'kurzepost.de', 'objectmail.com', 'proxymail.eu', 'rcpt.at',
    'cuvox.de', 'dayrep.com', 'einrot.com', 'fleckens.hu', 'gustr.com', 'jourrapide.com', 'rhyta.com', 'superrito.com', 'teleworm.us', 'armyspy.com'
];
var _disposable = {};
DISPOSABLE_DOMAINS.forEach(function(d) { _disposable[d] = true; });
function isDisposableDomain(domain) {
    var d = String(domain || '').toLowerCase();
    while (d && d.indexOf('.') !== -1) {
        if (_disposable[d]) return true;
        d = d.slice(d.indexOf('.') + 1);
    }
    return false;
}

// Domaines/sous-domaines gratuits très prisés des envois de masse : pas bloquants seuls, mais
// comptent dans la note des messages de contact et sont signalés à l'admin.
// (.shop, .store, .online… exclus : de vrais commerces les utilisent pour leur messagerie.)
var SUSPICIOUS_SUFFIXES = ['.my.id', '.biz.id', '.web.id', '.xyz', '.top', '.click', '.icu', '.buzz', '.rest', '.monster', '.cfd', '.sbs', '.lol', '.quest', '.cyou', '.bond', '.tk', '.ml', '.ga', '.cf', '.gq'];
function isSuspiciousDomain(domain) {
    var d = '.' + String(domain || '').toLowerCase();
    for (var i = 0; i < SUSPICIOUS_SUFFIXES.length; i++) {
        var s = SUSPICIOUS_SUFFIXES[i];
        if (d.length > s.length && d.slice(-s.length) === s) return true;
    }
    return false;
}

// Le domaine reçoit-il du courrier ? (MX, à défaut A/AAAA comme le prévoit la norme SMTP.)
// Renvoie false SEULEMENT si le domaine n'existe pas / n'a aucune adresse : en cas de panne DNS ou
// de délai dépassé, on laisse passer (une vraie personne ne doit jamais être bloquée par une panne).
var _domainCache = {};
function domainAcceptsMail(domain, timeoutMs) {
    var d = String(domain || '').toLowerCase();
    if (!d) return Promise.resolve(false);
    var hit = _domainCache[d];
    if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return Promise.resolve(hit.ok);
    function settle(ok, cache) { if (cache) _domainCache[d] = { ok: ok, at: Date.now() }; return ok; }
    function missing(err) { return err && (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.code === 'NXDOMAIN'); }
    var lookup = dns.promises.resolveMx(d).then(function(mx) {
        if (mx && mx.length && !(mx.length === 1 && mx[0].exchange === '')) return settle(true, true);
        return settle(false, true); // « null MX » : le domaine déclare ne recevoir aucun courrier
    }).catch(function(err) {
        if (!missing(err)) return settle(true, false);
        return dns.promises.resolve4(d).then(function(a) { return settle(!!(a && a.length), true); })
            .catch(function(e2) { return missing(e2) ? settle(false, true) : settle(true, false); });
    });
    var timer = new Promise(function(resolve) { setTimeout(function() { resolve(true); }, timeoutMs || 3000).unref(); });
    return Promise.race([lookup, timer]);
}

// Contrôle commun aux inscriptions (clients et prestataires).
// Renvoie { ok:true, flags:[...] } ou { ok:false, error, code }.
function checkSignupEmail(email) {
    var e = normalizeEmail(email);
    if (!isStrictEmail(e)) {
        return Promise.resolve({ ok: false, code: 'email_format', error: 'Adresse e-mail invalide. Vérifiez qu’elle ne contient ni espace ni caractère spécial.' });
    }
    var domain = emailDomain(e);
    if (isDisposableDomain(domain)) {
        return Promise.resolve({ ok: false, code: 'email_disposable', error: 'Les adresses e-mail temporaires ne sont pas acceptées. Utilisez votre adresse habituelle.' });
    }
    return domainAcceptsMail(domain).then(function(ok) {
        if (!ok) return { ok: false, code: 'email_domain', error: 'Cette adresse e-mail ne peut pas recevoir de messages. Vérifiez le nom de domaine (après le @).' };
        var flags = [];
        if (isSuspiciousDomain(domain)) flags.push('Adresse e-mail sur un domaine peu fiable (' + domain + ')');
        return { ok: true, flags: flags };
    });
}

// ── Note des messages du formulaire de contact ──
// Liens explicites, ou domaine suivi d'un chemin (« site.online/fr/… ») ; une adresse e-mail
// citée dans le message (« x@gmail.com ») ou un simple nom de site sans chemin ne compte pas.
var URL_RE = /\b(?:https?:\/\/|www\.)[^\s]+|(?:^|[^@\w.-])[a-z0-9-]{2,}(?:\.[a-z0-9-]{2,})*\.[a-z]{2,12}\/[^\s]+/gi;
var PITCH_TERMS = [
    // Prospection / démarchage
    'démonstration', 'demonstration', 'marketplace', 'seo', 'référencement', 'backlink', 'netlinking', 'leads', 'prospects qualifiés', 'growth', 'agence web',
    'site web professionnel', 'refonte de votre site', 'first page of google', 'première page de google', 'rank your', 'boost your', 'increase your sales', 'augmenter vos ventes',
    'partenariat commercial', 'collaboration rémunérée', 'sponsored post', 'guest post', 'article sponsorisé', 'outreach', 'b2b',
    // Arnaques classiques
    'crypto', 'bitcoin', 'usdt', 'forex', 'trading', 'investissement garanti', 'guaranteed return', 'casino', 'paris sportifs', 'loan', 'prêt rapide', 'héritage', 'inheritance',
    'western union', 'moneygram', 'gift card', 'carte cadeau', 'whatsapp', 'telegram', 'wa.me', 't.me/', 'viagra', 'adult'
];
// Terme isolé : « seo » ne doit pas trouver « Séoul », ni « adult » « adulte ».
function _hasTerm(text, t) {
    var i = text.indexOf(t);
    while (i !== -1) {
        var before = i ? text.charAt(i - 1) : ' ', after = text.charAt(i + t.length) || ' ';
        if (!/[a-z0-9À-ɏ]/i.test(before) && !/[a-z0-9À-ɏ]/i.test(after)) return true;
        i = text.indexOf(t, i + 1);
    }
    return false;
}
function scoreContactMessage(m) {
    m = m || {};
    var text = [m.subject, m.message].join(' \n ').toLowerCase();
    var reasons = [], score = 0;
    var domain = emailDomain(m.email);
    var urls = (String(m.message || '').match(URL_RE) || []).filter(function(u) { return !/fagenesis\.com|fa-genesis/i.test(u); });
    if (urls.length) {
        score += urls.length > 1 ? 3 : 2;
        reasons.push(urls.length > 1 ? urls.length + ' liens externes' : 'lien externe');
        // Lien « personnalisé » à notre nom sur un site tiers : signature de la prospection automatisée.
        if (urls.some(function(u) { return /fa-?genesis/i.test(u); })) { score += 1; reasons.push('page tierce à notre nom'); }
    }
    var terms = [];
    PITCH_TERMS.forEach(function(t) { if (terms.length < 3 && _hasTerm(text, t)) terms.push(t); });
    if (terms.length) { score += Math.min(terms.length, 2); reasons.push('mots de démarchage (' + terms.join(', ') + ')'); }
    if (isDisposableDomain(domain)) { score += 3; reasons.push('adresse e-mail jetable'); }
    else if (isSuspiciousDomain(domain)) { score += 1; reasons.push('domaine e-mail peu fiable (' + domain + ')'); }
    if (/[Ѐ-ӿ]{6,}/.test(text) && !/[àâçéèêëîïôûùüÿœ]/.test(text)) { score += 1; reasons.push('texte en cyrillique'); }
    if (String(m.message || '').trim().length < 8) { score += 1; reasons.push('message vide'); }
    return { score: score, spam: score >= 3, reasons: reasons };
}

module.exports = {
    normalizeEmail: normalizeEmail,
    isStrictEmail: isStrictEmail,
    emailDomain: emailDomain,
    isDisposableDomain: isDisposableDomain,
    isSuspiciousDomain: isSuspiciousDomain,
    domainAcceptsMail: domainAcceptsMail,
    checkSignupEmail: checkSignupEmail,
    scoreContactMessage: scoreContactMessage
};
