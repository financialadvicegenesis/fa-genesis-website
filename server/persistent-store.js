/**
 * FA GENESIS - Persistent Store (MongoDB Atlas)
 *
 * Résout le problème de perte de données sur Render free tier :
 * les fichiers JSON sont effacés à chaque redéploiement.
 *
 * Ce module :
 * 1. Au démarrage : restaure toutes les données depuis MongoDB → fichiers JSON locaux
 * 2. À chaque save : écrit dans le fichier JSON local ET dans MongoDB
 *
 * Configuration : variable d'environnement MONGODB_URI
 * Ex: mongodb+srv://user:pass@cluster.mongodb.net/fagenesis?retryWrites=true&w=majority
 */

var MongoClient = null;
var db = null;
var connected = false;
var connectionError = null;
var uriPresent = false;

// Collections à persister
var COLLECTIONS = [
    'users',
    'orders',
    'partners',
    'partner-assignments',
    'partner-uploads',
    'partner-comments',
    'quotes',
    'sessions',
    'projects',
    'livrables'
];

/**
 * Connexion à MongoDB Atlas
 */
async function connect() {
    var uri = process.env.MONGODB_URI;
    if (!uri) {
        console.log('[PERSISTENT-STORE] MONGODB_URI non défini - mode fichiers JSON uniquement (données perdues au redéploiement)');
        connectionError = 'MONGODB_URI non défini dans les variables d\'environnement';
        return false;
    }

    uriPresent = true;
    // Masquer le mot de passe dans les logs
    var maskedUri = uri.replace(/:([^@]+)@/, ':***@');
    console.log('[PERSISTENT-STORE] MONGODB_URI détecté: ' + maskedUri);

    try {
        var { MongoClient: MC } = require('mongodb');
        console.log('[PERSISTENT-STORE] Package mongodb chargé OK');

        var client = new MC(uri, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000
        });
        console.log('[PERSISTENT-STORE] Tentative de connexion...');
        await client.connect();

        // Test rapide: lister les collections
        db = client.db('fagenesis');
        var collections = await db.listCollections().toArray();
        console.log('[PERSISTENT-STORE] Connecté à MongoDB Atlas - ' + collections.length + ' collections existantes');

        connected = true;
        connectionError = null;
        return true;
    } catch (err) {
        console.error('[PERSISTENT-STORE] ERREUR connexion MongoDB:');
        console.error('[PERSISTENT-STORE]   Message: ' + err.message);
        console.error('[PERSISTENT-STORE]   Code: ' + (err.code || 'N/A'));
        console.error('[PERSISTENT-STORE]   Name: ' + (err.name || 'N/A'));
        if (err.message && err.message.indexOf('ENOTFOUND') !== -1) {
            console.error('[PERSISTENT-STORE]   CAUSE PROBABLE: Le hostname du cluster est incorrect ou le cluster est en pause');
        }
        if (err.message && (err.message.indexOf('authentication') !== -1 || err.message.indexOf('auth') !== -1)) {
            console.error('[PERSISTENT-STORE]   CAUSE PROBABLE: Mauvais utilisateur ou mot de passe dans MONGODB_URI');
        }
        if (err.message && (err.message.indexOf('IP') !== -1 || err.message.indexOf('whitelist') !== -1 || err.message.indexOf('network') !== -1)) {
            console.error('[PERSISTENT-STORE]   CAUSE PROBABLE: L\'IP de Render n\'est pas dans la whitelist MongoDB Atlas');
        }
        if (err.message && err.message.indexOf('timeout') !== -1) {
            console.error('[PERSISTENT-STORE]   CAUSE PROBABLE: Timeout - vérifiez que 0.0.0.0/0 est dans Network Access sur MongoDB Atlas');
        }
        connectionError = err.message;
        connected = false;
        return false;
    }
}

/**
 * Restaurer toutes les données depuis MongoDB → fichiers JSON locaux
 * Appelé au démarrage du serveur
 */
async function restoreAllFromCloud(dataDir) {
    if (!connected || !db) return false;

    var fs = require('fs');
    var path = require('path');
    var restored = 0;

    for (var i = 0; i < COLLECTIONS.length; i++) {
        var collName = COLLECTIONS[i];
        try {
            var collection = db.collection(collName);
            var docs = await collection.find({}).toArray();

            if (docs.length > 0) {
                // Retirer les _id MongoDB pour compatibilité JSON
                var cleanDocs = docs.map(function(doc) {
                    var clean = Object.assign({}, doc);
                    delete clean._id;
                    return clean;
                });

                var filePath = path.join(dataDir, collName + '.json');
                fs.writeFileSync(filePath, JSON.stringify(cleanDocs, null, 2), 'utf8');
                console.log('[PERSISTENT-STORE] Restauré ' + collName + ': ' + cleanDocs.length + ' documents');
                restored++;
            }
        } catch (err) {
            console.error('[PERSISTENT-STORE] Erreur restauration ' + collName + ':', err.message);
        }
    }

    console.log('[PERSISTENT-STORE] Restauration terminée: ' + restored + '/' + COLLECTIONS.length + ' collections');
    return true;
}

/**
 * Persister une collection entière dans MongoDB
 * Appelé à chaque saveX() dans server.js
 */
async function persistToCloud(collectionName, data) {
    if (!connected || !db) return false;

    try {
        var collection = db.collection(collectionName);

        // Stratégie : remplacer toute la collection
        // On utilise un bulk operation : supprimer tout, puis insérer tout
        await collection.deleteMany({});

        if (data && data.length > 0) {
            // Cloner les données pour ne pas modifier les originaux
            var docs = data.map(function(item) {
                return Object.assign({}, item);
            });
            await collection.insertMany(docs);
        }

        return true;
    } catch (err) {
        console.error('[PERSISTENT-STORE] Erreur persistance ' + collectionName + ':', err.message);
        return false;
    }
}

/**
 * Vérifier si MongoDB est connecté
 */
function isConnected() {
    return connected;
}

/**
 * Statut détaillé pour le diagnostic
 */
function getStatus() {
    if (connected) return 'connected';
    if (uriPresent) return 'error: ' + (connectionError || 'connexion échouée');
    return 'not configured';
}

module.exports = {
    connect: connect,
    restoreAllFromCloud: restoreAllFromCloud,
    persistToCloud: persistToCloud,
    isConnected: isConnected,
    getStatus: getStatus
};
