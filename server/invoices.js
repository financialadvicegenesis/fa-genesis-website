'use strict';

// Factures émises par le PRESTATAIRE (auto-entrepreneur) au CLIENT pour une mission réalisée.
// FA GENESIS n'est jamais l'émetteur légal — elle n'agit que comme intermédiaire de paiement
// (GENESIS SAFE™). Voir server.js, processDispatchPayout()/releaseOnHoldPayouts() pour le
// déclenchement (à la validation finale de la mission, une fois le versement réellement
// crédité — jamais sur une mission encore en cours ou annulée).
//
// Une facture nécessite un SIRET + une adresse de facturation enregistrés par le prestataire
// (mention légale obligatoire sur toute facture française) — generateInvoiceForOrder() renvoie
// { pending_siret: true } si absents, sans jamais générer de document juridiquement invalide.
// Le prestataire est notifié pour compléter son profil ; aucune relance automatique n'est
// nécessaire ensuite car generateInvoiceForOrder() est idempotente (une seule facture par
// commande, jamais régénérée) — si elle n'a pas pu être créée au moment du versement, elle ne
// le sera jamais rétroactivement pour CETTE commande précise sans un appel explicite.

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var PDFDocument = require('pdfkit');

var INVOICES_FILE = path.join(__dirname, 'data', 'invoices.json');

var _LOGO_DATA_URI = '';
try {
    var _logoFile = path.join(__dirname, '../assets/images/logo-genesis-transparent.png');
    _LOGO_DATA_URI = 'data:image/png;base64,' + fs.readFileSync(_logoFile).toString('base64');
} catch (e) {
    console.warn('[INVOICE] Logo introuvable, fallback texte :', e.message);
}

function loadInvoices() {
    try {
        if (!fs.existsSync(INVOICES_FILE)) return [];
        return JSON.parse(fs.readFileSync(INVOICES_FILE, 'utf8'));
    } catch (e) {
        console.error('[INVOICE] Erreur lecture invoices.json:', e);
        return [];
    }
}

function saveInvoices(invoices) {
    try {
        fs.writeFileSync(INVOICES_FILE, JSON.stringify(invoices, null, 2));
        return true;
    } catch (e) {
        console.error('[INVOICE] Erreur écriture invoices.json:', e);
        return false;
    }
}

// Numérotation séquentielle SANS TROU, PAR PRESTATAIRE (obligation légale française : chaque
// émetteur a sa propre suite continue, jamais partagée avec d'autres vendeurs). Remise à 1
// chaque année civile (format standard Fxxxx-0001) — basé sur le nombre de factures déjà
// émises par CE prestataire cette année, jamais réutilisé même si une facture plus récente
// est supprimée (ce module n'expose d'ailleurs aucune suppression).
function _nextInvoiceNumber(partnerId, invoices) {
    var year = new Date().getFullYear();
    var mine = invoices.filter(function(i) { return i.partner_id === partnerId && i.number && i.number.indexOf('F' + year + '-') === 0; });
    var n = mine.length + 1;
    return 'F' + year + '-' + String(n).padStart(4, '0');
}

// Une seule facture par commande, générée une fois que le versement final est réellement
// crédité (voir en-tête de fichier). Idempotente : rappelée plusieurs fois sans effet si une
// facture existe déjà pour cette order_id.
function generateInvoiceForOrder(order, partner, dispatch) {
    if (!order || !partner) return null;

    var invoices = loadInvoices();
    var existing = invoices.find(function(i) { return i.order_id === order.id; });
    if (existing) return existing;

    if (!partner.siret || !partner.billing_address) {
        return { pending_siret: true };
    }

    var clientInfo = order.client_info || {};
    var clientName = ((clientInfo.first_name || '') + ' ' + (clientInfo.last_name || '')).trim() || 'Client GENESIS';

    var invoice = {
        id: 'INV-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
        number: _nextInvoiceNumber(partner.id, invoices),
        order_id: order.id,
        dispatch_id: dispatch ? dispatch.id : null,
        partner_id: partner.id,
        partner_name: ((partner.prenom || '') + ' ' + (partner.nom || '')).trim(),
        partner_siret: partner.siret,
        partner_address: partner.billing_address,
        partner_email: partner.email,
        client_name: clientName,
        client_email: clientInfo.email || order.client_email || '',
        service_name: (dispatch && dispatch.offer_name) || order.product_name || 'Prestation GENESIS',
        amount: parseFloat(order.total_amount || 0),
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString()
    };
    invoices.push(invoice);
    saveInvoices(invoices);
    return invoice;
}

function _formatDate(iso) {
    try {
        return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return iso || ''; }
}

function generateInvoicePdfBuffer(invoice, callback) {
    try {
        var doc = new PDFDocument({ margin: 50, size: 'A4' });
        var buffers = [];
        doc.on('data', function(chunk) { buffers.push(chunk); });
        doc.on('end', function() { callback(null, Buffer.concat(buffers)); });
        doc.on('error', function(err) { callback(err); });

        var _logoDrawn = false;
        if (_LOGO_DATA_URI) {
            try {
                var _logoBuf = Buffer.from(_LOGO_DATA_URI.replace(/^data:image\/png;base64,/, ''), 'base64');
                var _logoW = 70;
                doc.image(_logoBuf, 50, 45, { width: _logoW });
                _logoDrawn = true;
            } catch (_e) { /* fallback */ }
        }

        doc.fontSize(20).font('Helvetica-Bold').fillColor('#000').text('FACTURE', 50, 50, { align: 'right' });
        doc.fontSize(10).font('Helvetica').fillColor('#444').text('N° ' + invoice.number, { align: 'right' });
        doc.text('Date d\'émission : ' + _formatDate(invoice.created_at), { align: 'right' });
        doc.moveDown(2);

        doc.strokeColor('#FFD700').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);

        // Émetteur (vendeur légal) / Destinataire — deux colonnes
        var _colY = doc.y;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#888').text('ÉMETTEUR', 50, _colY);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(invoice.partner_name, 50, _colY + 14);
        doc.fontSize(9).font('Helvetica').fillColor('#333')
            .text(invoice.partner_address || '', 50, doc.y + 2, { width: 240 });
        doc.text('SIRET : ' + invoice.partner_siret, 50, doc.y + 2);
        doc.text(invoice.partner_email || '', 50, doc.y + 2);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#888').text('CLIENT', 320, _colY);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(invoice.client_name, 320, _colY + 14);
        doc.fontSize(9).font('Helvetica').fillColor('#333').text(invoice.client_email || '', 320, doc.y + 2);

        doc.y = Math.max(doc.y, _colY + 90);
        doc.moveDown(1);
        doc.strokeColor('#eee').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);

        // Tableau prestation
        var _tableY = doc.y;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#888');
        doc.text('DÉSIGNATION', 50, _tableY);
        doc.text('RÉFÉRENCE', 330, _tableY);
        doc.text('MONTANT', 470, _tableY, { width: 75, align: 'right' });
        doc.moveDown(0.5);
        doc.strokeColor('#000').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        var _rowY = doc.y;
        doc.fontSize(10).font('Helvetica').fillColor('#000');
        doc.text(invoice.service_name, 50, _rowY, { width: 270 });
        doc.text(invoice.order_id || '', 330, _rowY, { width: 130 });
        doc.font('Helvetica-Bold').text(invoice.amount.toFixed(2) + ' €', 470, _rowY, { width: 75, align: 'right' });
        doc.moveDown(1.5);

        doc.strokeColor('#000').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica-Bold').text('TOTAL TTC', 330, doc.y, { width: 140, align: 'right' });
        doc.text(invoice.amount.toFixed(2) + ' €', 470, doc.y - 14, { width: 75, align: 'right' });
        doc.moveDown(1.5);

        doc.fontSize(9).font('Helvetica').fillColor('#444')
            .text('TVA non applicable, art. 293 B du Code général des impôts.', { align: 'left' });
        doc.moveDown(0.3);
        doc.fillColor('#4caf50').font('Helvetica-Bold')
            .text('Facture acquittée le ' + _formatDate(invoice.paid_at) + ' — réglée via GENESIS SAFE™.', { align: 'left' });
        doc.moveDown(1.5);

        doc.fontSize(8).font('Helvetica').fillColor('#888')
            .text('Cette facture est émise par le Prestataire ci-dessus, seul responsable de ses obligations fiscales et sociales. FA GENESIS agit uniquement comme intermédiaire de paiement (GENESIS SAFE™) entre le Client et le Prestataire et n\'est pas partie à la présente facture.', { align: 'left' });

        doc.end();
    } catch (e) {
        callback(e);
    }
}

module.exports = {
    loadInvoices,
    saveInvoices,
    generateInvoiceForOrder,
    generateInvoicePdfBuffer,
    INVOICES_FILE
};
