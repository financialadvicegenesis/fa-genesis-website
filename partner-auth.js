// Systeme d'authentification PARTENAIRE FA GENESIS
// Auth separee des clients - utilise des cles localStorage et endpoints distincts

// URL du backend (centralisee dans config.js)
var PARTNER_API_BASE_URL = window.FA_GENESIS_API || 'https://fa-genesis-website.onrender.com';

// Cles de stockage local PARTENAIRE (differentes des clients)
var PARTNER_SESSION_KEY = 'fa_genesis_partner_session';
var PARTNER_TOKEN_KEY = 'fa_genesis_partner_token';

/**
 * Connexion partenaire
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>}
 */
async function partnerLogin(email, password) {
    try {
        var response = await fetch(PARTNER_API_BASE_URL + '/api/partner/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        });

        var data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                message: data.error || 'Erreur de connexion'
            };
        }

        // Sauvegarder la session et le token partenaire
        localStorage.setItem(PARTNER_SESSION_KEY, JSON.stringify(data.partner));
        localStorage.setItem(PARTNER_TOKEN_KEY, data.token);

        return {
            success: true,
            message: 'Connexion réussie',
            partner: data.partner
        };

    } catch (error) {
        console.error('[PARTNER] Erreur login:', error);
        return {
            success: false,
            message: 'Le serveur est temporairement indisponible. Veuillez réessayer dans quelques instants.'
        };
    }
}

/**
 * Deconnexion partenaire
 */
async function partnerLogout() {
    try {
        var token = localStorage.getItem(PARTNER_TOKEN_KEY);

        if (token) {
            await fetch(PARTNER_API_BASE_URL + '/api/partner/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token }
            });
        }
    } catch (error) {
        console.error('[PARTNER] Erreur logout:', error);
    }

    // Nettoyer le stockage local partenaire
    localStorage.removeItem(PARTNER_SESSION_KEY);
    localStorage.removeItem(PARTNER_TOKEN_KEY);

    // Rediriger vers la page de connexion partenaire
    window.location.href = 'partner-login.html';
}

/**
 * Verifie si le partenaire est authentifie
 * @returns {boolean}
 */
function isPartnerAuthenticated() {
    var session = localStorage.getItem(PARTNER_SESSION_KEY);
    var token = localStorage.getItem(PARTNER_TOKEN_KEY);
    return session !== null && token !== null;
}

/**
 * Obtient le partenaire actuellement connecte (depuis le cache local)
 * @returns {Object|null}
 */
function getCurrentPartner() {
    var session = localStorage.getItem(PARTNER_SESSION_KEY);
    if (!session) {
        return null;
    }

    try {
        return JSON.parse(session);
    } catch (e) {
        console.error('[PARTNER] Erreur lecture session:', e);
        return null;
    }
}

/**
 * Obtient le token d'authentification partenaire
 * @returns {string|null}
 */
function getPartnerAuthToken() {
    return localStorage.getItem(PARTNER_TOKEN_KEY);
}

/**
 * Verifie et rafraichit la session partenaire depuis le serveur
 * @returns {Promise<Object|null>}
 */
async function verifyPartnerSession() {
    var token = localStorage.getItem(PARTNER_TOKEN_KEY);

    if (!token) {
        return null;
    }

    try {
        var response = await fetch(PARTNER_API_BASE_URL + '/api/partner/auth/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!response.ok) {
            // Session invalide, nettoyer
            localStorage.removeItem(PARTNER_SESSION_KEY);
            localStorage.removeItem(PARTNER_TOKEN_KEY);
            return null;
        }

        var data = await response.json();

        // Mettre a jour le cache local
        localStorage.setItem(PARTNER_SESSION_KEY, JSON.stringify(data.partner));

        return data.partner;

    } catch (error) {
        console.error('[PARTNER] Erreur verification session:', error);
        return null;
    }
}

/**
 * Protection des pages partenaire
 * Redirige vers partner-login.html si non connecte
 */
function requirePartnerAuth() {
    if (!isPartnerAuthenticated()) {
        window.location.href = 'partner-login.html';
        return false;
    }
    return true;
}

/**
 * Protection des pages partenaire (version asynchrone)
 * Verifie aussi la validite du token cote serveur
 */
async function requirePartnerAuthAsync() {
    if (!isPartnerAuthenticated()) {
        window.location.href = 'partner-login.html';
        return false;
    }

    var partner = await verifyPartnerSession();
    if (!partner) {
        window.location.href = 'partner-login.html';
        return false;
    }

    return true;
}

/**
 * Mise a jour du profil partenaire
 * @param {Object} profileData - Donnees a mettre a jour
 * @returns {Promise<Object>}
 */
async function updatePartnerProfile(profileData) {
    var token = localStorage.getItem(PARTNER_TOKEN_KEY);

    if (!token) {
        return {
            success: false,
            message: 'Partenaire non connecté'
        };
    }

    try {
        var response = await fetch(PARTNER_API_BASE_URL + '/api/partner/auth/update-profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(profileData)
        });

        var data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                message: data.error || 'Erreur lors de la mise à jour du profil'
            };
        }

        // Mettre a jour le cache local
        localStorage.setItem(PARTNER_SESSION_KEY, JSON.stringify(data.partner));

        return {
            success: true,
            message: 'Profil mis à jour avec succès',
            partner: data.partner
        };

    } catch (error) {
        console.error('[PARTNER] Erreur mise a jour profil:', error);
        return {
            success: false,
            message: 'Erreur de connexion au serveur'
        };
    }
}

/**
 * Fonction utilitaire pour les requetes authentifiees partenaire
 */
async function partnerAuthenticatedFetch(url, options) {
    var token = localStorage.getItem(PARTNER_TOKEN_KEY);
    if (!options) options = {};
    if (!options.headers) options.headers = {};

    options.headers['Authorization'] = 'Bearer ' + token;

    return fetch(url, options);
}
