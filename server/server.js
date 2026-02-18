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
const PDFDocument = require('pdfkit');

const { getProductById, calculatePaymentAmounts, getAmountForStage } = require('./products');
const emailService = require('./email-service');
const { OFFER_BLUEPRINTS, getOfferBlueprint, getAllOfferKeys } = require('./config/offerBlueprints');
const { fillTemplate, getAvailableTemplates, getTemplate } = require('./config/documentTemplates');
const aiService = require('./services/aiService');
const bootstrapService = require('./services/bootstrapService');
const persistentStore = require('./persistent-store');

const app = express();
const PORT = process.env.PORT || 3001;

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

// Creer le dossier data s'il n'existe pas
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
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
        const partner = partners.find(p => p.sessionToken === token);
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
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        'https://fagenesis.com',
        'https://www.fagenesis.com',
        'https://financialadvicegenesis.github.io',
        process.env.FRONT_URL
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parser JSON (limite augmentee pour supporter les fichiers base64)
app.use(express.json({ limit: '50mb' }));

// Logger les requetes
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

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

function getOrderById(orderId) {
    const orders = loadOrders();
    return orders.find(o => o.id === orderId) || null;
}

function updateOrder(orderId, updates) {
    const orders = loadOrders();
    const index = orders.findIndex(o => o.id === orderId);
    if (index === -1) return null;

    orders[index] = { ...orders[index], ...updates, updated_at: new Date().toISOString() };
    saveOrders(orders);
    return orders[index];
}

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
        var authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'Token manquant' });
        }
        var token = authHeader.split(' ')[1];

        // 2. Trouver l'utilisateur par sessionToken
        var users = loadUsers();
        var user = users.find(function(u) { return u.sessionToken === token; });
        if (!user) {
            return res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'Session invalide ou expiree' });
        }

        // 3. Trouver les commandes du client
        var orders = loadOrders();
        var clientOrders = orders.filter(function(o) {
            return o.client_info && o.client_info.email && o.client_info.email.toLowerCase() === user.email.toLowerCase();
        });

        // 4. Trouver la commande payee (acompte)
        var paidOrder = null;
        var pendingOrder = null;
        for (var i = 0; i < clientOrders.length; i++) {
            if (clientOrders[i].deposit_paid === true && !paidOrder) {
                paidOrder = clientOrders[i];
            }
            if (!clientOrders[i].deposit_paid && !pendingOrder) {
                pendingOrder = clientOrders[i];
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
                    paymentStatus: user.paymentStatus || 'registered',
                    activeOfferId: user.activeOfferId || user.offre || null,
                    productType: user.productType || null
                },
                pendingOrder: pendingOrder ? {
                    id: pendingOrder.id,
                    product_name: pendingOrder.product_name || '',
                    product_type: pendingOrder.product_type || 'accompagnement',
                    product_id: pendingOrder.product_id || '',
                    deposit_amount: pendingOrder.deposit_amount || 0,
                    source: pendingOrder.source || '',
                    quote_id: pendingOrder.quote_id || null
                } : null,
                project: null,
                timeline: [],
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
        res.json({
            ok: true,
            status: 'ACTIVE',
            user: {
                email: user.email,
                prenom: user.prenom || '',
                nom: user.nom || '',
                paymentStatus: paidOrder.balance_paid ? 'fully_paid' : 'deposit_paid',
                activeOfferId: user.activeOfferId || user.offre || paidOrder.product_id || null,
                productType: paidOrder.product_type || user.productType || 'accompagnement'
            },
            order: {
                id: paidOrder.id,
                product_name: paidOrder.product_name || '',
                product_type: paidOrder.product_type || 'accompagnement',
                product_id: paidOrder.product_id || '',
                deposit_paid: true,
                balance_paid: paidOrder.balance_paid || false,
                deposit_amount: paidOrder.deposit_amount || 0,
                total_amount: paidOrder.total_amount || 0,
                start_date: paidOrder.start_date || null,
                schedule_status: paidOrder.schedule_status || null,
                proposed_start_date: paidOrder.proposed_start_date || null,
                status: paidOrder.status || 'active'
            },
            progress: {
                currentDay: dayInfo.currentDay,
                totalDays: dayInfo.totalDays,
                isComplete: dayInfo.isComplete
            },
            access: accessRights,
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
 * Body: { productId, clientInfo }
 * Response: { orderId, deposit_amount, balance_amount, total_amount }
 */
app.post('/api/orders/create', (req, res) => {
    try {
        const { productId, clientInfo } = req.body;

        // Validation
        if (!productId) {
            return res.status(400).json({ error: 'productId requis' });
        }

        if (!clientInfo || !clientInfo.email || !clientInfo.firstName || !clientInfo.lastName) {
            return res.status(400).json({ error: 'Informations client incompletes (email, firstName, lastName requis)' });
        }

        // Recuperer le produit
        const product = getProductById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Produit non trouve' });
        }

        // Calculer les montants cote serveur (SECURITE)
        const amounts = calculatePaymentAmounts(product.total_price);

        // Creer la commande
        const order = {
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
            total_amount: amounts.total_amount,
            deposit_amount: amounts.deposit_amount,
            balance_amount: amounts.balance_amount,
            deposit_paid: false,
            balance_paid: false,
            duration_days: product.duration_days || parseDurationToDays(product.duration),
            start_date: null,
            status: 'pending_deposit', // pending_deposit, active, pending_balance, paid_in_full, cancelled
            checkout_id: null,
            transaction_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Sauvegarder
        const orders = loadOrders();
        orders.push(order);
        saveOrders(orders);

        console.log(`[ORDER] Commande creee: ${order.id} - ${product.name} - ${amounts.total_amount}EUR`);

        res.json({
            success: true,
            orderId: order.id,
            deposit_amount: order.deposit_amount,
            balance_amount: order.balance_amount,
            total_amount: order.total_amount
        });

    } catch (error) {
        console.error('Erreur creation commande:', error);
        res.status(500).json({ error: 'Erreur lors de la creation de la commande' });
    }
});

/**
 * GET /api/orders/:orderId
 * Recuperer une commande par son ID
 */
app.get('/api/orders/:orderId', (req, res) => {
    const order = getOrderById(req.params.orderId);

    if (!order) {
        return res.status(404).json({ error: 'Commande non trouvee' });
    }

    res.json(order);
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

        if (!stage || !['deposit', 'balance'].includes(stage)) {
            return res.status(400).json({ error: 'stage doit etre "deposit" ou "balance"' });
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

        if (stage === 'balance' && !order.deposit_paid) {
            return res.status(400).json({ error: 'L\'acompte doit etre paye avant le solde' });
        }

        if (stage === 'balance' && order.balance_paid) {
            return res.status(400).json({ error: 'Solde deja paye' });
        }

        // Determiner le montant
        const amount = stage === 'deposit' ? order.deposit_amount : order.balance_amount;
        const stageLabel = stage === 'deposit' ? 'Acompte 30%' : 'Solde 70%';

        // Construire les URLs de retour
        const successUrl = process.env.SUMUP_SUCCESS_URL || 'https://fagenesis.com/payment-success.html';
        const failureUrl = process.env.SUMUP_FAILURE_URL || 'https://fagenesis.com/payment-failure.html';
        const returnUrl = `${successUrl}?order=${orderId}&stage=${stage}`;

        // Creer le checkout SumUp (widget mode - SumUpCard.mount utilise checkout_id)
        const checkoutData = {
            checkout_reference: `${orderId}-${stage}`,
            amount: amount,
            currency: 'EUR',
            pay_to_email: process.env.SUMUP_PAY_TO_EMAIL,
            description: `FA GENESIS - ${order.product_name} (${stageLabel})`,
            return_url: returnUrl,
            merchant_code: process.env.SUMUP_MERCHANT_CODE
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
        // Format: ORD-XXXXX-deposit ou ORD-XXXXX-balance
        const parts = checkout_reference ? checkout_reference.split('-') : [];
        const stage = parts.pop(); // 'deposit' ou 'balance'
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
                console.log(`[WEBHOOK] Solde payé - Commande complète`);
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
                        if (stage === 'deposit') {
                            users[userIdx].paymentStatus = 'deposit_paid';
                            users[userIdx].payment_status = 'deposit_paid';
                        } else if (stage === 'balance') {
                            users[userIdx].paymentStatus = 'fully_paid';
                            users[userIdx].payment_status = 'fully_paid';
                        }
                        users[userIdx].activeOrderId = orderId;
                        saveUsers(users);
                        console.log('[WEBHOOK] users.json mis à jour: ' + updatedOrder.client_info.email + ' → paymentStatus=' + (stage === 'deposit' ? 'deposit_paid' : 'fully_paid'));
                    } else {
                        console.log('[WEBHOOK] Utilisateur non trouvé dans users.json: ' + updatedOrder.client_info.email);
                    }
                } catch (syncErr) {
                    console.error('[WEBHOOK] Erreur sync users.json (non-bloquant):', syncErr.message);
                }
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

                    emailService.sendRegistrationConfirmation(
                        clientEmail,
                        updatedOrder.client_info.first_name,
                        offerData
                    ).then(result => {
                        if (result.success) {
                            console.log(`[WEBHOOK] Email de bienvenue envoyé à ${clientEmail}`);
                        }
                    }).catch(err => console.error('[WEBHOOK] Erreur envoi email bienvenue:', err));

                    // Auto-assigner un partenaire pour les prestations individuelles
                    try {
                        var productId = updatedOrder.product_id || '';
                        var partnerTypeMap = { 'photo': 'photographer', 'video': 'videographer', 'marketing': 'marketer', 'media': 'media' };
                        var prefix = productId.split('-')[0];
                        var neededType = partnerTypeMap[prefix];
                        if (neededType) {
                            var allPartners = loadPartners();
                            var availablePartner = allPartners.find(function(p) {
                                return p.partner_type === neededType && p.status === 'active';
                            });
                            if (availablePartner) {
                                var assignments = loadPartnerAssignments();
                                var alreadyAssigned = assignments.find(function(a) {
                                    return a.order_id === orderId && a.status === 'active';
                                });
                                if (!alreadyAssigned) {
                                    var assignment = {
                                        id: 'ASG-' + uuidv4().split('-')[0],
                                        partner_id: availablePartner.id,
                                        partner_email: availablePartner.email,
                                        partner_type: availablePartner.partner_type,
                                        order_id: orderId,
                                        assigned_at: new Date().toISOString(),
                                        assigned_by: 'system-auto-tarif',
                                        status: 'active',
                                        notes: 'Auto-assigne depuis tarif ' + productId
                                    };
                                    assignments.push(assignment);
                                    savePartnerAssignments(assignments);
                                    console.log('[WEBHOOK] Partenaire ' + availablePartner.email + ' auto-assigne a la commande ' + orderId);
                                }
                            }
                        }
                    } catch (autoAssignErr) {
                        console.error('[WEBHOOK] Erreur auto-assignation partenaire:', autoAssignErr);
                    }

                    // NOTE: Le bootstrap projet est maintenant declenche par finalizeSchedule()
                    // apres que le client ait choisi une date ET que admin+partenaire aient confirme
                    console.log('[WEBHOOK] Bootstrap reporte - en attente choix date client');

                } else if (stage === 'balance') {
                    // Après paiement du solde : envoyer la confirmation de paiement complet
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

        if (!orderId || !stage) {
            return res.status(400).json({ error: 'orderId et stage requis' });
        }

        const order = getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvee' });
        }

        // Si pas de checkout_id, on ne peut pas verifier
        if (!order.checkout_id) {
            return res.json({
                success: false,
                order: order,
                message: 'Aucun checkout associe'
            });
        }

        // Verifier le statut aupres de SumUp
        try {
            const checkoutStatus = await callSumUpAPI(`/checkouts/${order.checkout_id}`, 'GET');

            if (checkoutStatus.status === 'PAID') {
                // Mettre a jour la commande
                const updates = {
                    transaction_id: checkoutStatus.transaction_id || checkoutStatus.transaction_code
                };

                let isNewPayment = false;
                let paymentStage = null;

                if (stage === 'deposit' && !order.deposit_paid) {
                    updates.deposit_paid = true;
                    updates.status = 'active';
                    updates.start_date = null;
                    updates.schedule_status = 'awaiting_client_choice';
                    updates.proposed_start_date = null;
                    updates.schedule_confirmed_by_admin = false;
                    updates.schedule_confirmed_by_partner = false;
                    isNewPayment = true;
                    paymentStage = 'deposit';
                } else if (stage === 'balance' && !order.balance_paid) {
                    updates.balance_paid = true;
                    updates.status = 'paid_in_full';
                    isNewPayment = true;
                    paymentStage = 'balance';
                }

                const updatedOrder = updateOrder(orderId, updates);

                // Synchroniser users.json
                if (isNewPayment && updatedOrder && updatedOrder.client_info && updatedOrder.client_info.email) {
                    try {
                        var allUsers = loadUsers();
                        var uIdx = allUsers.findIndex(function(u) {
                            return u.email && u.email.toLowerCase() === updatedOrder.client_info.email.toLowerCase();
                        });
                        if (uIdx !== -1) {
                            var newStatus = paymentStage === 'deposit' ? 'deposit_paid' : 'fully_paid';
                            allUsers[uIdx].paymentStatus = newStatus;
                            allUsers[uIdx].payment_status = newStatus;
                            allUsers[uIdx].activeOrderId = orderId;
                            saveUsers(allUsers);
                            console.log('[VERIFY] users.json sync: ' + updatedOrder.client_info.email + ' → ' + newStatus);
                        }
                    } catch (syncErr) {
                        console.error('[VERIFY] Erreur sync users.json:', syncErr.message);
                    }
                }

                // Envoyer les emails appropriés si nouveau paiement
                if (isNewPayment && updatedOrder && updatedOrder.client_info) {
                    const clientEmail = updatedOrder.client_info.email;
                    const clientName = `${updatedOrder.client_info.first_name} ${updatedOrder.client_info.last_name}`;

                    if (paymentStage === 'deposit') {
                        // Après paiement de l'acompte : envoyer l'email de bienvenue
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

                        emailService.sendRegistrationConfirmation(
                            clientEmail,
                            updatedOrder.client_info.first_name,
                            offerData
                        ).then(result => {
                            if (result.success) {
                                console.log(`[VERIFY] Email de bienvenue envoyé à ${clientEmail}`);
                            }
                        }).catch(err => console.error('[VERIFY] Erreur envoi email bienvenue:', err));

                        // Auto-assigner un partenaire pour les prestations individuelles
                        try {
                            var productId = updatedOrder.product_id || '';
                            var partnerTypeMap = { 'photo': 'photographer', 'video': 'videographer', 'marketing': 'marketer', 'media': 'media' };
                            var prefix = productId.split('-')[0];
                            var neededType = partnerTypeMap[prefix];
                            if (neededType) {
                                var allPartners = loadPartners();
                                var availablePartner = allPartners.find(function(p) {
                                    return p.partner_type === neededType && p.status === 'active';
                                });
                                if (availablePartner) {
                                    var assignments = loadPartnerAssignments();
                                    var alreadyAssigned = assignments.find(function(a) {
                                        return a.order_id === orderId && a.status === 'active';
                                    });
                                    if (!alreadyAssigned) {
                                        var assignment = {
                                            id: 'ASG-' + uuidv4().split('-')[0],
                                            partner_id: availablePartner.id,
                                            partner_email: availablePartner.email,
                                            partner_type: availablePartner.partner_type,
                                            order_id: orderId,
                                            assigned_at: new Date().toISOString(),
                                            assigned_by: 'system-auto-tarif',
                                            status: 'active',
                                            notes: 'Auto-assigne depuis tarif ' + productId
                                        };
                                        assignments.push(assignment);
                                        savePartnerAssignments(assignments);
                                        console.log('[VERIFY] Partenaire ' + availablePartner.email + ' auto-assigne a la commande ' + orderId);
                                    }
                                }
                            }
                        } catch (autoAssignErr) {
                            console.error('[VERIFY] Erreur auto-assignation partenaire:', autoAssignErr);
                        }

                        // NOTE: Le bootstrap projet est maintenant declenche par finalizeSchedule()
                        // apres que le client ait choisi une date ET que admin+partenaire aient confirme
                        console.log('[VERIFY] Bootstrap reporte - en attente choix date client');

                    } else if (paymentStage === 'balance') {
                        // Après paiement du solde : confirmation de paiement complet
                        emailService.sendPaymentConfirmation(
                            clientEmail,
                            clientName,
                            updatedOrder
                        ).then(result => {
                            if (result.success) {
                                console.log(`[VERIFY] Email de paiement envoyé à ${clientEmail}`);
                            }
                        }).catch(err => console.error('[VERIFY] Erreur envoi email paiement:', err));
                    }
                }

                return res.json({
                    success: true,
                    paid: true,
                    order: updatedOrder
                });
            }

            return res.json({
                success: true,
                paid: false,
                checkout_status: checkoutStatus.status,
                order: order
            });

        } catch (sumupError) {
            console.error('Erreur verification SumUp:', sumupError);

            // Retourner l'etat actuel de la commande
            return res.json({
                success: false,
                order: order,
                message: 'Impossible de verifier aupres de SumUp'
            });
        }

    } catch (error) {
        console.error('Erreur verification paiement:', error);
        res.status(500).json({ error: 'Erreur lors de la verification' });
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
        balance_message: null
    };

    // Pas d'acompte paye = pas d'acces
    if (!order.deposit_paid) {
        rights.balance_message = 'Veuillez payer l\'acompte de 30% pour acceder a votre espace client.';
        return rights;
    }

    // Acompte paye = acces au dashboard
    rights.can_access_dashboard = true;

    if (order.product_type === 'accompagnement') {
        // CAS A: Offres d'accompagnement
        rights.can_view_parcours = true;
        rights.can_view_livrables_preview = true;
        rights.can_book_sessions = true;

        // Le telechargement est toujours possible pour les accompagnements
        // (documents journaliers, etc.)
        rights.can_download_livrables = true;

        // Si l'accompagnement est termine mais solde non paye
        if (order.status === 'completed' && !order.balance_paid) {
            rights.balance_required = true;
            rights.balance_message = 'Votre accompagnement est termine. Payez le solde de 70% pour finaliser.';
        }

        // Si tout est paye
        if (order.balance_paid) {
            rights.balance_message = 'Paiement complet - Acces total a tous vos contenus.';
        }

    } else if (order.product_type === 'prestation_individuelle') {
        // CAS B: Prestations individuelles (photo/video/media/marketing)
        rights.can_view_parcours = false;
        rights.can_book_sessions = false;

        // Preview toujours possible apres acompte
        rights.can_view_livrables_preview = true;

        // Telechargement uniquement si solde paye
        rights.can_download_livrables = order.balance_paid;

        // Si livrables prets mais solde non paye
        if (order.status === 'delivered' && !order.balance_paid) {
            rights.balance_required = true;
            rights.balance_message = 'Vos livrables sont prêts ! Payez le solde de 70% pour télécharger les fichiers originaux.';
        }

        // Si tout est paye
        if (order.balance_paid) {
            rights.balance_message = 'Paiement complet - Telechargement des fichiers originaux disponible.';
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
    const orderLivrables = allLivrables.filter(l => l.order_id === req.params.orderId);

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
        var user = users.find(function(u) { return u.sessionToken === token; });
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

        var updates = {
            proposed_start_date: proposedDate,
            schedule_status: 'client_proposed',
            schedule_confirmed_by_admin: false,
            schedule_confirmed_by_partner: false
        };

        var updatedOrder = updateOrder(req.params.orderId, updates);
        console.log('[SCHEDULE] Client ' + user.email + ' propose date: ' + proposedDate + ' pour ' + req.params.orderId);

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
            return o.schedule_status === 'client_proposed';
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

        var updates = { schedule_confirmed_by_admin: true };
        var finalized = false;

        // Verifier si les deux ont confirme (ou pas de partenaire)
        var partnerNeeded = hasAssignedPartner(order.id);
        if (!partnerNeeded || order.schedule_confirmed_by_partner) {
            finalized = true;
        }

        var updatedOrder = updateOrder(req.params.orderId, updates);
        console.log('[SCHEDULE] Admin confirme date pour ' + req.params.orderId + ' (finalized: ' + finalized + ')');

        if (finalized) {
            updatedOrder = finalizeSchedule(updatedOrder);
        }

        res.json({ success: true, order: updatedOrder, finalized: finalized });
    } catch (error) {
        console.error('[SCHEDULE] Erreur confirm-schedule admin:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/partner/pending-schedules
 * Liste des commandes assignees au partenaire en attente de confirmation
 */
app.get('/api/partner/pending-schedules', authenticatePartner, function(req, res) {
    try {
        var partner = req.partner;
        var assignments = loadPartnerAssignments().filter(function(a) {
            return a.partner_id === partner.id && a.status === 'active';
        });

        var orders = loadOrders();
        var pending = [];
        for (var i = 0; i < assignments.length; i++) {
            var order = orders.find(function(o) { return o.id === assignments[i].order_id; });
            if (order && order.schedule_status === 'client_proposed') {
                pending.push(order);
            }
        }

        res.json({ orders: pending });
    } catch (error) {
        console.error('[SCHEDULE] Erreur partner pending-schedules:', error);
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
        if (order.schedule_status !== 'client_proposed') {
            return res.status(400).json({ error: 'Pas de date proposee a confirmer' });
        }

        // Verifier que le partenaire est bien assigne a cette commande
        var assignments = loadPartnerAssignments();
        var isAssigned = assignments.some(function(a) {
            return a.partner_id === partner.id && a.order_id === order.id && a.status === 'active';
        });
        if (!isAssigned) return res.status(403).json({ error: 'Vous n\'etes pas assigne a cette commande' });

        var updates = { schedule_confirmed_by_partner: true };
        var finalized = false;

        if (order.schedule_confirmed_by_admin) {
            finalized = true;
        }

        var updatedOrder = updateOrder(req.params.orderId, updates);
        console.log('[SCHEDULE] Partenaire ' + partner.email + ' confirme date pour ' + req.params.orderId + ' (finalized: ' + finalized + ')');

        if (finalized) {
            updatedOrder = finalizeSchedule(updatedOrder);
        }

        res.json({ success: true, order: updatedOrder, finalized: finalized });
    } catch (error) {
        console.error('[SCHEDULE] Erreur confirm-schedule partenaire:', error);
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
app.get('/api/admin/users', (req, res) => {
    const users = loadUsers();
    const safeUsers = users.map(u => {
        const { password, ...rest } = u;
        return rest;
    });
    // Trier par date d'inscription decroissante
    safeUsers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json(safeUsers);
});

/**
 * GET /api/admin/users/:email
 * Recuperer un utilisateur specifique (Admin)
 */
app.get('/api/admin/users/:email', (req, res) => {
    const user = getUserByEmail(decodeURIComponent(req.params.email));
    if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouve' });
    }
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
});

/**
 * GET /api/admin/stats
 * Statistiques globales du dashboard admin
 */
app.get('/api/admin/stats', (req, res) => {
    const users = loadUsers();
    const orders = loadOrders();
    const messages = loadMessages();

    const totalRevenue = orders.reduce((sum, o) => {
        let revenue = 0;
        if (o.deposit_paid) revenue += (o.deposit_amount || 0);
        if (o.balance_paid) revenue += (o.balance_amount || 0);
        return sum + revenue;
    }, 0);

    res.json({
        totalClients: users.length,
        registered: users.filter(u => u.paymentStatus === 'registered').length,
        depositPaid: users.filter(u => u.paymentStatus === 'deposit_paid').length,
        fullyPaid: users.filter(u => u.paymentStatus === 'fully_paid').length,
        totalOrders: orders.length,
        totalRevenue: totalRevenue,
        unreadMessages: messages.filter(m => m.status === 'unread').length,
        totalMessages: messages.length
    });
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
        const { name, email, phone, profil, subject, message, service_type } = req.body;

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
app.get('/api/admin/messages', (req, res) => {
    const messages = loadMessages();
    // Trier par date decroissante (plus recents en premier)
    messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(messages);
});

/**
 * GET /api/admin/messages/stats (Admin)
 * Statistiques des messages
 * IMPORTANT: Cette route doit etre AVANT /:messageId pour eviter le conflit
 */
app.get('/api/admin/messages/stats', (req, res) => {
    const messages = loadMessages();

    const stats = {
        total: messages.length,
        unread: messages.filter(m => m.status === 'unread').length,
        read: messages.filter(m => m.status === 'read').length,
        replied: messages.filter(m => m.status === 'replied').length,
        archived: messages.filter(m => m.status === 'archived').length,
        today: messages.filter(m => {
            const today = new Date().toDateString();
            return new Date(m.created_at).toDateString() === today;
        }).length
    };

    res.json(stats);
});

/**
 * GET /api/admin/messages/:messageId (Admin)
 * Recuperer un message specifique et le marquer comme lu
 */
app.get('/api/admin/messages/:messageId', (req, res) => {
    const messages = loadMessages();
    const index = messages.findIndex(m => m.id === req.params.messageId);

    if (index === -1) {
        return res.status(404).json({ error: 'Message non trouve' });
    }

    // Marquer comme lu
    if (messages[index].status === 'unread') {
        messages[index].status = 'read';
        messages[index].updated_at = new Date().toISOString();
        saveMessages(messages);
    }

    res.json(messages[index]);
});

/**
 * PUT /api/admin/messages/:messageId/status (Admin)
 * Mettre a jour le statut d'un message
 */
app.put('/api/admin/messages/:messageId/status', (req, res) => {
    const { status } = req.body;
    const validStatuses = ['unread', 'read', 'replied', 'archived'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Statut invalide', valid_statuses: validStatuses });
    }

    const messages = loadMessages();
    const index = messages.findIndex(m => m.id === req.params.messageId);

    if (index === -1) {
        return res.status(404).json({ error: 'Message non trouve' });
    }

    messages[index].status = status;
    messages[index].updated_at = new Date().toISOString();
    saveMessages(messages);

    res.json({ success: true, message: messages[index] });
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
app.delete('/api/admin/messages/:messageId', (req, res) => {
    const messages = loadMessages();
    const index = messages.findIndex(m => m.id === req.params.messageId);

    if (index === -1) {
        return res.status(404).json({ error: 'Message non trouve' });
    }

    const deleted = messages.splice(index, 1)[0];
    saveMessages(messages);

    console.log(`[CONTACT] Message supprime: ${deleted.id}`);

    res.json({ success: true, deleted: deleted });
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
        const { prenom, nom, email, telephone, password, offre } = req.body;

        // Validation des champs requis
        if (!prenom || !nom || !email || !password) {
            return res.status(400).json({
                error: 'Champs requis manquants',
                required: ['prenom', 'nom', 'email', 'password']
            });
        }

        // Validation email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Format d\'email invalide' });
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

        // Generer un token de session
        const sessionToken = generateSessionToken();

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

        // Creer l'utilisateur
        const newUser = {
            id: `USR-${uuidv4().split('-')[0].toUpperCase()}`,
            prenom: prenom.trim(),
            nom: nom.trim(),
            email: email.trim().toLowerCase(),
            telephone: telephone ? telephone.trim() : null,
            password: hashedPassword,
            offre: offre || null,
            activeOfferId: offre || null,
            productType: productType,
            paymentStatus: 'registered',
            payments: [],
            sessionToken: sessionToken,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };

        // Sauvegarder
        const users = loadUsers();
        users.push(newUser);
        saveUsers(users);

        console.log(`[AUTH] Nouvel utilisateur inscrit: ${newUser.id} - ${email}`);

        // NOTE: L'email de bienvenue sera envoyé APRÈS le paiement de l'acompte
        // Seule la notification admin est envoyée à l'inscription
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

        // Generer un nouveau token de session
        const sessionToken = generateSessionToken();

        // Mettre a jour l'utilisateur
        users[userIndex].sessionToken = sessionToken;
        users[userIndex].lastLogin = new Date().toISOString();
        users[userIndex].updatedAt = new Date().toISOString();
        saveUsers(users);

        console.log(`[AUTH] Connexion: ${user.id} - ${email}`);

        // Retourner l'utilisateur (sans le mot de passe)
        const userResponse = { ...users[userIndex] };
        delete userResponse.password;

        res.json({
            success: true,
            message: 'Connexion reussie',
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
        const user = users.find(u => u.sessionToken === token);

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

        res.json({
            success: true,
            user: userResponse
        });

    } catch (error) {
        console.error('Erreur verification session:', error);
        res.status(500).json({ error: 'Erreur lors de la verification' });
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
            const userIndex = users.findIndex(u => u.sessionToken === token);

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
        const userIndex = users.findIndex(u => u.sessionToken === token);

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
        const userIndex = users.findIndex(u => u.sessionToken === token);

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
        const userIndex = users.findIndex(u => u.sessionToken === token);

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
 * GET /api/orders/all (Admin)
 * Recuperer toutes les commandes
 */
app.get('/api/orders/all', (req, res) => {
    const orders = loadOrders();
    res.json(orders);
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
app.get('/api/admin/sessions', (req, res) => {
    const sessions = loadSessions();
    res.json(sessions);
});

/**
 * GET /api/admin/sessions/user/:userEmail
 * Recuperer les seances d'un client specifique (Admin)
 */
app.get('/api/admin/sessions/user/:userEmail', (req, res) => {
    const { userEmail } = req.params;
    const sessions = loadSessions();
    const userSessions = sessions.filter(s => s.userEmail.toLowerCase() === userEmail.toLowerCase());
    res.json(userSessions);
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
    var user = users.find(function(u) { return u.sessionToken === token; });
    if (!user) {
        res.status(401).json({ error: 'Session invalide ou expiree' });
        return null;
    }
    return user;
}

// Helper : sanitiser une session pour le client (masquer meet_url si pas CONFIRMED)
function sanitizeSessionForClient(session) {
    var s = JSON.parse(JSON.stringify(session));
    if (s.status !== 'CONFIRMED') {
        s.meet_url = null;
    }
    // Ne pas exposer notes_partner au client
    delete s.notes_partner;
    return s;
}

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

        // Chercher le partenaire si fourni
        var partnerName = null;
        var partnerRole = null;
        if (body.partner_id) {
            var partners = loadPartners();
            var partner = partners.find(function(p) { return p.id === body.partner_id; });
            if (partner) {
                partnerName = (partner.prenom || '') + ' ' + (partner.nom || '');
                partnerRole = partner.partner_type || null;
            }
        }

        var now = new Date().toISOString();
        var newSession = {
            id: 'SES-' + uuidv4().split('-')[0].toUpperCase(),
            project_id: body.project_id || null,
            client_id: user.email.toLowerCase(),
            client_name: ((user.prenom || '') + ' ' + (user.nom || '')).trim() || user.email,
            partner_id: body.partner_id || null,
            partner_name: partnerName,
            partner_role: partnerRole,
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

            // Email si c'etait une reprogrammation
            try {
                var emailService = require('./email-service');
                if (emailService.sendSessionRescheduledEmail) {
                    emailService.sendSessionRescheduledEmail(session.client_id, session.client_name, session);
                }
            } catch(e) { console.error('[SESSION] Erreur envoi email reschedule:', e.message); }

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

// Connexion partenaire
app.post('/api/partner/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }
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
        const sessionToken = generateSessionToken();
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
        const { prenom, nom, telephone, currentPassword, newPassword } = req.body;
        const partners = loadPartners();
        const index = partners.findIndex(p => p.id === req.partner.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Partenaire non trouve' });
        }
        if (prenom) partners[index].prenom = prenom;
        if (nom) partners[index].nom = nom;
        if (telephone) partners[index].telephone = telephone;
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
        const { prenom, nom, email, telephone, password, partner_type, company } = req.body;
        if (!prenom || !nom || !email || !password || !partner_type) {
            return res.status(400).json({ error: 'Champs obligatoires: prenom, nom, email, password, partner_type' });
        }
        const validTypes = ['photographer', 'videographer', 'marketer', 'media'];
        if (validTypes.indexOf(partner_type) === -1) {
            return res.status(400).json({ error: 'partner_type invalide. Valeurs acceptees: ' + validTypes.join(', ') });
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

// Lister tous les partenaires
app.get('/api/admin/partners', (req, res) => {
    try {
        const partners = loadPartners().map(p => {
            const { password, ...safe } = p;
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
        if (prenom) partners[index].prenom = prenom;
        if (nom) partners[index].nom = nom;
        if (telephone !== undefined) partners[index].telephone = telephone;
        if (partner_type) {
            const validTypes = ['photographer', 'videographer', 'marketer', 'media'];
            if (validTypes.indexOf(partner_type) !== -1) {
                partners[index].partner_type = partner_type;
            }
        }
        if (company !== undefined) partners[index].company = company;
        if (accountStatus) partners[index].accountStatus = accountStatus;
        partners[index].updatedAt = new Date().toISOString();
        savePartners(partners);
        const { password, ...partnerSafe } = partners[index];
        res.json({ success: true, partner: partnerSafe });
    } catch (error) {
        console.error('[ADMIN] Erreur modif partenaire:', error);
        res.status(500).json({ error: 'Erreur modification partenaire' });
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

        if (quotes[idx].status === 'ACCEPTED') {
            return res.status(400).json({ error: 'Impossible d\'annuler un devis déjà accepté' });
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

        quotes[idx].partner_proposal = {
            items: items,
            delay: delay || '',
            notes: notes || ''
        };
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
        var authUser = users.find(function(u) { return u.sessionToken === authToken; });
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
        var authUser = users.find(function(u) { return u.sessionToken === authToken; });
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
        var authUser = users.find(function(u) { return u.sessionToken === authToken; });
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
// INITIALISATION DES COMPTES PARTENAIRES PAR DEFAUT
// ============================================================

async function seedPartnerAccounts() {
    const defaultPartners = [
        { prenom: 'Photo', nom: 'Graphe', email: 'photographe@fagenesis.com', password: 'FAphoto2024', partner_type: 'photographer' },
        { prenom: 'Video', nom: 'Aste', email: 'videaste@fagenesis.com', password: 'FAvideo2024', partner_type: 'videographer' },
        { prenom: 'Market', nom: 'Eur', email: 'marketeur@fagenesis.com', password: 'FAmarket2024', partner_type: 'marketer' },
        { prenom: 'Media', nom: 'Press', email: 'media@fagenesis.com', password: 'FAmedia2024', partner_type: 'media' }
    ];

    const partners = loadPartners();
    let created = 0;

    for (const def of defaultPartners) {
        const exists = partners.find(p => p.email.toLowerCase() === def.email.toLowerCase());
        if (!exists) {
            const hashedPassword = await bcrypt.hash(def.password, 10);
            partners.push({
                id: 'PTR-' + uuidv4().split('-')[0],
                prenom: def.prenom,
                nom: def.nom,
                email: def.email,
                telephone: '',
                password: hashedPassword,
                partner_type: def.partner_type,
                company: '',
                sessionToken: null,
                accountStatus: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastLogin: null,
                createdBy: 'system-seed'
            });
            created++;
        }
    }

    if (created > 0) {
        savePartners(partners);
        console.log('   [SEED] ' + created + ' compte(s) partenaire(s) cree(s) automatiquement');
    } else {
        console.log('   [SEED] Comptes partenaires deja presents (' + partners.length + ')');
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
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');
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
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');

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
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');
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
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');
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
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');
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
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');
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
 * GET /api/admin/projects
 * Liste tous les projets (admin uniquement)
 */
app.get('/api/admin/projects', (req, res) => {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acces admin requis' });

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
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acces admin requis' });

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
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');
        if (decoded.role !== 'partner') return res.status(403).json({ error: 'Acces partenaire requis' });

        var partnerId = decoded.partnerId || decoded.id;
        var partnerEmail = decoded.email;

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
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');
        if (decoded.role !== 'partner') return res.status(403).json({ error: 'Acces partenaire requis' });

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
                    updated_by_id: decoded.partnerId || decoded.id || decoded.email,
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
                liv.owner_partner_id = decoded.partnerId || decoded.id;
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
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');
        if (decoded.role !== 'partner') return res.status(403).json({ error: 'Acces partenaire requis' });

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
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');
        if (decoded.role !== 'partner') return res.status(403).json({ error: 'Acces partenaire requis' });

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
        var authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Non autorise' });
        var token = authHeader.replace('Bearer ', '');
        var jwt = require('jsonwebtoken');
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');

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
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');

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
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');

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
        var decoded = jwt.verify(token, process.env.JWT_SECRET || 'fa-genesis-secret-key-2024');
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
// DEMARRAGE DU SERVEUR
// ============================================================

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

    // Initialiser les comptes partenaires par defaut
    await seedPartnerAccounts();
});
