// Systeme d'authentification FA GENESIS
// Version backend - Utilise l'API REST du serveur Node.js

// URL du backend (centralisee dans config.js)
const API_BASE_URL = window.FA_GENESIS_API || 'https://fa-genesis-website.onrender.com';

// Cle de stockage local
const SESSION_KEY = 'fa_genesis_session';
const TOKEN_KEY = 'fa_genesis_token';

/**
 * Fonction de connexion (asynchrone)
 * @param {string} email - Email de l'utilisateur
 * @param {string} password - Mot de passe de l'utilisateur
 * @returns {Promise<Object>} Resultat de la connexion
 */
async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                message: data.error || 'Erreur de connexion',
                deactivated: data.deactivated || false
            };
        }

        // Sauvegarder la session et le token
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
        localStorage.setItem(TOKEN_KEY, data.token);

        return {
            success: true,
            message: 'Connexion reussie',
            user: data.user
        };

    } catch (error) {
        console.error('Erreur login:', error);
        return {
            success: false,
            message: 'Erreur de connexion au serveur. Verifiez que le backend est lance.'
        };
    }
}

/**
 * Fonction d'inscription (asynchrone)
 * @param {Object} userData - Donnees d'inscription
 * @returns {Promise<Object>} Resultat de l'inscription
 */
async function register(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                message: data.error || 'Erreur lors de l\'inscription'
            };
        }

        // Sauvegarder la session et le token
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
        localStorage.setItem(TOKEN_KEY, data.token);

        return {
            success: true,
            message: 'Inscription reussie',
            user: data.user
        };

    } catch (error) {
        console.error('Erreur register:', error);
        return {
            success: false,
            message: 'Erreur de connexion au serveur. Verifiez que le backend est lance.'
        };
    }
}

/**
 * Fonction de deconnexion
 */
async function logout() {
    try {
        const token = localStorage.getItem(TOKEN_KEY);

        if (token) {
            await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
    } catch (error) {
        console.error('Erreur logout:', error);
    }

    // Nettoyer le stockage local
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);

    // Rediriger vers la page de connexion
    window.location.href = 'login.html';
}

/**
 * Verifie si l'utilisateur est authentifie
 * @returns {boolean}
 */
function isAuthenticated() {
    const session = localStorage.getItem(SESSION_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    return session !== null && token !== null;
}

/**
 * Obtient l'utilisateur actuellement connecte (depuis le cache local)
 * @returns {Object|null}
 */
function getCurrentUser() {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) {
        return null;
    }

    try {
        return JSON.parse(session);
    } catch (e) {
        console.error('Erreur lors de la lecture de la session', e);
        return null;
    }
}

/**
 * Obtient le token d'authentification
 * @returns {string|null}
 */
function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Verifie et rafraichit la session depuis le serveur
 * @returns {Promise<Object|null>}
 */
async function verifySession() {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Session invalide, nettoyer
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(TOKEN_KEY);
            return null;
        }

        const data = await response.json();

        // Mettre a jour le cache local
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));

        return data.user;

    } catch (error) {
        console.error('Erreur verification session:', error);
        return null;
    }
}

/**
 * Protection des pages privees
 * Redirige vers login.html si l'utilisateur n'est pas connecte
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Protection des pages privees (version asynchrone)
 * Verifie aussi la validite du token cote serveur
 */
async function requireAuthAsync() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }

    // Verifier la session cote serveur
    const user = await verifySession();
    if (!user) {
        window.location.href = 'login.html';
        return false;
    }

    return true;
}

/**
 * Calcule la progression en pourcentage
 * @returns {number}
 */
function getProgressPercentage() {
    const user = getCurrentUser();
    if (!user) return 0;

    // Compatibilite avec l'ancien systeme
    if (user.jourActuel && user.duree) {
        return Math.round((user.jourActuel / user.duree) * 100);
    }

    return 0;
}

/**
 * Obtient le nombre de jours restants
 * @returns {number}
 */
function getDaysRemaining() {
    const user = getCurrentUser();
    if (!user) return 0;

    if (user.duree && user.jourActuel) {
        return user.duree - user.jourActuel;
    }

    return 0;
}

/**
 * Changement de mot de passe (asynchrone)
 * @param {string} currentPassword - Mot de passe actuel
 * @param {string} newPassword - Nouveau mot de passe
 * @returns {Promise<Object>}
 */
async function changePassword(currentPassword, newPassword) {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        return {
            success: false,
            message: 'Utilisateur non connecte'
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                message: data.error || 'Erreur lors du changement de mot de passe'
            };
        }

        // Mettre a jour le cache local
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));

        return {
            success: true,
            message: 'Mot de passe modifie avec succes'
        };

    } catch (error) {
        console.error('Erreur changement mot de passe:', error);
        return {
            success: false,
            message: 'Erreur de connexion au serveur'
        };
    }
}

/**
 * Mise a jour du profil (asynchrone)
 * @param {Object} profileData - Donnees a mettre a jour
 * @returns {Promise<Object>}
 */
async function updateProfile(profileData) {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        return {
            success: false,
            message: 'Utilisateur non connecte'
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profileData)
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                message: data.error || 'Erreur lors de la mise a jour du profil'
            };
        }

        // Mettre a jour le cache local
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));

        return {
            success: true,
            message: 'Profil mis a jour avec succes',
            user: data.user
        };

    } catch (error) {
        console.error('Erreur mise a jour profil:', error);
        return {
            success: false,
            message: 'Erreur de connexion au serveur'
        };
    }
}

/**
 * Sauvegarde l'etat d'une tache du parcours (stockage local)
 * @param {string} taskId - ID de la tache
 * @param {boolean} completed - Etat de completion
 */
function saveTaskState(taskId, completed) {
    const user = getCurrentUser();
    if (!user) return;

    const storageKey = `fa_genesis_tasks_${user.email}`;
    let tasks = JSON.parse(localStorage.getItem(storageKey) || '{}');

    tasks[taskId] = completed;

    localStorage.setItem(storageKey, JSON.stringify(tasks));
}

/**
 * Recupere l'etat d'une tache du parcours
 * @param {string} taskId - ID de la tache
 * @returns {boolean}
 */
function getTaskState(taskId) {
    const user = getCurrentUser();
    if (!user) return false;

    const storageKey = `fa_genesis_tasks_${user.email}`;
    let tasks = JSON.parse(localStorage.getItem(storageKey) || '{}');

    return tasks[taskId] || false;
}

/**
 * Recupere toutes les taches sauvegardees
 * @returns {Object}
 */
function getAllTaskStates() {
    const user = getCurrentUser();
    if (!user) return {};

    const storageKey = `fa_genesis_tasks_${user.email}`;
    return JSON.parse(localStorage.getItem(storageKey) || '{}');
}

// Fonction utilitaire pour les requetes authentifiees
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY);

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    return fetch(url, { ...options, headers });
}
