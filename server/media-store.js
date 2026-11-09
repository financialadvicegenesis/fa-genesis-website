// ============================================================
// FA GENESIS - Stockage des vidéos du portfolio prestataire
// ============================================================
// Avant : la vidéo était convertie en texte (base64) et rangée DANS la fiche du prestataire
// (partners.json → MongoDB). Une vidéo de téléphone dépassait la limite de 50 Mo de la requête
// (« Erreur de connexion au serveur ») et un document MongoDB est limité à 16 Mo ; une vidéo en
// texte ne se lit pas non plus sur iPhone (case noire).
// Maintenant : le fichier brut est rangé à part — MongoDB GridFS (bucket « portfolio_media »,
// survit aux redéploiements) ou, sans MongoDB, le dossier data/media — et servi par morceaux
// (en-tête Range), indispensable à la lecture vidéo sur iPhone.
//
// Un identifiant de vidéo (VID-…) = l'adresse publique, qui ne change jamais. Derrière, le fichier
// peut être remplacé (version compressée) sans coupure : la nouvelle version est rangée AVANT que
// l'ancienne soit supprimée, et la plus récente est toujours celle servie.

var fs = require('fs');
var path = require('path');

var BUCKET = 'portfolio_media';

function create(opts) {
    var dataDir = opts.dataDir;
    var getDb = opts.getDb; // () => db MongoDB connectée, ou null
    var localDir = path.join(dataDir, 'media');

    function bucket() {
        var db = getDb && getDb();
        if (!db) return null;
        var mongodb = require('mongodb');
        return new mongodb.GridFSBucket(db, { bucketName: BUCKET });
    }
    function localPaths(id) {
        return { file: path.join(localDir, id + '.bin'), meta: path.join(localDir, id + '.json') };
    }
    // Fichiers GridFS d'une vidéo, le plus récent d'abord (1re version : _id = identifiant).
    function gridFiles(b, id) {
        return b.find({ $or: [{ _id: id }, { 'metadata.media_id': id }] }).sort({ uploadDate: -1 }).toArray();
    }

    // Range le fichier tmpPath comme (nouvelle) version de la vidéo id.
    // meta : { owner, contentType, processed }
    function put(id, tmpPath, meta) {
        var b = bucket();
        var now = new Date().toISOString();
        if (b) {
            return gridFiles(b, id).then(function(prev) {
                var created = (prev[0] && prev[0].metadata && prev[0].metadata.created_at) || now;
                return new Promise(function(resolve, reject) {
                    var up = b.openUploadStream(id, {
                        contentType: meta.contentType,
                        metadata: { media_id: id, owner: meta.owner, kind: 'video', processed: !!meta.processed, created_at: created }
                    });
                    fs.createReadStream(tmpPath).on('error', reject).pipe(up).on('error', reject).on('finish', function() { resolve({ fileId: up.id, previous: prev }); });
                });
            }).then(function(r) {
                // Anciennes versions supprimées seulement une fois la nouvelle entièrement rangée.
                return Promise.all(r.previous.map(function(f) { return b.delete(f._id).catch(function() {}); }));
            });
        }
        return new Promise(function(resolve, reject) {
            try {
                fs.mkdirSync(localDir, { recursive: true });
                var p = localPaths(id), old = {};
                try { old = JSON.parse(fs.readFileSync(p.meta, 'utf8')); } catch (e) {}
                fs.copyFileSync(tmpPath, p.file + '.part');
                fs.renameSync(p.file + '.part', p.file); // remplacement d'un seul coup
                fs.writeFileSync(p.meta, JSON.stringify({ owner: meta.owner, contentType: meta.contentType, processed: !!meta.processed, created_at: old.created_at || now }));
                resolve();
            } catch (e) { reject(e); }
        });
    }

    // { size, contentType, owner, created_at, processed, fileId } ou null.
    function info(id) {
        var b = bucket();
        if (b) {
            return gridFiles(b, id).then(function(rows) {
                var f = rows[0];
                if (!f) return null;
                var md = f.metadata || {};
                return { size: f.length, contentType: f.contentType || 'video/mp4', owner: md.owner, created_at: md.created_at || (f.uploadDate && f.uploadDate.toISOString()), processed: !!md.processed, fileId: f._id };
            });
        }
        try {
            var p = localPaths(id);
            if (!fs.existsSync(p.file)) return Promise.resolve(null);
            var m = JSON.parse(fs.readFileSync(p.meta, 'utf8'));
            return Promise.resolve({ size: fs.statSync(p.file).size, contentType: m.contentType || 'video/mp4', owner: m.owner, created_at: m.created_at, processed: !!m.processed, fileId: null });
        } catch (e) { return Promise.resolve(null); }
    }

    // Flux de lecture, octets start..end inclus, de la version décrite par inf (résultat d'info()).
    function openStream(id, inf, start, end) {
        var b = bucket();
        if (b) return b.openDownloadStream(inf.fileId, { start: start, end: end + 1 });
        return fs.createReadStream(localPaths(id).file, { start: start, end: end });
    }

    // Copie la version actuelle dans un fichier (compression d'une vidéo déjà rangée).
    function toFile(id, destPath) {
        return info(id).then(function(inf) {
            if (!inf) throw new Error('introuvable');
            return new Promise(function(resolve, reject) {
                var out = fs.createWriteStream(destPath);
                openStream(id, inf, 0, inf.size - 1).on('error', reject).pipe(out).on('error', reject).on('finish', function() { resolve(inf); });
            });
        });
    }

    function remove(id) {
        var b = bucket();
        if (b) {
            return gridFiles(b, id).then(function(rows) {
                return Promise.all(rows.map(function(f) { return b.delete(f._id).catch(function() {}); }));
            }).catch(function() {});
        }
        try {
            var p = localPaths(id);
            if (fs.existsSync(p.file)) fs.unlinkSync(p.file);
            if (fs.existsSync(p.meta)) fs.unlinkSync(p.meta);
        } catch (e) {}
        return Promise.resolve();
    }

    // [{ id, owner, created_at, processed }] — ménage et compression des vidéos existantes.
    function list() {
        var b = bucket();
        if (b) {
            return b.find({}).sort({ uploadDate: -1 }).toArray().then(function(rows) {
                var seen = {}, outRows = [];
                rows.forEach(function(f) {
                    var md = f.metadata || {}, id = md.media_id || f._id;
                    if (seen[id]) return;
                    seen[id] = true;
                    outRows.push({ id: id, owner: md.owner, created_at: md.created_at || (f.uploadDate && f.uploadDate.toISOString()), processed: !!md.processed });
                });
                return outRows;
            });
        }
        try {
            if (!fs.existsSync(localDir)) return Promise.resolve([]);
            return Promise.resolve(fs.readdirSync(localDir).filter(function(n) { return /\.json$/.test(n); }).map(function(n) {
                var id = n.replace(/\.json$/, '');
                var m = {};
                try { m = JSON.parse(fs.readFileSync(path.join(localDir, n), 'utf8')); } catch (e) {}
                return { id: id, owner: m.owner, created_at: m.created_at, processed: !!m.processed };
            }));
        } catch (e) { return Promise.resolve([]); }
    }

    return { put: put, info: info, openStream: openStream, toFile: toFile, remove: remove, list: list };
}

// Le fichier est-il vraiment une vidéo ? (signature des formats acceptés, pas le type annoncé)
// MP4 / MOV / 3GP : « ftyp » à l'octet 4 ; WebM / MKV : en-tête EBML.
function sniffVideo(buf) {
    if (!buf || buf.length < 12) return null;
    if (buf.toString('latin1', 4, 8) === 'ftyp') {
        var brand = buf.toString('latin1', 8, 12);
        if (/^3g/.test(brand)) return 'video/3gpp';
        // .MOV d'iPhone compris : servi comme MP4 (même structure), sinon Chrome/Android refuse
        // de le lire alors que le contenu (H.264 / HEVC) est le même.
        return 'video/mp4';
    }
    if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return 'video/webm';
    return null;
}

module.exports = { create: create, sniffVideo: sniffVideo, BUCKET: BUCKET };
