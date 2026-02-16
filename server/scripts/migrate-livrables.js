/**
 * FA GENESIS - Migration des livrables existants
 * Ajoute les nouveaux champs workflow aux livrables existants.
 * A executer une seule fois apres le deploiement.
 *
 * Usage: node server/scripts/migrate-livrables.js
 */

var fs = require('fs');
var path = require('path');

var LIVRABLES_FILE = path.join(__dirname, '..', 'data', 'livrables.json');

function migrate() {
    console.log('=== Migration des livrables ===');

    // Charger les livrables
    var livrables = [];
    try {
        if (fs.existsSync(LIVRABLES_FILE)) {
            var data = fs.readFileSync(LIVRABLES_FILE, 'utf8');
            livrables = JSON.parse(data);
        } else {
            console.log('Fichier livrables.json non trouve. Rien a migrer.');
            return;
        }
    } catch (err) {
        console.error('Erreur lecture livrables:', err.message);
        return;
    }

    console.log('Livrables trouves: ' + livrables.length);
    var migrated = 0;

    for (var i = 0; i < livrables.length; i++) {
        var l = livrables[i];
        var changed = false;

        // Champs projet
        if (!l.project_id) { l.project_id = null; changed = true; }
        if (!l.offer_key) { l.offer_key = null; changed = true; }
        if (!l.domain) { l.domain = 'strategy'; changed = true; }

        // Workflow
        if (!l.visibility) { l.visibility = 'CLIENT_ON_PUBLISH'; changed = true; }
        if (!l.workflow_status) { l.workflow_status = 'PUBLISHED'; changed = true; }
        if (!l.owner_role) { l.owner_role = l.source || 'admin'; changed = true; }
        if (!l.owner_partner_id) { l.owner_partner_id = l.partner_id || null; changed = true; }
        if (l.requires_admin_approval === undefined) { l.requires_admin_approval = false; changed = true; }
        if (l.requires_partner_approval === undefined) { l.requires_partner_approval = false; changed = true; }

        // Contenu texte
        if (!l.content_text) { l.content_text = null; changed = true; }

        // Versioning
        if (!l.versions) { l.versions = []; changed = true; }

        if (changed) migrated++;
    }

    // Sauvegarder
    try {
        fs.writeFileSync(LIVRABLES_FILE, JSON.stringify(livrables, null, 2), 'utf8');
        console.log('Migration terminee: ' + migrated + ' livrables mis a jour sur ' + livrables.length);
    } catch (err) {
        console.error('Erreur sauvegarde:', err.message);
    }
}

migrate();
