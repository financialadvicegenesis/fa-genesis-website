// panier.js - Systeme de panier FA GENESIS
// Stocke les IDs produit dans localStorage, jamais les prix (securite)

var PANIER_KEY = 'fa_genesis_panier';

/**
 * Lire le panier depuis localStorage
 */
function getPanier() {
    try {
        var data = localStorage.getItem(PANIER_KEY);
        if (data) {
            var parsed = JSON.parse(data);
            if (parsed && Array.isArray(parsed.items)) return parsed;
        }
    } catch (e) {
        console.error('[PANIER] Erreur lecture:', e);
    }
    return { items: [], updatedAt: null };
}

/**
 * Sauvegarder le panier dans localStorage
 */
function savePanier(panier) {
    try {
        panier.updatedAt = new Date().toISOString();
        localStorage.setItem(PANIER_KEY, JSON.stringify(panier));
        updatePanierBadge();
    } catch (e) {
        console.error('[PANIER] Erreur sauvegarde:', e);
    }
}

/**
 * Ajouter un produit au panier (empeche les doublons)
 */
function ajouterAuPanier(productId) {
    var panier = getPanier();
    for (var i = 0; i < panier.items.length; i++) {
        if (panier.items[i].id === productId) {
            showPanierToast('D\u00e9j\u00e0 dans votre panier', 'info');
            return;
        }
    }
    panier.items.push({ id: productId, qty: 1 });
    savePanier(panier);

    var offer = (typeof getOfferById === 'function') ? getOfferById(productId) : null;
    var nom = offer ? offer.nom : productId;
    showPanierToast(nom + ' ajout\u00e9 au panier', 'success');
}

/**
 * Retirer un produit du panier
 */
function retirerDuPanier(productId) {
    var panier = getPanier();
    panier.items = panier.items.filter(function(item) {
        return item.id !== productId;
    });
    savePanier(panier);
}

/**
 * Vider le panier
 */
function viderPanier() {
    savePanier({ items: [], updatedAt: null });
}

/**
 * Nombre d'items dans le panier
 */
function getPanierCount() {
    return getPanier().items.length;
}

/**
 * Total du panier en euros (via getOfferById)
 */
function getPanierTotal() {
    var panier = getPanier();
    var total = 0;
    for (var i = 0; i < panier.items.length; i++) {
        var offer = (typeof getOfferById === 'function') ? getOfferById(panier.items[i].id) : null;
        if (offer && offer.prixTotal > 0) {
            total += offer.prixTotal;
        }
    }
    return total;
}

/**
 * Acompte (30% du total)
 */
function getPanierDeposit() {
    return Math.round(getPanierTotal() * 0.30);
}

/**
 * Solde (70% du total)
 */
function getPanierBalance() {
    var total = getPanierTotal();
    return total - Math.round(total * 0.30);
}

/**
 * Verifie si le panier contient au moins un item "sur devis" (prix = 0)
 */
function panierContientDevis() {
    var panier = getPanier();
    for (var i = 0; i < panier.items.length; i++) {
        var offer = (typeof getOfferById === 'function') ? getOfferById(panier.items[i].id) : null;
        if (offer && offer.prixTotal === 0) return true;
    }
    return false;
}

/**
 * Verifie si TOUS les items sont "sur devis"
 */
function panierEstToutDevis() {
    var panier = getPanier();
    if (panier.items.length === 0) return false;
    for (var i = 0; i < panier.items.length; i++) {
        var offer = (typeof getOfferById === 'function') ? getOfferById(panier.items[i].id) : null;
        if (offer && offer.prixTotal > 0) return false;
    }
    return true;
}

/**
 * Mettre a jour le badge compteur du panier dans la nav
 */
function updatePanierBadge() {
    var count = getPanierCount();
    var badges = document.querySelectorAll('.panier-badge');
    for (var i = 0; i < badges.length; i++) {
        if (count > 0) {
            badges[i].textContent = count;
            badges[i].style.display = '';
        } else {
            badges[i].style.display = 'none';
        }
    }
}

/**
 * Afficher une notification toast temporaire
 */
function showPanierToast(msg, type) {
    // Supprimer un toast existant
    var existing = document.getElementById('panierToast');
    if (existing) existing.remove();

    var bgColor = type === 'success' ? '#4CAF50' : (type === 'info' ? '#2196F3' : '#FFD700');
    var textColor = type === 'success' || type === 'info' ? '#fff' : '#000';

    var toast = document.createElement('div');
    toast.id = 'panierToast';
    toast.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:99999;padding:16px 24px;'
        + 'background:' + bgColor + ';color:' + textColor + ';font-weight:900;font-size:14px;'
        + 'border:4px solid #000;box-shadow:6px 6px 0 #000;text-transform:uppercase;'
        + 'transition:opacity 0.3s;opacity:1;max-width:350px;';
    toast.innerHTML = '<i class="fas fa-shopping-cart" style="margin-right:8px;"></i>' + msg;

    document.body.appendChild(toast);

    setTimeout(function() {
        toast.style.opacity = '0';
        setTimeout(function() { toast.remove(); }, 300);
    }, 2500);
}

// Initialiser le badge au chargement
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updatePanierBadge);
    } else {
        updatePanierBadge();
    }
}
