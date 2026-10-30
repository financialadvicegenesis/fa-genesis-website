/**
 * LinkGuard — détection des liens de redirection externes et des coordonnées dans les textes
 * PUBLICS des prestataires (bio, prestations, légendes du portfolio).
 *
 * Fichier partagé : chargé par le serveur (require('./link-guard')) ET par app.html
 * (<script src="server/link-guard.js">), pour que l'app et le serveur appliquent exactement la
 * même règle. ES5 uniquement, sans lookbehind (non supporté par les WebView iOS < 16.4 : une
 * seule regex avec lookbehind ferait planter tout le script).
 *
 * Volontairement distinct de CONTOURNEMENT_PATTERNS (server.js, messagerie) : ici on NE bloque
 * PAS les simples mots « Instagram », « YouTube »… (« formé sur YouTube » est une phrase normale),
 * seulement ce qui permet réellement de quitter GENESIS : URL, domaine, lien raccourci, @compte,
 * e-mail, téléphone — y compris leurs formes déguisées (« monsite [.] com », « w w w », « point com »).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.LinkGuard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var MESSAGE_LINK = 'Pour garantir une expérience optimale et faciliter les échanges avec vos clients, vos réalisations doivent être présentées directement sur GENESIS. Les liens de redirection externes ne sont pas autorisés dans votre portfolio.';
    var MESSAGE_CONTACT = 'Pour garantir une expérience optimale et faciliter les échanges avec vos clients, vos coordonnées personnelles (téléphone, e-mail) ne peuvent pas figurer sur votre profil. Vos clients vous contactent via la messagerie GENESIS.';

    function toSet(list) { var o = {}; for (var i = 0; i < list.length; i++) o[list[i]] = true; return o; }

    // Extensions de domaine reconnues sans « http » ni « www ». Liste fermée : « v2.0 », « 12.50 »,
    // « logo.png » ou « Node.js » ne sont jamais pris pour des domaines. Exclues exprès car ce sont
    // aussi des extensions de fichier courantes chez les créatifs : .ai (Illustrator), .zip, .mov,
    // .sh, .cc, .so — elles restent détectées avec « http », « www » ou un chemin (« beacons.ai/x »).
    var TLDS = toSet(('com net org fr io co me ly gg tv app site shop store online info biz pro eu be ch ca uk '
        + 'de es it pt nl lu mc ma tn dz sn ci cm ga cg cd bj tg ml bf ne gn mg mu re gp mq us bio link page '
        + 'xyz ee li to gl gd ws la fm am art studio design photo photography events agency media live club '
        + 'world blog web tech digital space top vip one social email work fit beauty im in is at ly gy ga').split(' '));
    var PATH_ONLY_TLDS = toSet('ai zip mov sh cc so'.split(' '));
    // Extensions qui sont aussi des mots courts (fr/en) : un « .De » ou « . me » en début de phrase
    // mal espacée (« mes projets.De plus… ») n'est pas un lien.
    var AMBIGUOUS_TLDS = toSet('de es la me it to be ma ne am fm co pt ca ch us in is at re im ci ga'.split(' '));
    // Extensions « fortes » : toujours un domaine, même avec une majuscule (« Monsite.Com »).
    var STRONG_TLDS = toSet('com fr net org io'.split(' '));
    // Termes techniques qui ressemblent à des domaines.
    var ALLOWED_DOMAINS = toSet('asp.net vb.net ado.net fagenesis.com www.fagenesis.com'.split(' '));
    // Mots qui précèdent « point » dans des expressions ordinaires (« un point fort », « le point com… »).
    var POINT_STOP_WORDS = toSet('un le la au du ce mon ton son ma ta sa notre votre leur chaque ce dernier premier bon gros'.split(' '));

    var DOT_RE = '(?:\\s{0,2}\\.\\s{0,2}|\\s{0,2}[\\[\\(\\{]\\s{0,2}(?:\\.|dot|point|pt)\\s{0,2}[\\]\\)\\}]\\s{0,2})';
    var LABEL_RE = '[a-z0-9\\u00e0-\\u00ff](?:[a-z0-9\\u00e0-\\u00ff-]{0,61}[a-z0-9\\u00e0-\\u00ff])?';
    var BOUNDARY = '(^|[^a-z0-9\\u00e0-\\u00ff_@.-])';

    var PATTERNS = [
        // 1. Schéma explicite (http, https, hxxp, ftp), même déguisé « https : / / ».
        { kind: 'link', re: new RegExp('\\b(?:h(?:tt|xx)ps?|ftp)\\s{0,2}:?\\s{0,2}\\/\\s{0,2}\\/[^\\s<>"\']*', 'g') },
        // 2. « www » suivi d'un séparateur.
        { kind: 'link', re: new RegExp(BOUNDARY + '(www\\d?' + '(?:' + DOT_RE + '|\\s+(?:dot|point)\\s+|\\s)' + '[a-z0-9\\u00e0-\\u00ff-]+[^\\s<>"\']*)', 'g'), group: 2 },
        // 3. Domaine : « monsite.com », « bit.ly/x », « monsite [.] com », « monsite (dot) fr ».
        { kind: 'domain', re: new RegExp(BOUNDARY + '((?:' + LABEL_RE + DOT_RE + ')+)([a-z]{2,12})(?![a-z0-9\\u00e0-\\u00ff-])(\\/[^\\s<>"\']*)?', 'g') },
        // 4. « monsite point com » / « monsite dot fr » (en toutes lettres).
        { kind: 'link', re: new RegExp(BOUNDARY + '(' + LABEL_RE + ')\\s+(?:point|dot)\\s+(com|fr|net|org|io|ly|eu|xyz|app|site|online|store|shop|tv|biz)(?![a-z0-9\\u00e0-\\u00ff-])', 'g'), group: 2, check: 'point' },
        // 5. E-mail, y compris « nom [at] gmail », « nom arobase gmail ».
        { kind: 'contact', re: /[a-z0-9._%+-]+\s{0,2}(?:@|[\[\(\{]\s?(?:at|arobase)\s?[\]\)\}]|\s(?:at|arobase)\s)\s{0,2}[a-z0-9-]+(?:\s{0,2}(?:\.|[\[\(\{]\s?(?:dot|point)\s?[\]\)\}]|\s(?:dot|point)\s)\s{0,2}[a-z]{2,12})+/g, check: 'email' },
        // 6. @compte (Instagram, TikTok…).
        { kind: 'link', re: /(^|[\s(\[:,;«"'])@([a-z0-9_](?:[a-z0-9_.]{1,28}[a-z0-9_]))(?![a-z0-9_@-])/g, group: 0, check: 'handle' },
        // 7. « Insta : studio_x », « TikTok => @studio.x ». Le pseudo doit ressembler à un compte
        //    (@, _, . ou chiffre) : « YouTube : tutoriels » reste une phrase normale.
        { kind: 'link', re: /\b(instagram|insta|ig|tiktok|tik\s?tok|snapchat|snap|youtube|yt|facebook|fb|telegram|whatsapp|threads|twitter|linkedin|pinterest|twitch|discord|linktree|behance|dribbble|vimeo|calendly|fiverr|malt|upwork|booksy|planity|treatwell)\s{0,2}[:=>–—-]+\s{0,2}(@?[a-z0-9_.]{3,30})(?![a-z0-9_.])(\s+(?:abonn|follow|vue|view|like|j'aime|membre|fan|k\b))?/g, check: 'platformHandle' },
        // 8. Téléphone (FR + international), mêmes formats que la messagerie.
        { kind: 'contact', re: /(^|[^0-9])(0[1-9](?:[\s.-]?\d{2}){4})(?![0-9])/g, group: 2 },
        { kind: 'contact', re: /\+\s?\d{1,3}[\s.-]?(?:\d[\s.-]?){6,12}\d/g }
    ];

    // Texte « miroir » de même longueur que l'original (pour pouvoir masquer une portion précise) :
    // minuscules, chiffres/lettres pleine chasse ramenés en ASCII, points exotiques → « . »,
    // caractères invisibles → espace.
    function shadow(text) {
        var out = '';
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            var code = ch.charCodeAt(0);
            if (code >= 0xFF01 && code <= 0xFF5E) ch = String.fromCharCode(code - 0xFEE0);
            if (/[。．․‧∙·•・｡]/.test(ch)) ch = '.';
            else if (/[​-‍⁠﻿­]/.test(ch)) ch = ' ';
            else if (/[  -   　]/.test(ch)) ch = ' ';
            var low = ch.toLowerCase();
            out += low.length === 1 ? low : ch;
        }
        return out;
    }

    function isCapitalized(s) { return s.length > 1 && s.charAt(0) !== s.charAt(0).toLowerCase() && s.slice(1) === s.slice(1).toLowerCase(); }

    function acceptDomain(m, start, original) {
        var labels = m[2], tld = m[3], path = m[4] || '';
        var spaced = /\s/.test(labels);
        var bracketed = /[\[\(\{]/.test(labels);
        var tldStart = start + m[1].length + labels.length;
        var tldOrig = original.substr(tldStart, tld.length);
        var lastLabel = labels.replace(/[\s\[\]\(\)\{\}]|dot|point|pt/g, '').replace(/\.+$/, '').split('.').pop();
        if (!lastLabel || /^\d+$/.test(lastLabel)) return false;
        var plain = (labels.replace(/[\s\[\]\(\)\{\}]/g, '').replace(/dot|point|pt/g, '.').replace(/\.+/g, '.') + tld);
        if (ALLOWED_DOMAINS[plain]) return false;
        if (PATH_ONLY_TLDS[tld]) return path.length > 1;
        if (!TLDS[tld]) return false;
        if (path.length > 1 || bracketed) return true;
        if (spaced) {
            // « monsite . com » : seulement en minuscules et hors mots courts (« fin . De plus »).
            return tldOrig === tld && !AMBIGUOUS_TLDS[tld];
        }
        // Domaine collé : une majuscule après le point signale plutôt une phrase mal espacée.
        if (!STRONG_TLDS[tld] && (isCapitalized(tldOrig) || (AMBIGUOUS_TLDS[tld] && tldOrig !== tld))) return false;
        return true;
    }

    function acceptMatch(p, m, start, original) {
        if (p.kind === 'domain') return acceptDomain(m, start, original);
        if (p.check === 'point') return !POINT_STOP_WORDS[m[2]];
        if (p.check === 'email') {
            var tail = m[0].replace(/\s/g, '').split(/\.|\]|\)|\}|dot|point/).pop();
            return !!TLDS[tail] || !!PATH_ONLY_TLDS[tail];
        }
        if (p.check === 'platformHandle') {
            var h = m[2];
            if (m[3]) return false; // « Instagram : 12k abonnés »
            if (/^[\d.,]+k?$/.test(h)) return false;
            return h.charAt(0) === '@' || /[_.\d]/.test(h);
        }
        return true;
    }

    // Toutes les portions suspectes : [{ start, end, kind: 'link'|'contact' }].
    function scan(text) {
        if (!text || typeof text !== 'string') return [];
        var original = text;
        var s = shadow(text);
        var hits = [];
        function run(str, offsetMap) {
            for (var i = 0; i < PATTERNS.length; i++) {
                var p = PATTERNS[i];
                p.re.lastIndex = 0;
                var m;
                while ((m = p.re.exec(str)) !== null) {
                    if (m[0].length === 0) { p.re.lastIndex++; continue; }
                    var start = m.index;
                    var matchText = m[0];
                    if (p.group === 2 || (p.kind === 'domain')) {
                        var pre = m[1] || '';
                        start = m.index + pre.length;
                        matchText = m[0].slice(pre.length);
                    } else if (p.check === 'handle') {
                        var lead = m[1] || '';
                        start = m.index + lead.length;
                        matchText = m[0].slice(lead.length);
                    }
                    if (!acceptMatch(p, m, m.index, offsetMap ? str : original)) {
                        p.re.lastIndex = m.index + 1;
                        continue;
                    }
                    var end = start + matchText.replace(/[\s.,;:!?)\]}»"']+$/, '').length;
                    if (offsetMap) { start = offsetMap[start]; end = offsetMap[end - 1] + 1; }
                    hits.push({ start: start, end: end, kind: p.kind === 'domain' ? 'link' : p.kind });
                }
            }
        }
        run(s, null);
        // Lettres espacées une à une : « w w w . m o n s i t e . c o m », « h t t p s : / / ».
        var spacedRe = /(?:[a-z0-9.:\/@]\s){4,}[a-z0-9.:\/@]/g, sm;
        while ((sm = spacedRe.exec(s)) !== null) {
            var collapsed = '', map = [];
            for (var k = 0; k < sm[0].length; k++) {
                if (sm[0].charAt(k) !== ' ') { map.push(sm.index + k); collapsed += sm[0].charAt(k); }
            }
            map.push(sm.index + sm[0].length);
            var before = hits.length;
            run(collapsed, map);
            if (hits.length > before) {
                hits.splice(before, hits.length - before, { start: sm.index, end: sm.index + sm[0].length, kind: hits[before].kind });
            }
        }
        hits.sort(function (a, b) { return a.start - b.start; });
        return hits;
    }

    // null si le texte est propre, sinon 'link' ou 'contact' (le lien prime pour le message).
    function check(text) {
        var hits = scan(text);
        if (!hits.length) return null;
        // Un e-mail contient un domaine (« gmail.com ») : ce domaine-là ne compte pas comme lien.
        var contacts = hits.filter(function (h) { return h.kind === 'contact'; });
        for (var i = 0; i < hits.length; i++) {
            var h = hits[i];
            if (h.kind !== 'link') continue;
            var inside = contacts.some(function (c) { return h.start >= c.start && h.end <= c.end; });
            if (!inside) return 'link';
        }
        return 'contact';
    }

    function messageFor(kind) { return kind === 'contact' ? MESSAGE_CONTACT : MESSAGE_LINK; }

    // Texte affichable aux clients : les portions suspectes sont retirées, le reste est conservé
    // (la donnée d'origine reste intacte en base — c'est uniquement l'affichage qui est masqué).
    function redact(text) {
        if (!text || typeof text !== 'string') return text;
        var hits = scan(text);
        if (!hits.length) return text;
        var out = '', pos = 0;
        for (var i = 0; i < hits.length; i++) {
            if (hits[i].start < pos) { pos = Math.max(pos, hits[i].end); continue; }
            var before = text.slice(pos, hits[i].start);
            // « m o n s i t e point com » : retirer aussi les lettres espacées qui précèdent.
            var spacedTail = before.match(/(?:^|\s)((?:\S ){3,})$/);
            if (spacedTail) before = before.slice(0, before.length - spacedTail[1].length);
            out += before;
            pos = hits[i].end;
        }
        out += text.slice(pos);
        out = out.replace(/[ \t]{2,}/g, ' ').replace(/\s*[:–—>-]+\s*$/, '').replace(/[ \t]+([,.;:!?])/g, '$1').replace(/:(?=[,.;!?])/g, '').trim();
        // Sécurité : si un reste déguisé subsiste malgré tout, on masque le champ entier.
        return scan(out).length ? '' : out;
    }

    return { scan: scan, check: check, redact: redact, messageFor: messageFor, MESSAGE_LINK: MESSAGE_LINK, MESSAGE_CONTACT: MESSAGE_CONTACT };
});
