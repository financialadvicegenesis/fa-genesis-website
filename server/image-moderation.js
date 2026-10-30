/**
 * Modération automatique des images des prestataires (portfolio + photo de prestation).
 *
 * Tout se passe SUR NOTRE SERVEUR : OCR Tesseract (tesseract.js, modèles fra+eng embarqués dans
 * server/tessdata), lecture des QR codes (jsQR), décodage/préparation des images (sharp). Aucune
 * image n'est envoyée à un service tiers.
 *
 * Trois verdicts :
 *  - 'blocked'  : coordonnées manifestement destinées à faire sortir le client de GENESIS
 *                 (@compte, lien de réseau social/messagerie, téléphone ou e-mail présenté comme
 *                 moyen de contact, ou identifiant du prestataire lui-même) → refus immédiat, le
 *                 prestataire téléverse une version corrigée.
 *  - 'review'   : cas incertain (site web quelconque — ex. affiche réalisée pour un client —,
 *                 QR code externe, texte suspect mal lu, mention seule de WhatsApp…, ou analyse
 *                 impossible) → enregistrée mais JAMAIS publiée avant validation humaine (admin).
 *  - 'approved' : rien de suspect → publiée. Un texte ordinaire (affiche, logo, maquette) n'est
 *                 jamais un motif de refus en soi : seuls les liens/coordonnées comptent.
 *
 * Fail-closed : si l'OCR ne peut pas tourner (dépendance absente, erreur, délai dépassé), le
 * verdict est 'review', jamais 'approved'. Coupe-circuit d'urgence (ex. mémoire saturée sur
 * Render) : IMAGE_MODERATION_DISABLED=1 → plus d'analyse, images publiées comme avant.
 */
'use strict';

var path = require('path');
var crypto = require('crypto');
var LinkGuard = require('./link-guard');

var MESSAGE_BLOCKED = 'Cette image semble contenir des coordonnées ou des informations de redirection vers une plateforme externe. Pour préserver les échanges au sein de GENESIS, veuillez téléverser une version sans ces éléments.';
var MESSAGE_REVIEW = 'Votre image est en cours de vérification par l\'équipe GENESIS. Elle sera visible par les clients dès sa validation.';

var STRONG_CONFIDENCE = 70;      // en dessous : texte mal lu → vérification humaine, pas de refus auto
var ANALYSIS_TIMEOUT_MS = 45000;
var WORKER_IDLE_MS = 5 * 60 * 1000; // libère ~100 Mo de mémoire quand personne n'envoie d'image
var MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// Liens/comptes de réseaux sociaux, messageries et prises de rendez-vous externes.
var SOCIAL_RE = /(instagram|insta\b|tiktok|snapchat|snap\b|facebook|fb\.|wa\.me|whats\s?app|t\.me|telegram|linktr|linkin\.bio|lnk\.bio|beacons|calendly|youtube|youtu\.be|threads|twitter|x\.com|discord|messenger|m\.me|signal\.me|wechat|viber|planity|treatwell|booksy)/i;
// Mots qui présentent un numéro / un e-mail comme un moyen de contact.
var CONTACT_KW_RE = /(whats\s?app|telegram|signal|viber|wechat|snap|appel|appelez|t[ée]l[ée]phone|\bt[ée]l\b|\bcontact|\bdm\b|\bmp\b|[ée]cri[st]|[ée]crivez|r[ée]serv|devis|\bmail|e-mail|joindre|whatsapp)/i;
var APP_MENTION_RE = /\b(whats\s?app|telegram|snapchat|signal|wechat|viber|linktree)\b/i;
var GENESIS_RE = /fagenesis\.com/i;

var _sharp = null, _jsQR = null, _Tesseract = null, _depsError = null;
function deps() {
    if (_sharp || _depsError) return !_depsError;
    try {
        _sharp = require('sharp');
        _jsQR = require('jsqr');
        _Tesseract = require('tesseract.js');
    } catch (e) {
        _depsError = e;
        console.error('[IMAGE-MOD] Dépendances OCR indisponibles — toutes les images passeront en vérification :', e.message);
    }
    return !_depsError;
}

// ── Worker OCR unique, créé à la demande, détruit après inactivité ──
var _workerPromise = null, _idleTimer = null, _queue = Promise.resolve();
function getWorker() {
    if (!_workerPromise) {
        var dir = path.join(__dirname, 'tessdata');
        _workerPromise = _Tesseract.createWorker(['fra', 'eng'], 1, { langPath: dir, cachePath: dir, cacheMethod: 'readOnly', gzip: false })
            .catch(function (e) { _workerPromise = null; throw e; });
    }
    return _workerPromise;
}
function scheduleIdle() {
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = setTimeout(function () {
        var wp = _workerPromise; _workerPromise = null;
        if (wp) wp.then(function (w) { return w.terminate(); }).catch(function () {});
    }, WORKER_IDLE_MS);
    if (_idleTimer.unref) _idleTimer.unref();
}
// Une seule analyse à la fois (le serveur Render n'a qu'un demi-cœur) : file d'attente.
function serialize(fn) {
    var run = _queue.then(fn, fn);
    _queue = run.catch(function () {});
    return run;
}
function withTimeout(p, ms) {
    return new Promise(function (resolve, reject) {
        var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
        p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
}

// ── Cache des verdicts (empreinte de l'image) : l'app vérifie l'image dès sa sélection, puis
// l'enregistrement réutilise le verdict sans refaire l'OCR. Le serveur ne fait JAMAIS confiance
// à un statut envoyé par l'app : il recalcule (ou relit ce cache, qui est le sien). ──
var _cache = new Map();
function cacheKey(dataUri, partnerId) { return crypto.createHash('sha256').update(String(partnerId || '') + '|' + dataUri).digest('hex'); }
function cacheGet(k) { var v = _cache.get(k); if (v && Date.now() - v.t < 6 * 3600 * 1000) return v.r; _cache.delete(k); return null; }
function cacheSet(k, r) { _cache.set(k, { t: Date.now(), r: r }); if (_cache.size > 300) _cache.delete(_cache.keys().next().value); }

function parseDataUri(dataUri) {
    var m = /^data:image\/(jpe?g|png|webp|heic|heif|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUri || ''));
    if (!m) return null;
    var buf = Buffer.from(m[2], 'base64');
    if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
    return buf;
}

// Corrige les confusions OCR courantes dans les suites de chiffres (« O6 l2 34 S6 78 »).
function digitLookalikes(text) {
    return text.replace(/[0-9OoIlSB|][0-9OoIlSB|\s.\-]{7,}[0-9OoIlSB|]/g, function (s) {
        var digits = (s.match(/[0-9]/g) || []).length;
        if (digits < 5) return s;
        return s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/B/g, '8');
    });
}

function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
function identityTokens(partner) {
    var out = [];
    if (!partner) return out;
    [partner.prenom, partner.nom, partner.company, partner.company_name, partner.business_name].forEach(function (v) {
        String(v || '').split(/[\s\-']+/).forEach(function (w) { var n = norm(w); if (n.length >= 3) out.push(n); });
    });
    var local = String(partner.email || '').split('@')[0];
    local.split(/[._\-+]+/).forEach(function (w) { var n = norm(w); if (n.length >= 4 && !/^\d+$/.test(n)) out.push(n); });
    return out.filter(function (v, i, a) { return a.indexOf(v) === i; });
}
function phoneTail(s) { var d = String(s || '').replace(/\D/g, ''); return d.length >= 8 ? d.slice(-9) : null; }

// Analyse une ligne OCR (mots + confiances) : renvoie les correspondances avec leur confiance.
function scanLine(words) {
    var hits = [];
    if (!words.length) return hits;
    var text = '', spans = [];
    words.forEach(function (w) {
        if (text) text += ' ';
        spans.push({ start: text.length, end: text.length + w.text.length, conf: w.confidence });
        text += w.text;
    });
    var alt = digitLookalikes(text);
    [text, alt].forEach(function (variant, vi) {
        if (vi === 1 && alt === text) return;
        LinkGuard.scan(variant).forEach(function (h) {
            if (vi === 1 && hits.some(function (x) { return x.value === variant.slice(h.start, h.end); })) return;
            var conf = 100;
            spans.forEach(function (sp) { if (sp.end > h.start && sp.start < h.end) conf = Math.min(conf, sp.conf); });
            hits.push({ kind: h.kind, value: variant.slice(h.start, h.end), conf: Math.round(conf), line: text, lookalike: vi === 1 });
        });
    });
    return hits;
}

function linesOf(data) {
    var lines = [];
    (data.lines || []).forEach(function (l) {
        var words = (l.words || []).filter(function (w) { return w.text && w.text.trim(); }).map(function (w) { return { text: w.text.trim(), confidence: w.confidence || 0 }; });
        if (words.length) lines.push(words);
    });
    if (!lines.length && data.text) {
        data.text.split('\n').forEach(function (t) {
            var words = t.split(/\s+/).filter(Boolean).map(function (w) { return { text: w, confidence: data.confidence || 0 }; });
            if (words.length) lines.push(words);
        });
    }
    return lines;
}

// Décide du verdict à partir du texte OCR et des QR codes. Exportée pour les tests.
function evaluate(passes, qrs, partner) {
    var reasons = [];
    var tokens = identityTokens(partner);
    var myPhone = phoneTail(partner && (partner.telephone || partner.phone));
    var myEmail = String((partner && partner.email) || '').toLowerCase();
    var blocked = false, review = false;
    var allText = [];

    passes.forEach(function (data) {
        linesOf(data).forEach(function (words) {
            var lineText = words.map(function (w) { return w.text; }).join(' ');
            allText.push(lineText);
            scanLine(words).forEach(function (h) {
                var v = h.value.toLowerCase();
                var nv = norm(v);
                var identity = tokens.some(function (t) { return nv.indexOf(t) !== -1; })
                    || (myPhone && phoneTail(v) === myPhone)
                    || (myEmail && v.replace(/\s/g, '').indexOf(myEmail) !== -1);
                var social = v.charAt(0) === '@' || SOCIAL_RE.test(v) || /^[a-z]+\s*[:=>]/.test(v) && SOCIAL_RE.test(v.split(/[:=>]/)[0]);
                var contactCalled = h.kind === 'contact' && CONTACT_KW_RE.test(h.line);
                var strong = identity || social || contactCalled || (h.kind === 'link' && /^@/.test(v));
                var confident = h.conf >= STRONG_CONFIDENCE && !h.lookalike;
                if (GENESIS_RE.test(v)) return;
                if (strong && confident) {
                    blocked = true;
                    reasons.push({ code: identity ? 'identity' : (h.kind === 'contact' ? 'contact' : 'social'), value: h.value, conf: h.conf });
                } else {
                    review = true;
                    reasons.push({ code: confident ? (h.kind === 'contact' ? 'contact_unclear' : 'url') : 'low_confidence', value: h.value, conf: h.conf });
                }
            });
            if (APP_MENTION_RE.test(lineText) && !reasons.length) {
                review = true;
                reasons.push({ code: 'mention', value: (lineText.match(APP_MENTION_RE) || [''])[0], conf: null });
            }
        });
    });
    (qrs || []).forEach(function (q) {
        if (!q || GENESIS_RE.test(q)) return;
        review = true;
        reasons.push({ code: 'qr', value: String(q).slice(0, 200), conf: null });
    });
    var status = blocked ? 'blocked' : (review ? 'review' : 'approved');
    // Les deux passes OCR lisent souvent la même chose : un seul motif par valeur, le plus grave
    // d'abord (ce que l'admin et le prestataire voient).
    var rank = { identity: 0, social: 1, contact: 2, qr: 3, url: 4, contact_unclear: 5, mention: 6, low_confidence: 7 };
    reasons.sort(function (x, y) { return (rank[x.code] || 9) - (rank[y.code] || 9); });
    var seen = {};
    reasons = reasons.filter(function (x) { var k = String(x.value || '').toLowerCase(); if (seen[k]) return false; seen[k] = true; return true; });
    return { status: status, reasons: reasons.slice(0, 8), text: allText.join(' / ').replace(/\s+/g, ' ').slice(0, 400) };
}

async function readQr(buf) {
    var found = [];
    for (var size of [1000, 1800]) {
        var raw = await _sharp(buf).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
            .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        var qr = _jsQR(new Uint8ClampedArray(raw.data.buffer, raw.data.byteOffset, raw.data.length), raw.info.width, raw.info.height);
        if (qr && qr.data && found.indexOf(qr.data) === -1) found.push(qr.data);
        if (found.length) break;
    }
    return found;
}

async function runAnalysis(buf, partner) {
    var meta = await _sharp(buf).metadata();
    if (!meta || !meta.width || !meta.height) throw new Error('image illisible');
    var pre = await _sharp(buf).rotate().flatten({ background: '#ffffff' })
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .grayscale().normalize().png().toBuffer();
    var worker = await getWorker();
    // Deux passes : mise en page automatique (affiches, textes en blocs) + texte épars (texte
    // incrusté sur une photo) — chacune rattrape ce que l'autre rate.
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
    var a = await worker.recognize(pre);
    await worker.setParameters({ tessedit_pageseg_mode: '11' });
    var b = await worker.recognize(pre);
    var qrs = await readQr(buf);
    return evaluate([a.data, b.data], qrs, partner);
}

/**
 * Analyse une image (data URI) pour un prestataire.
 * → { status: 'approved'|'review'|'blocked'|'invalid', reasons, text, ms, analyzedAt }
 */
function analyzeImage(dataUri, partner) {
    var started = Date.now();
    function done(r) { r.ms = Date.now() - started; r.analyzedAt = new Date().toISOString(); return r; }
    if (process.env.IMAGE_MODERATION_DISABLED === '1') return Promise.resolve(done({ status: 'approved', reasons: [{ code: 'disabled' }], text: '' }));
    var buf = parseDataUri(dataUri);
    if (!buf) return Promise.resolve(done({ status: 'invalid', reasons: [{ code: 'invalid_image' }], text: '' }));
    var key = cacheKey(dataUri, partner && partner.id);
    var cached = cacheGet(key);
    if (cached) return Promise.resolve(Object.assign({}, cached, { cached: true }));
    if (!deps()) return Promise.resolve(done({ status: 'review', reasons: [{ code: 'ocr_unavailable' }], text: '' }));
    return serialize(function () {
        return withTimeout(runAnalysis(buf, partner), ANALYSIS_TIMEOUT_MS);
    }).then(function (r) {
        scheduleIdle();
        r = done(r);
        cacheSet(key, r);
        return r;
    }).catch(function (e) {
        scheduleIdle();
        var invalid = /illisible|unsupported image|Input buffer/i.test(e.message || '');
        console.error('[IMAGE-MOD] Analyse impossible :', e.message);
        return done(invalid ? { status: 'invalid', reasons: [{ code: 'invalid_image' }], text: '' }
                            : { status: 'review', reasons: [{ code: 'ocr_error', value: String(e.message || '').slice(0, 120) }], text: '' });
    });
}

module.exports = {
    analyzeImage: analyzeImage,
    evaluate: evaluate,
    MESSAGE_BLOCKED: MESSAGE_BLOCKED,
    MESSAGE_REVIEW: MESSAGE_REVIEW,
    _shutdown: function () { var wp = _workerPromise; _workerPromise = null; return wp ? wp.then(function (w) { return w.terminate(); }) : Promise.resolve(); }
};
