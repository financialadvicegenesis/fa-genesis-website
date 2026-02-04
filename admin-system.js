// Système d'administration FA GENESIS
// Gestion des documents par client et suivi de l'accompagnement

console.log('🔵 Chargement de admin-system.js');

/**
 * Identifiants admin (en production, utiliser un système sécurisé)
 */
const ADMIN_CREDENTIALS = {
    email: 'admin@fagenesis.com',
    password: 'FAGenesis2024!'
};

/**
 * Connexion administrateur
 * @param {string} email
 * @param {string} password
 * @returns {Object}
 */
function adminLogin(email, password) {
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        const adminSession = {
            email: email,
            role: 'admin',
            loginTime: new Date().toISOString()
        };
        localStorage.setItem('adminSession', JSON.stringify(adminSession));
        console.log('✅ Admin connecté');
        return { success: true, message: 'Connexion réussie' };
    }
    return { success: false, message: 'Identifiants incorrects' };
}

/**
 * Vérifier si l'admin est connecté
 * @returns {boolean}
 */
function isAdminAuthenticated() {
    const session = localStorage.getItem('adminSession');
    return session !== null;
}

/**
 * Déconnexion admin
 */
function adminLogout() {
    localStorage.removeItem('adminSession');
    console.log('✅ Admin déconnecté');
}

/**
 * Obtenir la session admin
 * @returns {Object|null}
 */
function getAdminSession() {
    const session = localStorage.getItem('adminSession');
    return session ? JSON.parse(session) : null;
}

/**
 * Récupérer tous les clients
 * @returns {Array}
 */
function getAllClients() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    return users.map(user => {
        const offer = getOfferById(user.offre);
        return {
            ...user,
            offerDetails: offer,
            documentsCount: (user.dailyDocuments || []).length
        };
    });
}

/**
 * Récupérer un client par email
 * @param {string} email
 * @returns {Object|null}
 */
function getClientByEmail(email) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    return users.find(u => u.email === email) || null;
}

/**
 * Ajouter un document journalier à un client
 * @param {string} clientEmail
 * @param {Object} document
 * @returns {boolean}
 */
function addDailyDocumentToClient(clientEmail, document) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.email === clientEmail);

    if (userIndex === -1) {
        console.error('❌ Client non trouvé');
        return false;
    }

    // Initialiser le tableau des documents journaliers si nécessaire
    if (!users[userIndex].dailyDocuments) {
        users[userIndex].dailyDocuments = [];
    }

    // Créer le document avec un ID unique
    const newDocument = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: document.title,
        description: document.description || '',
        day: document.day,
        fileUrl: document.fileUrl,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'admin'
    };

    users[userIndex].dailyDocuments.push(newDocument);
    users[userIndex].currentDay = Math.max(users[userIndex].currentDay || 0, document.day);

    localStorage.setItem('users', JSON.stringify(users));
    console.log('✅ Document journalier ajouté:', newDocument);

    return true;
}

/**
 * Supprimer un document journalier d'un client
 * @param {string} clientEmail
 * @param {string} documentId
 * @returns {boolean}
 */
function deleteDailyDocument(clientEmail, documentId) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.email === clientEmail);

    if (userIndex === -1 || !users[userIndex].dailyDocuments) {
        return false;
    }

    const docIndex = users[userIndex].dailyDocuments.findIndex(d => d.id === documentId);
    if (docIndex === -1) {
        return false;
    }

    users[userIndex].dailyDocuments.splice(docIndex, 1);
    localStorage.setItem('users', JSON.stringify(users));
    console.log('✅ Document supprimé');

    return true;
}

/**
 * Récupérer les documents journaliers d'un client
 * @param {string} clientEmail
 * @returns {Array}
 */
function getClientDailyDocuments(clientEmail) {
    const client = getClientByEmail(clientEmail);
    if (!client) return [];

    return client.dailyDocuments || [];
}

/**
 * Récupérer les documents journaliers groupés par jour
 * @param {string} clientEmail
 * @returns {Object}
 */
function getClientDocumentsByDay(clientEmail) {
    const documents = getClientDailyDocuments(clientEmail);
    const grouped = {};

    documents.forEach(doc => {
        if (!grouped[doc.day]) {
            grouped[doc.day] = [];
        }
        grouped[doc.day].push(doc);
    });

    return grouped;
}

/**
 * Mettre à jour le jour actuel d'un client
 * @param {string} clientEmail
 * @param {number} day
 * @returns {boolean}
 */
function updateClientCurrentDay(clientEmail, day) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.email === clientEmail);

    if (userIndex === -1) return false;

    users[userIndex].currentDay = day;
    localStorage.setItem('users', JSON.stringify(users));
    console.log(`✅ Jour actuel du client mis à jour: ${day}`);

    return true;
}

/**
 * Obtenir les statistiques globales
 * @returns {Object}
 */
function getAdminStats() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');

    const stats = {
        totalClients: users.length,
        registered: users.filter(u => u.paymentStatus === 'registered').length,
        depositPaid: users.filter(u => u.paymentStatus === 'deposit_paid').length,
        deliveryPending: users.filter(u => u.paymentStatus === 'delivery_pending_payment').length,
        fullyPaid: users.filter(u => u.paymentStatus === 'fully_paid').length,
        totalDocuments: users.reduce((sum, u) => sum + (u.dailyDocuments || []).length, 0),
        totalRevenue: users.reduce((sum, u) => {
            return sum + (u.payments || []).reduce((pSum, p) => pSum + p.amount, 0);
        }, 0)
    };

    return stats;
}

/**
 * Simuler l'upload d'un fichier et retourner une URL base64
 * @param {File} file
 * @returns {Promise}
 */
function uploadFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function(e) {
            const fileData = {
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                fileUrl: e.target.result, // Base64 data URL
                uploadedAt: new Date().toISOString()
            };
            resolve(fileData);
        };

        reader.onerror = function() {
            reject(new Error('Erreur lors de la lecture du fichier'));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Marquer l'accompagnement d'un client comme terminé
 * @param {string} clientEmail
 * @returns {boolean}
 */
function markClientAccompanimentComplete(clientEmail) {
    return markAccompanimentCompleted(clientEmail);
}

/**
 * Rechercher des clients
 * @param {string} query
 * @returns {Array}
 */
function searchClients(query) {
    const users = getAllClients();
    const searchTerm = query.toLowerCase();

    return users.filter(user => {
        return user.email.toLowerCase().includes(searchTerm) ||
               user.prenom.toLowerCase().includes(searchTerm) ||
               user.nom.toLowerCase().includes(searchTerm) ||
               (user.offerDetails && user.offerDetails.nom.toLowerCase().includes(searchTerm));
    });
}

console.log('🟢 admin-system.js chargé avec succès');
console.log('🔐 Système d\'administration actif');
console.log('📊 Identifiants admin: admin@fagenesis.com / FAGenesis2024!');
