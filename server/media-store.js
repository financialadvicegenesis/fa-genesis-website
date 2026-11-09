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

    // Range le fichier temporaire tmpPath sous l'identifiant id. meta : { owner, contentType, size }.
    function put(id, tmpPath, meta) {
        var b = bucket();
        if (b) {
            return new Promise(function(resolve, reject) {
                var up = b.openUploadStreamWithId(id, id, {
                    contentType: meta.contentType,
                    metadata: { owner: meta.owner, kind: 'video', created_at: new Date().toISOString() }
                });
                fs.createReadStream(tmpPath).on('error', reject).pipe(up).on('error', reject).on('finish', function() { resolve(); });
            });
        }
        return new Promise(function(resolve, reject) {
            try {
                fs.mkdirSync(localDir, { recursive: true });
                var p = localPaths(id);
                fs.copyFileSync(tmpPath, p.file);
                fs.writeFileSync(p.meta, JSON.stringify({ owner: meta.owner, contentType: meta.contentType, size: fs.statSync(p.file).size, created_at: new Date().toISOString() }));
                resolve();
            } catch (e) { reject(e); }
        });
    }

    // { size, contentType, owner, created_at } ou null.
    function info(id) {
        var b = bucket();
        if (b) {
            return b.find({ _id: id }).limit(1).toArray().then(function(rows) {
                var f = rows[0];
                if (!f) return null;
                return { size: f.length, contentType: f.contentType || 'video/mp4', owner: f.metadata && f.metadata.owner, created_at: (f.metadata && f.metadata.created_at) || (f.uploadDate && f.uploadDate.toISOString()) };
            });
        }
        try {
            var p = localPaths(id);
            if (!fs.existsSync(p.file)) return Promise.resolve(null);
            var m = JSON.parse(fs.readFileSync(p.meta, 'utf8'));
            return Promise.resolve({ size: fs.statSync(p.file).size, contentType: m.contentType || 'video/mp4', owner: m.owner, created_at: m.created_at });
        } catch (e) { return Promise.resolve(null); }
    }

    // Flux de lecture, octets start..end inclus.
    function openStream(id, start, end) {
        var b = bucket();
        if (b) return b.openDownloadStream(id, { start: start, end: end + 1 });
        return fs.createReadStream(localPaths(id).file, { start: start, end: end });
    }

    function remove(id) {
        var b = bucket();
        if (b) return b.delete(id).catch(function() {});
        try {
            var p = localPaths(id);
            if (fs.existsSync(p.file)) fs.unlinkSync(p.file);
            if (fs.existsSync(p.meta)) fs.unlinkSync(p.meta);
        } catch (e) {}
        return Promise.resolve();
    }

    // [{ id, owner, created_at }] — pour le ménage des vidéos envoyées mais jamais enregistrées.
    function list() {
        var b = bucket();
        if (b) {
            return b.find({}).toArray().then(function(rows) {
                return rows.map(function(f) { return { id: f._id, owner: f.metadata && f.metadata.owner, created_at: (f.metadata && f.metadata.created_at) || (f.uploadDate && f.uploadDate.toISOString()) }; });
            });
        }
        try {
            if (!fs.existsSync(localDir)) return Promise.resolve([]);
            return Promise.resolve(fs.readdirSync(localDir).filter(function(n) { return /\.json$/.test(n); }).map(function(n) {
                var id = n.replace(/\.json$/, '');
                var m = {};
                try { m = JSON.parse(fs.readFileSync(path.join(localDir, n), 'utf8')); } catch (e) {}
                return { id: id, owner: m.owner, created_at: m.created_at };
            }));
        } catch (e) { return Promise.resolve([]); }
    }

    return { put: put, info: info, openStream: openStream, remove: remove, list: list };
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
