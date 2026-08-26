/**
 * FA GENESIS - Backend Node.js pour Integration SumUp
 *
 * SECURITE:
 * - La cle API SumUp est stockee dans .env (jamais dans le code)
 * - Les prix sont calcules cote serveur (jamais envoyes par le front)
 * - Les webhooks SumUp sont verifies avant mise a jour
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');

const { getProductById, calculatePaymentAmounts, getAmountForStage, generateInstallments, generateGenesisSplit, generateUserInstallmentPlan, validateInstallments, CLIENT_TYPE_MAX_INSTALLMENTS } = require('./products');
const contractService = require('./contracts');
const emailService = require('./email-service');
const { OFFER_BLUEPRINTS, getOfferBlueprint, getAllOfferKeys } = require('./config/offerBlueprints');
const { fillTemplate, getAvailableTemplates, getTemplate } = require('./config/documentTemplates');
const aiService = require('./services/aiService');
const bootstrapService = require('./services/bootstrapService');
const mps = require('./services/marketplace-payment-service');
const payoutRouting = require('./services/payout-routing-service');
const payoneerProvider = require('./services/payoneer-provider');
const persistentStore = require('./persistent-store');
const webpush = require('web-push');

// Firebase Admin SDK — optionnel ; utilisé pour les push FCM vers l'app Android native.
// Activer en ajoutant FIREBASE_SERVICE_ACCOUNT (JSON stringifié) dans les variables d'env Render.
var firebaseAdmin = null;
(function() {
    try {
        var svcAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!svcAccount) { console.log('[FCM] FIREBASE_SERVICE_ACCOUNT absent — push FCM désactivé'); return; }
        var admin = require('firebase-admin');
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(svcAccount)) });
        firebaseAdmin = admin;
        console.log('[FCM] firebase-admin initialisé ✓');
    } catch(e) { console.error('[FCM] Erreur init firebase-admin:', e.message); }
})();

const app = express();
const PORT = process.env.PORT || 3001;

// Render (et la plupart des PaaS) place l'app derriere un reverse proxy : sans ce
// reglage, req.ip renvoie l'IP interne du proxy pour TOUTES les requetes (identique
// pour tout le monde), ce qui rend le rate-limiting par IP global au lieu d'etre
// par utilisateur — un seul utilisateur epuise alors le quota de tout le monde.
app.set('trust proxy', 1);

// ============================================================
// CONFIGURATION
// ============================================================

const SUMUP_API_BASE = 'https://api.sumup.com/v0.1';
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const PARTNERS_FILE = path.join(__dirname, 'data', 'partners.json');
const PARTNER_ASSIGNMENTS_FILE = path.join(__dirname, 'data', 'partner-assignments.json');
const PARTNER_UPLOADS_FILE = path.join(__dirname, 'data', 'partner-uploads.json');
const PARTNER_COMMENTS_FILE = path.join(__dirname, 'data', 'partner-comments.json');
const QUOTES_FILE = path.join(__dirname, 'data', 'quotes.json');
const PROJECTS_FILE = path.join(__dirname, 'data', 'projects.json');
const FEEDBACKS_FILE = path.join(__dirname, 'data', 'feedbacks.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');
const RESERVATIONS_FILE = path.join(__dirname, 'data', 'reservations.json');
const BLOCKED_DATES_FILE = path.join(__dirname, 'data', 'blocked-dates.json');
const CW_MESSAGES_FILE = path.join(__dirname, 'data', 'cw-messages.json');
const CW_DEVIS_FILE = path.join(__dirname, 'data', 'cw-devis.json');
const PUSH_SUBSCRIPTIONS_FILE = path.join(__dirname, 'data', 'push-subscriptions.json');
const DISPATCHES_FILE = path.join(__dirname, 'data', 'dispatches.json');
const PARTNER_REQUESTS_FILE = path.join(__dirname, 'data', 'partner_requests.json');
const PAYOUTS_FILE    = path.join(__dirname, 'data', 'payouts.json');
const PARTNER_REVIEWS_FILE = path.join(__dirname, 'data', 'partner_reviews.json');
const HALL_OF_FAME_FILE = path.join(__dirname, 'data', 'hall_of_fame.json');
const EVENTS_FILE = path.join(__dirname, 'data', 'events.json');
const JEREMIE_MEMORY_FILE = path.join(__dirname, 'data', 'jeremie_memory.json');
const PROMOTIONS_FILE     = path.join(__dirname, 'data', 'promotions.json');
const ADMIN_SESSIONS_FILE = path.join(__dirname, 'data', 'admin_sessions.json');
const NOTIFICATIONS_FILE = path.join(__dirname, 'data', 'notifications.json');
const DISPUTES_FILE = path.join(__dirname, 'data', 'disputes.json');
const PROSPECTS_FILE = path.join(__dirname, 'data', 'prospects.json');
const CAMPAGNES_FILE = path.join(__dirname, 'data', 'campagnes.json');
const SCHEDULED_NOTIFS_FILE = path.join(__dirname, 'data', 'scheduled_notifs.json');
const GENESIS_PROJECTS_FILE = path.join(__dirname, 'data', 'genesis_projects.json');
const CONTRACTS_FILE = path.join(__dirname, 'data', 'contracts.json');
const ACTUALITES_FILE = path.join(__dirname, 'data', 'actualites.json');
const FCM_TOKENS_FILE = path.join(__dirname, 'data', 'fcm_tokens.json');

// Catégories de partenaires marketplace (source unique, partagée par inscription + admin)
const PARTNER_TYPES = [
    { value: 'photographer', label: 'Photographe' },
    { value: 'videographer', label: 'Vidéaste' },
    { value: 'marketer', label: 'Marketeur' },
    { value: 'media', label: 'Média' },
    { value: 'community_manager', label: 'Community Manager' },
    { value: 'graphiste', label: 'Graphiste' },
    { value: 'developpeur_web', label: 'Développeur Web' },
    { value: 'pilote_drone', label: 'Pilote Drone' },
    { value: 'consultant', label: 'Consultant' },
    { value: 'coworking', label: 'Espace Coworking' },
    { value: 'animateur_evenementiel', label: 'Animateur / Événementiel' },
    { value: 'influencer', label: 'Influenceur / Influenceuse' },
    { value: 'other', label: 'Autre' }
];
const PARTNER_TYPE_VALUES = PARTNER_TYPES.map(t => t.value);

// Tarifs deja en place aujourd'hui (catalogue fige admin) pour les categories qui basculent
// vers l'auto-gestion : pre-remplir les prestations du partenaire a l'inscription avec ses
// vrais tarifs actuels, plutot que de le faire tout ressaisir depuis zero.
const LEGACY_SERVICE_CATALOG = {
    marketer: [
        { label: 'Marketing EXPRESS', description: 'Audit marketing rapide et recommandations', price: 120, audience: 'particulier' },
        { label: 'Marketing STRATEGY', description: 'Stratégie marketing complète', price: 150, audience: 'particulier' },
        { label: 'Marketing IMPACT', description: 'Accompagnement marketing intensif', price: 350, audience: 'particulier' },
        { label: 'Marketing DIGITALES', description: 'Option digitale en complément de Marketing STRATEGY', price: 70, audience: 'particulier' }
    ],
    media: [
        { label: 'Média SIMPLE', description: 'Accès à un média crédible pour une première visibilité', price: 55, audience: 'particulier' },
        { label: 'Média VISIBILITY', description: 'Pack visibilité médiatique', price: 223, audience: 'particulier' },
        { label: 'Média IMPACT', description: 'Campagne média pour maximiser votre impact', price: 420, audience: 'particulier' },
        { label: 'Média PREMIUM', description: 'Package média premium complet', price: 590, audience: 'particulier' },
        { label: 'Média PROMOTION', description: 'Promotion médiatique ciblée', price: 679, audience: 'particulier' }
    ],
    coworking: [
        { label: 'OpenSpace Étudiant (par jour)', description: 'Accès espace de coworking ouvert', price: 10, audience: 'etudiant' },
        { label: 'OpenSpace Particulier (par jour)', description: 'Accès espace de coworking ouvert', price: 15, audience: 'particulier' },
        { label: 'OpenSpace Entreprise (par jour)', description: 'Accès espace de coworking ouvert', price: 25, audience: 'entreprise' },
        { label: 'Bureau Privé Particulier (par jour)', description: 'Bureau privé', price: 45, audience: 'particulier' },
        { label: 'Bureau Privé Entreprise (par jour)', description: 'Bureau privé', price: 85, audience: 'entreprise' },
        { label: 'Événement Étudiant (format 4h)', description: 'Location de salle pour événement', price: 200, audience: 'etudiant' },
        { label: 'Événement Particulier (format 4h)', description: 'Location de salle pour événement', price: 300, audience: 'particulier' },
        { label: 'Événement Entreprise (format 4h)', description: 'Location de salle pour événement', price: 375, audience: 'entreprise' }
    ]
};

// Creer le dossier data s'il n'existe pas
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// ============================================================
// ANTI-SPAM - Rate limiting et validation des soumissions
// ============================================================

var _rateCache = {};
function checkRateLimit(ip, action, maxReqs, windowMs) {
    var key = ip + ':' + action;
    var now = Date.now();
    if (!_rateCache[key]) _rateCache[key] = [];
    _rateCache[key] = _rateCache[key].filter(function(t) { return now - t < windowMs; });
    if (_rateCache[key].length >= maxReqs) return false;
    _rateCache[key].push(now);
    return true;
}
setInterval(function() {
    var now = Date.now();
    Object.keys(_rateCache).forEach(function(k) {
        _rateCache[k] = (_rateCache[k] || []).filter(function(t) { return now - t < 3600000; });
        if (!_rateCache[k].length) delete _rateCache[k];
    });
}, 3600000);

// Verifie le header x-admin-key contre ADMIN_KEY — echoue FERME si ADMIN_KEY n'est pas configuree
// (sans ce garde-fou, "undefined === undefined" laisserait passer n'importe quelle requete sans header)
function isValidAdminKey(req) {
    var configured = process.env.ADMIN_KEY;
    var provided = req.headers['x-admin-key'];
    if (!configured || !provided) return false;
    var a = Buffer.from(String(configured));
    var b = Buffer.from(String(provided));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

// Vérifie si la requête vient d'un admin (session admin OU JWT admin OU x-admin-key)
function _isAdminRequest(req) {
    if (isValidAdminKey(req)) return true;
    var tok = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!tok) return false;
    try { var dec = _jwt.verify(tok, _JWT_SECRET); if (dec && dec.role === 'admin') return true; } catch(e) {}
    try { var sessions = loadAdminSessions(); if (sessions.find(function(s) { return s.token === tok; })) return true; } catch(e) {}
    return false;
}

// Detecte si un nom ressemble a une chaine aleatoire generee par un bot
function isSpamName(name) {
    if (!name || name.length < 2) return false;
    // Seuls les lettres, espaces, tirets et apostrophes sont autorises
    if (!/^[a-zA-Z\u00C0-\u024F\-' ]+$/.test(name)) return true;
    var words = name.trim().split(/[\s\-]+/);
    for (var wi = 0; wi < words.length; wi++) {
        var w = words[wi];
        // Un mot de plus de 16 caracteres est suspect (peu de noms reels depassent ca)
        if (w.length > 16) return true;
        // Dans un mot de 7+ lettres, plus de 5 consonnes consecutives = chaine aleatoire
        if (w.length >= 7) {
            var maxRun = 0, run = 0;
            var lower = w.toLowerCase();
            for (var ci = 0; ci < lower.length; ci++) {
                if (/[aeiouy\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u00f9\u00fb\u00fc]/.test(lower[ci])) {
                    run = 0;
                } else if (/[a-z\u00c0-\u024f]/.test(lower[ci])) {
                    run++;
                    if (run > maxRun) maxRun = run;
                }
            }
            if (maxRun > 5) return true;
        }
    }
    return false;
}

// ============================================================
// HELPERS - STOCKAGE DES UTILISATEURS
// ============================================================

function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Erreur lecture users:', error);
    }
    return [];
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
        persistentStore.persistToCloud('users', users).catch(function(e) {});
    } catch (error) {
        console.error('Erreur sauvegarde users:', error);
    }
}

function getUserByEmail(email) {
    const users = loadUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function generateSessionToken() {
    return uuidv4() + '-' + Date.now();
}

// JWT-first token helpers: tokens survive Render redeploys (verified via secret, no DB lookup)
var _jwt = require('jsonwebtoken');
var _JWT_SECRET = process.env.JWT_SECRET || 'fa-genesis-secret-key';

function findUserByToken(token) {
    if (!token) return null;
    try {
        var decoded = _jwt.verify(token, _JWT_SECRET);
        if (decoded && decoded.id) return loadUsers().find(function(u) { return u.id === decoded.id; }) || null;
        if (decoded && decoded.email) return loadUsers().find(function(u) { return u.email === decoded.email.toLowerCase(); }) || null;
    } catch(e) {}
    return loadUsers().find(function(u) { return u.sessionToken === token; }) || null;
}

function findPartnerByToken(token) {
    if (!token) return null;
    try {
        var decoded = _jwt.verify(token, _JWT_SECRET);
        if (decoded && decoded.id) return loadPartners().find(function(p) { return p.id === decoded.id; }) || null;
        if (decoded && decoded.email) return loadPartners().find(function(p) { return p.email === decoded.email.toLowerCase(); }) || null;
    } catch(e) {}
    return loadPartners().find(function(p) { return p.sessionToken === token; }) || null;
}

function findUserIndexByToken(token, usersArr) {
    var u = findUserByToken(token); if (!u) return -1;
    return usersArr.findIndex(function(x) { return x.id === u.id; });
}

function signClientToken(user) {
    var jwt2 = require('jsonwebtoken');
    return jwt2.sign({id: user.id, email: user.email, role: 'client'}, _JWT_SECRET, {expiresIn: '90d'});
}

function signPartnerToken(partner) {
    var jwt2 = require('jsonwebtoken');
    return jwt2.sign({id: partner.id, email: partner.email, role: 'partner'}, _JWT_SECRET, {expiresIn: '90d'});
}

// ============================================================
// HELPERS - STOCKAGE DES PARTENAIRES
// ============================================================

function loadPartners() {
    try {
        if (fs.existsSync(PARTNERS_FILE)) {
            const data = fs.readFileSync(PARTNERS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[PARTNER] Erreur lecture partners:', error);
    }
    return [];
}

function savePartners(partners) {
    try {
        fs.writeFileSync(PARTNERS_FILE, JSON.stringify(partners, null, 2), 'utf8');
        persistentStore.persistToCloud('partners', partners).catch(function(e) {});
    } catch (error) {
        console.error('[PARTNER] Erreur sauvegarde partners:', error);
    }
}

function loadHallOfFame() {
    try {
        if (fs.existsSync(HALL_OF_FAME_FILE)) {
            return JSON.parse(fs.readFileSync(HALL_OF_FAME_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('[HALL_OF_FAME] Erreur lecture:', error);
    }
    return { lastComputedMonth: null, snapshots: [] };
}

function saveHallOfFame(data) {
    try {
        fs.writeFileSync(HALL_OF_FAME_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('[HALL_OF_FAME] Erreur sauvegarde:', error);
    }
}

function loadEvents() {
    try {
        if (fs.existsSync(EVENTS_FILE)) {
            return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('[EVENTS] Erreur lecture events:', error);
    }
    return [];
}

function loadActualites() {
    try {
        if (fs.existsSync(ACTUALITES_FILE)) return JSON.parse(fs.readFileSync(ACTUALITES_FILE, 'utf8'));
    } catch(e) { console.error('[ACTUALITES] Lecture:', e.message); }
    return [];
}
function saveActualites(list) {
    try { fs.writeFileSync(ACTUALITES_FILE, JSON.stringify(list, null, 2), 'utf8'); } catch(e) { console.error('[ACTUALITES] Sauvegarde:', e.message); }
    persistentStore.persistToCloud('actualites', list).catch(function(e) {});
}

function saveEvents(events) {
    try {
        fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf8');
        persistentStore.persistToCloud('events', events).catch(function(e) {});
    } catch (error) {
        console.error('[EVENTS] Erreur sauvegarde events:', error);
    }
}

function loadCampagnes() {
    try {
        if (fs.existsSync(CAMPAGNES_FILE)) {
            return JSON.parse(fs.readFileSync(CAMPAGNES_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('[CAMPAGNES] Erreur lecture campagnes:', error);
    }
    return [];
}

function saveCampagnes(campagnes) {
    try {
        fs.writeFileSync(CAMPAGNES_FILE, JSON.stringify(campagnes, null, 2), 'utf8');
    } catch (error) {
        console.error('[CAMPAGNES] Erreur sauvegarde campagnes:', error);
    }
}

function loadScheduledNotifs() {
    try {
        if (fs.existsSync(SCHEDULED_NOTIFS_FILE)) return JSON.parse(fs.readFileSync(SCHEDULED_NOTIFS_FILE, 'utf8'));
    } catch(e) { console.error('[SCHED_NOTIF] Lecture:', e); }
    return [];
}
function saveScheduledNotifs(notifs) {
    try { fs.writeFileSync(SCHEDULED_NOTIFS_FILE, JSON.stringify(notifs, null, 2), 'utf8'); } catch(e) { console.error('[SCHED_NOTIF] Sauvegarde:', e); }
}
function processScheduledNotifs() {
    try {
        var now = Date.now();
        var notifs = loadScheduledNotifs();
        var updated = false;
        notifs.forEach(function(n) {
            if (!n.sent && new Date(n.sendAt).getTime() <= now) {
                notifyUser(n.email, n.role, n.type, n.title, n.body, n.link);
                if (n.emailType === 'capacity_limited_event') {
                    emailService.sendCapacityLimitedEventEmail(n.email, n.userPrenom, n.emailEventTitle, n.link).catch(function(e) {
                        console.warn('[SCHED_NOTIF] Email event capacite:', e.message);
                    });
                }
                n.sent = true;
                updated = true;
            }
        });
        if (updated) {
            var cutoff = now - 7 * 24 * 3600 * 1000;
            notifs = notifs.filter(function(n) { return !n.sent || new Date(n.sendAt).getTime() > cutoff; });
            saveScheduledNotifs(notifs);
        }
    } catch(e) { console.error('[SCHED_NOTIF] Process:', e); }
}

function loadPartnerReviews() {
    try {
        if (fs.existsSync(PARTNER_REVIEWS_FILE)) {
            const data = fs.readFileSync(PARTNER_REVIEWS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[PARTNER-REVIEWS] Erreur lecture partner_reviews:', error);
    }
    return [];
}

function savePartnerReviews(reviews) {
    try {
        fs.writeFileSync(PARTNER_REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf8');
        persistentStore.persistToCloud('partner_reviews', reviews).catch(function(e) {});
    } catch (error) {
        console.error('[PARTNER-REVIEWS] Erreur sauvegarde partner_reviews:', error);
    }
}

function loadGenesisProjects() {
    try {
        if (fs.existsSync(GENESIS_PROJECTS_FILE)) {
            return JSON.parse(fs.readFileSync(GENESIS_PROJECTS_FILE, 'utf8')) || [];
        }
    } catch (e) { console.error('[GENESIS-PROJECTS] Erreur lecture:', e); }
    return [];
}

function saveGenesisProjects(data) {
    try {
        fs.writeFileSync(GENESIS_PROJECTS_FILE, JSON.stringify(data, null, 2), 'utf8');
        persistentStore.persistToCloud('genesis_projects', data).catch(function(e) {});
    } catch (e) { console.error('[GENESIS-PROJECTS] Erreur sauvegarde:', e); }
}

function getGenesisProjectById(id) {
    return loadGenesisProjects().find(function(p) { return p.id === id; }) || null;
}

function getPartnerByEmail(email) {
    const partners = loadPartners();
    return partners.find(p => p.email.toLowerCase() === email.toLowerCase()) || null;
}

function getPartnerById(partnerId) {
    const partners = loadPartners();
    return partners.find(p => p.id === partnerId) || null;
}

function loadPartnerAssignments() {
    try {
        if (fs.existsSync(PARTNER_ASSIGNMENTS_FILE)) {
            const data = fs.readFileSync(PARTNER_ASSIGNMENTS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[PARTNER] Erreur lecture assignments:', error);
    }
    return [];
}

function savePartnerAssignments(assignments) {
    try {
        fs.writeFileSync(PARTNER_ASSIGNMENTS_FILE, JSON.stringify(assignments, null, 2), 'utf8');
        persistentStore.persistToCloud('partner-assignments', assignments).catch(function(e) {});
    } catch (error) {
        console.error('[PARTNER] Erreur sauvegarde assignments:', error);
    }
}

// ── Dispatches (missions partenaire en mode "course") ──
function loadDispatches() {
    try {
        if (!fs.existsSync(DISPATCHES_FILE)) return [];
        return JSON.parse(fs.readFileSync(DISPATCHES_FILE, 'utf8')) || [];
    } catch(e) { return []; }
}
function saveDispatches(data) {
    try { fs.writeFileSync(DISPATCHES_FILE, JSON.stringify(data, null, 2), 'utf8'); }
    catch(e) { console.error('[DISPATCH] Erreur sauvegarde:', e); }
    persistentStore.persistToCloud('dispatches', data).catch(function(e) {});
}
var _dispatchLocks = {}; // verrou en mémoire contre les race conditions

// ── Demandes directes client → partenaire (marketplace, remplace le dispatch broadcast) ──
function loadPartnerRequests() {
    try {
        if (!fs.existsSync(PARTNER_REQUESTS_FILE)) return [];
        return JSON.parse(fs.readFileSync(PARTNER_REQUESTS_FILE, 'utf8')) || [];
    } catch(e) { return []; }
}
function savePartnerRequests(data) {
    try {
        fs.writeFileSync(PARTNER_REQUESTS_FILE, JSON.stringify(data, null, 2), 'utf8');
        persistentStore.persistToCloud('partner-requests', data).catch(function(e) {});
    } catch(e) { console.error('[PARTNER-REQUEST] Erreur sauvegarde:', e); }
}

// ── Payouts (répartition automatique des revenus) ──
function loadPayouts() {
    try {
        if (!fs.existsSync(PAYOUTS_FILE)) return [];
        return JSON.parse(fs.readFileSync(PAYOUTS_FILE, 'utf8')) || [];
    } catch(e) { return []; }
}
function savePayouts(data) {
    try {
        fs.writeFileSync(PAYOUTS_FILE, JSON.stringify(data, null, 2), 'utf8');
        persistentStore.persistToCloud('payouts', data).catch(function(e) {});
    } catch(e) { console.error('[PAYOUT] Erreur sauvegarde:', e); }
}

function loadPromotions() {
    try {
        if (!fs.existsSync(PROMOTIONS_FILE)) return [];
        return JSON.parse(fs.readFileSync(PROMOTIONS_FILE, 'utf8')) || [];
    } catch(e) { return []; }
}
function savePromotions(data) {
    try { fs.writeFileSync(PROMOTIONS_FILE, JSON.stringify(data, null, 2), 'utf8'); }
    catch(e) { console.error('[PROMO] Erreur sauvegarde:', e); }
    persistentStore.persistToCloud('promotions', data).catch(function(e) {});
}

// Types de promotion prévus — seul 'merchant' est utilisable en V1
var PROMO_TYPES_ALL   = ['percentage','fixed','free_service','bonus','free_consultation','free_travel','promo_code'];
// Financeurs prévus dans l'architecture — seul 'merchant' est activé en V1
var FUNDING_TYPES_ALL = ['merchant','platform','partner','shared','loyalty','referral','seasonal'];

function isPromoActive(promo) {
    if (!promo || promo.status !== 'active' || promo.funding_type !== 'merchant') return false;
    var now = new Date();
    if (new Date(promo.start_date) > now || new Date(promo.end_date) < now) return false;
    if (promo.max_uses && promo.current_uses >= promo.max_uses) return false;
    return true;
}

// ── Notifications persistantes ──
function loadNotifications() {
    try {
        if (!fs.existsSync(NOTIFICATIONS_FILE)) return [];
        return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf8')) || [];
    } catch(e) { return []; }
}
function saveNotifications(data) {
    try { fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(data, null, 2), 'utf8'); }
    catch(e) { console.error('[NOTIF] Erreur sauvegarde:', e); }
    persistentStore.persistToCloud('notifications', data).catch(function(e) {});
}

// ── Prospects B2B ──
function loadProspects() {
    try {
        if (!fs.existsSync(PROSPECTS_FILE)) return [];
        return JSON.parse(fs.readFileSync(PROSPECTS_FILE, 'utf8')) || [];
    } catch(e) { return []; }
}
function saveProspects(data) {
    try { fs.writeFileSync(PROSPECTS_FILE, JSON.stringify(data, null, 2), 'utf8'); }
    catch(e) { console.error('[PROSPECTS] Erreur sauvegarde:', e); }
}

// ── Litiges ──
function loadDisputes() {
    try {
        if (!fs.existsSync(DISPUTES_FILE)) return [];
        return JSON.parse(fs.readFileSync(DISPUTES_FILE, 'utf8')) || [];
    } catch(e) { return []; }
}
function saveDisputes(data) {
    try { fs.writeFileSync(DISPUTES_FILE, JSON.stringify(data, null, 2), 'utf8'); }
    catch(e) { console.error('[DISPUTE] Erreur sauvegarde:', e); }
    persistentStore.persistToCloud('disputes', data).catch(function(e) {});
}

// IDs de tarifs partenaires (taux variable selon badge : standard 25% FA, réduit pour Argent/Or/Élite)
var PARTNER_TARIF_IDS = ['photo-devis', 'video-devis'];

function calculateRevenueShares(order, paidAmount) {
    var productIds = [];
    if (order.items && order.items.length > 0) {
        order.items.forEach(function(item) { if (item.product_id) productIds.push(item.product_id); });
    } else if (order.product_id) {
        productIds.push(order.product_id);
    }
    var isPartnerTarif = productIds.length > 0 && productIds.every(function(pid) { return PARTNER_TARIF_IDS.indexOf(pid) !== -1; });
    var assignments = loadPartnerAssignments().filter(function(a) {
        return a.order_id === order.id && a.status === 'active' && a.partner_type !== 'admin';
    });
    if (assignments.length === 0) return [];
    var partners = loadPartners();
    var shares = [];
    if (isPartnerTarif) {
        // Tarif partenaire : taux selon badge du partenaire (Bronze 25%, Argent 22%, Or 19%, Élite 15%)
        assignments.forEach(function(a) {
            var partner = partners.find(function(p) { return p.id === a.partner_id; }) || {};
            var _badge = getPartnerBadge(partner);
            var _faPct = getBenefitsForBadge(_badge).commissionPct;
            var _partnerPct = 100 - _faPct;
            var partnerAmount = parseFloat((paidAmount * _partnerPct / 100).toFixed(2));
            var faAmount      = parseFloat((paidAmount - partnerAmount).toFixed(2));
            shares.push({ partner_id: a.partner_id, partner_email: a.partner_email, partner_paypal: partner.payout_paypal_email || null, partner_iban: partner.payout_iban || null, partner_bic: partner.payout_bic || null, partner_titulaire: partner.payout_titulaire || null, partner_amount: partnerAmount, fa_amount: faAmount, partner_pct: _partnerPct, fa_pct: _faPct, type: 'tarif_partenaire' });
        });
    } else {
        // Offre multi-service : taux selon badge de chaque partenaire, FA prend le reste
        var _multiShares = [];
        var _totalPartnerAmount = 0;
        var n = assignments.length;
        assignments.forEach(function(a) {
            var partner = partners.find(function(p) { return p.id === a.partner_id; }) || {};
            var _badge = getPartnerBadge(partner);
            var _faPct = getBenefitsForBadge(_badge).commissionPct;
            var _partnerPct = 100 - _faPct;
            var _perPartner = parseFloat((paidAmount / n * _partnerPct / 100).toFixed(2));
            _totalPartnerAmount += _perPartner;
            _multiShares.push({ a: a, partner: partner, amount: _perPartner, partnerPct: _partnerPct, faPct: _faPct });
        });
        var _faTotal = parseFloat((paidAmount - _totalPartnerAmount).toFixed(2));
        _multiShares.forEach(function(ms, i) {
            shares.push({ partner_id: ms.a.partner_id, partner_email: ms.a.partner_email, partner_paypal: ms.partner.payout_paypal_email || null, partner_iban: ms.partner.payout_iban || null, partner_bic: ms.partner.payout_bic || null, partner_titulaire: ms.partner.payout_titulaire || null, partner_amount: ms.amount, fa_amount: i === 0 ? _faTotal : 0, partner_pct: ms.partnerPct, fa_pct: ms.faPct, type: 'offre_multi_service' });
        });
    }
    return shares;
}

async function triggerPayPalPayouts(items) {
    if (!items || !items.length) return { success: false, error: 'Aucun élément' };
    try {
        var token = await getPayPalAccessToken();
        var batchId = 'FAG-' + Date.now();
        var payoutItems = items.map(function(item, i) {
            return { recipient_type: 'EMAIL', amount: { value: item.amount.toFixed(2), currency: item.currency || 'EUR' }, receiver: item.recipient_email, note: item.note || 'Versement FA GENESIS', sender_item_id: batchId + '-' + i };
        });
        var resp = await fetch(PAYPAL_BASE + '/v1/payments/payouts', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_batch_header: { sender_batch_id: batchId, email_subject: 'Votre versement FA GENESIS', email_message: 'Votre part de prestation FA GENESIS a été versée automatiquement.' }, items: payoutItems })
        });
        var data = await resp.json();
        return { success: resp.ok, payout_batch_id: (data.batch_header && data.batch_header.payout_batch_id) || null, raw: data };
    } catch(e) {
        return { success: false, error: e.message };
    }
}

async function processPaymentSplit(orderId, paidAmount, stage) {
    try {
        var orders = loadOrders();
        var order = orders.find(function(o) { return o.id === orderId; });
        if (!order || !paidAmount || paidAmount <= 0) return;
        var shares = calculateRevenueShares(order, paidAmount);
        if (!shares.length) { console.log('[SPLIT] Pas de partenaires externes pour commande ' + orderId); return; }
        var payouts = loadPayouts();
        var newPayouts = [];
        shares.forEach(function(share) {
            if (share.partner_amount <= 0) return;
            // Déterminer la méthode préférée : PayPal si email dispo, virement si IBAN dispo, sinon en attente
            var method = share.partner_paypal ? 'paypal' : (share.partner_iban ? 'bank_transfer' : 'pending');
            newPayouts.push({
                id: 'PAY-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
                order_id: orderId, stage: stage || 'deposit',
                partner_id: share.partner_id, partner_email: share.partner_email,
                partner_paypal: share.partner_paypal,
                partner_iban: share.partner_iban, partner_bic: share.partner_bic, partner_titulaire: share.partner_titulaire,
                payout_method: method,
                amount: share.partner_amount, currency: 'EUR',
                fa_amount: share.fa_amount, fa_pct: share.fa_pct, partner_pct: share.partner_pct,
                type: share.type, status: 'pending',
                created_at: new Date().toISOString(), sent_at: null, payout_batch_id: null, error: null
            });
        });
        savePayouts(payouts.concat(newPayouts));

        // Envoyer via PayPal les partenaires ayant un email PayPal
        var itemsToSend = newPayouts.filter(function(p) { return p.payout_method === 'paypal'; }).map(function(p) {
            return { recipient_email: p.partner_paypal, amount: p.amount, currency: 'EUR', note: 'Versement FA GENESIS — Commande ' + orderId.substring(0, 8).toUpperCase() };
        });
        if (itemsToSend.length > 0) {
            var result = await triggerPayPalPayouts(itemsToSend);
            var latestPayouts = loadPayouts();
            newPayouts.forEach(function(np) {
                if (np.payout_method !== 'paypal') return;
                var idx = latestPayouts.findIndex(function(p) { return p.id === np.id; });
                if (idx !== -1) {
                    if (result.success) { latestPayouts[idx].status = 'sent'; latestPayouts[idx].sent_at = new Date().toISOString(); latestPayouts[idx].payout_batch_id = result.payout_batch_id || null; }
                    else { latestPayouts[idx].status = 'failed'; latestPayouts[idx].error = result.error || 'Erreur PayPal Payouts'; }
                }
            });
            savePayouts(latestPayouts);
            console.log('[SPLIT] Versements PayPal ' + (result.success ? 'envoyés' : 'ÉCHOUÉS') + ' pour commande ' + orderId);
        }
        // Les partenaires avec IBAN sont marqués status='pending' + payout_method='bank_transfer'
        // Un virement SEPA doit être déclenché manuellement ou via une API bancaire (ex: Stripe Treasury)
        var bankCount = newPayouts.filter(function(p) { return p.payout_method === 'bank_transfer'; }).length;
        if (bankCount > 0) console.log('[SPLIT] ' + bankCount + ' virement(s) bancaire(s) à effectuer pour commande ' + orderId);
        var noneCount = newPayouts.filter(function(p) { return p.payout_method === 'pending'; }).length;
        if (noneCount > 0) console.log('[SPLIT] ' + noneCount + ' partenaire(s) sans coordonnées bancaires — versements en attente pour commande ' + orderId);
    } catch(e) { console.error('[SPLIT] Erreur processPaymentSplit:', e); }
}

// ============================================================
// ASSIGNATION AUTOMATIQUE DES INTERVENANTS (après acompte)
// ============================================================
var ASSIGNMENT_RULES = {
    // Accompagnement Etudiant - consultant FA GENESIS uniquement
    'etudiant-idea':    ['admin'],
    'etudiant-starter': ['admin'],
    'etudiant-launch':  ['admin'],
    'etudiant-impact':  ['admin'],
    // Accompagnement Particulier - consultant FA GENESIS uniquement
    'particulier-idea':    ['admin'],
    'particulier-starter': ['admin'],
    'particulier-launch':  ['admin'],
    'particulier-impact':  ['admin'],
    // Accompagnement Entreprise - consultant FA GENESIS uniquement
    'entreprise-start':      ['admin'],
    'entreprise-visibility': ['admin'],
    'entreprise-impact':     ['admin'],
    // Photo & vidéo - devis = assignation manuelle uniquement
    'photo-devis': [],
    'video-devis': [],
    // Marketing - marketer
    'marketing-express':          ['marketer'],
    'marketing-strategy':         ['marketer'],
    'marketing-impact':           ['marketer'],
    'marketing-option-digitales': ['marketer'],
    // Médias - media
    'media-visibility': ['media'],
    'media-impact':     ['media'],
    'media-premium':    ['media'],
    'media-promotion':  ['media']
};

function assignIntervenantsFromOrder(orderId) {
    try {
        var orders = loadOrders();
        var order = orders.find(function(o) { return o.id === orderId; });
        if (!order) { console.log('[ASSIGN] Commande introuvable: ' + orderId); return; }

        // Récupérer tous les product IDs (panier multi ou produit unique)
        var productIds = [];
        if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            order.items.forEach(function(item) { if (item.product_id) productIds.push(item.product_id); });
        } else if (order.product_id) {
            productIds.push(order.product_id);
        }
        if (productIds.length === 0) { console.log('[ASSIGN] Aucun product_id pour commande: ' + orderId); return; }

        var allPartners = loadPartners();
        var assignments = loadPartnerAssignments();
        var newAssignments = [];
        var assignedRoles = [];

        productIds.forEach(function(productId) {
            var roles = ASSIGNMENT_RULES[productId] || [];
            roles.forEach(function(role) {
                if (role === 'admin') {
                    // Consultant FA GENESIS - assignation interne immédiate
                    if (assignedRoles.indexOf('admin') === -1) assignedRoles.push('admin');
                    return;
                }
                // Partenaires externes (marketer, media, photographer, videographer)
                // → système de dispatch (course) : ils se manifestent eux-mêmes
                if (assignedRoles.indexOf(role) === -1) assignedRoles.push(role);
                console.log('[ASSIGN] Role ' + role + ' mis en mode dispatch pour ' + orderId);
            });
        });

        if (newAssignments.length > 0) {
            savePartnerAssignments(assignments.concat(newAssignments));
        }

        // Mettre à jour la commande avec les rôles assignés
        var orderIdx = orders.findIndex(function(o) { return o.id === orderId; });
        if (orderIdx !== -1) {
            orders[orderIdx].assigned_roles = assignedRoles;
            orders[orderIdx].assigned_at = new Date().toISOString();
            if (!orders[orderIdx].project_status) orders[orderIdx].project_status = 'active';
            saveOrders(orders);
        }

        console.log('[ASSIGN] Assignation terminee pour ' + orderId + '. Roles: ' + assignedRoles.join(', '));
    } catch (e) {
        console.error('[ASSIGN] Erreur assignIntervenantsFromOrder:', e);
    }
}

// Délai avant auto-libération de la tranche intermédiaire GENESIS SAFE™ si le client ne valide pas
const GENESIS_SAFE_INTERMEDIATE_RELEASE_DAYS = 3;
// SLA traitement des litiges — affiché aux deux parties et dans les API de litiges
const GENESIS_DISPUTE_SLA_HOURS = 48;
const GENESIS_DISPUTE_SLA_LABEL = '48h ouvrées';

// ── Distinctions prestataires ──────────────────────────────────────────────────
var PARTNER_DISTINCTIONS_DEF = [
    { id: 'ambassador', label: 'Ambassadeur GENESIS', icon: 'fa-medal',    color: '#FFD700', permanent: true },
    { id: 'new_talent', label: 'Nouveau Talent',       icon: 'fa-seedling', color: '#a78bfa', permanent: false, expires_on_badge: 'bronze' }
];
var PROFILE_BOOST_DAYS_PARRAIN = 7;
var PROFILE_BOOST_DAYS_FILLEUL = 4;

function getPartnerActiveDistinctions(partner, badge) {
    var dists = partner.distinctions || [];
    var badgeOrder = ['bronze', 'argent', 'or', 'elite'];
    return dists.filter(function(d) {
        var def = PARTNER_DISTINCTIONS_DEF.find(function(dd) { return dd.id === d.id; });
        if (!def) return false;
        if (d.expires_at && new Date(d.expires_at) < new Date()) return false;
        if (def.expires_on_badge) {
            var expIdx = badgeOrder.indexOf(def.expires_on_badge);
            var curIdx = badge ? badgeOrder.indexOf(badge) : -1;
            if (curIdx >= expIdx && expIdx >= 0) return false;
        }
        return true;
    });
}

function grantDistinction(partner, id) {
    if (!partner.distinctions) partner.distinctions = [];
    if (partner.distinctions.some(function(d) { return d.id === id; })) return false;
    partner.distinctions.push({ id: id, granted_at: new Date().toISOString(), expires_at: null });
    return true;
}

function _serializeDistinctions(dists) {
    return dists.map(function(d) {
        var def = PARTNER_DISTINCTIONS_DEF.find(function(dd) { return dd.id === d.id; });
        return { id: d.id, label: def ? def.label : d.id, icon: def ? def.icon : 'fa-medal', color: def ? def.color : '#FFD700', granted_at: d.granted_at };
    });
}

async function _handleFirstMissionCompleted(partner, allPartners) {
    try {
        partner.first_mission_completed_at = new Date().toISOString();
        grantDistinction(partner, 'new_talent');
        partner.profile_boost_until = new Date(Date.now() + PROFILE_BOOST_DAYS_FILLEUL * 24 * 3600 * 1000).toISOString();
        notifyUser(partner.email, 'partner', 'first_mission_completed',
            '🎉 Félicitations !',
            'Votre première prestation est terminée. Votre profil bénéficie d\'une mise en avant pendant ' + PROFILE_BOOST_DAYS_FILLEUL + ' jours. Vous obtenez la distinction Nouveau Talent.',
            '/app.html');
        if (partner.referredBy) {
            var parrain = allPartners.find(function(p) { return p.id === partner.referredBy; });
            if (parrain) {
                grantDistinction(parrain, 'ambassador');
                var newBoostDate = new Date(Date.now() + PROFILE_BOOST_DAYS_PARRAIN * 24 * 3600 * 1000);
                var curBoostDate = parrain.profile_boost_until ? new Date(parrain.profile_boost_until) : new Date(0);
                if (newBoostDate > curBoostDate) parrain.profile_boost_until = newBoostDate.toISOString();
                parrain.referred_active_count = (parrain.referred_active_count || 0) + 1;
                notifyUser(parrain.email, 'partner', 'ambassador_earned',
                    '🎉 Félicitations !',
                    'Votre filleul a réalisé sa première prestation. Vous obtenez la distinction Ambassadeur GENESIS. Votre profil bénéficie d\'une mise en avant pendant ' + PROFILE_BOOST_DAYS_PARRAIN + ' jours.',
                    '/app.html');
            }
        }
        savePartners(allPartners);
    } catch(e) {
        console.error('[FIRST-MISSION] Erreur:', e);
    }
}

// Crée les missions (dispatches) pour les partenaires externes d'une commande
// Versement unitaire pour un dispatch accepté (acompte ou solde)
async function processDispatchPayout(dispatch, stage) {
    try {
        if (!dispatch || !dispatch.claimed_by_partner_id) return;

        var partnerPct = dispatch.partner_pct || 75;
        var faPct = 100 - partnerPct;

        var orders = loadOrders();
        var order = orders.find(function(o) { return o.id === dispatch.order_id; });

        var paidAmount, stageTotal;

        if (stage === 'deposit') {
            paidAmount = parseFloat((dispatch.partner_deposit_amount || 0).toFixed(2));
            stageTotal = order ? parseFloat(order.deposit_amount || ((order.total_amount || 0) * 0.30)) : 0;
        } else if (stage === 'installment_2' || stage === 'installment_3') {
            // GENESIS SAFE™ : tranches 2 (40%, livrable intermédiaire) et 3 (30%, livraison finale),
            // calculées sur le montant réel de la tranche (order.installments), pas sur le solde global.
            var tranche = order && order.installments
                ? order.installments.find(function(i) { return i.stage === stage; })
                : null;
            stageTotal = tranche ? parseFloat(tranche.amount || 0) : 0;
            // Si avantage bienvenue : le partenaire est payé sur le prix plein (gross-up).
            var _wdaInst = order ? parseFloat(order.welcome_discount_amount || 0) : 0;
            var _grossUpInst = (_wdaInst > 0 && order && parseFloat(order.total_amount) > 0)
                ? (parseFloat(order.total_amount) + _wdaInst) / parseFloat(order.total_amount)
                : 1;
            paidAmount = parseFloat((stageTotal * partnerPct / 100 * _grossUpInst).toFixed(2));
        } else if (order && order.installments && order.installments.length === 3) {
            // 'balance' sur une commande GENESIS SAFE™ : le client a payé tout le solde
            // restant en un clic (tranches 2+3) au lieu de les régler séparément. On ne verse
            // au partenaire que les tranches pas encore reversées, pour éviter un double
            // versement si une tranche avait déjà été payée/versée individuellement.
            var existingPayoutsForDispatch = loadPayouts().filter(function(p) { return p.dispatch_id === dispatch.id; });
            var paidOutStages = existingPayoutsForDispatch.map(function(p) { return p.stage; });
            var remainingTranches = order.installments.filter(function(i) {
                return i.stage !== 'deposit' && paidOutStages.indexOf(i.stage) === -1;
            });
            stageTotal = remainingTranches.reduce(function(sum, i) { return sum + parseFloat(i.amount || 0); }, 0);
            var _wdaBal = order ? parseFloat(order.welcome_discount_amount || 0) : 0;
            var _grossUpBal = (_wdaBal > 0 && order && parseFloat(order.total_amount) > 0)
                ? (parseFloat(order.total_amount) + _wdaBal) / parseFloat(order.total_amount)
                : 1;
            paidAmount = parseFloat((stageTotal * partnerPct / 100 * _grossUpBal).toFixed(2));
        } else {
            // 'balance' : commandes historiques sans split 30/40/30 (solde 70% en un seul versement)
            var pTotal = parseFloat(dispatch.partner_total_amount || 0);
            var pDeposit = parseFloat(dispatch.partner_deposit_amount || 0);
            paidAmount = parseFloat((pTotal - pDeposit).toFixed(2));
            var orderTotal = order ? parseFloat(order.total_amount || 0) : 0;
            var depositAmt = order ? parseFloat(order.deposit_amount || (orderTotal * 0.30)) : 0;
            stageTotal = order ? parseFloat(order.balance_amount || (orderTotal - depositAmt)) : 0;
        }
        if (paidAmount <= 0) return;

        var partners = loadPartners();
        var partner = partners.find(function(p) { return p.id === dispatch.claimed_by_partner_id; });
        if (!partner) return;

        var faAmount = parseFloat((stageTotal - paidAmount).toFixed(2));

        // Détection méthode : Stripe Connect > Wise/IBAN > PayPal (legacy) > IBAN legacy > pending
        var method;
        if (partner.stripeAccountId && partner.stripeChargesEnabled) {
            method = 'stripe_connect';
        } else if (partner.bankDetails && partner.bankDetails.iban) {
            method = 'wise';
        } else if (partner.payout_paypal) {
            method = 'paypal';
        } else if (partner.payout_iban) {
            method = 'bank_transfer';
        } else {
            method = 'pending';
        }

        // Coordonnées bancaires : nouvelle structure bankDetails > anciens champs legacy
        var _bd = partner.bankDetails || {};
        var _partnerIban      = _bd.iban      || partner.payout_iban      || null;
        var _partnerBic       = _bd.bic       || partner.payout_bic       || null;
        var _partnerTitulaire = _bd.accountHolderName || partner.payout_titulaire || null;
        var _partnerPaypal    = partner.payout_paypal || null;

        // Litige (Phase 6) : tant qu'un litige est ouvert sur ce dispatch, les versements
        // futurs sont mis en attente (on_hold) au lieu d'être envoyés immédiatement.
        var hasOpenDispute = loadDisputes().some(function(d) {
            return d.dispatch_id === dispatch.id && (d.status === 'open' || d.status === 'jeremie_triage' || d.status === 'escalated_admin');
        });

        var _autoReleaseAt = (!hasOpenDispute && stage === 'installment_2')
            ? new Date(Date.now() + GENESIS_SAFE_INTERMEDIATE_RELEASE_DAYS * 24 * 3600 * 1000).toISOString()
            : null;

        var newPayout = {
            id: 'PAY-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
            order_id: dispatch.order_id,
            dispatch_id: dispatch.id,
            stage: stage,
            partner_id: partner.id,
            partner_email: partner.email,
            partner_paypal: _partnerPaypal,
            partner_iban: _partnerIban,
            partner_bic: _partnerBic,
            partner_titulaire: _partnerTitulaire,
            partner_stripe_account: partner.stripeAccountId || null,
            payout_method: method,
            amount: paidAmount,
            fa_amount: faAmount,
            fa_pct: faPct,
            partner_pct: partnerPct,
            currency: 'EUR',
            status: hasOpenDispute ? 'on_hold' : (stage === 'installment_2' ? 'awaiting_validation' : 'pending'),
            auto_release_at: _autoReleaseAt,
            created_at: new Date().toISOString(),
            sent_at: null,
            payout_batch_id: null,
            error: null
        };

        var payouts = loadPayouts();
        payouts.push(newPayout);
        savePayouts(payouts);

        // ── Première mission complète → récompenses parrainage/distinctions ──
        var _isFinalStage = (stage === 'balance' || stage === 'installment_3') ||
            (stage === 'deposit' && dispatch.partner_deposit_amount != null && dispatch.partner_total_amount != null &&
             Math.abs((dispatch.partner_deposit_amount || 0) - (dispatch.partner_total_amount || 0)) < 0.01);
        if (_isFinalStage && !partner.first_mission_completed_at) {
            _handleFirstMissionCompleted(partner, partners);
        }

        if (hasOpenDispute) {
            console.log('[PAYOUT] ' + stage + ' mis en attente (on_hold, litige ouvert sur dispatch ' + dispatch.id + ') → ' + partner.email + ' : ' + paidAmount + ' €');
            return;
        }

        // GENESIS SAFE™ : tranche intermédiaire (40%) retenue jusqu'à validation du livrable intermédiaire par le client
        if (stage === 'installment_2') {
            console.log('[PAYOUT] installment_2 retenu — auto-libération dans ' + GENESIS_SAFE_INTERMEDIATE_RELEASE_DAYS + ' j (le ' + (_autoReleaseAt || '').substring(0, 10) + ') → ' + partner.email + ' : ' + paidAmount + ' €');
            return;
        }

        if (method === 'stripe_connect') {
            // L'argent a déjà été transféré automatiquement via transfer_data dans le PaymentIntent.
            // Le record de payout est créé pour le suivi admin uniquement.
            var _scLatest = loadPayouts();
            var _scPi = _scLatest.findIndex(function(p) { return p.id === newPayout.id; });
            if (_scPi !== -1) { _scLatest[_scPi].status = 'sent'; _scLatest[_scPi].sent_at = new Date().toISOString(); savePayouts(_scLatest); }
            console.log('[PAYOUT] ' + stage + ' Stripe Connect (transfert automatique) → ' + partner.email + ' : ' + paidAmount + ' €');
        } else if (method === 'wise') {
            // Virement manuel via wise.com — le record est créé en status 'pending', l'admin fait le virement.
            console.log('[PAYOUT] ' + stage + ' Wise (virement manuel requis) → ' + partner.email + ' IBAN:' + (_partnerIban || '?') + ' : ' + paidAmount + ' €');
        } else if (method === 'paypal') {
            var result = await triggerPayPalPayouts([{
                recipient_email: _partnerPaypal,
                amount: paidAmount,
                currency: 'EUR',
                note: 'Versement FA GENESIS — ' + (dispatch.offer_name || dispatch.order_id) + ' (' + stage + ')'
            }]);
            var latest = loadPayouts();
            var pi = latest.findIndex(function(p) { return p.id === newPayout.id; });
            if (pi !== -1) {
                latest[pi].status = result.success ? 'sent' : 'failed';
                if (result.success) { latest[pi].sent_at = new Date().toISOString(); latest[pi].payout_batch_id = result.payout_batch_id || null; }
                else { latest[pi].error = result.error || 'Erreur PayPal'; }
                savePayouts(latest);
            }
            console.log('[PAYOUT] ' + stage + ' PayPal ' + (result.success ? 'envoyé' : 'ÉCHOUÉ') + ' → ' + partner.email + ' : ' + paidAmount + ' €');
        } else {
            console.log('[PAYOUT] ' + stage + ' en attente (' + method + ') → ' + partner.email + ' : ' + paidAmount + ' €');
        }
    } catch(e) {
        console.error('[PAYOUT] Erreur processDispatchPayout:', e);
    }
}

// Litige résolu (Phase 6) : déclenche les versements on_hold mis en attente pour ce dispatch
async function releaseOnHoldPayouts(dispatchId) {
    try {
        var payouts = loadPayouts();
        var toRelease = payouts.filter(function(p) { return p.dispatch_id === dispatchId && p.status === 'on_hold'; });
        if (toRelease.length === 0) return;

        for (var i = 0; i < toRelease.length; i++) {
            var p = toRelease[i];
            if (p.payout_method === 'paypal' && p.partner_paypal) {
                var result = await triggerPayPalPayouts([{
                    recipient_email: p.partner_paypal,
                    amount: p.amount,
                    currency: 'EUR',
                    note: 'Versement FA GENESIS — ' + (p.order_id || '') + ' (' + p.stage + ', débloqué après résolution de litige)'
                }]);
                var latest = loadPayouts();
                var pi = latest.findIndex(function(x) { return x.id === p.id; });
                if (pi !== -1) {
                    latest[pi].status = result.success ? 'sent' : 'failed';
                    if (result.success) { latest[pi].sent_at = new Date().toISOString(); latest[pi].payout_batch_id = result.payout_batch_id || null; }
                    else { latest[pi].error = result.error || 'Erreur PayPal'; }
                    savePayouts(latest);
                }
                console.log('[PAYOUT] Versement débloqué (litige résolu) ' + p.stage + ' PayPal ' + (result.success ? 'envoyé' : 'ÉCHOUÉ') + ' → ' + p.partner_email);
            } else {
                var latest2 = loadPayouts();
                var pi2 = latest2.findIndex(function(x) { return x.id === p.id; });
                if (pi2 !== -1) { latest2[pi2].status = 'pending'; savePayouts(latest2); }
                console.log('[PAYOUT] Versement débloqué (litige résolu) ' + p.stage + ' repasse en attente (' + p.payout_method + ') → ' + p.partner_email);
            }
        }
    } catch (e) {
        console.error('[PAYOUT] Erreur releaseOnHoldPayouts:', e);
    }
}

// GENESIS SAFE™ Phase 2 : libère la tranche intermédiaire (40%) retenue pour l'order donné
async function releaseIntermediatePayoutsForOrder(orderId) {
    try {
        var _riPayouts = loadPayouts();
        var _riToRelease = _riPayouts.filter(function(p) {
            return p.order_id === orderId && p.stage === 'installment_2' && p.status === 'awaiting_validation';
        });
        if (_riToRelease.length === 0) return;

        for (var _riIdx = 0; _riIdx < _riToRelease.length; _riIdx++) {
            var _riP = _riToRelease[_riIdx];
            var _riPartner = loadPartners().find(function(pt) { return pt.id === _riP.partner_id; });

            var _riPouts = loadPayouts();
            var _riPi = _riPouts.findIndex(function(p) { return p.id === _riP.id; });
            if (_riPi === -1) continue;
            _riPouts[_riPi].status = 'pending';
            _riPouts[_riPi].validation_released_at = new Date().toISOString();
            savePayouts(_riPouts);

            if (_riPartner && _riPartner.payout_paypal) {
                var _riResult = await triggerPayPalPayouts([{
                    recipient_email: _riPartner.payout_paypal,
                    amount: _riP.amount,
                    currency: 'EUR',
                    note: 'GENESIS SAFE™ — livrable intermédiaire validé (' + _riP.order_id + ')'
                }]);
                var _riPouts2 = loadPayouts();
                var _riPi2 = _riPouts2.findIndex(function(p) { return p.id === _riP.id; });
                if (_riPi2 !== -1) {
                    _riPouts2[_riPi2].status = _riResult.success ? 'sent' : 'failed';
                    if (_riResult.success) { _riPouts2[_riPi2].sent_at = new Date().toISOString(); _riPouts2[_riPi2].payout_batch_id = _riResult.payout_batch_id || null; }
                    else { _riPouts2[_riPi2].error = _riResult.error || 'Erreur PayPal'; }
                    savePayouts(_riPouts2);
                }
                console.log('[PAYOUT] installment_2 libéré PayPal ' + (_riResult.success ? 'envoyé' : 'ÉCHOUÉ') + ' → ' + (_riPartner.email || '') + ' : ' + _riP.amount + ' €');
            } else {
                console.log('[PAYOUT] installment_2 libéré en attente virement → ' + _riP.partner_email + ' : ' + _riP.amount + ' €');
            }
        }
    } catch(e) {
        console.error('[PAYOUT] Erreur releaseIntermediatePayoutsForOrder:', e);
    }
}

// GENESIS SAFE™ Phase 2 : auto-libère les tranches intermédiaires dont le délai de validation est dépassé
function checkAutoReleaseIntermediatePayouts() {
    try {
        var _carNow = Date.now();
        var _carPayouts = loadPayouts();
        var _carOrderIds = {};
        _carPayouts.forEach(function(p) {
            if (p.status === 'awaiting_validation' && p.auto_release_at && new Date(p.auto_release_at).getTime() <= _carNow) {
                _carOrderIds[p.order_id] = true;
            }
        });
        Object.keys(_carOrderIds).forEach(function(orderId) {
            releaseIntermediatePayoutsForOrder(orderId).catch(function(e) {
                console.error('[PAYOUT] Erreur auto-libération tranche intermédiaire order ' + orderId + ':', e);
            });
        });
    } catch(_e) {}
}

// Demande d'avis client après versement du solde à chaque partenaire ayant accepté sa mission
function requestPartnerReviews(clientEmail, acceptedDispatches) {
    if (!clientEmail || !acceptedDispatches || acceptedDispatches.length === 0) return;
    try {
        var allDispatches = loadDispatches();
        var changed = false;
        acceptedDispatches.forEach(function(d) {
            var idx = allDispatches.findIndex(function(x) { return x.id === d.id; });
            if (idx === -1 || allDispatches[idx].review_requested) return;
            allDispatches[idx].review_requested = true;
            changed = true;
            var partner = getPartnerById(d.claimed_by_partner_id);
            var partnerName = partner ? (partner.prenom + ' ' + partner.nom) : 'votre partenaire';
            notifyUser(clientEmail, 'client', 'review-request', 'Comment était votre expérience ?', 'Donnez votre avis sur ' + partnerName, '/app.html#client-review-' + d.claimed_by_partner_id + '-' + d.id);
        });
        if (changed) saveDispatches(allDispatches);
    } catch (e) {
        console.error('[REVIEW] Erreur requestPartnerReviews:', e);
    }
}

// Commande "prestation partenaire" (marketplace) : le client a déjà choisi un partenaire précis,
// donc la mission est créée directement acceptée (pas de dispatch ouvert à réclamation).
function createPartnerServiceDispatch(order) {
    try {
        if (!order || order.product_type !== 'partner_service' || !order.partner_id) return null;

        var dispatches = loadDispatches();
        var existing = dispatches.find(function(d) { return d.order_id === order.id; });
        if (existing) return existing;

        // Taux selon badge du partenaire (Bronze 25% FA → 75% partenaire, Argent 22%, Or 19%, Élite 15%)
        var partner = getPartnerById(order.partner_id);
        var _partnerBadge = getPartnerBadge(partner);
        var _faPct = getBenefitsForBadge(_partnerBadge).commissionPct;
        var partnerPct = 100 - _faPct;
        // Si une réduction bienvenue a été absorbée par GENESIS, le partenaire est payé
        // sur le prix plein (avant réduction). La différence est à la charge de GENESIS.
        var discountedTotal = parseFloat(order.total_amount || 0);
        var welcomeDiscount = parseFloat(order.welcome_discount_amount || 0);
        var totalAmount = discountedTotal + welcomeDiscount;     // prix plein
        var depositAmount = parseFloat(order.deposit_amount || 0);
        var fullDeposit = welcomeDiscount > 0 ? parseFloat((totalAmount * 0.30).toFixed(2)) : depositAmount;
        var partnerDeposit = parseFloat((fullDeposit * partnerPct / 100).toFixed(2));
        var partnerTotal = parseFloat((totalAmount * partnerPct / 100).toFixed(2));

        var users = loadUsers();
        var clientEmail = (order.client_info && order.client_info.email) || '';
        var user = users.find(function(u) { return u.email === clientEmail; });
        var clientPrenom = (order.client_info && order.client_info.first_name)
            || (user && (user.prenom || user.firstName || user.first_name))
            || 'Client';

        var dispatch = {
            id: 'DSP-' + uuidv4().split('-')[0],
            order_id: order.id,
            client_prenom: clientPrenom,
            offer_name: order.product_name,
            offer_total_price: totalAmount,
            partner_type: partner ? partner.partner_type : null,
            partner_pct: partnerPct,
            partner_deposit_amount: partnerDeposit,
            partner_total_amount: partnerTotal,
            client_availability: null,
            status: 'pending_acceptance',
            mission_status: null,
            claimed_by_name: partner ? (partner.prenom + ' ' + partner.nom) : null,
            claimed_by_profile: null,
            claimed_by_partner_id: order.partner_id,
            claimed_at: new Date().toISOString(),
            claim_message: null,
            proposed_start: null,
            created_at: new Date().toISOString()
        };
        dispatches.push(dispatch);
        saveDispatches(dispatches);
        console.log('[DISPATCH] Mission partenaire créée — en attente acceptation : ' + order.id + ' → ' + order.partner_id);
        return dispatch;
    } catch (e) {
        console.error('[DISPATCH] Erreur createPartnerServiceDispatch:', e);
        return null;
    }
}

function loadPartnerUploads() {
    try {
        if (fs.existsSync(PARTNER_UPLOADS_FILE)) {
            const data = fs.readFileSync(PARTNER_UPLOADS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[PARTNER] Erreur lecture uploads:', error);
    }
    return [];
}

function savePartnerUploads(uploads) {
    try {
        fs.writeFileSync(PARTNER_UPLOADS_FILE, JSON.stringify(uploads, null, 2), 'utf8');
        persistentStore.persistToCloud('partner-uploads', uploads).catch(function(e) {});
    } catch (error) {
        console.error('[PARTNER] Erreur sauvegarde uploads:', error);
    }
}

function loadPartnerComments() {
    try {
        if (fs.existsSync(PARTNER_COMMENTS_FILE)) {
            const data = fs.readFileSync(PARTNER_COMMENTS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[PARTNER] Erreur lecture comments:', error);
    }
    return [];
}

function savePartnerComments(comments) {
    try {
        fs.writeFileSync(PARTNER_COMMENTS_FILE, JSON.stringify(comments, null, 2), 'utf8');
        persistentStore.persistToCloud('partner-comments', comments).catch(function(e) {});
    } catch (error) {
        console.error('[PARTNER] Erreur sauvegarde comments:', error);
    }
}

// ============================================================
// HELPERS - STOCKAGE DES DEVIS (QUOTES)
// ============================================================

function loadQuotes() {
    try {
        if (fs.existsSync(QUOTES_FILE)) {
            const data = fs.readFileSync(QUOTES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[QUOTE] Erreur lecture quotes:', error);
    }
    return [];
}

function saveQuotes(quotes) {
    try {
        fs.writeFileSync(QUOTES_FILE, JSON.stringify(quotes, null, 2), 'utf8');
        persistentStore.persistToCloud('quotes', quotes).catch(function(e) {});
    } catch (error) {
        console.error('[QUOTE] Erreur sauvegarde quotes:', error);
    }
}

function getQuoteById(quoteId) {
    const quotes = loadQuotes();
    return quotes.find(q => q.id === quoteId) || null;
}

function generateQuoteNumber() {
    const quotes = loadQuotes();
    const year = new Date().getFullYear();
    const yearQuotes = quotes.filter(q => q.quote_number && q.quote_number.indexOf('FG-' + year) === 0);
    const nextNum = yearQuotes.length + 1;
    const padded = String(nextNum).padStart(5, '0');
    return 'FG-' + year + '-' + padded;
}

// Mapping service_type -> partner_type
const SERVICE_TO_PARTNER_TYPE = {
    photo: 'photographer',
    video: 'videographer',
    media: 'media',
    marketing: 'marketer'
};

// Middleware d'authentification partenaire
function authenticatePartner(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token d\'authentification requis' });
        }
        const token = authHeader.split(' ')[1];
        const partners = loadPartners();
        const partner = findPartnerByToken(token);
        if (!partner) {
            return res.status(401).json({ error: 'Session partenaire invalide ou expirée' });
        }
        if (partner.accountStatus === 'deactivated') {
            return res.status(403).json({ error: 'Compte partenaire désactivé' });
        }
        req.partner = partner;
        next();
    } catch (error) {
        console.error('[PARTNER] Erreur auth:', error);
        return res.status(500).json({ error: 'Erreur d\'authentification' });
    }
}

// Validation des types de fichiers par type de partenaire
const ALLOWED_FILE_TYPES = {
    photographer: ['jpg', 'jpeg', 'png'],
    videographer: ['mp4', 'mov', '4k'],
    marketer: ['pdf', 'docx'],
    media: ['jpg', 'jpeg', 'png', 'pdf']
};

function validateFileType(partnerType, fileName) {
    const allowed = ALLOWED_FILE_TYPES[partnerType];
    if (!allowed) return false;
    const ext = fileName.split('.').pop().toLowerCase();
    return allowed.indexOf(ext) !== -1;
}

// ============================================================
// MIDDLEWARE
// ============================================================

// CORS - Autoriser le frontend
app.use(cors({
    origin: [
        ...(process.env.NODE_ENV !== 'production' ? ['http://127.0.0.1:5500', 'http://localhost:5500'] : []),
        'https://fagenesis.com',
        'https://www.fagenesis.com',
        'https://financialadvicegenesis.github.io',
        // Capacitor mobile app (Android = https://localhost, iOS = capacitor://localhost)
        'https://localhost',
        'capacitor://localhost',
        'ionic://localhost',
        process.env.FRONT_URL
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}));

// Stripe webhooks nécessitent le raw body pour vérifier la signature.
// Ces routes doivent être déclarées AVANT express.json().
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    var sig     = req.headers['stripe-signature'];
    var secret1 = process.env.STRIPE_WEBHOOK_SECRET;
    var secret2 = process.env.STRIPE_WEBHOOK_SECRET_CONNECT;
    if (!secret1 && !secret2) return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET non configuré' });
    var event;
    // Essayer les deux secrets (Destination 1 = paiements, Destination 2 = comptes connectés)
    var lastErr;
    var secrets = [secret1, secret2].filter(Boolean);
    for (var si = 0; si < secrets.length; si++) {
        try { event = mps.handleWebhookRaw(req.body, sig, secrets[si]); break; }
        catch(e) { lastErr = e; }
    }
    if (!event) { console.error('[STRIPE-WH] Signature invalide:', lastErr && lastErr.message); return res.status(400).send('Webhook Error: ' + (lastErr && lastErr.message)); }

    try {
        if (event.type === 'payment_intent.succeeded') {
            var pi = event.data.object;
            mps.markPaymentSucceeded(pi.id);
            var orderId = pi.metadata && pi.metadata.order_id;
            var stage   = pi.metadata && pi.metadata.stage;
            console.log('[STRIPE-WH] Paiement réussi:', pi.id, orderId, stage);
            if (orderId && stage) {
                var orders = loadOrders();
                var oIdx = orders.findIndex(function(o){ return o.id === orderId; });
                if (oIdx !== -1) {
                    if (stage === 'deposit' || stage === 'installment_1') {
                        orders[oIdx].deposit_paid    = true;
                        orders[oIdx].deposit_paid_at = new Date().toISOString();
                        orders[oIdx].paymentStatus   = 'deposit_paid';
                        orders[oIdx].payment_method  = 'stripe';
                    } else {
                        orders[oIdx].balance_paid    = true;
                        orders[oIdx].balance_paid_at = new Date().toISOString();
                        orders[oIdx].paymentStatus   = 'fully_paid';
                    }
                    orders[oIdx].updatedAt = new Date().toISOString();
                    saveOrders(orders);
                    try { await processDispatchPayout(orders[oIdx], stage); } catch(pe){ console.error('[STRIPE-WH] Payout error:', pe.message); }
                }
            }
        } else if (event.type === 'payment_intent.payment_failed') {
            mps.markPaymentFailed(event.data.object.id);
            console.log('[STRIPE-WH] Paiement échoué:', event.data.object.id);
        } else if (event.type === 'account.updated') {
            // Mise à jour statut KYC d'un prestataire Connect
            var acct = event.data.object;
            var partners = loadPartners();
            var pIdx = partners.findIndex(function(p){ return p.stripeAccountId === acct.id; });
            if (pIdx !== -1) {
                var newStatus = (acct.charges_enabled && acct.payouts_enabled)    ? 'active'
                              : (!acct.details_submitted)                          ? 'pending'
                              : (acct.requirements && acct.requirements.disabled_reason && acct.requirements.disabled_reason.indexOf('rejected') !== -1) ? 'rejected'
                              : (acct.requirements && acct.requirements.currently_due && acct.requirements.currently_due.length > 0) ? 'requires_info'
                              : 'pending';
                partners[pIdx].stripeAccountStatus  = newStatus;
                partners[pIdx].stripeChargesEnabled = acct.charges_enabled;
                partners[pIdx].stripePayoutsEnabled = acct.payouts_enabled;
                partners[pIdx].stripeDetailsSubmitted = acct.details_submitted;
                partners[pIdx].updatedAt = new Date().toISOString();
                savePartners(partners);
                var pEmail = partners[pIdx].email;
                var notifMap = {
                    active:       { t: 'Compte de paiement vérifié ✓',                    b: 'Vous pouvez désormais recevoir vos rémunérations automatiquement.' },
                    pending:      { t: 'Vérification de votre compte en cours',            b: 'Stripe examine vos informations. Vous serez notifié dès validation.' },
                    requires_info:{ t: 'Informations complémentaires requises',            b: 'Connectez-vous à votre espace paiements pour fournir les documents manquants.' },
                    rejected:     { t: 'Compte de paiement refusé',                       b: 'Contactez le support FA GENESIS pour régulariser votre situation.' }
                };
                var nm = notifMap[newStatus];
                if (nm) notifyUser(pEmail, 'partner', 'stripe_account_' + newStatus, nm.t, nm.b, null);
                console.log('[STRIPE-WH] account.updated', acct.id, '→', newStatus);
            }
        } else if (event.type === 'payout.paid') {
            console.log('[STRIPE-WH] Payout versé au prestataire:', event.data.object.id);
        }
    } catch(we) { console.error('[STRIPE-WH] Erreur traitement event:', we.message); }

    res.json({ received: true });
});

// Parser JSON (limite augmentee pour supporter les fichiers base64)
app.use(express.json({ limit: '50mb' }));

// Logger les requetes
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================================
// AUTHENTIFICATION ADMIN — protege TOUTES les routes /api/admin/*
// (auparavant ces routes n'avaient aucune verification cote serveur :
//  n'importe qui pouvait appeler /api/admin/partners et recuperer les
//  IBAN/BIC en clair de tous les prestataires)
// ============================================================
var ADMIN_ACCOUNTS = [
    { email: 'admin@fagenesis.com', password: process.env.ADMIN_PASSWORD || 'FAGenesis2024!' },
    { email: 'tiffenndjambou3@gmail.com', password: process.env.ADMIN_PASSWORD || 'FAGenesis2024!' }
];

function loadAdminSessions() {
    try {
        if (!fs.existsSync(ADMIN_SESSIONS_FILE)) return [];
        return JSON.parse(fs.readFileSync(ADMIN_SESSIONS_FILE, 'utf8')) || [];
    } catch(e) { return []; }
}
function saveAdminSessions(sessions) {
    try {
        fs.writeFileSync(ADMIN_SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
        persistentStore.persistToCloud('admin_sessions', sessions).catch(function(e) {});
    }
    catch(e) { console.error('[ADMIN-AUTH] Erreur sauvegarde sessions:', e); }
}

app.post('/api/admin/login', function(req, res) {
    try {
        var ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        if (!checkRateLimit(ip, 'admin_login', 10, 900000)) {
            return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
        }
        var email = (req.body.email || '').toLowerCase().trim();
        var password = req.body.password || '';
        var match = ADMIN_ACCOUNTS.find(function(a) { return a.email === email && a.password === password; });
        if (!match) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
        // JWT signé — valide sans admin_sessions.json, survit aux redémarrages Render
        var token = _jwt.sign({ email: match.email, role: 'admin' }, _JWT_SECRET, { expiresIn: '30d' });
        console.log('[ADMIN-AUTH] Connexion admin réussie:', match.email);
        res.json({ success: true, token: token, email: match.email });
    } catch(e) {
        console.error('[ADMIN-AUTH] Erreur login:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/admin/logout', function(req, res) {
    try {
        // Avec JWT on ne peut pas révoquer côté serveur — le client supprime son token localStorage
        // On nettoie quand même le legacy sessions file si présent
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        try {
            var sessions = loadAdminSessions().filter(function(s) { return s.token !== token; });
            saveAdminSessions(sessions);
        } catch(e) {}
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

function authenticateAdmin(req, res, next) {
    try {
        var authHeader = req.headers.authorization || '';
        var token = authHeader.indexOf('Bearer ') === 0 ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Authentification admin requise' });
        // Valider le JWT directement (pas de fichier de sessions — survit aux redémarrages)
        var decoded;
        try { decoded = _jwt.verify(token, _JWT_SECRET); } catch(e) {
            // Ancien format UUID (pré-migration) : tenter lookup sessions fichier
            var sessions = loadAdminSessions();
            var legacy = sessions.find(function(s) { return s.token === token; });
            if (!legacy) return res.status(401).json({ error: 'Session expirée — veuillez vous reconnecter.' });
            req.admin = legacy;
            return next();
        }
        if (!decoded || decoded.role !== 'admin') return res.status(403).json({ error: 'Accès admin requis' });
        req.admin = { email: decoded.email, token: token };
        next();
    } catch(e) {
        res.status(500).json({ error: 'Erreur authentification admin' });
    }
}

// Toutes les routes /api/admin/* definies plus bas dans ce fichier exigent desormais
// une session admin valide (sauf /api/admin/login ci-dessus, enregistree avant ce middleware)
app.use('/api/admin', authenticateAdmin);

// ============================================================
// HELPERS - STOCKAGE DES COMMANDES
// ============================================================

function loadOrders() {
    try {
        if (fs.existsSync(ORDERS_FILE)) {
            const data = fs.readFileSync(ORDERS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Erreur lecture orders:', error);
    }
    return [];
}

function saveOrders(orders) {
    try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
        persistentStore.persistToCloud('orders', orders).catch(function(e) {});
    } catch (error) {
        console.error('Erreur sauvegarde orders:', error);
    }
}

function loadContracts() {
    try { if (fs.existsSync(CONTRACTS_FILE)) return JSON.parse(fs.readFileSync(CONTRACTS_FILE, 'utf8')); }
    catch(e) { console.error('Erreur lecture contracts:', e); }
    return [];
}
function saveContracts(contracts) {
    try { fs.writeFileSync(CONTRACTS_FILE, JSON.stringify(contracts, null, 2), 'utf8'); }
    catch(e) { console.error('Erreur sauvegarde contracts:', e); }
    persistentStore.persistToCloud('contracts', contracts).catch(function(e) {});
}

function loadBlockedDates() {
    try {
        if (fs.existsSync(BLOCKED_DATES_FILE)) {
            return JSON.parse(fs.readFileSync(BLOCKED_DATES_FILE, 'utf8'));
        }
    } catch(e) { console.error('Erreur lecture blocked-dates:', e); }
    return [];
}

function saveBlockedDates(dates) {
    try {
        fs.writeFileSync(BLOCKED_DATES_FILE, JSON.stringify(dates, null, 2), 'utf8');
        persistentStore.persistToCloud('blocked-dates', dates).catch(function(e) {});
    } catch(e) { console.error('Erreur sauvegarde blocked-dates:', e); }
}

function loadReservations() {
    try {
        if (fs.existsSync(RESERVATIONS_FILE)) {
            return JSON.parse(fs.readFileSync(RESERVATIONS_FILE, 'utf8'));
        }
    } catch (e) { console.error('Erreur lecture reservations:', e); }
    return [];
}

function saveReservations(reservations) {
    try {
        fs.writeFileSync(RESERVATIONS_FILE, JSON.stringify(reservations, null, 2), 'utf8');
        persistentStore.persistToCloud('reservations', reservations).catch(function(e) {});
    } catch (e) { console.error('Erreur sauvegarde reservations:', e); }
}

// ============================================================
// PUSH NOTIFICATIONS — Web Push API (VAPID)
// ============================================================

var VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BMfYDfWWoNiitqwi1OYkGAuksro9t4bE_udb6vqVRNEFPy54CWaSM2fBoIjSUbT97SOdypKSollhkNqTgyCsUUs';
var VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'MNbWG8XGiuU8wc6t4i7yaFDKtZxIeCbRRb7TF-GJGrQ';

try {
    webpush.setVapidDetails('mailto:contact@fagenesis.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch(e) { console.error('[PUSH] Erreur config VAPID:', e.message); }

function loadPushSubscriptions() {
    try {
        if (fs.existsSync(PUSH_SUBSCRIPTIONS_FILE)) return JSON.parse(fs.readFileSync(PUSH_SUBSCRIPTIONS_FILE, 'utf8'));
    } catch(e) {}
    return [];
}

function savePushSubscriptions(subs) {
    try {
        fs.writeFileSync(PUSH_SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2), 'utf8');
        persistentStore.persistToCloud('push-subscriptions', subs).catch(function(e) {});
    } catch(e) {}
}

var ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@fagenesis.com').toLowerCase().split(',');

function sendPushToUser(email, payload) {
    if (!email) return;
    var subs = loadPushSubscriptions().filter(function(s) {
        return s.email && s.email.toLowerCase() === email.toLowerCase();
    });
    if (subs.length === 0) return;
    var toRemove = [];
    subs.forEach(function(s) {
        webpush.sendNotification(s.subscription, JSON.stringify(payload)).catch(function(err) {
            if (err.statusCode === 410 || err.statusCode === 404) toRemove.push(s.id);
            console.error('[PUSH] Erreur envoi a ' + email + ':', err.statusCode || err.message);
        });
    });
    if (toRemove.length > 0) {
        var cleaned = loadPushSubscriptions().filter(function(s) { return toRemove.indexOf(s.id) === -1; });
        savePushSubscriptions(cleaned);
    }
}

function sendPushToRole(role, payload) {
    var subs = loadPushSubscriptions().filter(function(s) { return s.role === role; });
    if (subs.length === 0) return;
    var toRemove = [];
    subs.forEach(function(s) {
        webpush.sendNotification(s.subscription, JSON.stringify(payload)).catch(function(err) {
            if (err.statusCode === 410 || err.statusCode === 404) toRemove.push(s.id);
        });
    });
    if (toRemove.length > 0) {
        var cleaned = loadPushSubscriptions().filter(function(s) { return toRemove.indexOf(s.id) === -1; });
        savePushSubscriptions(cleaned);
    }
}

// Alerte Bâtisseur+ : notifie les clients de niveau argent/or/elite dont les préférences
// correspondent au type du nouveau partenaire venant d'être approuvé.
function alertBatisseurPlusOnNewPartner(partner) {
    try {
        var batisseurBadges = ['argent', 'or', 'elite'];
        var partnerName = ((partner.prenom || '') + ' ' + (partner.nom || '')).trim();
        var partnerType = partner.partner_type || '';
        loadUsers().forEach(function(user) {
            var qg = getClientGenesisPoints(user);
            var badge = getClientQGBadge(qg);
            if (batisseurBadges.indexOf(badge) === -1) return;
            // Priorité aux préférences explicitement renseignées par le client ; sinon, dérivées des favoris/historique
            var preferred = (user.preferred_partner_types && user.preferred_partner_types.length)
                ? user.preferred_partner_types
                : getClientPreferredCategories(user.email);
            // Si des préférences sont connues, ne notifier que si le type du partenaire correspond
            if (preferred.length > 0 && preferred.indexOf(partnerType) === -1) return;
            notifyUser(
                user.email,
                'client',
                'nouveau-prestataire',
                'Nouveau prestataire disponible',
                partnerName + ' vient de rejoindre GENESIS et correspond à vos préférences.',
                '/app.html'
            );
        });
    } catch(e) {
        console.error('[ALERT] alertBatisseurPlusOnNewPartner erreur:', e);
    }
}

// notifyUser : persiste une notification (historique consultable) ET tente un push best-effort
// (le push best-effort existant n'est pas retire, juste complete par la persistance).
function notifyUser(email, role, type, title, body, link) {
    try {
        var notif = {
            id: 'NOTIF-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
            email: email || null,
            role: role || 'client',
            type: type || 'info',
            title: title || '',
            body: body || '',
            link: link || null,
            read: false,
            created_at: new Date().toISOString()
        };
        var all = loadNotifications();
        all.push(notif);
        saveNotifications(all);

        var pushPayload = {
            title: title || 'FA GENESIS',
            body: body || '',
            icon: '/assets/images/logo-favicon-192.png',
            badge: '/assets/images/logo-favicon-32.png',
            url: link || '/',
            tag: type || 'notif'
        };
        if (email) sendPushToUser(email, pushPayload);
        else if (role) sendPushToRole(role, pushPayload);
    } catch(e) {
        console.error('[NOTIFY] Erreur notifyUser:', e);
    }
}

// Identifie l'utilisateur courant (admin JWT, partenaire ou client) a partir du token Bearer,
// pour les routes communes aux 3 roles (notifications, litiges).
function resolveCurrentIdentity(req) {
    var authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    var token = authHeader.split(' ')[1];

    try {
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);
        if (decoded && decoded.role === 'admin') {
            return { role: 'admin', email: decoded.email || null };
        }
    } catch(e) { /* pas un JWT admin valide, on continue */ }

    var partner = findPartnerByToken(token);
    if (partner) return { role: 'partner', email: partner.email, partner: partner };

    var user = findUserByToken(token);
    if (user) return { role: 'client', email: user.email, user: user };

    return null;
}

// GET /api/notifications
app.get('/api/notifications', function(req, res) {
    var identity = resolveCurrentIdentity(req);
    if (!identity) return res.status(401).json({ error: 'Non autorise' });

    var all = loadNotifications();
    var mine = all.filter(function(n) {
        if (identity.role === 'admin') return n.role === 'admin';
        return n.role === identity.role && n.email && n.email.toLowerCase() === identity.email.toLowerCase();
    }).sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

    res.json({ ok: true, notifications: mine, unread_count: mine.filter(function(n) { return !n.read; }).length });
});

// POST /api/notifications/:id/read
app.post('/api/notifications/:id/read', function(req, res) {
    var identity = resolveCurrentIdentity(req);
    if (!identity) return res.status(401).json({ error: 'Non autorise' });

    var all = loadNotifications();
    var idx = all.findIndex(function(n) { return n.id === req.params.id; });
    if (idx === -1) return res.status(404).json({ error: 'Notification non trouvee' });
    var n = all[idx];
    var owns = identity.role === 'admin' ? n.role === 'admin' : (n.role === identity.role && n.email && n.email.toLowerCase() === identity.email.toLowerCase());
    if (!owns) return res.status(403).json({ error: 'Acces non autorise' });

    all[idx].read = true;
    saveNotifications(all);
    res.json({ ok: true });
});

// POST /api/notifications/read-all
app.post('/api/notifications/read-all', function(req, res) {
    var identity = resolveCurrentIdentity(req);
    if (!identity) return res.status(401).json({ error: 'Non autorise' });

    var all = loadNotifications();
    all.forEach(function(n) {
        var owns = identity.role === 'admin' ? n.role === 'admin' : (n.role === identity.role && n.email && n.email.toLowerCase() === identity.email.toLowerCase());
        if (owns) n.read = true;
    });
    saveNotifications(all);
    res.json({ ok: true });
});

// ── Litiges (Phase 6) ──

function buildDisputeSystemPrompt(dispute) {
    return 'Tu es Jeremie, mediateur de premier niveau pour la marketplace FA GENESIS. '
        + 'Un litige a ete ouvert entre un client et un partenaire prestataire au sujet d\'une mission (categorie : ' + (dispute.category || 'non precisee') + '). '
        + 'Ton role : rester neutre, resumer le differend en une phrase, poser une question de clarification ou proposer une piste de resolution concrete. '
        + 'Tu n\'as aucun pouvoir de decision financiere (pas de remboursement automatique) — toute decision finale revient a un administrateur humain. '
        + 'Reponds en francais, de facon breve (5 phrases maximum) et bienveillante.';
}

// POST /api/disputes — ouverture d'un litige par le client ou le partenaire sur un dispatch
app.post('/api/disputes', function(req, res) {
    try {
        var identity = resolveCurrentIdentity(req);
        if (!identity || identity.role === 'admin') return res.status(401).json({ error: 'Non autorise' });

        var dispatchId = req.body && req.body.dispatch_id;
        var category = (req.body && req.body.category || '').trim();
        var description = (req.body && req.body.description || '').trim();
        if (!dispatchId) return res.status(400).json({ error: 'dispatch_id requis' });
        if (description.length < 10) return res.status(400).json({ error: 'Merci de decrire le probleme (10 caracteres minimum).' });

        var dispatch = loadDispatches().find(function(d) { return d.id === dispatchId; });
        if (!dispatch) return res.status(404).json({ error: 'Mission non trouvee' });

        var isOwner = (identity.role === 'client' && dispatch.client_email && dispatch.client_email.toLowerCase() === identity.email.toLowerCase())
            || (identity.role === 'partner' && dispatch.claimed_by_partner_id === identity.partner.id);
        if (!isOwner) return res.status(403).json({ error: 'Acces non autorise a cette mission' });

        var fromName = identity.role === 'partner'
            ? ((identity.partner.prenom || '') + ' ' + (identity.partner.nom || '')).trim()
            : (((identity.user && ((identity.user.prenom || '') + ' ' + (identity.user.nom || '')).trim())) || identity.email);

        var dispute = {
            id: 'DISPUTE-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
            order_id: dispatch.order_id,
            dispatch_id: dispatch.id,
            partner_id: dispatch.claimed_by_partner_id,
            client_email: dispatch.client_email,
            opened_by: identity.role,
            category: category || 'autre',
            description: description,
            status: 'open',
            messages: [{ from_role: identity.role, from_name: fromName, content: description, created_at: new Date().toISOString() }],
            jeremie_reply_count: 0,
            admin_resolution: null,
            created_at: new Date().toISOString()
        };

        var disputes = loadDisputes();
        disputes.push(dispute);
        saveDisputes(disputes);

        var notifyAdminNewDispute = function() {
            notifyUser(null, 'admin', 'litige', 'Nouveau litige ouvert', fromName + ' a ouvert un litige (' + dispute.category + ')', '/admin.html#open-disputes');
        };

        if (aiService.isJeremieAvailable()) {
            var systemPrompt = buildDisputeSystemPrompt(dispute);
            aiService.askJeremie(systemPrompt, [], description).then(function(result) {
                var all = loadDisputes();
                var idx = all.findIndex(function(d) { return d.id === dispute.id; });
                if (idx !== -1) {
                    if (result.success) {
                        all[idx].messages.push({ from_role: 'jeremie', from_name: 'Jeremie (IA)', content: result.reply, created_at: new Date().toISOString() });
                        all[idx].status = 'jeremie_triage';
                        all[idx].jeremie_reply_count = 1;
                        saveDisputes(all);
                        dispute = all[idx];
                    } else {
                        all[idx].messages.push({ from_role: 'system', from_name: 'FA GENESIS', content: 'Notre equipe va examiner votre litige.', created_at: new Date().toISOString() });
                        saveDisputes(all);
                        dispute = all[idx];
                        notifyAdminNewDispute();
                    }
                }
                res.json({ ok: true, dispute: dispute, sla_label: GENESIS_DISPUTE_SLA_LABEL });
            }).catch(function(err) {
                console.error('[DISPUTE] Erreur askJeremie:', err);
                notifyAdminNewDispute();
                res.json({ ok: true, dispute: dispute, sla_label: GENESIS_DISPUTE_SLA_LABEL });
            });
        } else {
            var all2 = loadDisputes();
            var idx2 = all2.findIndex(function(d) { return d.id === dispute.id; });
            if (idx2 !== -1) {
                all2[idx2].messages.push({ from_role: 'system', from_name: 'FA GENESIS', content: 'Notre equipe va examiner votre litige.', created_at: new Date().toISOString() });
                saveDisputes(all2);
                dispute = all2[idx2];
            }
            notifyAdminNewDispute();
            res.json({ ok: true, dispute: dispute, sla_label: GENESIS_DISPUTE_SLA_LABEL });
        }
    } catch (err) {
        console.error('[DISPUTE] Erreur creation:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/disputes/mine — liste des litiges du client/partenaire connecte
app.get('/api/disputes/mine', function(req, res) {
    try {
        var identity = resolveCurrentIdentity(req);
        if (!identity || identity.role === 'admin') return res.status(401).json({ error: 'Non autorise' });

        var disputes = loadDisputes().filter(function(d) {
            if (identity.role === 'client') return d.client_email && d.client_email.toLowerCase() === identity.email.toLowerCase();
            return d.partner_id === identity.partner.id;
        }).sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

        res.json({ ok: true, disputes: disputes, sla_label: GENESIS_DISPUTE_SLA_LABEL });
    } catch (err) {
        console.error('[DISPUTE] Erreur mine:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/disputes/:id/message — ajoute un message au fil du litige (relance Jeremie si en triage)
app.post('/api/disputes/:id/message', function(req, res) {
    try {
        var identity = resolveCurrentIdentity(req);
        if (!identity) return res.status(401).json({ error: 'Non autorise' });

        var content = (req.body && req.body.content || '').trim();
        if (content.length < 1) return res.status(400).json({ error: 'Message vide' });

        var disputes = loadDisputes();
        var idx = disputes.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Litige non trouve' });
        var dispute = disputes[idx];

        var isParty = identity.role === 'admin'
            || (identity.role === 'client' && dispute.client_email && dispute.client_email.toLowerCase() === identity.email.toLowerCase())
            || (identity.role === 'partner' && dispute.partner_id === identity.partner.id);
        if (!isParty) return res.status(403).json({ error: 'Acces non autorise' });
        if (dispute.status === 'resolved') return res.status(409).json({ error: 'Ce litige est deja resolu.' });

        var fromName = identity.role === 'admin'
            ? 'FA GENESIS (admin)'
            : identity.role === 'partner'
                ? ((identity.partner.prenom || '') + ' ' + (identity.partner.nom || '')).trim()
                : (((identity.user && ((identity.user.prenom || '') + ' ' + (identity.user.nom || '')).trim())) || identity.email);

        dispute.messages.push({ from_role: identity.role, from_name: fromName, content: content, created_at: new Date().toISOString() });

        var shouldAskJeremie = identity.role !== 'admin' && dispute.status === 'jeremie_triage' && dispute.jeremie_reply_count < 3 && aiService.isJeremieAvailable();

        if (!shouldAskJeremie) {
            if (identity.role !== 'admin' && dispute.status === 'jeremie_triage' && dispute.jeremie_reply_count >= 3) {
                dispute.status = 'escalated_admin';
                notifyUser(null, 'admin', 'litige', 'Litige escalade', 'Le litige ' + dispute.id + ' necessite une intervention humaine.', '/admin.html#open-disputes');
            }
            disputes[idx] = dispute;
            saveDisputes(disputes);
            return res.json({ ok: true, dispute: dispute, sla_label: GENESIS_DISPUTE_SLA_LABEL });
        }

        disputes[idx] = dispute;
        saveDisputes(disputes);

        var systemPrompt = buildDisputeSystemPrompt(dispute);
        var history = dispute.messages.slice(0, -1).map(function(m) { return { role: m.from_role === 'jeremie' ? 'assistant' : 'user', content: m.content }; });

        aiService.askJeremie(systemPrompt, history, content).then(function(result) {
            var all = loadDisputes();
            var i2 = all.findIndex(function(d) { return d.id === dispute.id; });
            if (i2 === -1) return res.json({ ok: true, dispute: dispute, sla_label: GENESIS_DISPUTE_SLA_LABEL });
            if (result.success) {
                all[i2].messages.push({ from_role: 'jeremie', from_name: 'Jeremie (IA)', content: result.reply, created_at: new Date().toISOString() });
                all[i2].jeremie_reply_count = (all[i2].jeremie_reply_count || 0) + 1;
                if (all[i2].jeremie_reply_count >= 3) {
                    all[i2].status = 'escalated_admin';
                    notifyUser(null, 'admin', 'litige', 'Litige escalade', 'Le litige ' + all[i2].id + ' necessite une intervention humaine.', '/admin.html#open-disputes');
                }
            }
            saveDisputes(all);
            res.json({ ok: true, dispute: all[i2] });
        }).catch(function(err) {
            console.error('[DISPUTE] Erreur askJeremie message:', err);
            res.json({ ok: true, dispute: dispute, sla_label: GENESIS_DISPUTE_SLA_LABEL });
        });
    } catch (err) {
        console.error('[DISPUTE] Erreur message:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/disputes/:id/escalate — demande explicite d'intervention humaine
app.post('/api/disputes/:id/escalate', function(req, res) {
    try {
        var identity = resolveCurrentIdentity(req);
        if (!identity || identity.role === 'admin') return res.status(401).json({ error: 'Non autorise' });

        var disputes = loadDisputes();
        var idx = disputes.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Litige non trouve' });
        var dispute = disputes[idx];

        var isParty = (identity.role === 'client' && dispute.client_email && dispute.client_email.toLowerCase() === identity.email.toLowerCase())
            || (identity.role === 'partner' && dispute.partner_id === identity.partner.id);
        if (!isParty) return res.status(403).json({ error: 'Acces non autorise' });
        if (dispute.status === 'resolved') return res.status(409).json({ error: 'Ce litige est deja resolu.' });

        dispute.status = 'escalated_admin';
        disputes[idx] = dispute;
        saveDisputes(disputes);
        notifyUser(null, 'admin', 'litige', 'Intervention humaine demandee', 'Le litige ' + dispute.id + ' demande l\'intervention d\'un administrateur.', '/admin.html#open-disputes');
        res.json({ ok: true, dispute: dispute, sla_label: GENESIS_DISPUTE_SLA_LABEL });
    } catch (err) {
        console.error('[DISPUTE] Erreur escalate:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/admin/test-email — test direct de l'envoi d'email partenaire service
app.post('/api/admin/test-email', async function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acces admin requis' });

        var targetEmail = req.body.email || decoded.email || 'contact@fagenesis.com';
        var mockOrder = {
            id: 'ORD-TEST-DIAG',
            product_name: 'Test prestation partenaire',
            deposit_amount: 99,
            total_price: 330,
            created_at: new Date().toISOString()
        };
        var result = await emailService.sendPartnerServiceOrderConfirmation(
            targetEmail, 'Admin', mockOrder, 'Prestataire Test'
        );
        res.json({ success: true, emailResult: result, sentTo: targetEmail });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /api/admin/disputes — file d'attente admin
app.get('/api/admin/disputes', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acces admin requis' });

        var statusOrder = { escalated_admin: 0, jeremie_triage: 1, open: 2, resolved: 3 };
        var partners = loadPartners();
        var disputes = loadDisputes().slice().sort(function(a, b) {
            var sa = statusOrder[a.status] !== undefined ? statusOrder[a.status] : 9;
            var sb = statusOrder[b.status] !== undefined ? statusOrder[b.status] : 9;
            if (sa !== sb) return sa - sb;
            return new Date(b.created_at) - new Date(a.created_at);
        }).map(function(d) {
            var partner = partners.find(function(p) { return p.id === d.partner_id; });
            return Object.assign({}, d, {
                partner_name: partner ? ((partner.prenom || '') + ' ' + (partner.nom || '')).trim() : null,
                partner_email: partner ? partner.email : null
            });
        });

        res.json({ ok: true, disputes: disputes });
    } catch (err) {
        console.error('[DISPUTE] Erreur admin list:', err);
        res.status(401).json({ error: 'Non autorise' });
    }
});

// POST /api/admin/disputes/:id/resolve — verdict admin (ecrit, pas d'action financiere automatisee)
app.post('/api/admin/disputes/:id/resolve', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acces admin requis' });

        var verdict = req.body && req.body.verdict;
        var note = (req.body && req.body.note || '').trim();
        var validVerdicts = ['partner_favor', 'client_favor', 'split', 'manual_action_required'];
        if (validVerdicts.indexOf(verdict) === -1) return res.status(400).json({ error: 'Verdict invalide' });

        var disputes = loadDisputes();
        var idx = disputes.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Litige non trouve' });
        var dispute = disputes[idx];
        if (dispute.status === 'resolved') return res.status(409).json({ error: 'Ce litige est deja resolu.' });

        dispute.status = 'resolved';
        dispute.admin_resolution = {
            verdict: verdict,
            note: note,
            resolved_by: decoded.email || 'admin',
            resolved_at: new Date().toISOString()
        };
        disputes[idx] = dispute;
        saveDisputes(disputes);

        var partner = getPartnerById(dispute.partner_id);
        notifyUser(dispute.client_email, 'client', 'litige-resolu', 'Litige resolu', 'Votre litige a ete resolu par notre equipe.', '/app.html#open-litiges');
        if (partner && partner.email) {
            notifyUser(partner.email, 'partner', 'litige-resolu', 'Litige resolu', 'Le litige avec votre client a ete resolu par notre equipe.', '/app.html#open-litiges');
        }

        releaseOnHoldPayouts(dispute.dispatch_id).catch(function(e) { console.error('[DISPUTE] Erreur releaseOnHoldPayouts:', e); });

        res.json({ ok: true, dispute: dispute, sla_label: GENESIS_DISPUTE_SLA_LABEL });
    } catch (err) {
        console.error('[DISPUTE] Erreur resolve:', err);
        res.status(401).json({ error: 'Non autorise' });
    }
});

// GET /api/push/vapid-public-key
app.get('/api/push/vapid-public-key', function(req, res) {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe
app.post('/api/push/subscribe', function(req, res) {
    try {
        var subscription = req.body.subscription;
        var role = req.body.role || 'client';
        if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Subscription invalide' });

        var email = null;
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var partnerToken = process.env.PARTNER_TOKEN || 'fa-genesis-partner-2024';

        if (token === partnerToken) {
            role = 'partner';
            email = 'partner';
        } else if (isValidAdminKey(req)) {
            role = 'admin';
            email = 'admin';
        } else if (token) {
            var users = loadUsers();
            var u = findUserByToken(token);
            if (u) {
                email = u.email;
                // Élever le rôle en 'admin' si l'email est un compte admin
                role = ADMIN_EMAILS.indexOf(u.email.toLowerCase()) !== -1 ? 'admin' : 'client';
            }
        }

        var subs = loadPushSubscriptions();
        // Supprimer l'ancienne subscription du même endpoint
        subs = subs.filter(function(s) { return s.subscription.endpoint !== subscription.endpoint; });
        subs.push({
            id: uuidv4(),
            email: email,
            role: role,
            subscription: subscription,
            created_at: new Date().toISOString()
        });
        savePushSubscriptions(subs);
        console.log('[PUSH] Abonnement enregistré — role:', role, 'email:', email);
        res.json({ success: true });
    } catch(e) {
        console.error('[PUSH] Erreur subscribe:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/push/unsubscribe
app.delete('/api/push/unsubscribe', function(req, res) {
    try {
        var endpoint = req.body.endpoint;
        if (!endpoint) return res.status(400).json({ error: 'endpoint requis' });
        var subs = loadPushSubscriptions().filter(function(s) { return s.subscription.endpoint !== endpoint; });
        savePushSubscriptions(subs);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ──────────────────────────────────────────────────────────────────────────────
// FCM TOKEN — Enregistrement des tokens Firebase Cloud Messaging (app native)
// ──────────────────────────────────────────────────────────────────────────────

function loadFcmTokens() {
    try {
        if (fs.existsSync(FCM_TOKENS_FILE)) return JSON.parse(fs.readFileSync(FCM_TOKENS_FILE, 'utf8'));
    } catch(e) {}
    return [];
}

function saveFcmTokens(tokens) {
    try { fs.writeFileSync(FCM_TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8'); } catch(e) {}
}

// Envoie une notification FCM à tous les tokens enregistrés pour un userId (best-effort)
function sendFcmToUser(userId, payload) {
    if (!firebaseAdmin || !userId) return;
    var tokens = loadFcmTokens().filter(function(t) { return t.userId === userId; });
    if (tokens.length === 0) return;
    var expired = [];
    tokens.forEach(function(t) {
        firebaseAdmin.messaging().send({
            token: t.token,
            notification: { title: payload.title || 'FA GENESIS', body: payload.body || '' },
            android: { channelId: payload.channelId || 'genesis_general', priority: 'high' },
            data: payload.data || {}
        }).then(function() {
            console.log('[FCM] Notification envoyée à userId=' + userId);
        }).catch(function(err) {
            // Token expiré ou invalide → supprimer
            if (err.code === 'messaging/registration-token-not-registered' ||
                err.code === 'messaging/invalid-registration-token') {
                expired.push(t.token);
            }
            console.warn('[FCM] Erreur envoi:', err.message);
        });
    });
    if (expired.length > 0) {
        var cleaned = loadFcmTokens().filter(function(t) { return expired.indexOf(t.token) === -1; });
        saveFcmTokens(cleaned);
    }
}

// POST /api/push/register — Enregistre un token FCM depuis l'app native Capacitor
app.post('/api/push/register', function(req, res) {
    try {
        var token = req.body.token;
        var userId = req.body.userId;
        var platform = req.body.platform || 'android';
        if (!token || !userId) return res.status(400).json({ error: 'token et userId requis' });

        var tokens = loadFcmTokens();
        // Supprimer les anciennes entrées pour ce même token
        tokens = tokens.filter(function(t) { return t.token !== token; });
        tokens.push({
            id: uuidv4(),
            userId: String(userId),
            token: token,
            platform: platform,
            registered_at: new Date().toISOString()
        });
        saveFcmTokens(tokens);
        console.log('[FCM] Token enregistré — userId:', userId, 'platform:', platform);
        res.json({ success: true });
    } catch(e) {
        console.error('[FCM] Erreur register:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

function getOrderById(orderId) {
    const orders = loadOrders();
    return orders.find(o => o.id === orderId) || null;
}

function updateOrder(orderId, updates) {
    const orders = loadOrders();
    const index = orders.findIndex(o => o.id === orderId);
    if (index === -1) return null;

    orders[index] = { ...orders[index], ...updates, updated_at: new Date().toISOString() };
    // Dès que l'acompte est payé : fixer les dates d'échéance des mensualités suivantes
    if (updates.deposit_paid === true && orders[index].installments && orders[index].installments.length > 1) {
        orders[index] = setInstallmentDueDates(orders[index]);
    }
    saveOrders(orders);
    // Si la commande fait partie d'un Projet GENESIS, vérifier si toutes les prestations sont terminées
    if (updates.status === 'completed' && orders[index].project_id) {
        checkAndCompleteGenesisProject(orders[index].project_id, orders);
    }
    // Générer automatiquement le contrat de prestation si require_contract=true et acompte payé
    if (updates.deposit_paid === true && orders[index].require_contract === true) {
        var _existingCtr = contractService.loadContracts().find(function(c) { return c.order_id === orders[index].id && c.type === 'service'; });
        if (!_existingCtr) {
            setTimeout(function() {
                try {
                    var _order = orders[index];
                    var _partner = getPartnerById(_order.partner_id);
                    var _users = loadUsers();
                    var _clientEmail = _order.client_info && _order.client_info.email;
                    var _clientUser = _users.find(function(u) { return u.email === _clientEmail; });
                    var _clientName = _clientUser
                        ? ((_clientUser.prenom || _clientUser.firstName || '') + ' ' + (_clientUser.nom || _clientUser.lastName || '')).trim()
                        : ((_order.client_info && _order.client_info.first_name || '') + ' ' + (_order.client_info && _order.client_info.last_name || '')).trim();
                    var _now = new Date().toISOString();
                    var _cId = 'CTR-SVC-' + uuidv4().split('-')[0].toUpperCase();
                    var _newCtr = {
                        id: _cId, type: 'service', status: 'pending_client_signature',
                        order_id: _order.id, service_name: _order.product_name || '',
                        service_price: parseFloat(_order.total_amount || 0),
                        client_type: (_order.client_info && _order.client_info.client_type) || 'particulier',
                        partner_id: _partner ? _partner.id : null,
                        partner_email: _partner ? _partner.email : '',
                        partner_name: _partner ? ((_partner.prenom || '') + ' ' + (_partner.nom || '')).trim() : '',
                        partner_type: _partner ? _partner.partner_type : null,
                        client_email: _clientEmail || '', client_name: _clientName,
                        custom_conditions: _order.service_custom_conditions || '',
                        signed_at: null, signed_ip: null, signature_name: null, signature_data: null,
                        refused_at: null,
                        events: [{ type: 'generated', at: _now, detail: 'Contrat généré automatiquement après paiement acompte' }],
                        contract_version: contractService.CONTRACT_VERSION,
                        created_at: _now, updated_at: _now
                    };
                    var _contracts = contractService.loadContracts();
                    _contracts.push(_newCtr);
                    contractService.saveContracts(_contracts);
                    if (_clientEmail) {
                        notifyUser(_clientEmail, 'client', 'contract_ready', 'Contrat prêt à signer',
                            'Votre contrat de prestation avec ' + _newCtr.partner_name + ' est disponible. Signez-le pour démarrer la mission.',
                            '/app.html#mes-contrats');
                    }
                    if (_partner) {
                        notifyUser(_partner.email, 'partner', 'contract_sent', 'Contrat envoyé au client',
                            'Le contrat pour la commande ' + _order.id + ' a été envoyé à ' + (_clientName || _clientEmail) + '.',
                            '/app.html');
                    }
                    console.log('[CONTRACT] Contrat prestation auto-généré:', _cId);
                } catch(_e) { console.error('[CONTRACT] Erreur auto-génération:', _e); }
            }, 500);
        }
    }
    return orders[index];
}

// Assigner les dates d'échéance mensuelles aux mensualités restantes dès le paiement de l'acompte
function setInstallmentDueDates(order) {
    if (!order || !order.installments || order.installments.length <= 1) return order;
    var depositDate = new Date();
    var month = 1;
    order.installments = order.installments.map(function(inst) {
        if (inst.stage === 'deposit') return inst;
        var due = new Date(depositDate.getTime() + month * 30 * 24 * 60 * 60 * 1000);
        month++;
        return Object.assign({}, inst, {
            due_date: due.toISOString(),
            due_date_set_at: depositDate.toISOString()
        });
    });
    return order;
}

function checkAndCompleteGenesisProject(projectId, allOrders) {
    try {
        var projects = loadGenesisProjects();
        var projIdx = projects.findIndex(function(p) { return p.id === projectId; });
        if (projIdx === -1) return;
        var proj = projects[projIdx];
        var ordersToCheck = allOrders || loadOrders();
        var subOrders = ordersToCheck.filter(function(o) { return o.project_id === projectId; });
        if (!subOrders.length) return;
        var allCompleted = subOrders.every(function(o) { return o.status === 'completed'; });
        var completedCount = subOrders.filter(function(o) { return o.status === 'completed'; }).length;
        var progressPct = Math.round((completedCount / subOrders.length) * 100);
        var newStatus = allCompleted ? 'completed' : (completedCount > 0 ? 'in_progress' : 'pending_deposit');
        projects[projIdx] = Object.assign({}, proj, {
            status: newStatus,
            progress_pct: progressPct,
            updated_at: new Date().toISOString(),
            completed_at: allCompleted ? new Date().toISOString() : (proj.completed_at || null)
        });
        // Mettre à jour les statuts de prestation
        if (Array.isArray(projects[projIdx].prestations)) {
            projects[projIdx].prestations = projects[projIdx].prestations.map(function(prest) {
                var subOrd = subOrders.find(function(o) { return o.id === prest.order_id; });
                return Object.assign({}, prest, { status: subOrd ? subOrd.status : prest.status });
            });
        }
        saveGenesisProjects(projects);
        if (allCompleted) {
            console.log('[GENESIS-PROJECT] Projet ' + projectId + ' terminé — toutes les prestations livrées.');
        }
    } catch(e) { console.error('[GENESIS-PROJECT] Erreur checkAndComplete:', e.message); }
}

// ============================================================
// RAPPELS MENSUALITÉS — job quotidien
// ============================================================

function checkInstallmentReminders() {
    try {
        var now = new Date();
        var todayStr = now.toISOString().slice(0, 10);
        var in3DaysStr = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10);
        var orders = loadOrders();
        var modified = false;
        orders.forEach(function(order) {
            if (!order.installments || order.installments.length <= 1) return;
            if (!order.deposit_paid) return;
            var clientEmail = order.client_info && order.client_info.email;
            if (!clientEmail) return;
            var clientFirstName = (order.client_info && order.client_info.first_name) || 'Client';
            order.installments.forEach(function(inst) {
                if (inst.paid || inst.stage === 'deposit') return;
                if (!inst.due_date) return;
                var dueStr = inst.due_date.slice(0, 10);
                var isUpcoming = dueStr <= in3DaysStr && dueStr >= todayStr;
                var isOverdue = dueStr < todayStr;
                if (!isUpcoming && !isOverdue) return;
                var lastReminded = inst.last_reminded_at ? inst.last_reminded_at.slice(0, 10) : null;
                if (lastReminded === todayStr) return;
                inst.last_reminded_at = now.toISOString();
                modified = true;
                var dueDateFr = new Date(inst.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
                if (isOverdue) {
                    notifyUser(clientEmail, 'client', 'installment-overdue', 'Mensualité en retard ⚠️',
                        (inst.label || 'Mensualité') + ' de ' + inst.amount + ' € était due le ' + dueDateFr + '. Connectez-vous pour régler.',
                        '/app.html#open-reservations');
                    try { emailService.sendInstallmentReminderEmail && emailService.sendInstallmentReminderEmail(clientEmail, clientFirstName, order, inst, true).catch(function(e) { console.error('[INSTALLMENT-REMINDER]', e.message); }); } catch(e2) {}
                } else {
                    notifyUser(clientEmail, 'client', 'installment-reminder', 'Mensualité à venir 📅',
                        (inst.label || 'Mensualité') + ' de ' + inst.amount + ' € est due le ' + dueDateFr + '.',
                        '/app.html#open-reservations');
                    try { emailService.sendInstallmentReminderEmail && emailService.sendInstallmentReminderEmail(clientEmail, clientFirstName, order, inst, false).catch(function(e) { console.error('[INSTALLMENT-REMINDER]', e.message); }); } catch(e2) {}
                }
            });
        });
        if (modified) saveOrders(orders);
        console.log('[INSTALLMENT-REMINDER] Vérification terminée —', new Date().toLocaleString('fr-FR'));
    } catch(e) { console.error('[INSTALLMENT-REMINDER] Erreur:', e.message); }
}
// Lancer au démarrage puis toutes les 24h
setTimeout(checkInstallmentReminders, 60000); // premier passage 1 min après le démarrage
setInterval(checkInstallmentReminders, 24 * 60 * 60 * 1000);

// ============================================================
// HELPERS - CALCUL JOUR COURANT (ACCOMPAGNEMENT)
// ============================================================

/**
 * Parse une chaine de duree en nombre de jours
 * @param {string} duration - Ex: "2 jours", "7 jours", "1 mois", "30 jours"
 * @returns {number}
 */
function parseDurationToDays(duration) {
    if (!duration) return 0;
    const str = duration.toLowerCase().trim();
    const match = str.match(/^(\d+)\s*(jour|jours|mois)$/);
    if (!match) return 0;
    const num = parseInt(match[1]);
    const unit = match[2];
    if (unit === 'mois') return num * 30;
    return num;
}

// ============================================================
// HELPER - ACTIVE SUBSCRIPTION (source de verite unique)
// ============================================================

/**
 * Construit l'objet activeSubscription a partir d'un user et de sa commande payee.
 * Utilise par /api/dashboard et /api/auth/me.
 */
function buildActiveSubscription(user, order) {
    if (!order) return null;
    var product = getProductById(order.product_id);
    var categoryMap = {
        'etudiant': 'ETUDIANTS',
        'particulier': 'PARTICULIERS',
        'entreprise': 'ENTREPRISES'
    };
    var catKey = (order.product_id || '').split('-')[0];
    var category = categoryMap[catKey] || (order.product_type === 'prestation_individuelle' ? 'TARIF_INDIVIDUEL' : 'DEVIS');
    var formulaLabel = product ? product.name : (order.product_name || 'Offre personnalisee');
    var durationDays = order.duration_days || (product ? product.duration_days : null) || null;

    // Solde restant : en mode installements, total - deja_paye ; sinon balance_amount
    var remainingDue = 0;
    if (!order.balance_paid) {
        if (order.installments && order.installments.length > 0) {
            remainingDue = (order.total_amount || 0) - (order.amount_paid || 0);
        } else {
            remainingDue = order.balance_amount || 0;
        }
    }
    // Prochain versement a payer
    var nextInst = null;
    if (order.installments && order.installments.length > 0) {
        nextInst = order.installments.find(function(inst) {
            return !inst.paid && inst.stage !== 'deposit';
        }) || null;
    }

    // GENESIS SAFE™ : badge "Paiement sécurisé" tant que la tranche finale n'est pas payee
    var hasGenesisSplitSub = order.installments && order.installments.length === 3;
    var tranche3PaidSub = hasGenesisSplitSub ? !!order.installments[2].paid : !!order.balance_paid;
    var paymentSecured = order.deposit_paid === true && !tranche3PaidSub;

    return {
        product_type: order.product_type || 'accompagnement',
        category: category,
        formula_key: order.product_id || '',
        formula_label: formulaLabel,
        startDate: order.start_date || null,
        durationDays: durationDays,
        deposit_paid: order.deposit_paid === true,
        balance_paid: order.balance_paid === true,
        balance_payment_ready: order.balance_payment_ready === true,
        remaining_due: remainingDue,
        total_amount: order.total_amount || 0,
        deposit_amount: order.deposit_amount || 0,
        amount_paid: order.amount_paid || 0,
        installments_count: order.installments_count || 2,
        installments: order.installments || null,
        next_installment: nextInst,
        payment_secured: paymentSecured,
        status: order.status || 'registered',
        schedule_status: order.schedule_status || null,
        proposed_start_date: order.proposed_start_date || null,
        order_id: order.id || null,
        next_step_label: computeNextStep(order)
    };
}

function computeNextStep(order) {
    if (!order) return '';
    if (!order.deposit_paid) return 'Payer l\'acompte pour activer votre espace';
    if (!order.start_date && order.schedule_status !== 'confirmed')
        return 'Choisir votre date de demarrage';
    if (!order.balance_paid)
        return 'Payer le solde pour debloquer les telechargements';
    return 'Votre accompagnement est en cours';
}

/**
 * Retourne les roles d'intervenants autorises selon le type de produit de la commande
 */
function getAllowedProviders(order) {
    var productId = (order && order.product_id) || '';
    var PROVIDER_LABELS = {
        admin: 'Consultant FA GENESIS',
        photographer: 'Photographe',
        videographer: 'Videaste',
        marketer: 'Consultant Marketing',
        media: 'Specialiste Media'
    };

    var roles = [];

    // Tarifs individuels (devis)
    if (productId.indexOf('photo-') === 0) {
        roles = ['photographer'];
    } else if (productId.indexOf('video-') === 0) {
        roles = ['videographer'];
    } else if (productId.indexOf('marketing-') === 0) {
        roles = ['marketer'];
    } else if (productId.indexOf('media-') === 0) {
        roles = ['media'];
    }
    // Offres ETUDIANT et PARTICULIER
    else if (productId === 'etudiant-idea' || productId === 'etudiant-starter'
          || productId === 'particulier-idea' || productId === 'particulier-starter') {
        roles = ['admin'];
    } else if (productId === 'etudiant-launch' || productId === 'particulier-launch') {
        roles = ['admin', 'videographer', 'media'];
    } else if (productId === 'etudiant-impact' || productId === 'particulier-impact') {
        roles = ['admin', 'photographer', 'videographer', 'media'];
    } else if (productId === 'etudiant-custom' || productId === 'particulier-custom') {
        roles = ['admin', 'photographer', 'videographer', 'marketer', 'media'];
    }
    // Offres ENTREPRISE
    else if (productId === 'entreprise-start') {
        roles = ['admin'];
    } else if (productId === 'entreprise-visibility' || productId === 'entreprise-impact') {
        roles = ['admin', 'photographer', 'videographer', 'media'];
    } else if (productId === 'entreprise-custom') {
        roles = ['admin', 'photographer', 'videographer', 'marketer', 'media'];
    }
    // Fallback : tous les types
    else {
        roles = ['admin', 'photographer', 'videographer', 'marketer', 'media'];
    }

    return roles.map(function(role) {
        return { role: role, label: PROVIDER_LABELS[role] || role };
    });
}

/**
 * Calcule le jour courant d'un accompagnement
 * @param {Object} order - La commande
 * @returns {{ currentDay: number, totalDays: number, isComplete: boolean }}
 */
function calculateCurrentDay(order) {
    if (!order.start_date) {
        return { currentDay: 0, totalDays: order.duration_days || 0, isComplete: false };
    }

    const totalDays = order.duration_days || 0;
    if (totalDays === 0) {
        return { currentDay: 0, totalDays: 0, isComplete: false };
    }

    const startDate = new Date(order.start_date);
    const now = new Date();
    const diffMs = now.getTime() - startDate.getTime();
    const rawDay = Math.floor(diffMs / 86400000) + 1; // Jour 1 = jour du debut
    const currentDay = Math.max(1, Math.min(rawDay, totalDays));
    const isComplete = rawDay > totalDays;

    return { currentDay, totalDays, isComplete };
}

// ============================================================
// HELPER - SUMUP API
// ============================================================

async function callSumUpAPI(endpoint, method, body = null) {
    const apiKey = process.env.SUMUP_API_KEY;

    if (!apiKey || apiKey === 'COLLER_LA_CLE_ICI') {
        throw new Error('SUMUP_API_KEY non configuree. Verifiez votre fichier .env');
    }

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${SUMUP_API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
        console.error('Erreur SumUp API:', data);
        throw new Error(data.message || data.error_message || 'Erreur SumUp API');
    }

    console.log('[SUMUP] API response keys:', Object.keys(data), 'id:', data.id, 'hosted_checkout_url:', data.hosted_checkout_url || 'N/A');
    return data;
}

/**
 * Extraire l'URL de paiement depuis la reponse SumUp checkout.
 * Pour les hosted checkouts, la reponse contient hosted_checkout_url.
 * Pour les checkouts widget, on utilise le checkout_id avec SumUpCard.mount().
 */
function getSumUpCheckoutUrl(checkoutResponse) {
    if (checkoutResponse.hosted_checkout_url) {
        return checkoutResponse.hosted_checkout_url;
    }
    // Fallback si hosted_checkout n'a pas ete demande
    return null;
}

// ============================================================
// ROUTES - HEALTH CHECK
// ============================================================

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'FA GENESIS Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/ping', (req, res) => {
    res.json({
        ok: true,
        service: 'FA GENESIS Backend',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    const hasApiKey = process.env.SUMUP_API_KEY && process.env.SUMUP_API_KEY !== 'COLLER_LA_CLE_ICI';
    const hasMerchantCode = process.env.SUMUP_MERCHANT_CODE && process.env.SUMUP_MERCHANT_CODE !== 'COLLER_LE_MERCHANT_CODE_ICI';

    res.json({
        status: 'ok',
        sumup_configured: hasApiKey && hasMerchantCode,
        mode: process.env.SUMUP_MODE || 'sandbox',
        mongodb: persistentStore.getStatus ? persistentStore.getStatus() : (persistentStore.isConnected() ? 'connected' : 'not configured'),
        data: {
            users: loadUsers().length,
            orders: loadOrders().length
        }
    });
});

// ============================================================
// ROUTE - DASHBOARD CENTRALISE
// ============================================================

/**
 * GET /api/dashboard
 * Endpoint centralise pour le dashboard client.
 * Retourne TOUJOURS du JSON, jamais de HTML.
 * Auth: Bearer token requis.
 */
app.get('/api/dashboard', (req, res) => {
    try {
        // 1. Authentification par sessionToken (meme logique que /api/auth/me)
        var authHeader = req.headers.authorization || '';
        console.log('[/api/dashboard] authorization header:', authHeader ? 'PRESENT (' + authHeader.substring(0, 20) + '...)' : 'MISSING');

        // Accepter "Bearer <token>" ou "<token>" directement
        var token = '';
        if (authHeader.toLowerCase().startsWith('bearer ')) {
            token = authHeader.slice(7).trim();
        } else if (authHeader.trim()) {
            token = authHeader.trim();
        }

        if (!token) {
            console.log('[/api/dashboard] Token vide - 401');
            return res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'Token manquant' });
        }

        // 2. Trouver l'utilisateur par sessionToken
        var users = loadUsers();
        var user = findUserByToken(token);
        if (!user) {
            console.log('[/api/dashboard] Aucun user avec ce sessionToken - 401');
            return res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'Session invalide ou expiree' });
        }
        console.log('[/api/dashboard] User trouve: ' + user.email);

        // 3. Trouver les commandes du client
        var orders = loadOrders();
        var clientOrders = orders.filter(function(o) {
            return o.client_info && o.client_info.email && o.client_info.email.toLowerCase() === user.email.toLowerCase();
        });

        // 4. Trouver la commande payee (acompte)
        var paidOrder = null;
        var pendingOrder = null;
        for (var i = 0; i < clientOrders.length; i++) {
            var o = clientOrders[i];
            if (o.deposit_paid === true && !paidOrder) {
                paidOrder = o;
            }
            // Exclure les commandes annulees de la file d'attente
            if (!o.deposit_paid && o.status !== 'cancelled' && !pendingOrder) {
                pendingOrder = o;
            }
        }

        // 5. Si pas de commande payee
        if (!paidOrder) {
            return res.json({
                ok: true,
                status: 'NO_PAID_ORDER',
                user: {
                    email: user.email,
                    prenom: user.prenom || '',
                    nom: user.nom || '',
                    telephone: user.telephone || '',
                    paymentStatus: user.paymentStatus || 'registered',
                    activeOfferId: user.activeOfferId || user.offre || null,
                    productType: user.productType || null
                },
                activeSubscription: pendingOrder ? buildActiveSubscription(user, pendingOrder) : null,
                pendingOrder: pendingOrder ? {
                    id: pendingOrder.id,
                    product_name: pendingOrder.product_name || '',
                    product_type: pendingOrder.product_type || 'accompagnement',
                    product_id: pendingOrder.product_id || '',
                    deposit_amount: pendingOrder.deposit_amount || 0,
                    source: pendingOrder.source || '',
                    quote_id: pendingOrder.quote_id || null
                } : null,
                deliverables: [],
                sessions: []
            });
        }

        // 6. Commande payee - Collecter toutes les donnees
        var dayInfo = calculateCurrentDay(paidOrder);
        var accessRights = getAccessRights(paidOrder);

        // Projet
        var projects = loadProjects();
        var project = null;
        for (var p = 0; p < projects.length; p++) {
            if (projects[p].order_id === paidOrder.id) { project = projects[p]; break; }
        }

        // Livrables
        var allLivrables = loadLivrables();
        var deliverables = allLivrables.filter(function(l) {
            return l.orderId === paidOrder.id || l.order_id === paidOrder.id;
        });

        // Sessions
        var allSessions = loadSessions();
        var sessions = allSessions.filter(function(s) {
            return s.client_email && s.client_email.toLowerCase() === user.email.toLowerCase();
        });

        // 7. Reponse complete
        var subscription = buildActiveSubscription(user, paidOrder);

        res.json({
            ok: true,
            status: 'ACTIVE',
            user: {
                email: user.email,
                prenom: user.prenom || '',
                nom: user.nom || '',
                telephone: user.telephone || '',
                paymentStatus: paidOrder.balance_paid ? 'fully_paid' : 'deposit_paid',
                activeOfferId: user.activeOfferId || user.offre || paidOrder.product_id || null,
                productType: paidOrder.product_type || user.productType || 'accompagnement'
            },
            activeSubscription: subscription,
            order: {
                id: paidOrder.id,
                product_name: paidOrder.product_name || '',
                product_type: paidOrder.product_type || 'accompagnement',
                product_id: paidOrder.product_id || '',
                deposit_paid: true,
                balance_paid: paidOrder.balance_paid || false,
                deposit_amount: paidOrder.deposit_amount || 0,
                total_amount: paidOrder.total_amount || 0,
                balance_amount: paidOrder.balance_amount || 0,
                start_date: paidOrder.start_date || null,
                schedule_status: paidOrder.schedule_status || null,
                proposed_start_date: paidOrder.proposed_start_date || null,
                status: paidOrder.status || 'active'
            },
            access: {
                can_view_livrables: true,
                can_download: paidOrder.balance_paid === true
            },
            project: project,
            deliverables: deliverables,
            sessions: sessions
        });

    } catch (err) {
        console.error('[/api/dashboard] Erreur:', err.message);
        res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: 'Erreur serveur interne' });
    }
});

// ============================================================
// ROUTES - PRODUITS
// ============================================================

app.get('/api/products', (req, res) => {
    const { PRODUCTS } = require('./products');

    // Retourner les produits avec les montants calcules (sans exposer les details internes)
    const productsWithPrices = PRODUCTS.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        product_type: p.product_type,
        duration: p.duration,
        ...calculatePaymentAmounts(p.total_price)
    }));

    res.json(productsWithPrices);
});

app.get('/api/products/:productId', (req, res) => {
    const product = getProductById(req.params.productId);

    if (!product) {
        return res.status(404).json({ error: 'Produit non trouve' });
    }

    res.json({
        id: product.id,
        name: product.name,
        category: product.category,
        product_type: product.product_type,
        duration: product.duration,
        ...calculatePaymentAmounts(product.total_price)
    });
});

// ============================================================
// ROUTES - COMMANDES
// ============================================================

/**
 * POST /api/orders/create
 * Creer une nouvelle commande
 *
 * Body LEGACY: { productId, clientInfo }
 * Body MULTI:  { items: [{id: "..."}], clientInfo }
 * Response: { orderId, deposit_amount, balance_amount, total_amount }
 */
app.post('/api/orders/create', (req, res) => {
    try {
        const { productId, items, clientInfo, partnerServiceOrder: _psoRaw, partnerServiceItems } = req.body;
        // 1 seul item dans partnerServiceItems → traité comme partnerServiceOrder classique
        const partnerServiceOrder = _psoRaw || (partnerServiceItems && partnerServiceItems.length === 1 ? { partnerId: partnerServiceItems[0].partnerId, serviceId: partnerServiceItems[0].serviceId } : null);

        if (!clientInfo || !clientInfo.email || !clientInfo.firstName || !clientInfo.lastName) {
            return res.status(400).json({ error: 'Informations client incompletes (email, firstName, lastName requis)' });
        }

        let order;

        // ---- FORMAT MULTI-ITEMS (depuis panier) ----
        if (items && Array.isArray(items) && items.length > 0) {
            const { calculateMultiItemAmounts: calcMulti } = require('./products');
            var cwInstallsChoice = req.body.cwInstallmentsChoice || 1;
            var cwItems = items.filter(function(it) { return it.coworkingData; });
            var stdItems = items.filter(function(it) { return !it.coworkingData; });
            var allOrderItems = [];
            var totalAmountCW = 0;
            var pendingReservations = [];

            // Items COWORKING
            var hasCwDevis = false;
            var cwDevisBalance = 0;
            var cwDevisInstallments = 1;
            for (var ci = 0; ci < cwItems.length; ci++) {
                var cwIt = cwItems[ci];
                var cwData = cwIt.coworkingData;

                // Cas spécial : devis coworking (payment depuis email)
                if (cwData && cwData.is_devis) {
                    var devisPrix = Number(cwData.prix) || Number(cwData.total_amount) || 0;
                    var devisTotal = Number(cwData.total_amount) || devisPrix;
                    var devisInstalls = parseInt(cwData.installments) || 1;
                    hasCwDevis = true;
                    cwDevisBalance = devisInstalls > 1 ? Math.max(0, devisTotal - devisPrix) : 0;
                    cwDevisInstallments = devisInstalls;
                    totalAmountCW += devisPrix;
                    allOrderItems.push({
                        product_id: 'cw-devis',
                        product_name: cwData.label || 'Devis Coworking',
                        product_type: 'coworking_devis',
                        category: 'COWORKING',
                        payment_model: 'devis',
                        unit_price: devisPrix,
                        total_amount: devisTotal,
                        installments: devisInstalls,
                        installments_count: devisInstalls,
                        devis_id: cwData.devis_id || null
                    });
                    continue;
                }

                var cwProduct = getProductById(cwIt.id);
                if (!cwProduct) continue;
                var cwPrix = 0;
                if (cwProduct.payment_model === 'full') {
                    var nbDays = cwData.dates ? cwData.dates.length : (cwData.nb_days || 1);
                    cwPrix = cwProduct.price_per_day * nbDays;
                } else if (cwProduct.payment_model === 'event') {
                    cwPrix = cwProduct.total_price;
                }
                totalAmountCW += cwPrix;
                allOrderItems.push({
                    product_id: cwProduct.id,
                    product_name: cwProduct.name,
                    product_type: 'coworking',
                    category: 'COWORKING',
                    payment_model: cwProduct.payment_model,
                    unit_price: cwPrix,
                    price_per_day: cwProduct.price_per_day || 0,
                    dates: cwData.dates || [],
                    nb_days: cwData.nb_days || 0,
                    duration: cwProduct.duration,
                    is_event: cwData.is_event || false,
                    installments: cwInstallsChoice,
                    installments_count: cwProduct.installments_count || 1
                });
                pendingReservations.push({
                    id: 'RES-' + uuidv4().split('-')[0].toUpperCase(),
                    product_id: cwProduct.id,
                    product_name: cwProduct.name,
                    payment_model: cwProduct.payment_model,
                    dates: cwData.dates || [],
                    nb_days: cwData.nb_days || 0,
                    time_start: cwData.time_start || null,
                    time_end: cwData.time_end || null,
                    is_event: cwData.is_event || false,
                    prix: cwPrix,
                    client_email: clientInfo.email,
                    client_name: clientInfo.firstName + ' ' + clientInfo.lastName,
                    client_phone: clientInfo.phone || '',
                    status: 'pending',
                    partner_note: '',
                    order_id: null,
                    email_token: uuidv4(),
                    created_at: new Date().toISOString()
                });
            }

            // Items STANDARDS
            var stdCalc = null;
            if (stdItems.length > 0) {
                var stdItemIds = [];
                stdItems.forEach(function(it) {
                    var qty = parseInt(it.qty) || 1;
                    for (var q = 0; q < qty; q++) stdItemIds.push(it.id);
                });
                stdCalc = calcMulti(stdItemIds);
                totalAmountCW += stdCalc.total_amount;
                allOrderItems = allOrderItems.concat(stdCalc.items);
            }

            if (allOrderItems.length === 0) {
                return res.status(400).json({ error: 'Aucun produit valide dans le panier' });
            }

            var totalAmountFinal = totalAmountCW;
            var hasOnlyCw = stdItems.length === 0;
            var hasCwEvent = pendingReservations.some(function(r) { return r.is_event; });
            var depositAmountFinal, balanceAmountFinal, installCountFinal, installPlanFinal;

            if (hasCwDevis) {
                depositAmountFinal = totalAmountFinal; // premier versement (prix)
                balanceAmountFinal = cwDevisBalance;
                installCountFinal = cwDevisInstallments;
                installPlanFinal = null;
            } else if (hasOnlyCw && !hasCwEvent) {
                depositAmountFinal = totalAmountFinal;
                balanceAmountFinal = 0;
                installCountFinal = 1;
                installPlanFinal = null;
            } else if (hasCwEvent) {
                // GENESIS SAFE™ : 1 tranche si ≤ 300 €, split 30/40/30 si > 300 €
                installPlanFinal = generateGenesisSplit(totalAmountFinal);
                depositAmountFinal = installPlanFinal[0].amount;
                balanceAmountFinal = installPlanFinal.length > 1 ? installPlanFinal.slice(1).reduce(function(s, i) { return s + i.amount; }, 0) : 0;
                installCountFinal = installPlanFinal.length;
            } else {
                // GENESIS SAFE™ : 1 tranche si ≤ 300 €, split 30/40/30 si > 300 €
                installPlanFinal = generateGenesisSplit(totalAmountFinal);
                depositAmountFinal = installPlanFinal[0].amount;
                balanceAmountFinal = installPlanFinal.length > 1 ? installPlanFinal.slice(1).reduce(function(s, i) { return s + i.amount; }, 0) : 0;
                installCountFinal = installPlanFinal.length;
            }

            var orderIdFinal = 'ORD-' + uuidv4().split('-')[0].toUpperCase();

            order = {
                id: orderIdFinal,
                product_id: allOrderItems.length === 1 ? allOrderItems[0].product_id : null,
                product_name: allOrderItems.map(function(i) { return i.product_name; }).join(' + '),
                product_type: allOrderItems.every(function(i) { return i.product_type === 'coworking'; }) ? 'coworking' : 'multi',
                items: allOrderItems,
                client_info: {
                    email: clientInfo.email,
                    first_name: clientInfo.firstName,
                    last_name: clientInfo.lastName,
                    phone: clientInfo.phone || null,
                    company: clientInfo.company || null,
                    client_type: clientInfo.clientType || 'particulier'
                },
                total_amount: totalAmountFinal,
                deposit_amount: depositAmountFinal,
                balance_amount: balanceAmountFinal,
                has_devis_items: stdCalc ? stdCalc.has_devis_items : false,
                installments_count: installCountFinal,
                installments: installPlanFinal,
                amount_paid: 0,
                deposit_paid: false,
                balance_paid: false,
                duration_days: 0,
                start_date: null,
                status: totalAmountFinal === 0 ? 'devis_requested' : 'pending_deposit',
                checkout_id: null,
                transaction_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            if (pendingReservations.length > 0) {
                var allRes = loadReservations();
                pendingReservations.forEach(function(res) { res.order_id = orderIdFinal; allRes.push(res); });
                saveReservations(allRes);
            }
            console.log('[ORDER] Commande multi: ' + order.id + ' - ' + allOrderItems.length + ' items - ' + totalAmountFinal + 'EUR');

        // ---- FORMAT PROJET GENESIS (multi-prestataires) ----
        } else if (partnerServiceItems && Array.isArray(partnerServiceItems) && partnerServiceItems.length > 1) {
            // Valider chaque item
            var psiAuthTok = (req.headers.authorization || '').replace('Bearer ', '').trim();
            var psiActUser = psiAuthTok ? findUserByToken(psiAuthTok) : null;
            var psiClientEmail = (clientInfo && clientInfo.email) || (psiActUser && psiActUser.email) || '';
            var psiIsFirstOrder = psiClientEmail ? isClientFirstPaidOrder(psiClientEmail) : false;
            var psiWelcomeApplied = false;

            var psiValidated = [];
            for (var psiIdx = 0; psiIdx < partnerServiceItems.length; psiIdx++) {
                var psiItem = partnerServiceItems[psiIdx];
                if (!psiItem.partnerId || !psiItem.serviceId) {
                    return res.status(400).json({ error: 'Chaque prestation doit avoir partnerId et serviceId' });
                }
                var psiPartner = getPartnerById(psiItem.partnerId);
                if (!psiPartner) return res.status(404).json({ error: 'Partenaire ' + psiItem.partnerId + ' non trouvé' });
                if (psiPartner.accountStatus !== 'active') return res.status(400).json({ error: 'Le partenaire ' + (psiPartner.prenom||'') + ' n\'est pas disponible' });
                var psiService = (psiPartner.services || []).find(function(s) { return s.id === psiItem.serviceId && s.active !== false; });
                if (!psiService) return res.status(404).json({ error: 'Prestation non trouvée chez ' + (psiPartner.prenom||'') });

                var psiTotal = parseFloat(psiService.price);
                var psiFullPrice = psiTotal;
                var psiWelcomeAmt = 0;
                // Avantage bienvenue : s'applique sur la première commande, une seule fois au total
                if (psiIsFirstOrder && !psiWelcomeApplied) {
                    var psiDiePct = (psiActUser && psiActUser.referral_discount && psiActUser.referral_discount.pct)
                        ? psiActUser.referral_discount.pct
                        : (psiActUser && psiActUser.referredBy ? WELCOME_DISCOUNT_PCT_WITH_REFERRAL : WELCOME_DISCOUNT_PCT_NO_REFERRAL);
                    psiTotal = Math.round(psiFullPrice * (1 - psiDiePct / 100) * 100) / 100;
                    psiWelcomeAmt = Math.round((psiFullPrice - psiTotal) * 100) / 100;
                    psiWelcomeApplied = true;
                }
                var psiPaymentTier = psiTotal <= 300 ? 'small' : 'large';
                var psiRequestedInstallments = parseInt(psiItem.requestedInstallments) || 1;
                var psiClientType = (clientInfo && clientInfo.clientType) || 'particulier';
                var psiValidatedN = validateInstallments(psiRequestedInstallments, psiService.max_installments || 1, psiClientType);
                var psiInstalls = psiValidatedN > 1
                    ? generateUserInstallmentPlan(psiTotal, psiValidatedN)
                    : generateGenesisSplit(psiTotal);
                var psiDeposit = psiInstalls[0].amount;
                var psiBalance = psiInstalls.length > 1 ? psiInstalls.slice(1).reduce(function(s, i) { return s + i.amount; }, 0) : 0;

                psiValidated.push({
                    partner: psiPartner,
                    service: psiService,
                    total: psiTotal,
                    fullPrice: psiFullPrice,
                    welcomeAmt: psiWelcomeAmt,
                    paymentTier: psiPaymentTier,
                    installments: psiInstalls,
                    deposit: psiDeposit,
                    balance: psiBalance
                });
            }

            // Appliquer la remise bienvenue sur le compte si applicable
            if (psiWelcomeApplied && psiActUser) {
                var psiUsrs = loadUsers(); var psiUIdx = psiUsrs.findIndex(function(u) { return u.id === psiActUser.id; });
                if (psiUIdx !== -1 && psiUsrs[psiUIdx].referral_discount && !psiUsrs[psiUIdx].referral_discount.applied) {
                    psiUsrs[psiUIdx].referral_discount.applied = true;
                    psiUsrs[psiUIdx].referral_discount.applied_at = new Date().toISOString();
                    saveUsers(psiUsrs);
                }
            }

            // Créer le Projet GENESIS
            var projId = 'PROJ-' + uuidv4().split('-')[0].toUpperCase();
            var projTotalAmount = psiValidated.reduce(function(s, v) { return s + v.total; }, 0);
            var projDepositTotal = psiValidated.reduce(function(s, v) { return s + v.deposit; }, 0);
            var projClientInfo = {
                email: clientInfo.email,
                first_name: clientInfo.firstName,
                last_name: clientInfo.lastName,
                phone: clientInfo.phone || null,
                company: clientInfo.company || null,
                client_type: clientInfo.clientType || 'particulier'
            };

            var projOrderIds = [];
            var projPrestations = [];
            var nowIso = new Date().toISOString();
            var allOrders = loadOrders();

            psiValidated.forEach(function(v) {
                var subOrderId = 'ORD-' + uuidv4().split('-')[0].toUpperCase();
                projOrderIds.push(subOrderId);
                var subOrder = {
                    id: subOrderId,
                    product_id: null,
                    product_name: v.service.label,
                    product_type: 'partner_service',
                    project_id: projId,
                    payment_tier: v.paymentTier,
                    partner_id: v.partner.id,
                    partner_service_id: v.service.id,
                    request_id: null,
                    client_info: projClientInfo,
                    total_amount: v.total,
                    welcome_discount_amount: v.welcomeAmt,
                    deposit_amount: v.deposit,
                    balance_amount: v.balance,
                    installments_count: v.installments.length,
                    installments: v.installments,
                    amount_paid: 0,
                    deposit_paid: false,
                    balance_paid: false,
                    delivery_confirmed: false,
                    duration_days: 0,
                    start_date: null,
                    status: 'pending_deposit',
                    checkout_id: null,
                    transaction_id: null,
                    created_at: nowIso,
                    updated_at: nowIso
                };
                allOrders.push(subOrder);
                projPrestations.push({
                    order_id: subOrderId,
                    partner_id: v.partner.id,
                    partner_name: (v.partner.prenom || '') + ' ' + (v.partner.nom || ''),
                    service_label: v.service.label,
                    total_amount: v.total,
                    deposit_amount: v.deposit,
                    status: 'pending_deposit'
                });
            });

            saveOrders(allOrders);

            var genesisProject = {
                id: projId,
                title: 'Projet GENESIS — ' + projPrestations.map(function(p) { return p.service_label; }).join(' + '),
                client_info: projClientInfo,
                client_email: clientInfo.email,
                order_ids: projOrderIds,
                prestations: projPrestations,
                total_amount: projTotalAmount,
                deposit_total: projDepositTotal,
                status: 'pending_deposit',
                progress_pct: 0,
                created_at: nowIso,
                updated_at: nowIso
            };
            var gProjects = loadGenesisProjects();
            gProjects.push(genesisProject);
            saveGenesisProjects(gProjects);

            notifyUser(null, 'admin', 'commande', 'FA GENESIS — Nouveau Projet GENESIS', (projClientInfo.first_name + ' ' + projClientInfo.last_name) + ' — ' + psiValidated.length + ' prestations — ' + projTotalAmount + ' €', '/app.html#open-admin');

            console.log('[ORDER] Projet GENESIS créé: ' + projId + ' - ' + psiValidated.length + ' prestations - ' + projTotalAmount + ' EUR');

            return res.json({
                success: true,
                projectId: projId,
                order_ids: projOrderIds,
                total_amount: projTotalAmount,
                deposit_total: projDepositTotal,
                prestations: projPrestations.length
            });

        // ---- FORMAT PRESTATION PARTENAIRE (marketplace, commande directe) ----
        } else if (partnerServiceOrder && partnerServiceOrder.partnerId && partnerServiceOrder.serviceId) {
            const partner = getPartnerById(partnerServiceOrder.partnerId);
            if (!partner) {
                return res.status(404).json({ error: 'Partenaire non trouve' });
            }
            if (partner.accountStatus !== 'active') {
                return res.status(400).json({ error: 'Ce partenaire n\'est pas disponible actuellement' });
            }
            const service = (partner.services || []).find(function(s) {
                return s.id === partnerServiceOrder.serviceId && s.active !== false;
            });
            if (!service) {
                return res.status(404).json({ error: 'Prestation non trouvee' });
            }

            // Le paiement n'est autorisé qu'après acceptation explicite du partenaire ET signature
            // du contrat (proposition structurée + signature électronique, GENESIS CONTRACT™) :
            // le client doit d'abord avoir une demande au statut 'signed' pour ce couple partenaire/prestation.
            var psoTotal = parseFloat(service.price);
            var psoFullPrice = psoTotal;
            var psoWelcomeDiscountAmount = 0;
            // Avantage bienvenue -10% : s'applique automatiquement à toute première commande,
            // avec ou sans code de parrainage. Absorbé par la commission GENESIS.
            var psoAuthTok = (req.headers.authorization || '').replace('Bearer ', '').trim();
            var psoActUser = psoAuthTok ? findUserByToken(psoAuthTok) : null;
            var psoClientEmail = (clientInfo && clientInfo.email) || (psoActUser && psoActUser.email) || '';
            if (psoClientEmail && isClientFirstPaidOrder(psoClientEmail)) {
                // Taux selon l'origine du client : avec parrainage → 10%, sans parrainage → 15%
                var psoDiePct = (psoActUser && psoActUser.referral_discount && psoActUser.referral_discount.pct)
                    ? psoActUser.referral_discount.pct
                    : (psoActUser && psoActUser.referredBy ? WELCOME_DISCOUNT_PCT_WITH_REFERRAL : WELCOME_DISCOUNT_PCT_NO_REFERRAL);
                psoTotal = Math.round(psoFullPrice * (1 - psoDiePct / 100) * 100) / 100;
                psoWelcomeDiscountAmount = Math.round((psoFullPrice - psoTotal) * 100) / 100;
                // Marquer le champ legacy comme appliqué (rétrocompatibilité frontend)
                if (psoActUser) {
                    var psoUsrs = loadUsers(); var psoUIdx = psoUsrs.findIndex(function(u) { return u.id === psoActUser.id; });
                    if (psoUIdx !== -1 && psoUsrs[psoUIdx].referral_discount && !psoUsrs[psoUIdx].referral_discount.applied) {
                        psoUsrs[psoUIdx].referral_discount.applied = true;
                        psoUsrs[psoUIdx].referral_discount.applied_at = new Date().toISOString();
                        saveUsers(psoUsrs);
                    }
                }
                console.log('[WELCOME] Avantage bienvenue -' + psoDiePct + '% appliqué pour ' + psoClientEmail + ' : ' + psoFullPrice + ' → ' + psoTotal + ' €');
            }
            // Réduction Cercle Alliance supprimée dans la refonte fidélisation v2
            // GENESIS SAFE™ two-tier :
            // ≤ 300 € → paiement intégral immédiat, fonds retenus jusqu'à la livraison (payment_tier='small')
            // > 300 € → acompte 30 % versé au prestataire + solde 70 % à la livraison (payment_tier='large')
            const psoPaymentTier = psoTotal <= 300 ? 'small' : 'large';
            // Paiement en plusieurs fois : si le client demande N mensualités et que le service le permet
            var psoRequestedInstallments = parseInt(partnerServiceOrder.requestedInstallments) || 1;
            var psoClientType = (clientInfo && clientInfo.clientType) || 'particulier';
            var psoValidatedInstallments = validateInstallments(psoRequestedInstallments, service.max_installments || 1, psoClientType);
            const psoInstallments = psoValidatedInstallments > 1
                ? generateUserInstallmentPlan(psoTotal, psoValidatedInstallments)
                : generateGenesisSplit(psoTotal);
            const psoDeposit = psoInstallments[0].amount;
            const psoBalance = psoInstallments.length > 1
                ? psoInstallments.slice(1).reduce(function(s, i) { return s + i.amount; }, 0)
                : 0;

            // Vérification de la demande signée uniquement pour les prestations > 300 €
            // (les petites prestations s'achètent directement, sans demande préalable)
            var psoRequests = loadPartnerRequests();
            var psoRequest = null;
            if (psoPaymentTier === 'large') {
                psoRequest = psoRequests.find(function(r) {
                    return r.client_email === clientInfo.email &&
                        r.partner_id === partner.id &&
                        r.service_id === service.id &&
                        r.status === 'signed';
                });
                if (!psoRequest) {
                    var psoPendingRequest = psoRequests.find(function(r) {
                        return r.client_email === clientInfo.email &&
                            r.partner_id === partner.id &&
                            r.service_id === service.id &&
                            (r.status === 'accepted' || r.status === 'proposed');
                    });
                    if (psoPendingRequest) {
                        return res.status(403).json({ error: 'Vous devez d\'abord signer le contrat proposé par le partenaire avant de payer.' });
                    }
                    return res.status(403).json({ error: 'Vous devez d\'abord envoyer une demande et obtenir l\'accord du partenaire avant de payer.' });
                }
            }

            order = {
                id: `ORD-${uuidv4().split('-')[0].toUpperCase()}`,
                product_id: null,
                product_name: service.label,
                product_type: 'partner_service',
                payment_tier: psoPaymentTier,
                partner_id: partner.id,
                partner_service_id: service.id,
                request_id: psoRequest ? psoRequest.id : null,
                client_info: {
                    email: clientInfo.email,
                    first_name: clientInfo.firstName,
                    last_name: clientInfo.lastName,
                    phone: clientInfo.phone || null,
                    company: clientInfo.company || null,
                    client_type: clientInfo.clientType || 'particulier'
                },
                total_amount: psoTotal,
                welcome_discount_pct: psoWelcomeDiscountAmount > 0 ? psoDiePct : 0,
                welcome_discount_amount: psoWelcomeDiscountAmount,
                deposit_amount: psoDeposit,
                balance_amount: psoBalance,
                installments_count: psoInstallments.length,
                installments: psoInstallments,
                amount_paid: 0,
                deposit_paid: false,
                balance_paid: false,
                delivery_confirmed: false,
                duration_days: 0,
                start_date: null,
                status: 'pending_deposit',
                checkout_id: null,
                transaction_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            if (psoRequest) {
                var psoReqIdx = psoRequests.findIndex(function(r) { return r.id === psoRequest.id; });
                if (psoReqIdx !== -1) { psoRequests[psoReqIdx].order_id = order.id; savePartnerRequests(psoRequests); }
            }

            console.log(`[ORDER] Commande prestation partenaire: ${order.id} - ${service.label} (${partner.email}) - ${psoTotal}EUR`);

        // ---- FORMAT LEGACY (1 seul productId) ----
        } else if (productId) {
            const product = getProductById(productId);
            if (!product) {
                return res.status(404).json({ error: 'Produit non trouve' });
            }

            // GENESIS SAFE™ : split fixe 30/40/30 (acompte / livrable intermédiaire / livraison finale)
            var legacyInstallPlan = generateGenesisSplit(product.total_price);

            order = {
                id: `ORD-${uuidv4().split('-')[0].toUpperCase()}`,
                product_id: productId,
                product_name: product.name,
                product_type: product.product_type,
                client_info: {
                    email: clientInfo.email,
                    first_name: clientInfo.firstName,
                    last_name: clientInfo.lastName,
                    phone: clientInfo.phone || null,
                    company: clientInfo.company || null,
                    client_type: clientInfo.clientType || 'particulier'
                },
                total_amount: product.total_price,
                deposit_amount: legacyInstallPlan[0].amount,
                balance_amount: legacyInstallPlan.length > 1 ? legacyInstallPlan.slice(1).reduce(function(s, i) { return s + i.amount; }, 0) : 0,
                installments_count: legacyInstallPlan.length,
                installments: legacyInstallPlan,
                amount_paid: 0,
                deposit_paid: false,
                balance_paid: false,
                duration_days: product.duration_days || parseDurationToDays(product.duration),
                start_date: null,
                status: 'pending_deposit',
                checkout_id: null,
                transaction_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            console.log(`[ORDER] Commande creee: ${order.id} - ${product.name} - ${product.total_price}EUR`);

        } else {
            return res.status(400).json({ error: 'productId, items, partnerServiceOrder ou partnerServiceItems requis' });
        }

        // Sauvegarder
        const orders = loadOrders();
        orders.push(order);
        saveOrders(orders);

        // Notif admin : nouvelle commande
        notifyUser(null, 'admin', 'commande', 'FA GENESIS — Nouvelle commande', (order.client_info ? order.client_info.first_name + ' ' + order.client_info.last_name : '') + ' — ' + (order.product_name || ''), '/app.html#open-admin');

        // Envoyer email de notification au partenaire coworking pour chaque réservation
        if (pendingReservations && pendingReservations.length > 0) {
            pendingReservations.forEach(function(resv) {
                emailService.sendCwReservationToPartner(resv, order).catch(function(e) {
                    console.error('[EMAIL] Erreur envoi reservation partenaire:', e.message);
                });
            });
        }

        res.json({
            success: true,
            orderId: order.id,
            deposit_amount: order.deposit_amount,
            balance_amount: order.balance_amount,
            total_amount: order.total_amount,
            has_devis_items: order.has_devis_items || false
        });

    } catch (error) {
        console.error('Erreur creation commande:', error);
        res.status(500).json({ error: 'Erreur lors de la creation de la commande' });
    }
});

/**
 * GET /api/orders/all (Admin)
 * Recuperer toutes les commandes
 * DOIT etre avant /api/orders/:orderId pour eviter le conflit de route
 */
app.get('/api/orders/all', function(req, res) {
    if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Admin requis' });
    const orders = loadOrders();
    res.json(orders);
});

/**
 * GET /api/orders/:orderId
 * Recuperer une commande par son ID — accessible au propriétaire (client/partenaire) ou admin
 */
app.get('/api/orders/:orderId', function(req, res) {
    var order = getOrderById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Commande non trouvee' });

    if (_isAdminRequest(req)) return res.json(order);

    var tok = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (tok) {
        var user = findUserByToken(tok);
        if (user && order.client_info && (order.client_info.email || '').toLowerCase() === user.email.toLowerCase()) return res.json(order);
        var partner = findPartnerByToken(tok);
        if (partner && order.partner_id === partner.id) return res.json(order);
    }
    return res.status(403).json({ error: 'Acces non autorise' });
});

/**
 * POST /api/orders/:orderId/cancel-pending
 * Client annule sa commande si l'acompte n'a pas encore ete paye
 */
app.post('/api/orders/:orderId/cancel-pending', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var orderId = req.params.orderId;
        var userEmail = user.email;

        var order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Commande introuvable.' });
        }

        // Verifier que la commande appartient a cet utilisateur
        var orderEmail = order.client_info && order.client_info.email ? order.client_info.email.toLowerCase() : '';
        if (orderEmail !== (userEmail || '').toLowerCase()) {
            return res.status(403).json({ success: false, error: 'Commande non autorisee.' });
        }

        // Verifier que l'acompte n'est pas deja paye
        if (order.deposit_paid) {
            return res.status(400).json({ success: false, error: 'Impossible d\'annuler : l\'acompte a deja ete regle.' });
        }

        // Annuler la commande
        var updatedOrder = updateOrder(orderId, { status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: 'client' });

        // Reinitialiser le statut de paiement de l'utilisateur
        try {
            var allUsers = loadUsers();
            var uIdx = allUsers.findIndex(function(u) { return u.email && u.email.toLowerCase() === (userEmail || '').toLowerCase(); });
            if (uIdx !== -1) {
                allUsers[uIdx].paymentStatus = 'registered';
                allUsers[uIdx].payment_status = 'registered';
                allUsers[uIdx].activeOrderId = null;
                allUsers[uIdx].activeOfferId = null;
                saveUsers(allUsers);
                console.log('[CANCEL-ORDER] Statut utilisateur reinitialise pour ' + userEmail);
            }
        } catch (syncErr) {
            console.error('[CANCEL-ORDER] Erreur sync users:', syncErr.message);
        }

        console.log('[CANCEL-ORDER] Commande ' + orderId + ' annulee par ' + userEmail);
        res.json({ success: true, message: 'Commande annulee avec succes.' });

    } catch (err) {
        console.error('[CANCEL-ORDER] Erreur:', err.message);
        res.status(500).json({ success: false, error: 'Erreur serveur lors de l\'annulation.' });
    }
});

/**
 * POST /api/orders/:orderId/cancel-start-date
 * Annuler la date de demarrage confirmee
 * Accessible par : client (son propre ordre), partenaire, ou admin (sans token)
 */
app.post('/api/orders/:orderId/cancel-start-date', function(req, res) {
    try {
        var orderId = req.params.orderId;
        var order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Commande introuvable.' });
        }
        var cancellableStatuses = ['confirmed', 'client_proposed', 'reproposed'];
        if (cancellableStatuses.indexOf(order.schedule_status) === -1) {
            return res.status(400).json({ success: false, error: 'Aucune date a annuler pour cette commande.' });
        }

        // Determiner qui appelle
        var callerRole = 'admin';
        var authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            var token = authHeader.split(' ')[1];
            // Essayer client
            var users = loadUsers();
            var clientUser = findUserByToken(token);
            if (clientUser) {
                var orderEmail = order.client_info && order.client_info.email ? order.client_info.email.toLowerCase() : '';
                if (orderEmail !== (clientUser.email || '').toLowerCase()) {
                    return res.status(403).json({ success: false, error: 'Commande non autorisee.' });
                }
                callerRole = 'client';
            } else {
                // Essayer partenaire
                var partners = loadPartners();
                var partner = findPartnerByToken(token);
                if (partner) {
                    callerRole = 'partner';
                }
            }
        }

        var updatedOrder = updateOrder(orderId, {
            start_date: null,
            proposed_start_date: null,
            schedule_status: 'awaiting_client_choice',
            schedule_confirmed_by_admin: false,
            schedule_confirmed_by_partner: false,
            start_date_cancelled_at: new Date().toISOString(),
            start_date_cancelled_by: callerRole
        });

        if (!updatedOrder) {
            return res.status(500).json({ success: false, error: 'Erreur mise a jour commande.' });
        }

        console.log('[CANCEL-DATE] Date annulee pour commande ' + orderId + ' par ' + callerRole);

        // --- Notifications email ---
        try {
            var cancelClientName = (updatedOrder.client_info && (updatedOrder.client_info.first_name || updatedOrder.client_info.last_name))
                ? ((updatedOrder.client_info.first_name || '') + ' ' + (updatedOrder.client_info.last_name || '')).trim()
                : (updatedOrder.client_info && updatedOrder.client_info.email ? updatedOrder.client_info.email : 'Client');
            var cancelOrderName = updatedOrder.offreName || updatedOrder.offre || 'Commande';
            var cancelledDateVal = order.proposed_start_date || order.start_date || null;
            var adminEmailForCancel = process.env.ADMIN_EMAIL || 'contact@fagenesis.com';

            if (callerRole === 'client') {
                // Notifier l'admin
                emailService.sendScheduleCancelledNotification(
                    adminEmailForCancel,
                    'Admin FA GENESIS',
                    cancelClientName,
                    cancelledDateVal,
                    cancelOrderName,
                    'client'
                );

                // Notifier le partenaire si le kickoff est gere par un partenaire
                var kickoffRole = order.kickoff_provider_role;
                if (kickoffRole && kickoffRole !== 'admin') {
                    var allCancelAssignments = loadPartnerAssignments();
                    var cancelOrderAssignments = allCancelAssignments.filter(function(a) { return a.order_id === orderId && a.status === 'active'; });
                    var allCancelPartners = loadPartners();

                    var cancelTargetPartners = [];
                    var sameTypeCancelAssignments = cancelOrderAssignments.filter(function(a) {
                        if (a.partner_type) return a.partner_type === kickoffRole;
                        var pt = allCancelPartners.find(function(p) { return p.id === a.partner_id; });
                        return pt && pt.partner_type === kickoffRole;
                    });
                    if (sameTypeCancelAssignments.length > 0) {
                        sameTypeCancelAssignments.forEach(function(a) {
                            var pt = allCancelPartners.find(function(p) { return p.id === a.partner_id; });
                            if (pt && pt.email) cancelTargetPartners.push(pt);
                        });
                    } else {
                        allCancelPartners.forEach(function(pt) {
                            if (pt.partner_type === kickoffRole && pt.email) cancelTargetPartners.push(pt);
                        });
                    }
                    cancelTargetPartners.forEach(function(pt) {
                        emailService.sendScheduleCancelledNotification(
                            pt.email,
                            pt.name || pt.email,
                            cancelClientName,
                            cancelledDateVal,
                            cancelOrderName,
                            'client'
                        );
                    });
                }
            } else {
                // Admin ou partenaire annule → notifier le client
                var cancelClientEmail = updatedOrder.client_info && updatedOrder.client_info.email ? updatedOrder.client_info.email : null;
                if (cancelClientEmail) {
                    emailService.sendScheduleCancelledNotification(
                        cancelClientEmail,
                        cancelClientName,
                        cancelClientName,
                        cancelledDateVal,
                        cancelOrderName,
                        callerRole
                    );
                }
            }
        } catch (notifErr) {
            console.error('[CANCEL-DATE] Erreur notification email:', notifErr.message);
        }

        res.json({ success: true, message: 'Date de demarrage annulee. Le client peut proposer une nouvelle date.' });

    } catch (err) {
        console.error('[CANCEL-DATE] Erreur:', err.message);
        res.status(500).json({ success: false, error: 'Erreur serveur lors de l\'annulation de la date.' });
    }
});

/**
 * DELETE /api/orders/:orderId
 * Supprimer une commande (admin seulement)
 */
app.delete('/api/orders/:orderId', function(req, res) {
    if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Admin requis' });

    try {
        var orderId = req.params.orderId;
        var order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Commande introuvable : ' + orderId });
        }
        var orders = loadOrders();
        var newOrders = orders.filter(function(o) { return o.id !== orderId; });
        if (newOrders.length === orders.length) {
            return res.status(404).json({ success: false, error: 'Commande introuvable.' });
        }
        saveOrders(newOrders);
        console.log('[DELETE-ORDER] Commande supprimee : ' + orderId);
        res.json({ success: true, message: 'Commande ' + orderId + ' supprimee.' });
    } catch (err) {
        console.error('[DELETE-ORDER] Erreur:', err.message);
        res.status(500).json({ success: false, error: 'Erreur serveur lors de la suppression.' });
    }
});

// ============================================================
// ROUTES - PAIEMENTS SUMUP
// ============================================================

/**
 * POST /api/payments/sumup/create-checkout
 * Creer un checkout SumUp pour une commande
 *
 * Body: { orderId, stage } ou stage = 'deposit' ou 'balance'
 * Response: { checkout_url, checkout_id }
 */
app.post('/api/payments/sumup/create-checkout', async (req, res) => {
    try {
        const { orderId, stage } = req.body;

        // Validation
        if (!orderId) {
            return res.status(400).json({ error: 'orderId requis' });
        }

        var isInstallmentStage = stage && stage.startsWith('installment_');
        if (!stage || (!['deposit', 'balance'].includes(stage) && !isInstallmentStage)) {
            return res.status(400).json({ error: 'stage invalide (deposit, balance ou installment_N)' });
        }

        // Recuperer la commande
        const order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvee' });
        }

        // Verifier que le stage est valide pour cette commande
        if (stage === 'deposit' && order.deposit_paid) {
            return res.status(400).json({ error: 'Acompte deja paye' });
        }

        if ((stage === 'balance' || isInstallmentStage) && !order.deposit_paid) {
            return res.status(400).json({ error: 'L\'acompte doit etre paye en premier' });
        }

        if (stage === 'balance' && order.balance_paid) {
            return res.status(400).json({ error: 'Solde deja paye' });
        }

        // Determiner le montant selon le stage
        var amount;
        var stageLabel;

        if (isInstallmentStage) {
            // Versement spécifique : stage = 'installment_N'
            var installList = order.installments || [];
            var instItem = installList.find(function(it) { return it.stage === stage; });
            if (!instItem) {
                return res.status(400).json({ error: 'Versement introuvable : ' + stage });
            }
            if (instItem.paid) {
                return res.status(400).json({ error: 'Ce versement a déjà été réglé' });
            }
            amount = instItem.amount;
            stageLabel = instItem.label;
        } else if (stage === 'balance') {
            // Paiement du solde restant (tout payer maintenant)
            if (order.installments && order.installments.length > 0) {
                // Avec installments : solde = total - montant déjà payé
                var alreadyPaid = order.amount_paid || order.deposit_amount || 0;
                amount = order.total_amount - alreadyPaid;
                if (amount <= 0) {
                    return res.status(400).json({ error: 'Aucun solde restant à payer' });
                }
            } else {
                amount = order.balance_amount;
            }
            stageLabel = 'Solde restant';
        } else {
            amount = order.deposit_amount;
            stageLabel = 'Acompte 30%';
        }

        // Construire les URLs de retour
        const successUrl = process.env.SUMUP_SUCCESS_URL || 'https://fagenesis.com/payment-success.html';
        const failureUrl = process.env.SUMUP_FAILURE_URL || 'https://fagenesis.com/payment-failure.html';
        const returnUrl = `${successUrl}?order=${orderId}&stage=${stage}`;

        // Creer le checkout SumUp (widget mode - SumUpCard.mount utilise checkout_id)
        // On ajoute un timestamp pour garantir l'unicite de la reference (evite le doublon si retry)
        const checkoutData = {
            checkout_reference: `${orderId}-${stage}-${Date.now()}`,
            amount: amount,
            currency: 'EUR',
            pay_to_email: process.env.SUMUP_PAY_TO_EMAIL,
            description: `FA GENESIS - ${order.product_name} (${stageLabel})`,
            return_url: returnUrl
        };

        console.log(`[SUMUP] Creation checkout pour ${orderId} - ${stage} - ${amount}EUR`);

        const checkoutResponse = await callSumUpAPI('/checkouts', 'POST', checkoutData);

        // Mettre a jour la commande avec l'ID du checkout
        updateOrder(orderId, {
            checkout_id: checkoutResponse.id,
            current_stage: stage
        });

        console.log(`[SUMUP] Checkout cree: ${checkoutResponse.id}`);

        res.json({
            success: true,
            checkout_id: checkoutResponse.id,
            checkout_url: getSumUpCheckoutUrl(checkoutResponse),
            amount: amount,
            stage: stage
        });

    } catch (error) {
        console.error('Erreur creation checkout SumUp:', error);

        // Message d'erreur specifique si la cle API n'est pas configuree
        if (error.message.includes('non configuree')) {
            return res.status(500).json({
                error: 'Configuration SumUp incomplete',
                details: 'Verifiez que SUMUP_API_KEY est configure dans le fichier .env'
            });
        }

        res.status(500).json({ error: 'Erreur lors de la creation du checkout', details: error.message });
    }
});

/**
 * POST /api/payments/cart/stripe-intent
 * Crée un PaymentIntent Stripe direct pour le panier FA GENESIS (sans Connect)
 */
app.post('/api/payments/cart/stripe-intent', async function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '').trim();
        if (!token) return res.status(401).json({ error: 'Token requis' });
        var payload;
        try { payload = _jwt.verify(token, _JWT_SECRET); }
        catch(e) { return res.status(401).json({ error: 'Token invalide' }); }

        var b = req.body || {};
        var items = b.items || [];
        var amount = parseFloat(b.total);
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Montant invalide' });
        }

        var description = ('FA GENESIS — ' + items.map(function(i){ return i.name; }).join(', ')).substring(0, 250);

        var scp = require('./services/stripe-connect-provider');
        var pi = await scp.createDirectPaymentIntent({
            amountEuros: amount,
            currency: 'eur',
            description: description,
            receiptEmail: payload.email || undefined,
            metadata: {
                user_email: payload.email || '',
                items_count: String(items.length)
            }
        });

        console.log('[STRIPE CART] PaymentIntent créé:', pi.id, amount + ' EUR', payload.email);
        res.json({ ok: true, clientSecret: pi.client_secret, paymentIntentId: pi.id });
    } catch(error) {
        console.error('[STRIPE CART] Erreur:', error.message);
        res.status(500).json({ error: error.message || 'Erreur création paiement' });
    }
});

/**
 * POST /api/payments/order/stripe-direct
 * Crée un PaymentIntent Stripe direct pour une commande (prestataire sans Stripe Connect)
 */
app.post('/api/payments/order/stripe-direct', async function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '').trim();
        if (!token) return res.status(401).json({ error: 'Token requis' });
        var payload;
        try { payload = _jwt.verify(token, _JWT_SECRET); }
        catch(e) { return res.status(401).json({ error: 'Token invalide' }); }

        var b = req.body || {};
        var orderId = b.orderId;
        var stage   = b.stage || 'deposit';
        if (!orderId) return res.status(400).json({ error: 'orderId requis' });

        var order = getOrderById(orderId);
        if (!order) return res.status(404).json({ error: 'Commande introuvable' });

        // Résoudre le montant selon le stage (identique à la logique SumUp)
        var amount, stageLabel;
        var isInstallment = stage && stage.startsWith('installment_');
        if (isInstallment) {
            var instItem = (order.installments || []).find(function(it){ return it.stage === stage; });
            if (!instItem) return res.status(400).json({ error: 'Versement introuvable : ' + stage });
            if (instItem.paid) return res.status(400).json({ error: 'Ce versement est déjà réglé' });
            amount = instItem.amount; stageLabel = instItem.label;
        } else if (stage === 'balance') {
            if (order.installments && order.installments.length > 0) {
                var alreadyPaid = order.amount_paid || order.deposit_amount || 0;
                amount = order.total_amount - alreadyPaid;
                if (amount <= 0) return res.status(400).json({ error: 'Aucun solde restant' });
            } else {
                amount = order.balance_amount;
            }
            stageLabel = 'Solde restant';
        } else {
            if (order.deposit_paid) return res.status(400).json({ error: 'Acompte déjà payé' });
            amount = order.deposit_amount;
            stageLabel = 'Acompte';
        }

        var description = (b.description || ('FA GENESIS — ' + (order.product_name || 'Prestation') + ' (' + stageLabel + ')')).substring(0, 250);
        var scp = require('./services/stripe-connect-provider');
        var pi = await scp.createDirectPaymentIntent({
            amountEuros: amount,
            currency: 'eur',
            description: description,
            receiptEmail: payload.email || undefined,
            metadata: { order_id: orderId, stage: stage, user_email: payload.email || '' }
        });

        console.log('[STRIPE ORDER DIRECT] PI:', pi.id, amount + ' EUR', orderId, stage);
        res.json({ ok: true, clientSecret: pi.client_secret, paymentIntentId: pi.id });
    } catch(error) {
        console.error('[STRIPE ORDER DIRECT] Erreur:', error.message);
        res.status(500).json({ error: error.message || 'Erreur création paiement' });
    }
});

/**
 * POST /api/contracts/sign
 * Enregistre la signature électronique d'un contrat de prestation
 */
app.post('/api/contracts/sign', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '').trim();
        if (!token) return res.status(401).json({ error: 'Token requis' });
        var payload;
        try { payload = _jwt.verify(token, _JWT_SECRET); }
        catch(e) { return res.status(401).json({ error: 'Token invalide' }); }

        var b = req.body || {};
        if (!b.contractRef || !b.partnerId || !b.serviceLabel || !b.signatureName) {
            return res.status(400).json({ error: 'Champs requis manquants' });
        }

        var contracts = loadContracts();
        var now = new Date().toISOString();
        var contractId = 'CTR-' + Date.now() + '-' + Math.random().toString(36).substr(2,5).toUpperCase();
        contracts.push({
            id:               contractId,
            ref:              b.contractRef,
            type:             'service',
            status:           'signed',
            client_email:     payload.email,
            client_name:      b.signatureName,
            client_type:      'particulier',
            partner_id:       b.partnerId,
            partner_name:     b.partnerName || '',
            partner_type:     b.partnerType || '',
            service_name:     b.serviceLabel,
            service_price:    parseFloat(b.servicePrice) || 0,
            deposit_amount:   parseFloat(b.depositAmount) || 0,
            signature_name:   b.signatureName,
            signed_at:        now,
            created_at:       now,
            order_id:         null,
            contract_version: 'v2-2026',
            events:           [{ type: 'signed', at: now, detail: 'Signature client : ' + b.signatureName }]
        });
        saveContracts(contracts);

        // Notifier le prestataire (in-app + email)
        try {
            var _partner = loadPartners().find(function(p) { return p.id === b.partnerId; });
            if (_partner) {
                var _clientDisplayName = b.signatureName || payload.email;
                notifyUser(_partner.email, 'partner', 'contract_signed',
                    'Contrat signé par un client',
                    _clientDisplayName + ' a signé le contrat pour : ' + b.serviceLabel + '. Téléchargez-le dans vos Documents.',
                    '/app.html'
                );
                emailService.sendContractSignedToPartnerEmail(
                    _partner.email,
                    _partner.prenom || _partner.firstName || '',
                    _clientDisplayName,
                    b.serviceLabel,
                    b.contractRef
                ).catch(function(e) { console.warn('[CONTRACT] Email prestataire non envoyé:', e.message); });
            }
        } catch(_ne) { console.warn('[CONTRACT] Erreur notification prestataire:', _ne.message); }

        console.log('[CONTRACT] Signé:', contractId, payload.email, b.serviceLabel);
        res.json({ ok: true, contractId: contractId });
    } catch(e) {
        console.error('[CONTRACT] Erreur:', e.message);
        res.status(500).json({ error: e.message || 'Erreur enregistrement contrat' });
    }
});

/**
 * PATCH /api/contracts/:id/set-order
 * Lie un contrat signé à une commande créée juste après
 */
app.patch('/api/contracts/:id/set-order', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '').trim();
        if (!token) return res.status(401).json({ error: 'Token requis' });
        var payload;
        try { payload = _jwt.verify(token, _JWT_SECRET); }
        catch(e) { return res.status(401).json({ error: 'Token invalide' }); }
        var contracts = loadContracts();
        var idx = contracts.findIndex(function(c) { return c.id === req.params.id && c.client_email === payload.email; });
        if (idx === -1) return res.status(404).json({ error: 'Contrat introuvable' });
        contracts[idx].order_id = req.body.orderId || null;
        contracts[idx].updated_at = new Date().toISOString();
        saveContracts(contracts);
        res.json({ ok: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * ══════════════════════════════════════════════════════
 *  PAYPAL
 * ══════════════════════════════════════════════════════
 */
const PAYPAL_BASE = (process.env.PAYPAL_MODE === 'live')
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const secret   = process.env.PAYPAL_SECRET;
    if (!clientId || !secret) throw new Error('PayPal non configuré (PAYPAL_CLIENT_ID, PAYPAL_SECRET manquants)');
    const resp = await fetch(PAYPAL_BASE + '/v1/oauth2/token', {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(clientId + ':' + secret).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    const data = await resp.json();
    if (!data.access_token) throw new Error('Erreur auth PayPal : ' + JSON.stringify(data));
    return data.access_token;
}

/**
 * POST /api/payments/paypal/create-order
 * Body: { amount, currency, description, installments, totalAmount }
 * Response: { orderId }
 */
app.post('/api/payments/paypal/create-order', async (req, res) => {
    try {
        const { amount, currency, description, installments, totalAmount } = req.body;
        const amt = parseFloat(amount);
        if (!amt || isNaN(amt) || amt <= 0) {
            return res.status(400).json({ error: 'Montant invalide' });
        }
        const token = await getPayPalAccessToken();
        const ref = 'FAG-' + Date.now();
        const n = parseInt(installments) || 1;
        const descFull = ((description || 'FA GENESIS') + (n > 1 ? ' — Versement 1/' + n : '')).substring(0, 127);

        const orderBody = {
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: ref,
                description: descFull,
                amount: { currency_code: currency || 'EUR', value: amt.toFixed(2) }
            }],
            application_context: {
                brand_name: 'FA GENESIS',
                locale: 'fr-FR',
                shipping_preference: 'NO_SHIPPING',
                user_action: 'PAY_NOW',
                return_url: 'https://fagenesis.com/app.html',
                cancel_url: 'https://fagenesis.com/app.html'
            }
        };

        const resp = await fetch(PAYPAL_BASE + '/v2/checkout/orders', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'PayPal-Request-Id': ref
            },
            body: JSON.stringify(orderBody)
        });
        const order = await resp.json();
        if (!order.id) throw new Error('Erreur PayPal create-order : ' + JSON.stringify(order));

        console.log('[PAYPAL] Commande créée:', order.id, amt + ' EUR', n > 1 ? '(' + n + 'x)' : '');
        res.json({ success: true, orderId: order.id });
    } catch (err) {
        console.error('[PAYPAL] create-order:', err.message);
        res.status(500).json({ error: 'Erreur création commande PayPal', details: err.message });
    }
});

/**
 * Logique de confirmation de paiement partagée entre le webhook SumUp et la capture PayPal.
 * Met à jour le statut de la commande, synchronise users.json, envoie les notifications,
 * crée le dispatch partenaire et déclenche les versements.
 */
async function _applyPaymentConfirmation(orderId, stage, transactionRef, paypalCaptureId) {
    const order = getOrderById(orderId);
    if (!order) { console.log('[PAY_CONFIRM] Commande non trouvée:', orderId); return null; }

    const updates = { transaction_id: transactionRef || null };
    if (paypalCaptureId) updates.paypal_capture_id = paypalCaptureId;

    if (stage === 'deposit') {
        updates.deposit_paid = true; updates.status = 'active'; updates.start_date = null;
        updates.schedule_status = 'awaiting_client_choice'; updates.proposed_start_date = null;
        updates.schedule_confirmed_by_admin = false; updates.schedule_confirmed_by_partner = false;
    } else if (stage === 'balance') {
        updates.balance_paid = true; updates.status = 'paid_in_full';
        if (order.installments && order.installments.length === 3) {
            const bInst = order.installments.map(i => i.paid ? i : Object.assign({}, i, { paid: true, paid_at: new Date().toISOString() }));
            updates.installments = bInst;
            updates.amount_paid = bInst.reduce((s, i) => s + (i.paid ? i.amount : 0), 0);
        }
    } else if (stage === 'installment_2' || stage === 'installment_3') {
        const idx = (order.installments || []).findIndex(i => i.stage === stage);
        if (idx !== -1) {
            const uInst = order.installments.map((i, n) => n !== idx ? i : Object.assign({}, i, { paid: true, paid_at: new Date().toISOString() }));
            updates.installments = uInst;
            updates.amount_paid = uInst.reduce((s, i) => s + (i.paid ? i.amount : 0), 0);
            if (stage === 'installment_2') { updates.status = 'mid_delivery_paid'; }
            else { updates.balance_paid = true; updates.status = 'paid_in_full'; }
        }
    }

    const updatedOrder = updateOrder(orderId, updates);
    if (!updatedOrder) return null;

    // Sync users.json
    if (updatedOrder.client_info && updatedOrder.client_info.email) {
        try {
            const users = loadUsers();
            const uIdx = users.findIndex(u => u.email && u.email.toLowerCase() === updatedOrder.client_info.email.toLowerCase());
            if (uIdx !== -1) {
                const ps = stage === 'deposit' ? 'deposit_paid' : stage === 'installment_2' ? 'mid_delivery_paid' : (stage === 'balance' || stage === 'installment_3') ? 'fully_paid' : null;
                if (ps) { users[uIdx].paymentStatus = ps; users[uIdx].payment_status = ps; }
                users[uIdx].activeOrderId = orderId;
                saveUsers(users);
            }
        } catch(e) { console.error('[PAY_CONFIRM] Sync users:', e.message); }
    }

    // Notifications
    if (updatedOrder.client_info && updatedOrder.client_info.email) {
        const msg = stage === 'deposit' ? 'Votre acompte a été reçu. Votre accompagnement démarre !'
            : stage === 'installment_2' ? 'Le paiement de la tranche 2 a été reçu. Merci !'
            : 'Votre paiement complet a été confirmé. Merci !';
        const lbl = stage === 'deposit' ? 'acompte' : stage === 'installment_2' ? 'tranche 2' : stage === 'installment_3' ? 'tranche 3' : 'solde';
        notifyUser(updatedOrder.client_info.email, 'client', 'paiement', 'Paiement confirmé ✅', msg, '/app.html');
        notifyUser(null, 'admin', 'paiement-admin', 'Paiement reçu', (updatedOrder.client_info.first_name || '') + ' — ' + (updatedOrder.product_name || '') + ' — ' + lbl, '/app.html#open-admin');
    }

    // Emails + dispatch/payout
    if (updatedOrder.client_info) {
        const ce = updatedOrder.client_info.email;
        const cn = (updatedOrder.client_info.first_name || '') + ' ' + (updatedOrder.client_info.last_name || '');
        if (stage === 'deposit') {
            try {
                const { getProductById, calculatePaymentAmounts } = require('./products');
                const prod = getProductById(updatedOrder.product_id);
                let offerData = null;
                if (prod) { const a = calculatePaymentAmounts(prod.total_price); offerData = { name: prod.name, category: prod.category, product_type: prod.product_type, total_price: prod.total_price, duration: prod.duration, deposit_amount: a.deposit_amount, balance_amount: a.balance_amount }; }
            } catch(e) { console.error('[PAY_CONFIRM] Email setup:', e.message); }
            if (updatedOrder.product_type === 'partner_service') {
                const psPartner = getPartnerById(updatedOrder.partner_id);
                const psPartnerEmail = psPartner ? (psPartner.email || psPartner.contact_email || null) : null;
                const psPartnerName = psPartner ? (psPartner.prenom ? (psPartner.prenom + ' ' + (psPartner.nom || '')) : psPartner.company || 'votre prestataire') : 'votre prestataire';
                // Email récapitulatif envoyé immédiatement — indépendamment de la création du dispatch
                emailService.sendPartnerServiceOrderConfirmation(
                    ce,
                    updatedOrder.client_info ? updatedOrder.client_info.first_name : '',
                    updatedOrder,
                    psPartnerName
                ).catch(function(e){ console.error('[PAY_CONFIRM] Email commande partenaire:', e.message); });
                const disp = createPartnerServiceDispatch(updatedOrder);
                if (disp) {
                    // Notifier le PRESTATAIRE : nouvelle commande payée, acceptation requise
                    if (psPartnerEmail) {
                        notifyUser(psPartnerEmail, 'partner', 'mission_pending',
                            '🆕 Nouvelle commande !',
                            ((updatedOrder.client_info && updatedOrder.client_info.first_name) || 'Un client') + ' a payé pour "' + (updatedOrder.product_name || 'votre prestation') + '". Acceptez ou refusez dans les 24h.',
                            '#partner:missions');
                    }
                    // Notifier le CLIENT : paiement réussi
                    notifyUser(ce, 'client', 'payment_success',
                        '✅ Paiement réussi !',
                        'Votre paiement a bien été reçu. ' + psPartnerName + ' va prendre en charge votre demande sous 24h.',
                        '#tab:resa');
                    console.log('[PAY_CONFIRM] Mission partenaire créée — en attente d\'acceptation du prestataire');
                }
            } else {
                assignIntervenantsFromOrder(orderId);
                emailService.sendPaymentConfirmation(ce, cn, updatedOrder).catch(e => console.error('[PAY_CONFIRM] Email acompte:', e));
            }
        } else {
            const isFinal = (stage === 'balance' || stage === 'installment_3');
            if (isFinal) { try { emailService.sendPaymentConfirmation(ce, cn, updatedOrder).catch(e => console.error('[PAY_CONFIRM] Email paiement:', e)); } catch(e) {} }
            const acceptedD = loadDispatches().filter(d => d.order_id === orderId && d.status === 'accepted');
            acceptedD.forEach(d => processDispatchPayout(d, stage).catch(e => console.error('[PAYOUT]', e)));
            if (isFinal) {
                requestPartnerReviews(ce, acceptedD);
                checkReferralAndMissionRewards(ce);
            }
        }
    }

    console.log('[PAY_CONFIRM] OK:', orderId, '—', stage, '(ref:', transactionRef + ')');
    return updatedOrder;
}

/**
 * POST /api/payments/paypal/capture-order
 * Body: { paypalOrderId, orderId?, stage? }
 * orderId + stage sont optionnels : fournis uniquement pour le flux dépôt partenaire (pb-sheet).
 * Response: { success, details }
 */
app.post('/api/payments/paypal/capture-order', async (req, res) => {
    try {
        const { paypalOrderId, orderId, stage } = req.body;
        if (!paypalOrderId) return res.status(400).json({ error: 'paypalOrderId requis' });

        const token = await getPayPalAccessToken();
        const resp = await fetch(PAYPAL_BASE + '/v2/checkout/orders/' + paypalOrderId + '/capture', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        });
        const result = await resp.json();

        if (result.status === 'COMPLETED') {
            console.log('[PAYPAL] Capturé:', paypalOrderId);
            const ppCaptures = result.purchase_units && result.purchase_units[0] &&
                result.purchase_units[0].payments && result.purchase_units[0].payments.captures;
            const ppCaptureId = ppCaptures && ppCaptures[0] ? ppCaptures[0].id : null;
            // Si un orderId Genesis est fourni, confirmer la commande (flux dépôt partenaire via pb-sheet)
            if (orderId && stage) {
                await _applyPaymentConfirmation(orderId, stage, paypalOrderId, ppCaptureId);
            }
            res.json({ success: true, details: result });
        } else {
            console.warn('[PAYPAL] Statut inattendu:', result.status);
            res.status(400).json({ error: 'Paiement non complété', status: result.status });
        }
    } catch (err) {
        console.error('[PAYPAL] capture-order:', err.message);
        res.status(500).json({ error: 'Erreur capture PayPal', details: err.message });
    }
});

// ---------------------------------------------------------------------------
// Remboursement automatique client (refus prestataire)
// ---------------------------------------------------------------------------
async function refundClientOrder(order) {
    var depositAmount = parseFloat(order.deposit_amount || 0);
    var refunded = false;
    // Tentative remboursement PayPal
    if (order.paypal_capture_id) {
        try {
            var ppToken = await getPayPalAccessToken();
            var ppBody = depositAmount > 0 ? { amount: { value: depositAmount.toFixed(2), currency_code: 'EUR' } } : {};
            var ppResp = await fetch(PAYPAL_BASE + '/v2/payments/captures/' + order.paypal_capture_id + '/refund', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + ppToken, 'Content-Type': 'application/json' },
                body: JSON.stringify(ppBody)
            });
            var ppResult = await ppResp.json();
            if (ppResult.status === 'COMPLETED' || ppResult.status === 'PENDING') { refunded = true; }
            else { console.error('[REFUND] PayPal réponse inattendue:', JSON.stringify(ppResult)); }
        } catch(e) { console.error('[REFUND] PayPal erreur:', e.message); }
    }
    // Tentative remboursement SumUp (seulement si pas PayPal)
    if (!refunded && order.transaction_id && !order.paypal_capture_id) {
        try {
            await callSumUpAPI('/v0.1/me/refunds/' + order.transaction_id, 'PUT', depositAmount > 0 ? { amount: depositAmount } : null);
            refunded = true;
        } catch(e) { console.error('[REFUND] SumUp erreur:', e.message); }
    }
    updateOrder(order.id, {
        status: 'refunded',
        deposit_paid: false,
        refunded_at: new Date().toISOString(),
        refund_method: order.paypal_capture_id ? 'paypal' : (order.transaction_id ? 'sumup' : 'manual'),
        refund_reason: 'Refus prestataire',
        refund_success: refunded
    });
    if (!refunded) {
        notifyUser(null, 'admin', 'refund_manual', '⚠️ Remboursement manuel requis',
            'La commande ' + order.id + ' a été refusée mais le remboursement automatique a échoué. Action manuelle requise.',
            '#admin');
    }
    return refunded;
}

// ---------------------------------------------------------------------------
// Routes acceptation/refus mission prestataire
// ---------------------------------------------------------------------------

/**
 * GET /api/partner/dispatches/pending
 * Retourne les dispatches en statut pending_acceptance pour le prestataire connecté.
 */
app.get('/api/partner/dispatches/pending', authenticatePartner, async (req, res) => {
    try {
        var partnerId = req.partner.id || req.partner.partnerId;
        var dispatches = loadDispatches().filter(function(d) {
            return d.partner_id === partnerId && d.status === 'pending_acceptance';
        });
        // Enrichir avec les infos de la commande
        var enriched = dispatches.map(function(d) {
            var order = getOrderById(d.order_id);
            return Object.assign({}, d, {
                order: order ? {
                    product_name: order.product_name,
                    deposit_amount: order.deposit_amount,
                    total_price: order.total_price,
                    client_name: order.client_info ? ((order.client_info.first_name || '') + ' ' + (order.client_info.last_name || '')).trim() : 'Client'
                } : null
            });
        });
        res.json({ ok: true, dispatches: enriched });
    } catch(e) {
        console.error('[PARTNER_PENDING]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/partner/dispatches/:id/accept-mission
 * Le prestataire accepte la mission — déclenche le versement de l'acompte.
 */
app.post('/api/partner/dispatches/:id/accept-mission', authenticatePartner, async (req, res) => {
    try {
        var partnerId = req.partner.id || req.partner.partnerId;
        var dispatches = loadDispatches();
        var idx = dispatches.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Dispatch introuvable' });
        var disp = dispatches[idx];
        if (disp.partner_id !== partnerId) return res.status(403).json({ error: 'Non autorisé' });
        if (disp.status !== 'pending_acceptance') return res.status(400).json({ error: 'Ce dispatch ne nécessite pas d\'acceptation' });

        dispatches[idx] = Object.assign({}, disp, {
            status: 'accepted',
            mission_status: 'in_progress',
            accepted_at: new Date().toISOString()
        });
        saveDispatches(dispatches);

        var order = getOrderById(disp.order_id);
        // Déclencher le versement de l'acompte (partenaires > 300€ paiement >30%)
        if (order && order.payment_tier !== 'small') {
            await processDispatchPayout(dispatches[idx], 'deposit').catch(function(e) {
                console.error('[ACCEPT_MISSION] Payout erreur:', e.message);
            });
        }
        // Notifier le client
        if (order && order.client_info && order.client_info.email) {
            notifyUser(order.client_info.email, 'client', 'mission_accepted',
                '✅ Mission acceptée !',
                'Votre prestataire a accepté "' + (order.product_name || 'votre demande') + '". La mission démarre.',
                '#tab:resa');
        }
        console.log('[ACCEPT_MISSION] Dispatch accepté:', disp.id);
        res.json({ ok: true });
    } catch(e) {
        console.error('[ACCEPT_MISSION]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/partner/dispatches/:id/decline-mission
 * Le prestataire refuse la mission — remboursement automatique du client.
 */
app.post('/api/partner/dispatches/:id/decline-mission', authenticatePartner, async (req, res) => {
    try {
        var partnerId = req.partner.id || req.partner.partnerId;
        var dispatches = loadDispatches();
        var idx = dispatches.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Dispatch introuvable' });
        var disp = dispatches[idx];
        if (disp.partner_id !== partnerId) return res.status(403).json({ error: 'Non autorisé' });
        if (disp.status !== 'pending_acceptance') return res.status(400).json({ error: 'Ce dispatch ne peut plus être refusé' });

        dispatches[idx] = Object.assign({}, disp, {
            status: 'declined',
            mission_status: 'declined',
            declined_at: new Date().toISOString()
        });
        saveDispatches(dispatches);

        var order = getOrderById(disp.order_id);
        var refunded = false;
        if (order) {
            refunded = await refundClientOrder(order);
            // Notifier le client
            if (order.client_info && order.client_info.email) {
                var refundMsg = refunded
                    ? 'Le prestataire n\'a pas pu prendre en charge votre demande. Vous serez remboursé sous 3 à 5 jours ouvrés.'
                    : 'Le prestataire n\'a pas pu prendre en charge votre demande. Notre équipe vous contactera pour le remboursement.';
                notifyUser(order.client_info.email, 'client', 'mission_declined',
                    '❌ Mission refusée',
                    refundMsg,
                    '#tab:resa');
            }
        }
        console.log('[DECLINE_MISSION] Dispatch refusé:', disp.id, '— remboursé:', refunded);
        res.json({ ok: true, refunded: refunded });
    } catch(e) {
        console.error('[DECLINE_MISSION]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/my-orders
 * Retourne les commandes partner_service du client avec le statut du dispatch associé.
 */
app.get('/api/my-orders', async function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;
        var userEmail = user.email;
        var orders = loadOrders().filter(function(o) {
            return o.product_type === 'partner_service' &&
                !o.project_id &&  // Les commandes d'un Projet GENESIS apparaissent dans /api/my-projects
                o.client_info && o.client_info.email &&
                o.client_info.email.toLowerCase() === userEmail.toLowerCase();
        });
        var allDispatches = loadDispatches();
        var enriched = orders.map(function(o) {
            var disp = allDispatches.find(function(d) { return d.order_id === o.id; });
            var ptnr = getPartnerById(o.partner_id);
            return {
                id: o.id,
                product_name: o.product_name,
                partner_id: o.partner_id,
                partner_name: ptnr ? (ptnr.prenom ? (ptnr.prenom + ' ' + (ptnr.nom || '')) : ptnr.company || ptnr.email) : 'Prestataire',
                partner_email: ptnr ? (ptnr.email || ptnr.contact_email || null) : null,
                total_price: o.total_price,
                deposit_amount: o.deposit_amount,
                deposit_paid: o.deposit_paid,
                status: o.status,
                created_at: o.created_at,
                dispatch: disp ? {
                    id: disp.id,
                    status: disp.status,
                    mission_status: disp.mission_status,
                    accepted_at: disp.accepted_at,
                    declined_at: disp.declined_at
                } : null
            };
        }).sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        res.json({ ok: true, orders: enriched });
    } catch(e) {
        console.error('[MY_ORDERS]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/my-projects
 * Projets GENESIS du client (commandes multi-prestataires)
 */
app.get('/api/my-projects', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;
        var userEmail = user.email.toLowerCase();
        var projects = loadGenesisProjects().filter(function(p) {
            return p.client_email && p.client_email.toLowerCase() === userEmail;
        });
        var allOrders = loadOrders();
        var allDispatches = loadDispatches();

        var enriched = projects.map(function(proj) {
            var completedCount = 0;
            var inProgressCount = 0;
            var prestations = (proj.prestations || []).map(function(prest) {
                var ord = allOrders.find(function(o) { return o.id === prest.order_id; });
                var disp = allDispatches.find(function(d) { return d.order_id === prest.order_id; });
                var ptnr = getPartnerById(prest.partner_id);
                var prestStatus = 'pending_deposit';
                if (ord) {
                    prestStatus = ord.status;
                    if (disp) {
                        if (disp.status === 'completed' || ord.status === 'completed') {
                            prestStatus = 'completed';
                            completedCount++;
                        } else if (disp.status === 'accepted' || disp.status === 'in_progress') {
                            prestStatus = 'in_progress';
                            inProgressCount++;
                        }
                    } else if (ord.status === 'completed') {
                        prestStatus = 'completed';
                        completedCount++;
                    }
                }
                return {
                    order_id: prest.order_id,
                    partner_id: prest.partner_id,
                    partner_name: ptnr ? ((ptnr.prenom || '') + ' ' + (ptnr.nom || '')).trim() : (prest.partner_name || 'Prestataire'),
                    partner_photo: ptnr ? (ptnr.photo || null) : null,
                    service_label: prest.service_label,
                    total_amount: prest.total_amount,
                    deposit_amount: prest.deposit_amount || 0,
                    deposit_paid: ord ? (ord.deposit_paid || false) : false,
                    status: prestStatus,
                    dispatch_status: disp ? disp.status : null
                };
            });

            var totalPrest = prestations.length;
            var progressPct = totalPrest > 0 ? Math.round((completedCount / totalPrest) * 100) : 0;
            var projStatus = completedCount === totalPrest ? 'completed' : (inProgressCount > 0 || completedCount > 0 ? 'in_progress' : 'pending_deposit');

            return {
                id: proj.id,
                title: proj.title,
                total_amount: proj.total_amount,
                deposit_total: proj.deposit_total,
                status: projStatus,
                progress_pct: progressPct,
                completed_count: completedCount,
                total_count: totalPrest,
                prestations: prestations,
                created_at: proj.created_at
            };
        }).sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

        res.json({ ok: true, projects: enriched });
    } catch(e) {
        console.error('[MY_PROJECTS]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/projects/:projectId
 * Détail d'un Projet GENESIS (client ou admin)
 */
app.get('/api/projects/:projectId', function(req, res) {
    try {
        var tok = (req.headers.authorization || '').replace('Bearer ', '').trim();
        var user = findUserByToken(tok);
        var isAdminReq = tok && loadAdminSessions().some(function(s) {
            return s.token === tok && (!s.expires_at || new Date(s.expires_at) > new Date());
        });
        var proj = getGenesisProjectById(req.params.projectId);
        if (!proj) return res.status(404).json({ error: 'Projet non trouvé' });
        if (!isAdminReq && (!user || user.email.toLowerCase() !== (proj.client_email || '').toLowerCase())) {
            return res.status(403).json({ error: 'Accès refusé' });
        }
        // Enrichir avec installements et statuts live de chaque sous-commande
        var allOrd = loadOrders();
        var enrichedProj = Object.assign({}, proj);
        if (Array.isArray(enrichedProj.prestations)) {
            enrichedProj.prestations = enrichedProj.prestations.map(function(prest) {
                var ord = allOrd.find(function(o) { return o.id === prest.order_id; });
                return Object.assign({}, prest, {
                    deposit_paid: ord ? (ord.deposit_paid || false) : false,
                    balance_paid: ord ? (ord.balance_paid || false) : false,
                    status: ord ? ord.status : prest.status,
                    installments: ord ? (ord.installments || []) : [],
                    installments_count: ord ? (ord.installments_count || 1) : 1,
                    payment_tier: ord ? (ord.payment_tier || 'large') : 'large'
                });
            });
        }
        res.json({ ok: true, project: enrichedProj });
    } catch(e) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/partner/genesis-sub-orders
 * Sous-commandes GENESIS du partenaire connecté
 */
app.get('/api/partner/genesis-sub-orders', authenticatePartner, function(req, res) {
    try {
        var partnerId = req.partner.id;
        var allOrders = loadOrders();
        var projects = loadGenesisProjects();
        var subOrders = allOrders.filter(function(o) {
            return o.partner_id === partnerId && o.project_id && o.product_type === 'partner_service';
        });
        var enriched = subOrders.map(function(o) {
            var proj = projects.find(function(p) { return p.id === o.project_id; });
            return {
                order_id: o.id,
                project_id: o.project_id,
                project_title: proj ? proj.title : 'Projet GENESIS',
                service_label: o.product_name,
                client_name: o.client_info ? ((o.client_info.first_name || '') + ' ' + (o.client_info.last_name ? o.client_info.last_name.charAt(0) + '.' : '')) : 'Client',
                total_amount: o.total_amount,
                deposit_amount: o.deposit_amount,
                deposit_paid: o.deposit_paid || false,
                balance_paid: o.balance_paid || false,
                status: o.status,
                installments_count: o.installments_count || 1,
                created_at: o.created_at
            };
        }).sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        res.json({ ok: true, sub_orders: enriched });
    } catch(e) {
        console.error('[PARTNER/GENESIS-SUB-ORDERS]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/admin/genesis-projects
 * Liste tous les Projets GENESIS (admin)
 */
app.get('/api/admin/genesis-projects', function(req, res) {
    try {
        var projects = loadGenesisProjects();
        var allOrders = loadOrders();
        var allDispatches = loadDispatches();
        var users = loadUsers();

        var enriched = projects.map(function(proj) {
            var completedCount = 0;
            var inProgressCount = 0;
            var prestations = (proj.prestations || []).map(function(prest) {
                var ord = allOrders.find(function(o) { return o.id === prest.order_id; });
                var disp = allDispatches.find(function(d) { return d.order_id === prest.order_id; });
                var ptnr = getPartnerById(prest.partner_id);
                var prestStatus = 'pending_deposit';
                if (ord) {
                    prestStatus = ord.status;
                    if (disp) {
                        if (disp.status === 'completed' || ord.status === 'completed') {
                            prestStatus = 'completed'; completedCount++;
                        } else if (disp.status === 'accepted' || disp.status === 'in_progress') {
                            prestStatus = 'in_progress'; inProgressCount++;
                        }
                    } else if (ord.status === 'completed') {
                        prestStatus = 'completed'; completedCount++;
                    }
                }
                return {
                    order_id: prest.order_id,
                    partner_id: prest.partner_id,
                    partner_name: ptnr ? ((ptnr.prenom || '') + ' ' + (ptnr.nom || '')).trim() : (prest.partner_name || 'Prestataire'),
                    service_label: prest.service_label,
                    total_amount: prest.total_amount,
                    deposit_amount: prest.deposit_amount || 0,
                    deposit_paid: ord ? (ord.deposit_paid || false) : false,
                    balance_paid: ord ? (ord.balance_paid || false) : false,
                    status: prestStatus
                };
            });

            var totalPrest = prestations.length;
            var progressPct = totalPrest > 0 ? Math.round((completedCount / totalPrest) * 100) : 0;
            var projStatus = completedCount === totalPrest && totalPrest > 0 ? 'completed' : (inProgressCount > 0 || completedCount > 0 ? 'in_progress' : 'pending_deposit');

            var clientUser = users.find(function(u) { return u.email && u.email.toLowerCase() === (proj.client_email || '').toLowerCase(); });
            var clientName = clientUser ? ((clientUser.prenom || '') + ' ' + (clientUser.nom || '')).trim() : (proj.client_name || proj.client_email || 'Client inconnu');

            return {
                id: proj.id,
                title: proj.title,
                client_email: proj.client_email,
                client_name: clientName,
                total_amount: proj.total_amount,
                deposit_total: proj.deposit_total,
                status: projStatus,
                progress_pct: progressPct,
                completed_count: completedCount,
                total_count: totalPrest,
                prestations: prestations,
                created_at: proj.created_at,
                completed_at: proj.completed_at || null
            };
        }).sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

        res.json({ ok: true, projects: enriched });
    } catch(e) {
        console.error('[ADMIN_GENESIS_PROJECTS]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/campagnes — campagnes et jeux concours actifs (Bâtisseur+)
app.get('/api/campagnes', function(req, res) {
    try {
        var all = loadCampagnes().filter(function(c) { return c.active !== false; });
        var campagnes = all.filter(function(c) { return c.type === 'campagne'; });
        var jeux = all.filter(function(c) { return c.type === 'jeu'; });
        res.json({ ok: true, campagnes: campagnes, jeux: jeux });
    } catch(e) {
        res.json({ ok: true, campagnes: [], jeux: [] });
    }
});

/**
 * GET /api/client/wallet
 * Portefeuille GENESIS SAFE™ du client : fonds actuellement retenus en escrow + historique libéré.
 */
app.get('/api/client/wallet', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var users = loadUsers();
        var user = findUserByToken(token);
        if (!user) return res.status(401).json({ error: 'Non autorisé' });

        var orders = loadOrders();
        var payouts = loadPayouts();
        var partners = loadPartners();
        var dispatches = loadDispatches();

        var clientOrders = orders.filter(function(o) {
            return o.product_type === 'partner_service' &&
                   o.client_info && o.client_info.email &&
                   o.client_info.email.toLowerCase() === user.email.toLowerCase() &&
                   o.status !== 'cancelled' &&
                   o.status !== 'refunded' &&
                   Array.isArray(o.installments) && o.installments.length > 0;
        });

        var totalHeld = 0;
        var totalReleased = 0;
        var orderRows = [];

        clientOrders.forEach(function(order) {
            var held = 0;
            var released = 0;
            order.installments.forEach(function(inst) {
                if (!inst.paid) return;
                var payout = payouts.find(function(p) {
                    return p.order_id === order.id && p.stage === inst.stage;
                });
                if (payout && payout.status === 'sent') {
                    released += parseFloat(inst.amount) || 0;
                } else {
                    held += parseFloat(inst.amount) || 0;
                }
            });
            if (held === 0 && released === 0) return;
            totalHeld += held;
            totalReleased += released;
            var partner = partners.find(function(p) { return p.id === order.partner_id; });
            var partnerName = partner ? ((partner.prenom || partner.firstName || '') + ' ' + (partner.nom || partner.lastName || '')).trim() || partner.email : 'Prestataire';
            var statusLabel = held > 0 && order.delivery_confirmed ? 'En cours de versement'
                            : held > 0 ? 'Sécurisé jusqu\'à la livraison'
                            : 'Versé au prestataire ✓';
            // Éligibilité retrait GENESIS SAFE
            var dispatch = dispatches.find(function(d) { return d.order_id === order.id; });
            var partnerInactive = partner && partner.accountStatus && partner.accountStatus !== 'active';
            var dispatchNotAccepted = !dispatch || dispatch.status === 'pending_acceptance';
            var canWithdraw = held > 0 && (dispatchNotAccepted || partnerInactive);
            var withdrawReason = canWithdraw
                ? (partnerInactive ? 'Le prestataire n\'est pas disponible' : 'Le prestataire n\'a pas encore accepté la mission')
                : null;
            orderRows.push({
                order_id: order.id,
                service_label: order.product_name || 'Prestation',
                partner_name: partnerName,
                payment_tier: order.payment_tier || 'small',
                held_amount: Math.round(held * 100) / 100,
                released_amount: Math.round(released * 100) / 100,
                status_label: statusLabel,
                can_withdraw: canWithdraw,
                withdraw_reason: withdrawReason,
                created_at: order.created_at
            });
        });

        orderRows.sort(function(a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); });

        res.json({
            ok: true,
            total_held: Math.round(totalHeld * 100) / 100,
            total_released_alltime: Math.round(totalReleased * 100) / 100,
            orders: orderRows
        });
    } catch(e) {
        console.error('[CLIENT_WALLET]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/client/wallet/withdraw/:order_id
 * Demande de retrait GENESIS SAFE : rembourse le client si le prestataire n'a pas répondu ou est inactif.
 */
app.post('/api/client/wallet/withdraw/:order_id', async function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var user = findUserByToken(token);
        if (!user) return res.status(401).json({ error: 'Non autorisé' });

        var orderId = req.params.order_id;
        var orders = loadOrders();
        var orderIdx = orders.findIndex(function(o) { return o.id === orderId; });
        if (orderIdx === -1) return res.status(404).json({ error: 'Commande introuvable' });
        var order = orders[orderIdx];

        // Vérifier que la commande appartient à ce client
        if (!order.client_info || (order.client_info.email || '').toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'Accès refusé' });
        }
        // Vérifier que la commande est une prestation partenaire non remboursée
        if (order.product_type !== 'partner_service') {
            return res.status(400).json({ error: 'Ce type de commande ne supporte pas le retrait GENESIS SAFE' });
        }
        if (order.status === 'refunded' || order.status === 'cancelled') {
            return res.status(400).json({ error: 'Cette commande a déjà été remboursée ou annulée' });
        }
        if (!order.deposit_paid && !order.balance_paid) {
            return res.status(400).json({ error: 'Aucun paiement à rembourser' });
        }

        // Lire et valider les coordonnées bancaires du client
        var bankDetails = req.body || {};
        var accountHolder = (bankDetails.account_holder || '').trim();
        var iban = (bankDetails.iban || '').replace(/\s/g, '').toUpperCase();
        var bic = (bankDetails.bic || '').trim().toUpperCase();
        if (!accountHolder) return res.status(400).json({ error: 'Veuillez renseigner le nom du titulaire du compte' });
        if (iban.length < 14) return res.status(400).json({ error: 'IBAN invalide' });

        // Vérifier l'éligibilité : prestataire inactif OU n'a pas encore accepté
        var dispatches = loadDispatches();
        var partners = loadPartners();
        var dispatch = dispatches.find(function(d) { return d.order_id === orderId; });
        var partner = partners.find(function(p) { return p.id === order.partner_id; });
        var partnerInactive = partner && partner.accountStatus && partner.accountStatus !== 'active';
        var dispatchNotAccepted = !dispatch || dispatch.status === 'pending_acceptance';
        if (!partnerInactive && !dispatchNotAccepted) {
            return res.status(400).json({ error: 'Le retrait n\'est possible que si le prestataire n\'a pas encore accepté la mission ou est inactif' });
        }

        // Annuler le dispatch si existant
        if (dispatch) {
            var dIdx = dispatches.findIndex(function(d) { return d.id === dispatch.id; });
            if (dIdx !== -1) {
                dispatches[dIdx].status = 'cancelled';
                dispatches[dIdx].cancelled_at = new Date().toISOString();
                dispatches[dIdx].cancel_reason = 'Retrait client GENESIS SAFE';
                saveDispatches(dispatches);
            }
        }

        // Stocker les coordonnées bancaires + lancer le remboursement
        var reason = partnerInactive ? 'Prestataire inactif' : 'Prestataire n\'a pas répondu';
        updateOrder(orderId, {
            refund_reason: reason,
            withdrawal_bank: { account_holder: accountHolder, iban: iban, bic: bic, requested_at: new Date().toISOString() }
        });
        var refunded = await refundClientOrder(order);

        if (refunded) {
            console.log('[WALLET_WITHDRAW] Remboursement auto réussi pour', orderId);
        } else {
            // Le remboursement auto a échoué : notifier l'admin avec les coordonnées bancaires
            console.warn('[WALLET_WITHDRAW] Remboursement auto échoué pour', orderId, '- virement IBAN requis');
            var ibanMasked = iban.length > 8 ? iban.substring(0, 4) + '****' + iban.slice(-4) : iban;
            notifyUser(null, 'admin', 'withdrawal_manual', '💳 Virement IBAN à effectuer',
                'Retrait GENESIS SAFE – commande ' + orderId + ' – Titulaire : ' + accountHolder + ' – IBAN : ' + ibanMasked + (bic ? ' – BIC : ' + bic : ''),
                '#admin');
        }

        res.json({
            ok: true,
            refund_success: refunded,
            message: refunded
                ? 'Remboursement initié. L\'argent sera crédité sur votre mode de paiement d\'origine sous 3-5 jours ouvrés.'
                : 'Vos coordonnées bancaires ont été transmises à notre équipe. Vous recevrez un virement SEPA sous 24-48h.',
            refund_method: order.paypal_capture_id ? 'paypal' : (order.transaction_id ? 'sumup' : 'virement_iban')
        });
    } catch(e) {
        console.error('[WALLET_WITHDRAW]', e.message);
        res.status(500).json({ error: 'Erreur serveur : ' + e.message });
    }
});

/**
 * GET /api/partner/wallet
 * Portefeuille GENESIS SAFE™ du partenaire : fonds retenus en escrow + historique libéré.
 * Requête les dispatches directement par claimed_by_partner_id (pas via partner_requests).
 */
app.get('/api/partner/wallet', authenticatePartner, function(req, res) {
    try {
        var partnerId = req.partner.id;
        var dispatches = loadDispatches();
        var orders = loadOrders();
        var payouts = loadPayouts();

        var partnerDispatches = dispatches.filter(function(d) {
            return d.claimed_by_partner_id === partnerId && d.status !== 'cancelled';
        });

        var totalHeld = 0;
        var totalReleased = 0;
        var orderRows = [];

        partnerDispatches.forEach(function(dispatch) {
            var order = orders.find(function(o) { return o.id === dispatch.order_id; });
            if (!order) return;

            var held = 0;
            var released = 0;

            if (Array.isArray(order.installments) && order.installments.length > 0) {
                order.installments.forEach(function(inst) {
                    if (!inst.paid) return;
                    var payout = payouts.find(function(p) {
                        return p.order_id === order.id && p.stage === inst.stage && p.status === 'sent';
                    });
                    if (payout) {
                        released += parseFloat(inst.amount) || 0;
                    } else {
                        held += parseFloat(inst.amount) || 0;
                    }
                });
            } else {
                // Fallback for orders without installments array (old model)
                var depositPaid = !!(order.deposit_paid || order.depositPaid);
                var balancePaid = !!(order.balance_paid || order.balancePaid || order.fully_paid);
                if (depositPaid) {
                    var depPayout = payouts.find(function(p) {
                        return p.order_id === order.id && (p.stage === 'deposit' || p.stage === 'balance') && p.status === 'sent';
                    });
                    var depositAmt = parseFloat(order.deposit_amount || order.depositAmount || order.price || order.total_amount || 0);
                    var balanceAmt = parseFloat(order.balance_amount || 0);
                    if (depPayout) {
                        released += depositAmt + (balancePaid ? balanceAmt : 0);
                    } else {
                        held += depositAmt;
                        if (balancePaid) {
                            var balPayout = payouts.find(function(p) {
                                return p.order_id === order.id && p.stage === 'balance' && p.status === 'sent';
                            });
                            if (balPayout) released += balanceAmt;
                            else held += balanceAmt;
                        }
                    }
                }
            }

            if (held === 0 && released === 0) return;
            totalHeld += held;
            totalReleased += released;

            var clientName = (order.client_info && (order.client_info.name || order.client_info.email)) || 'Client';
            var statusLabel = held > 0 && order.delivery_confirmed ? 'En cours de versement'
                            : held > 0 ? 'Sécurisé jusqu\'à la livraison'
                            : 'Versé sur votre compte ✓';
            orderRows.push({
                dispatch_id: dispatch.id,
                order_id: order.id,
                service_label: order.product_name || order.service_label || 'Prestation',
                client_name: clientName,
                payment_tier: order.payment_tier || 'small',
                held_amount: Math.round(held * 100) / 100,
                released_amount: Math.round(released * 100) / 100,
                delivery_confirmed: !!order.delivery_confirmed,
                status_label: statusLabel,
                created_at: order.created_at
            });
        });

        orderRows.sort(function(a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); });

        res.json({
            ok: true,
            total_held: Math.round(totalHeld * 100) / 100,
            total_released_alltime: Math.round(totalReleased * 100) / 100,
            orders: orderRows
        });
    } catch(e) {
        console.error('[PARTNER_WALLET]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/payments/apple-pay/validate
 * Merchant validation for Apple Pay JS API — proxies request to Apple with merchant certificate
 */
app.post('/api/payments/apple-pay/validate', async (req, res) => {
    try {
        const { validationURL } = req.body;
        if (!validationURL) return res.status(400).json({ error: 'validationURL manquante' });

        const merchantId = process.env.APPLE_PAY_MERCHANT_ID;
        const certPath = process.env.APPLE_PAY_CERT_PATH;
        const keyPath = process.env.APPLE_PAY_KEY_PATH;

        if (!merchantId || !certPath || !keyPath) {
            console.warn('[APPLE PAY] Variables d\'environnement manquantes (APPLE_PAY_MERCHANT_ID, APPLE_PAY_CERT_PATH, APPLE_PAY_KEY_PATH)');
            return res.status(503).json({ error: 'Apple Pay non configuré sur ce serveur' });
        }

        const url = new URL(validationURL);
        // Security: Apple validation URLs must be on apple.com
        if (!url.hostname.endsWith('.apple.com')) {
            return res.status(400).json({ error: 'URL de validation invalide' });
        }

        const payload = JSON.stringify({
            merchantIdentifier: merchantId,
            domainName: 'fagenesis.com',
            displayName: 'FA GENESIS'
        });

        const https = require('https');
        const fs = require('fs');

        const merchantSession = await new Promise((resolve, reject) => {
            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'POST',
                cert: fs.readFileSync(certPath),
                key: fs.readFileSync(keyPath),
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            };
            const req2 = https.request(options, (res2) => {
                let data = '';
                res2.on('data', c => data += c);
                res2.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error('Réponse Apple invalide: ' + data.substring(0, 200))); }
                });
            });
            req2.on('error', reject);
            req2.write(payload);
            req2.end();
        });

        console.log('[APPLE PAY] Merchant validation OK');
        res.json(merchantSession);
    } catch (error) {
        console.error('[APPLE PAY] Validate error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/payments/apple-pay/complete
 * Complete a SumUp checkout using an Apple Pay payment token
 */
app.post('/api/payments/apple-pay/complete', async (req, res) => {
    try {
        const { checkoutId, paymentToken } = req.body;
        if (!checkoutId || !paymentToken) {
            return res.status(400).json({ error: 'checkoutId et paymentToken requis', success: false });
        }

        console.log('[APPLE PAY] Completion checkout:', checkoutId);

        const result = await callSumUpAPI('/checkouts/' + checkoutId, 'PUT', {
            payment_type: 'applepay',
            token: typeof paymentToken === 'string' ? paymentToken : JSON.stringify(paymentToken)
        });

        const success = result.status === 'PAID' || result.status === 'SUCCESSFUL';
        console.log('[APPLE PAY] Checkout status:', result.status, '— success:', success);
        res.json({ success: success, status: result.status });
    } catch (error) {
        console.error('[APPLE PAY] Complete error:', error.message);
        res.status(500).json({ error: error.message, success: false });
    }
});

/**
 * GET /api/payments/sumup/status/:checkoutId
 * Verifier le statut d'un checkout SumUp
 */
app.get('/api/payments/sumup/status/:checkoutId', async (req, res) => {
    try {
        const { checkoutId } = req.params;

        const status = await callSumUpAPI(`/checkouts/${checkoutId}`, 'GET');

        res.json(status);

    } catch (error) {
        console.error('Erreur verification statut:', error);
        res.status(500).json({ error: 'Erreur lors de la verification du statut' });
    }
});

/**
 * POST /api/payments/sumup/webhook
 * Recevoir les notifications de paiement SumUp
 *
 * SECURITE: En production, verifier la signature du webhook
 */
app.post('/api/payments/sumup/webhook', async (req, res) => {
    try {
        console.log('[WEBHOOK] Notification recue:', JSON.stringify(req.body, null, 2));

        const { event_type, checkout_reference, id, status, transaction_code, transaction_id } = req.body;

        // Extraire l'orderId et le stage du checkout_reference
        // Format: ORD-XXXXX-deposit-TIMESTAMP ou ORD-XXXXX-balance-TIMESTAMP (ou sans timestamp)
        const parts = checkout_reference ? checkout_reference.split('-') : [];
        // Retirer le timestamp final s'il est numerique (format avec timestamp)
        if (parts.length > 0 && /^\d+$/.test(parts[parts.length - 1])) {
            parts.pop();
        }
        const stage = parts.pop(); // 'deposit', 'balance', ou 'installment_N'
        const orderId = parts.join('-'); // 'ORD-XXXXX'

        if (!orderId) {
            console.log('[WEBHOOK] checkout_reference invalide:', checkout_reference);
            return res.status(200).send('OK');
        }

        const order = getOrderById(orderId);
        if (!order) {
            console.log('[WEBHOOK] Commande non trouvee:', orderId);
            return res.status(200).send('OK');
        }

        // Traiter selon le type d'evenement
        if (event_type === 'CHECKOUT.PAID' || status === 'PAID') {
            console.log(`[WEBHOOK] Paiement confirme pour ${orderId} - ${stage}`);

            const updates = {
                transaction_id: transaction_id || transaction_code
            };

            if (stage === 'deposit') {
                updates.deposit_paid = true;
                updates.status = 'active';
                updates.start_date = null;
                updates.schedule_status = 'awaiting_client_choice';
                updates.proposed_start_date = null;
                updates.schedule_confirmed_by_admin = false;
                updates.schedule_confirmed_by_partner = false;
                console.log('[WEBHOOK] Acompte paye - Commande active - En attente choix date client');
            } else if (stage === 'balance') {
                updates.balance_paid = true;
                updates.status = 'paid_in_full';
                // GENESIS SAFE™ : si la commande a un split 3 tranches et que le client a payé
                // tout le solde restant en un clic, marquer aussi les tranches 2/3 comme payées
                // (sinon getAccessRights, qui se base sur installments[2].paid, resterait bloqué).
                if (order.installments && order.installments.length === 3) {
                    var balUpdatedInstallments = order.installments.map(function(i) {
                        if (i.paid) return i;
                        return Object.assign({}, i, { paid: true, paid_at: new Date().toISOString() });
                    });
                    updates.installments = balUpdatedInstallments;
                    updates.amount_paid = balUpdatedInstallments.reduce(function(sum, i) { return sum + (i.paid ? i.amount : 0); }, 0);
                }
                console.log(`[WEBHOOK] Solde payé - Commande complète`);
            } else if (stage === 'installment_2' || stage === 'installment_3') {
                // GENESIS SAFE™ : tranche 2 (livrable intermédiaire, 40%) ou tranche 3 (livraison finale, 30%)
                var instIdx = (order.installments || []).findIndex(function(i) { return i.stage === stage; });
                if (instIdx !== -1) {
                    var updatedInstallments = order.installments.map(function(i, idx) {
                        if (idx !== instIdx) return i;
                        return Object.assign({}, i, { paid: true, paid_at: new Date().toISOString() });
                    });
                    updates.installments = updatedInstallments;
                    updates.amount_paid = updatedInstallments.reduce(function(sum, i) { return sum + (i.paid ? i.amount : 0); }, 0);
                    if (stage === 'installment_2') {
                        updates.status = 'mid_delivery_paid';
                        console.log('[WEBHOOK] Tranche 2 (livrable intermédiaire) payée');
                    } else {
                        updates.balance_paid = true;
                        updates.status = 'paid_in_full';
                        console.log('[WEBHOOK] Tranche 3 (livraison finale) payée - Commande complète');
                    }
                }
            }

            const updatedOrder = updateOrder(orderId, updates);

            // === SYNCHRONISER users.json avec le paymentStatus ===
            if (updatedOrder && updatedOrder.client_info && updatedOrder.client_info.email) {
                try {
                    var users = loadUsers();
                    var userIdx = users.findIndex(function(u) {
                        return u.email && u.email.toLowerCase() === updatedOrder.client_info.email.toLowerCase();
                    });
                    if (userIdx !== -1) {
                        var newPaymentStatus = stage === 'deposit' ? 'deposit_paid'
                            : stage === 'installment_2' ? 'mid_delivery_paid'
                            : (stage === 'balance' || stage === 'installment_3') ? 'fully_paid'
                            : null;
                        if (newPaymentStatus) {
                            users[userIdx].paymentStatus = newPaymentStatus;
                            users[userIdx].payment_status = newPaymentStatus;
                        }
                        users[userIdx].activeOrderId = orderId;
                        saveUsers(users);
                        console.log('[WEBHOOK] users.json mis à jour: ' + updatedOrder.client_info.email + ' → paymentStatus=' + newPaymentStatus);
                    } else {
                        console.log('[WEBHOOK] Utilisateur non trouvé dans users.json: ' + updatedOrder.client_info.email);
                    }
                } catch (syncErr) {
                    console.error('[WEBHOOK] Erreur sync users.json (non-bloquant):', syncErr.message);
                }
            }

            // Push notifications paiement
            if (updatedOrder && updatedOrder.client_info && updatedOrder.client_info.email) {
                var pushClientEmail = updatedOrder.client_info.email;
                var pushMsgClient = stage === 'deposit' ? 'Votre acompte a été reçu. Votre accompagnement démarre !'
                    : stage === 'installment_2' ? 'Le paiement de la tranche 2 (livrable intermédiaire) a été reçu. Merci !'
                    : 'Votre paiement complet a été confirmé. Merci !';
                var pushStageLabel = stage === 'deposit' ? 'acompte' : stage === 'installment_2' ? 'tranche 2' : stage === 'installment_3' ? 'tranche 3' : 'solde';
                notifyUser(pushClientEmail, 'client', 'paiement', 'Paiement confirmé ✅', pushMsgClient, '/app.html');
                notifyUser(null, 'admin', 'paiement-admin', 'Paiement reçu', (updatedOrder.client_info.first_name || '') + ' — ' + (updatedOrder.product_name || '') + ' — ' + pushStageLabel, '/app.html#open-admin');
            }

            // Envoyer les emails appropriés
            if (updatedOrder && updatedOrder.client_info) {
                const clientEmail = updatedOrder.client_info.email;
                const clientName = `${updatedOrder.client_info.first_name} ${updatedOrder.client_info.last_name}`;

                if (stage === 'deposit') {
                    // Après paiement de l'acompte : envoyer l'email de bienvenue/confirmation d'inscription
                    const { getProductById, calculatePaymentAmounts } = require('./products');
                    const product = getProductById(updatedOrder.product_id);
                    let offerData = null;
                    if (product) {
                        const amounts = calculatePaymentAmounts(product.total_price);
                        offerData = {
                            name: product.name,
                            category: product.category,
                            product_type: product.product_type,
                            total_price: product.total_price,
                            duration: product.duration,
                            deposit_amount: amounts.deposit_amount,
                            balance_amount: amounts.balance_amount
                        };
                    }

                    if (updatedOrder.product_type === 'partner_service') {
                        const psPartner = getPartnerById(updatedOrder.partner_id);
                        const psPartnerEmail = psPartner ? (psPartner.email || psPartner.contact_email || null) : null;
                        const psPartnerName = psPartner ? (psPartner.prenom ? (psPartner.prenom + ' ' + (psPartner.nom || '')) : psPartner.company || 'votre prestataire') : 'votre prestataire';
                        // Email récapitulatif envoyé immédiatement — indépendamment de la création du dispatch
                        emailService.sendPartnerServiceOrderConfirmation(
                            updatedOrder.client_info.email,
                            updatedOrder.client_info ? updatedOrder.client_info.first_name : '',
                            updatedOrder,
                            psPartnerName
                        ).catch(function(e){ console.error('[WEBHOOK] Email commande partenaire:', e.message); });
                        const psDispatch = createPartnerServiceDispatch(updatedOrder);
                        if (psDispatch) {
                            // Notifier le PRESTATAIRE : nouvelle commande payée, acceptation requise
                            if (psPartnerEmail) {
                                notifyUser(psPartnerEmail, 'partner', 'mission_pending',
                                    '🆕 Nouvelle commande !',
                                    ((updatedOrder.client_info && updatedOrder.client_info.first_name) || 'Un client') + ' a payé pour "' + (updatedOrder.product_name || 'votre prestation') + '". Acceptez ou refusez dans les 24h.',
                                    '#partner:missions');
                            }
                            // Notifier le CLIENT : paiement réussi
                            notifyUser(updatedOrder.client_info.email, 'client', 'payment_success',
                                '✅ Paiement réussi !',
                                'Votre paiement a bien été reçu. ' + psPartnerName + ' va prendre en charge votre demande sous 24h.',
                                '#tab:resa');
                            console.log('[WEBHOOK] Mission partenaire créée — en attente d\'acceptation du prestataire');
                        }
                    } else {
                        assignIntervenantsFromOrder(orderId);
                        console.log('[WEBHOOK] Acompte retenu — en attente acceptation partenaire');
                        emailService.sendPaymentConfirmation(clientEmail, clientName, updatedOrder).catch(err => console.error('[WEBHOOK] Email acompte:', err));
                    }

                    // NOTE: Le bootstrap projet est maintenant declenche par finalizeSchedule()
                    // apres que le client ait choisi une date ET que admin+partenaire aient confirme
                    console.log('[WEBHOOK] Bootstrap reporte - en attente choix date client');

                } else if (stage === 'balance' || stage === 'installment_2' || stage === 'installment_3') {
                    var isFinalPayment = (stage === 'balance' || stage === 'installment_3');

                    if (isFinalPayment) {
                        // Après paiement du solde / de la tranche finale : confirmation de paiement complet
                        emailService.sendPaymentConfirmation(
                            clientEmail,
                            clientName,
                            updatedOrder
                        ).then(result => {
                            if (result.success) {
                                console.log(`[WEBHOOK] Email de paiement envoyé à ${clientEmail}`);
                            }
                        }).catch(err => console.error('[WEBHOOK] Erreur envoi email paiement:', err));
                    }

                    // Vérifier si des tranches intermédiaires en attente doivent être auto-libérées
                    checkAutoReleaseIntermediatePayouts();
                    // Verser la part de cette tranche (installment_2 retenu jusqu'à validation livrable ou auto-libération)
                    var _acceptedD = loadDispatches().filter(function(d) { return d.order_id === orderId && d.status === 'accepted'; });
                    _acceptedD.forEach(function(d) { processDispatchPayout(d, stage).catch(function(e) { console.error('[PAYOUT] Erreur ' + stage + ' webhook:', e); }); });
                    if (_acceptedD.length === 0) console.log('[WEBHOOK] Aucun dispatch accepté pour versement ' + stage + ' — commande ' + orderId);
                    if (isFinalPayment) {
                        requestPartnerReviews(clientEmail, _acceptedD);
                        checkReferralAndMissionRewards(clientEmail);
                        // Tâche 7 : Jérémie proactif après paiement final
                        try {
                            var _wUser = loadUsers().find(function(u){ return (u.email||'')===(clientEmail||''); });
                            if (_wUser) checkAndSendProactiveQGNotif(_wUser.email, 'client', getClientGenesisPoints(_wUser));
                            _acceptedD.forEach(function(d){
                                if (d.claimed_by_partner_id) {
                                    var _wPtnr = loadPartners().find(function(p){ return p.id === d.claimed_by_partner_id; });
                                    if (_wPtnr) checkAndSendProactiveQGNotif(_wPtnr.email, 'partner', getPartnerGenesisPoints(_wPtnr));
                                }
                            });
                        } catch(_e) {}
                    }
                }
            }
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error('[WEBHOOK] Erreur:', error);
        res.status(200).send('OK'); // Toujours retourner 200 pour eviter les retries
    }
});

/**
 * POST /api/payments/verify
 * Verification manuelle du paiement (apres retour de SumUp)
 * Utilise par le frontend pour confirmer le paiement
 */
app.post('/api/payments/verify', async (req, res) => {
    try {
        const { orderId, stage } = req.body;
        if (!orderId || !stage) return res.status(400).json({ error: 'orderId et stage requis' });

        const order = getOrderById(orderId);
        if (!order) return res.status(404).json({ error: 'Commande non trouvee' });

        // ── Déterminer si ce stage est un nouveau paiement (idempotent) ──────────────
        var isNewPayment = false;
        var paymentStage = null;
        var payoutStage = null;
        var updates = {};
        var isInstallVerify = stage && stage.startsWith('installment_');

        if (stage === 'deposit' && !order.deposit_paid) {
            isNewPayment = true; paymentStage = 'deposit'; payoutStage = 'deposit';
            updates.deposit_paid = true;
            updates.deposit_paid_at = new Date().toISOString();
            updates.amount_paid = order.deposit_amount || 0;
            updates.status = 'active';
            updates.start_date = null;
            updates.schedule_status = 'awaiting_client_choice';
            updates.proposed_start_date = null;
            updates.schedule_confirmed_by_admin = false;
            updates.schedule_confirmed_by_partner = false;
            if (order.installments && order.installments.length > 0) {
                var installsCopy = JSON.parse(JSON.stringify(order.installments));
                var dep = installsCopy.find(function(it) { return it.stage === 'deposit'; });
                if (dep) { dep.paid = true; dep.paid_at = new Date().toISOString(); }
                updates.installments = installsCopy;
            }
        } else if (isInstallVerify && !order.balance_paid) {
            var installsCopy2 = order.installments ? JSON.parse(JSON.stringify(order.installments)) : [];
            var instToMark = installsCopy2.find(function(it) { return it.stage === stage; });
            if (instToMark && !instToMark.paid) {
                instToMark.paid = true; instToMark.paid_at = new Date().toISOString();
                var newAmountPaid = (order.amount_paid || 0) + instToMark.amount;
                updates.installments = installsCopy2; updates.amount_paid = newAmountPaid;
                var allPaid = installsCopy2.every(function(it) { return it.paid; });
                if (allPaid || newAmountPaid >= order.total_amount) { updates.balance_paid = true; updates.status = 'paid_in_full'; }
                else if (stage === 'installment_2') { updates.status = 'mid_delivery_paid'; }
                isNewPayment = true; paymentStage = allPaid ? 'balance' : 'installment'; payoutStage = stage;
            }
        } else if (stage === 'balance' && !order.balance_paid) {
            isNewPayment = true; paymentStage = 'balance'; payoutStage = 'balance';
            updates.balance_paid = true; updates.amount_paid = order.total_amount; updates.status = 'paid_in_full';
            if (order.installments && order.installments.length > 0) {
                var installsCopy3 = JSON.parse(JSON.stringify(order.installments));
                installsCopy3.forEach(function(it) { if (!it.paid) { it.paid = true; it.paid_at = new Date().toISOString(); } });
                updates.installments = installsCopy3;
            }
        }

        if (!isNewPayment) {
            // Déjà traité (appel dupliqué) — retourner l'état actuel sans rien faire
            return res.json({ success: true, paid: order.deposit_paid || order.balance_paid, already_processed: true, order });
        }

        // ── Récupérer le transaction_id depuis SumUp (optionnel — ne bloque pas) ───
        if (order.checkout_id) {
            try {
                var checkoutStatus = await callSumUpAPI('/checkouts/' + order.checkout_id, 'GET');
                if (checkoutStatus.transaction_id || checkoutStatus.transaction_code) {
                    updates.transaction_id = checkoutStatus.transaction_id || checkoutStatus.transaction_code;
                }
            } catch (sumupErr) {
                console.log('[VERIFY] SumUp API indisponible pour transaction_id (paiement traité quand même):', sumupErr.message);
            }
        }

        var updatedOrder = updateOrder(orderId, updates);
        console.log('[VERIFY] Paiement confirmé:', orderId, '—', stage);

        // ── Synchroniser users.json ───────────────────────────────────────────────
        if (updatedOrder && updatedOrder.client_info && updatedOrder.client_info.email) {
            try {
                var allUsers = loadUsers();
                var uIdx = allUsers.findIndex(function(u) { return u.email && u.email.toLowerCase() === updatedOrder.client_info.email.toLowerCase(); });
                if (uIdx !== -1) {
                    var newUserStatus = payoutStage === 'deposit' ? 'deposit_paid' : payoutStage === 'installment_2' ? 'mid_delivery_paid' : 'fully_paid';
                    allUsers[uIdx].paymentStatus = newUserStatus; allUsers[uIdx].payment_status = newUserStatus; allUsers[uIdx].activeOrderId = orderId;
                    saveUsers(allUsers);
                    console.log('[VERIFY] users.json sync: ' + updatedOrder.client_info.email + ' → ' + newUserStatus);
                }
            } catch (syncErr) { console.error('[VERIFY] Erreur sync users.json:', syncErr.message); }
        }

        // ── Emails + dispatch/payout ──────────────────────────────────────────────
        if (updatedOrder && updatedOrder.client_info) {
            var clientEmail = updatedOrder.client_info.email;
            var clientName = (updatedOrder.client_info.first_name || '') + ' ' + (updatedOrder.client_info.last_name || '');

            if (paymentStage === 'deposit') {
                if (updatedOrder.product_type === 'partner_service') {
                    var psVP = getPartnerById(updatedOrder.partner_id);
                    var psVPName = psVP ? (psVP.prenom ? (psVP.prenom + ' ' + (psVP.nom || '')) : psVP.company || 'votre prestataire') : 'votre prestataire';
                    emailService.sendPartnerServiceOrderConfirmation(
                        clientEmail, updatedOrder.client_info.first_name || '', updatedOrder, psVPName
                    ).then(function(r){ console.log('[VERIFY] Email partenaire résultat:', JSON.stringify(r)); })
                     .catch(function(e){ console.error('[VERIFY] Email partenaire exception:', e.message); });
                    var psDispatch = createPartnerServiceDispatch(updatedOrder);
                    if (psDispatch) {
                        if (updatedOrder.payment_tier === 'small') {
                            console.log('[VERIFY] Mission partenaire — fonds GENESIS SAFE™ (small)');
                            notifyUser(clientEmail, 'client', 'mission_created', 'Mission créée — paiement sécurisé', 'Votre paiement est sécurisé par GENESIS SAFE™. Les fonds seront versés au prestataire après livraison.', '/app.html#reservations');
                        } else {
                            await processDispatchPayout(psDispatch, 'deposit');
                            console.log('[VERIFY] Mission partenaire — acompte 30% versé (large)');
                            notifyUser(clientEmail, 'client', 'mission_created', 'Mission en cours', 'Votre acompte a été versé au prestataire. La livraison sera bientôt disponible.', '/app.html#reservations');
                        }
                    }
                } else {
                    assignIntervenantsFromOrder(orderId);
                    emailService.sendPaymentConfirmation(clientEmail, clientName, updatedOrder)
                        .catch(function(err){ console.error('[VERIFY] Email acompte:', err); });
                }
                console.log('[VERIFY] Bootstrap reporté — en attente choix date client');

            } else if (paymentStage === 'balance' || paymentStage === 'installment') {
                if (paymentStage === 'balance') {
                    emailService.sendPaymentConfirmation(clientEmail, clientName, updatedOrder)
                        .then(function(r){ if(r.success) console.log('[VERIFY] Email paiement final envoyé à ' + clientEmail); })
                        .catch(function(err){ console.error('[VERIFY] Erreur email paiement:', err); });
                }
                var _vAccD = loadDispatches().filter(function(d) { return d.order_id === orderId && d.status === 'accepted'; });
                _vAccD.forEach(function(d) { processDispatchPayout(d, payoutStage).catch(function(e){ console.error('[PAYOUT] Erreur ' + payoutStage + ' verify:', e); }); });
                if (paymentStage === 'balance') {
                    requestPartnerReviews(clientEmail, _vAccD);
                    checkReferralAndMissionRewards(clientEmail);
                }
            }
        }

        return res.json({ success: true, paid: true, order: updatedOrder });

    } catch (error) {
        console.error('Erreur verification paiement:', error);
        res.status(500).json({ error: 'Erreur lors de la verification' });
    }
});

// ============================================================
// ROUTE - HISTORIQUE DES PAIEMENTS
// ============================================================

/**
 * GET /api/payments/history
 * Retourne l'historique des paiements du client authentifie.
 * Auth: Bearer sessionToken
 */
app.get('/api/payments/history', (req, res) => {
    try {
        var authHeader = req.headers.authorization || '';
        var token = '';
        if (authHeader.toLowerCase().startsWith('bearer ')) {
            token = authHeader.slice(7).trim();
        } else if (authHeader.trim()) {
            token = authHeader.trim();
        }
        if (!token) {
            return res.status(401).json({ ok: false, error: 'Token manquant' });
        }

        var users = loadUsers();
        var user = findUserByToken(token);
        if (!user) {
            return res.status(401).json({ ok: false, error: 'Session invalide' });
        }

        var orders = loadOrders();
        var clientOrders = orders.filter(function(o) {
            return o.client_info && o.client_info.email &&
                o.client_info.email.toLowerCase() === user.email.toLowerCase();
        });

        // Trier par date de creation decroissante (la plus recente en premier)
        clientOrders.sort(function(a, b) {
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });

        // Construire l'historique des paiements
        var payments = [];
        var canPayBalance = false;
        var balanceAmount = 0;

        for (var i = 0; i < clientOrders.length; i++) {
            var ord = clientOrders[i];
            // Mode installements : construire l'historique depuis le tableau installments
            if (ord.installments && ord.installments.length > 0) {
                for (var j = 0; j < ord.installments.length; j++) {
                    var inst = ord.installments[j];
                    if (inst.paid) {
                        payments.push({
                            type: inst.stage || 'installment',
                            label: inst.label || ('Versement #' + inst.number),
                            amount: inst.amount || 0,
                            currency: 'EUR',
                            paid_at: inst.paid_at || ord.updated_at || ord.created_at,
                            order_id: ord.id,
                            product_name: ord.product_name || ''
                        });
                    }
                }
            } else {
                // Mode standard (N=2)
                if (ord.deposit_paid) {
                    payments.push({
                        type: 'deposit',
                        label: 'Acompte (30%)',
                        amount: ord.deposit_amount || 0,
                        currency: 'EUR',
                        paid_at: ord.deposit_paid_at || ord.updated_at || ord.created_at,
                        order_id: ord.id,
                        product_name: ord.product_name || ''
                    });
                }
                if (ord.balance_paid) {
                    payments.push({
                        type: 'balance',
                        label: 'Solde (70%)',
                        amount: ord.balance_amount || 0,
                        currency: 'EUR',
                        paid_at: ord.balance_paid_at || ord.updated_at,
                        order_id: ord.id,
                        product_name: ord.product_name || ''
                    });
                }
            }
        }

        // Commande active = la plus recente non annulee et non entierement payee
        // Priorite : acompte non paye > acompte paye mais solde non paye > entierement payee
        var activeOrder = clientOrders.find(function(o) {
            return o.status !== 'cancelled' && !o.deposit_paid;
        }) || clientOrders.find(function(o) {
            return o.status !== 'cancelled' && o.deposit_paid && !o.balance_paid;
        }) || clientOrders.find(function(o) {
            return o.status !== 'cancelled';
        }) || clientOrders[0] || null;

        // Determiner si le solde peut etre paye
        // Autorise des que l'acompte est paye : le client peut anticiper a tout moment
        if (activeOrder && activeOrder.deposit_paid && !activeOrder.balance_paid) {
            canPayBalance = true;
            // En mode installements : solde restant = total - deja paye
            if (activeOrder.installments && activeOrder.installments.length > 0) {
                balanceAmount = (activeOrder.total_amount || 0) - (activeOrder.amount_paid || 0);
            } else {
                balanceAmount = activeOrder.balance_amount || 0;
            }
        }

        // Prochain versement a payer (mode installements)
        var nextInstallment = null;
        if (activeOrder && activeOrder.installments && activeOrder.installments.length > 0) {
            nextInstallment = activeOrder.installments.find(function(inst) {
                return !inst.paid && inst.stage !== 'deposit';
            }) || null;
        }

        // Trier par date (plus recent en premier)
        payments.sort(function(a, b) {
            return new Date(b.paid_at || 0) - new Date(a.paid_at || 0);
        });

        res.json({
            ok: true,
            payments: payments,
            can_pay_balance: canPayBalance,
            balance_amount: balanceAmount,
            order_id: activeOrder ? activeOrder.id : null,
            product_name: activeOrder ? (activeOrder.product_name || '') : '',
            deposit_paid: activeOrder ? (activeOrder.deposit_paid === true) : false,
            balance_paid: activeOrder ? (activeOrder.balance_paid === true) : false,
            total_amount: activeOrder ? (activeOrder.total_amount || 0) : 0,
            deposit_amount: activeOrder ? (activeOrder.deposit_amount || 0) : 0,
            amount_paid: activeOrder ? (activeOrder.amount_paid || 0) : 0,
            installments_count: activeOrder ? (activeOrder.installments_count || 2) : 2,
            installments: activeOrder ? (activeOrder.installments || null) : null,
            next_installment: nextInstallment,
            balance_payment_ready: activeOrder ? (activeOrder.balance_payment_ready === true) : false
        });

    } catch (error) {
        console.error('[PAYMENTS/HISTORY] Erreur:', error);
        res.status(500).json({ ok: false, error: 'Erreur serveur' });
    }
});

// ============================================================
// ROUTES - ESPACE CLIENT
// ============================================================

/**
 * GET /api/client/orders
 * Recuperer les commandes d'un client par email
 */
app.get('/api/client/orders', (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: 'Email requis' });
    }

    const orders = loadOrders();
    const clientOrders = orders.filter(o =>
        o.client_info.email.toLowerCase() === email.toLowerCase()
    );

    res.json(clientOrders);
});

/**
 * GET /api/client/payments-list
 * Liste complète des paiements d'un client (JWT)
 */
app.get('/api/client/payments-list', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var users = loadUsers();
        var user = findUserByToken(token);
        if (!user) return res.status(401).json({ error: 'Non autorisé' });

        var orders = loadOrders();
        var clientOrders = orders.filter(function(o) {
            return o.client_info && o.client_info.email &&
                   o.client_info.email.toLowerCase() === user.email.toLowerCase() &&
                   o.status !== 'cancelled' &&
                   o.status !== 'completed' &&
                   o.status !== 'fully_paid';
        });
        clientOrders.sort(function(a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); });

        var cwDevisAll = loadCwDevis();
        var clientDevis = cwDevisAll.filter(function(d) {
            return d.client_email && d.client_email.toLowerCase() === user.email.toLowerCase() &&
                   (d.status === 'accepted' || d.status === 'paid');
        });

        var paymentList = [];

        clientOrders.forEach(function(order) {
            var orderName = order.product_name || 'Commande';
            var cat = order.product_type === 'coworking_devis' ? 'Devis Coworking'
                    : order.product_type === 'coworking' ? 'Coworking'
                    : 'Accompagnement';

            if (order.product_type === 'coworking_devis') {
                var installs = parseInt(order.installments_count) || 1;
                var devisTotal = Number(order.total_amount) || 0;
                var installAmt = installs > 1 ? Math.ceil(devisTotal / installs) : devisTotal;
                var devisItemRef = (order.items || []).find(function(it) { return it.devis_id; });
                var orderDevisId = devisItemRef ? devisItemRef.devis_id : null;
                for (var i = 1; i <= installs; i++) {
                    var isPaid = i === 1 ? order.deposit_paid === true : (i === 2 ? order.balance_paid === true : false);
                    var canPayThis = (i === 1 && !order.deposit_paid) || (i === 2 && order.deposit_paid === true && !order.balance_paid);
                    var amt = i < installs ? installAmt : Math.max(0, devisTotal - installAmt * (installs - 1));
                    paymentList.push({
                        id: order.id + '-inst-' + i,
                        order_id: order.id,
                        devis_id: i === 1 ? orderDevisId : null,
                        label: orderName,
                        category: cat,
                        type_label: installs > 1 ? 'Versement ' + i + '/' + installs : 'Paiement intégral',
                        amount: amt,
                        total_amount: devisTotal,
                        installments_options: [1],
                        status: isPaid ? 'paid' : (canPayThis ? 'accepted_unpaid' : 'pending'),
                        paid_at: isPaid ? (order.deposit_paid_at || order.updated_at || null) : null,
                        can_pay: canPayThis
                    });
                }
            } else if (order.product_type === 'coworking') {
                paymentList.push({
                    id: order.id + '-full',
                    order_id: order.id,
                    label: orderName,
                    category: 'Coworking',
                    type_label: 'Paiement',
                    amount: Number(order.total_amount) || 0,
                    status: order.deposit_paid ? 'paid' : 'pending',
                    paid_at: order.deposit_paid ? (order.deposit_paid_at || null) : null,
                    can_pay: !order.deposit_paid
                });
            } else {
                paymentList.push({
                    id: order.id + '-deposit',
                    order_id: order.id,
                    label: orderName,
                    category: cat,
                    type_label: 'Acompte (30%)',
                    amount: Number(order.deposit_amount) || 0,
                    status: order.deposit_paid ? 'paid' : 'pending',
                    paid_at: order.deposit_paid ? (order.deposit_paid_at || null) : null,
                    can_pay: false
                });
                if (Number(order.balance_amount) > 0) {
                    paymentList.push({
                        id: order.id + '-balance',
                        order_id: order.id,
                        label: orderName,
                        category: cat,
                        type_label: 'Solde (70%)',
                        amount: Number(order.balance_amount) || 0,
                        status: order.balance_paid ? 'paid' : (order.deposit_paid ? 'due' : 'pending'),
                        paid_at: order.balance_paid ? (order.balance_paid_at || null) : null,
                        can_pay: order.deposit_paid === true && !order.balance_paid
                    });
                }
            }
        });

        clientDevis.forEach(function(d) {
            var hasOrder = clientOrders.some(function(o) {
                return o.items && o.items.some(function(it) { return it.devis_id === d.id; });
            });
            if (hasOrder) return;
            paymentList.push({
                id: 'devis-' + d.id,
                devis_id: d.id,
                label: d.service_label,
                category: 'Devis Coworking',
                type_label: 'Devis accepté',
                amount: Number((d.quote || {}).amount) || 0,
                total_amount: Number((d.quote || {}).amount) || 0,
                installments_options: (d.quote || {}).installments_options || [1],
                status: d.status === 'paid' ? 'paid' : 'accepted_unpaid',
                can_pay: d.status !== 'paid'
            });
        });

        var totalPaid = 0, totalPending = 0;
        paymentList.forEach(function(p) {
            if (p.status === 'paid') totalPaid += p.amount;
            else totalPending += p.amount;
        });

        paymentList.sort(function(a, b) {
            var rank = { due: 0, accepted_unpaid: 1, pending: 2, paid: 3 };
            return (rank[a.status] || 2) - (rank[b.status] || 2);
        });

        res.json({ payments: paymentList, summary: { total_paid: totalPaid, total_pending: totalPending } });
    } catch(e) {
        console.error('[PAYMENTS LIST]', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/client/dashboard/:orderId
 * Recuperer les informations du dashboard pour une commande
 * Retourne les droits d'acces selon le statut
 */
app.get('/api/client/dashboard/:orderId', (req, res) => {
    const order = getOrderById(req.params.orderId);

    if (!order) {
        return res.status(404).json({ error: 'Commande non trouvee' });
    }

    // Determiner les droits d'acces
    const accessRights = getAccessRights(order);

    // Calculer le jour courant pour les accompagnements
    const dayInfo = calculateCurrentDay(order);

    res.json({
        order: order,
        access: accessRights,
        product_type: order.product_type,
        currentDay: dayInfo.currentDay,
        totalDays: dayInfo.totalDays,
        isComplete: dayInfo.isComplete,
        schedule_status: order.schedule_status || null,
        proposed_start_date: order.proposed_start_date || null,
        start_date: order.start_date || null
    });
});

// Statut de mission unifié (frise de suivi façon Deliveroo, Phase 8) — dérivé des signaux
// déjà existants plutôt que stocké, sauf mission_status (in_progress/delivering) qui n'a
// pas d'équivalent ailleurs. request peut être null (mission créée hors flux partner_requests).
var MISSION_STATUS_META = {
    received:    { key: 'received',    label: 'Commande reçue',          emoji: '🟡' },
    accepted:    { key: 'accepted',     label: 'Commande acceptée',       emoji: '🔵' },
    in_progress: { key: 'in_progress',  label: 'En préparation',          emoji: '🟣' },
    delivering:  { key: 'delivering',   label: 'Livraison en cours',      emoji: '🟠' },
    delivered:   { key: 'delivered',    label: 'Livrables disponibles',   emoji: '🟢' },
    completed:   { key: 'completed',    label: 'Projet terminé',          emoji: '✅' },
    reviewed:    { key: 'reviewed',     label: 'Évaluation',              emoji: '⭐' }
};
function computeMissionDisplayStatus(request, dispatch, order, livrables, hasReview) {
    if (hasReview) return MISSION_STATUS_META.reviewed;
    if (order && order.balance_paid === true) return MISSION_STATUS_META.completed;
    if ((livrables || []).some(function(l) { return l.workflow_status === 'PUBLISHED'; })) {
        return MISSION_STATUS_META.delivered;
    }
    if (dispatch) {
        return dispatch.mission_status === 'delivering' ? MISSION_STATUS_META.delivering : MISSION_STATUS_META.in_progress;
    }
    if (request && (request.status === 'accepted' || request.status === 'proposed' || request.status === 'signed')) {
        return MISSION_STATUS_META.accepted;
    }
    return MISSION_STATUS_META.received;
}

/**
 * Determiner les droits d'acces selon le statut de la commande
 */
function getAccessRights(order) {
    const rights = {
        can_access_dashboard: false,
        can_view_parcours: false,
        can_view_livrables_preview: false,
        can_download_livrables: false,
        can_book_sessions: false,
        balance_required: false,
        balance_message: null,
        payment_secured: false,
        mid_delivery_paid: false
    };

    // Pas d'acompte paye = pas d'acces
    if (!order.deposit_paid) {
        rights.balance_message = 'Veuillez payer l\'acompte de 30% pour acceder a votre espace client.';
        return rights;
    }

    // Acompte paye = acces au dashboard
    rights.can_access_dashboard = true;

    // GENESIS SAFE™ : split fixe 30/40/30 sur les commandes créées après cette phase
    // (order.installments contient alors exactement 3 tranches). Les commandes plus
    // anciennes n'ont pas ces 3 tranches : on garde le comportement acompte/solde 30/70.
    var hasGenesisSplit = order.installments && order.installments.length === 3;
    var tranche2Paid = hasGenesisSplit ? !!order.installments[1].paid : false;
    var tranche3Paid = hasGenesisSplit ? !!order.installments[2].paid : !!order.balance_paid;
    rights.mid_delivery_paid = tranche2Paid;
    // "Paiement sécurisé" (cosmétique) : reste affiché tant que la tranche finale n'est pas réglée.
    rights.payment_secured = !tranche3Paid;

    if (order.product_type === 'accompagnement') {
        // CAS A: Offres d'accompagnement
        rights.can_view_parcours = true;
        rights.can_view_livrables_preview = true;
        rights.can_book_sessions = true;

        // Le telechargement est toujours possible pour les accompagnements
        // (documents journaliers, etc.)
        rights.can_download_livrables = true;

        // Si l'accompagnement est termine mais tranche finale non payee
        if (order.status === 'completed' && !tranche3Paid) {
            rights.balance_required = true;
            rights.balance_message = hasGenesisSplit
                ? 'Votre accompagnement est termine. Payez la tranche finale (30%) pour finaliser.'
                : 'Votre accompagnement est termine. Payez le solde de 70% pour finaliser.';
        }

        // Si tout est paye
        if (tranche3Paid) {
            rights.balance_message = 'Paiement complet - Acces total a tous vos contenus.';
        }

    } else if (order.product_type === 'prestation_individuelle') {
        // CAS B: Prestations individuelles (photo/video/media/marketing)
        rights.can_view_parcours = false;
        rights.can_book_sessions = false;

        // Preview toujours possible apres acompte
        rights.can_view_livrables_preview = true;

        // Telechargement uniquement si tranche finale payee
        rights.can_download_livrables = tranche3Paid;

        // Si livrables prets mais tranche finale non payee
        if (order.status === 'delivered' && !tranche3Paid) {
            rights.balance_required = true;
            rights.balance_message = hasGenesisSplit
                ? 'Vos livrables sont prêts ! Payez la tranche finale (30%) pour télécharger les fichiers originaux.'
                : 'Vos livrables sont prêts ! Payez le solde de 70% pour télécharger les fichiers originaux.';
        }

        // Si tout est paye
        if (tranche3Paid) {
            rights.balance_message = 'Paiement complet - Telechargement des fichiers originaux disponible.';
        }
    } else if (order.product_type === 'partner_service') {
        // CAS C: Prestation marketplace partenaire (GENESIS CONTRACT™ / GENESIS SAFE™)
        rights.can_view_parcours = false;
        rights.can_book_sessions = false;
        rights.can_view_livrables_preview = true;

        if (order.payment_tier === 'small') {
            // ≤ 300 € : paiement intégral retenu — accès au téléchargement dès que la livraison est confirmée
            var deliveryConfirmed = !!order.delivery_confirmed;
            rights.can_download_livrables = deliveryConfirmed;
            rights.payment_secured = !deliveryConfirmed;
            if (!deliveryConfirmed) {
                rights.balance_message = 'Paiement sécurisé par GENESIS SAFE™. Les livrables seront disponibles dès que le prestataire confirmera la livraison.';
            } else {
                rights.balance_message = 'Livraison confirmée — téléchargement disponible.';
            }
        } else {
            // > 300 € : acompte 30 % déjà versé, solde 70 % débloque le téléchargement
            rights.can_download_livrables = tranche3Paid || (order.balance_paid === true);
            if (tranche2Paid && !tranche3Paid) {
                rights.balance_message = 'Paiement partiel reçu. Payez le solde pour débloquer le téléchargement.';
            }
            if (tranche3Paid || order.balance_paid) {
                rights.balance_message = 'Paiement complet — téléchargement des fichiers disponible.';
            }
        }
    }

    return rights;
}

// ============================================================
// ROUTES - LIVRABLES
// ============================================================

const LIVRABLES_FILE = path.join(__dirname, 'data', 'livrables.json');

function loadLivrables() {
    try {
        if (fs.existsSync(LIVRABLES_FILE)) {
            const data = fs.readFileSync(LIVRABLES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Erreur lecture livrables:', error);
    }
    return [];
}

function saveLivrables(livrables) {
    try {
        fs.writeFileSync(LIVRABLES_FILE, JSON.stringify(livrables, null, 2), 'utf8');
        persistentStore.persistToCloud('livrables', livrables).catch(function(e) {});
    } catch (error) {
        console.error('Erreur sauvegarde livrables:', error);
    }
}

// ============================================================
// HELPERS - PROJETS
// ============================================================

function loadProjects() {
    try {
        if (fs.existsSync(PROJECTS_FILE)) {
            const data = fs.readFileSync(PROJECTS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Erreur lecture projects:', error);
    }
    return [];
}

function saveProjects(projects) {
    try {
        fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf8');
        persistentStore.persistToCloud('projects', projects).catch(function(e) {});
    } catch (error) {
        console.error('Erreur sauvegarde projects:', error);
    }
}

// ============================================================
// HELPERS - FEEDBACKS
// ============================================================

function loadFeedbacks() {
    try {
        if (fs.existsSync(FEEDBACKS_FILE)) {
            var data = fs.readFileSync(FEEDBACKS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Erreur lecture feedbacks:', error);
    }
    return [];
}

function saveFeedbacks(feedbacks) {
    try {
        fs.writeFileSync(FEEDBACKS_FILE, JSON.stringify(feedbacks, null, 2), 'utf8');
        persistentStore.persistToCloud('feedbacks', feedbacks).catch(function(e) {});
    } catch (error) {
        console.error('Erreur sauvegarde feedbacks:', error);
    }
}

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Erreur lecture settings:', error);
    }
    return { revenue_offset: 0 };
}

function saveSettings(settings) {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
        persistentStore.persistToCloud('settings', settings).catch(function(e) {});
    } catch (error) {
        console.error('Erreur sauvegarde settings:', error);
    }
}


function getProjectByOrderId(orderId) {
    var projects = loadProjects();
    for (var i = 0; i < projects.length; i++) {
        if (projects[i].order_id === orderId) return projects[i];
    }
    return null;
}

function getProjectById(projectId) {
    var projects = loadProjects();
    for (var i = 0; i < projects.length; i++) {
        if (projects[i].id === projectId) return projects[i];
    }
    return null;
}

// ============================================================
// HELPER - NORMALISATION LIVRABLES (compatibilite arriere)
// ============================================================

/**
 * Ajoute les nouveaux champs workflow aux livrables existants.
 * Les anciens livrables (sans ces champs) recevront des valeurs par defaut.
 */
function ensureLivrableFields(livrable) {
    if (!livrable) return livrable;

    // Champs projet
    if (!livrable.project_id) livrable.project_id = null;
    if (!livrable.offer_key) livrable.offer_key = null;
    if (!livrable.domain) livrable.domain = 'strategy';

    // Workflow
    if (!livrable.visibility) livrable.visibility = 'CLIENT_ON_PUBLISH';
    if (!livrable.workflow_status) livrable.workflow_status = 'PUBLISHED';
    if (!livrable.owner_role) livrable.owner_role = livrable.source || 'admin';
    if (!livrable.owner_partner_id) livrable.owner_partner_id = livrable.partner_id || null;
    if (livrable.requires_admin_approval === undefined) livrable.requires_admin_approval = false;
    if (livrable.requires_partner_approval === undefined) livrable.requires_partner_approval = false;

    // Contenu texte (pour docs IA)
    if (!livrable.content_text) livrable.content_text = null;

    // Versioning
    if (!livrable.versions) livrable.versions = [];

    // Jalon de paiement GENESIS SAFE™ : 'intermediaire' | 'final' | null (Phase 2)
    if (livrable.genesis_stage === undefined) livrable.genesis_stage = null;

    // Validation client (Phase 5, cosmetique : ne bloque jamais le paiement)
    if (!livrable.client_validation) livrable.client_validation = 'pending';
    if (livrable.client_validated_at === undefined) livrable.client_validated_at = null;
    if (livrable.client_revision_note === undefined) livrable.client_revision_note = null;

    return livrable;
}

/**
 * GET /api/livrables/:orderId
 * Recuperer les livrables d'une commande
 */
app.get('/api/livrables/:orderId', (req, res) => {
    const order = getOrderById(req.params.orderId);

    if (!order) {
        return res.status(404).json({ error: 'Commande non trouvee' });
    }

    // Verifier l'acces
    if (!order.deposit_paid) {
        return res.status(403).json({ error: 'Acompte requis pour acceder aux livrables' });
    }

    const allLivrables = loadLivrables();
    const orderLivrables = allLivrables.filter(l => l.order_id === req.params.orderId).map(ensureLivrableFields);

    // Ajouter l'info si le telechargement est autorise
    const accessRights = getAccessRights(order);
    const livrablesWithAccess = orderLivrables.map(l => ({
        ...l,
        can_download: accessRights.can_download_livrables,
        // Masquer l'URL de telechargement si pas autorise
        download_url: accessRights.can_download_livrables ? l.download_url : null
    }));

    res.json({
        livrables: livrablesWithAccess,
        can_download: accessRights.can_download_livrables,
        balance_required: accessRights.balance_required,
        message: accessRights.balance_message
    });
});

/**
 * POST /api/livrables/:id/validate
 * Le client valide un livrable publie. Cosmetique uniquement (Phase 5) :
 * ne bloque jamais le paiement de la tranche finale.
 */
app.post('/api/livrables/:id/validate', (req, res) => {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var livrables = loadLivrables();
        var idx = livrables.findIndex(function(l) { return l.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Livrable non trouve' });

        var livrable = ensureLivrableFields(livrables[idx]);
        var order = getOrderById(livrable.order_id);
        if (!order || !order.client_info || (order.client_info.email || '').toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'Acces non autorise' });
        }
        if (livrable.workflow_status !== 'PUBLISHED') {
            return res.status(409).json({ error: 'Ce livrable n\'est pas encore publie.' });
        }

        livrable.client_validation = 'validated';
        livrable.client_validated_at = new Date().toISOString();
        livrable.client_revision_note = null;
        livrable.updated_at = new Date().toISOString();
        livrables[idx] = livrable;
        saveLivrables(livrables);

        if (livrable.owner_partner_id) {
            var partnerForValidation = getPartnerById(livrable.owner_partner_id);
            if (partnerForValidation && partnerForValidation.email) {
                notifyUser(partnerForValidation.email, 'partner', 'livrable-valide', 'Livrable validé ✅', (order.client_info.first_name || 'Le client') + ' a validé : ' + (livrable.title || 'votre livrable'), '/app.html#open-partner');
            }
        }

        // GENESIS SAFE™ Phase 2 : si le livrable est de type intermédiaire, libérer la tranche 40%
        if ((livrable.genesis_stage || '') === 'intermediaire' && order.status === 'mid_delivery_paid') {
            checkAutoReleaseIntermediatePayouts();
            releaseIntermediatePayoutsForOrder(order.id).catch(function(e) {
                console.error('[PAYOUT] Erreur libération tranche intermédiaire sur validation:', e);
            });
        }

        res.json({ success: true, livrable: livrable });
    } catch (err) {
        console.error('[API] Erreur validate livrable:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/livrables/:id/request-revision
 * Le client demande une revision sur un livrable publie. Cosmetique uniquement (Phase 5).
 */
app.post('/api/livrables/:id/request-revision', (req, res) => {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var note = (req.body.note || '').trim();
        if (note.length < 5) return res.status(400).json({ error: 'Merci de preciser votre demande de revision (5 caracteres minimum).' });

        var livrables = loadLivrables();
        var idx = livrables.findIndex(function(l) { return l.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Livrable non trouve' });

        var livrable = ensureLivrableFields(livrables[idx]);
        var order = getOrderById(livrable.order_id);
        if (!order || !order.client_info || (order.client_info.email || '').toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'Acces non autorise' });
        }
        if (livrable.workflow_status !== 'PUBLISHED') {
            return res.status(409).json({ error: 'Ce livrable n\'est pas encore publie.' });
        }

        livrable.workflow_status = 'REVISION_REQUESTED';
        livrable.client_validation = 'revision_requested';
        livrable.client_revision_note = note;
        livrable.updated_at = new Date().toISOString();
        if (!livrable.versions) livrable.versions = [];
        livrable.versions.push({
            version_number: livrable.versions.length + 1,
            updated_by_role: 'client',
            updated_by_id: user.email,
            content_text: null,
            file_url: null,
            change_note: 'Revision demandee par le client: ' + note,
            created_at: new Date().toISOString()
        });
        livrables[idx] = livrable;
        saveLivrables(livrables);

        if (livrable.owner_partner_id) {
            var partnerForRevision = getPartnerById(livrable.owner_partner_id);
            if (partnerForRevision && partnerForRevision.email) {
                notifyUser(partnerForRevision.email, 'partner', 'livrable-revision', 'Révision demandée ✏️', (order.client_info.first_name || 'Le client') + ' demande une revision sur : ' + (livrable.title || 'votre livrable'), '/app.html#open-partner');
            }
        }

        res.json({ success: true, livrable: livrable });
    } catch (err) {
        console.error('[API] Erreur request-revision livrable:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/livrables/add (Admin)
 * Ajouter un livrable a une commande
 */
app.post('/api/livrables/add', (req, res) => {
    try {
        const { orderId, name, type, preview_url, download_url, description, day_number, client_email } = req.body;

        if (!orderId || !name || !type) {
            return res.status(400).json({ error: 'orderId, name et type requis' });
        }

        const order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvee' });
        }

        const livrable = {
            id: `LIV-${uuidv4().split('-')[0].toUpperCase()}`,
            order_id: orderId,
            client_email: client_email || (order.client_info ? order.client_info.email : null),
            name: name,
            type: type, // 'photo', 'video', 'document', 'audio'
            day_number: day_number || null, // Numero de jour pour les accompagnements
            preview_url: preview_url || null,
            download_url: download_url || null,
            description: description || null,
            status: 'ready', // 'pending', 'ready', 'delivered'
            created_at: new Date().toISOString()
        };

        const livrables = loadLivrables();
        livrables.push(livrable);
        saveLivrables(livrables);

        console.log(`[LIVRABLE] Ajoute: ${livrable.id} pour commande ${orderId}`);

        res.json({ success: true, livrable: livrable });

    } catch (error) {
        console.error('Erreur ajout livrable:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du livrable' });
    }
});

/**
 * PUT /api/livrables/:livrableId/status (Admin)
 * Mettre a jour le statut d'un livrable
 */
app.put('/api/livrables/:livrableId/status', (req, res) => {
    try {
        const { status } = req.body;
        const { livrableId } = req.params;

        if (!['pending', 'ready', 'delivered'].includes(status)) {
            return res.status(400).json({ error: 'Statut invalide' });
        }

        const livrables = loadLivrables();
        const index = livrables.findIndex(l => l.id === livrableId);

        if (index === -1) {
            return res.status(404).json({ error: 'Livrable non trouve' });
        }

        livrables[index].status = status;
        livrables[index].updated_at = new Date().toISOString();
        saveLivrables(livrables);

        res.json({ success: true, livrable: livrables[index] });

    } catch (error) {
        console.error('Erreur mise a jour livrable:', error);
        res.status(500).json({ error: 'Erreur lors de la mise a jour' });
    }
});

/**
 * GET /api/download/:orderId/:livrableId
 * Endpoint protege pour telecharger un livrable
 * Verifie que le solde est paye avant d'autoriser
 */
app.get('/api/download/:orderId/:livrableId', (req, res) => {
    try {
        const { orderId, livrableId } = req.params;

        const order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvee' });
        }

        // SECURITE: Verifier que le solde est paye pour les prestations individuelles
        if (order.product_type === 'prestation_individuelle' && !order.balance_paid) {
            return res.status(403).json({
                error: 'Paiement du solde requis',
                message: 'Veuillez payer le solde de 70% pour télécharger vos fichiers.'
            });
        }

        // Recuperer le livrable
        const livrables = loadLivrables();
        const livrable = livrables.find(l => l.id === livrableId && l.order_id === orderId);

        if (!livrable) {
            return res.status(404).json({ error: 'Livrable non trouve' });
        }

        // En production, ici on servirait le fichier depuis un stockage securise
        // Pour l'instant, on renvoie l'URL de telechargement
        if (livrable.download_url) {
            console.log(`[DOWNLOAD] Autorise: ${livrableId} pour commande ${orderId}`);
            res.json({
                success: true,
                download_url: livrable.download_url,
                filename: livrable.name
            });
        } else {
            res.status(404).json({ error: 'Fichier non disponible' });
        }

    } catch (error) {
        console.error('Erreur telechargement:', error);
        res.status(500).json({ error: 'Erreur lors du telechargement' });
    }
});

// ============================================================
// ROUTES - LIVRABLES ADMIN (JOUR PAR JOUR)
// ============================================================

/**
 * GET /api/livrables/by-email/:email
 * Recuperer tous les livrables d'un client par email
 */
app.get('/api/livrables/by-email/:email', (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email).toLowerCase();
        const orders = loadOrders();
        const clientOrders = orders.filter(o =>
            o.client_info && o.client_info.email.toLowerCase() === email
        );

        if (clientOrders.length === 0) {
            return res.json({ livrables: [], byDay: {} });
        }

        const allLivrables = loadLivrables();
        const orderIds = clientOrders.map(o => o.id);
        const clientLivrables = allLivrables.filter(l =>
            orderIds.includes(l.order_id) || (l.client_email && l.client_email.toLowerCase() === email)
        );

        // Grouper par jour
        const byDay = {};
        clientLivrables.forEach(l => {
            const day = l.day_number || 0;
            if (!byDay[day]) byDay[day] = [];
            byDay[day].push(l);
        });

        res.json({ livrables: clientLivrables, byDay: byDay });
    } catch (error) {
        console.error('Erreur livrables by email:', error);
        res.status(500).json({ error: 'Erreur lors de la recuperation des livrables' });
    }
});

/**
 * POST /api/admin/livrables/upload
 * Ajouter un livrable depuis l'admin (avec numero de jour)
 */
app.post('/api/admin/livrables/upload', (req, res) => {
    try {
        const { orderId, clientEmail, dayNumber, name, type, description, download_url } = req.body;

        if (!clientEmail || !name) {
            return res.status(400).json({ error: 'clientEmail et name requis' });
        }

        // Trouver la commande du client si orderId non fourni
        let resolvedOrderId = orderId;
        if (!resolvedOrderId) {
            const orders = loadOrders();
            const clientOrder = orders.find(o =>
                o.client_info && o.client_info.email.toLowerCase() === clientEmail.toLowerCase() && o.deposit_paid
            );
            if (clientOrder) {
                resolvedOrderId = clientOrder.id;
            }
        }

        const livrable = {
            id: `LIV-${uuidv4().split('-')[0].toUpperCase()}`,
            order_id: resolvedOrderId || null,
            client_email: clientEmail.toLowerCase(),
            name: name,
            type: type || 'document',
            day_number: dayNumber ? parseInt(dayNumber) : null,
            download_url: download_url || null,
            description: description || null,
            status: 'ready',
            created_at: new Date().toISOString()
        };

        const livrables = loadLivrables();
        livrables.push(livrable);
        saveLivrables(livrables);

        console.log(`[LIVRABLE-ADMIN] Ajouté: ${livrable.id} pour ${clientEmail} - Jour ${dayNumber || 'N/A'}`);

        // Envoyer une notification email au client
        if (resolvedOrderId) {
            const order = getOrderById(resolvedOrderId);
            if (order && order.client_info) {
                const clientName = order.client_info.first_name || '';
                const offerName = order.product_name || '';
                emailService.sendNewDocumentNotification(
                    clientEmail,
                    clientName,
                    name,
                    dayNumber,
                    offerName
                ).then(result => {
                    if (result.success) {
                        console.log(`[LIVRABLE-ADMIN] Email de notification envoyé à ${clientEmail}`);
                    }
                }).catch(err => console.error('[LIVRABLE-ADMIN] Erreur envoi notification:', err));
            }
        }

        res.json({ success: true, livrable: livrable });

    } catch (error) {
        console.error('Erreur upload livrable admin:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du livrable' });
    }
});

/**
 * DELETE /api/admin/livrables/:livrableId
 * Supprimer un livrable
 */
app.delete('/api/admin/livrables/:livrableId', (req, res) => {
    try {
        const { livrableId } = req.params;
        const livrables = loadLivrables();
        const index = livrables.findIndex(l => l.id === livrableId);

        if (index === -1) {
            return res.status(404).json({ error: 'Livrable non trouvé' });
        }

        livrables.splice(index, 1);
        saveLivrables(livrables);

        console.log(`[LIVRABLE-ADMIN] Supprimé: ${livrableId}`);
        res.json({ success: true });

    } catch (error) {
        console.error('Erreur suppression livrable:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

/**
 * POST /api/admin/start-accompaniment/:orderId
 * Définir manuellement la date de début d'un accompagnement
 */
app.post('/api/admin/start-accompaniment/:orderId', (req, res) => {
    try {
        const order = getOrderById(req.params.orderId);
        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvée' });
        }

        const startDate = req.body.startDate || new Date().toISOString();
        const updatedOrder = updateOrder(req.params.orderId, { start_date: startDate });

        console.log(`[ADMIN] Date de début définie pour ${req.params.orderId}: ${startDate}`);
        res.json({ success: true, order: updatedOrder });

    } catch (error) {
        console.error('Erreur start-accompaniment:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
});

// ============================================================
// ROUTES - PLANIFICATION DATE DE DEBUT (SCHEDULING)
// ============================================================

/**
 * Verifie si un partenaire est assigne a une commande
 */
function hasAssignedPartner(orderId) {
    var assignments = loadPartnerAssignments();
    return assignments.some(function(a) {
        return a.order_id === orderId && a.status === 'active';
    });
}

/**
 * Finalise la planification apres confirmation admin + partenaire
 * Cree le projet (accompagnement) ou une session (prestation)
 */
function finalizeSchedule(order) {
    try {
        // 1. Mettre a jour start_date et schedule_status
        var updatedOrder = updateOrder(order.id, {
            start_date: order.proposed_start_date,
            schedule_status: 'confirmed'
        });

        // Email + push de confirmation au client
        try {
            if (updatedOrder.client_info && updatedOrder.client_info.email) {
                var confirmClientName = ((updatedOrder.client_info.first_name || '') + ' ' + (updatedOrder.client_info.last_name || '')).trim() || updatedOrder.client_info.email;
                var confirmOrderName = updatedOrder.product_name || updatedOrder.product_id || 'votre commande';
                emailService.sendScheduleConfirmedToClient(updatedOrder.client_info.email, confirmClientName, updatedOrder.start_date, confirmOrderName);
                var dateStr = updatedOrder.start_date ? new Date(updatedOrder.start_date).toLocaleDateString('fr-FR') : '';
                notifyUser(updatedOrder.client_info.email, 'client', 'rdv', 'Rendez-vous confirmé 📅', confirmOrderName + (dateStr ? ' — ' + dateStr : '') + ' est confirmé !', '/app.html');
            }
        } catch (emailErr) {
            console.error('[SCHEDULE] Erreur email confirmation date client:', emailErr.message);
        }

        var product = getProductById(updatedOrder.product_id);
        console.log('[SCHEDULE] Finalisation pour ' + updatedOrder.id + ' - type: ' + (product ? product.product_type : 'inconnu'));

        // 2. Si accompagnement → bootstrap projet + livrables
        if (product && product.product_type === 'accompagnement') {
            var bootstrapUser = {
                email: updatedOrder.client_info.email,
                firstName: updatedOrder.client_info.first_name,
                lastName: updatedOrder.client_info.last_name,
                id: updatedOrder.client_info.email
            };
            var result = bootstrapService.bootstrapProject(updatedOrder, bootstrapUser);
            if (result.success) {
                console.log('[SCHEDULE] Projet bootstrap: ' + result.project.id + ' (' + result.deliverables.length + ' livrables)');
            } else {
                console.log('[SCHEDULE] Bootstrap non effectue: ' + (result.error || 'raison inconnue'));
            }
        }

        // 3. Si prestation individuelle → creer session REQUESTED
        if (product && product.product_type === 'prestation_individuelle') {
            var assignments = loadPartnerAssignments();
            var assignment = assignments.find(function(a) {
                return a.order_id === updatedOrder.id && a.status === 'active';
            });

            if (assignment) {
                // Deduire le type de session depuis le product_id
                var prefix = (updatedOrder.product_id || '').split('-')[0];
                var sessionTypeMap = { 'photo': 'shooting', 'video': 'shooting', 'marketing': 'meeting', 'media': 'meeting' };
                var sessionType = sessionTypeMap[prefix] || 'meeting';

                var partners = loadPartners();
                var assignedPartner = partners.find(function(p) { return p.id === assignment.partner_id; });

                var sessions = loadSessions();
                var newSession = {
                    id: 'SES-' + uuidv4().split('-')[0].toUpperCase(),
                    project_id: null,
                    client_id: updatedOrder.client_info.email.toLowerCase(),
                    client_name: (updatedOrder.client_info.first_name + ' ' + updatedOrder.client_info.last_name).trim(),
                    partner_id: assignment.partner_id,
                    partner_name: assignedPartner ? (assignedPartner.firstName + ' ' + assignedPartner.lastName).trim() : null,
                    partner_role: assignment.partner_type || null,
                    session_type: sessionType,
                    datetime_start: updatedOrder.proposed_start_date + 'T10:00:00.000Z',
                    duration_minutes: 60,
                    meet_url: null,
                    location: null,
                    status: 'REQUESTED',
                    notes_client: 'Seance auto-creee depuis la planification de la prestation',
                    notes_partner: '',
                    proposed_slots: [updatedOrder.proposed_start_date + 'T10:00:00.000Z'],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                sessions.push(newSession);
                saveSessions(sessions);
                console.log('[SCHEDULE] Session creee: ' + newSession.id + ' pour partenaire ' + assignment.partner_id);
            } else {
                console.log('[SCHEDULE] Aucun partenaire assigne - pas de session creee');
            }
        }

        return updatedOrder;
    } catch (err) {
        console.error('[SCHEDULE] Erreur finalisation:', err.message);
        return null;
    }
}

/**
 * POST /api/orders/:orderId/schedule-start
 * Client propose une date de debut pour son accompagnement/prestation
 */
app.post('/api/orders/:orderId/schedule-start', function(req, res) {
    try {
        // Authentifier le client
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var users = loadUsers();
        var user = findUserByToken(token);
        if (!user) return res.status(401).json({ error: 'Session invalide' });

        var order = getOrderById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Commande non trouvee' });

        // Verifier que la commande appartient au client
        if (!order.client_info || order.client_info.email.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'Acces refuse' });
        }

        if (!order.deposit_paid) return res.status(400).json({ error: 'Acompte non paye' });
        if (order.start_date && order.schedule_status === 'confirmed') {
            return res.status(400).json({ error: 'Date de debut deja confirmee' });
        }

        var proposedDate = req.body.proposed_date;
        if (!proposedDate) return res.status(400).json({ error: 'Date requise (proposed_date)' });

        // Valider la date : minimum J+1
        var dateObj = new Date(proposedDate + 'T00:00:00');
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        if (isNaN(dateObj.getTime())) return res.status(400).json({ error: 'Date invalide' });
        if (dateObj < tomorrow) return res.status(400).json({ error: 'La date doit etre au minimum demain (J+1)' });

        var kickoffRole = req.body.kickoff_provider_role || 'admin';

        var updates = {
            proposed_start_date: proposedDate,
            kickoff_provider_role: kickoffRole,
            schedule_status: 'client_proposed',
            schedule_confirmed_by_admin: false,
            schedule_confirmed_by_partner: false
        };

        var updatedOrder = updateOrder(req.params.orderId, updates);
        console.log('[SCHEDULE] Client ' + user.email + ' propose date: ' + proposedDate + ' (provider: ' + kickoffRole + ') pour ' + req.params.orderId);

        // Notifier l'admin par email
        try {
            var clientDisplayName = ((order.client_info.first_name || '') + ' ' + (order.client_info.last_name || '')).trim() || user.email;
            var orderDisplayName = order.product_name || order.product_id || 'Commande ' + order.id;
            var adminEmailAddr = process.env.ADMIN_EMAIL || 'contact@fagenesis.com';
            emailService.sendScheduleProposedNotification(adminEmailAddr, clientDisplayName, proposedDate, orderDisplayName);
            // Si l'intervenant est un partenaire, notifier aussi le partenaire assigne
            if (kickoffRole !== 'admin') {
                var partnerAssignments = loadPartnerAssignments();
                var partnerAssignment = partnerAssignments.find(function(a) { return a.order_id === req.params.orderId && a.status === 'active'; });
                if (partnerAssignment) {
                    var allPartners = loadPartners();
                    var assignedPartner = allPartners.find(function(p) { return p.id === partnerAssignment.partner_id; });
                    if (assignedPartner && assignedPartner.email) {
                        emailService.sendScheduleProposedNotification(assignedPartner.email, clientDisplayName, proposedDate, orderDisplayName);
                    }
                }
            }
        } catch (emailErr) {
            console.error('[SCHEDULE] Erreur envoi email notification planning:', emailErr.message);
        }

        res.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error('[SCHEDULE] Erreur schedule-start:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/admin/pending-schedules
 * Liste des commandes en attente de confirmation de date
 */
app.get('/api/admin/pending-schedules', function(req, res) {
    try {
        var orders = loadOrders();
        var pending = orders.filter(function(o) {
            return o.schedule_status === 'client_proposed' || o.schedule_status === 'reproposed';
        }).map(function(o) {
            // requires_admin_action = vrai seulement si l'intervenant choisi est l'admin
            var role = o.kickoff_provider_role || 'admin';
            return Object.assign({}, o, { requires_admin_action: role === 'admin' });
        });
        res.json({ orders: pending });
    } catch (error) {
        console.error('[SCHEDULE] Erreur pending-schedules:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/confirm-schedule/:orderId
 * Admin confirme la date proposee par le client
 */
app.post('/api/admin/confirm-schedule/:orderId', function(req, res) {
    try {
        var order = getOrderById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Commande non trouvee' });
        if (order.schedule_status !== 'client_proposed') {
            return res.status(400).json({ error: 'Pas de date proposee a confirmer' });
        }

        // Bloquer si la demande est destinee a un partenaire (pas a l'admin)
        var kickoffRole = order.kickoff_provider_role || 'admin';
        var roleLabels = { photographer: 'Photographe', videographer: 'Vidéaste', marketer: 'Consultant Marketing', media: 'Spécialiste Média' };
        if (kickoffRole !== 'admin') {
            return res.status(400).json({
                error: 'Cette demande est destinée au ' + (roleLabels[kickoffRole] || kickoffRole) + '. Seul ce partenaire peut la confirmer.'
            });
        }

        // Rôle admin : finaliser directement, sans attendre le partenaire
        var updatedOrder = updateOrder(req.params.orderId, { schedule_confirmed_by_admin: true });
        console.log('[SCHEDULE] Admin confirme date pour ' + req.params.orderId + ' (finalisation directe)');
        updatedOrder = finalizeSchedule(updatedOrder);

        res.json({ success: true, order: updatedOrder, finalized: true });
    } catch (error) {
        console.error('[SCHEDULE] Erreur confirm-schedule admin:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/reschedule-start/:orderId
 * Admin contre-propose une date differente au client
 */
app.post('/api/admin/reschedule-start/:orderId', function(req, res) {
    try {
        var order = getOrderById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Commande non trouvee' });
        if (order.schedule_status !== 'client_proposed') {
            return res.status(400).json({ error: 'Pas de date proposee a contre-proposer' });
        }

        // Bloquer si la demande est destinee a un partenaire
        var kickoffRoleR = order.kickoff_provider_role || 'admin';
        if (kickoffRoleR !== 'admin') {
            return res.status(400).json({ error: 'Cette demande est destinée au partenaire, pas à l\'administrateur.' });
        }

        var reproposedDate = req.body.reproposed_date;
        var reproposedMessage = req.body.message || '';
        if (!reproposedDate) return res.status(400).json({ error: 'reproposed_date requis' });

        var updatedOrder = updateOrder(req.params.orderId, {
            schedule_status: 'reproposed',
            reproposed_date: reproposedDate,
            reproposed_by: 'admin',
            repropose_message: reproposedMessage,
            schedule_confirmed_by_admin: false,
            schedule_confirmed_by_partner: false
        });

        console.log('[SCHEDULE] Admin contre-propose date ' + reproposedDate + ' pour ' + req.params.orderId);

        // Email au client
        try {
            if (order.client_info && order.client_info.email) {
                var rClientName = ((order.client_info.first_name || '') + ' ' + (order.client_info.last_name || '')).trim() || order.client_info.email;
                var rOrderName = order.product_name || order.product_id || 'votre commande';
                emailService.sendScheduleReproposedToClient(order.client_info.email, rClientName, reproposedDate, reproposedMessage, rOrderName);
            }
        } catch (emailErr) {
            console.error('[SCHEDULE] Erreur email contre-proposition admin:', emailErr.message);
        }

        res.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error('[SCHEDULE] Erreur reschedule-start admin:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/partner/pending-schedules
 * Liste des commandes en attente de confirmation par ce partenaire.
 *
 * Logique :
 *  - Le rôle (kickoff_provider_role) doit correspondre au partner_type du partenaire
 *  - Si le partenaire est explicitement assigné à la commande → il voit toujours
 *  - Sinon, si aucun autre partenaire du même type n'est assigné → il voit aussi
 *    (permet aux partenaires de voir les propositions sans assignment préalable)
 */
app.get('/api/partner/pending-schedules', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var orders = loadOrders();
        var allAssignments = loadPartnerAssignments();
        var allPartners = loadPartners();
        var pending = [];

        for (var i = 0; i < orders.length; i++) {
            var order = orders[i];

            // Uniquement les commandes avec une proposition en attente
            if (order.schedule_status !== 'client_proposed' && order.schedule_status !== 'reproposed') continue;

            // Le rôle du kickoff doit correspondre au type de ce partenaire
            var orderRole = order.kickoff_provider_role || 'admin';
            if (orderRole !== partner.partner_type) continue;

            // Chercher les assignments actifs sur cette commande pour ce type de rôle
            var orderAssignments = allAssignments.filter(function(a) {
                return a.order_id === order.id && a.status === 'active';
            });

            // Parmi ces assignments, trouver ceux du même type que le partenaire
            // (en vérifiant partner_type sur l'assignment OU en cherchant dans partners.json)
            var sameTypeAssignments = orderAssignments.filter(function(a) {
                if (a.partner_type) return a.partner_type === partner.partner_type;
                var p = allPartners.find(function(pt) { return pt.id === a.partner_id; });
                return p && p.partner_type === partner.partner_type;
            });

            if (sameTypeAssignments.length === 0) {
                // Aucun partenaire de ce type assigné → la commande est visible par tous
                // les partenaires actifs de ce type
                pending.push(order);
            } else {
                // Un partenaire de ce type est déjà assigné → montrer seulement à lui
                var isMe = sameTypeAssignments.some(function(a) { return a.partner_id === partner.id; });
                if (isMe) pending.push(order);
            }
        }

        res.json({ orders: pending });
    } catch (error) {
        console.error('[SCHEDULE] Erreur partner pending-schedules:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/partner/reschedule-start/:orderId
 * Partenaire contre-propose une date differente au client
 */
app.post('/api/partner/reschedule-start/:orderId', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var order = getOrderById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Commande non trouvee' });
        if (order.schedule_status !== 'client_proposed' && order.schedule_status !== 'reproposed') {
            return res.status(400).json({ error: 'Pas de date proposee a contre-proposer' });
        }

        // Verifier que le partenaire est habilite (meme logique que pending-schedules)
        var pKickoffRole = order.kickoff_provider_role || 'admin';
        if (pKickoffRole !== partner.partner_type) {
            return res.status(403).json({ error: 'Cette demande n\'est pas destinée à votre rôle.' });
        }

        var pAllAssignments = loadPartnerAssignments();
        var pAllPartners = loadPartners();
        var pOrderAssignments = pAllAssignments.filter(function(a) {
            return a.order_id === order.id && a.status === 'active';
        });
        var pSameTypeAssignments = pOrderAssignments.filter(function(a) {
            if (a.partner_type) return a.partner_type === partner.partner_type;
            var p = pAllPartners.find(function(pt) { return pt.id === a.partner_id; });
            return p && p.partner_type === partner.partner_type;
        });
        var pCanAct = pSameTypeAssignments.length === 0 ||
                      pSameTypeAssignments.some(function(a) { return a.partner_id === partner.id; });
        if (!pCanAct) {
            return res.status(403).json({ error: 'Un autre partenaire est deja assigne a cette commande' });
        }

        var reproposedDate = req.body.reproposed_date;
        var reproposedMessage = req.body.message || '';
        if (!reproposedDate) return res.status(400).json({ error: 'reproposed_date requis' });

        var updatedOrder = updateOrder(req.params.orderId, {
            schedule_status: 'reproposed',
            reproposed_date: reproposedDate,
            reproposed_by: 'partner',
            repropose_message: reproposedMessage,
            schedule_confirmed_by_admin: false,
            schedule_confirmed_by_partner: false
        });

        console.log('[SCHEDULE] Partenaire ' + partner.email + ' contre-propose date ' + reproposedDate + ' pour ' + req.params.orderId);

        // Email au client
        try {
            if (order.client_info && order.client_info.email) {
                var rpClientName = ((order.client_info.first_name || '') + ' ' + (order.client_info.last_name || '')).trim() || order.client_info.email;
                var rpOrderName = order.product_name || order.product_id || 'votre commande';
                emailService.sendScheduleReproposedToClient(order.client_info.email, rpClientName, reproposedDate, reproposedMessage, rpOrderName);
            }
        } catch (emailErr) {
            console.error('[SCHEDULE] Erreur email contre-proposition partenaire:', emailErr.message);
        }

        res.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error('[SCHEDULE] Erreur reschedule-start partenaire:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/partner/confirm-schedule/:orderId
 * Partenaire confirme la date proposee par le client
 */
app.post('/api/partner/confirm-schedule/:orderId', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var order = getOrderById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Commande non trouvee' });
        if (order.schedule_status !== 'client_proposed' && order.schedule_status !== 'reproposed') {
            return res.status(400).json({ error: 'Pas de date proposee a confirmer' });
        }

        // Verifier que le partenaire est habilite a confirmer cette commande.
        // Logique identique a GET /api/partner/pending-schedules :
        //   - son partner_type doit correspondre au kickoff_provider_role de la commande
        //   - ET soit il est explicitement assigne, soit aucun autre partenaire du meme type ne l'est
        var partnerKickoffRole = order.kickoff_provider_role || 'admin';
        var partnerIsKickoff = (partnerKickoffRole === partner.partner_type);

        if (!partnerIsKickoff) {
            return res.status(403).json({ error: 'Vous n\'etes pas l\'intervenant designe pour cette commande' });
        }

        var allAssignments = loadPartnerAssignments();
        var allPartners = loadPartners();

        var orderAssignments = allAssignments.filter(function(a) {
            return a.order_id === order.id && a.status === 'active';
        });
        var sameTypeAssignments = orderAssignments.filter(function(a) {
            if (a.partner_type) return a.partner_type === partner.partner_type;
            var p = allPartners.find(function(pt) { return pt.id === a.partner_id; });
            return p && p.partner_type === partner.partner_type;
        });

        var canConfirm = sameTypeAssignments.length === 0 ||
                         sameTypeAssignments.some(function(a) { return a.partner_id === partner.id; });

        if (!canConfirm) {
            return res.status(403).json({ error: 'Un autre partenaire est deja assigne a cette commande' });
        }

        // Le partenaire kickoff finalise directement (sans attendre l'admin)
        var updatedOrder = updateOrder(req.params.orderId, { schedule_confirmed_by_partner: true });
        console.log('[SCHEDULE] Partenaire ' + partner.email + ' confirme date pour ' + req.params.orderId);

        updatedOrder = finalizeSchedule(updatedOrder);

        res.json({ success: true, order: updatedOrder, finalized: true });
    } catch (error) {
        console.error('[SCHEDULE] Erreur confirm-schedule partenaire:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/orders/:orderId/accept-reschedule
 * Client accepte la contre-proposition de date de l'admin ou du partenaire
 */
app.post('/api/orders/:orderId/accept-reschedule', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var users = loadUsers();
        var user = findUserByToken(token);
        if (!user) return res.status(401).json({ error: 'Session invalide' });

        var order = getOrderById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Commande non trouvee' });

        // Verifier que la commande appartient au client
        if (!order.client_info || order.client_info.email.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'Acces refuse' });
        }

        if (order.schedule_status !== 'reproposed') {
            return res.status(400).json({ error: 'Pas de contre-proposition a accepter' });
        }

        // Accepter la contre-proposition : copier reproposed_date -> proposed_start_date
        var updatedOrder = updateOrder(req.params.orderId, {
            proposed_start_date: order.reproposed_date,
            schedule_status: 'client_proposed',
            schedule_confirmed_by_admin: false,
            schedule_confirmed_by_partner: false
        });

        console.log('[SCHEDULE] Client ' + user.email + ' accepte contre-proposition date ' + order.reproposed_date + ' pour ' + req.params.orderId);

        // La date est acceptee par le client : finaliser directement
        updatedOrder = finalizeSchedule(updatedOrder);

        res.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error('[SCHEDULE] Erreur accept-reschedule:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// ROUTES - ADMIN (UTILISATEURS & STATISTIQUES)
// ============================================================

/**
 * GET /api/admin/users
 * Recuperer tous les utilisateurs inscrits (Admin)
 */
app.get('/api/admin/users', function(req, res) {
    try {
        var users = loadUsers();
        var safeUsers = users.map(function(u) {
            var rest = Object.assign({}, u);
            delete rest.password;
            return rest;
        });
        safeUsers.sort(function(a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
        res.json(safeUsers);
    } catch (e) {
        console.error('[ADMIN] Erreur GET /api/admin/users:', e);
        res.status(500).json({ error: 'Erreur serveur', detail: e.message });
    }
});

/**
 * GET /api/admin/users/:email
 * Recuperer un utilisateur specifique (Admin)
 */
app.get('/api/admin/users/:email', function(req, res) {
    try {
        var user = getUserByEmail(decodeURIComponent(req.params.email));
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouve' });
        var userWithoutPassword = Object.assign({}, user);
        delete userWithoutPassword.password;
        res.json(userWithoutPassword);
    } catch (e) {
        console.error('[ADMIN] Erreur GET /api/admin/users/:email:', e);
        res.status(500).json({ error: 'Erreur serveur', detail: e.message });
    }
});

/**
 * DELETE /api/admin/users/:email
 * Supprimer un utilisateur (Admin)
 */
app.delete('/api/admin/users/:email', function(req, res) {
    try {
        var emailToDelete = decodeURIComponent(req.params.email).toLowerCase();
        var users = loadUsers();
        var index = -1;
        for (var i = 0; i < users.length; i++) {
            if (users[i].email && users[i].email.toLowerCase() === emailToDelete) {
                index = i;
                break;
            }
        }
        if (index === -1) {
            return res.status(404).json({ error: 'Utilisateur non trouve' });
        }
        var deleted = users.splice(index, 1)[0];
        saveUsers(users);
        console.log('[ADMIN] Utilisateur supprime: ' + emailToDelete);
        res.json({ success: true, deleted_email: emailToDelete });
    } catch (err) {
        console.error('[ADMIN] Erreur suppression utilisateur:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/admin/stats
 * Statistiques globales du dashboard admin
 */
app.get('/api/admin/stats', function(req, res) {
    try {
        var users = loadUsers();
        var orders = loadOrders();
        var messages = loadMessages();
        var settings = loadSettings();
        var partners = loadPartners();

        var grossRevenue = orders.reduce(function(sum, o) {
            var revenue = 0;
            if (o.deposit_paid) revenue += (o.deposit_amount || 0);
            if (o.balance_paid) revenue += (o.balance_amount || 0);
            return sum + revenue;
        }, 0);

        var totalRevenue = Math.max(0, grossRevenue - (settings.revenue_offset || 0));

        res.json({
            totalClients: users.length,
            registered: users.filter(function(u) { return u.paymentStatus === 'registered'; }).length,
            depositPaid: users.filter(function(u) { return u.paymentStatus === 'deposit_paid'; }).length,
            fullyPaid: users.filter(function(u) { return u.paymentStatus === 'fully_paid'; }).length,
            totalOrders: orders.length,
            totalRevenue: totalRevenue,
            unreadMessages: messages.filter(function(m) { return m.status === 'unread'; }).length,
            totalMessages: messages.length,
            totalPartners: partners.length
        });
    } catch (e) {
        console.error('[ADMIN] Erreur GET /api/admin/stats:', e);
        res.status(500).json({ error: 'Erreur serveur', detail: e.message });
    }
});

/**
 * POST /api/admin/reset-revenue
 * Réinitialise le compteur de revenu total (stocke un offset = total actuel)
 */
app.post('/api/admin/reset-revenue', function(req, res) {
    try {
        var orders = loadOrders();
        var settings = loadSettings();

        var grossRevenue = orders.reduce(function(sum, o) {
            var revenue = 0;
            if (o.deposit_paid) revenue += (o.deposit_amount || 0);
            if (o.balance_paid) revenue += (o.balance_amount || 0);
            return sum + revenue;
        }, 0);

        settings.revenue_offset = grossRevenue;
        settings.revenue_reset_at = new Date().toISOString();
        saveSettings(settings);

        console.log('Revenu total réinitialisé. Offset:', grossRevenue);
        res.json({ success: true, revenue_offset: grossRevenue, reset_at: settings.revenue_reset_at });
    } catch (e) {
        console.error('[ADMIN] Erreur POST /api/admin/reset-revenue:', e);
        res.status(500).json({ error: 'Erreur serveur', detail: e.message });
    }
});

// ============================================================
// ROUTES - MESSAGES DE CONTACT
// ============================================================

const MESSAGES_FILE = path.join(__dirname, 'data', 'messages.json');

function loadMessages() {
    try {
        if (fs.existsSync(MESSAGES_FILE)) {
            const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Erreur lecture messages:', error);
    }
    return [];
}

function saveMessages(messages) {
    try {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
    } catch (error) {
        console.error('Erreur sauvegarde messages:', error);
    }
    persistentStore.persistToCloud('messages', messages).catch(function(e) {});
}

// Memoire de Jeremie (IA conversationnelle) : historique de messages par personne
// ({ [personId]: { messages: [{role, content, date}], updatedAt } }), cle = userId client ou partnerId.
function loadJeremieMemory() {
    try {
        if (fs.existsSync(JEREMIE_MEMORY_FILE)) {
            return JSON.parse(fs.readFileSync(JEREMIE_MEMORY_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Erreur lecture jeremie_memory:', error);
    }
    return {};
}

function saveJeremieMemory(memory) {
    try {
        fs.writeFileSync(JEREMIE_MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf8');
    } catch (error) {
        console.error('Erreur sauvegarde jeremie_memory:', error);
    }
}

/**
 * POST /api/contact
 * Recevoir un message du formulaire de contact
 * - Enregistre le message dans l'espace admin
 * - Envoie un email de confirmation au client
 * - Envoie une notification a l'admin
 */
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, profil, subject, message, service_type, client_budget } = req.body;

        // Validation
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                error: 'Champs requis manquants',
                required: ['name', 'email', 'subject', 'message']
            });
        }

        // Validation email basique
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Format d\'email invalide' });
        }

        // Anti-spam : champ honeypot
        if (req.body._hp && req.body._hp.trim() !== '') {
            console.log('[SPAM] Contact bloque (honeypot): ' + email);
            return res.status(400).json({ error: 'Formulaire invalide.' });
        }

        // Anti-spam : rate limiting (max 5 messages par IP par heure)
        var contactClientIp = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        if (!checkRateLimit(contactClientIp, 'contact', 5, 3600000)) {
            console.log('[SPAM] Contact bloque (rate limit): ' + contactClientIp);
            return res.status(429).json({ error: 'Trop de messages envoyes. Veuillez reessayer dans 1 heure.' });
        }

        // Anti-spam : validation du nom
        if (isSpamName(name)) {
            console.log('[SPAM] Contact bloque (nom suspect): ' + name + ' <' + email + '>');
            return res.status(400).json({ error: 'Veuillez entrer votre vrai nom.' });
        }

        // Anti-spam : timing minimum
        if (req.body._ft) {
            var contactFormTime = parseInt(req.body._ft, 10);
            var contactFormElapsed = Date.now() - contactFormTime;
            // elapsed < 0 = horloge du client en avance (frequent sur mobile mal synchronise) : pas du spam, on ignore le check
            if (!isNaN(contactFormElapsed) && contactFormElapsed >= 0 && contactFormElapsed < 3000) {
                console.log('[SPAM] Contact bloque (soumission trop rapide): ' + email);
                return res.status(400).json({ error: 'Formulaire soumis trop rapidement.' });
            }
        }

        // Creer le message
        const newMessage = {
            id: 'MSG-' + uuidv4().split('-')[0].toUpperCase(),
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone ? phone.trim() : null,
            profil: profil ? profil.trim() : null,
            subject: subject.trim(),
            message: message.trim(),
            status: 'unread',
            quote_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Sauvegarder dans la base
        const messages = loadMessages();
        messages.push(newMessage);
        saveMessages(messages);

        console.log('[CONTACT] Nouveau message: ' + newMessage.id + ' de ' + name + ' <' + email + '>');

        // Envoyer les emails en parallele (sans bloquer la reponse)
        const emailPromises = [];

        // Email de confirmation au client
        emailPromises.push(
            emailService.sendContactConfirmation(email, name, subject)
                .then(function(result) {
                    if (result.success) {
                        console.log('[CONTACT] Email de confirmation envoye a ' + email);
                    } else {
                        console.log('[CONTACT] Echec envoi confirmation: ' + (result.reason || result.error));
                    }
                })
                .catch(function(err) { console.error('[CONTACT] Erreur envoi confirmation:', err); })
        );

        // Notification a l'admin
        emailPromises.push(
            emailService.sendAdminNotification({
                name: name,
                email: email,
                phone: phone,
                profil: profil,
                subject: subject,
                message: message
            })
                .then(function(result) {
                    if (result.success) {
                        console.log('[CONTACT] Notification admin envoyee');
                    } else {
                        console.log('[CONTACT] Echec notification admin: ' + (result.reason || result.error));
                    }
                })
                .catch(function(err) { console.error('[CONTACT] Erreur notification admin:', err); })
        );

        // === WORKFLOW DEVIS : Si subject === 'devis' et service_type fourni ===
        var quoteId = null;
        if (subject.trim().toLowerCase() === 'devis' && service_type) {
            try {
                var quotes = loadQuotes();
                var quoteNumber = generateQuoteNumber();
                var partnerType = SERVICE_TO_PARTNER_TYPE[service_type] || null;

                // Auto-assigner le partenaire si un seul correspond au type
                var assignedPartnerId = null;
                var assignedPartnerEmail = null;
                if (partnerType) {
                    var matchingPartners = loadPartners().filter(function(p) {
                        return p.partner_type === partnerType && p.accountStatus === 'active';
                    });
                    if (matchingPartners.length === 1) {
                        assignedPartnerId = matchingPartners[0].id;
                        assignedPartnerEmail = matchingPartners[0].email;
                    }
                }

                var newQuote = {
                    id: 'QUO-' + uuidv4().split('-')[0].toUpperCase(),
                    contact_request_id: newMessage.id,
                    quote_number: quoteNumber,
                    status: 'DRAFT_REQUESTED',
                    service_type: service_type,
                    partner_id: assignedPartnerId,
                    partner_email: assignedPartnerEmail,
                    client_name: name.trim(),
                    client_email: email.trim().toLowerCase(),
                    client_profil: profil ? profil.trim() : null,
                    brief: message.trim(),
                    client_budget: (client_budget && !isNaN(parseFloat(client_budget)) && parseFloat(client_budget) > 0) ? parseFloat(client_budget) : null,
                    partner_proposal: null,
                    admin_final: null,
                    pricing: null,
                    validity_days: 30,
                    acceptance_token: uuidv4(),
                    sent_at: null,
                    accepted_at: null,
                    expired_at: null,
                    order_id: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                quotes.push(newQuote);
                saveQuotes(quotes);
                quoteId = newQuote.id;

                // Mettre a jour le message avec le quote_id
                newMessage.quote_id = quoteId;
                var allMessages = loadMessages();
                var msgIdx = allMessages.findIndex(function(m) { return m.id === newMessage.id; });
                if (msgIdx !== -1) {
                    allMessages[msgIdx].quote_id = quoteId;
                    saveMessages(allMessages);
                }

                console.log('[QUOTE] Devis cree: ' + newQuote.id + ' (' + quoteNumber + ') - type: ' + service_type);

                // Email notification devis a l'admin
                if (typeof emailService.sendQuoteAdminNotification === 'function') {
                    emailPromises.push(
                        emailService.sendQuoteAdminNotification(newQuote)
                            .then(function(r) { if (r && r.success) console.log('[QUOTE] Notification admin devis envoyee'); })
                            .catch(function(err) { console.error('[QUOTE] Erreur notif admin devis:', err); })
                    );
                }

                // Email notification au partenaire assigne
                if (assignedPartnerId && typeof emailService.sendQuotePartnerNotification === 'function') {
                    var assignedPartner = loadPartners().find(function(p) { return p.id === assignedPartnerId; });
                    if (assignedPartner) {
                        emailPromises.push(
                            emailService.sendQuotePartnerNotification(newQuote, assignedPartner)
                                .then(function(r) { if (r && r.success) console.log('[QUOTE] Notification partenaire devis envoyee'); })
                                .catch(function(err) { console.error('[QUOTE] Erreur notif partenaire devis:', err); })
                        );
                    }
                }

            } catch (quoteError) {
                console.error('[QUOTE] Erreur creation devis:', quoteError);
                // Ne pas bloquer la reponse du contact si le devis echoue
            }
        }

        // Ne pas attendre les emails pour repondre
        Promise.all(emailPromises);

        res.json({
            success: true,
            messageId: newMessage.id,
            quoteId: quoteId,
            message: 'Votre message a bien ete recu. Vous recevrez une confirmation par email.'
        });

    } catch (error) {
        console.error('Erreur contact:', error);
        res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
    }
});

/**
 * GET /api/admin/messages (Admin)
 * Recuperer tous les messages
 */
app.get('/api/admin/messages', function(req, res) {
    try {
        var messages = loadMessages();
        messages.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        res.json(messages);
    } catch (e) {
        console.error('[ADMIN] Erreur GET /api/admin/messages:', e);
        res.status(500).json({ error: 'Erreur serveur', detail: e.message });
    }
});

/**
 * GET /api/admin/messages/stats (Admin)
 * Statistiques des messages
 * IMPORTANT: Cette route doit etre AVANT /:messageId pour eviter le conflit
 */
app.get('/api/admin/messages/stats', function(req, res) {
    try {
        var messages = loadMessages();
        var todayStr = new Date().toDateString();
        res.json({
            total: messages.length,
            unread: messages.filter(function(m) { return m.status === 'unread'; }).length,
            read: messages.filter(function(m) { return m.status === 'read'; }).length,
            replied: messages.filter(function(m) { return m.status === 'replied'; }).length,
            archived: messages.filter(function(m) { return m.status === 'archived'; }).length,
            today: messages.filter(function(m) { return new Date(m.created_at).toDateString() === todayStr; }).length
        });
    } catch (e) {
        console.error('[ADMIN] Erreur GET /api/admin/messages/stats:', e);
        res.status(500).json({ error: 'Erreur serveur', detail: e.message });
    }
});

/**
 * GET /api/admin/messages/:messageId (Admin)
 * Recuperer un message specifique et le marquer comme lu
 */
app.get('/api/admin/messages/:messageId', function(req, res) {
    try {
        var messages = loadMessages();
        var index = messages.findIndex(function(m) { return m.id === req.params.messageId; });
        if (index === -1) return res.status(404).json({ error: 'Message non trouve' });
        if (messages[index].status === 'unread') {
            messages[index].status = 'read';
            messages[index].updated_at = new Date().toISOString();
            saveMessages(messages);
        }
        res.json(messages[index]);
    } catch (e) {
        console.error('[ADMIN] Erreur GET /api/admin/messages/:messageId:', e);
        res.status(500).json({ error: 'Erreur serveur', detail: e.message });
    }
});

/**
 * PUT /api/admin/messages/:messageId/status (Admin)
 * Mettre a jour le statut d'un message
 */
app.put('/api/admin/messages/:messageId/status', function(req, res) {
    try {
        var status = (req.body || {}).status;
        var validStatuses = ['unread', 'read', 'replied', 'archived'];
        if (validStatuses.indexOf(status) === -1) {
            return res.status(400).json({ error: 'Statut invalide', valid_statuses: validStatuses });
        }
        var messages = loadMessages();
        var index = messages.findIndex(function(m) { return m.id === req.params.messageId; });
        if (index === -1) return res.status(404).json({ error: 'Message non trouve' });
        messages[index].status = status;
        messages[index].updated_at = new Date().toISOString();
        saveMessages(messages);
        res.json({ success: true, message: messages[index] });
    } catch (e) {
        console.error('[ADMIN] Erreur PUT /api/admin/messages/:messageId/status:', e);
        res.status(500).json({ error: 'Erreur serveur', detail: e.message });
    }
});

/**
 * POST /api/admin/messages/:messageId/reply (Admin)
 * Repondre a un message par email
 */
app.post('/api/admin/messages/:messageId/reply', async (req, res) => {
    try {
        const { replyMessage } = req.body;

        if (!replyMessage || !replyMessage.trim()) {
            return res.status(400).json({ error: 'Le message de reponse est requis' });
        }

        // Verifier que la fonction sendAdminReply existe
        if (typeof emailService.sendAdminReply !== 'function') {
            console.error('[CONTACT] sendAdminReply non disponible dans emailService');
            return res.status(500).json({ error: 'Service email non disponible. Veuillez reessayer dans quelques minutes.' });
        }

        const messages = loadMessages();
        const index = messages.findIndex(m => m.id === req.params.messageId);

        if (index === -1) {
            return res.status(404).json({ error: 'Message non trouve' });
        }

        const msg = messages[index];

        console.log(`[CONTACT] Envoi reponse a ${msg.email} pour message ${msg.id}...`);

        // Envoyer l'email de reponse
        const emailResult = await emailService.sendAdminReply(
            msg.email,
            msg.name,
            msg.subject,
            replyMessage.trim()
        );

        console.log(`[CONTACT] Resultat envoi:`, JSON.stringify(emailResult));

        if (!emailResult.success) {
            const details = emailResult.error || emailResult.reason || 'Erreur inconnue';
            console.error(`[CONTACT] Echec envoi email: ${details}`);
            return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email: ' + details });
        }

        // Mettre a jour le statut du message
        messages[index].status = 'replied';
        messages[index].replied_at = new Date().toISOString();
        messages[index].reply_message = replyMessage.trim();
        messages[index].updated_at = new Date().toISOString();
        saveMessages(messages);

        console.log(`[CONTACT] Reponse envoyee avec succes au message ${msg.id} (${msg.email})`);
        // Push au client : réponse admin reçue
        notifyUser(msg.email, 'client', 'reponse-admin', 'FA GENESIS vous a répondu', replyMessage.trim().substring(0, 100), '/app.html');

        res.json({ success: true, message: 'Reponse envoyee avec succes' });

    } catch (error) {
        console.error('[CONTACT] Erreur reponse message:', error.message, error.stack);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

/**
 * DELETE /api/admin/messages/:messageId (Admin)
 * Supprimer un message
 */
app.delete('/api/admin/messages/:messageId', function(req, res) {
    try {
        var messages = loadMessages();
        var index = messages.findIndex(function(m) { return m.id === req.params.messageId; });
        if (index === -1) return res.status(404).json({ error: 'Message non trouve' });
        var deleted = messages.splice(index, 1)[0];
        saveMessages(messages);
        console.log('[CONTACT] Message supprime: ' + deleted.id);
        res.json({ success: true, deleted: deleted });
    } catch (e) {
        console.error('[ADMIN] Erreur DELETE /api/admin/messages/:messageId:', e);
        res.status(500).json({ error: 'Erreur serveur', detail: e.message });
    }
});

/**
 * POST /api/admin/messages/bulk-delete (Admin)
 * Supprimer plusieurs messages en une seule requete
 * Body: { ids: ['MSG-XXX', 'MSG-YYY', ...] }
 */
app.post('/api/admin/messages/bulk-delete', (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids requis (tableau)' });
        }
        var messages = loadMessages();
        var idSet = new Set(ids);
        var before = messages.length;
        messages = messages.filter(function(m) { return !idSet.has(m.id); });
        var deletedCount = before - messages.length;
        saveMessages(messages);
        console.log('[CONTACT] ' + deletedCount + ' message(s) supprimes en masse');
        res.json({ success: true, deleted: deletedCount });
    } catch (error) {
        console.error('[CONTACT] Erreur suppression en masse:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// ROUTES - AUTHENTIFICATION
// ============================================================

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur
 *
 * Body: { prenom, nom, email, telephone, password, offre }
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { prenom, nom, email, telephone, password, offre, accountType, referralCode } = req.body;
        const validAccountTypes = ['etudiant', 'particulier', 'entreprise'];
        const userAccountType = validAccountTypes.includes(accountType) ? accountType : null;

        // Validation des champs requis (le nom est facultatif côté formulaire)
        if (!prenom || !email || !password) {
            return res.status(400).json({
                error: 'Champs requis manquants',
                required: ['prenom', 'email', 'password']
            });
        }

        // Validation email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Format d\'email invalide' });
        }

        // Anti-spam : champ honeypot (les bots remplissent les champs caches)
        if (req.body._hp && req.body._hp.trim() !== '') {
            console.log('[SPAM] Inscription bloquee (honeypot): ' + email);
            return res.status(400).json({ error: 'Formulaire invalide.' });
        }

        // Anti-spam : rate limiting (max 3 inscriptions par IP par heure)
        var regClientIp = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        if (!checkRateLimit(regClientIp, 'register', 3, 3600000)) {
            console.log('[SPAM] Inscription bloquee (rate limit): ' + regClientIp);
            return res.status(429).json({ error: 'Trop de tentatives. Veuillez reessayer dans 1 heure.' });
        }

        // Anti-spam : les noms qui ressemblent a des chaines aleatoires sont rejetes
        if (isSpamName(prenom) || (nom && isSpamName(nom))) {
            console.log('[SPAM] Inscription bloquee (nom suspect): ' + prenom + ' ' + (nom || '') + ' <' + email + '>');
            return res.status(400).json({ error: 'Veuillez entrer votre vrai prenom et nom.' });
        }

        // Anti-spam : le formulaire doit avoir ete ouvert depuis au moins 3 secondes
        if (req.body._ft) {
            var regFormTime = parseInt(req.body._ft, 10);
            var regFormElapsed = Date.now() - regFormTime;
            // elapsed < 0 = horloge du client en avance (frequent sur mobile mal synchronise) : pas du spam, on ignore le check
            if (!isNaN(regFormElapsed) && regFormElapsed >= 0 && regFormElapsed < 3000) {
                console.log('[SPAM] Inscription bloquee (soumission trop rapide): ' + email);
                return res.status(400).json({ error: 'Formulaire soumis trop rapidement.' });
            }
        }

        // Validation mot de passe (minimum 6 caracteres)
        if (password.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caracteres' });
        }

        // Verifier si l'email existe deja
        const existingUser = getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Un compte existe deja avec cet email' });
        }

        // Hasher le mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generer un token de session (JWT, survit aux redéploiements Render)
        const _regUserId = 'USR-' + uuidv4().split('-')[0].toUpperCase();
        const sessionToken = signClientToken({id: _regUserId, email: email.trim().toLowerCase()});

        // Determiner le type de produit et recuperer les infos de l'offre
        let productType = null;
        let offerData = null;
        if (offre) {
            const { getProductById, calculatePaymentAmounts } = require('./products');
            const product = getProductById(offre);
            if (product) {
                productType = product.product_type;
                const amounts = calculatePaymentAmounts(product.total_price);
                offerData = {
                    name: product.name,
                    category: product.category,
                    product_type: product.product_type,
                    total_price: product.total_price,
                    duration: product.duration,
                    deposit_amount: amounts.deposit_amount,
                    balance_amount: amounts.balance_amount
                };
            }
        }

        // Code de parrainage optionnel : l'id de l'utilisateur sert directement de code
        const users = loadUsers();
        let referredBy = null;
        if (referralCode && typeof referralCode === 'string') {
            const referrer = users.find(u => u.id.toLowerCase() === referralCode.trim().toLowerCase());
            if (referrer) referredBy = referrer.id;
        }

        // Creer l'utilisateur
        const newUser = {
            id: _regUserId,
            prenom: prenom.trim(),
            nom: nom ? nom.trim() : '',
            email: email.trim().toLowerCase(),
            telephone: telephone ? telephone.trim() : null,
            password: hashedPassword,
            accountType: userAccountType,
            offre: offre || null,
            activeOfferId: offre || null,
            productType: productType,
            paymentStatus: 'registered',
            payments: [],
            favoris: [],
            referredBy: referredBy,
            referralBonusQG: referredBy ? 0 : 40,
            referral_discount: { pct: referredBy ? WELCOME_DISCOUNT_PCT_WITH_REFERRAL : WELCOME_DISCOUNT_PCT_NO_REFERRAL, applied: false },
            sessionToken: sessionToken,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };

        // Sauvegarder
        users.push(newUser);
        saveUsers(users);

        console.log(`[AUTH] Nouvel utilisateur inscrit: ${newUser.id} - ${email}`);
        // Push admin : nouvelle inscription
        notifyUser(null, 'admin', 'inscription', 'FA GENESIS — Nouvelle inscription', prenom + (nom ? ' ' + nom : '') + ' vient de s\'inscrire.', '/app.html#open-admin');

        // Email de bienvenue au client (invitation a decouvrir les offres)
        emailService.sendWelcomeEmail(email, prenom)
            .then(result => {
                if (result.success) console.log(`[AUTH] Email bienvenue envoye a ${email}`);
            })
            .catch(err => console.error('[AUTH] Erreur email bienvenue:', err));

        // Notification admin
        emailService.sendAdminRegistrationNotification({
            firstName: prenom,
            lastName: nom,
            email: email,
            phone: telephone,
            offerName: offerData ? offerData.name : null
        })
            .then(result => {
                if (result.success) {
                    console.log(`[AUTH] Notification admin envoyée pour ${email}`);
                }
            })
            .catch(err => console.error('[AUTH] Erreur notification admin:', err));

        // Retourner l'utilisateur (sans le mot de passe)
        const userResponse = { ...newUser };
        delete userResponse.password;

        res.json({
            success: true,
            message: 'Inscription reussie',
            user: userResponse,
            token: sessionToken
        });

    } catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
});

/**
 * POST /api/auth/login
 * Connexion d'un utilisateur
 *
 * Body: { email, password }
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        // Anti brute-force : max 10 tentatives par IP+email par 15 minutes
        var loginClientIp = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        if (!checkRateLimit(loginClientIp + ':' + email.toLowerCase(), 'login', 10, 900000)) {
            console.log('[SECURITY] Connexion bloquee (rate limit): ' + email + ' depuis ' + loginClientIp);
            return res.status(429).json({ error: 'Trop de tentatives de connexion. Veuillez reessayer dans quelques minutes.' });
        }

        // Chercher l'utilisateur
        const users = loadUsers();
        const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

        if (userIndex === -1) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const user = users[userIndex];

        // Verifier le mot de passe
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        // Verifier si le compte est desactive
        if (user.accountStatus === 'deactivated') {
            return res.status(403).json({
                error: 'Compte désactivé',
                deactivated: true,
                message: 'Votre compte est temporairement désactivé. Vous pouvez le réactiver depuis la page de connexion.'
            });
        }

        // Connexion directe — même comportement que le login prestataire
        const sessionToken = signClientToken(user);
        users[userIndex].sessionToken = sessionToken;
        users[userIndex].lastLogin = new Date().toISOString();
        users[userIndex].updatedAt = new Date().toISOString();
        saveUsers(users);

        console.log(`[AUTH] Connexion client: ${user.id} - ${email}`);

        const userResponse = { ...users[userIndex] };
        delete userResponse.password;
        delete userResponse.trustedDevices;
        delete userResponse.otp_code;
        delete userResponse.pending_token;

        res.json({
            success: true,
            user: userResponse,
            token: sessionToken
        });

    } catch (error) {
        console.error('Erreur connexion:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

/**
 * GET /api/auth/me
 * Recuperer l'utilisateur connecte via le token
 *
 * Headers: Authorization: Bearer <token>
 */
app.get('/api/auth/me', (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token d\'authentification requis' });
        }

        const token = authHeader.split(' ')[1];

        // Chercher l'utilisateur avec ce token
        const users = loadUsers();
        const user = findUserByToken(token);

        if (!user) {
            return res.status(401).json({ error: 'Session invalide ou expirée' });
        }

        // Synchroniser le paymentStatus depuis orders.json si besoin
        try {
            var orders = loadOrders();
            var userOrders = orders.filter(function(o) {
                return o.client_info && o.client_info.email &&
                    o.client_info.email.toLowerCase() === user.email.toLowerCase();
            });
            var paidOrder = userOrders.find(function(o) { return o.deposit_paid === true; });
            var fullyPaidOrder = userOrders.find(function(o) { return o.balance_paid === true; });

            var correctStatus = 'registered';
            if (fullyPaidOrder) {
                correctStatus = 'fully_paid';
            } else if (paidOrder) {
                correctStatus = 'deposit_paid';
            }

            if (user.paymentStatus !== correctStatus) {
                // Mettre à jour users.json
                var allUsers = loadUsers();
                var idx = allUsers.findIndex(function(u) { return u.email === user.email; });
                if (idx !== -1) {
                    allUsers[idx].paymentStatus = correctStatus;
                    allUsers[idx].payment_status = correctStatus;
                    if (paidOrder && paidOrder.id) allUsers[idx].activeOrderId = paidOrder.id;
                    saveUsers(allUsers);
                    user.paymentStatus = correctStatus;
                    user.payment_status = correctStatus;
                    console.log('[AUTH/ME] Sync paymentStatus pour ' + user.email + ': ' + correctStatus);
                }
            }
        } catch (syncErr) {
            console.error('[AUTH/ME] Erreur sync paymentStatus:', syncErr.message);
        }

        // Retourner l'utilisateur (sans le mot de passe)
        const userResponse = { ...user };
        delete userResponse.password;
        delete userResponse.sessionToken;

        // Construire activeSubscription depuis la commande payee
        var meSubscription = null;
        if (paidOrder) {
            meSubscription = buildActiveSubscription(user, paidOrder);
        } else {
            // Chercher une commande en attente (exclure les annulees)
            var pendingOrd = userOrders.find(function(o) { return !o.deposit_paid && o.status !== 'cancelled'; });
            if (pendingOrd) {
                meSubscription = buildActiveSubscription(user, pendingOrd);
            }
        }

        // Avis en attente : dispatches des commandes de l'utilisateur dont l'avis a ete demande mais pas encore soumis
        var pendingReviewPrompts = [];
        try {
            var userOrderIds = userOrders.map(function(o) { return o.id; });
            var pendingDispatches = loadDispatches().filter(function(d) {
                return userOrderIds.indexOf(d.order_id) !== -1 && d.review_requested === true && !d.review_submitted;
            });
            pendingReviewPrompts = pendingDispatches.map(function(d) {
                var partner = getPartnerById(d.claimed_by_partner_id);
                return {
                    dispatchId: d.id,
                    partnerId: d.claimed_by_partner_id,
                    partnerName: partner ? ((partner.prenom || '') + ' ' + (partner.nom || '')).trim() : 'votre partenaire'
                };
            });
        } catch (prErr) {
            console.error('[AUTH/ME] Erreur pendingReviewPrompts:', prErr.message);
        }

        var completedOrders = getClientCompletedOrders(user.email);
        var clientQGPoints = getClientGenesisPoints(user, completedOrders);
        var clientBadge = getClientQGBadge(clientQGPoints); // Niveau basé sur QG, non sur les commandes
        var referralCount = getClientReferralCount(user.id);

        // Détection level-up : notifier + email si le niveau a changé depuis la dernière visite
        var prevBadge = user.lastKnownClientBadge !== undefined ? user.lastKnownClientBadge : '__init__';
        if (prevBadge !== '__init__' && prevBadge !== clientBadge && clientBadge) {
            var newLevel = getGenesisLevel(clientBadge);
            notifyUser(user.email, 'client', 'level_up',
                '🎉 Vous avez atteint le niveau ' + newLevel.label + ' !',
                'Félicitations ! De nouveaux avantages sont maintenant débloqués.',
                '/app.html');
            try {
                emailService.sendLevelUpEmail(user.email, (user.prenom || user.email), newLevel.label)
                    .catch(function(e) { console.warn('[LEVEL_UP_EMAIL]', e.message); });
            } catch(_) {}
        }
        if (prevBadge !== clientBadge) {
            try {
                var usersForLU = loadUsers();
                var uIdxLU = usersForLU.findIndex(function(u) { return u.email === user.email; });
                if (uIdxLU !== -1) {
                    usersForLU[uIdxLU].lastKnownClientBadge = clientBadge;
                    saveUsers(usersForLU);
                }
            } catch(_) {}
        }

        res.json({
            success: true,
            user: userResponse,
            activeSubscription: meSubscription,
            pendingReviewPrompts: pendingReviewPrompts,
            badge: clientBadge,
            badgeProgress: getClientQGBadgeProgress(clientQGPoints),
            genesisPoints: clientQGPoints,
            genesisLevel: getGenesisLevel(clientBadge),
            completedOrders: completedOrders,
            isClientFidele: completedOrders >= 5,
            favoris: user.favoris || [],
            referralCode: user.id,
            referralCount: referralCount,
            referralDiscount: user.referral_discount || null,
            welcomeDiscountEligible: isClientFirstPaidOrder(user.email),
            referralBonusQG: user.referralBonusQG || 0,
            missionBonuses: user.missionBonuses || {},
            preferred_partner_types: user.preferred_partner_types || [],
            profile_bio: user.profile_bio || '',
            profile_theme: user.profile_theme || 'genesis',
            profile_banner: user.profile_banner || null,
            patrimoineGenesis: {
                prestationsRealisees: completedOrders,
                partenairesDistincts: getClientDistinctPartnerCount(user.email),
                parrainages: referralCount,
                ancienneteJours: user.createdAt ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0
            }
        });

    } catch (error) {
        console.error('Erreur verification session:', error);
        res.status(500).json({ error: 'Erreur lors de la verification' });
    }
});

app.post('/api/auth/referral-discount/mark-used', function(req, res) {
    var muUser = authenticateClient(req, res);
    if (!muUser) return;
    try {
        var muUsers = loadUsers();
        var muIdx = muUsers.findIndex(function(u) { return u.email === muUser.email; });
        if (muIdx !== -1 && muUsers[muIdx].referral_discount && !muUsers[muIdx].referral_discount.applied) {
            muUsers[muIdx].referral_discount.applied = true;
            muUsers[muIdx].referral_discount.applied_at = new Date().toISOString();
            saveUsers(muUsers);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// GET /api/tier-benefits — configuration publique des avantages par palier
app.get('/api/tier-benefits', function(req, res) {
    try {
        var tiers = Object.keys(GENESIS_TIER_BENEFITS).map(function(badge) {
            var b = GENESIS_TIER_BENEFITS[badge];
            var _cr = b.commissionReduction || 0;
            var _cl = _cr <= 0 ? 'Standard' : (_cr <= 2 ? 'Avantageuse' : 'Privilégiée');
            return { badge: badge, commissionLabel: _cl, commissionReduction: _cr, commissionPct: b.commissionPct || 15, payout: b.payout, events: b.events, monthlyBoosts: b.monthlyBoosts || 0 };
        });
        res.json({ ok: true, tiers: tiers });
    } catch (e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// GET /api/client/level-progress — progression niveaux GENESIS du client connecté
app.get('/api/client/level-progress', function(req, res) {
    var user = authenticateClient(req, res);
    if (!user) return;
    try {
        // Rétroactivité : attribuer les bonus non encore accordés aux utilisateurs existants
        var _retroUpdated = checkReferralAndMissionRewards(user.email);
        if (_retroUpdated) user = _retroUpdated;
        var completedOrders = getClientCompletedOrders(user.email);
        var qgPoints = getClientGenesisPoints(user, completedOrders);
        var currentBadge = getClientQGBadge(qgPoints);
        var progress = getClientQGBadgeProgress(qgPoints);
        var levelMeta = getGenesisLevel(currentBadge);

        var clientLevelAdvantages = {
            bronze: [
                { id: 'profil_perso',       label: 'Personnalisation du profil (thème, bannière, bio enrichie)' },
                { id: 'parrainage',         label: 'Programme de parrainage' },
                { id: 'defis_qg',           label: 'Missions GENESIS pour gagner davantage de points' },
                { id: 'suggestions_ia',     label: 'Jérémie IA — Suggestions personnalisées selon vos habitudes' },
                { id: 'patrimoine_genesis', label: 'Patrimoine GENESIS' }
            ],
            argent: [
                { id: 'avantages_ptnr',    label: 'Offres promotionnelles proposées par les prestataires' },
                { id: 'webinaires',        label: 'Invitations aux webinaires et ateliers GENESIS' },
                { id: 'alertes_ia',        label: 'Alertes intelligentes — nouveau prestataire correspondant à vos préférences' },
                { id: 'campagnes',         label: 'Accès prioritaire aux campagnes et aux jeux concours' },
                { id: 'jeremie_plus',      label: 'Jérémie IA Plus — Analyse des habitudes & recommandations automatiques' }
            ],
            or: [
                { id: 'events_prives',     label: 'Invitations aux événements privés & soirées networking GENESIS' },
                { id: 'avant_premiere',    label: 'Accès anticipé aux nouvelles fonctionnalités de l\'application GENESIS' },
                { id: 'priority_events',   label: 'Priorité d\'inscription aux événements à capacité limitée' },
                { id: 'jeremie_pro',       label: 'Jérémie IA Pro — Comparaison multicritères & préparation de projet' }
            ],
            elite: [
                { id: 'vip',            label: 'Invitations VIP aux événements GENESIS' },
                { id: 'fonct_exp',      label: 'Accès anticipé aux nouvelles fonctionnalités de l\'application GENESIS' },
                { id: 'cadeau_annuel',  label: 'Cadeau annuel de fidélité' },
                { id: 'jeremie_expert', label: 'Jérémie IA Expert — Assistant personnel multi-projets & conseils continus' }
            ]
        };
        var clientLevelDescriptions = {
            bronze: 'Vous venez de réaliser vos premières actions significatives sur FA GENESIS.',
            argent: 'Vous êtes un utilisateur régulier — bienvenue dans le cercle des Bâtisseurs.',
            or:     'Vous entrez dans un cercle privilégié réservé aux membres les plus engagés.',
            elite:  'Le plus haut niveau de fidélité. Vous faites partie de l\'élite GENESIS.'
        };

        var levelOrder = ['bronze', 'argent', 'or', 'elite'];
        var currentOrder = levelOrder.indexOf(currentBadge);

        var levels = CLIENT_QG_LEVEL_TIERS.slice().reverse().map(function(tier) {
            var tierOrder = levelOrder.indexOf(tier.id);
            var unlocked = tierOrder <= currentOrder;
            var advantages = clientLevelAdvantages[tier.id] || [];
            return {
                id: tier.id,
                label: tier.label,
                description: clientLevelDescriptions[tier.id] || '',
                pts: tier.pts,
                unlocked: unlocked,
                icon: getGenesisLevel(tier.id).icon,
                advantages: advantages.map(function(adv) {
                    return { id: adv.id, label: adv.label, available: unlocked };
                })
            };
        });

        res.json({
            ok: true,
            qgPoints: qgPoints,
            currentBadge: currentBadge,
            currentLevel: levelMeta,
            progress: progress,
            levels: levels,
            completedOrders: completedOrders,
            referralCount: getClientReferralCount(user.id)
        });
    } catch(e) {
        console.error('[LEVEL_PROGRESS]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/partner/badge-progress-full — progression badge prestataire avec avantages
app.get('/api/partner/badge-progress-full', function(req, res) {
    var partner = authenticatePartner(req, res);
    if (!partner) return;
    try {
        var summary = getPartnerRatingSummary(partner.id);
        var missions = getPartnerMissionsCompleted(partner.id);
        var badge = getPartnerBadge(partner, summary, missions);
        var progress = getPartnerBadgeProgress(partner, summary, missions);

        var badgeOrder = [null, 'bronze', 'argent', 'or', 'elite'];
        var currentOrder = badgeOrder.indexOf(badge);

        var badgeAdvantages = {
            bronze: [
                { id: 'presence_annuaire', label: 'Présence dans l\'annuaire' },
                { id: 'dashboard', label: 'Tableau de bord professionnel' },
                { id: 'commission', label: 'Commission standard (25%)' },
                { id: 'formations', label: 'Accès aux formations FA GENESIS' },
                { id: 'boost_bienvenue', label: 'Boost de visibilité de bienvenue (30 jours)' },
                { id: 'jeremie_essentiel', label: 'Jérémie IA Essentiel — Optimisation profil & annonces' }
            ],
            argent: [
                { id: 'commission_22', label: 'Commission réduite (22%)' },
                { id: 'stats_avancees', label: 'Statistiques avancées de performance' },
                { id: 'meilleur_classement', label: 'Meilleur classement dans l\'annuaire' },
                { id: 'boosts_2', label: '2 boosts mensuels de visibilité' },
                { id: 'ateliers', label: 'Accès prioritaire aux ateliers professionnels' },
                { id: 'jeremie_plus', label: 'Jérémie IA Plus — Analyse des avis & taux de conversion' }
            ],
            or: [
                { id: 'commission_19', label: 'Commission réduite (19%)' },
                { id: 'classement_renforce', label: 'Classement renforcé dans l\'annuaire' },
                { id: 'boosts_4', label: '4 boosts mensuels de visibilité' },
                { id: 'outils_anticipes', label: 'Accès anticipé aux nouveaux outils' },
                { id: 'events', label: 'Accès aux événements FA GENESIS' },
                { id: 'jeremie_pro', label: 'Jérémie IA Pro — Conseils marketing & optimisation revenus' }
            ],
            elite: [
                { id: 'commission_15', label: 'Commission réduite (15%)' },
                { id: 'badge_premium', label: 'Badge premium affiché dans l\'annuaire' },
                { id: 'priorite_classement', label: 'Priorité de classement (à profil équivalent)' },
                { id: 'boosts_8', label: '8 boosts mensuels de visibilité' },
                { id: 'events_pro', label: 'Invitations aux événements professionnels exclusifs' },
                { id: 'jeremie_expert', label: 'Jérémie IA Expert — Assistant stratégique & prévisions d\'activité' }
            ]
        };

        var badges = ['bronze', 'argent', 'or', 'elite'].map(function(b) {
            var bOrder = badgeOrder.indexOf(b);
            var unlocked = currentOrder >= bOrder && bOrder > 0;
            var tier = PARTNER_BADGE_TIERS.find(function(t) { return t.id === b; });
            var benefits = GENESIS_TIER_BENEFITS[b] || GENESIS_TIER_BENEFITS[null];
            var advantages = badgeAdvantages[b] || [];
            return {
                id: b,
                label: b.charAt(0).toUpperCase() + b.slice(1),
                missions: tier ? tier.missions : 0,
                rating: tier ? tier.rating : 0,
                unlocked: unlocked,
                commissionPct: benefits.commissionPct,
                monthlyBoosts: benefits.monthlyBoosts,
                events: benefits.events,
                advantages: advantages.map(function(adv) {
                    return { id: adv.id, label: adv.label, available: unlocked };
                })
            };
        });

        res.json({
            ok: true,
            badge: badge,
            progress: progress,
            missionsCurrent: missions,
            ratingCurrent: summary.average,
            badges: badges
        });
    } catch(e) {
        console.error('[BADGE_PROGRESS_FULL]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/users/favorites/:partnerId/toggle — ajoute/retire un partenaire des favoris du client connecte
app.post('/api/users/favorites/:partnerId/toggle', (req, res) => {
    var user = authenticateClient(req, res);
    if (!user) return;
    try {
        var partnerId = req.params.partnerId;
        var users = loadUsers();
        var idx = users.findIndex(function(u) { return u.email === user.email; });
        if (idx === -1) return res.status(404).json({ error: 'Utilisateur non trouve' });
        var favoris = users[idx].favoris || [];
        var pos = favoris.indexOf(partnerId);
        if (pos === -1) favoris.push(partnerId);
        else favoris.splice(pos, 1);
        users[idx].favoris = favoris;
        users[idx].updatedAt = new Date().toISOString();
        saveUsers(users);
        res.json({ success: true, favoris: favoris });
    } catch (error) {
        console.error('[FAVORIS] Erreur toggle:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/users/favorites — partenaires favoris du client connecte, meme forme que /api/partners/directory
app.get('/api/users/favorites', (req, res) => {
    var user = authenticateClient(req, res);
    if (!user) return;
    try {
        var favIds = user.favoris || [];
        var partners = loadPartners().filter(function(p) {
            return p.accountStatus === 'active' && favIds.indexOf(p.id) !== -1;
        });
        var results = partners.map(function(p) {
            return {
                id: p.id,
                prenom: p.prenom,
                nom: p.nom,
                partner_type: p.partner_type,
                photo: p.photo || null,
                city: p.city || '',
                fromPrice: getPartnerFromPrice(p),
                rating: getPartnerRatingSummary(p.id),
                badge: getPartnerBadge(p),
                constellation: getConstellationTier(p),
                verified: true
            };
        });
        res.json({ success: true, partners: results });
    } catch (error) {
        console.error('[FAVORIS] Erreur liste:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PATCH /api/me
 * Mettre a jour les infos personnelles (prenom, nom, telephone)
 */
app.patch('/api/me', (req, res) => {
    try {
        var authHeader = req.headers.authorization || '';
        var token = '';
        if (authHeader.toLowerCase().startsWith('bearer ')) {
            token = authHeader.slice(7).trim();
        } else if (authHeader.trim()) {
            token = authHeader.trim();
        }
        if (!token) {
            return res.status(401).json({ success: false, error: 'Token manquant' });
        }

        var users = loadUsers();
        var userIdx = findUserIndexByToken(token, users);
        if (userIdx === -1) {
            return res.status(401).json({ success: false, error: 'Session invalide' });
        }

        var body = req.body || {};
        if (body.prenom && typeof body.prenom === 'string' && body.prenom.trim()) {
            users[userIdx].prenom = body.prenom.trim();
        }
        if (body.nom && typeof body.nom === 'string' && body.nom.trim()) {
            users[userIdx].nom = body.nom.trim();
        }
        if (typeof body.telephone === 'string') {
            users[userIdx].telephone = body.telephone.trim();
        }
        if (typeof body.profilePhoto === 'string') {
            if (body.profilePhoto.length > 2800000) {
                return res.status(400).json({ success: false, error: 'Image trop grande (max 2 Mo)' });
            }
            users[userIdx].profilePhoto = body.profilePhoto;
        }

        users[userIdx].updatedAt = new Date().toISOString();
        saveUsers(users);

        var userResp = Object.assign({}, users[userIdx]);
        delete userResp.password;
        delete userResp.sessionToken;

        res.json({ success: true, user: userResp });
    } catch (err) {
        console.error('[PATCH /api/me] Erreur:', err.message);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ============================================================
// ENDPOINTS CLIENT — commandes, livrables, compte
// ============================================================

/**
 * GET /api/orders
 * Retourne les commandes du client authentifie
 */
app.get('/api/orders', function(req, res) {
    try {
        var authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requis' });
        var token = authHeader.slice(7).trim();
        var users = loadUsers();
        var user = users.find(function(u) { return u.sessionToken === token; });
        if (!user) return res.status(401).json({ error: 'Session invalide' });

        var orders = loadOrders().filter(function(o) {
            return o.client_info && o.client_info.email &&
                o.client_info.email.toLowerCase() === user.email.toLowerCase();
        });

        var sanitized = orders.map(function(o) {
            return {
                id: o.id,
                status: o.status,
                product_name: o.product_name || o.service,
                service: o.service,
                amount: o.amount,
                partner_name: o.partner_name,
                partner_id: o.partner_id,
                deposit_paid: o.deposit_paid,
                balance_paid: o.balance_paid,
                created_at: o.created_at,
                updated_at: o.updated_at
            };
        });

        res.json(sanitized);
    } catch(err) {
        console.error('[GET /api/orders] Erreur:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/livrables
 * Retourne les livrables du client authentifie
 */
app.get('/api/livrables', function(req, res) {
    try {
        var authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requis' });
        var token = authHeader.slice(7).trim();
        var users = loadUsers();
        var user = users.find(function(u) { return u.sessionToken === token; });
        if (!user) return res.status(401).json({ error: 'Session invalide' });

        var orders = loadOrders().filter(function(o) {
            return o.client_info && o.client_info.email &&
                o.client_info.email.toLowerCase() === user.email.toLowerCase();
        });
        var orderIds = orders.map(function(o) { return o.id; });

        var allLivrables = loadLivrables();
        var myLivrables = allLivrables.filter(function(l) {
            return orderIds.indexOf(l.orderId || l.order_id) !== -1;
        }).map(function(l) {
            return {
                id: l.id,
                product_name: l.product_name || l.name || l.title,
                title: l.title || l.name,
                partner_name: l.partner_name,
                status: l.status,
                delivered_at: l.delivered_at || l.created_at,
                created_at: l.created_at,
                contract_id: l.contract_id
            };
        });

        res.json(myLivrables);
    } catch(err) {
        console.error('[GET /api/livrables] Erreur:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * DELETE /api/account
 * Supprimer le compte du client authentifie
 */
app.delete('/api/account', function(req, res) {
    try {
        var authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requis' });
        var token = authHeader.slice(7).trim();
        var users = loadUsers();
        var userIdx = users.findIndex(function(u) { return u.sessionToken === token; });
        if (userIdx === -1) return res.status(401).json({ error: 'Session invalide' });

        var email = users[userIdx].email;
        users.splice(userIdx, 1);
        saveUsers(users);

        console.log('[ACCOUNT] Suppression compte client:', email);
        res.json({ success: true, message: 'Compte supprimé' });
    } catch(err) {
        console.error('[DELETE /api/account] Erreur:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// ANNUAIRE PUBLIC PARTENAIRES
// ============================================================

function _sanitizePartnerPublic(p) {
    return {
        id: p.id,
        prenom: p.prenom || '',
        nom: p.nom || '',
        partner_type: p.partner_type || '',
        partner_type_other: p.partner_type_other || '',
        city: p.city || p.ville || '',
        ville: p.ville || p.city || '',
        photo: p.photo || null,
        tarif_type: p.tarif_type || 'devis',
        tarif_from: p.tarif_from || null,
        rating: p.rating || null,
        score: p.score || 0,
        registeredAt: p.registeredAt || p.createdAt || p.created_at || null
    };
}

/**
 * GET /api/partners/directory
 * Annuaire public des partenaires (filtre: type, sort, limit)
 */
app.get('/api/partners/directory', function(req, res) {
    try {
        var partners = loadPartners().filter(function(p) {
            return p.accountStatus !== 'deactivated' && p.accountStatus !== 'pending';
        });
        var type = req.query.type;
        if (type) partners = partners.filter(function(p) { return p.partner_type === type; });
        var sort = req.query.sort || 'score';
        if (sort === 'new') {
            partners.sort(function(a, b) {
                return new Date(b.registeredAt || b.createdAt || 0) - new Date(a.registeredAt || a.createdAt || 0);
            });
        } else {
            partners.sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
        }
        var limit = Math.min(parseInt(req.query.limit) || 24, 100);
        res.json(partners.slice(0, limit).map(_sanitizePartnerPublic));
    } catch(e) {
        console.error('[GET /api/partners/directory] Erreur:', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/partners/featured
 * Top partenaires par score
 */
app.get('/api/partners/featured', function(req, res) {
    try {
        var partners = loadPartners().filter(function(p) {
            return p.accountStatus !== 'deactivated' && p.accountStatus !== 'pending';
        });
        partners.sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
        var limit = Math.min(parseInt(req.query.limit) || 6, 50);
        res.json(partners.slice(0, limit).map(_sanitizePartnerPublic));
    } catch(e) {
        console.error('[GET /api/partners/featured] Erreur:', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/partners/new
 * Nouveaux partenaires (triés par date d'inscription)
 */
app.get('/api/partners/new', function(req, res) {
    try {
        var partners = loadPartners().filter(function(p) {
            return p.accountStatus !== 'deactivated' && p.accountStatus !== 'pending';
        });
        partners.sort(function(a, b) {
            return new Date(b.registeredAt || b.createdAt || 0) - new Date(a.registeredAt || a.createdAt || 0);
        });
        var limit = Math.min(parseInt(req.query.limit) || 6, 50);
        res.json(partners.slice(0, limit).map(_sanitizePartnerPublic));
    } catch(e) {
        console.error('[GET /api/partners/new] Erreur:', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/partners/recommended
 * Partenaires recommandés (par nombre d'avis puis score)
 */
app.get('/api/partners/recommended', function(req, res) {
    try {
        var partners = loadPartners().filter(function(p) {
            return p.accountStatus !== 'deactivated' && p.accountStatus !== 'pending';
        });
        partners.sort(function(a, b) {
            var ra = (a.rating && a.rating.count) ? a.rating.count : 0;
            var rb = (b.rating && b.rating.count) ? b.rating.count : 0;
            if (rb !== ra) return rb - ra;
            return (b.score || 0) - (a.score || 0);
        });
        var limit = Math.min(parseInt(req.query.limit) || 6, 50);
        res.json(partners.slice(0, limit).map(_sanitizePartnerPublic));
    } catch(e) {
        console.error('[GET /api/partners/recommended] Erreur:', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/deliverables/mine
 * Recuperer les livrables du client connecte
 */
app.get('/api/deliverables/mine', (req, res) => {
    try {
        var authHeader = req.headers.authorization || '';
        var token = '';
        if (authHeader.toLowerCase().startsWith('bearer ')) {
            token = authHeader.slice(7).trim();
        } else if (authHeader.trim()) {
            token = authHeader.trim();
        }
        if (!token) {
            return res.status(401).json({ ok: false, error: 'Token manquant' });
        }

        var users = loadUsers();
        var user = findUserByToken(token);
        if (!user) {
            return res.status(401).json({ ok: false, error: 'Session invalide' });
        }

        // Trouver la commande payee
        var orders = loadOrders();
        var paidOrder = null;
        for (var i = 0; i < orders.length; i++) {
            if (orders[i].client_info && orders[i].client_info.email &&
                orders[i].client_info.email.toLowerCase() === user.email.toLowerCase() &&
                orders[i].deposit_paid === true) {
                paidOrder = orders[i];
                break;
            }
        }

        if (!paidOrder) {
            return res.json({ ok: true, deliverables: [], can_download: false, order_id: null,
                message: 'Aucune commande payee' });
        }

        // Recuperer les livrables
        var allLivrables = loadLivrables();
        var myLivrables = allLivrables.filter(function(l) {
            var matchOrder = (l.orderId === paidOrder.id || l.order_id === paidOrder.id);
            if (!matchOrder) return false;
            // Filtrer: seulement PUBLISHED ou pas de workflow_status
            if (l.workflow_status && l.workflow_status !== 'PUBLISHED') return false;
            return true;
        });

        // Nettoyer les livrables pour le client
        var cleaned = myLivrables.map(function(l) {
            return {
                id: l.id,
                name: l.name || l.title || 'Document',
                type: l.type || 'document',
                category: l.type === 'photo' ? 'Photos' : (l.type === 'video' ? 'Videos' : 'Documents'),
                day_number: l.day_number || null,
                status: l.status || 'ready',
                download_url: l.download_url || null,
                preview_url: l.preview_url || l.previewUrl || null,
                content_text: l.content_text || null,
                created_at: l.created_at || l.createdAt || null
            };
        });

        res.json({
            ok: true,
            deliverables: cleaned,
            can_download: paidOrder.balance_paid === true,
            balance_payment_ready: paidOrder.balance_payment_ready === true,
            balance_paid: paidOrder.balance_paid === true,
            order_id: paidOrder.id
        });

    } catch (err) {
        console.error('[GET /api/deliverables/mine] Erreur:', err.message);
        res.status(500).json({ ok: false, error: 'Erreur serveur' });
    }
});

/**
 * POST /api/auth/logout
 * Deconnecter l'utilisateur (invalider le token)
 */
app.post('/api/auth/logout', (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];

            // Chercher et invalider le token
            const users = loadUsers();
            const userIndex = findUserIndexByToken(token, users);

            if (userIndex !== -1) {
                users[userIndex].sessionToken = null;
                users[userIndex].updatedAt = new Date().toISOString();
                saveUsers(users);
                console.log(`[AUTH] Deconnexion: ${users[userIndex].id}`);
            }
        }

        res.json({ success: true, message: 'Deconnexion reussie' });

    } catch (error) {
        console.error('Erreur deconnexion:', error);
        res.status(500).json({ error: 'Erreur lors de la deconnexion' });
    }
});

/**
 * POST /api/auth/forgot-password
 * Génère un token de réinitialisation et envoie l'email
 */
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email requis' });

        // Rate limiting : max 3 demandes par IP par heure
        const fpIp = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        if (!checkRateLimit(fpIp, 'forgot_password', 3, 3600000)) {
            return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 1 heure.' });
        }

        const users = loadUsers();
        const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

        if (userIndex !== -1) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            users[userIndex].reset_token = resetToken;
            users[userIndex].reset_token_expires = Date.now() + 86400000; // 24h
            saveUsers(users);

            const user = users[userIndex];
            const resetLink = 'https://fagenesis.com/reset-password.html?token=' + resetToken;
            try {
                await emailService.sendPasswordResetEmail(user.email, user.prenom || 'Client', resetLink);
            } catch (emailErr) {
                console.error('[FORGOT PWD] Erreur email:', emailErr.message);
            }
            console.log('[FORGOT PWD] Token généré: ' + email);
        } else {
            console.log('[FORGOT PWD] Email inconnu (réponse neutre): ' + email);
        }

        // Toujours répondre succès pour ne pas révéler si l'email existe
        res.json({ ok: true });

    } catch (error) {
        console.error('[FORGOT PWD]', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/auth/reset-password
 * Valide le token et met à jour le mot de passe
 */
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });

        const users = loadUsers();
        const userIndex = users.findIndex(u =>
            u.reset_token === token &&
            u.reset_token_expires &&
            u.reset_token_expires > Date.now()
        );

        if (userIndex === -1) {
            return res.status(400).json({ error: 'Lien de réinitialisation invalide ou expiré.' });
        }

        const salt = await bcrypt.genSalt(10);
        users[userIndex].password = await bcrypt.hash(newPassword, salt);
        users[userIndex].reset_token = null;
        users[userIndex].reset_token_expires = null;
        users[userIndex].updatedAt = new Date().toISOString();
        saveUsers(users);

        console.log('[RESET PWD] Mot de passe mis à jour: ' + users[userIndex].email);
        res.json({ ok: true });

    } catch (error) {
        console.error('[RESET PWD]', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/partner/auth/forgot-password
 * Génère un token de réinitialisation et envoie un email au partenaire
 */
app.post('/api/partner/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email requis' });

        const fpIp = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        if (!checkRateLimit(fpIp, 'partner_forgot_password', 3, 3600000)) {
            return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 1 heure.' });
        }

        const partners = loadPartners();
        const partnerIndex = partners.findIndex(p => p.email.toLowerCase() === email.toLowerCase());

        if (partnerIndex !== -1) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            partners[partnerIndex].reset_token = resetToken;
            partners[partnerIndex].reset_token_expires = Date.now() + 86400000;
            savePartners(partners);

            const partner = partners[partnerIndex];
            const resetLink = 'https://fagenesis.com/reset-password.html?token=' + resetToken + '&type=partner';
            try {
                await emailService.sendPasswordResetEmail(partner.email, partner.prenom || 'Partenaire', resetLink);
            } catch (emailErr) {
                console.error('[PARTNER FORGOT PWD] Erreur email:', emailErr.message);
            }
            console.log('[PARTNER FORGOT PWD] Token généré: ' + email);
        } else {
            console.log('[PARTNER FORGOT PWD] Email inconnu (réponse neutre): ' + email);
        }

        res.json({ ok: true });

    } catch (error) {
        console.error('[PARTNER FORGOT PWD]', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/partner/auth/reset-password
 * Valide le token et met à jour le mot de passe du partenaire
 */
app.post('/api/partner/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });

        const partners = loadPartners();
        const partnerIndex = partners.findIndex(p =>
            p.reset_token === token &&
            p.reset_token_expires &&
            p.reset_token_expires > Date.now()
        );

        if (partnerIndex === -1) {
            return res.status(400).json({ error: 'Lien de réinitialisation invalide ou expiré.' });
        }

        const salt = await bcrypt.genSalt(10);
        partners[partnerIndex].password = await bcrypt.hash(newPassword, salt);
        partners[partnerIndex].reset_token = null;
        partners[partnerIndex].reset_token_expires = null;
        partners[partnerIndex].updatedAt = new Date().toISOString();
        savePartners(partners);

        console.log('[PARTNER RESET PWD] Mot de passe mis à jour: ' + partners[partnerIndex].email);
        res.json({ ok: true });

    } catch (error) {
        console.error('[PARTNER RESET PWD]', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/auth/send-otp
 * Génère et envoie un code OTP à 6 chiffres (email ou SMS)
 */
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { pendingToken, channel, phone } = req.body;
        if (!pendingToken || !channel) return res.status(400).json({ error: 'Données manquantes' });

        const users = loadUsers();
        const userIndex = users.findIndex(function(u) {
            return u.pending_token === pendingToken && u.pending_token_expires && u.pending_token_expires > Date.now();
        });
        if (userIndex === -1) return res.status(400).json({ error: 'Session expirée. Recommencez la connexion.' });

        const user = users[userIndex];

        // Générer OTP à 6 chiffres
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        users[userIndex].otp_code = otp;
        users[userIndex].otp_expires = Date.now() + 600000; // 10min
        users[userIndex].otp_attempts = 0;

        let maskedDest;
        if (channel === 'sms') {
            if (!phone) return res.status(400).json({ error: 'Numéro requis' });
            saveUsers(users);
            try {
                await emailService.sendOtpSms(phone, otp);
            } catch(e) {
                console.error('[OTP SMS]', e.message);
                return res.status(500).json({ error: 'Échec envoi SMS : ' + e.message });
            }
            maskedDest = phone.slice(0, 4) + '****' + phone.slice(-2);
        } else {
            saveUsers(users);
            try { await emailService.sendOtpEmail(user.email, user.prenom || 'Client', otp); } catch(e) { console.error('[OTP EMAIL]', e.message); }
            const ep = user.email.split('@');
            maskedDest = ep[0].slice(0, 2) + '***@' + ep[1];
        }

        console.log('[OTP] Code envoyé (' + channel + '): ' + user.email);
        res.json({ ok: true, maskedDest });
    } catch (error) {
        console.error('[SEND OTP]', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/auth/verify-otp
 * Valide le code OTP et retourne le token de session + token d'appareil
 */
app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { pendingToken, otp } = req.body;
        if (!pendingToken || !otp) return res.status(400).json({ error: 'Données manquantes' });

        const users = loadUsers();
        const userIndex = users.findIndex(function(u) {
            return u.pending_token === pendingToken && u.pending_token_expires && u.pending_token_expires > Date.now();
        });
        if (userIndex === -1) return res.status(400).json({ error: 'Session expirée. Recommencez la connexion.' });

        users[userIndex].otp_attempts = (users[userIndex].otp_attempts || 0) + 1;
        if (users[userIndex].otp_attempts > 5) {
            saveUsers(users);
            return res.status(429).json({ error: 'Trop de tentatives. Recommencez la connexion.' });
        }

        if (!users[userIndex].otp_code || users[userIndex].otp_expires < Date.now() || users[userIndex].otp_code !== otp) {
            saveUsers(users);
            return res.status(400).json({ error: 'Code incorrect. Vérifiez le code reçu.' });
        }

        // OTP valide → générer token appareil de confiance
        const deviceToken = crypto.randomBytes(32).toString('hex');
        if (!Array.isArray(users[userIndex].trustedDevices)) users[userIndex].trustedDevices = [];
        users[userIndex].trustedDevices.push({ token: deviceToken, createdAt: new Date().toISOString() });
        if (users[userIndex].trustedDevices.length > 5) users[userIndex].trustedDevices.shift(); // max 5 appareils

        // Nettoyer OTP et pending token
        users[userIndex].otp_code = null;
        users[userIndex].otp_expires = null;
        users[userIndex].otp_attempts = 0;
        users[userIndex].pending_token = null;
        users[userIndex].pending_token_expires = null;

        // Générer session (JWT, survit aux redéploiements Render)
        const sessionToken = signClientToken(users[userIndex]);
        users[userIndex].sessionToken = sessionToken;
        users[userIndex].lastLogin = new Date().toISOString();
        users[userIndex].updatedAt = new Date().toISOString();
        saveUsers(users);

        console.log('[OTP] Vérifié, appareil enregistré: ' + users[userIndex].email);

        const userResponse = { ...users[userIndex] };
        delete userResponse.password;
        delete userResponse.trustedDevices;
        delete userResponse.otp_code;
        delete userResponse.pending_token;
        delete userResponse.reset_token;

        res.json({ success: true, user: userResponse, token: sessionToken, deviceToken });
    } catch (error) {
        console.error('[VERIFY OTP]', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PUT /api/auth/update-profile
 * Mettre a jour le profil utilisateur
 */
app.put('/api/auth/update-profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token d\'authentification requis' });
        }

        const token = authHeader.split(' ')[1];
        const users = loadUsers();
        const userIndex = findUserIndexByToken(token, users);

        if (userIndex === -1) {
            return res.status(401).json({ error: 'Session invalide ou expirée' });
        }

        const { prenom, nom, telephone, currentPassword, newPassword } = req.body;

        // Mettre a jour les champs autorises
        if (prenom) users[userIndex].prenom = prenom.trim();
        if (nom) users[userIndex].nom = nom.trim();
        if (telephone !== undefined) users[userIndex].telephone = telephone ? telephone.trim() : null;

        // Changement de mot de passe
        if (currentPassword && newPassword) {
            const isValidPassword = await bcrypt.compare(currentPassword, users[userIndex].password);
            if (!isValidPassword) {
                return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caracteres' });
            }

            const salt = await bcrypt.genSalt(10);
            users[userIndex].password = await bcrypt.hash(newPassword, salt);
        }

        users[userIndex].updatedAt = new Date().toISOString();
        saveUsers(users);

        // Retourner l'utilisateur mis a jour
        const userResponse = { ...users[userIndex] };
        delete userResponse.password;

        res.json({
            success: true,
            message: 'Profil mis a jour',
            user: userResponse
        });

    } catch (error) {
        console.error('Erreur mise a jour profil:', error);
        res.status(500).json({ error: 'Erreur lors de la mise a jour' });
    }
});

/**
 * POST /api/auth/change-password
 * Changer uniquement le mot de passe (appelé depuis app.html mon-compte).
 * Alias vers la logique de changement déjà dans PUT /api/auth/update-profile.
 */
app.post('/api/auth/change-password', async (req, res) => {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;
        var { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'currentPassword et newPassword requis' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
        }
        var users = loadUsers();
        var idx = users.findIndex(function(u) { return u.email && u.email.toLowerCase() === user.email.toLowerCase(); });
        if (idx === -1) return res.status(404).json({ error: 'Utilisateur introuvable' });
        var valid = await bcrypt.compare(currentPassword, users[idx].password);
        if (!valid) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
        var salt = await bcrypt.genSalt(10);
        users[idx].password = await bcrypt.hash(newPassword, salt);
        users[idx].updatedAt = new Date().toISOString();
        saveUsers(users);
        res.json({ success: true, message: 'Mot de passe modifié avec succès' });
    } catch(e) {
        console.error('[CHANGE-PWD]', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// ROUTES - GESTION DU COMPTE (Desactivation / Suppression)
// ============================================================

/**
 * PUT /api/auth/deactivate-account
 * Desactiver temporairement son compte (auth requise)
 */
app.put('/api/auth/deactivate-account', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token requis' });
        }

        const token = authHeader.split(' ')[1];
        const users = loadUsers();
        const userIndex = findUserIndexByToken(token, users);

        if (userIndex === -1) {
            return res.status(401).json({ error: 'Session invalide' });
        }

        users[userIndex].accountStatus = 'deactivated';
        users[userIndex].deactivatedAt = new Date().toISOString();
        users[userIndex].sessionToken = null;
        users[userIndex].updatedAt = new Date().toISOString();
        saveUsers(users);

        console.log(`[AUTH] Compte desactive: ${users[userIndex].email}`);

        res.json({ success: true, message: 'Compte désactivé avec succès' });

    } catch (error) {
        console.error('Erreur desactivation compte:', error);
        res.status(500).json({ error: 'Erreur lors de la désactivation' });
    }
});

/**
 * PUT /api/auth/reactivate-account
 * Reactiver un compte desactive (pas de token, utilise email+password)
 */
app.put('/api/auth/reactivate-account', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        const users = loadUsers();
        const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

        if (userIndex === -1) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const user = users[userIndex];

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        if (user.accountStatus !== 'deactivated') {
            return res.status(400).json({ error: 'Ce compte n\'est pas désactivé' });
        }

        users[userIndex].accountStatus = 'active';
        delete users[userIndex].deactivatedAt;
        users[userIndex].updatedAt = new Date().toISOString();
        saveUsers(users);

        console.log(`[AUTH] Compte reactive: ${email}`);

        res.json({ success: true, message: 'Compte réactivé avec succès. Vous pouvez maintenant vous connecter.' });

    } catch (error) {
        console.error('Erreur reactivation compte:', error);
        res.status(500).json({ error: 'Erreur lors de la réactivation' });
    }
});

/**
 * DELETE /api/auth/delete-account
 * Supprimer definitivement son compte (auth requise + confirmation mot de passe)
 */
app.delete('/api/auth/delete-account', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token requis' });
        }

        const token = authHeader.split(' ')[1];
        const users = loadUsers();
        const userIndex = findUserIndexByToken(token, users);

        if (userIndex === -1) {
            return res.status(401).json({ error: 'Session invalide' });
        }

        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Mot de passe requis pour confirmer la suppression' });
        }

        const user = users[userIndex];
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Mot de passe incorrect' });
        }

        const deletedEmail = user.email;
        users.splice(userIndex, 1);
        saveUsers(users);

        console.log(`[AUTH] Compte supprime definitivement: ${deletedEmail}`);

        res.json({ success: true, message: 'Compte supprimé définitivement' });

    } catch (error) {
        console.error('Erreur suppression compte:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

/**
 * DELETE /api/partner/account
 * Suppression définitive du compte prestataire (auth + confirmation mot de passe)
 */
app.delete('/api/partner/account', authenticatePartner, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Mot de passe requis pour confirmer la suppression' });
        }
        const partners = loadPartners();
        const idx = partners.findIndex(p => p.id === req.partner.id);
        if (idx === -1) return res.status(404).json({ error: 'Compte introuvable' });

        const partner = partners[idx];
        const isValid = await bcrypt.compare(password, partner.password);
        if (!isValid) return res.status(401).json({ error: 'Mot de passe incorrect' });

        const deletedEmail = partner.email;
        partners.splice(idx, 1);
        savePartners(partners);
        console.log(`[PARTNER] Compte supprimé définitivement: ${deletedEmail}`);
        res.json({ ok: true, message: 'Compte supprimé définitivement' });
    } catch(e) {
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// ============================================================
// ROUTES - GESTION DES STATUTS (Admin)
// ============================================================

/**
 * PUT /api/orders/:orderId/status (Admin)
 * Mettre a jour le statut d'une commande
 */
app.put('/api/orders/:orderId/status', (req, res) => {
    try {
        const { status } = req.body;
        const { orderId } = req.params;

        const validStatuses = ['pending_deposit', 'active', 'in_progress', 'delivered', 'completed', 'pending_balance', 'paid_in_full', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Statut invalide', valid_statuses: validStatuses });
        }

        const order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvee' });
        }

        const updatedOrder = updateOrder(orderId, { status: status });

        console.log(`[ORDER] Statut mis a jour: ${orderId} -> ${status}`);

        res.json({ success: true, order: updatedOrder });

    } catch (error) {
        console.error('Erreur mise a jour statut:', error);
        res.status(500).json({ error: 'Erreur lors de la mise a jour' });
    }
});

/**
 * PUT /api/orders/:orderId/mark-delivered (Admin)
 * Marquer une prestation individuelle comme livree
 * Cela declenche la demande de paiement du solde
 */
app.put('/api/orders/:orderId/mark-delivered', (req, res) => {
    try {
        const { orderId } = req.params;

        const order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvee' });
        }

        if (order.product_type !== 'prestation_individuelle') {
            return res.status(400).json({ error: 'Cette action est reservee aux prestations individuelles' });
        }

        const updatedOrder = updateOrder(orderId, { status: 'delivered' });

        console.log(`[ORDER] Prestation livree: ${orderId} - En attente du solde`);

        res.json({
            success: true,
            order: updatedOrder,
            message: 'Prestation marquee comme livree. Le client peut maintenant payer le solde.'
        });

    } catch (error) {
        console.error('Erreur mark-delivered:', error);
        res.status(500).json({ error: 'Erreur lors de la mise a jour' });
    }
});

/**
 * PUT /api/orders/:orderId/mark-completed (Admin)
 * Marquer un accompagnement comme termine
 * Cela declenche la demande de paiement du solde
 */
app.put('/api/orders/:orderId/mark-completed', (req, res) => {
    try {
        const { orderId } = req.params;

        const order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvee' });
        }

        if (order.product_type !== 'accompagnement') {
            return res.status(400).json({ error: 'Cette action est reservee aux accompagnements' });
        }

        const updatedOrder = updateOrder(orderId, { status: 'completed' });

        console.log(`[ORDER] Accompagnement termine: ${orderId} - En attente du solde`);

        res.json({
            success: true,
            order: updatedOrder,
            message: 'Accompagnement marque comme termine. Le client peut maintenant payer le solde.'
        });

    } catch (error) {
        console.error('Erreur mark-completed:', error);
        res.status(500).json({ error: 'Erreur lors de la mise a jour' });
    }
});

/**
 * POST /api/admin/orders/:orderId/confirm-deposit
 * Confirmer manuellement le paiement de l'acompte (sans SumUp)
 */
app.post('/api/admin/orders/:orderId/confirm-deposit', function(req, res) {
    try {
        var orderId = req.params.orderId;
        var order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvee' });
        }
        if (order.deposit_paid) {
            return res.status(400).json({ error: 'Acompte deja marque comme paye' });
        }

        var updates = {
            deposit_paid: true,
            deposit_paid_at: new Date().toISOString(),
            status: 'active',
            schedule_status: 'awaiting_client_choice',
            proposed_start_date: null,
            schedule_confirmed_by_admin: false,
            schedule_confirmed_by_partner: false
        };
        var updatedOrder = updateOrder(orderId, updates);

        // Synchroniser paymentStatus dans users.json
        try {
            if (updatedOrder && updatedOrder.client_info && updatedOrder.client_info.email) {
                var allUsers = loadUsers();
                var uIdx = allUsers.findIndex(function(u) {
                    return u.email && u.email.toLowerCase() === updatedOrder.client_info.email.toLowerCase();
                });
                if (uIdx !== -1) {
                    allUsers[uIdx].paymentStatus = 'deposit_paid';
                    allUsers[uIdx].payment_status = 'deposit_paid';
                    allUsers[uIdx].activeOrderId = orderId;
                    saveUsers(allUsers);
                    console.log('[ADMIN] Acompte confirme manuellement: ' + updatedOrder.client_info.email + ' → deposit_paid');
                }
            }
        } catch (syncErr) {
            console.error('[ADMIN] Erreur sync users apres confirmation acompte:', syncErr.message);
        }

        res.json({ success: true, order: updatedOrder });
    } catch (err) {
        console.error('[ADMIN] Erreur confirm-deposit:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/orders/:orderId/unlock-balance
 * Déclarer la fin de l'accompagnement → débloque le paiement du solde pour le client
 */
app.post('/api/admin/orders/:orderId/unlock-balance', function(req, res) {
    try {
        var orderId = req.params.orderId;
        var order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvee' });
        }
        if (!order.deposit_paid) {
            return res.status(400).json({ error: 'L\'acompte n\'a pas encore été payé' });
        }
        if (order.balance_paid) {
            return res.status(400).json({ error: 'Le solde a déjà été payé' });
        }
        if (order.balance_payment_ready) {
            return res.status(400).json({ error: 'Le solde est déjà débloqué' });
        }

        var updates = {
            balance_payment_ready: true,
            balance_unlocked_at: new Date().toISOString(),
            balance_unlocked_by: 'admin',
            status: 'pending_balance'
        };
        var updatedOrder = updateOrder(orderId, updates);

        var clientEmail = updatedOrder && updatedOrder.client_info && updatedOrder.client_info.email;
        var clientName = updatedOrder && updatedOrder.client_info
            ? ((updatedOrder.client_info.prenom || '') + ' ' + (updatedOrder.client_info.nom || '')).trim()
            : '';

        // Synchroniser paymentStatus dans users.json
        try {
            if (clientEmail) {
                var allUsers = loadUsers();
                var uIdx = allUsers.findIndex(function(u) {
                    return u.email && u.email.toLowerCase() === clientEmail.toLowerCase();
                });
                if (uIdx !== -1) {
                    allUsers[uIdx].paymentStatus = 'delivery_pending_payment';
                    allUsers[uIdx].payment_status = 'delivery_pending_payment';
                    saveUsers(allUsers);
                    console.log('[ADMIN] Solde débloqué: ' + clientEmail + ' → delivery_pending_payment');
                }
            }
        } catch (syncErr) {
            console.error('[ADMIN] Erreur sync users apres unlock-balance:', syncErr.message);
        }

        // Envoyer email de notification au client
        if (clientEmail && clientName) {
            emailService.sendAccompanimentEndNotification(
                clientEmail,
                clientName,
                'admin',
                updatedOrder.product_name || '',
                updatedOrder.balance_amount || 0
            ).catch(function(e) {
                console.error('[ADMIN] Erreur email fin accompagnement:', e.message);
            });
        }

        res.json({ success: true, order: updatedOrder });
    } catch (err) {
        console.error('[ADMIN] Erreur unlock-balance:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// ROUTES - MESSAGERIE INTERNE (chat client <-> admin/partenaire)
// Utilise chat.json separe des messages de contact (messages.json)
// ============================================================

var CHAT_FILE = path.join(__dirname, 'data', 'chat.json');
var SUPPORT_TICKETS_FILE = path.join(__dirname, 'data', 'support-tickets.json');

function loadChat() {
    try {
        if (fs.existsSync(CHAT_FILE)) {
            var data = fs.readFileSync(CHAT_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) { console.error('[CHAT] Erreur lecture:', e.message); }
    return [];
}

function saveChat(msgs) {
    try { fs.writeFileSync(CHAT_FILE, JSON.stringify(msgs, null, 2), 'utf8'); }
    catch (e) { console.error('[CHAT] Erreur ecriture:', e.message); }
}

function loadSupportTickets() {
    try {
        if (fs.existsSync(SUPPORT_TICKETS_FILE)) {
            var data = fs.readFileSync(SUPPORT_TICKETS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch(e) { console.error('[SUPPORT] Erreur lecture:', e.message); }
    return [];
}

function saveSupportTickets(tickets) {
    try { fs.writeFileSync(SUPPORT_TICKETS_FILE, JSON.stringify(tickets, null, 2), 'utf8'); }
    catch(e) { console.error('[SUPPORT] Erreur ecriture:', e.message); }
}

// Détection anti-contournement : téléphone, email, URL, réseaux sociaux dans le contenu d'un message
var CONTOURNEMENT_PATTERNS = [
    /\b0[1-9](?:[\s.\-]?\d{2}){4}\b/,
    /\+\d{1,3}[\s.\-]?(?:\d[\s.\-]?){6,12}/,
    /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,
    /https?:\/\/\S+/i,
    /\bwww\.\S+/i,
    /@[a-z0-9_.]{3,}/i,
    /\b(instagram|insta|whatsapp|telegram|snapchat|snap|tiktok|facebook|messenger)\b/i
];

function detectContournement(text) {
    if (!text) return false;
    for (var i = 0; i < CONTOURNEMENT_PATTERNS.length; i++) {
        if (CONTOURNEMENT_PATTERNS[i].test(text)) return true;
    }
    return false;
}

var CONTOURNEMENT_MESSAGE = 'Le partage de coordonnées personnelles (téléphone, email, réseaux sociaux) est interdit avant la signature du contrat. Merci de rester sur la messagerie FA GENESIS.';
var MESSAGING_SUSPENDED_MESSAGE = 'Votre messagerie a été suspendue suite à plusieurs tentatives de partage de coordonnées personnelles. Contactez le support FA GENESIS.';

// Pièces jointes (fichiers/images) : même approche base64 inline que partner-uploads.json (pas de multipart)
var ATTACHMENT_ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
var ATTACHMENT_MAX_COUNT = 3;
var ATTACHMENT_MAX_TOTAL_CHARS = 6 * 1024 * 1024;

function validateAttachments(attachments) {
    if (!attachments) return { ok: true, attachments: [] };
    if (!Array.isArray(attachments)) return { ok: false, error: 'Pièces jointes invalides' };
    if (attachments.length > ATTACHMENT_MAX_COUNT) return { ok: false, error: 'Maximum ' + ATTACHMENT_MAX_COUNT + ' fichiers par message' };
    var totalChars = 0;
    var clean = [];
    for (var i = 0; i < attachments.length; i++) {
        var a = attachments[i];
        if (!a || !a.dataUrl || !a.name) return { ok: false, error: 'Pièce jointe invalide' };
        var ext = (a.name.split('.').pop() || '').toLowerCase();
        if (ATTACHMENT_ALLOWED_EXT.indexOf(ext) === -1) return { ok: false, error: 'Type de fichier non autorisé : ' + ext };
        totalChars += a.dataUrl.length;
        clean.push({ name: String(a.name).substring(0, 200), type: a.type || '', dataUrl: a.dataUrl });
    }
    if (totalChars > ATTACHMENT_MAX_TOTAL_CHARS) return { ok: false, error: 'Pièces jointes trop volumineuses' };
    return { ok: true, attachments: clean };
}

// Escalade : avertissement (1-2) puis suspension (3+). Champs ajoutés paresseusement sur le compte (user ou partner).
function registerContournementViolation(account) {
    account.messagingWarnings = (account.messagingWarnings || 0) + 1;
    if (account.messagingWarnings >= 3) account.messagingBlocked = true;
    return account.messagingWarnings;
}

/**
 * GET /api/my-partners — Client recupere les partenaires assignes a sa commande
 * Utilise pour alimenter le selecteur de destinataires dans messagerie.html
 */
app.get('/api/my-partners', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '').trim();
        var users = loadUsers();
        var user = findUserByToken(token);
        if (!user) return res.status(401).json({ error: 'Session invalide' });

        // Trouver la commande payee du client
        var orders = loadOrders();
        var paidOrder = null;
        for (var i = 0; i < orders.length; i++) {
            var o = orders[i];
            if (o.client_info && o.client_info.email &&
                o.client_info.email.toLowerCase() === user.email.toLowerCase() &&
                o.deposit_paid === true) {
                paidOrder = o;
                break;
            }
        }

        if (!paidOrder) {
            return res.json({ ok: true, partners: [] });
        }

        // Trouver les assignments de cette commande
        var allAssignments = loadPartnerAssignments();
        var orderAssignments = allAssignments.filter(function(a) {
            return a.order_id === paidOrder.id && a.status === 'active';
        });

        if (orderAssignments.length === 0) {
            return res.json({ ok: true, partners: [] });
        }

        // Recuperer les infos des partenaires
        var allPartners = loadPartners();
        var partnerTypeLabels = {
            'photographer': 'Photographe',
            'videographer': 'Vidéaste',
            'marketer': 'Consultant Marketing',
            'media': 'Spécialiste Média'
        };

        var result = [];
        orderAssignments.forEach(function(a) {
            var p = allPartners.find(function(pt) { return pt.id === a.partner_id; });
            if (p && p.email) {
                var name = ((p.prenom || p.firstName || '') + ' ' + (p.nom || p.lastName || '')).trim() || p.email;
                var typeLabel = partnerTypeLabels[p.partner_type] || p.partner_type || 'Partenaire';
                result.push({
                    email: p.email,
                    name: name,
                    partner_type: p.partner_type || '',
                    label: typeLabel + ' — ' + name
                });
            }
        });

        res.json({ ok: true, partners: result });
    } catch (err) {
        console.error('[MY-PARTNERS] Erreur:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/messages — Client recupere ses messages de chat
 */
app.get('/api/messages', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var users = loadUsers();
        var user = findUserByToken(token);
        if (!user) return res.status(401).json({ error: 'Session invalide' });

        var msgs = loadChat();
        var myMsgs = msgs.filter(function(m) {
            return m.from_email === user.email || m.to_email === user.email;
        });
        myMsgs.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        res.json({ ok: true, messages: myMsgs });
    } catch (err) {
        console.error('[CHAT] Erreur GET client:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/messages — Client envoie un message de chat
 */
app.post('/api/messages', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var users = loadUsers();
        var user = findUserByToken(token);
        if (!user) return res.status(401).json({ error: 'Session invalide' });

        if (user.messagingBlocked) {
            return res.status(403).json({ error: 'messaging_suspended', message: MESSAGING_SUSPENDED_MESSAGE });
        }

        var content = (req.body.content || '').trim();
        if (!content) return res.status(400).json({ error: 'Message vide' });

        if (detectContournement(content)) {
            var warnings = registerContournementViolation(user);
            saveUsers(users);
            if (user.messagingBlocked) {
                return res.status(403).json({ error: 'messaging_suspended', message: MESSAGING_SUSPENDED_MESSAGE });
            }
            return res.status(400).json({ error: 'contournement', message: CONTOURNEMENT_MESSAGE, warnings: warnings });
        }

        var attResult = validateAttachments(req.body.attachments);
        if (!attResult.ok) return res.status(400).json({ error: attResult.error });

        var toType = req.body.to_type || 'admin';
        var toId = req.body.to_id || null; // email partenaire si partenaire
        var toEmail = 'admin';
        var toName = 'FA GENESIS';

        if (toType === 'partner' && toId) {
            var partners = loadPartners();
            var targetPartner = partners.find(function(p) { return p.email === toId || p.id === toId; });
            if (!targetPartner) return res.status(404).json({ error: 'Partenaire introuvable' });
            toEmail = targetPartner.email;
            toName = ((targetPartner.prenom || '') + ' ' + (targetPartner.nom || '')).trim();
        }

        var newMsg = {
            id: 'MSG-' + uuidv4().split('-')[0].toUpperCase(),
            from_email: user.email,
            from_name: ((user.prenom || '') + ' ' + (user.nom || '')).trim() || user.email,
            from_type: 'client',
            to_type: toType,
            to_id: toId,
            to_email: toEmail,
            to_name: toName.trim(),
            subject: req.body.subject || '',
            content: content,
            attachments: attResult.attachments,
            created_at: new Date().toISOString(),
            read_at: null
        };

        var msgs = loadChat();
        msgs.push(newMsg);
        saveChat(msgs);
        console.log('[CHAT] Client ' + user.email + ' -> ' + toType + ' : ' + content.substring(0, 50));
        // Push au destinataire
        var senderDisplayName = ((user.prenom || '') + ' ' + (user.nom || '')).trim() || user.email;
        if (toType === 'admin') {
            notifyUser(null, 'admin', 'message-client', 'Message de ' + senderDisplayName, content.substring(0, 100), '/app.html#open-admin');
        } else if (toType === 'partner' && toEmail) {
            notifyUser(toEmail, 'partner', 'message-client', 'Message de ' + senderDisplayName, content.substring(0, 100), '/app.html#open-partner');
        }
        res.json({ ok: true, message: newMsg });
    } catch (err) {
        console.error('[CHAT] Erreur POST client:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PATCH /api/messages/:id/read — Marquer un message de chat comme lu
 */
app.patch('/api/messages/:id/read', function(req, res) {
    try {
        var msgs = loadChat();
        var idx = msgs.findIndex(function(m) { return m.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Message introuvable' });
        msgs[idx].read_at = new Date().toISOString();
        saveChat(msgs);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/admin/inbox — Admin recupere tous les messages du chat client
 */
app.get('/api/admin/inbox', function(req, res) {
    try {
        var msgs = loadChat();
        msgs.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        res.json({ ok: true, messages: msgs });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/inbox/reply — Admin repond a un client
 */
app.post('/api/admin/inbox/reply', function(req, res) {
    try {
        var toEmail = req.body.to_email;
        var content = (req.body.content || '').trim();
        if (!toEmail || !content) return res.status(400).json({ error: 'to_email et content requis' });

        var attResult = validateAttachments(req.body.attachments);
        if (!attResult.ok) return res.status(400).json({ error: attResult.error });

        var newMsg = {
            id: 'MSG-' + uuidv4().split('-')[0].toUpperCase(),
            from_email: process.env.ADMIN_EMAIL || 'admin@fagenesis.com',
            from_name: 'FA GENESIS',
            from_type: 'admin',
            to_type: 'client',
            to_id: null,
            to_email: toEmail,
            to_name: req.body.to_name || '',
            subject: req.body.subject || '',
            content: content,
            attachments: attResult.attachments,
            created_at: new Date().toISOString(),
            read_at: null
        };

        var msgs = loadChat();
        msgs.push(newMsg);
        saveChat(msgs);
        console.log('[CHAT] Admin -> ' + toEmail + ' : ' + content.substring(0, 50));
        res.json({ ok: true, message: newMsg });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/partner/inbox — Partenaire recupere ses messages du chat client
 */
app.get('/api/partner/inbox', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var msgs = loadChat();
        var myMsgs = msgs.filter(function(m) {
            return (m.to_type === 'partner' && m.to_email === partner.email) ||
                   (m.from_type === 'partner' && m.from_email === partner.email);
        });
        myMsgs.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        res.json({ ok: true, messages: myMsgs });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/partner/inbox/reply — Partenaire repond a un client
 */
app.post('/api/partner/inbox/reply', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var allPartners = loadPartners();
        var pIndex = allPartners.findIndex(function(p) { return p.id === partner.id; });

        if (pIndex !== -1 && allPartners[pIndex].messagingBlocked) {
            return res.status(403).json({ error: 'messaging_suspended', message: MESSAGING_SUSPENDED_MESSAGE });
        }

        var toEmail = req.body.to_email;
        var content = (req.body.content || '').trim();
        if (!toEmail || !content) return res.status(400).json({ error: 'to_email et content requis' });

        if (detectContournement(content)) {
            if (pIndex !== -1) {
                var warnings = registerContournementViolation(allPartners[pIndex]);
                savePartners(allPartners);
                if (allPartners[pIndex].messagingBlocked) {
                    return res.status(403).json({ error: 'messaging_suspended', message: MESSAGING_SUSPENDED_MESSAGE });
                }
                return res.status(400).json({ error: 'contournement', message: CONTOURNEMENT_MESSAGE, warnings: warnings });
            }
            return res.status(400).json({ error: 'contournement', message: CONTOURNEMENT_MESSAGE });
        }

        var attResult = validateAttachments(req.body.attachments);
        if (!attResult.ok) return res.status(400).json({ error: attResult.error });

        var thread = loadChat().filter(function(m) {
            return (m.from_email === partner.email && m.to_email === toEmail) ||
                   (m.from_email === toEmail && m.to_email === partner.email);
        }).sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        var lastFromClient = thread.find(function(m) { return m.from_type === 'client'; });
        if (lastFromClient) {
            var deltaMinutes = (new Date() - new Date(lastFromClient.created_at)) / 60000;
            if (deltaMinutes >= 0 && deltaMinutes < 60 * 24 * 14) {
                if (pIndex !== -1) {
                    var samples = allPartners[pIndex].responseSamples || 0;
                    var prevAvg = allPartners[pIndex].avgResponseMinutes || 0;
                    allPartners[pIndex].avgResponseMinutes = ((prevAvg * samples) + deltaMinutes) / (samples + 1);
                    allPartners[pIndex].responseSamples = samples + 1;
                    savePartners(allPartners);
                }
            }
        }

        var newMsg = {
            id: 'MSG-' + uuidv4().split('-')[0].toUpperCase(),
            from_email: partner.email,
            from_name: ((partner.prenom || '') + ' ' + (partner.nom || '')).trim(),
            from_type: 'partner',
            to_type: 'client',
            to_id: null,
            to_email: toEmail,
            to_name: req.body.to_name || '',
            subject: req.body.subject || '',
            content: content,
            attachments: attResult.attachments,
            created_at: new Date().toISOString(),
            read_at: null
        };

        var msgs = loadChat();
        msgs.push(newMsg);
        saveChat(msgs);
        console.log('[CHAT] Partenaire ' + partner.email + ' -> ' + toEmail + ' : ' + content.substring(0, 50));
        res.json({ ok: true, message: newMsg });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// ROUTES - MESSAGERIE ENTRE COLLÈGUES PARTENAIRES (P2P)
// ============================================================

/**
 * GET /api/partner/peers — Partenaires actifs de même catégorie (hors soi-même)
 */
app.get('/api/partner/peers', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var peers = loadPartners().filter(function(p) {
            return p.id !== partner.id &&
                   p.partner_type === partner.partner_type &&
                   p.accountStatus === 'active' &&
                   p.contract_signed === true;
        }).map(function(p) {
            var ratingSummary = getPartnerRatingSummary(p.id);
            var badge = getPartnerBadge(p, ratingSummary);
            var missionsCompleted = getPartnerMissionsCompleted(p.id);
            return {
                id:                p.id,
                prenom:            p.prenom || '',
                nom:               p.nom || '',
                email:             p.email || '',
                photo:             p.photo || null,
                city:              p.city || '',
                bio:               (p.bio || '').slice(0, 120),
                partner_type:      p.partner_type || '',
                badge:             badge,
                founderBadge:      p.founderBadge || false,
                rating:            ratingSummary,
                missionsCompleted: missionsCompleted,
                services:          (p.services || []).filter(function(s){ return s.active !== false; }).slice(0,3).map(function(s){ return { label: s.label, price: s.price }; })
            };
        });
        res.json({ ok: true, peers: peers });
    } catch(err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/partner/peer-inbox — Conversations P2P impliquant ce partenaire
 */
app.get('/api/partner/peer-inbox', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var msgs = loadChat().filter(function(m) {
            return m.from_type === 'partner' && m.to_type === 'partner' &&
                   (m.from_email === partner.email || m.to_email === partner.email);
        });
        msgs.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        res.json({ ok: true, messages: msgs });
    } catch(err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/partner/peer-message — Envoyer un message à un collègue de même catégorie
 */
app.post('/api/partner/peer-message', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var toPartnerId = (req.body.to_partner_id || '').trim();
        var content     = (req.body.content || '').trim();
        if (!toPartnerId || !content) {
            return res.status(400).json({ error: 'to_partner_id et content requis' });
        }
        if (detectContournement(content)) {
            return res.status(400).json({ error: 'contournement', message: CONTOURNEMENT_MESSAGE });
        }
        var allPartners = loadPartners();
        var toPeer = allPartners.find(function(p) { return p.id === toPartnerId; });
        if (!toPeer) return res.status(404).json({ error: 'Collègue introuvable' });
        if (toPeer.partner_type !== partner.partner_type) {
            return res.status(403).json({ error: 'Messagerie disponible uniquement entre partenaires de même catégorie' });
        }
        var msg = {
            id:           'MSG-' + uuidv4().split('-')[0].toUpperCase(),
            from_email:   partner.email,
            from_name:    ((partner.prenom || '') + ' ' + (partner.nom || '')).trim(),
            from_type:    'partner',
            to_type:      'partner',
            to_email:     toPeer.email,
            to_name:      ((toPeer.prenom || '') + ' ' + (toPeer.nom || '')).trim(),
            to_partner_id: toPartnerId,
            content:      content,
            attachments:  [],
            created_at:   new Date().toISOString(),
            read_at:      null
        };
        var msgs = loadChat();
        msgs.push(msg);
        saveChat(msgs);
        res.json({ ok: true, message: msg });
    } catch(err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// ROUTES - GESTION DES SEANCES (Admin)
// ============================================================

const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

function loadSessions() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Erreur lecture sessions:', error);
    }
    return [];
}

function saveSessions(sessions) {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
        persistentStore.persistToCloud('sessions', sessions).catch(function(e) {});
    } catch (error) {
        console.error('Erreur sauvegarde sessions:', error);
    }
}

/**
 * GET /api/admin/sessions
 * Recuperer toutes les seances (Admin)
 */
app.get('/api/admin/sessions', function(req, res) {
    try {
        res.json(loadSessions());
    } catch (e) {
        console.error('[ADMIN] Erreur GET /api/admin/sessions:', e);
        res.status(500).json({ error: 'Erreur serveur', detail: e.message });
    }
});

/**
 * GET /api/admin/sessions/user/:userEmail
 * Recuperer les seances d'un client specifique (Admin)
 */
app.get('/api/admin/sessions/user/:userEmail', function(req, res) {
    try {
        var userEmail = req.params.userEmail;
        var sessions = loadSessions();
        var userSessions = sessions.filter(function(s) { return s.userEmail.toLowerCase() === userEmail.toLowerCase(); });
        res.json(userSessions);
    } catch (e) {
        console.error('[ADMIN] Erreur GET /api/admin/sessions/user:', e);
        res.status(500).json({ error: 'Erreur serveur', detail: e.message });
    }
});

// Helper : authentifier un client via Bearer token
function authenticateClient(req, res) {
    var authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token d\'authentification requis' });
        return null;
    }
    var token = authHeader.split(' ')[1];
    var users = loadUsers();
    var user = findUserByToken(token);
    if (!user) {
        res.status(401).json({ error: 'Session invalide ou expiree' });
        return null;
    }
    return user;
}

// PUT /api/clients/update-personalization — thème, bannière, bio enrichie (Créateur+)
app.put('/api/clients/update-personalization', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var completedOrders = getClientCompletedOrders(user.email);
        var qgPoints = getClientGenesisPoints(user, completedOrders);
        var badge = getClientQGBadge(qgPoints);
        if (!badge) return res.status(403).json({ error: 'Niveau Créateur requis pour personnaliser votre profil' });

        var VALID_THEMES = ['genesis','blue','green','purple','red'];
        var VALID_GENESIS_BANNERS = ['genesis:bronze','genesis:argent','genesis:or','genesis:elite'];
        var LEVEL_ORDER = { bronze:1, argent:2, or:3, elite:4 };

        var users = loadUsers();
        var idx = users.findIndex(function(u) { return u.id === user.id; });
        if (idx === -1) return res.status(404).json({ error: 'Utilisateur non trouvé' });

        var profile_bio    = req.body.profile_bio;
        var profile_theme  = req.body.profile_theme;
        var profile_banner = req.body.profile_banner;

        if (typeof profile_bio === 'string') {
            users[idx].profile_bio = profile_bio.slice(0, 500);
        }
        if (typeof profile_theme === 'string' && VALID_THEMES.indexOf(profile_theme) !== -1) {
            users[idx].profile_theme = profile_theme;
        }
        if (profile_banner === null || profile_banner === undefined) {
            users[idx].profile_banner = null;
        } else if (typeof profile_banner === 'string' && VALID_GENESIS_BANNERS.indexOf(profile_banner) !== -1) {
            var bannerLevelId = profile_banner.split(':')[1];
            var userLevelOrd  = LEVEL_ORDER[badge] || 0;
            var bannerLevelOrd = LEVEL_ORDER[bannerLevelId] || 0;
            if (bannerLevelOrd > userLevelOrd) {
                return res.status(403).json({ error: 'Niveau insuffisant pour cette bannière' });
            }
            users[idx].profile_banner = profile_banner;
        } else if (typeof profile_banner === 'string' && profile_banner.startsWith('data:image/')) {
            if (!/^data:image\/(jpeg|png|webp);base64,/.test(profile_banner)) {
                return res.status(400).json({ error: 'Format d\'image non supporté' });
            }
            if (profile_banner.length > 300000) {
                return res.status(400).json({ error: 'Image trop volumineuse après compression' });
            }
            users[idx].profile_banner = profile_banner;
        } else if (typeof profile_banner === 'string') {
            return res.status(400).json({ error: 'Format de bannière invalide' });
        }

        users[idx].updatedAt = new Date().toISOString();
        saveUsers(users);
        res.json({ success: true });
    } catch (error) {
        console.error('[CLIENT] Erreur update-personalization:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
});

// PUT /api/clients/preferences — préférences de types de prestataires (Alertes intelligentes Bâtisseur+)
app.put('/api/clients/preferences', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;
        var preferred = req.body.preferred_partner_types;
        if (!Array.isArray(preferred)) return res.status(400).json({ error: 'preferred_partner_types doit etre un tableau' });
        var validTypes = preferred.filter(function(t) { return PARTNER_TYPE_VALUES.indexOf(t) !== -1; });
        var users = loadUsers();
        var idx = users.findIndex(function(u) { return u.id === user.id; });
        if (idx === -1) return res.status(404).json({ error: 'Utilisateur non trouvé' });
        users[idx].preferred_partner_types = validTypes;
        users[idx].updatedAt = new Date().toISOString();
        saveUsers(users);
        res.json({ success: true, preferred_partner_types: validTypes });
    } catch(e) {
        console.error('[CLIENT] Erreur update preferences:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/clients/update-profile — le client modifie son propre profil (nom/téléphone/photo)
app.put('/api/clients/update-profile', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var prenom = req.body.prenom;
        var nom = req.body.nom;
        var telephone = req.body.telephone;
        var photo = req.body.photo;

        var users = loadUsers();
        var index = users.findIndex(function(u) { return u.id === user.id; });
        if (index === -1) return res.status(404).json({ error: 'Utilisateur non trouvé' });

        if (typeof prenom === 'string' && prenom.trim()) users[index].prenom = prenom.trim();
        if (typeof nom === 'string') users[index].nom = nom.trim();
        if (typeof telephone === 'string') users[index].telephone = telephone.trim();
        if (typeof photo === 'string' && photo) users[index].photo = photo;
        users[index].updatedAt = new Date().toISOString();

        saveUsers(users);
        var userSafe = JSON.parse(JSON.stringify(users[index]));
        delete userSafe.password;
        res.json({ success: true, user: userSafe });
    } catch (error) {
        console.error('[CLIENT] Erreur update-profile:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
    }
});

// Helper : sanitiser une session pour le client (masquer meet_url si pas CONFIRMED)
function sanitizeSessionForClient(session) {
    var s = JSON.parse(JSON.stringify(session));
    if (s.status !== 'CONFIRMED') {
        s.meet_url = null;
    }
    // Exposer notes_partner au client pour la communication bidirectionnelle
    return s;
}

/**
 * GET /api/sessions/allowed-providers
 * Retourne les types d'intervenants autorises pour l'utilisateur connecte
 */
app.get('/api/sessions/allowed-providers', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        // Trouver la commande active de l'utilisateur (priorité : commande avec acompte payé)
        var orders = loadOrders();
        var userOrders = orders.filter(function(o) {
            return o.client_info && o.client_info.email &&
                o.client_info.email.toLowerCase() === user.email.toLowerCase();
        });
        // Préférer la commande payée (deposit_paid), sinon la plus récente
        var paidOrders = userOrders.filter(function(o) { return o.deposit_paid === true; });
        var order = paidOrders.length > 0
            ? paidOrders[paidOrders.length - 1]
            : (userOrders.length > 0 ? userOrders[userOrders.length - 1] : null);

        var providers = getAllowedProviders(order);
        res.json({ ok: true, providers: providers });
    } catch (error) {
        console.error('[PROVIDERS] Erreur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/sessions/me
 * Recuperer les seances de l'utilisateur connecte
 * Supporte ancien modele (userEmail) + nouveau (client_id)
 */
app.get('/api/sessions/me', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var sessions = loadSessions();
        var email = user.email.toLowerCase();
        var userSessions = sessions.filter(function(s) {
            return (s.client_id && s.client_id.toLowerCase() === email) ||
                   (s.userEmail && s.userEmail.toLowerCase() === email);
        });

        // Trier par date (plus proche en premier)
        userSessions.sort(function(a, b) {
            var dateA = a.datetime_start || (a.date + 'T' + (a.heure || '00:00'));
            var dateB = b.datetime_start || (b.date + 'T' + (b.heure || '00:00'));
            return new Date(dateA) - new Date(dateB);
        });

        // Masquer meet_url si pas CONFIRMED
        var sanitized = userSessions.map(sanitizeSessionForClient);
        res.json(sanitized);

    } catch (error) {
        console.error('Erreur recuperation sessions:', error);
        res.status(500).json({ error: 'Erreur lors de la recuperation des seances' });
    }
});

/**
 * POST /api/sessions
 * Client cree une demande de seance (status=REQUESTED)
 * Body: { partner_id, session_type, notes_client, proposed_slots, project_id }
 */
app.post('/api/sessions', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var body = req.body;
        if (!body.session_type) {
            return res.status(400).json({ error: 'session_type requis (call, shooting, meeting)' });
        }

        // Chercher le partenaire si fourni directement ou via requested_provider_role
        var partnerName = null;
        var partnerRole = null;
        var partnerId = body.partner_id || null;
        var requestedProviderRole = body.requested_provider_role || 'admin';

        var partners = loadPartners();

        if (partnerId) {
            // Partenaire specifique fourni
            var partner = partners.find(function(p) { return p.id === partnerId; });
            if (partner) {
                partnerName = (partner.prenom || '') + ' ' + (partner.nom || '');
                partnerRole = partner.partner_type || null;
            }
        } else if (requestedProviderRole && requestedProviderRole !== 'admin') {
            // Auto-assigner un partenaire actif du type demande
            var matchingPartner = partners.find(function(p) {
                return p.partner_type === requestedProviderRole && p.accountStatus === 'active';
            });
            if (matchingPartner) {
                partnerId = matchingPartner.id;
                partnerName = (matchingPartner.prenom || '') + ' ' + (matchingPartner.nom || '');
                partnerRole = matchingPartner.partner_type;
                console.log('[SESSION] Auto-assign partenaire ' + partnerId + ' (type: ' + requestedProviderRole + ')');
            }
        }

        var now = new Date().toISOString();
        var newSession = {
            id: 'SES-' + uuidv4().split('-')[0].toUpperCase(),
            project_id: body.project_id || null,
            client_id: user.email.toLowerCase(),
            client_name: ((user.prenom || '') + ' ' + (user.nom || '')).trim() || user.email,
            partner_id: partnerId,
            partner_name: partnerName,
            partner_role: partnerRole,
            requested_provider_role: requestedProviderRole,
            session_type: body.session_type,
            datetime_start: null,
            duration_minutes: body.duration_minutes || 45,
            meet_url: null,
            location: body.location || null,
            status: 'REQUESTED',
            notes_client: body.notes_client || '',
            notes_partner: '',
            proposed_slots: body.proposed_slots || [],
            created_at: now,
            updated_at: now
        };

        var sessions = loadSessions();
        sessions.push(newSession);
        saveSessions(sessions);

        console.log('[SESSION] Demande creee: ' + newSession.id + ' par ' + user.email);

        // Email notification a l'admin
        try {
            var emailService = require('./email-service');
            var adminEmail = process.env.EMAIL_ADMIN_ADDRESS;
            if (adminEmail && emailService.sendSessionRequestedEmail) {
                emailService.sendSessionRequestedEmail(adminEmail, newSession.client_name, newSession);
            }
            // Email notification au partenaire assigne
            if (newSession.partner_id && emailService.sendSessionRequestedEmail) {
                var assignedPartner = partners.find(function(p) { return p.id === newSession.partner_id; });
                if (assignedPartner && assignedPartner.email) {
                    emailService.sendSessionRequestedEmail(assignedPartner.email, newSession.client_name, newSession);
                    console.log('[SESSION] Email envoye au partenaire ' + assignedPartner.email);
                }
            }
        } catch(e) { console.error('[SESSION] Erreur envoi email requested:', e.message); }

        res.json({ success: true, session: sanitizeSessionForClient(newSession) });

    } catch (error) {
        console.error('Erreur creation session:', error);
        res.status(500).json({ error: 'Erreur lors de la creation de la seance' });
    }
});

/**
 * POST /api/sessions/:id/accept
 * Client accepte un creneau PROPOSED -> CONFIRMED (si meet_url present) ou reste PROPOSED
 */
app.post('/api/sessions/:id/accept', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var sessions = loadSessions();
        var idx = sessions.findIndex(function(s) { return s.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Seance non trouvee' });

        var session = sessions[idx];
        if (session.client_id.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'Acces non autorise' });
        }
        if (session.status !== 'PROPOSED') {
            return res.status(400).json({ error: 'La seance doit etre en statut PROPOSED pour accepter' });
        }

        session.status = session.meet_url ? 'CONFIRMED' : 'CONFIRMED';
        session.updated_at = new Date().toISOString();
        saveSessions(sessions);

        // Envoyer email si CONFIRMED avec meet_url
        if (session.status === 'CONFIRMED' && session.meet_url) {
            try {
                var emailService = require('./email-service');
                if (emailService.sendSessionConfirmedEmail) {
                    emailService.sendSessionConfirmedEmail(session.client_id, session.client_name, session);
                }
            } catch(e) { console.error('[SESSION] Erreur envoi email confirmation:', e.message); }
        }

        console.log('[SESSION] Acceptee: ' + session.id);
        res.json({ success: true, session: sanitizeSessionForClient(session) });

    } catch (error) {
        console.error('Erreur accept session:', error);
        res.status(500).json({ error: 'Erreur' });
    }
});

/**
 * POST /api/sessions/:id/reschedule
 * Client demande reprogrammation
 * Body: { notes_client, proposed_slots }
 */
app.post('/api/sessions/:id/reschedule', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var sessions = loadSessions();
        var idx = sessions.findIndex(function(s) { return s.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Seance non trouvee' });

        var session = sessions[idx];
        if (session.client_id.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'Acces non autorise' });
        }
        if (session.status !== 'PROPOSED' && session.status !== 'CONFIRMED') {
            return res.status(400).json({ error: 'Reprogrammation impossible pour ce statut' });
        }

        session.status = 'RESCHEDULE_REQUESTED';
        if (req.body.notes_client) session.notes_client = req.body.notes_client;
        if (req.body.proposed_slots) session.proposed_slots = req.body.proposed_slots;
        session.updated_at = new Date().toISOString();
        saveSessions(sessions);

        console.log('[SESSION] Reprogrammation demandee: ' + session.id);
        res.json({ success: true, session: sanitizeSessionForClient(session) });

    } catch (error) {
        console.error('Erreur reschedule session:', error);
        res.status(500).json({ error: 'Erreur' });
    }
});

/**
 * POST /api/sessions/:id/cancel
 * Client annule une seance
 */
app.post('/api/sessions/:id/cancel', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var sessions = loadSessions();
        var idx = sessions.findIndex(function(s) { return s.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Seance non trouvee' });

        var session = sessions[idx];
        if (session.client_id.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'Acces non autorise' });
        }
        if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Impossible d\'annuler cette seance' });
        }

        session.status = 'CANCELLED';
        session.updated_at = new Date().toISOString();
        saveSessions(sessions);

        console.log('[SESSION] Annulee par client: ' + session.id);
        res.json({ success: true, session: sanitizeSessionForClient(session) });

    } catch (error) {
        console.error('Erreur cancel session:', error);
        res.status(500).json({ error: 'Erreur' });
    }
});

// ============================================================
// ROUTES - SESSIONS PARTENAIRE
// ============================================================

/**
 * GET /api/partner/sessions
 * Partenaire recupere ses seances
 */
app.get('/api/partner/sessions', authenticatePartner, function(req, res) {
    try {
        var sessions = loadSessions();
        var partnerSessions = sessions.filter(function(s) {
            return s.partner_id === req.partner.id;
        });

        partnerSessions.sort(function(a, b) {
            var dateA = a.datetime_start || a.created_at;
            var dateB = b.datetime_start || b.created_at;
            return new Date(dateB) - new Date(dateA);
        });

        res.json(partnerSessions);
    } catch (error) {
        console.error('Erreur get partner sessions:', error);
        res.status(500).json({ error: 'Erreur' });
    }
});

/**
 * PATCH /api/partner/sessions/:id
 * Partenaire propose/confirme/modifie une seance
 * Body: { action, datetime_start, duration_minutes, meet_url, location, notes_partner }
 * action: "propose" | "confirm" | "modify"
 */
app.patch('/api/partner/sessions/:id', authenticatePartner, function(req, res) {
    try {
        var sessions = loadSessions();
        var idx = sessions.findIndex(function(s) { return s.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Seance non trouvee' });

        var session = sessions[idx];
        if (session.partner_id !== req.partner.id) {
            return res.status(403).json({ error: 'Acces non autorise' });
        }

        var body = req.body;
        var action = body.action || 'modify';
        var now = new Date().toISOString();

        if (action === 'propose') {
            // REQUESTED ou RESCHEDULE_REQUESTED -> PROPOSED
            if (session.status !== 'REQUESTED' && session.status !== 'RESCHEDULE_REQUESTED') {
                return res.status(400).json({ error: 'Statut incompatible pour proposer un creneau' });
            }
            if (!body.datetime_start) {
                return res.status(400).json({ error: 'datetime_start requis' });
            }
            session.datetime_start = body.datetime_start;
            if (body.duration_minutes) session.duration_minutes = body.duration_minutes;
            if (body.location !== undefined) session.location = body.location;
            if (body.meet_url) session.meet_url = body.meet_url;
            if (body.notes_partner) session.notes_partner = body.notes_partner;
            session.status = 'PROPOSED';
            session.updated_at = now;

            // Email au client : creneau propose
            try {
                var emailService = require('./email-service');
                if (emailService.sendSessionProposedEmail) {
                    emailService.sendSessionProposedEmail(session.client_id, session.client_name, session);
                }
            } catch(e) { console.error('[SESSION] Erreur envoi email proposed:', e.message); }

        } else if (action === 'confirm') {
            // REQUESTED -> CONFIRMED direct (avec meet_url)
            if (session.status !== 'REQUESTED' && session.status !== 'PROPOSED') {
                return res.status(400).json({ error: 'Statut incompatible pour confirmer' });
            }
            if (!body.datetime_start && !session.datetime_start) {
                return res.status(400).json({ error: 'datetime_start requis' });
            }
            if (body.datetime_start) session.datetime_start = body.datetime_start;
            if (body.duration_minutes) session.duration_minutes = body.duration_minutes;
            if (body.meet_url) session.meet_url = body.meet_url;
            if (body.location !== undefined) session.location = body.location;
            if (body.notes_partner) session.notes_partner = body.notes_partner;
            session.status = 'CONFIRMED';
            session.updated_at = now;

            // Email confirmation
            try {
                var emailService = require('./email-service');
                if (emailService.sendSessionConfirmedEmail) {
                    emailService.sendSessionConfirmedEmail(session.client_id, session.client_name, session);
                }
            } catch(e) { console.error('[SESSION] Erreur envoi email confirmation:', e.message); }

        } else {
            // modify : modifier les champs sans changer le statut
            if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
                return res.status(400).json({ error: 'Modification impossible pour ce statut' });
            }
            if (body.datetime_start) session.datetime_start = body.datetime_start;
            if (body.duration_minutes) session.duration_minutes = body.duration_minutes;
            if (body.meet_url !== undefined) session.meet_url = body.meet_url;
            if (body.location !== undefined) session.location = body.location;
            if (body.notes_partner !== undefined) session.notes_partner = body.notes_partner;
            session.updated_at = now;
        }

        saveSessions(sessions);
        console.log('[SESSION] Partenaire ' + action + ': ' + session.id);
        res.json({ success: true, session: session });

    } catch (error) {
        console.error('Erreur patch partner session:', error);
        res.status(500).json({ error: 'Erreur' });
    }
});

/**
 * POST /api/partner/sessions/:id/complete
 * Partenaire marque la seance comme terminee
 */
app.post('/api/partner/sessions/:id/complete', authenticatePartner, function(req, res) {
    try {
        var sessions = loadSessions();
        var idx = sessions.findIndex(function(s) { return s.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Seance non trouvee' });

        var session = sessions[idx];
        if (session.partner_id !== req.partner.id) {
            return res.status(403).json({ error: 'Acces non autorise' });
        }
        if (session.status !== 'CONFIRMED') {
            return res.status(400).json({ error: 'Seule une seance CONFIRMED peut etre terminee' });
        }

        session.status = 'COMPLETED';
        if (req.body && req.body.notes_partner) session.notes_partner = req.body.notes_partner;
        session.updated_at = new Date().toISOString();
        saveSessions(sessions);

        console.log('[SESSION] Terminee: ' + session.id);

        // Email au client : seance terminee
        try {
            var emailService = require('./email-service');
            if (emailService.sendSessionCompletedEmail) {
                emailService.sendSessionCompletedEmail(session.client_id, session.client_name, session);
            }
        } catch(e) { console.error('[SESSION] Erreur envoi email completed:', e.message); }

        res.json({ success: true, session: session });

    } catch (error) {
        console.error('Erreur complete session:', error);
        res.status(500).json({ error: 'Erreur' });
    }
});

/**
 * POST /api/partner/sessions/:id/cancel
 * Partenaire annule une seance
 */
app.post('/api/partner/sessions/:id/cancel', authenticatePartner, function(req, res) {
    try {
        var sessions = loadSessions();
        var idx = sessions.findIndex(function(s) { return s.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Seance non trouvee' });

        var session = sessions[idx];
        if (session.partner_id !== req.partner.id) {
            return res.status(403).json({ error: 'Acces non autorise' });
        }
        if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Impossible d\'annuler cette seance' });
        }

        session.status = 'CANCELLED';
        if (req.body && req.body.notes_partner) session.notes_partner = req.body.notes_partner;
        session.updated_at = new Date().toISOString();
        saveSessions(sessions);

        console.log('[SESSION] Annulee par partenaire: ' + session.id);
        res.json({ success: true, session: session });

    } catch (error) {
        console.error('Erreur cancel partner session:', error);
        res.status(500).json({ error: 'Erreur' });
    }
});

/**
 * POST /api/admin/sessions
 * Ajouter une seance pour un client (Admin)
 * Body: { userEmail, date, heure, type, duree, description, visioLink, lieu, icon }
 */
app.post('/api/admin/sessions', (req, res) => {
    try {
        const { userEmail, date, heure, type, duree, description, visioLink, lieu, icon } = req.body;

        // Validation
        if (!userEmail || !date || !heure || !type || !duree) {
            return res.status(400).json({
                error: 'Champs requis manquants',
                required: ['userEmail', 'date', 'heure', 'type', 'duree']
            });
        }

        // Verifier que l'utilisateur existe
        const user = getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouve' });
        }

        // Creer la seance
        const newSession = {
            id: `SES-${uuidv4().split('-')[0].toUpperCase()}`,
            userEmail: userEmail.toLowerCase(),
            userName: `${user.prenom} ${user.nom}`,
            date: date,
            heure: heure,
            type: type,
            duree: duree,
            description: description || '',
            visioLink: visioLink || null,
            lieu: lieu || null,
            icon: icon || 'fa-calendar',
            status: 'scheduled', // 'scheduled', 'completed', 'cancelled'
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const sessions = loadSessions();
        sessions.push(newSession);
        saveSessions(sessions);

        console.log(`[SESSION] Seance ajoutee: ${newSession.id} pour ${userEmail}`);

        res.json({ success: true, session: newSession });

    } catch (error) {
        console.error('Erreur ajout seance:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout de la seance' });
    }
});

/**
 * PUT /api/admin/sessions/:sessionId
 * Modifier une seance (Admin)
 */
app.put('/api/admin/sessions/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const { date, heure, type, duree, description, visioLink, lieu, icon, status } = req.body;

        const sessions = loadSessions();
        const index = sessions.findIndex(s => s.id === sessionId);

        if (index === -1) {
            return res.status(404).json({ error: 'Seance non trouvee' });
        }

        // Mettre a jour les champs fournis
        if (date) sessions[index].date = date;
        if (heure) sessions[index].heure = heure;
        if (type) sessions[index].type = type;
        if (duree) sessions[index].duree = duree;
        if (description !== undefined) sessions[index].description = description;
        if (visioLink !== undefined) sessions[index].visioLink = visioLink;
        if (lieu !== undefined) sessions[index].lieu = lieu;
        if (icon) sessions[index].icon = icon;
        if (status) sessions[index].status = status;

        sessions[index].updatedAt = new Date().toISOString();
        saveSessions(sessions);

        console.log(`[SESSION] Seance modifiee: ${sessionId}`);

        res.json({ success: true, session: sessions[index] });

    } catch (error) {
        console.error('Erreur modification seance:', error);
        res.status(500).json({ error: 'Erreur lors de la modification de la seance' });
    }
});

/**
 * DELETE /api/admin/sessions/:sessionId
 * Supprimer une seance (Admin)
 */
app.delete('/api/admin/sessions/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;

        const sessions = loadSessions();
        const index = sessions.findIndex(s => s.id === sessionId);

        if (index === -1) {
            return res.status(404).json({ error: 'Seance non trouvee' });
        }

        const deleted = sessions.splice(index, 1)[0];
        saveSessions(sessions);

        console.log(`[SESSION] Seance supprimee: ${sessionId}`);

        res.json({ success: true, deleted: deleted });

    } catch (error) {
        console.error('Erreur suppression seance:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression de la seance' });
    }
});

// ============================================================
// ENDPOINTS PARTENAIRES - AUTHENTIFICATION
// ============================================================

// ── Sous-profils partenaires (plusieurs personnes sur un compte partagé) ──
const SUBPROFILES_FILE = path.join(__dirname, 'data', 'partner-subprofiles.json');

function loadSubProfiles() {
    try {
        if (fs.existsSync(SUBPROFILES_FILE)) return JSON.parse(fs.readFileSync(SUBPROFILES_FILE, 'utf8'));
    } catch(e) {}
    return [];
}
function saveSubProfiles(profiles) {
    try { fs.writeFileSync(SUBPROFILES_FILE, JSON.stringify(profiles, null, 2)); } catch(e) {}
}

// Connexion partenaire (+ admin via email admin)
app.post('/api/partner/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        // Anti brute-force : max 10 tentatives par IP+email par 15 minutes
        var ptnrLoginClientIp = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        if (!checkRateLimit(ptnrLoginClientIp + ':' + email.toLowerCase(), 'partner_login', 10, 900000)) {
            console.log('[SECURITY] Connexion partenaire bloquee (rate limit): ' + email + ' depuis ' + ptnrLoginClientIp);
            return res.status(429).json({ error: 'Trop de tentatives de connexion. Veuillez reessayer dans quelques minutes.' });
        }

        // ── Cas admin : identifiants hardcodés (mêmes que admin.html / admin-system.js) ──
        const ADMIN_ACCOUNTS_LIST = [
            { email: 'admin@fagenesis.com', password: 'FAGenesis2024!' },
        ];
        // Accepter aussi les overrides via variables d'environnement
        if (process.env.ADMIN_PARTNER_EMAIL && process.env.ADMIN_PARTNER_PASSWORD) {
            ADMIN_ACCOUNTS_LIST.push({ email: process.env.ADMIN_PARTNER_EMAIL.toLowerCase().trim(), password: process.env.ADMIN_PARTNER_PASSWORD });
        }
        const emailNorm = email.toLowerCase().trim();
        const passwordNorm = password.trim();
        console.log('[PARTNER/ADMIN] Tentative login:', emailNorm);
        const adminMatch = ADMIN_ACCOUNTS_LIST.find(function(a) {
            return a.email === emailNorm && a.password === passwordNorm;
        });
        if (adminMatch) {
            var jwt3 = require('jsonwebtoken'); const sessionToken = jwt3.sign({id: 'ADMIN', email: emailNorm, role: 'admin'}, _JWT_SECRET, {expiresIn: '90d'});
            console.log('[PARTNER/ADMIN] Connexion admin:', email);
            return res.json({
                success: true,
                role: 'admin',
                partner: { id: 'ADMIN', email: email, prenom: 'Admin', nom: 'FA GENESIS', partner_type: 'admin', role: 'admin' },
                token: sessionToken
            });
        }

        // ── Cas partenaire normal ──
        const partner = getPartnerByEmail(email);
        if (!partner) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }
        if (partner.accountStatus === 'deactivated') {
            return res.status(403).json({ error: 'Compte partenaire désactivé' });
        }
        const validPassword = await bcrypt.compare(password, partner.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }
        const sessionToken = signPartnerToken(partner);
        const partners = loadPartners();
        const index = partners.findIndex(p => p.id === partner.id);
        if (index !== -1) {
            partners[index].sessionToken = sessionToken;
            partners[index].lastLogin = new Date().toISOString();
            partners[index].updatedAt = new Date().toISOString();
            savePartners(partners);
        }
        const { password: _, ...partnerSafe } = partner;
        partnerSafe.sessionToken = sessionToken;
        console.log('[PARTNER] Connexion:', email);
        res.json({ success: true, partner: partnerSafe, token: sessionToken });
    } catch (error) {
        console.error('[PARTNER] Erreur login:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

// Inscription partenaire (self-service) — compte créé en 'pending', visible en annuaire seulement après validation admin
app.post('/api/partner/auth/register', async (req, res) => {
    try {
        const { prenom, nom, email, telephone, city, country, password, partner_type, partner_type_other, company, referralCode } = req.body;
        if (!prenom || !nom || !email || !password || !partner_type) {
            return res.status(400).json({ error: 'Champs obligatoires: prenom, nom, email, password, partner_type' });
        }
        if (partner_type === 'other' && (!partner_type_other || !partner_type_other.trim() || partner_type_other.trim().length < 2)) {
            return res.status(400).json({ error: 'Merci de preciser votre profil pour la categorie "Autre"' });
        }

        // Anti-spam : champ honeypot (les bots remplissent les champs caches)
        if (req.body._hp && req.body._hp.trim() !== '') {
            console.log('[SPAM] Inscription partenaire bloquee (honeypot): ' + email);
            return res.status(400).json({ error: 'Formulaire invalide.' });
        }

        // Anti-spam : rate limiting (max 3 inscriptions par IP par heure)
        var ptnrRegClientIp = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        if (!checkRateLimit(ptnrRegClientIp, 'partner_register', 3, 3600000)) {
            console.log('[SPAM] Inscription partenaire bloquee (rate limit): ' + ptnrRegClientIp);
            return res.status(429).json({ error: 'Trop de tentatives. Veuillez reessayer dans 1 heure.' });
        }

        // Anti-spam : les noms qui ressemblent a des chaines aleatoires sont rejetes
        if (isSpamName(prenom) || isSpamName(nom)) {
            console.log('[SPAM] Inscription partenaire bloquee (nom suspect): ' + prenom + ' ' + nom + ' <' + email + '>');
            return res.status(400).json({ error: 'Veuillez entrer votre vrai prenom et nom.' });
        }

        // Anti-spam : le formulaire doit avoir ete ouvert depuis au moins 3 secondes
        if (req.body._ft) {
            var ptnrRegFormTime = parseInt(req.body._ft, 10);
            var ptnrRegFormElapsed = Date.now() - ptnrRegFormTime;
            // elapsed < 0 = horloge du client en avance (frequent sur mobile mal synchronise) : pas du spam, on ignore le check
            if (!isNaN(ptnrRegFormElapsed) && ptnrRegFormElapsed >= 0 && ptnrRegFormElapsed < 3000) {
                console.log('[SPAM] Inscription partenaire bloquee (soumission trop rapide): ' + email);
                return res.status(400).json({ error: 'Formulaire soumis trop rapidement.' });
            }
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Format d\'email invalide' });
        }
        if (PARTNER_TYPE_VALUES.indexOf(partner_type) === -1) {
            return res.status(400).json({ error: 'partner_type invalide. Valeurs acceptees: ' + PARTNER_TYPE_VALUES.join(', ') });
        }
        const existing = getPartnerByEmail(email);
        if (existing) {
            return res.status(409).json({ error: 'Un compte existe deja avec cet email' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caracteres' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date().toISOString();
        // JWT for new partner (id assigned below in newPartner object)
        const _pRegEmail = email.trim().toLowerCase();
        const _pRegId = 'PTR-' + uuidv4().split('-')[0].toUpperCase();
        const sessionToken = signPartnerToken({id: _pRegId, email: _pRegEmail});
        const partners = loadPartners();
        let referredBy = null;
        if (referralCode && typeof referralCode === 'string') {
            const referrer = partners.find(p => p.id.toLowerCase() === referralCode.trim().toLowerCase());
            if (referrer) referredBy = referrer.id;
        }
        const partner = {
            id: _pRegId,
            prenom: prenom,
            nom: nom,
            email: email.toLowerCase(),
            telephone: telephone || '',
            city: (typeof city === 'string') ? city.trim() : '',
            country: (typeof country === 'string' && country.length === 2) ? country.trim().toUpperCase() : '',
            password: hashedPassword,
            partner_type: partner_type,
            partner_type_other: partner_type === 'other' ? partner_type_other.trim() : '',
            company: company || '',
            services: (LEGACY_SERVICE_CATALOG[partner_type] || []).map(s => Object.assign({ id: 'SVC-' + uuidv4().split('-')[0] }, s, { active: true })),
            sessionToken: sessionToken,
            accountStatus: 'pending',
            contract_signed: false,
            contract_signed_at: null,
            referredBy: referredBy,
            createdAt: now,
            updatedAt: now,
            lastLogin: now,
            createdBy: 'self-register'
        };
        partners.push(partner);
        savePartners(partners);
        const { password: _, ...partnerSafe } = partner;
        console.log('[PARTNER] Inscription self-service:', email, '(' + partner_type + ')');
        notifyUser(null, 'admin', 'partenaire-pending', 'Nouveau partenaire à valider', prenom + ' ' + nom + ' (' + (PARTNER_TYPE_VALUES.indexOf(partner_type) !== -1 ? partner_type : partner_type_other) + ') attend votre approbation pour apparaître dans l\'annuaire.', '/admin.html#open-partners');
        res.json({ success: true, partner: partnerSafe, token: sessionToken });
    } catch (error) {
        console.error('[PARTNER] Erreur inscription:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
});

// ── GET /api/partner/subprofiles — liste les sous-profils du compte partenaire connecté ──
app.get('/api/partner/subprofiles', authenticatePartner, (req, res) => {
    try {
        const all = loadSubProfiles();
        let mine = all.filter(p => p.partnerId === req.partner.id);
        // Compte partenaire déjà inscrit mais sans aucun sous-profil (ancien compte, ou
        // tout premier accès) : on lui crée automatiquement un profil par défaut à partir
        // de son propre nom, pour ne jamais lui redemander de "créer un profil" alors qu'il
        // est déjà un partenaire enregistré.
        if (mine.length === 0) {
            const defaultName = ((req.partner.prenom || '') + ' ' + (req.partner.nom || '')).trim() || req.partner.company || 'Mon profil';
            const defaultInitials = defaultName.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().substring(0, 3) || 'P';
            const defaultProfile = {
                id: 'PRF-' + require('crypto').randomBytes(4).toString('hex').toUpperCase(),
                partnerId: req.partner.id,
                partnerType: req.partner.partner_type,
                name: defaultName,
                initials: defaultInitials,
                pinHash: null,
                createdAt: new Date().toISOString()
            };
            all.push(defaultProfile);
            saveSubProfiles(all);
            mine = [defaultProfile];
            console.log('[SUBPROFILE] Profil par défaut auto-créé:', defaultProfile.id, 'pour', req.partner.email);
        }
        res.json({ success: true, profiles: mine.map(p => ({ id: p.id, name: p.name, initials: p.initials, hasPin: !!p.pinHash, createdAt: p.createdAt })) });
    } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /api/partner/subprofiles — créer un sous-profil ──
app.post('/api/partner/subprofiles', authenticatePartner, async (req, res) => {
    try {
        const { name, initials, pin } = req.body;
        if (!name || !initials) return res.status(400).json({ error: 'Nom et initiales requis' });
        const all = loadSubProfiles();
        const existing = all.filter(p => p.partnerId === req.partner.id);
        if (existing.find(p => p.name.toLowerCase() === name.toLowerCase())) {
            return res.status(409).json({ error: 'Un profil avec ce nom existe déjà' });
        }
        const pinHash = pin ? await bcrypt.hash(pin, 10) : null;
        const profile = {
            id: 'PRF-' + require('crypto').randomBytes(4).toString('hex').toUpperCase(),
            partnerId: req.partner.id,
            partnerType: req.partner.partner_type,
            name: name.trim(),
            initials: initials.trim().toUpperCase().substring(0, 3),
            pinHash,
            createdAt: new Date().toISOString()
        };
        all.push(profile);
        saveSubProfiles(all);
        console.log('[SUBPROFILE] Créé:', profile.id, 'pour', req.partner.email);
        res.json({ success: true, profile: { id: profile.id, name: profile.name, initials: profile.initials, hasPin: !!pinHash } });
    } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── DELETE /api/admin/partner/subprofiles/:id — supprimer un sous-profil (admin) ──
app.delete('/api/admin/partner/subprofiles/:id', (req, res) => {
    try {
        const all = loadSubProfiles();
        const idx = all.findIndex(p => p.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Profil introuvable' });
        const deleted = all.splice(idx, 1)[0];
        saveSubProfiles(all);
        console.log('[ADMIN] Sous-profil supprimé:', deleted.id, deleted.name);
        res.json({ success: true, deleted });
    } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /api/admin/partner/subprofiles — liste tous les sous-profils (admin) ──
app.get('/api/admin/partner/subprofiles', (req, res) => {
    try {
        const all = loadSubProfiles();
        const partners = loadPartners();
        // Enrichir avec les infos du compte partenaire parent
        const enriched = all.map(function(p) {
            const parent = partners.find(function(pt) { return pt.id === p.partnerId; });
            return Object.assign({}, p, {
                partnerEmail: parent ? parent.email : '',
                partnerType: parent ? parent.partner_type : (p.partnerType || ''),
                pinHash: undefined
            });
        });
        res.json({ success: true, profiles: enriched });
    } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── PUT /api/partner/subprofiles/:id — modifier nom, initiales ou PIN ──
app.put('/api/partner/subprofiles/:id', authenticatePartner, async (req, res) => {
    try {
        const { name, initials, pin, removePin } = req.body;
        const all = loadSubProfiles();
        const idx = all.findIndex(p => p.id === req.params.id && p.partnerId === req.partner.id);
        if (idx === -1) return res.status(404).json({ error: 'Profil introuvable' });
        if (name) all[idx].name = name.trim();
        if (initials) all[idx].initials = initials.trim().toUpperCase().substring(0, 3);
        if (removePin) { all[idx].pinHash = null; }
        else if (pin) { all[idx].pinHash = await bcrypt.hash(pin, 10); }
        all[idx].updatedAt = new Date().toISOString();
        saveSubProfiles(all);
        res.json({ success: true, profile: { id: all[idx].id, name: all[idx].name, initials: all[idx].initials, hasPin: !!all[idx].pinHash } });
    } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /api/partner/subprofiles/:id/verify-pin — vérifier le code PIN d'un sous-profil ──
app.post('/api/partner/subprofiles/:id/verify-pin', authenticatePartner, async (req, res) => {
    try {
        const { pin } = req.body;
        const all = loadSubProfiles();
        const profile = all.find(p => p.id === req.params.id && p.partnerId === req.partner.id);
        if (!profile) return res.status(404).json({ error: 'Profil introuvable' });
        if (!profile.pinHash) return res.json({ success: true });
        if (!pin) return res.status(400).json({ error: 'Code PIN requis' });
        const valid = await bcrypt.compare(pin, profile.pinHash);
        if (!valid) return res.status(401).json({ error: 'Code PIN incorrect' });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// Infos partenaire connecte
app.get('/api/partner/auth/me', authenticatePartner, (req, res) => {
    try {
        const { password, ...partnerSafe } = req.partner;
        res.json({ success: true, partner: partnerSafe });
    } catch (error) {
        console.error('[PARTNER] Erreur me:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Deconnexion partenaire
app.post('/api/partner/auth/logout', authenticatePartner, (req, res) => {
    try {
        const partners = loadPartners();
        const index = partners.findIndex(p => p.id === req.partner.id);
        if (index !== -1) {
            partners[index].sessionToken = null;
            savePartners(partners);
        }
        console.log('[PARTNER] Deconnexion:', req.partner.email);
        res.json({ success: true, message: 'Deconnexion reussie' });
    } catch (error) {
        console.error('[PARTNER] Erreur logout:', error);
        res.status(500).json({ error: 'Erreur lors de la deconnexion' });
    }
});

// Modifier profil partenaire
app.put('/api/partner/auth/update-profile', authenticatePartner, async (req, res) => {
    try {
        const { prenom, nom, telephone, photo, logo, bio, city, country, interventionZone, social, responseTimeCommitmentMinutes, currentPassword, newPassword } = req.body;
        const partners = loadPartners();
        const index = partners.findIndex(p => p.id === req.partner.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Partenaire non trouve' });
        }
        if (prenom) partners[index].prenom = prenom;
        if (nom) partners[index].nom = nom;
        if (telephone) partners[index].telephone = telephone;
        if (photo) partners[index].photo = photo;
        if (logo) partners[index].logo = logo;
        if (typeof bio === 'string') partners[index].bio = bio.trim();
        if (typeof city === 'string') partners[index].city = city.trim();
        if (typeof country === 'string' && country.length === 2) partners[index].country = country.toUpperCase();
        if (typeof interventionZone === 'string') partners[index].interventionZone = interventionZone.trim();
        if (responseTimeCommitmentMinutes !== undefined) {
            const allowedResponseMinutes = [30, 60, 180, 720, 1440, 2880];
            partners[index].responseTimeCommitmentMinutes = allowedResponseMinutes.indexOf(responseTimeCommitmentMinutes) !== -1
                ? responseTimeCommitmentMinutes
                : null;
        }
        if (social && typeof social === 'object') {
            const prevSocial = partners[index].social || {};
            const cleanedSocial = {};
            ['instagram', 'facebook', 'linkedin', 'tiktok', 'website'].forEach(key => {
                cleanedSocial[key] = typeof social[key] === 'string' ? social[key].trim() : (prevSocial[key] || '');
            });
            partners[index].social = cleanedSocial;
        }
        if (currentPassword && newPassword) {
            const validPassword = await bcrypt.compare(currentPassword, partners[index].password);
            if (!validPassword) {
                return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caracteres' });
            }
            partners[index].password = await bcrypt.hash(newPassword, 10);
        }
        partners[index].updatedAt = new Date().toISOString();
        savePartners(partners);
        const { password, ...partnerSafe } = partners[index];
        res.json({ success: true, partner: partnerSafe });
    } catch (error) {
        console.error('[PARTNER] Erreur update-profile:', error);
        res.status(500).json({ error: 'Erreur lors de la mise a jour' });
    }
});

// Lister mes prestations (partenaire connecté)
app.get('/api/partner/services', authenticatePartner, (req, res) => {
    res.json({ success: true, services: req.partner.services || [] });
});

// Segments client pour les prestations (tarifs differencies)
const SERVICE_AUDIENCES = ['etudiant', 'particulier', 'entreprise', 'promo'];

// Remplacer la liste de mes prestations (partenaire connecté)
app.put('/api/partner/services', authenticatePartner, (req, res) => {
    try {
        const { services } = req.body;
        if (!Array.isArray(services)) {
            return res.status(400).json({ error: 'services doit etre un tableau' });
        }
        const cleaned = [];
        for (const s of services) {
            if (!s || !s.label || typeof s.label !== 'string' || !s.label.trim()) {
                return res.status(400).json({ error: 'Chaque prestation doit avoir un libelle' });
            }
            const isQuote = s.pricing_type === 'quote';
            const price = isQuote ? 0 : Number(s.price);
            if (!isQuote && (!Number.isFinite(price) || price <= 0)) {
                return res.status(400).json({ error: 'Chaque prestation doit avoir un prix numerique superieur a 0' });
            }
            cleaned.push({
                id: s.id || ('SVC-' + uuidv4().split('-')[0]),
                label: s.label.trim(),
                description: (s.description || '').trim(),
                price: price,
                pricing_type: isQuote ? 'quote' : 'fixed',
                active: s.active !== false,
                audience: SERVICE_AUDIENCES.indexOf(s.audience) !== -1 ? s.audience : 'particulier',
                image: typeof s.image === 'string' ? s.image : '',
                features: Array.isArray(s.features)
                    ? s.features.filter(f => typeof f === 'string' && f.trim()).map(f => f.trim()).slice(0, 12)
                    : []
            });
        }
        const partners = loadPartners();
        const index = partners.findIndex(p => p.id === req.partner.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Partenaire non trouve' });
        }
        partners[index].services = cleaned;
        partners[index].updatedAt = new Date().toISOString();
        savePartners(partners);
        res.json({ success: true, services: cleaned });
    } catch (error) {
        console.error('[PARTNER] Erreur update services:', error);
        res.status(500).json({ error: 'Erreur lors de la mise a jour des prestations' });
    }
});

// Extraction de la miniature OG d'un lien externe (Instagram, TikTok, etc.)
function fetchOgImage(rawUrl) {
    return new Promise((resolve) => {
        let parsed;
        try { parsed = new URL(rawUrl); } catch { return resolve(null); }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return resolve(null);
        // Block private/loopback ranges (SSRF protection)
        const h = parsed.hostname.toLowerCase();
        if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return resolve(null);
        const lib = parsed.protocol === 'https:' ? require('https') : require('http');
        const options = {
            hostname: parsed.hostname, port: parsed.port || undefined,
            path: parsed.pathname + parsed.search, method: 'GET',
            timeout: 6000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'fr-FR,fr;q=0.9'
            }
        };
        const req = lib.request(options, (r) => {
            // Follow one redirect
            if ([301,302,303,307,308].includes(r.statusCode) && r.headers.location) {
                try {
                    const redir = new URL(r.headers.location, rawUrl).href;
                    return fetchOgImage(redir).then(resolve);
                } catch { return resolve(null); }
            }
            if (r.statusCode !== 200) return resolve(null);
            let body = '';
            r.setEncoding('utf8');
            r.on('data', chunk => { body += chunk; if (body.length > 300000) r.destroy(); });
            r.on('end', () => {
                const patterns = [
                    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
                    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
                    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
                    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
                ];
                for (const p of patterns) {
                    const m = body.match(p);
                    if (m && m[1] && m[1].startsWith('http')) return resolve(m[1]);
                }
                resolve(null);
            });
            r.on('error', () => resolve(null));
        });
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.on('error', () => resolve(null));
        req.end();
    });
}

// Récupère la miniature OG d'un lien externe pour le portfolio
app.post('/api/partner/fetch-link-thumb', authenticatePartner, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || typeof url !== 'string' || url.length > 2000) return res.status(400).json({ error: 'url requis' });
        const thumb = await fetchOgImage(url);
        res.json({ success: !!thumb, thumb: thumb || '' });
    } catch (e) {
        res.json({ success: false, thumb: '' });
    }
});

// Lister mon portfolio (partenaire connecté)
app.get('/api/partner/portfolio', authenticatePartner, (req, res) => {
    res.json({ success: true, portfolio: req.partner.portfolio || [] });
});

// Remplacer mon portfolio (partenaire connecté)
app.put('/api/partner/portfolio', authenticatePartner, (req, res) => {
    try {
        const { portfolio } = req.body;
        if (!Array.isArray(portfolio)) {
            return res.status(400).json({ error: 'portfolio doit etre un tableau' });
        }
        const cleaned = [];
        for (const item of portfolio) {
            if (!item || (item.type !== 'photo' && item.type !== 'video' && item.type !== 'video_upload')) {
                return res.status(400).json({ error: 'Chaque element doit avoir un type "photo", "video" ou "video_upload"' });
            }
            if (!item.url || typeof item.url !== 'string' || !item.url.trim()) {
                return res.status(400).json({ error: 'Chaque element doit avoir une url' });
            }
            cleaned.push({
                id: item.id || ('PF-' + uuidv4().split('-')[0]),
                type: item.type,
                url: item.url.trim(),
                caption: (item.caption || '').trim(),
                thumb: (item.thumb || '').trim()
            });
        }
        const partners = loadPartners();
        const index = partners.findIndex(p => p.id === req.partner.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Partenaire non trouve' });
        }
        partners[index].portfolio = cleaned;
        partners[index].updatedAt = new Date().toISOString();
        savePartners(partners);
        res.json({ success: true, portfolio: cleaned });
    } catch (error) {
        console.error('[PARTNER] Erreur update portfolio:', error);
        res.status(500).json({ error: 'Erreur lors de la mise a jour du portfolio' });
    }
});

// ============================================================
// ENDPOINT PUBLIC - ANNUAIRE PARTENAIRES
// ============================================================

function getPartnerFromPrice(partner) {
    const activePrices = (partner.services || [])
        .filter(s => s.active !== false && s.pricing_type !== 'quote')
        .map(s => s.price)
        .filter(p => typeof p === 'number' && isFinite(p) && p > 0);
    return activePrices.length ? Math.min(...activePrices) : null;
}

function getPartnerRatingSummary(partnerId) {
    const reviews = loadPartnerReviews().filter(
        r => r.partnerId === partnerId && r.status === 'published'
    );
    if (reviews.length === 0) return { average: 0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}

// ============================================================
// SYSTEME DE FIDELISATION / REPUTATION — Phase 1 (badges, classement)
// ============================================================

// Une mission est consideree "realisee" quand le versement du solde a ete cree
function getPartnerMissionsCompleted(partnerId) {
    return loadPayouts().filter(p => p.partner_id === partnerId && p.stage === 'balance').length;
}

function getPartnerSatisfactionRate(partnerId) {
    const reviews = loadPartnerReviews().filter(r => r.partnerId === partnerId && r.status === 'published');
    if (reviews.length === 0) return 0;
    const satisfied = reviews.filter(r => (r.rating || 0) >= 4).length;
    return satisfied / reviews.length;
}

const PARTNER_BADGE_TIERS = [
    { id: 'elite', missions: 100, rating: 5 },
    { id: 'or', missions: 50, rating: 4.5 },
    { id: 'argent', missions: 20, rating: 4.3 },
    { id: 'bronze', missions: 5, rating: 4 }
];

// 'fondateur' est attribue manuellement par l'admin (partner.founderBadge), pas calculable
function getPartnerBadge(partner, ratingSummary, missionsCompleted) {
    if (!partner) return null;
    if (partner.founderBadge === true) return 'fondateur';
    const summary = ratingSummary || getPartnerRatingSummary(partner.id);
    const missions = typeof missionsCompleted === 'number' ? missionsCompleted : getPartnerMissionsCompleted(partner.id);
    for (const tier of PARTNER_BADGE_TIERS) {
        if (missions >= tier.missions && summary.average >= tier.rating) return tier.id;
    }
    return null;
}

// Progression vers le palier suivant : deux conditions a remplir (missions ET note), le pourcentage retenu est le plus bas des deux
function getPartnerBadgeProgress(partner, ratingSummary, missionsCompleted) {
    const summary = ratingSummary || getPartnerRatingSummary(partner.id);
    const missions = typeof missionsCompleted === 'number' ? missionsCompleted : getPartnerMissionsCompleted(partner.id);
    const currentBadge = getPartnerBadge(partner, summary, missions);
    const tiersAsc = PARTNER_BADGE_TIERS.slice().reverse();
    for (const tier of tiersAsc) {
        if (missions < tier.missions || summary.average < tier.rating) {
            const missionsPercent = Math.min(100, Math.round((missions / tier.missions) * 100));
            const ratingPercent = Math.min(100, Math.round((summary.average / tier.rating) * 100));
            return {
                currentBadge,
                nextBadge: tier.id,
                missionsCurrent: missions,
                missionsTarget: tier.missions,
                ratingCurrent: summary.average,
                ratingTarget: tier.rating,
                percent: Math.min(missionsPercent, ratingPercent)
            };
        }
    }
    return {
        currentBadge,
        nextBadge: null,
        missionsCurrent: missions,
        missionsTarget: missions,
        ratingCurrent: summary.average,
        ratingTarget: summary.average,
        percent: 100
    };
}

// Parrainage partenaire : un filleul ne compte que s'il a ete active (equivalent partenaire du "premier paiement" client)
function getPartnerReferralCount(partnerId) {
    if (!partnerId) return 0;
    return loadPartners().filter(function(p) {
        return p.referredBy === partnerId && p.accountStatus === 'active';
    }).length;
}
function getPartnerReferralStatus(count) {
    if (count >= 10) return 'architecte';
    if (count >= 3) return 'batisseur';
    return null;
}

// Niveaux client basés sur les QG (Quotient Genesis) — séparés des badges prestataires
const CLIENT_QG_LEVEL_TIERS = [
    { id: 'elite',  label: 'Générateur',  pts: 1000 },
    { id: 'or',     label: 'Visionnaire', pts: 600  },
    { id: 'argent', label: 'Bâtisseur',   pts: 300  },
    { id: 'bronze', label: 'Créateur',    pts: 100  }
];

function getClientQGBadge(points) {
    var p = parseInt(points) || 0;
    for (var i = 0; i < CLIENT_QG_LEVEL_TIERS.length; i++) {
        if (p >= CLIENT_QG_LEVEL_TIERS[i].pts) return CLIENT_QG_LEVEL_TIERS[i].id;
    }
    return null;
}

function getClientQGBadgeProgress(points) {
    var p = parseInt(points) || 0;
    var currentBadge = getClientQGBadge(p);
    var tiersAsc = CLIENT_QG_LEVEL_TIERS.slice().reverse();
    for (var i = 0; i < tiersAsc.length; i++) {
        if (p < tiersAsc[i].pts) {
            var prev = tiersAsc[i - 1] ? tiersAsc[i - 1].pts : 0;
            return {
                currentBadge: currentBadge,
                nextBadge: tiersAsc[i].id,
                current: p,
                target: tiersAsc[i].pts,
                prevTarget: prev,
                percent: Math.min(100, Math.round(((p - prev) / (tiersAsc[i].pts - prev)) * 100))
            };
        }
    }
    return { currentBadge: currentBadge, nextBadge: null, current: p, target: p, prevTarget: 0, percent: 100 };
}

// Aliases backward-compat — anciens appels à getClientBadge/getClientBadgeProgress
function getClientBadge(completedOrdersOrPoints) { return getClientQGBadge(completedOrdersOrPoints); }
function getClientBadgeProgress(completedOrders) { return getClientQGBadgeProgress(completedOrders); }

// Une commande "realisee" = solde paye (convention deja utilisee dans /api/auth/me, cf paymentStatus 'fully_paid')
// Renvoie true si le client n'a encore jamais effectué de premier paiement (acompte)
// → éligible à l'avantage bienvenue -10%
function isClientFirstPaidOrder(email) {
    if (!email) return false;
    var needle = email.toLowerCase();
    return !loadOrders().some(function(o) {
        var oe = (o.client_info && o.client_info.email) || o.email || '';
        return oe.toLowerCase() === needle && o.deposit_paid === true;
    });
}

function getClientCompletedOrders(email) {
    if (!email) return 0;
    const needle = email.toLowerCase();
    return loadOrders().filter(o => {
        const oe = (o.client_info && o.client_info.email) || o.email || '';
        return oe.toLowerCase() === needle && o.balance_paid === true;
    }).length;
}

function getClientBadge(completedCount) {
    for (const tier of CLIENT_BADGE_TIERS) {
        if (completedCount >= tier.orders) return tier.id;
    }
    return null;
}

// Progression vers le palier suivant (CLIENT_BADGE_TIERS est trie du plus haut au plus bas)
function getClientBadgeProgress(completedCount) {
    const tiersAsc = CLIENT_BADGE_TIERS.slice().reverse();
    const currentBadge = getClientBadge(completedCount);
    for (const tier of tiersAsc) {
        if (completedCount < tier.orders) {
            return {
                currentBadge,
                nextBadge: tier.id,
                current: completedCount,
                target: tier.orders,
                percent: Math.min(100, Math.round((completedCount / tier.orders) * 100))
            };
        }
    }
    return { currentBadge, nextBadge: null, current: completedCount, target: completedCount, percent: 100 };
}

// Parrainage client : un filleul ne compte que s'il a effectue son premier paiement (evite les faux comptes)
function getClientReferralCount(userId) {
    if (!userId) return 0;
    return loadUsers().filter(function(u) {
        return u.referredBy === userId && getClientCompletedOrders(u.email) >= 1;
    }).length;
}

const PARTNER_BADGE_SCORE_BONUS = { fondateur: 40, elite: 30, or: 20, argent: 10, bronze: 5 };

// Score composite utilise pour le classement par categorie et les "Top [categorie]"
function getPartnerCategoryScore(partner) {
    const summary = getPartnerRatingSummary(partner.id);
    const missions = getPartnerMissionsCompleted(partner.id);
    const satisfaction = getPartnerSatisfactionRate(partner.id);
    const badge = getPartnerBadge(partner, summary, missions);
    const ratingComponent = summary.count > 0 ? summary.average * Math.log(summary.count + 1) : 0;
    const seniorityMonths = partner.createdAt
        ? Math.max(0, (Date.now() - new Date(partner.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 0;
    const avgResponseMinutes = typeof partner.avgResponseMinutes === 'number' ? partner.avgResponseMinutes : null;
    // Reponse rapide = bonus ; pas encore de donnee = neutre (ni bonus ni malus)
    const responseComponent = avgResponseMinutes === null ? 0 : Math.max(0, 10 - Math.min(avgResponseMinutes, 600) / 60);

    // Tâche 6 : boost temporaire pour les nouveaux partenaires sans historique
    var _ancJours = seniorityMonths * 30;
    var _nouveauVenuBoost = (_ancJours < 30 && missions < 3) ? NOUVEAU_VENU_BOOST : 0;

    // Boost temporaire parrainage/Nouveau Talent (7j parrain, 4j filleul)
    var _profileBoost = (partner.profile_boost_until && new Date(partner.profile_boost_until) > new Date()) ? 15 : 0;

    return (ratingComponent * 10)
        + (missions * 0.5)
        + (Math.min(seniorityMonths, 36) * 0.3)
        + (satisfaction * 10)
        + responseComponent
        + (PARTNER_BADGE_SCORE_BONUS[badge] || 0)
        + getPartnerCercleGenesisBonus(partner.id)
        + _nouveauVenuBoost
        + _profileBoost;
}

function getPartnerCategoryRank(partner, allPartnersSameCategory) {
    const scored = allPartnersSameCategory
        .map(p => ({ id: p.id, score: getPartnerCategoryScore(p) }))
        .sort((a, b) => b.score - a.score);
    const idx = scored.findIndex(s => s.id === partner.id);
    return { rank: idx === -1 ? null : idx + 1, total: scored.length };
}

// ============================================================
// CERCLES GENESIS — relation client x prestataire (Phase 2)
// Compte les collaborations payees (commandes balance_paid) entre un
// client precis et un partenaire precis, via les dispatches qui les relient.
// ============================================================
const CERCLE_GENESIS_TIERS = [
    { id: 'constellation', label: 'Cercle Constellation', collabs: 20, icon: 'fa-meteor' },
    { id: 'cercle_premium', label: 'Cercle Premium', collabs: 10, icon: 'fa-gem' },
    { id: 'alliance', label: 'Alliance', collabs: 5, icon: 'fa-handshake' },
    { id: 'decouverte', label: 'Découverte', collabs: 1, icon: 'fa-compass' }
];

function getClientPartnerCollabCount(clientEmail, partnerId) {
    if (!clientEmail || !partnerId) return 0;
    const needle = clientEmail.toLowerCase();
    const orderIds = loadDispatches()
        .filter(d => d.claimed_by_partner_id === partnerId)
        .map(d => d.order_id);
    if (orderIds.length === 0) return 0;
    const seen = {};
    loadOrders().forEach(o => {
        if (orderIds.indexOf(o.id) === -1 || o.balance_paid !== true) return;
        const oe = (o.client_info && o.client_info.email) || o.email || '';
        if (oe.toLowerCase() === needle) seen[o.id] = true;
    });
    return Object.keys(seen).length;
}

function getCercleGenesisTier(count) {
    for (const tier of CERCLE_GENESIS_TIERS) {
        if (count >= tier.collabs) return tier;
    }
    return null;
}

// Progression vers le prochain palier de cercle (meme convention que getClientBadgeProgress)
function getCercleGenesisProgress(count) {
    const tiersAsc = CERCLE_GENESIS_TIERS.slice().reverse();
    const current = getCercleGenesisTier(count);
    for (const tier of tiersAsc) {
        if (count < tier.collabs) {
            return { current, next: tier, collabsCurrent: count, collabsTarget: tier.collabs, percent: Math.min(100, Math.round(count / tier.collabs * 100)) };
        }
    }
    return { current, next: null, collabsCurrent: count, collabsTarget: count, percent: 100 };
}

// Nombre maximum de collaborations du client avec un seul et meme partenaire
function getClientMaxCollabCount(clientEmail) {
    if (!clientEmail) return 0;
    const partnerIds = loadDispatches()
        .map(d => d.claimed_by_partner_id)
        .filter((id, idx, arr) => id && arr.indexOf(id) === idx);
    let maxCount = 0;
    partnerIds.forEach(pid => {
        const c = getClientPartnerCollabCount(clientEmail, pid);
        if (c > maxCount) maxCount = c;
    });
    return maxCount;
}

// Plus haut palier de cercle atteint par ce client, toutes relations partenaires confondues
// (utilise pour la reservation prioritaire — pas seulement le badge global du client)
function getClientMaxCercleGenesisTier(clientEmail) {
    return getCercleGenesisTier(getClientMaxCollabCount(clientEmail));
}

// Nombre de partenaires distincts avec qui ce client a deja collabore (commande payee)
function getClientDistinctPartnerCount(clientEmail) {
    if (!clientEmail) return 0;
    const needle = clientEmail.toLowerCase();
    const orders = loadOrders();
    const partnerIds = {};
    loadDispatches().forEach(d => {
        if (!d.claimed_by_partner_id) return;
        const order = orders.find(o => o.id === d.order_id);
        if (!order || order.balance_paid !== true) return;
        const oe = (order.client_info && order.client_info.email) || order.email || '';
        if (oe.toLowerCase() === needle) partnerIds[d.claimed_by_partner_id] = true;
    });
    return Object.keys(partnerIds).length;
}

// Nombre maximum de collaborations d'un partenaire avec un seul et meme client
function getPartnerMaxCollabCount(partnerId) {
    const orderIds = loadDispatches().filter(d => d.claimed_by_partner_id === partnerId).map(d => d.order_id);
    if (orderIds.length === 0) return 0;
    const emails = loadOrders()
        .filter(o => orderIds.indexOf(o.id) !== -1 && o.balance_paid === true)
        .map(o => ((o.client_info && o.client_info.email) || o.email || '').toLowerCase())
        .filter((e, idx, arr) => e && arr.indexOf(e) === idx);
    let maxCount = 0;
    emails.forEach(email => {
        const c = getClientPartnerCollabCount(email, partnerId);
        if (c > maxCount) maxCount = c;
    });
    return maxCount;
}

// Nombre de clients distincts d'un partenaire (commande payee)
function getPartnerDistinctClientCount(partnerId) {
    const orderIds = loadDispatches().filter(d => d.claimed_by_partner_id === partnerId).map(d => d.order_id);
    if (orderIds.length === 0) return 0;
    const emails = loadOrders()
        .filter(o => orderIds.indexOf(o.id) !== -1 && o.balance_paid === true)
        .map(o => ((o.client_info && o.client_info.email) || o.email || '').toLowerCase())
        .filter(Boolean);
    return emails.filter((e, idx, arr) => arr.indexOf(e) === idx).length;
}

// Bonus de visibilite pour les partenaires ayant des clients en Cercle Premium/Constellation
function getPartnerCercleGenesisBonus(partnerId) {
    const orderIds = loadDispatches()
        .filter(d => d.claimed_by_partner_id === partnerId)
        .map(d => d.order_id);
    if (orderIds.length === 0) return 0;
    const emails = loadOrders()
        .filter(o => orderIds.indexOf(o.id) !== -1 && o.balance_paid === true)
        .map(o => ((o.client_info && o.client_info.email) || o.email || '').toLowerCase())
        .filter((e, idx, arr) => e && arr.indexOf(e) === idx);
    let bonus = 0;
    emails.forEach(email => {
        const count = getClientPartnerCollabCount(email, partnerId);
        if (count >= 20) bonus += 8;
        else if (count >= 10) bonus += 4;
    });
    return bonus;
}

// Liste des clients d'un partenaire ayant atteint au moins le palier "Alliance" (5 collaborations)
function getPartnerCercleClientsList(partnerId, maxResults) {
    const orderIds = loadDispatches()
        .filter(d => d.claimed_by_partner_id === partnerId)
        .map(d => d.order_id);
    if (orderIds.length === 0) return [];
    const orders = loadOrders().filter(o => orderIds.indexOf(o.id) !== -1 && o.balance_paid === true);
    const byEmail = {};
    orders.forEach(o => {
        const email = ((o.client_info && o.client_info.email) || o.email || '').toLowerCase();
        if (!email || byEmail[email]) return;
        byEmail[email] = (o.client_info && o.client_info.first_name) || 'Client';
    });
    const users = loadUsers();
    return Object.keys(byEmail).map(email => {
        const count = getClientPartnerCollabCount(email, partnerId);
        const tier = getCercleGenesisTier(count);
        const user = users.find(u => (u.email || '').toLowerCase() === email);
        const name = (user && (user.prenom || user.firstName)) || byEmail[email];
        return { name, collabCount: count, tier };
    }).filter(c => c.tier).sort((a, b) => b.collabCount - a.collabCount).slice(0, maxResults || 5);
}

// Opportunites Intelligentes (Phase 4) : partenaires ayant servi les memes
// clients que ce partenaire (correlation simple par jointure sur les commandes
// payees — pas d'IA ici, reservee a Jeremie en Phase 6)
function findSharedClientPartners(partnerId, maxResults) {
    const orders = loadOrders();
    const dispatches = loadDispatches();
    const partners = loadPartners();
    function clientEmailsServedBy(pid) {
        const orderIds = dispatches.filter(d => d.claimed_by_partner_id === pid).map(d => d.order_id);
        return orders
            .filter(o => orderIds.indexOf(o.id) !== -1 && o.balance_paid === true)
            .map(o => ((o.client_info && o.client_info.email) || o.email || '').toLowerCase())
            .filter((e, idx, arr) => e && arr.indexOf(e) === idx);
    }
    const myClients = clientEmailsServedBy(partnerId);
    if (!myClients.length) return [];
    const sharedEmailsByPartner = {};
    dispatches.forEach(d => {
        if (!d.claimed_by_partner_id || d.claimed_by_partner_id === partnerId) return;
        const order = orders.find(o => o.id === d.order_id);
        if (!order || order.balance_paid !== true) return;
        const email = ((order.client_info && order.client_info.email) || order.email || '').toLowerCase();
        if (myClients.indexOf(email) === -1) return;
        sharedEmailsByPartner[d.claimed_by_partner_id] = sharedEmailsByPartner[d.claimed_by_partner_id] || {};
        sharedEmailsByPartner[d.claimed_by_partner_id][email] = true;
    });
    return Object.keys(sharedEmailsByPartner).map(pid => {
        const p = partners.find(pp => pp.id === pid);
        if (!p || p.accountStatus !== 'active') return null;
        return {
            partnerId: pid,
            name: ((p.prenom || '') + ' ' + (p.nom || '')).trim(),
            company: p.company || '',
            partnerType: p.partner_type,
            sharedClientCount: Object.keys(sharedEmailsByPartner[pid]).length
        };
    }).filter(Boolean).sort((a, b) => b.sharedClientCount - a.sharedClientCount).slice(0, maxResults || 5);
}

// ============================================================
// GEOLOCALISATION — table statique ville -> [lat, lng]
// Pas de service de geocodage externe (cohérent avec les conventions
// défensives du projet : aucune dépendance réseau fragile). Une ville
// non reconnue retourne simplement null et n'est pas épinglée sur la carte.
// ============================================================
const CITY_COORDS = {
    paris: [48.8566, 2.3522], marseille: [43.2965, 5.3698], lyon: [45.7640, 4.8357],
    toulouse: [43.6047, 1.4442], nice: [43.7102, 7.2620], nantes: [47.2184, -1.5536],
    montpellier: [43.6108, 3.8767], strasbourg: [48.5734, 7.7521], bordeaux: [44.8378, -0.5792],
    lille: [50.6292, 3.0573], rennes: [48.1173, -1.6778], reims: [49.2583, 4.0317],
    'le havre': [49.4944, 0.1079], 'saint-etienne': [45.4397, 4.3872], toulon: [43.1242, 5.9280],
    grenoble: [45.1885, 5.7245], dijon: [47.3220, 5.0415], angers: [47.4784, -0.5632],
    nimes: [43.8367, 4.3601], villeurbanne: [45.7667, 4.8800], 'le mans': [48.0061, 0.1996],
    'aix-en-provence': [43.5297, 5.4474], 'clermont-ferrand': [45.7772, 3.0870], brest: [48.3904, -4.4861],
    tours: [47.3941, 0.6848], limoges: [45.8336, 1.2611], amiens: [49.8941, 2.2958],
    annecy: [45.8992, 6.1294], perpignan: [42.6886, 2.8948], besancon: [47.2380, 6.0243],
    metz: [49.1193, 6.1757], orleans: [47.9029, 1.9093], mulhouse: [47.7508, 7.3359],
    caen: [49.1829, -0.3707], nancy: [48.6921, 6.1844], avignon: [43.9493, 4.8055],
    pau: [43.2951, -0.3708], 'la rochelle': [46.1603, -1.1511], cannes: [43.5528, 7.0174],
    beziers: [43.3442, 3.2158], narbonne: [43.1839, 3.0036], sete: [43.4022, 3.6967],
    carcassonne: [43.2130, 2.3491], bruxelles: [50.8503, 4.3517], geneve: [46.2044, 6.1432],
    lausanne: [46.5197, 6.6323], luxembourg: [49.6116, 6.1319], montreal: [45.5019, -73.5674],
    casablanca: [33.5731, -7.5898], dakar: [14.7167, -17.4677], abidjan: [5.3600, -4.0083]
};

function _normalizeCityKey(s) {
    return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
}

function getCityCoords(cityRaw) {
    const key = _normalizeCityKey(cityRaw);
    if (!key) return null;
    if (CITY_COORDS[key]) return CITY_COORDS[key];
    const found = Object.keys(CITY_COORDS).find(function(k) { return key.indexOf(k) >= 0 || k.indexOf(key) >= 0; });
    return found ? CITY_COORDS[found] : null;
}

// ============================================================
// HALL OF FAME — calcul automatique mensuel (Phase 4)
// ============================================================

// dateStr au format ISO ('YYYY-MM-DDTHH:...') ; monthStr au format 'YYYY-MM'
function _hofDateInMonth(dateStr, monthStr) {
    return !!dateStr && dateStr.slice(0, 7) === monthStr;
}

function getPreviousMonthStr(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), 1);
    d.setMonth(d.getMonth() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

// Les 5 niveaux d'evolution Genesis (couche d'affichage additive) : les
// identifiants de badge internes (bronze/argent/or/elite/prestige/fondateur)
// ne changent pas — trop de call-sites en dependent (score de classement,
// priorite de dispatch, Hall of Fame). On traduit juste l'identifiant pour
// l'affichage utilisateur. Definie ici (avant computeHallOfFameForMonth, pas
// a cote de getClientGenesisPoints) car maybeComputeHallOfFame() s'execute
// immediatement au chargement du module (cf appel plus bas) — une const
// definie plus loin dans le fichier ne serait pas encore initialisee.
const GENESIS_LEVEL_META = {
    none:      { id: 'explorateur', label: 'Explorateur', icon: 'fa-seedling', order: 0 },
    bronze:    { id: 'createur',    label: 'Créateur',    icon: 'fa-fire',     order: 1 },
    argent:    { id: 'batisseur',   label: 'Bâtisseur',   icon: 'fa-bolt',     order: 2 },
    or:        { id: 'visionnaire', label: 'Visionnaire', icon: 'fa-crown',    order: 3 },
    elite:     { id: 'generateur',  label: 'Générateur',  icon: 'fa-infinity', order: 4 },
    fondateur: { id: 'generateur',  label: 'Générateur',  icon: 'fa-infinity', order: 4 }
};

function getGenesisLevel(badgeId) {
    return GENESIS_LEVEL_META[badgeId || 'none'] || GENESIS_LEVEL_META.none;
}

function computeHallOfFameForMonth(monthStr) {
    var partners = loadPartners();
    var orders = loadOrders();
    var users = loadUsers();
    var payouts = loadPayouts();

    // Meilleur partenaire par categorie : parmi ceux ayant complete au moins une mission
    // dans le mois (payout stage=balance), le meilleur score global (reutilise le score
    // Phase 1 plutot qu'un second calculateur "du mois" — simplification documentee)
    var bestPartners = [];
    PARTNER_TYPE_VALUES.forEach(function(category) {
        var categoryPartners = partners.filter(function(p) { return p.partner_type === category && p.accountStatus === 'active'; });
        var qualifying = categoryPartners.filter(function(p) {
            return payouts.some(function(pay) {
                return pay.partner_id === p.id && pay.stage === 'balance' && _hofDateInMonth(pay.created_at, monthStr);
            });
        });
        if (!qualifying.length) return;
        var winner = qualifying
            .map(function(p) { return { partner: p, score: getPartnerCategoryScore(p) }; })
            .sort(function(a, b) { return b.score - a.score; })[0];
        bestPartners.push({
            category: category,
            partnerId: winner.partner.id,
            partnerName: (winner.partner.prenom || '') + ' ' + (winner.partner.nom || ''),
            company: winner.partner.company || '',
            score: Math.round(winner.score * 10) / 10
        });
    });

    // Meilleur client : le plus de commandes au solde paye dans le mois
    var clientCounts = {};
    orders.forEach(function(o) {
        if (!o.balance_paid) return;
        var date = o.balance_paid_at || o.updated_at || o.created_at;
        if (!_hofDateInMonth(date, monthStr)) return;
        var email = ((o.client_info && o.client_info.email) || o.email || '').toLowerCase();
        if (!email) return;
        clientCounts[email] = (clientCounts[email] || 0) + 1;
    });
    var bestClient = null;
    Object.keys(clientCounts).forEach(function(email) {
        if (!bestClient || clientCounts[email] > bestClient.count) {
            var user = users.find(function(u) { return u.email.toLowerCase() === email; });
            bestClient = {
                email: email,
                name: user ? ((user.prenom || '') + ' ' + (user.nom || '')).trim() : email,
                count: clientCounts[email]
            };
        }
    });

    // Meilleur parrain (client ou partenaire) : le plus de filleuls valides dans le mois
    var referrerCounts = {};
    users.forEach(function(u) {
        if (!u.referredBy) return;
        var paidDates = orders.filter(function(o) {
            var email = ((o.client_info && o.client_info.email) || o.email || '').toLowerCase();
            return email === u.email.toLowerCase() && o.balance_paid === true;
        }).map(function(o) { return o.balance_paid_at || o.updated_at || o.created_at; }).sort();
        if (paidDates.length && _hofDateInMonth(paidDates[0], monthStr)) {
            referrerCounts[u.referredBy] = (referrerCounts[u.referredBy] || 0) + 1;
        }
    });
    partners.forEach(function(p) {
        if (!p.referredBy || p.accountStatus !== 'active') return;
        // Pas de date d'activation dediee : updatedAt est mis a jour lors du passage a 'active'
        if (_hofDateInMonth(p.updatedAt || p.createdAt, monthStr)) {
            referrerCounts[p.referredBy] = (referrerCounts[p.referredBy] || 0) + 1;
        }
    });
    var bestReferrer = null;
    Object.keys(referrerCounts).forEach(function(id) {
        if (!bestReferrer || referrerCounts[id] > bestReferrer.count) {
            var u = users.find(function(usr) { return usr.id === id; });
            var p = !u ? partners.find(function(ptn) { return ptn.id === id; }) : null;
            var name = u ? ((u.prenom || '') + ' ' + (u.nom || '')).trim() : (p ? ((p.prenom || '') + ' ' + (p.nom || '')).trim() : id);
            bestReferrer = { id: id, type: u ? 'client' : 'partenaire', name: name, count: referrerCounts[id] };
        }
    });

    // Top QG du mois : parmi les partenaires qualifies ce mois-ci (cf bestPartners),
    // le meilleur score parmi ceux ayant atteint le niveau Genesis "Visionnaire" (badge or+)
    var bestTopQG = null;
    (function() {
        var qualifying = partners.filter(function(p) {
            if (p.accountStatus !== 'active') return false;
            var badge = getPartnerBadge(p);
            if (!badge || GENESIS_LEVEL_META[badge].order < GENESIS_LEVEL_META.or.order) return false;
            return payouts.some(function(pay) {
                return pay.partner_id === p.id && pay.stage === 'balance' && _hofDateInMonth(pay.created_at, monthStr);
            });
        });
        if (!qualifying.length) return;
        var winner = qualifying
            .map(function(p) { return { partner: p, score: getPartnerCategoryScore(p) }; })
            .sort(function(a, b) { return b.score - a.score; })[0];
        bestTopQG = {
            partnerId: winner.partner.id,
            name: ((winner.partner.prenom || '') + ' ' + (winner.partner.nom || '')).trim(),
            company: winner.partner.company || '',
            score: Math.round(winner.score * 10) / 10
        };
    })();

    // Plus productif du mois : parmi les clients ayant paye une commande ce mois-ci (cf bestClient),
    // le plus de commandes realisees au total parmi ceux ayant atteint le niveau Genesis "Batisseur" (badge argent+)
    var bestMostProductive = null;
    (function() {
        var candidates = Object.keys(clientCounts).map(function(email) {
            var completed = getClientCompletedOrders(email);
            var badge = getClientBadge(completed);
            return { email: email, completed: completed, badge: badge };
        }).filter(function(c) {
            return c.badge && GENESIS_LEVEL_META[c.badge].order >= GENESIS_LEVEL_META.argent.order;
        });
        if (!candidates.length) return;
        var winner = candidates.sort(function(a, b) { return b.completed - a.completed; })[0];
        var user = users.find(function(u) { return u.email.toLowerCase() === winner.email; });
        bestMostProductive = {
            email: winner.email,
            name: user ? ((user.prenom || '') + ' ' + (user.nom || '')).trim() : winner.email,
            count: winner.completed
        };
    })();

    return {
        month: monthStr,
        computedAt: new Date().toISOString(),
        bestPartners: bestPartners,
        bestClient: bestClient,
        bestReferrer: bestReferrer,
        bestTopQG: bestTopQG,
        bestMostProductive: bestMostProductive
    };
}

function maybeComputeHallOfFame() {
    try {
        var hof = loadHallOfFame();
        var prevMonth = getPreviousMonthStr(new Date());
        if (hof.lastComputedMonth === prevMonth) return;
        var snapshot = computeHallOfFameForMonth(prevMonth);
        hof.snapshots = hof.snapshots || [];
        hof.snapshots.push(snapshot);
        hof.lastComputedMonth = prevMonth;
        saveHallOfFame(hof);
        console.log('[HALL_OF_FAME] Snapshot calcule pour ' + prevMonth);
    } catch (e) {
        console.error('[HALL_OF_FAME] Erreur calcul:', e);
    }
}
setInterval(maybeComputeHallOfFame, 3600000);
maybeComputeHallOfFame();

// Rappels automatiques "Jérémie" par règles (Phase 10) — détecte les missions dont le
// délai annoncé par le partenaire (proposal.delay_days) est dépassé sans être encore en
// livraison, et notifie les deux parties une seule fois (delay_reminder_sent évite les
// rappels en boucle). Volontairement basé sur des règles, pas sur l'API Claude
// (ANTHROPIC_API_KEY toujours absente — même contrainte que pour les litiges/fidélisation).
function checkDelayedMissions() {
    try {
        var dispatches = loadDispatches();
        var requests = loadPartnerRequests();
        var orders = loadOrders();
        var changed = false;
        dispatches.forEach(function(d) {
            if (d.mission_status !== 'in_progress' || d.delay_reminder_sent) return;
            var req = requests.find(function(r) { return r.order_id === d.order_id; });
            var delayDays = req && req.proposal && req.proposal.delay_days;
            if (!delayDays || !d.created_at) return;
            var daysElapsed = (Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24);
            if (daysElapsed <= delayDays) return;

            d.delay_reminder_sent = true;
            changed = true;

            var partner = getPartnerById(d.claimed_by_partner_id);
            if (partner) {
                notifyUser(partner.email, 'partner', 'delay-reminder', 'Délai annoncé dépassé',
                    'Le délai annoncé pour "' + (d.offer_name || 'une mission') + '" est dépassé. Pensez à informer votre client de l\'avancement.',
                    '/app.html#open-partner');
            }
            var order = orders.find(function(o) { return o.id === d.order_id; });
            var clientEmail = order && order.client_info && order.client_info.email;
            if (clientEmail) {
                notifyUser(clientEmail, 'client', 'delay-reminder', 'Mise à jour de votre commande',
                    'Votre prestataire travaille toujours sur votre projet. N\'hésitez pas à le contacter via la messagerie pour un point d\'avancement.',
                    '/app.html#open-resa');
            }
        });
        if (changed) saveDispatches(dispatches);
    } catch (e) {
        console.error('[JEREMIE] Erreur checkDelayedMissions:', e);
    }
}
setInterval(checkDelayedMissions, 3600000);
checkDelayedMissions();

// ============================================================
// QUOTIENT GENESIS (QG) — Systeme de Fidelisation Genesis, Phase 1
// Le QG est l'equivalent visible des "points de contribution" du cahier
// des charges : pas de ledger stocke (les chemins de paiement balance_paid
// sont multiples et non idempotents — un ledger evenementiel risquerait un
// double comptage). Le QG est donc calcule a la volee a partir des memes
// compteurs deja utilises par les badges (missions, avis, parrainages,
// presence aux evenements), exactement comme getPartnerCategoryScore().
// ============================================================
const GENESIS_POINT_VALUES = {
    prestationRealisee: 20,
    reservationEffectuee: 20,
    avisCinqEtoiles: 30,
    avisLaisse: 30,
    workshop: 50,
    evenement: 75,
    parrainage: 100,
    filleulPremierPrestation: 50,
    missionMultiCollab: 75,
    missionRef1:  100,
    missionRef5:  300,
    missionRef10: 500,
    missionRef25: 1000,
    missionRef50: 2000
};
// Avantage bienvenue : absorbé par GENESIS. Taux selon l'origine :
//   sans code de parrainage → -15%  |  avec code de parrainage → -10%
const WELCOME_DISCOUNT_PCT_NO_REFERRAL  = 15;
const WELCOME_DISCOUNT_PCT_WITH_REFERRAL = 10;
const WELCOME_DISCOUNT_PCT = WELCOME_DISCOUNT_PCT_WITH_REFERRAL; // alias backwards-compat
const REFERRAL_FILLEUL_DISCOUNT_PCT     = WELCOME_DISCOUNT_PCT_WITH_REFERRAL; // alias legacy

// Avantages par badge prestataire — commissions explicites (Bronze 25%, Argent 22%, Or 19%, Élite 15%)
const GENESIS_TIER_BENEFITS = {
    null:      { commissionPct: 25, commissionReduction: 0,  payout: 'standard',    events: false, monthlyBoosts: 0 },
    bronze:    { commissionPct: 25, commissionReduction: 0,  payout: 'standard',    events: false, monthlyBoosts: 0 },
    argent:    { commissionPct: 22, commissionReduction: 3,  payout: 'prioritaire', events: false, monthlyBoosts: 2 },
    or:        { commissionPct: 19, commissionReduction: 6,  payout: 'prioritaire', events: true,  monthlyBoosts: 4 },
    elite:     { commissionPct: 15, commissionReduction: 10, payout: 'express',     events: true,  monthlyBoosts: 8 }
};

function getBenefitsForBadge(badge) {
    return GENESIS_TIER_BENEFITS[badge] || GENESIS_TIER_BENEFITS[null];
}

// Boost de visibilité annuaire pour les nouveaux partenaires (< 30 j, < 3 missions)
const NOUVEAU_VENU_BOOST = 15;

// Seuils QG pour les notifications proactives (miroir de _QG_LEVEL_THRESHOLDS côté client)
const GENESIS_QG_THRESHOLDS = [
    { badge: null,     nextPts: 100,  nextLabel: 'Créateur' },
    { badge: 'bronze', nextPts: 300,  nextLabel: 'Bâtisseur' },
    { badge: 'argent', nextPts: 600,  nextLabel: 'Visionnaire' },
    { badge: 'or',     nextPts: 1000, nextLabel: 'Générateur' }
];

// Réduction fidélité pour les paires ayant atteint un palier Cercle Genesis
const CERCLE_ALLIANCE_DISCOUNT_PCT = 5;

// Retourne le prochain seuil QG à atteindre (ou null si palier max)
function getNextQGThreshold(pts) {
    for (var _ti = 0; _ti < GENESIS_QG_THRESHOLDS.length; _ti++) {
        if (GENESIS_QG_THRESHOLDS[_ti].nextPts > 0 && pts < GENESIS_QG_THRESHOLDS[_ti].nextPts) {
            return GENESIS_QG_THRESHOLDS[_ti];
        }
    }
    return null;
}

// Envoie une notification proactive si l'utilisateur est à 1 action du prochain palier
function checkAndSendProactiveQGNotif(email, role, pts) {
    try {
        var _next = getNextQGThreshold(pts);
        if (!_next) return;
        var _gap = _next.nextPts - pts;
        if (_gap <= GENESIS_POINT_VALUES.reservationEffectuee) {
            var _msg = _gap <= GENESIS_POINT_VALUES.avisLaisse
                ? 'Plus qu\'un avis pour atteindre le niveau ' + _next.nextLabel + ' !'
                : 'Plus qu\'une mission pour atteindre le niveau ' + _next.nextLabel + ' !';
            notifyUser(email, role, 'jeremie_proactif',
                'Palier ' + _next.nextLabel + ' en vue !' ,
                _msg + ' (' + pts + '/' + _next.nextPts + ' QG)',
                '/app.html');
        }
    } catch(_e) {}
}

// Vérifie et attribue les récompenses de parrainage et de mission multi_collab.
// Appelée après chaque paiement final (balance_paid). Retourne l'objet user mis à jour
// ou null si aucun changement. Idempotente : les gardes referralBonusQG / missionBonuses.multi_collab
// empêchent tout double-crédit.
function checkReferralAndMissionRewards(clientEmail) {
    try {
        if (!clientEmail) return null;
        var users = loadUsers();
        var uIdx = users.findIndex(function(u) { return (u.email || '').toLowerCase() === clientEmail.toLowerCase(); });
        if (uIdx === -1) return null;
        var user = users[uIdx];
        var dirty = false;

        // 1. FILLEUL : bonus première prestation (+50 QG)
        if (user.referredBy && !user.referralBonusQG) {
            var completedCount = getClientCompletedOrders(clientEmail);
            if (completedCount >= 1) {
                users[uIdx].referralBonusQG = GENESIS_POINT_VALUES.filleulPremierPrestation;
                dirty = true;
                // Notification filleul
                notifyUser(clientEmail, 'client', 'referral_bonus',
                    '🎁 +50 Points QG débloqués !',
                    'Félicitations pour votre première prestation ! Vous gagnez 50 Points QG et débloquez la Mission GENESIS « Collaborer avec 3 professionnels différents ».',
                    '/app.html');
                // Notification parrain (+100 QG via formule, pas de stockage supplémentaire)
                var parrain = users.find(function(u) { return u.id === user.referredBy; });
                if (parrain) {
                    var parrainIdx = users.findIndex(function(u) { return u.id === user.referredBy; });
                    notifyUser(parrain.email, 'client', 'referral_reward',
                        '🎉 Récompense parrainage !',
                        'Votre filleul ' + (users[uIdx].prenom || 'votre filleul') + ' vient de réaliser sa première prestation. Vous gagnez +100 Points QG !',
                        '/app.html');
                    // Missions de parrainage progressives (parrain) — 5 paliers
                    if (parrainIdx !== -1) {
                        var parrainRefCount = getClientReferralCount(users[parrainIdx].id);
                        if (!users[parrainIdx].missionBonuses) users[parrainIdx].missionBonuses = {};
                        var _refMilestones = [
                            { key: 'ref1',  target: 1,  qg: GENESIS_POINT_VALUES.missionRef1  },
                            { key: 'ref5',  target: 5,  qg: GENESIS_POINT_VALUES.missionRef5  },
                            { key: 'ref10', target: 10, qg: GENESIS_POINT_VALUES.missionRef10 },
                            { key: 'ref25', target: 25, qg: GENESIS_POINT_VALUES.missionRef25 },
                            { key: 'ref50', target: 50, qg: GENESIS_POINT_VALUES.missionRef50 }
                        ];
                        _refMilestones.forEach(function(m) {
                            if (parrainRefCount >= m.target && !users[parrainIdx].missionBonuses[m.key]) {
                                users[parrainIdx].missionBonuses[m.key] = true;
                                dirty = true;
                                notifyUser(users[parrainIdx].email, 'client', 'mission_complete',
                                    '🏆 Mission communauté accomplie !',
                                    'Vous avez invité ' + m.target + ' membre' + (m.target > 1 ? 's actifs' : ' actif') + ' dans GENESIS. +' + m.qg + ' Points QG crédités !',
                                    '/app.html');
                            }
                        });
                        // Notification de classement Top Ambassadeurs
                        try {
                            var _orders = loadOrders();
                            var _refMap = {};
                            users.forEach(function(u) {
                                if (u.referredBy && _orders.some(function(o) {
                                    var em = (o.client_email || (o.client_info && o.client_info.email) || '').toLowerCase();
                                    return em === (u.email || '').toLowerCase() && o.balance_paid;
                                })) { _refMap[u.referredBy] = (_refMap[u.referredBy] || 0) + 1; }
                            });
                            var _sorted = Object.keys(_refMap).sort(function(a,b){ return _refMap[b] - _refMap[a]; });
                            var _newRank = _sorted.indexOf(users[parrainIdx].id) + 1;
                            var _rankMsgs = { 1: ['🥇 1ère place !', 'Vous venez de prendre la tête du Top Ambassadeurs GENESIS !'], 2: ['🥈 2ᵉ place !', 'Vous êtes maintenant 2ᵉ du Top Ambassadeurs GENESIS.'], 3: ['🥉 3ᵉ place !', 'Vous êtes maintenant 3ᵉ du Top Ambassadeurs GENESIS.'] };
                            if (_rankMsgs[_newRank]) {
                                notifyUser(users[parrainIdx].email, 'client', 'ambassadeur_rank', _rankMsgs[_newRank][0], _rankMsgs[_newRank][1] + ' (' + parrainRefCount + ' parrainage' + (parrainRefCount > 1 ? 's' : '') + ' validé' + (parrainRefCount > 1 ? 's' : '') + ')', '/app.html');
                            } else if (_newRank > 0 && _newRank <= 10) {
                                notifyUser(users[parrainIdx].email, 'client', 'ambassadeur_rank', '🏆 Top 10 Ambassadeurs !', 'Vous occupez la ' + _newRank + 'ᵉ place du Top Ambassadeurs GENESIS.', '/app.html');
                            }
                        } catch(_rankErr) { console.warn('[HOF_RANK]', _rankErr.message); }
                    }
                    try { checkAndSendProactiveQGNotif(parrain.email, 'client', getClientGenesisPoints(parrain)); } catch(_) {}
                }
            }
        }

        // 2. MISSION multi_collab : +75 QG à la 3e collaboration distincte
        if (!(user.missionBonuses && user.missionBonuses.multi_collab)) {
            var distinctCount = getClientDistinctPartnerCount(clientEmail);
            if (distinctCount >= 3) {
                if (!users[uIdx].missionBonuses) users[uIdx].missionBonuses = {};
                users[uIdx].missionBonuses.multi_collab = true;
                dirty = true;
                notifyUser(clientEmail, 'client', 'mission_complete',
                    '🏆 Mission accomplie !',
                    'Vous avez collaboré avec 3 professionnels différents et gagnez +75 Points QG ! Votre progression GENESIS est mise à jour.',
                    '/app.html');
            }
        }

        if (dirty) {
            saveUsers(users);
            var updated = users[uIdx];
            try { checkAndSendProactiveQGNotif(clientEmail, 'client', getClientGenesisPoints(updated)); } catch(_) {}
            return updated;
        }
        return null;
    } catch (e) {
        console.error('[REFERRAL_REWARDS] Erreur:', e.message);
        return null;
    }
}

function getEventAttendancePoints(personId) {
    if (!personId) return 0;
    var events = loadEvents();
    var total = 0;
    events.forEach(function(ev) {
        (ev.attendees || []).forEach(function(a) {
            if (a.id === personId && a.attended === true) {
                total += ev.type === 'workshop' ? GENESIS_POINT_VALUES.workshop : GENESIS_POINT_VALUES.evenement;
            }
        });
    });
    return total;
}

function getPartnerGenesisPoints(partner, missionsCompleted) {
    if (!partner) return 0;
    var missions = typeof missionsCompleted === 'number' ? missionsCompleted : getPartnerMissionsCompleted(partner.id);
    var fiveStars = loadPartnerReviews().filter(function(r) {
        return r.partnerId === partner.id && r.status === 'published' && r.rating === 5;
    }).length;
    var referrals = getPartnerReferralCount(partner.id);
    return (missions * GENESIS_POINT_VALUES.prestationRealisee)
        + (fiveStars * GENESIS_POINT_VALUES.avisCinqEtoiles)
        + (referrals * GENESIS_POINT_VALUES.parrainage)
        + getEventAttendancePoints(partner.id);
}

function getClientGenesisPoints(user, completedOrders) {
    if (!user) return 0;
    var orders = typeof completedOrders === 'number' ? completedOrders : getClientCompletedOrders(user.email);
    var referrals = getClientReferralCount(user.id);
    var reviewsLeft = loadPartnerReviews().filter(function(r) { return (r.userEmail || '').toLowerCase() === user.email.toLowerCase(); }).length;
    var mb = user.missionBonuses || {};
    return (orders * GENESIS_POINT_VALUES.reservationEffectuee)
        + (reviewsLeft * GENESIS_POINT_VALUES.avisLaisse)
        + (referrals * GENESIS_POINT_VALUES.parrainage)
        + getEventAttendancePoints(user.id)
        + (user.referralBonusQG || 0)
        + (mb.multi_collab ? GENESIS_POINT_VALUES.missionMultiCollab : 0)
        + (mb.ref1  ? GENESIS_POINT_VALUES.missionRef1  : 0)
        + (mb.ref5  ? GENESIS_POINT_VALUES.missionRef5  : 0)
        + (mb.ref10 ? GENESIS_POINT_VALUES.missionRef10 : 0)
        + (mb.ref25 ? GENESIS_POINT_VALUES.missionRef25 : 0)
        + (mb.ref50 ? GENESIS_POINT_VALUES.missionRef50 : 0);
}

function getEventAttendanceCount(personId) {
    if (!personId) return 0;
    var events = loadEvents();
    var count = 0;
    events.forEach(function(ev) {
        (ev.attendees || []).forEach(function(a) {
            if (a.id === personId && a.attended === true) count++;
        });
    });
    return count;
}

// ============================================================
// CONSTELLATION GENESIS (Phase 5) — palier exclusif partenaire, au-dessus
// des 5 niveaux d'evolution. Le cahier des charges ne precise les seuils
// que pour le premier palier (Argent) ; Or et Diamant sont construits par
// extrapolation proportionnelle sur les memes dimensions (QG, note,
// anciennete, missions, evenements) — choix documente ici car non explicite
// dans le plan. "Fondateur" reste l'extension du toggle admin existant
// (partner.founderBadge), independant des autres criteres, et prime sur eux.
// ============================================================
const CONSTELLATION_TIERS = [
    { id: 'diamant', label: 'Constellation Diamant', icon: 'fa-gem', genesisPoints: 5000, rating: 4.9, ancienneteJours: 730, missions: 75, evenements: 3 },
    { id: 'or', label: 'Constellation Or', icon: 'fa-star', genesisPoints: 2500, rating: 4.7, ancienneteJours: 365, missions: 30, evenements: 2 },
    { id: 'argent', label: 'Constellation Argent', icon: 'fa-medal', genesisPoints: 1000, rating: 4.5, ancienneteJours: 180, missions: 10, evenements: 1 }
];

function getConstellationTier(partner) {
    // Constellation Genesis supprimée dans la refonte v2 — toujours null
    return null;
}

// ============================================================
// MISSIONS GENESIS (Phase 3) — catalogue statique, progression calculee a la
// volee a partir des memes compteurs que le QG (pas de nouveau stockage,
// pas de recompense separee : la mission accomplie est deja comptabilisee
// dans le QG via les compteurs source qu'elle agrege).
// ============================================================
const GENESIS_MISSIONS = [
    { id: 'multi_collab',      audience: 'client',  label: 'Collaborer avec 3 professionnels différents',       description: 'Travaillez avec au moins 3 partenaires différents pour enrichir votre réseau Genesis.',          icon: 'fa-people-group',   target: 3,  qgReward: 75  },
    { id: 'event_participation',audience: 'both',   label: 'Participer à un atelier ou événement Genesis',       description: 'Inscrivez-vous et soyez présent à un événement ou workshop organisé par FA GENESIS.',          icon: 'fa-calendar-check', target: 1,  qgReward: 50  },
    { id: 'ref1',  category: 'communaute', audience: 'client', label: 'Inviter 1 nouveau membre actif',    description: 'Votre filleul doit réaliser sa première prestation pour que le parrainage soit validé.',  icon: 'fa-user-plus',      target: 1,  qgReward: 100  },
    { id: 'ref5',  category: 'communaute', audience: 'client', label: 'Inviter 5 nouveaux membres actifs',  description: 'Chacun doit avoir réalisé au moins une prestation.',                                    icon: 'fa-users',          target: 5,  qgReward: 300  },
    { id: 'ref10', category: 'communaute', audience: 'client', label: 'Inviter 10 nouveaux membres actifs', description: 'Chacun doit avoir réalisé au moins une prestation.',                                    icon: 'fa-people-arrows',  target: 10, qgReward: 500  },
    { id: 'ref25', category: 'communaute', audience: 'client', label: 'Inviter 25 nouveaux membres actifs', description: 'Chacun doit avoir réalisé au moins une prestation.',                                    icon: 'fa-globe',          target: 25, qgReward: 1000 },
    { id: 'ref50', category: 'communaute', audience: 'client', label: 'Inviter 50 nouveaux membres actifs', description: 'Chacun doit avoir réalisé au moins une prestation.',                                    icon: 'fa-earth-americas', target: 50, qgReward: 2000 },
    { id: 'alliance_circle',    audience: 'client', label: 'Atteindre le palier Alliance avec un partenaire',    description: 'Collaborez 5 fois avec le même partenaire pour débloquer le Cercle Alliance.',                icon: 'fa-handshake',      target: 5,  qgReward: 100 },
    { id: 'ten_orders',         audience: 'client', label: 'Réaliser 10 prestations',                            description: 'Commandez et finalisez 10 prestations sur la plateforme.',                                   icon: 'fa-receipt',        target: 10, qgReward: 200 },
    { id: 'multi_clients',      audience: 'partner',label: 'Travailler avec 3 clients différents',               description: 'Réalisez des prestations pour au moins 3 clients différents.',                                icon: 'fa-people-group',   target: 3,  qgReward: 75  },
    { id: 'five_star_reviews',  audience: 'partner',label: 'Obtenir 10 avis 5 étoiles',                          description: 'Décrochez 10 avis 5 étoiles de vos clients.',                                                 icon: 'fa-star',           target: 10, qgReward: 150 },
    { id: 'premium_circle',     audience: 'partner',label: 'Construire un Cercle Premium avec un client',         description: 'Collaborez 10 fois avec le même client pour débloquer le Cercle Premium.',                    icon: 'fa-gem',            target: 10, qgReward: 150 }
];

function computeGenesisMissionProgress(mission, person, personType) {
    var current = 0;
    switch (mission.id) {
        case 'multi_collab':
            current = getClientDistinctPartnerCount(person.email);
            break;
        case 'event_participation':
            current = getEventAttendancePoints(person.id) > 0 ? 1 : 0;
            break;
        case 'ref1': case 'ref5': case 'ref10': case 'ref25': case 'ref50':
            current = getClientReferralCount(person.id);
            break;
        case 'alliance_circle':
            current = getClientMaxCollabCount(person.email);
            break;
        case 'ten_orders':
            current = getClientCompletedOrders(person.email);
            break;
        case 'multi_clients':
            current = getPartnerDistinctClientCount(person.id);
            break;
        case 'five_star_reviews':
            current = loadPartnerReviews().filter(function(r) { return r.partnerId === person.id && r.status === 'published' && r.rating === 5; }).length;
            break;
        case 'premium_circle':
            current = getPartnerMaxCollabCount(person.id);
            break;
    }
    var capped = Math.min(current, mission.target);
    return {
        id: mission.id, category: mission.category || null, label: mission.label, description: mission.description, icon: mission.icon,
        current: current, target: mission.target,
        percent: Math.min(100, Math.round(capped / mission.target * 100)),
        completed: current >= mission.target,
        qgReward: mission.qgReward || 0
    };
}

function getGenesisMissions(person, personType) {
    return GENESIS_MISSIONS
        .filter(function(m) { return m.audience === 'both' || m.audience === personType; })
        .map(function(m) { return computeGenesisMissionProgress(m, person, personType); });
}

app.get('/api/genesis/missions', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requis' });
        var token = authHeader.slice(7);
        var user = findUserByToken(token);
        if (user) {
            var mb = user.missionBonuses || {};
            var _claimedKeys = { multi_collab: mb.multi_collab, ref1: mb.ref1, ref5: mb.ref5, ref10: mb.ref10, ref25: mb.ref25, ref50: mb.ref50 };
            var missions = getGenesisMissions(user, 'client').map(function(m) {
                m.rewardClaimed = _claimedKeys[m.id] === true || (m.completed && !['multi_collab','ref1','ref5','ref10','ref25','ref50'].includes(m.id));
                return m;
            });
            return res.json({ success: true, missions: missions });
        }
        var partner = findPartnerByToken(token);
        if (partner) return res.json({ success: true, missions: getGenesisMissions(partner, 'partner') });
        return res.status(401).json({ error: 'Session invalide ou expiree' });
    } catch (e) {
        console.error('[GENESIS-MISSIONS] Erreur:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// JEREMIE - CONSEILLER IA (Phase 6) — prompt systeme ancre dans les
// vraies donnees de la plateforme (QG, missions, opportunites), memoire
// de conversation persistee par personne. Inerte tant que ANTHROPIC_API_KEY
// n'est pas fourni (cf aiService.askJeremie).
// ============================================================

function buildJeremieSystemPrompt(person, personType) {
    var lines = [];
    lines.push('Tu es Jeremie, le conseiller IA de FA GENESIS, une plateforme qui met en relation des clients ' +
        '(createurs de contenu, entrepreneurs, marques) avec des prestataires (videastes, photographes, graphistes, ' +
        'marketeurs, etc.). Tu es chaleureux, concret, jamais inventif sur les chiffres : tu utilises uniquement les ' +
        'donnees ci-dessous, et si tu ne sais pas, tu le dis. Reponds en francais, de maniere construite : une courte ' +
        'phrase d\'accroche, puis 2 a 4 points clairs si le sujet le demande, puis une conclusion actionnable (la ' +
        'prochaine etape concrete a faire). Reste concis, jamais de pave de texte ni de reponse a rallonge inutile. ' +
        'N\'utilise jamais de syntaxe markdown (pas de **, pas de #, pas de listes a tirets) : ecris en texte simple, ' +
        'avec des retours a la ligne pour separer les idees.');
    lines.push('');
    lines.push('Le systeme de fidelisation Genesis repose sur : le Quotient Genesis (QG, points de contribution ' +
        'gagnes par prestation realisee, avis 5 etoiles, parrainage, participation a des evenements), 5 niveaux ' +
        'd\'evolution (Explorateur < Createur < Batisseur < Visionnaire < Generateur), les Cercles Genesis (relation ' +
        'privilegiee avec un partenaire specifique apres plusieurs collaborations), les Missions Genesis (objectifs ' +
        'a debloquer), le Patrimoine Genesis (recapitulatif de parcours), et la Constellation Genesis (palier ' +
        'exclusif Argent/Or/Diamant/Fondateur reserve aux membres les plus actifs et les mieux notes).');

    if (personType === 'guest') {
        lines.push('');
        lines.push('Tu parles a un visiteur non connecte (mode invite) : tu n\'as aucune donnee personnelle sur lui ' +
            'et aucun historique n\'est conserve entre ses messages. Ton role : presenter la plateforme, l\'aider a ' +
            'clarifier son besoin (type de projet, type de prestataire recherche), repondre a ses questions generales ' +
            'sur le fonctionnement et le systeme de fidelisation Genesis, et l\'inciter naturellement a creer un compte ' +
            'ou a parcourir l\'annuaire des prestataires pour aller plus loin. Ne jamais inventer de chiffres personnels ' +
            'puisqu\'il n\'est pas connecte.');
        return lines.join('\n');
    }

    try {
        if (personType === 'client') {
            var completedOrders = getClientCompletedOrders(person.email);
            var badge = getClientBadge(completedOrders);
            var level = getGenesisLevel(badge);
            var genesisPoints = getClientGenesisPoints(person, completedOrders);
            var missions = getGenesisMissions(person, 'client');
            var preferredCategories = getClientPreferredCategories(person.email);
            var referralCount = getClientReferralCount(person.id);

            lines.push('');
            lines.push('Donnees de ce client : prenom=' + (person.prenom || '') + ', niveau Genesis=' + level.label +
                ', QG=' + genesisPoints + ', prestations realisees=' + completedOrders +
                ', partenaires distincts=' + getClientDistinctPartnerCount(person.email) +
                ', parrainages=' + referralCount +
                ', categories preferees=' + (preferredCategories.length ? preferredCategories.join(', ') : 'aucune pour le moment') + '.');
            lines.push('Missions Genesis en cours : ' + (missions.length ? missions.map(function(m) {
                return m.label + ' (' + m.current + '/' + m.target + (m.completed ? ', terminee' : '') + ')';
            }).join(' | ') : 'aucune'));
            lines.push('Ton role avec ce client : conseiller de projet (l\'aider a clarifier son besoin et choisir le bon ' +
                'type de prestataire), recommandation intelligente (s\'appuyer sur ses categories preferees et son historique), ' +
                'detection d\'opportunites (lui suggerer la prochaine mission ou le prochain palier de Cercle Genesis a portee ' +
                'de main), et explication pedagogique du systeme de fidelisation s\'il pose des questions dessus.');
            // Jérémie IA Plus : analyse des habitudes pour les clients Bâtisseur+ (argent/or/elite)
            var argBadge = getClientQGBadge(genesisPoints);
            if (['argent','or','elite'].indexOf(argBadge) !== -1) {
                var habits = buildClientHabitAnalysis(person.email);
                if (habits) {
                    lines.push('');
                    lines.push('Jeremie IA Plus — Analyse des habitudes (niveau Batisseur+) :');
                    lines.push('- ' + habits.totalOrders + ' prestation(s) commandee(s) au total' +
                        (habits.recentCount > 0 ? ', dont ' + habits.recentCount + ' au cours des 90 derniers jours' : '') + '.');
                    lines.push('- Derniere commande il y a ' + habits.daysSinceLast + ' jour' + (habits.daysSinceLast > 1 ? 's' : '') + '.');
                    if (habits.avgGapDays !== null) lines.push('- Rythme moyen : une nouvelle prestation toutes les environ ' + habits.avgGapDays + ' jours.');
                    if (habits.avgValue) lines.push('- Panier moyen : ' + habits.avgValue + ' EUR.');
                    if (habits.topCategories.length) lines.push('- Categories les plus utilisees : ' + habits.topCategories.join(', ') + '.');
                    lines.push('Utilise ces habitudes pour emettre des recommandations proactives personnalisees : si le rythme ' +
                        'est irregulier, suggere de planifier la prochaine prestation ; si le client revient souvent sur les memes ' +
                        'categories, propose de decouvrir des prestataires complementaires ou les offres Promo disponibles ; ' +
                        'si le panier est eleve, signale les offres groupees ou les partenaires avec un excellent rapport qualite/prix.');
                }
            }
            // Jérémie IA Pro — comparaison multicritères & préparation de projet pour Visionnaire+ (or/elite)
            if (['or','elite'].indexOf(argBadge) !== -1) {
                lines.push('');
                lines.push('Jeremie IA Pro — Mode Visionnaire (comparaison multicriteres & preparation de projet) :');
                lines.push('Tu as des capacites enrichies pour ce client de niveau Visionnaire ou superieur :');
                lines.push('1. Comparaison multicriteres : si le client demande a comparer des types de prestataires ou des offres, ' +
                    'structure une analyse sur au moins 3 criteres (budget, delai de livraison, specialite, note moyenne GENESIS). ' +
                    'Base-toi uniquement sur les donnees reelles de la plateforme ; ne pas inventer de chiffres.');
                lines.push('2. Preparation de projet : aide a construire un brief complet (objectif du projet, cible, budget global, ' +
                    'calendrier, indicateurs de reussite, types de prestataires GENESIS requis et dans quel ordre les mobiliser). ' +
                    'Si le projet mobilise plusieurs types de prestataires, propose un sequencage logique des etapes.');
                lines.push('3. Recommandations networking : signale systematiquement les evenements prives GENESIS, webinaires et ' +
                    'sessions reseau disponibles qui correspondent au secteur ou aux projets du client.');
            }
            // Jérémie IA Expert — assistant personnel multi-projets & conseils continus pour Générateur (elite uniquement)
            if (argBadge === 'elite') {
                lines.push('');
                lines.push('Jeremie IA Expert — Mode Generateur (assistant personnel multi-projets & conseils continus) :');
                lines.push('Ce client est au niveau GENERATEUR, le niveau le plus eleve de GENESIS. Tu es son assistant personnel IA ' +
                    'avec des capacites etendues :');
                lines.push('1. Suivi multi-projets : ce client peut avoir plusieurs projets actifs en parallele. Aide-le a les prioriser, ' +
                    'a identifier les dependances entre eux, et a orchestrer ses prestataires de maniere coherente. Si les donnees le ' +
                    'permettent, rappelle-lui l\'etat de ses engagements en cours.');
                lines.push('2. Conseils continus personnalises : base-toi sur l\'integralite de ses donnees d\'usage (historique, ' +
                    'categories preferees, rythme, panier moyen, partenaires habituels) pour formuler des recommandations proactives ' +
                    'avant meme qu\'il ne te pose une question. Anticipe ses besoins selon ses cycles habituels.');
                lines.push('3. Vision strategique : aide-le a structurer une roadmap de contenu ou de croissance sur plusieurs mois. ' +
                    'Identifie les types de prestataires GENESIS a mobiliser selon les etapes, les budgets a prevoir, et les ' +
                    'indicateurs a surveiller. Va au-dela de la prestation unitaire : pense en termes de strategie globale.');
                lines.push('4. Acces VIP et experimental : rappelle-lui proactivement les evenements VIP GENESIS disponibles, les ' +
                    'fonctionnalites experimentales auxquelles il a acces en avant-premiere, et les opportunites exclusives de la ' +
                    'plateforme reservees aux Generateurs. Sois son conseiller de reference, pas seulement un assistant de commande.');
            }
        } else {
            var summary = getPartnerRatingSummary(person.id);
            var missionsCompleted = getPartnerMissionsCompleted(person.id);
            var pBadge = getPartnerBadge(person, summary, missionsCompleted);
            var pLevel = getGenesisLevel(pBadge);
            var pGenesisPoints = getPartnerGenesisPoints(person, missionsCompleted);
            var constellation = getConstellationTier(person);
            var pMissions = getGenesisMissions(person, 'partner');
            var opportunites = findSharedClientPartners(person.id, 3);

            lines.push('');
            lines.push('Donnees de ce partenaire : prenom=' + (person.prenom || '') + ', categorie=' + (person.partner_type || '') +
                ', niveau Genesis=' + pLevel.label + ', QG=' + pGenesisPoints +
                ', note moyenne=' + (summary && summary.average ? summary.average : 'pas encore note') +
                ', prestations realisees=' + missionsCompleted +
                ', Constellation Genesis=' + (constellation ? constellation.label : 'pas encore atteinte') + '.');
            lines.push('Missions Genesis en cours : ' + (pMissions.length ? pMissions.map(function(m) {
                return m.label + ' (' + m.current + '/' + m.target + (m.completed ? ', terminee' : '') + ')';
            }).join(' | ') : 'aucune'));
            lines.push('Partenaires partageant des clients avec lui (opportunites de collaboration) : ' +
                (opportunites.length ? opportunites.map(function(o) { return o.name + ' (' + o.sharedClientCount + ' client(s) en commun)'; }).join(', ') : 'aucune pour le moment'));
            lines.push('Ton role avec ce partenaire : coach de profil et de visibilite (comment progresser de niveau, ' +
                'comment atteindre la Constellation Genesis), detection d\'opportunites de collaboration avec d\'autres ' +
                'partenaires, et explication pedagogique du systeme de fidelisation s\'il pose des questions dessus.');
        }
    } catch (ctxErr) {
        console.error('[JEREMIE] Erreur construction contexte:', ctxErr);
    }
    return lines.join('\n');
}

// Jérémie IA Plus (Bâtisseur+) : analyse des habitudes de commande du client
function buildClientHabitAnalysis(email) {
    try {
        var clientOrders = loadOrders().filter(function(o) {
            return o.client_info && (o.client_info.email || '').toLowerCase() === email.toLowerCase() && o.deposit_paid;
        });
        if (!clientOrders.length) return null;
        clientOrders.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        var now = Date.now();
        var ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
        var recentCount = clientOrders.filter(function(o) { return new Date(o.created_at).getTime() > ninetyDaysAgo; }).length;
        var lastOrder = clientOrders[clientOrders.length - 1];
        var daysSinceLast = Math.round((now - new Date(lastOrder.created_at).getTime()) / (24 * 60 * 60 * 1000));
        var avgGapDays = null;
        if (clientOrders.length >= 2) {
            var gaps = [];
            for (var gi = 1; gi < clientOrders.length; gi++) {
                gaps.push((new Date(clientOrders[gi].created_at) - new Date(clientOrders[gi - 1].created_at)) / (24 * 60 * 60 * 1000));
            }
            avgGapDays = Math.round(gaps.reduce(function(s, g) { return s + g; }, 0) / gaps.length);
        }
        var avgValue = Math.round(clientOrders.reduce(function(s, o) { return s + (parseFloat(o.total_price) || 0); }, 0) / clientOrders.length);
        var orderIds = clientOrders.map(function(o) { return o.id; });
        var catCounts = {};
        loadDispatches().filter(function(d) { return orderIds.indexOf(d.order_id) !== -1 && d.partner_type; }).forEach(function(d) {
            catCounts[d.partner_type] = (catCounts[d.partner_type] || 0) + 1;
        });
        var topCats = Object.keys(catCounts).sort(function(a, b) { return catCounts[b] - catCounts[a]; }).slice(0, 3);
        return { totalOrders: clientOrders.length, recentCount: recentCount, daysSinceLast: daysSinceLast, avgGapDays: avgGapDays, avgValue: avgValue, topCategories: topCats };
    } catch(e) { return null; }
}

// ── SUGGESTION DE PRESTATAIRES PAR JÉRÉMIE (Bâtisseur+) ──────────────────────

function detectPartnerSearchIntent(message) {
    var lc = (message || '').toLowerCase();
    var keywords = [
        'trouv', 'cherch', 'besoin d', 'recherch', 'recommand', 'suggér',
        'prestataire', 'professionnel', 'expert', 'spécialiste', 'qui peut',
        'photographe', 'photo', 'shooting',
        'vidéaste', 'videoaste', 'vidéo', 'video', 'montage', 'réalisation', 'clip',
        'graphiste', 'graphism', 'logo', 'branding', 'charte', 'identité visuelle', 'illustration',
        'marketing', 'marketeur', 'community', 'social media', 'réseaux sociaux',
        'rédact', 'redact', 'copywriting', 'contenu', 'article',
        'développ', 'devlopp', 'site web', 'application mobile',
        'podcast', 'coach', 'formateur', 'formation', 'atelier'
    ];
    return keywords.some(function(kw) { return lc.indexOf(kw) !== -1; });
}

function buildPartnerContextForJeremie(message) {
    try {
        var allPartners = loadPartners().filter(function(p) {
            return p.isActive !== false && p.partner_type;
        });
        if (!allPartners.length) return '';

        var lc = (message || '').toLowerCase();
        var categoryMatches = {
            photo:         ['photo', 'photographe', 'shooting', 'portrait', 'reportage'],
            video:         ['vidéo', 'video', 'vidéaste', 'videoaste', 'montage', 'réalisation', 'film', 'clip'],
            graphisme:     ['graphist', 'logo', 'branding', 'charte', 'design', 'identité visuelle', 'illustration'],
            marketing:     ['marketing', 'marketeur', 'community', 'social media', 'réseaux', 'instagram', 'tiktok', 'campagne'],
            redaction:     ['rédact', 'redact', 'texte', 'contenu', 'article', 'copywriting', 'seo'],
            developpement: ['développ', 'devlopp', 'site web', 'application', 'web', 'app'],
            coaching:      ['coach', 'formateur', 'formation', 'atelier', 'accompagnement']
        };

        var detectedCats = [];
        Object.keys(categoryMatches).forEach(function(cat) {
            if (categoryMatches[cat].some(function(kw) { return lc.indexOf(kw) !== -1; })) {
                detectedCats.push(cat);
            }
        });

        var filtered = allPartners;
        if (detectedCats.length) {
            var byType = allPartners.filter(function(p) {
                var pt = (p.partner_type || '').toLowerCase();
                return detectedCats.some(function(cat) { return pt.indexOf(cat) !== -1; });
            });
            if (byType.length >= 2) filtered = byType;
        }

        // Trier par note décroissante
        filtered = filtered.slice().sort(function(a, b) {
            var ra = getPartnerRatingSummary(a.id);
            var rb = getPartnerRatingSummary(b.id);
            var diff = (rb.average || 0) - (ra.average || 0);
            if (diff !== 0) return diff;
            return (rb.count || 0) - (ra.count || 0);
        });

        var top = filtered.slice(0, 8);
        if (!top.length) return '';

        var lines = [
            'PRESTATAIRES GENESIS DISPONIBLES (données temps réel — utilise cette liste pour tes recommandations) :',
            'Instruction : recommande uniquement des prestataires présents dans cette liste. Explique brièvement pourquoi chacun correspond au besoin exprimé. Ne communique jamais leur email ni téléphone ; invite toujours à consulter leur profil dans l\'onglet Prestataires de l\'application FA GENESIS.',
            ''
        ];

        top.forEach(function(p) {
            var rating  = getPartnerRatingSummary(p.id);
            var price   = getPartnerFromPrice(p);
            var name    = ((p.prenom || '') + ' ' + (p.nom || '')).trim();
            var type    = p.partner_type_other || p.partner_type || '';
            var city    = p.city || '';
            var ratingStr = rating.count
                ? (parseFloat(rating.average || 0).toFixed(1) + '/5 (' + rating.count + ' avis)')
                : 'pas encore noté';
            var priceStr = price ? ('à partir de ' + price + ' €') : '';

            var parts = [name, type];
            if (city)     parts.push(city);
            if (priceStr) parts.push(priceStr);
            parts.push('note : ' + ratingStr);
            lines.push('• ' + parts.join(' | '));
        });

        return lines.join('\n');
    } catch (e) {
        console.error('[JEREMIE] Erreur buildPartnerContextForJeremie:', e);
        return '';
    }
}

app.post('/api/jeremie/chat', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        var message = req.body && typeof req.body.message === 'string' ? req.body.message.trim() : '';
        if (!message) return res.status(400).json({ error: 'Message requis' });
        if (message.length > 2000) return res.status(400).json({ error: 'Message trop long' });

        var jeremieClientIp = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';

        // Mode invite (non authentifie) : pas de memoire persistee, contexte generique,
        // limite stricte par IP pour eviter qu'un tiers non identifie n'abuse de l'API IA.
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            if (!checkRateLimit(jeremieClientIp, 'jeremie_guest', 15, 3600000)) {
                return res.status(429).json({ error: 'Trop de messages. Reessayez plus tard ou creez un compte.' });
            }
            var guestPrompt = buildJeremieSystemPrompt(null, 'guest');
            return aiService.askJeremie(guestPrompt, [], message).then(function(result) {
                if (!result.success) {
                    return res.status(503).json({ error: result.error || 'Jeremie est momentanement indisponible.' });
                }
                res.json({ success: true, reply: result.reply });
            }).catch(function(err) {
                console.error('[JEREMIE] Erreur askJeremie (invite):', err);
                res.status(500).json({ error: 'Erreur serveur' });
            });
        }
        var token = authHeader.slice(7);

        if (!checkRateLimit(jeremieClientIp, 'jeremie', 30, 3600000)) {
            return res.status(429).json({ error: 'Trop de messages. Reessayez dans quelques minutes.' });
        }

        var person = findUserByToken(token);
        var personType = 'client';
        if (!person) {
            person = findPartnerByToken(token);
            personType = 'partner';
        }
        if (!person) return res.status(401).json({ error: 'Session invalide ou expiree' });

        var memory = loadJeremieMemory();
        var entry = memory[person.id] || { messages: [] };
        var history = (entry.messages || []).slice(-20).map(function(m) { return { role: m.role, content: m.content }; });
        var systemPrompt = buildJeremieSystemPrompt(person, personType);

        // Suggestion de prestataires : disponible à partir du niveau Bâtisseur (argent+)
        if (personType === 'client' && detectPartnerSearchIntent(message)) {
            try {
                var _cOrders = getClientCompletedOrders(person.email);
                var _cPoints = getClientGenesisPoints(person, _cOrders);
                var _cBadge  = getClientQGBadge(_cPoints);
                if (['argent', 'or', 'elite'].indexOf(_cBadge) !== -1) {
                    var _pCtx = buildPartnerContextForJeremie(message);
                    if (_pCtx) systemPrompt += '\n\n' + _pCtx;
                }
            } catch (pCtxErr) {
                console.error('[JEREMIE] Erreur injection prestataires:', pCtxErr);
            }
        }

        aiService.askJeremie(systemPrompt, history, message).then(function(result) {
            if (!result.success) {
                return res.status(503).json({ error: result.error || 'Jeremie est momentanement indisponible.' });
            }
            entry.messages = entry.messages || [];
            entry.messages.push({ role: 'user', content: message, date: new Date().toISOString() });
            entry.messages.push({ role: 'assistant', content: result.reply, date: new Date().toISOString() });
            if (entry.messages.length > 60) entry.messages = entry.messages.slice(-60);
            entry.updatedAt = new Date().toISOString();
            memory[person.id] = entry;
            saveJeremieMemory(memory);
            res.json({ success: true, reply: result.reply });
        }).catch(function(err) {
            console.error('[JEREMIE] Erreur askJeremie:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        });
    } catch (e) {
        console.error('[JEREMIE] Erreur route chat:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/jeremie/chat — historique de conversation persiste pour l'utilisateur connecte
app.get('/api/jeremie/chat', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requis' });
        var token = authHeader.slice(7);

        var person = findUserByToken(token);
        if (!person) person = findPartnerByToken(token);
        if (!person) return res.status(401).json({ error: 'Session invalide ou expiree' });

        var memory = loadJeremieMemory();
        var entry = memory[person.id] || { messages: [] };
        res.json({ success: true, messages: entry.messages || [], available: aiService.isJeremieAvailable() });
    } catch (e) {
        console.error('[JEREMIE] Erreur route history:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Hall of Fame public : dernier snapshot mensuel calcule
app.get('/api/hall-of-fame', function(req, res) {
    try {
        var hof = loadHallOfFame();
        var snapshots = hof.snapshots || [];
        var snapshot = snapshots.length ? snapshots[snapshots.length - 1] : null;
        if (snapshot) {
            var partners = loadPartners();
            snapshot = Object.assign({}, snapshot, {
                bestPartners: (snapshot.bestPartners || []).map(function(bp) {
                    var p = partners.find(function(pp) { return pp.id === bp.partnerId; });
                    var coords = p ? getCityCoords(p.city) : null;
                    return Object.assign({}, bp, {
                        id: bp.partnerId,
                        prenom: p ? p.prenom : bp.partnerName.split(' ')[0],
                        nom: p ? p.nom : bp.partnerName.split(' ').slice(1).join(' '),
                        partner_type: bp.category,
                        photo: p ? (p.photo || null) : null,
                        city: p ? (p.city || '') : '',
                        lat: coords ? coords[0] : null,
                        lng: coords ? coords[1] : null,
                        rating: p ? getPartnerRatingSummary(p.id) : null,
                        badge: p ? getPartnerBadge(p) : null,
                        constellation: p ? getConstellationTier(p) : null
                    });
                }),
                bestTopQG: snapshot.bestTopQG ? (function() {
                    var p = partners.find(function(pp) { return pp.id === snapshot.bestTopQG.partnerId; });
                    return Object.assign({}, snapshot.bestTopQG, { photo: p ? (p.photo || null) : null, constellation: p ? getConstellationTier(p) : null });
                })() : null
            });
        }
        res.json({ success: true, hallOfFame: snapshot });
    } catch (e) {
        console.error('[HALL_OF_FAME] Erreur lecture:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// TOP AMBASSADEURS GENESIS — classement cumulatif (tous les temps) basé sur
// le nombre de filleuls ayant réalisé leur première prestation (balance_paid).
// Calculé dynamiquement à la volée en un seul passage sur users + orders.
// ============================================================
app.get('/api/hall-of-fame/ambassadeurs', function(req, res) {
    try {
        var limitParam = parseInt(req.query.limit) || 20;
        var limit = Math.max(1, Math.min(limitParam, 100));
        var users = loadUsers();
        var orders = loadOrders();
        // Marque les filleuls qui ont au moins une prestation payée (balance_paid)
        var filleulsActifs = new Set();
        orders.forEach(function(o) {
            if (o.balance_paid) {
                var em = (o.client_email || (o.client_info && o.client_info.email) || '').toLowerCase();
                if (em) filleulsActifs.add(em);
            }
        });
        // Compte les filleuls actifs par parrain (O(n), un seul passage)
        var refMap = {};
        users.forEach(function(u) {
            if (u.referredBy && u.email && filleulsActifs.has(u.email.toLowerCase())) {
                refMap[u.referredBy] = (refMap[u.referredBy] || 0) + 1;
            }
        });
        var totalAmbassadeurs = Object.keys(refMap).length;
        // Construit le classement
        var leaderboard = users
            .filter(function(u) { return (refMap[u.id] || 0) > 0; })
            .map(function(u) {
                var count = refMap[u.id] || 0;
                var qg = getClientGenesisPoints(u);
                return {
                    id: u.id,
                    name: ((u.prenom || '') + ' ' + (u.nom || '')).trim() || 'Membre GENESIS',
                    prenom: u.prenom || '',
                    photo: u.photo || null,
                    badge: getClientQGBadge(qg),
                    genesisPoints: qg,
                    referralCount: count
                };
            })
            .sort(function(a, b) { return b.referralCount - a.referralCount || b.genesisPoints - a.genesisPoints; })
            .slice(0, limit);
        res.json({ success: true, ambassadeurs: leaderboard, total: totalAmbassadeurs });
    } catch (e) {
        console.error('[HOF_AMBASSADEURS] Erreur:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// EVENEMENTS / WORKSHOPS — Systeme de Fidelisation Genesis, Phase 1
// L'UI admin (admin.html, section #evenementsSection) et l'UI Explorer
// (app.html, onglet "ÉVÉNEMENTS") existaient déjà et appelaient ces routes —
// seul le backend manquait (EVENTS_FILE/loadEvents/saveEvents étaient
// déclarés mais jamais branchés). Contrat conservé tel qu'attendu par ce
// front existant : POST .../create, GET admin renvoie un tableau brut.
// La presence reelle (marquee par l'admin apres coup) declenche les points
// Genesis, pas la simple inscription — voir getEventAttendancePoints().
// ============================================================

// Admin : creer un evenement/workshop
app.post('/api/admin/events/create', function(req, res) {
    try {
        var body = req.body || {};
        if (!body.title || !body.date) {
            return res.status(400).json({ error: 'Titre et date requis' });
        }
        var events = loadEvents();
        var event = {
            id: uuidv4(),
            title: body.title,
            type: body.type || 'workshop',
            date: body.date,
            location: body.location || '',
            image: body.image || '',
            description: body.description || '',
            link: body.link || '',
            published: body.published !== false,
            capacity_limited: body.capacity_limited === true || body.capacity_limited === 'true',
            capacity: body.capacity ? parseInt(body.capacity, 10) : null,
            createdAt: new Date().toISOString(),
            attendees: []
        };
        events.push(event);
        saveEvents(events);
        if (event.published && event.capacity_limited) {
            try { notifyCapacityLimitedEvent(event); } catch(ne) { console.error('[EVENT_NOTIFY] Create:', ne); }
        }
        res.json({ success: true, event: event });
    } catch (e) {
        console.error('[EVENTS] Erreur creation:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin : lister tous les evenements (avec liste complete des inscrits)
app.get('/api/admin/events', function(req, res) {
    try {
        var events = loadEvents().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
        res.json(events);
    } catch (e) {
        console.error('[EVENTS] Erreur lecture admin:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin : modifier un evenement
app.put('/api/admin/events/:id', function(req, res) {
    try {
        var events = loadEvents();
        var idx = events.findIndex(function(e) { return e.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Evenement non trouve' });
        var body = req.body || {};
        var wasPublished = !!events[idx].published;
        ['title', 'description', 'type', 'date', 'location', 'image', 'link', 'published'].forEach(function(field) {
            if (body[field] !== undefined) events[idx][field] = body[field];
        });
        if (body.capacity_limited !== undefined) events[idx].capacity_limited = body.capacity_limited === true || body.capacity_limited === 'true';
        if (body.capacity !== undefined) events[idx].capacity = body.capacity ? parseInt(body.capacity, 10) : null;
        events[idx].updatedAt = new Date().toISOString();
        saveEvents(events);
        if (!wasPublished && events[idx].published && events[idx].capacity_limited) {
            try { notifyCapacityLimitedEvent(events[idx]); } catch(ne) { console.error('[EVENT_NOTIFY] Update:', ne); }
        }
        res.json({ success: true, event: events[idx] });
    } catch (e) {
        console.error('[EVENTS] Erreur modification:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin : supprimer un evenement
app.delete('/api/admin/events/:id', function(req, res) {
    try {
        var events = loadEvents();
        var idx = events.findIndex(function(e) { return e.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Evenement non trouve' });
        events.splice(idx, 1);
        saveEvents(events);
        res.json({ success: true });
    } catch (e) {
        console.error('[EVENTS] Erreur suppression:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin : lister les inscrits d'un evenement (pour pointer la presence)
app.get('/api/admin/events/:id/attendees', function(req, res) {
    try {
        var events = loadEvents();
        var event = events.find(function(e) { return e.id === req.params.id; });
        if (!event) return res.status(404).json({ error: 'Evenement non trouve' });
        res.json({ success: true, attendees: event.attendees || [] });
    } catch (e) {
        console.error('[EVENTS] Erreur lecture inscrits:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin : marquer la presence d'un inscrit (c'est cette action qui declenche les points Genesis)
app.post('/api/admin/events/:id/attendance', function(req, res) {
    try {
        var events = loadEvents();
        var idx = events.findIndex(function(e) { return e.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Evenement non trouve' });
        var attendeeId = (req.body || {}).attendeeId;
        var attended = (req.body || {}).attended !== false;
        var attendee = (events[idx].attendees || []).find(function(a) { return a.id === attendeeId; });
        if (!attendee) return res.status(404).json({ error: 'Inscrit non trouve' });
        attendee.attended = attended;
        attendee.attendedAt = attended ? new Date().toISOString() : null;
        saveEvents(events);
        res.json({ success: true, event: events[idx] });
    } catch (e) {
        console.error('[EVENTS] Erreur presence:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Liste publique des evenements publies a venir (clients et partenaires)
app.get('/api/events', function(req, res) {
    try {
        var now = Date.now();
        var events = loadEvents()
            .filter(function(e) { return e.published !== false && new Date(e.date).getTime() >= now; })
            .sort(function(a, b) { return new Date(a.date) - new Date(b.date); })
            .map(function(e) {
                var rsvpCount = (e.attendees || []).length;
                var coords = getCityCoords(e.location);
                return {
                    id: e.id, title: e.title, description: e.description, type: e.type,
                    date: e.date, location: e.location, image: e.image || '', link: e.link || '',
                    attendeeCount: rsvpCount,
                    capacity_limited: e.capacity_limited || false,
                    capacity: e.capacity || null,
                    spots_left: (e.capacity_limited && e.capacity) ? Math.max(0, e.capacity - rsvpCount) : null,
                    lat: coords ? coords[0] : (e.lat || null),
                    lng: coords ? coords[1] : (e.lng || null),
                    city: e.city || e.location || null
                };
            });
        res.json({ success: true, events: events });
    } catch (e) {
        console.error('[EVENTS] Erreur lecture publique:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Inscription (RSVP) d'un client ou d'un partenaire connecte a un evenement
app.post('/api/events/:id/rsvp', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token d\'authentification requis' });
        }
        var token = authHeader.split(' ')[1];
        var person = null, personType = null;
        var user = findUserByToken(token);
        if (user) { person = user; personType = 'client'; }
        else {
            var partner = findPartnerByToken(token);
            if (partner) { person = partner; personType = 'partner'; }
        }
        if (!person) return res.status(401).json({ error: 'Session invalide ou expiree' });

        var events = loadEvents();
        var idx = events.findIndex(function(e) { return e.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Evenement non trouve' });
        events[idx].attendees = events[idx].attendees || [];
        var already = events[idx].attendees.find(function(a) { return a.id === person.id; });
        if (already) return res.json({ success: true, event: events[idx], alreadyRsvp: true });

        // Vérification capacité limitée
        if (events[idx].capacity_limited && events[idx].capacity) {
            var rsvpCount = events[idx].attendees.length;
            if (rsvpCount >= events[idx].capacity) {
                // Visionnaire+ (or/elite) ont la priorité — ils peuvent toujours s'inscrire
                var isPriority = false;
                if (personType === 'client') {
                    var qgForPriority = getClientGenesisPoints(person, getClientCompletedOrders(person.email));
                    var badgeForPriority = getClientQGBadge(qgForPriority);
                    isPriority = ['or', 'elite'].indexOf(badgeForPriority) !== -1;
                }
                if (!isPriority) {
                    return res.status(409).json({ error: 'Complet', full: true, spots_left: 0,
                        message: 'Cet événement est complet. Les membres Visionnaire+ ont un accès prioritaire.' });
                }
            }
        }

        events[idx].attendees.push({
            id: person.id,
            type: personType,
            name: ((person.prenom || '') + ' ' + (person.nom || '')).trim() || person.email,
            rsvpAt: new Date().toISOString(),
            attended: false,
            attendedAt: null
        });
        saveEvents(events);
        res.json({ success: true, event: events[idx] });
    } catch (e) {
        console.error('[EVENTS] Erreur RSVP:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Annuaire public des partenaires (recherche, filtre categorie, filtre prix)
app.get('/api/partners/directory', (req, res) => {
    try {
        const { category, q, maxPrice, city, sort, promo } = req.query;
        const allPromos = loadPromotions();
        let partners = loadPartners().filter(p => p.accountStatus === 'active');

        if (category) {
            partners = partners.filter(p => p.partner_type === category);
        }
        if (q) {
            const needle = q.trim().toLowerCase();
            partners = partners.filter(p => {
                const typeLabel = (PARTNER_TYPES.find(t => t.value === p.partner_type) || {}).label || '';
                return ((p.prenom || '') + ' ' + (p.nom || '')).toLowerCase().includes(needle)
                    || typeLabel.toLowerCase().includes(needle)
                    || (p.partner_type_other || '').toLowerCase().includes(needle)
                    || (p.city || '').toLowerCase().includes(needle)
                    || (p.company || '').toLowerCase().includes(needle);
            });
        }
        if (city) {
            const needleCity = city.trim().toLowerCase();
            partners = partners.filter(p => (p.city || '').toLowerCase().includes(needleCity));
        }

        // Filtre "en promotion" : ne garder que les partenaires avec une promo active
        if (promo === 'true') {
            partners = partners.filter(p => allPromos.some(pr => pr.partner_id === p.id && isPromoActive(pr)));
        }

        // Tri applique sur les partenaires bruts (avant la mise en forme) afin de pouvoir
        // reutiliser le score composite / la note / la date d'inscription le cas echeant.
        const sortMode = sort || 'score';
        if (sortMode === 'recent') {
            partners = partners.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } else if (sortMode === 'rating') {
            partners = partners.slice().sort((a, b) => {
                const ra = getPartnerRatingSummary(a.id), rb = getPartnerRatingSummary(b.id);
                if (rb.average !== ra.average) return rb.average - ra.average;
                return rb.count - ra.count;
            });
        } else if (sortMode === 'alpha') {
            partners = partners.slice().sort((a, b) => ((a.nom || '') + (a.prenom || '')).localeCompare((b.nom || '') + (b.prenom || '')));
        } else {
            partners = partners.slice().sort((a, b) => getPartnerCategoryScore(b) - getPartnerCategoryScore(a));
        }

        let results = partners.map((p, idx) => {
            return Object.assign(partnerDirectoryShape(p, allPromos), {
                verified: true,
                rank: (sortMode === 'score' && idx < 3) ? idx + 1 : null
            });
        });

        if (maxPrice !== undefined && maxPrice !== '') {
            const maxPriceNum = parseFloat(maxPrice);
            if (!isNaN(maxPriceNum)) {
                results = results.filter(r => r.fromPrice !== null && r.fromPrice <= maxPriceNum);
            }
        }

        res.json({ success: true, partners: results });
    } catch (error) {
        console.error('[PARTNERS-DIRECTORY] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors du chargement de l\'annuaire' });
    }
});

// Detail public d'un partenaire + ses avis publies
app.get('/api/partners/:id/reviews', (req, res) => {
    try {
        const partner = loadPartners().find(p => p.id === req.params.id && p.accountStatus === 'active');
        if (!partner) {
            return res.status(404).json({ error: 'Partenaire non trouve' });
        }
        const fromPrice = getPartnerFromPrice(partner);
        const activeServices = (partner.services || []).filter(s => s.active !== false)
            .map(s => ({ id: s.id, label: s.label, description: s.description || '', price: s.price, pricing_type: s.pricing_type || 'fixed', features: Array.isArray(s.features) ? s.features : [], audience: s.audience || 'particulier', image: s.image || '' }));
        const activePortfolio = (partner.portfolio || [])
            .map(item => ({ id: item.id, type: item.type, url: item.url, thumb: item.thumb || '', caption: item.caption || '' }));
        const reviews = loadPartnerReviews()
            .filter(r => r.partnerId === partner.id && r.status === 'published')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(r => ({ rating: r.rating, comment: r.comment || '', userName: r.userName || 'Client GENESIS', createdAt: r.createdAt }));

        // Cercle Genesis : relation de ce client precis avec ce partenaire (si connecte)
        let cercleGenesis = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            const clientUser = findUserByToken(token);
            if (clientUser) {
                const collabCount = getClientPartnerCollabCount(clientUser.email, partner.id);
                if (collabCount > 0) cercleGenesis = getCercleGenesisProgress(collabCount);
            }
        }

        res.json({
            success: true,
            partner: {
                id: partner.id,
                prenom: partner.prenom,
                nom: partner.nom,
                partner_type: partner.partner_type,
                partner_type_other: partner.partner_type_other || '',
                photo: partner.photo || null,
                bio: partner.bio || '',
                city: partner.city || '',
                social: partner.social || {},
                fromPrice: fromPrice,
                avgResponseMinutes: typeof partner.avgResponseMinutes === 'number' ? partner.avgResponseMinutes : null,
                responseTimeCommitmentMinutes: typeof partner.responseTimeCommitmentMinutes === 'number' ? partner.responseTimeCommitmentMinutes : null,
                rating: getPartnerRatingSummary(partner.id),
                badge: getPartnerBadge(partner),
                constellation: getConstellationTier(partner),
                services: activeServices,
                portfolio: activePortfolio,
                verified: true,
                cercleGenesis: cercleGenesis,
                cercleDiscountPct: (cercleGenesis && cercleGenesis.current) ? CERCLE_ALLIANCE_DISCOUNT_PCT : 0
            },
            reviews: reviews
        });
    } catch (error) {
        console.error('[PARTNERS-DIRECTORY] Erreur reviews:', error);
        res.status(500).json({ error: 'Erreur lors du chargement des avis' });
    }
});

// Top prestataires d'une categorie, classes par score composite (badge, note, missions, anciennete, satisfaction, reponse)
app.get('/api/partners/top', (req, res) => {
    try {
        const { category, limit } = req.query;
        if (!category) return res.status(400).json({ error: 'category requis' });
        const max = Math.max(1, Math.min(parseInt(limit) || 10, 50));
        const categoryPartners = loadPartners().filter(p => p.accountStatus === 'active' && p.partner_type === category);

        const ranked = categoryPartners
            .map(p => ({ partner: p, score: getPartnerCategoryScore(p) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, max)
            .map(entry => partnerDirectoryShape(entry.partner));

        res.json({ success: true, category: category, partners: ranked });
    } catch (error) {
        console.error('[PARTNERS-TOP] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors du chargement du classement' });
    }
});

// Professionnels a la Une : meilleurs partenaires toutes categories confondues, classes par score composite
app.get('/api/partners/featured', (req, res) => {
    try {
        const { limit, category } = req.query;
        const max = Math.max(1, Math.min(parseInt(limit) || 10, 50));
        let activePartners = loadPartners().filter(p => p.accountStatus === 'active');
        if (category) activePartners = activePartners.filter(p => p.partner_type === category);

        const ranked = activePartners
            .map(p => ({ partner: p, score: getPartnerCategoryScore(p) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, max)
            .map(entry => partnerDirectoryShape(entry.partner));

        res.json({ success: true, partners: ranked });
    } catch (error) {
        console.error('[PARTNERS-FEATURED] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors du chargement des professionnels à la une' });
    }
});

function partnerDirectoryShape(p, allPromos) {
    var promos = allPromos || loadPromotions();
    var ap = promos.find(function(pr) { return pr.partner_id === p.id && isPromoActive(pr); }) || null;
    const coords = getCityCoords(p.city);
    var badge = getPartnerBadge(p);
    var activeDists = getPartnerActiveDistinctions(p, badge);
    return {
        id: p.id,
        prenom: p.prenom,
        nom: p.nom,
        partner_type: p.partner_type,
        partner_type_other: p.partner_type_other || '',
        photo: p.photo || null,
        city: p.city || '',
        lat: coords ? coords[0] : null,
        lng: coords ? coords[1] : null,
        fromPrice: getPartnerFromPrice(p),
        avgResponseMinutes: typeof p.avgResponseMinutes === 'number' ? p.avgResponseMinutes : null,
        responseTimeCommitmentMinutes: typeof p.responseTimeCommitmentMinutes === 'number' ? p.responseTimeCommitmentMinutes : null,
        rating: getPartnerRatingSummary(p.id),
        badge: badge,
        distinctions: _serializeDistinctions(activeDists),
        profile_boost_active: !!(p.profile_boost_until && new Date(p.profile_boost_until) > new Date()),
        constellation: getConstellationTier(p),
        activePromo: ap ? { id: ap.id, title: ap.title, type: ap.type, value: ap.value, end_date: ap.end_date } : null
    };
}

// Nouveaux Talents : partenaires actifs les plus recemment inscrits
app.get('/api/partners/new', (req, res) => {
    try {
        const { limit, category } = req.query;
        const max = Math.max(1, Math.min(parseInt(limit) || 10, 50));
        let pool = loadPartners().filter(p => p.accountStatus === 'active');
        if (category) pool = pool.filter(p => p.partner_type === category);
        const sorted = pool
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, max)
            .map(partnerDirectoryShape);
        res.json({ success: true, partners: sorted });
    } catch (error) {
        console.error('[PARTNERS-NEW] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors du chargement des nouveaux talents' });
    }
});

// Deduit les categories de partenaires preferees d'un client a partir de ses favoris
// et des prestations qu'il a deja reservees (dispatches acceptes lies a ses commandes).
function getClientPreferredCategories(email) {
    if (!email) return [];
    var counts = {};
    try {
        var lowerEmail = email.toLowerCase();
        var partners = loadPartners();
        var users = loadUsers();
        var user = users.find(function(u) { return (u.email || '').toLowerCase() === lowerEmail; });
        if (user && user.favoris && user.favoris.length) {
            user.favoris.forEach(function(pid) {
                var p = partners.find(function(pp) { return pp.id === pid; });
                if (p && p.partner_type) counts[p.partner_type] = (counts[p.partner_type] || 0) + 2;
            });
        }
        var orders = loadOrders();
        var orderIds = orders
            .filter(function(o) { return o.client_info && (o.client_info.email || '').toLowerCase() === lowerEmail; })
            .map(function(o) { return o.id; });
        if (orderIds.length) {
            loadDispatches()
                .filter(function(d) { return d.partner_type && d.status === 'accepted' && orderIds.indexOf(d.order_id) !== -1; })
                .forEach(function(d) { counts[d.partner_type] = (counts[d.partner_type] || 0) + 1; });
        }
    } catch (e) { /* signal best-effort, jamais bloquant */ }
    return Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; });
}

// Recommandes pour vous : partenaires des categories preferees du client (favoris + historique
// de reservations), completes par le classement "a la une" generique pour remplir la liste.
app.get('/api/partners/recommended', (req, res) => {
    try {
        const { limit } = req.query;
        const max = Math.max(1, Math.min(parseInt(limit) || 10, 50));

        var email = null;
        var authHeader = req.headers.authorization || '';
        if (authHeader.toLowerCase().startsWith('bearer ')) {
            var token = authHeader.slice(7).trim();
            var sessionUser = findUserByToken(token);
            if (sessionUser) email = sessionUser.email;
        }
        var preferredCategories = email ? getClientPreferredCategories(email) : [];

        var ranked = loadPartners()
            .filter(p => p.accountStatus === 'active')
            .map(p => ({ partner: p, score: getPartnerCategoryScore(p) }));

        var result = [];
        var usedIds = {};
        preferredCategories.forEach(function(cat) {
            ranked
                .filter(function(e) { return e.partner.partner_type === cat; })
                .sort(function(a, b) { return b.score - a.score; })
                .forEach(function(e) {
                    if (result.length < max && !usedIds[e.partner.id]) {
                        result.push(e.partner);
                        usedIds[e.partner.id] = true;
                    }
                });
        });
        if (result.length < max) {
            ranked
                .sort(function(a, b) { return b.score - a.score; })
                .forEach(function(e) {
                    if (result.length < max && !usedIds[e.partner.id]) {
                        result.push(e.partner);
                        usedIds[e.partner.id] = true;
                    }
                });
        }

        res.json({
            success: true,
            personalized: preferredCategories.length > 0,
            partners: result.slice(0, max).map(partnerDirectoryShape)
        });
    } catch (error) {
        console.error('[PARTNERS-RECOMMENDED] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors du chargement des recommandations' });
    }
});

// Offres promotionnelles publiques : toutes les prestations audience=promo des partenaires actifs
app.get('/api/partners/promo-services', (req, res) => {
    try {
        var results = [];
        loadPartners()
            .filter(function(p){ return p.published && (p.services || []).some(function(s){ return s.audience === 'promo' && s.active !== false; }); })
            .forEach(function(p){
                var partnerName = ((p.prenom || '') + ' ' + (p.nom || '')).trim();
                (p.services || [])
                    .filter(function(s){ return s.audience === 'promo' && s.active !== false; })
                    .forEach(function(s){
                        results.push({
                            partner_id: p.id,
                            partner_name: partnerName,
                            partner_photo: p.photo || null,
                            partner_type: p.type || null,
                            partner_rating: typeof p.rating === 'number' ? p.rating : null,
                            service_id: s.id,
                            label: s.label,
                            description: s.description || '',
                            price: s.price,
                            pricing_type: s.pricing_type,
                            image: s.image || null,
                            features: s.features || []
                        });
                    });
            });
        results.sort(function(a, b){ return (b.partner_rating || 0) - (a.partner_rating || 0); });
        res.json({ promo_services: results.slice(0, 24) });
    } catch (error) {
        console.error('[PROMO-SERVICES] Erreur:', error);
        res.status(500).json({ error: 'Erreur chargement offres promo' });
    }
});

// ============================================================
// EVENEMENTS ET WORKSHOPS
// ============================================================

// Liste publique des evenements publies, tries par date croissante
app.get('/api/events', (req, res) => {
    try {
        var events = loadEvents()
            .filter(function(e) { return e.published === true; })
            .sort(function(a, b) { return new Date(a.date) - new Date(b.date); })
            .map(function(e) {
                var coords = getCityCoords(e.location);
                return Object.assign({}, e, { lat: coords ? coords[0] : null, lng: coords ? coords[1] : null });
            });
        res.json({ success: true, events: events });
    } catch (error) {
        console.error('[EVENTS] Erreur liste publique:', error);
        res.status(500).json({ error: 'Erreur chargement des evenements' });
    }
});

// ── ADMIN CAMPAGNES & JEUX CONCOURS ──────────────────────────────────────────

// Liste toutes les campagnes/jeux (admin)
app.get('/api/admin/campagnes', function(req, res) {
    try { res.json({ ok: true, campagnes: loadCampagnes() }); }
    catch(e) { res.status(500).json({ error: 'Erreur lecture campagnes' }); }
});

// Créer une campagne ou un jeu concours
app.post('/api/admin/campagnes', function(req, res) {
    try {
        var body = req.body || {};
        var titre = (body.titre || '').trim();
        if (!titre) return res.status(400).json({ error: 'Le titre est obligatoire' });
        if (['campagne','jeu'].indexOf(body.type) === -1) return res.status(400).json({ error: 'type doit être campagne ou jeu' });
        var now = new Date().toISOString();
        var item = {
            id: 'CAM-' + uuidv4().split('-')[0].toUpperCase(),
            type: body.type,
            titre: titre,
            description: (body.description || '').trim(),
            lien: (body.lien || '').trim(),
            active: body.active !== false,
            created_at: now,
            updated_at: now
        };
        var all = loadCampagnes();
        all.push(item);
        saveCampagnes(all);
        res.json({ success: true, item: item });
    } catch(e) {
        console.error('[ADMIN] Erreur creation campagne:', e);
        res.status(500).json({ error: 'Erreur création campagne' });
    }
});

// Modifier une campagne ou un jeu
app.put('/api/admin/campagnes/:id', function(req, res) {
    try {
        var all = loadCampagnes();
        var idx = all.findIndex(function(c) { return c.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Entrée non trouvée' });
        var body = req.body || {};
        if (body.titre !== undefined) all[idx].titre = body.titre.trim();
        if (body.description !== undefined) all[idx].description = body.description.trim();
        if (body.lien !== undefined) all[idx].lien = body.lien.trim();
        if (body.active !== undefined) all[idx].active = body.active === true;
        if (body.type !== undefined && ['campagne','jeu'].indexOf(body.type) !== -1) all[idx].type = body.type;
        all[idx].updated_at = new Date().toISOString();
        saveCampagnes(all);
        res.json({ success: true, item: all[idx] });
    } catch(e) {
        console.error('[ADMIN] Erreur modif campagne:', e);
        res.status(500).json({ error: 'Erreur modification campagne' });
    }
});

// Supprimer une campagne ou un jeu
app.delete('/api/admin/campagnes/:id', function(req, res) {
    try {
        var all = loadCampagnes();
        var idx = all.findIndex(function(c) { return c.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Entrée non trouvée' });
        all.splice(idx, 1);
        saveCampagnes(all);
        res.json({ success: true });
    } catch(e) {
        console.error('[ADMIN] Erreur suppression campagne:', e);
        res.status(500).json({ error: 'Erreur suppression campagne' });
    }
});

// ── ANNONCES DE NOUVELLES FONCTIONNALITÉS ──────────────────────────
// Bâtisseur+ (argent/or/elite) reçoivent la notification immédiatement.
// Créateur (bronze) et sans niveau : notification différée de 24h via processScheduledNotifs().
app.post('/api/admin/feature-announcement', function(req, res) {
    try {
        var body = req.body || {};
        if (!body.title) return res.status(400).json({ error: 'Titre requis' });

        var title = String(body.title).substring(0, 120);
        var description = body.description ? String(body.description).substring(0, 400) : 'Découvrez la nouvelle fonctionnalité de l\'application GENESIS.';
        var link = body.link || '/app.html';
        var experimental = body.experimental === true;
        var notifType = experimental ? 'fonctionnalite_experimentale' : 'nouvelle_fonctionnalite';
        var immediateCount = 0;
        var scheduledCount = 0;
        var later24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        var scheduled = loadScheduledNotifs();

        loadUsers().forEach(function(user) {
            if (!user.email) return;
            var qg = getClientGenesisPoints(user, getClientCompletedOrders(user.email));
            var badge = getClientQGBadge(qg);
            var isImmediate = experimental ? (badge === 'elite') : (['argent', 'or', 'elite'].indexOf(badge) !== -1);
            if (isImmediate) {
                notifyUser(user.email, 'client', notifType, title, description, link);
                immediateCount++;
            } else {
                scheduled.push({
                    id: uuidv4(), email: user.email, role: 'client',
                    type: notifType, title: title, body: description, link: link,
                    sendAt: later24h, sent: false, createdAt: new Date().toISOString()
                });
                scheduledCount++;
            }
        });

        saveScheduledNotifs(scheduled);
        res.json({ success: true, immediate: immediateCount, scheduled: scheduledCount, experimental: experimental });
    } catch(e) {
        console.error('[FEATURE_ANNONCE] Erreur:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Notifie les clients quand un evenement a capacite limitee est publie
// Visionnaire (or) + Generateur (elite) : notification immediate + email
// Createur (bronze), sans niveau (null), Batisseur (argent) : 24h plus tard
function notifyCapacityLimitedEvent(event) {
    try {
        var title = 'Événement exclusif : ' + event.title;
        var body = 'Un événement à places limitées est disponible dans Événements. Réservez vite !';
        var link = '/app.html';
        var later24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        var scheduled = loadScheduledNotifs();
        loadUsers().forEach(function(user) {
            if (!user.email) return;
            var qg = getClientGenesisPoints(user, getClientCompletedOrders(user.email));
            var badge = getClientQGBadge(qg);
            if (['or', 'elite'].indexOf(badge) !== -1) {
                notifyUser(user.email, 'client', 'evenement_capacite_limitee', title, body, link);
                emailService.sendCapacityLimitedEventEmail(user.email, user.prenom, event.title, link).catch(function(e) {
                    console.warn('[EVENT_NOTIFY] Email prioritaire:', e.message);
                });
            } else {
                scheduled.push({
                    id: uuidv4(),
                    email: user.email,
                    role: 'client',
                    type: 'evenement_capacite_limitee',
                    title: title,
                    body: body,
                    link: link,
                    emailType: 'capacity_limited_event',
                    emailEventTitle: event.title,
                    userPrenom: user.prenom || null,
                    sendAt: later24h,
                    sent: false,
                    createdAt: new Date().toISOString()
                });
            }
        });
        saveScheduledNotifs(scheduled);
        console.log('[EVENT_NOTIFY] notifyCapacityLimitedEvent planifie pour:', event.title);
    } catch(e) {
        console.error('[EVENT_NOTIFY] notifyCapacityLimitedEvent:', e);
    }
}

// Admin : utilisateurs par niveau QG en temps reel
app.get('/api/admin/users-by-level', function(req, res) {
    try {

        var tiers = [
            { id: 'elite',  label: 'Générateur',  pts: 1000 },
            { id: 'or',     label: 'Visionnaire',  pts: 600  },
            { id: 'argent', label: 'Bâtisseur',    pts: 300  },
            { id: 'bronze', label: 'Créateur',     pts: 100  },
            { id: null,     label: 'Sans niveau',  pts: 0    }
        ];
        var buckets = {};
        tiers.forEach(function(t) { buckets[t.id || 'none'] = { label: t.label, pts: t.pts, count: 0, users: [] }; });

        var allUsers = loadUsers();
        allUsers.forEach(function(user) {
            if (!user.email) return;
            var qg = getClientGenesisPoints(user, getClientCompletedOrders(user.email));
            var badge = getClientQGBadge(qg);
            var key = badge || 'none';
            if (!buckets[key]) key = 'none';
            buckets[key].count++;
            buckets[key].users.push({
                email: user.email,
                nom: ((user.prenom || '') + ' ' + (user.nom || '')).trim(),
                qg: qg,
                createdAt: user.createdAt || null
            });
        });

        var ordered = tiers.map(function(t) {
            var key = t.id || 'none';
            return { id: t.id, key: key, label: t.label, pts: t.pts, count: buckets[key].count, users: buckets[key].users };
        });

        res.json({ success: true, tiers: ordered, total: allUsers.length });
    } catch(e) {
        console.error('[ADMIN] users-by-level:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Soumission d'un avis client sur un partenaire (suite a une demande post-paiement solde)
app.post('/api/partner-reviews', (req, res) => {
    try {
        var authHeader = req.headers.authorization || '';
        var token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
        if (!token) return res.status(401).json({ success: false, message: 'Token manquant' });

        var users = loadUsers();
        var user = findUserByToken(token);
        if (!user) return res.status(401).json({ success: false, message: 'Session invalide' });

        var body = req.body || {};
        var dispatchId = (body.dispatchId || '').trim();
        var rating = parseInt(body.rating) || 0;
        var comment = (body.comment || '').trim();

        if (!dispatchId) return res.status(400).json({ success: false, message: 'dispatchId manquant' });
        if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'La note doit être entre 1 et 5.' });

        var dispatches = loadDispatches();
        var dIdx = dispatches.findIndex(function(d) { return d.id === dispatchId; });
        if (dIdx === -1) return res.status(404).json({ success: false, message: 'Mission non trouvée' });
        var dispatch = dispatches[dIdx];
        if (dispatch.status !== 'accepted') return res.status(403).json({ success: false, message: 'Mission non éligible à un avis' });

        var orders = loadOrders();
        var order = orders.find(function(o) { return o.id === dispatch.order_id; });
        if (!order || !order.client_info || (order.client_info.email || '').toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ success: false, message: 'Accès refusé à cette mission' });
        }

        var review = {
            id: 'PRV-' + uuidv4().split('-')[0],
            dispatchId: dispatch.id,
            orderId: dispatch.order_id,
            partnerId: dispatch.claimed_by_partner_id,
            userEmail: user.email,
            userName: ((user.prenom || '') + ' ' + (user.nom || '')).trim() || user.email,
            rating: rating,
            comment: comment,
            status: 'published',
            createdAt: new Date().toISOString()
        };

        var reviews = loadPartnerReviews();
        reviews.push(review);
        savePartnerReviews(reviews);

        dispatches[dIdx].review_submitted = true;
        saveDispatches(dispatches);

        if (rating === 5 && review.partnerId) {
            var allPtnrs = loadPartners();
            var rvPIdx = allPtnrs.findIndex(function(p) { return p.id === review.partnerId; });
            if (rvPIdx !== -1) {
                if (!Array.isArray(allPtnrs[rvPIdx].pendingQGGains)) allPtnrs[rvPIdx].pendingQGGains = [];
                allPtnrs[rvPIdx].pendingQGGains.push({ type: 'avisCinqEtoiles', amount: GENESIS_POINT_VALUES.avisCinqEtoiles, from: review.userName, created_at: review.createdAt });
                savePartners(allPtnrs);
            }
        }

        // Tâche 7 : Jérémie proactif — vérifier si le client approche un palier
        try {
            var _rvClientUser = loadUsers().find(function(u) { return (u.email||'')===(review.userEmail||''); });
            if (_rvClientUser) checkAndSendProactiveQGNotif(_rvClientUser.email, 'client', getClientGenesisPoints(_rvClientUser));
        } catch(_e) {}

        res.json({ success: true, review: review, client_qg_gain: GENESIS_POINT_VALUES.avisLaisse });
    } catch (error) {
        console.error('[PARTNER-REVIEWS] Erreur soumission avis:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de l\'enregistrement de l\'avis' });
    }
});

// ============================================================
// ENDPOINTS PARTENAIRES - PROJETS
// ============================================================

// Liste des projets assignes au partenaire
app.get('/api/partner/projects', authenticatePartner, (req, res) => {
    try {
        const assignments = loadPartnerAssignments().filter(
            a => a.partner_id === req.partner.id && a.status === 'active'
        );
        const orders = loadOrders();
        const projects = assignments.map(a => {
            const order = orders.find(o => o.id === a.order_id);
            if (!order) return null;
            return {
                assignment: a,
                order: {
                    id: order.id,
                    product_name: order.product_name,
                    product_type: order.product_type,
                    status: order.status,
                    created_at: order.created_at,
                    schedule_status: order.schedule_status || null,
                    start_date: order.start_date || null,
                    deposit_paid: order.deposit_paid === true,
                    balance_paid: order.balance_paid === true,
                    balance_payment_ready: order.balance_payment_ready === true,
                    client_name: order.client_info
                        ? (order.client_info.first_name + ' ' + (order.client_info.last_name || '').charAt(0) + '.')
                        : 'Client'
                }
            };
        }).filter(Boolean);
        res.json(projects);
    } catch (error) {
        console.error('[PARTNER] Erreur projects:', error);
        res.status(500).json({ error: 'Erreur chargement projets' });
    }
});

// ============================================================
//  DISPATCH — Système de missions (course entre partenaires)
// ============================================================

// GET /api/partner/dispatches — missions à accepter / ouvertes pour ce type
app.get('/api/partner/dispatches', authenticatePartner, function(req, res) {
    try {
        var dispatches = loadDispatches();
        var pType = req.partner.partner_type;
        var partnerId = req.partner.id;
        var available = dispatches
            .filter(function(d) {
                if (d.partner_type !== pType) return false;
                if (d.status === 'open') return true;
                if (d.status === 'pending_acceptance') {
                    var declined = d.declined_partners || [];
                    return declined.indexOf(partnerId) === -1;
                }
                return false;
            })
            .sort(function(a, b) {
                var prioDiff = (b.priority || 0) - (a.priority || 0);
                if (prioDiff !== 0) return prioDiff;
                return new Date(a.created_at) - new Date(b.created_at);
            });
        res.json({ dispatches: available });
    } catch(e) {
        console.error('[DISPATCH] Erreur liste:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/partner/dispatches/count — badge count
app.get('/api/partner/dispatches/count', authenticatePartner, function(req, res) {
    try {
        var dispatches = loadDispatches();
        var pType = req.partner.partner_type;
        var partnerId = req.partner.id;
        var count = dispatches.filter(function(d) {
            if (d.partner_type !== pType) return false;
            if (d.status === 'open') return true;
            if (d.status === 'pending_acceptance') {
                var declined = d.declined_partners || [];
                return declined.indexOf(partnerId) === -1;
            }
            return false;
        }).length;
        res.json({ count: count });
    } catch(e) {
        res.status(500).json({ error: 'Erreur' });
    }
});

// POST /api/partner/dispatches/:id/claim — prendre en charge (premier arrivé = servi)
app.post('/api/partner/dispatches/:id/claim', authenticatePartner, function(req, res) {
    var dispatchId = req.params.id;
    if (_dispatchLocks[dispatchId]) {
        return res.status(409).json({ error: 'Mission en cours de traitement. Réessayez dans un instant.' });
    }
    _dispatchLocks[dispatchId] = true;
    try {
        var dispatches = loadDispatches();
        var idx = dispatches.findIndex(function(d) { return d.id === dispatchId; });
        if (idx === -1) {
            delete _dispatchLocks[dispatchId];
            return res.status(404).json({ error: 'Mission introuvable' });
        }
        var dispatch = dispatches[idx];
        var isPendingAcc = dispatch.status === 'pending_acceptance';
        if (dispatch.status !== 'open' && !isPendingAcc) {
            delete _dispatchLocks[dispatchId];
            return res.status(409).json({ taken: true, error: 'Cette mission a déjà été prise en charge par un autre partenaire.' });
        }
        if (dispatch.partner_type !== req.partner.partner_type) {
            delete _dispatchLocks[dispatchId];
            return res.status(403).json({ error: 'Cette mission ne correspond pas à votre domaine.' });
        }

        var partnerName = req.body.partner_name || req.partner.prenom || req.partner.email;
        var claimMessage = req.body.claim_message || '';
        var proposedStart = req.body.proposed_start || null;
        var profileId = req.body.profile_id || null;

        dispatches[idx].status = isPendingAcc ? 'accepted' : 'taken';
        dispatches[idx].claimed_by_name = partnerName;
        dispatches[idx].claimed_by_profile = profileId;
        dispatches[idx].claimed_by_partner_id = req.partner.id;
        dispatches[idx].claimed_at = new Date().toISOString();
        dispatches[idx].claim_message = claimMessage;
        dispatches[idx].proposed_start = proposedStart;
        if (isPendingAcc) dispatches[idx].accepted_at = new Date().toISOString();
        saveDispatches(dispatches);

        // Créer l'assignation partenaire pour que le projet apparaisse dans son espace
        var assignments = loadPartnerAssignments();
        assignments.push({
            id: 'ASG-' + uuidv4().split('-')[0],
            partner_id: req.partner.id,
            partner_email: req.partner.email,
            partner_type: req.partner.partner_type,
            order_id: dispatch.order_id,
            assigned_at: new Date().toISOString(),
            assigned_by: 'partner-claim',
            status: 'active',
            notes: 'Mission prise en charge par ' + partnerName + (proposedStart ? ' — Démarrage proposé : ' + proposedStart : ''),
            dispatch_id: dispatchId,
            sub_profile_name: partnerName
        });
        savePartnerAssignments(assignments);

        // Si la mission était en attente d'acceptation, déclencher le versement de l'acompte
        if (isPendingAcc) {
            processDispatchPayout(dispatches[idx], 'deposit').catch(function(e) { console.error('[PAYOUT] Erreur acompte claim:', e); });
        }

        delete _dispatchLocks[dispatchId];
        var claimMsg = isPendingAcc ? 'Mission acceptée ! Votre acompte est en cours de versement.' : 'Mission prise en charge avec succès !';
        res.json({ success: true, message: claimMsg });
    } catch(e) {
        delete _dispatchLocks[dispatchId];
        console.error('[DISPATCH] Erreur claim:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/partner/dispatches/:id/accept — accepter explicitement une mission (pending_acceptance → accepted)
app.post('/api/partner/dispatches/:id/accept', authenticatePartner, function(req, res) {
    var dispatchId = req.params.id;
    if (_dispatchLocks[dispatchId]) {
        return res.status(409).json({ error: 'Mission en cours de traitement. Réessayez dans un instant.' });
    }
    _dispatchLocks[dispatchId] = true;
    try {
        var dispatches = loadDispatches();
        var idx = dispatches.findIndex(function(d) { return d.id === dispatchId; });
        if (idx === -1) { delete _dispatchLocks[dispatchId]; return res.status(404).json({ error: 'Mission introuvable' }); }

        var dispatch = dispatches[idx];
        if (dispatch.status !== 'pending_acceptance') {
            delete _dispatchLocks[dispatchId];
            return res.status(409).json({ error: 'Cette mission n\'est plus en attente d\'acceptation (statut: ' + dispatch.status + ').' });
        }
        if (dispatch.partner_type !== req.partner.partner_type) {
            delete _dispatchLocks[dispatchId];
            return res.status(403).json({ error: 'Cette mission ne correspond pas à votre domaine.' });
        }

        var partnerName = req.partner.prenom || req.partner.email;
        dispatches[idx].status = 'accepted';
        dispatches[idx].claimed_by_name = partnerName;
        dispatches[idx].claimed_by_partner_id = req.partner.id;
        dispatches[idx].claimed_at = new Date().toISOString();
        dispatches[idx].accepted_at = new Date().toISOString();
        saveDispatches(dispatches);

        var assignments = loadPartnerAssignments();
        assignments.push({
            id: 'ASG-' + uuidv4().split('-')[0],
            partner_id: req.partner.id,
            partner_email: req.partner.email,
            partner_type: req.partner.partner_type,
            order_id: dispatch.order_id,
            assigned_at: new Date().toISOString(),
            assigned_by: 'partner-accept',
            status: 'active',
            notes: 'Mission acceptée par ' + partnerName,
            dispatch_id: dispatchId,
            sub_profile_name: partnerName
        });
        savePartnerAssignments(assignments);

        var _claimOrder = loadOrders().find(function(o) { return o.id === dispatch.order_id; });
        if (!_claimOrder || _claimOrder.payment_tier !== 'small') {
            processDispatchPayout(dispatches[idx], 'deposit').catch(function(e) { console.error('[PAYOUT] Erreur acompte accept:', e); });
        }

        delete _dispatchLocks[dispatchId];
        res.json({ success: true, message: 'Mission acceptée ! Votre acompte est en cours de versement.' });
    } catch(e) {
        delete _dispatchLocks[dispatchId];
        console.error('[DISPATCH] Erreur accept:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/partner/dispatches/:id/decline — refuser une mission (reste visible pour les autres partenaires)
app.post('/api/partner/dispatches/:id/decline', authenticatePartner, function(req, res) {
    try {
        var dispatches = loadDispatches();
        var idx = dispatches.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Mission introuvable' });

        if (dispatches[idx].partner_type !== req.partner.partner_type) {
            return res.status(403).json({ error: 'Cette mission ne correspond pas à votre domaine.' });
        }
        if (dispatches[idx].status !== 'pending_acceptance') {
            return res.status(409).json({ error: 'Statut invalide pour refuser cette mission.' });
        }

        var declined = dispatches[idx].declined_partners || [];
        if (declined.indexOf(req.partner.id) === -1) declined.push(req.partner.id);
        dispatches[idx].declined_partners = declined;
        saveDispatches(dispatches);

        console.log('[DISPATCH] Refus de ' + req.partner.email + ' pour mission ' + req.params.id);
        res.json({ success: true, message: 'Mission refusée.' });
    } catch(e) {
        console.error('[DISPATCH] Erreur decline:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Le partenaire signale qu'il finalise les fichiers (frise de suivi, Phase 8) —
// transition manuelle unique, les autres statuts de la frise sont déduits automatiquement.
app.post('/api/partner/dispatches/:id/mark-delivering', authenticatePartner, function(req, res) {
    try {
        var dispatches = loadDispatches();
        var idx = dispatches.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Mission introuvable' });
        if (dispatches[idx].claimed_by_partner_id !== req.partner.id) {
            return res.status(403).json({ error: 'Cette mission ne vous appartient pas.' });
        }
        if (dispatches[idx].mission_status && dispatches[idx].mission_status !== 'in_progress') {
            return res.status(409).json({ error: 'Cette mission a déjà dépassé cette étape.' });
        }
        dispatches[idx].mission_status = 'delivering';
        dispatches[idx].delivering_at = new Date().toISOString();
        saveDispatches(dispatches);

        var order = loadOrders().find(function(o) { return o.id === dispatches[idx].order_id; });
        var clientEmail = order && order.client_info && order.client_info.email;
        if (clientEmail) {
            notifyUser(clientEmail, 'client', 'mission-status', 'Livraison en cours', 'Votre prestataire finalise vos livrables.', '/app.html#open-resa');
        }
        res.json({ success: true, mission_status: 'delivering' });
    } catch(e) {
        console.error('[DISPATCH] Erreur mark-delivering:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Partenaire uploade une photo directement depuis sa mission (crée ou met à jour le livrable lié).
app.post('/api/partner/dispatches/:id/upload-photo', authenticatePartner, function(req, res) {
    try {
        var imageDataUrl = req.body.image_data_url;
        var caption = req.body.caption || '';
        if (!imageDataUrl || imageDataUrl.indexOf('data:image') !== 0) {
            return res.status(400).json({ error: 'image_data_url (data URI image) requis' });
        }
        var dispatches = loadDispatches();
        var idx = dispatches.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Mission introuvable' });
        if (dispatches[idx].claimed_by_partner_id !== req.partner.id) {
            return res.status(403).json({ error: 'Cette mission ne vous appartient pas.' });
        }
        var orderId = dispatches[idx].order_id;
        var livrables = loadLivrables();
        var livIdx = livrables.findIndex(function(l) { return l.order_id === orderId; });
        var now = new Date().toISOString();
        if (livIdx === -1) {
            var newLiv = ensureLivrableFields({
                id: 'LIV-' + Date.now(),
                order_id: orderId,
                file_url: imageDataUrl,
                download_url: imageDataUrl,
                title: 'Photo de livrable',
                caption: caption,
                workflow_status: 'PENDING_PARTNER',
                owner_role: 'partner',
                owner_partner_id: req.partner.id,
                created_at: now,
                updated_at: now
            });
            livrables.push(newLiv);
            saveLivrables(livrables);
            return res.json({ success: true, created: true, livrable: newLiv });
        } else {
            var liv = livrables[livIdx];
            if (liv.workflow_status === 'PUBLISHED') {
                return res.status(400).json({ error: 'Livrable déjà publié, modification impossible' });
            }
            if (!liv.versions) liv.versions = [];
            liv.versions.push({
                version_number: liv.versions.length + 1,
                updated_by_role: 'partner',
                updated_by_id: req.partner.id,
                file_url: imageDataUrl,
                change_note: caption || 'Photo ajoutée',
                created_at: now
            });
            liv.file_url = imageDataUrl;
            liv.download_url = imageDataUrl;
            if (caption) liv.caption = caption;
            liv.workflow_status = 'PENDING_PARTNER';
            liv.owner_role = 'partner';
            liv.owner_partner_id = req.partner.id;
            liv.updated_at = now;
            livrables[livIdx] = liv;
            saveLivrables(livrables);
            return res.json({ success: true, created: false, livrable: ensureLivrableFields(liv) });
        }
    } catch(e) {
        console.error('[DISPATCH] Erreur upload-photo:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GENESIS SAFE™ — le partenaire confirme la livraison d'une mission "small" (≤ 300 €) :
// libère les fonds retenus et notifie le client.
app.post('/api/partner/dispatches/:id/mark-delivered', authenticatePartner, async function(req, res) {
    try {
        var dispatches = loadDispatches();
        var idx = dispatches.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Mission introuvable' });
        var dispatch = dispatches[idx];

        var partners = loadPartners();
        var partner = partners.find(function(p) { return p.id === dispatch.partner_id; });
        if (!partner || partner.email !== req.partnerEmail) {
            return res.status(403).json({ error: 'Accès refusé' });
        }

        // Charger la commande liée
        var orders = loadOrders();
        var oIdx = orders.findIndex(function(o) { return o.id === dispatch.order_id; });
        if (oIdx === -1) return res.status(404).json({ error: 'Commande introuvable' });
        var order = orders[oIdx];

        if (order.payment_tier !== 'small') {
            return res.status(400).json({ error: 'Cette route s\'applique uniquement aux missions GENESIS SAFE™ ≤ 300 €.' });
        }
        if (order.delivery_confirmed) {
            return res.status(400).json({ error: 'Livraison déjà confirmée.' });
        }

        // Marquer la livraison sur la commande
        orders[oIdx] = Object.assign({}, order, {
            delivery_confirmed: true,
            delivery_confirmed_at: new Date().toISOString(),
            status: 'delivered',
            updated_at: new Date().toISOString()
        });
        saveOrders(orders);

        // Libérer les fonds retenus → payout au prestataire
        await processDispatchPayout(dispatch, 'deposit');
        console.log('[DISPATCH] GENESIS SAFE™ — livraison confirmée, fonds libérés, acompte versé au prestataire', dispatch.id);

        // Notifier le client que les livrables sont disponibles
        var clientEmail = order.client_info && order.client_info.email;
        if (clientEmail) {
            notifyUser(clientEmail, 'client', 'delivery_ready',
                'Livrables disponibles',
                'Votre prestataire a confirmé la livraison. Vous pouvez maintenant télécharger vos fichiers.',
                '/app.html#reservations');
        }

        res.json({ success: true, delivery_confirmed: true });
    } catch(e) {
        console.error('[DISPATCH] Erreur mark-delivered:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
//  DEMANDES DIRECTES — Client choisit un partenaire précis,
//  qui accepte ou refuse librement (remplace le dispatch broadcast)
// ============================================================

// POST /api/partner-requests — le client envoie une demande à un partenaire précis
app.post('/api/partner-requests', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var partnerId = req.body.partnerId;
        var serviceId = req.body.serviceId;
        if (!partnerId || !serviceId) {
            return res.status(400).json({ error: 'partnerId et serviceId requis' });
        }

        var partner = getPartnerById(partnerId);
        if (!partner) return res.status(404).json({ error: 'Partenaire non trouvé' });
        if (partner.accountStatus !== 'active') {
            return res.status(400).json({ error: 'Ce partenaire n\'est pas disponible actuellement' });
        }
        var service = (partner.services || []).find(function(s) { return s.id === serviceId && s.active !== false; });
        if (!service) return res.status(404).json({ error: 'Prestation non trouvée' });

        var requests = loadPartnerRequests();
        var alreadyPending = requests.some(function(r) {
            return r.client_email === user.email && r.partner_id === partnerId && r.service_id === serviceId && r.status === 'pending';
        });
        if (alreadyPending) {
            return res.status(409).json({ error: 'Vous avez déjà une demande en attente pour cette prestation auprès de ce partenaire.' });
        }

        var newRequest = {
            id: 'PREQ-' + uuidv4().split('-')[0].toUpperCase(),
            client_email: user.email,
            client_name: ((user.prenom || '') + ' ' + (user.nom || '')).trim() || user.email,
            partner_id: partnerId,
            service_id: serviceId,
            service_label: service.label,
            price: service.price,
            budget_note: (req.body.budgetNote || '').toString().substring(0, 300),
            desired_date: req.body.desiredDate || null,
            location: (req.body.location || '').toString().substring(0, 200),
            description: (req.body.description || '').toString().substring(0, 1500),
            files: Array.isArray(req.body.files) ? req.body.files.slice(0, 5) : [],
            status: 'pending',
            created_at: new Date().toISOString(),
            responded_at: null
        };
        requests.push(newRequest);
        savePartnerRequests(requests);

        notifyUser(partner.email, 'partner', 'partner-request', 'Nouvelle demande de mission', newRequest.client_name + ' souhaite vous engager pour : ' + service.label, '/app.html#open-partner');

        res.json({ success: true, request: newRequest });
    } catch(e) {
        console.error('[PARTNER-REQUEST] Erreur création:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/my-quotes — le client liste ses devis personnalisés (catégorie C), pour les voir
// sans dépendre uniquement du lien envoyé par email. L'acceptance_token n'est exposé que
// pour les devis SENT_TO_CLIENT (seul état où on a besoin d'appeler /api/quotes/accept).
app.get('/api/my-quotes', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var quotes = loadQuotes()
            .filter(function(q) { return q.client_email && q.client_email.toLowerCase() === user.email.toLowerCase(); })
            .sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); })
            .map(function(q) {
                return {
                    id: q.id,
                    quote_number: q.quote_number,
                    status: q.status,
                    service_type: q.service_type,
                    brief: q.brief,
                    pricing: q.pricing,
                    admin_final: q.admin_final,
                    validity_days: q.validity_days,
                    sent_at: q.sent_at,
                    accepted_at: q.accepted_at,
                    created_at: q.created_at,
                    order_id: q.order_id,
                    acceptance_token: q.status === 'SENT_TO_CLIENT' ? q.acceptance_token : null
                };
            });
        res.json({ quotes: quotes });
    } catch (e) {
        console.error('[QUOTE] Erreur liste devis client:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/my-requests — le client liste ses demandes envoyées
app.get('/api/my-requests', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var allDispatchesForRequests = loadDispatches();
        var allOrdersForRequests = loadOrders();
        var allLivrablesForRequests = loadLivrables();
        var allReviewsForRequests = loadPartnerReviews();
        var requests = loadPartnerRequests()
            .filter(function(r) { return r.client_email === user.email; })
            .sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); })
            .map(function(r) {
                var partner = getPartnerById(r.partner_id);
                var out = JSON.parse(JSON.stringify(r));
                out.partner_name = partner ? (partner.prenom ? (partner.prenom + ' ' + (partner.nom || '')) : partner.company || partner.email) : 'Partenaire';
                out.partner_email = partner ? (partner.email || partner.contact_email || null) : null;
                var dispatchForReq = null;
                if (r.order_id) {
                    dispatchForReq = allDispatchesForRequests.find(function(d) { return d.order_id === r.order_id; });
                    out.dispatch_id = dispatchForReq ? dispatchForReq.id : null;
                }
                var orderForReq = r.order_id ? allOrdersForRequests.find(function(o) { return o.id === r.order_id; }) : null;
                var livrablesForReq = orderForReq ? allLivrablesForRequests.filter(function(l) { return l.order_id === orderForReq.id; }) : [];
                var hasReviewForReq = !!(dispatchForReq && allReviewsForRequests.some(function(rv) { return rv.dispatchId === dispatchForReq.id; }));
                out.display_status = computeMissionDisplayStatus(r, dispatchForReq, orderForReq, livrablesForReq, hasReviewForReq);
                out.step_timestamps = {
                    received: r.created_at || null,
                    accepted: dispatchForReq ? (dispatchForReq.accepted_at || null) : (r.responded_at || null),
                    delivering: dispatchForReq ? (dispatchForReq.delivering_at || null) : null
                };
                // Infos partenaire pour la carte de suivi et le widget accueil
                out.partner_photo = partner ? (partner.photo || null) : null;
                out.partner_type = partner ? (partner.partner_type || null) : null;
                out.partner_city = partner ? (partner.city || null) : null;
                out.partner_bio = partner ? (partner.bio || null) : null;
                out.partner_rating = partner ? getPartnerRatingSummary(partner.id) : null;
                out.partner_badge = partner ? getPartnerBadge(partner) : null;
                // Champs GENESIS SAFE™ Phase 3 : bloc de paiement différencié côté client
                out.payment_tier = orderForReq ? (orderForReq.payment_tier || null) : null;
                out.delivery_confirmed = orderForReq ? (!!orderForReq.delivery_confirmed) : false;
                out.total_amount = orderForReq
                    ? (orderForReq.total_amount || r.total_price || r.price || 0)
                    : (r.total_price || r.price || 0);
                out.installments = (orderForReq && Array.isArray(orderForReq.installments))
                    ? orderForReq.installments.map(function(inst) {
                        return {
                            stage: inst.stage,
                            label: inst.label || inst.key || inst.stage,
                            amount: inst.amount || 0,
                            paid: !!inst.paid
                        };
                    })
                    : null;
                return out;
            });
        res.json({ requests: requests });
    } catch(e) {
        console.error('[PARTNER-REQUEST] Erreur liste client:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/my-partner-collabs — liste des IDs partenaires avec qui le client a collaboré
// (commande entièrement payée), utilisé par l'annuaire pour le filtre "Déjà travaillé avec vous".
app.get('/api/my-partner-collabs', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;
        var needle = user.email.toLowerCase();
        var paidOrderIds = {};
        loadOrders().forEach(function(o) {
            var oe = (o.client_info && o.client_info.email) || o.email || '';
            if (oe.toLowerCase() === needle && o.balance_paid === true) paidOrderIds[o.id] = true;
        });
        var collabIds = {};
        loadDispatches().forEach(function(d) {
            if (d.claimed_by_partner_id && paidOrderIds[d.order_id]) collabIds[d.claimed_by_partner_id] = true;
        });
        res.json({ partner_ids: Object.keys(collabIds) });
    } catch(e) {
        console.error('[MY-COLLABS]', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/partner/requests — le partenaire liste ses demandes actives : celles en attente
// d'une action de sa part (pending = à accepter/refuser, accepted = à proposer un contrat,
// proposed = en attente de signature client) ET celles déjà signées/payées (mission engagée,
// avec la frise de suivi Phase 8) — exclut seulement les demandes closes (declined/expired/cancelled).
app.get('/api/partner/requests', authenticatePartner, function(req, res) {
    try {
        var allDispatchesForPtnr = loadDispatches();
        var allOrdersForPtnr = loadOrders();
        var allLivrablesForPtnr = loadLivrables();
        var allReviewsForPtnr = loadPartnerReviews();
        var requests = loadPartnerRequests()
            .filter(function(r) {
                return r.partner_id === req.partner.id
                    && ['pending', 'accepted', 'proposed', 'signed'].indexOf(r.status) !== -1;
            })
            .sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); })
            .map(function(r) {
                var dispatchForReq = r.order_id ? allDispatchesForPtnr.find(function(d) { return d.order_id === r.order_id; }) : null;
                var orderForReq = r.order_id ? allOrdersForPtnr.find(function(o) { return o.id === r.order_id; }) : null;
                var livrablesForReq = orderForReq ? allLivrablesForPtnr.filter(function(l) { return l.order_id === orderForReq.id; }) : [];
                var hasReviewForReq = !!(dispatchForReq && allReviewsForPtnr.some(function(rv) { return rv.dispatchId === dispatchForReq.id; }));
                var out = JSON.parse(JSON.stringify(r));
                out.dispatch_id = dispatchForReq ? dispatchForReq.id : null;
                out.payment_tier = orderForReq ? (orderForReq.payment_tier || null) : null;
                out.delivery_confirmed = orderForReq ? (!!orderForReq.delivery_confirmed) : false;
                out.display_status = computeMissionDisplayStatus(r, dispatchForReq, orderForReq, livrablesForReq, hasReviewForReq);
                return out;
            });
        res.json({ requests: requests });
    } catch(e) {
        console.error('[PARTNER-REQUEST] Erreur liste partenaire:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/partner/requests/:id/accept — le partenaire accepte librement la demande
app.post('/api/partner/requests/:id/accept', authenticatePartner, function(req, res) {
    try {
        var requests = loadPartnerRequests();
        var idx = requests.findIndex(function(r) { return r.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Demande introuvable' });
        if (requests[idx].partner_id !== req.partner.id) {
            return res.status(403).json({ error: 'Cette demande ne vous concerne pas.' });
        }
        if (requests[idx].status !== 'pending') {
            return res.status(409).json({ error: 'Cette demande n\'est plus en attente (statut: ' + requests[idx].status + ').' });
        }

        requests[idx].status = 'accepted';
        requests[idx].responded_at = new Date().toISOString();
        savePartnerRequests(requests);

        var partnerName = req.partner.prenom || req.partner.email;
        notifyUser(requests[idx].client_email, 'client', 'partner-request', 'Demande acceptée ✅', partnerName + ' a accepté votre demande pour : ' + requests[idx].service_label + '. Vous pouvez payer l\'acompte.', '/app.html#open-reservations');

        res.json({ success: true, message: 'Demande acceptée.' });
    } catch(e) {
        console.error('[PARTNER-REQUEST] Erreur accept:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/partner/requests/:id/decline — le partenaire refuse librement la demande
app.post('/api/partner/requests/:id/decline', authenticatePartner, function(req, res) {
    try {
        var requests = loadPartnerRequests();
        var idx = requests.findIndex(function(r) { return r.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Demande introuvable' });
        if (requests[idx].partner_id !== req.partner.id) {
            return res.status(403).json({ error: 'Cette demande ne vous concerne pas.' });
        }
        if (requests[idx].status !== 'pending') {
            return res.status(409).json({ error: 'Cette demande n\'est plus en attente (statut: ' + requests[idx].status + ').' });
        }

        requests[idx].status = 'declined';
        requests[idx].responded_at = new Date().toISOString();
        savePartnerRequests(requests);

        notifyUser(requests[idx].client_email, 'client', 'partner-request', 'Demande refusée', 'Le partenaire n\'est pas disponible pour : ' + requests[idx].service_label + '. Vous pouvez en choisir un autre dans l\'annuaire.', '/app.html#open-prestataires');

        res.json({ success: true, message: 'Demande refusée.' });
    } catch(e) {
        console.error('[PARTNER-REQUEST] Erreur decline:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
//  GENESIS CONTRACT™ — proposition structurée du partenaire
//  + signature électronique simple du client (case + nom + IP)
// ============================================================

var PARTNER_REQUEST_MILESTONES = [
    { key: 'kickoff', label: 'Acompte', pct: 30 },
    { key: 'mid_delivery', label: 'Livrable intermédiaire', pct: 40 },
    { key: 'final_delivery', label: 'Livraison finale', pct: 30 }
];

// GET /api/my-requests/:id — détail d'une demande (avec proposition si présente)
app.get('/api/my-requests/:id', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var requests = loadPartnerRequests();
        var found = requests.find(function(r) { return r.id === req.params.id; });
        if (!found) return res.status(404).json({ error: 'Demande introuvable' });
        if (found.client_email !== user.email) return res.status(403).json({ error: 'Accès non autorisé' });

        var partner = getPartnerById(found.partner_id);
        var out = JSON.parse(JSON.stringify(found));
        out.partner_name = partner ? (partner.prenom ? (partner.prenom + ' ' + (partner.nom || '')) : partner.company || partner.email) : 'Partenaire';
        res.json({ request: out });
    } catch(e) {
        console.error('[PARTNER-REQUEST] Erreur détail client:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/partner/requests/:id/propose — le partenaire envoie sa proposition structurée
app.post('/api/partner/requests/:id/propose', authenticatePartner, function(req, res) {
    try {
        var items = req.body.items;
        var totalPrice = parseFloat(req.body.total_price);
        var delayDays = parseInt(req.body.delay_days) || 0;
        var revisionsIncluded = parseInt(req.body.revisions_included) || 0;
        var notes = (req.body.notes || '').toString().substring(0, 1000);

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Au moins une ligne de proposition requise' });
        }
        if (!totalPrice || totalPrice <= 0) {
            return res.status(400).json({ error: 'Le prix total doit être supérieur à 0' });
        }

        var requests = loadPartnerRequests();
        var idx = requests.findIndex(function(r) { return r.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Demande introuvable' });
        if (requests[idx].partner_id !== req.partner.id) {
            return res.status(403).json({ error: 'Cette demande ne vous concerne pas.' });
        }
        if (requests[idx].status !== 'accepted') {
            return res.status(409).json({ error: 'Cette demande ne peut pas recevoir de proposition (statut: ' + requests[idx].status + ').' });
        }

        requests[idx].proposal = {
            items: items.map(function(it) { return { label: (it.label || '').toString().substring(0, 200), amount: parseFloat(it.amount) || 0 }; }),
            total_price: totalPrice,
            delay_days: delayDays,
            revisions_included: revisionsIncluded,
            notes: notes,
            milestones: PARTNER_REQUEST_MILESTONES,
            created_at: new Date().toISOString()
        };
        requests[idx].status = 'proposed';
        savePartnerRequests(requests);

        notifyUser(requests[idx].client_email, 'client', 'partner-request', 'Proposition reçue 📋', 'Le partenaire vous a envoyé une proposition pour : ' + requests[idx].service_label + '. Merci de la consulter et de signer le contrat.', '/app.html#open-reservations');

        res.json({ success: true, message: 'Proposition envoyée avec succès', request: requests[idx] });
    } catch(e) {
        console.error('[PARTNER-REQUEST] Erreur propose:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/my-requests/:id/sign-contract — signature électronique simple du client (GENESIS CONTRACT™)
app.post('/api/my-requests/:id/sign-contract', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var signatureName = (req.body.signatureName || '').trim();
        var accepted = req.body.accepted === true;
        if (!accepted) return res.status(400).json({ error: 'Vous devez accepter les conditions pour continuer.' });
        if (!signatureName || signatureName.length < 2) return res.status(400).json({ error: 'Merci de saisir votre nom complet pour signer.' });

        var requests = loadPartnerRequests();
        var idx = requests.findIndex(function(r) { return r.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Demande introuvable' });
        if (requests[idx].client_email !== user.email) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }
        if (requests[idx].status !== 'proposed') {
            return res.status(409).json({ error: 'Aucune proposition à signer pour le moment (statut: ' + requests[idx].status + ').' });
        }

        var signIp = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        requests[idx].contract_signed = true;
        requests[idx].contract_signed_at = new Date().toISOString();
        requests[idx].contract_signature_name = signatureName;
        requests[idx].contract_signature_ip = signIp;
        requests[idx].status = 'signed';
        savePartnerRequests(requests);

        console.log('[CONTRACT] Signature client demande ' + requests[idx].id + ' par ' + user.email + ' (' + signIp + ')');
        res.json({ success: true, message: 'Contrat signé avec succès', request: requests[idx] });
    } catch(e) {
        console.error('[PARTNER-REQUEST] Erreur sign-contract:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/client/set-availability — client renseigne ses disponibilités après paiement
app.post('/api/client/set-availability', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorisé' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);

        var preferredStart = req.body.preferred_start;
        var days = req.body.days || [];
        var timeSlot = req.body.time_slot || '';
        var notes = req.body.notes || '';

        if (!preferredStart) return res.status(400).json({ error: 'preferred_start requis' });

        var availability = {
            preferred_start: preferredStart,
            days: days,
            time_slot: timeSlot,
            notes: notes,
            submitted_at: new Date().toISOString()
        };

        // Mettre à jour tous les dispatches ouverts de ce client
        var orders = loadOrders();
        var userOrders = orders.filter(function(o) {
            var email = (o.client_info && o.client_info.email) || o.email || o.user_email || '';
            return email === decoded.email;
        });

        var dispatches = loadDispatches();
        var updated = false;
        userOrders.forEach(function(order) {
            dispatches.forEach(function(d) {
                if (d.order_id === order.id && d.status === 'open') {
                    d.client_availability = availability;
                    updated = true;
                }
            });
            var oIdx = orders.findIndex(function(o) { return o.id === order.id; });
            if (oIdx !== -1) orders[oIdx].client_availability = availability;
        });

        if (updated) {
            saveDispatches(dispatches);
            saveOrders(orders);
        }

        res.json({ success: true, updated: updated });
    } catch(e) {
        console.error('[AVAIL] Erreur:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/partner/profile/set-paypal — partenaire enregistre son email PayPal pour recevoir les versements
app.post('/api/partner/profile/set-paypal', authenticatePartner, function(req, res) {
    try {
        var paypalEmail = (req.body.paypal_email || '').trim();
        if (!paypalEmail || !paypalEmail.includes('@')) return res.status(400).json({ error: 'Email PayPal invalide' });
        var partners = loadPartners();
        var idx = partners.findIndex(function(p) { return p.id === req.partner.id; });
        if (idx === -1) return res.status(404).json({ error: 'Partenaire introuvable' });
        partners[idx].payout_paypal_email = paypalEmail;
        partners[idx].updatedAt = new Date().toISOString();
        savePartners(partners);
        res.json({ success: true, paypal_email: paypalEmail });
    } catch(e) {
        console.error('[PAYPAL-SET] Erreur:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/partner/profile/set-rib — partenaire enregistre son IBAN/BIC pour virement bancaire
app.post('/api/partner/profile/set-rib', authenticatePartner, function(req, res) {
    try {
        var iban     = (req.body.iban || '').replace(/\s/g, '').toUpperCase();
        var bic      = (req.body.bic  || '').replace(/\s/g, '').toUpperCase();
        var titulaire = (req.body.titulaire || '').trim();
        if (!iban || iban.length < 14) return res.status(400).json({ error: 'IBAN invalide' });
        if (!bic  || bic.length < 8)   return res.status(400).json({ error: 'BIC invalide' });
        if (!titulaire)                 return res.status(400).json({ error: 'Titulaire requis' });
        var partners = loadPartners();
        var idx = partners.findIndex(function(p) { return p.id === req.partner.id; });
        if (idx === -1) return res.status(404).json({ error: 'Partenaire introuvable' });
        partners[idx].payout_iban      = iban;
        partners[idx].payout_bic       = bic;
        partners[idx].payout_titulaire = titulaire;
        partners[idx].updatedAt = new Date().toISOString();
        savePartners(partners);
        // Masquer l'IBAN dans la réponse (ne renvoyer que les 4 derniers chiffres)
        var ibanMasked = '••••' + iban.slice(-4);
        res.json({ success: true, iban_masked: ibanMasked, bic: bic, titulaire: titulaire });
    } catch(e) {
        console.error('[RIB-SET] Erreur:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Taux de commission FA GENESIS sur les prestations partenaires (cf. PARTNER_TARIF_IDS / calculateRevenueShares)
var PARTNER_CONTRACT_VERSION = contractService.CONTRACT_VERSION;
// Taux standard lu dynamiquement depuis GENESIS_TIER_BENEFITS (bronze = taux de base)
var PARTNER_COMMISSION_RATE = (GENESIS_TIER_BENEFITS['bronze'] || GENESIS_TIER_BENEFITS['null'] || { commissionPct: 25 }).commissionPct;

// POST /api/partner/contract/sign — signature électronique du contrat de partenariat (version enrichie)
app.post('/api/partner/contract/sign', authenticatePartner, function(req, res) {
    try {
        var signatureName = (req.body.signatureName || '').trim();
        var accepted = req.body.accepted === true;
        var signatureData = req.body.signatureData || null; // base64 canvas
        if (!accepted) return res.status(400).json({ error: 'Vous devez accepter les conditions pour continuer.' });
        if (!signatureName || signatureName.length < 2) return res.status(400).json({ error: 'Merci de saisir votre nom complet pour signer.' });

        var partners = loadPartners();
        var idx = partners.findIndex(function(p) { return p.id === req.partner.id; });
        if (idx === -1) return res.status(404).json({ error: 'Partenaire introuvable' });
        var partner = partners[idx];
        var signIp = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        var now = new Date().toISOString();

        // Construire le barème de badges pour archivage snapshot
        var badgeTableSnapshot = Object.keys(GENESIS_TIER_BENEFITS)
            .filter(function(k) { return k !== 'null'; })
            .map(function(k) {
                var b = GENESIS_TIER_BENEFITS[k];
                return { badge: k.charAt(0).toUpperCase() + k.slice(1), commissionPct: b.commissionPct };
            });

        // Créer l'enregistrement dans contracts.json
        var contracts = contractService.loadContracts();
        var existing = contracts.find(function(c) { return c.type === 'partnership' && c.partner_id === partner.id && c.status === 'signed'; });
        var contractId = existing ? existing.id : ('CTR-PRTN-' + uuidv4().split('-')[0].toUpperCase());
        var contractRecord = {
            id: contractId,
            type: 'partnership',
            status: 'signed',
            partner_id: partner.id,
            partner_email: partner.email,
            partner_name: ((partner.prenom || '') + ' ' + (partner.nom || '')).trim(),
            partner_type: partner.partner_type || null,
            partner_company: partner.company || null,
            partner_country: partner.country || 'France',
            signed_at: now,
            signed_ip: signIp,
            signature_name: signatureName,
            signature_data: signatureData,
            badge_table: badgeTableSnapshot,
            commission_rate: PARTNER_COMMISSION_RATE,
            contract_version: PARTNER_CONTRACT_VERSION,
            events: [{ type: 'signed', at: now, ip: signIp, detail: 'Signature partenaire' }],
            created_at: now,
            updated_at: now
        };
        if (existing) {
            contracts[contracts.indexOf(existing)] = contractRecord;
        } else {
            contracts.push(contractRecord);
        }
        contractService.saveContracts(contracts);

        // Mettre à jour le partenaire
        partners[idx].contract_signed = true;
        partners[idx].contract_signed_at = now;
        partners[idx].contract_signature_name = signatureName;
        partners[idx].contract_version = PARTNER_CONTRACT_VERSION;
        partners[idx].contract_commission_rate = PARTNER_COMMISSION_RATE;
        partners[idx].contract_signature_ip = signIp;
        partners[idx].contract_id = contractId;
        partners[idx].updatedAt = now;
        savePartners(partners);

        // Notifier le partenaire : contrat disponible dans Livrables
        notifyUser(partner.email, 'partner', 'contract_partnership_signed',
            'Contrat de partenariat signé ✅',
            'Votre contrat de partenariat FA GENESIS est disponible dans la section Livrables de votre espace.',
            '/app.html');

        console.log('[CONTRACT] Signature electronique partenariat:', partner.email, '(' + contractId + ')');
        res.json({ success: true, contract_signed: true, contract_signed_at: now, contract_version: PARTNER_CONTRACT_VERSION, contract_id: contractId });
    } catch(e) {
        console.error('[CONTRACT] Erreur signature:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/partner/payouts — historique des versements du partenaire connecté
app.get('/api/partner/payouts', authenticatePartner, function(req, res) {
    try {
        var payouts = loadPayouts();
        var dispatches = loadDispatches();
        var mine = payouts
            .filter(function(p) { return p.partner_id === req.partner.id; })
            .sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); })
            .map(function(p) {
                var dispatch = p.dispatch_id ? dispatches.find(function(d) { return d.id === p.dispatch_id; }) : null;
                return Object.assign({}, p, { offer_name: dispatch ? dispatch.offer_name : null });
            });
        var partners = loadPartners();
        var me = partners.find(function(p) { return p.id === req.partner.id; });
        var ibanMasked = me && me.payout_iban ? '••••' + me.payout_iban.slice(-4) : null;
        res.json({
            payouts: mine,
            paypal_email: (me && me.payout_paypal_email) || null,
            rib: me && me.payout_iban ? { iban_masked: ibanMasked, bic: me.payout_bic || '', titulaire: me.payout_titulaire || '' } : null
        });
    } catch(e) {
        console.error('[PAYOUTS] Erreur:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Reputation du partenaire connecte : badge, note, missions, classement, revenus, commissions, clients
app.get('/api/partner/reputation', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var partners = loadPartners();
        var summary = getPartnerRatingSummary(partner.id);
        var missionsCompleted = getPartnerMissionsCompleted(partner.id);
        var badge = getPartnerBadge(partner, summary, missionsCompleted);

        var myPayouts = loadPayouts().filter(function(p) { return p.partner_id === partner.id; });
        var revenusGeneres = myPayouts.reduce(function(sum, p) { return sum + (parseFloat(p.amount) || 0); }, 0);
        var commissionsVersees = myPayouts.reduce(function(sum, p) { return sum + (parseFloat(p.fa_amount) || 0); }, 0);

        var orderIds = myPayouts.map(function(p) { return p.order_id; }).filter(Boolean);
        var uniqueOrderIds = orderIds.filter(function(id, idx) { return orderIds.indexOf(id) === idx; });
        var orders = loadOrders();
        var clientEmails = uniqueOrderIds.map(function(id) {
            var order = orders.find(function(o) { return o.id === id; });
            return order && order.client_info ? (order.client_info.email || '').toLowerCase() : '';
        }).filter(Boolean);
        var nombreClients = clientEmails.filter(function(email, idx) { return clientEmails.indexOf(email) === idx; }).length;

        var categoryPartners = partners.filter(function(p) { return p.partner_type === partner.partner_type && p.accountStatus === 'active'; });
        var classement = getPartnerCategoryRank(partner, categoryPartners);
        var referralCount = getPartnerReferralCount(partner.id);

        var pendingQGGains = Array.isArray(partner.pendingQGGains) ? partner.pendingQGGains.slice() : [];
        if (pendingQGGains.length > 0) {
            var repAllPtnrs = loadPartners();
            var repPIdx = repAllPtnrs.findIndex(function(p) { return p.id === partner.id; });
            if (repPIdx !== -1) { repAllPtnrs[repPIdx].pendingQGGains = []; savePartners(repAllPtnrs); }
        }

        res.json({
            success: true,
            rating: summary,
            badge: badge,
            badgeProgress: getPartnerBadgeProgress(partner, summary, missionsCompleted),
            genesisPoints: getPartnerGenesisPoints(partner, missionsCompleted),
            genesisLevel: getGenesisLevel(badge),
            constellation: getConstellationTier(partner),
            founderBadge: partner.founderBadge === true,
            pendingQGGains: pendingQGGains,
            currentBenefits: getBenefitsForBadge(badge),
            missionsCompleted: missionsCompleted,
            revenusGeneres: Math.round(revenusGeneres * 100) / 100,
            commissionsVersees: Math.round(commissionsVersees * 100) / 100,
            nombreClients: nombreClients,
            classement: classement,
            avgResponseMinutes: typeof partner.avgResponseMinutes === 'number' ? Math.round(partner.avgResponseMinutes) : null,
            referralCode: partner.id,
            referralCount: referralCount,
            referralStatus: getPartnerReferralStatus(referralCount),
            referredActiveCount: partner.referred_active_count || 0,
            distinctions: _serializeDistinctions(getPartnerActiveDistinctions(partner, badge)),
            profile_boost_active: !!(partner.profile_boost_until && new Date(partner.profile_boost_until) > new Date()),
            profile_boost_until: partner.profile_boost_until || null,
            cerclesGenesis: getPartnerCercleClientsList(partner.id, 5),
            opportunites: findSharedClientPartners(partner.id, 5),
            patrimoineGenesis: {
                missionsRealisees: missionsCompleted,
                clientsDistincts: nombreClients,
                parrainages: referralCount,
                ancienneteJours: partner.createdAt ? Math.floor((Date.now() - new Date(partner.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0
            }
        });
    } catch (e) {
        console.error('[REPUTATION] Erreur:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ── PALMARÈS ──
app.get('/api/partner/palmares', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var summary = getPartnerRatingSummary(partner.id);
        var missionsCompleted = getPartnerMissionsCompleted(partner.id);

        var myPayouts = loadPayouts().filter(function(p) { return p.partner_id === partner.id && p.status === 'sent'; });
        var revenusGeneres = myPayouts.reduce(function(sum, p) { return sum + (parseFloat(p.amount) || 0); }, 0);
        var commissionsVersees = myPayouts.reduce(function(sum, p) { return sum + (parseFloat(p.fa_amount) || 0); }, 0);

        var orders = loadOrders();
        var orderIds = myPayouts.map(function(p) { return p.order_id; }).filter(Boolean);
        var uniqueOrderIds = orderIds.filter(function(id, idx) { return orderIds.indexOf(id) === idx; });
        var clientEmails = uniqueOrderIds.map(function(id) {
            var o = orders.find(function(o) { return o.id === id; });
            return o && o.client_info ? (o.client_info.email || '').toLowerCase() : '';
        }).filter(Boolean);
        var nombreClients = clientEmails.filter(function(e, idx) { return clientEmails.indexOf(e) === idx; }).length;

        var missionsList = myPayouts.slice(-30).reverse().map(function(p) {
            var o = orders.find(function(o) { return o.id === p.order_id; });
            return {
                id: p.id,
                order_id: p.order_id,
                service_label: o ? (o.product_name || o.service_label || 'Prestation') : 'Prestation',
                client_name: o && o.client_info ? (o.client_info.first_name || 'Client') : 'Client',
                amount: parseFloat(p.amount) || 0,
                sent_at: p.sent_at || p.created_at || ''
            };
        });

        var reviewsList = loadPartnerReviews()
            .filter(function(r) { return r.partnerId === partner.id && r.status === 'published'; })
            .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

        var allPartners = loadPartners();
        var referralsList = allPartners
            .filter(function(p) { return p.referredBy === partner.id; })
            .map(function(p) { return { prenom: p.prenom, nom: p.nom, partner_type: p.partner_type, createdAt: p.createdAt }; });
        var referralCount = referralsList.length;

        var categoryPartners = allPartners.filter(function(p) { return p.partner_type === partner.partner_type && p.accountStatus === 'active'; });
        var classement = getPartnerCategoryRank(partner, categoryPartners);

        res.json({
            ok: true,
            missionsCompleted: missionsCompleted,
            nombreClients: nombreClients,
            revenusGeneres: Math.round(revenusGeneres * 100) / 100,
            commissionsVersees: Math.round(commissionsVersees * 100) / 100,
            classement: classement,
            missions: missionsList,
            reviews: reviewsList,
            referralCode: partner.id,
            referralCount: referralCount,
            referralStatus: getPartnerReferralStatus(referralCount),
            referredActiveCount: partner.referred_active_count || 0,
            referrals: referralsList
        });
    } catch (e) {
        console.error('[PALMARES] Erreur:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Detail d'un projet assigne
app.get('/api/partner/projects/:orderId', authenticatePartner, (req, res) => {
    try {
        const orderId = req.params.orderId;
        const assignments = loadPartnerAssignments();
        const assignment = assignments.find(
            a => a.partner_id === req.partner.id && a.order_id === orderId && a.status === 'active'
        );
        if (!assignment) {
            return res.status(403).json({ error: 'Acces non autorise a ce projet' });
        }
        const order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Projet non trouve' });
        }
        const partnerType = req.partner.partner_type;
        const allUploads = loadPartnerUploads().filter(
            u => u.order_id === orderId && u.partner_id === req.partner.id
        );
        const comments = loadPartnerComments().filter(
            c => c.order_id === orderId && (c.author_id === req.partner.id || c.author_type === 'admin')
        );
        let livrables = [];
        const LIVRABLES_FILE = path.join(__dirname, 'data', 'livrables.json');
        try {
            if (fs.existsSync(LIVRABLES_FILE)) {
                const allLivrables = JSON.parse(fs.readFileSync(LIVRABLES_FILE, 'utf8'));
                if (partnerType === 'marketer') {
                    livrables = allLivrables.filter(l => l.order_id === orderId && l.type === 'document');
                } else if (partnerType === 'media') {
                    livrables = allLivrables.filter(l => l.order_id === orderId && (l.status === 'ready' || l.status === 'delivered'));
                } else {
                    livrables = allLivrables.filter(l => l.order_id === orderId && (l.type === 'photo' || l.type === 'video'));
                }
            }
        } catch (e) {
            console.error('[PARTNER] Erreur lecture livrables:', e);
        }
        res.json({
            order: {
                id: order.id,
                product_name: order.product_name,
                product_type: order.product_type,
                status: order.status,
                created_at: order.created_at,
                client_name: order.client_info
                    ? (order.client_info.first_name + ' ' + (order.client_info.last_name || '').charAt(0) + '.')
                    : 'Client'
            },
            assignment: assignment,
            uploads: allUploads,
            comments: comments,
            livrables: livrables
        });
    } catch (error) {
        console.error('[PARTNER] Erreur project detail:', error);
        res.status(500).json({ error: 'Erreur chargement projet' });
    }
});

// Partenaire se désaffecte d'un projet
app.post('/api/partner/projects/:orderId/leave', authenticatePartner, function(req, res) {
    try {
        var orderId = req.params.orderId;
        var partner = req.partner;
        var assignments = loadPartnerAssignments();
        var idx = assignments.findIndex(function(a) {
            return a.order_id === orderId && a.partner_id === partner.id && a.status === 'active';
        });
        if (idx === -1) {
            return res.status(404).json({ error: 'Assignation introuvable ou déjà annulée' });
        }
        assignments[idx].status = 'cancelled';
        assignments[idx].cancelled_at = new Date().toISOString();
        assignments[idx].cancelled_by = 'partner';
        savePartnerAssignments(assignments);

        // Notifier l'admin
        if (typeof emailService.sendAdminNotification === 'function') {
            emailService.sendAdminNotification({
                name: partner.prenom || partner.name || partner.email,
                email: partner.email,
                subject: 'Désaffectation projet',
                message: 'Le partenaire ' + (partner.prenom || '') + ' ' + (partner.nom || partner.email) + ' s\'est désaffecté du projet ' + orderId + '.'
            }).catch(function(e) {});
        }

        console.log('[PARTNER] ' + partner.email + ' s\'est desaffecte du projet ' + orderId);
        res.json({ success: true });
    } catch (error) {
        console.error('[PARTNER] Erreur leave project:', error);
        res.status(500).json({ error: 'Erreur lors de la désaffectation' });
    }
});

/**
 * POST /api/partner/orders/:orderId/unlock-balance
 * Le partenaire déclare la fin de l'accompagnement → débloque le paiement du solde
 */
app.post('/api/partner/orders/:orderId/unlock-balance', authenticatePartner, function(req, res) {
    try {
        var orderId = req.params.orderId;
        var partner = req.partner;

        // Vérifier que le partenaire est assigné à cette commande
        var assignments = loadPartnerAssignments();
        var assignment = assignments.find(function(a) {
            return a.order_id === orderId && a.partner_id === partner.id && a.status === 'active';
        });
        if (!assignment) {
            return res.status(403).json({ error: 'Vous n\'êtes pas assigné à cette commande' });
        }

        var order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvée' });
        }
        if (!order.deposit_paid) {
            return res.status(400).json({ error: 'L\'acompte n\'a pas encore été payé' });
        }
        if (order.balance_paid) {
            return res.status(400).json({ error: 'Le solde a déjà été payé' });
        }
        if (order.balance_payment_ready) {
            return res.status(400).json({ error: 'La fin d\'accompagnement a déjà été déclarée' });
        }

        var partnerName = ((partner.prenom || '') + ' ' + (partner.nom || partner.name || '')).trim() || partner.email;

        var updates = {
            balance_payment_ready: true,
            balance_unlocked_at: new Date().toISOString(),
            balance_unlocked_by: 'partner:' + partnerName,
            status: 'pending_balance'
        };
        var updatedOrder = updateOrder(orderId, updates);

        var clientEmail = updatedOrder && updatedOrder.client_info && updatedOrder.client_info.email;
        var clientName = updatedOrder && updatedOrder.client_info
            ? ((updatedOrder.client_info.prenom || '') + ' ' + (updatedOrder.client_info.nom || '')).trim()
            : '';

        // Synchroniser paymentStatus dans users.json
        try {
            if (clientEmail) {
                var allUsers = loadUsers();
                var uIdx = allUsers.findIndex(function(u) {
                    return u.email && u.email.toLowerCase() === clientEmail.toLowerCase();
                });
                if (uIdx !== -1) {
                    allUsers[uIdx].paymentStatus = 'delivery_pending_payment';
                    allUsers[uIdx].payment_status = 'delivery_pending_payment';
                    saveUsers(allUsers);
                    console.log('[PARTNER] Solde débloqué par ' + partnerName + ': ' + clientEmail + ' → delivery_pending_payment');
                }
            }
        } catch (syncErr) {
            console.error('[PARTNER] Erreur sync users apres unlock-balance:', syncErr.message);
        }

        // Envoyer email de notification au client
        if (clientEmail && clientName) {
            emailService.sendAccompanimentEndNotification(
                clientEmail,
                clientName,
                partnerName,
                updatedOrder.product_name || '',
                updatedOrder.balance_amount || 0
            ).catch(function(e) {
                console.error('[PARTNER] Erreur email fin accompagnement:', e.message);
            });
        }

        // Notifier aussi l'admin
        emailService.sendAdminNotification({
            name: partnerName,
            email: partner.email,
            subject: 'Fin d\'accompagnement déclarée',
            message: 'Le partenaire ' + partnerName + ' a déclaré la fin de l\'accompagnement pour la commande '
                + orderId + ' (client : ' + (clientEmail || 'inconnu') + ').'
        }).catch(function(e) {});

        res.json({ success: true, order: updatedOrder });
    } catch (err) {
        console.error('[PARTNER] Erreur unlock-balance:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Upload livrable par partenaire
app.post('/api/partner/upload', authenticatePartner, (req, res) => {
    try {
        const { order_id, name, description, file_url, file_extension, file_size,
                publication_link, publication_date, diffusion_type } = req.body;
        if (!order_id || !name || !file_url || !file_extension) {
            return res.status(400).json({ error: 'Champs obligatoires manquants (order_id, name, file_url, file_extension)' });
        }
        const assignments = loadPartnerAssignments();
        const assignment = assignments.find(
            a => a.partner_id === req.partner.id && a.order_id === order_id && a.status === 'active'
        );
        if (!assignment) {
            return res.status(403).json({ error: 'Vous n\'etes pas assigne a ce projet' });
        }
        const allowed = ALLOWED_FILE_TYPES[req.partner.partner_type];
        if (!allowed || allowed.indexOf(file_extension.toLowerCase()) === -1) {
            return res.status(400).json({
                error: 'Type de fichier non autorise pour votre profil. Extensions acceptees: ' + (allowed || []).join(', ')
            });
        }
        if (req.partner.partner_type === 'media') {
            if (!publication_link || !publication_date || !diffusion_type) {
                return res.status(400).json({
                    error: 'Les champs publication_link, publication_date et diffusion_type sont obligatoires pour les partenaires media'
                });
            }
        }
        let fileType = 'document';
        const ext = file_extension.toLowerCase();
        if (['jpg', 'jpeg', 'png'].indexOf(ext) !== -1) fileType = 'photo';
        else if (['mp4', 'mov'].indexOf(ext) !== -1) fileType = 'video';
        const upload = {
            id: 'PUP-' + uuidv4().split('-')[0],
            partner_id: req.partner.id,
            partner_email: req.partner.email,
            partner_type: req.partner.partner_type,
            order_id: order_id,
            name: name,
            file_type: fileType,
            file_extension: ext,
            file_url: file_url,
            file_size: file_size || 0,
            description: description || '',
            validation_status: 'pending',
            validated_at: null,
            validated_by: null,
            rejection_reason: null,
            livrable_id: null,
            publication_link: publication_link || null,
            publication_date: publication_date || null,
            diffusion_type: diffusion_type || null,
            created_at: new Date().toISOString()
        };
        const uploads = loadPartnerUploads();
        uploads.push(upload);
        savePartnerUploads(uploads);
        console.log('[PARTNER] Upload:', req.partner.email, '->', order_id, ':', name);
        res.json({ success: true, upload: upload });
    } catch (error) {
        console.error('[PARTNER] Erreur upload:', error);
        res.status(500).json({ error: 'Erreur lors de l\'upload' });
    }
});

// Commentaires d'un projet
app.get('/api/partner/comments/:orderId', authenticatePartner, (req, res) => {
    try {
        const orderId = req.params.orderId;
        const assignments = loadPartnerAssignments();
        const assignment = assignments.find(
            a => a.partner_id === req.partner.id && a.order_id === orderId && a.status === 'active'
        );
        if (!assignment) {
            return res.status(403).json({ error: 'Acces non autorise' });
        }
        const comments = loadPartnerComments().filter(
            c => c.order_id === orderId && (c.author_id === req.partner.id || c.author_type === 'admin')
        );
        res.json(comments);
    } catch (error) {
        console.error('[PARTNER] Erreur comments:', error);
        res.status(500).json({ error: 'Erreur chargement commentaires' });
    }
});

// Poster un commentaire
app.post('/api/partner/comments', authenticatePartner, (req, res) => {
    try {
        const { order_id, content } = req.body;
        if (!order_id || !content || !content.trim()) {
            return res.status(400).json({ error: 'order_id et content requis' });
        }
        const assignments = loadPartnerAssignments();
        const assignment = assignments.find(
            a => a.partner_id === req.partner.id && a.order_id === order_id && a.status === 'active'
        );
        if (!assignment) {
            return res.status(403).json({ error: 'Acces non autorise a ce projet' });
        }
        const comment = {
            id: 'CMT-' + uuidv4().split('-')[0],
            order_id: order_id,
            author_type: 'partner',
            author_id: req.partner.id,
            author_name: req.partner.prenom + ' ' + req.partner.nom,
            author_email: req.partner.email,
            content: content.trim(),
            created_at: new Date().toISOString()
        };
        const comments = loadPartnerComments();
        comments.push(comment);
        savePartnerComments(comments);
        console.log('[PARTNER] Commentaire:', req.partner.email, '->', order_id);
        res.json({ success: true, comment: comment });
    } catch (error) {
        console.error('[PARTNER] Erreur post comment:', error);
        res.status(500).json({ error: 'Erreur envoi commentaire' });
    }
});

// ============================================================
// ENDPOINTS ADMIN - GESTION DES PARTENAIRES
// ============================================================

// Creer un partenaire
app.post('/api/admin/partners/create', async (req, res) => {
    try {
        const { prenom, nom, email, telephone, password, partner_type, partner_type_other, company } = req.body;
        if (!prenom || !nom || !email || !password || !partner_type) {
            return res.status(400).json({ error: 'Champs obligatoires: prenom, nom, email, password, partner_type' });
        }
        if (PARTNER_TYPE_VALUES.indexOf(partner_type) === -1) {
            return res.status(400).json({ error: 'partner_type invalide. Valeurs acceptees: ' + PARTNER_TYPE_VALUES.join(', ') });
        }
        if (partner_type === 'other' && (!partner_type_other || !partner_type_other.trim() || partner_type_other.trim().length < 2)) {
            return res.status(400).json({ error: 'Merci de preciser le profil pour la categorie "Autre"' });
        }
        const existing = getPartnerByEmail(email);
        if (existing) {
            return res.status(409).json({ error: 'Un partenaire avec cet email existe deja' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caracteres' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date().toISOString();
        const partner = {
            id: 'PTR-' + uuidv4().split('-')[0],
            prenom: prenom,
            nom: nom,
            email: email.toLowerCase(),
            telephone: telephone || '',
            password: hashedPassword,
            partner_type: partner_type,
            partner_type_other: partner_type === 'other' ? partner_type_other.trim() : '',
            company: company || '',
            sessionToken: null,
            accountStatus: 'active',
            createdAt: now,
            updatedAt: now,
            lastLogin: null,
            createdBy: 'admin@fagenesis.com'
        };
        const partners = loadPartners();
        partners.push(partner);
        savePartners(partners);
        const { password: _, ...partnerSafe } = partner;
        console.log('[ADMIN] Partenaire cree:', email, '(' + partner_type + ')');
        res.json({ success: true, partner: partnerSafe });
    } catch (error) {
        console.error('[ADMIN] Erreur creation partenaire:', error);
        res.status(500).json({ error: 'Erreur lors de la creation du partenaire' });
    }
});

// Creer les comptes de test partenaires complets (parrain + filleul) — apercu complet de l'espace prestataire
app.post('/api/admin/setup-test-parrainage', async function(req, res) {
    try {

        var TEST_EMAILS = ['test-parrain@fagenesis.com', 'test-filleul@fagenesis.com'];
        var nowStr = new Date().toISOString();
        var daysAgo = function(n) { return new Date(Date.now() - n * 24 * 3600 * 1000).toISOString(); };
        var daysFromNow = function(n) { return new Date(Date.now() + n * 24 * 3600 * 1000).toISOString(); };
        var uid = function(prefix) { return prefix + require('crypto').randomBytes(4).toString('hex').toUpperCase(); };

        // ── IDs stables pour les relations cross-fichiers ──
        var parrainId = 'PTR-TEST-PAR-A1B2';
        var filleulId = 'PTR-TEST-FIL-C3D4';

        var hashP = await bcrypt.hash('TestParrain2026!', 10);
        var hashF = await bcrypt.hash('TestFilleul2026!', 10);

        // ── 1. Partners ──
        var partners = loadPartners().filter(function(p) { return TEST_EMAILS.indexOf(p.email) === -1; });
        partners.push({
            id: parrainId, prenom: 'Alexandre', nom: 'Martin',
            email: 'test-parrain@fagenesis.com', telephone: '+33 6 12 34 56 78', city: 'Paris',
            password: hashP, partner_type: 'photographer', partner_type_other: '', company: 'AM Visuel',
            bio: 'Photographe professionnel spécialisé en portraits corporate, événements d\'entreprise et shooting produit. 8 ans d\'expérience, matériel haut de gamme.',
            services: [
                { id: 'SVC-PAR-01', label: 'Shooting portrait corporate', price: 290, description: 'Séance photo professionnelle en studio ou extérieur. Retouches incluses. Livraison sous 5 jours.', active: true },
                { id: 'SVC-PAR-02', label: 'Reportage événementiel', price: 480, description: 'Couverture complète de vos événements d\'entreprise, conférences, soirées. Galerie en ligne incluse.', active: true },
                { id: 'SVC-PAR-03', label: 'Shooting produit / e-commerce', price: 190, description: 'Photos produits sur fond blanc ou ambiance. Idéal pour sites e-commerce et fiches produits.', active: true }
            ],
            payout_iban: 'FR76 3000 4000 0300 0000 0000 456', payout_bic: 'BNPAFRPPXXX', payout_titulaire: 'Alexandre Martin',
            payout_paypal: null,
            sessionToken: null, accountStatus: 'active', contract_signed: true, contract_signed_at: daysAgo(60),
            referredBy: null, founderBadge: false,
            distinctions: [{ id: 'ambassador', granted_at: daysAgo(15), expires_at: null }],
            referred_active_count: 1, profile_boost_until: daysFromNow(7),
            first_mission_completed_at: daysAgo(45),
            createdAt: daysAgo(90), updatedAt: daysAgo(2), lastLogin: daysAgo(1)
        });
        partners.push({
            id: filleulId, prenom: 'Camille', nom: 'Dubois',
            email: 'test-filleul@fagenesis.com', telephone: '+33 6 98 76 54 32', city: 'Lyon',
            password: hashF, partner_type: 'videographer', partner_type_other: '', company: '',
            bio: 'Vidéaste et motion designer freelance. Je crée des contenus vidéo percutants pour les marques : teasers, interviews, reels réseaux sociaux et vidéos institutionnelles.',
            services: [
                { id: 'SVC-FIL-01', label: 'Vidéo courte (Reels / TikTok)', price: 250, description: 'Création de vidéos courtes percutantes pour vos réseaux sociaux. Montage + sous-titres + musique inclus.', active: true },
                { id: 'SVC-FIL-02', label: 'Vidéo institutionnelle', price: 750, description: 'Présentation de votre entreprise, de vos valeurs et de votre équipe. Format 2-3 min, habillage graphique inclus.', active: true }
            ],
            payout_iban: 'FR76 1027 8060 0001 7816 1016 086', payout_bic: 'CMCIFR2A', payout_titulaire: 'Camille Dubois',
            payout_paypal: null,
            sessionToken: null, accountStatus: 'active', contract_signed: true, contract_signed_at: daysAgo(30),
            referredBy: parrainId, founderBadge: false,
            distinctions: [{ id: 'new_talent', granted_at: daysAgo(10), expires_at: null }],
            first_mission_completed_at: daysAgo(8), profile_boost_until: daysFromNow(4),
            referred_active_count: 0,
            createdAt: daysAgo(35), updatedAt: daysAgo(1), lastLogin: daysAgo(0)
        });
        savePartners(partners);

        // ── 2. Payouts (missions realisees = stage 'balance') pour le calcul des badges ──
        var payouts = loadPayouts().filter(function(p) {
            return p.partner_id !== parrainId && p.partner_id !== filleulId;
        });
        // Parrain : 6 missions realisees → badge Bronze (seuil 5)
        for (var i = 0; i < 6; i++) {
            payouts.push({
                id: uid('PAY-TST-PAR-'),
                partner_id: parrainId, partner_email: 'test-parrain@fagenesis.com',
                order_id: uid('ORD-DEMO-'), stage: 'balance',
                amount: [290, 480, 190, 380, 240, 320][i] * 0.75,
                currency: 'EUR', status: 'sent', payout_method: 'bank_transfer',
                created_at: daysAgo(80 - i * 10), sent_at: daysAgo(79 - i * 10)
            });
        }
        // Filleul : 1 mission realisee → premiere mission accomplie
        payouts.push({
            id: uid('PAY-TST-FIL-'),
            partner_id: filleulId, partner_email: 'test-filleul@fagenesis.com',
            order_id: uid('ORD-DEMO-'), stage: 'balance',
            amount: 250 * 0.75, currency: 'EUR', status: 'sent', payout_method: 'bank_transfer',
            created_at: daysAgo(8), sent_at: daysAgo(7)
        });
        savePayouts(payouts);

        // ── 3. Avis clients (pour la note moyenne) ──
        var reviews = loadPartnerReviews().filter(function(r) {
            return r.partnerId !== parrainId && r.partnerId !== filleulId;
        });
        var parrainRatings = [5, 4, 5, 5, 4, 5];
        var parrainComments = [
            'Excellent professionnel, photos magnifiques et livraison rapide. Je recommande !',
            'Très bon shooting, Alexandre est à l\'écoute et les retouches sont soignées.',
            'Reportage parfait pour notre séminaire, il a su capter l\'essentiel.',
            'Qualité remarquable, ponctuel et très agréable. Travail au top.',
            'Photos de produits superbes, exactement ce que je voulais.',
            'Collaboration parfaite du début à la fin. On refait appel à lui sans hésiter !'
        ];
        parrainRatings.forEach(function(rating, i) {
            reviews.push({
                id: uid('REV-PAR-'), partnerId: parrainId,
                orderId: uid('ORD-DEMO-'), clientEmail: 'client-demo-' + (i+1) + '@example.com',
                rating: rating, comment: parrainComments[i],
                status: 'published', createdAt: daysAgo(75 - i * 8)
            });
        });
        // Filleul : 1 avis
        reviews.push({
            id: uid('REV-FIL-'), partnerId: filleulId,
            orderId: uid('ORD-DEMO-'), clientEmail: 'client-demo-7@example.com',
            rating: 5, comment: 'Super vidéo, Camille a été très créative et réactive. Résultat bluffant !',
            status: 'published', createdAt: daysAgo(7)
        });
        savePartnerReviews(reviews);

        console.log('[ADMIN] Comptes test partenaires complets créés:', parrainId, filleulId);
        res.json({
            success: true,
            parrain: { id: parrainId, email: 'test-parrain@fagenesis.com', badge: 'bronze', missions: 6, rating: 4.8, distinctions: ['ambassador'] },
            filleul: { id: filleulId, email: 'test-filleul@fagenesis.com', badge: null, missions: 1, rating: 5, distinctions: ['new_talent'], referredBy: parrainId }
        });
    } catch (e) {
        console.error('[ADMIN] Erreur setup-test-parrainage:', e);
        res.status(500).json({ error: e.message });
    }
});

// Lister tous les partenaires
app.get('/api/admin/partners', (req, res) => {
    try {
        const partners = loadPartners().map(p => {
            const { password, ...safe } = p;
            // Normalise la date d'inscription : certains enregistrements utilisent createdAt,
            // d'autres created_at selon la route d'inscription. On expose les deux pour le front.
            if (!safe.created_at && safe.createdAt) safe.created_at = safe.createdAt;
            if (!safe.createdAt && safe.created_at) safe.createdAt = safe.created_at;
            return safe;
        });
        const assignments = loadPartnerAssignments();
        const result = partners.map(p => {
            const assignedCount = assignments.filter(a => a.partner_id === p.id && a.status === 'active').length;
            return { ...p, assigned_projects: assignedCount };
        });
        res.json(result);
    } catch (error) {
        console.error('[ADMIN] Erreur liste partenaires:', error);
        res.status(500).json({ error: 'Erreur chargement partenaires' });
    }
});

// Detail d'un partenaire
app.get('/api/admin/partners/:partnerId', (req, res) => {
    try {
        const partner = getPartnerById(req.params.partnerId);
        if (!partner) {
            return res.status(404).json({ error: 'Partenaire non trouve' });
        }
        const { password, ...partnerSafe } = partner;
        const assignments = loadPartnerAssignments().filter(a => a.partner_id === partner.id);
        res.json({ partner: partnerSafe, assignments: assignments });
    } catch (error) {
        console.error('[ADMIN] Erreur detail partenaire:', error);
        res.status(500).json({ error: 'Erreur chargement partenaire' });
    }
});

// Modifier un partenaire
app.put('/api/admin/partners/:partnerId', (req, res) => {
    try {
        const partners = loadPartners();
        const index = partners.findIndex(p => p.id === req.params.partnerId);
        if (index === -1) {
            return res.status(404).json({ error: 'Partenaire non trouve' });
        }
        const { prenom, nom, telephone, partner_type, company, accountStatus } = req.body;
        const wasActive = partners[index].accountStatus === 'active';
        if (prenom) partners[index].prenom = prenom;
        if (nom) partners[index].nom = nom;
        if (telephone !== undefined) partners[index].telephone = telephone;
        if (partner_type) {
            if (PARTNER_TYPE_VALUES.indexOf(partner_type) !== -1) {
                partners[index].partner_type = partner_type;
            }
        }
        if (company !== undefined) partners[index].company = company;
        if (accountStatus) partners[index].accountStatus = accountStatus;
        partners[index].updatedAt = new Date().toISOString();
        savePartners(partners);
        const { password, ...partnerSafe } = partners[index];
        // Approbation (pending/deactivated -> active) : prevenir le partenaire qu'il peut
        // desormais configurer ses prestations et qu'il devient visible des clients.
        if (accountStatus === 'active' && !wasActive) {
            emailService.sendPartnerAccountApprovedEmail(partnerSafe).catch(function(e) {
                console.error('[ADMIN] Erreur envoi email approbation partenaire:', e);
            });
            notifyUser(partnerSafe.email, 'partner', 'compte-approuve', 'Votre compte est approuvé !', 'Vous pouvez desormais configurer vos prestations, elles seront visibles par les clients.', '/app.html#open-partner');
            // Alertes intelligentes : notifier les clients Bâtisseur+ dont les préférences correspondent
            setTimeout(function() { alertBatisseurPlusOnNewPartner(partnerSafe); }, 0);
        }
        res.json({ success: true, partner: partnerSafe });
    } catch (error) {
        console.error('[ADMIN] Erreur modif partenaire:', error);
        res.status(500).json({ error: 'Erreur modification partenaire' });
    }
});

// Toggle du badge Membre Fondateur (attribution manuelle admin)
app.put('/api/admin/partners/:partnerId/founder-badge', (req, res) => {
    try {
        const partners = loadPartners();
        const index = partners.findIndex(p => p.id === req.params.partnerId);
        if (index === -1) {
            return res.status(404).json({ error: 'Partenaire non trouve' });
        }
        partners[index].founderBadge = req.body.value === true;
        partners[index].updatedAt = new Date().toISOString();
        savePartners(partners);
        res.json({ success: true, founderBadge: partners[index].founderBadge });
    } catch (error) {
        console.error('[ADMIN] Erreur toggle founder badge:', error);
        res.status(500).json({ error: 'Erreur modification badge' });
    }
});

// Envoyer le lien Stripe onboarding à un partenaire (admin)
app.post('/api/admin/partners/:partnerId/stripe-onboarding-link', async (req, res) => {
    try {
        const partner = getPartnerById(req.params.partnerId);
        if (!partner) return res.status(404).json({ error: 'Partenaire non trouvé' });

        var baseUrl = process.env.FRONT_URL || 'https://fagenesis.com';
        var onboardingUrl;

        if (!partner.stripeAccountId) {
            // Créer le compte Stripe minimal + générer le lien
            var accountData = { email: partner.email, country: partner.stripeCountry || 'FR', entityType: partner.entityType || 'particulier', partnerId: partner.id };
            var account = await mps.setupPartnerStripeAccount(accountData);
            var partners = loadPartners();
            var idx = partners.findIndex(p => p.id === partner.id);
            if (idx !== -1) {
                partners[idx].stripeAccountId      = account.id;
                partners[idx].stripeAccountStatus  = 'pending';
                partners[idx].stripeChargesEnabled = false;
                partners[idx].stripePayoutsEnabled = false;
                partners[idx].stripeCountry        = accountData.country;
                partners[idx].updatedAt            = new Date().toISOString();
                savePartners(partners);
            }
            onboardingUrl = await mps.getPartnerOnboardingLink(account.id, baseUrl);
        } else {
            onboardingUrl = await mps.getPartnerOnboardingLink(partner.stripeAccountId, baseUrl);
        }

        // Envoyer le lien par email
        var transport = emailService.initializeTransporter();
        await transport.sendMail({
            from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: partner.email,
            subject: 'Configurez votre compte de paiement GENESIS',
            html: '<p>Bonjour ' + (partner.prenom || '') + ',</p>' +
                  '<p>Pour recevoir vos rémunérations sur la plateforme FA GENESIS, vous devez configurer votre compte de paiement Stripe.</p>' +
                  '<p style="margin:24px 0;"><a href="' + onboardingUrl + '" style="background:#ffd700;color:#000;padding:12px 24px;font-weight:900;text-decoration:none;border-radius:8px;display:inline-block;">Configurer mon compte Stripe</a></p>' +
                  '<p><small>Ce lien est valable 1 heure. Si vous rencontrez un problème, contactez contact@fagenesis.com</small></p>'
        });

        res.json({ ok: true });
    } catch (e) {
        console.error('[ADMIN] Erreur envoi lien Stripe:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Supprimer un partenaire
app.delete('/api/admin/partners/:partnerId', (req, res) => {
    try {
        const partners = loadPartners();
        const index = partners.findIndex(p => p.id === req.params.partnerId);
        if (index === -1) {
            return res.status(404).json({ error: 'Partenaire non trouve' });
        }
        const removed = partners.splice(index, 1)[0];
        savePartners(partners);
        const assignments = loadPartnerAssignments();
        let modified = false;
        assignments.forEach(a => {
            if (a.partner_id === req.params.partnerId && a.status === 'active') {
                a.status = 'removed';
                modified = true;
            }
        });
        if (modified) savePartnerAssignments(assignments);
        console.log('[ADMIN] Partenaire supprimé:', removed.email);
        res.json({ success: true, message: 'Partenaire supprimé' });
    } catch (error) {
        console.error('[ADMIN] Erreur suppression partenaire:', error);
        res.status(500).json({ error: 'Erreur suppression partenaire' });
    }
});

// Assigner un partenaire a un projet
app.post('/api/admin/partners/assign', (req, res) => {
    try {
        const { partner_id, order_id, notes } = req.body;
        if (!partner_id || !order_id) {
            return res.status(400).json({ error: 'partner_id et order_id requis' });
        }
        const partner = getPartnerById(partner_id);
        if (!partner) {
            return res.status(404).json({ error: 'Partenaire non trouve' });
        }
        const order = getOrderById(order_id);
        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvee' });
        }
        const assignments = loadPartnerAssignments();
        const existing = assignments.find(
            a => a.partner_id === partner_id && a.order_id === order_id && a.status === 'active'
        );
        if (existing) {
            return res.status(409).json({ error: 'Ce partenaire est deja assigne a ce projet' });
        }
        const assignment = {
            id: 'ASG-' + uuidv4().split('-')[0],
            partner_id: partner_id,
            partner_email: partner.email,
            partner_type: partner.partner_type,
            order_id: order_id,
            assigned_at: new Date().toISOString(),
            assigned_by: 'admin@fagenesis.com',
            status: 'active',
            notes: notes || ''
        };
        assignments.push(assignment);
        savePartnerAssignments(assignments);
        console.log('[ADMIN] Partenaire assigne:', partner.email, '->', order_id);
        res.json({ success: true, assignment: assignment });
    } catch (error) {
        console.error('[ADMIN] Erreur assignation:', error);
        res.status(500).json({ error: 'Erreur lors de l\'assignation' });
    }
});

// Retirer une assignation
app.delete('/api/admin/partners/assign/:assignmentId', (req, res) => {
    try {
        const assignments = loadPartnerAssignments();
        const index = assignments.findIndex(a => a.id === req.params.assignmentId);
        if (index === -1) {
            return res.status(404).json({ error: 'Assignation non trouvee' });
        }
        assignments[index].status = 'removed';
        savePartnerAssignments(assignments);
        res.json({ success: true, message: 'Assignation retiree' });
    } catch (error) {
        console.error('[ADMIN] Erreur retrait assignation:', error);
        res.status(500).json({ error: 'Erreur retrait assignation' });
    }
});

// Partenaires assignes a un projet
app.get('/api/admin/partners/assignments/:orderId', (req, res) => {
    try {
        const assignments = loadPartnerAssignments().filter(
            a => a.order_id === req.params.orderId && a.status === 'active'
        );
        const partners = loadPartners();
        const result = assignments.map(a => {
            const partner = partners.find(p => p.id === a.partner_id);
            return {
                assignment: a,
                partner: partner ? {
                    id: partner.id,
                    prenom: partner.prenom,
                    nom: partner.nom,
                    email: partner.email,
                    partner_type: partner.partner_type,
                    company: partner.company
                } : null
            };
        });
        res.json(result);
    } catch (error) {
        console.error('[ADMIN] Erreur assignments:', error);
        res.status(500).json({ error: 'Erreur chargement assignations' });
    }
});

// Uploads en attente (ou tous)
app.get('/api/admin/partner-uploads', (req, res) => {
    try {
        let uploads = loadPartnerUploads();
        if (req.query.status) {
            uploads = uploads.filter(u => u.validation_status === req.query.status);
        }
        res.json(uploads);
    } catch (error) {
        console.error('[ADMIN] Erreur partner-uploads:', error);
        res.status(500).json({ error: 'Erreur chargement uploads' });
    }
});

// ═══════════════════════════════════════════════════════════════════════
// SYSTÈME DE CONTRATS NUMÉRIQUES GENESIS
// ═══════════════════════════════════════════════════════════════════════

// Barème pour injection dans les contrats
function _contractBadgeTable() {
    return Object.keys(GENESIS_TIER_BENEFITS)
        .filter(function(k) { return k !== 'null'; })
        .map(function(k) {
            var b = GENESIS_TIER_BENEFITS[k];
            return { badge: k.charAt(0).toUpperCase() + k.slice(1), commissionPct: b.commissionPct };
        });
}

// GET /api/partner/contract/partnership — contenu HTML du contrat de partenariat (non signé)
app.get('/api/partner/contract/partnership', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var html = contractService.generatePartnershipContractHtml(partner, _contractBadgeTable());
        res.json({ html: html, already_signed: partner.contract_signed === true, contract_version: contractService.CONTRACT_VERSION });
    } catch(e) {
        console.error('[CONTRACT] Erreur génération contrat partenariat:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/partner/contracts — liste des contrats du partenaire connecté
app.get('/api/partner/contracts', authenticatePartner, function(req, res) {
    try {
        var contracts = contractService.loadContracts().filter(function(c) { return c.partner_id === req.partner.id; });
        contracts.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        res.json(contracts);
    } catch(e) {
        console.error('[CONTRACT] Erreur liste contrats partenaire:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/client/contracts — liste des contrats du client connecté
app.get('/api/client/contracts', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;
        var contracts = contractService.loadContracts().filter(function(c) { return c.client_email === user.email; });
        contracts.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        res.json(contracts);
    } catch(e) {
        console.error('[CONTRACT] Erreur liste contrats client:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/contracts/:id — détail d'un contrat (partenaire ou client propriétaire)
app.get('/api/contracts/:id', function(req, res) {
    try {
        var contracts = contractService.loadContracts();
        var contract = contracts.find(function(c) { return c.id === req.params.id; });
        if (!contract) return res.status(404).json({ error: 'Contrat introuvable' });

        // Vérif accès : partenaire ou client concerné, ou admin
        var tokenHeader = req.headers['authorization'] || req.headers['x-partner-token'] || '';
        var isAdmin = isValidAdminKey(req);
        var accessOk = isAdmin;
        if (!accessOk) {
            // Essayer auth partenaire
            try {
                var jwt = require('jsonwebtoken');
                var tok = tokenHeader.replace('Bearer ', '');
                var decoded = jwt.verify(tok, _JWT_SECRET);
                if (decoded && (decoded.partnerId || decoded.id)) {
                    var pid = decoded.partnerId || decoded.id;
                    accessOk = contract.partner_id === pid;
                } else if (decoded && decoded.email) {
                    accessOk = contract.client_email === decoded.email || contract.partner_email === decoded.email;
                }
            } catch(e2) { /* token invalide */ }
        }
        if (!accessOk) {
            // Essayer session client
            try {
                var sessions = loadSessions ? loadSessions() : [];
                var tok2 = req.headers['x-session-token'] || (req.cookies && req.cookies['fa_session']) || '';
                var sess = sessions.find(function(s) { return s.token === tok2 && s.active; });
                if (sess) accessOk = contract.client_email === sess.email || contract.partner_email === sess.email;
            } catch(e3) { /* sessions indisponibles */ }
        }
        if (!accessOk) return res.status(403).json({ error: 'Accès non autorisé' });

        res.json(contract);
    } catch(e) {
        console.error('[CONTRACT] Erreur get contract:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/contracts/:id/pdf — téléchargement PDF
app.get('/api/contracts/:id/pdf', function(req, res) {
    try {
        var contracts = contractService.loadContracts();
        var contract = contracts.find(function(c) { return c.id === req.params.id; });
        if (!contract) return res.status(404).json({ error: 'Contrat introuvable' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="contrat-' + contract.id + '.pdf"');
        contractService.generatePdfBuffer(contract, function(err, buf) {
            if (err) { console.error('[CONTRACT] Erreur PDF:', err); return res.status(500).end(); }
            res.end(buf);
        });
    } catch(e) {
        console.error('[CONTRACT] Erreur PDF endpoint:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/contracts/service/generate — génère un contrat de prestation après paiement
// Appelé automatiquement lorsque la commande est créée et que le service a require_contract=true
app.post('/api/contracts/service/generate', function(req, res) {
    try {
        var orderId = req.body.orderId;
        if (!orderId) return res.status(400).json({ error: 'orderId requis' });

        var orders = loadOrders();
        var order = orders.find(function(o) { return o.id === orderId; });
        if (!order) return res.status(404).json({ error: 'Commande introuvable' });

        // Vérifier qu'un contrat n'existe pas déjà
        var contracts = contractService.loadContracts();
        var existing = contracts.find(function(c) { return c.order_id === orderId && c.type === 'service'; });
        if (existing) return res.json({ contract: existing, already_exists: true });

        // Charger partenaire et client
        var partner = order.partner_id ? getPartnerById(order.partner_id) : null;
        if (!partner) return res.status(400).json({ error: 'Partenaire introuvable sur cette commande' });

        var users = loadUsers();
        var clientEmail = order.client_info && order.client_info.email;
        var clientUser = users.find(function(u) { return u.email === clientEmail; });
        var clientName = clientUser
            ? ((clientUser.prenom || clientUser.firstName || '') + ' ' + (clientUser.nom || clientUser.lastName || '')).trim()
            : ((order.client_info && order.client_info.first_name || '') + ' ' + (order.client_info && order.client_info.last_name || '')).trim();

        var customConditions = order.service_custom_conditions || '';
        var now = new Date().toISOString();
        var contractId = 'CTR-SVC-' + uuidv4().split('-')[0].toUpperCase();

        var newContract = {
            id: contractId,
            type: 'service',
            status: 'pending_client_signature',
            order_id: order.id,
            service_name: order.product_name || '',
            service_price: parseFloat(order.total_amount || 0),
            client_type: (order.client_info && order.client_info.client_type) || 'particulier',
            partner_id: partner.id,
            partner_email: partner.email,
            partner_name: ((partner.prenom || '') + ' ' + (partner.nom || '')).trim(),
            partner_type: partner.partner_type || null,
            partner_country: partner.country || 'France',
            client_email: clientEmail || '',
            client_name: clientName,
            custom_conditions: customConditions,
            signed_at: null,
            signed_ip: null,
            signature_name: null,
            signature_data: null,
            refused_at: null,
            events: [{ type: 'generated', at: now, detail: 'Contrat généré automatiquement après paiement' }],
            contract_version: contractService.CONTRACT_VERSION,
            created_at: now,
            updated_at: now
        };

        contracts.push(newContract);
        contractService.saveContracts(contracts);

        // Notifier le client
        if (clientEmail) {
            notifyUser(clientEmail, 'client', 'contract_ready',
                'Contrat prêt à signer',
                'Votre contrat de prestation avec ' + newContract.partner_name + ' est disponible. Signez-le pour démarrer la mission.',
                '/app.html#mes-contrats');
        }
        // Notifier le partenaire
        notifyUser(partner.email, 'partner', 'contract_sent',
            'Contrat envoyé au client',
            'Le contrat pour la commande ' + order.id + ' a été envoyé à ' + (clientName || clientEmail) + '.',
            '/app.html');

        console.log('[CONTRACT] Contrat prestation généré:', contractId, '→', clientEmail);
        res.json({ success: true, contract: newContract });
    } catch(e) {
        console.error('[CONTRACT] Erreur génération contrat prestation:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/contracts/service/preview/:orderId — HTML preview du contrat pour le client avant signature
app.get('/api/contracts/service/preview/:orderId', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var contracts = contractService.loadContracts();
        var contract = contracts.find(function(c) { return c.order_id === req.params.orderId && c.type === 'service'; });
        if (!contract) return res.status(404).json({ error: 'Contrat introuvable' });
        if (contract.client_email !== user.email) return res.status(403).json({ error: 'Accès refusé' });

        var orders = loadOrders();
        var order = orders.find(function(o) { return o.id === contract.order_id; });
        var partner = getPartnerById(contract.partner_id);
        var users = loadUsers();
        var clientUser = users.find(function(u) { return u.email === user.email; });
        var html = contractService.generateServiceContractHtml(order || { id: contract.order_id, product_name: contract.service_name, total_amount: contract.service_price, client_info: { client_type: contract.client_type } }, partner || {}, clientUser, contract.custom_conditions);
        res.json({ html: html, contract: contract });
    } catch(e) {
        console.error('[CONTRACT] Erreur preview:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/contracts/:id/client-sign — client signe le contrat de prestation
app.post('/api/contracts/:id/client-sign', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var signatureName = (req.body.signatureName || '').trim();
        var accepted = req.body.accepted === true;
        var signatureData = req.body.signatureData || null;
        if (!accepted) return res.status(400).json({ error: 'Vous devez accepter les conditions pour continuer.' });
        if (!signatureName || signatureName.length < 2) return res.status(400).json({ error: 'Merci de saisir votre nom complet pour signer.' });

        var contracts = contractService.loadContracts();
        var idx = contracts.findIndex(function(c) { return c.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Contrat introuvable' });
        var contract = contracts[idx];
        if (contract.client_email !== user.email) return res.status(403).json({ error: 'Accès refusé' });
        if (contract.status === 'signed') return res.status(409).json({ error: 'Ce contrat est déjà signé.' });
        if (contract.status === 'refused') return res.status(409).json({ error: 'Ce contrat a été refusé.' });

        var signIp = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        var now = new Date().toISOString();

        contracts[idx].status = 'signed';
        contracts[idx].signed_at = now;
        contracts[idx].signed_ip = signIp;
        contracts[idx].signature_name = signatureName;
        contracts[idx].signature_data = signatureData;
        contracts[idx].updated_at = now;
        contracts[idx].events = (contracts[idx].events || []).concat([{ type: 'signed', at: now, ip: signIp, detail: 'Signature client : ' + signatureName }]);
        contractService.saveContracts(contracts);

        // Mettre à jour la commande
        var orders = loadOrders();
        var oIdx = orders.findIndex(function(o) { return o.id === contract.order_id; });
        if (oIdx !== -1) {
            orders[oIdx].service_contract_signed = true;
            orders[oIdx].service_contract_signed_at = now;
            orders[oIdx].service_contract_id = contract.id;
            orders[oIdx].updated_at = now;
            saveOrders(orders);
        }

        // Notifier le partenaire
        notifyUser(contract.partner_email, 'partner', 'contract_signed',
            'Contrat signé ✅',
            contract.client_name + ' a signé le contrat pour la mission ' + contract.order_id + '. Il est disponible dans vos Livrables. La prestation peut commencer.',
            '/app.html');

        console.log('[CONTRACT] Client a signé le contrat:', contract.id, '→', user.email);
        res.json({ success: true, contract: contracts[idx] });
    } catch(e) {
        console.error('[CONTRACT] Erreur signature client:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/contracts/:id/client-refuse — client refuse le contrat
app.post('/api/contracts/:id/client-refuse', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;

        var contracts = contractService.loadContracts();
        var idx = contracts.findIndex(function(c) { return c.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Contrat introuvable' });
        var contract = contracts[idx];
        if (contract.client_email !== user.email) return res.status(403).json({ error: 'Accès refusé' });
        if (contract.status !== 'pending_client_signature') return res.status(409).json({ error: 'Statut incompatible.' });

        var reason = (req.body.reason || '').trim();
        var signIp = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        var now = new Date().toISOString();

        contracts[idx].status = 'refused';
        contracts[idx].refused_at = now;
        contracts[idx].refuse_reason = reason || null;
        contracts[idx].updated_at = now;
        contracts[idx].events = (contracts[idx].events || []).concat([{ type: 'refused', at: now, ip: signIp, detail: reason || 'Refus client sans motif' }]);
        contractService.saveContracts(contracts);

        // Notifier le partenaire
        notifyUser(contract.partner_email, 'partner', 'contract_refused',
            'Contrat refusé ❌',
            contract.client_name + ' a refusé le contrat pour la commande ' + contract.order_id + (reason ? ' — Motif : ' + reason : '') + '.',
            '/app.html');

        console.log('[CONTRACT] Client a refusé le contrat:', contract.id);
        res.json({ success: true, contract: contracts[idx] });
    } catch(e) {
        console.error('[CONTRACT] Erreur refus client:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Valider ou rejeter un upload
app.put('/api/admin/partner-uploads/:uploadId/validate', (req, res) => {
    try {
        const { action, rejection_reason } = req.body;
        if (!action || (action !== 'approve' && action !== 'reject')) {
            return res.status(400).json({ error: 'action doit etre "approve" ou "reject"' });
        }
        const uploads = loadPartnerUploads();
        const index = uploads.findIndex(u => u.id === req.params.uploadId);
        if (index === -1) {
            return res.status(404).json({ error: 'Upload non trouve' });
        }
        const upload = uploads[index];
        if (upload.validation_status !== 'pending') {
            return res.status(400).json({ error: 'Cet upload a deja ete traite' });
        }
        if (action === 'approve') {
            uploads[index].validation_status = 'approved';
            uploads[index].validated_at = new Date().toISOString();
            uploads[index].validated_by = 'admin@fagenesis.com';
            const livrableId = 'LIV-' + uuidv4().split('-')[0];
            uploads[index].livrable_id = livrableId;
            const LIVRABLES_FILE = path.join(__dirname, 'data', 'livrables.json');
            let livrables = [];
            try {
                if (fs.existsSync(LIVRABLES_FILE)) {
                    livrables = JSON.parse(fs.readFileSync(LIVRABLES_FILE, 'utf8'));
                }
            } catch (e) { livrables = []; }
            const livrable = {
                id: livrableId,
                order_id: upload.order_id,
                client_email: '',
                name: upload.name,
                type: upload.file_type,
                day_number: null,
                preview_url: upload.file_type === 'photo' ? upload.file_url : null,
                download_url: upload.file_url,
                description: upload.description || '',
                status: 'ready',
                source: 'partner',
                partner_id: upload.partner_id,
                partner_type: upload.partner_type,
                created_at: new Date().toISOString()
            };
            const order = getOrderById(upload.order_id);
            if (order && order.client_info) {
                livrable.client_email = order.client_info.email || '';
            }
            livrables.push(livrable);
            fs.writeFileSync(LIVRABLES_FILE, JSON.stringify(livrables, null, 2), 'utf8');
            console.log('[ADMIN] Upload approuve:', upload.name, '-> Livrable', livrableId);
        } else {
            uploads[index].validation_status = 'rejected';
            uploads[index].validated_at = new Date().toISOString();
            uploads[index].validated_by = 'admin@fagenesis.com';
            uploads[index].rejection_reason = rejection_reason || 'Aucune raison specifiee';
            console.log('[ADMIN] Upload rejete:', upload.name);
        }
        savePartnerUploads(uploads);
        res.json({ success: true, upload: uploads[index] });
    } catch (error) {
        console.error('[ADMIN] Erreur validation upload:', error);
        res.status(500).json({ error: 'Erreur lors de la validation' });
    }
});

// Commenter en tant qu'admin sur un projet partenaire
app.post('/api/admin/partner-comments', (req, res) => {
    try {
        const { order_id, partner_id, content } = req.body;
        if (!order_id || !content || !content.trim()) {
            return res.status(400).json({ error: 'order_id et content requis' });
        }
        const comment = {
            id: 'CMT-' + uuidv4().split('-')[0],
            order_id: order_id,
            author_type: 'admin',
            author_id: partner_id || 'admin',
            author_name: 'FA Genesis Admin',
            author_email: 'admin@fagenesis.com',
            content: content.trim(),
            created_at: new Date().toISOString()
        };
        const comments = loadPartnerComments();
        comments.push(comment);
        savePartnerComments(comments);
        console.log('[ADMIN] Commentaire partenaire:', order_id);
        res.json({ success: true, comment: comment });
    } catch (error) {
        console.error('[ADMIN] Erreur comment partenaire:', error);
        res.status(500).json({ error: 'Erreur envoi commentaire' });
    }
});

// Commentaires admin d'un projet
app.get('/api/admin/partner-comments/:orderId', (req, res) => {
    try {
        const comments = loadPartnerComments().filter(c => c.order_id === req.params.orderId);
        res.json(comments);
    } catch (error) {
        console.error('[ADMIN] Erreur comments:', error);
        res.status(500).json({ error: 'Erreur chargement commentaires' });
    }
});

// ============================================================
// ROUTES - DEVIS / QUOTES
// ============================================================

// --- ADMIN ENDPOINTS ---

/**
 * GET /api/admin/quotes
 * Liste tous les devis (filtrable par ?status=X&service_type=X)
 */
app.get('/api/admin/quotes', function(req, res) {
    try {
        var quotes = loadQuotes();
        var status = req.query.status;
        var serviceType = req.query.service_type;

        if (status) {
            quotes = quotes.filter(function(q) { return q.status === status; });
        }
        if (serviceType) {
            quotes = quotes.filter(function(q) { return q.service_type === serviceType; });
        }

        // Trier par date decroissante
        quotes.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        res.json(quotes);
    } catch (error) {
        console.error('[QUOTE] Erreur liste quotes:', error);
        res.status(500).json({ error: 'Erreur chargement devis' });
    }
});

/**
 * GET /api/admin/quotes/:id
 * Detail d'un devis
 */
app.get('/api/admin/quotes/:id', function(req, res) {
    try {
        var quote = getQuoteById(req.params.id);
        if (!quote) {
            return res.status(404).json({ error: 'Devis non trouvé' });
        }

        // Enrichir avec les infos du partenaire assigne
        var partnerInfo = null;
        if (quote.partner_id) {
            var partner = loadPartners().find(function(p) { return p.id === quote.partner_id; });
            if (partner) {
                partnerInfo = {
                    id: partner.id,
                    prenom: partner.prenom,
                    nom: partner.nom,
                    email: partner.email,
                    partner_type: partner.partner_type
                };
            }
        }

        // Integrer partner_info dans l'objet quote pour le frontend
        quote.partner_info = partnerInfo;
        res.json(quote);
    } catch (error) {
        console.error('[QUOTE] Erreur detail quote:', error);
        res.status(500).json({ error: 'Erreur chargement devis' });
    }
});

/**
 * POST /api/admin/quotes/:id/assign-partner
 * Assigner un partenaire a un devis
 */
app.post('/api/admin/quotes/:id/assign-partner', function(req, res) {
    try {
        var partnerId = req.body.partner_id;
        if (!partnerId) {
            return res.status(400).json({ error: 'partner_id requis' });
        }

        var quotes = loadQuotes();
        var idx = quotes.findIndex(function(q) { return q.id === req.params.id; });
        if (idx === -1) {
            return res.status(404).json({ error: 'Devis non trouvé' });
        }

        var partner = loadPartners().find(function(p) { return p.id === partnerId; });
        if (!partner) {
            return res.status(404).json({ error: 'Partenaire non trouve' });
        }

        quotes[idx].partner_id = partner.id;
        quotes[idx].partner_email = partner.email;
        quotes[idx].updated_at = new Date().toISOString();
        saveQuotes(quotes);

        console.log('[QUOTE] Partenaire ' + partner.email + ' assigne au devis ' + quotes[idx].quote_number);

        // Notification email au partenaire
        if (typeof emailService.sendQuotePartnerNotification === 'function') {
            emailService.sendQuotePartnerNotification(quotes[idx], partner)
                .catch(function(err) { console.error('[QUOTE] Erreur notif partenaire:', err); });
        }

        res.json({ success: true, quote: quotes[idx] });
    } catch (error) {
        console.error('[QUOTE] Erreur assignation:', error);
        res.status(500).json({ error: 'Erreur assignation partenaire' });
    }
});

/**
 * POST /api/admin/quotes/:id/review
 * Admin sauvegarde sa version finale du devis (items + notes) et calcule le pricing
 */
app.post('/api/admin/quotes/:id/review', function(req, res) {
    try {
        var items = req.body.items;
        var notes = req.body.notes;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Au moins une ligne de prestation requise' });
        }

        var quotes = loadQuotes();
        var idx = quotes.findIndex(function(q) { return q.id === req.params.id; });
        if (idx === -1) {
            return res.status(404).json({ error: 'Devis non trouvé' });
        }

        // Calculer le total
        var total = 0;
        for (var i = 0; i < items.length; i++) {
            var qty = Number(items[i].qty) || 1;
            var unitPrice = Number(items[i].unit_price) || 0;
            total += qty * unitPrice;
        }

        var depositAmount = Math.round(total * 0.30);
        var balanceAmount = total - depositAmount;

        quotes[idx].admin_final = {
            items: items,
            notes: notes || ''
        };
        quotes[idx].pricing = {
            total: total,
            deposit_percent: 30,
            deposit_amount: depositAmount,
            balance_amount: balanceAmount
        };
        quotes[idx].status = 'ADMIN_REVIEW';
        quotes[idx].updated_at = new Date().toISOString();
        saveQuotes(quotes);

        console.log('[QUOTE] Devis ' + quotes[idx].quote_number + ' revise par admin - Total: ' + total + 'EUR');

        res.json({ success: true, quote: quotes[idx] });
    } catch (error) {
        console.error('[QUOTE] Erreur review:', error);
        res.status(500).json({ error: 'Erreur revision devis' });
    }
});

/**
 * POST /api/admin/quotes/:id/send
 * Envoyer le devis au client par email
 */
app.post('/api/admin/quotes/:id/send', async function(req, res) {
    try {
        var quotes = loadQuotes();
        var idx = quotes.findIndex(function(q) { return q.id === req.params.id; });
        if (idx === -1) {
            return res.status(404).json({ error: 'Devis non trouvé' });
        }

        var quote = quotes[idx];

        if (!quote.admin_final || !quote.pricing) {
            return res.status(400).json({ error: 'Le devis doit être révisé avant envoi (items et pricing requis)' });
        }

        if (quote.status === 'ACCEPTED') {
            return res.status(400).json({ error: 'Ce devis a déjà été accepté' });
        }

        // Mettre a jour le statut
        quotes[idx].status = 'SENT_TO_CLIENT';
        quotes[idx].sent_at = new Date().toISOString();
        quotes[idx].updated_at = new Date().toISOString();
        saveQuotes(quotes);

        // Envoyer l'email au client
        var emailSent = false;
        if (typeof emailService.sendQuoteToClient === 'function') {
            try {
                var result = await emailService.sendQuoteToClient(quotes[idx]);
                emailSent = result && result.success;
                if (emailSent) {
                    console.log('[QUOTE] Devis ' + quote.quote_number + ' envoye a ' + quote.client_email);
                } else {
                    console.log('[QUOTE] Echec envoi devis: ' + (result ? result.error : 'inconnu'));
                }
            } catch (emailErr) {
                console.error('[QUOTE] Erreur envoi email devis:', emailErr);
            }
        }

        res.json({ success: true, email_sent: emailSent, quote: quotes[idx] });
    } catch (error) {
        console.error('[QUOTE] Erreur envoi devis:', error);
        res.status(500).json({ error: 'Erreur envoi devis' });
    }
});

/**
 * POST /api/admin/quotes/:id/cancel
 * Annuler un devis
 */
app.post('/api/admin/quotes/:id/cancel', function(req, res) {
    try {
        var quotes = loadQuotes();
        var idx = quotes.findIndex(function(q) { return q.id === req.params.id; });
        if (idx === -1) {
            return res.status(404).json({ error: 'Devis non trouvé' });
        }

        quotes[idx].status = 'CANCELLED';
        quotes[idx].updated_at = new Date().toISOString();
        saveQuotes(quotes);

        console.log('[QUOTE] Devis ' + quotes[idx].quote_number + ' annule');

        res.json({ success: true, quote: quotes[idx] });
    } catch (error) {
        console.error('[QUOTE] Erreur annulation:', error);
        res.status(500).json({ error: 'Erreur annulation devis' });
    }
});

/**
 * DELETE /api/admin/quotes/:id (Admin)
 * Supprimer un devis unitaire
 */
app.delete('/api/admin/quotes/:id', function(req, res) {
    try {
        var quotes = loadQuotes();
        var idx = quotes.findIndex(function(q) { return q.id === req.params.id; });
        if (idx === -1) {
            return res.status(404).json({ error: 'Devis non trouve' });
        }
        var deleted = quotes.splice(idx, 1)[0];
        saveQuotes(quotes);
        console.log('[QUOTE] Devis supprime: ' + deleted.id);
        res.json({ success: true, deleted: deleted });
    } catch (error) {
        console.error('[QUOTE] Erreur suppression devis:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/quotes/bulk-delete (Admin)
 * Supprimer plusieurs devis en une seule requete
 * Body: { ids: ['QUO-XXX', ...] }
 */
app.post('/api/admin/quotes/bulk-delete', function(req, res) {
    try {
        var ids = req.body.ids;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids requis (tableau)' });
        }
        var quotes = loadQuotes();
        var idSet = new Set(ids);
        var before = quotes.length;
        quotes = quotes.filter(function(q) { return !idSet.has(q.id); });
        var deletedCount = before - quotes.length;
        saveQuotes(quotes);
        console.log('[QUOTE] ' + deletedCount + ' devis supprime(s) en masse');
        res.json({ success: true, deleted: deletedCount });
    } catch (error) {
        console.error('[QUOTE] Erreur suppression en masse:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- PARTNER ENDPOINTS ---

/**
 * GET /api/partner/quotes
 * Liste des devis assignes au partenaire connecte
 */
app.get('/api/partner/quotes', authenticatePartner, function(req, res) {
    try {
        var quotes = loadQuotes().filter(function(q) {
            return q.partner_id === req.partner.id && q.status !== 'CANCELLED';
        });
        quotes.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        res.json(quotes);
    } catch (error) {
        console.error('[QUOTE] Erreur liste quotes partenaire:', error);
        res.status(500).json({ error: 'Erreur chargement devis' });
    }
});

/**
 * GET /api/partner/quotes/:id
 * Detail d'un devis pour le partenaire (verifie l'assignation)
 */
app.get('/api/partner/quotes/:id', authenticatePartner, function(req, res) {
    try {
        var quote = getQuoteById(req.params.id);
        if (!quote) {
            return res.status(404).json({ error: 'Devis non trouvé' });
        }
        if (quote.partner_id !== req.partner.id) {
            return res.status(403).json({ error: 'Acces non autorise a ce devis' });
        }

        // Retourner les infos sans donnees financieres sensibles pour le partenaire
        var partnerView = {
            id: quote.id,
            quote_number: quote.quote_number,
            status: quote.status,
            service_type: quote.service_type,
            client_name: quote.client_name,
            client_profil: quote.client_profil,
            brief: quote.brief,
            partner_proposal: quote.partner_proposal,
            created_at: quote.created_at,
            updated_at: quote.updated_at
        };

        res.json(partnerView);
    } catch (error) {
        console.error('[QUOTE] Erreur detail quote partenaire:', error);
        res.status(500).json({ error: 'Erreur chargement devis' });
    }
});

/**
 * POST /api/partner/quotes/:id/propose
 * Partenaire soumet sa proposition interne
 */
app.post('/api/partner/quotes/:id/propose', authenticatePartner, function(req, res) {
    try {
        var items = req.body.items;
        var delay = req.body.delay;
        var notes = req.body.notes;
        var budgetAccepted = req.body.budget_accepted;
        var counterBudget = req.body.counter_budget;
        var budgetJustification = req.body.budget_justification;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Au moins une ligne de proposition requise' });
        }

        var quotes = loadQuotes();
        var idx = quotes.findIndex(function(q) { return q.id === req.params.id; });
        if (idx === -1) {
            return res.status(404).json({ error: 'Devis non trouvé' });
        }

        if (quotes[idx].partner_id !== req.partner.id) {
            return res.status(403).json({ error: 'Acces non autorise' });
        }

        if (quotes[idx].status !== 'DRAFT_REQUESTED' && quotes[idx].status !== 'PARTNER_PROPOSED') {
            return res.status(400).json({ error: 'Ce devis ne peut plus etre modifie (statut: ' + quotes[idx].status + ')' });
        }

        var proposal = {
            items: items,
            delay: delay || '',
            notes: notes || ''
        };

        // Réponse au budget client
        if (quotes[idx].client_budget != null) {
            proposal.budget_accepted = budgetAccepted === true || budgetAccepted === 'true';
            if (!proposal.budget_accepted && counterBudget != null && !isNaN(parseFloat(counterBudget))) {
                proposal.counter_budget = parseFloat(counterBudget);
                proposal.budget_justification = budgetJustification || '';
            }
        }

        quotes[idx].partner_proposal = proposal;
        quotes[idx].status = 'PARTNER_PROPOSED';
        quotes[idx].updated_at = new Date().toISOString();
        saveQuotes(quotes);

        console.log('[QUOTE] Proposition partenaire pour devis ' + quotes[idx].quote_number);

        res.json({ success: true, message: 'Proposition soumise avec succes' });
    } catch (error) {
        console.error('[QUOTE] Erreur proposition:', error);
        res.status(500).json({ error: 'Erreur soumission proposition' });
    }
});

/**
 * POST /api/partner/quotes/:id/cancel
 * Partenaire annule un devis qui lui est assigné (même si déjà accepté par le client)
 */
app.post('/api/partner/quotes/:id/cancel', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var quotes = loadQuotes();
        var idx = quotes.findIndex(function(q) { return q.id === req.params.id; });
        if (idx === -1) {
            return res.status(404).json({ error: 'Devis non trouvé' });
        }

        var quote = quotes[idx];

        // Vérifier que ce devis est bien assigné à ce partenaire
        if (quote.partner_id !== partner.id && quote.partner_email !== partner.email) {
            return res.status(403).json({ error: 'Accès non autorisé à ce devis' });
        }

        if (quote.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Ce devis est déjà annulé' });
        }

        quotes[idx].status = 'CANCELLED';
        quotes[idx].cancelled_at = new Date().toISOString();
        quotes[idx].cancelled_by = 'partner';
        quotes[idx].updated_at = new Date().toISOString();
        saveQuotes(quotes);

        // Notifier l'admin
        if (typeof emailService.sendAdminNotification === 'function') {
            emailService.sendAdminNotification({
                name: partner.prenom || partner.email,
                email: partner.email,
                subject: 'Devis annulé par un partenaire',
                message: 'Le partenaire ' + (partner.prenom || '') + ' ' + (partner.nom || partner.email) + ' a annulé le devis ' + (quote.quote_number || quote.id) + ' (client : ' + (quote.client_name || quote.client_email) + ').'
            }).catch(function(e) {});
        }

        console.log('[QUOTE] Devis ' + quote.quote_number + ' annule par partenaire ' + partner.email);
        res.json({ success: true });

    } catch (error) {
        console.error('[QUOTE] Erreur annulation partenaire:', error);
        res.status(500).json({ error: 'Erreur lors de l\'annulation' });
    }
});

// --- PUBLIC ENDPOINTS ---

/**
 * GET /api/quotes/view/:token
 * Page publique : consulter un devis via son token d'acceptation
 */
app.get('/api/quotes/view/:token', function(req, res) {
    try {
        var quotes = loadQuotes();
        var quote = quotes.find(function(q) { return q.acceptance_token === req.params.token; });

        if (!quote) {
            return res.status(404).json({ error: 'Devis non trouvé', code: 'INVALID_TOKEN' });
        }

        if (quote.status === 'ACCEPTED') {
            return res.json({ quote: null, status: 'ALREADY_ACCEPTED', message: 'Ce devis a déjà été accepté.' });
        }

        if (quote.status === 'CANCELLED') {
            return res.json({ quote: null, status: 'CANCELLED', message: 'Ce devis a été annulé.' });
        }

        if (quote.status !== 'SENT_TO_CLIENT') {
            return res.json({ quote: null, status: 'NOT_READY', message: 'Ce devis n\'est pas encore disponible.' });
        }

        // Verifier l'expiration
        var createdDate = new Date(quote.sent_at || quote.created_at);
        var expiryDate = new Date(createdDate.getTime() + (quote.validity_days * 24 * 60 * 60 * 1000));
        if (new Date() > expiryDate) {
            return res.json({ quote: null, status: 'EXPIRED', message: 'Ce devis a expiré.' });
        }

        // Retourner les donnees publiques du devis (pas de token, pas de donnees internes)
        var publicView = {
            quote_number: quote.quote_number,
            client_name: quote.client_name,
            client_email: quote.client_email,
            service_type: quote.service_type,
            admin_final: {
                items: quote.admin_final ? quote.admin_final.items : [],
                notes: quote.admin_final ? quote.admin_final.notes : ''
            },
            pricing: quote.pricing,
            validity_days: quote.validity_days,
            created_at: quote.sent_at || quote.created_at,
            sent_at: quote.sent_at,
            expiry_date: expiryDate.toISOString()
        };

        res.json({ quote: publicView, status: 'OK' });
    } catch (error) {
        console.error('[QUOTE] Erreur consultation devis:', error);
        res.status(500).json({ error: 'Erreur consultation devis' });
    }
});

/**
 * POST /api/quotes/accept
 * Accepter un devis (authentification requise)
 * Le client doit etre connecte. Le devis est lie a son compte.
 * Cree une order + checkout SumUp + livrable PDF du devis.
 */
app.post('/api/quotes/accept', async function(req, res) {
    try {
        // Authentification requise
        var authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentification requise. Veuillez vous connecter.' });
        }
        var authToken = authHeader.split(' ')[1];
        var users = loadUsers();
        var authUser = findUserByToken(authToken);
        if (!authUser) {
            return res.status(401).json({ error: 'Session invalide ou expirée' });
        }

        var quoteToken = req.body.token;
        if (!quoteToken) {
            return res.status(400).json({ error: 'Token de devis requis' });
        }

        var quotes = loadQuotes();
        var idx = quotes.findIndex(function(q) { return q.acceptance_token === quoteToken; });
        if (idx === -1) {
            return res.status(404).json({ error: 'Devis non trouvé' });
        }

        var quote = quotes[idx];

        // Si deja accepte, retourner les infos existantes (idempotent)
        if (quote.status === 'ACCEPTED' || quote.status === 'DEPOSIT_PAID') {
            var existingOrder = quote.order_id ? getOrderById(quote.order_id) : null;
            var existingCheckoutId = null;

            // Si l'acompte n'est pas encore paye, recreer un checkout (widget mode)
            if (existingOrder && !existingOrder.deposit_paid) {
                try {
                    var checkoutData = {
                        checkout_reference: existingOrder.id + '-deposit-' + Date.now(),
                        amount: existingOrder.deposit_amount,
                        currency: 'EUR',
                        pay_to_email: process.env.SUMUP_PAY_TO_EMAIL,
                        description: 'FA GENESIS - Acompte devis ' + quote.quote_number,
                        merchant_code: process.env.SUMUP_MERCHANT_CODE
                    };
                    var ckResp = await callSumUpAPI('/checkouts', 'POST', checkoutData);
                    existingCheckoutId = ckResp.id;
                    updateOrder(existingOrder.id, { checkout_id: ckResp.id, current_stage: 'deposit' });
                } catch (e) {
                    console.error('[QUOTE] Erreur recreation checkout:', e);
                }
            }

            return res.json({
                success: true,
                already_accepted: true,
                order_id: quote.order_id,
                checkout_id: existingCheckoutId,
                deposit_paid: existingOrder ? existingOrder.deposit_paid : false,
                deposit_amount: quote.pricing.deposit_amount,
                total_amount: quote.pricing.total
            });
        }

        if (quote.status !== 'SENT_TO_CLIENT') {
            return res.status(400).json({ error: 'Ce devis ne peut pas être accepté (statut : ' + quote.status + ')' });
        }

        // Verifier l'expiration
        var createdDate = new Date(quote.sent_at || quote.created_at);
        var expiryDate = new Date(createdDate.getTime() + (quote.validity_days * 24 * 60 * 60 * 1000));
        if (new Date() > expiryDate) {
            quotes[idx].status = 'EXPIRED';
            quotes[idx].expired_at = new Date().toISOString();
            saveQuotes(quotes);
            return res.status(400).json({ error: 'Ce devis a expiré' });
        }

        if (!quote.pricing || !quote.pricing.total) {
            return res.status(400).json({ error: 'Devis invalide (pas de pricing)' });
        }

        // 1. Lier le devis au compte client connecte
        quotes[idx].client_user_id = authUser.id;
        quotes[idx].client_email = authUser.email;

        // 2. Creer la commande (order)
        var serviceLabels = { photo: 'Photo', video: 'Vidéo', media: 'Média', marketing: 'Marketing', other: 'Prestation' };
        var productName = 'Devis ' + (serviceLabels[quote.service_type] || 'Personnalisé') + ' - ' + quote.quote_number;

        var newOrder = {
            id: 'ORD-' + uuidv4().split('-')[0].toUpperCase(),
            product_id: 'quote-' + quote.id,
            product_name: productName,
            product_type: 'prestation_individuelle',
            client_info: {
                email: authUser.email,
                first_name: authUser.prenom || '',
                last_name: authUser.nom || '',
                phone: authUser.telephone || null,
                company: null,
                client_type: quote.client_profil || 'particulier'
            },
            user_id: authUser.id,
            total_amount: quote.pricing.total,
            deposit_amount: quote.pricing.deposit_amount,
            balance_amount: quote.pricing.balance_amount,
            deposit_paid: false,
            balance_paid: false,
            duration_days: null,
            start_date: null,
            status: 'pending_deposit',
            checkout_id: null,
            transaction_id: null,
            source: 'quote',
            quote_id: quote.id,
            quote_number: quote.quote_number,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        var orders = loadOrders();
        orders.push(newOrder);
        saveOrders(orders);

        // 3. Mettre a jour le devis
        quotes[idx].status = 'ACCEPTED';
        quotes[idx].accepted_at = new Date().toISOString();
        quotes[idx].order_id = newOrder.id;
        quotes[idx].updated_at = new Date().toISOString();
        saveQuotes(quotes);

        console.log('[QUOTE] Devis ' + quote.quote_number + ' accepte par ' + authUser.email + ' - Commande ' + newOrder.id + ' creee');

        // 3.5 Auto-assigner le partenaire du devis a la commande
        if (quote.partner_id) {
            try {
                var assignPartner = getPartnerById(quote.partner_id);
                if (assignPartner) {
                    var assignments = loadPartnerAssignments();
                    var alreadyAssigned = assignments.find(function(a) {
                        return a.partner_id === quote.partner_id && a.order_id === newOrder.id && a.status === 'active';
                    });
                    if (!alreadyAssigned) {
                        var newAssignment = {
                            id: 'ASG-' + uuidv4().split('-')[0],
                            partner_id: quote.partner_id,
                            partner_email: assignPartner.email,
                            partner_type: assignPartner.partner_type,
                            order_id: newOrder.id,
                            assigned_at: new Date().toISOString(),
                            assigned_by: 'system-quote-accept',
                            status: 'active',
                            notes: 'Auto-assigne depuis devis ' + quote.quote_number
                        };
                        assignments.push(newAssignment);
                        savePartnerAssignments(assignments);
                        console.log('[QUOTE] Partenaire ' + assignPartner.email + ' auto-assigne a la commande ' + newOrder.id);
                    }
                }
            } catch (assignError) {
                console.error('[QUOTE] Erreur auto-assignation partenaire:', assignError);
            }
        }

        // 4. Creer le livrable PDF du devis
        try {
            var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';
            var pdfDownloadUrl = (process.env.API_URL || 'https://fa-genesis-website.onrender.com') + '/api/quotes/' + quote.id + '/pdf';

            var livrable = {
                id: 'LIV-' + uuidv4().split('-')[0].toUpperCase(),
                order_id: newOrder.id,
                client_email: authUser.email,
                name: 'Devis ' + quote.quote_number,
                type: 'document',
                day_number: null,
                preview_url: null,
                download_url: pdfDownloadUrl,
                description: 'Devis personnalisé ' + quote.quote_number + ' - Document contractuel',
                status: 'ready',
                created_at: new Date().toISOString()
            };

            var livrables = loadLivrables();
            livrables.push(livrable);
            saveLivrables(livrables);
            console.log('[QUOTE] Livrable PDF cree: ' + livrable.id + ' pour commande ' + newOrder.id);
        } catch (livrableError) {
            console.error('[QUOTE] Erreur creation livrable PDF:', livrableError);
        }

        // 5. Creer le checkout SumUp pour l'acompte (widget mode, pas hosted)
        var checkoutId = null;
        try {
            var checkoutData = {
                checkout_reference: newOrder.id + '-deposit',
                amount: quote.pricing.deposit_amount,
                currency: 'EUR',
                pay_to_email: process.env.SUMUP_PAY_TO_EMAIL,
                description: 'FA GENESIS - ' + productName + ' (Acompte 30%)',
                merchant_code: process.env.SUMUP_MERCHANT_CODE
            };

            var checkoutResponse = await callSumUpAPI('/checkouts', 'POST', checkoutData);
            checkoutId = checkoutResponse.id;

            updateOrder(newOrder.id, {
                checkout_id: checkoutId,
                current_stage: 'deposit'
            });

            console.log('[QUOTE] Checkout SumUp cree: ' + checkoutId);
        } catch (sumupError) {
            console.error('[QUOTE] Erreur SumUp checkout:', sumupError);
        }

        // 6. Notification admin
        if (typeof emailService.sendAdminNotification === 'function') {
            emailService.sendAdminNotification({
                name: authUser.prenom + ' ' + authUser.nom,
                email: authUser.email,
                subject: 'Devis accepte',
                message: 'Le client ' + authUser.prenom + ' ' + authUser.nom + ' (' + authUser.email + ') a accepte le devis ' + quote.quote_number + ' (' + quote.pricing.total + ' EUR). Commande ' + newOrder.id + ' creee.'
            }).catch(function(err) { console.error('[QUOTE] Erreur notif admin:', err); });
        }

        res.json({
            success: true,
            order_id: newOrder.id,
            checkout_id: checkoutId,
            deposit_amount: quote.pricing.deposit_amount,
            total_amount: quote.pricing.total
        });

    } catch (error) {
        console.error('[QUOTE] Erreur acceptation devis:', error);
        res.status(500).json({ error: 'Erreur lors de l\'acceptation du devis' });
    }
});

/**
 * POST /api/quotes/cancel
 * Annuler un devis depuis l'espace client (même si déjà accepté)
 */
app.post('/api/quotes/cancel', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentification requise' });
        }
        var authToken = authHeader.split(' ')[1];
        var users = loadUsers();
        var authUser = findUserByToken(authToken);
        if (!authUser) {
            return res.status(401).json({ error: 'Session invalide ou expirée' });
        }

        var quoteToken = req.body.token;
        if (!quoteToken) {
            return res.status(400).json({ error: 'Token de devis requis' });
        }

        var quotes = loadQuotes();
        var idx = quotes.findIndex(function(q) { return q.acceptance_token === quoteToken; });
        if (idx === -1) {
            return res.status(404).json({ error: 'Devis non trouvé' });
        }

        var quote = quotes[idx];

        // Vérifier que le client est bien le destinataire
        if (quote.client_email && quote.client_email !== authUser.email) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        if (quote.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Ce devis est déjà annulé' });
        }

        quotes[idx].status = 'CANCELLED';
        quotes[idx].cancelled_at = new Date().toISOString();
        quotes[idx].cancelled_by = 'client';
        quotes[idx].updated_at = new Date().toISOString();
        saveQuotes(quotes);

        // Si une commande liée existe, la marquer annulée
        if (quote.order_id) {
            try {
                var orders = loadOrders();
                var oIdx = orders.findIndex(function(o) { return o.id === quote.order_id; });
                if (oIdx !== -1 && orders[oIdx].status !== 'fully_paid') {
                    orders[oIdx].status = 'cancelled';
                    orders[oIdx].updated_at = new Date().toISOString();
                    saveOrders(orders);
                }
            } catch (e) { console.error('[QUOTE] Erreur annulation order liee:', e); }
        }

        // Notifications email
        if (typeof emailService.sendQuoteCancelledNotification === 'function') {
            emailService.sendQuoteCancelledNotification(quotes[idx], 'client')
                .catch(function(e) { console.error('[QUOTE] Erreur notif annulation:', e); });
        }

        console.log('[QUOTE] Devis ' + quote.quote_number + ' annule par le client ' + authUser.email);
        res.json({ success: true });

    } catch (error) {
        console.error('[QUOTE] Erreur annulation client:', error);
        res.status(500).json({ error: 'Erreur lors de l\'annulation' });
    }
});

/**
 * GET /api/quotes/:quoteId/pdf
 * Generer et telecharger le PDF du devis
 */
app.get('/api/quotes/:quoteId/pdf', function(req, res) {
    try {
        var quotes = loadQuotes();
        var quote = quotes.find(function(q) { return q.id === req.params.quoteId; });
        if (!quote) {
            return res.status(404).json({ error: 'Devis non trouvé' });
        }

        // Verifier que le devis a ete accepte (ou au moins envoye)
        if (!['SENT_TO_CLIENT', 'ACCEPTED', 'DEPOSIT_PAID'].includes(quote.status)) {
            return res.status(403).json({ error: 'Ce devis n\'est pas encore disponible en PDF' });
        }

        var serviceLabels = { photo: 'Photo', video: 'Vidéo', media: 'Média', marketing: 'Marketing', other: 'Prestation sur mesure' };
        var serviceLabel = serviceLabels[quote.service_type] || 'Prestation sur mesure';

        // Creer le PDF
        var doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Devis_' + quote.quote_number + '.pdf');

        doc.pipe(res);

        // === EN-TETE ===
        doc.fontSize(24).font('Helvetica-Bold').text('FA GENESIS', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('BUILD. LAUNCH. IMPACT.', { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#FFD700');
        doc.moveDown(1);

        // === INFOS DEVIS ===
        doc.fontSize(18).font('Helvetica-Bold').text('DEVIS ' + quote.quote_number, { align: 'left' });
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica');
        doc.text('Service : ' + serviceLabel);
        doc.text('Date : ' + new Date(quote.sent_at || quote.created_at).toLocaleDateString('fr-FR'));
        var sentDate = new Date(quote.sent_at || quote.created_at);
        var expiryDate = new Date(sentDate.getTime() + ((quote.validity_days || 30) * 24 * 60 * 60 * 1000));
        doc.text('Valable jusqu\'au : ' + expiryDate.toLocaleDateString('fr-FR'));
        doc.moveDown(1);

        // === CLIENT ===
        doc.fontSize(13).font('Helvetica-Bold').text('CLIENT');
        doc.fontSize(11).font('Helvetica');
        doc.text(quote.client_name || '');
        doc.text(quote.client_email || '');
        doc.moveDown(1);

        // === TABLEAU DES PRESTATIONS ===
        doc.fontSize(13).font('Helvetica-Bold').text('PRESTATIONS');
        doc.moveDown(0.5);

        var items = (quote.admin_final && quote.admin_final.items) ? quote.admin_final.items : [];
        var tableTop = doc.y;
        var colX = [50, 300, 370, 440, 510];

        // Header
        doc.fontSize(9).font('Helvetica-Bold');
        doc.rect(50, tableTop, 495, 20).fill('#000');
        doc.fillColor('#FFD700');
        doc.text('PRESTATION', colX[0] + 5, tableTop + 5, { width: 245 });
        doc.text('QTE', colX[1] + 5, tableTop + 5, { width: 60, align: 'center' });
        doc.text('P.U.', colX[2] + 5, tableTop + 5, { width: 60, align: 'right' });
        doc.text('TOTAL', colX[3] + 5, tableTop + 5, { width: 95, align: 'right' });
        doc.fillColor('#000');

        var rowY = tableTop + 22;
        doc.font('Helvetica').fontSize(10);

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var qty = Number(item.qty) || 1;
            var unitPrice = Number(item.unit_price) || 0;
            var lineTotal = qty * unitPrice;

            if (i % 2 === 0) {
                doc.rect(50, rowY - 2, 495, 18).fill('#f9f9f9');
                doc.fillColor('#000');
            }

            doc.text(item.label || '', colX[0] + 5, rowY, { width: 245 });
            doc.text(String(qty), colX[1] + 5, rowY, { width: 60, align: 'center' });
            doc.text(unitPrice.toFixed(2) + ' EUR', colX[2] + 5, rowY, { width: 60, align: 'right' });
            doc.font('Helvetica-Bold').text(lineTotal.toFixed(2) + ' EUR', colX[3] + 5, rowY, { width: 95, align: 'right' });
            doc.font('Helvetica');

            rowY += 20;
        }

        // Ligne separatrice
        doc.moveTo(50, rowY + 2).lineTo(545, rowY + 2).stroke('#000');

        // === TOTAUX ===
        rowY += 15;
        if (quote.pricing) {
            doc.fontSize(12).font('Helvetica-Bold');
            doc.text('TOTAL HT :', 350, rowY, { width: 100, align: 'right' });
            doc.text(quote.pricing.total.toFixed(2) + ' EUR', 455, rowY, { width: 90, align: 'right' });
            rowY += 20;

            doc.fontSize(11).font('Helvetica');
            doc.text('Acompte (30%) :', 350, rowY, { width: 100, align: 'right' });
            doc.font('Helvetica-Bold').text(quote.pricing.deposit_amount.toFixed(2) + ' EUR', 455, rowY, { width: 90, align: 'right' });
            rowY += 18;

            doc.font('Helvetica');
            doc.text('Solde (70%) :', 350, rowY, { width: 100, align: 'right' });
            doc.text(quote.pricing.balance_amount.toFixed(2) + ' EUR', 455, rowY, { width: 90, align: 'right' });
        }

        // === NOTES ===
        if (quote.admin_final && quote.admin_final.notes) {
            doc.moveDown(2);
            doc.fontSize(11).font('Helvetica-Bold').text('CONDITIONS :');
            doc.fontSize(10).font('Helvetica').text(quote.admin_final.notes);
        }

        // === PIED DE PAGE ===
        doc.moveDown(3);
        doc.fontSize(8).font('Helvetica').fillColor('#888');
        doc.text('FA GENESIS - Groupe FA Industries', 50, doc.page.height - 80, { align: 'center', width: 495 });
        doc.text('Document généré automatiquement - Ce devis fait office de document contractuel', { align: 'center', width: 495 });

        doc.end();

    } catch (error) {
        console.error('[QUOTE] Erreur generation PDF:', error);
        res.status(500).json({ error: 'Erreur generation PDF' });
    }
});

/**
 * GET /api/quotes/my-quote/:token
 * Consulter un devis lie a son compte (authentification requise)
 */
app.get('/api/quotes/my-quote/:token', function(req, res) {
    try {
        // Authentification requise
        var authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentification requise' });
        }
        var authToken = authHeader.split(' ')[1];
        var users = loadUsers();
        var authUser = findUserByToken(authToken);
        if (!authUser) {
            return res.status(401).json({ error: 'Session invalide' });
        }

        var quotes = loadQuotes();
        var quote = quotes.find(function(q) { return q.acceptance_token === req.params.token; });
        if (!quote) {
            return res.status(404).json({ error: 'Devis non trouvé' });
        }

        // Recuperer l'order liee si elle existe
        var order = quote.order_id ? getOrderById(quote.order_id) : null;

        var sentDate = new Date(quote.sent_at || quote.created_at);
        var expiryDate = new Date(sentDate.getTime() + ((quote.validity_days || 30) * 24 * 60 * 60 * 1000));

        res.json({
            quote_number: quote.quote_number,
            client_name: quote.client_name,
            client_email: quote.client_email,
            service_type: quote.service_type,
            status: quote.status,
            admin_final: {
                items: quote.admin_final ? quote.admin_final.items : [],
                notes: quote.admin_final ? quote.admin_final.notes : ''
            },
            pricing: quote.pricing,
            validity_days: quote.validity_days,
            created_at: quote.sent_at || quote.created_at,
            expiry_date: expiryDate.toISOString(),
            accepted_at: quote.accepted_at || null,
            order_id: quote.order_id || null,
            deposit_paid: order ? order.deposit_paid : false,
            order_status: order ? order.status : null,
            pdf_url: (process.env.API_URL || 'https://fa-genesis-website.onrender.com') + '/api/quotes/' + quote.id + '/pdf'
        });

    } catch (error) {
        console.error('[QUOTE] Erreur consultation devis authentifie:', error);
        res.status(500).json({ error: 'Erreur consultation devis' });
    }
});

/**
 * GET /api/quotes/by-order/:orderId
 * Retrouver le token d'un devis a partir de l'order_id (authentification requise)
 */
app.get('/api/quotes/by-order/:orderId', function(req, res) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentification requise' });
        }
        var authToken = authHeader.split(' ')[1];
        var users = loadUsers();
        var authUser = findUserByToken(authToken);
        if (!authUser) {
            return res.status(401).json({ error: 'Session invalide' });
        }

        var quotes = loadQuotes();
        var quote = quotes.find(function(q) { return q.order_id === req.params.orderId; });
        if (!quote) {
            return res.status(404).json({ error: 'Aucun devis lié à cette commande' });
        }

        // Verifier que le devis appartient au bon client
        if (quote.client_email.toLowerCase() !== authUser.email.toLowerCase()) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        res.json({
            acceptance_token: quote.acceptance_token,
            quote_number: quote.quote_number,
            status: quote.status
        });

    } catch (error) {
        console.error('[QUOTE] Erreur recherche devis par order_id:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// NETTOYAGE DES FAUX COMPTES PARTENAIRES DE DEMARRAGE (system-seed)
// ============================================================
// Ces comptes de demonstration (Photo Graphe, Video Aste, Market Eur, Media
// Press) etaient auto-crees a chaque demarrage par l'ancienne fonction
// seedPartnerAccounts(). Ils masquaient les vrais prestataires dans
// l'annuaire/explorer. On les purge desormais au demarrage au lieu de les
// recreer.
async function purgeSeedPartnerAccounts() {
    const partners = loadPartners();
    const remaining = partners.filter(function(p) {
        return p.createdBy !== 'system-seed' &&
               p.createdBy !== 'setup-test-partners' &&
               p.createdBy !== 'setup-test-parrainage' &&
               !/^test-/.test((p.email || '').toLowerCase());
    });
    const removed = partners.length - remaining.length;

    if (removed > 0) {
        savePartners(remaining);
        console.log('   [CLEANUP] ' + removed + ' compte(s) partenaire(s) de test supprime(s) au demarrage');
    }
}

// ============================================================
// ENDPOINTS IA + WORKFLOW PROJET
// ============================================================

/**
 * POST /api/ai/bootstrap-project
 * Cree un projet + livrables Jour 1 pour une commande (admin uniquement)
 */
app.post('/api/ai/bootstrap-project', (req, res) => {
    try {
        // Verifier admin
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acces admin requis' });

        var orderId = req.body.order_id;
        if (!orderId) return res.status(400).json({ error: 'order_id requis' });

        var order = getOrderById(orderId);
        if (!order) return res.status(404).json({ error: 'Commande non trouvee' });

        if (!order.deposit_paid) return res.status(400).json({ error: 'Acompte non paye' });

        // Trouver l'utilisateur
        var users = loadUsers();
        var clientEmail = (order.client_info && order.client_info.email) || order.email || '';
        var user = users.find(function(u) { return u.email === clientEmail; }) || {
            email: clientEmail,
            firstName: order.client_info ? order.client_info.first_name : '',
            lastName: order.client_info ? order.client_info.last_name : ''
        };

        var result = bootstrapService.bootstrapProject(order, user);
        if (result.success) {
            res.json({ success: true, project: result.project, deliverables_count: result.deliverables.length, errors: result.errors });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (err) {
        console.error('[API] Erreur bootstrap-project:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/ai/client-submit
 * Client soumet ses reponses au questionnaire → genere pre-analyse + agenda
 */
app.post('/api/ai/client-submit', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);

        var projectId = req.body.project_id;
        var responses = req.body.responses; // texte des reponses client

        if (!projectId || !responses) return res.status(400).json({ error: 'project_id et responses requis' });

        var projects = loadProjects();
        var project = null;
        var projectIndex = -1;
        for (var i = 0; i < projects.length; i++) {
            if (projects[i].id === projectId) {
                project = projects[i];
                projectIndex = i;
                break;
            }
        }
        if (!project) return res.status(404).json({ error: 'Projet non trouve' });

        // Verifier que le client est bien le proprietaire
        if (decoded.email !== project.client_email && decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Acces non autorise a ce projet' });
        }

        // Sauvegarder les reponses dans le contexte IA
        project.ai_context.client_responses = responses;
        project.updated_at = new Date().toISOString();
        projects[projectIndex] = project;
        saveProjects(projects);

        // Generer la pre-analyse et l'agenda
        var templateData = {
            client_name: project.client_name,
            client_email: project.client_email,
            offer_name: project.offer_name,
            offer_category: project.category,
            duration: project.duration_days + ' jours',
            duration_days: String(project.duration_days),
            order_id: project.order_id,
            project_id: project.id,
            day_number: '1',
            client_responses: responses,
            session_notes: '',
            items_list: '',
            domain: 'strategy',
            partner_name: ''
        };

        var generated = [];
        var livrables = loadLivrables();
        var now = new Date().toISOString();

        // Generer pre-analyse (ADMIN_ONLY)
        var preAnalyse = aiService.generateDocument('pre-analyse', templateData);
        if (preAnalyse.success) {
            var livPreAnalyse = {
                id: 'LIV-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
                order_id: project.order_id,
                project_id: project.id,
                client_email: project.client_email,
                name: 'Pre-analyse du projet',
                type: 'pre-analyse',
                day_number: 1,
                step_order: 1,
                offer_key: project.offer_key,
                domain: 'strategy',
                status: 'generated',
                source: 'ai',
                download_url: null,
                content_text: preAnalyse.content,
                visibility: 'ADMIN_ONLY',
                workflow_status: 'PENDING_ADMIN',
                owner_role: 'ai',
                owner_partner_id: null,
                requires_admin_approval: true,
                requires_partner_approval: false,
                is_form: false,
                is_ai_generated: true,
                versions: [{
                    version_number: 1,
                    updated_by_role: 'ai',
                    updated_by_id: 'system',
                    content_text: preAnalyse.content,
                    file_url: null,
                    change_note: 'Genere apres soumission questionnaire client',
                    created_at: now
                }],
                created_at: now,
                updated_at: now
            };
            livrables.push(livPreAnalyse);
            generated.push(livPreAnalyse.id);
        }

        // Generer agenda de seance
        var agenda = aiService.generateDocument('agenda', templateData);
        if (agenda.success) {
            var livAgenda = {
                id: 'LIV-' + Date.now() + '-' + Math.floor(Math.random() * 9999),
                order_id: project.order_id,
                project_id: project.id,
                client_email: project.client_email,
                name: 'Agenda de seance - Jour 1',
                type: 'agenda',
                day_number: 1,
                step_order: 2,
                offer_key: project.offer_key,
                domain: 'strategy',
                status: 'generated',
                source: 'ai',
                download_url: null,
                content_text: agenda.content,
                visibility: 'ADMIN_ONLY',
                workflow_status: 'PENDING_ADMIN',
                owner_role: 'ai',
                owner_partner_id: null,
                requires_admin_approval: true,
                requires_partner_approval: false,
                is_form: false,
                is_ai_generated: true,
                versions: [{
                    version_number: 1,
                    updated_by_role: 'ai',
                    updated_by_id: 'system',
                    content_text: agenda.content,
                    file_url: null,
                    change_note: 'Genere apres soumission questionnaire client',
                    created_at: now
                }],
                created_at: now,
                updated_at: now
            };
            livrables.push(livAgenda);
            generated.push(livAgenda.id);
        }

        saveLivrables(livrables);

        res.json({ success: true, message: 'Reponses enregistrees, documents generes', generated_count: generated.length, generated_ids: generated });
    } catch (err) {
        console.error('[API] Erreur client-submit:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/session-completed
 * Admin marque une seance comme effectuee + notes → genere synthese + structuration + plan-action
 */
app.post('/api/admin/session-completed', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acces admin requis' });

        var projectId = req.body.project_id;
        var sessionNotes = req.body.session_notes;
        var stepOrder = req.body.step_order || null;

        if (!projectId || !sessionNotes) return res.status(400).json({ error: 'project_id et session_notes requis' });

        var projects = loadProjects();
        var project = null;
        var projectIndex = -1;
        for (var i = 0; i < projects.length; i++) {
            if (projects[i].id === projectId) {
                project = projects[i];
                projectIndex = i;
                break;
            }
        }
        if (!project) return res.status(404).json({ error: 'Projet non trouve' });

        // Ajouter les notes de seance
        project.ai_context.session_notes.push({
            step_order: stepOrder || project.current_step,
            notes: sessionNotes,
            date: new Date().toISOString()
        });

        // Marquer l'etape comme terminee dans timeline_progress
        var targetStep = stepOrder || project.current_step;
        for (var t = 0; t < project.timeline_progress.length; t++) {
            if (project.timeline_progress[t].step_order === targetStep) {
                project.timeline_progress[t].status = 'completed';
                project.timeline_progress[t].completed_at = new Date().toISOString();
            }
            // Activer l'etape suivante
            if (project.timeline_progress[t].step_order === targetStep + 1) {
                project.timeline_progress[t].status = 'in_progress';
            }
        }

        // Avancer le step courant
        if (!stepOrder || stepOrder === project.current_step) {
            project.current_step = project.current_step + 1;
        }

        project.updated_at = new Date().toISOString();
        projects[projectIndex] = project;
        saveProjects(projects);

        // Generer les documents post-seance
        var templateData = {
            client_name: project.client_name,
            client_email: project.client_email,
            offer_name: project.offer_name,
            offer_category: project.category,
            duration: project.duration_days + ' jours',
            duration_days: String(project.duration_days),
            order_id: project.order_id,
            project_id: project.id,
            day_number: String(targetStep),
            client_responses: project.ai_context.client_responses || '',
            session_notes: sessionNotes,
            items_list: '',
            domain: 'strategy',
            partner_name: ''
        };

        var generated = [];
        var livrables = loadLivrables();
        var now = new Date().toISOString();

        // Generer synthese, structuration, plan-action
        var docTypes = ['synthese', 'structuration', 'plan-action'];
        var docNames = ['Synthese de seance', 'Structuration du projet', 'Plan d\'action'];

        for (var d = 0; d < docTypes.length; d++) {
            var doc = aiService.generateDocument(docTypes[d], templateData);
            if (doc.success) {
                var livDoc = {
                    id: 'LIV-' + Date.now() + '-' + Math.floor(Math.random() * 10000 + d),
                    order_id: project.order_id,
                    project_id: project.id,
                    client_email: project.client_email,
                    name: docNames[d],
                    type: docTypes[d],
                    day_number: targetStep,
                    step_order: targetStep,
                    offer_key: project.offer_key,
                    domain: 'strategy',
                    status: 'generated',
                    source: 'ai',
                    download_url: null,
                    content_text: doc.content,
                    visibility: 'ADMIN_ONLY',
                    workflow_status: 'PENDING_ADMIN',
                    owner_role: 'ai',
                    owner_partner_id: null,
                    requires_admin_approval: true,
                    requires_partner_approval: false,
                    is_form: false,
                    is_ai_generated: true,
                    versions: [{
                        version_number: 1,
                        updated_by_role: 'ai',
                        updated_by_id: 'system',
                        content_text: doc.content,
                        file_url: null,
                        change_note: 'Genere apres seance effectuee',
                        created_at: now
                    }],
                    created_at: now,
                    updated_at: now
                };
                livrables.push(livDoc);
                generated.push({ id: livDoc.id, type: docTypes[d] });
            }
        }

        saveLivrables(livrables);

        res.json({ success: true, message: 'Seance marquee comme effectuee', generated: generated, project_step: project.current_step });
    } catch (err) {
        console.error('[API] Erreur session-completed:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/deliverables/:id/approve
 * Admin approuve un livrable (workflow_status → APPROVED)
 */
app.post('/api/admin/deliverables/:id/approve', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acces admin requis' });

        var livrables = loadLivrables();
        var found = false;
        for (var i = 0; i < livrables.length; i++) {
            if (livrables[i].id === req.params.id) {
                livrables[i].workflow_status = 'APPROVED';
                livrables[i].updated_at = new Date().toISOString();
                found = true;
                saveLivrables(livrables);
                return res.json({ success: true, livrable: ensureLivrableFields(livrables[i]) });
            }
        }
        if (!found) return res.status(404).json({ error: 'Livrable non trouve' });
    } catch (err) {
        console.error('[API] Erreur approve:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/deliverables/:id/publish
 * Admin publie un livrable (visible par le client)
 */
app.post('/api/admin/deliverables/:id/publish', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acces admin requis' });

        var livrables = loadLivrables();
        for (var i = 0; i < livrables.length; i++) {
            if (livrables[i].id === req.params.id) {
                livrables[i].workflow_status = 'PUBLISHED';
                livrables[i].visibility = 'CLIENT_ON_PUBLISH';
                livrables[i].updated_at = new Date().toISOString();
                saveLivrables(livrables);
                return res.json({ success: true, livrable: ensureLivrableFields(livrables[i]) });
            }
        }
        return res.status(404).json({ error: 'Livrable non trouve' });
    } catch (err) {
        console.error('[API] Erreur publish:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/deliverables/:id/request-revision
 * Admin demande une revision au partenaire
 */
app.post('/api/admin/deliverables/:id/request-revision', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acces admin requis' });

        var note = req.body.note || 'Revision demandee';
        var livrables = loadLivrables();
        for (var i = 0; i < livrables.length; i++) {
            if (livrables[i].id === req.params.id) {
                livrables[i].workflow_status = 'REVISION_REQUESTED';
                livrables[i].updated_at = new Date().toISOString();
                // Ajouter une note de revision dans les versions
                if (!livrables[i].versions) livrables[i].versions = [];
                livrables[i].versions.push({
                    version_number: livrables[i].versions.length + 1,
                    updated_by_role: 'admin',
                    updated_by_id: decoded.email || 'admin',
                    content_text: null,
                    file_url: null,
                    change_note: 'Revision demandee: ' + note,
                    created_at: new Date().toISOString()
                });
                saveLivrables(livrables);
                return res.json({ success: true, livrable: ensureLivrableFields(livrables[i]) });
            }
        }
        return res.status(404).json({ error: 'Livrable non trouve' });
    } catch (err) {
        console.error('[API] Erreur request-revision:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/admin/payouts/pending
 * Liste les versements partenaires en attente (Phase 5 : surtout les virements bancaires
 * sans equivalent automatique cote PayPal).
 */
app.get('/api/admin/payouts/pending', (req, res) => {
    try {
        var partners = loadPartners();
        var pending = loadPayouts()
            .filter(function(p) { return p.status === 'pending'; })
            .map(function(p) {
                var partner = partners.find(function(pt) { return pt.id === p.partner_id; });
                return Object.assign({}, p, {
                    partner_name: partner ? (partner.prenom ? (partner.prenom + ' ' + (partner.nom || '')) : (partner.company || partner.email)) : (p.partner_email || 'Partenaire'),
                    partner_iban_masked: p.partner_iban ? ('•••• ' + p.partner_iban.slice(-4)) : null
                });
            })
            .sort(function(a, b) { return (a.partner_name || '').localeCompare(b.partner_name || ''); });

        res.json({ success: true, payouts: pending });
    } catch (err) {
        console.error('[API] Erreur payouts pending:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/payouts/:id/mark-sent
 * Cloture manuelle d'un versement par virement bancaire (aucun appel PayPal declenche ici).
 */
app.post('/api/admin/payouts/:id/mark-sent', (req, res) => {
    try {
        var reference = (req.body.reference || '').trim();
        var payouts = loadPayouts();
        var idx = payouts.findIndex(function(p) { return p.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Versement non trouve' });
        if (payouts[idx].status !== 'pending') {
            return res.status(409).json({ error: 'Ce versement n\'est pas en attente (statut: ' + payouts[idx].status + ').' });
        }

        payouts[idx].status = 'sent';
        payouts[idx].sent_at = new Date().toISOString();
        if (reference) payouts[idx].reference = reference;
        savePayouts(payouts);

        res.json({ success: true, payout: payouts[idx] });
    } catch (err) {
        console.error('[API] Erreur mark-sent payout:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// PROSPECTS — Outil de repérage B2B Montpellier
// ============================================================

async function extractEmailFromWebsite(websiteUrl) {
    var emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    var blocked = ['example', 'test', 'domain', 'noreply', 'no-reply', 'sentry', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];

    async function fetchPage(url) {
        try {
            var r = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FetchBot/1.0)' },
                redirect: 'follow',
                timeout: 8000
            });
            if (!r.ok) return null;
            return await r.text();
        } catch(e) { return null; }
    }

    function extractFromHtml(html, pageUrl) {
        var mailtoRe = /href=["']mailto:([^"'?&\s<>]+)/gi;
        var m;
        while ((m = mailtoRe.exec(html)) !== null) {
            var email = m[1].split('?')[0].toLowerCase().trim();
            if (email.indexOf('@') !== -1 && !blocked.some(function(b) { return email.indexOf(b) !== -1; })) {
                return { email: email, source: pageUrl };
            }
        }
        var emails = html.match(emailRegex) || [];
        for (var i = 0; i < emails.length; i++) {
            var e = emails[i].toLowerCase();
            if (!blocked.some(function(b) { return e.indexOf(b) !== -1; })) {
                return { email: e, source: pageUrl };
            }
        }
        return null;
    }

    var base = websiteUrl.replace(/\/$/, '');
    var pages = [base, base + '/contact', base + '/nous-contacter', base + '/contactez-nous'];
    for (var i = 0; i < pages.length; i++) {
        var html = await fetchPage(pages[i]);
        if (html) {
            var found = extractFromHtml(html, pages[i]);
            if (found) return found;
        }
    }
    return null;
}

/**
 * GET /api/admin/prospects
 */
app.get('/api/admin/prospects', (req, res) => {
    try {
        var prospects = loadProspects();
        prospects.sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
        res.json({ success: true, prospects: prospects });
    } catch (err) {
        console.error('[API] Erreur admin/prospects:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/prospects/search
 * Lance une recherche Google Places et importe les nouveaux résultats scorés.
 * Body: { category: "restaurant", zone: "Montpellier" }
 */
app.post('/api/admin/prospects/search', async (req, res) => {
    try {
        var category = (req.body.category || '').trim();
        var zone = (req.body.zone || 'Montpellier').trim();
        if (!category) return res.status(400).json({ error: 'category requise' });

        var apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) {
            return res.status(503).json({ error: 'GOOGLE_PLACES_API_KEY non configurée dans .env — voir guide de configuration', results: [] });
        }

        var r = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.photos,places.rating,places.userRatingCount'
            },
            body: JSON.stringify({
                textQuery: category + ' ' + zone,
                locationBias: { circle: { center: { latitude: 43.6117, longitude: 3.8767 }, radius: 15000.0 } },
                maxResultCount: 20,
                languageCode: 'fr'
            })
        });

        var data = await r.json();
        if (!r.ok) {
            console.error('[PROSPECTS] Google Places error:', JSON.stringify(data));
            return res.status(502).json({ error: 'Erreur Google Places: ' + ((data.error && data.error.message) || r.status) });
        }

        var places = data.places || [];
        var prospects = loadProspects();
        var existingIds = {};
        prospects.forEach(function(p) { existingIds[p.place_id] = true; });
        var newCount = 0;

        places.forEach(function(pl) {
            if (existingIds[pl.id]) return;
            var photos = pl.photos ? pl.photos.length : 0;
            var website = pl.websiteUri || null;
            var reviews = pl.userRatingCount || 0;
            var rating = pl.rating || 0;

            var score = 0;
            if (photos === 0) score += 3;
            else if (photos <= 3) score += 2;
            else if (photos <= 8) score += 1;
            if (!website) score += 2;
            if (reviews < 10) score += 1;
            if (rating > 0 && rating < 3.5) score += 1;

            prospects.push({
                id: uuidv4(),
                place_id: pl.id,
                name: (pl.displayName && pl.displayName.text) || 'Inconnu',
                address: pl.formattedAddress || '',
                category: category,
                phone: pl.nationalPhoneNumber || null,
                website: website,
                photos_count: photos,
                rating: rating,
                reviews_count: reviews,
                score: score,
                status: 'new',
                notes: '',
                email: null,
                email_source: null,
                found_at: new Date().toISOString(),
                searched_zone: zone
            });
            newCount++;
        });

        saveProspects(prospects);
        res.json({ success: true, added: newCount, total_found: places.length });
    } catch (err) {
        console.error('[API] Erreur prospects/search:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PATCH /api/admin/prospects/:id
 * Met à jour le statut et/ou les notes d'un prospect.
 */
app.patch('/api/admin/prospects/:id', (req, res) => {
    try {
        var prospects = loadProspects();
        var idx = prospects.findIndex(function(p) { return p.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Prospect non trouvé' });
        var valid = ['new', 'to_contact', 'contacted', 'converted', 'dismissed'];
        if (req.body.status !== undefined) {
            if (!valid.includes(req.body.status)) return res.status(400).json({ error: 'Statut invalide' });
            prospects[idx].status = req.body.status;
        }
        if (req.body.notes !== undefined) {
            prospects[idx].notes = String(req.body.notes).slice(0, 2000);
        }
        saveProspects(prospects);
        res.json({ success: true, prospect: prospects[idx] });
    } catch (err) {
        console.error('[API] Erreur PATCH prospect:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/prospects/:id/find-email
 * Cherche un email publié sur le site web du prospect (uniquement mailto: et emails visibles).
 */
app.post('/api/admin/prospects/:id/find-email', async (req, res) => {
    try {
        var prospects = loadProspects();
        var idx = prospects.findIndex(function(p) { return p.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Prospect non trouvé' });
        var website = prospects[idx].website;
        if (!website) return res.status(400).json({ error: 'Ce prospect n\'a pas de site web' });
        if (!website.startsWith('http')) website = 'https://' + website;

        var result = await extractEmailFromWebsite(website);
        if (result) {
            prospects[idx].email = result.email;
            prospects[idx].email_source = result.source;
            saveProspects(prospects);
            res.json({ success: true, email: result.email, source: result.source });
        } else {
            res.json({ success: false, message: 'Aucun email publié trouvé sur ce site' });
        }
    } catch (err) {
        console.error('[API] Erreur find-email:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/prospects/:id/send-email
 * Envoie un email de prospection à l'entreprise via le service SMTP/Brevo existant.
 * Body: { subject, body }
 */
app.post('/api/admin/prospects/:id/send-email', async (req, res) => {
    try {
        var prospects = loadProspects();
        var idx = prospects.findIndex(function(p) { return p.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Prospect non trouvé' });
        var prospect = prospects[idx];
        if (!prospect.email) return res.status(400).json({ error: 'Aucun email renseigné pour ce prospect' });

        var subject = (req.body.subject || '').trim();
        var body    = (req.body.body    || '').trim();
        if (!subject) return res.status(400).json({ error: 'Objet requis' });
        if (!body)    return res.status(400).json({ error: 'Corps du message requis' });

        var result = await emailService.sendProspectContactEmail(prospect, subject, body);
        if (!result.success) {
            return res.status(500).json({ error: 'Erreur d\'envoi : ' + (result.error || result.reason || 'inconnu') });
        }

        // Passer automatiquement en statut "Contacté"
        if (prospects[idx].status === 'new' || prospects[idx].status === 'to_contact') {
            prospects[idx].status = 'contacted';
        }
        prospects[idx].last_contact_at = new Date().toISOString();
        saveProspects(prospects);
        res.json({ success: true });
    } catch (err) {
        console.error('[API] Erreur send-email prospect:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * DELETE /api/admin/prospects/:id
 * Supprime un prospect de la table.
 */
app.delete('/api/admin/prospects/:id', (req, res) => {
    try {
        var prospects = loadProspects();
        var idx = prospects.findIndex(function(p) { return p.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Prospect non trouvé' });
        prospects.splice(idx, 1);
        saveProspects(prospects);
        res.json({ success: true });
    } catch (err) {
        console.error('[API] Erreur DELETE prospect:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/admin/projects
 * Liste tous les projets (admin uniquement)
 */
app.get('/api/admin/projects', (req, res) => {
    try {
        var projects = loadProjects();
        res.json({ success: true, projects: projects });
    } catch (err) {
        console.error('[API] Erreur admin/projects:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/admin/projects/create-from-order
 * Creer un projet manuellement pour une commande existante
 */
app.post('/api/admin/projects/create-from-order', (req, res) => {
    try {
        var orderId = req.body.order_id;
        if (!orderId) return res.status(400).json({ error: 'order_id requis' });

        var order = getOrderById(orderId);
        if (!order) return res.status(404).json({ error: 'Commande non trouvee' });

        var users = loadUsers();
        var clientEmail = (order.client_info && order.client_info.email) || order.email || '';
        var user = users.find(function(u) { return u.email === clientEmail; }) || {
            email: clientEmail,
            firstName: order.client_info ? order.client_info.first_name : '',
            lastName: order.client_info ? order.client_info.last_name : ''
        };

        var result = bootstrapService.bootstrapProject(order, user);
        if (result.success) {
            res.json({ success: true, project: result.project, deliverables_count: result.deliverables.length });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (err) {
        console.error('[API] Erreur create-from-order:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/partner/deliverables
 * Livrables assignes au partenaire connecte
 */
app.get('/api/partner/deliverables', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var partnerAuth = findPartnerByToken(token);
        if (!partnerAuth) return res.status(401).json({ error: 'Session partenaire invalide ou expirée' });

        var partnerId = partnerAuth.id;
        var partnerEmail = partnerAuth.email;

        // Trouver les commandes assignees au partenaire
        var assignments = loadPartnerAssignments();
        var partnerOrderIds = [];
        for (var a = 0; a < assignments.length; a++) {
            if ((assignments[a].partner_id === partnerId || assignments[a].partner_email === partnerEmail) && assignments[a].status === 'active') {
                partnerOrderIds.push(assignments[a].order_id);
            }
        }

        // Charger les livrables de ces commandes
        var allLivrables = loadLivrables();
        var partnerLivrables = [];
        for (var l = 0; l < allLivrables.length; l++) {
            var liv = ensureLivrableFields(allLivrables[l]);
            // Livrables assignes au partenaire OU livrables des commandes assignees avec visibilite partenaire
            if (liv.owner_partner_id === partnerId ||
                (partnerOrderIds.indexOf(liv.order_id) !== -1 && (liv.visibility === 'PARTNER_ONLY' || liv.owner_role === 'partner' || liv.domain !== 'strategy'))) {
                partnerLivrables.push(liv);
            }
        }

        res.json({ success: true, deliverables: partnerLivrables });
    } catch (err) {
        console.error('[API] Erreur partner/deliverables:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/partner/deliverables/:id/upload
 * Partenaire uploade une nouvelle version d'un livrable
 */
app.post('/api/partner/deliverables/:id/upload', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var partnerAuth = findPartnerByToken(token);
        if (!partnerAuth) return res.status(401).json({ error: 'Session partenaire invalide ou expirée' });

        var fileUrl = req.body.file_url;
        var contentText = req.body.content_text;
        var changeNote = req.body.change_note || 'Nouvelle version';

        if (!fileUrl && !contentText) return res.status(400).json({ error: 'file_url ou content_text requis' });

        var livrables = loadLivrables();
        for (var i = 0; i < livrables.length; i++) {
            if (livrables[i].id === req.params.id) {
                var liv = livrables[i];

                // Verifier que le livrable n'est pas deja publie
                if (liv.workflow_status === 'PUBLISHED') {
                    return res.status(400).json({ error: 'Livrable deja publie, modification impossible' });
                }

                if (!liv.versions) liv.versions = [];
                var newVersion = {
                    version_number: liv.versions.length + 1,
                    updated_by_role: 'partner',
                    updated_by_id: partnerAuth.id,
                    content_text: contentText || null,
                    file_url: fileUrl || null,
                    change_note: changeNote,
                    created_at: new Date().toISOString()
                };
                liv.versions.push(newVersion);

                // Mettre a jour le livrable principal
                if (fileUrl) liv.download_url = fileUrl;
                if (contentText) liv.content_text = contentText;
                liv.workflow_status = 'PENDING_PARTNER';
                liv.owner_role = 'partner';
                liv.owner_partner_id = partnerAuth.id;
                liv.updated_at = new Date().toISOString();

                livrables[i] = liv;
                saveLivrables(livrables);
                return res.json({ success: true, livrable: ensureLivrableFields(liv), version: newVersion });
            }
        }
        return res.status(404).json({ error: 'Livrable non trouve' });
    } catch (err) {
        console.error('[API] Erreur partner upload:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PATCH /api/partner/deliverables/:id
 * Partenaire modifie titre/description d'un livrable
 */
app.patch('/api/partner/deliverables/:id', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var partnerAuth = findPartnerByToken(token);
        if (!partnerAuth) return res.status(401).json({ error: 'Session partenaire invalide ou expirée' });

        var livrables = loadLivrables();
        for (var i = 0; i < livrables.length; i++) {
            if (livrables[i].id === req.params.id) {
                // Verifier que le livrable n'est pas publie
                if (livrables[i].workflow_status === 'PUBLISHED') {
                    return res.status(400).json({ error: 'Livrable publie, modification impossible' });
                }

                if (req.body.name) livrables[i].name = req.body.name;
                if (req.body.description) livrables[i].description = req.body.description;
                livrables[i].updated_at = new Date().toISOString();

                saveLivrables(livrables);
                return res.json({ success: true, livrable: ensureLivrableFields(livrables[i]) });
            }
        }
        return res.status(404).json({ error: 'Livrable non trouve' });
    } catch (err) {
        console.error('[API] Erreur partner patch:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/partner/deliverables/:id/submit
 * Partenaire soumet un livrable pour validation admin
 */
app.post('/api/partner/deliverables/:id/submit', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var partnerAuth = findPartnerByToken(token);
        if (!partnerAuth) return res.status(401).json({ error: 'Session partenaire invalide ou expirée' });

        var livrables = loadLivrables();
        for (var i = 0; i < livrables.length; i++) {
            if (livrables[i].id === req.params.id) {
                livrables[i].workflow_status = 'PENDING_ADMIN';
                livrables[i].updated_at = new Date().toISOString();
                saveLivrables(livrables);
                return res.json({ success: true, livrable: ensureLivrableFields(livrables[i]) });
            }
        }
        return res.status(404).json({ error: 'Livrable non trouve' });
    } catch (err) {
        console.error('[API] Erreur partner submit:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/projects/:id/timeline
 * Timeline complete d'un projet avec livrables par etape
 */
app.get('/api/projects/:id/timeline', (req, res) => {
    try {
        var project = getProjectById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Projet non trouve' });

        // Verifier acces
        if (decoded.role !== 'admin' && decoded.email !== project.client_email) {
            return res.status(403).json({ error: 'Acces non autorise' });
        }

        // Charger le blueprint
        var blueprint = getOfferBlueprint(project.offer_key);
        var allLivrables = loadLivrables();

        // Construire la timeline avec livrables
        var timeline = [];
        var steps = blueprint ? blueprint.steps : [];
        for (var s = 0; s < steps.length; s++) {
            var step = steps[s];
            var progress = project.timeline_progress[s] || {};

            // Trouver les livrables de cette etape
            var stepLivrables = [];
            for (var l = 0; l < allLivrables.length; l++) {
                var liv = ensureLivrableFields(allLivrables[l]);
                if (liv.project_id === project.id && liv.step_order === step.order) {
                    // Pour les clients, ne montrer que les livrables publies
                    if (decoded.role === 'admin' || liv.workflow_status === 'PUBLISHED') {
                        stepLivrables.push(liv);
                    }
                }
            }

            timeline.push({
                step: step,
                status: progress.status || 'pending',
                completed_at: progress.completed_at || null,
                deliverables: stepLivrables
            });
        }

        res.json({ success: true, project: project, timeline: timeline });
    } catch (err) {
        console.error('[API] Erreur timeline:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/projects/:id/deliverables
 * Livrables d'un projet filtres par role
 */
app.get('/api/projects/:id/deliverables', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);

        var project = getProjectById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Projet non trouve' });

        var role = req.query.role || decoded.role;
        var allLivrables = loadLivrables();
        var filtered = [];

        for (var i = 0; i < allLivrables.length; i++) {
            var liv = ensureLivrableFields(allLivrables[i]);
            if (liv.project_id !== project.id) continue;

            if (role === 'admin') {
                filtered.push(liv);
            } else if (role === 'client') {
                if (liv.workflow_status === 'PUBLISHED' && liv.visibility === 'CLIENT_ON_PUBLISH') {
                    filtered.push(liv);
                }
            } else if (role === 'partner') {
                if (liv.visibility === 'PARTNER_ONLY' || liv.owner_role === 'partner') {
                    filtered.push(liv);
                }
            }
        }

        res.json({ success: true, deliverables: filtered });
    } catch (err) {
        console.error('[API] Erreur project deliverables:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/projects/by-order/:orderId
 * Trouver un projet par commande
 */
app.get('/api/projects/by-order/:orderId', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);

        var project = getProjectByOrderId(req.params.orderId);
        if (!project) return res.status(404).json({ error: 'Projet non trouve pour cette commande' });

        // Verifier acces
        if (decoded.role !== 'admin' && decoded.email !== project.client_email) {
            return res.status(403).json({ error: 'Acces non autorise' });
        }

        res.json({ success: true, project: project });
    } catch (err) {
        console.error('[API] Erreur project by order:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/admin/deliverables/pending
 * Livrables en attente de validation admin
 */
app.get('/api/admin/deliverables/pending', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, _JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acces admin requis' });

        var allLivrables = loadLivrables();
        var pending = [];
        for (var i = 0; i < allLivrables.length; i++) {
            var liv = ensureLivrableFields(allLivrables[i]);
            if (liv.workflow_status === 'PENDING_ADMIN' || liv.workflow_status === 'DRAFT_AI') {
                pending.push(liv);
            }
        }

        res.json({ success: true, deliverables: pending, count: pending.length });
    } catch (err) {
        console.error('[API] Erreur admin pending:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/ai/status
 * Statut du service IA
 */
app.get('/api/ai/status', (req, res) => {
    try {
        var status = aiService.getServiceStatus();
        res.json({ success: true, status: status });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// ROUTES - FEEDBACKS (CLIENTS + ADMIN)
// ============================================================

/**
 * POST /api/feedbacks
 * Client authentifié soumet un feedback.
 */
app.post('/api/feedbacks', function(req, res) {
    try {
        var authHeader = req.headers.authorization || '';
        var token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
        if (!token) return res.status(401).json({ ok: false, error: 'Token manquant' });

        var users = loadUsers();
        var user = findUserByToken(token);
        if (!user) return res.status(401).json({ ok: false, error: 'Session invalide' });

        var body = req.body || {};
        var rating = parseInt(body.rating) || 0;
        var category = (body.category || '').trim();
        var feedbackText = (body.feedbackText || '').trim();
        var suggestionText = (body.suggestionText || '').trim();
        var consentTestimonial = body.consentTestimonial === true || body.consentTestimonial === 'true';

        if (!feedbackText) return res.status(400).json({ ok: false, error: 'Le retour d\'expérience est obligatoire.' });
        if (!rating || rating < 1 || rating > 5) return res.status(400).json({ ok: false, error: 'La note doit être entre 1 et 5.' });
        if (!category) return res.status(400).json({ ok: false, error: 'Veuillez sélectionner une catégorie.' });

        // Retrouver l'offre active du client
        var orders = loadOrders();
        var activeOrder = null;
        for (var i = 0; i < orders.length; i++) {
            var o = orders[i];
            if (o.client_info && o.client_info.email && o.client_info.email.toLowerCase() === user.email.toLowerCase() && o.deposit_paid) {
                activeOrder = o;
                break;
            }
        }

        var feedback = {
            id: 'fb-' + uuidv4().split('-')[0] + '-' + Date.now(),
            userId: user.id || user.email,
            userEmail: user.email,
            userName: ((user.prenom || '') + ' ' + (user.nom || '')).trim() || user.email,
            offerType: activeOrder ? (activeOrder.product_type || 'accompagnement') : 'inconnu',
            offerName: activeOrder ? (activeOrder.product_name || 'N/A') : 'N/A',
            rating: rating,
            category: category,
            feedbackText: feedbackText,
            suggestionText: suggestionText,
            consentTestimonial: consentTestimonial,
            status: 'new',
            createdAt: new Date().toISOString()
        };

        var feedbacks = loadFeedbacks();
        feedbacks.unshift(feedback);
        saveFeedbacks(feedbacks);

        console.log('[FEEDBACKS] Nouveau feedback:', feedback.id, '- Note:', rating, '- Categorie:', category);

        // Email si urgent (note ≤ 2 ou catégorie Site/Bug)
        if (rating <= 2 || category === 'Site/Bug') {
            emailService.sendUrgentFeedbackNotification(feedback).catch(function(e) {
                console.error('[FEEDBACKS] Erreur email urgent:', e.message);
            });
        }

        res.json({ ok: true, message: 'Merci, votre retour a bien été enregistré !' });
    } catch (err) {
        console.error('[FEEDBACKS] Erreur POST:', err);
        res.status(500).json({ ok: false, error: 'Erreur serveur' });
    }
});

/**
 * GET /api/admin/feedbacks
 * Admin récupère tous les feedbacks avec filtres optionnels.
 * Query params : ?category=...&status=...&search=...&sort=date|rating
 */
app.get('/api/admin/feedbacks', function(req, res) {
    try {
        var feedbacks = loadFeedbacks();

        var filterCategory = (req.query.category || '').trim();
        var filterStatus = (req.query.status || '').trim();
        var filterSearch = (req.query.search || '').toLowerCase().trim();
        var sortBy = (req.query.sort || 'date');

        // Filtrer
        if (filterCategory) {
            feedbacks = feedbacks.filter(function(f) { return f.category === filterCategory; });
        }
        if (filterStatus) {
            feedbacks = feedbacks.filter(function(f) { return f.status === filterStatus; });
        }
        if (filterSearch) {
            feedbacks = feedbacks.filter(function(f) {
                return (f.userName || '').toLowerCase().indexOf(filterSearch) !== -1
                    || (f.userEmail || '').toLowerCase().indexOf(filterSearch) !== -1
                    || (f.feedbackText || '').toLowerCase().indexOf(filterSearch) !== -1
                    || (f.offerName || '').toLowerCase().indexOf(filterSearch) !== -1;
            });
        }

        // Trier
        if (sortBy === 'rating_asc') feedbacks.sort(function(a, b) { return (a.rating || 0) - (b.rating || 0); });
        else if (sortBy === 'rating_desc') feedbacks.sort(function(a, b) { return (b.rating || 0) - (a.rating || 0); });
        else feedbacks.sort(function(a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });

        var newCount = loadFeedbacks().filter(function(f) { return f.status === 'new'; }).length;

        res.json({ ok: true, feedbacks: feedbacks, total: feedbacks.length, new_count: newCount });
    } catch (err) {
        console.error('[FEEDBACKS] Erreur GET admin:', err);
        res.status(500).json({ ok: false, error: 'Erreur serveur' });
    }
});

/**
 * PATCH /api/admin/feedbacks/:id/status
 * Admin met à jour le statut d'un feedback.
 */
app.patch('/api/admin/feedbacks/:id/status', function(req, res) {
    try {
        var fbId = req.params.id;
        var newStatus = (req.body && req.body.status) || '';
        var validStatuses = ['new', 'in_progress', 'resolved'];
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({ ok: false, error: 'Statut invalide' });
        }

        var feedbacks = loadFeedbacks();
        var fb = feedbacks.find(function(f) { return f.id === fbId; });
        if (!fb) return res.status(404).json({ ok: false, error: 'Feedback introuvable' });

        fb.status = newStatus;
        fb.updatedAt = new Date().toISOString();
        saveFeedbacks(feedbacks);

        res.json({ ok: true, feedback: fb });
    } catch (err) {
        console.error('[FEEDBACKS] Erreur PATCH status:', err);
        res.status(500).json({ ok: false, error: 'Erreur serveur' });
    }
});

/**
 * GET /api/admin/feedbacks/unread-count
 * Badge : nombre de feedbacks "new" pour l'admin.
 */
app.get('/api/admin/feedbacks/unread-count', function(req, res) {
    try {
        var feedbacks = loadFeedbacks();
        var count = feedbacks.filter(function(f) { return f.status === 'new'; }).length;
        res.json({ ok: true, count: count });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'Erreur serveur' });
    }
});

// ============================================================
// DISPONIBILITES COWORKING
// ============================================================

/**
 * GET /api/coworking/availability?category=openspace|bureau|all
 * Retourne les dates réservées (confirmées) + bloquées par le partenaire.
 * Endpoint public — pas d'auth requise (les dates sont anonymes).
 */
app.get('/api/coworking/availability', function(req, res) {
    try {
        var category = req.query.category || 'all';

        // Réservations confirmées → slots avec horaires
        var reservations = loadReservations();
        var bookedSet = {};
        var bookedSlots = [];
        reservations.forEach(function(r) {
            if (r.status !== 'confirmed') return;
            var rCat = r.product_id && r.product_id.indexOf('openspace') > -1 ? 'openspace'
                     : r.product_id && r.product_id.indexOf('bureau') > -1 ? 'bureau'
                     : 'evenement';
            if (category !== 'all' && rCat !== category) return;
            if (r.dates && r.dates.length > 0) {
                r.dates.forEach(function(d) {
                    bookedSet[d] = true;
                    bookedSlots.push({
                        date: d,
                        time_start: r.time_start || '06:00',
                        time_end: r.time_end || '23:00'
                    });
                });
            }
        });

        // Dates bloquées manuellement par le partenaire → slots avec horaires
        var allBlocked = loadBlockedDates();
        var blockedForCat = allBlocked.filter(function(b) {
            return b.category === 'all' || b.category === category || category === 'all';
        });
        var blockedSlots = blockedForCat.map(function(b) {
            return {
                date: b.date,
                time_start: b.time_start || '06:00',
                time_end: b.time_end || '23:00',
                reason: b.reason || ''
            };
        });

        res.json({
            booked_dates: Object.keys(bookedSet),
            blocked_dates: blockedForCat.map(function(b) { return b.date; }),
            blocked_details: blockedForCat,
            booked_slots: bookedSlots,
            blocked_slots: blockedSlots
        });
    } catch(e) {
        console.error('[COWORKING] availability error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/coworking/blocked-dates
 * Partenaire bloque ou débloque une date pour un type d'espace.
 * Body: { date: 'YYYY-MM-DD', category: 'openspace'|'bureau'|'all', action: 'block'|'unblock', reason: '...' }
 */
app.post('/api/coworking/blocked-dates', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var partnerToken = process.env.PARTNER_TOKEN || 'fa-genesis-partner-2024';
        var isAdmin = isValidAdminKey(req);
        if (token !== partnerToken && !isAdmin) {
            return res.status(403).json({ error: 'Non autorisé' });
        }

        var date = req.body.date;
        var category = req.body.category || 'all';
        var action = req.body.action; // 'block' ou 'unblock'
        var reason = req.body.reason || '';
        var time_start = req.body.time_start || '06:00';
        var time_end = req.body.time_end || '23:00';

        if (!date || !action) {
            return res.status(400).json({ error: 'date et action requis' });
        }

        var blocked = loadBlockedDates();

        if (action === 'block') {
            // Permettre plusieurs créneaux par jour — vérifier l'exact doublon (date+heure+catégorie)
            var exists = blocked.some(function(b) {
                return b.date === date && b.category === category
                    && (b.time_start || '06:00') === time_start
                    && (b.time_end || '23:00') === time_end;
            });
            if (!exists) {
                blocked.push({ date: date, category: category, reason: reason,
                               time_start: time_start, time_end: time_end,
                               created_at: new Date().toISOString() });
            }
        } else if (action === 'unblock') {
            blocked = blocked.filter(function(b) {
                return !(b.date === date && b.category === category
                      && (b.time_start || '06:00') === time_start
                      && (b.time_end || '23:00') === time_end);
            });
        }

        saveBlockedDates(blocked);
        console.log('[COWORKING] Date ' + action + 'ed: ' + date + ' ' + time_start + '-' + time_end + ' (' + category + ')');
        res.json({ ok: true, blocked_dates: blocked });
    } catch(e) {
        console.error('[COWORKING] blocked-dates error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// RESERVATIONS COWORKING
// ============================================================

/**
 * POST /api/reservations
 * Créer une réservation coworking (depuis le formulaire de réservation client).
 */
app.post('/api/reservations', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;
        var body = req.body || {};
        if (!body.dates || !body.dates.length) {
            return res.status(400).json({ error: 'Au moins une date est requise' });
        }
        var reservations = loadReservations();
        var newResa = {
            id: 'RSV-' + require('crypto').randomBytes(4).toString('hex').toUpperCase(),
            client_email: user.email,
            client_name: (user.prenom || '') + ' ' + (user.nom || ''),
            product_id: body.product_id || 'coworking',
            product_name: body.product_name || 'Coworking',
            dates: body.dates,
            quantity: body.quantity || 1,
            notes: body.notes || '',
            prix: body.prix || null,
            status: 'pending',
            created_at: new Date().toISOString()
        };
        reservations.push(newResa);
        saveReservations(reservations);
        notifyUser(user.email, 'client', 'reservation_created', 'Réservation envoyée',
            'Votre demande de réservation pour ' + newResa.product_name + ' a bien été reçue.', '/app.html');
        res.json({ success: true, id: newResa.id, reservation: newResa });
    } catch(e) {
        console.error('[RESERVATIONS POST]', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/reservations/me
 * Réservations coworking du client connecté (par email)
 */
app.get('/api/reservations/me', function(req, res) {
    try {
        var user = authenticateClient(req, res);
        if (!user) return;
        var reservations = loadReservations();
        var myRes = reservations.filter(function(r) { return r.client_email && r.client_email.toLowerCase() === user.email.toLowerCase(); });
        // Inclure les commandes coworking comme conversations virtuelles
        var orders = loadOrders();
        orders.forEach(function(o) {
            if ((o.product_type === 'coworking' || o.product_type === 'coworking_devis') &&
                o.client_info && o.client_info.email && o.client_info.email.toLowerCase() === user.email.toLowerCase()) {
                var alreadyLinked = myRes.some(function(r) { return r.order_id === o.id; });
                if (!alreadyLinked) {
                    myRes.push({
                        id: o.id,
                        order_id: o.id,
                        client_email: o.client_info.email,
                        client_name: (o.client_info.first_name || '') + ' ' + (o.client_info.last_name || ''),
                        product_id: o.product_id || 'coworking',
                        product_name: o.product_name || 'Coworking',
                        status: o.status || 'active',
                        created_at: o.created_at,
                        is_order: true
                    });
                }
            }
        });
        myRes.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        res.json(myRes);
    } catch (e) {
        console.error('[RESERVATIONS] Erreur /me:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/reservations/all
 * Toutes les réservations (admin / partenaire)
 */
app.get('/api/reservations/all', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        // Accès simple par token partenaire ou admin
        var partnerToken = process.env.PARTNER_TOKEN || 'fa-genesis-partner-2024';
        var adminToken = process.env.ADMIN_TOKEN || null;
        var isAdmin = isValidAdminKey(req);
        var isPartner = token === partnerToken;
        if (!isAdmin && !isPartner) {
            var user = authenticateClient(req, res);
            if (!user || user.role !== 'admin') return;
        }
        var reservations = loadReservations();
        // Inclure les commandes coworking comme réservations virtuelles
        var orders = loadOrders();
        orders.forEach(function(o) {
            if ((o.product_type === 'coworking' || o.product_type === 'coworking_devis') &&
                o.client_info && o.client_info.email) {
                var alreadyLinked = reservations.some(function(r) { return r.order_id === o.id; });
                if (!alreadyLinked) {
                    reservations.push({
                        id: o.id, order_id: o.id,
                        client_email: o.client_info.email,
                        client_name: (o.client_info.first_name || '') + ' ' + (o.client_info.last_name || ''),
                        product_id: o.product_id || 'coworking',
                        product_name: o.product_name || 'Coworking',
                        status: o.status || 'active',
                        created_at: o.created_at, is_order: true
                    });
                }
            }
        });
        res.json(reservations);
    } catch (e) {
        console.error('[RESERVATIONS] Erreur /all:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PUT /api/reservations/:id/status
 * Partenaire accepte ou refuse une réservation
 * Body: { status: 'confirmed' | 'refused', partner_note: '...' }
 */
app.put('/api/reservations/:id/status', function(req, res) {
    try {
        var partnerToken = process.env.PARTNER_TOKEN || 'fa-genesis-partner-2024';
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var isAdmin = isValidAdminKey(req);
        if (token !== partnerToken && !isAdmin) {
            return res.status(403).json({ error: 'Non autorisé' });
        }

        var resId = req.params.id;
        var newStatus = req.body.status;
        var partnerNote = req.body.partner_note || '';

        if (!['confirmed', 'refused', 'pending'].includes(newStatus)) {
            return res.status(400).json({ error: 'Status invalide' });
        }

        var reservations = loadReservations();
        var idx = reservations.findIndex(function(r) { return r.id === resId; });
        if (idx === -1) return res.status(404).json({ error: 'Réservation non trouvée' });

        reservations[idx].status = newStatus;
        reservations[idx].partner_note = partnerNote;
        reservations[idx].updated_at = new Date().toISOString();
        saveReservations(reservations);

        console.log('[RESERVATIONS] ' + resId + ' -> ' + newStatus);
        // Push client : confirmation/refus réservation
        var clientEmailRes = reservations[idx].client_email;
        if (clientEmailRes) {
            var labelRes = newStatus === 'confirmed' ? 'confirmée ✅' : 'refusée ❌';
            sendPushToUser(clientEmailRes, { title: 'Réservation ' + labelRes, body: (reservations[idx].product_name || 'Coworking') + ' — ' + labelRes, icon: '/assets/images/logo-favicon-192.png', badge: '/assets/images/logo-favicon-32.png', url: '/app.html', tag: 'reservation' });
        }
        res.json({ ok: true, reservation: reservations[idx] });
    } catch (e) {
        console.error('[RESERVATIONS] Erreur PUT status:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/reservations/:id/email-respond
 * Partenaire confirme ou refuse depuis un lien email (tokenisé)
 * ?action=confirmed|refused&token=XXX
 */
app.get('/api/reservations/:id/email-respond', function(req, res) {
    try {
        var resId = req.params.id;
        var action = req.query.action;
        var token = req.query.token;

        if (!['confirmed', 'refused'].includes(action)) {
            return res.status(400).send('<html><body style="font-family:Arial;text-align:center;padding:40px;"><h2>Action invalide.</h2></body></html>');
        }

        var reservations = loadReservations();
        var idx = reservations.findIndex(function(r) { return r.id === resId; });
        if (idx === -1) {
            return res.status(404).send('<html><body style="font-family:Arial;text-align:center;padding:40px;"><h2>Réservation introuvable.</h2></body></html>');
        }

        if (reservations[idx].email_token !== token) {
            return res.status(403).send('<html><body style="font-family:Arial;text-align:center;padding:40px;"><h2>Lien invalide ou expiré.</h2></body></html>');
        }

        reservations[idx].status = action;
        reservations[idx].updated_at = new Date().toISOString();
        saveReservations(reservations);

        var r = reservations[idx];
        var label = action === 'confirmed' ? 'CONFIRMÉE' : 'REFUSÉE';
        var color = action === 'confirmed' ? '#4CAF50' : '#f44336';
        var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Réservation ' + label + '</title></head>'
            + '<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:40px;">'
            + '<div style="max-width:500px;margin:0 auto;background:#fff;border:4px solid #000;padding:40px;text-align:center;">'
            + '<h1 style="color:#FFD700;background:#000;margin:-40px -40px 30px -40px;padding:20px;font-size:24px;letter-spacing:2px;">FA GENESIS</h1>'
            + '<h2 style="color:' + color + ';font-size:22px;text-transform:uppercase;">Réservation ' + label + '</h2>'
            + '<p style="font-weight:700;color:#000;">' + (r.product_name || '') + '</p>'
            + '<p style="color:#333;font-weight:700;">Client : ' + (r.client_name || '') + '</p>'
            + '<p style="margin-top:30px;"><a href="https://fagenesis.com/coworking-partner.html" style="background:#000;color:#FFD700;padding:14px 28px;text-decoration:none;font-weight:900;text-transform:uppercase;letter-spacing:1px;">Gérer l\'espace coworking</a></p>'
            + '</div></body></html>';

        console.log('[RESERVATIONS] Email-respond: ' + resId + ' -> ' + action);
        res.send(html);
    } catch (e) {
        console.error('[RESERVATIONS] Erreur email-respond:', e);
        res.status(500).send('<html><body style="font-family:Arial;text-align:center;padding:40px;"><h2>Erreur serveur.</h2></body></html>');
    }
});

// ============================================================
// MESSAGERIE COWORKING
// ============================================================

function loadCwMessages() {
    try {
        if (fs.existsSync(CW_MESSAGES_FILE)) return JSON.parse(fs.readFileSync(CW_MESSAGES_FILE, 'utf8'));
    } catch(e) { console.error('[MSG] Lecture:', e); }
    return [];
}
function saveCwMessages(msgs) {
    try { fs.writeFileSync(CW_MESSAGES_FILE, JSON.stringify(msgs, null, 2), 'utf8'); }
    catch(e) { console.error('[MSG] Sauvegarde:', e); }
}

// GET /api/coworking/messages?reservation_id=X
app.get('/api/coworking/messages', function(req, res) {
    try {
        var reservationId = req.query.reservation_id;
        if (!reservationId) return res.status(400).json({ error: 'reservation_id requis' });
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var partnerToken = process.env.PARTNER_TOKEN || 'fa-genesis-partner-2024';
        var isPartner = token === partnerToken;
        if (!isPartner) {
            var users = loadUsers();
            var cu = findUserByToken(token);
            if (!cu) return res.status(401).json({ error: 'Non autorise' });
            var myRes = loadReservations().find(function(r) { return r.id === reservationId && r.client_email && r.client_email.toLowerCase() === cu.email.toLowerCase(); });
            if (!myRes) {
                // Vérifier si c'est un order coworking (conversation virtuelle)
                var cwOrder = loadOrders().find(function(o) {
                    return o.id === reservationId &&
                        (o.product_type === 'coworking' || o.product_type === 'coworking_devis') &&
                        o.client_info && o.client_info.email && o.client_info.email.toLowerCase() === cu.email.toLowerCase();
                });
                if (!cwOrder) return res.status(403).json({ error: 'Reservation introuvable' });
            }
        }
        var all = loadCwMessages();
        var msgs = all.filter(function(m) { return m.reservation_id === reservationId; });
        var changed = false;
        all.forEach(function(m) {
            if (m.reservation_id !== reservationId) return;
            if (isPartner && !m.read_by_partner) { m.read_by_partner = true; changed = true; }
            if (!isPartner && !m.read_by_client) { m.read_by_client = true; changed = true; }
        });
        if (changed) saveCwMessages(all);
        msgs.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        res.json(msgs);
    } catch(e) { console.error('[MSG] GET:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// POST /api/coworking/messages — { reservation_id, content }
app.post('/api/coworking/messages', function(req, res) {
    try {
        var reservationId = req.body.reservation_id;
        var content = (req.body.content || '').trim();
        if (!reservationId || !content) return res.status(400).json({ error: 'Champs manquants' });
        if (content.length > 2000) return res.status(400).json({ error: 'Message trop long' });
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var partnerToken = process.env.PARTNER_TOKEN || 'fa-genesis-partner-2024';
        var isPartner = token === partnerToken;
        var senderName = 'COM VISA', senderType = 'partner';
        if (!isPartner) {
            var users = loadUsers();
            var cu = findUserByToken(token);
            if (!cu) return res.status(401).json({ error: 'Non autorise' });
            var reservation = loadReservations().find(function(r) { return r.id === reservationId && r.client_email && r.client_email.toLowerCase() === cu.email.toLowerCase(); });
            if (!reservation) {
                // Accepter aussi les orders coworking comme conversations
                var cwOrder = loadOrders().find(function(o) {
                    return o.id === reservationId &&
                        (o.product_type === 'coworking' || o.product_type === 'coworking_devis') &&
                        o.client_info && o.client_info.email && o.client_info.email.toLowerCase() === cu.email.toLowerCase();
                });
                if (!cwOrder) return res.status(403).json({ error: 'Reservation introuvable' });
            }
            senderName = ((cu.firstName || cu.first_name || '') + ' ' + (cu.lastName || cu.last_name || '')).trim() || cu.email;
            senderType = 'client';
        }
        var msg = {
            id: uuidv4(),
            reservation_id: reservationId,
            sender_type: senderType,
            sender_name: senderName,
            content: content,
            created_at: new Date().toISOString(),
            read_by_partner: isPartner,
            read_by_client: !isPartner
        };
        var all = loadCwMessages();
        all.push(msg);
        saveCwMessages(all);
        // Push au destinataire
        if (isPartner) {
            sendPushToRole('partner', { title: 'Nouveau message client', body: (senderName || 'Client') + ' : ' + content.substring(0, 80), icon: '/assets/images/logo-favicon-192.png', badge: '/assets/images/logo-favicon-32.png', url: '/app.html#open-partner', tag: 'message-cw' });
        } else {
            // Trouver l'email du client pour lui envoyer le push si le partenaire répond
            var resForPush = loadReservations().find(function(r) { return r.id === reservationId; });
            if (!resForPush) {
                var orderForPush = loadOrders().find(function(o) { return o.id === reservationId; });
                if (orderForPush && orderForPush.client_info) resForPush = { client_email: orderForPush.client_info.email };
            }
            if (resForPush && resForPush.client_email) {
                sendPushToUser(resForPush.client_email, { title: 'Nouveau message', body: 'COM VISA : ' + content.substring(0, 80), icon: '/assets/images/logo-favicon-192.png', badge: '/assets/images/logo-favicon-32.png', url: '/app.html', tag: 'message-cw' });
            }
        }
        res.json({ ok: true, message: msg });
    } catch(e) { console.error('[MSG] POST:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// GET /api/coworking/messages/unread — stats non lus
app.get('/api/coworking/messages/unread', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var partnerToken = process.env.PARTNER_TOKEN || 'fa-genesis-partner-2024';
        var isPartner = token === partnerToken;
        var all = loadCwMessages();
        if (isPartner) {
            var byRes = {};
            all.forEach(function(m) {
                if (m.sender_type === 'client' && !m.read_by_partner)
                    byRes[m.reservation_id] = (byRes[m.reservation_id] || 0) + 1;
            });
            return res.json(byRes);
        }
        var users = loadUsers();
        var cu = findUserByToken(token);
        if (!cu) return res.status(401).json({ error: 'Non autorise' });
        var myIds = loadReservations().filter(function(r) { return r.client_email && r.client_email.toLowerCase() === cu.email.toLowerCase(); }).map(function(r) { return r.id; });
        // Inclure aussi les orders coworking
        loadOrders().forEach(function(o) {
            if ((o.product_type === 'coworking' || o.product_type === 'coworking_devis') &&
                o.client_info && o.client_info.email && o.client_info.email.toLowerCase() === cu.email.toLowerCase()) {
                if (myIds.indexOf(o.id) === -1) myIds.push(o.id);
            }
        });
        var count = all.filter(function(m) { return myIds.indexOf(m.reservation_id) !== -1 && m.sender_type === 'partner' && !m.read_by_client; }).length;
        res.json({ unread: count });
    } catch(e) { console.error('[MSG] UNREAD:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// ============================================================
// DEVIS COWORKING (Restauration & Boisson / Prestation DJ)
// ============================================================

function loadCwDevis() {
    try {
        if (fs.existsSync(CW_DEVIS_FILE)) return JSON.parse(fs.readFileSync(CW_DEVIS_FILE, 'utf8'));
    } catch(e) { console.error('[DEVIS] Lecture:', e); }
    return [];
}
function saveCwDevis(devis) {
    try { fs.writeFileSync(CW_DEVIS_FILE, JSON.stringify(devis, null, 2), 'utf8'); }
    catch(e) { console.error('[DEVIS] Sauvegarde:', e); }
}

var DEVIS_SERVICE_LABELS = {
    'restauration-boisson': 'Restauration & Boisson',
    'prestation-dj': 'Prestation DJ'
};

// POST /api/coworking/auth/login — connexion partenaire coworking (email + mot de passe)
app.post('/api/coworking/auth/login', function(req, res) {
    try {
        var email = (req.body.email || '').trim().toLowerCase();
        var password = (req.body.password || '').trim();
        var validEmail = (process.env.CW_PARTNER_EMAIL || '').toLowerCase();
        var validPassword = process.env.CW_PARTNER_PASSWORD || '';
        if (!email || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
        if (email !== validEmail || password !== validPassword) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }
        var token = process.env.PARTNER_TOKEN || 'fa-genesis-partner-2024';
        res.json({ success: true, token: token });
    } catch(e) {
        console.error('[CW AUTH] Erreur login:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/coworking/devis — client soumet une demande (sans auth)
app.post('/api/coworking/devis', function(req, res) {
    try {
        var service = req.body.service;
        var clientName = (req.body.client_name || '').trim();
        var clientEmail = (req.body.client_email || '').trim().toLowerCase();
        var clientPhone = (req.body.client_phone || '').trim();
        var eventDate = req.body.event_date || '';
        var eventDetails = (req.body.event_details || '').trim();
        var guestCount = req.body.guest_count || '';
        if (!clientName || !clientEmail || !service) return res.status(400).json({ error: 'Champs obligatoires manquants' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) return res.status(400).json({ error: 'Email invalide' });
        var item = {
            id: uuidv4(),
            service: service,
            service_label: DEVIS_SERVICE_LABELS[service] || service,
            client_name: clientName,
            client_email: clientEmail,
            client_phone: clientPhone,
            event_date: eventDate,
            event_details: eventDetails,
            guest_count: guestCount,
            status: 'pending',
            created_at: new Date().toISOString(),
            quote: null,
            client_response: null
        };
        var all = loadCwDevis();
        all.push(item);
        saveCwDevis(all);
        console.log('[DEVIS] Nouvelle demande:', clientEmail, service);
        res.json({ ok: true, id: item.id });
    } catch(e) { console.error('[DEVIS] POST:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// GET /api/coworking/devis — partenaire récupère tout
app.get('/api/coworking/devis', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var partnerToken = process.env.PARTNER_TOKEN || 'fa-genesis-partner-2024';
        if (token !== partnerToken) return res.status(403).json({ error: 'Non autorisé' });
        var all = loadCwDevis();
        all.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        res.json(all);
    } catch(e) { console.error('[DEVIS] GET all:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// GET /api/coworking/devis/me — client voit ses devis (JWT)
app.get('/api/coworking/devis/me', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var users = loadUsers();
        var cu = findUserByToken(token);
        if (!cu) return res.status(401).json({ error: 'Non autorisé' });
        var all = loadCwDevis().filter(function(d) { return d.client_email && d.client_email.toLowerCase() === cu.email.toLowerCase(); });
        all.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        res.json(all);
    } catch(e) { console.error('[DEVIS] GET me:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// PUT /api/coworking/devis/:id/quote — partenaire envoie le devis élaboré
app.put('/api/coworking/devis/:id/quote', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var partnerToken = process.env.PARTNER_TOKEN || 'fa-genesis-partner-2024';
        if (token !== partnerToken) return res.status(403).json({ error: 'Non autorisé' });
        var amount = parseFloat(req.body.amount);
        var description = (req.body.description || '').trim();
        var installmentsOptions = req.body.installments_options || [1];
        var validUntil = req.body.valid_until || '';
        if (!amount || amount <= 0 || !description) return res.status(400).json({ error: 'Champs obligatoires manquants' });
        var all = loadCwDevis();
        var idx = all.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Devis non trouvé' });
        all[idx].quote = { description: description, amount: amount, installments_options: installmentsOptions, valid_until: validUntil, sent_at: new Date().toISOString() };
        all[idx].status = 'quoted';
        all[idx].email_token = uuidv4();
        all[idx].updated_at = new Date().toISOString();
        saveCwDevis(all);
        var devisToSend = all[idx];
        emailService.sendCwDevisToClient(devisToSend).catch(function(e) { console.error('[DEVIS] Email error:', e); });
        res.json({ ok: true, devis: all[idx] });
    } catch(e) { console.error('[DEVIS] PUT quote:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// GET /api/coworking/devis/:id/email-respond — accepter ou décliner depuis email (tokenisé)
app.get('/api/coworking/devis/:id/email-respond', function(req, res) {
    var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';
    try {
        var emailToken = req.query.token;
        var action = req.query.action;
        if (!emailToken || (action !== 'accept' && action !== 'decline')) {
            return res.redirect(frontUrl + '/devis-response.html?error=invalid');
        }
        var all = loadCwDevis();
        var idx = all.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.redirect(frontUrl + '/devis-response.html?error=notfound');
        var devis = all[idx];
        if (devis.email_token !== emailToken) return res.redirect(frontUrl + '/devis-response.html?error=invalid');
        if (devis.status !== 'quoted') {
            // Si déjà accepté, laisser l'utilisateur aller payer
            if (action === 'accept' && devis.status === 'accepted') {
                return res.redirect(frontUrl + '/login.html?cw_devis_id=' + devis.id);
            }
            return res.redirect(frontUrl + '/devis-response.html?error=expired&action=' + action + '&service=' + encodeURIComponent(devis.service_label || ''));
        }
        var accepted = action === 'accept';
        all[idx].client_response = { accepted: accepted, installments_choice: null, responded_at: new Date().toISOString(), via_email: true };
        all[idx].status = accepted ? 'accepted' : 'declined';
        all[idx].updated_at = new Date().toISOString();
        saveCwDevis(all);
        console.log('[DEVIS] email-respond:', action, devis.client_email);
        if (accepted) {
            res.redirect(frontUrl + '/login.html?cw_devis_id=' + devis.id);
        } else {
            res.redirect(frontUrl + '/devis-response.html?action=declined&service=' + encodeURIComponent(devis.service_label || ''));
        }
    } catch(e) {
        console.error('[DEVIS] email-respond:', e);
        var frontUrlErr = process.env.FRONT_URL || 'https://fagenesis.com';
        res.redirect(frontUrlErr + '/devis-response.html?error=server');
    }
});

// GET /api/coworking/devis/:id/summary — résumé public pour checkout post-email
app.get('/api/coworking/devis/:id/summary', function(req, res) {
    try {
        var all = loadCwDevis();
        var devis = all.find(function(d) { return d.id === req.params.id; });
        if (!devis || !devis.quote) return res.status(404).json({ error: 'Devis non trouvé' });
        res.json({
            id: devis.id,
            service_label: devis.service_label,
            amount: devis.quote.amount,
            installments_options: devis.quote.installments_options || [1],
            valid_until: devis.quote.valid_until,
            status: devis.status,
            client_name: devis.client_name
        });
    } catch(e) { console.error('[DEVIS] GET summary:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// PUT /api/coworking/devis/:id/respond — client accepte ou décline (JWT)
app.put('/api/coworking/devis/:id/respond', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var users = loadUsers();
        var cu = findUserByToken(token);
        if (!cu) return res.status(401).json({ error: 'Non autorisé' });
        var accepted = req.body.accepted === true || req.body.accepted === 'true';
        var installmentsChoice = parseInt(req.body.installments_choice) || 1;
        var all = loadCwDevis();
        var idx = all.findIndex(function(d) { return d.id === req.params.id && d.client_email === cu.email; });
        if (idx === -1) return res.status(404).json({ error: 'Devis non trouvé' });
        if (all[idx].status !== 'quoted') return res.status(400).json({ error: 'Devis non répondable' });
        all[idx].client_response = { accepted: accepted, installments_choice: accepted ? installmentsChoice : null, responded_at: new Date().toISOString() };
        all[idx].status = accepted ? 'accepted' : 'declined';
        all[idx].updated_at = new Date().toISOString();
        saveCwDevis(all);
        res.json({ ok: true, devis: all[idx] });
    } catch(e) { console.error('[DEVIS] PUT respond:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// PUT /api/coworking/devis/:id/pay — partenaire marque comme payé
app.put('/api/coworking/devis/:id/pay', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var partnerToken = process.env.PARTNER_TOKEN || 'fa-genesis-partner-2024';
        if (token !== partnerToken) return res.status(403).json({ error: 'Non autorisé' });
        var all = loadCwDevis();
        var idx = all.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Devis non trouvé' });
        all[idx].status = 'paid';
        all[idx].paid_at = new Date().toISOString();
        saveCwDevis(all);
        res.json({ ok: true });
    } catch(e) { console.error('[DEVIS] PUT pay:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// DELETE /api/coworking/devis/:id — partenaire supprime un devis
app.delete('/api/coworking/devis/:id', function(req, res) {
    try {
        var token = (req.headers.authorization || '').replace('Bearer ', '');
        var partnerToken = process.env.PARTNER_TOKEN || 'fa-genesis-partner-2024';
        if (token !== partnerToken) return res.status(403).json({ error: 'Non autorisé' });
        var all = loadCwDevis();
        var idx = all.findIndex(function(d) { return d.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Devis non trouvé' });
        all.splice(idx, 1);
        saveCwDevis(all);
        res.json({ ok: true });
    } catch(e) { console.error('[DEVIS] DELETE:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// ============================================================
// ASSISTANT LINKEDIN B2B — Génération de messages IA
// ============================================================

/**
 * POST /api/admin/linkedin/generate-message
 * Génère un message LinkedIn B2B personnalisé via Claude API
 * Protégé par x-admin-key
 */
app.post('/api/admin/linkedin/generate-message', async function(req, res) {
    if (!_isAdminRequest(req)) {
        return res.status(401).json({ error: 'Non autorisé' });
    }

    var anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
        return res.status(503).json({ error: 'ANTHROPIC_API_KEY non configurée sur le serveur.' });
    }

    var { prenom, nom, titre, entreprise, secteur, bio, objectif, langue } = req.body;
    if (!prenom || !entreprise || !objectif) {
        return res.status(400).json({ error: 'Champs requis : prenom, entreprise, objectif' });
    }

    var langCode = langue === 'en' ? 'anglais' : 'français';
    var objetLabel = {
        connexion: 'une demande de connexion personnalisée (note d\'invitation)',
        collaboration: 'une proposition de collaboration ou partenariat',
        presentation: 'une présentation de FA GENESIS et de ses offres',
        relance: 'une relance après une première prise de contact'
    }[objectif] || objectif;

    var systemPrompt = [
        'Tu es l\'assistant commercial B2B de FA GENESIS, une société de conseil financier et d\'accompagnement basée en France.',
        '',
        '== À PROPOS DE FA GENESIS ==',
        'FA GENESIS propose trois types de services :',
        '1. ACCOMPAGNEMENT FINANCIER : coaching individuel et collectif pour étudiants, particuliers et entrepreneurs (budgeting, investissement, gestion de patrimoine, création d\'entreprise). Formules en 2, 3 ou 4 jours selon le profil.',
        '2. PRODUCTION MÉDIA : photo professionnelle, vidéo corporate/promotionnelle, contenu réseaux sociaux pour entreprises (tarifs sur devis personnalisé).',
        '3. MARKETING & STRATÉGIE : stratégie de contenu, branding, accompagnement communication pour TPE/PME.',
        '',
        '== VALEUR AJOUTÉE ==',
        '- Accompagnement 100% personnalisé, suivi individuel',
        '- Expertise combinée finance + production + marketing sous un seul toit',
        '- Résultats mesurables et orientés impact business',
        '- Tarifs adaptés au profil (étudiant, particulier, entreprise)',
        '',
        '== RÈGLES DE RÉDACTION LINKEDIN B2B ==',
        '- Message court : 3 à 5 phrases maximum',
        '- Ton professionnel mais chaleureux, jamais agressif ni trop commercial',
        '- Commencer par une phrase de personnalisation (référencer quelque chose de spécifique au profil)',
        '- Proposer de la valeur avant de parler de FA GENESIS',
        '- Terminer par UN seul call-to-action clair (appel, échange, réponse)',
        '- PAS de formules génériques ("J\'espère que vous allez bien", "Je me permets de vous contacter")',
        '- PAS de pression, PAS de liste à puces, PAS de majuscules excessives',
        '- Langue : ' + langCode,
        '',
        'Génère UNIQUEMENT le texte du message LinkedIn, sans titre ni explication.'
    ].join('\n');

    var userPrompt = [
        'Génère un message LinkedIn de type : ' + objetLabel,
        '',
        'PROFIL DU PROSPECT :',
        '- Prénom : ' + prenom + (nom ? ' ' + nom : ''),
        '- Titre / Poste : ' + (titre || 'non précisé'),
        '- Entreprise : ' + entreprise,
        '- Secteur : ' + (secteur || 'non précisé'),
        (bio ? '- Bio / À propos : ' + bio : ''),
        '',
        'Génère le message en ' + langCode + '.'
    ].filter(Boolean).join('\n');

    try {
        var aiResp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 400,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }]
            })
        });

        if (!aiResp.ok) {
            var errText = await aiResp.text();
            console.error('[LINKEDIN AI] Erreur API:', aiResp.status, errText);
            return res.status(502).json({ error: 'Erreur API IA : ' + aiResp.status });
        }

        var aiData = await aiResp.json();
        var message = (aiData.content && aiData.content[0] && aiData.content[0].text) || '';
        if (!message) return res.status(502).json({ error: 'Réponse IA vide' });

        res.json({ success: true, message: message.trim() });
    } catch(e) {
        console.error('[LINKEDIN AI] Erreur:', e);
        res.status(500).json({ error: 'Erreur serveur : ' + e.message });
    }
});

// ============================================================
// GESTION D'ERREURS GLOBALE
// ============================================================
// Sans ce middleware, une erreur non interceptee (route inconnue, payload
// trop volumineux, JSON malforme...) tombe sur la page d'erreur HTML par
// defaut d'Express. Le front-end fait toujours `JSON.parse(reponse)` : une
// reponse HTML fait donc echouer ce parsing et masque la vraie cause derriere
// un message generique ("Erreur de connexion"). On garantit ici que TOUTE
// reponse d'erreur reste du JSON valide.

// ===== SUPPORT CLIENT =====

app.post('/api/support/new', function(req, res) {
    var user = authenticateClient(req, res);
    if (!user) return;
    var subject = (req.body.subject || '').trim();
    var message = (req.body.message || '').trim();
    if (!subject || !message) return res.status(400).json({ error: 'Sujet et message requis' });
    var tickets = loadSupportTickets();
    var now = new Date().toISOString();
    var ticket = {
        id: 'SUP-' + Date.now(),
        client_email: user.email,
        client_name: ((user.prenom || '') + ' ' + (user.nom || '')).trim() || user.email,
        subject: subject,
        status: 'open',
        created_at: now,
        updated_at: now,
        messages: [{ from: 'client', from_name: user.prenom || user.email, content: message, created_at: now }]
    };
    tickets.push(ticket);
    saveSupportTickets(tickets);
    try { sendPushToRole('admin', { title: 'Nouveau ticket support', body: subject + ' — ' + (user.prenom || user.email), icon: '/assets/images/logo.png', url: '/admin.html' }); } catch(e){}
    emailService.sendSupportTicketAdminEmail(ticket, message).catch(function(e){ console.error('[SUPPORT] Email admin:', e.message); });
    res.json({ ok: true, ticket: ticket });
});

app.get('/api/support/mine', function(req, res) {
    var user = authenticateClient(req, res);
    if (!user) return;
    var tickets = loadSupportTickets().filter(function(t) {
        return t.client_email && t.client_email.toLowerCase() === user.email.toLowerCase();
    });
    tickets.sort(function(a, b) { return new Date(b.updated_at) - new Date(a.updated_at); });
    res.json({ ok: true, tickets: tickets });
});

app.post('/api/support/:id/reply', function(req, res) {
    var user = authenticateClient(req, res);
    if (!user) return;
    var message = (req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Message requis' });
    var tickets = loadSupportTickets();
    var idx = tickets.findIndex(function(t) { return t.id === req.params.id; });
    if (idx === -1) return res.status(404).json({ error: 'Ticket introuvable' });
    if (tickets[idx].client_email.toLowerCase() !== user.email.toLowerCase()) return res.status(403).json({ error: 'Acces refuse' });
    var now = new Date().toISOString();
    tickets[idx].messages.push({ from: 'client', from_name: user.prenom || user.email, content: message, created_at: now });
    tickets[idx].status = 'open';
    tickets[idx].updated_at = now;
    saveSupportTickets(tickets);
    try { sendPushToRole('admin', { title: 'Réponse client support', body: (user.prenom || user.email) + ' a répondu', icon: '/assets/images/logo.png', url: '/admin.html' }); } catch(e){}
    emailService.sendSupportTicketAdminEmail(tickets[idx], message).catch(function(e){ console.error('[SUPPORT] Email admin reply:', e.message); });
    res.json({ ok: true });
});

app.get('/api/admin/support', authenticateAdmin, function(req, res) {
    var tickets = loadSupportTickets();
    tickets.sort(function(a, b) {
        var order = { open: 0, replied: 1, closed: 2 };
        var d = (order[a.status] || 0) - (order[b.status] || 0);
        if (d !== 0) return d;
        return new Date(b.updated_at) - new Date(a.updated_at);
    });
    res.json({ ok: true, tickets: tickets });
});

app.post('/api/admin/support/:id/reply', authenticateAdmin, function(req, res) {
    var message = (req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Message requis' });
    var tickets = loadSupportTickets();
    var idx = tickets.findIndex(function(t) { return t.id === req.params.id; });
    if (idx === -1) return res.status(404).json({ error: 'Ticket introuvable' });
    var now = new Date().toISOString();
    tickets[idx].messages.push({ from: 'admin', from_name: 'FA Genesis', content: message, created_at: now });
    tickets[idx].status = 'replied';
    tickets[idx].updated_at = now;
    saveSupportTickets(tickets);
    try { sendPushToUser(tickets[idx].client_email, { title: 'Réponse FA Genesis', body: message.substring(0, 80), icon: '/assets/images/logo-favicon-192.png', url: '/app.html#support-reply-' + tickets[idx].id }); } catch(e){}
    res.json({ ok: true });
});

app.post('/api/admin/support/:id/close', authenticateAdmin, function(req, res) {
    var tickets = loadSupportTickets();
    var idx = tickets.findIndex(function(t) { return t.id === req.params.id; });
    if (idx === -1) return res.status(404).json({ error: 'Ticket introuvable' });
    tickets[idx].status = 'closed';
    tickets[idx].updated_at = new Date().toISOString();
    saveSupportTickets(tickets);
    res.json({ ok: true });
});

// Erreurs non gerees (payload trop gros, JSON malforme, exception non rattrapee...)
app.use((err, req, res, next) => {
    console.error('[ERREUR GLOBALE]', req.method, req.path, err);
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Fichier ou donnees trop volumineux.' });
    }
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
        return res.status(400).json({ error: 'Requete invalide.' });
    }
    res.status(err && err.status ? err.status : 500).json({ error: 'Erreur serveur inattendue.' });
});

// ============================================================
// COMPTES DE TEST INTERNES (initialisation au démarrage)
// ============================================================
var TEST_ACCOUNTS_GENESIS = [
    { email: 'test-createur@fagenesis.com',    password: 'TestCreateur2026!',    prenom: 'Test', nom: 'Createur',    referralBonusQG: 100  },
    { email: 'test-batisseur@fagenesis.com',   password: 'TestBatisseur2026!',   prenom: 'Test', nom: 'Batisseur',   referralBonusQG: 300  },
    { email: 'test-visionnaire@fagenesis.com', password: 'TestVisionnaire2026!', prenom: 'Test', nom: 'Visionnaire', referralBonusQG: 600  },
    { email: 'test-generateur@fagenesis.com',  password: 'TestGenerateur2026!',  prenom: 'Test', nom: 'Generateur',  referralBonusQG: 1000 }
];
async function initTestAccounts() {
    try {
        var users = loadUsers();
        var dirty = false;
        for (var i = 0; i < TEST_ACCOUNTS_GENESIS.length; i++) {
            var acc = TEST_ACCOUNTS_GENESIS[i];
            var idx = users.findIndex(function(u) { return (u.email || '').toLowerCase() === acc.email; });
            if (idx !== -1) {
                if (users[idx].referralBonusQG !== acc.referralBonusQG) {
                    users[idx].referralBonusQG = acc.referralBonusQG;
                    dirty = true;
                }
            } else {
                var hash = await bcrypt.hash(acc.password, 10);
                users.push({
                    id: 'USR-TEST-' + acc.nom.toUpperCase(),
                    prenom: acc.prenom, nom: acc.nom,
                    email: acc.email, telephone: null,
                    password: hash, accountType: 'particulier',
                    offre: null, activeOfferId: null, productType: null,
                    paymentStatus: 'registered',
                    referralBonusQG: acc.referralBonusQG,
                    missionBonuses: {}, profile_bio: '', profile_theme: 'genesis', profile_banner: null,
                    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                });
                dirty = true;
                console.log('[TEST] Compte créé : ' + acc.email + ' (' + acc.referralBonusQG + ' QG)');
            }
        }
        if (dirty) saveUsers(users);
    } catch (e) {
        console.error('[TEST] Erreur initTestAccounts:', e.message);
    }
}

// ============================================================
// STRIPE CONNECT — MARKETPLACE PAYMENT MODULE
// ============================================================

// ── Config publique (publishable key + commission) ────────────────────────────
app.get('/api/payments/stripe/config', function(req, res) {
    var cfg = mps.getConfig();
    res.json({
        publishableKey:    process.env.STRIPE_PUBLISHABLE_KEY || null,
        globalCommission:  cfg.globalCommissionRate,
        currency:          cfg.currency || 'eur',
        paymentsEnabled:   cfg.paymentsEnabled !== false,
        stripeEnabled:     !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY)
    });
});

// ── Onboarding prestataire — étape 1 : créer le compte Connect ───────────────
app.post('/api/partner/stripe/setup', authenticatePartner, async function(req, res) {
    try {
        var partner = req.partner;
        if (partner.stripeAccountId) {
            // Compte déjà créé → renvoyer un nouveau lien d'onboarding
            var baseUrl = process.env.FRONT_URL || 'https://fagenesis.com';
            var url = await mps.getPartnerOnboardingLink(partner.stripeAccountId, baseUrl);
            return res.json({ ok: true, url: url, accountId: partner.stripeAccountId });
        }

        var b = req.body || {};
        var entityType = b.entityType || 'particulier';

        if (entityType !== 'particulier' && entityType !== 'entreprise') {
            return res.status(400).json({ error: 'entityType invalide (particulier|entreprise)' });
        }
        if (entityType === 'entreprise' && !(b.raisonSociale || '').trim()) {
            return res.status(400).json({ error: 'Raison sociale requise' });
        }

        var accountData = {
            email:              partner.email,
            country:            (b.country || 'FR').toUpperCase(),
            entityType:         entityType,
            prenom:             b.prenom             || partner.prenom || '',
            nom:                b.nom                || partner.nom   || '',
            raisonSociale:      b.raisonSociale      || '',
            registrationNumber: b.registrationNumber || '',
            representantPrenom: b.representantPrenom || b.prenom || '',
            representantNom:    b.representantNom    || b.nom    || '',
            partnerId:          partner.id
        };

        var account = await mps.setupPartnerStripeAccount(accountData);

        // Persister les infos Stripe sur le partenaire
        var partners = loadPartners();
        var idx = partners.findIndex(function(p){ return p.id === partner.id; });
        if (idx !== -1) {
            partners[idx].stripeAccountId      = account.id;
            partners[idx].stripeAccountStatus  = 'pending';
            partners[idx].stripeChargesEnabled = false;
            partners[idx].stripePayoutsEnabled = false;
            partners[idx].stripeDetailsSubmitted = false;
            partners[idx].entityType           = entityType;
            partners[idx].stripeCountry        = accountData.country;
            partners[idx].country              = accountData.country;
            partners[idx].updatedAt            = new Date().toISOString();
            savePartners(partners);
        }

        var baseUrl = process.env.FRONT_URL || 'https://fagenesis.com';
        var onboardingUrl = await mps.getPartnerOnboardingLink(account.id, baseUrl);

        notifyUser(partner.email, 'partner', 'stripe_account_created',
            'Compte de paiement créé',
            'Complétez la configuration Stripe pour recevoir vos rémunérations.',
            null);

        res.json({ ok: true, url: onboardingUrl, accountId: account.id });
    } catch(e) {
        console.error('[STRIPE SETUP]', e.message);
        res.status(500).json({ error: e.message || 'Erreur lors de la création du compte Stripe' });
    }
});

// ── Nouveau lien d'onboarding (si le premier a expiré — 1h TTL Stripe) ───────
app.get('/api/partner/stripe/onboarding-link', authenticatePartner, async function(req, res) {
    try {
        var partner = req.partner;
        if (!partner.stripeAccountId) {
            return res.status(400).json({ error: 'Aucun compte Stripe associé. Faites /setup d\'abord.' });
        }
        var baseUrl = process.env.FRONT_URL || 'https://fagenesis.com';
        var url = await mps.getPartnerOnboardingLink(partner.stripeAccountId, baseUrl);
        res.json({ ok: true, url: url });
    } catch(e) {
        console.error('[STRIPE LINK]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ── Statut du compte Stripe du prestataire ────────────────────────────────────
app.get('/api/partner/stripe/status', authenticatePartner, async function(req, res) {
    try {
        var partner = req.partner;
        if (!partner.stripeAccountId) {
            return res.json({ ok: true, configured: false, statusLabel: 'not_configured' });
        }
        var status = await mps.getPartnerStripeStatus(partner.stripeAccountId);
        res.json({ ok: true, configured: true, accountId: partner.stripeAccountId, entityType: partner.entityType || null, ...status });
    } catch(e) {
        console.error('[STRIPE STATUS]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ── Configuration du calendrier de versements ─────────────────────────────────
app.post('/api/partner/stripe/payout-schedule', authenticatePartner, async function(req, res) {
    try {
        var partner = req.partner;
        if (!partner.stripeAccountId || !partner.stripeChargesEnabled) {
            return res.status(400).json({ error: 'Compte Stripe non encore vérifié' });
        }
        var b = req.body || {};
        var interval = b.interval || 'daily';
        if (['daily','weekly','monthly'].indexOf(interval) === -1) {
            return res.status(400).json({ error: 'interval invalide (daily|weekly|monthly)' });
        }
        await mps.provider.updatePayoutSchedule(partner.stripeAccountId, {
            interval:      interval,
            weeklyAnchor:  b.weeklyAnchor  || undefined,
            monthlyAnchor: b.monthlyAnchor || undefined
        });
        res.json({ ok: true, interval: interval });
    } catch(e) {
        console.error('[STRIPE SCHEDULE]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ── Historique paiements Stripe du prestataire ────────────────────────────────
app.get('/api/partner/stripe/payments', authenticatePartner, function(req, res) {
    try {
        var partner  = req.partner;
        var payments = mps.loadStripePayments()
            .filter(function(p){ return p.partnerId === partner.id; })
            .sort(function(a,b){ return new Date(b.createdAt) - new Date(a.createdAt); });
        res.json({ ok: true, payments: payments });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Créer un PaymentIntent (appelé par le front client avant affichage du form) ─
app.post('/api/payments/stripe/create-intent', async function(req, res) {
    try {
        // Auth client (même pattern que /api/my-orders)
        var token = (req.headers.authorization || '').replace('Bearer ', '').trim();
        if (!token) return res.status(401).json({ error: 'Token requis' });
        var jwt = require('jsonwebtoken');
        var payload;
        try { payload = jwt.verify(token, process.env.JWT_SECRET); }
        catch(e) { return res.status(401).json({ error: 'Token invalide' }); }
        var users = loadUsers();
        var user = users.find(function(u){ return u.email === payload.email; });
        if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });

        var b = req.body || {};
        if (!b.partnerId || !b.amountEuros) {
            return res.status(400).json({ error: 'partnerId et amountEuros requis' });
        }

        var partners = loadPartners();
        var partner  = partners.find(function(p){ return p.id === b.partnerId; });
        if (!partner || !partner.stripeAccountId || !partner.stripeChargesEnabled) {
            return res.status(400).json({ error: 'Ce prestataire n\'a pas encore configuré ses paiements Stripe.' });
        }

        // S'assurer que le client a un Stripe Customer ID
        var stripeCustomerId = user.stripeCustomerId || null;
        if (!stripeCustomerId) {
            stripeCustomerId = await mps.ensureStripeCustomer({ email: user.email, prenom: user.prenom, nom: user.nom, id: user.id });
            var uIdx = users.findIndex(function(u){ return u.id === user.id; });
            if (uIdx !== -1) { users[uIdx].stripeCustomerId = stripeCustomerId; saveUsers(users); }
        }

        var result = await mps.createClientPaymentIntent({
            amountEuros:            parseFloat(b.amountEuros),
            partnerType:            partner.partner_type || 'other',
            partnerId:              partner.id,
            stripeConnectedAccountId: partner.stripeAccountId,
            clientStripeCustomerId: stripeCustomerId,
            clientEmail:            user.email,
            orderId:                b.orderId  || null,
            stage:                  b.stage    || 'deposit',
            description:            b.description || ('FA GENESIS — ' + (b.label || 'Prestation'))
        });

        res.json({ ok: true, clientSecret: result.clientSecret, paymentIntentId: result.paymentIntentId, split: result.split });
    } catch(e) {
        console.error('[STRIPE INTENT]', e.message);
        res.status(500).json({ error: e.message || 'Erreur lors de la création du paiement' });
    }
});

// ── Admin : statistiques marketplace ─────────────────────────────────────────
app.get('/api/admin/marketplace/stats', function(req, res) {
    if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Accès refusé' });
    try {
        var stats = mps.getMarketplaceStats();
        // Statuts des comptes prestataires
        var partners = loadPartners().filter(function(p){ return p.accountStatus === 'active'; });
        var stripeVerified  = partners.filter(function(p){ return p.stripeAccountStatus === 'active'; }).length;
        var stripePending   = partners.filter(function(p){ return p.stripeAccountId && p.stripeAccountStatus !== 'active'; }).length;
        var stripeNone      = partners.filter(function(p){ return !p.stripeAccountId; }).length;
        res.json(Object.assign({}, stats, {
            partnerStats: { verified: stripeVerified, pending: stripePending, notConfigured: stripeNone }
        }));
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Admin : configuration des commissions ─────────────────────────────────────
app.get('/api/admin/marketplace/config', function(req, res) {
    if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Accès refusé' });
    res.json({ ok: true, config: mps.getConfig() });
});

app.put('/api/admin/marketplace/config', function(req, res) {
    if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Accès refusé' });
    try {
        var b = req.body || {};
        var patch = {};
        if (typeof b.globalCommissionRate === 'number') {
            if (b.globalCommissionRate < 0 || b.globalCommissionRate > 0.5) {
                return res.status(400).json({ error: 'Commission globale entre 0 et 50 %' });
            }
            patch.globalCommissionRate = b.globalCommissionRate;
        }
        if (b.categoryCommissions && typeof b.categoryCommissions === 'object') {
            var cats = {};
            Object.keys(b.categoryCommissions).forEach(function(k){
                var v = parseFloat(b.categoryCommissions[k]);
                if (!isNaN(v) && v >= 0 && v <= 0.5) cats[k] = v;
            });
            patch.categoryCommissions = cats;
        }
        if (typeof b.paymentsEnabled === 'boolean') patch.paymentsEnabled = b.paymentsEnabled;
        if (['daily','weekly','monthly'].indexOf(b.payoutSchedule) !== -1) patch.payoutSchedule = b.payoutSchedule;
        if (typeof b.payoutDelayDays === 'number' && b.payoutDelayDays >= 0) patch.payoutDelayDays = b.payoutDelayDays;
        var cfg = mps.updateConfig(patch);
        res.json({ ok: true, config: cfg });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Admin : liste des comptes partenaires Stripe ──────────────────────────────
app.get('/api/admin/marketplace/partners', function(req, res) {
    if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Accès refusé' });
    try {
        var partners = loadPartners().filter(function(p){ return p.accountStatus === 'active'; });
        var list = partners.map(function(p) {
            return {
                id:                  p.id,
                prenom:              p.prenom,
                nom:                 p.nom,
                email:               p.email,
                partner_type:        p.partner_type,
                entityType:          p.entityType        || null,
                stripeAccountId:     p.stripeAccountId   || null,
                stripeAccountStatus: p.stripeAccountStatus || 'not_configured',
                stripeChargesEnabled:p.stripeChargesEnabled || false,
                stripePayoutsEnabled:p.stripePayoutsEnabled || false
            };
        });
        res.json({ ok: true, partners: list });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Admin : remboursement ─────────────────────────────────────────────────────
app.post('/api/admin/marketplace/refund', async function(req, res) {
    if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Accès refusé' });
    try {
        var b = req.body || {};
        if (!b.paymentIntentId) return res.status(400).json({ error: 'paymentIntentId requis' });
        var refund = await mps.refundPayment(b.paymentIntentId, b.amountEuros || null, b.reason || 'requested_by_customer');
        res.json({ ok: true, refundId: refund.id, amountCents: refund.amount, status: refund.status });
    } catch(e) {
        console.error('[STRIPE REFUND]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ── Admin : liste des paiements Stripe ───────────────────────────────────────
app.get('/api/admin/marketplace/payments', function(req, res) {
    if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Accès refusé' });
    try {
        var payments = mps.loadStripePayments()
            .sort(function(a,b){ return new Date(b.createdAt) - new Date(a.createdAt); });
        var limit = parseInt(req.query.limit) || 100;
        res.json({ ok: true, payments: payments.slice(0, limit), total: payments.length });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// ─── PAYOUT ROUTING — GENESIS PAYMENT ORCHESTRATION ─────────
// ============================================================

// GET /api/payout/routing/:countryCode — Meilleur fournisseur de payout pour un pays
app.get('/api/payout/routing/:countryCode', function(req, res) {
    try {
        var code   = (req.params.countryCode || '').toUpperCase().slice(0, 2);
        var result = payoutRouting.getBestPayoutProvider(code);
        res.json({ ok: true, countryCode: code, routing: result });
    } catch(e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// GET /api/partner/payout/routing — Routage basé sur le pays du prestataire connecté
app.get('/api/partner/payout/routing', authenticatePartner, function(req, res) {
    try {
        var partners = loadPartners();
        var partner  = partners.find(function(p) { return p.id === req.partner.id; });
        if (!partner) return res.status(404).json({ ok: false, error: 'Partenaire introuvable' });
        var code     = partner.country || '';
        var result   = payoutRouting.getBestPayoutProvider(code);
        res.json({ ok: true, countryCode: code, countryName: result.countryName, routing: result, payoutProvider: partner.payoutProvider || null, payoutStatus: partner.payoutStatus || 'not_configured' });
    } catch(e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST /api/partner/payout/payoneer-link — Générer un lien d'inscription Payoneer personnalisé
app.post('/api/partner/payout/payoneer-link', authenticatePartner, async function(req, res) {
    try {
        var partners = loadPartners();
        var partner  = partners.find(function(p) { return p.id === req.partner.id; });
        if (!partner) return res.status(404).json({ ok: false, error: 'Partenaire introuvable' });

        var result = await payoneerProvider.generateRegistrationLink({
            id:      partner.id,
            email:   partner.email,
            prenom:  partner.prenom || '',
            nom:     partner.nom    || '',
            country: partner.country || ''
        });

        if (result.ok) {
            return res.json({ ok: true, url: result.url });
        }
        // Fallback : Payoneer non configuré → retourner la page intermédiaire
        if (result.fallback) {
            return res.json({ ok: true, url: 'https://fagenesis.com/payoneer-setup.html', fallback: true });
        }
        res.status(500).json({ ok: false, error: result.error });
    } catch(e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST /api/partner/payout/setup-payoneer — Sauvegarder l'email Payoneer (flow manuel / fallback)
app.post('/api/partner/payout/setup-payoneer', authenticatePartner, function(req, res) {
    try {
        var partners = loadPartners();
        var idx      = partners.findIndex(function(p) { return p.id === req.partner.id; });
        if (idx === -1) return res.status(404).json({ ok: false, error: 'Partenaire introuvable' });
        var email = (req.body.payoneerEmail || '').trim().toLowerCase();
        if (!email || !email.includes('@')) return res.status(400).json({ ok: false, error: 'Email Payoneer invalide.' });
        partners[idx].payoutProvider = 'payoneer';
        partners[idx].payoutStatus   = 'pending_verification';
        partners[idx].payoneerEmail  = email;
        partners[idx].updatedAt      = new Date().toISOString();
        savePartners(partners);
        res.json({ ok: true, payoutProvider: 'payoneer', payoutStatus: 'pending_verification', payoneerEmail: email });
    } catch(e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

// POST /api/webhooks/payoneer — Notifications Payoneer (approbation bénéficiaire, paiement, etc.)
app.post('/api/webhooks/payoneer', function(req, res) {
    try {
        var event   = req.body;
        var type    = event.type || event.event_type || '';
        var payeeId = event.payee_id || (event.payee && event.payee.payee_id) || '';

        if (!payeeId) return res.json({ ok: true, ignored: true });

        var partners = loadPartners();
        var idx      = partners.findIndex(function(p) { return p.email === payeeId; });
        if (idx === -1) return res.json({ ok: true, ignored: true });

        // Compte approuvé → activer le payout
        if (type === 'PAYEE_REGISTRATION_APPROVED' || type === 'payee_approved' || (event.status && event.status.toLowerCase() === 'active')) {
            partners[idx].payoutStatus     = 'active';
            partners[idx].payoneerEmail    = partners[idx].payoneerEmail || payeeId;
            // Stocker l'ID numérique Payoneer utilisé pour les appels Mass Payouts
            if (event.payoneer_id || event.payee_payoneer_id) {
                partners[idx].payoneerPayeeId = event.payoneer_id || event.payee_payoneer_id;
            }
            partners[idx].updatedAt        = new Date().toISOString();
            savePartners(partners);
        }

        // Compte refusé
        if (type === 'PAYEE_REGISTRATION_DECLINED' || type === 'payee_declined') {
            partners[idx].payoutStatus = 'declined';
            partners[idx].updatedAt   = new Date().toISOString();
            savePartners(partners);
        }

        res.json({ ok: true });
    } catch(e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// GET /api/partner/earnings/summary — Résumé des revenus du prestataire
app.get('/api/partner/earnings/summary', authenticatePartner, function(req, res) {
    try {
        var payouts   = loadPayouts().filter(function(p) { return p.partner_id === req.partner.id; });
        var available = 0;
        var pending   = 0;
        var totalEarned  = 0;
        var totalPaidOut = 0;

        payouts.forEach(function(p) {
            var amt = parseFloat(p.amount || 0);
            if (p.status === 'sent') {
                totalPaidOut += amt;
                totalEarned  += amt;
            } else if (p.status === 'pending' || p.status === 'awaiting_validation') {
                pending     += amt;
                totalEarned += amt;
            } else if (p.status === 'on_hold') {
                pending     += amt;
                totalEarned += amt;
            }
        });

        var stripePayments = [];
        try { stripePayments = mps.loadStripePayments().filter(function(p) { return p.partnerId === req.partner.id && p.status === 'succeeded'; }); } catch(e) {}
        stripePayments.forEach(function(p) {
            var partnerCents = p.partnerCents || 0;
            totalEarned  += partnerCents / 100;
        });

        res.json({ ok: true, available: parseFloat(available.toFixed(2)), pending: parseFloat(pending.toFixed(2)), totalEarned: parseFloat(totalEarned.toFixed(2)), totalPaidOut: parseFloat(totalPaidOut.toFixed(2)), currency: 'EUR' });
    } catch(e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// GET /api/admin/payout/providers — Liste des fournisseurs de payout (admin)
app.get('/api/admin/payout/providers', function(req, res) {
    if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Accès refusé' });
    var table = payoutRouting.loadCountryTable();
    var providers = [
        { id: 'stripe',    name: 'Stripe Connect', active: true,  note: 'Credentials actifs via STRIPE_SECRET_KEY' },
        { id: 'payoneer',  name: 'Payoneer',        active: true,  note: payoneerProvider.isConfigured() ? 'API configurée' : 'Payout manuel — PAYONEER_PARTNER_ID / PAYONEER_API_KEY non configurés' },
        { id: 'airwallex', name: 'Airwallex',       active: false, note: 'Non configuré' },
        { id: 'adyen',     name: 'Adyen',           active: false, note: 'Non configuré' }
    ];
    res.json({ ok: true, providers: providers, countryTable: table });
});

// PUT /api/admin/payout/country/:code — Modifier la disponibilité d'un fournisseur pour un pays (admin)
app.put('/api/admin/payout/country/:code', function(req, res) {
    if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Accès refusé' });
    try {
        var code     = req.params.code.toUpperCase();
        var provider = req.body.provider;
        var enabled  = !!req.body.enabled;
        var updated  = payoutRouting.updateCountryProvider(code, provider, enabled);
        if (!updated) return res.status(400).json({ ok: false, error: 'Pays ou fournisseur invalide' });
        res.json({ ok: true, countryCode: code, provider: provider, enabled: enabled });
    } catch(e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ── ACTUALITÉS (partenariats / événements publics) ──────────────
// GET public — lecture de toutes les actualités publiées
app.get('/api/actualites', function(req, res) {
    try {
        var list = loadActualites();
        var published = list.filter(function(a) { return a.published !== false; });
        published.sort(function(a, b) {
            var da = new Date(a.date || a.created_at || 0).getTime() || 0;
            var db = new Date(b.date || b.created_at || 0).getTime() || 0;
            return da - db; // ordre chronologique croissant : le plus ancien en premier
        });
        res.json({ ok: true, actualites: published });
    } catch(e) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET public — une actualité par ID (avec image complète, pour le modal)
app.get('/api/actualites/:id', function(req, res) {
    try {
        var list = loadActualites();
        var a = list.find(function(x) { return x.id === req.params.id && x.published !== false; });
        if (!a) return res.status(404).json({ error: 'Actualité introuvable' });
        res.json({ ok: true, actualite: a });
    } catch(e) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET admin — toutes les actualités (y compris brouillons)
app.get('/api/admin/actualites', function(req, res) {
    try {
        if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
        var list = loadActualites();
        list.sort(function(a, b) {
            var da = new Date(a.date || a.created_at || 0).getTime() || 0;
            var db = new Date(b.date || b.created_at || 0).getTime() || 0;
            return db - da;
        });
        // Strip full base64 images from list view — replaced by a boolean flag.
        // The edit form fetches the full image when needed via GET /api/admin/actualites/:id.
        var slim = list.map(function(a) {
            var out = Object.assign({}, a);
            if (out.image && out.image.length > 200) { out.has_image = true; out.image = ''; }
            return out;
        });
        res.json({ ok: true, actualites: slim });
    } catch(e) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET admin — actualité individuelle (avec image complète pour édition)
app.get('/api/admin/actualites/:id', function(req, res) {
    try {
        if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
        var list = loadActualites();
        var actu = list.find(function(a) { return a.id === req.params.id; });
        if (!actu) return res.status(404).json({ error: 'Actualité introuvable' });
        res.json({ ok: true, actualite: actu });
    } catch(e) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST admin — créer une actualité
app.post('/api/admin/actualites', function(req, res) {
    try {
        if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
        var b = req.body;
        if (!b.title || !b.description) return res.status(400).json({ error: 'Titre et description requis' });
        var crypto = require('crypto');
        var actu = {
            id: 'actu_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
            title: (b.title || '').substring(0, 200),
            description: (b.description || '').substring(0, 2000),
            category: b.category || 'partenariat',
            location: (b.location || '').substring(0, 100),
            date: b.date || new Date().toISOString(),
            image: (b.image || '').substring(0, 500000), // base64 ou URL
            published: b.published !== false,
            created_at: new Date().toISOString()
        };
        var list = loadActualites();
        list.push(actu);
        saveActualites(list);
        res.json({ ok: true, actualite: actu });
    } catch(e) {
        console.error('[ACTUALITES POST]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT admin — modifier une actualité
app.put('/api/admin/actualites/:id', function(req, res) {
    try {
        if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
        var list = loadActualites();
        var idx = list.findIndex(function(a) { return a.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Actualité introuvable' });
        var b = req.body;
        var actu = list[idx];
        if (b.title !== undefined) actu.title = (b.title || '').substring(0, 200);
        if (b.description !== undefined) actu.description = (b.description || '').substring(0, 2000);
        if (b.category !== undefined) actu.category = b.category;
        if (b.location !== undefined) actu.location = (b.location || '').substring(0, 100);
        if (b.date !== undefined) actu.date = b.date;
        if (b.image !== undefined) actu.image = (b.image || '').substring(0, 500000);
        if (b.published !== undefined) actu.published = !!b.published;
        actu.updated_at = new Date().toISOString();
        list[idx] = actu;
        saveActualites(list);
        res.json({ ok: true, actualite: actu });
    } catch(e) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE admin — supprimer une actualité
app.delete('/api/admin/actualites/:id', function(req, res) {
    try {
        if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
        var list = loadActualites();
        var idx = list.findIndex(function(a) { return a.id === req.params.id; });
        if (idx === -1) return res.status(404).json({ error: 'Actualité introuvable' });
        list.splice(idx, 1);
        saveActualites(list);
        res.json({ ok: true });
    } catch(e) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// ─── DEMO SCREENSHOT ACCOUNT ─────────────────────────────────────────────────
// Crée un compte démo réaliste pour les captures Play Store (admin only)
app.post('/api/admin/setup-screenshot-demo', async function(req, res) {
    try {
        if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });

        var bcrypt = require('bcrypt');
        var crypto = require('crypto');
        var uid = function(p) { return p + crypto.randomBytes(4).toString('hex').toUpperCase(); };
        var daysAgo = function(n) { return new Date(Date.now() - n * 24 * 3600 * 1000).toISOString(); };
        var daysFromNow = function(n) { return new Date(Date.now() + n * 24 * 3600 * 1000).toISOString(); };

        var DEMO_EMAIL = 'demo.screenshot@fagenesis.com';
        var DEMO_PASS  = 'DemoGenesis2026!';
        var DEMO_PARTNER_EMAIL = 'demo.prestataire@fagenesis.com';

        // ── Partner démo ──────────────────────────────────────────────────────
        var partners = loadPartners();
        var demoPartner = partners.find(function(p) { return p.email === DEMO_PARTNER_EMAIL; });
        if (!demoPartner) {
            var phash = await bcrypt.hash('DemoPartner2026!', 10);
            demoPartner = {
                id: uid('PTN'),
                email: DEMO_PARTNER_EMAIL,
                password: phash,
                name: 'Marie Dubois',
                prenom: 'Marie',
                nom: 'Dubois',
                category: 'Design & Création',
                bio: 'Designeuse UI/UX passionnée avec 7 ans d\'expérience. Spécialisée en identité visuelle, applications mobiles et design de marque. J\'accompagne les startups et PME dans leur transformation digitale.',
                city: 'Paris',
                phone: '+33 6 12 34 56 78',
                website: 'https://marie-design.fr',
                instagram: '@marie.design',
                rating: 4.9,
                reviewCount: 47,
                tier: 'or',
                constellationBadge: 'Étoile Montante',
                verified: true,
                isActive: true,
                responseTime: '< 2h',
                services: [
                    { id: uid('SVC'), label: 'Logo & Identité visuelle', price: 450, duration: '5 jours', description: 'Création de votre logo, charte graphique complète et guide de style.' },
                    { id: uid('SVC'), label: 'Design d\'application mobile', price: 1200, duration: '10 jours', description: 'Maquettes UI/UX complètes pour iOS et Android, prototype interactif inclus.' },
                    { id: uid('SVC'), label: 'Refonte de site web', price: 800, duration: '7 jours', description: 'Redesign complet de votre site : wireframes, design final et assets exportés.' },
                    { id: uid('SVC'), label: 'Pack réseaux sociaux', price: 280, duration: '3 jours', description: '10 templates Canva/Figma personnalisés à votre charte graphique.' }
                ],
                portfolio: [],
                qgPoints: 1240,
                missionsCount: 47,
                createdBy: 'setup-screenshot-demo',
                created_at: daysAgo(180)
            };
            partners.push(demoPartner);
            savePartners(partners);
        }

        // ── Utilisateur démo client ────────────────────────────────────────────
        var users = loadUsers();
        var demoUser = users.find(function(u) { return u.email === DEMO_EMAIL; });
        if (!demoUser) {
            var uhash = await bcrypt.hash(DEMO_PASS, 10);
            demoUser = {
                id: uid('USR'),
                email: DEMO_EMAIL,
                password: uhash,
                prenom: 'Sophie',
                nom: 'Martin',
                phone: '+33 6 98 76 54 32',
                badge: 'or',
                qgPoints: 980,
                missionsCount: 12,
                referralCode: 'SOPHIE2026',
                createdBy: 'setup-screenshot-demo',
                created_at: daysAgo(210)
            };
            users.push(demoUser);
            saveUsers(users);
        }

        // ── Commandes démo ────────────────────────────────────────────────────
        var orders = loadOrders();
        var existingDemo = orders.filter(function(o) { return o.client_email === DEMO_EMAIL; });

        var demoOrders = [];

        if (!existingDemo.find(function(o) { return o.status === 'in_progress'; })) {
            // Mission active : Design d'app mobile
            var ordId1 = uid('ORD'), reqId1 = uid('REQ');
            var ord1 = {
                id: ordId1,
                request_id: reqId1,
                client_id: demoUser.id,
                client_email: DEMO_EMAIL,
                client_name: 'Sophie Martin',
                partner_id: demoPartner.id,
                partner_email: DEMO_PARTNER_EMAIL,
                partner_name: 'Marie Dubois',
                service_label: 'Design d\'application mobile',
                total_amount: 1200,
                deposit_amount: 600,
                balance_amount: 600,
                paymentStatus: 'deposit_paid',
                status: 'in_progress',
                acceptedByPartner: true,
                started_at: daysAgo(8),
                delivery_date: daysFromNow(2),
                created_at: daysAgo(12),
                updated_at: daysAgo(1),
                createdBy: 'setup-screenshot-demo'
            };
            orders.push(ord1);
            demoOrders.push(ord1);
        }

        if (!existingDemo.find(function(o) { return o.status === 'delivering'; })) {
            // Mission en livraison : Logo & charte
            var ordId2 = uid('ORD'), reqId2 = uid('REQ');
            var ord2 = {
                id: ordId2,
                request_id: reqId2,
                client_id: demoUser.id,
                client_email: DEMO_EMAIL,
                client_name: 'Sophie Martin',
                partner_id: demoPartner.id,
                partner_email: DEMO_PARTNER_EMAIL,
                partner_name: 'Marie Dubois',
                service_label: 'Logo & Identité visuelle',
                total_amount: 450,
                deposit_amount: 225,
                balance_amount: 225,
                paymentStatus: 'deposit_paid',
                status: 'delivering',
                acceptedByPartner: true,
                started_at: daysAgo(5),
                delivery_date: daysFromNow(0),
                created_at: daysAgo(7),
                updated_at: daysAgo(0),
                createdBy: 'setup-screenshot-demo'
            };
            orders.push(ord2);
            demoOrders.push(ord2);
        }

        if (!existingDemo.find(function(o) { return o.status === 'completed'; })) {
            // Mission terminée : Pack réseaux sociaux
            var ordId3 = uid('ORD'), reqId3 = uid('REQ');
            var ord3 = {
                id: ordId3,
                request_id: reqId3,
                client_id: demoUser.id,
                client_email: DEMO_EMAIL,
                client_name: 'Sophie Martin',
                partner_id: demoPartner.id,
                partner_email: DEMO_PARTNER_EMAIL,
                partner_name: 'Marie Dubois',
                service_label: 'Pack réseaux sociaux',
                total_amount: 280,
                deposit_amount: 280,
                balance_amount: 0,
                paymentStatus: 'fully_paid',
                status: 'completed',
                rating: 5,
                review: 'Travail exceptionnel, délais respectés, communication parfaite. Je recommande vivement !',
                acceptedByPartner: true,
                completed_at: daysAgo(20),
                created_at: daysAgo(30),
                updated_at: daysAgo(20),
                createdBy: 'setup-screenshot-demo'
            };
            orders.push(ord3);
            demoOrders.push(ord3);
        }

        saveOrders(orders);

        res.json({
            success: true,
            demo_client: { email: DEMO_EMAIL, password: DEMO_PASS },
            demo_partner_email: DEMO_PARTNER_EMAIL,
            orders_created: demoOrders.length,
            message: 'Compte démo screenshot créé. Connectez-vous avec demo.screenshot@fagenesis.com'
        });
    } catch (e) {
        console.error('[DEMO] Erreur setup-screenshot-demo:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// DEMARRAGE DU SERVEUR
// ============================================================


// Traitement des notifications différées (toutes les 5 min)
processScheduledNotifs();
setInterval(processScheduledNotifs, 5 * 60 * 1000);

app.listen(PORT, async () => {
    // Restaurer les données depuis MongoDB Atlas (si configuré)
    try {
        var mongoConnected = await persistentStore.connect();
        if (mongoConnected) {
            var dataDir = path.join(__dirname, 'data');
            await persistentStore.restoreAllFromCloud(dataDir);
            console.log('[STARTUP] Données restaurées depuis MongoDB Atlas');
        } else {
            console.log('[STARTUP] ATTENTION: Pas de MongoDB → les données seront perdues au prochain redéploiement');
        }
    } catch (mongoErr) {
        console.error('[STARTUP] Erreur restauration MongoDB:', mongoErr.message);
    }

    console.log('');
    console.log('=================================================');
    console.log('   FA GENESIS - Backend SumUp');
    console.log('=================================================');
    console.log(`   Serveur demarre sur http://localhost:${PORT}`);
    console.log(`   Mode: ${process.env.SUMUP_MODE || 'sandbox'}`);
    console.log('');
    console.log('   Endpoints disponibles:');
    console.log('   - GET  /api/health');
    console.log('   - GET  /api/products');
    console.log('   - POST /api/orders/create');
    console.log('   - POST /api/payments/sumup/create-checkout');
    console.log('   - POST /api/payments/sumup/webhook');
    console.log('   - POST /api/payments/verify');
    console.log('   - POST /api/contact (emails automatiques)');
    console.log('   - GET  /api/admin/users');
    console.log('   - GET  /api/admin/stats');
    console.log('   - GET  /api/admin/messages');
    console.log('   - POST /api/auth/register');
    console.log('   - POST /api/auth/login');
    console.log('   - GET  /api/auth/me');
    console.log('   - POST /api/auth/logout');
    console.log('   - GET  /api/sessions/me (seances client)');
    console.log('   - GET/POST/PUT/DELETE /api/admin/sessions');
    console.log('');

    // Verifier la configuration SumUp
    const hasApiKey = process.env.SUMUP_API_KEY && process.env.SUMUP_API_KEY !== 'COLLER_LA_CLE_ICI';
    if (!hasApiKey) {
        console.log('   [ATTENTION] SUMUP_API_KEY non configuree!');
        console.log('   Editez le fichier server/.env');
        console.log('');
    }

    // Verifier la configuration Email
    const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD;
    if (!hasSmtpConfig || process.env.SMTP_PASSWORD === 'votre_mot_de_passe_smtp') {
        console.log('   [INFO] Configuration SMTP incomplete');
        console.log('   Les emails automatiques ne seront pas envoyes');
        console.log('   Editez SMTP_HOST, SMTP_USER, SMTP_PASSWORD dans .env');
        console.log('');
    } else {
        console.log('   [OK] Service email configure');
        console.log(`   Expediteur: ${process.env.EMAIL_FROM_ADDRESS}`);
        console.log(`   Notifications vers: ${process.env.EMAIL_ADMIN_ADDRESS}`);
        console.log('');
        // Initialiser le transporteur email
        emailService.initializeTransporter();
    }

    console.log('=================================================');
    console.log('');

    // Nettoyer les faux comptes partenaires de demonstration crees par d'anciens demarrages
    await purgeSeedPartnerAccounts();

    // Comptes de test internes : uniquement en dehors de la production
    if (process.env.NODE_ENV !== 'production') {
        await initTestAccounts();
    }

// ── PROMOTIONS ────────────────────────────────────────────────────────────────

// GET /api/partner/promotions — liste des promotions du partenaire connecté
app.get('/api/partner/promotions', authenticatePartner, (req, res) => {
    try {
        var pid = req.partner.id;
        var promos = loadPromotions().filter(function(p) { return p.partner_id === pid; });
        res.json({ ok: true, promotions: promos });
    } catch(e) {
        console.error('[PROMO GET]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/partner/promotions — créer une promotion
app.post('/api/partner/promotions', authenticatePartner, (req, res) => {
    try {
        var pid = req.partner.id;
        var b = req.body;
        var title = (b.title || '').trim();
        var type  = b.type || '';
        if (!title)                             return res.status(400).json({ error: 'Titre requis' });
        if (!PROMO_TYPES_ALL.includes(type))    return res.status(400).json({ error: 'Type invalide' });
        if (!b.start_date || !b.end_date)       return res.status(400).json({ error: 'Dates requises' });
        if (new Date(b.end_date) <= new Date(b.start_date)) return res.status(400).json({ error: 'La date de fin doit être après la date de début' });
        if ((type === 'percentage' || type === 'fixed') && (b.value === null || b.value === undefined || isNaN(parseFloat(b.value)))) {
            return res.status(400).json({ error: 'Valeur numérique requise pour ce type' });
        }
        if (type === 'percentage' && (parseFloat(b.value) <= 0 || parseFloat(b.value) > 99)) {
            return res.status(400).json({ error: 'Le pourcentage doit être entre 1 et 99' });
        }
        var promo = {
            id: 'promo_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
            partner_id: pid,
            title: title,
            description: (b.description || '').trim(),
            type: type,
            value: (type === 'percentage' || type === 'fixed') ? parseFloat(b.value) : null,
            start_date: new Date(b.start_date).toISOString(),
            end_date: new Date(b.end_date).toISOString(),
            max_uses: b.max_uses ? parseInt(b.max_uses) : null,
            current_uses: 0,
            min_amount: b.min_amount ? parseFloat(b.min_amount) : null,
            categories: Array.isArray(b.categories) ? b.categories : [],
            services: Array.isArray(b.services) ? b.services : [],
            status: 'active',
            funding_type: 'merchant',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            bookings_generated: 0,
            revenue_generated: 0
        };
        var all = loadPromotions();
        all.push(promo);
        savePromotions(all);
        res.json({ ok: true, promotion: promo });
    } catch(e) {
        console.error('[PROMO CREATE]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/partner/promotions/:id — modifier une promotion
app.put('/api/partner/promotions/:id', authenticatePartner, (req, res) => {
    try {
        var pid = req.partner.id;
        var all = loadPromotions();
        var idx = all.findIndex(function(p) { return p.id === req.params.id && p.partner_id === pid; });
        if (idx === -1) return res.status(404).json({ error: 'Promotion introuvable' });
        var pr = all[idx];
        var b  = req.body;
        if (b.title       !== undefined) pr.title       = b.title.trim();
        if (b.description !== undefined) pr.description = b.description.trim();
        if (b.type        !== undefined && PROMO_TYPES_ALL.includes(b.type)) pr.type = b.type;
        if (b.value       !== undefined) pr.value       = b.value !== null ? parseFloat(b.value) : null;
        if (b.start_date  !== undefined) pr.start_date  = new Date(b.start_date).toISOString();
        if (b.end_date    !== undefined) pr.end_date    = new Date(b.end_date).toISOString();
        if (b.max_uses    !== undefined) pr.max_uses    = b.max_uses ? parseInt(b.max_uses) : null;
        if (b.min_amount  !== undefined) pr.min_amount  = b.min_amount ? parseFloat(b.min_amount) : null;
        if (b.categories  !== undefined) pr.categories  = Array.isArray(b.categories) ? b.categories : [];
        if (b.services    !== undefined) pr.services    = Array.isArray(b.services) ? b.services : [];
        pr.updated_at = new Date().toISOString();
        all[idx] = pr;
        savePromotions(all);
        res.json({ ok: true, promotion: pr });
    } catch(e) {
        console.error('[PROMO UPDATE]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/partner/promotions/:id/suspend — suspendre / réactiver (bascule)
app.post('/api/partner/promotions/:id/suspend', authenticatePartner, (req, res) => {
    try {
        var pid = req.partner.id;
        var all = loadPromotions();
        var idx = all.findIndex(function(p) { return p.id === req.params.id && p.partner_id === pid; });
        if (idx === -1) return res.status(404).json({ error: 'Promotion introuvable' });
        all[idx].status     = all[idx].status === 'suspended' ? 'active' : 'suspended';
        all[idx].updated_at = new Date().toISOString();
        savePromotions(all);
        res.json({ ok: true, status: all[idx].status });
    } catch(e) {
        console.error('[PROMO SUSPEND]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/partner/promotions/:id — supprimer
app.delete('/api/partner/promotions/:id', authenticatePartner, (req, res) => {
    try {
        var pid = req.partner.id;
        var all = loadPromotions();
        var idx = all.findIndex(function(p) { return p.id === req.params.id && p.partner_id === pid; });
        if (idx === -1) return res.status(404).json({ error: 'Promotion introuvable' });
        all.splice(idx, 1);
        savePromotions(all);
        res.json({ ok: true });
    } catch(e) {
        console.error('[PROMO DELETE]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/promotions — promotions actives publiques (client)
app.get('/api/promotions', (req, res) => {
    try {
        var partner_id = req.query.partner_id || null;
        var category   = req.query.category   || null;
        var type       = req.query.type       || null;
        var max        = Math.min(parseInt(req.query.limit) || 50, 100);
        var all = loadPromotions().filter(function(pr) {
            if (!isPromoActive(pr)) return false;
            if (partner_id && pr.partner_id !== partner_id) return false;
            if (category && pr.categories.length > 0 && !pr.categories.includes(category)) return false;
            if (type && pr.type !== type) return false;
            return true;
        });
        var partners = loadPartners();
        var enriched = all.slice(0, max).map(function(pr) {
            var p = partners.find(function(x) { return x.id === pr.partner_id; });
            return Object.assign({}, pr, {
                partner_name: p ? ((p.prenom || '') + ' ' + (p.nom || '')).trim() : '',
                partner_photo: p ? (p.photo || null) : null,
                partner_type: p ? (p.partner_type || '') : ''
            });
        });
        enriched.sort(function(a, b) { return new Date(a.end_date) - new Date(b.end_date); });
        res.json({ ok: true, promotions: enriched });
    } catch(e) {
        console.error('[PROMOS PUBLIC]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ══════════════════════════════════════════════════════════════
// ── WISE PAYMENT INTEGRATION ──────────────────────────────────
// ══════════════════════════════════════════════════════════════

const WISE_TOKEN = process.env.WISE_API_TOKEN;
const WISE_BASE  = 'https://api.wise.com';
var   _wiseProfileId = null;

async function _wiseGetProfileId() {
    if (_wiseProfileId) return _wiseProfileId;
    const r = await fetch(WISE_BASE + '/v1/profiles', {
        headers: { 'Authorization': 'Bearer ' + WISE_TOKEN }
    });
    const profiles = await r.json();
    if (!Array.isArray(profiles)) throw new Error('Wise: profils non disponibles');
    const biz = profiles.find(function(p) { return p.type === 'BUSINESS'; });
    _wiseProfileId = biz ? biz.id : profiles[0].id;
    return _wiseProfileId;
}

async function _wiseCreateRecipientWithCurrency(profileId, info, currency) {
    const legalType = info.legalType || 'PRIVATE';
    const details = { legalType: legalType, iban: info.iban };
    if (info.bic) details.bic = info.bic;
    const payload = {
        profile: profileId,
        accountHolderName: info.accountHolderName,
        currency: currency,
        type: 'iban',
        details: details
    };
    const r = await fetch(WISE_BASE + '/v1/accounts', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + WISE_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const body = await r.json();
    return { ok: r.ok, status: r.status, body: body };
}

async function _wiseCreateRecipient(profileId, info) {
    const requestedCurrency = info.currency || 'EUR';

    // Essai 1 : devise demandée par le partenaire
    const r1 = await _wiseCreateRecipientWithCurrency(profileId, info, requestedCurrency);
    if (r1.ok) return r1.body;

    // Essai 2 : fallback EUR (Wise SEPA IBAN universel)
    // Cas fréquent : devise locale non-SEPA (MAD, XOF…) rejetée par l'API Wise pour type=iban
    if (requestedCurrency !== 'EUR') {
        console.warn('[WISE RECIPIENT] ' + requestedCurrency + ' failed (HTTP ' + r1.status + '), retrying with EUR. Error: ' + JSON.stringify(r1.body));
        const r2 = await _wiseCreateRecipientWithCurrency(profileId, info, 'EUR');
        if (r2.ok) {
            console.log('[WISE RECIPIENT] EUR fallback succeeded for', info.iban);
            return r2.body;
        }
        console.error('[WISE RECIPIENT ERROR] Both ' + requestedCurrency + ' and EUR failed. EUR error: HTTP ' + r2.status, JSON.stringify(r2.body));
        throw new Error('Wise API ' + r1.status + ' (' + requestedCurrency + '): ' + JSON.stringify(r1.body));
    }

    console.error('[WISE RECIPIENT ERROR] HTTP', r1.status, JSON.stringify(r1.body));
    throw new Error('Wise API ' + r1.status + ': ' + JSON.stringify(r1.body));
}

async function _wiseTransfer(profileId, recipientId, amount, currency, reference) {
    // 1) Quote
    const qr = await fetch(WISE_BASE + '/v2/quotes', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + WISE_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCurrency: 'EUR', targetCurrency: currency || 'EUR', sourceAmount: amount, profile: profileId })
    });
    const quote = await qr.json();
    if (!quote.id) throw new Error('Wise quote error: ' + JSON.stringify(quote));

    // 2) Transfer
    const tr = await fetch(WISE_BASE + '/v1/transfers', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + WISE_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            targetAccount: recipientId,
            quoteUuid: quote.id,
            customerTransactionId: require('crypto').randomBytes(16).toString('hex'),
            details: { reference: reference || 'Paiement FA GENESIS' }
        })
    });
    const transfer = await tr.json();
    if (!transfer.id) throw new Error('Wise transfer error: ' + JSON.stringify(transfer));

    // 3) Fund (peut nécessiter confirmation manuelle SCA dans l'app Wise si 2FA actif)
    const fr = await fetch(WISE_BASE + '/v3/profiles/' + profileId + '/transfers/' + transfer.id + '/payments', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + WISE_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'BALANCE' })
    });
    const fund = await fr.json();

    return { quoteId: quote.id, transferId: transfer.id, status: fund.status || transfer.status, fund };
}

// ── Partenaire : enregistrer ses coordonnées bancaires ────────

app.post('/api/partner/bank-details', authenticatePartner, async function(req, res) {
    try {
        var b = req.body;
        if (!b.accountHolderName || !b.iban) return res.status(400).json({ error: 'Nom du titulaire et IBAN requis' });
        var iban = (b.iban || '').replace(/\s/g, '').toUpperCase();

        var partners = loadPartners();
        var idx = partners.findIndex(function(p) { return p.id === req.partner.id; });
        if (idx === -1) return res.status(404).json({ error: 'Partenaire introuvable' });

        // Créer le récipiendaire Wise si token configuré
        var wiseRecipientId = partners[idx].wiseRecipientId || null;
        var wiseError = null;
        if (WISE_TOKEN) {
            try {
                var profileId = await _wiseGetProfileId();
                var recipient = await _wiseCreateRecipient(profileId, {
                    accountHolderName: b.accountHolderName,
                    iban: iban,
                    bic: b.bic || '',
                    currency: b.currency || 'EUR',
                    legalType: b.legalType || 'PRIVATE'
                });
                if (recipient.id) {
                    wiseRecipientId = recipient.id;
                    console.log('[WISE] Récipiendaire créé:', wiseRecipientId, 'pour', partners[idx].email);
                }
            } catch(wiseErr) {
                wiseError = wiseErr.message;
                console.error('[WISE RECIPIENT]', wiseErr.message);
            }
        }

        partners[idx].bankDetails = {
            accountHolderName: b.accountHolderName,
            iban: iban,
            bic: b.bic || '',
            currency: b.currency || 'EUR',
            country: b.country || '',
            updatedAt: new Date().toISOString()
        };
        if (wiseRecipientId) partners[idx].wiseRecipientId = wiseRecipientId;
        savePartners(partners);

        res.json({ ok: true, wiseLinked: !!wiseRecipientId, wiseError: wiseError || undefined });
    } catch(e) {
        console.error('[BANK DETAILS]', e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ── Partenaire : consulter ses coordonnées bancaires ──────────

app.get('/api/partner/bank-details', authenticatePartner, function(req, res) {
    var partners = loadPartners();
    var p = partners.find(function(x) { return x.id === req.partner.id; });
    if (!p) return res.status(404).json({ error: 'Introuvable' });
    var bd = p.bankDetails || null;
    // Masquer l'IBAN sauf les 4 derniers chiffres
    var masked = null;
    if (bd) {
        masked = Object.assign({}, bd);
        if (masked.iban && masked.iban.length > 4) {
            masked.iban = '•••• •••• •••• ' + masked.iban.slice(-4);
        }
    }
    res.json({ ok: true, bankDetails: masked, wiseLinked: !!p.wiseRecipientId });
});

// ── Admin : vérifier le solde Wise ───────────────────────────

app.get('/api/admin/wise/balance', async function(req, res) {
    try {
        if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
        if (!WISE_TOKEN) return res.status(503).json({ error: 'Wise non configuré' });
        var profileId = await _wiseGetProfileId();
        var r = await fetch(WISE_BASE + '/v4/profiles/' + profileId + '/balances?types=STANDARD', {
            headers: { 'Authorization': 'Bearer ' + WISE_TOKEN }
        });
        var data = await r.json();
        res.json({ ok: true, balances: data });
    } catch(e) {
        console.error('[WISE BALANCE]', e.message);
        res.status(500).json({ error: 'Erreur Wise: ' + e.message });
    }
});

// ── Admin : déclencher un virement Wise vers un prestataire ──

app.post('/api/admin/wise/payout', async function(req, res) {
    try {
        if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
        if (!WISE_TOKEN) return res.status(503).json({ error: 'Wise non configuré' });

        var b = req.body;
        if (!b.partnerEmail || !b.amount || b.amount <= 0) {
            return res.status(400).json({ error: 'partnerEmail et amount requis' });
        }

        var partners = loadPartners();
        var partner = partners.find(function(p) { return p.email === b.partnerEmail; });
        if (!partner) return res.status(404).json({ error: 'Prestataire introuvable' });
        if (!partner.wiseRecipientId) return res.status(400).json({ error: 'Ce prestataire n\'a pas encore enregistré ses coordonnées bancaires' });

        var profileId = await _wiseGetProfileId();
        var currency = (partner.bankDetails && partner.bankDetails.currency) || 'EUR';
        var reference = b.reference || ('Paiement ' + (partner.prenom || '') + ' ' + (partner.nom || '') + ' – FA GENESIS').trim();

        var result = await _wiseTransfer(profileId, partner.wiseRecipientId, parseFloat(b.amount), currency, reference);

        // Enregistrer le payout dans payouts.json
        var payouts = loadPayouts();
        payouts.push({
            id: 'wise_' + Date.now(),
            partner_id: partner.id,
            partnerEmail: partner.email,
            amount: parseFloat(b.amount),
            currency: currency,
            reference: reference,
            wiseTransferId: result.transferId,
            wiseQuoteId: result.quoteId,
            status: result.status || 'processing',
            method: 'wise',
            createdAt: new Date().toISOString(),
            order_id: b.orderId || null,
            stage: b.stage || null
        });
        savePayouts(payouts);

        res.json({ ok: true, transferId: result.transferId, status: result.status, note: result.status === 'processing' ? 'Virement en cours – confirmez dans l\'app Wise si la 2FA est activée' : undefined });
    } catch(e) {
        console.error('[WISE PAYOUT]', e.message);
        res.status(500).json({ error: 'Erreur virement Wise: ' + e.message });
    }
});

// ── Admin : liste des prestataires avec statut Wise ──────────

app.get('/api/admin/wise/partners-status', function(req, res) {
    try {
        if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
        var partners = loadPartners();
        var result = partners.map(function(p) {
            return {
                id: p.id,
                email: p.email,
                name: ((p.prenom || '') + ' ' + (p.nom || '')).trim(),
                wiseLinked: !!p.wiseRecipientId,
                currency: p.bankDetails ? p.bankDetails.currency : null,
                bankUpdatedAt: p.bankDetails ? p.bankDetails.updatedAt : null
            };
        });
        res.json({ ok: true, partners: result });
    } catch(e) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ── Admin : re-créer le destinataire Wise pour un partenaire ─
app.post('/api/admin/wise/retry-recipient/:partnerId', async function(req, res) {
    try {
        if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
        if (!WISE_TOKEN) return res.status(503).json({ error: 'WISE_API_TOKEN non configuré' });
        var partners = loadPartners();
        var idx = partners.findIndex(function(p) { return p.id === req.params.partnerId; });
        if (idx === -1) return res.status(404).json({ error: 'Partenaire introuvable' });
        var bd = partners[idx].bankDetails;
        if (!bd || !bd.iban) return res.status(400).json({ error: 'Aucun IBAN enregistré pour ce partenaire' });
        var profileId = await _wiseGetProfileId();
        var recipient = await _wiseCreateRecipient(profileId, {
            accountHolderName: bd.accountHolderName,
            iban: bd.iban,
            bic: bd.bic || '',
            currency: bd.currency || 'EUR',
            legalType: 'PRIVATE'
        });
        if (!recipient.id) return res.status(500).json({ error: 'Wise n\'a pas retourné d\'ID', details: recipient });
        partners[idx].wiseRecipientId = recipient.id;
        partners[idx].updatedAt = new Date().toISOString();
        savePartners(partners);
        res.json({ ok: true, wiseRecipientId: recipient.id, partnerEmail: partners[idx].email });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Admin : diagnostiquer Wise pour tous les partenaires avec IBAN ─
app.get('/api/admin/wise/iban-status', async function(req, res) {
    try {
        if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
        var partners = loadPartners();
        var result = partners
            .filter(function(p) { return p.bankDetails && p.bankDetails.iban; })
            .map(function(p) {
                return {
                    id: p.id,
                    email: p.email,
                    name: p.bankDetails.accountHolderName,
                    iban: p.bankDetails.iban,
                    currency: p.bankDetails.currency || 'EUR',
                    wiseRecipientId: p.wiseRecipientId || null,
                    wiseLinked: !!p.wiseRecipientId
                };
            });
        res.json({ ok: true, count: result.length, partners: result });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Admin : retry Wise pour tous les partenaires sans wiseRecipientId ─
app.post('/api/admin/wise/retry-all', async function(req, res) {
    try {
        if (!_isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
        if (!WISE_TOKEN) return res.status(503).json({ error: 'WISE_API_TOKEN non configuré' });
        var partners = loadPartners();
        var toRetry = partners.filter(function(p) { return p.bankDetails && p.bankDetails.iban && !p.wiseRecipientId; });
        var profileId = await _wiseGetProfileId();
        var results = [];
        for (var i = 0; i < toRetry.length; i++) {
            var p = toRetry[i];
            var bd = p.bankDetails;
            try {
                var recipient = await _wiseCreateRecipient(profileId, {
                    accountHolderName: bd.accountHolderName,
                    iban: bd.iban,
                    bic: bd.bic || '',
                    currency: bd.currency || 'EUR',
                    legalType: 'PRIVATE'
                });
                var pidx = partners.findIndex(function(x) { return x.id === p.id; });
                if (pidx !== -1) { partners[pidx].wiseRecipientId = recipient.id; }
                results.push({ email: p.email, ok: true, wiseRecipientId: recipient.id });
            } catch(err) {
                results.push({ email: p.email, ok: false, error: err.message });
            }
        }
        savePartners(partners);
        res.json({ ok: true, processed: results.length, results: results });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Route inconnue (404) — doit rester APRÈS toutes les routes app.get/post/put/delete
app.use((req, res) => {
    res.status(404).json({ error: 'Route introuvable' });
});

});

